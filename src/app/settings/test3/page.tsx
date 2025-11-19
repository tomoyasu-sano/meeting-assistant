"use client";

import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { v4 as uuidv4 } from "uuid";

type Transcript = {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
};

export default function GeminiLiveTestPage() {
  const [sessionId] = useState(() => uuidv4());
  const [isRecording, setIsRecording] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ chunksUploaded: 0, bytesUploaded: 0 });
  const [isGeminiActive, setIsGeminiActive] = useState(false);
  const [isGeminiConnecting, setIsGeminiConnecting] = useState(false);
  const [shouldStreamAudio, setShouldStreamAudio] = useState(false);
  const [geminiResponse, setGeminiResponse] = useState<string>("");

  const eventSourceRef = useRef<EventSource | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pcmChunksRef = useRef<Int16Array[]>([]);
  const sequenceRef = useRef(0);
  const geminiWsRef = useRef<WebSocket | null>(null);

  const int16ToBase64 = (pcm: Int16Array) => {
    const view = new Uint8Array(
      pcm.buffer,
      pcm.byteOffset,
      pcm.byteLength
    );
    const chunk = 0x8000;
    let binary = "";
    for (let i = 0; i < view.length; i += chunk) {
      const sub = view.subarray(i, i + chunk);
      binary += String.fromCharCode(...sub);
    }
    return btoa(binary);
  };

  // 録音開始
  const startRecording = async () => {
    try {
      setError(null);
      setTranscripts([]);
      setStats({ chunksUploaded: 0, bytesUploaded: 0 });

      console.log("[Gemini Live Test] 🎤 Starting...", { sessionId });

      // 1. SSE接続（Google STT for トリガー検知）
      const eventSource = new EventSource(`/api/stt/test?sessionId=${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("ready", () => {
        console.log("[Gemini Live Test] ✅ SSE Ready");
      });

      eventSource.addEventListener("partial", (e) => {
        const data = JSON.parse(e.data);
        console.log("[Gemini Live Test] 📝 Partial:", data.text);

        const newTranscript: Transcript = {
          ...data,
          id: Date.now().toString(),
          speaker: "User",
          isFinal: false,
        };

        setTranscripts((prev) => {
          const filtered = prev.filter((t) => t.isFinal);
          return [...filtered, newTranscript];
        });
      });

      eventSource.addEventListener("final", (e) => {
        const data = JSON.parse(e.data);
        console.log("[Gemini Live Test] ✅ Final:", data.text);

        const newTranscript: Transcript = {
          ...data,
          id: Date.now().toString(),
          speaker: "User",
          isFinal: true,
        };

        setTranscripts((prev) => {
          const filtered = prev.filter((t) => t.isFinal);
          return [...filtered, newTranscript];
        });

        const wsReady =
          geminiWsRef.current &&
          geminiWsRef.current.readyState === WebSocket.OPEN;

        if (wsReady && data.text) {
          console.log("[Gemini Live] 📤 Sending user message:", data.text);
          geminiWsRef.current!.send(
            JSON.stringify({
              clientContent: {
                turns: [{ role: "user", parts: [{ text: data.text }] }],
                turnComplete: true,
              },
            })
          );
          console.log("[Gemini Live] ✅ User message sent");
          return;
        }

        if (
          !isGeminiActive &&
          !isGeminiConnecting &&
          data.text &&
          data.text.includes("アシスタント")
        ) {
          console.log(
            "[Gemini Live Test] 🎯 Trigger detected (starting session)!"
          );
          startGeminiLiveSession();
        }
      });

      eventSource.addEventListener("error", (e: any) => {
        console.error("[Gemini Live Test] ❌ SSE Error", e);
        setError("SSE connection error");
      });

      // 2. AudioWorklet setup
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioContextCtor = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext;
      const audioContext = new AudioContextCtor({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/worklets/pcm16-processor.js");

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "pcm16-processor");
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = ({ data }) => {
        if (data instanceof Int16Array) {
          pcmChunksRef.current.push(data);
        } else if (data?.buffer) {
          pcmChunksRef.current.push(new Int16Array(data.buffer));
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      console.log("[Gemini Live Test] 🎵 Audio pipeline ready");

      // 3. 500msごとにアップロード（Google STT用）
      uploadIntervalRef.current = setInterval(async () => {
        if (pcmChunksRef.current.length === 0) return;

        const chunks = pcmChunksRef.current.splice(0);
        const totalSamples = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Int16Array(totalSamples);

        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        const audioBlob = new Blob([combined.buffer], { type: "audio/pcm" });

        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("audio", audioBlob);
        formData.append("sequence", sequenceRef.current.toString());

        try {
          const response = await fetch("/api/stt/test-upload", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            setStats((prev) => ({
              chunksUploaded: prev.chunksUploaded + 1,
              bytesUploaded: prev.bytesUploaded + audioBlob.size,
            }));
            sequenceRef.current++;
          }
        } catch (uploadError) {
          console.error("[Gemini Live Test] Upload error", uploadError);
        }

        if (
          shouldStreamAudio &&
          geminiWsRef.current &&
          geminiWsRef.current.readyState === WebSocket.OPEN
        ) {
          try {
            const base64 = int16ToBase64(combined);
            geminiWsRef.current.send(
              JSON.stringify({
                realtimeInput: {
                  audio: {
                    data: base64,
                    mimeType: "audio/pcm;rate=16000",
                  },
                },
              })
            );
          } catch (err) {
            console.error("[Gemini Live] Failed to stream audio", err);
          }
        }
      }, 500);

      setIsRecording(true);
    } catch (err) {
      console.error("[Gemini Live Test] Start error", err);
      setError(err instanceof Error ? err.message : "Failed to start");
    }
  };

  // Gemini Live APIセッション開始
  const startGeminiLiveSession = async () => {
    if (isGeminiActive) {
      console.log("[Gemini Live] Already active");
      return;
    }

    try {
      console.log("[Gemini Live] 🚀 Starting session...");
      setIsGeminiConnecting(true);
      setIsGeminiActive(true);
      setGeminiResponse("");

      // 会話履歴の直近3つを取得
      const recentHistory = transcripts
        .filter((t) => t.isFinal)
        .slice(-3)
        .map((t) => `${t.speaker}: ${t.text}`)
        .join("\n");

      // Gemini Live API接続（WebSocket経由）
      const response = await fetch("/api/gemini/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          conversationHistory: recentHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start Gemini Live session");
      }

      const { wsUrl, model, config } = await response.json();
      console.log("[Gemini Live] Connecting to:", wsUrl);

      const ws = new WebSocket(wsUrl);
      geminiWsRef.current = ws;

      ws.onopen = () => {
        console.log("[Gemini Live] ✅ WebSocket connected");
        setIsGeminiConnecting(false);

        // Gemini Live APIセットアップメッセージを送信
        // APIリファレンスに従い、キャメルケース（camelCase）を使用
        const setupMessage = {
          setup: {
            model,
            generationConfig: {
              responseModalities: ["TEXT"],
            },
            systemInstruction: {
              parts: [{ text: config.systemInstruction }],
            },
          },
        };

        console.log("[Gemini Live] Sending setup:", setupMessage);
        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = async (event) => {
        try {
          // WebSocketメッセージはBlobまたはテキストで返ってくる
          let message;
          if (event.data instanceof Blob) {
            // Blobの場合はテキストに変換
            const text = await event.data.text();
            message = JSON.parse(text);
          } else {
            // 文字列の場合は直接パース
            message = JSON.parse(event.data);
          }

          console.log("[Gemini Live] Message:", message);

          // エラーレスポンス
          if (message.error) {
            console.error("[Gemini Live] Error from server:", message.error);
            setError(`Gemini Live error: ${message.error.message || JSON.stringify(message.error)}`);
            ws.close();
            return;
          }

          // セットアップ完了
          if (message.setupComplete) {
            console.log("[Gemini Live] ✅ Setup complete");
            setShouldStreamAudio(true);

            // セットアップ完了後、最初のメッセージを送信
            // 会話履歴の直近3つを含めて送信
            const recentHistory = transcripts
              .filter((t) => t.isFinal)
              .slice(-3)
              .map((t) => `${t.speaker}: ${t.text}`)
              .join("\n");

            const initialMessage = recentHistory
              ? `直近の会話:\n${recentHistory}\n\n上記を踏まえて応答してください。`
              : "はい、お話しください。";

            const clientContentMessage = {
              clientContent: {
                turns: [{ role: "user", parts: [{ text: initialMessage }] }],
                turnComplete: true,
              },
            };

            console.log("[Gemini Live] 📤 Sending clientContent:", {
              message: initialMessage.substring(0, 50) + "...",
              fullPayload: clientContentMessage,
            });

            // ClientContentメッセージを送信
            ws.send(JSON.stringify(clientContentMessage));

            console.log("[Gemini Live] ✅ Message sent, waiting for response...");
            return;
          }

          // サーバーコンテンツの処理
          if (message.serverContent) {
            console.log("[Gemini Live] 📥 Received serverContent:", message.serverContent);

            const { modelTurn, turnComplete, interrupted } = message.serverContent;

            // 割り込み検知
            if (interrupted) {
              console.log("[Gemini Live] ⚠️ Generation interrupted");
            }

            // モデルの応答を処理
            if (modelTurn) {
              console.log("[Gemini Live] 🤖 Model turn received", {
                fullModelTurn: modelTurn,
                hasParts: !!modelTurn.parts,
                partsIsArray: Array.isArray(modelTurn.parts),
                partsLength: modelTurn.parts?.length,
                partsKeys: modelTurn.parts ? Object.keys(modelTurn.parts) : [],
              });

              // テキストパートの処理
              if (modelTurn.parts) {
                // partsが配列かどうか確認
                const partsArray = Array.isArray(modelTurn.parts)
                  ? modelTurn.parts
                  : [modelTurn.parts];

                console.log("[Gemini Live] Processing parts:", partsArray);

                partsArray.forEach((part: any, index: number) => {
                  console.log(`[Gemini Live] Part ${index}:`, JSON.stringify(part));

                  if (part.text) {
                    console.log(`[Gemini Live] 📝 Text part ${index}:`, part.text);
                    // flushSyncを使って即座にレンダリング
                    flushSync(() => {
                      setGeminiResponse((prev) => prev + part.text);
                    });
                    console.log(`[Gemini Live] ✅ State updated and flushed to DOM`);
                  } else if (part.inlineData) {
                    console.log(`[Gemini Live] Part ${index} has inlineData (not text)`);
                  } else {
                    console.warn(`[Gemini Live] ⚠️ Part ${index} structure:`, Object.keys(part));
                  }
                });
              } else {
                console.warn("[Gemini Live] ⚠️ modelTurn has no parts");
              }
            }

            // ターン完了
            if (turnComplete) {
              console.log("[Gemini Live] ✅ Turn complete (session continues until manual stop)");
              // 手動で停止するまでセッション継続
            }
          }
        } catch (err) {
          console.error("[Gemini Live] Message parse error", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[Gemini Live] WebSocket error", err);
        setError("Gemini Live connection error");
      };

      ws.onclose = (event) => {
        console.log("[Gemini Live] WebSocket closed", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        setIsGeminiActive(false);
        setIsGeminiConnecting(false);
        setShouldStreamAudio(false);

        // エラーコードに応じたメッセージ
        if (event.code !== 1000) {
          setError(
            `WebSocket closed with code ${event.code}: ${event.reason || "Unknown error"}`
          );
        }
      };
    } catch (err) {
      console.error("[Gemini Live] Session start error", err);
      setError(err instanceof Error ? err.message : "Failed to start Gemini Live");
      setIsGeminiActive(false);
      setIsGeminiConnecting(false);
      setShouldStreamAudio(false);
    }
  };

  // 録音停止
  const stopRecording = () => {
    console.log("[Gemini Live Test] 🛑 Stopping...");

    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (geminiWsRef.current) {
      geminiWsRef.current.close();
      geminiWsRef.current = null;
    }

    setShouldStreamAudio(false);
    pcmChunksRef.current = [];
    sequenceRef.current = 0;
    setIsRecording(false);
    setIsGeminiActive(false);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Gemini Live API テスト
          </h1>
          <p className="mt-2 text-gray-600">
            「アシスタント」と言うとGemini Live APIが起動します
          </p>
        </div>

        {/* コントロール */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
          <div className="flex items-center gap-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="rounded-lg bg-red-600 px-6 py-3 text-white font-medium hover:bg-red-700 transition-colors"
              >
                🎤 録音開始
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="rounded-lg bg-gray-600 px-6 py-3 text-white font-medium hover:bg-gray-700 transition-colors"
              >
                ⏹️ 録音停止
              </button>
            )}

            {isRecording && (
              <div className="flex items-center gap-2 text-red-600">
                <span className="inline-block w-3 h-3 bg-red-600 rounded-full animate-pulse"></span>
                <span className="font-medium">録音中...</span>
              </div>
            )}

            {isGeminiActive && (
              <div className="flex items-center gap-2 text-blue-600">
                <span className="inline-block w-3 h-3 bg-blue-600 rounded-full animate-pulse"></span>
                <span className="font-medium">Gemini Live 起動中...</span>
              </div>
            )}
          </div>

          {/* 統計情報 */}
          {isRecording && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">アップロードチャンク数：</span>
                  <span className="font-mono font-semibold ml-2">
                    {stats.chunksUploaded}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">送信データ量：</span>
                  <span className="font-mono font-semibold ml-2">
                    {(stats.bytesUploaded / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* エラー */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {/* Gemini応答 */}
        {geminiResponse && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">
              🤖 Gemini応答
            </h2>
            <p className="text-gray-900">{geminiResponse}</p>
          </div>
        )}

        {/* 文字起こし結果 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            文字起こし結果
          </h2>

          <div className="min-h-[300px] space-y-3">
            {transcripts.length === 0 ? (
              <p className="text-gray-500">
                録音を開始すると、ここに文字起こし結果が表示されます
              </p>
            ) : (
              transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg ${
                    t.isFinal
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {t.speaker}
                    </span>
                    {!t.isFinal && (
                      <span className="text-xs text-gray-500">(認識中...)</span>
                    )}
                  </div>
                  <p className="text-gray-900">{t.text}</p>
                  {t.text.includes("アシスタント") && (
                    <span className="mt-2 inline-block text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      🎯 トリガー検知
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 説明 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm mt-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            このテストについて
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Google Cloud Speech-to-Text でトリガー検知</li>
            <li>• 「アシスタント」と言うと Gemini Live API が起動</li>
            <li>• 会話履歴の直近3つをプロンプトに含める</li>
            <li>• リアルタイム音声対話が可能</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
