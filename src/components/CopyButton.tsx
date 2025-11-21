"use client";

import { useState } from "react";
import { useTranslations } from 'next-intl';

type CopyButtonProps = {
  text: string;
  label?: string;
  successMessage?: string;
};

export function CopyButton({
  text,
  label,
  successMessage,
}: CopyButtonProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const defaultLabel = label || t('common.copy');
  const defaultSuccessMessage = successMessage || t('common.copied');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error(t('common.copyFailed'), error);
      alert(t('common.copyFailed'));
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      disabled={copied}
    >
      {copied ? "✓ " + defaultSuccessMessage : defaultLabel}
    </button>
  );
}
