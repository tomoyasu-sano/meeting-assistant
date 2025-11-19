# Supabase Storage バケット作成手順

## ステップ1: バケットを作成

1. Supabaseダッシュボード https://supabase.com/dashboard/project/hmqtyhyzueehwhcfkgld
2. 左メニューから **「Storage」** をクリック
3. **「New bucket」** ボタンをクリック
4. 設定:
   - **Name**: `voice-samples`
   - **Public bucket**: ❌ OFF（チェックを外す）
   - **File size limit**: `2 MB`（デフォルトでOK）
   - **Allowed MIME types**: `audio/webm, audio/wav, audio/mp4`（任意）
5. **「Create bucket」** をクリック

## ステップ2: RLSポリシーを設定

バケット作成後、RLS（Row Level Security）を設定します。

### 方法1: GUIで設定（推奨）

1. Storage画面で `voice-samples` バケットをクリック
2. 右上の **「Policies」** タブをクリック
3. **「New Policy」** をクリック

#### ポリシー1: アップロード権限

- **Policy name**: `Users can upload their own voice samples`
- **Allowed operation**: `INSERT` ✅
- **Target roles**: `authenticated` ✅
- **WITH CHECK expression**:
```sql
bucket_id = 'voice-samples'
AND (storage.foldername(name))[1] = auth.uid()::text
```

#### ポリシー2: 読み取り権限

- **Policy name**: `Users can read their own voice samples`
- **Allowed operation**: `SELECT` ✅
- **Target roles**: `authenticated` ✅
- **USING expression**:
```sql
bucket_id = 'voice-samples'
AND (storage.foldername(name))[1] = auth.uid()::text
```

#### ポリシー3: 削除権限

- **Policy name**: `Users can delete their own voice samples`
- **Allowed operation**: `DELETE` ✅
- **Target roles**: `authenticated` ✅
- **USING expression**:
```sql
bucket_id = 'voice-samples'
AND (storage.foldername(name))[1] = auth.uid()::text
```

### 方法2: SQLで設定

SQL Editorで以下を実行：

```sql
-- アップロード権限
CREATE POLICY "Users can upload their own voice samples"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-samples' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 読み取り権限
CREATE POLICY "Users can read their own voice samples"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-samples' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 削除権限
CREATE POLICY "Users can delete their own voice samples"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-samples' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## ステップ3: 確認

1. Storage画面で `voice-samples` バケットを開く
2. Policiesタブで3つのポリシーが表示されることを確認

## ファイルパスの規則

アプリケーションでは以下の形式でファイルをアップロードします：

```
voice-samples/
  {user_id}/
    {participant_id}_{timestamp}.webm
```

例：
```
voice-samples/123e4567-e89b-12d3-a456-426614174000/abc123-def456_1699876543.webm
```

この形式により、RLSで自分のファイルのみにアクセスできます。
