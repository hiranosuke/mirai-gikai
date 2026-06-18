# `mirai_stances` → 「論点整理」転用 設計

作成日: 2026-06-17 / ブランチ: `saitama/discussion-points` / ベース: `poc/saitama-mirai-gikai`

## 背景と目的

さいたま市版 PoC では、議案詳細に「🗳️チームみらいの賛否」カード（`mirai_stances`）が
国会版のまま残っている。さいたま市議会には該当議員が存在しないため、特定主体（政党）が
賛否を表明する構造は中立性に反する。

本設計では、この構造を **ラベルではなく構造のレベルで除去** し、議案の
**賛成論拠／反対論拠を中立に併記する「論点整理」** へ転用する。

> 制約（ユーザー指示）: 「特定政党から見た時のスタンスを表明する前提の作り」を残さないこと。
> `type`（賛否判定）カラム・スタンスバッジ・党装飾・`preparing` 時の「党内で検討」特別文言など、
> 主体が賛否を表明する前提の構造そのものを廃止する。

関連: [`docs/20260613_2200_みらい議会さいたま市PoC運用案.md`](../../20260613_2200_みらい議会さいたま市PoC運用案.md)
§3（既存機能の転用方針）/ §7（中立性）。

## コンセプト

特定主体が賛否を**表明する**構造を全廃し、議案の**賛成論拠／反対論拠を中立に併記**する
「論点整理」に作り替える。残るのは「議案に対する賛成論拠／反対論拠の中立併記」のみ。

## データモデル（DB migration 1本）

`mirai_stances` テーブルを中立な構造へ変更する。

- テーブル名: `mirai_stances` → **`discussion_points`**
- `type stance_type_enum` カラム → **削除**（党の賛否判定そのものを廃止）
- `comment TEXT` → **削除**し、以下を追加:
  - `pro_points TEXT`（賛成の論拠、nullable）
  - `con_points TEXT`（反対の論拠、nullable）
- `bill_id`（UNIQUE FK, `ON DELETE CASCADE`）、`created_at`/`updated_at`、`updated_at` トリガは踏襲
- RLS: `alter table discussion_points enable row level security;`（ポリシーは定義しない＝デフォルト全拒否。
  アクセスは `createAdminClient()` 経由）
- インデックス: `idx_discussion_points_bill_id`（`bill_id`）。`type` 用インデックスは廃止
- `stance_type_enum` は **温存**（`interview_report.stance` や各種 sort RPC が市民回答スタンスで使用）
- migration 後 `pnpm db:types:gen` で `packages/supabase/types/supabase.types.ts` を再生成しコミット

## web（表示側）

表示は議案詳細の1箇所（`web/src/features/bills/server/components/bill-detail/bill-detail-layout.tsx`）に集約。

- `mirai-stance-card.tsx`（`MiraiStanceCard`）→ **`discussion-points-card.tsx`（`DiscussionPointsCard`）** に作り替え
  - 見出し: **「論点整理」**
  - 補足注記: **「議案資料・議事録をもとにAIが整理し、運営者が確認した賛否の主な論拠です。
    特定の立場を推奨するものではありません」**
  - 賛成論拠／反対論拠を2セクション（または2カラム）で中立併記
  - **除去するもの**:
    - 「🗳️チームみらいの賛否」見出し
    - スタンスバッジ（for/against/neutral のラベル表示）
    - `bg-mirai-gradient` 装飾とロゴ画像（`/img/logo.svg`、主体の賛否を示す演出）
    - `preparing` 時の「議案提出後、党内で検討のうえ賛否を表明します。」特別表示
  - 空状態: `pro_points`・`con_points` がともに空（null/空文字）なら **カード非表示**（既存の null 非表示を踏襲）
- `stance-styles.ts`（`getStanceStyles`）→ **廃止**。pro/con セクションの配色は既存トークン
  （`bg-stance-for-bg`/`text-primary-accent`、`bg-stance-against-bg`/`text-stance-against`）を
  中立な「賛成論拠／反対論拠」色として直接適用
- 型（`web/src/features/bills/shared/types/index.ts`）:
  - `MiraiStance` → **`DiscussionPoints`**
  - `BillWithStance.mirai_stance` → **`BillWithDiscussionPoints.discussion_points`**
  - `BillWithContent.mirai_stance` → `discussion_points`
- repository / loaders の参照更新:
  - `web/src/features/bills/server/repositories/bill-repository.ts`
  - `web/src/features/bills/server/loaders/get-bill-by-id.ts`
  - `web/src/features/bills/server/loaders/get-bill-by-id-admin.ts`
- dev プレビュー用モック（`web/src/app/dev/_lib/mock-data.ts`）の stance データを新構造へ更新

## admin（編集側）

- feature ディレクトリ `admin/src/features/mirai-stance/` → **`admin/src/features/discussion-points/`** にリネーム
- `client/components/stance-form.tsx`: 「賛否タイプ選択＋コメント欄」→ **賛成論拠／反対論拠の
  2テキスト欄**（手動入力のみ、AI生成は本スコープ外）
- CRUD を新構造に合わせて更新:
  - `server/actions/{create,update,delete}-stance.ts` → 論点整理用に改名・更新
  - `server/repositories/mirai-stance-repository.ts` → `discussion-points-repository.ts`
  - `server/loaders/get-stance-by-bill-id.ts` → 論点整理取得に更新
  - `shared/types/index.ts`（`StanceInput` → `DiscussionPointsInput` 等）
- 議案編集ページ `admin/src/app/(protected)/bills/[id]/edit/page.tsx` の組み込み更新
- `@/lib/routes` への影響なし（論点整理に専用ルートは無く、議案編集ページに内包されるため）

## seed

- `packages/seed/main/data.ts`・`packages/seed/shared/helper.ts`・`packages/seed/main/run.ts` の
  `mirai_stances` 投入を `discussion_points`（`pro_points`/`con_points`）へ置換

## テスト

- 廃止: `web/src/features/bills/shared/utils/stance-styles.test.ts`（対象関数を削除するため）
- 更新: `web/src/features/bills/shared/types/index.test.ts`（`preparing` 関連の stance 分岐）、
  `web/src/features/bills/server/repositories/bill-repository.integration.test.ts`（新構造で読み出し検証）
- 純粋関数を新たに切り出す場合は同階層に `*.test.ts` を追加（テストガイドライン準拠）
- ローカル検証: `pnpm db:reset`（migration 適用 + seed）→ `pnpm lint` / `pnpm typecheck` /
  `pnpm build` / `pnpm test`

## スコープ外（YAGNI / 後続）

- 論点整理の **AI 下書き生成**（増分3「議事録→議案コンテンツ供給フロー」側で検討）
- 議案ごとの論点整理 表示/非表示トグル（空状態の自動非表示で代替）

## 中立性チェック（受け入れ基準）

実装完了時、以下がコードに残っていないことを確認する:

- [ ] `mirai_stances` テーブル / `MiraiStance` 型 / `mirai_stance` フィールド名
- [ ] `discussion_points` に賛否を一意に判定する `type` 系カラム
- [ ] 主体の賛否を示すバッジ・党グラデーション・ロゴ演出
- [ ] 「党内で検討」等、特定主体が賛否を表明する前提の文言
