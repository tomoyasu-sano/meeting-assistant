import { getTranslations } from 'next-intl/server';
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MeetingCard } from "./MeetingCard";
import { MeetingForm } from "./MeetingForm";

type Meeting = {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  join_token: string;
  join_password_hash: string | null;
  category_id: string;
  created_at: string;
  category?: {
    title: string;
  };
  meeting_participants: Array<{
    participant_id: string;
    is_voice_registered: boolean;
    participant: {
      display_name: string;
    };
  }>;
};

type Category = {
  id: string;
  title: string;
};

type Participant = {
  id: string;
  display_name: string;
  role: string | null;
};

export default async function MeetingsPage() {
  const t = await getTranslations('meeting');
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // 会議一覧を取得（カテゴリと参加者情報を含む）
  const { data: meetings } = await supabase
    .from("meetings")
    .select(
      `
      *,
      category:categories(title),
      meeting_participants(
        participant_id,
        is_voice_registered,
        participant:participants(display_name)
      )
    `
    )
    .order("scheduled_at", { ascending: false });

  // カテゴリ一覧を取得
  const { data: categories } = await supabase
    .from("categories")
    .select("id, title")
    .order("title");

  // 参加者一覧を取得
  const { data: participants } = await supabase
    .from("participants")
    .select("id, display_name, role")
    .order("display_name");

  return (
    <div className="space-y-6">
      {/* ヘッダーセクション */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 via-indigo-200/20 to-purple-200/20 rounded-full blur-3xl -z-10" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full border border-blue-200/50">
            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold gradient-text">Meeting Management</span>
          </div>

          <h2 className="text-3xl font-black text-gray-900 mb-2">
            {t('management')}
          </h2>
          <p className="text-gray-600">
            {t('description')}
          </p>
        </div>
      </div>

      {/* 新規作成フォーム */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-4 mb-6">
          <h3 className="text-xl font-black text-gray-900">{t('createMeeting')}</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-blue-200 via-indigo-200 to-transparent" />
        </div>

        <MeetingForm
          categories={(categories as Category[] | null) || []}
          participants={(participants as Participant[] | null) || []}
        />
      </div>

      {/* 会議一覧 */}
      <div className="space-y-4 animate-fade-scale" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-black text-gray-900">{t('registeredMeetings')}</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-blue-200 via-indigo-200 to-transparent" />
          {meetings && meetings.length > 0 && (
            <div className="px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full">
              <span className="text-xs font-bold gradient-text">{meetings.length}件</span>
            </div>
          )}
        </div>

        {!meetings || meetings.length === 0 ? (
          <div className="mesh-card rounded-2xl p-8 text-center minimal-shadow">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full">
              <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 font-medium">{t('noMeetingsYet')}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(meetings as Meeting[]).map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
