import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/meetings/[meetingId]/sessions
 * 会議の全セッション一覧を取得
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

  // セッション一覧を取得（新しい順）
  const { data: sessions, error } = await supabase
    .from("meeting_sessions")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sessions: sessions || [],
  });
}
