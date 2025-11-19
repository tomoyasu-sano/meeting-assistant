import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 会議情報取得API
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ meetingId: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetingId } = await context.params;

    // 会議情報を取得
    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (error || !meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ meeting });
  } catch (error) {
    console.error("GET /api/meetings/[meetingId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 会議情報更新API
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ meetingId: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetingId } = await context.params;
    const body = await request.json();

    // 更新可能なフィールドのみを抽出
    const allowedFields = ["ai_output_mode"];
    const updates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
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

    // 更新実行
    const { data, error } = await supabase
      .from("meetings")
      .update(updates)
      .eq("id", meetingId)
      .select()
      .single();

    if (error) {
      console.error("Failed to update meeting:", error);
      return NextResponse.json(
        { error: "Failed to update meeting" },
        { status: 500 }
      );
    }

    return NextResponse.json({ meeting: data });
  } catch (error) {
    console.error("PATCH /api/meetings/[meetingId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
