"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseServerClient } from "@/lib/supabase/server";

// カテゴリを作成する
export async function createCategory(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("認証が必要です");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const color_code = formData.get("color_code") as string;
  const industriesRaw = formData.get("industries") as string;

  if (!title) {
    throw new Error("タイトルは必須です");
  }

  // 業界タグをJSON配列からパース
  let industries: string[] = [];
  if (industriesRaw) {
    try {
      industries = JSON.parse(industriesRaw);
    } catch {
      industries = [];
    }
  }

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    title,
    description: description || null,
    color_code: color_code || null,
    industries,
  });

  if (error) {
    throw new Error(`カテゴリの作成に失敗しました: ${error.message}`);
  }

  revalidatePath("/categories");
}

// カテゴリを更新する
export async function updateCategory(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("認証が必要です");
  }

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const color_code = formData.get("color_code") as string;
  const industriesRaw = formData.get("industries") as string;

  if (!id || !title) {
    throw new Error("IDとタイトルは必須です");
  }

  // 業界タグをJSON配列からパース
  let industries: string[] = [];
  if (industriesRaw) {
    try {
      industries = JSON.parse(industriesRaw);
    } catch {
      industries = [];
    }
  }

  const { error } = await supabase
    .from("categories")
    .update({
      title,
      description: description || null,
      color_code: color_code || null,
      industries,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`カテゴリの更新に失敗しました: ${error.message}`);
  }

  revalidatePath("/categories");
}

// カテゴリを削除する
export async function deleteCategory(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("認証が必要です");
  }

  const id = formData.get("id") as string;

  if (!id) {
    throw new Error("IDは必須です");
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`カテゴリの削除に失敗しました: ${error.message}`);
  }

  revalidatePath("/categories");
}
