"use client";

import { useRef, useEffect } from "react";
import { useTranslations } from 'next-intl';
import type { LanguageCard } from "@/hooks/useLanguageExchange";

type LanguageExchangeColumnsProps = {
  cards: LanguageCard[];
  partnerLanguage: string;
  partnerLanguageName: string;
};

export function LanguageExchangeColumns({
  cards,
  partnerLanguage,
  partnerLanguageName,
}: LanguageExchangeColumnsProps) {
  const t = useTranslations('languageExchange');
  const partnerColumnRef = useRef<HTMLDivElement>(null);
  const englishColumnRef = useRef<HTMLDivElement>(null);
  const japaneseColumnRef = useRef<HTMLDivElement>(null);

  // 新しいカードが追加されたら自動スクロール
  useEffect(() => {
    if (cards.length > 0) {
      partnerColumnRef.current?.scrollTo({ top: partnerColumnRef.current.scrollHeight, behavior: "smooth" });
      englishColumnRef.current?.scrollTo({ top: englishColumnRef.current.scrollHeight, behavior: "smooth" });
      japaneseColumnRef.current?.scrollTo({ top: japaneseColumnRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [cards]);

  const getLanguageEmoji = (langCode: string) => {
    const emojiMap: { [key: string]: string } = {
      ja: "🇯🇵",
      en: "🇬🇧",
      sv: "🇸🇪",
      ko: "🇰🇷",
      zh: "🇨🇳",
      es: "🇪🇸",
      fr: "🇫🇷",
      de: "🇩🇪",
      it: "🇮🇹",
      pt: "🇵🇹",
      ru: "🇷🇺",
      tr: "🇹🇷",
      th: "🇹🇭",
      vi: "🇻🇳",
    };
    return emojiMap[langCode] || "🌐";
  };

  return (
    <div className={`grid ${partnerLanguage === "en" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"} gap-4 h-[calc(100vh-300px)]`}>
      {/* 相手語カラム */}
      <div className="flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3 text-white font-semibold text-base">
          {getLanguageEmoji(partnerLanguage)} {partnerLanguageName}
        </div>
        <div ref={partnerColumnRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`rounded-lg p-4 shadow-sm ${
                card.isFinal
                  ? "bg-purple-50 border border-purple-200"
                  : "bg-zinc-50 border border-zinc-200"
              }`}
            >
              {card.isTranslating ? (
                <div className="flex items-center gap-2 text-purple-600">
                  <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm md:text-base">{t('translating')}</span>
                </div>
              ) : (
                <div>
                  {card.originalLanguage === partnerLanguage ? (
                    <div>
                      <span className={`text-xs md:text-sm font-medium ${card.isFinal ? 'text-purple-600' : 'text-zinc-500'}`}>
                        {t('original')}{!card.isFinal && <span className="ml-1">{t('recognizing')}</span>}
                      </span>
                      <p className={`${card.isFinal ? "text-gray-900" : "text-gray-500"} mt-1 text-sm md:text-base`}>
                        {card.originalText}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className={`text-xs md:text-sm font-medium ${card.isFinal ? 'text-purple-600' : 'text-zinc-500'}`}>
                        {t('translation')}{!card.isFinal && <span className="ml-1">{t('recognizing')}</span>}
                      </span>
                      <p className={`${card.isFinal ? "text-gray-900" : "text-gray-500"} mt-1 text-sm md:text-base`}>
                        {card.translations.partner || t('noTranslation')}
                      </p>
                    </div>
                  )}
                  <div className="mt-2 text-xs md:text-sm text-gray-500">
                    {new Date(card.timestamp).toLocaleTimeString("ja-JP")}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 英語カラム（相手の言語が英語でない場合のみ表示） */}
      {partnerLanguage !== "en" && (
        <div className="flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-white font-semibold text-base">
            🇬🇧 {t('english')}
          </div>
          <div ref={englishColumnRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`rounded-lg p-4 shadow-sm ${
                card.isFinal
                  ? "bg-blue-50 border border-blue-200"
                  : "bg-zinc-50 border border-zinc-200"
              }`}
            >
              {card.isTranslating ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm md:text-base">{t('translating')}</span>
                </div>
              ) : (
                <div>
                  {card.originalLanguage === "en" ? (
                    <div>
                      <span className={`text-xs md:text-sm font-medium ${card.isFinal ? 'text-blue-600' : 'text-zinc-500'}`}>
                        {t('original')}{!card.isFinal && <span className="ml-1">{t('recognizing')}</span>}
                      </span>
                      <p className={`${card.isFinal ? "text-gray-900" : "text-gray-500"} mt-1 text-sm md:text-base`}>
                        {card.originalText}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className={`text-xs md:text-sm font-medium ${card.isFinal ? 'text-blue-600' : 'text-zinc-500'}`}>
                        {t('translation')}{!card.isFinal && <span className="ml-1">{t('recognizing')}</span>}
                      </span>
                      <p className={`${card.isFinal ? "text-gray-900" : "text-gray-500"} mt-1 text-sm md:text-base`}>
                        {card.translations.en || t('noTranslation')}
                      </p>
                    </div>
                  )}
                  <div className="mt-2 text-xs md:text-sm text-gray-500">
                    {new Date(card.timestamp).toLocaleTimeString("ja-JP")}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
      )}

      {/* 日本語カラム */}
      <div className="flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 text-white font-semibold text-base">
          🇯🇵 {t('japanese')}
        </div>
        <div ref={japaneseColumnRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`rounded-lg p-4 shadow-sm ${
                card.isFinal
                  ? "bg-green-50 border border-green-200"
                  : "bg-zinc-50 border border-zinc-200"
              }`}
            >
              {card.isTranslating ? (
                <div className="flex items-center gap-2 text-green-600">
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm md:text-base">{t('translating')}</span>
                </div>
              ) : (
                <div>
                  {card.originalLanguage === "ja" ? (
                    <div>
                      <span className={`text-xs md:text-sm font-medium ${card.isFinal ? 'text-green-600' : 'text-zinc-500'}`}>
                        {t('original')}{!card.isFinal && <span className="ml-1">{t('recognizing')}</span>}
                      </span>
                      <p className={`${card.isFinal ? "text-gray-900" : "text-gray-500"} mt-1 text-sm md:text-base`}>
                        {card.originalText}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className={`text-xs md:text-sm font-medium ${card.isFinal ? 'text-green-600' : 'text-zinc-500'}`}>
                        {t('translation')}{!card.isFinal && <span className="ml-1">{t('recognizing')}</span>}
                      </span>
                      <p className={`${card.isFinal ? "text-gray-900" : "text-gray-500"} mt-1 text-sm md:text-base`}>
                        {card.translations.ja || t('noTranslation')}
                      </p>
                    </div>
                  )}
                  <div className="mt-2 text-xs md:text-sm text-gray-500">
                    {new Date(card.timestamp).toLocaleTimeString("ja-JP")}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
