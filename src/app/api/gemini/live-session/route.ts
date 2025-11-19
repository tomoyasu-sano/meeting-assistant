/**
 * Gemini Live API セッション開始エンドポイント
 *
 * WebSocket接続用のURLとパラメータを返す
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import path from "path";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL || "gemini-2.0-flash-exp";

type ProfileType = 'assistant' | 'terminology_helper' | 'tools_demo' | 'function_calling_demo';

type GeminiContent = { parts: { text: string }[] };

export async function POST(request: NextRequest) {
  try {
    const { sessionId, conversationHistory, meetingId, profile } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // 会議情報を取得してai_output_modeを取得
    let ai_output_mode = "text"; // デフォルト

    // tools_demoの場合は音声+テキスト応答を強制
    if (profile === 'tools_demo') {
      ai_output_mode = "text_audio";
    } else if (meetingId) {
      const supabase = await getSupabaseServerClient();
      const { data: meeting } = await supabase
        .from("meetings")
        .select("ai_output_mode")
        .eq("id", meetingId)
        .single();

      if (meeting?.ai_output_mode) {
        ai_output_mode = meeting.ai_output_mode;
      }
    }

    const credentialsPath = path.resolve(
      process.cwd(),
      "live_api_auth.json"
    );

    const auth = new GoogleAuth({
      keyFilename: credentialsPath,
      scopes: [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/generative-language",
      ],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse?.token;

    if (!accessToken) {
      console.error("[Gemini Live] Failed to acquire OAuth token");
      return NextResponse.json(
        { error: "Failed to acquire OAuth token" },
        { status: 500 }
      );
    }

    console.log("[Gemini Live] OAuth token acquired", {
      tokenLength: accessToken.length,
      tokenPrefix: accessToken.substring(0, 20) + "...",
    });

    // Provide the access token via query parameter so the browser can connect.
    // Token is short-lived (~1h) and scoped to generative-language.
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?access_token=${encodeURIComponent(
      accessToken
    )}`;

    console.log("[Gemini Live] Session created", {
      sessionId,
      model: GEMINI_LIVE_MODEL,
      hasHistory: !!conversationHistory,
      ai_output_mode,
    });

    const profileType: ProfileType =
      profile === 'terminology_helper'
        ? 'terminology_helper'
        : profile === 'tools_demo'
        ? 'tools_demo'
        : profile === 'function_calling_demo'
        ? 'function_calling_demo'
        : 'assistant';

    const responseData: any = {
      wsUrl,
      sessionId,
      model: `models/${GEMINI_LIVE_MODEL}`,
      ai_output_mode,
      config: {
        systemInstruction: buildSystemInstruction(
          conversationHistory,
          profileType
        ),
      },
    };

    // tools_demoの場合はツール定義を追加
    if (profileType === 'tools_demo') {
      responseData.tools = buildToolsConfig();
      console.log("[Gemini Live] tools_demo profile - tools config:", JSON.stringify(responseData.tools, null, 2));
    }

    // function_calling_demoの場合はFunction Calling設定を追加
    if (profileType === 'function_calling_demo') {
      responseData.tools = buildFunctionCallingTools();
      console.log("[Gemini Live] function_calling_demo - tools:", JSON.stringify(responseData.tools, null, 2));
    }

    console.log("[Gemini Live] Returning response:", {
      hasWsUrl: !!responseData.wsUrl,
      model: responseData.model,
      hasTools: !!responseData.tools,
      toolsCount: responseData.tools?.length || 0,
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[Gemini Live] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to create session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * ツール定義を構築（tools_demo用）
 */
function buildToolsConfig() {
  return [
    {
      functionDeclarations: [
        {
          name: "internet_search",
          description: "最新情報やWeb由来情報が必要なときに呼び出す。気温、天気、ニュースなど。",
          parameters: {
            type: "OBJECT",
            properties: {
              query: {
                type: "STRING",
                description: "検索クエリ（例：東京の気温、今日のニュース）",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "meeting_summary_lookup",
          description: "過去会議の結論や決定事項を取得する",
          parameters: {
            type: "OBJECT",
            properties: {
              meetingId: {
                type: "STRING",
                description: "会議ID",
              },
            },
            required: ["meetingId"],
          },
        },
      ],
    },
  ];
}

/**
 * Function Calling用のツール定義を構築（function_calling_demo用）
 */
function buildFunctionCallingTools() {
  return [
    {
      functionDeclarations: [
        {
          name: "get_past_meeting_summary",
          description: "過去の会議内容や決定事項を検索する",
          parameters: {
            type: "OBJECT",
            properties: {
              query: {
                type: "STRING",
                description: "会議名またはキーワード (例: '先週のケアプラン会議')"
              },
              limit: {
                type: "INTEGER",
                description: "取得する会議数の上限",
                minimum: 1,
                maximum: 5,
                default: 1
              }
            },
            required: ["query"]
          }
        }
      ]
    }
  ];
}

/**
 * システムインストラクションを生成
 */
function buildSystemInstruction(
  conversationHistory?: string,
  profile: ProfileType = 'assistant'
): GeminiContent {
  if (profile === 'function_calling_demo') {
    const demoInstruction = `あなたは meeting assistant です。過去の会議を聞かれたら get_past_meeting_summary を呼び出し、それ以外は通常回答します。

【役割】
- ユーザーから過去の会議について質問されたら get_past_meeting_summary 関数を呼び出す
- 関数の結果を踏まえて、わかりやすく回答する
- それ以外の質問には通常通り回答する
- 常に日本語で簡潔に応答する`;

    if (conversationHistory) {
      const text = `${demoInstruction}

【直近の会話履歴】
${conversationHistory}

上記を踏まえて応答してください。`;
      return { parts: [{ text }] };
    }

    return { parts: [{ text: demoInstruction }] };
  }

  if (profile === 'tools_demo') {
    const demoInstruction = `あなたはツール呼び出し機能を持つAIアシスタントです。

【役割】
- 質問に応じて適切なツールを呼び出してください
- 気温や天気などリアルタイム情報が必要な場合は internet_search を使用
- 過去会議の情報が必要な場合は meeting_summary_lookup を使用
- ツールの結果を踏まえて、わかりやすく回答してください
- 日本語で応答してください`;

    if (conversationHistory) {
      const text = `${demoInstruction}

【直近の会話履歴】
${conversationHistory}

上記を踏まえて応答してください。`;
      return { parts: [{ text }] };
    }

    return { parts: [{ text: demoInstruction }] };
  }

  if (profile === 'terminology_helper') {
    const helperInstruction = `あなたは介護サービス会議の「用語解説アシスタント」です。

【役割】
- 会議中に出てくる業界用語・専門用語・略語・難解な表現を新人にも分かるよう簡潔に説明する
- 元発言の要点とともに1〜2文で補足する
- 評価や意見は述べず、中立的にフォローする
- 音声応答は不要、テキストのみで返答する`;

    if (conversationHistory) {
      const text = `${helperInstruction}

【直近の会話履歴】
${conversationHistory}

上記の雰囲気を踏まえ、以降は用語や難しい内容があれば即座に噛み砕いて説明してください。`;
      return { parts: [{ text }] };
    }

    return { parts: [{ text: helperInstruction }] };
  }

  const baseInstruction = `あなたは会議のAIアシスタントです。

【役割】
- 参加者から呼びかけられたので、応答してください
- 簡潔に（30秒以内で）
- 日本語で応答してください
- 補助的な立場を保ってください`;

  if (conversationHistory) {
    const text = `${baseInstruction}

【直近の会話履歴】
${conversationHistory}

上記の会話を踏まえて、適切に応答してください。`;
    return { parts: [{ text }] };
  }

  return { parts: [{ text: baseInstruction }] };
}
