/**
 * 過去セッション履歴API
 * GET /api/meetings/[meetingId]/history?range=1|3|all
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
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

    // クエリパラメータ
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "all";

    // 過去の終了済みセッションを取得（最新順）
    let query = supabase
      .from("meeting_sessions")
      .select(
        `
        id,
        started_at,
        ended_at,
        status,
        meeting_summaries (
          id,
          summary_text,
          key_decisions,
          action_items
        )
      `
      )
      .eq("meeting_id", meetingId)
      .eq("status", "ended")
      .order("started_at", { ascending: false });

    // 範囲指定
    if (range === "1") {
      query = query.limit(1);
    } else if (range === "3") {
      query = query.limit(3);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error("Failed to fetch history sessions:", error);
      return NextResponse.json(
        { error: "Failed to fetch sessions" },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        sessions: [],
        total: 0,
      });
    }

    // レスポンス整形
    const formattedSessions = sessions.map((session: any, index: number) => {
      const summaries = session.meeting_summaries || [];
      const hasSummary = summaries.length > 0;
      const summary = hasSummary ? summaries[0] : null;

      return {
        sessionId: session.id,
        title: `第${sessions.length - index}回`,
        occurredAt: session.started_at,
        summaryStatus: hasSummary ? "ready" : "missing",
        summaryText: summary?.summary_text || null,
        sessionNumber: sessions.length - index,
      };
    });

    return NextResponse.json({
      sessions: formattedSessions,
      total: sessions.length,
    });
  } catch (error) {
    console.error("GET /api/meetings/[meetingId]/history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
