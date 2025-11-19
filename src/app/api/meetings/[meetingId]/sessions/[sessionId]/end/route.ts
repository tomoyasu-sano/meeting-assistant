import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateSummaryForSession } from "@/lib/ai/summary-service";
import { logMeetingCostSummary } from "@/lib/pricing/calculate-costs";

/**
 * POST /api/meetings/[meetingId]/sessions/[sessionId]/end
 * セッションを終了し、要約を生成する
 */
export async function POST(
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
      category:categories!inner(user_id)
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
    .select("id, status, started_at")
    .eq("id", sessionId)
    .eq("meeting_id", meetingId)
    .single();

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  if (session.status === "ended") {
    return NextResponse.json(
      {
        error: "already_ended",
        message: "このセッションは既に終了しています",
      },
      { status: 400 }
    );
  }

  // セッションを終了に更新
  const endedAt = new Date().toISOString();
  const { data: updatedSession, error } = await supabase
    .from("meeting_sessions")
    .update({
      status: "ended",
      ended_at: endedAt,
      updated_at: endedAt,
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    console.error("[Session End] ❌ Failed to end session:", error);
    return NextResponse.json(
      { error: "Failed to end session" },
      { status: 500 }
    );
  }

  // 料金計算用のデータを取得
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("text")
    .eq("session_id", sessionId);

  const transcriptChars = transcripts
    ? transcripts.reduce((sum, t) => sum + (t.text?.length || 0), 0)
    : 0;

  // セッション時間を計算（分）
  const startTime = new Date(session.started_at);
  const endTime = new Date(endedAt);
  const durationMinutes = (endTime.getTime() - startTime.getTime()) / 60000;

  // 料金サマリーをログ出力
  logMeetingCostSummary(sessionId, {
    durationMinutes,
    transcriptChars,
    // 他のパラメータは概算として0または未設定
    // 実際のトークン数やTTS使用量は別途トラッキングが必要
  });

  // 要約生成を同一プロセス内で直接呼び出し
  // 注意: エラーが発生してもセッション終了自体は成功として扱う
  let summaryStatus = "not_triggered";
  console.log("[Session End] 📝 Generating summary...", {
    meetingId,
    sessionId,
  });

  try {
    const result = await generateSummaryForSession({
      meetingId,
      sessionId,
      mode: "human_ai_combined",
      provider: "gemini",
    });

    summaryStatus = result.status;

    console.log("[Session End] 📊 Summary generation result:", {
      status: result.status,
      error: result.error,
      hasSummary: !!result.summary,
      stats: result.stats,
    });

    if (result.status === "success") {
      console.log("[Session End] ✅ Summary generated successfully", {
        summaryId: result.summary?.id,
        stats: result.stats,
      });
    } else if (result.status === "already_exists") {
      console.log("[Session End] ℹ️  Summary already exists");
    } else if (result.status === "no_data") {
      console.log("[Session End] ⚠️  No conversation data found");
    } else {
      console.error("[Session End] ❌ Summary generation failed", {
        status: result.status,
        error: result.error,
        fullResult: JSON.stringify(result),
      });
    }
  } catch (error) {
    summaryStatus = "error";
    console.error("[Session End] ❌ Failed to generate summary (exception):", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return NextResponse.json({
    session: updatedSession,
    message: "セッションを終了しました",
    summaryStatus, // 要約生成の状態を返す
  });
}
