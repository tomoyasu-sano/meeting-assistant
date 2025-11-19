import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/update-password
 * 新しいパスワードに更新する
 */
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json(
        { error: "新しいパスワードが必要です" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "パスワードは6文字以上である必要があります" },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();

    // パスワードを更新
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error("Password update error:", error);
      return NextResponse.json(
        { error: "パスワードの更新に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "パスワードが正常に更新されました",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "予期しないエラーが発生しました" },
      { status: 500 }
    );
  }
}
