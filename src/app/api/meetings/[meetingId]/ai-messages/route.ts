import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type RouteContext = {
  params: Promise<{
    meetingId: string;
  }>;
};

/**
 * POST /api/meetings/{meetingId}/ai-messages
 * AI発話をai_messagesテーブルに保存
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await getSupabaseServerClient();
    const { meetingId } = await context.params;

    const body = await request.json();
    const {
      sessionId,
      content,
      source = 'response',
      provider,
      mode,
      turnId,
    } = body as {
      sessionId: string;
      content: string;
      source?: 'participation' | 'response';
      provider?: 'gemini_live' | 'gemini_assessment' | 'openai_realtime';
      mode?: 'assistant' | 'assessment' | 'custom';
      turnId?: string;
    };

    if (!sessionId || !content) {
      return NextResponse.json(
        { error: 'sessionId and content are required' },
        { status: 400 }
      );
    }

    // ai_messagesテーブルに保存
    const insertData: Record<string, unknown> = {
      meeting_id: meetingId,
      session_id: sessionId,
      content: content,
      source: source,
      render_format: 'text',
    };

    // オプショナルフィールドを追加
    if (provider) insertData.provider = provider;
    if (mode) insertData.mode = mode;
    if (turnId) insertData.turn_id = turnId;

    const { error: insertError } = await supabase
      .from('ai_messages')
      .insert(insertData);

    if (insertError) {
      console.error('[AI Messages] Failed to save:', insertError);
      return NextResponse.json(
        { error: 'Failed to save AI message', details: insertError.message },
        { status: 500 }
      );
    }

    console.log('[AI Messages] Saved successfully', {
      meetingId,
      sessionId,
      contentLength: content.length,
      source,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AI Messages] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
