/**
 * Google AI 設定ファイル
 *
 * STT v2, Gemini, TTS の設定を一元管理
 */

/**
 * Google Cloud プロジェクト設定
 */
export const GOOGLE_CLOUD_CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || "",
  location: process.env.GOOGLE_CLOUD_LOCATION || "asia-northeast1",
  recognizer: process.env.GOOGLE_CLOUD_RECOGNIZER || "",
  // このプロジェクト専用の認証ファイルパス
  credentialsPath: "./google-credentials.json",
} as const;

/**
 * Speech-to-Text v2 設定
 */
export const STT_CONFIG = {
  // Recognizer リソース名（事前作成済み）
  recognizer: GOOGLE_CLOUD_CONFIG.recognizer,

  // ストリーミング設定
  streamingConfig: {
    config: {
      // 自動デコード（音声フォーマット自動判定）
      autoDecodingConfig: {},
      // または明示的デコード:
      // explicitDecodingConfig: {
      //   encoding: 'LINEAR16',
      //   sampleRateHertz: 16000,
      //   audioChannelCount: 1,
      // },
      languageCodes: ["ja-JP"],
      model: process.env.STT_MODEL || "chirp_3",
      features: {
        enableAutomaticPunctuation: true,
        // 話者識別（Recognizer作成時に設定）
        // diarizationConfig: {
        //   enableSpeakerDiarization: true,
        //   minSpeakerCount: 2,
        //   maxSpeakerCount: 10,
        // },
      },
    },
    streamingFeatures: {
      interimResults: true, // 部分結果を有効化
    },
  },
} as const;

/**
 * Gemini 2.0 設定
 */
export const GEMINI_CONFIG = {
  // モデル選択（環境変数で上書き可能、デフォルトは最新の Gemini 2.5 Flash）
  model: process.env.GEMINI_MODEL_ID || "gemini-2.5-flash",
  // ロケーション（global をデフォルトにし、環境変数で上書き可）
  location: process.env.VERTEX_LOCATION || "global",
  projectId: GOOGLE_CLOUD_CONFIG.projectId,

  // 生成設定
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 500,
    topP: 0.8,
    topK: 40,
  },

  // 安全性設定
  safetySettings: [
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_ONLY_HIGH",
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "BLOCK_ONLY_HIGH",
    },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_ONLY_HIGH",
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_ONLY_HIGH",
    },
  ],
} as const;

/**
 * Text-to-Speech 設定
 */
export const TTS_CONFIG = {
  // 音声設定
  voice: {
    languageCode: "ja-JP",
    name: "ja-JP-Neural2-B", // 男性の声
    ssmlGender: "MALE" as const,
  },

  // 音声エンコーディング
  audioConfig: {
    audioEncoding: "LINEAR16" as const,
    sampleRateHertz: 24000,
    speakingRate: 1.0,
    pitch: 0.0,
  },
} as const;

/**
 * トリガーパターン設定
 */
export const TRIGGER_PATTERNS = {
  // 直接呼びかけ
  DIRECT_CALL: [
    /AI[君くんさん]?/,
    /[Mm]iton/,
    /ミトン/,
    /アシスタント/,
  ],

  // 要約依頼
  SUMMARY_REQUEST: [
    /まとめ(て|てください)?/,
    /整理(して|してください)?/,
    /要約(して|してください)?/,
  ],

  // 調査依頼
  RESEARCH_REQUEST: [
    /調べて/,
    /検索(して|してください)?/,
    /探して/,
    /調査(して|してください)?/,
    /確認(して|してください)?/,
  ],

  // 質問
  QUESTION: [
    /[？?]$/,
    /どう思[う|い|います]/,
    /意見(は|を|ある)?/,
    /考え(は|を|ある)?/,
  ],
} as const;

/**
 * トリガー判定設定
 */
export const TRIGGER_CONFIG = {
  // 時間ベーストリガー（ミリ秒）
  LONG_SPEECH_MS: 30000, // 30秒
  SILENCE_MS: 10000, // 10秒

  // 頻度制御（ミリ秒）
  MIN_INTERVAL_MS: 10000, // 10秒（テスト用に短縮、本番は120000推奨）
} as const;

/**
 * コスト計算用の料金設定（USD）
 */
export const PRICING = {
  // Google STT v2 (Standard)
  stt: {
    perMinute: 0.016,
  },

  // Gemini 1.5 Flash
  gemini: {
    inputPer1MTokens: 0.075,
    outputPer1MTokens: 0.3,
  },

  // Google TTS (Neural2)
  tts: {
    per1MCharacters: 16.0,
  },
} as const;
