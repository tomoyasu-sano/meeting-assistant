/**
 * 会議評価生成サービス
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
  createEvaluationProvider,
  type EvaluationProvider,
} from '@/lib/ai/evaluation-provider';
import type { EvaluationResult } from '@/types/evaluation';

export type EvaluationStatus =
  | 'success'
  | 'no_data'
  | 'failed'
  | 'already_exists'
  | 'not_found';

export type GenerateEvaluationResult = {
  status: EvaluationStatus;
  evaluation?: any;
  error?: string;
};

export type GenerateEvaluationOptions = {
  meetingId: string;
  sessionId: string;
  mode?: MergeMode;
};

/**
 * セッションの評価を生成する
 * RLSをバイパスしてService Role Keyでアクセス
 */
export async function generateEvaluationForSession(
  options: GenerateEvaluationOptions
): Promise<GenerateEvaluationResult> {
  const { meetingId, sessionId, mode = 'human_ai_combined' } = options;

  console.log('[Evaluation Service] 🚀 Starting evaluation generation', {
    meetingId,
    sessionId,
    mode,
  });

  try {
    const supabase = getSupabaseServiceClient();

    // 1. セッションの存在確認
    const { data: session, error: sessionError } = await supabase
      .from('meeting_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('meeting_id', meetingId)
      .single();

    if (sessionError || !session) {
      console.error('[Evaluation Service] ❌ Session not found', {
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
      console.error('[Evaluation Service] ❌ Meeting not found', {
        meetingId,
        error: meetingError,
      });
      return {
        status: 'not_found',
        error: 'Meeting not found',
      };
    }

    // 3. 既存の評価が存在するかチェック
    const { data: existingEvaluation } = await supabase
      .from('meeting_evaluations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('meeting_id', meetingId)
      .single();

    if (existingEvaluation) {
      console.log('[Evaluation Service] ℹ️  Evaluation already exists', {
        evaluationId: existingEvaluation.id,
      });
      return {
        status: 'already_exists',
        evaluation: existingEvaluation,
      };
    }

    // 4. 文字起こしログの取得
    console.log('[Evaluation Service] 📖 Fetching transcripts...');

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

    if (transcriptsError) {
      console.error('[Evaluation Service] ❌ Failed to fetch transcripts:', {
        error: transcriptsError,
      });
      return {
        status: 'failed',
        error: 'Failed to fetch transcripts',
      };
    }

    // 5. AI発話ログの取得
    console.log('[Evaluation Service] 🤖 Fetching AI messages...');

    const { data: aiMessages, error: aiMessagesError } = await supabase
      .from('ai_messages')
      .select('id, content, created_at, source')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (aiMessagesError) {
      console.error('[Evaluation Service] ❌ Failed to fetch AI messages:', {
        error: aiMessagesError,
      });
      return {
        status: 'failed',
        error: 'Failed to fetch AI messages',
      };
    }

    // 6. 会話ログの統合
    console.log('[Evaluation Service] 🔗 Merging conversation logs...');

    const conversationMessages = mergeConversationLogs(
      (transcripts || []) as TranscriptRecord[],
      (aiMessages || []) as AIMessageRecord[],
      mode
    );

    // 会話ログが空の場合
    if (conversationMessages.length === 0) {
      console.error('[Evaluation Service] ❌ No conversation data found');
      return {
        status: 'no_data',
        error: 'No conversation data found for this session',
      };
    }

    // 7. 会話の統計情報を取得
    const stats = getConversationStats(conversationMessages);

    // 8. 評価用テキストの生成
    const conversationText = formatConversationForSummary(conversationMessages);

    // 9. AIプロバイダーを使って評価生成（リトライ付き）
    console.log('[Evaluation Service] 🤖 Generating evaluation with AI...');

    let evaluationResult: EvaluationResult;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const evaluationProvider = createEvaluationProvider();
        evaluationResult = await evaluationProvider.generateEvaluation(
          conversationText,
          meeting.title,
          stats.participantCount,
          Math.floor(stats.durationSeconds / 60) // 分単位に変換
        );
        console.log('[Evaluation Service] ✅ Evaluation generated successfully');
        break;
      } catch (error) {
        retries++;
        console.error(
          `[Evaluation Service] ❌ Evaluation generation failed (attempt ${retries}/${maxRetries})`,
          {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
          }
        );

        if (retries >= maxRetries) {
          return {
            status: 'failed',
            error: 'Failed to generate evaluation after multiple retries',
          };
        }

        // 指数バックオフ
        const backoffMs = Math.pow(2, retries) * 1000;
        console.log(`[Evaluation Service] ⏳ Retrying in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    // 10. 評価をデータベースに保存
    console.log('[Evaluation Service] 💾 Saving evaluation to database...');

    const { data: savedEvaluation, error: saveError } = await supabase
      .from('meeting_evaluations')
      .insert({
        session_id: sessionId,
        meeting_id: meetingId,
        overall_feedback: evaluationResult!.overallFeedback,
        positive_aspects: evaluationResult!.positiveAspects,
        improvement_suggestions: evaluationResult!.improvementSuggestions,
        host_feedback: evaluationResult!.hostFeedback,
        team_feedback: evaluationResult!.teamFeedback,
        atmosphere_comment: evaluationResult!.atmosphereComment,
        discussion_depth_comment: evaluationResult!.discussionDepthComment,
        time_management_comment: evaluationResult!.timeManagementComment,
        engagement_comment: evaluationResult!.engagementComment,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      console.error('[Evaluation Service] ❌ Failed to save evaluation:', {
        error: saveError,
        message: saveError.message,
      });
      return {
        status: 'failed',
        error: 'Failed to save evaluation',
      };
    }

    console.log('[Evaluation Service] ✅ Evaluation saved successfully', {
      evaluationId: savedEvaluation.id,
    });

    // 11. 成功レスポンス
    return {
      status: 'success',
      evaluation: savedEvaluation,
    };
  } catch (error) {
    console.error('[Evaluation Service] ❌ Unexpected error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Internal server error',
    };
  }
}
