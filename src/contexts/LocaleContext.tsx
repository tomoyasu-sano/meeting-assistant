'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Locale, locales, defaultLocale } from '@/config/locales';

type LocaleContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isChanging: boolean;
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [isChanging, setIsChanging] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 初期化: localStorage または ブラウザ言語から言語を取得
  useEffect(() => {
    if (isInitialized) return;

    const savedLocale = localStorage.getItem('locale') as Locale | null;

    if (savedLocale && locales.includes(savedLocale)) {
      // localStorage に保存されている言語を使用
      setLocaleState(savedLocale);
    } else {
      // ブラウザの言語を検出
      const browserLang = navigator.language.split('-')[0] as Locale;
      if (locales.includes(browserLang)) {
        setLocaleState(browserLang);
        localStorage.setItem('locale', browserLang);
      } else {
        // フォールバック: デフォルト言語（英語）
        setLocaleState(defaultLocale);
        localStorage.setItem('locale', defaultLocale);
      }
    }

    setIsInitialized(true);
  }, [isInitialized]);

  // Cookie に言語設定を保存する関数
  const setLocaleCookie = useCallback((newLocale: Locale) => {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  // 言語を変更する関数
  const setLocale = useCallback((newLocale: Locale) => {
    if (!locales.includes(newLocale)) {
      console.error(`Invalid locale: ${newLocale}`);
      return;
    }

    setIsChanging(true);
    setLocaleState(newLocale);

    // localStorage に保存
    localStorage.setItem('locale', newLocale);

    // Cookie に保存（サーバーサイドで読み取れるように）
    setLocaleCookie(newLocale);

    // ページをリロードして新しい言語を反映
    // next-intl のミドルウェアが Cookie を読み取って適切な言語を設定
    setTimeout(() => {
      router.refresh();
      setIsChanging(false);
    }, 100);
  }, [router, setLocaleCookie]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, isChanging }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}
