/**
 * 議論アシスト OpenAI API（Streaming）
 */

import { NextRequest } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_MODEL = "gpt-4o-mini"; // gpt-5.1-mini is not yet available, using gpt-4o-mini as fallback

type Message = {
  role: "user" | "assistant";
  text: string;
};

type RequestBody = {
  meetingId: string;
  mode: "checkpoint" | "chat";
  summaryRange?: { from: string; to: string };
  transcriptChunk?: string;
  meetingInfo?: { title: string; purpose: string };
  history?: Message[];
  userMessage?: string;
};

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const {
      mode,
      transcriptChunk,
      meetingInfo,
      history = [],
      userMessage,
    }: RequestBody = await request.json();

    console.log("[OpenAI Discussion] Request received", {
      mode,
      transcriptLength: transcriptChunk?.length,
      historyLength: history.length,
    });

    // システムプロンプト
    const systemPrompt = `あなたは会議に参加している後輩です。議論を整理し、抜け漏れや次のアクションを提案します。
返答は日本語で、必ず礼儀正しく、前向きなトーンにしてください。`;

    // プロンプト構築
    let userPrompt = "";

    if (mode === "checkpoint") {
      // チェックポイントモード: 要約生成
      const historyText = history.length > 0
        ? `# 既存の要約/抜け漏れ\n${history.map((h, i) => `${i + 1}) ${h.text}`).join("\n\n")}\n\n`
        : "";

      userPrompt = `${historyText}# ここまでの議事録
${transcriptChunk || "（まだ議事録がありません）"}

# 会議の情報
タイトル: ${meetingInfo?.title || "未設定"}
目的: ${meetingInfo?.purpose || "未設定"}

以下の4パート構成で回答してください:
1. ここまでの議論の一言サマリ
2. ほぼ合意されていそうなこと
3. 抜け漏れチェック
4. 次に話すと良さそうなこと`;
    } else {
      // チャットモード: ユーザーの質問に回答
      const recentSummary = history.length > 0
        ? `# 直近の要約/抜け漏れ\n${history[history.length - 1].text}\n\n`
        : "";

      const recentTranscripts = transcriptChunk
        ? `# 最後の要約以降の会話テキスト\n${transcriptChunk}\n\n`
        : "";

      userPrompt = `${recentSummary}${recentTranscripts}# ユーザー指示
${userMessage}`;
    }

    // OpenAI API 呼び出し（ストリーミング）
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    });

    console.log("[OpenAI Discussion] Stream started");

    // SSEストリームを作成
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";

            if (delta) {
              fullText += delta;

              // SSE形式でチャンクを送信
              const data = JSON.stringify({
                type: "chunk",
                text: delta,
                fullText: fullText,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // 完了メッセージ
          const doneData = JSON.stringify({
            type: "done",
            fullText: fullText,
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));

          console.log("[OpenAI Discussion] Stream completed", {
            textLength: fullText.length,
          });

          controller.close();
        } catch (error) {
          console.error("[OpenAI Discussion] Stream error:", error);
          const errorData = JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[OpenAI Discussion] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
