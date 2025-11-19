"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    // パスワード一致確認
    if (password !== confirmPassword) {
      setErrorMessage("パスワードが一致しません");
      return;
    }

    // パスワード長さ確認
    if (password.length < 6) {
      setErrorMessage("パスワードは6文字以上である必要があります");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/update-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setErrorMessage(data.error || "エラーが発生しました");
          return;
        }

        // 成功したらログインページにリダイレクト
        router.replace("/login?message=password-updated");
      } catch (error) {
        console.error("Update password error:", error);
        setErrorMessage("予期しないエラーが発生しました");
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-zinc-700"
          htmlFor="new-password"
        >
          新しいパスワード
        </label>
        <input
          id="new-password"
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="6文字以上"
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium text-zinc-700"
          htmlFor="confirm-password"
        >
          パスワード確認
        </label>
        <input
          id="confirm-password"
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="もう一度入力"
        />
      </div>

      {errorMessage ? (
        <p className="text-sm text-red-600">{errorMessage}</p>
      ) : null}

      <button
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isPending}
      >
        {isPending ? "更新中..." : "パスワードを更新"}
      </button>
    </form>
  );
}
