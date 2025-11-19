/**
 * AI応答保存レイヤー統一ユーティリティ
 *
 * すべてのAIプロバイダー（Gemini Live, Gemini 1.5, OpenAI Realtime）からの
 * 応答を統一的に保存するためのユーティリティ
 */

export type AIProvider = "gemini_live" | "gemini_assessment" | "openai_realtime";
export type AIMode = "assistant" | "assessment" | "custom";
export type AISource = "response" | "trigger" | "error";

export interface SaveAIMessageParams {
  meetingId: string;
  sessionId: string;
  provider: AIProvider;
  mode: AIMode;
  source: AISource;
  content: string;
  turnId?: string; // 重複防止用のターンID（省略時は自動生成）
}

/**
 * ターンIDを生成する
 * タイムスタンプ + ランダムハッシュで一意性を保証
 */
export function generateTurnId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * AI応答をDBに保存する
 */
export async function saveAIMessage(params: SaveAIMessageParams): Promise<boolean> {
  const {
    meetingId,
    sessionId,
    provider,
    mode,
    source,
    content,
    turnId = generateTurnId(),
  } = params;

  if (!content.trim()) {
    console.warn("[AIMessageRecorder] Empty content, skipping save");
    return false;
  }

  try {
    console.log("[AIMessageRecorder] Saving AI message", {
      provider,
      mode,
      source,
      turnId,
      contentLength: content.length,
    });

    const response = await fetch(`/api/meetings/${meetingId}/ai-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        content,
        source,
        provider,
        mode,
        turnId,
      }),
    });

    if (response.ok) {
      console.log("[AIMessageRecorder] ✅ AI message saved successfully", { turnId });
      return true;
    } else {
      const errorText = await response.text();
      console.error("[AIMessageRecorder] ❌ Failed to save AI message", {
        status: response.status,
        error: errorText,
      });
      return false;
    }
  } catch (error) {
    console.error("[AIMessageRecorder] ❌ Error saving AI message", error);
    return false;
  }
}

/**
 * AIResponseRecorderクラス
 * ストリーミング応答のバッファ管理とフラッシュ機能を提供
 */
export class AIResponseRecorder {
  private buffer: string = "";
  private currentTurnId: string | null = null;
  private savedTurnIds: Set<string> = new Set();
  private meetingId: string;
  private sessionId: string;
  private provider: AIProvider;
  private mode: AIMode;

  constructor(
    meetingId: string,
    sessionId: string,
    provider: AIProvider,
    mode: AIMode
  ) {
    this.meetingId = meetingId;
    this.sessionId = sessionId;
    this.provider = provider;
    this.mode = mode;
  }

  /**
   * チャンクを追加
   */
  appendChunk(text: string): void {
    this.buffer += text;
  }

  /**
   * 現在のバッファ内容を取得
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * ターン完了（保存して新しいターンを開始）
   */
  async completeTurn(): Promise<boolean> {
    if (!this.buffer.trim()) {
      console.log("[AIResponseRecorder] No content to complete, skipping");
      return false;
    }

    // 新しいターンIDを生成
    this.currentTurnId = generateTurnId();

    // 保存
    const success = await saveAIMessage({
      meetingId: this.meetingId,
      sessionId: this.sessionId,
      provider: this.provider,
      mode: this.mode,
      source: "response",
      content: this.buffer,
      turnId: this.currentTurnId,
    });

    if (success) {
      this.savedTurnIds.add(this.currentTurnId);
      this.buffer = ""; // バッファクリア
      this.currentTurnId = null;
      return true;
    }

    return false;
  }

  /**
   * フラッシュ（未保存の内容を保存）
   * STOP/一時停止/終了時に呼ばれる
   */
  async flush(): Promise<boolean> {
    if (!this.buffer.trim()) {
      console.log("[AIResponseRecorder] No content to flush");
      return false;
    }

    // 現在のターンIDがあり、既に保存済みなら重複保存を防ぐ
    if (this.currentTurnId && this.savedTurnIds.has(this.currentTurnId)) {
      console.log("[AIResponseRecorder] Turn already saved, skipping flush", {
        turnId: this.currentTurnId,
      });
      this.buffer = "";
      return false;
    }

    // 新しいターンIDを生成（現在のターンIDがない場合）
    if (!this.currentTurnId) {
      this.currentTurnId = generateTurnId();
    }

    console.log("[AIResponseRecorder] Flushing unsaved content", {
      turnId: this.currentTurnId,
      contentLength: this.buffer.length,
    });

    const success = await saveAIMessage({
      meetingId: this.meetingId,
      sessionId: this.sessionId,
      provider: this.provider,
      mode: this.mode,
      source: "response",
      content: this.buffer,
      turnId: this.currentTurnId,
    });

    if (success) {
      this.savedTurnIds.add(this.currentTurnId);
      this.buffer = "";
      this.currentTurnId = null;
      return true;
    }

    return false;
  }

  /**
   * バッファとターンIDをクリア
   */
  clear(): void {
    this.buffer = "";
    this.currentTurnId = null;
  }

  /**
   * 保存済みターンIDをセット（再接続・復元時に使用）
   */
  setSavedTurnIds(turnIds: string[]): void {
    this.savedTurnIds = new Set(turnIds);
    console.log("[AIResponseRecorder] Loaded saved turn IDs", {
      count: turnIds.length,
    });
  }

  /**
   * モードを更新（アシスタント ⇔ アセスメント切り替え時）
   */
  setMode(mode: AIMode): void {
    this.mode = mode;
    console.log("[AIResponseRecorder] Mode updated", { mode });
  }
}
