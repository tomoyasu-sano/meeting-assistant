/**
 * Google AI 統合フック
 *
 * Google STT + Trigger Engine + Gemini + TTS を統合
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useGoogleSTT, Transcript } from "./useGoogleSTT";
import { useTriggerEngine, TriggerType } from "./useTriggerEngine";
import { useGeminiAI, AIResponse } from "./useGeminiAI";
import { useGoogleTTS } from "./useGoogleTTS";

type OutputMode = "text" | "audio" | "text_audio";

export function useGoogleAI(
  meetingTitle: string | undefined,
  outputMode: OutputMode,
  onTranscript: (transcript: Transcript) => void,
  onAIResponse: (response: AIResponse) => void
) {
  const [conversationHistory, setConversationHistory] = useState<Transcript[]>(
    []
  );
  const [isActive, setIsActive] = useState(false);

  const sessionIdRef = useRef<string>("");
  const currentResponseRef = useRef<string>("");

  // フック初期化（ハンドラーより先に初期化）
  const stt = useGoogleSTT((transcript: Transcript) => {
    // 確定した文字起こしを履歴に追加
    if (transcript.isFinal) {
      setConversationHistory((prev) => [...prev, transcript]);
    }

    // 親コンポーネントに通知
    onTranscript(transcript);

    // トリガーエンジンで評価
    triggerEngineRef.current?.evaluate(transcript);
  });

  const triggerEngineRef = useRef<ReturnType<typeof useTriggerEngine> | undefined>(undefined);
  const geminiRef = useRef<ReturnType<typeof useGeminiAI> | undefined>(undefined);
  const ttsRef = useRef<ReturnType<typeof useGoogleTTS> | undefined>(undefined);

  const gemini = useGeminiAI(
    (response: AIResponse) => {
      console.log("[useGoogleAI] AI response received", {
        text: response.text,
        outputMode,
      });

      // 親コンポーネントに通知
      onAIResponse(response);

      // 音声出力が必要な場合
      if (outputMode === "audio" || outputMode === "text_audio") {
        ttsRef.current?.speak(response.text);
      }
    },
    (chunk: string) => {
      currentResponseRef.current += chunk;
      // リアルタイム表示が必要な場合はここで処理
    }
  );
  geminiRef.current = gemini;

  const tts = useGoogleTTS(() => {
    console.log("[useGoogleAI] Barge-in detected, stopping TTS");
  });
  ttsRef.current = tts;

  const triggerEngine = useTriggerEngine(
    conversationHistory,
    (
      triggerType: TriggerType,
      context: {
        transcript: Transcript;
        conversationHistory: Transcript[];
      }
    ) => {
      console.log("[useGoogleAI] Trigger detected", {
        triggerType,
        historyLength: context.conversationHistory.length,
      });

      // STOP トリガーの場合は応答を停止
      if (triggerType === "STOP") {
        console.log("[useGoogleAI] 🛑 STOP trigger detected - stopping TTS");
        ttsRef.current?.cleanup();
        return;
      }

      // Gemini応答生成
      geminiRef.current?.generateResponse(
        sessionIdRef.current,
        triggerType,
        context.conversationHistory,
        meetingTitle
      );
    },
    isActive
  );
  triggerEngineRef.current = triggerEngine;

  /**
   * 接続開始
   */
  const connect = useCallback(async (sessionId: string, meetingId: string) => {
    console.log("[useGoogleAI] Connecting...", { sessionId, meetingId });

    try {
      sessionIdRef.current = sessionId;
      await stt.connect(sessionId, meetingId);
      setIsActive(true);
      console.log("[useGoogleAI] Connected");
    } catch (error) {
      console.error("[useGoogleAI] Connection error", error);
      throw error;
    }
  }, [stt]);

  /**
   * 接続終了
   */
  const disconnect = useCallback(() => {
    console.log("[useGoogleAI] Disconnecting...");

    stt.disconnect();
    tts.cleanup();
    setIsActive(false);
    setConversationHistory([]);

    console.log("[useGoogleAI] Disconnected");
  }, [stt, tts]);

  // クリーンアップ（コンポーネントアンマウント時のみ）
  useEffect(() => {
    return () => {
      console.log("[useGoogleAI] Component unmounting, cleaning up");
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    connect,
    disconnect,
    isConnected: stt.isConnected,
    isGenerating: gemini.isGenerating,
    isSpeaking: tts.isSpeaking,
    error: stt.error || gemini.error || tts.error,
  };
}
