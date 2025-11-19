/**
 * Gemini API テスト用エンドポイント（サービスアカウント / OAuth2 認証）
 *
 * シンプルなテキスト入力→テキスト出力のストリーミング応答を返す。
 */

import { NextRequest } from "next/server";
import { GoogleAuth } from "google-auth-library";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gemini-2.5-flash";

function extractText(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload);
    const arrayPayload = Array.isArray(parsed) ? parsed : [parsed];

    let text = "";
    for (const item of arrayPayload) {
      const candidate = item?.candidates?.[0];
      if (!candidate) continue;

      if (Array.isArray(candidate.content?.parts)) {
        text += candidate.content.parts
          .map((part: any) => part?.text || "")
          .join("");
      } else if (typeof candidate.content?.text === "string") {
        text += candidate.content.text;
      }
    }

    return text;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log("[Gemini Test] Request received", { time: new Date().toISOString() });

  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
      });
    }

    const credentialsPath = path.resolve(process.cwd(), "google-credentials.json");
    const auth = new GoogleAuth({
      keyFilename: credentialsPath,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken?.token) {
      console.error("[Gemini Test] Failed to acquire access token");
      return new Response(
        JSON.stringify({ error: "Failed to acquire access token" }),
        { status: 500 }
      );
    }

    const model = process.env.GEMINI_TEST_MODEL || DEFAULT_MODEL;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

    const apiCallStart = Date.now();
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      }),
    });

    console.log("[Gemini Test] API response received", {
      latency: Date.now() - apiCallStart,
    });

    if (!geminiResponse.ok || !geminiResponse.body) {
      const errorText = await geminiResponse.text().catch(() => "");
      console.error("[Gemini Test] Gemini API error", {
        status: geminiResponse.status,
        error: errorText,
      });
      return new Response(
        JSON.stringify({
          error: "Gemini API request failed",
          details: errorText,
        }),
        { status: geminiResponse.status || 500 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const flush = (obj: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        const body = geminiResponse.body;
        if (!body) {
          flush({ type: "error", message: "Missing response body" });
          controller.close();
          return;
        }

        const reader = body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let pending = "";
        let fullText = "";
        let chunkCount = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
              const rawLine = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);

              if (!rawLine.startsWith("data:")) {
                continue;
              }

              const payload = rawLine.substring(5).trim();
              const candidateLine = pending
                ? `${pending}${payload}`
                : payload;

              const textChunk = extractText(candidateLine);
              if (textChunk === null) {
                pending = candidateLine;
                continue;
              }

              pending = "";
              if (textChunk.length > 0) {
                chunkCount += 1;
                fullText += textChunk;
                flush({
                  type: "delta",
                  text: textChunk,
                  metadata: {
                    chunkNumber: chunkCount,
                    totalLength: fullText.length,
                  },
                });
              }
            }
          }

          const remaining = [pending, buffer]
            .filter((chunk) => chunk && chunk.trim().length > 0)
            .join("");

          if (remaining) {
            const textChunk = extractText(remaining);
            if (textChunk && textChunk.length > 0) {
              chunkCount += 1;
              fullText += textChunk;
              flush({
                type: "delta",
                text: textChunk,
                metadata: {
                  chunkNumber: chunkCount,
                  totalLength: fullText.length,
                },
              });
            }
          }

          flush({
            type: "complete",
            fullText,
            metadata: {
              totalChunks: chunkCount,
              totalLength: fullText.length,
              totalTime: Date.now() - startTime,
            },
          });
        } catch (error) {
          console.error("[Gemini Test] Stream error", error);
          flush({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        } finally {
          controller.close();
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
  } catch (error) {
    console.error("[Gemini Test] Error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
