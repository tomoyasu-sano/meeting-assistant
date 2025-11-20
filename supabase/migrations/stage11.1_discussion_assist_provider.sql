-- Stage 11.1: ai_messagesテーブルにopenai_discussionプロバイダーを追加
-- 議論アシストメッセージ（チェックポイント要約とチャット）を保存するため

-- 1. providerカラムの制約を更新して'openai_discussion'を追加
ALTER TABLE public.ai_messages
DROP CONSTRAINT IF EXISTS ai_messages_provider_check;

ALTER TABLE public.ai_messages
ADD CONSTRAINT ai_messages_provider_check
CHECK (provider IN ('gemini_live', 'gemini_assessment', 'openai_realtime', 'openai_discussion'));

-- 2. modeカラムの制約を更新して'checkpoint'を追加
ALTER TABLE public.ai_messages
DROP CONSTRAINT IF EXISTS ai_messages_mode_check;

ALTER TABLE public.ai_messages
ADD CONSTRAINT ai_messages_mode_check
CHECK (mode IN ('assistant', 'assessment', 'custom', 'checkpoint'));

-- 3. コメント更新
COMMENT ON COLUMN public.ai_messages.provider IS 'AIプロバイダー: gemini_live=Gemini Live WebSocket, gemini_assessment=Gemini 1.5 HTTP, openai_realtime=OpenAI Realtime, openai_discussion=OpenAI Discussion Assist';
COMMENT ON COLUMN public.ai_messages.mode IS 'AIモード: assistant=アシスタント, assessment=アセスメント, custom=カスタム, checkpoint=チェックポイント要約';

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'Stage 11.1 migration completed successfully';
  RAISE NOTICE '- ai_messages.provider constraint updated to include openai_discussion';
  RAISE NOTICE '- ai_messages.mode constraint updated to include checkpoint';
END $$;
