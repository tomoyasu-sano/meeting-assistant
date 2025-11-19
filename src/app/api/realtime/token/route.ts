import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * リアルタイムAI接続用の一時トークンを発行
 * Stage 10.1: ハイブリッドモード
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 認証確認
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. リクエストボディ取得
    const { meetingId, sessionId } = await request.json();

    if (!meetingId || !sessionId) {
      return NextResponse.json(
        { error: "Missing meetingId or sessionId" },
        { status: 400 }
      );
    }

    // 3. 会議へのアクセス権確認と出力モード取得
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, title, ai_output_mode, category:categories(user_id)")
      .eq("id", meetingId)
      .single();

    if (!meeting || (meeting.category as any)?.user_id !== user.id) {
      return NextResponse.json(
        { error: "Meeting not found or access denied" },
        { status: 404 }
      );
    }

    const outputMode = meeting.ai_output_mode || "text_audio";

    // 4. Google Cloud Speech-to-Text用アクセストークン取得
    let googleAccessToken = null;
    try {
      const auth = new GoogleAuth({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      googleAccessToken = tokenResponse.token;
    } catch (err) {
      console.error("Failed to get Google access token:", err);
      // Google STT失敗は致命的ではない（Web Speech APIにフォールバック可能）
    }

    // 5. OpenAI Realtime API用エフェメラルキー取得
    console.log("Requesting OpenAI ephemeral token...");
    const ephemeralResponse = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-10-01",
          voice: "alloy",
        }),
      }
    );

    if (!ephemeralResponse.ok) {
      const errorText = await ephemeralResponse.text();
      console.error("OpenAI ephemeral token error:", errorText);
      return NextResponse.json(
        { error: "Failed to get OpenAI ephemeral token" },
        { status: 500 }
      );
    }

    const ephemeralData = await ephemeralResponse.json();
    console.log("OpenAI ephemeral response:", ephemeralData);

    // 6. レスポンス返却
    return NextResponse.json({
      googleAccessToken,
      openaiEphemeralKey: ephemeralData.client_secret?.value,
      meetingTitle: meeting.title,
      outputMode,
      sessionId,
      expiresIn: 60, // 1分で期限切れ
    });
  } catch (error: any) {
    console.error("Token API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
