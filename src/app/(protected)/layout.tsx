import { redirect } from "next/navigation";
import { getTranslations } from 'next-intl/server';

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LayoutClient } from "./_components/LayoutClient";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const t = await getTranslations();

  const navigation = [
    { href: "/dashboard", label: t('navigation.dashboard') },
    { href: "/categories", label: t('navigation.categories') },
    { href: "/participants", label: t('navigation.participants') },
    { href: "/meetings", label: t('navigation.meetings') },
    { href: "/meeting-index", label: t('navigation.meetingList') },
    { href: "/language-exchange", label: t('navigation.languageExchange') },
    { href: "/settings", label: t('navigation.settings') },
  ];

  return (
    <LayoutClient
      navigation={navigation}
      brandName={t('common.brandName')}
      userEmail={user.email || ""}
    >
      {children}
    </LayoutClient>
  );
}
