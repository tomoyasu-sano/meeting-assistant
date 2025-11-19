-- ============================================
-- hmqtyhyzueehwhcfkgld プロジェクト用
-- categories と participants テーブルの作成
-- ============================================
-- Supabase SQL Editor で実行してください

-- 既存テーブルの削除（念のため）
DROP TABLE IF EXISTS public.participants CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;

-- UUID拡張を有効化
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- categoriesテーブル
-- ============================================

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  color_code TEXT
);

-- インデックス
CREATE INDEX categories_user_id_idx ON public.categories (user_id, created_at DESC);

-- RLS有効化
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "Users can view their own categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- participantsテーブル
-- ============================================

CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT,
  organization TEXT,
  notes TEXT,
  voice_profile_id UUID
);

-- インデックス
CREATE INDEX participants_user_id_idx ON public.participants (user_id, created_at DESC);

-- RLS有効化
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "Users can view their own participants"
  ON public.participants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create participants"
  ON public.participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participants"
  ON public.participants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own participants"
  ON public.participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 権限付与
-- ============================================

GRANT ALL ON TABLE public.categories TO postgres;
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;

GRANT ALL ON TABLE public.participants TO postgres;
GRANT ALL ON TABLE public.participants TO authenticated;
GRANT ALL ON TABLE public.participants TO service_role;

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
WHERE table_name IN ('categories', 'participants')
  AND table_schema = 'public';

-- カラムを確認
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('categories', 'participants')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- RLSポリシーを確認
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('categories', 'participants')
ORDER BY tablename, policyname;
