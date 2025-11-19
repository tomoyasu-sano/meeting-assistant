/**
 * Gemini AI応答生成API
 *
 * トリガー検出時にGemini 1.5を使用してAI応答を生成し、
 * HTTPストリーミングでクライアントに送信
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { GEMINI_CONFIG, GOOGLE_CLOUD_CONFIG } from "@/lib/google-ai/config";
import path from "path";

export const runtime = "nodejs";

type TriggerType =
  | "NONE"
  | "DIRECT_CALL"
  | "SUMMARY_REQUEST"
  | "RESEARCH_REQUEST"
  | "QUESTION"
  | "LONG_SPEECH"
  | "SILENCE";

type RequestBody = {
  sessionId: string;
  triggerType: TriggerType;
  conversationHistory: Array<{
    speaker: string;
    text: string;
    timestamp: string;
  }>;
  meetingTitle?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { triggerType, conversationHistory, meetingTitle } = body;

    // プロンプト生成
    const prompt = buildPrompt(triggerType, conversationHistory, meetingTitle);

    console.log("[Gemini API] Generating response", {
      triggerType,
      promptLength: prompt.length,
      model: GEMINI_CONFIG.model,
      location: GEMINI_CONFIG.location,
    });

    // Gemini APIエンドポイント（リージョンプレフィックス必須）
    const host =
      GEMINI_CONFIG.location === "global"
        ? "aiplatform.googleapis.com"
        : `${GEMINI_CONFIG.location}-aiplatform.googleapis.com`;

    const endpoint = `https://${host}/v1/projects/${GOOGLE_CLOUD_CONFIG.projectId}/locations/${GEMINI_CONFIG.location}/publishers/google/models/${GEMINI_CONFIG.model}:streamGenerateContent`;

    console.log("[Gemini API] Endpoint", endpoint);

    // Google認証（絶対パスを使用）
    const credentialsPath = path.resolve(
      process.cwd(),
      GOOGLE_CLOUD_CONFIG.credentialsPath
    );
    const auth = new GoogleAuth({
      keyFilename: credentialsPath,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error("Failed to get access token");
    }

    // Gemini APIリクエスト
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
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: GEMINI_CONFIG.generationConfig,
        safetySettings: GEMINI_CONFIG.safetySettings,
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("[Gemini API] Request failed", {
        status: geminiResponse.status,
        error: errorText,
      });
      throw new Error(`Gemini API error: ${geminiResponse.statusText}`);
    }

    console.log("[Gemini API] Response received, starting stream");

    // ストリーミングレスポンスの作成（行区切りJSON対応）
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const flush = (obj: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        try {
          const reader = geminiResponse.body?.getReader();
          if (!reader) {
            throw new Error("No response body");
          }

          let fullText = "";
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          let pending = "";

          // Vertex AIはNDJSONだが行途中で改行が入る場合があるため、組み立てながら処理する
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let newlineIndex;
            while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);

              if (!line) continue;

              const candidateLine = pending
                ? `${pending}${line}`
                : line;

              try {
                const parsed = JSON.parse(candidateLine);
                pending = "";

                const payload = Array.isArray(parsed) ? parsed[0] : parsed;
                const candidates = payload?.candidates ?? [];
                const candidate = candidates[0];
                const parts = candidate?.content?.parts;

                let textChunk = "";
                if (Array.isArray(parts) && parts.length > 0) {
                  textChunk = parts
                    .map((part: any) => part?.text || "")
                    .join("");
                } else if (typeof candidate?.content?.text === "string") {
                  textChunk = candidate.content.text;
                }

                if (textChunk) {
                  fullText += textChunk;
                  flush({ type: "delta", text: textChunk });
                  console.log("[Gemini API] Delta sent", {
                    length: textChunk.length,
                  });
                }
              } catch (parseError) {
                // JSONとしてまだ完成していないので pending に保持
                pending = candidateLine;
              }
            }
          }

          // 残ったデータ(buffer + pending)を最終処理
          const remaining = [pending, buffer]
            .filter((chunk) => chunk && chunk.trim().length > 0)
            .join("");

          if (remaining) {
            try {
              const parsed = JSON.parse(remaining);
              const payload = Array.isArray(parsed) ? parsed[0] : parsed;
              const candidates = payload?.candidates ?? [];
              const candidate = candidates[0];
              const parts = candidate?.content?.parts;

              let textChunk = "";
              if (Array.isArray(parts) && parts.length > 0) {
                textChunk = parts
                  .map((part: any) => part?.text || "")
                  .join("");
              } else if (typeof candidate?.content?.text === "string") {
                textChunk = candidate.content.text;
              }

              if (textChunk) {
                fullText += textChunk;
                flush({ type: "delta", text: textChunk });
                console.log("[Gemini API] Delta sent", {
                  length: textChunk.length,
                });
              }
            } catch (parseError) {
              console.warn("[Gemini API] Discarding incomplete JSON", {
                remaining,
              });
            }
          }

          // 完了イベント送信
          flush({ type: "complete", fullText });
          console.log("[Gemini API] Stream complete", {
            totalLength: fullText.length,
          });
          controller.close();
        } catch (error) {
          console.error("[Gemini API] Stream error", error);
          flush({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
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
    console.error("[Gemini API] Error", error);

    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * プロンプト生成
 */
function buildPrompt(
  triggerType: TriggerType,
  conversationHistory: Array<{ speaker: string; text: string }>,
  meetingTitle?: string
): string {
  // 直近の会話を抽出（最大10件）
  const recentConversation = conversationHistory
    .slice(-10)
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n");

  const basePrompt = `あなたは介護サービス会議のアシスタントAIです。
会議: ${meetingTitle || "会議"}

直近の会話:
${recentConversation}

`;

  switch (triggerType) {
    case "DIRECT_CALL":
      return (
        basePrompt +
        "参加者から直接呼びかけられました。簡潔に応答してください。（30文字以内）"
      );

    case "SUMMARY_REQUEST":
      return (
        basePrompt +
        "これまでの議論を要約してください。主要なポイントを3点に絞って箇条書きで。"
      );

    case "RESEARCH_REQUEST":
      return (
        basePrompt +
        "参加者が調査を依頼しています。適切な情報を提供してください。（50文字以内）"
      );

    case "QUESTION":
      return (
        basePrompt +
        "参加者の質問に答えてください。簡潔かつ正確に。（50文字以内）"
      );

    case "LONG_SPEECH":
      return (
        basePrompt +
        "長い発言が続いています。議論を整理するための提案を1つだけ。（30文字以内）"
      );

    case "SILENCE":
      return (
        basePrompt +
        "沈黙が続いています。議論を前進させるための質問を1つ。（30文字以内）"
      );

    default:
      return basePrompt + "現在の議論に対して、適切なコメントをください。";
  }
}
