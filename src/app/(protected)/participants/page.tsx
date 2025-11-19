import { getTranslations } from 'next-intl/server';
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createParticipant } from "@/actions/participants";
import { ParticipantCardForm } from "./ParticipantCardForm";

type Participant = {
  id: string;
  display_name: string;
  role: string | null;
  organization: string | null;
  notes: string | null;
  voice_profile_id: string | null;
  created_at: string;
};

export default async function ParticipantsPage() {
  const t = await getTranslations('participants');
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // 参加者一覧を取得
  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      {/* ヘッダーセクション */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-200/20 via-pink-200/20 to-indigo-200/20 rounded-full blur-3xl -z-10" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full border border-purple-200/50">
            <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold gradient-text">Participant Management</span>
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
          <h3 className="text-xl font-black text-gray-900">{t('createParticipant')}</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-purple-200 via-pink-200 to-transparent" />
        </div>

        <form action={createParticipant} className="space-y-4">
          <div>
            <label
              htmlFor="display_name"
              className="block text-sm font-bold text-gray-800 mb-2"
            >
              {t('displayNameRequired')}
            </label>
            <input
              type="text"
              id="display_name"
              name="display_name"
              required
              className="w-full rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all"
              placeholder={t('displayNamePlaceholder')}
            />
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-sm font-bold text-gray-800 mb-2"
            >
              {t('role')}
            </label>
            <input
              type="text"
              id="role"
              name="role"
              className="w-full rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all"
              placeholder={t('rolePlaceholder')}
            />
          </div>

          <div>
            <label
              htmlFor="organization"
              className="block text-sm font-bold text-gray-800 mb-2"
            >
              {t('organization')}
            </label>
            <input
              type="text"
              id="organization"
              name="organization"
              className="w-full rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all"
              placeholder={t('organizationPlaceholder')}
            />
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-bold text-gray-800 mb-2"
            >
              {t('notes')}
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all resize-none"
              placeholder={t('notesPlaceholder')}
            />
          </div>

          <button
            type="submit"
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <span className="relative z-10 flex items-center gap-2">
              {t('createParticipant')}
              <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </span>
          </button>
        </form>
      </div>

      {/* 参加者一覧 */}
      <div className="space-y-4 animate-fade-scale" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-black text-gray-900">{t('registeredParticipants')}</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-purple-200 via-pink-200 to-transparent" />
          {participants && participants.length > 0 && (
            <div className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full">
              <span className="text-xs font-bold gradient-text">{participants.length}件</span>
            </div>
          )}
        </div>

        {!participants || participants.length === 0 ? (
          <div className="mesh-card rounded-2xl p-8 text-center minimal-shadow">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full">
              <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 font-medium">{t('noParticipantsYet')}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(participants as Participant[]).map((participant) => (
              <ParticipantCard key={participant.id} participant={participant} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ParticipantCard({ participant }: { participant: Participant }) {
  return (
    <div className="group relative bg-white rounded-2xl p-6 border border-purple-100 minimal-shadow-hover overflow-hidden">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10">
        <div className="mb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors mb-2">
                {participant.display_name}
              </h4>
              {participant.role && (
                <p className="text-sm text-gray-600 font-medium">{participant.role}</p>
              )}
              {participant.organization && (
                <p className="text-sm text-gray-500">
                  {participant.organization}
                </p>
              )}
            </div>
          </div>
          {participant.notes && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-sm text-gray-600">{participant.notes}</p>
            </div>
          )}
        </div>

        {/* 音声登録セクション - 現在未使用 */}
        {/* <div className="mb-4">
          <VoiceRegistrationSection
            participantId={participant.id}
            participantName={participant.display_name}
            hasVoiceProfile={!!participant.voice_profile_id}
          />
        </div> */}

        <div className="pt-4 border-t border-gray-100">
          <ParticipantCardForm participant={participant} />
        </div>

        {/* Bottom gradient accent */}
        <div className="mt-4 h-1 w-0 group-hover:w-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500" />
      </div>
    </div>
  );
}

