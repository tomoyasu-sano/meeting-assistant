/**
 * API使用料金の計算ユーティリティ
 *
 * 仕様書: /documents/ai_api_inventory.md
 */

// 料金定数（2025年1月時点）
export const PRICING = {
  // Google Cloud Speech-to-Text V2
  stt: {
    chirp3: 0.016, // $/分
    standard: 0.024, // $/分
    withLogging: 0.012, // $/分
  },
  // Google Cloud Text-to-Speech
  tts: {
    neural2: 16.0 / 1_000_000, // $/文字
    standard: 4.0 / 1_000_000, // $/文字
  },
  // Google Translation API V2
  translation: {
    perChar: 20.0 / 1_000_000, // $/文字
  },
  // Google Gemini 2.5 Flash (Vertex AI)
  gemini25Flash: {
    input: 0.075 / 1_000_000, // $/トークン (128K以下)
    output: 0.30 / 1_000_000, // $/トークン (128K以下)
  },
  // Google Gemini Live API (2.0 Flash EXP)
  geminiLive: {
    free: true, // 実験版のため現在無料
  },
  // OpenAI GPT-4o Mini
  openaiGPT4oMini: {
    input: 0.150 / 1_000_000, // $/トークン
    output: 0.600 / 1_000_000, // $/トークン
  },
} as const;

/**
 * 会議セッションの料金計算
 */
export interface MeetingCostParams {
  durationMinutes: number; // セッション時間（分）
  transcriptChars: number; // 文字起こしの文字数
  summaryTokens?: {
    input: number;
    output: number;
  };
  ttsChars?: number; // AI応答の音声合成文字数
  openaiTokens?: {
    // 議論アシスト
    input: number;
    output: number;
  };
}

export function calculateMeetingCosts(params: MeetingCostParams) {
  const costs = {
    stt: params.durationMinutes * PRICING.stt.chirp3, // 1. STT
    tts: (params.ttsChars || 0) * PRICING.tts.neural2, // 2. TTS
    summary: params.summaryTokens // 4. Gemini Summary
      ? params.summaryTokens.input * PRICING.gemini25Flash.input +
        params.summaryTokens.output * PRICING.gemini25Flash.output
      : 0,
    geminiLive: 0, // 5. Gemini Live (無料)
    openai: params.openaiTokens // 6. OpenAI Chat (議論アシスト)
      ? params.openaiTokens.input * PRICING.openaiGPT4oMini.input +
        params.openaiTokens.output * PRICING.openaiGPT4oMini.output
      : 0,
  };

  const total = Object.values(costs).reduce((sum, cost) => sum + cost, 0);

  return {
    breakdown: costs,
    total,
    totalUSD: `$${total.toFixed(4)}`,
    totalJPY: `¥${Math.ceil(total * 150)}`, // 1ドル=150円で概算
  };
}

/**
 * 言語交換セッションの料金計算
 */
export interface LanguageExchangeCostParams {
  durationMinutes: number; // セッション時間（分）
  translationChars: number; // 翻訳した文字数の合計
}

export function calculateLanguageExchangeCosts(
  params: LanguageExchangeCostParams
) {
  const costs = {
    stt: params.durationMinutes * PRICING.stt.chirp3, // 1. STT
    translation: params.translationChars * PRICING.translation.perChar, // 3. Translation
  };

  const total = Object.values(costs).reduce((sum, cost) => sum + cost, 0);

  return {
    breakdown: costs,
    total,
    totalUSD: `$${total.toFixed(4)}`,
    totalJPY: `¥${Math.ceil(total * 150)}`, // 1ドル=150円で概算
  };
}

/**
 * コンソールに料金サマリーを出力
 */
export function logMeetingCostSummary(
  sessionId: string,
  params: MeetingCostParams
) {
  const result = calculateMeetingCosts(params);

  console.log("\n" + "=".repeat(60));
  console.log("💰 会議セッション料金サマリー");
  console.log("=".repeat(60));
  console.log(`📋 セッションID: ${sessionId}`);
  console.log(`⏱️  セッション時間: ${params.durationMinutes.toFixed(1)}分`);
  console.log("-".repeat(60));
  console.log("📊 API使用料金内訳:");
  console.log(
    `  1. STT (文字起こし):        $${result.breakdown.stt.toFixed(4)}`
  );
  console.log(
    `  2. TTS (音声合成):          $${result.breakdown.tts.toFixed(4)}`
  );
  console.log(
    `  4. Gemini (サマリー・評価): $${result.breakdown.summary.toFixed(4)}`
  );
  console.log(
    `  5. Gemini Live (用語解説):  $${result.breakdown.geminiLive.toFixed(4)} (無料)`
  );
  console.log(
    `  6. OpenAI (議論アシスト):   $${result.breakdown.openai.toFixed(4)}`
  );
  console.log("-".repeat(60));
  console.log(`💵 合計: ${result.totalUSD} (約${result.totalJPY})`);
  console.log("=".repeat(60) + "\n");

  return result;
}

/**
 * コンソールに言語交換の料金サマリーを出力
 */
export function logLanguageExchangeCostSummary(
  params: LanguageExchangeCostParams
) {
  const result = calculateLanguageExchangeCosts(params);

  console.log("\n" + "=".repeat(60));
  console.log("💰 言語交換セッション料金サマリー");
  console.log("=".repeat(60));
  console.log(`⏱️  セッション時間: ${params.durationMinutes.toFixed(1)}分`);
  console.log(
    `📝 翻訳文字数: ${params.translationChars.toLocaleString()}文字`
  );
  console.log("-".repeat(60));
  console.log("📊 API使用料金内訳:");
  console.log(
    `  1. STT (文字起こし): $${result.breakdown.stt.toFixed(4)}`
  );
  console.log(
    `  3. Translation (翻訳): $${result.breakdown.translation.toFixed(4)}`
  );
  console.log("-".repeat(60));
  console.log(`💵 合計: ${result.totalUSD} (約${result.totalJPY})`);
  console.log("=".repeat(60) + "\n");

  return result;
}
