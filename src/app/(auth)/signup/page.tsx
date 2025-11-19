import Link from "next/link";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-zinc-900">新規登録</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ログイン用のメールアドレスとパスワードを設定します。
        </p>
        <div className="mt-6">
          <SignupForm />
        </div>
        <p className="mt-6 text-center text-sm text-zinc-600">
          すでにアカウントをお持ちの場合は{" "}
          <Link
            className="font-medium text-indigo-600 hover:text-indigo-500"
            href="/login"
          >
            ログイン
          </Link>
          へ移動してください。
        </p>
      </div>
    </div>
  );
}
