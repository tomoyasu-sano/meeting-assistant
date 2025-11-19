"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseServerClient } from "@/lib/supabase/server";

// 参加者を作成する
export async function createParticipant(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("認証が必要です");
  }

  const display_name = formData.get("display_name") as string;
  const role = formData.get("role") as string;
  const organization = formData.get("organization") as string;
  const notes = formData.get("notes") as string;

  if (!display_name) {
    throw new Error("表示名は必須です");
  }

  const { error } = await supabase.from("participants").insert({
    user_id: user.id,
    display_name,
    role: role || null,
    organization: organization || null,
    notes: notes || null,
  });

  if (error) {
    throw new Error(`参加者の作成に失敗しました: ${error.message}`);
  }

  revalidatePath("/participants");
}

// 参加者を更新する
export async function updateParticipant(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("認証が必要です");
  }

  const id = formData.get("id") as string;
  const display_name = formData.get("display_name") as string;
  const role = formData.get("role") as string;
  const organization = formData.get("organization") as string;
  const notes = formData.get("notes") as string;

  if (!id || !display_name) {
    throw new Error("IDと表示名は必須です");
  }

  const { error } = await supabase
    .from("participants")
    .update({
      display_name,
      role: role || null,
      organization: organization || null,
      notes: notes || null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`参加者の更新に失敗しました: ${error.message}`);
  }

  revalidatePath("/participants");
}

// 参加者を削除する
export async function deleteParticipant(formData: FormData) {
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
    .from("participants")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`参加者の削除に失敗しました: ${error.message}`);
  }

  revalidatePath("/participants");
}
