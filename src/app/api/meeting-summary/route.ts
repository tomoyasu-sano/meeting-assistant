/**
 * 会議サマリー取得API
 * GET /api/meeting-summary?meetingId=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      return NextResponse.json(
        { error: "meetingId is required" },
        { status: 400 }
      );
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

    // 最新のサマリーを取得
    const { data: summaries, error } = await supabase
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
        generated_at,
        session:meeting_sessions (
          id,
          started_at,
          ended_at
        )
      `
      )
      .eq("meeting_id", meetingId)
      .order("generated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Failed to fetch summary:", error);
      return NextResponse.json(
        { error: "Failed to fetch summary" },
        { status: 500 }
      );
    }

    if (!summaries || summaries.length === 0) {
      return NextResponse.json(
        { error: "No summary found for this meeting" },
        { status: 404 }
      );
    }

    return NextResponse.json({ summary: summaries[0] });
  } catch (error) {
    console.error("GET /api/meeting-summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
