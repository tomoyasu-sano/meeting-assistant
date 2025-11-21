"use client";

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { useTranslations } from 'next-intl';
import { getIndustryLabels } from "@/lib/constants/industries";

export type TermCard = {
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

export type Transcript = {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  startTime?: number;
  isFinal?: boolean;
};

type TermExplanationPaneProps = {
  meetingId: string;
  sessionId: string | null;
  isSessionActive: boolean;
  transcripts: Transcript[];
  sessionStartTime?: number;
  industries?: string[];
  onTermCardsChange?: (termCards: TermCard[]) => void;
};

export type TermExplanationPaneRef = {
  sendTranscript: (text: string) => void;
  termCards: TermCard[];
  activeTab: "terms" | "transcripts";
  setActiveTab: (tab: "terms" | "transcripts") => void;
};

export const TermExplanationPane = forwardRef<TermExplanationPaneRef, TermExplanationPaneProps>(
  ({ meetingId, sessionId, isSessionActive, transcripts, sessionStartTime, industries = [], onTermCardsChange }, ref) => {
    const t = useTranslations();
    const [activeTab, setActiveTab] = useState<"terms" | "transcripts">("terms");
    const [termCards, setTermCards] = useState<TermCard[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [hasShownWelcome, setHasShownWelcome] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const explainedTermsRef = useRef<Set<string>>(new Set());
    const contextSendIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const pendingBufferRef = useRef<string>("");
    const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
    const currentTurnRef = useRef<{
      text: string;
      search?: any;
      searchResult?: any;
      groundingMetadata?: any;
    }>({ text: "" });

    /**
     * 用語を正規化（重複判定用）
     */
    const normalizeTerm = (term: string): string => {
      return term
        .trim()
        .toLowerCase()
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0)
        );
    };

    /**
     * 既出用語リストをLive APIに送信
     */
    const sendExplainedTermsContext = useCallback(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (explainedTermsRef.current.size === 0) return;

      const explainedTermsList = [...explainedTermsRef.current];
      const contextMessage = {
        clientContent: {
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: `# 既に説明済みの用語リスト\n${JSON.stringify(explainedTermsList)}\n\n上記の用語はすでに説明済みなので、再度説明しないでください。`,
                },
              ],
            },
          ],
          turnComplete: true,
        },
      };

      wsRef.current.send(JSON.stringify(contextMessage));
      console.log("[TermPane] Sent explained terms:", explainedTermsList);
    }, []);

    /**
     * バッファをフラッシュしてLive APIに送信
     */
    const flushBuffer = useCallback(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (!pendingBufferRef.current.trim()) return;

      const bufferText = pendingBufferRef.current.trim();
      console.log("[TermPane] Flushing buffer:", bufferText);

      const message = {
        clientContent: {
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: `# 会議の直近の発話テキスト\n${bufferText}\n\n# 既に説明済みの用語リスト\n${JSON.stringify([...explainedTermsRef.current])}\n\n上記の発話内容から専門用語を抽出し、JSON配列形式で解説してください。`,
                },
              ],
            },
          ],
          turnComplete: true,
        },
      };

      wsRef.current.send(JSON.stringify(message));
      pendingBufferRef.current = "";

      // フラッシュタイマーをクリア
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    }, []);

    /**
     * 外部から呼ばれるTranscript送信メソッド
     */
    const sendTranscript = useCallback(
      (text: string) => {
        if (!text || !text.trim()) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log("[TermPane] WebSocket not ready, skipping transcript:", text);
          return;
        }

        pendingBufferRef.current += text + "\n";
        console.log("[TermPane] Transcript added to buffer:", text);

        // 250文字を超えたら即座にフラッシュ
        if (pendingBufferRef.current.length >= 250) {
          console.log("[TermPane] Buffer size exceeded 250, flushing");
          flushBuffer();
          return;
        }

        // 5秒のタイマーをリセット
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
        }

        flushTimerRef.current = setTimeout(() => {
          console.log("[TermPane] 5s timer elapsed, flushing");
          flushBuffer();
        }, 5000);
      },
      [flushBuffer]
    );

    // 外部に公開
    useImperativeHandle(ref, () => ({
      sendTranscript,
      termCards,
      activeTab,
      setActiveTab,
    }), [sendTranscript, termCards, activeTab]);

    /**
     * WebSocket接続
     */
    const connectWebSocket = useCallback(async () => {
      if (!sessionId || !meetingId) {
        console.log("[TermPane] Cannot connect: missing sessionId or meetingId");
        return;
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log("[TermPane] Already connected");
        return;
      }

      try {
        console.log("[TermPane] Starting connection...");
        setConnectionError(null);

        const response = await fetch("/api/gemini/live-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId,
            conversationHistory: "",
            meetingId: meetingId,
            profile: "terminology_helper",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to start term explanation session");
        }

        const { wsUrl, model } = await response.json();
        console.log("[TermPane] Connecting to:", wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[TermPane] ✅ WebSocket connected");

          // 業界コンテキストを生成
          const industryLabels = getIndustryLabels(industries);
          const industryContext = industryLabels.length > 0
            ? `\n**この会議の業界コンテキスト**:\n- 業界: ${industryLabels.join('、')}\n`
            : '\n**この会議の業界コンテキスト**:\n- 業界: 指定なし（一般）\n';

          const setupMessage = {
            setup: {
              model,
              generationConfig: {
                responseModalities: ["TEXT"],
              },
              systemInstruction: {
                parts: [
                  {
                    text: `あなたは「用語解説に特化した」会議のアシスタントです。
役割は、会議中に出てくる専門用語・略語・社外の人には伝わりづらい言葉を、
参加者がさっと読めるように、短くわかりやすく説明することです。
${industryContext}
**重要：業界コンテキストを考慮した解説**
- 上記の業界特有の用語には、その業界の文脈で解説してください
- 例: 「ADL」→ 介護業界なら「日常生活動作（食事、入浴、排泄など）」、IT業界なら文脈を考慮
- 業界外の人にも理解できるよう、かみ砕いた説明を心がけてください
- 業界が指定されていない場合は、最も一般的な意味を優先してください

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
]`,
                  },
                ],
              },
              tools: [{ googleSearch: {} }],
            },
          };

          console.log("[TermPane] Sending setup");
          ws.send(JSON.stringify(setupMessage));
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

            console.log("[TermPane] Message:", message);

            // Setup完了
            if (message.setupComplete) {
              console.log("[TermPane] ✅ Setup complete");

              // 初回のみウェルカムメッセージを表示
              if (!hasShownWelcome) {
                const welcomeCard: TermCard = {
                  id: `welcome-${Date.now()}`,
                  term: "📢 用語解説を開始",
                  description:
                    "会議中に専門用語が出てきたら、自動的に解説します。",
                  timestamp: new Date().toISOString(),
                };
                setTermCards([welcomeCard]);
                setHasShownWelcome(true);
              }

              // 既出用語リストを10秒ごとに送信
              contextSendIntervalRef.current = setInterval(() => {
                sendExplainedTermsContext();
              }, 10000);
            }

            // エラー
            if (message.error) {
              console.error("[TermPane] Server error:", message.error);
              setConnectionError("用語解説の接続に失敗しました");
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
                  console.log("[TermPane] Search executed");
                  currentTurnRef.current.search = part.executableCode;
                }
                // 検索結果
                if (part.codeExecutionResult) {
                  console.log("[TermPane] Search result received");
                  currentTurnRef.current.searchResult = part.codeExecutionResult;
                }
              }
            }

            // Grounding Metadata
            if (message.serverContent?.groundingMetadata) {
              currentTurnRef.current.groundingMetadata =
                message.serverContent.groundingMetadata;
              console.log(
                "[TermPane] Grounding metadata received",
                message.serverContent.groundingMetadata
              );
            }

            // Turn完了時にカードを確定
            if (message.serverContent?.turnComplete || message.usageMetadata) {
              setIsProcessing(false);

              const turnText = currentTurnRef.current.text.trim();
              if (turnText) {
                console.log("[TermPane] Turn complete:", turnText);

                try {
                  // ```json ... ``` のコードブロックを除去
                  let jsonText = turnText;
                  const jsonMatch = turnText.match(/```json\s*([\s\S]*?)\s*```/);
                  if (jsonMatch) {
                    jsonText = jsonMatch[1].trim();
                  } else if (
                    turnText.startsWith("```") &&
                    turnText.endsWith("```")
                  ) {
                    jsonText = turnText
                      .replace(/^```\w*\s*/, "")
                      .replace(/\s*```$/, "")
                      .trim();
                  }

                  const parsedTerms = JSON.parse(jsonText);

                  if (Array.isArray(parsedTerms)) {
                    if (parsedTerms.length === 0) {
                      console.log("[TermPane] Empty array received");
                    } else {
                      const newCards: TermCard[] = [];

                      parsedTerms.forEach((item: any) => {
                        if (item.term && item.description) {
                          // 重複チェック
                          const normalizedTerm = normalizeTerm(item.term);
                          if (explainedTermsRef.current.has(normalizedTerm)) {
                            console.log(
                              `[TermPane] Duplicate term skipped: ${item.term}`
                            );
                            return;
                          }

                          const newCard: TermCard = {
                            id: `term-${Date.now()}-${Math.random()}`,
                            term: item.term,
                            description: item.description,
                            timestamp: new Date().toISOString(),
                          };

                          // URL抽出（ログのみ）
                          if (currentTurnRef.current.groundingMetadata) {
                            const groundingMetadata =
                              currentTurnRef.current.groundingMetadata;
                            let extractedUrls: string[] = [];

                            if (
                              groundingMetadata.searchEntryPoint?.renderedContent
                            ) {
                              const renderedContent =
                                groundingMetadata.searchEntryPoint.renderedContent;
                              const urlMatches = renderedContent.match(
                                /https?:\/\/[^\s"'<>]+/g
                              );
                              if (urlMatches) {
                                extractedUrls = urlMatches;
                              }
                            }

                            if (groundingMetadata.groundingChunks) {
                              groundingMetadata.groundingChunks.forEach(
                                (chunk: any) => {
                                  if (chunk.web?.uri) {
                                    extractedUrls.push(chunk.web.uri);
                                  }
                                }
                              );
                            }

                            if (extractedUrls.length > 0) {
                              const uniqueUrls = [...new Set(extractedUrls)];
                              console.log("[TermPane] Search URLs:", uniqueUrls);
                            }
                          }

                          newCards.push(newCard);
                          explainedTermsRef.current.add(normalizedTerm);
                          console.log(`[TermPane] Card added: ${item.term}`);
                        }
                      });

                      if (newCards.length > 0) {
                        setTermCards((prev) => [...newCards, ...prev]);
                      }
                    }
                  } else {
                    throw new Error("配列形式ではありません");
                  }
                } catch (parseError) {
                  // JSONパースエラーはログのみ記録し、エラーカードは表示しない
                  // （実験版モデルの不安定性により、専門用語がない場合に発生することがある）
                  console.error("[TermPane] JSON parse error:", parseError);
                  console.error("[TermPane] Received text:", turnText);
                }

                currentTurnRef.current = {
                  text: "",
                  search: undefined,
                  searchResult: undefined,
                  groundingMetadata: undefined,
                };
              }
            }
          } catch (err) {
            console.error("[TermPane] Message parse error", err);
          }
        };

        ws.onerror = (err) => {
          console.error("[TermPane] WebSocket error", err);
          setConnectionError("用語解説の接続エラーが発生しました");
        };

        ws.onclose = () => {
          console.log("[TermPane] WebSocket closed");
          wsRef.current = null;

          // インターバルクリア
          if (contextSendIntervalRef.current) {
            clearInterval(contextSendIntervalRef.current);
            contextSendIntervalRef.current = null;
          }

          // フラッシュタイマークリア
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
        };
      } catch (err) {
        console.error("[TermPane] Connection error", err);
        setConnectionError("用語解説の起動に失敗しました");
      }
    }, [meetingId, sessionId, hasShownWelcome, sendExplainedTermsContext]);

    /**
     * WebSocket切断
     */
    const disconnectWebSocket = useCallback(() => {
      console.log("[TermPane] Disconnecting...");

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (contextSendIntervalRef.current) {
        clearInterval(contextSendIntervalRef.current);
        contextSendIntervalRef.current = null;
      }

      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      // 既出用語リストをクリア
      const explainedCount = explainedTermsRef.current.size;
      explainedTermsRef.current.clear();
      if (explainedCount > 0) {
        console.log(`[TermPane] Cleared ${explainedCount} explained terms`);
      }

      pendingBufferRef.current = "";
      setHasShownWelcome(false);
      setTermCards([]);
    }, []);

    // セッション開始時に接続
    useEffect(() => {
      if (isSessionActive && sessionId) {
        connectWebSocket();
      } else {
        disconnectWebSocket();
      }

      return () => {
        disconnectWebSocket();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSessionActive, sessionId]);

    // termCards が変更されたら親に通知
    useEffect(() => {
      if (onTermCardsChange) {
        onTermCardsChange(termCards);
      }
    }, [termCards, onTermCardsChange]);

    return (
      <div className="hidden h-full w-full flex-col border-l border-zinc-200 bg-white lg:flex lg:w-1/4">
        {/* エラートースト */}
        {connectionError && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2">
            <p className="text-xs text-red-700">{connectionError}</p>
          </div>
        )}

        {/* タブバー */}
        <div className="border-b border-zinc-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab("terms")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "terms"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {t('liveSession.terminologyTitle')}
            </button>
            <button
              onClick={() => setActiveTab("transcripts")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "transcripts"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {t('liveSession.transcriptTitle')}
            </button>
          </nav>
        </div>

        {/* 用語解説タブ */}
        {activeTab === "terms" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* 解析中インジケータ */}
            {isProcessing && (
              <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-2">
                <div className="flex items-center gap-2 text-xs text-indigo-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500"></span>
                  <span>{t('common.processing')}</span>
                </div>
              </div>
            )}

            {/* カード表示エリア */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {termCards.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <p className="text-sm text-zinc-500">
                    {t('liveSession.terminologyPrompt')}
                  </p>
                </div>
              ) : (
                termCards.map((card) => (
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
                ))
              )}
            </div>
          </div>
        )}

        {/* 文字起こしタブ */}
        {activeTab === "transcripts" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* カード表示エリア */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {transcripts.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <p className="text-sm text-zinc-500">
                    {t('liveSession.transcriptPrompt')}
                  </p>
                </div>
              ) : (
                transcripts.map((transcript) => (
                  <div
                    key={transcript.id}
                    className={`rounded-lg border p-4 ${
                      transcript.isFinal
                        ? "border-blue-200 bg-blue-50"
                        : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-900">
                        {transcript.speaker}
                        {!transcript.isFinal && (
                          <span className="ml-2 text-xs text-zinc-500">
                            (認識中...)
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {transcript.startTime !== undefined
                          ? `${Math.floor(transcript.startTime / 60)}:${String(Math.floor(transcript.startTime % 60)).padStart(2, "0")}`
                          : ""}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700">{transcript.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

TermExplanationPane.displayName = "TermExplanationPane";
