-- Stage 10.2: WebRTC + 出力モード設定
-- 会議ごとにAI出力モード（テキスト、音声、両方）を設定可能にする

-- meetingsテーブルに出力モード設定を追加
ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS ai_output_mode TEXT CHECK (ai_output_mode IN ('text', 'audio', 'text_audio')) DEFAULT 'text_audio';

COMMENT ON COLUMN public.meetings.ai_output_mode IS 'AI応答の出力モード: text（テキストのみ）, audio（音声のみ）, text_audio（両方）';
