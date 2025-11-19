/**
 * セッション文字起こし取得API
 * GET /api/meetings/[meetingId]/history/[sessionId]/transcript
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string; sessionId: string }> }
) {
  try {
    const { meetingId, sessionId } = await params;
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // セッション情報を取得
    const { data: session, error: sessionError } = await supabase
      .from("meeting_sessions")
      .select("id, started_at, ended_at, status")
      .eq("id", sessionId)
      .eq("meeting_id", meetingId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // 文字起こしを取得
    const { data: transcripts, error: transcriptError } = await supabase
      .from("transcripts")
      .select(
        `
        id,
        text,
        speaker_label,
        start_time,
        end_time,
        created_at
      `
      )
      .eq("session_id", sessionId)
      .order("start_time", { ascending: true });

    if (transcriptError) {
      console.error("Failed to fetch transcripts:", transcriptError);
      return NextResponse.json(
        { error: "Failed to fetch transcripts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transcripts: transcripts || [],
      session: {
        id: session.id,
        started_at: session.started_at,
        ended_at: session.ended_at,
      },
    });
  } catch (error) {
    console.error(
      "GET /api/meetings/[meetingId]/history/[sessionId]/transcript error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
