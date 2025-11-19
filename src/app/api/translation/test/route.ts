import { NextResponse } from "next/server";
import { v2 } from "@google-cloud/translate";
import path from "path";

/**
 * GET /api/translation/test
 * Translation API接続テスト
 */
export async function GET() {
  console.log("[Translation Test] ========== TEST REQUEST ==========");

  try {
    const credentialsPath = path.resolve(process.cwd(), "google-credentials.json");
    console.log("[Translation Test] Credentials path:", credentialsPath);

    // ファイルの存在確認
    const fs = require('fs');
    const fileExists = fs.existsSync(credentialsPath);
    console.log("[Translation Test] Credentials file exists:", fileExists);

    if (!fileExists) {
      return NextResponse.json({
        success: false,
        error: "Credentials file not found",
        credentialsPath,
      });
    }

    // Translation client初期化
    console.log("[Translation Test] Initializing Translation client...");
    const translate = new v2.Translate({
      keyFilename: credentialsPath,
    });

    // 簡単なテスト翻訳
    console.log("[Translation Test] Testing translation...");
    const testText = "こんにちは";
    const [translation] = await translate.translate(testText, "en");

    console.log("[Translation Test] ✅ Test successful:", {
      original: testText,
      translated: translation,
    });

    return NextResponse.json({
      success: true,
      message: "Translation API is working",
      test: {
        original: testText,
        translated: translation,
      },
      credentialsPath,
    });
  } catch (error) {
    console.error("[Translation Test] ❌ Error:", error);
    console.error("[Translation Test] ❌ Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      type: error instanceof Error ? error.name : typeof error,
    }, { status: 500 });
  }
}
