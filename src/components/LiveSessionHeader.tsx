"use client";

import { useAIMode } from "@/contexts/AIModeContext";

export type AIMode = "google_ai" | "full_realtime";

export function LiveSessionHeader() {
  const { aiMode, setAIMode } = useAIMode();

  const handleChange = (newMode: AIMode) => {
    setAIMode(newMode);
  };

  const getModeInfo = (mode: AIMode) => {
    switch (mode) {
      case "google_ai":
        return {
          label: "Google AI（推奨）",
          cost: "¥150/時間",
          color: "blue",
        };
      case "full_realtime":
        return {
          label: "OpenAI Realtime",
          cost: "$100/会議",
          color: "purple",
        };
    }
  };

  const modeInfo = getModeInfo(aiMode);

  return (
    <div className="flex items-center gap-3">
      {/* AIモード選択 */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="ai-mode"
          className="text-xs font-medium text-zinc-700"
        >
          AIモード:
        </label>
        <select
          id="ai-mode"
          value={aiMode}
          onChange={(e) => handleChange(e.target.value as AIMode)}
          className="rounded-lg border border-zinc-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="google_ai">
            Google AI（推奨・¥150/時間）
          </option>
          <option value="full_realtime">
            OpenAI Realtime（$100/会議）
          </option>
        </select>
      </div>

      {/* モード情報 */}
      <div className="text-xs text-zinc-600">
        <span className="font-medium">{modeInfo.label}</span>
        {" · "}
        <span>{modeInfo.cost}</span>
      </div>

      {/* 接続状態 */}
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
          modeInfo.color === "blue"
            ? "bg-blue-100 text-blue-800"
            : "bg-purple-100 text-purple-800"
        }`}
      >
        <span
          className={`h-2 w-2 animate-pulse rounded-full ${
            modeInfo.color === "blue"
              ? "bg-blue-500"
              : "bg-purple-500"
          }`}
        ></span>
        AI接続中
      </span>
    </div>
  );
}
