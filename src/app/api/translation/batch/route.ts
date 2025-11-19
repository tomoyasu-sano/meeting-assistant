import { NextRequest, NextResponse } from "next/server";
import { v2 } from "@google-cloud/translate";
import path from "path";

/**
 * POST /api/translation/batch
 * テキストの言語を判定し、指定された言語に翻訳する
 *
 * Body:
 * {
 *   text: string;           // 翻訳するテキスト
 *   targetLanguages: string[]; // 翻訳先言語コード (例: ["en", "ja", "ko"])
 * }
 *
 * Response:
 * {
 *   detectedLanguage: string; // 検出された言語コード
 *   translations: {
 *     [languageCode: string]: string; // 言語コードごとの翻訳結果
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  console.log("[Translation Batch] ========== NEW REQUEST ==========");

  try {
    const { text, targetLanguages } = await request.json();
    console.log("[Translation Batch] Request body parsed:", {
      text,
      targetLanguages,
      textLength: text?.length,
    });

    if (!text || !targetLanguages || !Array.isArray(targetLanguages)) {
      console.error("[Translation Batch] ❌ Invalid request body", {
        hasText: !!text,
        hasTargetLanguages: !!targetLanguages,
        isArray: Array.isArray(targetLanguages),
      });
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Google Cloud Translation v2 クライアントを初期化
    const credentialsPath = path.resolve(process.cwd(), "google-credentials.json");
    console.log("[Translation Batch] Using credentials from:", credentialsPath);

    // 認証情報ファイルの存在確認
    const fs = require('fs');
    if (!fs.existsSync(credentialsPath)) {
      console.error("[Translation Batch] ❌ Credentials file not found:", credentialsPath);
      return NextResponse.json(
        { error: "Credentials file not found" },
        { status: 500 }
      );
    }

    // 認証情報ファイルからプロジェクトIDを読み取る
    let projectId = "unknown";
    try {
      const credentialsContent = fs.readFileSync(credentialsPath, 'utf-8');
      const credentials = JSON.parse(credentialsContent);
      projectId = credentials.project_id || "unknown";
    } catch (err) {
      console.error("[Translation Batch] ⚠️  Could not read project_id from credentials:", err);
    }

    console.log("[Translation Batch] Initializing Translation client...", {
      projectId,
      credentialsPath,
    });

    const translate = new v2.Translate({
      keyFilename: credentialsPath,
    });

    console.log("[Translation Batch] ✅ Translation client initialized", {
      projectId,
      apiEnabled: "Cloud Translation API",
    });

    console.log("[Translation Batch] Processing translation request", {
      textLength: text.length,
      targetLanguages,
      text,
    });

    // 言語検出
    console.log("[Translation Batch] Starting language detection...");
    let detection;
    try {
      [detection] = await translate.detect(text);
      console.log("[Translation Batch] Detection result:", detection);
    } catch (detectError) {
      console.error("[Translation Batch] ❌ Language detection failed:", {
        error: detectError,
        message: detectError instanceof Error ? detectError.message : "Unknown error",
        stack: detectError instanceof Error ? detectError.stack : undefined,
      });
      throw detectError;
    }

    const detectedLanguage = Array.isArray(detection)
      ? detection[0].language
      : detection.language;

    console.log("[Translation Batch] ✅ Detected language:", detectedLanguage);

    // 翻訳処理（並列実行）
    const translations: { [languageCode: string]: string } = {};

    console.log("[Translation Batch] Starting translations...", {
      detectedLanguage,
      targetLanguages,
    });

    await Promise.all(
      targetLanguages.map(async (targetLang) => {
        console.log(`[Translation Batch] Processing ${targetLang}...`);

        // 検出された言語と同じ言語への翻訳はスキップ
        if (targetLang === detectedLanguage) {
          translations[targetLang] = text; // 原文をそのまま使用
          console.log(`[Translation Batch] ⏭️  Skipping translation to ${targetLang} (same as source)`);
          return;
        }

        try {
          console.log(`[Translation Batch] Calling translate API for ${targetLang}...`);
          const [translation] = await translate.translate(text, {
            from: detectedLanguage,
            to: targetLang,
          });

          translations[targetLang] = translation;

          console.log(`[Translation Batch] ✅ Translated to ${targetLang}:`, {
            original: text,
            translated: translation,
            textLength: translation.length,
          });
        } catch (error) {
          console.error(`[Translation Batch] ❌ Failed to translate to ${targetLang}:`, {
            error,
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          });
          translations[targetLang] = `[Translation Error]`;
        }
      })
    );

    console.log("[Translation Batch] All translations completed:", translations);

    const response = {
      detectedLanguage,
      translations,
    };

    console.log("[Translation Batch] ✅ ========== SUCCESS ==========");
    console.log("[Translation Batch] ✅ Project ID:", projectId);
    console.log("[Translation Batch] ✅ Detected Language:", detectedLanguage);
    console.log("[Translation Batch] ✅ Target Languages:", targetLanguages);
    console.log("[Translation Batch] ✅ Original Text:", text);
    console.log("[Translation Batch] ✅ Translations:", translations);
    console.log("[Translation Batch] ✅ Response:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Translation Batch] ========== ERROR OCCURRED ==========");

    // プロジェクトIDを取得（エラー時でも表示）
    let errorProjectId = "unknown";
    try {
      const credentialsPath = path.resolve(process.cwd(), "google-credentials.json");
      const fs = require('fs');
      if (fs.existsSync(credentialsPath)) {
        const credentialsContent = fs.readFileSync(credentialsPath, 'utf-8');
        const credentials = JSON.parse(credentialsContent);
        errorProjectId = credentials.project_id || "unknown";
      }
    } catch (err) {
      // エラー取得失敗は無視
    }

    console.error("[Translation Batch] ❌ Project ID:", errorProjectId);
    console.error("[Translation Batch] ❌ Error:", error);
    console.error("[Translation Batch] ❌ Error type:", typeof error);
    console.error("[Translation Batch] ❌ Error name:", error instanceof Error ? error.name : "N/A");
    console.error("[Translation Batch] ❌ Error message:", error instanceof Error ? error.message : "Unknown error");
    console.error("[Translation Batch] ❌ Error stack:", error instanceof Error ? error.stack : "N/A");

    // HTTP エラーコードを表示（403などを確認）
    if (error && typeof error === 'object' && 'code' in error) {
      console.error("[Translation Batch] ❌ HTTP Status Code:", (error as any).code);
    }

    if (error && typeof error === 'object') {
      console.error("[Translation Batch] ❌ Error object keys:", Object.keys(error));
      console.error("[Translation Batch] ❌ Full error object:", JSON.stringify(error, null, 2));
    }

    const errorResponse = {
      error: "Translation failed",
      details: error instanceof Error ? error.message : "Unknown error",
      type: error instanceof Error ? error.name : typeof error,
      projectId: errorProjectId,
    };

    console.error("[Translation Batch] ❌ Sending error response:", errorResponse);

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
