import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type RouteContext = {
  params: Promise<{
    meetingId: string;
    sessionId: string;
  }>;
};

/**
 * GET /api/meetings/{meetingId}/history/{sessionId}/evaluation
 * 過去セッションの評価を取得
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await getSupabaseServerClient();
    const { meetingId, sessionId } = await context.params;

    console.log('[History Evaluation API] Fetching evaluation', {
      meetingId,
      sessionId,
    });

    // 評価の取得
    const { data: evaluation, error } = await supabase
      .from('meeting_evaluations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('meeting_id', meetingId)
      .single();

    if (error) {
      console.error('[History Evaluation API] Error fetching evaluation:', error);
      return NextResponse.json(
        { error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error('[History Evaluation API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
