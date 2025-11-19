import { getTranslations } from 'next-intl/server';
import { getSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const supabase = await getSupabaseServerClient();

  // 認証確認
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // 最近の会議セッションを取得（最新5件）
  const { data: recentSessions } = await supabase
    .from("meeting_sessions")
    .select(`
      id,
      started_at,
      ended_at,
      status,
      meeting:meetings(
        id,
        title,
        category:categories!inner(user_id)
      )
    `)
    .eq("meetings.categories.user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(5);

  const sessions = recentSessions?.filter(s => s.meeting) || [];

  return (
    <div className="space-y-6">
      {/* ウェルカムセクション - Mesh Gradient Hero */}
      <section className="mesh-card rounded-3xl p-8 sm:p-12 minimal-shadow animate-fade-scale overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-200/30 via-purple-200/30 to-pink-200/30 rounded-full blur-3xl -z-10 animate-[mesh-float_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-blue-200/30 via-indigo-200/30 to-purple-200/30 rounded-full blur-3xl -z-10 animate-[mesh-float_25s_ease-in-out_infinite_reverse]" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full border border-indigo-200/50">
            <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold gradient-text">Welcome Dashboard</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-black mb-4 tracking-tight leading-tight">
            <span className="gradient-text">{t('title')}</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
            {t('description')}
          </p>

          {/* Decorative elements */}
          <div className="mt-8 flex gap-2">
            <div className="h-1 w-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
            <div className="h-1 w-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
            <div className="h-1 w-4 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full" />
          </div>
        </div>
      </section>

      {/* クイックアクション - Minimal Cards with Subtle Borders */}
      <section className="mesh-card rounded-3xl p-6 sm:p-8 minimal-shadow animate-fade-scale" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-2xl font-black text-gray-900">{t('quickActions')}</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 via-purple-200 to-transparent" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* New Meeting Card */}
          <Link
            href="/meetings"
            className="group relative bg-white rounded-2xl p-6 border border-indigo-100 minimal-shadow-hover cursor-pointer overflow-hidden"
          >
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0 translate-x-2">
                  <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('newMeeting')}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{t('newMeetingDescription')}</p>

              <div className="mt-4 h-1 w-0 group-hover:w-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" />
            </div>
          </Link>

          {/* Language Exchange Card */}
          <Link
            href="/language-exchange"
            className="group relative bg-white rounded-2xl p-6 border border-purple-100 minimal-shadow-hover cursor-pointer overflow-hidden"
          >
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0 translate-x-2">
                  <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('startLanguageExchange')}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{t('startLanguageExchangeDescription')}</p>

              <div className="mt-4 h-1 w-0 group-hover:w-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500" />
            </div>
          </Link>
        </div>
      </section>

      {/* 最近のアクティビティ - Minimal Timeline Style */}
      <section className="mesh-card rounded-3xl p-6 sm:p-8 minimal-shadow animate-fade-scale" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-2xl font-black text-gray-900">{t('recentActivity')}</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 via-purple-200 to-transparent" />
          {sessions.length > 0 && (
            <div className="px-3 py-1 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full">
              <span className="text-xs font-bold gradient-text">{sessions.length}件</span>
            </div>
          )}
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noRecentActivity')}</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session: any) => {
              const startedAt = new Date(session.started_at);
              const endedAt = session.ended_at ? new Date(session.ended_at) : null;
              const duration = endedAt
                ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)
                : 0;

              return (
                <Link
                  key={session.id}
                  href={`/meetings/${session.meeting.id}`}
                  className="group flex items-center gap-5 p-5 bg-white rounded-xl border border-gray-100 minimal-shadow-hover cursor-pointer"
                >
                  <div className="relative flex-shrink-0">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-white rounded-full ${
                      session.status === 'ended' ? 'bg-green-500' : 'bg-yellow-400 animate-pulse'
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
                      {session.meeting.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        {startedAt.toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <span>
                        {startedAt.toLocaleTimeString('ja-JP', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {duration > 0 && (
                        <>
                          <span className="w-1 h-1 bg-gray-300 rounded-full" />
                          <span>{duration}{t('minutes')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-xs font-bold rounded-lg ${
                      session.status === 'ended'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                        : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white'
                    }`}>
                      {session.status === 'ended' ? t('completed') : t('inProgress')}
                    </span>
                    <svg className="h-5 w-5 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer Accent */}
      <div className="flex justify-center items-center gap-2 py-4">
        <div className="h-1 w-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" />
        <div className="h-1 w-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
        <div className="h-1 w-1 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
}
