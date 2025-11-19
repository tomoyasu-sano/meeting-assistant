import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    meetingId: string;
  }>;
};

/**
 * GET /api/meetings/{meetingId}/summaries/history
 * 同一会議の過去セッション要約を取得（最新5件）
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await getSupabaseServerClient();
    const { meetingId } = await context.params;

    // 認証確認
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 会議がユーザーのものであるか確認
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

    // 過去要約の取得（最新5件）
    const { data: summaries, error } = await supabase
      .from("meeting_summaries")
      .select("id, summary_text, generated_at")
      .eq("meeting_id", meetingId)
      .order("generated_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("[Summaries History] Failed to fetch summaries:", error);
      return NextResponse.json(
        { error: "Failed to fetch summaries" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      summaries: summaries || [],
    });
  } catch (error) {
    console.error("[Summaries History] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
