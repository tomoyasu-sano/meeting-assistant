-- Stage 10: リアルタイムAI統合のためのスキーマ更新

-- 1. meeting_sessionsテーブルにAIモードカラム追加
ALTER TABLE public.meeting_sessions
ADD COLUMN IF NOT EXISTS ai_mode TEXT CHECK (ai_mode IN ('mock', 'hybrid', 'full_realtime')) DEFAULT 'mock';

COMMENT ON COLUMN public.meeting_sessions.ai_mode IS 'AIモード: mock=モックデータ, hybrid=Google STT + OpenAI Realtime（テキスト）, full_realtime=OpenAI Realtime（音声）';

-- 2. session_costsテーブル作成（コスト追跡用）
CREATE TABLE IF NOT EXISTS public.session_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.meeting_sessions(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('google_stt', 'openai_realtime_text', 'openai_realtime_audio')),
  cost_usd DECIMAL(10, 4) NOT NULL,
  usage_details JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.session_costs IS 'セッションごとのAPIコスト追跡';
COMMENT ON COLUMN public.session_costs.service IS 'APIサービス名';
COMMENT ON COLUMN public.session_costs.cost_usd IS 'コスト（USD）';
COMMENT ON COLUMN public.session_costs.usage_details IS '使用量詳細（JSON）: {audio_minutes, tokens_input, tokens_output}';

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_session_costs_session_id ON public.session_costs(session_id);
CREATE INDEX IF NOT EXISTS idx_session_costs_service ON public.session_costs(service);
CREATE INDEX IF NOT EXISTS idx_session_costs_recorded_at ON public.session_costs(recorded_at);

-- 3. RLS（Row Level Security）設定
ALTER TABLE public.session_costs ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のセッションのコストのみ閲覧可能
CREATE POLICY "Users can view their own session costs"
  ON public.session_costs FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM meeting_sessions s
      JOIN meetings m ON s.meeting_id = m.id
      JOIN categories c ON m.category_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- システムのみコスト挿入可能（サーバー側から）
CREATE POLICY "Service role can insert session costs"
  ON public.session_costs FOR INSERT
  WITH CHECK (true);

-- 4. speaker_mappingsテーブル作成（話者マッピング用）
CREATE TABLE IF NOT EXISTS public.speaker_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.meeting_sessions(id) ON DELETE CASCADE,
  speaker_label TEXT NOT NULL, -- 'Speaker 1', 'Speaker 2', etc.
  participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL, -- 参加者の表示名
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(session_id, speaker_label)
);

COMMENT ON TABLE public.speaker_mappings IS '話者ラベルと参加者のマッピング';
COMMENT ON COLUMN public.speaker_mappings.speaker_label IS 'Google STTの話者ラベル（Speaker 1, Speaker 2, etc.）';
COMMENT ON COLUMN public.speaker_mappings.participant_name IS 'マッピングされた参加者名';

-- インデックス
CREATE INDEX IF NOT EXISTS idx_speaker_mappings_session_id ON public.speaker_mappings(session_id);

-- RLS
ALTER TABLE public.speaker_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own speaker mappings"
  ON public.speaker_mappings FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM meeting_sessions s
      JOIN meetings m ON s.meeting_id = m.id
      JOIN categories c ON m.category_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own speaker mappings"
  ON public.speaker_mappings FOR ALL
  USING (
    session_id IN (
      SELECT s.id FROM meeting_sessions s
      JOIN meetings m ON s.meeting_id = m.id
      JOIN categories c ON m.category_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );
