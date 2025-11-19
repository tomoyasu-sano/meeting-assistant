import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { generateEvaluationForSession } from '@/lib/ai/evaluation-service';
import type { MergeMode } from '@/lib/utils/conversation-merger';

type RouteContext = {
  params: Promise<{
    meetingId: string;
  }>;
};

/**
 * POST /api/meetings/{meetingId}/evaluation
 * 会議評価生成エンドポイント
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await getSupabaseServerClient();
    const { meetingId } = await context.params;

    // 認証確認
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // リクエストボディの取得
    const body = await request.json();
    const { sessionId, mode = 'human_ai_combined' } = body as {
      sessionId: string;
      mode?: MergeMode;
    };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // 会議の所有者チェック
    const { data: meeting } = await supabase
      .from('meetings')
      .select(
        `
        id,
        category:categories!inner(user_id)
      `
      )
      .eq('id', meetingId)
      .single();

    if (!meeting || (meeting.category as any)?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 評価生成サービスを呼び出し
    const result = await generateEvaluationForSession({
      meetingId,
      sessionId,
      mode,
    });

    // ステータスに応じてレスポンスを返す
    switch (result.status) {
      case 'success':
        return NextResponse.json({
          success: true,
          evaluation: result.evaluation,
        });

      case 'already_exists':
        return NextResponse.json(
          {
            error: 'Evaluation already exists for this session',
            evaluation: result.evaluation,
          },
          { status: 409 }
        );

      case 'no_data':
        return NextResponse.json(
          { error: result.error || 'No conversation data found' },
          { status: 400 }
        );

      case 'not_found':
        return NextResponse.json(
          { error: result.error || 'Session or meeting not found' },
          { status: 404 }
        );

      case 'failed':
      default:
        return NextResponse.json(
          {
            error: 'Failed to generate evaluation',
            details: result.error,
          },
          { status: 500 }
        );
    }
  } catch (error) {
    console.error('[Evaluation API] ❌ Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/meetings/{meetingId}/evaluation?sessionId={sessionId}
 * 既存の評価を取得
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await getSupabaseServerClient();
    const { meetingId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId query parameter is required' },
        { status: 400 }
      );
    }

    // 評価の取得
    const { data: evaluation, error } = await supabase
      .from('meeting_evaluations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('meeting_id', meetingId)
      .single();

    if (error || !evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error('[Evaluation API] Failed to fetch evaluation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
