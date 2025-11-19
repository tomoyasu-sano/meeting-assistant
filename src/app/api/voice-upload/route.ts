import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    // ユーザー認証確認
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    // FormDataを取得
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const participantId = formData.get("participantId") as string;
    const durationSeconds = formData.get("durationSeconds") as string;

    if (!file || !participantId) {
      return NextResponse.json(
        { error: "ファイルと参加者IDは必須です" },
        { status: 400 }
      );
    }

    // 参加者が自分のものか確認
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id, display_name")
      .eq("id", participantId)
      .eq("user_id", user.id)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "参加者が見つかりません" },
        { status: 404 }
      );
    }

    // ファイル名を生成（user_id/participant_id_timestamp.webm）
    const timestamp = Date.now();
    const filename = `${participantId}_${timestamp}.webm`;
    const storagePath = `${user.id}/${filename}`;

    // Supabase Storageにアップロード
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("voice-samples")
      .upload(storagePath, fileBuffer, {
        contentType: "audio/webm",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storageアップロードエラー:", uploadError);
      return NextResponse.json(
        { error: `アップロードに失敗しました: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // voice_profilesテーブルにレコードを作成
    const { data: voiceProfile, error: voiceProfileError } = await supabase
      .from("voice_profiles")
      .insert({
        participant_id: participantId,
        feature_blob_path: uploadData.path,
        status: "registered",
        file_size_bytes: file.size,
        duration_seconds: parseFloat(durationSeconds) || null,
      })
      .select()
      .single();

    if (voiceProfileError || !voiceProfile) {
      console.error("voice_profiles作成エラー:", voiceProfileError);
      // Storageからファイルを削除（ロールバック）
      await supabase.storage.from("voice-samples").remove([storagePath]);

      return NextResponse.json(
        { error: `音声プロファイルの作成に失敗しました: ${voiceProfileError?.message}` },
        { status: 500 }
      );
    }

    // participantsテーブルのvoice_profile_idを更新
    const { error: updateError } = await supabase
      .from("participants")
      .update({ voice_profile_id: voiceProfile.id })
      .eq("id", participantId);

    if (updateError) {
      console.error("participants更新エラー:", updateError);
      // エラーログは記録するが、ここでは失敗としない（voice_profileは作成済み）
    }

    return NextResponse.json(
      {
        success: true,
        voiceProfile: {
          id: voiceProfile.id,
          path: voiceProfile.feature_blob_path,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("予期しないエラー:", error);
    return NextResponse.json(
      { error: "予期しないエラーが発生しました" },
      { status: 500 }
    );
  }
}
