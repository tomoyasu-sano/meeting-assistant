import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * PATCH /api/meetings/[meetingId]/sessions/[sessionId]/pause
 * セッションを一時停止
 */
export async function PATCH(
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

  // セッションの存在確認と状態チェック
  const { data: session } = await supabase
    .from("meeting_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("meeting_id", meetingId)
    .single();

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  if (session.status !== "active") {
    return NextResponse.json(
      {
        error: "invalid_status",
        message: `セッションをpauseできません。現在のステータス: ${session.status}`,
      },
      { status: 400 }
    );
  }

  // セッションを一時停止に更新
  const { data: updatedSession, error } = await supabase
    .from("meeting_sessions")
    .update({
      status: "paused",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    console.error("Failed to pause session:", error);
    return NextResponse.json(
      { error: "Failed to pause session" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    session: updatedSession,
    message: "セッションを一時停止しました",
  });
}
