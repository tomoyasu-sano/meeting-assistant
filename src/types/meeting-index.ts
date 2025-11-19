export type MeetingRow = {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  created_at: string;
  category: {
    id: string;
    title: string;
    color_code: string | null;
  } | null;
  sessionCount: number;
  participantCount: number;
  hasSummary: boolean;
  latestSummary: {
    id: string;
    summary_text: string;
    generated_at: string;
  } | null;
};

export type MeetingIndexResponse = {
  meetings: MeetingRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type MeetingSummary = {
  id: string;
  summary_text: string;
  key_decisions: any[];
  action_items: any[];
  topics_discussed: string[];
  participant_count: number | null;
  duration_seconds: number | null;
  generated_at: string;
  session: {
    id: string;
    started_at: string;
    ended_at: string | null;
  } | null;
};

export type TranscriptItem = {
  id: string;
  text: string;
  speaker_label: string | null;
  start_time: number | null;
  end_time: number | null;
  created_at: string;
  session_id: string | null;
};

export type SessionWithTranscripts = {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  transcripts: TranscriptItem[];
};

export type MeetingTranscriptsResponse = {
  sessions: SessionWithTranscripts[];
  totalTranscripts: number;
};
