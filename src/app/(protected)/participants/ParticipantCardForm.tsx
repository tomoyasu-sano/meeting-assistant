"use client";

import { useTranslations } from 'next-intl';
import { updateParticipant, deleteParticipant } from "@/actions/participants";

type Participant = {
  id: string;
  display_name: string;
  role: string | null;
  organization: string | null;
  notes: string | null;
  voice_profile_id: string | null;
  created_at: string;
};

export function ParticipantCardForm({ participant }: { participant: Participant }) {
  const t = useTranslations();

  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700">
        {t('common.edit')} ・ {t('common.delete')}
      </summary>
      <form action={updateParticipant} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={participant.id} />

        <div>
          <label
            htmlFor={`display_name-${participant.id}`}
            className="block text-sm font-medium text-zinc-700"
          >
            {t('participants.displayNameRequired')}
          </label>
          <input
            type="text"
            id={`display_name-${participant.id}`}
            name="display_name"
            defaultValue={participant.display_name}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor={`role-${participant.id}`}
            className="block text-sm font-medium text-zinc-700"
          >
            {t('participants.role')}
          </label>
          <input
            type="text"
            id={`role-${participant.id}`}
            name="role"
            defaultValue={participant.role || ""}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor={`organization-${participant.id}`}
            className="block text-sm font-medium text-zinc-700"
          >
            {t('participants.organization')}
          </label>
          <input
            type="text"
            id={`organization-${participant.id}`}
            name="organization"
            defaultValue={participant.organization || ""}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor={`notes-${participant.id}`}
            className="block text-sm font-medium text-zinc-700"
          >
            {t('participants.notes')}
          </label>
          <textarea
            id={`notes-${participant.id}`}
            name="notes"
            rows={2}
            defaultValue={participant.notes || ""}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
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
            formAction={deleteParticipant}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {t('common.delete')}
          </button>
        </div>
      </form>
    </details>
  );
}

export function ParticipantVoiceBadge({ hasVoiceProfile }: { hasVoiceProfile: boolean }) {
  const t = useTranslations('participants');

  return (
    <div className="ml-4">
      {hasVoiceProfile ? (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          {t('voiceRegistered')}
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          {t('notRegistered')}
        </span>
      )}
    </div>
  );
}
