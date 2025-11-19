/**
 * STT テスト用音声アップロードエンドポイント
 *
 * 音声チャンクを受け取ってSTTストリームに書き込む
 */

import { NextRequest } from "next/server";
import { sttTestSessions } from "../test/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId") as string;
    const audioBlob = formData.get("audio") as Blob;
    const sequence = formData.get("sequence") as string;

    if (!sessionId || !audioBlob) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId or audio" }),
        { status: 400 }
      );
    }

    // セッション取得
    const session = sttTestSessions.get(sessionId);
    if (!session) {
      console.log("[STT Test Upload] ⚠️ Session not found", { sessionId });
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404 }
      );
    }

    // 音声データをバッファに変換
    const audioBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(audioBuffer);

    // STTストリームに書き込み
    session.sttStream.write(buffer);

    console.log("[STT Test Upload] 🎵 Audio chunk written", {
      sessionId,
      sequence: parseInt(sequence),
      size: buffer.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sequence: parseInt(sequence),
        size: buffer.length,
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error("[STT Test Upload] ❌ Error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Upload failed",
      }),
      { status: 500 }
    );
  }
}
