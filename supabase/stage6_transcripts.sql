-- ============================================
-- Stage 6: 文字起こしテーブルの作成
-- ============================================
-- Supabase SQL Editor (hmqtyhyzueehwhcfkgld) で実行してください

-- 既存テーブルの削除（念のため）
DROP TABLE IF EXISTS public.transcripts CASCADE;

-- ============================================
-- transcriptsテーブル
-- ============================================

CREATE TABLE public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,  -- 話者不明の場合はNULL
  text TEXT NOT NULL,  -- 文字起こしテキスト
  start_time REAL,  -- 会議開始からの経過時間（秒）
  end_time REAL,  -- 会議開始からの経過時間（秒）
  confidence REAL,  -- 信頼度（0.0〜1.0）
  language TEXT,  -- 検出された言語（例: "ja", "en"）
  audio_duration REAL,  -- 音声チャンクの長さ（秒）
  speaker_label TEXT  -- 話者ラベル（Stage 8で使用、例: "Speaker 1"）
);

-- インデックス
CREATE INDEX transcripts_meeting_id_idx ON public.transcripts (meeting_id, created_at DESC);
CREATE INDEX transcripts_participant_id_idx ON public.transcripts (participant_id);
CREATE INDEX transcripts_start_time_idx ON public.transcripts (meeting_id, start_time);

-- RLS有効化
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（会議の所有者のみアクセス可能）
CREATE POLICY "Users can view transcripts of their meetings"
  ON public.transcripts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      JOIN public.categories ON meetings.category_id = categories.id
      WHERE meetings.id = transcripts.meeting_id
      AND categories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create transcripts for their meetings"
  ON public.transcripts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings
      JOIN public.categories ON meetings.category_id = categories.id
      WHERE meetings.id = transcripts.meeting_id
      AND categories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update transcripts of their meetings"
  ON public.transcripts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      JOIN public.categories ON meetings.category_id = categories.id
      WHERE meetings.id = transcripts.meeting_id
      AND categories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete transcripts of their meetings"
  ON public.transcripts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      JOIN public.categories ON meetings.category_id = categories.id
      WHERE meetings.id = transcripts.meeting_id
      AND categories.user_id = auth.uid()
    )
  );

-- ============================================
-- 権限付与
-- ============================================

GRANT ALL ON TABLE public.transcripts TO postgres;
GRANT ALL ON TABLE public.transcripts TO authenticated;
GRANT ALL ON TABLE public.transcripts TO service_role;

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
WHERE table_name = 'transcripts'
  AND table_schema = 'public';

-- カラムを確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transcripts'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- RLSポリシーを確認
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'transcripts'
ORDER BY policyname;
