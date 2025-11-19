/**
 * 会議評価の型定義
 */

export type MeetingEvaluation = {
  id: string;
  session_id: string;
  meeting_id: string;
  overall_feedback: string;
  positive_aspects: string;
  improvement_suggestions: string;
  host_feedback: string;
  team_feedback: string;
  atmosphere_comment: string | null;
  discussion_depth_comment: string | null;
  time_management_comment: string | null;
  engagement_comment: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
};

export type EvaluationResult = {
  overallFeedback: string;
  positiveAspects: string;
  improvementSuggestions: string;
  hostFeedback: string;
  teamFeedback: string;
  atmosphereComment: string;
  discussionDepthComment: string;
  timeManagementComment: string;
  engagementComment: string;
};
