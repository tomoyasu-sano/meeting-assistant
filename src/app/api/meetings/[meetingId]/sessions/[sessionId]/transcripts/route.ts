import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/meetings/[meetingId]/sessions/[sessionId]/transcripts
 * セッションの文字起こし一覧を取得
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ meetingId: string; sessionId: string }> }
) {
  const { meetingId, sessionId } = await context.params;
  const supabase = await getSupabaseServerClient();

  // 認証確認
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 会議の存在確認
  const { data: meeting } = await supabase
    .from("meetings")
    .select(
      `
      id,
      category:categories(user_id)
    `
    )
    .eq("id", meetingId)
    .single();

  if (!meeting || (meeting.category as any)?.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // セッションの存在確認
  const { data: session } = await supabase
    .from("meeting_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("meeting_id", meetingId)
    .single();

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  // 文字起こし一覧を取得
  const { data: transcripts, error } = await supabase
    .from("transcripts")
    .select(
      `
      id,
      text,
      start_time,
      speaker_label,
      confidence,
      language,
      created_at,
      participant:participants(display_name)
    `
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch transcripts:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcripts" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    transcripts: transcripts || [],
  });
}
