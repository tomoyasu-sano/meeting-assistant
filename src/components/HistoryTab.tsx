"use client";

import { useState, useEffect } from "react";
import type {
  HistorySession,
  SessionSummary,
  SessionTranscript,
} from "@/types/history";
import ReactMarkdown from "react-markdown";

type HistoryTabProps = {
  meetingId: string;
};

export function HistoryTab({ meetingId }: HistoryTabProps) {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [visibleSummaries, setVisibleSummaries] = useState<
    Record<
      string,
      {
        loading: boolean;
        data: SessionSummary | null;
        error: string | null;
      }
    >
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [modalData, setModalData] = useState<{
    type: "summary" | "transcript";
    sessionId: string;
    title: string;
    data: SessionSummary | SessionTranscript[] | null;
    loading: boolean;
  } | null>(null);

  // セッション一覧を取得
  useEffect(() => {
    fetchSessions("all");
  }, [meetingId]);

  const fetchSessions = async (range: "1" | "3" | "all") => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/history?range=${range}`
      );
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else {
        console.error("Failed to fetch sessions");
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // セッション選択のトグル
  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessionIds((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  // ショートカットボタン
  const selectRecent = (count: 1 | 3) => {
    const recentIds = sessions.slice(0, count).map((s) => s.sessionId);
    setSelectedSessionIds(recentIds);
  };

  // サマリーを表示
  const showSummaries = async () => {
    const newVisibleSummaries: typeof visibleSummaries = {};

    for (const sessionId of selectedSessionIds) {
      newVisibleSummaries[sessionId] = {
        loading: true,
        data: null,
        error: null,
      };
    }

    setVisibleSummaries(newVisibleSummaries);

    // 各セッションのサマリーを取得
    for (const sessionId of selectedSessionIds) {
      try {
        const response = await fetch(
          `/api/meetings/${meetingId}/history/${sessionId}/summary`
        );
        if (response.ok) {
          const data = await response.json();
          setVisibleSummaries((prev) => ({
            ...prev,
            [sessionId]: {
              loading: false,
              data: data.summary,
              error: null,
            },
          }));
        } else {
          setVisibleSummaries((prev) => ({
            ...prev,
            [sessionId]: {
              loading: false,
              data: null,
              error: "サマリーの取得に失敗しました",
            },
          }));
        }
      } catch (error) {
        setVisibleSummaries((prev) => ({
          ...prev,
          [sessionId]: {
            loading: false,
            data: null,
            error: "エラーが発生しました",
          },
        }));
      }
    }
  };

  // 全文を見るモーダルを開く
  const openTranscriptModal = async (
    sessionId: string,
    sessionTitle: string
  ) => {
    setModalData({
      type: "transcript",
      sessionId,
      title: sessionTitle,
      data: null,
      loading: true,
    });

    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/history/${sessionId}/transcript`
      );
      if (response.ok) {
        const data = await response.json();
        setModalData((prev) =>
          prev
            ? {
                ...prev,
                data: data.transcripts,
                loading: false,
              }
            : null
        );
      } else {
        setModalData((prev) =>
          prev
            ? {
                ...prev,
                data: null,
                loading: false,
              }
            : null
        );
      }
    } catch (error) {
      console.error("Failed to fetch transcript:", error);
      setModalData((prev) =>
        prev
          ? {
              ...prev,
              data: null,
              loading: false,
            }
          : null
      );
    }
  };

  const closeModal = () => {
    setModalData(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="border-b border-zinc-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">過去履歴</h2>
        <p className="mt-1 text-sm text-zinc-600">
          過去に開催したセッションのサマリーと文字起こしを確認できます
        </p>
      </div>

      {/* 範囲選択エリア */}
      <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => selectRecent(1)}
            className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
          >
            直近1回
          </button>
          <button
            onClick={() => selectRecent(3)}
            className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
          >
            直近3回
          </button>
          <button
            onClick={showSummaries}
            disabled={selectedSessionIds.length === 0}
            className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed"
          >
            サマリーを表示
          </button>
        </div>

        {/* セッション選択リスト */}
        {isLoading ? (
          <div className="text-sm text-zinc-600">読み込み中...</div>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-zinc-600">
            過去履歴はまだありません
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <label
                key={session.sessionId}
                className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50"
              >
                <input
                  type="checkbox"
                  checked={selectedSessionIds.includes(session.sessionId)}
                  onChange={() => toggleSessionSelection(session.sessionId)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-900">
                    {session.title}
                  </div>
                  <div className="text-xs text-zinc-600">
                    {new Date(session.occurredAt).toLocaleString("ja-JP")}
                  </div>
                </div>
                <div className="text-xs">
                  {session.summaryStatus === "ready" ? (
                    <span className="text-green-600">サマリー有</span>
                  ) : (
                    <span className="text-zinc-400">未生成</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* サマリーカード表示エリア */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {Object.keys(visibleSummaries).length === 0 ? (
          <div className="text-center text-zinc-600 text-sm mt-8">
            セッションを選択して「サマリーを表示」ボタンを押してください
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(visibleSummaries).map(
              ([sessionId, summaryData]) => {
                const session = sessions.find((s) => s.sessionId === sessionId);
                if (!session) return null;

                return (
                  <div
                    key={sessionId}
                    className="bg-white border border-zinc-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-zinc-900">
                          {session.title}
                        </h3>
                        <p className="text-xs text-zinc-600">
                          {new Date(session.occurredAt).toLocaleString(
                            "ja-JP"
                          )}
                        </p>
                      </div>
                    </div>

                    {summaryData.loading ? (
                      <div className="text-sm text-zinc-600">
                        読み込み中...
                      </div>
                    ) : summaryData.error ? (
                      <div className="text-sm text-red-600">
                        {summaryData.error}
                      </div>
                    ) : summaryData.data ? (
                      <div>
                        <div className="prose prose-sm max-w-none text-zinc-700 mb-3">
                          <ReactMarkdown>
                            {summaryData.data.summary_text}
                          </ReactMarkdown>
                        </div>

                        {/* 決定事項 */}
                        {summaryData.data.key_decisions &&
                          summaryData.data.key_decisions.length > 0 && (
                            <div className="mb-2">
                              <h4 className="text-xs font-semibold text-zinc-700 mb-1">
                                決定事項
                              </h4>
                              <ul className="text-xs text-zinc-600 list-disc list-inside">
                                {summaryData.data.key_decisions.map(
                                  (decision: any, idx: number) => (
                                    <li key={idx}>
                                      {typeof decision === "string"
                                        ? decision
                                        : decision.description || ""}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}

                        {/* アクションアイテム */}
                        {summaryData.data.action_items &&
                          summaryData.data.action_items.length > 0 && (
                            <div className="mb-3">
                              <h4 className="text-xs font-semibold text-zinc-700 mb-1">
                                宿題
                              </h4>
                              <ul className="text-xs text-zinc-600 list-disc list-inside">
                                {summaryData.data.action_items.map(
                                  (item: any, idx: number) => (
                                    <li key={idx}>
                                      {typeof item === "string"
                                        ? item
                                        : item.description || ""}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}

                        <button
                          onClick={() =>
                            openTranscriptModal(sessionId, session.title)
                          }
                          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          全文を見る →
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-600">
                        サマリーが見つかりませんでした
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* モーダル */}
      {modalData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">
                {modalData.title} - 全文文字起こし
              </h3>
              <button
                onClick={closeModal}
                className="text-zinc-600 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {modalData.loading ? (
                <div className="text-center text-zinc-600">読み込み中...</div>
              ) : modalData.data && Array.isArray(modalData.data) ? (
                <div className="space-y-3">
                  {modalData.data.map((transcript: SessionTranscript) => (
                    <div key={transcript.id} className="border-b pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-indigo-600">
                          {transcript.speaker_label || "不明"}
                        </span>
                        {transcript.start_time !== null && (
                          <span className="text-xs text-zinc-500">
                            {Math.floor(transcript.start_time / 60)}:
                            {String(
                              Math.floor(transcript.start_time % 60)
                            ).padStart(2, "0")}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-800">{transcript.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-zinc-600">
                  文字起こしが見つかりませんでした
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
