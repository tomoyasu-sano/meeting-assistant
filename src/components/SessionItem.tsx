"use client";

import { useState } from "react";

type Transcript = {
  id: string;
  text: string;
  created_at: string;
  start_time: number | null;
  participant: {
    display_name: string;
  } | null;
  speaker_label: string | null;
};

type Session = {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  created_at: string;
  transcripts: Transcript[];
};

type SessionItemProps = {
  session: Session;
  isLatest: boolean;
};

export function SessionItem({ session, isLatest }: SessionItemProps) {
  const [isExpanded, setIsExpanded] = useState(isLatest);

  const startedAt = new Date(session.started_at);
  const endedAt = session.ended_at ? new Date(session.ended_at) : null;
  const duration = endedAt
    ? Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000 / 60)
    : null;

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    paused: "bg-yellow-100 text-yellow-800",
    ended: "bg-zinc-100 text-zinc-800",
  };

  const statusLabels: Record<string, string> = {
    active: "実行中",
    paused: "一時停止",
    ended: "終了",
  };

  const formatTimestamp = (startTime: number | null) => {
    if (startTime === null) return "";
    const minutes = Math.floor(startTime / 60);
    const seconds = Math.floor(startTime % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // 文字起こしを時系列順にソート
  const sortedTranscripts = [...(session.transcripts || [])].sort((a, b) => {
    return (
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      {/* セッションヘッダー */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-zinc-50"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColors[session.status] || "bg-gray-100 text-gray-800"}`}
            >
              {statusLabels[session.status] || session.status}
            </span>
            {duration !== null && (
              <span className="text-xs text-zinc-500">{duration}分</span>
            )}
            <span className="text-xs text-zinc-500">
              発言数: {sortedTranscripts.length}件
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-700">
            開始: {startedAt.toLocaleString("ja-JP")}
          </p>
          {endedAt && (
            <p className="text-sm text-zinc-700">
              終了: {endedAt.toLocaleString("ja-JP")}
            </p>
          )}
        </div>

        {/* 展開アイコン */}
        <svg
          className={`h-5 w-5 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* 文字起こし一覧（展開時） */}
      {isExpanded && (
        <div className="border-t border-zinc-200 bg-zinc-50 p-4">
          {sortedTranscripts.length > 0 ? (
            <div className="space-y-3">
              {sortedTranscripts.map((transcript) => (
                <div
                  key={transcript.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900">
                        {transcript.participant?.display_name ||
                          transcript.speaker_label ||
                          "不明な話者"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        {transcript.text}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {formatTimestamp(transcript.start_time)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-zinc-500">
              このセッションには文字起こしがありません
            </p>
          )}
        </div>
      )}
    </div>
  );
}
