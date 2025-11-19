import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/reset-password
 * パスワードリセット用のメールを送信する
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスが必要です" },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();

    // パスワードリセット用のメールを送信
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password`,
    });

    if (error) {
      console.error("Password reset error:", error);
      return NextResponse.json(
        { error: "パスワードリセットメールの送信に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "パスワードリセット用のメールを送信しました",
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "予期しないエラーが発生しました" },
      { status: 500 }
    );
  }
}
