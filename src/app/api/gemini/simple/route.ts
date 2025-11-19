/**
 * Gemini API シンプルテスト用エンドポイント（Vertex AI SDK経由）
 *
 * サービスアカウント認証でVertex AI Gemini APIにアクセス
 */

import { NextRequest } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || "meeting-supporter";
const LOCATION = process.env.VERTEX_LOCATION || "asia-northeast1";
const DEFAULT_MODEL = "gemini-2.5-flash";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
      });
    }

    console.log("[Gemini Simple] ⏱️ Request received", {
      messageLength: message.length,
      project: PROJECT_ID,
      location: LOCATION,
      time: new Date().toISOString(),
    });

    // 認証情報パスを環境変数に設定
    const authStart = Date.now();
    const credentialsPath = path.resolve(
      process.cwd(),
      "google-credentials.json"
    );
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    console.log(`[Gemini Simple] 🔑 Credentials set (${Date.now() - authStart}ms)`, credentialsPath);

    // Vertex AI SDK初期化
    const initStart = Date.now();
    const vertexAI = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    });
    console.log(`[Gemini Simple] 🚀 VertexAI initialized (${Date.now() - initStart}ms)`);

    const model = process.env.GEMINI_TEST_MODEL || DEFAULT_MODEL;

    // Generative Model取得
    const modelStart = Date.now();
    const generativeModel = vertexAI.getGenerativeModel({
      model: model,
    });
    console.log(`[Gemini Simple] 📦 Model loaded (${Date.now() - modelStart}ms)`, { model });

    const apiCallStart = Date.now();
    console.log(`[Gemini Simple] 🌐 API call starting...`);

    // コンテンツ生成（ストリーミングなし）
    const result = await generativeModel.generateContent({
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
    });

    const apiLatency = Date.now() - apiCallStart;
    console.log(`[Gemini Simple] ⚡ API call completed (${apiLatency}ms)`);

    // レスポンスからテキストを抽出
    const response = result.response;
    const candidates = response.candidates || [];
    const firstCandidate = candidates[0];
    const content = firstCandidate?.content;
    const parts = content?.parts || [];
    const text = parts.map((p: any) => p.text || "").join("");

    const totalTime = Date.now() - startTime;

    console.log("[Gemini Simple] Success", {
      textLength: text.length,
      apiLatency,
      totalTime,
    });

    return new Response(
      JSON.stringify({
        text,
        metadata: {
          model,
          project: PROJECT_ID,
          location: LOCATION,
          apiLatency,
          totalTime,
          textLength: text.length,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[Gemini Simple] Error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500 }
    );
  }
}
