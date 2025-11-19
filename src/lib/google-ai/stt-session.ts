/**
 * STTセッション管理
 *
 * Next.jsのルート間で直接Mapをimportすると動作しないため、
 * 単一のモジュールに切り出して共有する。
 *
 * 将来的には Redis や Memorystore など外部ストアへの移行も考慮。
 */

import type { ReadableStreamDefaultController } from "stream/web";

export type STTSession = {
  sttStream: any; // Google Speech client stream
  controller: ReadableStreamDefaultController;
  createdAt: Date;
};

/**
 * セッションストア
 *
 * 注意: Cloud Run は複数インスタンスに振り分けることがあるため、
 * 本番環境では外部ストア（Redis等）の使用を推奨。
 */
class SessionStore {
  private sessions: Map<string, STTSession>;

  constructor() {
    this.sessions = new Map();
  }

  /**
   * セッションを登録
   */
  set(sessionId: string, session: STTSession): void {
    this.sessions.set(sessionId, session);
  }

  /**
   * セッションを取得
   */
  get(sessionId: string): STTSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * セッションを削除
   */
  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * セッション数を取得
   */
  size(): number {
    return this.sessions.size;
  }

  /**
   * 古いセッションをクリーンアップ（オプション）
   * @param maxAgeMs 最大保持時間（ミリ秒）
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const now = new Date();
    let deletedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.createdAt.getTime();
      if (age > maxAgeMs) {
        this.delete(sessionId);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

// シングルトンインスタンス
export const sessionStore = new SessionStore();
