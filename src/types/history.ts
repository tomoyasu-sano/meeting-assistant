/**
 * 過去履歴機能の型定義
 */

export type HistorySession = {
  sessionId: string;
  title: string; // 例: "第5回"
  occurredAt: string; // ISO 8601 format
  summaryStatus: "ready" | "missing";
  summaryText: string | null;
  sessionNumber: number; // 何回目のセッションか
};

export type SessionSummary = {
  id: string;
  summary_text: string;
  key_decisions: any[];
  action_items: any[];
  topics_discussed: string[];
  participant_count: number | null;
  duration_seconds: number | null;
  generated_at: string;
};

export type SessionTranscript = {
  id: string;
  text: string;
  speaker_label: string | null;
  start_time: number | null;
  end_time: number | null;
  created_at: string;
};

export type HistoryResponse = {
  sessions: HistorySession[];
  total: number;
};

export type SummaryResponse = {
  summary: SessionSummary | null;
  session: {
    id: string;
    started_at: string;
    ended_at: string | null;
  };
};

export type TranscriptResponse = {
  transcripts: SessionTranscript[];
  session: {
    id: string;
    started_at: string;
    ended_at: string | null;
  };
};
