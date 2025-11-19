import { getTranslations } from 'next-intl/server';
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const t = await getTranslations('settings');
  const supabase = await getSupabaseServerClient();

  // 認証確認
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* ヘッダーセクション */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-teal-200/20 via-cyan-200/20 to-blue-200/20 rounded-full blur-3xl -z-10" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-full border border-teal-200/50">
            <div className="w-2 h-2 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold gradient-text">User Settings</span>
          </div>

          <h2 className="text-3xl font-black text-gray-900 mb-2">
            {t('title')}
          </h2>
          <p className="text-gray-600">
            {t('description')}
          </p>
        </div>
      </div>

      {/* プロフィールセクション */}
      <div className="mesh-card rounded-3xl p-8 minimal-shadow animate-fade-scale" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-4 mb-6">
          <h3 className="text-xl font-black text-gray-900">{t('profile')}</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-teal-200 via-cyan-200 to-transparent" />
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('email')}
            </label>
            <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-3 text-gray-900 font-medium">
              {user.email}
            </div>
            <p className="mt-2 text-sm text-gray-500">{t('emailNote')}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('userId')}
            </label>
            <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-3 font-mono text-sm text-gray-600">
              {user.id}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('createdAt')}
            </label>
            <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-3 text-gray-900 font-medium">
              {new Date(user.created_at).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Decorative gradient accent */}
        <div className="mt-6 h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 rounded-full" />
      </div>
    </div>
  );
}
