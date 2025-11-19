"use client";

import { useTranslations } from 'next-intl';
import { createMeeting } from "@/actions/meetings";
import { CustomSelect } from "@/components/CustomSelect";
import { useState } from "react";

type Category = {
  id: string;
  title: string;
};

type Participant = {
  id: string;
  display_name: string;
  role: string | null;
};

type MeetingFormProps = {
  categories: Category[];
  participants: Participant[];
};

export function MeetingForm({ categories, participants }: MeetingFormProps) {
  const t = useTranslations('meeting');
  const [selectedCategory, setSelectedCategory] = useState("");

  const categoryOptions = [
    { value: "", label: t('selectCategory') },
    ...categories.map((category) => ({
      value: category.id,
      label: category.title,
    })),
  ];

  return (
    <form action={createMeeting} className="space-y-4">
      <input type="hidden" name="category_id" value={selectedCategory} />

      <div>
        <label className="block text-sm font-bold text-gray-800 mb-2">
          {t('categoryRequired')}
        </label>
        <CustomSelect
          value={selectedCategory}
          options={categoryOptions}
          onChange={setSelectedCategory}
          placeholder={t('selectCategory')}
        />
      </div>

      <div>
        <label
          htmlFor="title"
          className="block text-sm font-bold text-gray-800 mb-2"
        >
          {t('meetingTitleRequired')}
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          placeholder={t('titlePlaceholder')}
        />
      </div>

      <div>
        <label
          htmlFor="scheduled_at"
          className="block text-sm font-bold text-gray-800 mb-2"
        >
          {t('scheduledDateTimeRequired')}
        </label>
        <input
          type="datetime-local"
          id="scheduled_at"
          name="scheduled_at"
          required
          className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>

      <div>
        <label
          htmlFor="join_password"
          className="block text-sm font-bold text-gray-800 mb-2"
        >
          {t('joinPassword')}
        </label>
        <input
          type="password"
          id="join_password"
          name="join_password"
          className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          placeholder={t('joinPasswordPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-800 mb-2">
          {t('selectParticipants')}
        </label>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-blue-100 bg-white p-4">
          {participants.length === 0 ? (
            <p className="text-sm text-gray-500">
              {t('noParticipantsRegistered')}
            </p>
          ) : (
            participants.map((participant) => (
              <label
                key={participant.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  name="participant_ids"
                  value={participant.id}
                  className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 font-medium">
                  {participant.display_name}
                  {participant.role && (
                    <span className="text-gray-500 font-normal">
                      {" "}
                      ({participant.role})
                    </span>
                  )}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <button
        type="submit"
        className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <span className="relative z-10 flex items-center gap-2">
          {t('createMeeting')}
          <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </span>
      </button>
    </form>
  );
}
