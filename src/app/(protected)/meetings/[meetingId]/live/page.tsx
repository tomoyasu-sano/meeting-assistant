import { getTranslations } from 'next-intl/server';
import { getSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveSessionContainer } from "@/components/LiveSessionContainer";
import { LiveSessionPanel } from "@/components/LiveSessionPanel";

type Meeting = {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  category: {
    title: string;
    industries: string[] | null;
  };
  meeting_participants: Array<{
    participant: {
      display_name: string;
    };
  }>;
};

export default async function LiveSessionPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;
  const t = await getTranslations('navigation');
  const supabase = await getSupabaseServerClient();

  // 会議情報を取得
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select(
      `
      *,
      category:categories(title, industries),
      meeting_participants(
        participant:participants(display_name)
      )
    `
    )
    .eq("id", meetingId)
    .single();

  if (error || !meeting) {
    notFound();
  }

  const meetingData = meeting as Meeting;

  return (
    <LiveSessionContainer>
      <div className="flex min-h-screen flex-col">
        {/* ヘッダー */}
        <header className="border-b border-orange-100 bg-gradient-to-r from-white via-orange-50/30 to-amber-50/30 backdrop-blur-sm">
          <div className="mx-auto flex max-w-none items-start px-4 py-2">
            <Link
              href={`/meetings/${meetingId}`}
              className="rounded-lg border border-orange-200 bg-white px-2.5 py-1 text-xs font-bold text-orange-700 hover:bg-orange-50 transition-all"
            >
              {t('backToDetails')}
            </Link>
            <div className="ml-3">
              <h1 className="text-base font-bold text-gray-900">
                {meetingData.title}
              </h1>
              <p className="text-xs font-medium text-orange-600">
                {meetingData.category.title}
              </p>
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1 bg-gradient-to-br from-orange-50/30 via-amber-50/20 to-white">
          <LiveSessionPanel
            meetingId={meetingId}
            industries={meetingData.category.industries || []}
          />
        </main>
      </div>
    </LiveSessionContainer>
  );
}
