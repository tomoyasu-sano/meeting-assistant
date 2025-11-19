"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { CustomSelect } from "@/components/CustomSelect";
import type {
  MeetingRow,
  MeetingSummary,
  MeetingTranscriptsResponse,
} from "@/types/meeting-index";

type Category = {
  id: string;
  title: string;
  color_code: string | null;
};

export default function MeetingIndexPage() {
  const t = useTranslations();
  const router = useRouter();

  // State
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState({
    categoryId: "all",
    query: "",
    page: 1,
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // モーダル
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRow | null>(
    null
  );
  const [modalType, setModalType] = useState<
    "summary" | "transcript" | null
  >(null);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [transcripts, setTranscripts] =
    useState<MeetingTranscriptsResponse | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // カテゴリ取得
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };

    fetchCategories();
  }, []);

  // 会議一覧取得
  useEffect(() => {
    const fetchMeetings = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: filters.page.toString(),
        });

        if (filters.categoryId !== "all") {
          params.set("categoryId", filters.categoryId);
        }

        if (filters.query) {
          params.set("query", filters.query);
        }

        const response = await fetch(`/api/meeting-index?${params.toString()}`);

        if (response.ok) {
          const data = await response.json();
          setMeetings(data.meetings || []);
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 0);
        } else {
          console.error("Failed to fetch meetings");
        }
      } catch (error) {
        console.error("Failed to fetch meetings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetings();
  }, [filters]);

  // サマリーモーダルを開く
  const openSummaryModal = async (meeting: MeetingRow) => {
    setSelectedMeeting(meeting);
    setModalType("summary");
    setIsModalLoading(true);
    setSummary(null);

    try {
      const response = await fetch(
        `/api/meeting-summary?meetingId=${meeting.id}`
      );

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
      } else {
        console.error("Failed to fetch summary");
        alert("サマリーの取得に失敗しました");
        closeModal();
      }
    } catch (error) {
      console.error("Failed to fetch summary:", error);
      alert("サマリーの取得に失敗しました");
      closeModal();
    } finally {
      setIsModalLoading(false);
    }
  };

  // 文字起こしモーダルを開く
  const openTranscriptModal = async (meeting: MeetingRow) => {
    setSelectedMeeting(meeting);
    setModalType("transcript");
    setIsModalLoading(true);
    setTranscripts(null);

    try {
      const response = await fetch(
        `/api/meeting-transcripts?meetingId=${meeting.id}`
      );

      if (response.ok) {
        const data = await response.json();
        setTranscripts(data);
      } else {
        console.error("Failed to fetch transcripts");
        alert("文字起こしの取得に失敗しました");
        closeModal();
      }
    } catch (error) {
      console.error("Failed to fetch transcripts:", error);
      alert("文字起こしの取得に失敗しました");
      closeModal();
    } finally {
      setIsModalLoading(false);
    }
  };

  // モーダルを閉じる
  const closeModal = () => {
    setModalType(null);
    setSelectedMeeting(null);
    setSummary(null);
    setTranscripts(null);
  };

  // テキストをコピー
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("コピーしました");
  };

  // 検索実行
  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  // カテゴリーオプション
  const categoryOptions = [
    { value: "all", label: t('common.all') },
    ...categories.map((category) => ({
      value: category.id,
      label: category.title,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* ヘッダーセクション */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-200/20 via-fuchsia-200/20 to-pink-200/20 rounded-full blur-3xl -z-10" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-gradient-to-r from-violet-100 to-fuchsia-100 rounded-full border border-violet-200/50">
            <div className="w-2 h-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold gradient-text">Meeting Index</span>
          </div>

          <h1 className="text-3xl font-black text-gray-900 mb-2">{t('navigation.meetingList')}</h1>
          <p className="text-gray-600">
            {t('meeting.meetingListDescription')}
          </p>
        </div>
      </div>

      {/* 検索/フィルタバー・会議一覧 */}
      <div className="mesh-card rounded-3xl p-6 minimal-shadow animate-fade-scale" style={{ animationDelay: '0.1s' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* カテゴリ選択 */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('categories.title')}
            </label>
            <CustomSelect
              value={filters.categoryId}
              options={categoryOptions}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, categoryId: value, page: 1 }))
              }
            />
          </div>

          {/* タイトル検索 */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('meeting.titleSearch')}
            </label>
            <input
              type="search"
              value={filters.query}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, query: e.target.value }))
              }
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={t('meeting.titleSearchPlaceholder')}
              className="w-full px-4 py-3 border border-violet-100 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-300 transition-all"
            />
          </div>

          {/* 検索ボタン */}
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              className="group w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl font-bold hover:scale-105 hover:shadow-lg hover:shadow-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                {t('common.search')}
                <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        {/* ローディング */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-600 mt-2 font-medium">読み込み中...</p>
          </div>
        )}

        {/* 会議カード一覧 */}
        {!isLoading && meetings.length === 0 && (
          <div className="text-center py-12 bg-gradient-to-r from-violet-50 to-fuchsia-50 rounded-2xl border border-violet-100">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-gradient-to-br from-violet-100 to-fuchsia-100 rounded-full">
              <svg className="h-8 w-8 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">会議が見つかりませんでした</p>
          </div>
        )}

        {!isLoading && meetings.length > 0 && (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="group bg-white rounded-2xl p-6 border border-violet-100 minimal-shadow-hover overflow-hidden relative"
              >
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-fuchsia-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* 左側：会議情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-violet-600 transition-colors break-words">
                        {meeting.title}
                      </h3>
                      {meeting.category && (
                        <span
                          className="px-3 py-1 text-xs font-bold rounded-full border border-violet-200/50 flex-shrink-0"
                          style={{
                            backgroundColor: meeting.category.color_code || "#e5e7eb",
                            color: "#374151",
                          }}
                        >
                          {meeting.category.title}
                        </span>
                      )}
                      {/* <span
                        className={`px-3 py-1 text-xs font-bold rounded-full flex-shrink-0 ${
                          meeting.status === "completed"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200/50"
                            : meeting.status === "in_progress"
                            ? "bg-blue-100 text-blue-800 border border-blue-200/50"
                            : "bg-gray-100 text-gray-800 border border-gray-200/50"
                        }`}
                      >
                        {meeting.status === "completed"
                          ? "完了"
                          : meeting.status === "in_progress"
                          ? "進行中"
                          : meeting.status === "scheduled"
                          ? "予定"
                          : "キャンセル"}
                      </span> */}
                    </div>

                    <div className="text-sm text-gray-600 space-y-1 font-medium">
                      <p className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        開催日: {new Date(meeting.scheduled_at).toLocaleString("ja-JP")}
                      </p>
                      <p className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-fuchsia-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        セッション数: {meeting.sessionCount} | 参加者数: {meeting.participantCount}
                      </p>
                    </div>
                  </div>

                  {/* 右側：アクションボタン */}
                  <div className="flex flex-wrap gap-2 md:flex-shrink-0">
                    <button
                      onClick={() => openSummaryModal(meeting)}
                      disabled={!meeting.hasSummary}
                      className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                        meeting.hasSummary
                          ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:scale-105 hover:shadow-lg hover:shadow-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      }`}
                      title={
                        !meeting.hasSummary ? t('meeting.summaryNotCreated') : t('meeting.showSummary')
                      }
                    >
                      {t('meeting.showSummary')}
                    </button>

                    <button
                      onClick={() => openTranscriptModal(meeting)}
                      disabled={meeting.sessionCount === 0}
                      className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                        meeting.sessionCount > 0
                          ? "bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:scale-105 hover:shadow-lg hover:shadow-gray-500/50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      }`}
                      title={
                        meeting.sessionCount === 0
                          ? t('meeting.noTranscript')
                          : t('meeting.showTranscript')
                      }
                    >
                      {t('meeting.showTranscript')}
                    </button>
                  </div>
                </div>

                {/* Bottom gradient accent */}
                <div className="mt-4 h-1 w-0 group-hover:w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500" />
              </div>
            ))}
          </div>
        )}

        {/* ページング */}
        {!isLoading && totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-3">
            <button
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={filters.page === 1}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                filters.page === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:scale-105 hover:shadow-lg hover:shadow-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500"
              }`}
            >
              前へ
            </button>

            <div className="px-4 py-2.5 bg-gradient-to-r from-violet-100 to-fuchsia-100 rounded-xl border border-violet-200/50">
              <span className="text-sm font-bold gradient-text">
                {filters.page} / {totalPages}
              </span>
            </div>

            <button
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={filters.page === totalPages}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                filters.page === totalPages
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:scale-105 hover:shadow-lg hover:shadow-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500"
              }`}
            >
              次へ
            </button>
          </div>
        )}
      </div>

      {/* サマリーモーダル */}
      {modalType === "summary" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="mesh-card rounded-3xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden animate-fade-scale">
              {/* ヘッダー */}
              <div className="px-6 py-5 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-pulse" />
                  <h2 className="text-lg font-black text-gray-900">
                    サマリー: {selectedMeeting?.title}
                  </h2>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-xl text-violet-600 hover:bg-violet-100 transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* コンテンツ */}
              <div className="px-6 py-6 overflow-y-auto max-h-[calc(80vh-140px)]">
                {isModalLoading && (
                  <div className="text-center py-12">
                    <div className="inline-block w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-600 font-medium mt-3">読み込み中...</p>
                  </div>
                )}

                {!isModalLoading && summary && (
                  <div className="space-y-5">
                    <div className="px-4 py-2 bg-gradient-to-r from-violet-50 to-fuchsia-50 rounded-xl border border-violet-100">
                      <p className="text-xs font-bold text-violet-700">
                        生成日時: {new Date(summary.generated_at).toLocaleString("ja-JP")}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-violet-50/50 to-fuchsia-50/50 p-5 rounded-xl border border-violet-100">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                        {summary.summary_text}
                      </pre>
                    </div>

                    {summary.key_decisions && summary.key_decisions.length > 0 && (
                      <div className="bg-white p-5 rounded-xl border border-violet-100">
                        <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-violet-500 rounded-full"></div>
                          主要な決定事項
                        </h3>
                        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
                          {summary.key_decisions.map((item: any, index: number) => (
                            <li key={index} className="leading-relaxed">{JSON.stringify(item)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {summary.action_items && summary.action_items.length > 0 && (
                      <div className="bg-white p-5 rounded-xl border border-fuchsia-100">
                        <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full"></div>
                          アクションアイテム
                        </h3>
                        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
                          {summary.action_items.map((item: any, index: number) => (
                            <li key={index} className="leading-relaxed">{JSON.stringify(item)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* フッター */}
              <div className="px-6 py-4 border-t border-violet-100 bg-gradient-to-r from-violet-50/30 to-fuchsia-50/30 flex justify-end gap-3">
                <button
                  onClick={() => summary && copyToClipboard(summary.summary_text)}
                  disabled={!summary}
                  className="px-5 py-2.5 text-sm font-bold text-violet-600 hover:bg-violet-100 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  コピー
                </button>
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl hover:scale-105 hover:shadow-lg hover:shadow-violet-500/50 transition-all"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
      )}

      {/* 文字起こしモーダル */}
      {modalType === "transcript" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="mesh-card rounded-3xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-hidden animate-fade-scale">
              {/* ヘッダー */}
              <div className="px-6 py-5 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-pulse" />
                  <h2 className="text-lg font-black text-gray-900">
                    文字起こし: {selectedMeeting?.title}
                  </h2>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-xl text-violet-600 hover:bg-violet-100 transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* コンテンツ */}
              <div className="px-6 py-6 overflow-y-auto max-h-[calc(80vh-140px)]">
                {isModalLoading && (
                  <div className="text-center py-12">
                    <div className="inline-block w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-600 font-medium mt-3">読み込み中...</p>
                  </div>
                )}

                {!isModalLoading && transcripts && (
                  <div className="space-y-5">
                    {transcripts.sessions.map((session, index) => (
                      <div key={session.id} className="bg-white border border-violet-100 rounded-2xl p-5 minimal-shadow-hover">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="px-3 py-1 bg-gradient-to-r from-violet-100 to-fuchsia-100 rounded-full border border-violet-200/50">
                            <span className="text-xs font-bold gradient-text">セッション #{index + 1}</span>
                          </div>
                        </div>
                        <p className="text-xs font-bold text-violet-700 mb-4">
                          開始: {new Date(session.started_at).toLocaleString("ja-JP")}
                          {session.ended_at &&
                            ` | 終了: ${new Date(session.ended_at).toLocaleString("ja-JP")}`}
                        </p>

                        <div className="bg-gradient-to-br from-violet-50/30 to-fuchsia-50/30 p-4 rounded-xl border border-violet-100 max-h-96 overflow-y-auto">
                          {session.transcripts.length === 0 && (
                            <p className="text-sm text-gray-500 font-medium text-center py-4">
                              このセッションには文字起こしがありません
                            </p>
                          )}

                          {session.transcripts.map((transcript) => (
                            <div
                              key={transcript.id}
                              className="mb-3 pb-3 border-b border-violet-100 last:border-0"
                            >
                              <p className="text-xs font-bold text-violet-600 mb-1.5">
                                {transcript.speaker_label || "不明"} |{" "}
                                {transcript.start_time !== null
                                  ? `${transcript.start_time.toFixed(1)}s`
                                  : "N/A"}
                              </p>
                              <p className="text-sm text-gray-800 leading-relaxed">
                                {transcript.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* フッター */}
              <div className="px-6 py-4 border-t border-violet-100 bg-gradient-to-r from-violet-50/30 to-fuchsia-50/30 flex justify-end">
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl hover:scale-105 hover:shadow-lg hover:shadow-violet-500/50 transition-all"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}
