import { getTranslations } from 'next-intl/server';
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createCategory } from "@/actions/categories";
import { CategoryCardForm } from "./CategoryCardForm";
import { IndustrySelector } from "@/components/IndustrySelector";
import { getIndustryLabel } from "@/lib/constants/industries";

type Category = {
  id: string;
  title: string;
  description: string | null;
  color_code: string | null;
  industries: string[] | null;
  created_at: string;
};

export default async function CategoriesPage() {
  const t = await getTranslations('categories');
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // カテゴリ一覧を取得
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      {/* ヘッダーセクション */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-200/20 via-purple-200/20 to-pink-200/20 rounded-full blur-3xl -z-10" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full border border-indigo-200/50">
            <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold gradient-text">Category Management</span>
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
          <h3 className="text-xl font-black text-gray-900">{t('createCategory')}</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 via-purple-200 to-transparent" />
        </div>

        <form action={createCategory} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-bold text-gray-800 mb-2"
            >
              {t('titleRequired')}
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              className="w-full rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder={t('titlePlaceholder')}
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-bold text-gray-800 mb-2"
            >
              {t('descriptionLabel')}
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="w-full rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
              placeholder={t('descriptionPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              業界タグ（複数選択可）
            </label>
            <IndustrySelector />
          </div>

          <button
            type="submit"
            className="mt-6 group relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <span className="relative z-10 flex items-center gap-2">
              {t('createCategory')}
              <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </span>
          </button>
        </form>
      </div>

      {/* カテゴリ一覧 */}
      <div className="space-y-4 animate-fade-scale" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-black text-gray-900">{t('registeredCategories')}</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 via-purple-200 to-transparent" />
          {categories && categories.length > 0 && (
            <div className="px-3 py-1 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full">
              <span className="text-xs font-bold gradient-text">{categories.length}件</span>
            </div>
          )}
        </div>

        {!categories || categories.length === 0 ? (
          <div className="mesh-card rounded-2xl p-8 text-center minimal-shadow">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full">
              <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 font-medium">{t('noCategoriesYet')}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(categories as Category[]).map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ category }: { category: Category }) {
  return (
    <div className="group relative bg-white rounded-2xl p-6 border border-indigo-100 minimal-shadow-hover cursor-pointer overflow-hidden">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2">
              {category.title}
            </h4>
            {category.description && (
              <p className="text-sm text-gray-600 leading-relaxed">
                {category.description}
              </p>
            )}

            {/* 業界タグ表示 */}
            {category.industries && category.industries.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {category.industries.map((industryValue) => (
                  <span
                    key={industryValue}
                    className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md border border-indigo-100"
                  >
                    {getIndustryLabel(industryValue)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <CategoryCardForm category={category} />
        </div>

        {/* Bottom gradient accent */}
        <div className="mt-4 h-1 w-0 group-hover:w-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" />
      </div>
    </div>
  );
}

