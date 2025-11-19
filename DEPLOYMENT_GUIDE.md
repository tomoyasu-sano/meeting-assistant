# Google Cloud Run デプロイガイド

このドキュメントでは、Meeting AssistantをGoogle Cloud Runにデプロイする手順を説明します。

---

## 📋 前提条件

### 必要なツール
- [x] Google Cloud SDK (gcloud) インストール済み
- [x] Docker インストール済み
- [x] GitHubリポジトリ作成済み

### 必要なアカウント
- Google Cloudアカウント
- 課金が有効化されたGCPプロジェクト
- 必要なAPIキー:
  - Supabase (URL, ANON_KEY, SERVICE_ROLE_KEY)
  - Google Cloud (Speech-to-Text, TTS, Vertex AI)
  - OpenAI API Key
  - Google AI (Gemini) API Key

---

## 🚀 デプロイ手順

### Step 1: gcloud認証

```bash
# Google Cloudにログイン
gcloud auth login

# プロジェクトを設定
gcloud config set project meeting-supporter

# 認証確認
gcloud config list
```

### Step 2: 必要なAPIを有効化

```bash
# Cloud Run API
gcloud services enable run.googleapis.com

# Container Registry API
gcloud services enable containerregistry.googleapis.com

# Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# Speech-to-Text API (既に有効かもしれません)
gcloud services enable speech.googleapis.com

# Text-to-Speech API
gcloud services enable texttospeech.googleapis.com
```

### Step 3: デプロイスクリプトを実行

```bash
# デプロイスクリプトに実行権限を付与
chmod +x deploy-cloudrun.sh

# デプロイ実行
./deploy-cloudrun.sh
```

このスクリプトは以下を自動で行います:
1. Docker イメージをCloud Buildでビルド
2. Container Registry にプッシュ
3. Cloud Run にデプロイ

### Step 4: 環境変数を設定

#### 方法A: スクリプトを使用（推奨）

```bash
# .env.localファイルが存在することを確認
ls -la .env.local

# 環境変数設定スクリプトを実行
chmod +x set-env-vars.sh
./set-env-vars.sh
```

#### 方法B: 手動で設定

```bash
gcloud run services update meeting-assistant \
  --region asia-northeast1 \
  --update-env-vars \
    NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co,\
    NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx,\
    SUPABASE_SERVICE_ROLE_KEY=xxx,\
    GOOGLE_CLOUD_PROJECT=meeting-supporter,\
    GOOGLE_CLOUD_REGION=us-central1,\
    OPENAI_API_KEY=sk-xxx,\
    GOOGLE_API_KEY=xxx \
  --project meeting-supporter
```

#### 方法C: Secret Manager使用（本番環境推奨）

機密情報はSecret Managerに保存するのがベストプラクティスです:

```bash
# Secretを作成
echo -n "your-api-key" | gcloud secrets create OPENAI_API_KEY \
  --data-file=- \
  --replication-policy="automatic"

# Cloud RunサービスにSecret Managerへのアクセス権限を付与
gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Cloud RunサービスでSecretを使用
gcloud run services update meeting-assistant \
  --region asia-northeast1 \
  --update-secrets=OPENAI_API_KEY=OPENAI_API_KEY:latest
```

### Step 5: Google Cloud認証情報の設定

`google-credentials.json`はコンテナに含めることができないため、以下の方法で設定:

#### オプション1: Workload Identity使用（推奨）

```bash
# サービスアカウントを作成
gcloud iam service-accounts create meeting-assistant-sa \
  --display-name="Meeting Assistant Service Account"

# 必要な権限を付与
gcloud projects add-iam-policy-binding meeting-supporter \
  --member="serviceAccount:meeting-assistant-sa@meeting-supporter.iam.gserviceaccount.com" \
  --role="roles/speech.admin"

gcloud projects add-iam-policy-binding meeting-supporter \
  --member="serviceAccount:meeting-assistant-sa@meeting-supporter.iam.gserviceaccount.com" \
  --role="roles/texttospeech.admin"

# Cloud Runサービスにサービスアカウントを設定
gcloud run services update meeting-assistant \
  --region asia-northeast1 \
  --service-account=meeting-assistant-sa@meeting-supporter.iam.gserviceaccount.com
```

#### オプション2: Secret Managerに保存

```bash
# google-credentials.jsonをSecretとして保存
gcloud secrets create google-credentials \
  --data-file=./google-credentials.json

# Cloud Runで使用
gcloud run services update meeting-assistant \
  --region asia-northeast1 \
  --update-secrets=GOOGLE_APPLICATION_CREDENTIALS=/secrets/google-credentials:latest
```

### Step 6: デプロイ確認

```bash
# サービスURLを取得
gcloud run services describe meeting-assistant \
  --region asia-northeast1 \
  --format 'value(status.url)'

# ログを確認
gcloud run services logs read meeting-assistant \
  --region asia-northeast1 \
  --limit 50
```

ブラウザでサービスURLにアクセスして動作確認してください。

---

## 🔧 トラブルシューティング

### ビルドエラー

```bash
# ローカルでDockerビルドをテスト
docker build -t meeting-assistant .

# ビルドログを確認
gcloud builds log [BUILD_ID]
```

### メモリ不足エラー

```bash
# メモリを増やす（最大8Gi）
gcloud run services update meeting-assistant \
  --region asia-northeast1 \
  --memory 4Gi
```

### タイムアウトエラー

```bash
# タイムアウトを延長（最大3600秒）
gcloud run services update meeting-assistant \
  --region asia-northeast1 \
  --timeout 600
```

### ログ確認

```bash
# リアルタイムログ
gcloud run services logs tail meeting-assistant \
  --region asia-northeast1

# エラーログのみ
gcloud run services logs read meeting-assistant \
  --region asia-northeast1 \
  --filter="severity>=ERROR"
```

---

## 📊 コスト最適化

### 無料枠
- 月間200万リクエスト無料
- 月間36万vCPU秒無料
- 月間18万GiB秒メモリ無料

### 最適化設定

```bash
# 最小インスタンス数を0に設定（使用していない時は課金されない）
gcloud run services update meeting-assistant \
  --region asia-northeast1 \
  --min-instances 0 \
  --max-instances 10

# CPU常時割り当てを無効化（リクエスト処理時のみCPU使用）
gcloud run services update meeting-assistant \
  --region asia-northeast1 \
  --cpu-throttling
```

---

## 🔐 セキュリティベストプラクティス

1. **環境変数ではなくSecret Managerを使用**
   - API キー
   - データベース認証情報
   - Google Cloud認証情報

2. **最小権限の原則**
   - サービスアカウントに必要最小限の権限のみ付与

3. **認証設定**
   ```bash
   # 認証を要求する場合
   gcloud run services update meeting-assistant \
     --region asia-northeast1 \
     --no-allow-unauthenticated
   ```

4. **HTTPS強制**
   - Cloud RunはデフォルトでHTTPS強制

---

## 🔄 継続的デプロイ (CI/CD)

### GitHub Actionsでの自動デプロイ

`.github/workflows/deploy.yml`を作成:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Google Auth
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v1
        with:
          service: meeting-assistant
          region: asia-northeast1
          source: ./
```

---

## 📝 デプロイ後のチェックリスト

- [ ] サービスURLにアクセスできる
- [ ] ログイン機能が動作する
- [ ] Supabase接続が正常
- [ ] Google Cloud Speech-to-Text が動作
- [ ] AI機能（Gemini/OpenAI）が動作
- [ ] 環境変数がすべて設定されている
- [ ] エラーログがない
- [ ] README.mdにデプロイURLを追加

---

## 🆘 サポート

問題が発生した場合:

1. ログを確認: `gcloud run services logs read meeting-assistant --region asia-northeast1`
2. サービス詳細: `gcloud run services describe meeting-assistant --region asia-northeast1`
3. Google Cloud Console: https://console.cloud.google.com/run

---

## 📚 参考リンク

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
