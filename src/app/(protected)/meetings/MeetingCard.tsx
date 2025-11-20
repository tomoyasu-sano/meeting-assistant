"use client";

import { useTranslations } from 'next-intl';
import Link from "next/link";
import { updateMeeting, deleteMeeting } from "@/actions/meetings";

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

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const t = useTranslations();
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

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-zinc-900">
            {meeting.title}
          </h4>
          <p className="mt-1 text-sm text-zinc-600">
            {t('meeting.categoryColon')}{meeting.category?.title || t('common.notSet')}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {t('meeting.scheduledDateTimeColon')}{formattedDate}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[meeting.status] || "bg-gray-100 text-gray-800"}`}
        >
          {t(`meeting.status.${meeting.status}` as any) || meeting.status}
        </span>
      </div>

      {/* 参加者一覧 */}
      {meeting.meeting_participants &&
        meeting.meeting_participants.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-zinc-700">{t('meeting.participantsColon')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {meeting.meeting_participants.map((mp) => (
                <span
                  key={mp.participant_id}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700"
                >
                  {mp.participant.display_name}
                  {mp.is_voice_registered && (
                    <span className="text-green-600" title={t('participants.voiceRegistered')}>
                      🎤
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

      {/* 参加リンク - マスク中（会議詳細ページで共有するため不要） */}
      {false && (
      <div className="mb-4 rounded-lg bg-zinc-50 p-3">
        <p className="text-xs font-medium text-zinc-700">{t('meeting.joinToken')}</p>
        <code className="mt-1 block break-all text-xs text-zinc-600">
          {meeting.join_token}
        </code>
        {meeting.join_password_hash && (
          <p className="mt-2 text-xs text-zinc-500">
            {t('meeting.passwordProtected')}
          </p>
        )}
      </div>
      )}

      {/* アクションボタン */}
      <div className="mb-4 flex gap-2">
        <Link
          href={`/meetings/${meeting.id}`}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
        >
          {t('meeting.viewDetails')}
        </Link>
        <Link
          href={`/meetings/${meeting.id}/live`}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-green-700"
        >
          {t('meeting.startLiveSession')}
        </Link>
      </div>

      {/* 編集・削除フォーム */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700">
          {t('meeting.editDelete')}
        </summary>
        <form action={updateMeeting} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={meeting.id} />

          <div>
            <label
              htmlFor={`title-${meeting.id}`}
              className="block text-sm font-medium text-zinc-700"
            >
              {t('meeting.titleLabel')}
            </label>
            <input
              type="text"
              id={`title-${meeting.id}`}
              name="title"
              defaultValue={meeting.title}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor={`scheduled_at-${meeting.id}`}
              className="block text-sm font-medium text-zinc-700"
            >
              {t('meeting.scheduledDateTime')}
            </label>
            <input
              type="datetime-local"
              id={`scheduled_at-${meeting.id}`}
              name="scheduled_at"
              defaultValue={meeting.scheduled_at.slice(0, 16)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor={`status-${meeting.id}`}
              className="block text-sm font-medium text-zinc-700"
            >
              {t('meeting.statusLabel')}
            </label>
            <select
              id={`status-${meeting.id}`}
              name="status"
              defaultValue={meeting.status}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="scheduled">{t('meeting.status.scheduled')}</option>
              <option value="in_progress">{t('meeting.status.inProgress')}</option>
              <option value="completed">{t('meeting.status.completed')}</option>
              <option value="cancelled">{t('meeting.status.cancelled')}</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {t('common.update')}
            </button>
            <button
              type="submit"
              formAction={deleteMeeting}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {t('common.delete')}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
