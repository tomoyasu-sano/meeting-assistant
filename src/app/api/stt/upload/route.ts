/**
 * 音声アップロードAPI
 *
 * クライアントから500ms間隔でアップロードされる音声チャンクを
 * Google STT V2 のストリームに送信する
 */

import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@/lib/google-ai/stt-session";

export const runtime = "nodejs";

// V2 API: 25KB制限（余裕を持たせて20KBに設定）
const MAX_CHUNK_SIZE = 20 * 1024; // 20KB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId") as string;
    const audioBlob = formData.get("audio") as Blob;
    const sequence = parseInt(formData.get("sequence") as string);

    if (!sessionId || !audioBlob) {
      return NextResponse.json(
        { error: "Missing sessionId or audio data" },
        { status: 400 }
      );
    }

    // セッション取得
    const session = sessionStore.get(sessionId);
    if (!session) {
      console.error("[STT Upload] Session not found", { sessionId });
      return NextResponse.json(
        { error: "Session not found. Please start streaming first." },
        { status: 404 }
      );
    }

    // 音声データをBuffer化
    const audioBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(audioBuffer);

    // STTストリームに送信
    // V2 APIでは { audio: buffer } の形式で送信
    // また、25KB制限があるため、大きなバッファは分割
    try {
      if (buffer.length <= MAX_CHUNK_SIZE) {
        // 25KB以下の場合はそのまま送信
        session.sttStream.write({ audio: buffer });

        // console.log("[STT Upload V2] Audio chunk sent", {
        //   sessionId,
        //   sequence,
        //   size: buffer.length,
        // });
      } else {
        // 25KBを超える場合は分割して送信
        let offset = 0;
        let chunkCount = 0;

        while (offset < buffer.length) {
          const chunk = buffer.slice(offset, offset + MAX_CHUNK_SIZE);
          session.sttStream.write({ audio: chunk });
          offset += MAX_CHUNK_SIZE;
          chunkCount++;
        }

        console.log("[STT Upload V2] Large audio split and sent", {
          sessionId,
          sequence,
          totalSize: buffer.length,
          chunks: chunkCount,
        });
      }

      return NextResponse.json({
        success: true,
        sequence,
        size: buffer.length,
      });
    } catch (streamError) {
      console.error("[STT Upload V2] Error writing to stream", {
        sessionId,
        error: streamError,
      });

      return NextResponse.json(
        {
          error: "Failed to write to STT stream",
          details:
            streamError instanceof Error ? streamError.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[STT Upload V2] Request processing error", error);

    return NextResponse.json(
      {
        error: "Failed to process audio upload",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
