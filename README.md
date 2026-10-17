# mottainAI

食材の購入・在庫・献立・調理・買い物をひとつの循環にする、日本語のモバイルファーストWebアプリです。期限の近さだけでなく、残量・開封状態・消費ペースを使った説明可能な食品ロス推定を行います。

## 現在の実装

- ダッシュボード、在庫検索・絞り込み・手動追加・削除
- 在庫と期限を使うルールベースのレシピ順位、スコア理由表示
- 調理前の使用量・ロット確認と、在庫超過を拒否する消費処理
- レシート画像選択、確認画面、Gemini構造化出力API
- 買い物リストの追加・完了・削除
- 食品ロスリスクと安全上の注意、生活条件設定
- Supabase PostgreSQLの全テーブル、RLS、インデックス、制約
- 二重調理を防ぐ冪等キー付き消費RPCと、履歴からの取消RPC
- Gemini/Supabase未設定でも操作できるデモモード

ブラウザ版のデモデータは端末内の表示確認用です。Supabase接続後の実データとは混在しません。

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

`http://localhost:3000` を開きます。Node.js 22.13以上を使用してください。

### 環境変数

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.7-flash
```

モデル名は固定せず `GEMINI_MODEL` から読みます。画像入力・構造化出力に対応し、利用アカウントで有効なモデルを指定してください。秘密鍵を `NEXT_PUBLIC_` で公開しないでください。

## Supabase

1. Supabaseで新規プロジェクトを作成します。
2. SQL EditorまたはCLIで `supabase/migrations/202610170001_initial.sql` を適用します。
3. `.env.local` にURLとPublishable Keyを設定します。
4. Authのメールログイン等、利用するプロバイダーを有効にします。

全ユーザー固有テーブルでRLSを有効化しています。`consume_inventory` は対象ロットを行ロックし、在庫減算と履歴保存を同一トランザクションで処理します。同じ `idempotency_key` は同じ履歴IDを返すため、二重クリックによる二重消費を防ぎます。期限不明は `expires_at = null / expiry_type = 'unset'` のまま保存します。

## Geminiレシート解析

`POST /api/receipts/analyze` に `image` のmultipart form-dataを送ります。JPEG/PNG/WebP、10MB以下だけを許可し、20秒でタイムアウトします。出力はJSON Schemaで制約し、さらにZodで検証します。画像のSHA-256を返すため、`receipts(user_id, content_hash)` の一意制約で二重登録を拒否できます。AI出力から期限を生成しません。

## 検証

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

Playwrightの初回だけ `npx playwright install chromium` が必要です。

## デプロイ上の注意

公開デモはChatGPT Sitesのログイン境界で保護されます。通常のNext.jsホスティングでSupabase Authを使用するときは `@supabase/ssr` のクライアントを使い、公式ガイドに沿ってセッション更新用Proxyを追加してください。認証情報はデプロイ先のシークレットとして設定します。

## 本番接続前に必要なこと

UIとDB/API境界は実装済みですが、認証情報がないため公開デモはデモデータで動作します。実運用では画面のstate操作をSupabase CRUDへ接続し、レシート確認後の登録を認証済みサーバー処理に置き換えてください。通知の定期実行、レシート画像の短期保管ポリシー、運用監視も本番環境ごとに設定が必要です。
