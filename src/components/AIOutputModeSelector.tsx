"use client";

import { useState } from "react";

type AIOutputMode = "text" | "audio" | "text_audio";

type Props = {
  meetingId: string;
  initialMode: AIOutputMode;
};

const OUTPUT_MODES = [
  {
    value: "text" as const,
    label: "テキストのみ",
    description: "AIの応答をテキストで表示",
    icon: "📝",
  },
  {
    value: "audio" as const,
    label: "音声のみ",
    description: "AIの応答を音声で再生",
    icon: "🔊",
  },
  {
    value: "text_audio" as const,
    label: "テキスト + 音声",
    description: "AIの応答をテキストと音声の両方で出力",
    icon: "📝🔊",
  },
];

export function AIOutputModeSelector({ meetingId, initialMode }: Props) {
  const [mode, setMode] = useState<AIOutputMode>(initialMode);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (newMode: AIOutputMode) => {
    setMode(newMode);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_output_mode: newMode }),
      });

      if (!response.ok) {
        throw new Error("Failed to update output mode");
      }

      console.log("Output mode updated:", newMode);
    } catch (error) {
      console.error("Failed to update output mode:", error);
      alert("出力モードの更新に失敗しました");
      // ロールバック
      setMode(initialMode);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900">
        AI出力モード
      </h3>

      <div className="space-y-3">
        {OUTPUT_MODES.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-all ${
              mode === option.value
                ? "border-indigo-500 bg-indigo-50"
                : "border-zinc-200 bg-white hover:border-zinc-300"
            }`}
          >
            <input
              type="radio"
              name="ai_output_mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => handleChange(option.value)}
              disabled={isSaving}
              className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{option.icon}</span>
                <span className="font-medium text-zinc-900">
                  {option.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                {option.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      {isSaving && (
        <div className="mt-3 text-sm text-zinc-500">保存中...</div>
      )}
    </div>
  );
}
