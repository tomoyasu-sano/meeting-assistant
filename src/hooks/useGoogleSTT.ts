/**
 * Google STT フック
 *
 * ブラウザで音声をキャプチャし、AudioWorkletでPCM16へ変換して送信。
 * SSEで文字起こし結果を受信。
 */

import { useEffect, useRef, useCallback, useState } from "react";

export type Transcript = {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  confidence?: number;
  isFinal: boolean;
};

export function useGoogleSTT(
  onTranscript: (transcript: Transcript) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pcmChunksRef = useRef<Int16Array[]>([]);
  const sequenceRef = useRef(0);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string>("");
  const meetingIdRef = useRef<string>("");

  // 二重接続防止ガード
  const connectingRef = useRef(false);
  const connectedRef = useRef(false);

  /**
   * 接続開始
   */
  const connect = useCallback(async (sessionId: string, meetingId: string) => {
    // 既に接続中または接続済みの場合はスキップ
    if (connectingRef.current || connectedRef.current) {
      console.log("[useGoogleSTT] Already connecting or connected, skipping");
      return;
    }

    connectingRef.current = true;

    try {
      setError(null);
      sessionIdRef.current = sessionId;
      meetingIdRef.current = meetingId;

      console.log("[useGoogleSTT] Connecting...", { sessionId, meetingId });

      // 1. SSE接続（文字起こし結果の受信）- ready イベントを待つ
      await new Promise<void>((resolve, reject) => {
        const eventSource = new EventSource(
          `/api/stt/stream?sessionId=${sessionId}&meetingId=${meetingId}`
        );

        let timedOut = false;
        let timeoutId: NodeJS.Timeout | null = null;

        const clear = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        };

        const handleTimeout = () => {
          if (timedOut) return;
          timedOut = true;
          setError("SSE ready timeout");
          setIsConnected(false);
          console.error("[useGoogleSTT] SSE ready timeout");
          clear();
          eventSource.close();
          reject(new Error("SSE ready timeout"));
        };

        // サーバーからのready イベント（STT初期化完了）を待つ
        eventSource.addEventListener("ready", () => {
          if (timedOut) return;
          console.log("[useGoogleSTT] ✅ SSE Ready - STT stream initialized");
          setIsConnected(true);
          clear();
          resolve(); // STT初期化完了を通知
        });

        eventSource.addEventListener("partial", (e) => {
          if (timedOut) return;
          const data = JSON.parse(e.data);
          console.log("[useGoogleSTT] Partial transcript:", data.text);
          onTranscript({ ...data, isFinal: false });
        });

        eventSource.addEventListener("final", (e) => {
          if (timedOut) return;
          const data = JSON.parse(e.data);
          console.log("[useGoogleSTT] Final transcript:", data.text);
          onTranscript({ ...data, isFinal: true });
        });

        // サーバーからの明示的なエラーイベント
        eventSource.addEventListener("error", (e: any) => {
          if (timedOut) return;
          console.error("[useGoogleSTT] SSE error event", {
            readyState: eventSource.readyState,
            event: e,
          });

          // データがある場合はパースを試みる
          if (e.data) {
            try {
              const errorData = JSON.parse(e.data);
              console.error("[useGoogleSTT] Server error:", errorData);
              setError(`Server error: ${errorData.message}`);
            } catch (parseError) {
              console.error("[useGoogleSTT] Failed to parse error data");
              setError("SSE connection error");
            }
          } else {
            setError("SSE connection error");
          }
        });

        eventSourceRef.current = eventSource;

        // タイムアウト設定（60秒 - STT初期化を待つ）
        timeoutId = setTimeout(() => {
          if (!connectedRef.current) {
            handleTimeout();
          }
        }, 60000);
      });

      // readyイベント受信後、サーバー側のセッション準備完了を確実にするため少し待機
      console.log("[useGoogleSTT] Waiting for server session to be fully ready...");
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms待機
      console.log("[useGoogleSTT] Server session ready, proceeding with audio capture");

      // 2. SSE接続完了後に音声キャプチャ開始
      console.log("[useGoogleSTT] Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // STT v1は16kHzが推奨
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      console.log("[useGoogleSTT] Microphone access granted");

      mediaStreamRef.current = stream;

      if (typeof window === "undefined") {
        throw new Error("Audio capture is not available on the server");
      }

      const AudioContextCtor = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!AudioContextCtor) {
        throw new Error("AudioContext is not supported in this browser");
      }

      const audioContext = new AudioContextCtor({
        sampleRate: 16000,
        latencyHint: "interactive",
      });
      audioContextRef.current = audioContext;

      await audioContext.resume();
      await audioContext.audioWorklet.addModule(
        "/worklets/pcm16-processor.js"
      );

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "pcm16-processor");
      workletNodeRef.current = workletNode;

      pcmChunksRef.current = [];
      workletNode.port.onmessage = ({ data }) => {
        if (data instanceof Int16Array) {
          pcmChunksRef.current.push(data);
        } else if (data?.buffer) {
          pcmChunksRef.current.push(new Int16Array(data.buffer));
        } else {
          console.warn("[useGoogleSTT] Received unknown audio payload", data);
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
      console.log("[useGoogleSTT] AudioWorklet pipeline ready");

      // 500msごとに音声をアップロード
      uploadIntervalRef.current = setInterval(async () => {
        if (pcmChunksRef.current.length === 0) {
          return;
        }

        const chunks = pcmChunksRef.current.splice(0);
        const totalSamples = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Int16Array(totalSamples);

        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        const audioBlob = new Blob([combined.buffer], {
          type: "audio/pcm",
        });

        console.log("[useGoogleSTT] Uploading audio chunk:", {
          bytes: audioBlob.size,
          samples: combined.length,
          sequence: sequenceRef.current,
          sessionId: sessionIdRef.current,
        });

        const formData = new FormData();
        formData.append("sessionId", sessionIdRef.current);
        formData.append("audio", audioBlob);
        formData.append("sequence", sequenceRef.current.toString());

        try {
          const response = await fetch("/api/stt/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("[useGoogleSTT] Upload failed", {
              status: response.status,
              error: errorText,
            });
          } else {
            const result = await response.json();
            console.log("[useGoogleSTT] Upload success", result);
            sequenceRef.current++;
          }
        } catch (uploadError) {
          console.error("[useGoogleSTT] Upload error", uploadError);
        }
      }, 500);

      connectedRef.current = true; // 接続成功
      console.log("[useGoogleSTT] Audio capture active (PCM16)");
    } catch (err) {
      console.error("[useGoogleSTT] Connection error", err);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
      if (workletNodeRef.current) {
        try {
          workletNodeRef.current.port.onmessage = null;
          workletNodeRef.current.disconnect();
        } catch (error) {
          console.warn("[useGoogleSTT] Failed to disconnect worklet", error);
        }
        workletNodeRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch((error) => {
          console.warn("[useGoogleSTT] Failed to close audio context", error);
        });
        audioContextRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      pcmChunksRef.current = [];
      setError(err instanceof Error ? err.message : "Connection failed");
      setIsConnected(false);
      connectedRef.current = false;
      throw err;
    } finally {
      connectingRef.current = false;
    }
  }, [onTranscript]);

  /**
   * 接続終了
   */
  const disconnect = useCallback(() => {
    console.log("[useGoogleSTT] Disconnecting...");

    // 二重接続防止フラグをリセット
    connectingRef.current = false;
    connectedRef.current = false;

    // SSE切断
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // アップロード停止
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }

    // AudioWorklet停止
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
      } catch (error) {
        console.warn("[useGoogleSTT] Failed to disconnect worklet", error);
      }
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch((error) => {
        console.warn("[useGoogleSTT] Failed to close audio context", error);
      });
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    pcmChunksRef.current = [];

    setIsConnected(false);
    sequenceRef.current = 0;

    console.log("[useGoogleSTT] Disconnected");
  }, []);

  // クリーンアップ（コンポーネントアンマウント時のみ）
  useEffect(() => {
    return () => {
      console.log("[useGoogleSTT] Component unmounting, cleaning up");
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    connect,
    disconnect,
    isConnected,
    error,
  };
}
