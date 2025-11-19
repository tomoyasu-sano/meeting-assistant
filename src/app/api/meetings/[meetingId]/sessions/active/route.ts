import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/meetings/[meetingId]/sessions/active
 * 現在アクティブなセッションを取得
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await context.params;
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

  // アクティブなセッションを取得
  const { data: activeSession, error } = await supabase
    .from("meeting_sessions")
    .select("*")
    .eq("meeting_id", meetingId)
    .eq("status", "active")
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = "The result contains 0 rows" エラー以外
    console.error("Failed to fetch active session:", error);
    return NextResponse.json(
      { error: "Failed to fetch active session" },
      { status: 500 }
    );
  }

  if (!activeSession) {
    return NextResponse.json({
      session: null,
      message: "アクティブなセッションはありません",
    });
  }

  return NextResponse.json({
    session: activeSession,
  });
}
