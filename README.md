# 進捗帖

毎朝開いて、今日やるべきことが一目でわかる個人用タスク管理アプリ。

- フロントエンド: Next.js (App Router) + Tailwind CSS
- DB / 認証: Supabase (PostgreSQL + Supabase Auth + RLS)
- デプロイ: Vercel
- PWA対応（ホーム画面に追加してアプリのように使える）

## セットアップ

### 1. Supabase

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. SQL Editor で `supabase/migrations/` 内のSQLを番号順にすべて実行（`0001_init.sql` → `0002_add_note_to_nodes.sql`）
3. Authentication → Users → **Add user** で自分のユーザー（メール + パスワード、Auto Confirm）を作成
4. サインアップ画面は無いので、必要に応じて Authentication → Sign In / Providers で
   **Allow new users to sign up** をオフにする（RLSにより他ユーザーからデータは見えないが、念のため）

### 2. ローカル起動

```bash
cp .env.local.example .env.local
# NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を記入
# （Supabase の Project Settings → API で確認できる）

npm install
npm run dev
```

### 3. デプロイ (Vercel)

1. GitHubリポジトリにpush
2. [vercel.com](https://vercel.com) でリポジトリをimport
3. Environment Variables に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定
4. Deploy（以降はpushで自動デプロイ）

### 4. PWA

スマホでデプロイ先URLを開き、「ホーム画面に追加」でアプリとして利用できる。

## 構成メモ

- `src/lib/data.ts` … Supabaseへのデータアクセス層（全クエリ・ミューテーション）
- `src/lib/sections.ts` … ホームの並び順ロジック（期限切れ → 今日 → フラグ付き → それ以外）
- `supabase/migrations/` … スキーマ + RLS + DB関数（番号順に実行）
  - `promote_subtask(uuid)` … サブタスクの昇格（1トランザクション）
  - `complete_task(uuid, date)` … タスク完了 + repeat次回分の自動生成（1トランザクション）
- 進捗はサブタスクの完了数から導出（DBには持たない）
- 参照サブタスク（昇格済み）の完了状態はリンク先タスクの status から導出
- アイコンは `npm run gen-icons` で再生成できる（依存ライブラリ不要）

要件の詳細は `進捗帖_要件定義.md` を参照。
