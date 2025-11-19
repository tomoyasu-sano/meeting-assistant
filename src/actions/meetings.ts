"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";

import { getSupabaseServerClient } from "@/lib/supabase/server";

// 会議を作成する
export async function createMeeting(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("認証が必要です");
  }

  const category_id = formData.get("category_id") as string;
  const title = formData.get("title") as string;
  const scheduled_at = formData.get("scheduled_at") as string;
  const join_password = formData.get("join_password") as string;
  const participant_ids = formData.getAll("participant_ids") as string[];

  if (!category_id || !title || !scheduled_at) {
    throw new Error("カテゴリ、タイトル、日時は必須です");
  }

  // パスワードのハッシュ化（オプション）
  let join_password_hash = null;
  if (join_password) {
    join_password_hash = crypto
      .createHash("sha256")
      .update(join_password)
      .digest("hex");
  }

  // 会議を作成（ai_output_modeはDBのデフォルト値 "text_audio" を使用）
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      category_id,
      title,
      scheduled_at,
      join_password_hash,
    })
    .select()
    .single();

  if (meetingError || !meeting) {
    throw new Error(`会議の作成に失敗しました: ${meetingError?.message}`);
  }

  // 参加者を追加
  if (participant_ids && participant_ids.length > 0) {
    // 参加者の音声登録状況を確認
    const { data: participants } = await supabase
      .from("participants")
      .select("id, voice_profile_id")
      .in("id", participant_ids);

    const meeting_participants = participant_ids.map((participant_id) => {
      const participant = participants?.find((p) => p.id === participant_id);
      return {
        meeting_id: meeting.id,
        participant_id,
        is_voice_registered: !!participant?.voice_profile_id,
      };
    });

    const { error: participantsError } = await supabase
      .from("meeting_participants")
      .insert(meeting_participants);

    if (participantsError) {
      // 会議は作成されているので、エラーをログに記録するだけ
      console.error("参加者の追加に失敗:", participantsError.message);
    }
  }

  revalidatePath("/meetings");
}

// 会議を更新する
export async function updateMeeting(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("認証が必要です");
  }

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const scheduled_at = formData.get("scheduled_at") as string;
  const status = formData.get("status") as string;

  if (!id || !title || !scheduled_at) {
    throw new Error("ID、タイトル、日時は必須です");
  }

  const { error } = await supabase
    .from("meetings")
    .update({
      title,
      scheduled_at,
      status,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`会議の更新に失敗しました: ${error.message}`);
  }

  revalidatePath("/meetings");
}

// 会議を削除する
export async function deleteMeeting(formData: FormData) {
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

  const { error } = await supabase.from("meetings").delete().eq("id", id);

  if (error) {
    throw new Error(`会議の削除に失敗しました: ${error.message}`);
  }

  revalidatePath("/meetings");
}
