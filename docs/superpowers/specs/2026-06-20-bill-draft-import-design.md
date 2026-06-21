# 議案ドラフトインポート設計

作成: 2026-06-20 / 対象: admin / 増分3-A 第2段（外部AI→議案作成窓口）

## 1. 背景と目的

増分3-A 第1段（PR #18）で DiscussCabinet 文書ブラウザを追加し、運用者は文書本文テキストを
コピーして外部AI（MCPエージェント等）に渡せるようになった。

外部AIが生成した「議案ドラフトJSON」をシステムに投入する窓口がまだない。
既存の個別MCPツール（`create_bill` → `update_bill_contents` → `update_bill_tags` の3ステップ）では
AI側の操作コストが高く、エラーが出た際の部分失敗もある。

本増分はこれを解消する：

- **MCPツール `upsert_bill_from_draft`**: 1リクエストで議案を作成または更新する単発操作。
  AIエージェントは生成したJSONをそのままこのツールに渡せばよい。
- **Admin UI `/bills/import`**: 人間が同じJSONをペーストしてブラウザ上で作成/更新できる窓口。
  MCPセッション不要で運用者が手動操作できる。

### 設計方針（増分3-A 全体構想との整合）

> もろい部分（スクレイピング・PDF読解・AI生成）は製品の外でやり、
> 製品側は「JSONを受け取って議案を作成/更新する窓口」だけ持つ。

- スクレイピング・AI生成はシステム外（Claude Desktop + 既存MCP、または手動コピペ）
- 製品は「JSONを受け取る窓口」のみ持つ → 本増分がその窓口を実装する

## 2. JSON スキーマ（`billDraftSchema`）

```typescript
{
  // 省略 → 新規作成、指定 → 既存議案を更新
  billId?: string (UUID)

  // 議案メタ（nameのみ必須、他はデフォルト）
  name: string               // 必須
  status?: enum              // デフォルト: "preparing"
  originating_house?: enum   // デフォルト: "HR"（市議会では使わないが既存スキーマ制約）
  status_note?: string | null
  submitted_date?: string    // YYYY-MM-DD
  slug?: string | null
  diet_session_id?: string | null
  knowledge_source?: string  // DiscussCabinet本文テキスト等をここに入れる
  use_knowledge_source_in_chat?: boolean  // デフォルト: false
  is_featured?: boolean       // デフォルト: false
  is_review_completed?: boolean  // デフォルト: false

  // コンテンツ（省略可）
  contents?: {
    normal?: { title?, summary?, content? }
    hard?: { title?, summary?, content? }
  }

  // タグ（省略時は既存のまま、空配列で全削除）
  tagIds?: string[]
}
```

### AIが出力する典型JSON例

```json
{
  "name": "令和8年度さいたま市一般会計補正予算（第1号）",
  "status": "preparing",
  "submitted_date": "2026-06-03",
  "slug": "2026-r8-hosei1",
  "knowledge_source": "【DiscussCabinet取得テキスト】\n議案審議結果一覧...",
  "contents": {
    "normal": {
      "title": "令和8年度補正予算（第1号）について",
      "summary": "令和8年度のさいたま市一般会計の補正予算です。",
      "content": "## 概要\n..."
    },
    "hard": {
      "title": "令和8年度 一般会計補正予算（第1号）",
      "summary": "...",
      "content": "## 背景\n..."
    }
  }
}
```

## 3. アーキテクチャ

```
admin/src/
├── features/bills-edit/
│   ├── shared/types/
│   │   ├── bill-draft.ts            # billDraftSchema + BillDraftInput型
│   │   └── bill-draft.test.ts       # スキーマバリデーションテスト
│   ├── server/
│   │   ├── services/
│   │   │   ├── upsert-bill-draft.ts       # ビジネスロジック（MCPとUIで共用）
│   │   │   └── upsert-bill-draft.test.ts  # fakeリポジトリでのユニットテスト
│   │   └── actions/
│   │       └── upsert-bill-draft-action.ts  # "use server" Server Action（UI用）
│   └── client/components/
│       └── bill-draft-import-form.tsx      # "use client" JSONフォーム
├── app/(protected)/bills/
│   └── import/
│       └── page.tsx                 # 薄いラッパー
├── lib/routes.ts                    # billImport ルート追加
└── features/mcp/server/tools/
    └── register-bills-tools.ts      # upsert_bill_from_draft ツール追加
```

### 責務分担

| 層 | 責務 |
|---|---|
| `billDraftSchema` (shared) | バリデーション定義（MCP・UI・テスト共用） |
| `upsertBillFromDraft` (service) | 作成/更新/コンテンツ/タグ同期のオーケストレーション |
| `upsertBillDraftAction` (action) | `requireAdmin` + サービス呼び出し + エラーハンドリング |
| `BillDraftImportForm` (client) | JSON入力→パース→プレビュー→送信 |
| MCP ツール | `requireAdmin` 相当なし（MCPハンドラがトークン認証済み）→ サービス直接呼び出し |

### upsertBillFromDraft のロジック

```
input.billId が指定
  → updateBillRecord(billId, メタフィールド)
  → (省略)なければ作成しない

input.billId が省略
  → createBillRecord(メタフィールド) → 生成されたIDを取得

input.contents が指定
  → normal/hard それぞれ upsertBillContent (空文字のみならスキップ)

input.tagIds が指定
  → findBillsTagsByBillId → calculateSetDiff → delete/insert

invalidateWebCache([BILLS])
```

## 4. Admin UI フォームの設計

### レイアウト

```
[議案ドラフトインポート]

JSONを貼り付けてください：
┌────────────────────────────────────────┐
│  {                                     │
│    "name": "...",                      │
│    "contents": { ... }                 │
│  }                                     │
└────────────────────────────────────────┘
             [パースして確認] ボタン

← パース後に右側にプレビュー表示 →

[議案名] [ステータス] [コンテンツ数] ...
[作成する / 更新する] ボタン
```

### 動作フロー

1. ユーザーがJSONをtextareaにペースト
2. 「確認」ボタン or textareaのonChange でクライアント側バリデーション（billDraftSchema.safeParse）
3. エラーがあれば赤文字でエラー表示
4. 正常なら概要プレビュー（名前・status・コンテンツ有無・更新か作成かの判断）
5. 「作成する」または「更新する」ボタンでServer Action呼び出し
6. 成功時: `/bills/[id]/edit` にリダイレクト

## 5. 非ゴール

- AI生成自体（外部AIが担う）
- 複数議案の一括インポート
- JSONの自動生成（UI上でのフィールド入力は既存の `bills/new` が担う）
- `discussion_points`（論点整理）のインポート（別途検討）
