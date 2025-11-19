import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { LocaleProvider } from '@/contexts/LocaleContext';
import "./globals.css";

export const metadata: Metadata = {
  title: "Meeting Assistant",
  description: "Miton MVP",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-zinc-100 text-zinc-900">
        <NextIntlClientProvider messages={messages}>
          <LocaleProvider>
            {children}
          </LocaleProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
