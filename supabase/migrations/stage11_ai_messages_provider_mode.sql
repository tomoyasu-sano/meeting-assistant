-- Stage 11: ai_messagesテーブルにproviderとmodeカラムを追加
-- AI応答保存レイヤーの統一のため、プロバイダーとモード情報を記録

-- 1. ai_messagesテーブルにproviderカラムを追加
ALTER TABLE public.ai_messages
ADD COLUMN IF NOT EXISTS provider TEXT CHECK (provider IN ('gemini_live', 'gemini_assessment', 'openai_realtime'));

-- 2. ai_messagesテーブルにmodeカラムを追加
ALTER TABLE public.ai_messages
ADD COLUMN IF NOT EXISTS mode TEXT CHECK (mode IN ('assistant', 'assessment', 'custom'));

-- 3. ai_messagesテーブルにturn_idカラムを追加（重複防止用）
ALTER TABLE public.ai_messages
ADD COLUMN IF NOT EXISTS turn_id TEXT;

-- 4. turn_idのユニーク制約を追加
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_messages_turn_id
  ON public.ai_messages(turn_id)
  WHERE turn_id IS NOT NULL;

-- 5. インデックス追加（provider, mode でのフィルタリング用）
CREATE INDEX IF NOT EXISTS idx_ai_messages_provider ON public.ai_messages(provider);
CREATE INDEX IF NOT EXISTS idx_ai_messages_mode ON public.ai_messages(mode);
CREATE INDEX IF NOT EXISTS idx_ai_messages_provider_mode ON public.ai_messages(provider, mode);

-- 6. コメント追加
COMMENT ON COLUMN public.ai_messages.provider IS 'AIプロバイダー: gemini_live=Gemini Live WebSocket, gemini_assessment=Gemini 1.5 HTTP, openai_realtime=OpenAI Realtime';
COMMENT ON COLUMN public.ai_messages.mode IS 'AIモード: assistant=アシスタント, assessment=アセスメント, custom=カスタム';
COMMENT ON COLUMN public.ai_messages.turn_id IS 'ターンID（タイムスタンプ+ハッシュ）重複保存防止用';

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'Stage 11 migration completed successfully';
  RAISE NOTICE '- ai_messages.provider column added';
  RAISE NOTICE '- ai_messages.mode column added';
  RAISE NOTICE '- ai_messages.turn_id column added with unique index';
  RAISE NOTICE '- Indexes created for provider and mode filtering';
END $$;
