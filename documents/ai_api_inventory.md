# 生成AI API 一覧 - Care Meeting Assistant

このドキュメントは、Care Meeting Assistantで使用しているすべての生成AI APIを整理したものです。

---

## 📊 概要サマリー

| No | API名 | プロバイダー | 主な用途 | 状態 |
|----|-------|------------|---------|------|
| 1 | Speech-to-Text V2 | Google Cloud | 会議・言語交換の文字起こし | ✅ 稼働中 |
| 2 | Text-to-Speech | Google Cloud | AI応答の音声合成 | ✅ 稼働中 |
| 3 | Translation API | Google Cloud | 言語交換の翻訳 | ✅ 稼働中 |
| 4 | Gemini 2.5 Flash | Google Cloud Vertex AI | サマリー生成・会議評価 | ✅ 稼働中 |
| 5 | Gemini Live API | Google Cloud Vertex AI | リアルタイムAI（用語解説） | ✅ 稼働中 |
| 6 | OpenAI Chat | OpenAI | 議論アシスト | ✅ 稼働中 |
| 7 | OpenAI Realtime | OpenAI | リアルタイム音声AI | 🔶 削除予定 |

---

## 1. Google Cloud Speech-to-Text V2

### 📌 基本情報
- **プロバイダー**: Google Cloud
- **使用箇所**: 会議の文字起こし、言語交換モード
- **SDKバージョン**: `@google-cloud/speech` v7.2.1

### 🔌 接続方法
- **認証方式**: サービスアカウント（google-credentials.json）
- **プロジェクトID**: `meeting-supporter`
- **リージョン**: `asia-northeast1`
- **APIエンドポイント**: `/api/stt/stream` (本番), `/api/stt/upload` (音声アップロード)

### 🤖 使用モデル
- **Chirp 3モデル**: 高精度な音声認識（環境変数: `STT_MODEL=chirp_3`）
- **Longモデル**: 多言語対応（言語交換モードで使用）
- **Recognizer**: `projects/meeting-supporter/locations/asia-northeast1/recognizers/meeting-ja-no-diarization`

### 🌐 対応言語
- 日本語（ja-JP）
- 英語（en-US）
- スウェーデン語（sv-SE）
- 韓国語（ko-KR）
- 中国語（zh-CN）
- スペイン語、フランス語、ドイツ語、イタリア語、ポルトガル語、ロシア語、トルコ語、タイ語、ベトナム語

### 💰 料金（2025年1月時点）
- **標準モデル**: $0.024/分（60秒未満は60秒として課金）
- **Chirp 3モデル**: $0.016/分（より安価）
- **データロギング有効**: さらに割引あり（$0.012/分）

**月間使用量による割引**:
- 0-60分: 通常価格
- 60分以降: 割引適用

**実装での使用例**:
```typescript
// コスト計算（cost-tracker.ts）
google_stt: {
  unit: 'minute',
  pricePerUnit: 0.024,
}
```

### 📂 主要ファイル
- `/src/app/api/stt/stream/route.ts` - SSEストリーミング（本番）
- `/src/app/api/stt/upload/route.ts` - 音声データアップロード
- `/src/app/api/stt/test/route.ts` - テスト用（V1 API）
- `/src/lib/google-ai/stt-session.ts` - セッション管理
- `/src/lib/google-ai/config.ts` - 設定

### ⚙️ 主な機能
- リアルタイムストリーミング認識
- Partial結果（認識途中）とFinal結果（確定）の両方をサポート
- 自動句読点挿入
- 多言語同時認識（言語交換モード）
- 話者認識は無効化（no-diarization）

---

## 2. Google Cloud Text-to-Speech

### 📌 基本情報
- **プロバイダー**: Google Cloud
- **使用箇所**: AI応答の音声合成
- **SDKバージョン**: `@google-cloud/text-to-speech` v6.4.0

### 🔌 接続方法
- **認証方式**: サービスアカウント（google-credentials.json）
- **APIエンドポイント**: `/api/tts/synthesize`

### 🤖 使用モデル
- **音声名**: `ja-JP-Neural2-B`
- **言語**: 日本語（ja-JP）
- **性別**: 男性（MALE）
- **音声タイプ**: Neural2（ニューラルネットワークベース）

### 🎵 音声設定
- **エンコーディング**: LINEAR16（PCM）
- **サンプルレート**: 24000 Hz
- **対応機能**:
  - SSML（Speech Synthesis Markup Language）
  - 速度調整（rate）
  - ピッチ調整（pitch）
  - 韻律制御（prosody）

### 💰 料金（2025年1月時点）
- **Neural2音声**: $16.00 / 100万文字
- **Standard音声**: $4.00 / 100万文字
- **WaveNet音声**: $16.00 / 100万文字

**月間無料枠**:
- Standard: 400万文字/月
- WaveNet/Neural2: 100万文字/月

### 📂 主要ファイル
- `/src/app/api/tts/synthesize/route.ts` - 音声合成エンドポイント

---

## 3. Google Cloud Translation API V2

### 📌 基本情報
- **プロバイダー**: Google Cloud
- **使用箇所**: 言語交換モードの翻訳
- **SDKバージョン**: `@google-cloud/translate` v9.3.0

### 🔌 接続方法
- **認証方式**: サービスアカウント（google-credentials.json）
- **APIエンドポイント**: `/api/translation/batch`

### 🤖 機能
- **言語検出**: 自動で元言語を検出
- **バッチ翻訳**: 複数の言語に同時翻訳（並列処理）
- **対応言語**: 100言語以上

**アプリでの使用言語**:
- 英語（en）
- 日本語（ja）
- スウェーデン語（sv）
- 韓国語（ko）
- 中国語（zh）
- その他多数

### 💰 料金（2025年1月時点）
- **Translation API v2**: $20.00 / 100万文字
- **Advanced Translation (v3)**: $20.00 / 100万文字
- **言語検出**: $20.00 / 100万文字

**月間無料枠**:
- 最初の50万文字まで無料

### 📂 主要ファイル
- `/src/app/api/translation/batch/route.ts` - バッチ翻訳
- `/src/app/api/translation/test/route.ts` - 接続テスト

### 📝 使用例
```typescript
// 1つのテキストを3言語に翻訳
text: "こんにちは"
targetLanguages: ["en", "ja", "sv"]
→ 結果: { en: "Hello", ja: "こんにちは", sv: "Hej" }
```

---

## 4. Google Gemini 2.5 Flash (Vertex AI)

### 📌 基本情報
- **プロバイダー**: Google Cloud Vertex AI
- **使用箇所**: サマリー生成、会議評価、議論応答
- **SDKバージョン**: `@google-cloud/vertexai` v1.10.0, `@google/generative-ai` v0.24.1

### 🔌 接続方法
- **認証方式**: OAuth2（google-auth-library経由）+ サービスアカウント
- **プロジェクトID**: `meeting-supporter`
- **リージョン**: `asia-northeast1`
- **APIエンドポイント**:
  - `/api/gemini/generate` - ストリーミング応答生成
  - `/api/meetings/[meetingId]/summary` - サマリー生成
  - `/api/meetings/[meetingId]/evaluation` - 会議評価

### 🤖 使用モデル
- **モデル名**: `gemini-2.5-flash`
- **環境変数**:
  - `GEMINI_TEST_MODEL=gemini-2.5-flash`
  - `GEMINI_SUMMARY_MODEL=gemini-2.5-flash`

### ⚙️ 生成設定
```typescript
// 応答生成用
{
  temperature: 0.7,      // 創造性（0-1）
  maxOutputTokens: 500,  // 最大出力トークン数
  topP: 0.8,
  topK: 40
}

// サマリー生成用
{
  temperature: 0.3,      // 正確性重視
  maxOutputTokens: 2048
}
```

### 🛡️ 安全性設定
- ハラスメント: BLOCK_ONLY_HIGH
- ヘイトスピーチ: BLOCK_ONLY_HIGH
- 性的コンテンツ: BLOCK_ONLY_HIGH
- 危険なコンテンツ: BLOCK_ONLY_HIGH

### 💰 料金（2025年1月時点）
**Gemini 2.5 Flash**:
- **入力**: $0.075 / 100万トークン（128K以下）
- **出力**: $0.30 / 100万トークン（128K以下）
- **128K超の場合**: 入力 $0.15、出力 $0.60 / 100万トークン

**無料枠**（Vertex AI）:
- なし（従量課金のみ）

### 📂 主要ファイル
- `/src/app/api/gemini/generate/route.ts` - ストリーミング生成
- `/src/lib/ai/summary-providers.ts` - サマリー生成ロジック
- `/src/lib/ai/evaluation-provider.ts` - 評価生成ロジック
- `/src/lib/google-ai/config.ts` - 設定

### 📝 使用例

**1. サマリー生成**:
```json
{
  "summaryText": "今回の会議では...",
  "keyDecisions": [
    { "decision": "新機能をリリース", "context": "..." }
  ],
  "actionItems": [
    { "item": "仕様書作成", "assignee": "山田さん", "deadline": "2025-01-20" }
  ],
  "topicsDiscussed": ["機能開発", "リリース計画"]
}
```

**2. 会議評価**:
```json
{
  "overallScore": 8.5,
  "categories": {
    "clarity": { "score": 9, "feedback": "..." },
    "participation": { "score": 8, "feedback": "..." }
  },
  "strengths": ["明確な目標設定"],
  "improvements": ["時間管理の改善"],
  "detailedFeedback": "..."
}
```

---

## 5. Google Gemini 2.0 Flash EXP (Live API)

### 📌 基本情報
- **プロバイダー**: Google Cloud Vertex AI
- **使用箇所**: リアルタイムAI（用語解説、トリガー式応答）
- **SDKバージョン**: `@google/genai` v0.7.0

### 🔌 接続方法
- **認証方式**: OAuth2 エフェメラルトークン（1時間有効）
- **接続タイプ**: WebSocket（`wss://generativelanguage.googleapis.com`）
- **APIエンドポイント**: `/api/gemini/live-session` - トークン生成

### 🤖 使用モデル
- **モデル名**: `gemini-2.0-flash-exp`
- **環境変数**: `GEMINI_LIVE_MODEL=gemini-2.0-flash-exp`

### ⚙️ 機能
- **リアルタイム双方向通信**: 音声・テキスト両対応
- **ツール/関数呼び出し**:
  - `internet_search` - Web検索
  - `meeting_summary_lookup` - 過去会議検索
  - `get_past_meeting_summary` - サマリー取得
- **プロファイル**:
  - `assistant` - 汎用アシスタント
  - `terminology_helper` - 用語解説専門
  - `tools_demo` - ツール実演
  - `function_calling_demo` - 関数呼び出しデモ

### 💰 料金（2025年1月時点）
**Gemini 2.0 Flash EXP** (Experimental):
- **現在**: 無料（実験段階）
- **将来**: 正式版リリース後は従量課金予定

**注意**: 実験版のため、本番環境での使用は推奨されません。

### 📂 主要ファイル
- `/src/app/api/gemini/live-session/route.ts` - WebSocketトークン生成
- `/src/hooks/useRealtimeAI.ts` - クライアント側WebSocket接続
- `/src/lib/ai/ai-message-recorder.ts` - メッセージ記録

### 🔄 削除予定
このAPIは今後、より安定したバージョンに置き換えられる可能性があります。

---

## 6. OpenAI Chat Completions API

### 📌 基本情報
- **プロバイダー**: OpenAI
- **使用箇所**: 議論アシスト機能
- **SDKバージョン**: `openai` v6.8.1

### 🔌 接続方法
- **認証方式**: APIキー（`OPENAI_API_KEY`）
- **APIエンドポイント**: `/api/discussion-assist/openai`

### 🤖 使用モデル
- **モデル名**: `gpt-4o-mini`
- **環境変数**: `OPENAI_MODEL=gpt-4o-mini`

### ⚙️ 生成設定
```typescript
{
  temperature: 0.7,
  max_tokens: 2048,
  stream: true  // ストリーミングレスポンス
}
```

### 🎯 機能
- **チェックポイントモード**: サマリー生成
- **チャットモード**: 議論サポート
- **アジェンダ提案**: 会議の進行支援
- **アクションアイテム追跡**: タスク管理サポート

### 💰 料金（2025年1月時点）
**GPT-4o Mini**:
- **入力**: $0.150 / 100万トークン
- **出力**: $0.600 / 100万トークン

**GPT-4o** (もし変更する場合):
- **入力**: $5.00 / 100万トークン
- **出力**: $15.00 / 100万トークン

**無料枠**: なし

### 📂 主要ファイル
- `/src/app/api/discussion-assist/openai/route.ts` - Chat Completions API

---

## 7. OpenAI Realtime API 🔶 削除予定

### 📌 基本情報
- **プロバイダー**: OpenAI
- **使用箇所**: リアルタイム音声AIモード
- **SDKバージョン**: `openai` v6.8.1

### 🔌 接続方法
- **認証方式**: エフェメラルトークン（60秒有効）
- **接続タイプ**: WebRTC（Peer Connection + Data Channel）
- **APIエンドポイント**: `/api/realtime/token` - トークン生成

### 🤖 使用モデル
- **モデル名**: `gpt-4o-realtime-preview-2024-10-01`
- **音声**: `alloy`（音声合成）

### 🎵 音声設定
- **フォーマット**: PCM16
- **サンプルレート**: 24000 Hz
- **チャンネル**: モノラル（1ch）
- **VAD**: サーバー側音声検出
- **ターン検出**: 700ms無音で発話終了
- **入力音声文字起こし**: Whisper-1モデル

### 💰 料金（2025年1月時点）
**GPT-4o Realtime**:
- **テキスト入力**: $5.00 / 100万トークン
- **テキスト出力**: $20.00 / 100万トークン
- **音声入力**: $100.00 / 100万トークン
- **音声出力**: $200.00 / 100万トークン

**実装でのコスト追跡**:
```typescript
// cost-tracker.ts
openai_realtime_text: {
  input: { unit: 'token', pricePerUnit: 5.0 / 1_000_000 },
  output: { unit: 'token', pricePerUnit: 20.0 / 1_000_000 }
},
openai_realtime_audio: {
  input: { unit: 'token', pricePerUnit: 100.0 / 1_000_000 },
  output: { unit: 'token', pricePerUnit: 200.0 / 1_000_000 }
}
```

### 📂 主要ファイル
- `/src/app/api/realtime/token/route.ts` - トークン生成
- `/src/hooks/useRealtimeAI.ts` - WebRTC接続（lines 269-295, 560-575）

### ⚠️ 削除予定の理由
- コストが非常に高い（音声処理）
- Gemini Live APIで代替可能
- 実験的なAPIのため安定性に懸念

---

## 8. 環境変数一覧

### 📝 `.env.local` 設定

```bash
# Google Cloud 設定
GOOGLE_CLOUD_PROJECT_ID=meeting-supporter
GOOGLE_CLOUD_LOCATION=asia-northeast1
GOOGLE_CLOUD_RECOGNIZER=projects/meeting-supporter/locations/asia-northeast1/recognizers/meeting-ja-no-diarization

# Gemini 設定
GEMINI_API_KEY=AIzaSyDaxg-...
GEMINI_TEST_MODEL=gemini-2.5-flash
GEMINI_LIVE_MODEL=gemini-2.0-flash-exp
GEMINI_SUMMARY_MODEL=gemini-2.5-flash
GEMINI_ENABLE_SEARCH=true

# STT 設定
STT_MODEL=chirp_3

# OpenAI 設定
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# アプリケーション設定
NEXT_PUBLIC_SITE_URL=http://localhost:3500
```

### 🔑 認証ファイル

1. **google-credentials.json**
   - Google Cloud サービスアカウント
   - STT, TTS, Translation, Vertex AI で使用

2. **live_api_auth.json**
   - Gemini Live API専用サービスアカウント
   - WebSocket接続のトークン生成に使用

---

## 9. コスト試算例

### 📊 月間使用量の想定

**会議機能**（1時間の会議を月20回開催）:
- STT: 20時間 × $0.024/分 × 60分 = **$28.80**
- Gemini Summary: 20回 × 2000トークン × $0.30/1M = **$0.012**
- Gemini Evaluation: 20回 × 1500トークン × $0.30/1M = **$0.009**

**言語交換機能**（1時間のセッションを月10回）:
- STT: 10時間 × $0.024/分 × 60分 = **$14.40**
- Translation: 10回 × 3000文字 × $20/1M = **$0.60**

**AI応答機能**（月100回応答、平均500トークン）:
- Gemini Generate: 100回 × 500トークン × $0.30/1M = **$0.015**
- TTS: 100回 × 200文字 × $16/1M = **$0.32**

### 💵 月間合計コスト試算
- **STT**: $43.20
- **Translation**: $0.60
- **Gemini**: $0.356
- **TTS**: $0.32
- **合計**: 約 **$44.50/月**

**注意**: OpenAI Realtime APIを使用すると、コストが大幅に増加します（音声処理は$100-200/1Mトークン）。

---

## 10. パッケージ依存関係

### 📦 package.json (AI/ML関連)

```json
{
  "@google-cloud/speech": "^7.2.1",
  "@google-cloud/text-to-speech": "^6.4.0",
  "@google-cloud/translate": "^9.3.0",
  "@google-cloud/vertexai": "^1.10.0",
  "@google/genai": "^0.7.0",
  "@google/generative-ai": "^0.24.1",
  "google-auth-library": "^10.5.0",
  "openai": "^6.8.1"
}
```

---

## 11. 機能別API使用マップ

### 🗺️ 各機能で使用するAPI

| 機能 | 使用API | 主なコスト |
|-----|--------|----------|
| **会議（文字起こし）** | Google STT V2 | $0.024/分 |
| **会議（サマリー生成）** | Gemini 2.5 Flash | $0.30/1Mトークン（出力） |
| **会議（評価）** | Gemini 2.5 Flash | $0.30/1Mトークン（出力） |
| **言語交換（文字起こし）** | Google STT V2 | $0.024/分 |
| **言語交換（翻訳）** | Google Translation | $20/100万文字 |
| **用語解説（Live）** | Gemini 2.0 Flash EXP | 現在無料（実験版） |
| **議論アシスト** | OpenAI GPT-4o Mini | $0.15/1Mトークン（入力） |
| **AI応答音声** | Google TTS | $16/100万文字 |
| **🔶 リアルタイムAI（削除予定）** | OpenAI Realtime | $100-200/1Mトークン |

---

## 12. 今後の方針

### ✅ 継続使用
1. **Google Cloud STT V2** - 文字起こしの主力
2. **Google Translation** - 言語交換の翻訳
3. **Gemini 2.5 Flash** - サマリー・評価生成
4. **Gemini Live API** - リアルタイム応答（用語解説）
5. **OpenAI Chat** - 議論アシスト（オプション機能）

### 🔶 削除予定
1. **OpenAI Realtime API** - コストが高く、Gemini Liveで代替可能
2. **AIアシスタント（トリガー式）** - 機能統合の予定

### 🔍 検討事項
- OpenAI Chat を Gemini に統一できるか？（コスト削減）
- STT の Chirp 3 モデルでデータロギング有効化（コスト削減: $0.024 → $0.012/分）

---

## 13. 参考リンク

### 📚 ドキュメント
- [Google Cloud Speech-to-Text V2](https://cloud.google.com/speech-to-text/v2/docs)
- [Google Cloud Translation](https://cloud.google.com/translate/docs)
- [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech/docs)
- [Vertex AI Gemini](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)

### 💰 料金ページ
- [Google Cloud Speech-to-Text 料金](https://cloud.google.com/speech-to-text/pricing)
- [Google Cloud Translation 料金](https://cloud.google.com/translate/pricing)
- [Vertex AI 料金](https://cloud.google.com/vertex-ai/pricing)
- [OpenAI 料金](https://openai.com/pricing)

---

**最終更新日**: 2025-01-16
**作成者**: Claude Code
**バージョン**: 1.0
