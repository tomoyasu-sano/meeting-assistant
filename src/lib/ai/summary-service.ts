/**
 * 要約生成サービス
 * セッション終了時に文字起こしとAI応答を統合して要約を生成する
 */

import { getSupabaseServiceClient } from '@/lib/supabase/service';
import {
  mergeConversationLogs,
  formatConversationForSummary,
  getConversationStats,
  type MergeMode,
  type TranscriptRecord,
  type AIMessageRecord,
} from '@/lib/utils/conversation-merger';
import {
  createSummaryProvider,
  type SummaryProviderType,
  type SummaryResult,
} from '@/lib/ai/summary-providers';

export type SummaryStatus =
  | 'success'
  | 'no_data'
  | 'failed'
  | 'already_exists'
  | 'not_found';

export type GenerateSummaryResult = {
  status: SummaryStatus;
  summary?: any;
  stats?: {
    totalMessages: number;
    humanMessages: number;
    aiMessages: number;
    participantCount: number;
    durationSeconds: number;
  };
  error?: string;
};

export type GenerateSummaryOptions = {
  meetingId: string;
  sessionId: string;
  mode?: MergeMode;
  provider?: SummaryProviderType;
};

/**
 * セッションの要約を生成する（内部関数）
 * RLSをバイパスしてService Role Keyでアクセス
 */
export async function generateSummaryForSession(
  options: GenerateSummaryOptions
): Promise<GenerateSummaryResult> {
  const {
    meetingId,
    sessionId,
    mode = 'human_ai_combined',
    provider = 'gemini',
  } = options;

  console.log('[Summary Service] 🚀 Starting summary generation', {
    meetingId,
    sessionId,
    mode,
    provider,
  });

  try {
    // Service Role Keyを使用してRLSをバイパス
    const supabase = getSupabaseServiceClient();

    // 1. セッションの存在確認
    const { data: session, error: sessionError } = await supabase
      .from('meeting_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('meeting_id', meetingId)
      .single();

    if (sessionError || !session) {
      console.error('[Summary Service] ❌ Session not found', {
        sessionId,
        meetingId,
        error: sessionError,
      });
      return {
        status: 'not_found',
        error: 'Session not found',
      };
    }

    // 2. 会議情報の取得
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('title')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error('[Summary Service] ❌ Meeting not found', {
        meetingId,
        error: meetingError,
      });
      return {
        status: 'not_found',
        error: 'Meeting not found',
      };
    }

    // 3. 既存の要約が存在するかチェック
    const { data: existingSummary } = await supabase
      .from('meeting_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .eq('meeting_id', meetingId)
      .single();

    if (existingSummary) {
      console.log('[Summary Service] ℹ️  Summary already exists', {
        summaryId: existingSummary.id,
      });
      return {
        status: 'already_exists',
        summary: existingSummary,
      };
    }

    // 4. 文字起こしログの取得
    console.log('[Summary Service] 📖 Fetching transcripts...');

    const { data: transcripts, error: transcriptsError } = await supabase
      .from('transcripts')
      .select(
        `
        id,
        text,
        created_at,
        participant_id,
        speaker_label,
        participants(display_name)
      `
      )
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    console.log('[Summary Service] 📊 Transcripts fetch result:', {
      count: transcripts?.length || 0,
      hasError: !!transcriptsError,
    });

    if (transcriptsError) {
      console.error('[Summary Service] ❌ Failed to fetch transcripts:', {
        error: transcriptsError,
        message: transcriptsError.message,
      });
      return {
        status: 'failed',
        error: 'Failed to fetch transcripts',
      };
    }

    // 5. AI発話ログの取得
    console.log('[Summary Service] 🤖 Fetching AI messages...');

    const { data: aiMessages, error: aiMessagesError } = await supabase
      .from('ai_messages')
      .select('id, content, created_at, source')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    console.log('[Summary Service] 📊 AI messages fetch result:', {
      count: aiMessages?.length || 0,
      hasError: !!aiMessagesError,
    });

    if (aiMessagesError) {
      console.error('[Summary Service] ❌ Failed to fetch AI messages:', {
        error: aiMessagesError,
        message: aiMessagesError.message,
      });
      return {
        status: 'failed',
        error: 'Failed to fetch AI messages',
      };
    }

    // 6. 会話ログの統合
    console.log('[Summary Service] 🔗 Merging conversation logs...', {
      transcriptsCount: transcripts?.length || 0,
      aiMessagesCount: aiMessages?.length || 0,
      mode,
    });

    const conversationMessages = mergeConversationLogs(
      (transcripts || []) as TranscriptRecord[],
      (aiMessages || []) as AIMessageRecord[],
      mode
    );

    console.log('[Summary Service] 📋 Merged conversation result:', {
      totalMessages: conversationMessages.length,
      humanMessages: conversationMessages.filter((m) => m.speaker === 'Human')
        .length,
      aiMessages: conversationMessages.filter((m) => m.speaker === 'AI').length,
    });

    // 会話ログが空の場合
    if (conversationMessages.length === 0) {
      console.error('[Summary Service] ❌ No conversation data found', {
        transcriptsCount: transcripts?.length || 0,
        aiMessagesCount: aiMessages?.length || 0,
        mode,
      });
      return {
        status: 'no_data',
        error: 'No conversation data found for this session',
      };
    }

    // 7. 会話の統計情報を取得
    const stats = getConversationStats(conversationMessages);

    // 8. 要約用テキストの生成
    const conversationText = formatConversationForSummary(conversationMessages);

    // 9. AIプロバイダーを使って要約生成（リトライ付き）
    console.log('[Summary Service] 🤖 Generating summary with AI...', {
      provider,
      textLength: conversationText.length,
    });

    let summaryResult: SummaryResult;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const summaryProvider = createSummaryProvider(provider);
        summaryResult = await summaryProvider.generateSummary(
          conversationText,
          meeting.title
        );
        console.log('[Summary Service] ✅ Summary generated successfully');
        break;
      } catch (error) {
        retries++;
        console.error(
          `[Summary Service] ❌ Summary generation failed (attempt ${retries}/${maxRetries})`,
          {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
          }
        );

        if (retries >= maxRetries) {
          return {
            status: 'failed',
            error: 'Failed to generate summary after multiple retries',
          };
        }

        // 指数バックオフ
        const backoffMs = Math.pow(2, retries) * 1000;
        console.log(
          `[Summary Service] ⏳ Retrying in ${backoffMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    // 10. 要約をデータベースに保存
    console.log('[Summary Service] 💾 Saving summary to database...');

    const { data: savedSummary, error: saveError } = await supabase
      .from('meeting_summaries')
      .insert({
        session_id: sessionId,
        meeting_id: meetingId,
        summary_text: summaryResult!.summaryText,
        key_decisions: summaryResult!.keyDecisions,
        action_items: summaryResult!.actionItems,
        topics_discussed: summaryResult!.topicsDiscussed,
        participant_count: stats.participantCount,
        duration_seconds: stats.durationSeconds,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      console.error('[Summary Service] ❌ Failed to save summary:', {
        error: saveError,
        message: saveError.message,
      });
      return {
        status: 'failed',
        error: 'Failed to save summary',
      };
    }

    console.log('[Summary Service] ✅ Summary saved successfully', {
      summaryId: savedSummary.id,
    });

    // 11. 成功レスポンス
    return {
      status: 'success',
      summary: savedSummary,
      stats: {
        totalMessages: stats.totalMessages,
        humanMessages: stats.humanMessageCount,
        aiMessages: stats.aiMessageCount,
        participantCount: stats.participantCount,
        durationSeconds: stats.durationSeconds,
      },
    };
  } catch (error) {
    console.error('[Summary Service] ❌ Unexpected error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      status: 'failed',
      error:
        error instanceof Error ? error.message : 'Internal server error',
    };
  }
}
