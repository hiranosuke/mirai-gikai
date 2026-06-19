# 設計: 運用労力ログ `ops_activity_log`（さいたまPoC 増分3-B）

作成: 2026-06-18 / ブランチ: `saitama/ops-activity-log`（base: `poc/saitama-mirai-gikai`）

## 0. 位置づけ

さいたま市PoCの目的は「個人が自費・自力で現実的に回せるか」の**実測**（[運用案](../../20260613_2200_みらい議会さいたま市PoC運用案.md) §0/§1）。LLM コストは `chat_usage_events` に自動で貯まるが、**人間の作業時間は自動記録されない**。本増分は、議案を公開可能状態にするまでの作業時間を記録する受け皿（`ops_activity_log`）と入力UI、Grafana 可視化を追加し、合格ライン「1議案を公開状態にする作業時間 ≤ 1〜2時間」(§1) を実測できるようにする。

handoff の「増分3」は2つの独立ピースに分解した。本ドキュメントは **B: 運用労力ログ** を対象とする。A（議事録→議案コンテンツ供給フロー）は別スペックで扱う。

## 1. 設計上の前提と決定（重要な背景）

- **作業時間は原理的に手入力でしか正確に取れない**。編集履歴（監査ログ）テーブルは存在せず、各テーブルは `created_at`/`updated_at` の2点しか持たないため、自動で取れるのは「着手〜更新のカレンダー経過時間」という代理値のみ。放置した日も含むため実作業分とは乖離する。
- したがって **`minutes` は手入力の確定値のみを保存**する。カレンダー経過などの自動算出値は**保存せず**、入力画面に「参考シグナル」として都度計算で表示するだけにとどめる（自動代入は誤解を生むため行わない）。
- データモデルは**作業ログ追記方式**（1行=1作業記録）。推定値を保存しないため1セル上書き方式にする理由がなく、`bill_id` を任意（null）にした際の一意制約問題も避けられる。議案あたり・種別あたりの集計は SQL の `group by` / `sum` で得る。
- `bill_id` は**任意**。告知・振り返り等のサイクル全体作業（特定議案に紐付かない）も記録できるようにする。

## 2. データモデル（DB / 新規 migration）

```sql
create type ops_activity_type_enum as enum
  ('selection', 'content', 'interview_config', 'review', 'other');

create table public.ops_activity_log (
  id            uuid primary key default gen_random_uuid(),
  bill_id       uuid references bills(id) on delete set null,  -- 任意（サイクル全体作業は null）
  activity_type ops_activity_type_enum not null,
  minutes       integer not null check (minutes > 0),          -- 手入力の確定値のみ
  note          text,                                          -- ボトルネック等の任意メモ
  occurred_on   date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index ops_activity_log_bill_id_idx     on public.ops_activity_log (bill_id);
create index ops_activity_log_occurred_on_idx on public.ops_activity_log (occurred_on);

alter table public.ops_activity_log enable row level security;  -- ポリシーは定義しない（デフォルト全拒否）
```

- `on delete set null`: 議案が削除されても労力履歴は残す。
- RLS 有効・ポリシー無し。データアクセスはすべて `createAdminClient()` 経由、認可はアプリ層（[AGENTS.md の RLS 方針](../../../AGENTS.md)）。
- `packages/supabase/types/supabase.types.ts` を migration とセットで再生成・コミットする。

### 作業種別（`activity_type`）の対応

| 値 | 意味（運用案 §5） |
|---|---|
| `selection` | 議案選定 |
| `content` | コンテンツ作成（簡易/詳細） |
| `interview_config` | インタビュー設定 |
| `review` | レビュー・公開 |
| `other` | 上記以外（告知・振り返り等） |

## 3. 参考シグナル（**廃止 — 増分3-C のタイマー実測へ移行**）

> **2026-06-19 更新**: 当初は議案ごとに `bill_contents`/`interview_configs` の
> `created_at→updated_at` 経過を「参考シグナル」として入力画面に表示する設計だったが、
> 「経過時間」が「作業時間」と誤読され、かつ created/updated 差分は放置時間を含み実作業と乖離する
> ため、**この区画は実装から削除した**。代替として、議案関連の編集ページを開いている**実時間を計測し、
> 保存時にダイアログで確認して `ops_activity_log` に登録する半自動方式**を別増分（3-C）で設計・実装する。
> 本PR（増分3-B）は テーブル + 手入力フォーム + 議案別一覧 + Grafana の土台のみを提供する。

## 4. admin 機能（feature: `ops-activity-log`、`(protected)` 配下）

Bulletproof React の feature 3層構造に従う。

```
admin/src/app/(protected)/ops-activity-log/page.tsx   # 薄いラッパー
admin/src/features/ops-activity-log/
├── server/
│   ├── repositories/ops-activity-log-repository.ts    # createAdminClient 経由 CRUD + 参考シグナル集計
│   ├── loaders/ops-activity-log-loader.ts             # 一覧（議案別グルーピング）+ 参考シグナル
│   ├── actions/ops-activity-log-actions.ts            # "use server" 追加 / 削除
│   └── components/ops-activity-log-view.tsx           # Server Component（一覧表）
├── client/
│   └── components/                                    # 追加フォーム・削除ボタン（"use client"）
└── shared/
    ├── types/                                         # 共通型
    └── utils/                                         # 純粋関数（分→時間整形・議案別/種別別集計）+ *.test.ts
```

- `lib/routes.ts` に `opsActivityLog: () => "/ops-activity-log"` を追加（page.tsx と 1:1）。
- `app/(protected)/layout/navigation-links.tsx` に `{ href: routes.opsActivityLog(), label: "作業ログ" }` を追加。
- 入力フォームは zod スキーマで検証（`minutes > 0` の正の整数、`activity_type` 必須、`bill_id` 任意、`occurred_on` 既定は当日）。
- アイコンは `lucide-react`、ボタンは `@/components/ui/button` の `Button`、色は `globals.css` のトークンのみ（インラインカラー禁止）。

## 5. Grafana 可視化（`observability/grafana/dashboards/poc-overview.json` にパネル追加）

Postgres datasource（`mirai-supabase`）から直接 SQL で集計。

- **議案あたり作業時間**: `sum(minutes)/60.0` を議案名で group by（`ops_activity_log` × `bills` を join、`bill_id is null` は「サイクル全体」として集約）。合格ライン 1〜2時間と照らせるようにする。
- **作業種別別の内訳**: `activity_type` ごとの合計（stacked）。
- **当月累計作業時間**: 当月の `sum(minutes)/60.0`（stat）。

## 6. エラーハンドリング

- 入力検証は zod（クライアント）+ server action 側でも再検証。`minutes <= 0` や未選択種別は弾く。
- server action はエラー状態を返し、クライアントで toast 表示。
- 削除は確認ダイアログを挟む。

## 7. テスト方針

- **純粋関数（shared/utils）**: 分→時間整形、議案別/種別別集計に `*.test.ts` を同階層で必須。
- **repository / loader**: ローカル Supabase 実接続でテスト（モックしない）。`createAdminClient` 経由の CRUD と参考シグナル集計を検証。
- **routes.test.ts**: page.tsx との同期を自動検証（新規ルート追加で通す）。
- DB function（RPC）は追加しないため、集計はアプリ層ユニットテスト + ローカル Supabase 実接続でカバー。

## 8. スコープ外（YAGNI）

- 自動の作業時間推定・タイマー計測（§1 の通り精度が出ず、手間に見合わない）。
- 議案編集ページからのクイック追加（専用ページに一元化）。
- A: 議事録→議案コンテンツ供給フロー（別スペック）。

## 9. 検証（受け入れ条件）

- migration 適用後、admin「作業ログ」ページで記録を追加・一覧・削除できる。
- 議案任意・種別必須・分が正の整数のバリデーションが効く。
- Grafana `poc-overview` に作業時間パネルが表示され、記録投入で値が反映される。
- `pnpm lint` / `pnpm typecheck` / `pnpm build` / `pnpm test` 全通過。
