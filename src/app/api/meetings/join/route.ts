import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import crypto from "crypto";

/**
 * トークンベースで会議情報を取得するAPI
 * 認証不要（RLSをバイパス）
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");
  const password = searchParams.get("password");

  if (!token) {
    return NextResponse.json(
      { error: "トークンが指定されていません" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServiceClient();

  // トークンで会議を検索（RLSバイパス）
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select(
      `
      id,
      title,
      scheduled_at,
      status,
      join_password_hash,
      category:categories(title)
    `
    )
    .eq("join_token", token)
    .single();

  if (error || !meeting) {
    return NextResponse.json(
      { error: "会議が見つかりません" },
      { status: 404 }
    );
  }

  // パスワード保護がある場合、パスワードを検証
  if (meeting.join_password_hash) {
    if (!password) {
      return NextResponse.json(
        { error: "password_required", passwordRequired: true },
        { status: 401 }
      );
    }

    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    if (hashedPassword !== meeting.join_password_hash) {
      return NextResponse.json(
        { error: "invalid_password", passwordRequired: true },
        { status: 401 }
      );
    }
  }

  // パスワードハッシュは返さない（セキュリティ）
  const { join_password_hash, ...meetingData } = meeting;

  return NextResponse.json({
    meeting: meetingData,
    hasPassword: !!meeting.join_password_hash,
  });
}
