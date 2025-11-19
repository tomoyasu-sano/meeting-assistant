"use client";

import { useState, useRef } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
};

type LogEntry = {
  timestamp: string;
  message: string;
  level: "info" | "error" | "success";
};

type ToolTrace = {
  timestamp: string;
  type: "function_call" | "function_response";
  functionName?: string;
  functionArgs?: any;
  result?: any;
};

export default function GeminiFunctionCallingTest() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toolTraces, setToolTraces] = useState<ToolTrace[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const addLog = (message: string, level: "info" | "error" | "success" = "info") => {
    const log: LogEntry = {
      timestamp: new Date().toLocaleTimeString("ja-JP"),
      message,
      level,
    };
    setLogs((prev) => [log, ...prev]);
    console.log(`[${level.toUpperCase()}]`, message);
  };

  const addToolTrace = (
    type: "function_call" | "function_response",
    data?: { functionName?: string; functionArgs?: any; result?: any }
  ) => {
    const trace: ToolTrace = {
      timestamp: new Date().toLocaleTimeString("ja-JP"),
      type,
      functionName: data?.functionName,
      functionArgs: data?.functionArgs,
      result: data?.result,
    };
    setToolTraces((prev) => [trace, ...prev]);
  };

  /**
   * Function呼び出しを処理
   */
  const handleFunctionCall = async (
    functionName: string,
    functionArgs: any,
    functionId: string,
    ws: WebSocket
  ) => {
    console.log(`[Function Call] 開始: ${functionName}`, { functionArgs, functionId });
    addLog(`🔄 Function実行開始: ${functionName}`, "info");
    addToolTrace("function_call", { functionName, functionArgs });

    let result: any;
    let hasError = false;

    try {
      if (functionName === "get_past_meeting_summary") {
        const query = functionArgs.query || "";
        const limit = functionArgs.limit || 1;
        // モックAPIを使用（動作確認用）
        const apiUrl = `/api/tools/mock-past-meeting-summary?query=${encodeURIComponent(query)}&limit=${limit}`;

        addLog(`📋 過去会議検索API呼び出し (MOCK): "${query}" (limit: ${limit})`);
        console.log(`[Function Call] API URL (MOCK): ${apiUrl}`);

        const response = await fetch(apiUrl);

        console.log(`[Function Call] API Response: status=${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Function Call] API Error: ${response.status} - ${errorText}`);
          addLog(`❌ API エラー: ${response.status} - ${errorText.substring(0, 100)}`, "error");
          result = { error: `API error: ${response.status}`, details: errorText };
          hasError = true;
        } else {
          result = await response.json();
          console.log(`[Function Call] API Success:`, result);
          addLog(`✅ 過去会議データ取得成功: ${result.meetings?.length || 0}件`, "success");
        }
      } else {
        addLog(`⚠️ 未知の関数: ${functionName}`, "error");
        console.warn(`[Function Call] Unknown function: ${functionName}`);
        result = { error: `Unknown function: ${functionName}` };
        hasError = true;
      }

    } catch (error) {
      console.error(`[Function Call] Exception:`, error);
      addLog(`❌ Function実行中の例外: ${error instanceof Error ? error.message : error}`, "error");
      result = {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      };
      hasError = true;
    }

    // 必ず toolTrace を追加
    addToolTrace("function_response", { functionName, result });
    console.log(`[Function Call] Tool trace added`, { functionName, result });

    // WebSocket状態を確認してから送信
    const wsState = ws.readyState;
    const wsStateText = wsState === WebSocket.OPEN ? "OPEN" :
                       wsState === WebSocket.CONNECTING ? "CONNECTING" :
                       wsState === WebSocket.CLOSING ? "CLOSING" : "CLOSED";

    console.log(`[Function Call] WebSocket state: ${wsState} (${wsStateText})`);

    if (wsState !== WebSocket.OPEN) {
      addLog(`⚠️ WebSocket が OPEN 状態ではありません: ${wsStateText}`, "error");
      console.error(`[Function Call] Cannot send response: WebSocket is ${wsStateText}`);
      return;
    }

    // Function Responseを送信
    const functionResponse = {
      toolResponse: {
        functionResponses: [
          {
            id: functionId,
            name: functionName,
            response: result,
          },
        ],
      },
    };

    try {
      console.log(`[Function Call] Sending functionResponse:`, functionResponse);
      addLog(`📤 Function Response送信: ${functionName}${hasError ? " (エラー含む)" : ""}`, hasError ? "error" : "success");
      ws.send(JSON.stringify(functionResponse));
      console.log(`[Function Call] Response sent successfully`);
      addLog(`✅ Function Response送信完了`, "success");
    } catch (sendError) {
      console.error(`[Function Call] Send error:`, sendError);
      addLog(`❌ Response送信エラー: ${sendError}`, "error");
    }
  };

  /**
   * Gemini Live APIに接続
   */
  const connectLiveAPI = async () => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    addLog("🔌 Live API接続を開始します...");

    try {
      // 1. WebSocket URLとツール設定を取得
      const response = await fetch("/api/gemini/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: `test5-${Date.now()}`,
          conversationHistory: "",
          meetingId: null,
          profile: "function_calling_demo",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get WebSocket URL");
      }

      const { wsUrl, model, tools, config } = await response.json();
      addLog(`✅ WebSocket URL取得成功: ${model}`, "success");
      if (tools) {
        addLog(`🔧 ツール設定取得: ${tools.length}個`, "success");
      }

      // 2. WebSocket接続
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        addLog("🟢 WebSocket接続成功", "success");
        setIsConnected(true);
        setIsConnecting(false);

        // 3. Setup messageを送信
        const setupMessage: any = {
          setup: {
            model,
            generationConfig: {
              responseModalities: ["TEXT"],
              temperature: 0.2,
              maxOutputTokens: 512,
            },
          },
        };

        // サーバーから取得したsystemInstructionとtoolsを使用
        if (config?.systemInstruction) {
          setupMessage.setup.systemInstruction = config.systemInstruction;
        }
        if (tools) {
          setupMessage.setup.tools = tools;
          addLog(`📤 Setup送信（ツール: ${tools.length}個）`);
        } else {
          addLog("📤 Setup送信");
        }

        ws.send(JSON.stringify(setupMessage));

        // 4. マイク起動
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

          addLog(`📥 メッセージ受信: ${JSON.stringify(message).substring(0, 100)}...`);

          // Setup完了
          if (message.setupComplete) {
            addLog("✅ Setup完了", "success");
          }

          // エラー
          if (message.error) {
            addLog(`❌ サーバーエラー: ${JSON.stringify(message.error)}`, "error");
          }

          // Tool Call（トップレベルに来る）
          if (message.toolCall?.functionCalls) {
            const functionCalls = message.toolCall.functionCalls;
            console.log(`[WebSocket] toolCall received:`, functionCalls);

            for (const call of functionCalls) {
              const { name, args, id } = call;
              addLog(`🔧 ToolCall受信: ${name}(${JSON.stringify(args).substring(0, 100)}...)`);
              console.log(`[WebSocket] Processing function call:`, { name, args, id });

              try {
                await handleFunctionCall(name, args, id, ws);
              } catch (error) {
                console.error(`[WebSocket] Function call error:`, error);
                addLog(`❌ Function実行エラー: ${error instanceof Error ? error.message : error}`, "error");
              }
            }
          }

          // Tool Call Cancellation
          if (message.toolCallCancellation) {
            addLog(`⚠️ ToolCall キャンセル: ${JSON.stringify(message.toolCallCancellation)}`, "error");
            console.warn(`[WebSocket] toolCallCancellation:`, message.toolCallCancellation);
          }

          // Model応答
          if (message.serverContent?.modelTurn?.parts) {
            const parts = message.serverContent.modelTurn.parts;
            let responseText = "";

            // Function呼び出しを逐次処理
            for (const part of parts) {
              if (part.text) {
                responseText += part.text;
              }

              // Function呼び出し（awaitで完了を待つ）
              if (part.functionCall) {
                const { name, args, id } = part.functionCall;
                addLog(`🔧 関数呼び出し検知: ${name}(${JSON.stringify(args).substring(0, 100)}...)`);
                try {
                  await handleFunctionCall(name, args, id, ws);
                } catch (error) {
                  addLog(`❌ Function実行エラー: ${error instanceof Error ? error.message : error}`, "error");
                }
              }
            }

            if (responseText) {
              const aiMessage: Message = {
                role: "assistant",
                text: responseText,
                timestamp: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, aiMessage]);
              addLog(`✅ AI応答: ${responseText.substring(0, 50)}...`, "success");
            }
          }

          // Turn完了
          if (message.serverContent?.turnComplete) {
            addLog("✅ Turn完了", "success");
          }

        } catch (err) {
          addLog(`❌ メッセージ解析エラー: ${err}`, "error");
        }
      };

      ws.onerror = (event) => {
        addLog(`❌ WebSocketエラー: ${JSON.stringify(event)}`, "error");
        console.error("[Gemini Live] WebSocket error", event);
      };

      ws.onclose = (event) => {
        addLog(`🔌 WebSocket切断: code=${event.code}, reason=${event.reason || "不明"}`, "error");
        if (event.code === 1006) {
          addLog("⚠️ code 1006: ツール定義を確認してください", "error");
        }
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

      addLog("🎤 録音開始", "success");

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

    addLog("🎤 録音停止");
  };

  /**
   * 切断
   */
  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopRecording();
    setIsConnected(false);
    addLog("🔌 切断しました");
  };

  /**
   * ログクリア
   */
  const clearAll = () => {
    setMessages([]);
    setLogs([]);
    setToolTraces([]);
    addLog("🗑️ ログをクリアしました");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">
          Gemini Live API - Function Calling テスト
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          音声入力でFunction Callingを検証します。「過去の会議について教えて」と話しかけてください。
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
              {isConnecting ? "接続中..." : "接続"}
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
            {isConnected ? "接続中 (マイク録音中)" : "未接続"}
          </span>

          <button
            onClick={clearAll}
            className="ml-auto rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            ログクリア
          </button>
        </div>
      </section>

      {/* Tool Trace */}
      <section className="rounded-2xl border border-purple-200 bg-purple-50 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-purple-900">
          🔧 Tool Trace - Function Calling履歴
        </h2>
        {toolTraces.length === 0 ? (
          <p className="text-sm text-purple-700">
            まだ関数は呼び出されていません
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {toolTraces.map((trace, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-4 ${
                  trace.type === "function_call"
                    ? "border-purple-300 bg-white"
                    : "border-indigo-300 bg-indigo-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                      trace.type === "function_call"
                        ? "bg-purple-200 text-purple-900"
                        : "bg-indigo-200 text-indigo-900"
                    }`}
                  >
                    {trace.type === "function_call" ? "🛠 Function Call" : "✅ Function Response"}
                  </span>
                  <span className="text-xs text-zinc-500">{trace.timestamp}</span>
                </div>

                {trace.type === "function_call" && (
                  <div className="mt-3 text-sm text-purple-900 space-y-2">
                    <div><strong>関数:</strong> {trace.functionName}</div>
                    {trace.functionArgs && (
                      <div>
                        <strong>引数:</strong>
                        <pre className="mt-1 text-xs bg-white border border-purple-200 rounded p-2 overflow-x-auto">
                          <code>{JSON.stringify(trace.functionArgs, null, 2)}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {trace.type === "function_response" && trace.result && (
                  <div className="mt-3 text-sm text-indigo-900">
                    <strong>結果:</strong>
                    <pre className="mt-1 text-xs bg-white border border-indigo-200 rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto">
                      <code>{JSON.stringify(trace.result, null, 2)}</code>
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* メッセージログ */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">会話ログ</h2>
          {messages.length === 0 ? (
            <p className="text-sm text-zinc-500">まだメッセージはありません</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-blue-50 text-blue-900"
                      : "bg-green-50 text-green-900"
                  }`}
                >
                  <div className="text-xs font-semibold mb-1">
                    {msg.role === "user" ? "👤 User" : "🤖 Assistant"}
                  </div>
                  <div className="text-sm">{msg.text}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 接続ログ */}
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">接続ログ</h2>
          <div className="space-y-1 max-h-[400px] overflow-y-auto text-xs font-mono">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`${
                  log.level === "error"
                    ? "text-red-600"
                    : log.level === "success"
                    ? "text-green-600"
                    : "text-zinc-600"
                }`}
              >
                <span className="text-zinc-400">[{log.timestamp}]</span> {log.message}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
