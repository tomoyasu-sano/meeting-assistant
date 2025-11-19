"use client";

import { useState, useRef } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  source?: "voice" | "ai"; // 音声入力かAI応答かを区別
};

type LogEntry = {
  timestamp: string;
  message: string;
  level: "info" | "error" | "success";
};

type ToolTrace = {
  timestamp: string;
  type: "search_executed" | "search_result";
  code?: string;
  result?: any;
};

type TermCard = {
  id: string;
  term: string;
  description: string;
  timestamp: string;
  searchMeta?: {
    query?: string;
    snippet?: string;
    sourceTitle?: string;
    sourceUrl?: string;
  };
};

export default function GeminiLiveSearchTest() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toolTraces, setToolTraces] = useState<ToolTrace[]>([]);
  const [termCards, setTermCards] = useState<TermCard[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<any[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const currentTurnRef = useRef<{
    text: string;
    search?: any;
    searchResult?: any;
    groundingMetadata?: any;
  }>({ text: "" });
  const explainedTermsRef = useRef<Set<string>>(new Set());
  const contextSendIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (message: string, level: "info" | "error" | "success" = "info") => {
    const log: LogEntry = {
      timestamp: new Date().toLocaleTimeString("ja-JP"),
      message,
      level,
    };
    setLogs((prev) => [log, ...prev]);
    console.log(`[${level.toUpperCase()}]`, message);
  };

  const addToolTrace = (type: "search_executed" | "search_result", data?: { code?: string; result?: any }) => {
    const trace: ToolTrace = {
      timestamp: new Date().toLocaleTimeString("ja-JP"),
      type,
      code: data?.code,
      result: data?.result,
    };
    setToolTraces((prev) => [trace, ...prev]);
  };

  /**
   * 用語を正規化（重複判定用）
   * - トリム
   * - 小文字化
   * - 全角英数字を半角に変換
   */
  const normalizeTerm = (term: string): string => {
    return term
      .trim()
      .toLowerCase()
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  };

  /**
   * 既出用語リストをLive APIに送信
   */
  const sendExplainedTermsContext = (ws: WebSocket) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (explainedTermsRef.current.size === 0) return;

    const explainedTermsList = [...explainedTermsRef.current];
    const contextMessage = {
      clientContent: {
        turns: [{
          role: "user",
          parts: [{
            text: `# 既に説明済みの用語リスト\n${JSON.stringify(explainedTermsList)}\n\n上記の用語はすでに説明済みなので、再度説明しないでください。`
          }]
        }],
        turnComplete: true
      }
    };

    ws.send(JSON.stringify(contextMessage));
    addLog(`📋 既出用語リスト送信: ${explainedTermsList.length}件`, "info");
    console.log("[既出用語] 送信リスト:", explainedTermsList);
  };

  const connectLiveAPI = async () => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    addLog("🔌 Live API接続を開始します...");

    try {
      // 1. WebSocket URLとトークンを取得
      const response = await fetch("/api/gemini/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: `test4-${Date.now()}`,
          conversationHistory: "",
          meetingId: null,
          profile: "assistant",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get WebSocket URL");
      }

      const { wsUrl, model } = await response.json();
      addLog(`✅ WebSocket URL取得成功: ${model}`);

      // 2. WebSocket接続
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        addLog("🟢 WebSocket接続成功", "success");
        setIsConnected(true);
        setIsConnecting(false);

        // 3. Setup messageを送信（用語解説特化型 + Google Search有効化）
        const setupMessage = {
          setup: {
            model: model,
            generationConfig: {
              responseModalities: ["TEXT"],
            },
            systemInstruction: {
              parts: [{
                text: `あなたは「用語解説に特化した」会議のアシスタントです。
役割は、会議中に出てくる専門用語・略語・社外の人には伝わりづらい言葉を、
参加者がさっと読めるように、短くわかりやすく説明することです。

**重要：必ずJSON配列形式で出力してください**

出力フォーマット（必須）:
[
  { "term": "用語1", "description": "短い説明文1" },
  { "term": "用語2", "description": "短い説明文2" }
]

制約:
- 必ず上記のJSON配列形式で出力してください。それ以外の形式は禁止です。
- 説明文は1〜2文で簡潔にまとめてください。
- 日本語で説明してください。
- すでに同じ会議内で説明した用語は、再度説明しないでください（既出用語リストが渡されます）。
- 会議の文脈に合わせて、もっとも一般的で自然な意味を優先してください。
- 経営層〜若手社員までがいる前提で、専門用語をかみ砕いた説明にしてください。

**重要な動作ルール:**
- 挨拶（こんにちは、おはようございます、など）や雑談には一切反応しないでください。
- 専門用語が含まれていない発話には、空配列 [] を返してください。
- 自分から会話を始めたり、質問をしたりしないでください。
- あなたの役割は「用語解説のみ」です。それ以外の応答は禁止です。

**Google検索の使用基準（重要）:**
- 一般的なIT用語（SaaS、DX、KPI、AIなど）は、あなたの知識で解説してください。検索は不要です。
- 以下の場合のみGoogle検索を使用してください：
  1. 専門的な業界用語（医療・介護・法律など）
  2. 最新の制度変更や法改正に関する用語
  3. あなたの知識にない新しい概念や技術
  4. 地域固有の用語や組織名
- 一般的な用語を検索する必要はありません。

**空配列の返却について:**
- 説明する用語がない場合のみ空配列 [] を返してください。
- ただし、専門用語が含まれている場合は必ず解説してください。

出力例:
[
  { "term": "SaaS", "description": "Software as a Serviceの略。インターネット経由でソフトウェアを提供するビジネスモデルです。" },
  { "term": "BPSD", "description": "認知症の行動・心理症状のこと。不安や徘徊、暴力などの症状を指します。" }
]`
              }],
            },
            tools: [{ googleSearch: {} }], // ← Google Search有効化
          },
        };

        addLog("📤 Setup送信（用語解説特化型 + Google Search有効化）");
        ws.send(JSON.stringify(setupMessage));

        // 4. マイク録音開始
        await startRecording(ws);
      };

      ws.onmessage = async (event) => {
        try {
          let message;
          if (event.data instanceof Blob) {
            const text = await event.data.text();
            message = JSON.parse(text);
          } else {
            message = JSON.parse(event.data);
          }

          messageQueueRef.current.push(message);
          addLog(`📥 メッセージ受信: ${JSON.stringify(message).substring(0, 100)}...`);

          // Setup完了
          if (message.setupComplete) {
            addLog("✅ Setup完了", "success");

            // 初回のみウェルカムメッセージを表示
            if (!hasShownWelcome) {
              const welcomeCard: TermCard = {
                id: `welcome-${Date.now()}`,
                term: "📢 用語解説を開始",
                description: "会議中に専門用語が出てきたら、自動的に解説します。",
                timestamp: new Date().toISOString(),
              };
              setTermCards([welcomeCard]);
              setHasShownWelcome(true);
              addLog("📢 ウェルカムメッセージを表示", "success");
            }
          }

          // エラー
          if (message.error) {
            addLog(`❌ サーバーエラー: ${JSON.stringify(message.error)}`, "error");
          }

          // Model応答
          if (message.serverContent?.modelTurn?.parts) {
            const parts = message.serverContent.modelTurn.parts;
            setIsProcessing(true);

            for (const part of parts) {
              // テキストを蓄積
              if (part.text) {
                currentTurnRef.current.text += part.text;
              }
              // Google Search実行コード
              if (part.executableCode) {
                const code = part.executableCode.code;
                addLog(`🔍 Google Search実行コード検出: ${code.substring(0, 100)}...`);
                console.log("[Google Search] executableCode:", part.executableCode);
                addToolTrace("search_executed", { code });
                currentTurnRef.current.search = { code };
              }
              // 検索結果
              if (part.codeExecutionResult) {
                const result = part.codeExecutionResult;
                addLog(`📊 検索結果受信: outcome=${result.outcome || "不明"}`);
                console.log("[Google Search] codeExecutionResult 全体:", JSON.stringify(result, null, 2));

                // output フィールドの詳細ログ
                if (result.output) {
                  console.log("[Google Search] output フィールド:", result.output);
                  addLog(`📄 検索output: ${result.output.substring(0, 200)}...`);
                }

                addToolTrace("search_result", { result });
                currentTurnRef.current.searchResult = result;
              }
            }
          }

          // Turn完了時にカードを確定
          if (message.serverContent?.turnComplete || message.usageMetadata) {
            setIsProcessing(false);

            const turnText = currentTurnRef.current.text.trim();
            if (turnText) {
              addLog(`✅ Turn完了: ${turnText.substring(0, 50)}...`);

              try {
                // ```json ... ``` のコードブロックを除去
                let jsonText = turnText;
                const jsonMatch = turnText.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                  jsonText = jsonMatch[1].trim();
                } else if (turnText.startsWith('```') && turnText.endsWith('```')) {
                  jsonText = turnText.replace(/^```\w*\s*/, '').replace(/\s*```$/, '').trim();
                }

                // JSON配列としてパース
                const parsedTerms = JSON.parse(jsonText);

                if (Array.isArray(parsedTerms)) {
                  if (parsedTerms.length === 0) {
                    addLog(`ℹ️ 用語なし（空配列を受信）`);
                  } else {
                    parsedTerms.forEach((item: any) => {
                      if (item.term && item.description) {
                        // 重複チェック
                        const normalizedTerm = normalizeTerm(item.term);
                        if (explainedTermsRef.current.has(normalizedTerm)) {
                          addLog(`⏭️ 既出用語をスキップ: ${item.term}`, "info");
                          console.log(`[重複スキップ] ${item.term} (正規化: ${normalizedTerm})`);
                          return; // 既出ならスキップ
                        }

                        const newCard: TermCard = {
                          id: `term-${Date.now()}-${Math.random()}`,
                          term: item.term,
                          description: item.description,
                          timestamp: new Date().toISOString(),
                        };

                        // Grounding Metadataから検索メタを追加
                        if (currentTurnRef.current.groundingMetadata) {
                          const groundingMetadata = currentTurnRef.current.groundingMetadata;
                          let extractedUrls: string[] = [];

                          // searchEntryPointからURLを抽出
                          if (groundingMetadata.searchEntryPoint?.renderedContent) {
                            const renderedContent = groundingMetadata.searchEntryPoint.renderedContent;
                            const urlMatches = renderedContent.match(/https?:\/\/[^\s"'<>]+/g);
                            if (urlMatches) {
                              extractedUrls = urlMatches;
                            }
                          }

                          // groundingChunksからもURLを抽出
                          if (groundingMetadata.groundingChunks) {
                            groundingMetadata.groundingChunks.forEach((chunk: any) => {
                              if (chunk.web?.uri) {
                                extractedUrls.push(chunk.web.uri);
                              }
                            });
                          }

                          if (extractedUrls.length > 0) {
                            // 重複を除去
                            const uniqueUrls = [...new Set(extractedUrls)];
                            // ログにのみ出力（画面表示はしない）
                            addLog(`🔗 検索URL検出: ${uniqueUrls.length}件`, "success");
                            console.log("[検索結果URL] 抽出されたURL一覧:", uniqueUrls);
                            if (groundingMetadata.groundingChunks) {
                              console.log("[検索結果詳細] groundingChunks:", groundingMetadata.groundingChunks);
                            }
                          } else {
                            console.log("[検索結果] URLなし（AIの知識のみで回答）");
                          }
                        }

                        setTermCards((prev) => [newCard, ...prev]);
                        // 既出用語リストに追加
                        explainedTermsRef.current.add(normalizedTerm);
                        addLog(`📝 用語カード追加: ${item.term}`, "success");
                        console.log(`[既出用語追加] ${item.term} (正規化: ${normalizedTerm})`);
                      }
                    });
                  }
                } else {
                  throw new Error("配列形式ではありません");
                }
              } catch (parseError) {
                // JSONパースに失敗した場合は詳細ログに表示し、用語カード（エラー）として追加
                addLog(`⚠️ JSON パースエラー: ${parseError}`, "error");
                addLog(`受信テキスト: ${turnText.substring(0, 200)}...`, "error");

                // エラーカードとして表示
                const errorCard: TermCard = {
                  id: `error-${Date.now()}`,
                  term: "⚠️ パースエラー",
                  description: `AIからの応答をJSON形式として解析できませんでした。応答: ${turnText.substring(0, 100)}...`,
                  timestamp: new Date().toISOString(),
                };
                setTermCards((prev) => [errorCard, ...prev]);
              }

              // currentTurnRefをリセット
              currentTurnRef.current = { text: "", search: undefined, searchResult: undefined, groundingMetadata: undefined };
            }
          }

          // Grounding Metadata（検索結果メタデータ）
          if (message.serverContent?.groundingMetadata) {
            const groundingMetadata = message.serverContent.groundingMetadata;
            addLog(`🌐 Grounding Metadata受信`);
            console.log("[Grounding] groundingMetadata全体:", JSON.stringify(groundingMetadata, null, 2));
            currentTurnRef.current.groundingMetadata = groundingMetadata;

            // searchEntryPointからURLを抽出
            if (groundingMetadata.searchEntryPoint?.renderedContent) {
              const renderedContent = groundingMetadata.searchEntryPoint.renderedContent;
              console.log("[Grounding] renderedContent:", renderedContent.substring(0, 500));

              // HTMLからURLを抽出
              const urlMatches = renderedContent.match(/https?:\/\/[^\s"'<>]+/g);
              if (urlMatches && urlMatches.length > 0) {
                addLog(`🔗 検索結果URL検出: ${urlMatches.length}件`);
                console.log("[Grounding] 抽出されたURL:", urlMatches);
              }
            }

            // groundingChunksからもURLを抽出
            if (groundingMetadata.groundingChunks) {
              console.log("[Grounding] groundingChunks:", groundingMetadata.groundingChunks);
            }
          }

          // User Transcriptを会話ログに追加（音声認識結果）
          if (message.serverContent?.userTurn?.parts) {
            const parts = message.serverContent.userTurn.parts;
            let userTranscript = "";

            for (const part of parts) {
              if (part.text) {
                userTranscript += part.text;
              }
            }

            if (userTranscript) {
              addLog(`🎤 ユーザー発話検知: ${userTranscript.substring(0, 50)}...`);
              const userMessage: Message = {
                role: "user",
                text: userTranscript,
                timestamp: new Date().toISOString(),
                source: "voice",
              };
              setMessages((prev) => [...prev, userMessage]);
            }
          }


        } catch (err) {
          addLog(`❌ メッセージ解析エラー: ${err}`, "error");
        }
      };

      ws.onerror = (err) => {
        addLog(`❌ WebSocketエラー: ${err}`, "error");
      };

      ws.onclose = (event) => {
        addLog(`🔌 WebSocket切断: code=${event.code}, reason=${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);
        stopRecording();
        wsRef.current = null;
      };

    } catch (err) {
      addLog(`❌ 接続エラー: ${err instanceof Error ? err.message : err}`, "error");
      setIsConnecting(false);
    }
  };

  /**
   * マイク録音開始（AudioWorklet使用）
   */
  const startRecording = async (ws: WebSocket) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      addLog("⚠️ WebSocketが接続されていません", "error");
      return;
    }

    try {
      addLog("🎤 マイク起動中...");

      // マイク権限取得
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      mediaStreamRef.current = stream;

      // AudioContext & AudioWorklet初期化
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/worklets/pcm16-processor.js");
      addLog("✅ AudioWorklet読み込み成功");

      const workletNode = new AudioWorkletNode(audioContext, "pcm16-processor");
      workletNodeRef.current = workletNode;

      // Workletからの音声データを受信してWebSocketで送信
      workletNode.port.onmessage = (event) => {
        const pcm16Data = event.data; // Int16Array

        if (ws.readyState === WebSocket.OPEN) {
          // Int16Array → Uint8Array → Base64
          const uint8 = new Uint8Array(pcm16Data.buffer);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64Audio = btoa(binary);

          // WebSocket経由でGemini Live APIに送信
          ws.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                data: base64Audio,
                mimeType: "audio/pcm;rate=16000"
              }]
            }
          }));
        }
      };

      // 音声パイプライン接続
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(workletNode);

      setIsRecording(true);
      addLog("🎤 録音開始", "success");

      // 既出用語リストを10秒ごとに送信
      contextSendIntervalRef.current = setInterval(() => {
        sendExplainedTermsContext(ws);
      }, 10000); // 10秒ごと

    } catch (error) {
      addLog(`❌ マイクエラー: ${error}`, "error");
      stopRecording();
    }
  };

  /**
   * マイク録音停止
   */
  const stopRecording = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // インターバルクリア
    if (contextSendIntervalRef.current) {
      clearInterval(contextSendIntervalRef.current);
      contextSendIntervalRef.current = null;
    }

    setIsRecording(false);
    addLog("🎤 録音停止");
  };

  const disconnect = () => {
    stopRecording();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setHasShownWelcome(false);

    // 既出用語リストをクリア（会議終了時にリセット）
    const explainedCount = explainedTermsRef.current.size;
    explainedTermsRef.current.clear();
    addLog("🔌 切断しました");
    if (explainedCount > 0) {
      addLog(`🗑️ 既出用語リストをクリア: ${explainedCount}件`, "info");
      console.log("[既出用語] セッション終了によりクリア");
    }
  };

  const clearAll = () => {
    setMessages([]);
    setLogs([]);
    setToolTraces([]);
    setTermCards([]);
    setHasShownWelcome(false);
    currentTurnRef.current = { text: "", search: undefined, searchResult: undefined, groundingMetadata: undefined };
    addLog("🗑️ ログをクリアしました");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">
          Gemini Live API - 音声入力 × 用語解説アシスタント
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          音声入力で専門用語の解説を取得できるか検証します。
          接続後、マイクに向かって専門用語を含む文章を話しかけてください。
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          例: 「SaaSのビジネスモデルについて」「DXの推進について」「KPIの設定について」
        </p>
      </header>

      {/* 接続コントロール */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {!isConnected ? (
            <button
              onClick={connectLiveAPI}
              disabled={isConnecting}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isConnecting ? "接続中..." : "Live API に接続"}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white hover:bg-red-700"
            >
              切断
            </button>
          )}

          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              isConnected
                ? "bg-green-100 text-green-800"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "animate-pulse bg-green-600" : "bg-zinc-400"
              }`}
            ></span>
            {isConnected ? "接続中" : "未接続"}
          </span>

          <button
            onClick={clearAll}
            className="ml-auto rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            ログクリア
          </button>
        </div>
      </section>

      {/* 音声入力状態表示 */}
      {isConnected && (
        <section className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-green-900">
            🎤 音声入力
          </h2>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${isRecording ? 'text-green-700' : 'text-zinc-500'}`}>
              <span className={`h-3 w-3 rounded-full ${isRecording ? 'animate-pulse bg-red-500' : 'bg-zinc-400'}`}></span>
              <span className="text-sm font-medium">
                {isRecording ? "録音中 - 話しかけてください" : "録音停止中"}
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-green-700">
            試してみる質問: 「SaaSのビジネスモデルについて」「DXの推進について」「KPIの設定について」
          </p>
        </section>
      )}

      {/* ツールトレース（Google Search実行状況） */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-amber-900">
          🔍 Tool Trace - Google Search実行履歴
        </h2>
        {toolTraces.length === 0 ? (
          <div className="text-sm text-amber-700">
            <p className="mb-2">まだGoogle Searchは実行されていません</p>
            <p className="text-xs text-amber-600">
              質問を送信すると、AIが必要に応じてGoogle Searchを使用します
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {toolTraces.map((trace, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-4 ${
                  trace.type === "search_executed"
                    ? "border-blue-300 bg-blue-50"
                    : "border-green-300 bg-green-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                      trace.type === "search_executed"
                        ? "bg-blue-200 text-blue-900"
                        : "bg-green-200 text-green-900"
                    }`}
                  >
                    {trace.type === "search_executed" ? "🔍 Search Executed" : "📊 Search Result"}
                  </span>
                  <span className="text-xs text-zinc-500">{trace.timestamp}</span>
                </div>

                {trace.type === "search_executed" && trace.code && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-blue-900 mb-1">実行コード:</div>
                    <pre className="text-xs bg-white border border-blue-200 rounded p-2 overflow-x-auto">
                      <code className="text-blue-800">{trace.code}</code>
                    </pre>
                  </div>
                )}

                {trace.type === "search_result" && trace.result && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-green-900 mb-1">検索結果:</div>
                    <pre className="text-xs bg-white border border-green-200 rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto">
                      <code className="text-green-800">{JSON.stringify(trace.result, null, 2)}</code>
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 用語解説カード */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">用語解説</h2>
            {isProcessing && (
              <span className="text-xs text-indigo-600">用語解析中...</span>
            )}
          </div>
          {termCards.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-zinc-500">会議中に出た用語はこちらに表示されます</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {termCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-semibold text-indigo-900">
                      {card.term}
                    </h3>
                    <span className="text-xs text-zinc-500">
                      {new Date(card.timestamp).toLocaleTimeString("ja-JP")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-700">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 詳細ログ */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            詳細ログ
          </h2>
          {logs.length === 0 ? (
            <p className="text-sm text-zinc-500">まだログがありません</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto font-mono text-xs">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`rounded border p-2 ${
                    log.level === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : log.level === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700"
                  }`}
                >
                  [{log.timestamp}] {log.message}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
