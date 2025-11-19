# OpenAI API セットアップ手順

Stage 6（リアルタイム文字起こし）では、OpenAI Whisper APIを使用します。

## ステップ1: OpenAI APIキーの取得

### 新規の場合

1. https://platform.openai.com/ にアクセス
2. 「Sign up」から新規アカウントを作成
3. 左メニューから「API keys」をクリック
4. 「Create new secret key」をクリック
5. 名前を入力（例: "care-meeting-assistant"）
6. 「Create secret key」をクリック
7. 表示されたAPIキーをコピー（**この画面でしか確認できません！**）

### 既存アカウントの場合

1. https://platform.openai.com/api-keys にアクセス
2. 「Create new secret key」をクリック
3. 名前を入力（例: "care-meeting-assistant"）
4. 「Create secret key」をクリック
5. 表示されたAPIキーをコピー

## ステップ2: 環境変数に追加

プロジェクトの `.env.local` ファイルを開き、以下を追加：

```bash
# OpenAI API
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**注意:**
- APIキーは `sk-proj-` または `sk-` で始まります
- 約51文字の長い文字列です
- 絶対にGitHubなどに公開しないでください

## ステップ3: 開発サーバーを再起動

環境変数を読み込むため、開発サーバーを再起動：

```bash
# Ctrl+C で停止
npm run dev
```

## ステップ4: 動作確認

OpenAI APIキーが正しく設定されているか確認：

```bash
node -e "console.log(process.env.OPENAI_API_KEY ? 'OK' : 'NG')"
```

「OK」と表示されればOKです。

## 料金について

### Whisper API 料金（2025年2月時点）

- **whisper-1**: $0.006 / 分

**例:**
- 30分の会議: $0.18（約27円）
- 1時間の会議: $0.36（約54円）

非常に安価ですが、使用状況は以下で確認できます：
https://platform.openai.com/usage

### 無料クレジット

新規アカウントには$5の無料クレジットが付与されます（3ヶ月間有効）。

### 支払い方法の設定

https://platform.openai.com/settings/organization/billing にアクセスし、クレジットカードを登録してください。

## トラブルシューティング

### エラー: "Incorrect API key provided"

**原因:** APIキーが間違っている

**解決策:**
1. `.env.local` のAPIキーを再確認
2. コピー時に余分なスペースが入っていないか確認
3. 開発サーバーを再起動

### エラー: "You exceeded your current quota"

**原因:** 無料クレジットを使い切った、または支払い方法が未設定

**解決策:**
1. https://platform.openai.com/settings/organization/billing で支払い方法を設定
2. 使用状況を確認: https://platform.openai.com/usage

### エラー: "Rate limit exceeded"

**原因:** リクエストが多すぎる（無料枠: 3 RPM = 1分あたり3リクエスト）

**解決策:**
- 有料プラン（Pay as you go）にアップグレード
- リクエスト間隔を調整（例: 10秒→20秒）

## セキュリティベストプラクティス

1. **APIキーをGitに含めない**
   - `.env.local` は `.gitignore` に含まれているか確認
   ```bash
   git check-ignore .env.local
   # .env.local と表示されればOK
   ```

2. **定期的にAPIキーをローテーション**
   - 3〜6ヶ月ごとに新しいキーを作成
   - 古いキーを削除

3. **使用状況を監視**
   - https://platform.openai.com/usage で確認
   - 予想外の課金がないかチェック

---

準備が整ったら、会議実行ページの実装に進みます。
