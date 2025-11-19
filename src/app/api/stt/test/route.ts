/**
 * STT テスト用SSEエンドポイント
 *
 * Google Cloud Speech-to-Text v1でストリーミング認識
 */

import { SpeechClient } from "@google-cloud/speech";
import { NextRequest } from "next/server";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// セッションストア（簡易版）
export const sttTestSessions = new Map<string, any>();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return new Response("Missing sessionId", { status: 400 });
  }

  console.log("[STT Test] 🎤 Session starting", { sessionId });

  // SSEストリーム作成
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      let isClosed = false;

      const safeEnqueue = (data: string) => {
        if (isClosed) {
          console.warn("[STT Test] ⚠️ Controller already closed, skipping enqueue");
          return;
        }
        try {
          controller.enqueue(encoder.encode(data));
        } catch (error) {
          console.error("[STT Test] ❌ Enqueue error", error);
          isClosed = true;
        }
      };

      try {
        // 認証情報
        const credentialsPath = path.resolve(
          process.cwd(),
          "google-credentials.json"
        );

        const speechClient = new SpeechClient({
          keyFilename: credentialsPath,
        });

        console.log("[STT Test] 🔊 Creating STT stream");

        // ストリーミング認識開始
        const sttStream = speechClient.streamingRecognize({
          config: {
            encoding: "LINEAR16" as any,
            sampleRateHertz: 16000,
            languageCode: "ja-JP",
            enableAutomaticPunctuation: true,
            model: "latest_long",
            useEnhanced: true,
          },
          interimResults: true,
        });

        // セッション登録
        sttTestSessions.set(sessionId, { sttStream });

        // 初期化完了通知
        safeEnqueue("event: ready\ndata: {}\n\n");
        console.log("[STT Test] ✅ STT stream ready");

        // STT結果をSSEで送信
        sttStream.on("data", (data: any) => {
          const result = data.results?.[0];
          if (!result) return;

          const transcript = result.alternatives?.[0]?.transcript || "";
          const confidence = result.alternatives?.[0]?.confidence || 0;
          const isFinal = result.isFinal;

          const event = isFinal ? "final" : "partial";

          console.log(`[STT Test] 📝 ${event}:`, transcript.substring(0, 30));

          const sseData = `event: ${event}\ndata: ${JSON.stringify({
            text: transcript,
            confidence,
            isFinal,
            timestamp: new Date().toISOString(),
          })}\n\n`;

          safeEnqueue(sseData);
        });

        sttStream.on("error", (error: any) => {
          console.error("[STT Test] ❌ STT Stream Error", error);
          safeEnqueue(`event: error\ndata: ${JSON.stringify({
            message: error.message || "STT error"
          })}\n\n`);
        });

        sttStream.on("end", () => {
          console.log("[STT Test] 🔚 STT Stream ended", { sessionId });
          isClosed = true;
          sttTestSessions.delete(sessionId);
          try {
            controller.close();
          } catch (error) {
            console.error("[STT Test] Error closing controller", error);
          }
        });

        // クライアント切断時のクリーンアップ
        request.signal.addEventListener("abort", () => {
          console.log("[STT Test] 🔌 Client disconnected", { sessionId });
          isClosed = true;
          try {
            sttStream.end();
          } catch (error) {
            console.error("[STT Test] Error ending stream", error);
          }
          sttTestSessions.delete(sessionId);
          try {
            controller.close();
          } catch (error) {
            console.error("[STT Test] Error closing controller", error);
          }
        });

      } catch (error) {
        console.error("[STT Test] ❌ Initialization error", error);
        isClosed = true;
        safeEnqueue(`event: error\ndata: ${JSON.stringify({
          message: error instanceof Error ? error.message : "Init failed"
        })}\n\n`);
        try {
          controller.close();
        } catch (closeError) {
          console.error("[STT Test] Error closing controller after init error", closeError);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
