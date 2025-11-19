/**
 * セッションサマリー取得API
 * GET /api/meetings/[meetingId]/history/[sessionId]/summary
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string; sessionId: string }> }
) {
  try {
    const { meetingId, sessionId } = await params;
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 会議の所有権確認
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, category:categories(user_id)")
      .eq("id", meetingId)
      .single();

    if (!meeting || (meeting.category as any)?.user_id !== user.id) {
      return NextResponse.json(
        { error: "Meeting not found or access denied" },
        { status: 404 }
      );
    }

    // セッション情報を取得
    const { data: session, error: sessionError } = await supabase
      .from("meeting_sessions")
      .select("id, started_at, ended_at, status")
      .eq("id", sessionId)
      .eq("meeting_id", meetingId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // サマリーを取得
    const { data: summaries, error: summaryError } = await supabase
      .from("meeting_summaries")
      .select(
        `
        id,
        summary_text,
        key_decisions,
        action_items,
        topics_discussed,
        participant_count,
        duration_seconds,
        generated_at
      `
      )
      .eq("session_id", sessionId)
      .order("generated_at", { ascending: false })
      .limit(1);

    if (summaryError) {
      console.error("Failed to fetch summary:", summaryError);
      return NextResponse.json(
        { error: "Failed to fetch summary" },
        { status: 500 }
      );
    }

    const summary = summaries && summaries.length > 0 ? summaries[0] : null;

    // サマリーが存在しない場合
    if (!summary) {
      // 将来的にはここでオンデマンド生成を行う
      // 現時点では null を返す
      return NextResponse.json({
        summary: null,
        session: {
          id: session.id,
          started_at: session.started_at,
          ended_at: session.ended_at,
        },
      });
    }

    return NextResponse.json({
      summary,
      session: {
        id: session.id,
        started_at: session.started_at,
        ended_at: session.ended_at,
      },
    });
  } catch (error) {
    console.error(
      "GET /api/meetings/[meetingId]/history/[sessionId]/summary error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
