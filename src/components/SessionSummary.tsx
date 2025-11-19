'use client';

import { useState, useEffect } from 'react';

type KeyDecision = {
  decision: string;
  context?: string;
};

type ActionItem = {
  item: string;
  assignee?: string;
  deadline?: string;
};

type Summary = {
  id: string;
  summary_text: string;
  key_decisions: KeyDecision[];
  action_items: ActionItem[];
  topics_discussed: string[];
  participant_count: number;
  duration_seconds: number;
  generated_at: string;
};

type SessionSummaryProps = {
  meetingId: string;
  sessionId: string;
  autoLoad?: boolean;
  onRegenerate?: () => void;
  summaryStatus?: string;
};

export default function SessionSummary({
  meetingId,
  sessionId,
  autoLoad = true,
  onRegenerate,
  summaryStatus,
}: SessionSummaryProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (autoLoad) {
      loadSummary();
    }
  }, [meetingId, sessionId, autoLoad]);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/summary?sessionId=${sessionId}`
      );

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
      } else if (response.status === 404) {
        setError('要約がまだ生成されていません');
      } else {
        setError('要約の取得に失敗しました');
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
      setError('要約の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          mode: 'human_ai_combined',
          provider: 'gemini',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        if (onRegenerate) {
          onRegenerate();
        }
      } else if (response.status === 409) {
        // 既に存在する場合は読み込み直し
        await loadSummary();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '要約の生成に失敗しました');
      }
    } catch (err) {
      console.error('Failed to regenerate summary:', err);
      setError('要約の生成中にエラーが発生しました');
    } finally {
      setIsRegenerating(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}時間${minutes}分`;
    } else if (minutes > 0) {
      return `${minutes}分${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  };

  if (loading || isRegenerating) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">
            {isRegenerating ? '要約を生成中...' : '要約を読み込み中...'}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg
            className="h-6 w-6 text-yellow-600 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800">{error}</h3>
            <div className="mt-2 flex gap-2">
              <button
                onClick={loadSummary}
                className="text-sm text-yellow-700 hover:text-yellow-800 underline"
              >
                再読み込み
              </button>
              <button
                onClick={handleRegenerate}
                className="text-sm text-yellow-700 hover:text-yellow-800 underline"
              >
                要約を生成
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      {/* ヘッダー */}
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-bold text-gray-900">会議要約</h2>
        <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
          <span>参加者: {summary.participant_count}名</span>
          <span>•</span>
          <span>時間: {formatDuration(summary.duration_seconds)}</span>
          <span>•</span>
          <span>
            生成日時: {new Date(summary.generated_at).toLocaleString('ja-JP')}
          </span>
        </div>
      </div>

      {/* 要約テキスト */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">概要</h3>
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {summary.summary_text}
        </p>
      </div>

      {/* 議論されたトピック */}
      {summary.topics_discussed && summary.topics_discussed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            議論されたトピック
          </h3>
          <div className="flex flex-wrap gap-2">
            {summary.topics_discussed.map((topic, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 重要な決定事項 */}
      {summary.key_decisions && summary.key_decisions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            重要な決定事項
          </h3>
          <ul className="space-y-3">
            {summary.key_decisions.map((decision, index) => (
              <li key={index} className="flex items-start">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-sm font-medium mr-3">
                  {index + 1}
                </span>
                <div>
                  <p className="text-gray-900 font-medium">{decision.decision}</p>
                  {decision.context && (
                    <p className="text-gray-600 text-sm mt-1">
                      {decision.context}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* アクションアイテム */}
      {summary.action_items && summary.action_items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            アクションアイテム
          </h3>
          <ul className="space-y-3">
            {summary.action_items.map((action, index) => (
              <li
                key={index}
                className="flex items-start p-3 bg-orange-50 border border-orange-200 rounded-md"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <div className="ml-3 flex-1">
                  <p className="text-gray-900 font-medium">{action.item}</p>
                  <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                    {action.assignee && (
                      <span>担当: {action.assignee}</span>
                    )}
                    {action.deadline && (
                      <span>期限: {action.deadline}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
