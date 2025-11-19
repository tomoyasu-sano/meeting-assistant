/**
 * 会議評価生成プロバイダー（Vertex AI版）
 */

import { VertexAI } from '@google-cloud/vertexai';
import path from 'path';
import type { EvaluationResult } from '@/types/evaluation';

export interface EvaluationProvider {
  generateEvaluation(
    conversationText: string,
    meetingTitle: string,
    participantCount: number,
    durationMinutes: number
  ): Promise<EvaluationResult>;
}

export class GeminiEvaluationProvider implements EvaluationProvider {
  private projectId: string;
  private location: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'meeting-supporter';
    this.location = process.env.VERTEX_LOCATION || 'asia-northeast1';

    // 認証情報パスを環境変数に設定
    const credentialsPath = path.resolve(
      process.cwd(),
      'google-credentials.json'
    );
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  }

  async generateEvaluation(
    conversationText: string,
    meetingTitle: string,
    participantCount: number,
    durationMinutes: number
  ): Promise<EvaluationResult> {
    // サマリーと同じモデルを使用（環境変数で指定可能）
    const evaluationModel = process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash';

    const prompt = this.buildPrompt(
      conversationText,
      meetingTitle,
      participantCount,
      durationMinutes
    );

    console.log('[Evaluation Provider] 🤖 Generating evaluation with Vertex AI Gemini...', {
      model: evaluationModel,
      project: this.projectId,
      location: this.location,
      meetingTitle,
      participantCount,
      durationMinutes,
      textLength: conversationText.length,
    });

    try {
      // Vertex AI SDK初期化
      const vertexAI = new VertexAI({
        project: this.projectId,
        location: this.location,
      });

      const generativeModel = vertexAI.getGenerativeModel({
        model: evaluationModel,
      });

      const result = await generativeModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3, // 評価は正確性重視
          maxOutputTokens: 4096, // トークン数を増やして完全なレスポンスを取得
        },
      });

      const response = result.response;
      const candidates = response.candidates || [];
      const firstCandidate = candidates[0];
      const content = firstCandidate?.content;
      const parts = content?.parts || [];
      const text = parts.map((p: any) => p.text || '').join('');

      console.log('[Evaluation Provider] ✅ Evaluation generated successfully');

      // JSONレスポンスをパース
      const parsed = this.parseResponse(text);
      return parsed;
    } catch (error) {
      console.error('[Evaluation Provider] ❌ Vertex AI Gemini evaluation generation error:', error);
      throw new Error('Failed to generate evaluation with Gemini');
    }
  }

  private buildPrompt(
    conversationText: string,
    meetingTitle: string,
    participantCount: number,
    durationMinutes: number
  ): string {
    return `あなたは介護サービス会議の評価を行う専門アシスタントです。会議の文字起こしログから、次回より良い会議につなげるための建設的な評価を生成してください。

**重要な前提**:
- この評価は全参加者が見ることができます
- 過度にポジティブな表現は避け、率直かつ建設的なフィードバックを心がけてください
- 改善点は具体的に指摘しつつ、「次回試したいこと」として前向きに提案してください
- ホストのやる気を削がないよう、批判的ではなく成長を促す表現にしてください
- 抽象的な評価ではなく、具体的で実行可能なアドバイスを提供してください

**会議タイトル**: ${meetingTitle}
**参加者数**: ${participantCount}人
**会議時間**: ${durationMinutes}分

**会議ログ**:
${conversationText}

---

以下のJSON形式で評価を生成してください：

\`\`\`json
{
  "overall_feedback": "会議全体の総評（3-5文程度）。良かった点と改善が必要な点をバランスよく、率直に記載。",
  "positive_aspects": "この会議で特に良かった点を3-5項目で具体的に記載。参加者の貢献を認める内容を含める。",
  "improvement_suggestions": "次回の会議で改善すべき点を3-5項目で具体的に記載。抽象的ではなく、実行可能な提案にする。",
  "host_feedback": "会議を主催したホストへの具体的なアドバイス。会議運営で改善できる点を率直かつ建設的に提案。",
  "team_feedback": "チーム全体で意識すべきこと。全員が次回意識すると良い点を具体的に提案。",
  "atmosphere_comment": "会議全体の雰囲気について。オープンな議論ができていたか、心理的安全性は確保されていたか。具体的な改善点があれば指摘。",
  "discussion_depth_comment": "議論の深さや質について。表面的な話だけでなく本質的な議論ができていたか。深掘りが不足していた点があれば指摘。",
  "time_management_comment": "時間配分について。重要なトピックに十分な時間を使えていたか、効率的だったか。改善できる点を具体的に指摘。",
  "engagement_comment": "参加者のエンゲージメントについて。全員が積極的に参加できていたか。発言機会の偏りなどがあれば指摘。"
}
\`\`\`

**評価軸のガイドライン**:

1. **全体の雰囲気（atmosphere）**:
   - オープンで率直な意見交換ができていたか
   - 参加者が安心して発言できる雰囲気だったか
   - 対立があった場合も建設的に解決できていたか
   - 改善点: 発言しづらい雰囲気があった場合は具体的に指摘

2. **議論の深まり（discussion_depth）**:
   - 表面的な確認だけでなく本質的な議論ができていたか
   - 「なぜ」を深掘りする質問があったか
   - 新しい視点や気づきが生まれていたか
   - 改善点: 議論が浅かった場合、どのようなテーマでより深掘りすべきだったか指摘

3. **時間配分（time_management）**:
   - 重要度に応じて適切に時間を配分できていたか
   - 議論が脱線せず焦点を保てていたか
   - 時間内に必要な議題を扱えていたか
   - 改善点: 時間配分が不適切だった場合、具体的にどう改善すべきか提案

4. **参加者のエンゲージメント（engagement）**:
   - 全員が発言機会を持てていたか
   - 特定の人だけが話していないか
   - 聞き手も積極的に反応していたか
   - 改善点: 参加の偏りがあった場合、全員を巻き込むための具体策を提案

**出力形式の注意**:
- 必ずJSON形式で返してください
- 各フィールドは日本語で記述してください
- 具体的で実行可能なフィードバックにしてください
- 過度にポジティブな表現は避け、率直かつ建設的なトーンを維持してください
- 改善点は具体的に、次回すぐに実行できる形で提案してください`;
  }

  private parseResponse(text: string): EvaluationResult {
    console.log('[Evaluation Provider] 🔍 Raw response text (first 500 chars):', text.substring(0, 500));
    console.log('[Evaluation Provider] 🔍 Raw response text (last 500 chars):', text.substring(Math.max(0, text.length - 500)));

    let jsonText = text.trim();

    // ステップ1: マークダウンコードブロックを抽出
    // パターン1: ```json ... ``` (完全な形式)
    let jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
      console.log('[Evaluation Provider] ✅ Matched pattern: ```json ... ```');
    } else {
      // パターン2: ``` ... ``` (jsonキーワードなし)
      jsonMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
        console.log('[Evaluation Provider] ✅ Matched pattern: ``` ... ```');
      } else {
        // パターン3: 開始タグのみ（閉じタグがない場合）
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\s*/, '');
          console.log('[Evaluation Provider] ✅ Removed opening ```json tag (no closing tag found)');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\s*/, '');
          console.log('[Evaluation Provider] ✅ Removed opening ``` tag (no closing tag found)');
        } else {
          console.log('[Evaluation Provider] ⚠️  No markdown code block found, using raw text');
        }

        // 終了タグがある場合は削除
        if (jsonText.endsWith('```')) {
          jsonText = jsonText.replace(/\s*```$/, '');
          console.log('[Evaluation Provider] ✅ Removed closing ``` tag');
        }
      }
    }

    jsonText = jsonText.trim();
    console.log('[Evaluation Provider] 🔍 Extracted JSON text (first 300 chars):', jsonText.substring(0, 300));
    console.log('[Evaluation Provider] 🔍 Extracted JSON text (last 200 chars):', jsonText.substring(Math.max(0, jsonText.length - 200)));

    try {
      const parsed = JSON.parse(jsonText);
      console.log('[Evaluation Provider] ✅ Successfully parsed JSON');
      return {
        overallFeedback: parsed.overall_feedback || '',
        positiveAspects: parsed.positive_aspects || '',
        improvementSuggestions: parsed.improvement_suggestions || '',
        hostFeedback: parsed.host_feedback || '',
        teamFeedback: parsed.team_feedback || '',
        atmosphereComment: parsed.atmosphere_comment || '',
        discussionDepthComment: parsed.discussion_depth_comment || '',
        timeManagementComment: parsed.time_management_comment || '',
        engagementComment: parsed.engagement_comment || '',
      };
    } catch (error) {
      console.error('[Evaluation Provider] ❌ Failed to parse JSON:', error);
      console.error('[Evaluation Provider] 📄 Full response text:', text);
      console.error('[Evaluation Provider] 📄 Attempted to parse:', jsonText);
      throw new Error('Failed to parse evaluation response');
    }
  }
}

export function createEvaluationProvider(): EvaluationProvider {
  return new GeminiEvaluationProvider();
}
