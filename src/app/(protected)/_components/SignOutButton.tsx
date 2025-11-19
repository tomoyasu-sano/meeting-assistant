"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const t = useTranslations('auth');
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  };

  return (
    <button
      className="self-start rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={handleSignOut}
      disabled={isPending}
      type="button"
    >
      {isPending ? t('signingOut') : t('signOut')}
    </button>
  );
}
