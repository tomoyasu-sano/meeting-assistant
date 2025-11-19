/**
 * 要約生成プロバイダーの抽象化レイヤー
 * Vertex AI Gemini APIを使用
 */

import { VertexAI } from '@google-cloud/vertexai';
import path from 'path';

export type SummaryResult = {
  summaryText: string;
  keyDecisions: Array<{ decision: string; context?: string }>;
  actionItems: Array<{ item: string; assignee?: string; deadline?: string }>;
  topicsDiscussed: string[];
};

export type SummaryProviderType = 'gemini' | 'openai' | 'custom';

/**
 * 要約プロバイダーのインターフェース
 */
export interface SummaryProvider {
  generateSummary(conversationText: string, meetingTitle?: string): Promise<SummaryResult>;
}

/**
 * Gemini プロバイダー（Vertex AI版）
 */
export class GeminiSummaryProvider implements SummaryProvider {
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

  async generateSummary(conversationText: string, meetingTitle?: string): Promise<SummaryResult> {
    // サマリー専用モデル（環境変数で指定可能、デフォルト: gemini-2.5-flash）
    const summaryModel = process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash';

    const prompt = this.buildPrompt(conversationText, meetingTitle);

    console.log('[Summary Provider] 🤖 Generating summary with Vertex AI Gemini...', {
      model: summaryModel,
      project: this.projectId,
      location: this.location,
      meetingTitle,
      textLength: conversationText.length,
    });

    try {
      // Vertex AI SDK初期化
      const vertexAI = new VertexAI({
        project: this.projectId,
        location: this.location,
      });

      const generativeModel = vertexAI.getGenerativeModel({
        model: summaryModel,
      });

      const result = await generativeModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3, // サマリーは正確性重視
          maxOutputTokens: 2048,
        },
      });

      const response = result.response;
      const candidates = response.candidates || [];
      const firstCandidate = candidates[0];
      const content = firstCandidate?.content;
      const parts = content?.parts || [];
      const text = parts.map((p: any) => p.text || '').join('');

      console.log('[Summary Provider] ✅ Summary generated successfully');

      // JSONレスポンスをパース
      const parsed = this.parseResponse(text);
      return parsed;
    } catch (error) {
      console.error('[Summary Provider] ❌ Vertex AI Gemini summary generation error:', error);
      throw new Error('Failed to generate summary with Gemini');
    }
  }

  private buildPrompt(conversationText: string, meetingTitle?: string): string {
    return `あなたは介護サービス会議の要約を作成する専門アシスタントです。以下の会議の文字起こしログから、構造化された要約を生成してください。

**会議タイトル**: ${meetingTitle || '介護サービス会議'}

**会議ログ**:
${conversationText}

---

以下のJSON形式で要約を生成してください：

\`\`\`json
{
  "summaryText": "会議全体の要約（3-5文程度）",
  "keyDecisions": [
    {
      "decision": "決定事項の内容",
      "context": "決定に至った背景や理由（任意）"
    }
  ],
  "actionItems": [
    {
      "item": "実施すべきアクション",
      "assignee": "担当者名（もし明示されている場合）",
      "deadline": "期限（もし明示されている場合）"
    }
  ],
  "topicsDiscussed": ["議論されたトピック1", "トピック2", "トピック3"]
}
\`\`\`

**重要な注意事項**:
- 必ずJSONフォーマットで返してください
- summaryTextは簡潔に、かつ重要なポイントを網羅してください
- keyDecisionsには明確に決定された事項のみを含めてください
- actionItemsには具体的な行動が必要な項目のみを含めてください
- topicsDiscussedには会議で話し合われた主要なテーマを列挙してください
- 参加者のプライバシーに配慮し、不要な個人情報は含めないでください`;
  }

  private parseResponse(text: string): SummaryResult {
    // JSONブロックを抽出（```json ... ``` の中身）
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    try {
      const parsed = JSON.parse(jsonText);
      return {
        summaryText: parsed.summaryText || '',
        keyDecisions: parsed.keyDecisions || [],
        actionItems: parsed.actionItems || [],
        topicsDiscussed: parsed.topicsDiscussed || [],
      };
    } catch (error) {
      console.error('Failed to parse Gemini response as JSON:', error);
      // フォールバック: テキスト全体を要約として返す
      return {
        summaryText: text.substring(0, 1000),
        keyDecisions: [],
        actionItems: [],
        topicsDiscussed: [],
      };
    }
  }
}

/**
 * OpenAI プロバイダー（将来の拡張用）
 */
export class OpenAISummaryProvider implements SummaryProvider {
  async generateSummary(conversationText: string, meetingTitle?: string): Promise<SummaryResult> {
    // TODO: OpenAI APIを使った要約生成を実装
    throw new Error('OpenAI provider is not yet implemented');
  }
}

/**
 * カスタムLLM プロバイダー（将来の拡張用）
 */
export class CustomSummaryProvider implements SummaryProvider {
  async generateSummary(conversationText: string, meetingTitle?: string): Promise<SummaryResult> {
    // TODO: カスタムLLMエンドポイントを使った要約生成を実装
    throw new Error('Custom provider is not yet implemented');
  }
}

/**
 * ファクトリー関数: プロバイダータイプに応じたインスタンスを返す
 */
export function createSummaryProvider(providerType: SummaryProviderType): SummaryProvider {
  switch (providerType) {
    case 'gemini':
      return new GeminiSummaryProvider();
    case 'openai':
      return new OpenAISummaryProvider();
    case 'custom':
      return new CustomSummaryProvider();
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}
