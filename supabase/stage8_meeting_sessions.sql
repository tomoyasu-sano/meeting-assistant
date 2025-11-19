-- Stage 8: Meeting Session Management
-- 会議セッションのライフサイクル管理テーブル

-- 1. meeting_sessions テーブル作成
CREATE TABLE IF NOT EXISTS public.meeting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_meeting_id ON public.meeting_sessions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_status ON public.meeting_sessions(status);
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_meeting_status ON public.meeting_sessions(meeting_id, status);

-- RLS有効化
ALTER TABLE public.meeting_sessions ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 閲覧
CREATE POLICY "Users can view their own meeting sessions"
  ON public.meeting_sessions FOR SELECT
  USING (
    meeting_id IN (
      SELECT m.id FROM public.meetings m
      JOIN public.categories c ON m.category_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- RLSポリシー: 挿入
CREATE POLICY "Users can insert their own meeting sessions"
  ON public.meeting_sessions FOR INSERT
  WITH CHECK (
    meeting_id IN (
      SELECT m.id FROM public.meetings m
      JOIN public.categories c ON m.category_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- RLSポリシー: 更新
CREATE POLICY "Users can update their own meeting sessions"
  ON public.meeting_sessions FOR UPDATE
  USING (
    meeting_id IN (
      SELECT m.id FROM public.meetings m
      JOIN public.categories c ON m.category_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- 2. transcripts テーブルに session_id カラム追加
ALTER TABLE public.transcripts
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.meeting_sessions(id) ON DELETE CASCADE;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON public.transcripts(session_id);

-- 3. meeting_summaries テーブル作成
CREATE TABLE IF NOT EXISTS public.meeting_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.meeting_sessions(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  key_decisions JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  topics_discussed TEXT[] DEFAULT ARRAY[]::TEXT[],
  participant_count INTEGER,
  duration_seconds INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_session_id ON public.meeting_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_meeting_id ON public.meeting_summaries(meeting_id);

-- RLS有効化
ALTER TABLE public.meeting_summaries ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 閲覧
CREATE POLICY "Users can view their own meeting summaries"
  ON public.meeting_summaries FOR SELECT
  USING (
    meeting_id IN (
      SELECT m.id FROM public.meetings m
      JOIN public.categories c ON m.category_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- RLSポリシー: 挿入
CREATE POLICY "Users can insert their own meeting summaries"
  ON public.meeting_summaries FOR INSERT
  WITH CHECK (
    meeting_id IN (
      SELECT m.id FROM public.meetings m
      JOIN public.categories c ON m.category_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- 4. ai_messages テーブルに session_id カラム追加
-- 注意: ai_messages テーブルは Stage 11 で作成されます
-- 今回は ai_messages への変更はスキップします

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'Stage 8 migration completed successfully';
  RAISE NOTICE '- meeting_sessions table created';
  RAISE NOTICE '- transcripts.session_id column added';
  RAISE NOTICE '- meeting_summaries table created';
  RAISE NOTICE '- ai_messages.session_id will be added in Stage 11';
END $$;
