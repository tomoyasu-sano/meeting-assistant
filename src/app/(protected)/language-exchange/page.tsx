"use client";

import { useTranslations } from 'next-intl';
import { LanguageExchangePanel } from "@/components/LanguageExchangePanel";

export default function LanguageExchangePage() {
  const t = useTranslations('languageExchange');

  return (
    <div className="space-y-6">
      {/* ヘッダーセクション */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-200/20 via-teal-200/20 to-cyan-200/20 rounded-full blur-3xl -z-10" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-full border border-emerald-200/50">
            <div className="w-2 h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold gradient-text">Language Exchange</span>
          </div>

          <h1 className="text-3xl font-black text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-gray-600">
            {t('description')}
          </p>
        </div>
      </div>

      {/* メインコンテンツ */}
      <LanguageExchangePanel />
    </div>
  );
}
