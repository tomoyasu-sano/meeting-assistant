import { UpdatePasswordForm } from "./UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">
          パスワード更新
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          新しいパスワードを入力してください。
        </p>
      </div>
      <UpdatePasswordForm />
    </div>
  );
}
