"use client";

import { useState, useEffect } from "react";
import { useTranslations } from 'next-intl';
import type { MeetingEvaluation } from "@/types/evaluation";
import ReactMarkdown from "react-markdown";

type EvaluationTabProps = {
  meetingId: string;
};

export function EvaluationTab({ meetingId }: EvaluationTabProps) {
  const t = useTranslations();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [evaluation, setEvaluation] = useState<MeetingEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // セッション一覧を取得
  useEffect(() => {
    fetchSessions();
  }, [meetingId]);

  const fetchSessions = async () => {
    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/history?range=all`
      );
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else {
        console.error("Failed to fetch sessions");
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  };

  // 評価を取得
  const fetchEvaluation = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    setEvaluation(null);

    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/history/${sessionId}/evaluation`
      );

      if (response.ok) {
        const data = await response.json();
        setEvaluation(data.evaluation);
      } else {
        setError("評価が見つかりませんでした");
      }
    } catch (error) {
      console.error("Failed to fetch evaluation:", error);
      setError("評価の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    if (sessionId) {
      fetchEvaluation(sessionId);
    } else {
      setEvaluation(null);
      setError(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="border-b border-zinc-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">{t('evaluation.title')}</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {t('evaluation.description')}
        </p>
      </div>

      {/* セッション選択 */}
      <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-4">
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          {t('evaluation.selectSession')}
        </label>
        <select
          value={selectedSessionId}
          onChange={(e) => handleSessionChange(e.target.value)}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">{t('evaluation.pleaseSelectSession')}</option>
          {sessions.map((session) => (
            <option key={session.sessionId} value={session.sessionId}>
              {session.title} ({new Date(session.occurredAt).toLocaleString("ja-JP")})
            </option>
          ))}
        </select>
      </div>

      {/* 評価表示エリア */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!selectedSessionId ? (
          <div className="text-center text-zinc-600 text-sm mt-8">
            {t('evaluation.selectSessionPrompt')}
          </div>
        ) : isLoading ? (
          <div className="text-center text-zinc-600 text-sm mt-8">
            {t('common.loading')}
          </div>
        ) : error ? (
          <div className="text-center text-red-600 text-sm mt-8">{error}</div>
        ) : evaluation ? (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* 全体評価 */}
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h3 className="text-base font-semibold text-zinc-900 mb-3">
                {t('evaluation.overallEvaluation')}
              </h3>
              <div className="prose prose-sm max-w-none text-zinc-700">
                <ReactMarkdown>{evaluation.overall_feedback}</ReactMarkdown>
              </div>
            </div>

            {/* ポジティブな面 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-base font-semibold text-green-900 mb-3">
                {t('evaluation.positiveAspects')}
              </h3>
              <div className="prose prose-sm max-w-none text-green-800">
                <ReactMarkdown
                  components={{
                    ul: ({ children }) => <div className="space-y-2">{children}</div>,
                    li: ({ children }) => <div className="text-sm">{children}</div>,
                  }}
                >
                  {evaluation.positive_aspects}
                </ReactMarkdown>
              </div>
            </div>

            {/* 次回に向けた提案 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-base font-semibold text-blue-900 mb-3">
                {t('evaluation.nextSteps')}
              </h3>
              <div className="prose prose-sm max-w-none text-blue-800">
                <ReactMarkdown
                  components={{
                    ul: ({ children }) => <div className="space-y-2">{children}</div>,
                    li: ({ children }) => <div className="text-sm">{children}</div>,
                  }}
                >
                  {evaluation.improvement_suggestions}
                </ReactMarkdown>
              </div>
            </div>

            {/* ホスト向けフィードバック */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-base font-semibold text-purple-900 mb-3">
                {t('evaluation.adviceForHost')}
              </h3>
              <div className="prose prose-sm max-w-none text-purple-800">
                <ReactMarkdown>{evaluation.host_feedback}</ReactMarkdown>
              </div>
            </div>

            {/* チーム全体向けフィードバック */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="text-base font-semibold text-amber-900 mb-3">
                {t('evaluation.messageForTeam')}
              </h3>
              <div className="prose prose-sm max-w-none text-amber-800">
                <ReactMarkdown>{evaluation.team_feedback}</ReactMarkdown>
              </div>
            </div>

            {/* 評価軸別コメント */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 雰囲気 */}
              {evaluation.atmosphere_comment && (
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-zinc-900 mb-2">
                    {t('evaluation.overallAtmosphere')}
                  </h4>
                  <p className="text-sm text-zinc-700">
                    {evaluation.atmosphere_comment}
                  </p>
                </div>
              )}

              {/* 議論の深まり */}
              {evaluation.discussion_depth_comment && (
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-zinc-900 mb-2">
                    {t('evaluation.discussionDepth')}
                  </h4>
                  <p className="text-sm text-zinc-700">
                    {evaluation.discussion_depth_comment}
                  </p>
                </div>
              )}

              {/* 時間配分 */}
              {evaluation.time_management_comment && (
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-zinc-900 mb-2">
                    {t('evaluation.timeManagement')}
                  </h4>
                  <p className="text-sm text-zinc-700">
                    {evaluation.time_management_comment}
                  </p>
                </div>
              )}

              {/* エンゲージメント */}
              {evaluation.engagement_comment && (
                <div className="bg-white border border-zinc-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-zinc-900 mb-2">
                    {t('evaluation.participantEngagement')}
                  </h4>
                  <p className="text-sm text-zinc-700">
                    {evaluation.engagement_comment}
                  </p>
                </div>
              )}
            </div>

            {/* 生成日時 */}
            <div className="text-center text-xs text-zinc-500 mt-6">
              {t('evaluation.evaluationGenerated')}{new Date(evaluation.generated_at).toLocaleString("ja-JP")}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
