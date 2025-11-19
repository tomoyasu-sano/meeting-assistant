"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from 'next-intl';
import { useLanguageExchange } from "@/hooks/useLanguageExchange";
import { LanguageExchangeColumns } from "./LanguageExchangeColumns";
import { CustomSelect } from "./CustomSelect";

type SessionStatus = "idle" | "active" | "ended";

export function LanguageExchangePanel() {
  const t = useTranslations('languageExchange');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [partnerLanguage, setPartnerLanguage] = useState("sv");
  const [autoEndMessage, setAutoEndMessage] = useState<string | null>(null);

  const {
    cards,
    isConnected,
    isRecording,
    lastTranscriptAt,
    connect,
    disconnect,
    setCards,
  } = useLanguageExchange({
    partnerLanguage,
  });

  // セッション開始
  const handleStart = useCallback(async () => {
    console.log("[Language Exchange] Starting session with partner language:", partnerLanguage);
    setSessionStatus("active");
    setAutoEndMessage(null);
    setCards([]); // カードをクリア
    await connect();
  }, [partnerLanguage, connect, setCards]);

  // セッション終了
  const handleEnd = useCallback(() => {
    console.log("[Language Exchange] Ending session");
    setSessionStatus("ended");
    disconnect();
  }, [disconnect]);

  // 自動終了
  const autoEndSession = useCallback(() => {
    console.log("[Language Exchange] Auto-ending session due to idle timeout");
    setSessionStatus("ended");
    setAutoEndMessage(t('autoEnded'));
    disconnect();
  }, [disconnect, t]);

  // Idle タイマー（3分無入力で自動終了）
  useEffect(() => {
    if (sessionStatus !== "active" || !lastTranscriptAt) {
      return;
    }

    console.log("[Language Exchange] Idle timer started");

    const interval = setInterval(() => {
      const now = Date.now();
      const lastTime = lastTranscriptAt.getTime();
      const elapsedMs = now - lastTime;
      const IDLE_TIMEOUT_MS = 180000; // 3分

      console.log("[Language Exchange] Checking idle time:", {
        elapsedSeconds: Math.floor(elapsedMs / 1000),
        thresholdSeconds: IDLE_TIMEOUT_MS / 1000,
      });

      if (elapsedMs >= IDLE_TIMEOUT_MS) {
        console.log("[Language Exchange] Idle timeout reached");
        clearInterval(interval);
        autoEndSession();
      }
    }, 10000); // 10秒ごとにチェック

    return () => {
      console.log("[Language Exchange] Idle timer stopped");
      clearInterval(interval);
    };
  }, [sessionStatus, lastTranscriptAt, autoEndSession]);

  // 言語リスト（翻訳対応）
  const SUPPORTED_LANGUAGES = [
    { code: "sv", name: t('languages.swedish') },
    { code: "fi", name: t('languages.finnish') },
    { code: "it", name: t('languages.italian') },
    { code: "de", name: t('languages.german') },
    { code: "tr", name: t('languages.turkish') },
  ];

  // CustomSelect用のオプション
  const languageOptions = SUPPORTED_LANGUAGES.map((lang) => ({
    value: lang.code,
    label: lang.name,
  }));

  const partnerLanguageName = SUPPORTED_LANGUAGES.find((lang) => lang.code === partnerLanguage)?.name || partnerLanguage;

  return (
    <div className="space-y-6">
      {/* セッションコントロール */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* 言語設定 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('partnerLanguage')}
            </label>
            <CustomSelect
              value={partnerLanguage}
              options={languageOptions}
              onChange={setPartnerLanguage}
              disabled={sessionStatus === "active"}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('myLanguage')}
            </label>
            <CustomSelect
              value="ja"
              options={[{ value: "ja", label: t('japanese') }]}
              onChange={() => {}}
              disabled={true}
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-2">
            {sessionStatus === "idle" && (
              <button
                onClick={handleStart}
                className="flex-1 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                {t('start')}
              </button>
            )}
            {sessionStatus === "active" && (
              <button
                onClick={handleEnd}
                className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                {t('end')}
              </button>
            )}
            {sessionStatus === "ended" && (
              <button
                onClick={() => setSessionStatus("idle")}
                className="flex-1 px-6 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                {t('newSession')}
              </button>
            )}
          </div>
        </div>

        {/* 状態表示 */}
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-gray-300"
              }`}
            ></div>
            <span className="text-sm text-gray-600">
              {isConnected ? t('connected') : t('notConnected')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isRecording ? "bg-red-500 animate-pulse" : "bg-gray-300"
              }`}
            ></div>
            <span className="text-sm text-gray-600">
              {isRecording ? t('recording') : t('stopped')}
            </span>
          </div>
          {autoEndMessage && (
            <div className="flex-1 text-sm text-orange-600 font-medium">
              ⚠️ {autoEndMessage}
            </div>
          )}
        </div>
      </div>

      {/* 3カラム表示 */}
      {(sessionStatus === "active" || sessionStatus === "ended") && (
        <LanguageExchangeColumns
          cards={cards}
          partnerLanguage={partnerLanguage}
          partnerLanguageName={partnerLanguageName}
        />
      )}

      {/* 初期状態の説明 */}
      {sessionStatus === "idle" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">{t('howToUse')}</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>{t('instruction1')}</li>
            <li>{t('instruction2')}</li>
            <li>{t('instruction3')}</li>
            <li>{t('instruction4')}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
