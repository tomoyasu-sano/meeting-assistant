import { useState, useCallback, useRef } from "react";
import { useGoogleSTT, Transcript } from "./useGoogleSTT";
import { logLanguageExchangeCostSummary } from "@/lib/pricing/calculate-costs";

export type LanguageCard = {
  id: string;
  originalText: string;
  originalLanguage: string;
  translations: {
    en: string | null;
    ja: string | null;
    partner: string | null; // 相手の言語
  };
  isTranslating: boolean;
  isFinal: boolean; // 確定したかどうか
  timestamp: string;
};

type UseLanguageExchangeOptions = {
  partnerLanguage: string; // 相手の母語 (例: "ko", "zh", "es")
  onTranscriptReceived?: (card: LanguageCard) => void;
};

export function useLanguageExchange({
  partnerLanguage,
  onTranscriptReceived,
}: UseLanguageExchangeOptions) {
  const [cards, setCards] = useState<LanguageCard[]>([]);
  const [lastTranscriptAt, setLastTranscriptAt] = useState<Date | null>(null);

  // 一時的なセッションID（言語交換専用）
  const sessionIdRef = useRef<string>("");

  // 一時的なカードID（Partial/Finalで共有）
  const currentCardIdRef = useRef<string | null>(null);

  // セッション開始時刻（料金計算用）
  const sessionStartTimeRef = useRef<Date | null>(null);

  // 翻訳文字数の合計（料金計算用）
  const totalTranslationCharsRef = useRef<number>(0);

  // Google STT フックを使用
  const stt = useGoogleSTT((transcript: Transcript) => {
    // 空のテキストはスキップ
    if (!transcript.text || !transcript.text.trim()) {
      return;
    }

    const isFinal = transcript.isFinal;
    const text = transcript.text;

    console.log(`[Language Exchange] ${isFinal ? 'Final' : 'Partial'} transcript received:`, text);

    // タイムスタンプを更新
    setLastTranscriptAt(new Date());

    // Partial結果の場合、同じカードIDを使用
    // Final結果の場合、新しいカードIDを生成し、次のPartialに備える
    if (!isFinal && !currentCardIdRef.current) {
      // 最初のPartial結果：新しいカードを作成
      currentCardIdRef.current = `card-${Date.now()}`;
    } else if (isFinal) {
      // Final結果：現在のIDを使用し、次回のために新しいIDを準備
      if (!currentCardIdRef.current) {
        currentCardIdRef.current = `card-${Date.now()}`;
      }
      // 次のPartialのためにリセット
      const cardId = currentCardIdRef.current;
      currentCardIdRef.current = null;

      // カードを更新または新規作成
      setCards((prev) => {
        const existingIndex = prev.findIndex((c) => c.id === cardId);
        if (existingIndex >= 0) {
          // 既存のカードを更新（Partialから確定）
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            originalText: text,
            isFinal: true,
            isTranslating: true,
          };
          return updated;
        } else {
          // 新しいカードを作成
          return [...prev, {
            id: cardId,
            originalText: text,
            originalLanguage: "unknown",
            translations: { en: null, ja: null, partner: null },
            isTranslating: true,
            isFinal: true,
            timestamp: new Date().toISOString(),
          }];
        }
      });

      // Final結果の場合のみ翻訳処理を開始
      const finalCardId = cardId;

      // 翻訳処理を開始
      (async () => {
        try {
          // 翻訳対象言語を決定（相手の言語が英語の場合は英語への翻訳を省略）
          const targetLanguages = partnerLanguage === "en"
            ? ["ja", partnerLanguage]  // 英語の場合: 日本語のみ
            : ["en", "ja", partnerLanguage];  // その他: 英語、日本語、相手の言語

          const response = await fetch("/api/translation/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: text,
              targetLanguages: targetLanguages,
            }),
          });

          if (response.ok) {
            const { detectedLanguage, translations } = await response.json();

            console.log("[Language Exchange] Translation completed:", {
              detectedLanguage,
              translations,
            });

            // 翻訳文字数を追加（オリジナルテキスト + 翻訳結果）
            const translatedChars =
              text.length +
              (translations.en?.length || 0) +
              (translations.ja?.length || 0) +
              (translations[partnerLanguage]?.length || 0);
            totalTranslationCharsRef.current += translatedChars;

            // カードを更新
            setCards((prev) =>
              prev.map((card) =>
                card.id === finalCardId
                  ? {
                      ...card,
                      originalLanguage: detectedLanguage,
                      translations: {
                        en: translations.en || null,
                        ja: translations.ja || null,
                        partner: translations[partnerLanguage] || null,
                      },
                      isTranslating: false,
                    }
                  : card
              )
            );

            // コールバックを呼び出し
            if (onTranscriptReceived) {
              const completedCard = {
                id: finalCardId,
                originalText: text,
                originalLanguage: detectedLanguage,
                translations: {
                  en: translations.en || null,
                  ja: translations.ja || null,
                  partner: translations[partnerLanguage] || null,
                },
                isTranslating: false,
                isFinal: true,
                timestamp: new Date().toISOString(),
              };
              onTranscriptReceived(completedCard);
            }
          } else {
            console.error("[Language Exchange] Translation failed");
            // エラー時はカードを翻訳失敗として更新
            setCards((prev) =>
              prev.map((card) =>
                card.id === finalCardId
                  ? { ...card, isTranslating: false }
                  : card
              )
            );
          }
        } catch (translationError) {
          console.error("[Language Exchange] Translation error:", translationError);
          setCards((prev) =>
            prev.map((card) =>
              card.id === finalCardId
                ? { ...card, isTranslating: false }
                : card
            )
          );
        }
      })();

      return; // Final結果の処理はここまで
    }

    // Partial結果の表示（翻訳なし）
    const partialCardId = currentCardIdRef.current!;
    setCards((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === partialCardId);
      if (existingIndex >= 0) {
        // 既存のカードを更新
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          originalText: text,
          isFinal: false,
        };
        return updated;
      } else {
        // 新しいPartialカードを作成
        return [...prev, {
          id: partialCardId,
          originalText: text,
          originalLanguage: "unknown",
          translations: { en: null, ja: null, partner: null },
          isTranslating: false,
          isFinal: false,
          timestamp: new Date().toISOString(),
        }];
      }
    });
  });

  // 接続を開始
  const connect = useCallback(async () => {
    console.log("[Language Exchange] Starting STT connection...", {
      partnerLanguage,
    });

    // 一時的なセッションIDとミーティングIDを生成
    const tempSessionId = `lang-exchange-${Date.now()}`;
    // ミーティングIDに言語情報を含める
    const tempMeetingId = `language-exchange-${partnerLanguage}`;

    sessionIdRef.current = tempSessionId;
    sessionStartTimeRef.current = new Date(); // セッション開始時刻を記録
    totalTranslationCharsRef.current = 0; // 翻訳文字数をリセット

    try {
      await stt.connect(tempSessionId, tempMeetingId);
      setLastTranscriptAt(new Date()); // タイマー開始
      console.log("[Language Exchange] STT connected successfully");
    } catch (error) {
      console.error("[Language Exchange] Connection error:", error);
      throw error;
    }
  }, [stt, partnerLanguage]);

  // 接続を切断
  const disconnect = useCallback(() => {
    console.log("[Language Exchange] Disconnecting...");

    // 料金計算
    if (sessionStartTimeRef.current) {
      const endTime = new Date();
      const durationMinutes =
        (endTime.getTime() - sessionStartTimeRef.current.getTime()) / 60000;

      // 料金サマリーをログ出力
      logLanguageExchangeCostSummary({
        durationMinutes,
        translationChars: totalTranslationCharsRef.current,
      });

      // リセット
      sessionStartTimeRef.current = null;
      totalTranslationCharsRef.current = 0;
    }

    stt.disconnect();
    setLastTranscriptAt(null);
  }, [stt]);

  return {
    cards,
    isConnected: stt.isConnected,
    isRecording: stt.isConnected, // STT接続中 = 録音中
    lastTranscriptAt,
    connect,
    disconnect,
    setCards, // カードを手動でクリアする場合に使用
  };
}
