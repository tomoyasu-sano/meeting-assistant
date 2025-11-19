/**
 * 会議用Function Calling定義
 * Stage 10: リアルタイムAI統合
 */

export const meetingFunctions = [
  {
    type: "function" as const,
    name: "evaluate_if_should_speak",
    description:
      "会議の流れを分析し、AIが今発言すべきか判断する。この関数は内部的に常に呼ばれ、発言タイミングを制御します。",
    parameters: {
      type: "object",
      properties: {
        should_speak: {
          type: "boolean",
          description: "今発言すべきかどうか",
        },
        reason: {
          type: "string",
          description: "判断理由",
          enum: [
            "direct_question", // 直接質問された
            "discussion_stuck", // 議論が行き詰まっている
            "need_info", // 重要な情報を補足すべき
            "contradiction", // 誤解や矛盾を発見
            "long_silence", // 長い沈黙
            "no_need", // 発言不要
          ],
        },
        confidence: {
          type: "number",
          description: "確信度（0-1）。0.7以上で発言を推奨",
          minimum: 0,
          maximum: 1,
        },
        reasoning: {
          type: "string",
          description: "詳細な判断理由の説明",
        },
      },
      required: ["should_speak", "reason", "confidence", "reasoning"],
    },
  },
  {
    type: "function" as const,
    name: "get_past_meeting_summary",
    description:
      "過去の会議サマリーをDBから取得する。参加者が過去の決定事項を忘れている場合に使用。",
    parameters: {
      type: "object",
      properties: {
        meeting_id: {
          type: "string",
          description: "会議ID",
        },
        limit: {
          type: "number",
          description: "取得件数",
          default: 3,
        },
      },
      required: ["meeting_id"],
    },
  },
  {
    type: "function" as const,
    name: "search_participant_info",
    description:
      "参加者の情報を検索する。利用者の状態やケアプラン情報を参照する際に使用。",
    parameters: {
      type: "object",
      properties: {
        participant_name: {
          type: "string",
          description: "参加者名",
        },
        info_type: {
          type: "string",
          description: "情報の種類",
          enum: ["care_plan", "health_status", "past_meetings"],
        },
      },
      required: ["participant_name", "info_type"],
    },
  },
];

/**
 * Function Calling結果の型定義
 */
export type EvaluateIfShouldSpeakResult = {
  should_speak: boolean;
  reason:
    | "direct_question"
    | "discussion_stuck"
    | "need_info"
    | "contradiction"
    | "long_silence"
    | "no_need";
  confidence: number;
  reasoning: string;
};

export type GetPastMeetingSummaryParams = {
  meeting_id: string;
  limit?: number;
};

export type SearchParticipantInfoParams = {
  participant_name: string;
  info_type: "care_plan" | "health_status" | "past_meetings";
};
