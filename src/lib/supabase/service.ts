import { createClient } from "@supabase/supabase-js";

/**
 * Service Role Key を使用した Supabase クライアント
 * RLS をバイパスして全てのデータにアクセス可能
 * セキュリティ上の理由から、サーバーサイドのみで使用すること
 */
export function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase の公開 URL または Service Role Key が設定されていません。"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
