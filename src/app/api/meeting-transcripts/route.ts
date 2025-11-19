/**
 * 会議文字起こし取得API
 * GET /api/meeting-transcripts?meetingId=xxx&sessionId=xxx
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

    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");
    const sessionId = searchParams.get("sessionId");

    if (!meetingId) {
      return NextResponse.json(
        { error: "meetingId is required" },
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

    // セッション一覧を取得
    const { data: sessions, error: sessionsError } = await supabase
      .from("meeting_sessions")
      .select("id, started_at, ended_at, status")
      .eq("meeting_id", meetingId)
      .order("started_at", { ascending: true });

    if (sessionsError) {
      console.error("Failed to fetch sessions:", sessionsError);
      return NextResponse.json(
        { error: "Failed to fetch sessions" },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: "No sessions found for this meeting" },
        { status: 404 }
      );
    }

    // 文字起こしを取得（セッション指定がある場合は絞り込み）
    let transcriptsQuery = supabase
      .from("transcripts")
      .select("id, text, speaker_label, start_time, end_time, created_at, session_id")
      .eq("meeting_id", meetingId)
      .order("start_time", { ascending: true });

    if (sessionId) {
      transcriptsQuery = transcriptsQuery.eq("session_id", sessionId);
    }

    const { data: transcripts, error: transcriptsError } =
      await transcriptsQuery;

    if (transcriptsError) {
      console.error("Failed to fetch transcripts:", transcriptsError);
      return NextResponse.json(
        { error: "Failed to fetch transcripts" },
        { status: 500 }
      );
    }

    // セッションごとにグループ化
    const transcriptsBySession: Record<string, any[]> = {};

    (transcripts || []).forEach((transcript) => {
      const sid = transcript.session_id || "unknown";
      if (!transcriptsBySession[sid]) {
        transcriptsBySession[sid] = [];
      }
      transcriptsBySession[sid].push(transcript);
    });

    // セッション情報と文字起こしを結合
    const sessionsWithTranscripts = sessions.map((session) => ({
      ...session,
      transcripts: transcriptsBySession[session.id] || [],
    }));

    return NextResponse.json({
      sessions: sessionsWithTranscripts,
      totalTranscripts: transcripts?.length || 0,
    });
  } catch (error) {
    console.error("GET /api/meeting-transcripts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
