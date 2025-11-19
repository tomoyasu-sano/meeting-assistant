-- ============================================
-- Stage 5: 音声プロファイルテーブルの作成
-- ============================================
-- Supabase SQL Editor (hmqtyhyzueehwhcfkgld) で実行してください

-- 既存テーブルの削除（念のため）
DROP TABLE IF EXISTS public.voice_profiles CASCADE;

-- ============================================
-- voice_profilesテーブル
-- ============================================

CREATE TABLE public.voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  feature_blob_path TEXT NOT NULL,  -- Supabase Storageのパス
  embedding_vector TEXT,  -- 将来の音声埋め込み（Stage 8で使用）
  model_version TEXT,  -- 使用した音声モデルのバージョン
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'failed')),
  file_size_bytes INTEGER,  -- ファイルサイズ
  duration_seconds REAL,  -- 録音時間
  error_message TEXT  -- エラーがあった場合のメッセージ
);

-- インデックス
CREATE INDEX voice_profiles_participant_id_idx ON public.voice_profiles (participant_id, created_at DESC);
CREATE INDEX voice_profiles_status_idx ON public.voice_profiles (status);

-- RLS有効化
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（参加者の所有者のみアクセス可能）
CREATE POLICY "Users can view voice profiles of their participants"
  ON public.voice_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants
      WHERE participants.id = voice_profiles.participant_id
      AND participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create voice profiles for their participants"
  ON public.voice_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants
      WHERE participants.id = voice_profiles.participant_id
      AND participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update voice profiles of their participants"
  ON public.voice_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants
      WHERE participants.id = voice_profiles.participant_id
      AND participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete voice profiles of their participants"
  ON public.voice_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants
      WHERE participants.id = voice_profiles.participant_id
      AND participants.user_id = auth.uid()
    )
  );

-- ============================================
-- 権限付与
-- ============================================

GRANT ALL ON TABLE public.voice_profiles TO postgres;
GRANT ALL ON TABLE public.voice_profiles TO authenticated;
GRANT ALL ON TABLE public.voice_profiles TO service_role;

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
WHERE table_name = 'voice_profiles'
  AND table_schema = 'public';

-- カラムを確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'voice_profiles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- RLSポリシーを確認
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'voice_profiles'
ORDER BY policyname;
