"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let supabaseBrowserClient: SupabaseClient | null = null;

/**
 * ブラウザで利用する Supabase クライアントのシングルトンを生成する。
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (supabaseBrowserClient) {
    return supabaseBrowserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase の公開 URL または公開キーが設定されていません。");
  }

  supabaseBrowserClient = createBrowserClient(url, anonKey);
  return supabaseBrowserClient;
}
