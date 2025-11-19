/**
 * トリガーエンジン フック
 *
 * 文字起こしテキストを監視し、AIが応答すべきタイミングを判定する
 */

import { useEffect, useRef, useCallback } from "react";

export type TriggerType =
  | "NONE"
  | "DIRECT_CALL"
  | "SUMMARY_REQUEST"
  | "RESEARCH_REQUEST"
  | "QUESTION"
  | "LONG_SPEECH"
  | "SILENCE"
  | "STOP";

export type Transcript = {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
};

type TriggerCallback = (
  triggerType: TriggerType,
  context: {
    transcript: Transcript;
    conversationHistory: Transcript[];
  }
) => void;

// トリガーパターン
const TRIGGER_PATTERNS = {
  DIRECT_CALL: [/AI[君くんさん]?/, /[Mm]iton/, /ミトン/, /アシスタント/],
  STOP: [/ストップ/, /止め(て|てください)?/, /停止/],
  SUMMARY_REQUEST: [
    /まとめ(て|てください)?/,
    /整理(して|してください)?/,
    /要約(して|してください)?/,
  ],
  RESEARCH_REQUEST: [
    /調べて/,
    /検索(して|してください)?/,
    /探して/,
    /調査(して|してください)?/,
    /確認(して|してください)?/,
  ],
  QUESTION: [
    /[？?]$/,
    /どう思[う|い|います]/,
    /意見(は|を|ある)?/,
    /考え(は|を|ある)?/,
  ],
};

// 時間ベース設定
const LONG_SPEECH_MS = 30000; // 30秒
const SILENCE_MS = 10000; // 10秒
const MIN_INTERVAL_MS = 120000; // 2分（最小トリガー間隔）

export function useTriggerEngine(
  conversationHistory: Transcript[],
  onTrigger: TriggerCallback,
  enabled: boolean = true
) {
  const lastTriggerTime = useRef<number>(0);
  const lastSpeechTime = useRef<number>(Date.now());
  const currentSpeakerStartTime = useRef<number>(Date.now());
  const currentSpeaker = useRef<string>("");
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * トリガー判定（テキストベース）
   */
  const evaluateTextTrigger = useCallback(
    (transcript: Transcript): TriggerType => {
      const text = transcript.text;

      // ストップ（最優先）
      if (TRIGGER_PATTERNS.STOP.some((pattern) => pattern.test(text))) {
        return "STOP";
      }

      // 直接呼びかけ
      if (TRIGGER_PATTERNS.DIRECT_CALL.some((pattern) => pattern.test(text))) {
        return "DIRECT_CALL";
      }

      // 要約依頼
      if (
        TRIGGER_PATTERNS.SUMMARY_REQUEST.some((pattern) => pattern.test(text))
      ) {
        return "SUMMARY_REQUEST";
      }

      // 調査依頼
      if (
        TRIGGER_PATTERNS.RESEARCH_REQUEST.some((pattern) => pattern.test(text))
      ) {
        return "RESEARCH_REQUEST";
      }

      // 質問
      if (TRIGGER_PATTERNS.QUESTION.some((pattern) => pattern.test(text))) {
        return "QUESTION";
      }

      return "NONE";
    },
    []
  );

  /**
   * 長時間発言チェック
   */
  const checkLongSpeech = useCallback((speaker: string): TriggerType => {
    const now = Date.now();

    if (speaker === currentSpeaker.current) {
      const speechDuration = now - currentSpeakerStartTime.current;
      if (speechDuration > LONG_SPEECH_MS) {
        return "LONG_SPEECH";
      }
    } else {
      // 話者が変わった
      currentSpeaker.current = speaker;
      currentSpeakerStartTime.current = now;
    }

    return "NONE";
  }, []);

  /**
   * トリガー実行（頻度制御付き）
   */
  const fireTrigger = useCallback(
    (triggerType: TriggerType, transcript: Transcript) => {
      const now = Date.now();

      // 最小間隔チェック
      if (now - lastTriggerTime.current < MIN_INTERVAL_MS) {
        console.log("[TriggerEngine] Skipped (too soon)", {
          triggerType,
          elapsedMs: now - lastTriggerTime.current,
        });
        return;
      }

      console.log("[TriggerEngine] Trigger fired", {
        triggerType,
        text: transcript.text.substring(0, 50),
      });

      lastTriggerTime.current = now;
      onTrigger(triggerType, { transcript, conversationHistory });
    },
    [conversationHistory, onTrigger]
  );

  /**
   * 新しい文字起こしを評価
   */
  const evaluate = useCallback(
    (transcript: Transcript) => {
      if (!enabled || !transcript.isFinal) {
        return;
      }

      console.log("[TriggerEngine] Evaluating", {
        speaker: transcript.speaker,
        text: transcript.text.substring(0, 50),
      });

      // 発言時刻更新
      lastSpeechTime.current = Date.now();

      // 沈黙タイマーリセット
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      // テキストベーストリガー
      const textTrigger = evaluateTextTrigger(transcript);
      if (textTrigger !== "NONE") {
        fireTrigger(textTrigger, transcript);
        return;
      }

      // 長時間発言チェック
      const longSpeechTrigger = checkLongSpeech(transcript.speaker);
      if (longSpeechTrigger !== "NONE") {
        fireTrigger(longSpeechTrigger, transcript);
        return;
      }

      // 沈黙タイマー設定
      silenceTimerRef.current = setTimeout(() => {
        console.log("[TriggerEngine] Silence detected");
        fireTrigger("SILENCE", transcript);
      }, SILENCE_MS);
    },
    [enabled, evaluateTextTrigger, checkLongSpeech, fireTrigger]
  );

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  return {
    evaluate,
  };
}
