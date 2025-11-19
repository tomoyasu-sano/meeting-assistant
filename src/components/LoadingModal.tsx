"use client";

import { useEffect, useState } from "react";

type LoadingStep = {
  label: string;
  status: "pending" | "loading" | "completed" | "error";
};

type LoadingModalProps = {
  isOpen: boolean;
  title?: string;
  steps?: LoadingStep[];
  onClose?: () => void;
};

/**
 * アプリ全体で使用できる汎用ローディングモーダル
 *
 * 使用例：
 * ```tsx
 * <LoadingModal
 *   isOpen={isConnecting}
 *   title="会議セッションを準備中"
 *   steps={[
 *     { label: "セッションを作成", status: "completed" },
 *     { label: "AIに接続", status: "loading" },
 *     { label: "音声認識を開始", status: "pending" },
 *   ]}
 * />
 * ```
 */
export function LoadingModal({
  isOpen,
  title = "読み込み中...",
  steps = [],
  onClose,
}: LoadingModalProps) {
  const [dots, setDots] = useState("");

  // ドットアニメーション（...）
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStep = steps.find((s) => s.status === "loading");
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        {/* スピナー */}
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-zinc-200 border-t-indigo-600"></div>
        </div>

        {/* タイトル */}
        <h2 className="mb-2 text-center text-xl font-semibold text-zinc-900">
          {title}
        </h2>

        {/* 現在のステップ */}
        {currentStep && (
          <p className="mb-6 text-center text-sm text-zinc-600">
            {currentStep.label}
            {dots}
          </p>
        )}

        {/* プログレスバー */}
        {steps.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 flex justify-between text-xs text-zinc-500">
              <span>進行状況</span>
              <span>
                {completedCount} / {totalCount}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* ステップ一覧 */}
        {steps.length > 0 && (
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-3 text-sm text-zinc-700"
              >
                {step.status === "completed" && (
                  <svg
                    className="h-5 w-5 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {step.status === "loading" && (
                  <div className="h-5 w-5">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600"></div>
                  </div>
                )}
                {step.status === "pending" && (
                  <div className="h-5 w-5 rounded-full border-2 border-zinc-300"></div>
                )}
                {step.status === "error" && (
                  <svg
                    className="h-5 w-5 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
                <span
                  className={
                    step.status === "completed"
                      ? "text-zinc-500"
                      : step.status === "error"
                        ? "text-red-600"
                        : ""
                  }
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 閉じるボタン（オプション） */}
        {onClose && (
          <button
            onClick={onClose}
            className="mt-6 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            キャンセル
          </button>
        )}
      </div>
    </div>
  );
}
