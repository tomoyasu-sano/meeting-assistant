"use client";

import React, { useState } from "react";

export default function GeminiTestPage() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      return;
    }

    setIsLoading(true);
    setResponse("");
    setMetadata(null);

    const startTime = Date.now();
    console.log("[Gemini Test] リクエスト送信開始", {
      message: message.substring(0, 50),
      timestamp: new Date().toISOString(),
    });

    try {
      const res = await fetch("/api/gemini/simple", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const fetchTime = Date.now() - startTime;
      console.log("[Gemini Test] API応答受信", {
        fetchTime: `${fetchTime}ms`,
        status: res.status,
      });

      if (!res.ok) {
        const error = await res.json();
        console.error("[Gemini Test] エラー応答", error);
        setResponse(`Error: ${error.error || "Unknown error"}`);
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      const totalTime = Date.now() - startTime;

      console.log("[Gemini Test] ✅ 成功", {
        totalTime: `${totalTime}ms`,
        apiLatency: data.metadata?.apiLatency ? `${data.metadata.apiLatency}ms` : "N/A",
        textLength: data.text?.length || 0,
        model: data.metadata?.model,
      });

      setResponse(data.text || "");
      setMetadata({
        ...(data.metadata || {}),
        elapsedTime: totalTime,
      });
      setIsLoading(false);
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error("[Gemini Test] ❌ リクエスト失敗", {
        error: error instanceof Error ? error.message : "Unknown error",
        elapsedTime: `${errorTime}ms`,
      });
      setResponse(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessage("");
    setResponse("");
    setMetadata(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Gemini API テスト</h1>
          <p className="mt-2 text-gray-600">
            サービスアカウントのアクセストークンで Gemini API を直接呼び出し、応答を確認します。
          </p>
        </div>

        <div className="grid gap-6">
          {/* 入力エリア */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  メッセージを入力
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="例：現在、gemini APIで軽くて反応が早いモデル順〜標準モデルを3つ教えて。"
                  className="w-full min-h-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isLoading || !message.trim()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? "送信中..." : "送信"}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isLoading}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                >
                  クリア
                </button>
              </div>
            </form>
          </div>

          {/* レスポンスエリア */}
          {(response || isLoading) && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  レスポンス
                </h2>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
                {response || (
                  <div className="flex items-center text-gray-500">
                    <span className="mr-2">⏳</span>
                    応答を待っています...
                  </div>
                )}
              </div>

              {/* メタデータ */}
              {metadata && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    パフォーマンス情報
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {metadata.totalLength && (
                      <div>
                        <span className="text-gray-600">文字数：</span>
                        <span className="font-mono font-semibold">
                          {metadata.totalLength}
                        </span>
                      </div>
                    )}
                    {metadata.totalChunks && (
                      <div>
                        <span className="text-gray-600">チャンク数：</span>
                        <span className="font-mono font-semibold">
                          {metadata.totalChunks}
                        </span>
                      </div>
                    )}
                    {metadata.elapsedTime && (
                      <div>
                        <span className="text-gray-600">経過時間：</span>
                        <span className="font-mono font-semibold">
                          {metadata.elapsedTime}ms
                        </span>
                      </div>
                    )}
                    {metadata.totalTime && (
                      <div>
                        <span className="text-gray-600">総時間：</span>
                        <span className="font-mono font-semibold">
                          {metadata.totalTime}ms
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 説明 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              このテストについて
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• API Key認証でGemini APIに直接接続します</li>
              <li>• モデル: gemini-1.5-flash（高速・安定版）</li>
              <li>• ストリーミング応答でリアルタイム表示します</li>
              <li>• レスポンス時間を計測してパフォーマンスを確認できます</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
