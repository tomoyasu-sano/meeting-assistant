import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">
          パスワードリセット
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          登録したメールアドレスを入力してください。
          <br />
          パスワードリセット用のリンクをお送りします。
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
