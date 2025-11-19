"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

export function ResetPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
          setErrorMessage(data.error || "エラーが発生しました");
          return;
        }

        setSuccessMessage(
          "パスワードリセット用のメールを送信しました。メールをご確認ください。"
        );
        setEmail("");
      } catch (error) {
        console.error("Reset password error:", error);
        setErrorMessage("予期しないエラーが発生しました");
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-zinc-700"
          htmlFor="reset-email"
        >
          登録メールアドレス
        </label>
        <input
          id="reset-email"
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your@email.com"
        />
      </div>

      {errorMessage ? (
        <p className="text-sm text-red-600">{errorMessage}</p>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg bg-green-50 p-3">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      ) : null}

      <button
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isPending}
      >
        {isPending ? "送信中..." : "リセットメールを送信"}
      </button>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          ログイン画面に戻る
        </Link>
      </div>
    </form>
  );
}
