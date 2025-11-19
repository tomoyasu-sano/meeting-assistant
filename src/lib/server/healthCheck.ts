import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Supabase への接続状況を確認し、バケット一覧の取得結果を返す。
 */
export async function fetchSupabaseHealth() {
  const { data, error } = await supabaseAdmin.storage.listBuckets();

  if (error) {
    return {
      ok: false,
      message: `Supabase 接続に失敗しました: ${error.message}`,
    };
  }

  return {
    ok: true,
    message: `Supabase 接続に成功しました。バケット数: ${data.length}`,
  };
}
