import { useState, useRef, useCallback } from "react";

type TermCard = {
  id: string;
  term: string;
  description: string;
  timestamp: string;
  searchMeta?: {
    query?: string;
    snippet?: string;
    sourceTitle?: string;
    sourceUrl?: string;
  };
};

type TerminologyStatus = "idle" | "connecting" | "active" | "error";

export function useTerminologyHelper(meetingId: string, sessionId: string | null) {
  const [status, setStatus] = useState<TerminologyStatus>("idle");
  const [cards, setCards] = useState<TermCard[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<TerminologyStatus>("idle");
  const explainedTermsRef = useRef<Set<string>>(new Set());
  const contextSendIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingBufferRef = useRef<string>("");
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTurnRef = useRef<{
    text: string;
    search?: any;
    searchResult?: any;
    groundingMetadata?: any;
  }>({ text: "" });
  const hasShownWelcomeRef = useRef(false);

  // statusが変わるたびにrefも更新
  statusRef.current = status;

  /**
   * 用語を正規化（重複判定用）
   */
  const normalizeTerm = (term: string): string => {
    return term
      .trim()
      .toLowerCase()
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xfee0)
      );
  };

  /**
   * 既出用語リストをLive APIに送信
   */
  const sendExplainedTermsContext = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (explainedTermsRef.current.size === 0) return;

    const explainedTermsList = [...explainedTermsRef.current];
    const contextMessage = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text: `# 既に説明済みの用語リスト\n${JSON.stringify(explainedTermsList)}\n\n上記の用語はすでに説明済みなので、再度説明しないでください。`,
              },
            ],
          },
        ],
        turnComplete: true,
      },
    };

    wsRef.current.send(JSON.stringify(contextMessage));
    console.log("[Terminology] Sent explained terms:", explainedTermsList);
  }, []);

  /**
   * バッファをフラッシュしてLive APIに送信
   */
  const flushBuffer = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!pendingBufferRef.current.trim()) return;

    const bufferText = pendingBufferRef.current.trim();
    console.log("[Terminology] Flushing buffer:", bufferText);

    const message = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text: `# 会議の直近の発話テキスト\n${bufferText}\n\n# 既に説明済みの用語リスト\n${JSON.stringify([...explainedTermsRef.current])}\n\n上記の発話内容から専門用語を抽出し、JSON配列形式で解説してください。`,
              },
            ],
          },
        ],
        turnComplete: true,
      },
    };

    wsRef.current.send(JSON.stringify(message));
    pendingBufferRef.current = "";

    // フラッシュタイマーをクリア
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  /**
   * Transcript を追加（バッファリング）
   */
  const addTranscript = useCallback(
    (text: string) => {
      if (!text || !text.trim()) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      pendingBufferRef.current += text + "\n";
      console.log("[Terminology] Transcript added to buffer:", text);

      // 250文字を超えたら即座にフラッシュ
      if (pendingBufferRef.current.length >= 250) {
        console.log("[Terminology] Buffer size exceeded 250, flushing");
        flushBuffer();
        return;
      }

      // 5秒のタイマーをリセット
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }

      flushTimerRef.current = setTimeout(() => {
        console.log("[Terminology] 5s timer elapsed, flushing");
        flushBuffer();
      }, 5000);
    },
    [flushBuffer]
  );

  /**
   * WebSocket接続
   */
  const connect = useCallback(async () => {
    if (!sessionId || !meetingId) {
      console.log("[Terminology] Cannot connect: missing sessionId or meetingId");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[Terminology] Already connected");
      return;
    }

    try {
      console.log("[Terminology] Starting connection...");
      setStatus("connecting");
      setConnectionError(null);

      const response = await fetch("/api/gemini/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          conversationHistory: "",
          meetingId: meetingId,
          profile: "terminology_helper",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start term explanation session");
      }

      const { wsUrl, model, config } = await response.json();
      console.log("[Terminology] Connecting to:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Terminology] ✅ WebSocket connected");
        setStatus("active");

        const setupMessage = {
          setup: {
            model,
            generationConfig: {
              responseModalities: ["TEXT"],
            },
            systemInstruction: {
              parts: [
                {
                  text: `あなたは「用語解説に特化した」会議のアシスタントです。
役割は、会議中に出てくる専門用語・略語・社外の人には伝わりづらい言葉を、
参加者がさっと読めるように、短くわかりやすく説明することです。

**重要：必ずJSON配列形式で出力してください**

出力フォーマット（必須）:
[
  { "term": "用語1", "description": "短い説明文1" },
  { "term": "用語2", "description": "短い説明文2" }
]

制約:
- 必ず上記のJSON配列形式で出力してください。それ以外の形式は禁止です。
- 説明文は1〜2文で簡潔にまとめてください。
- 日本語で説明してください。
- すでに同じ会議内で説明した用語は、再度説明しないでください（既出用語リストが渡されます）。
- 会議の文脈に合わせて、もっとも一般的で自然な意味を優先してください。
- 経営層〜若手社員までがいる前提で、専門用語をかみ砕いた説明にしてください。

**重要な動作ルール:**
- 挨拶（こんにちは、おはようございます、など）や雑談には一切反応しないでください。
- 専門用語が含まれていない発話には、空配列 [] を返してください。
- 自分から会話を始めたり、質問をしたりしないでください。
- あなたの役割は「用語解説のみ」です。それ以外の応答は禁止です。

**Google検索の使用基準（重要）:**
- 一般的なIT用語（SaaS、DX、KPI、AIなど）は、あなたの知識で解説してください。検索は不要です。
- 以下の場合のみGoogle検索を使用してください：
  1. 専門的な業界用語（医療・介護・法律など）
  2. 最新の制度変更や法改正に関する用語
  3. あなたの知識にない新しい概念や技術
  4. 地域固有の用語や組織名
- 一般的な用語を検索する必要はありません。

**空配列の返却について:**
- 説明する用語がない場合のみ空配列 [] を返してください。
- ただし、専門用語が含まれている場合は必ず解説してください。

出力例:
[
  { "term": "SaaS", "description": "Software as a Serviceの略。インターネット経由でソフトウェアを提供するビジネスモデルです。" },
  { "term": "BPSD", "description": "認知症の行動・心理症状のこと。不安や徘徊、暴力などの症状を指します。" }
]`,
                },
              ],
            },
            tools: [{ googleSearch: {} }],
          },
        };

        console.log("[Terminology] Sending setup");
        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = async (event) => {
        try {
          let message;
          if (event.data instanceof Blob) {
            const text = await event.data.text();
            message = JSON.parse(text);
          } else {
            message = JSON.parse(event.data);
          }

          console.log("[Terminology] Message:", message);

          // Setup完了
          if (message.setupComplete) {
            console.log("[Terminology] ✅ Setup complete");

            // 初回のみウェルカムメッセージを表示
            if (!hasShownWelcomeRef.current) {
              const welcomeCard: TermCard = {
                id: `welcome-${Date.now()}`,
                term: "📢 用語解説を開始",
                description:
                  "会議中に専門用語が出てきたら、自動的に解説します。",
                timestamp: new Date().toISOString(),
              };
              setCards([welcomeCard]);
              hasShownWelcomeRef.current = true;
            }

            // 既出用語リストを10秒ごとに送信
            contextSendIntervalRef.current = setInterval(() => {
              sendExplainedTermsContext();
            }, 10000);
          }

          // エラー
          if (message.error) {
            console.error("[Terminology] Server error:", message.error);
            setConnectionError("用語解説の接続に失敗しました");
            setStatus("error");
          }

          // Model応答
          if (message.serverContent?.modelTurn?.parts) {
            const parts = message.serverContent.modelTurn.parts;
            setIsProcessing(true);

            for (const part of parts) {
              // テキストを蓄積
              if (part.text) {
                currentTurnRef.current.text += part.text;
              }
              // Google Search実行コード
              if (part.executableCode) {
                console.log("[Terminology] Search executed");
                currentTurnRef.current.search = part.executableCode;
              }
              // 検索結果
              if (part.codeExecutionResult) {
                console.log("[Terminology] Search result received");
                currentTurnRef.current.searchResult = part.codeExecutionResult;
              }
            }
          }

          // Grounding Metadata
          if (message.serverContent?.groundingMetadata) {
            currentTurnRef.current.groundingMetadata =
              message.serverContent.groundingMetadata;
            console.log(
              "[Terminology] Grounding metadata received",
              message.serverContent.groundingMetadata
            );
          }

          // Turn完了時にカードを確定
          if (message.serverContent?.turnComplete || message.usageMetadata) {
            setIsProcessing(false);

            const turnText = currentTurnRef.current.text.trim();
            if (turnText) {
              console.log("[Terminology] Turn complete:", turnText);

              try {
                // ```json ... ``` のコードブロックを除去
                let jsonText = turnText;
                const jsonMatch = turnText.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                  jsonText = jsonMatch[1].trim();
                } else if (
                  turnText.startsWith("```") &&
                  turnText.endsWith("```")
                ) {
                  jsonText = turnText
                    .replace(/^```\w*\s*/, "")
                    .replace(/\s*```$/, "")
                    .trim();
                }

                const parsedTerms = JSON.parse(jsonText);

                if (Array.isArray(parsedTerms)) {
                  if (parsedTerms.length === 0) {
                    console.log("[Terminology] Empty array received");
                  } else {
                    const newCards: TermCard[] = [];

                    parsedTerms.forEach((item: any) => {
                      if (item.term && item.description) {
                        // 重複チェック
                        const normalizedTerm = normalizeTerm(item.term);
                        if (explainedTermsRef.current.has(normalizedTerm)) {
                          console.log(
                            `[Terminology] Duplicate term skipped: ${item.term}`
                          );
                          return;
                        }

                        const newCard: TermCard = {
                          id: `term-${Date.now()}-${Math.random()}`,
                          term: item.term,
                          description: item.description,
                          timestamp: new Date().toISOString(),
                        };

                        // URL抽出（ログのみ）
                        if (currentTurnRef.current.groundingMetadata) {
                          const groundingMetadata =
                            currentTurnRef.current.groundingMetadata;
                          let extractedUrls: string[] = [];

                          if (
                            groundingMetadata.searchEntryPoint?.renderedContent
                          ) {
                            const renderedContent =
                              groundingMetadata.searchEntryPoint.renderedContent;
                            const urlMatches = renderedContent.match(
                              /https?:\/\/[^\s"'<>]+/g
                            );
                            if (urlMatches) {
                              extractedUrls = urlMatches;
                            }
                          }

                          if (groundingMetadata.groundingChunks) {
                            groundingMetadata.groundingChunks.forEach(
                              (chunk: any) => {
                                if (chunk.web?.uri) {
                                  extractedUrls.push(chunk.web.uri);
                                }
                              }
                            );
                          }

                          if (extractedUrls.length > 0) {
                            const uniqueUrls = [...new Set(extractedUrls)];
                            console.log(
                              "[Terminology] Search URLs:",
                              uniqueUrls
                            );
                          }
                        }

                        newCards.push(newCard);
                        explainedTermsRef.current.add(normalizedTerm);
                        console.log(`[Terminology] Card added: ${item.term}`);
                      }
                    });

                    if (newCards.length > 0) {
                      setCards((prev) => [...newCards, ...prev]);
                    }
                  }
                } else {
                  throw new Error("配列形式ではありません");
                }
              } catch (parseError) {
                console.error("[Terminology] JSON parse error:", parseError);
                console.error("[Terminology] Received text:", turnText);

                const errorCard: TermCard = {
                  id: `error-${Date.now()}`,
                  term: "⚠️ パースエラー",
                  description: `AIからの応答をJSON形式として解析できませんでした。応答: ${turnText.substring(0, 100)}...`,
                  timestamp: new Date().toISOString(),
                };
                setCards((prev) => [errorCard, ...prev]);
              }

              currentTurnRef.current = {
                text: "",
                search: undefined,
                searchResult: undefined,
                groundingMetadata: undefined,
              };
            }
          }
        } catch (err) {
          console.error("[Terminology] Message parse error", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[Terminology] WebSocket error", err);
        setConnectionError("用語解説の接続エラーが発生しました");
        setStatus("error");
      };

      ws.onclose = () => {
        console.log("[Terminology] WebSocket closed");
        if (statusRef.current === "active") {
          setStatus("idle");
        }
        wsRef.current = null;

        // インターバルクリア
        if (contextSendIntervalRef.current) {
          clearInterval(contextSendIntervalRef.current);
          contextSendIntervalRef.current = null;
        }

        // フラッシュタイマークリア
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
      };
    } catch (err) {
      console.error("[Terminology] Connection error", err);
      setConnectionError("用語解説の起動に失敗しました");
      setStatus("error");
    }
  }, [meetingId, sessionId, sendExplainedTermsContext]);

  /**
   * WebSocket切断
   */
  const disconnect = useCallback(() => {
    console.log("[Terminology] Disconnecting...");

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (contextSendIntervalRef.current) {
      clearInterval(contextSendIntervalRef.current);
      contextSendIntervalRef.current = null;
    }

    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    // 既出用語リストをクリア
    const explainedCount = explainedTermsRef.current.size;
    explainedTermsRef.current.clear();
    if (explainedCount > 0) {
      console.log(`[Terminology] Cleared ${explainedCount} explained terms`);
    }

    pendingBufferRef.current = "";
    hasShownWelcomeRef.current = false;
    setStatus("idle");
    setCards([]);
  }, []);

  return {
    status,
    cards,
    isProcessing,
    connectionError,
    connect,
    disconnect,
    addTranscript,
  };
}
