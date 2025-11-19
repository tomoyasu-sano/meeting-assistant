'use client';

import { useLocale } from '@/contexts/LocaleContext';
import { locales, localeNames, type Locale } from '@/config/locales';

export function LanguageSwitcher() {
  const { locale, setLocale, isChanging } = useLocale();

  return (
    <div className="flex items-center gap-2">
      {locales.map((lang) => (
        <button
          key={lang}
          onClick={() => setLocale(lang)}
          disabled={isChanging}
          className={`
            px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
            ${
              locale === lang
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }
            ${isChanging ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          aria-label={`Switch to ${localeNames[lang]}`}
        >
          {localeNames[lang]}
        </button>
      ))}
    </div>
  );
}
