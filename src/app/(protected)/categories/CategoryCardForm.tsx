"use client";

import { useTranslations } from 'next-intl';
import { updateCategory, deleteCategory } from "@/actions/categories";
import { IndustrySelector } from "@/components/IndustrySelector";

type Category = {
  id: string;
  title: string;
  description: string | null;
  color_code: string | null;
  industries: string[] | null;
  created_at: string;
};

export function CategoryCardForm({ category }: { category: Category }) {
  const t = useTranslations();

  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700">
        {t('common.edit')} ・ {t('common.delete')}
      </summary>
      <form action={updateCategory} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={category.id} />

        <div>
          <label
            htmlFor={`title-${category.id}`}
            className="block text-sm font-medium text-zinc-700"
          >
            {t('categories.titleRequired')}
          </label>
          <input
            type="text"
            id={`title-${category.id}`}
            name="title"
            defaultValue={category.title}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor={`description-${category.id}`}
            className="block text-sm font-medium text-zinc-700"
          >
            {t('categories.descriptionLabel')}
          </label>
          <textarea
            id={`description-${category.id}`}
            name="description"
            rows={2}
            defaultValue={category.description || ""}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            業界タグ（複数選択可）
          </label>
          <IndustrySelector defaultValues={category.industries || []} />
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
            formAction={deleteCategory}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {t('common.delete')}
          </button>
        </div>
      </form>
    </details>
  );
}
