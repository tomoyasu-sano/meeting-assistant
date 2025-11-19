/**
 * 会議一覧API
 * GET /api/meeting-index
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

    // クエリパラメータ取得
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get("categoryId");
    const query = searchParams.get("query") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    // ベースクエリ
    let supabaseQuery = supabase
      .from("meetings")
      .select(
        `
        id,
        title,
        scheduled_at,
        status,
        created_at,
        category:categories (
          id,
          title,
          color_code
        ),
        sessions:meeting_sessions (
          id,
          started_at,
          ended_at,
          status
        ),
        summaries:meeting_summaries (
          id,
          summary_text,
          generated_at
        ),
        participants:meeting_participants (
          id
        )
      `,
        { count: "exact" }
      )
      .order("scheduled_at", { ascending: false });

    // カテゴリフィルタ
    if (categoryId && categoryId !== "all") {
      supabaseQuery = supabaseQuery.eq("category_id", categoryId);
    }

    // タイトル検索
    if (query) {
      supabaseQuery = supabaseQuery.ilike("title", `%${query}%`);
    }

    // ページング
    supabaseQuery = supabaseQuery.range(offset, offset + pageSize - 1);

    const { data: meetings, error, count } = await supabaseQuery;

    if (error) {
      console.error("Failed to fetch meetings:", error);
      return NextResponse.json(
        { error: "Failed to fetch meetings" },
        { status: 500 }
      );
    }

    // データ整形
    const formattedMeetings = (meetings || []).map((meeting: any) => ({
      id: meeting.id,
      title: meeting.title,
      scheduled_at: meeting.scheduled_at,
      status: meeting.status,
      created_at: meeting.created_at,
      category: meeting.category,
      sessionCount: meeting.sessions?.length || 0,
      participantCount: meeting.participants?.length || 0,
      hasSummary: (meeting.summaries?.length || 0) > 0,
      latestSummary: meeting.summaries?.[0] || null,
    }));

    return NextResponse.json({
      meetings: formattedMeetings,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error) {
    console.error("GET /api/meeting-index error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
