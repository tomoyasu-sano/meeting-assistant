-- ============================================
-- Stage 4: 会議管理テーブルの作成
-- ============================================
-- Supabase SQL Editor (hmqtyhyzueehwhcfkgld) で実行してください

-- 既存テーブルの削除（念のため）
DROP TABLE IF EXISTS public.meeting_participants CASCADE;
DROP TABLE IF EXISTS public.meetings CASCADE;

-- ============================================
-- meetingsテーブル
-- ============================================

CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  join_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  join_password_hash TEXT,
  max_participants INTEGER NOT NULL DEFAULT 5,
  ai_config_snapshot JSONB
);

-- インデックス
CREATE INDEX meetings_category_id_idx ON public.meetings (category_id, scheduled_at DESC);
CREATE INDEX meetings_status_idx ON public.meetings (status);
CREATE INDEX meetings_join_token_idx ON public.meetings (join_token);

-- updated_at自動更新用トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS有効化
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "Users can view meetings in their categories"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.categories
      WHERE categories.id = meetings.category_id
      AND categories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create meetings in their categories"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.categories
      WHERE categories.id = meetings.category_id
      AND categories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update meetings in their categories"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.categories
      WHERE categories.id = meetings.category_id
      AND categories.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.categories
      WHERE categories.id = meetings.category_id
      AND categories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete meetings in their categories"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.categories
      WHERE categories.id = meetings.category_id
      AND categories.user_id = auth.uid()
    )
  );

-- ============================================
-- meeting_participantsテーブル
-- ============================================

CREATE TABLE public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  is_voice_registered BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ,
  UNIQUE(meeting_id, participant_id)
);

-- インデックス
CREATE INDEX meeting_participants_meeting_id_idx ON public.meeting_participants (meeting_id);
CREATE INDEX meeting_participants_participant_id_idx ON public.meeting_participants (participant_id);

-- RLS有効化
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（会議を所有しているユーザーのみアクセス可能）
CREATE POLICY "Users can view participants in their meetings"
  ON public.meeting_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      JOIN public.categories c ON m.category_id = c.id
      WHERE m.id = meeting_participants.meeting_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add participants to their meetings"
  ON public.meeting_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings m
      JOIN public.categories c ON m.category_id = c.id
      WHERE m.id = meeting_participants.meeting_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update participants in their meetings"
  ON public.meeting_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      JOIN public.categories c ON m.category_id = c.id
      WHERE m.id = meeting_participants.meeting_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove participants from their meetings"
  ON public.meeting_participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      JOIN public.categories c ON m.category_id = c.id
      WHERE m.id = meeting_participants.meeting_id
      AND c.user_id = auth.uid()
    )
  );

-- ============================================
-- 権限付与
-- ============================================

GRANT ALL ON TABLE public.meetings TO postgres;
GRANT ALL ON TABLE public.meetings TO authenticated;
GRANT ALL ON TABLE public.meetings TO service_role;

GRANT ALL ON TABLE public.meeting_participants TO postgres;
GRANT ALL ON TABLE public.meeting_participants TO authenticated;
GRANT ALL ON TABLE public.meeting_participants TO service_role;

-- ============================================
-- PostgRESTにスキーマをリロードさせる
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- 確認クエリ
-- ============================================

-- テーブルが作成されたか確認
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_name IN ('meetings', 'meeting_participants')
  AND table_schema = 'public';

-- カラムを確認
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('meetings', 'meeting_participants')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- RLSポリシーを確認
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('meetings', 'meeting_participants')
ORDER BY tablename, policyname;
