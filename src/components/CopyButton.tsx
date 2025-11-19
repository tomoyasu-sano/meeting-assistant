"use client";

import { useState } from "react";

type CopyButtonProps = {
  text: string;
  label?: string;
  successMessage?: string;
};

export function CopyButton({
  text,
  label = "コピー",
  successMessage = "コピーしました",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("コピーに失敗しました:", error);
      alert("コピーに失敗しました");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      disabled={copied}
    >
      {copied ? "✓ " + successMessage : label}
    </button>
  );
}
