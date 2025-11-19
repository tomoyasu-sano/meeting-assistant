"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ViewerSessionPanel } from "@/components/ViewerSessionPanel";
import Link from "next/link";

type Meeting = {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  category: {
    title: string;
  };
};

export default function ViewerJoinPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const passwordParam = searchParams.get("password");

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    fetchMeeting(passwordParam || undefined);
  }, [token, passwordParam]);

  const fetchMeeting = async (pw?: string) => {
    setLoading(true);
    setError(null);
    setPasswordError(false);

    try {
      const url = new URL("/api/meetings/join", window.location.origin);
      url.searchParams.set("token", token);
      if (pw) {
        url.searchParams.set("password", pw);
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        if (data.passwordRequired) {
          setPasswordRequired(true);
          if (data.error === "invalid_password") {
            setPasswordError(true);
          }
        } else {
          setError(data.error || "会議の取得に失敗しました");
        }
        setLoading(false);
        return;
      }

      setMeeting(data.meeting);
      setPasswordRequired(false);
    } catch (err) {
      setError("会議の取得中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      // URLパラメータとしてパスワードを渡す（再レンダリングをトリガー）
      const url = new URL(window.location.href);
      url.searchParams.set("password", password);
      window.history.pushState({}, "", url.toString());
      fetchMeeting(password);
    }
  };

  // ローディング中
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm text-zinc-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // エラー
  if (error && !passwordRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <span className="text-2xl">❌</span>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            会議が見つかりません
          </h1>
          <p className="mt-2 text-sm text-zinc-600">{error}</p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  // パスワード入力画面
  if (passwordRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
              <span className="text-2xl">🔒</span>
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              パスワードが必要です
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              この会議はパスワードで保護されています
            </p>
          </div>

          {passwordError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              パスワードが正しくありません
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700"
              >
                パスワード
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="会議のパスワードを入力"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              会議に参加
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              アカウントをお持ちの方はログイン
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 会議画面
  if (!meeting) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* ヘッダー */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                閲覧モード
              </span>
              <h1 className="text-lg font-semibold text-zinc-900">
                {meeting.title}
              </h1>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              {meeting.category.title}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              ログイン
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
              接続中
            </span>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 bg-zinc-50">
        <ViewerSessionPanel meetingId={meeting.id} />
      </main>
    </div>
  );
}
