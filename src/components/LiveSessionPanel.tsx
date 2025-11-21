"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from 'next-intl';
import { useAIMode } from "@/contexts/AIModeContext";
import { useRealtimeAI } from "@/hooks/useRealtimeAI";
import { useGoogleAI } from "@/hooks/useGoogleAI";
import { LoadingModal } from "@/components/LoadingModal";
import SessionSummary from "@/components/SessionSummary";
import { AIResponseRecorder } from "@/lib/ai/ai-message-recorder";
import type { AIMode } from "@/lib/ai/ai-message-recorder";
import { TermExplanationPane, TermExplanationPaneRef, TermCard } from "@/components/TermExplanationPane";
import { HistoryTab } from "@/components/HistoryTab";
import { EvaluationTab } from "@/components/EvaluationTab";
import ReactMarkdown from "react-markdown";

type Transcript = {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  startTime?: number;
  isFinal?: boolean;
};

type AIMessage = {
  id: string;
  text: string;
  timestamp: string;
  type: "suggestion" | "response";
};

type TerminologyMessage = {
  id: string;
  text: string;
  timestamp: string;
};

type AssistMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
  metadata?: {
    type?: "auto-summary" | "manual" | "checkpoint";
    sourceRange?: { from: string; to: string };
  };
};

type TranscriptEvent = {
  type: "transcript" | "connected" | "end";
  id?: string;
  speaker?: string;
  text?: string;
  timestamp?: string;
  startTime?: number;
  meetingId?: string;
  message?: string;
};

type SessionStatus = "idle" | "active" | "paused" | "ended";

type Session = {
  id: string;
  meeting_id: string;
  started_at: string;
  ended_at: string | null;
  status: "active" | "paused" | "ended";
  created_at: string;
  updated_at: string;
};

export function LiveSessionPanel({
  meetingId,
  industries = [],
}: {
  meetingId: string;
  industries?: string[];
}) {
  const t = useTranslations();
  const { aiMode } = useAIMode();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const transcriptsRef = useRef<Transcript[]>([]);
  const [aiMessages, setAIMessages] = useState<AIMessage[]>([]);
  const [terminologyMessages, setTerminologyMessages] = useState<TerminologyMessage[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [speakerCount, setSpeakerCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "ended"
  >("connecting");
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);

  // 自動終了用のタイマー管理
  const [lastTranscriptAt, setLastTranscriptAt] = useState<Date | null>(null);

  // タブ切り替え状態
  const [activeTab, setActiveTab] = useState<'transcript' | 'ai' | 'discussionAssist' | 'history' | 'evaluation' | 'terms' | 'transcripts'>('discussionAssist');

  // Gemini Live API state
  const [isGeminiActive, setIsGeminiActive] = useState(false);
  const [isGeminiConnecting, setIsGeminiConnecting] = useState(false);
  const [geminiResponse, setGeminiResponse] = useState<string>("");
  const lastSavedResponseRef = useRef<string>(""); // 最後に保存した応答を記録

  // Terminology helper state
  const [isTerminologyActive, setIsTerminologyActive] = useState(false);
  const [isTerminologyConnecting, setIsTerminologyConnecting] = useState(false);
  const [terminologyResponse, setTerminologyResponse] = useState("");
  const terminologyLastResponseRef = useRef("");
  const meetingSummaryContextRef = useRef<string>("");
  const meetingSummaryContextLoadedRef = useRef(false);

  // Term cards state (synced from TermExplanationPane for mobile display)
  const [termCards, setTermCards] = useState<TermCard[]>([]);

  // AI Response Recorder（統一保存レイヤー）
  const geminiLiveRecorderRef = useRef<AIResponseRecorder | null>(null);
  const googleAIRecorderRef = useRef<AIResponseRecorder | null>(null);
  const [currentAIMode, setCurrentAIMode] = useState<AIMode>("assistant");

  // 議論アシスト state
  const [assistMessages, setAssistMessages] = useState<AssistMessage[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [lastSummaryTimestamp, setLastSummaryTimestamp] = useState<string | null>(null);
  const assistMessagesEndRef = useRef<HTMLDivElement>(null);
  const [assistInput, setAssistInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);

  // ローディングモーダル用の状態
  type LoadingStep = {
    label: string;
    status: "pending" | "loading" | "completed" | "error";
  };
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([]);

  const geminiWsRef = useRef<WebSocket | null>(null);
  const terminologyWsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const termPaneRef = useRef<TermExplanationPaneRef>(null);

  // キューから次の音声を再生
  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioBuffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);

    source.onended = () => {
      playNextAudio();
    };

    source.start(0);
  }, []);

  // 音声データを再生する関数
  const playAudioData = useCallback(async (base64Audio: string, mimeType: string) => {
    try {
      // AudioContextの初期化
      if (!audioContextRef.current) {
        const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextConstructor({ sampleRate: 24000 });
      }

      // Base64デコード
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // PCM16をデコードしてAudioBufferを作成
      const pcm16 = new Int16Array(bytes.buffer);
      const audioBuffer = audioContextRef.current.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);

      // Int16からFloat32に変換
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }

      // キューに追加
      audioQueueRef.current.push(audioBuffer);

      // 再生中でなければ再生開始
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    } catch (error) {
      console.error("[Gemini Live] Failed to play audio:", error);
    }
  }, [playNextAudio]);

  const fetchMeetingSummaryContext = useCallback(async () => {
    if (meetingSummaryContextLoadedRef.current) {
      return meetingSummaryContextRef.current;
    }

    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/summaries/history`
      );
      if (res.ok) {
        const data = await res.json();
        const summaries: Array<{
          id: string;
          summary_text: string;
          generated_at: string;
        }> = data.summaries || [];

        const contextText = summaries
          .map(
            (summary, index) =>
              `### 過去会議 ${index + 1}（${new Date(
                summary.generated_at
              ).toLocaleString("ja-JP")}）\n${summary.summary_text}`
          )
          .join("\n\n");

        console.log(
          "[Meeting Context] Loaded summaries for prompts:",
          contextText
        );

        meetingSummaryContextRef.current = contextText;
        meetingSummaryContextLoadedRef.current = true;
        return contextText;
      }
    } catch (error) {
      console.error("[Meeting Context] Failed to fetch summaries:", error);
    }

    meetingSummaryContextLoadedRef.current = true;
    meetingSummaryContextRef.current = "";
    return "";
  }, [meetingId]);

  // Gemini Live APIセッション開始
  const startGeminiLiveSession = useCallback(async () => {
    if (isGeminiActive) {
      console.log("[Gemini Live] Already active");
      return;
    }

    try {
      const summaryContext = await fetchMeetingSummaryContext();

      console.log("[Gemini Live] 🚀 Starting session...");
      setIsGeminiConnecting(true);
      setIsGeminiActive(true);
      setGeminiResponse("");

      // 会話履歴の直近3つを取得
      setTranscripts((current) => {
        const recentHistory = current
          .filter((t) => t.isFinal)
          .slice(-3)
          .map((t) => `${t.speaker}: ${t.text}`)
          .join("\n");

        const combinedHistory = [summaryContext, recentHistory]
          .filter((text) => text && text.trim().length > 0)
          .join("\n\n");

        // Gemini Live API接続開始
        (async () => {
          try {
            const response = await fetch("/api/gemini/live-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: currentSession?.id || "temp-session",
                conversationHistory: combinedHistory,
                meetingId: meetingId,
              }),
            });

            if (!response.ok) {
              throw new Error("Failed to start Gemini Live session");
            }

            const { wsUrl, model, config, ai_output_mode } = await response.json();
            console.log("[Gemini Live] Connecting to:", wsUrl, "mode:", ai_output_mode);

            const ws = new WebSocket(wsUrl);
            geminiWsRef.current = ws;

            ws.onopen = () => {
              console.log("[Gemini Live] ✅ WebSocket connected");
              setIsGeminiConnecting(false);

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
                let message;
                if (event.data instanceof Blob) {
                  const text = await event.data.text();
                  message = JSON.parse(text);
                } else {
                  message = JSON.parse(event.data);
                }

                console.log("[Gemini Live] Message:", message);

                if (message.error) {
                  console.error("[Gemini Live] Error from server:", message.error);
                  ws.close();
                  return;
                }

                if (message.setupComplete) {
                  console.log("[Gemini Live] ✅ Setup complete");

                  const initialMessage = recentHistory
                    ? `直近の会話:\n${recentHistory}\n\n上記を踏まえて応答してください。`
                    : "はい、お話しください。";

                  ws.send(
                    JSON.stringify({
                      clientContent: {
                        turns: [{ role: "user", parts: [{ text: initialMessage }] }],
                        turnComplete: true,
                      },
                    })
                  );
                  return;
                }

                if (message.serverContent?.modelTurn) {
                  const { modelTurn } = message.serverContent;
                  console.log("[Gemini Live] 🤖 Model turn received", {
                    hasParts: !!modelTurn.parts,
                    completed: modelTurn.completed,
                    turnComplete: modelTurn.turnComplete,
                  });

                  if (modelTurn.parts) {
                    const partsArray = Array.isArray(modelTurn.parts)
                      ? modelTurn.parts
                      : [modelTurn.parts];

                    partsArray.forEach((part: any) => {
                      // テキスト応答の処理
                      if (part.text) {
                        console.log("[Gemini Live] 📝 Text part:", part.text);
                        flushSync(() => {
                          setGeminiResponse((prev) => prev + part.text);
                        });
                        // Recorderにチャンクを追加
                        geminiLiveRecorderRef.current?.appendChunk(part.text);
                      }
                      // 音声応答の処理
                      else if (part.inlineData?.data) {
                        console.log("[Gemini Live] 🔊 Audio part received");
                        const audioData = part.inlineData.data;
                        const mimeType = part.inlineData.mimeType || "audio/pcm";
                        playAudioData(audioData, mimeType);
                      }
                    });
                  }

                  // ターン完了チェック（turnCompleteまたはcompletedフラグ）
                  if (modelTurn.turnComplete || modelTurn.completed) {
                    console.log("[Gemini Live] 💾 Turn complete (modelTurn flag detected)");

                    // Recorderのバッファから実際のテキストを取得
                    const bufferedText = geminiLiveRecorderRef.current?.getBuffer() || "";
                    console.log('[Gemini Live] 📊 Buffered text length:', bufferedText.length);

                    // UIにAIメッセージを追加（Recorderのバッファから）
                    if (bufferedText.trim()) {
                      const aiMessage: AIMessage = {
                        id: `ai-${Date.now()}`,
                        text: bufferedText,
                        timestamp: new Date().toISOString(),
                        type: "response",
                      };
                      console.log('[Gemini Live] 📋 Adding AI message to UI:', {
                        id: aiMessage.id,
                        textLength: aiMessage.text.length,
                        textPreview: aiMessage.text.substring(0, 50) + '...',
                      });
                      setAIMessages((prev) => {
                        const updated = [...prev, aiMessage];
                        console.log('[Gemini Live] 📊 Current aiMessages count:', updated.length);
                        return updated;
                      });

                      // ストリーミング表示をクリア
                      setGeminiResponse("");
                    }

                    // Recorderのターンを完了（自動的にDBに保存 & バッファクリア）
                    geminiLiveRecorderRef.current?.completeTurn().then((saved) => {
                      if (saved) {
                        console.log('[Gemini Live] ✅ AI response saved via Recorder');
                      }
                    });
                  }
                }

                // フォールバック: usageMetadataでも確定させる
                if (message.usageMetadata) {
                  const bufferedText = geminiLiveRecorderRef.current?.getBuffer() || "";

                  if (bufferedText.trim()) {
                    console.log("[Gemini Live] 💾 Turn complete (usageMetadata fallback)");

                    // UIにAIメッセージを追加
                    const aiMessage: AIMessage = {
                      id: `ai-${Date.now()}`,
                      text: bufferedText,
                      timestamp: new Date().toISOString(),
                      type: "response",
                    };
                    console.log('[Gemini Live] 📋 Adding AI message to UI (fallback):', {
                      id: aiMessage.id,
                      textLength: aiMessage.text.length,
                    });
                    setAIMessages((prev) => [...prev, aiMessage]);
                    setGeminiResponse("");

                    // Recorderのターンを完了（自動的にDBに保存）
                    geminiLiveRecorderRef.current?.completeTurn().then((saved) => {
                      if (saved) {
                        console.log('[Gemini Live] ✅ AI response saved via Recorder (fallback)');
                      }
                    });
                  }
                }
              } catch (err) {
                console.error("[Gemini Live] Message parse error", err);
              }
            };

            ws.onerror = (err) => {
              console.error("[Gemini Live] WebSocket error", err);
            };

            ws.onclose = (event) => {
              console.log("[Gemini Live] WebSocket closed", {
                code: event.code,
                reason: event.reason,
              });

              // WebSocket切断時に未保存の応答を確定
              const bufferedText = geminiLiveRecorderRef.current?.getBuffer() || "";

              if (bufferedText.trim()) {
                console.log("[Gemini Live] 💾 Finalizing response on WebSocket close");

                // UIにAIメッセージを追加
                const aiMessage: AIMessage = {
                  id: `ai-${Date.now()}`,
                  text: bufferedText,
                  timestamp: new Date().toISOString(),
                  type: "response",
                };
                console.log('[Gemini Live] 📋 Adding final AI message on close');
                setAIMessages((prev) => [...prev, aiMessage]);
                setGeminiResponse("");

                // Recorderをフラッシュ
                geminiLiveRecorderRef.current?.flush().then((saved) => {
                  if (saved) {
                    console.log('[Gemini Live] ✅ Response flushed on close');
                  }
                });
              }

              setIsGeminiActive(false);
              setIsGeminiConnecting(false);
            };
          } catch (err) {
            console.error("[Gemini Live] Session start error", err);
            setIsGeminiActive(false);
            setIsGeminiConnecting(false);
          }
        })();

        return current;
      });
    } catch (err) {
      console.error("[Gemini Live] Session start error", err);
      setIsGeminiActive(false);
      setIsGeminiConnecting(false);
    }
  }, [
    isGeminiActive,
    currentSession,
    meetingId,
    playAudioData,
    fetchMeetingSummaryContext,
  ]);

  const startTerminologyMonitorSession = useCallback(async () => {
    if (isTerminologyActive || isTerminologyConnecting) {
      return;
    }
    if (!currentSession) return;

    try {
      setIsTerminologyConnecting(true);
      setTerminologyResponse("");

      const contextText = await fetchMeetingSummaryContext();

      const recentHistory = transcriptsRef.current
        .filter((t) => t.isFinal)
        .slice(-5)
        .map((t) => `${t.speaker}: ${t.text}`)
        .join("\n");

      const combinedHistory = [contextText, recentHistory]
        .filter((text) => text && text.trim().length > 0)
        .join("\n\n");

      const response = await fetch("/api/gemini/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession.id,
          conversationHistory: combinedHistory,
          meetingId,
          profile: "terminology_helper",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start terminology monitor session");
      }

      const { wsUrl, model, config } = await response.json();
      const ws = new WebSocket(wsUrl);
      terminologyWsRef.current = ws;

      ws.onopen = () => {
        setIsTerminologyConnecting(false);
        setIsTerminologyActive(true);
        const setupMessage = {
          setup: {
            model,
            generationConfig: {
              responseModalities: ["TEXT"],
            },
            systemInstruction: config?.systemInstruction
              ? { parts: [{ text: config.systemInstruction }] }
              : undefined,
          },
        };
        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = async (event) => {
        try {
          const dataText =
            event.data instanceof Blob ? await event.data.text() : event.data;
          const message = JSON.parse(dataText);

          if (message.error) {
            console.error("[Terminology Helper] Error:", message.error);
            return;
          }

          if (message.serverContent?.modelTurn) {
            const { modelTurn } = message.serverContent;
            const partsArray = Array.isArray(modelTurn.parts)
              ? modelTurn.parts
              : [modelTurn.parts];

            partsArray.forEach((part: any) => {
              if (part.text) {
                setTerminologyResponse((prev) => {
                  const next = prev + part.text;
                  terminologyLastResponseRef.current = next;
                  return next;
                });
              }
            });
          }

          const turnComplete =
            message.serverContent?.modelTurn?.turnComplete ||
            message.serverContent?.modelTurn?.completed ||
            !!message.usageMetadata;

          if (turnComplete && terminologyLastResponseRef.current.trim()) {
            const finalizedText = terminologyLastResponseRef.current.trim();
            setTerminologyMessages((prev) => [
              ...prev,
              {
                id: `term-${Date.now()}`,
                text: finalizedText,
                timestamp: new Date().toISOString(),
              },
            ]);
            setTerminologyResponse("");
            terminologyLastResponseRef.current = "";
          }
        } catch (err) {
          console.error("[Terminology Helper] Message parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[Terminology Helper] WebSocket error:", err);
      };

      ws.onclose = () => {
        setIsTerminologyActive(false);
        setIsTerminologyConnecting(false);
      };
    } catch (error) {
      console.error("[Terminology Helper] Failed to start session:", error);
      setIsTerminologyConnecting(false);
    }
  }, [
    currentSession,
    fetchMeetingSummaryContext,
    isTerminologyActive,
    isTerminologyConnecting,
    meetingId,
  ]);

  const stopTerminologyMonitorSession = useCallback(() => {
    if (terminologyWsRef.current) {
      terminologyWsRef.current.close();
      terminologyWsRef.current = null;
    }
    setIsTerminologyActive(false);
    setIsTerminologyConnecting(false);
    setTerminologyResponse("");
    terminologyLastResponseRef.current = "";
  }, []);

  // リアルタイムAI統合（ハイブリッド/フルリアルタイムモード用）
  const handleRealtimeTranscript = useCallback((transcript: any) => {
    // Partial結果も表示（test2と同じロジック）
    setTranscripts((prev) => {
      // Final結果のみを残す（Partial結果は毎回削除）
      const filtered = prev.filter((t) => t.isFinal);

      const newTranscript: Transcript = {
        id: transcript.id || `transcript-${Date.now()}`,
        speaker: transcript.speaker,
        text: transcript.text,
        timestamp: transcript.timestamp,
        startTime: transcript.startTime,
        isFinal: transcript.isFinal,
      };

      return [...filtered, newTranscript];
    });

    // 話者数を更新（Final結果のみカウント）
    if (transcript.isFinal) {
      // 最終文字起こし受信時刻を更新（自動終了タイマー用）
      setLastTranscriptAt(new Date());

      setTranscripts((current) => {
        const uniqueSpeakers = new Set(
          current
            .filter((t) => t.isFinal && t.text && t.text.trim())
            .map((t) => t.speaker)
        );
        setSpeakerCount(uniqueSpeakers.size);
        return current;
      });

      // 用語解説ペインに transcript を送信（Final結果のみ）
      if (transcript.text && transcript.text.trim()) {
        termPaneRef.current?.sendTranscript(transcript.text);
      }

      // Gemini Live trigger detection (only for final transcripts)
      const wsReady =
        geminiWsRef.current &&
        geminiWsRef.current.readyState === WebSocket.OPEN;

      // デバッグログ
      console.log("[Gemini Live] 🔍 Debug check:", {
        wsReady,
        hasText: !!transcript.text,
        text: transcript.text,
        includesStop: transcript.text?.includes("ストップ"),
        wsState: geminiWsRef.current?.readyState,
      });

      // Priority 1: Stop command - Geminiが起動中に「ストップ」で終了
      if (wsReady && transcript.text && transcript.text.includes("ストップ")) {
        console.log("[Gemini Live] 🛑 Stop command detected, flushing recorders");

        // Recorderのバッファから未保存の応答を取得してUIに追加
        const bufferedText = geminiLiveRecorderRef.current?.getBuffer() || "";
        if (bufferedText.trim()) {
          const aiMessage: AIMessage = {
            id: `ai-${Date.now()}`,
            text: bufferedText,
            timestamp: new Date().toISOString(),
            type: "response",
          };
          console.log('[Gemini Live] 📋 Adding AI message on STOP:', {
            textLength: bufferedText.length,
          });
          setAIMessages((prev) => [...prev, aiMessage]);
          setGeminiResponse("");
        }

        // すべてのRecorderをフラッシュ（未保存の応答を保存）
        Promise.all([
          geminiLiveRecorderRef.current?.flush(),
          googleAIRecorderRef.current?.flush(),
        ]).then(([geminiSaved, googleSaved]) => {
          if (geminiSaved) {
            console.log('[Gemini Live] ✅ Flushed on STOP');
          }
          if (googleSaved) {
            console.log('[Google AI] ✅ Flushed on STOP');
          }
        });

        if (geminiWsRef.current) {
          geminiWsRef.current.close();
          geminiWsRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        setIsGeminiActive(false);
        setIsGeminiConnecting(false);
        return;
      }

      // Priority 2: Send to Gemini if connected
      if (wsReady && transcript.text) {
        console.log("[Gemini Live] 📤 Sending user message:", transcript.text);
        geminiWsRef.current!.send(
          JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: transcript.text }] }],
              turnComplete: true,
            },
          })
        );
        console.log("[Gemini Live] ✅ User message sent");
        return;
      }

      const terminologyReady =
        terminologyWsRef.current &&
        terminologyWsRef.current.readyState === WebSocket.OPEN;

      if (terminologyReady && transcript.text) {
        const helperInput = `話者: ${transcript.speaker}\n内容: ${transcript.text}`;
        terminologyWsRef.current!.send(
          JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: helperInput }] }],
              turnComplete: true,
            },
          })
        );
      }

      // Priority 3: Trigger detection only if not active
      if (
        !isGeminiActive &&
        !isGeminiConnecting &&
        transcript.text &&
        transcript.text.includes("アシスタント")
      ) {
        console.log("[Gemini Live] 🎯 Trigger detected (starting session)!");
        startGeminiLiveSession();
      }
    }
  }, [isGeminiActive, isGeminiConnecting, startGeminiLiveSession]);

  const handleRealtimeAIResponse = useCallback((response: any) => {
    const newMessage: AIMessage = {
      id: `ai-${Date.now()}`,
      text: response.text,
      timestamp: response.timestamp,
      type: "response",
    };
    setAIMessages((prev) => [...prev, newMessage]);

    // Google AI (HTTP) RecorderにチャンクIDを追加し、ターンを完了
    if (googleAIRecorderRef.current && response.text) {
      // バッファをクリアしてから新しい応答を追加
      googleAIRecorderRef.current.clear();
      googleAIRecorderRef.current.appendChunk(response.text);
      googleAIRecorderRef.current.completeTurn().then((saved) => {
        if (saved) {
          console.log('[Google AI] ✅ AI response saved via Recorder');
        }
      });
    }
  }, []);

  // Note: Gemini応答は usageMetadata 受信時に確定してAIMessagesに追加される
  // ストリーミング中の表示はgeminiResponse stateで管理され、UI側でリアルタイム表示される

  const realtimeAI = useRealtimeAI(
    meetingId,
    handleRealtimeTranscript,
    handleRealtimeAIResponse
  );

  // Google AI 統合（google_ai モード用）
  const googleAI = useGoogleAI(
    undefined, // meetingTitle
    "text", // outputMode (将来的に設定可能に)
    handleRealtimeTranscript,
    handleRealtimeAIResponse
  );

  // ページロード時のセッション復元
  useEffect(() => {
    // すでにチェック済みでセッションが存在する場合はスキップ
    if (hasCheckedSession && currentSession) {
      return;
    }

    const checkActiveSession = async () => {
      try {
        const res = await fetch(
          `/api/meetings/${meetingId}/sessions/active`
        );
        const { session } = await res.json();

        if (session) {
          setCurrentSession(session);

          if (session.status === "active") {
            // アクティブなセッションがある場合、自動再接続
            setSessionStatus("active");
            setLastSummaryTimestamp(session.started_at); // 議論整理の起点を設定

            // 既存の文字起こしを取得
            const transcriptsRes = await fetch(
              `/api/meetings/${meetingId}/sessions/${session.id}/transcripts`
            );
            const { transcripts: existingTranscripts } =
              await transcriptsRes.json();

            // 文字起こしをマッピング
            const mappedTranscripts = existingTranscripts.map((t: any) => ({
              id: t.id,
              speaker: t.participant?.display_name || t.speaker_label || "不明",
              text: t.text,
              timestamp: t.created_at,
              startTime: t.start_time,
            }));

            setTranscripts(mappedTranscripts);

            // AIモードに基づいて接続を再開
            await connectBasedOnMode(session.id);
          } else if (session.status === "paused") {
            // 一時停止中のセッションがある場合
            setSessionStatus("paused");

            // 既存の文字起こしを取得
            const transcriptsRes = await fetch(
              `/api/meetings/${meetingId}/sessions/${session.id}/transcripts`
            );
            const { transcripts: existingTranscripts } =
              await transcriptsRes.json();

            const mappedTranscripts = existingTranscripts.map((t: any) => ({
              id: t.id,
              speaker: t.participant?.display_name || t.speaker_label || "不明",
              text: t.text,
              timestamp: t.created_at,
              startTime: t.start_time,
            }));

            setTranscripts(mappedTranscripts);

            // ユーザーに再開を促す
            const shouldResume = confirm(
              "一時停止中のセッションがあります。\n\n" +
                "「OK」: セッションを再開\n" +
                "「キャンセル」: このまま（後で再開可能）"
            );

            if (shouldResume) {
              await resumeSession();
            }
          }
        } else {
          // セッションがない場合はidle
          setSessionStatus("idle");
        }

        setHasCheckedSession(true);
      } catch (error) {
        console.error("Failed to check active session:", error);
        setSessionStatus("idle");
        setHasCheckedSession(true);
      }
    };

    checkActiveSession();
  }, [meetingId, hasCheckedSession, currentSession]);

  // セッション開始
  const startSession = async () => {
    console.log("Starting session with aiMode:", aiMode);
    setIsLoading(true);

    // ローディングステップを初期化
    const initialSteps: LoadingStep[] = [
      { label: "セッションを作成", status: "loading" },
      {
        label:
          aiMode === "google_ai"
            ? "Google AIに接続"
            : "OpenAI Realtimeに接続",
        status: "pending",
      },
      {
        label: "音声認識を開始",
        status: "pending",
      },
    ];
    setLoadingSteps(initialSteps);

    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/sessions/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aiMode }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (error.error === "active_session_exists") {
          // 既にアクティブなセッションが存在する場合、それを使用
          setCurrentSession({ id: error.sessionId } as Session);
          setSessionStatus("active");

          // ステップ1完了
          setLoadingSteps((prev) =>
            prev.map((s, i) => (i === 0 ? { ...s, status: "completed" } : s))
          );

          await connectBasedOnMode(error.sessionId);
        } else {
          console.error("Failed to start session:", error);
          // エラー状態に更新
          setLoadingSteps((prev) =>
            prev.map((s, i) => (i === 0 ? { ...s, status: "error" } : s))
          );
          setTimeout(() => {
            alert("セッションの開始に失敗しました");
            setLoadingSteps([]);
          }, 1000);
        }
        return;
      }

      const data = await response.json();
      setCurrentSession(data.session);
      setSessionStatus("active");
      setTranscripts([]); // 新しいセッション開始時に文字起こしをリセット
      setAIMessages([]); // AIメッセージもリセット
      setTerminologyMessages([]);
      setAssistMessages([]); // 議論アシストメッセージもリセット
      setLastSummaryTimestamp(data.session.started_at); // 議論整理の起点を設定
      setLastTranscriptAt(new Date()); // 自動終了タイマーを開始

      // AIResponseRecorderを初期化
      geminiLiveRecorderRef.current = new AIResponseRecorder(
        meetingId,
        data.session.id,
        "gemini_live",
        "assistant"
      );
      googleAIRecorderRef.current = new AIResponseRecorder(
        meetingId,
        data.session.id,
        "gemini_assessment",
        "assistant"
      );
      console.log("[LiveSessionPanel] AI Response Recorders initialized");

      // ステップ1完了、ステップ2開始
      setLoadingSteps((prev) =>
        prev.map((s, i) =>
          i === 0
            ? { ...s, status: "completed" }
            : i === 1
              ? { ...s, status: "loading" }
              : s
        )
      );

      await connectBasedOnMode(data.session.id);
    } catch (error) {
      console.error("Failed to start session:", error);
      setLoadingSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "error" } : s))
      );
      setTimeout(() => {
        alert("セッションの開始に失敗しました");
        setLoadingSteps([]);
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  };

  // AIモードに基づいて接続
  const connectBasedOnMode = async (sessionId: string) => {
    console.log("connectBasedOnMode called:", { aiMode, sessionId });
    if (aiMode === "google_ai") {
      // Google AIモード: Google STT + Gemini + TTS
      console.log("Starting Google AI connection...");
      try {
        await googleAI.connect(sessionId, meetingId);
        setConnectionStatus("connected");
        console.log("Google AI connection successful");

        // ローディングステップを更新: Step 2完了、Step 3完了
        setLoadingSteps((prev) =>
          prev.map((s, i) =>
            i === 1 ? { ...s, status: "completed" } :
            i === 2 ? { ...s, status: "completed" } : s
          )
        );

        // ローディングモーダルを閉じる
        setTimeout(() => {
          setIsLoading(false);
          setLoadingSteps([]);
        }, 500);
      } catch (error) {
        console.error("Google AI connection error:", error);
        setLoadingSteps((prev) =>
          prev.map((s, i) => (i === 1 ? { ...s, status: "error" } : s))
        );
        throw error;
      }
    } else if (aiMode === "full_realtime") {
      // フルリアルタイムモード: OpenAI Realtime API接続
      console.log("Starting Realtime AI connection...");
      try {
        await realtimeAI.connect(sessionId);
        setConnectionStatus("connected");
        console.log("Realtime AI connection successful");

        // ローディングステップを更新: Step 2完了、Step 3完了
        setLoadingSteps((prev) =>
          prev.map((s, i) =>
            i === 1 ? { ...s, status: "completed" } :
            i === 2 ? { ...s, status: "completed" } : s
          )
        );

        // ローディングモーダルを閉じる
        setTimeout(() => {
          setIsLoading(false);
          setLoadingSteps([]);
        }, 500);
      } catch (error) {
        console.error("Failed to connect Realtime AI:", error);
        setConnectionStatus("disconnected");

        // ローディングステップをエラーに更新
        setLoadingSteps((prev) =>
          prev.map((s, i) => (i === 1 ? { ...s, status: "error" } : s))
        );
      }
    }
  };

  // セッション一時停止
  const pauseSession = async () => {
    if (!currentSession) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/sessions/${currentSession.id}/pause`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to pause session:", error);
        alert("セッションの一時停止に失敗しました");
        return;
      }

      const data = await response.json();
      setCurrentSession(data.session);
      setSessionStatus("paused");

      // すべてのRecorderをフラッシュ（未保存の応答を保存）
      console.log("[LiveSessionPanel] Flushing recorders on pause");
      await Promise.all([
        geminiLiveRecorderRef.current?.flush(),
        googleAIRecorderRef.current?.flush(),
      ]);

      // 接続を切断
      if (aiMode === "google_ai") {
        googleAI.disconnect();
      } else if (aiMode === "full_realtime") {
        realtimeAI.disconnect();
      }

      // Gemini WebSocket切断
      if (geminiWsRef.current) {
        geminiWsRef.current.close();
        geminiWsRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsGeminiActive(false);
      setIsGeminiConnecting(false);
    } catch (error) {
      console.error("Failed to pause session:", error);
      alert("セッションの一時停止に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  // セッション再開
  const resumeSession = async () => {
    if (!currentSession) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/sessions/${currentSession.id}/resume`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to resume session:", error);
        alert("セッションの再開に失敗しました");
        return;
      }

      const data = await response.json();
      setCurrentSession(data.session);
      setSessionStatus("active");
      await connectBasedOnMode(data.session.id);
    } catch (error) {
      console.error("Failed to resume session:", error);
      alert("セッションの再開に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  // セッション終了
  const endSession = async () => {
    if (!currentSession) return;

    if (!confirm("セッションを終了しますか？終了後は再開できません。")) {
      return;
    }

    setIsLoading(true);

    // ローディングステップを初期化（サマリー生成のみ）
    const initialSteps: LoadingStep[] = [
      { label: "セッションを終了", status: "loading" },
      { label: "会議サマリーを生成", status: "pending" },
    ];
    setLoadingSteps(initialSteps);

    try {
      // すべてのRecorderをフラッシュ（未保存の応答を保存）
      console.log('[Session End] Flushing recorders before ending session');
      await Promise.all([
        geminiLiveRecorderRef.current?.flush(),
        googleAIRecorderRef.current?.flush(),
      ]);

      // ステップ1: セッション終了
      const response = await fetch(
        `/api/meetings/${meetingId}/sessions/${currentSession.id}/end`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to end session:", error);
        setLoadingSteps((prev) =>
          prev.map((s, i) => (i === 0 ? { ...s, status: "error" } : s))
        );
        setTimeout(() => {
          alert("セッションの終了に失敗しました");
          setLoadingSteps([]);
        }, 1000);
        return;
      }

      const data = await response.json();
      setCurrentSession(data.session);
      setSessionStatus("ended");

      // ステップ1完了（セッション終了）
      setLoadingSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "completed" } : s))
      );

      // ステップ2開始（サマリー生成中）
      setLoadingSteps((prev) =>
        prev.map((s, i) => (i === 1 ? { ...s, status: "loading" } : s))
      );

      // 要約生成の状態を通知
      if (data.summaryStatus) {
        console.log('[Session End] Summary status:', data.summaryStatus);
        if (data.summaryStatus === 'success') {
          console.log('[Session End] ✅ Summary generated successfully');

          // ステップ2完了（サマリー生成完了）
          setLoadingSteps((prev) =>
            prev.map((s, i) => (i === 1 ? { ...s, status: "completed" } : s))
          );

          // モーダルを一時的に閉じて評価生成の確認
          setLoadingSteps([]);

          // サマリー生成成功後、評価生成の確認
          const shouldGenerateEvaluation = confirm(
            "会議評価も生成しますか？\n\n" +
            "評価は次回の会議改善に役立つフィードバックを提供します。\n" +
            "（生成には追加で30秒～1分程度かかります）"
          );

          if (shouldGenerateEvaluation) {
            console.log("[Session End] 📊 Generating evaluation...");

            // 評価生成用のローディングステップを設定
            setLoadingSteps([
              { label: "会議評価を生成", status: "loading" },
            ]);

            try {
              const evaluationResponse = await fetch(
                `/api/meetings/${meetingId}/evaluation`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionId: currentSession.id,
                    mode: "human_ai_combined",
                  }),
                }
              );

              if (evaluationResponse.ok) {
                console.log("[Session End] ✅ Evaluation generated successfully");

                // 評価生成完了
                setLoadingSteps((prev) =>
                  prev.map((s) => ({ ...s, status: "completed" }))
                );

                // 少し待ってからモーダルを閉じる
                setTimeout(() => {
                  setLoadingSteps([]);
                  alert("会議評価が生成されました！\n「会議評価」タブで確認できます。");
                }, 1000);
              } else {
                const errorData = await evaluationResponse.json();
                console.error("[Session End] ❌ Evaluation generation failed:", errorData);

                // エラー状態に更新
                setLoadingSteps((prev) =>
                  prev.map((s) => ({ ...s, status: "error" }))
                );

                setTimeout(() => {
                  setLoadingSteps([]);
                  // 409 (already_exists) の場合は警告を出さない
                  if (evaluationResponse.status !== 409) {
                    alert("会議評価の生成に失敗しました。");
                  }
                }, 1000);
              }
            } catch (evalError) {
              console.error("[Session End] ❌ Evaluation generation error:", evalError);

              // エラー状態に更新
              setLoadingSteps((prev) =>
                prev.map((s) => ({ ...s, status: "error" }))
              );

              setTimeout(() => {
                setLoadingSteps([]);
                alert("会議評価の生成中にエラーが発生しました。");
              }, 1000);
            }
          }
        } else if (data.summaryStatus === 'no_data') {
          // サマリー生成失敗
          setLoadingSteps((prev) =>
            prev.map((s, i) => (i === 1 ? { ...s, status: "error" } : s))
          );
          setTimeout(() => {
            setLoadingSteps([]);
            alert('会話データがないため要約を生成できませんでした');
          }, 1000);
        } else if (data.summaryStatus === 'failed' || data.summaryStatus === 'error') {
          // サマリー生成失敗
          setLoadingSteps((prev) =>
            prev.map((s, i) => (i === 1 ? { ...s, status: "error" } : s))
          );
          setTimeout(() => {
            setLoadingSteps([]);
            alert('要約の生成に失敗しました。再生成ボタンから再試行できます。');
          }, 1000);
        }
      }

      // 接続を切断
      if (aiMode === "google_ai") {
        googleAI.disconnect();
      } else if (aiMode === "full_realtime") {
        realtimeAI.disconnect();
      }

      // Gemini WebSocket切断
      if (geminiWsRef.current) {
        geminiWsRef.current.close();
        geminiWsRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsGeminiActive(false);
      setIsGeminiConnecting(false);
      setGeminiResponse("");
    } catch (error) {
      console.error("Failed to end session:", error);

      // エラー状態に更新
      setLoadingSteps((prev) =>
        prev.map((s) => (s.status === "loading" ? { ...s, status: "error" } : s))
      );

      setTimeout(() => {
        setLoadingSteps([]);
        alert("セッションの終了に失敗しました");
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  };

  // 自動セッション終了（idle timeout用）
  const autoEndSession = useCallback(async (reason: string) => {
    if (!currentSession) return;

    console.log(`[Auto End Session] 🤖 Auto-ending session due to: ${reason}`);

    try {
      // すべてのRecorderをフラッシュ（未保存の応答を保存）
      console.log('[Auto End Session] Flushing recorders before ending session');
      await Promise.all([
        geminiLiveRecorderRef.current?.flush(),
        googleAIRecorderRef.current?.flush(),
      ]);

      const response = await fetch(
        `/api/meetings/${meetingId}/sessions/${currentSession.id}/end`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("[Auto End Session] ❌ Failed to end session:", error);
        return;
      }

      const data = await response.json();
      setCurrentSession(data.session);
      setSessionStatus("ended");

      // 接続を切断
      if (aiMode === "google_ai") {
        googleAI.disconnect();
      } else if (aiMode === "full_realtime") {
        realtimeAI.disconnect();
      }

      // Gemini WebSocket切断
      if (geminiWsRef.current) {
        geminiWsRef.current.close();
        geminiWsRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsGeminiActive(false);
      setIsGeminiConnecting(false);
      setGeminiResponse("");

      // タイマーをリセット
      setLastTranscriptAt(null);

      // UI通知
      alert("3分以上入力がなかったため、セッションを自動終了しました。");

      console.log("[Auto End Session] ✅ Session auto-ended successfully");
    } catch (error) {
      console.error("[Auto End Session] ❌ Failed to auto-end session:", error);
    }
  }, [meetingId, currentSession, aiMode, googleAI, realtimeAI]);

  // SSE接続（モックモード用 - 現在は使用していない）
  // const connect = (sessionId: string) => {
  //   console.log("SSE connect() called with sessionId:", sessionId);
  //   if (eventSourceRef.current) {
  //     eventSourceRef.current.close();
  //   }
  //
  //   setConnectionStatus("connecting");
  //
  //   const eventSource = new EventSource(
  //     `/api/meetings/${meetingId}/stream?sessionId=${sessionId}`
  //   );
  //   console.log("EventSource created:", eventSource.url);
  //
  //   eventSource.onopen = () => {
  //     console.log("SSE connected");
  //     setConnectionStatus("connected");
  //
  //     // ステップ2完了、ステップ3完了
  //     setLoadingSteps((prev) =>
  //       prev.map((s, i) =>
  //         i === 1 || i === 2 ? { ...s, status: "completed" } : s
  //       )
  //     );
  //
  //     // 少し待ってからモーダルを閉じる
  //     setTimeout(() => {
  //       setLoadingSteps([]);
  //     }, 1000);
  //   };
  //
  //   eventSource.onmessage = (event) => {
  //     try {
  //       const data: TranscriptEvent = JSON.parse(event.data);
  //
  //       if (data.type === "connected") {
  //         console.log("Connected to meeting:", data.meetingId);
  //         setConnectionStatus("connected");
  //       } else if (data.type === "transcript") {
  //         const newTranscript: Transcript = {
  //           id: data.id || String(Date.now()),
  //           speaker: data.speaker || "不明な話者",
  //           text: data.text || "",
  //           timestamp: data.timestamp || new Date().toISOString(),
  //           startTime: data.startTime,
  //         };
  //
  //         setTranscripts((prev) => [...prev, newTranscript]);
  //
  //         // 話者数を更新
  //         setTranscripts((current) => {
  //           const uniqueSpeakers = new Set(
  //             current.map((t) => t.speaker)
  //           );
  //           setSpeakerCount(uniqueSpeakers.size);
  //           return current;
  //         });
  //       } else if (data.type === "end") {
  //         console.log("Stream ended:", data.message);
  //         setConnectionStatus("ended");
  //         eventSource.close();
  //       }
  //     } catch (error) {
  //       console.error("Failed to parse SSE data:", error);
  //     }
  //   };
  //
  //   eventSource.onerror = (error) => {
  //     console.error("SSE error:", error);
  //     setConnectionStatus("disconnected");
  //     eventSource.close();
  //   };
  //
  //   eventSourceRef.current = eventSource;
  // };

  // リアルタイムAI接続状態の同期
  // 注意: 頻繁な再レンダリングを避けるため、監視を最小限にする
  useEffect(() => {
    if (aiMode === "full_realtime" && sessionStatus === "active") {
      if (realtimeAI.isConnected) {
        setConnectionStatus("connected");
      } else if (realtimeAI.error) {
        setConnectionStatus("disconnected");
      }
    }
  }, [aiMode, sessionStatus]); // realtimeAI参照を削除

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (realtimeAI.isConnected) {
        realtimeAI.disconnect();
      }
      if (geminiWsRef.current) {
        geminiWsRef.current.close();
        geminiWsRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []); // 空の依存配列：コンポーネントアンマウント時のみ実行

  // 経過時間のカウント（activeの時のみ）
  useEffect(() => {
    if (sessionStatus !== "active") {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime((prev) => {
        const newTime = prev + 1;

        // 2時間50分（10,200秒）経過でアラート
        if (newTime === 10200) {
          alert(
            "会議が2時間50分経過しました。\n\n" +
            "あと10分で自動終了します。\n" +
            "長時間の会議を続ける場合は、一旦終了して新しいセッションを開始してください。"
          );
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStatus]);

  // beforeunloadアラート（ブラウザを閉じる/戻るボタン）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 会議が実行中の場合のみアラート
      if (sessionStatus === "active") {
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
      }
      // paused の場合はアラートなし（席を離れる想定）
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sessionStatus]);

  // モックAIメッセージ（Stage 10で実装）
  // useEffect(() => {
  //   if (transcripts.length === 3) {
  //     setAIMessages([
  //       {
  //         id: "1",
  //         text: "会議が開始されました。議事録の確認から始めるようです。",
  //         timestamp: new Date().toISOString(),
  //         type: "suggestion",
  //       },
  //     ]);
  //   }
  // }, [transcripts.length]);

  // 議論アシストメッセージの自動スクロール
  useEffect(() => {
    if (assistMessages.length > 0) {
      assistMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [assistMessages]);

  /**
   * 議論整理ハンドラ
   */
  const handleSummarizeDiscussion = async () => {
    if (!currentSession || !lastSummaryTimestamp) {
      console.error("[Discussion Assist] No active session or timestamp");
      return;
    }

    try {
      setIsSummarizing(true);

      // lastSummaryTimestamp以降のtranscriptを抽出
      const targetTranscripts = transcripts.filter((t) => {
        if (!t.timestamp || !t.isFinal) return false;
        return new Date(t.timestamp) > new Date(lastSummaryTimestamp);
      });

      if (targetTranscripts.length === 0) {
        // 新しい議事録がない場合
        const systemMessage: AssistMessage = {
          id: `system-${Date.now()}`,
          role: "system",
          text: "新しい議事録がありません。会議が進んでから再度お試しください。",
          createdAt: new Date().toISOString(),
        };
        setAssistMessages((prev) => [...prev, systemMessage]);
        return;
      }

      // transcriptを結合
      const transcriptChunk = targetTranscripts
        .map((t) => `[${t.speaker}] ${t.text}`)
        .join("\n");

      // 会議情報を取得
      const meetingRes = await fetch(`/api/meetings/${meetingId}`);
      const meetingData = await meetingRes.json();

      // Chat履歴を作成（直近のcheckpointのみ）
      const checkpoints = assistMessages.filter(
        (m) => m.metadata?.type === "checkpoint"
      );
      const history = checkpoints.slice(-1).map((m) => ({
        role: m.role as "user" | "assistant",
        text: m.text,
      }));

      // ストリーミングでAPI呼び出し（OpenAI）
      await streamOpenAIResponse({
        meetingId,
        mode: "checkpoint",
        transcriptChunk,
        meetingInfo: {
          title: meetingData.meeting?.title || "未設定",
          purpose: meetingData.meeting?.purpose || "未設定",
        },
        history,
        isCheckpoint: true,
      });

      // lastSummaryTimestampを更新
      const now = new Date().toISOString();
      setLastSummaryTimestamp(now);

      console.log("[Discussion Assist] Summary completed");
    } catch (error) {
      console.error("[Discussion Assist] Error:", error);

      // エラーメッセージを追加
      const errorMessage: AssistMessage = {
        id: `error-${Date.now()}`,
        role: "system",
        text: "要約の生成に失敗しました。もう一度お試しください。",
        createdAt: new Date().toISOString(),
      };
      setAssistMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSummarizing(false);
    }
  };

  /**
   * チャット送信ハンドラ
   */
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assistInput.trim() || isSendingChat) return;

    const userMessage = assistInput.trim();
    setAssistInput("");

    try {
      setIsSendingChat(true);

      // ユーザーメッセージを追加
      const userMsg: AssistMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: userMessage,
        createdAt: new Date().toISOString(),
      };
      setAssistMessages((prev) => [...prev, userMsg]);

      // ユーザーメッセージをデータベースに保存
      if (currentSession) {
        try {
          await fetch(`/api/meetings/${meetingId}/ai-messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: currentSession.id,
              content: userMessage,
              source: "participation",
              provider: "openai_discussion",
              mode: "assistant",
              turnId: userMsg.id,
            }),
          });
          console.log("[Discussion Chat] User message saved to database");
        } catch (saveError) {
          console.error("[Discussion Chat] Failed to save user message:", saveError);
        }
      }

      // 最後の要約以降のtranscriptsを取得
      const recentTranscripts = transcripts.filter((t) => {
        if (!t.timestamp || !t.isFinal) return false;
        if (!lastSummaryTimestamp) return false;
        return new Date(t.timestamp) > new Date(lastSummaryTimestamp);
      });

      const transcriptChunk = recentTranscripts
        .map((t) => `[${t.speaker}] ${t.text}`)
        .join("\n");

      // Chat履歴を作成（直近3ターン）
      const history = assistMessages.slice(-6).map((m) => ({
        role: m.role as "user" | "assistant",
        text: m.text,
      }));

      // ストリーミングでAPI呼び出し（OpenAI）
      await streamOpenAIResponse({
        meetingId,
        mode: "chat",
        transcriptChunk,
        history,
        userMessage,
        isCheckpoint: false,
      });

      console.log("[Discussion Chat] Message sent");
    } catch (error) {
      console.error("[Discussion Chat] Error:", error);

      const errorMessage: AssistMessage = {
        id: `error-${Date.now()}`,
        role: "system",
        text: "メッセージの送信に失敗しました。",
        createdAt: new Date().toISOString(),
      };
      setAssistMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSendingChat(false);
    }
  };

  /**
   * OpenAI ストリーミング共通処理
   */
  const streamOpenAIResponse = async (params: {
    meetingId: string;
    mode: "checkpoint" | "chat";
    transcriptChunk?: string;
    meetingInfo?: { title: string; purpose: string };
    history: { role: "user" | "assistant"; text: string }[];
    userMessage?: string;
    isCheckpoint: boolean;
  }) => {
    console.log("[OpenAI Discussion] Starting stream", {
      mode: params.mode,
      historyLength: params.history.length,
      isCheckpoint: params.isCheckpoint,
    });

    const response = await fetch("/api/discussion-assist/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId: params.meetingId,
        mode: params.mode,
        transcriptChunk: params.transcriptChunk,
        meetingInfo: params.meetingInfo,
        history: params.history,
        userMessage: params.userMessage,
      }),
    });

    console.log("[OpenAI Discussion] Response received", {
      ok: response.ok,
      status: response.status,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[OpenAI Discussion] API error:", errorText);
      throw new Error(`OpenAI API request failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response body");
    }

    let fullText = "";
    const messageId = params.isCheckpoint
      ? `checkpoint-${Date.now()}`
      : `assistant-${Date.now()}`;

    // 空のメッセージを追加（ストリーミング表示用）
    const initialMessage: AssistMessage = {
      id: messageId,
      role: "assistant",
      text: "",
      createdAt: new Date().toISOString(),
      metadata: params.isCheckpoint ? { type: "checkpoint" } : undefined,
    };
    setAssistMessages((prev) => [...prev, initialMessage]);
    console.log("[OpenAI Discussion] Initial message added", { messageId });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[OpenAI Discussion] Reader done");
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              console.log("[OpenAI Discussion] Chunk received", {
                type: data.type,
                chunkLength: data.text?.length,
                fullTextLength: data.fullText?.length,
              });

              if (data.type === "chunk") {
                fullText = data.fullText;

                // メッセージを更新（ストリーミング表示）
                setAssistMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId ? { ...m, text: fullText } : m
                  )
                );
              } else if (data.type === "done") {
                console.log("[OpenAI Discussion] Stream completed", {
                  finalLength: fullText.length,
                });

                // データベースに保存（議論アシストメッセージ）
                if (currentSession && fullText.trim()) {
                  try {
                    await fetch(`/api/meetings/${meetingId}/ai-messages`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sessionId: currentSession.id,
                        content: fullText,
                        source: "response",
                        provider: "openai_discussion",
                        mode: params.isCheckpoint ? "checkpoint" : "assistant",
                        turnId: messageId,
                      }),
                    });
                    console.log("[OpenAI Discussion] Saved to database", { messageId });
                  } catch (saveError) {
                    console.error("[OpenAI Discussion] Failed to save to database:", saveError);
                  }
                }
              } else if (data.type === "error") {
                console.error("[OpenAI Discussion] Stream error:", data.error);
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error(
                "[OpenAI Discussion] Parse error:",
                parseError,
                "Line:",
                line
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("[OpenAI Discussion] Stream reading error:", error);
      throw error;
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatTimestamp = (startTime?: number) => {
    if (startTime === undefined) return "";
    const minutes = Math.floor(startTime / 60);
    const seconds = Math.floor(startTime % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // キーボードショートカット (Alt+1/2)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) {
        if (event.key === '1') {
          event.preventDefault();
          setActiveTab('transcript');
        } else if (event.key === '2') {
          event.preventDefault();
          setActiveTab('ai');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  useEffect(() => {
    meetingSummaryContextRef.current = "";
    meetingSummaryContextLoadedRef.current = false;
  }, [meetingId]);

  // Terminology Helper の接続・切断管理は TermExplanationPane 内で自動的に行われる

  useEffect(() => {
    return () => {
      stopTerminologyMonitorSession();
    };
  }, [stopTerminologyMonitorSession]);

  // 自動終了タイマー（10秒ごとにチェック）
  useEffect(() => {
    // セッションが active でない場合はタイマーを起動しない
    if (sessionStatus !== "active" || !lastTranscriptAt) {
      return;
    }

    console.log("[Auto End Timer] ⏰ Watchdog timer started");

    const interval = setInterval(() => {
      const now = Date.now();
      const lastTime = lastTranscriptAt.getTime();
      const elapsedMs = now - lastTime;
      const IDLE_TIMEOUT_MS = 180000; // 3分 = 180秒

      console.log("[Auto End Timer] Checking idle time:", {
        elapsedMs,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
        threshold: IDLE_TIMEOUT_MS / 1000,
      });

      if (elapsedMs >= IDLE_TIMEOUT_MS) {
        console.log("[Auto End Timer] 🚨 Idle timeout reached, auto-ending session");
        clearInterval(interval);
        autoEndSession("idle_timeout");
      }
    }, 10000); // 10秒ごとにチェック

    return () => {
      console.log("[Auto End Timer] ⏰ Watchdog timer stopped");
      clearInterval(interval);
    };
  }, [sessionStatus, lastTranscriptAt, autoEndSession]);

  return (
    <>
      {/* ローディングモーダル */}
      <LoadingModal
        isOpen={loadingSteps.length > 0}
        title={
          loadingSteps.length > 0 && loadingSteps[0]?.label === "セッションを終了"
            ? "会議を終了しています"
            : loadingSteps.length > 0 && loadingSteps[0]?.label === "会議評価を生成"
            ? "会議評価を生成中"
            : aiMode === "google_ai"
            ? "Google AIに接続中"
            : "OpenAI Realtimeに接続中"
        }
        steps={loadingSteps}
      />

      {/* Gemini Live起動中ポップアップ */}
      {isGeminiConnecting && (
        <div className="fixed right-6 top-24 z-50 transition-all duration-300 ease-out">
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Gemini Live起動中
                </p>
                <p className="text-xs text-blue-700">
                  AIアシスタントを立ち上げています...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-screen w-full">
        {/* メインコンテンツエリア */}
        <div className="flex-1 overflow-auto p-4">
      {/* セッション終了時の要約表示（コスト節約のため一時停止） */}
      {false ? null : sessionStatus === "ended" && currentSession ? (
        <div className="mb-6" style={{ display: 'none' }}>
          <SessionSummary
            meetingId={meetingId}
            sessionId={currentSession.id}
            autoLoad={true}
          />
        </div>
      ) : null}

      {/* セッションコントロールバー */}
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-zinc-600">
            <p className="font-semibold text-zinc-900">
              {t('liveSession.sessionManagement')}
            </p>
            <p>
              {t('liveSession.sessionManagementDescription')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {sessionStatus === "idle" && (
              <button
                onClick={startSession}
                disabled={isLoading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? t('liveSession.starting') : t('liveSession.startMeeting')}
              </button>
            )}
            {sessionStatus === "active" && (
              <>
                <button
                  onClick={pauseSession}
                  disabled={isLoading}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {t('liveSession.pauseSession')}
                </button>
                <button
                  onClick={endSession}
                  disabled={isLoading}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {t('liveSession.endSession')}
                </button>
              </>
            )}
            {sessionStatus === "paused" && (
              <>
                <button
                  onClick={resumeSession}
                  disabled={isLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isLoading ? t('liveSession.resuming') : t('liveSession.resumeSession')}
                </button>
                <button
                  onClick={endSession}
                  disabled={isLoading}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {t('liveSession.endSession')}
                </button>
              </>
            )}
            {sessionStatus === "ended" && (
              <button
                onClick={startSession}
                disabled={isLoading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {t('liveSession.startNewSession')}
              </button>
            )}

            {/* 接続状態 */}
            {sessionStatus !== "idle" && (
              <span className="text-xs text-zinc-500">
                {connectionStatus === "connecting" && (
                  <span className="text-yellow-600">{t('liveSession.connectionConnecting')}</span>
                )}
                {connectionStatus === "connected" && (
                  <span className="flex items-center gap-1 text-green-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                    {t('liveSession.connectionConnected')}
                  </span>
                )}
                {connectionStatus === "disconnected" && (
                  <span className="text-red-600">{t('liveSession.connectionDisconnected')}</span>
                )}
                {connectionStatus === "ended" && (
                  <span className="text-blue-600">{t('liveSession.connectionEnded')}</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* タブバー */}
      <div className="sticky top-0 z-10 mb-4 backdrop-blur-sm bg-white/80 border-b border-zinc-200">
        <nav
          role="tablist"
          aria-label="会議コンテンツ"
          className="flex gap-2 px-2 pt-2"
        >
          {/* 文字起こしタブ - マスク中（将来の別機能で使用予定） */}
          {false && (
          <button
            role="tab"
            aria-selected={activeTab === 'transcript'}
            aria-controls="transcript-panel"
            onClick={() => setActiveTab('transcript')}
            className={`
              px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              ${
                activeTab === 'transcript'
                  ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }
            `}
          >
            文字起こし
            {transcripts.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-indigo-600 rounded-full">
                {transcripts.length}
              </span>
            )}
          </button>
          )}
          {/* AIアシスタントタブ - 一時的にマスク（将来使用予定） */}
          {false && (
          <button
            role="tab"
            aria-selected={activeTab === 'ai'}
            aria-controls="ai-panel"
            onClick={() => setActiveTab('ai')}
            className={`
              px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              ${
                activeTab === 'ai'
                  ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }
            `}
          >
            AIアシスタント
            {isGeminiActive && (
              <span className="ml-2 inline-block w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
            )}
          </button>
          )}
          <button
            role="tab"
            aria-selected={activeTab === 'discussionAssist'}
            aria-controls="discussion-assist-panel"
            onClick={() => setActiveTab('discussionAssist')}
            className={`
              px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              ${
                activeTab === 'discussionAssist'
                  ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }
            `}
          >
            {t('liveSession.tabs.discussionAssist')}
            {assistMessages.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-indigo-600 rounded-full">
                {assistMessages.length}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'history'}
            aria-controls="history-panel"
            onClick={() => setActiveTab('history')}
            className={`
              px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              ${
                activeTab === 'history'
                  ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }
            `}
          >
            {t('liveSession.tabs.history')}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'evaluation'}
            aria-controls="evaluation-panel"
            onClick={() => setActiveTab('evaluation')}
            className={`
              px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              ${
                activeTab === 'evaluation'
                  ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }
            `}
          >
            {t('liveSession.tabs.evaluation')}
          </button>
          {/* モバイル専用タブ: 用語解説 (PCでは右ペインで表示) */}
          <button
            role="tab"
            aria-selected={activeTab === 'terms'}
            aria-controls="terms-panel"
            onClick={() => setActiveTab('terms')}
            className={`
              lg:hidden px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              ${
                activeTab === 'terms'
                  ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }
            `}
          >
            {t('liveSession.tabs.terms')}
          </button>
          {/* モバイル専用タブ: 文字起こし (PCでは右ペインで表示) */}
          <button
            role="tab"
            aria-selected={activeTab === 'transcripts'}
            aria-controls="transcripts-panel"
            onClick={() => setActiveTab('transcripts')}
            className={`
              lg:hidden px-6 py-3 rounded-t-lg text-sm font-medium transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              ${
                activeTab === 'transcripts'
                  ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 border-b-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }
            `}
          >
            {t('liveSession.tabs.transcripts')}
          </button>
        </nav>
      </div>

      {/* タブパネル - 過去履歴タブと会議評価タブは別構造 */}
      {activeTab === 'history' ? (
        <div className="h-[calc(100vh-180px)]">
          <HistoryTab meetingId={meetingId} />
        </div>
      ) : activeTab === 'evaluation' ? (
        <div className="h-[calc(100vh-180px)]">
          <EvaluationTab meetingId={meetingId} />
        </div>
      ) : activeTab === 'terms' ? (
        <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white h-[calc(100vh-180px)] lg:hidden">
          <div
            role="tabpanel"
            id="terms-panel"
            aria-labelledby="terms-tab"
            className="flex flex-col h-full"
          >
            <div className="border-b border-zinc-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {t('liveSession.terminologyTitle')}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {t('liveSession.terminologyDescription')}
                </p>
              </div>
            </div>
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
        </div>
      ) : activeTab === 'transcripts' ? (
        <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white h-[calc(100vh-180px)] lg:hidden">
          <div
            role="tabpanel"
            id="transcripts-panel"
            aria-labelledby="transcripts-tab"
            className="flex flex-col h-full"
          >
            <div className="border-b border-zinc-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {t('liveSession.transcriptTitle')}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {t('liveSession.transcriptDescription')}
                </p>
              </div>
            </div>
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
        </div>
      ) : (
      <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white h-[calc(100vh-180px)]">
      {/* 文字起こしパネル - マスク中（将来の別機能で使用予定） */}
      {false && (
      <div
        role="tabpanel"
        id="transcript-panel"
        aria-labelledby="transcript-tab"
        hidden={activeTab !== 'transcript'}
        className={`flex flex-col h-full ${activeTab === 'transcript' ? 'animate-in fade-in duration-150' : ''}`}
      >
        <div className="border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              文字起こし（リアルタイム）
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              会議の発言がここに表示されます
            </p>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {transcripts.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-500">
                {sessionStatus === "idle"
                  ? "「会議を開始」ボタンを押して会議を始めてください"
                  : sessionStatus === "paused"
                    ? "会議が一時停止中です"
                    : sessionStatus === "ended"
                      ? "会議が終了しました"
                      : connectionStatus === "connecting"
                        ? "接続中..."
                        : "発言を待っています..."}
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
                    {formatTimestamp(transcript.startTime)}
                  </span>
                </div>
                <p className="text-sm text-zinc-700">{transcript.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {/* AI アシスタントパネル */}
      <div
        role="tabpanel"
        id="ai-panel"
        aria-labelledby="ai-tab"
        hidden={activeTab !== 'ai'}
        className={`flex flex-col h-full ${activeTab === 'ai' ? 'animate-in fade-in duration-150' : ''}`}
      >
        <div className="border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                AI アシスタント
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                AIの提案や応答が表示されます
              </p>
            </div>
            {isGeminiActive && (
              <div className="flex items-center gap-2 text-blue-600">
                <span className="inline-block w-3 h-3 bg-blue-600 rounded-full animate-pulse"></span>
                <span className="text-xs font-medium">Gemini Live</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 用語フォロー機能 - マスク中（将来の別機能で使用予定） */}
            {false && (
            <section className="flex h-full flex-col rounded-xl border border-amber-200 bg-amber-50 p-4">
              <header className="mb-3 border-b border-amber-200 pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900">
                      用語フォロー（テキストのみ）
                    </h3>
                    <p className="text-xs text-amber-700">
                      専門用語や難しい表現を噛み砕いて表示します
                    </p>
                  </div>
                  <div className="text-xs">
                    {isTerminologyConnecting && (
                      <span className="text-amber-700">接続中...</span>
                    )}
                    {isTerminologyActive && !isTerminologyConnecting && (
                      <span className="flex items-center gap-1 text-green-700">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                        稼働中
                      </span>
                    )}
                    {!isTerminologyActive && !isTerminologyConnecting && (
                      <span className="text-amber-700">待機中</span>
                    )}
                  </div>
                </div>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {terminologyMessages.length === 0 && !terminologyResponse ? (
                  <div className="flex h-full items-center justify-center text-xs text-amber-700">
                    会議の発言を待っています...
                  </div>
                ) : (
                  <>
                    {terminologyMessages.map((message) => (
                      <article
                        key={message.id}
                        className="rounded-lg border border-amber-100 bg-white/70 p-3 text-sm text-amber-900 shadow-sm"
                      >
                        <time className="mb-1 block text-xs text-amber-500">
                          {new Date(message.timestamp).toLocaleTimeString("ja-JP")}
                        </time>
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {message.text}
                        </p>
                      </article>
                    ))}
                    {terminologyResponse && (
                      <article className="rounded-lg border border-amber-300 bg-white/90 p-3 text-sm text-amber-900 shadow-sm">
                        <div className="mb-1 flex items-center gap-2 text-xs text-amber-600">
                          <span>解析中...</span>
                          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500"></span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {terminologyResponse}
                        </p>
                      </article>
                    )}
                  </>
                )}
              </div>
            </section>
            )}

            <section className="flex h-full flex-col">
              {aiMessages.length === 0 && !geminiResponse ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-500">
                    AIが会議を分析しています...
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {aiMessages.map((message, index) => (
                    <li
                      key={message.id}
                      className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <article
                        className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md max-w-full ${
                          message.type === "suggestion"
                            ? "border-blue-200 bg-blue-50"
                            : "border-indigo-200 bg-indigo-50"
                        }`}
                      >
                        <header className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-semibold ${
                                message.type === "suggestion"
                                  ? "text-blue-900"
                                  : "text-indigo-900"
                              }`}
                            >
                              {message.type === "suggestion" ? "💡 提案" : "🤖 AIアシスタント"}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                              Assistant
                            </span>
                          </div>
                          <time className="text-xs text-zinc-500">
                            {new Date(message.timestamp).toLocaleTimeString("ja-JP")}
                          </time>
                        </header>

                        <p
                          className={`whitespace-pre-wrap text-sm leading-relaxed ${
                            message.type === "suggestion"
                              ? "text-blue-900"
                              : "text-indigo-900"
                          }`}
                        >
                          {message.text}
                        </p>
                      </article>
                    </li>
                  ))}

                  {geminiResponse && (
                    <li className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <article className="rounded-xl border border-indigo-300 bg-indigo-100 p-4 shadow-sm opacity-90 max-w-full">
                        <header className="mb-3 flex items-center justify-between border-b border-indigo-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                              🤖 AIアシスタント
                              <span className="inline-block w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
                            </span>
                            <span className="rounded-full bg-indigo-200 px-2 py-0.5 text-xs text-indigo-700 animate-pulse">
                              送信中...
                            </span>
                          </div>
                          <time className="text-xs text-indigo-600">
                            {new Date().toLocaleTimeString("ja-JP")}
                          </time>
                        </header>

                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-indigo-900">
                          {geminiResponse}
                        </p>
                      </article>
                    </li>
                  )}
                </ul>
              )}
            </section>
          </div>
        </div>

        {/* ステータスバー */}
        <div className="border-t border-zinc-200 px-6 py-4">
          <div className="space-y-2 text-xs text-zinc-600">
            <div className="flex justify-between">
              <span>経過時間:</span>
              <span className="font-semibold text-zinc-900">
                {formatElapsedTime(elapsedTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>検出された話者:</span>
              <span className="font-semibold text-zinc-900">
                {speakerCount}人
              </span>
            </div>
            <div className="flex justify-between">
              <span>発言数:</span>
              <span className="font-semibold text-zinc-900">
                {transcripts.length}件
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 議論アシストパネル */}
      <div
        role="tabpanel"
        id="discussion-assist-panel"
        aria-labelledby="discussion-assist-tab"
        hidden={activeTab !== 'discussionAssist'}
        className={`flex flex-col h-full ${activeTab === 'discussionAssist' ? 'animate-in fade-in duration-150' : ''}`}
      >
        {/* アクションバー */}
        <div className="border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-zinc-900">
                {t('liveSession.discussionAssistTitle')}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {t('liveSession.discussionAssistDescription')}
              </p>
            </div>
            <button
              onClick={handleSummarizeDiscussion}
              disabled={isSummarizing || sessionStatus !== 'active'}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${
                  isSummarizing || sessionStatus !== 'active'
                    ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                }
              `}
            >
              {isSummarizing ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {t('common.processing')}
                </span>
              ) : (
                t('liveSession.summarizeDiscussion')
              )}
            </button>
          </div>
        </div>

        {/* メッセージリスト */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {assistMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-zinc-500">
                  {sessionStatus === "idle"
                    ? t('liveSession.discussionAssistPrompt')
                    : sessionStatus === "paused"
                      ? t('liveSession.sessionPaused')
                      : sessionStatus === "ended"
                        ? t('liveSession.sessionEndedMessage')
                        : t('liveSession.summarizeDiscussionPrompt')}
                </p>
              </div>
            </div>
          ) : (
            assistMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-zinc-100 text-zinc-900'
                      : message.role === 'system'
                        ? 'bg-red-50 text-red-900 border border-red-200'
                        : 'bg-slate-50 text-slate-800 border border-slate-200'
                  }`}
                >
                  {message.metadata?.type === 'checkpoint' && (
                    <div className="mb-2 flex items-center gap-2 text-xs opacity-75">
                      <span className="inline-block w-2 h-2 bg-current rounded-full"></span>
                      <span>{t('liveSession.viewer.checkpoint')}</span>
                    </div>
                  )}
                  <div className="text-sm leading-relaxed">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          h3: ({node, ...props}) => (
                            <h3
                              className="text-base font-bold text-slate-900 mt-3 mb-2 first:mt-0 flex items-center gap-2"
                              {...props}
                            />
                          ),
                          h2: ({node, ...props}) => (
                            <h2
                              className="text-lg font-bold text-slate-900 mt-4 mb-2 first:mt-0"
                              {...props}
                            />
                          ),
                          ul: ({node, ...props}) => (
                            <ul className="list-disc ml-5 space-y-1 my-2" {...props} />
                          ),
                          ol: ({node, ...props}) => (
                            <ol className="list-decimal ml-5 space-y-1 my-2" {...props} />
                          ),
                          li: ({node, ...props}) => (
                            <li className="text-slate-700" {...props} />
                          ),
                          p: ({node, ...props}) => (
                            <p className="text-slate-700 mb-2 last:mb-0" {...props} />
                          ),
                          strong: ({node, ...props}) => (
                            <strong className="font-semibold text-slate-900" {...props} />
                          ),
                          em: ({node, ...props}) => (
                            <em className="italic" {...props} />
                          ),
                          hr: ({node, ...props}) => (
                            <hr className="my-3 border-slate-300" {...props} />
                          ),
                        }}
                      >
                        {message.text}
                      </ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {message.text}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 text-xs opacity-75">
                    {new Date(message.createdAt).toLocaleTimeString('ja-JP')}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={assistMessagesEndRef} />
        </div>

        {/* 入力エリア */}
        <div className="border-t border-zinc-200 p-4">
          <form
            onSubmit={handleSendChat}
            className="flex gap-2"
          >
            <input
              type="text"
              value={assistInput}
              onChange={(e) => setAssistInput(e.target.value)}
              placeholder="決まったことだけ整理して"
              disabled={sessionStatus !== 'active' || isSummarizing || isSendingChat}
              className={`
                flex-1 px-4 py-2 rounded-lg border border-zinc-300
                focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${sessionStatus !== 'active' || isSummarizing || isSendingChat ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : ''}
              `}
            />
            <button
              type="submit"
              disabled={sessionStatus !== 'active' || isSummarizing || isSendingChat || !assistInput.trim()}
              className={`
                px-6 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${
                  sessionStatus !== 'active' || isSummarizing || isSendingChat || !assistInput.trim()
                    ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                }
              `}
            >
              {isSendingChat ? '送信中...' : '送信'}
            </button>
          </form>
        </div>
      </div>
      </div>
      )}
        </div>
        {/* メインコンテンツエリア終了 */}

        {/* 右ペイン - 用語解説 */}
        <TermExplanationPane
          ref={termPaneRef}
          meetingId={meetingId}
          sessionId={currentSession?.id || null}
          isSessionActive={sessionStatus === "active"}
          transcripts={transcripts}
          sessionStartTime={elapsedTime}
          industries={industries}
          onTermCardsChange={setTermCards}
        />
      </div>
      {/* flex container 終了 */}
    </>
  );
}
