"use client";

import { useState, useEffect } from "react";

type Transcript = {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
};

type AIMessage = {
  id: string;
  text: string;
  timestamp: string;
  type: "suggestion" | "response";
};

export function ViewerSessionPanel({ meetingId }: { meetingId: string }) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [aiMessages, setAIMessages] = useState<AIMessage[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);

  // モックデータ（Stage 7でリアルタイム通信に置き換え）
  useEffect(() => {
    // 初期モックデータ
    setTranscripts([
      {
        id: "1",
        speaker: "山田太郎",
        text: "本日の会議を始めます。皆さん、よろしくお願いします。",
        timestamp: "00:00:05",
      },
      {
        id: "2",
        speaker: "佐藤花子",
        text: "よろしくお願いします。",
        timestamp: "00:00:12",
      },
      {
        id: "3",
        speaker: "山田太郎",
        text: "まず、前回の議事録を確認したいと思います。",
        timestamp: "00:00:18",
      },
    ]);

    setAIMessages([
      {
        id: "1",
        text: "会議が開始されました。議事録の確認から始めるようです。",
        timestamp: "00:00:20",
        type: "suggestion",
      },
    ]);
  }, []);

  // 経過時間のカウント
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-80px)] max-w-7xl gap-4 p-4">
      {/* 左パネル: 文字起こし */}
      <div className="flex w-2/3 flex-col rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                文字起こし（リアルタイム）
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                会議の発言がここに表示されます
              </p>
            </div>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
              読み取り専用
            </span>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {transcripts.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-500">発言を待っています...</p>
            </div>
          ) : (
            transcripts.map((transcript) => (
              <div
                key={transcript.id}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900">
                    {transcript.speaker}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {transcript.timestamp}
                  </span>
                </div>
                <p className="text-sm text-zinc-700">{transcript.text}</p>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-zinc-200 px-6 py-3">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>経過時間:</span>
            <span className="font-semibold text-zinc-900">
              {formatElapsedTime(elapsedTime)}
            </span>
          </div>
        </div>
      </div>

      {/* 右パネル: AIレスポンス */}
      <div className="flex w-1/3 flex-col rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            AI アシスタント
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            AIの提案や応答が表示されます
          </p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {aiMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-500">
                AIが会議を分析しています...
              </p>
            </div>
          ) : (
            aiMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg p-4 ${
                  message.type === "suggestion"
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-purple-50 border border-purple-200"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold ${
                      message.type === "suggestion"
                        ? "text-blue-900"
                        : "text-purple-900"
                    }`}
                  >
                    {message.type === "suggestion" ? "💡 提案" : "🤖 応答"}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {message.timestamp}
                  </span>
                </div>
                <p
                  className={`text-sm ${
                    message.type === "suggestion"
                      ? "text-blue-900"
                      : "text-purple-900"
                  }`}
                >
                  {message.text}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
