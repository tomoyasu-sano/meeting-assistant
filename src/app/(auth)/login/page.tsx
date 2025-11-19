import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from 'next-intl/server';

import { getSupabaseServerClient } from "@/lib/supabase/server";

import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const t = await getTranslations('auth');
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
        <h1 className="text-2xl font-semibold text-zinc-900">{t('login')}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {t('loginPrompt')}
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
        {/* MVP版では新規登録を制限 */}
        {/* <p className="mt-6 text-center text-sm text-zinc-600">
          {t('noAccount')}{" "}
          <Link
            className="font-medium text-indigo-600 hover:text-indigo-500"
            href="/signup"
          >
            {t('signup')}
          </Link>
          {t('toSignup')}
        </p> */}
      </div>
    </div>
  );
}
