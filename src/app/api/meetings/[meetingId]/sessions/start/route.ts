import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/meetings/[meetingId]/sessions/start
 * 新しい会議セッションを開始
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await context.params;
  const supabase = await getSupabaseServerClient();

  // リクエストボディからAIモードを取得
  const body = await request.json();
  const aiMode = body.aiMode || "mock"; // デフォルトはmock

  // 認証確認
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 会議の存在確認（ホストのみアクセス可能）
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

  // アクティブなセッションが既に存在するか確認
  const { data: activeSession } = await supabase
    .from("meeting_sessions")
    .select("id, status")
    .eq("meeting_id", meetingId)
    .eq("status", "active")
    .single();

  if (activeSession) {
    return NextResponse.json(
      {
        error: "active_session_exists",
        message: "この会議には既にアクティブなセッションが存在します",
        sessionId: activeSession.id,
      },
      { status: 409 }
    );
  }

  // 新しいセッションを作成
  const { data: newSession, error } = await supabase
    .from("meeting_sessions")
    .insert({
      meeting_id: meetingId,
      status: "active",
      ai_mode: aiMode,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    session: newSession,
    message: "セッションを開始しました",
  });
}
