import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * APIコスト追跡ライブラリ
 * Stage 10: リアルタイムAI統合
 */

export type ServiceType =
  | "google_stt"
  | "openai_realtime_text"
  | "openai_realtime_audio";

export type UsageDetails = {
  audio_minutes?: number;
  tokens_input?: number;
  tokens_output?: number;
};

/**
 * APIコストを計算して記録
 */
export async function trackCost(
  sessionId: string,
  service: ServiceType,
  usageDetails: UsageDetails
): Promise<number> {
  let costUsd = 0;

  switch (service) {
    case "google_stt":
      // Google Speech-to-Text: $0.024/分
      costUsd = (usageDetails.audio_minutes || 0) * 0.024;
      break;

    case "openai_realtime_text":
      // OpenAI Realtime API (テキスト入力)
      // Input: $5 / 1M tokens
      // Output: $200 / 1M tokens (音声出力)
      costUsd =
        ((usageDetails.tokens_input || 0) / 1_000_000) * 5 +
        ((usageDetails.tokens_output || 0) / 1_000_000) * 200;
      break;

    case "openai_realtime_audio":
      // OpenAI Realtime API (音声入力)
      // Input: $100 / 1M tokens (音声)
      // Output: $200 / 1M tokens (音声)
      costUsd =
        ((usageDetails.tokens_input || 0) / 1_000_000) * 100 +
        ((usageDetails.tokens_output || 0) / 1_000_000) * 200;
      break;
  }

  // DBに記録
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("session_costs").insert({
    session_id: sessionId,
    service,
    cost_usd: costUsd,
    usage_details: usageDetails,
  });

  if (error) {
    console.error("Failed to track cost:", error);
  }

  return costUsd;
}

/**
 * セッションの合計コストを取得
 */
export async function getSessionTotalCost(
  sessionId: string
): Promise<number> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_costs")
    .select("cost_usd")
    .eq("session_id", sessionId);

  if (error) {
    console.error("Failed to get session cost:", error);
    return 0;
  }

  return data.reduce((sum, row) => sum + Number(row.cost_usd), 0);
}

/**
 * セッションのコスト詳細を取得
 */
export async function getSessionCostBreakdown(sessionId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_costs")
    .select("*")
    .eq("session_id", sessionId)
    .order("recorded_at", { ascending: true });

  if (error) {
    console.error("Failed to get session cost breakdown:", error);
    return [];
  }

  return data;
}
