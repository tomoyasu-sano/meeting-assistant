/**
 * 会議の文字起こしログ（Human）とAI発話ログ（AI）を時系列で統合するユーティリティ
 */

export type ConversationMessage = {
  speaker: 'Human' | 'AI';
  text: string;
  timestamp: Date;
  source?: string; // 'transcript' | 'ai_message'
  participantName?: string; // Human の場合の参加者名
};

export type TranscriptRecord = {
  id: string;
  text: string;
  created_at: string;
  participant_id?: string;
  speaker_label?: string;
  participants?: {
    display_name: string;
  } | {
    display_name: string;
  }[];
};

export type AIMessageRecord = {
  id: string;
  content: string;
  created_at: string;
  source: string;
};

export type MergeMode = 'human_only' | 'ai_only' | 'human_ai_combined';

/**
 * 文字起こしログとAIメッセージを時系列で統合
 * @param transcripts 文字起こしログの配列
 * @param aiMessages AI発話ログの配列
 * @param mode 統合モード
 * @returns 時系列でソートされた会話メッセージの配列
 */
export function mergeConversationLogs(
  transcripts: TranscriptRecord[],
  aiMessages: AIMessageRecord[],
  mode: MergeMode = 'human_ai_combined'
): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  // Human の文字起こしログを変換
  if (mode === 'human_only' || mode === 'human_ai_combined') {
    const humanMessages = transcripts.map((t) => {
      // participantsが配列かオブジェクトかを判定
      const participantName = Array.isArray(t.participants)
        ? t.participants[0]?.display_name
        : t.participants?.display_name;

      return {
        speaker: 'Human' as const,
        text: t.text,
        timestamp: new Date(t.created_at),
        source: 'transcript' as const,
        participantName: participantName || t.speaker_label || '不明な参加者',
      };
    });
    messages.push(...humanMessages);
  }

  // AI の発話ログを変換
  if (mode === 'ai_only' || mode === 'human_ai_combined') {
    const aiMessagesConverted = aiMessages.map((a) => ({
      speaker: 'AI' as const,
      text: a.content,
      timestamp: new Date(a.created_at),
      source: 'ai_message' as const,
    }));
    messages.push(...aiMessagesConverted);
  }

  // 時系列でソート（昇順）
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return messages;
}

/**
 * 会話ログをテキスト形式に変換（要約生成用）
 * @param messages 会話メッセージの配列
 * @returns フォーマットされたテキスト
 */
export function formatConversationForSummary(messages: ConversationMessage[]): string {
  return messages
    .map((msg) => {
      if (msg.speaker === 'Human') {
        const speaker = msg.participantName || '参加者';
        return `【${speaker}】: ${msg.text}`;
      } else {
        return `【AIアシスタント】: ${msg.text}`;
      }
    })
    .join('\n\n');
}

/**
 * 会話の統計情報を取得
 * @param messages 会話メッセージの配列
 * @returns 統計情報オブジェクト
 */
export function getConversationStats(messages: ConversationMessage[]) {
  const humanMessages = messages.filter((m) => m.speaker === 'Human');
  const aiMessages = messages.filter((m) => m.speaker === 'AI');

  const uniqueParticipants = new Set(
    humanMessages
      .map((m) => m.participantName)
      .filter((name): name is string => name !== undefined)
  );

  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
  const durationSeconds = firstMessage && lastMessage
    ? Math.floor((lastMessage.timestamp.getTime() - firstMessage.timestamp.getTime()) / 1000)
    : 0;

  return {
    totalMessages: messages.length,
    humanMessageCount: humanMessages.length,
    aiMessageCount: aiMessages.length,
    participantCount: uniqueParticipants.size,
    durationSeconds,
  };
}
