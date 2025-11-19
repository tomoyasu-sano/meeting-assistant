/**
 * Gemini AI フック
 *
 * Gemini 1.5を使用してAI応答を生成（HTTPストリーミング）
 */

import { useState, useCallback } from "react";
import { TriggerType } from "./useTriggerEngine";

export type AIResponse = {
  id: string;
  text: string;
  timestamp: string;
  type: "suggestion" | "response";
};

export type Transcript = {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
};

export function useGeminiAI(
  onResponse: (response: AIResponse) => void,
  onResponseChunk?: (chunk: string) => void
) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * AI応答生成
   */
  const generateResponse = useCallback(
    async (
      sessionId: string,
      triggerType: TriggerType,
      conversationHistory: Transcript[],
      meetingTitle?: string
    ) => {
      if (isGenerating) {
        console.log("[useGeminiAI] Already generating, skipping");
        return;
      }

      try {
        setIsGenerating(true);
        setError(null);

        console.log("[useGeminiAI] Generating response", {
          triggerType,
          historyLength: conversationHistory.length,
        });

        const response = await fetch("/api/gemini/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            triggerType,
            conversationHistory,
            meetingTitle,
          }),
        });

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.statusText}`);
        }

        // ストリーミングレスポンスの処理
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));

                if (data.type === "delta") {
                  fullText += data.text;
                  onResponseChunk?.(data.text);
                } else if (data.type === "complete") {
                  fullText = data.fullText;
                } else if (data.type === "error") {
                  console.error("[useGeminiAI] Server error", data);
                  throw new Error(data.message || "Server error");
                } else if (data.type === "raw") {
                  // デバッグ用：Vertex AIからの生データをログ出力
                  console.log("[useGeminiAI] Raw line from Vertex", data.line);
                }
              } catch (parseError) {
                console.error("[useGeminiAI] Parse error", parseError);
              }
            }
          }
        }

        // 完了時のコールバック
        const aiResponse: AIResponse = {
          id: `ai-${Date.now()}`,
          text: fullText,
          timestamp: new Date().toISOString(),
          type: "response",
        };

        onResponse(aiResponse);

        console.log("[useGeminiAI] Response generated", {
          textLength: fullText.length,
        });
      } catch (err) {
        console.error("[useGeminiAI] Error", err);
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, onResponse, onResponseChunk]
  );

  return {
    generateResponse,
    isGenerating,
    error,
  };
}
