import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { generateSummaryForSession } from '@/lib/ai/summary-service';
import type { MergeMode } from '@/lib/utils/conversation-merger';
import type { SummaryProviderType } from '@/lib/ai/summary-providers';

type RouteContext = {
  params: Promise<{
    meetingId: string;
  }>;
};

/**
 * POST /api/meetings/{meetingId}/summary
 * ライブAIセッション終了時の要約生成エンドポイント
 * HTTP経由での手動再生成や管理UI用
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
    const {
      sessionId,
      mode = 'human_ai_combined',
      provider = 'gemini',
    } = body as {
      sessionId: string;
      mode?: MergeMode;
      provider?: SummaryProviderType;
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

    // 要約生成サービスを呼び出し
    const result = await generateSummaryForSession({
      meetingId,
      sessionId,
      mode,
      provider,
    });

    // ステータスに応じてレスポンスを返す
    switch (result.status) {
      case 'success':
        return NextResponse.json({
          success: true,
          summary: result.summary,
          stats: result.stats,
        });

      case 'already_exists':
        return NextResponse.json(
          {
            error: 'Summary already exists for this session',
            summary: result.summary,
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
            error: 'Failed to generate summary',
            details: result.error,
          },
          { status: 500 }
        );
    }
  } catch (error) {
    console.error('[Summary API] ❌ Unexpected error:', error);
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
 * GET /api/meetings/{meetingId}/summary?sessionId={sessionId}
 * 既存の要約を取得
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

    // 要約の取得
    const { data: summary, error } = await supabase
      .from('meeting_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .eq('meeting_id', meetingId)
      .single();

    if (error || !summary) {
      return NextResponse.json(
        { error: 'Summary not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Failed to fetch summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
