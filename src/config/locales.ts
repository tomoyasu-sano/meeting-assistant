// サポートする言語の定義
export const locales = ['en', 'ja'] as const;
export type Locale = (typeof locales)[number];

// デフォルト言語（フォールバック）
export const defaultLocale: Locale = 'ja';

// 言語の表示名
export const localeNames: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
};
