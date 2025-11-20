import { getTranslations } from 'next-intl/server';
import { getSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { SessionItem } from "@/components/SessionItem";

type Meeting = {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  join_token: string;
  join_password_hash: string | null;
  category_id: string;
  created_at: string;
  ai_output_mode: "text" | "audio" | "text_audio";
  category: {
    id: string;
    title: string;
  };
  meeting_participants: Array<{
    participant_id: string;
    is_voice_registered: boolean;
    participant: {
      id: string;
      display_name: string;
      role: string | null;
    };
  }>;
};

type Session = {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  created_at: string;
  transcripts: Array<{
    id: string;
    text: string;
    created_at: string;
    start_time: number | null;
    participant: {
      display_name: string;
    } | null;
    speaker_label: string | null;
  }>;
};

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;
  const t = await getTranslations();
  const supabase = await getSupabaseServerClient();

  // 会議情報を取得
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select(
      `
      *,
      category:categories(id, title),
      meeting_participants(
        participant_id,
        is_voice_registered,
        participant:participants(id, display_name, role)
      )
    `
    )
    .eq("id", meetingId)
    .single();

  if (error || !meeting) {
    notFound();
  }

  // セッション履歴を取得（文字起こし付き）
  const { data: sessions } = await supabase
    .from("meeting_sessions")
    .select(
      `
      *,
      transcripts (
        id,
        text,
        created_at,
        start_time,
        speaker_label,
        participant:participants(display_name)
      )
    `
    )
    .eq("meeting_id", meetingId)
    .order("started_at", { ascending: false });

  const scheduledDate = new Date(meeting.scheduled_at);
  const formattedDate = scheduledDate.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800",
    in_progress: "bg-green-100 text-green-800",
    completed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/meetings/join/${meeting.join_token}`
      : `/meetings/join/${meeting.join_token}`;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-200/20 via-blue-200/20 to-indigo-200/20 rounded-full blur-3xl -z-10" />

        <div className="relative flex items-center gap-4">
          <Link
            href="/meetings"
            className="rounded-xl border border-cyan-200 bg-white px-5 py-2.5 text-sm font-bold text-cyan-700 hover:bg-cyan-50 transition-all"
          >
            {t('navigation.backToList')}
          </Link>
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-2 bg-gradient-to-r from-cyan-100 to-blue-100 rounded-full border border-cyan-200/50">
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold gradient-text">{t('meeting.details')}</span>
            </div>
          </div>
          <Link
            href={`/meetings/${meetingId}/live`}
            className="group rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-2.5 text-sm font-bold text-white hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/50 transition-all"
          >
            <span className="flex items-center gap-2">
              {t('meeting.startLiveSession')}
              <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>
      </div>

      {/* 会議情報 */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale overflow-hidden relative" style={{ animationDelay: '0.1s' }}>
        <div className="absolute top-0 left-0 w-48 h-48 bg-gradient-to-br from-cyan-200/10 via-blue-200/10 to-indigo-200/10 rounded-full blur-3xl -z-10" />

        <div className="relative mb-6 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-black text-gray-900 mb-3">
              {meeting.title}
            </h2>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200/50">
                <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="text-xs font-bold text-cyan-700">
                  {t('meeting.categoryColon')}{meeting.category.title}
                </span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50">
                <svg className="h-3.5 w-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-bold text-blue-700">
                  {formattedDate}
                </span>
              </div>
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-bold border ${
              meeting.status === 'scheduled' ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 text-blue-700' :
              meeting.status === 'in_progress' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700' :
              meeting.status === 'completed' ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 text-gray-700' :
              'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 text-red-700'
            }`}
          >
            {t(`meeting.status.${meeting.status}` as any) || meeting.status}
          </span>
        </div>

        {/* 参加者一覧 */}
        <div className="mb-6">
          <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></div>
            {t('meeting.participants')}
          </h3>
          {meeting.meeting_participants &&
          meeting.meeting_participants.length > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {meeting.meeting_participants.map((mp: Meeting["meeting_participants"][0]) => (
                <div
                  key={mp.participant_id}
                  className="group flex items-center gap-3 rounded-xl border border-cyan-100 bg-gradient-to-r from-cyan-50/50 to-blue-50/50 p-4 hover:shadow-md transition-all"
                >
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">
                      {mp.participant.display_name}
                    </p>
                    {mp.participant.role && (
                      <p className="text-xs text-cyan-600 font-medium mt-0.5">
                        {mp.participant.role}
                      </p>
                    )}
                  </div>
                  {mp.is_voice_registered && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-cyan-100 to-blue-100 rounded-lg border border-cyan-200/50">
                      <span
                        className="text-base"
                        title={t('participants.voiceRegistered')}
                        aria-label={t('participants.voiceRegistered')}
                      >
                        🎤
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500 font-medium">{t('meeting.noParticipantsRegistered')}</p>
          )}
        </div>

        {/* 参加リンク - 現在未使用 */}
        {/* <div className="mb-6">
          <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            {t('meeting.joinLink')}
          </h3>
          <div className="mt-3 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border border-blue-100 p-5">
            <MaskedToken
              token={meeting.join_token}
              copySuccessMessage={t('common.copyComplete')}
            />
            {meeting.join_password_hash && (
              <p className="mt-3 text-xs text-blue-600 font-medium">
                {t('meeting.passwordProtectedNote')}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-600 font-medium">
              {t('meeting.joinTokenNote')}
            </p>
          </div>
        </div> */}

        {/* AI出力モード設定 - 現在未使用（テキストのみ固定） */}
        {/* <div className="mb-6">
          <AIOutputModeSelector
            meetingId={meeting.id}
            initialMode={meeting.ai_output_mode || "text_audio"}
          />
        </div> */}

        {/* 閲覧専用リンク */}
        <div>
          <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
            {t('meeting.viewOnlyUrl')}
          </h3>
          <div className="mt-3 rounded-xl bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border border-indigo-100 p-5">
            <div className="flex items-center gap-3">
              <code className="flex-1 break-all text-sm font-mono text-indigo-700 bg-white px-3 py-2 rounded-lg">
                {`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3500"}/meetings/join/${meeting.join_token}`}
              </code>
              <CopyButton
                text={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3500"}/meetings/join/${meeting.join_token}`}
                successMessage={t('common.urlCopied')}
              />
            </div>
            <p className="mt-3 text-xs text-gray-600 font-medium">
              {t('meeting.shareUrlNote')}
            </p>
          </div>
        </div>
      </div>

      {/* セッション履歴と文字起こし */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale overflow-hidden relative" style={{ animationDelay: '0.2s' }}>
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-br from-cyan-200/10 via-blue-200/10 to-indigo-200/10 rounded-full blur-3xl -z-10" />

        <div className="relative mb-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-100 to-blue-100 rounded-full border border-cyan-200/50">
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold gradient-text">Session History</span>
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            {t('meeting.sessionHistory')}
          </h2>
          <p className="text-sm text-gray-600">
            {t('meeting.sessionHistoryNote')}
          </p>
        </div>
        {sessions && sessions.length > 0 ? (
          <div className="space-y-4">
            {(sessions as Session[]).map((session, index) => (
              <SessionItem
                key={session.id}
                session={session}
                isLatest={index === 0}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 text-center py-12 bg-gradient-to-br from-cyan-50/30 to-blue-50/30 rounded-2xl border border-cyan-100">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full">
              <svg className="h-8 w-8 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 font-medium">
              {t('meeting.noSessionsYet')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
