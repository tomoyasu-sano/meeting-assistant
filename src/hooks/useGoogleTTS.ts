/**
 * Google TTS フック
 *
 * テキストを音声に変換して再生（Barge-in監視付き）
 */

import { useState, useCallback, useRef } from "react";
import { Transcript } from "./useGoogleSTT";

export function useGoogleTTS(onBargeIn?: () => void) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const bargeInMonitorRef = useRef<((transcript: Transcript) => void) | null>(
    null
  );

  /**
   * 音声再生
   */
  const speak = useCallback(
    async (
      text: string,
      options?: {
        voice?: string;
        speed?: number;
        pitch?: number;
      }
    ) => {
      try {
        setError(null);

        console.log("[useGoogleTTS] Synthesizing speech", {
          textLength: text.length,
          options,
        });

        // TTS APIリクエスト
        const response = await fetch("/api/tts/synthesize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            voice: options?.voice,
            speed: options?.speed || 1.0,
            pitch: options?.pitch || 0.0,
          }),
        });

        if (!response.ok) {
          throw new Error(`TTS API error: ${response.statusText}`);
        }

        const data = await response.json();
        const { audioContent, duration } = data;

        // Base64デコード
        const audioData = Uint8Array.from(atob(audioContent), (c) =>
          c.charCodeAt(0)
        );

        // AudioContext作成
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        const audioContext = audioContextRef.current;

        // 音声デコード
        const audioBuffer = await audioContext.decodeAudioData(
          audioData.buffer
        );

        // 音声再生
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        sourceNodeRef.current = source;
        setIsSpeaking(true);

        console.log("[useGoogleTTS] Playing audio", {
          duration: audioBuffer.duration,
        });

        source.onended = () => {
          console.log("[useGoogleTTS] Audio playback ended");
          setIsSpeaking(false);
          sourceNodeRef.current = null;
        };

        source.start(0);
      } catch (err) {
        console.error("[useGoogleTTS] Error", err);
        setError(err instanceof Error ? err.message : "TTS failed");
        setIsSpeaking(false);
      }
    },
    []
  );

  /**
   * 音声停止（Barge-in）
   */
  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      console.log("[useGoogleTTS] Stopping audio (barge-in)");

      try {
        sourceNodeRef.current.stop();
      } catch (err) {
        // 既に停止している場合のエラーを無視
      }

      sourceNodeRef.current = null;
      setIsSpeaking(false);

      onBargeIn?.();
    }
  }, [onBargeIn]);

  /**
   * Barge-in監視を開始
   * 新しい文字起こしが来たら音声を停止
   */
  const startBargeInMonitoring = useCallback(
    (onNewTranscript: (transcript: Transcript) => void) => {
      bargeInMonitorRef.current = (transcript: Transcript) => {
        if (isSpeaking && transcript.isFinal && transcript.speaker !== "AI") {
          console.log("[useGoogleTTS] Barge-in detected", {
            speaker: transcript.speaker,
          });
          stop();
        }
        onNewTranscript(transcript);
      };
    },
    [isSpeaking, stop]
  );

  /**
   * クリーンアップ
   */
  const cleanup = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (err) {
        // 無視
      }
      sourceNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsSpeaking(false);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    error,
    startBargeInMonitoring,
    cleanup,
  };
}
