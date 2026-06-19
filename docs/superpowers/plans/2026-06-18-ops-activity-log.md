# 運用労力ログ `ops_activity_log` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** さいたまPoCの議案コンテンツ作成等にかかった作業時間を admin で手入力・記録し、Grafana で「議案あたり作業時間」を可視化する。

**Architecture:** 新規テーブル `ops_activity_log`（作業ログ追記方式・手入力の確定値のみ保存）を追加。admin に専用ページ feature `ops-activity-log`（Bulletproof React 3層: server/client/shared）を新設。既存タイムスタンプから算出する「参考シグナル」は loader で都度計算し非永続。Grafana `poc-overview` にパネル追加。

**Tech Stack:** Next.js 15 (App Router) / Supabase (Postgres, `createAdminClient`) / zod 4 / react (`useState`/`useId`) / sonner (toast) / Vitest / Grafana (Postgres datasource)

---

## 実行前提（毎ステップ共通）

- 作業ディレクトリは worktree `../mirai-gikai-ops-activity-log`（ブランチ `saitama/ops-activity-log`、base `poc/saitama-mirai-gikai`）。
- `pnpm` は `corepack pnpm`。**`pnpm -r` 系（`typecheck` / `build` / `test` / `test:integration`）を実行する時は `export PATH="/tmp/pnpm-shim:$PATH"` を前置**する（handoff の既知回避策）。`pnpm lint` / `pnpm db:migrate` / `pnpm --filter ... exec` は前置不要。
- ローカル Supabase が起動済みであること（`npx supabase status`。未起動なら `npx supabase start`）。DB ポートは 54432。
- 設計の根拠は [docs/superpowers/specs/2026-06-18-ops-activity-log-design.md](../specs/2026-06-18-ops-activity-log-design.md)。

## ファイル構成（このプランで作成/変更）

**DB**
- Create: `supabase/migrations/20260618130000_create_ops_activity_log.sql`
- Modify（自動生成）: `packages/supabase/types/supabase.types.ts`

**admin feature `ops-activity-log`**
- Create: `admin/src/features/ops-activity-log/shared/types/index.ts`
- Create: `admin/src/features/ops-activity-log/shared/utils/activity-type-labels.ts`
- Create: `admin/src/features/ops-activity-log/shared/utils/format-minutes.ts` (+ `.test.ts`)
- Create: `admin/src/features/ops-activity-log/shared/utils/aggregate-logs.ts` (+ `.test.ts`)
- Create: `admin/src/features/ops-activity-log/shared/utils/build-bill-reference-signals.ts` (+ `.test.ts`)
- Create: `admin/src/features/ops-activity-log/shared/utils/ops-activity-log-schema.ts` (+ `.test.ts`)
- Create: `admin/src/features/ops-activity-log/shared/utils/map-ops-db-error.ts` (+ `.test.ts`)
- Create: `admin/src/features/ops-activity-log/server/repositories/ops-activity-log-repository.ts`
- Create: `admin/src/features/ops-activity-log/server/loaders/load-ops-activity-logs.ts`
- Create: `admin/src/features/ops-activity-log/server/actions/create-ops-activity-log.ts`
- Create: `admin/src/features/ops-activity-log/server/actions/delete-ops-activity-log.ts`
- Create: `admin/src/features/ops-activity-log/server/components/ops-activity-log-view.tsx`
- Create: `admin/src/features/ops-activity-log/client/components/ops-activity-log-form.tsx`
- Create: `admin/src/features/ops-activity-log/client/components/ops-activity-log-delete-button.tsx`

**admin ルーティング/ナビ**
- Create: `admin/src/app/(protected)/ops-activity-log/page.tsx`
- Modify: `admin/src/lib/routes.ts`
- Modify: `admin/src/app/(protected)/layout/navigation-links.tsx`

**統合テスト**
- Create: `tests/supabase/ops-activity-log-repository.test.ts`
- Modify: `tests/supabase/rls/default-deny.test.ts`（`tables` 配列に追加）

**Grafana**
- Modify: `observability/grafana/dashboards/poc-overview.json`

---

## Task 1: DB migration（テーブル + enum + RLS）

**Files:**
- Create: `supabase/migrations/20260618130000_create_ops_activity_log.sql`
- Modify: `packages/supabase/types/supabase.types.ts`（自動生成）

- [ ] **Step 1: マイグレーションファイルを作成**

`supabase/migrations/20260618130000_create_ops_activity_log.sql`:

```sql
-- 運用労力ログ: 議案を公開状態にするまでの作業時間を手入力で記録する。
-- さいたまPoC 増分3-B。設計: docs/superpowers/specs/2026-06-18-ops-activity-log-design.md
-- minutes は手入力の確定値のみ保存（自動推定値は保存せず、loader で参考表示するだけ）。

CREATE TYPE ops_activity_type_enum AS ENUM (
  'selection',         -- 議案選定
  'content',           -- コンテンツ作成（簡易/詳細）
  'interview_config',  -- インタビュー設定
  'review',            -- レビュー・公開
  'other'              -- 上記以外（告知・振り返り等）
);

CREATE TABLE ops_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id       UUID REFERENCES bills(id) ON DELETE SET NULL,  -- 任意（サイクル全体作業は NULL）
  activity_type ops_activity_type_enum NOT NULL,
  minutes       INTEGER NOT NULL CHECK (minutes > 0),          -- 手入力の確定値（分）
  note          TEXT,                                          -- ボトルネック等の任意メモ
  occurred_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ops_activity_log_bill_id_idx     ON ops_activity_log (bill_id);
CREATE INDEX ops_activity_log_occurred_on_idx ON ops_activity_log (occurred_on);

-- RLS 有効・ポリシー無し（デフォルト全拒否）。アクセスは createAdminClient 経由のみ。
ALTER TABLE ops_activity_log ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: マイグレーションを適用して型を再生成**

Run: `pnpm db:migrate`
Expected: マイグレーションが適用され、`packages/supabase/types/supabase.types.ts` が再生成される（エラーなく完了）。

- [ ] **Step 3: 型が生成されたか確認**

Run: `grep -c "ops_activity_log" packages/supabase/types/supabase.types.ts`
Expected: 1 以上（Row/Insert/Update 型と Relationships が生成されている）。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260618130000_create_ops_activity_log.sql packages/supabase/types/supabase.types.ts
git commit -m "feat(db): ops_activity_log テーブルと enum を追加"
```

---

## Task 2: shared 型と作業種別ラベル

**Files:**
- Create: `admin/src/features/ops-activity-log/shared/types/index.ts`
- Create: `admin/src/features/ops-activity-log/shared/utils/activity-type-labels.ts`

- [ ] **Step 1: 型定義を作成**

`admin/src/features/ops-activity-log/shared/types/index.ts`:

```ts
export type OpsActivityType =
  | "selection"
  | "content"
  | "interview_config"
  | "review"
  | "other";

/** ops_activity_log の1レコード（DB の Row に対応） */
export type OpsActivityLog = {
  id: string;
  bill_id: string | null;
  activity_type: OpsActivityType;
  minutes: number;
  note: string | null;
  occurred_on: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
};

/** 一覧表示用（議案名を join 済み） */
export type OpsActivityLogListItem = OpsActivityLog & {
  bill_name: string | null;
};

export type CreateOpsActivityLogInput = {
  bill_id: string | null;
  activity_type: OpsActivityType;
  minutes: number;
  note?: string | null;
  occurred_on: string;
};

export type DeleteOpsActivityLogInput = {
  id: string;
};

/** フォームの議案選択肢 */
export type BillOption = {
  id: string;
  name: string;
};

/** 参考シグナル（議案単位・非永続）。loader が都度計算する。 */
export type BillReferenceSignal = {
  bill_id: string;
  bill_name: string;
  content_span_hours: number | null; // bill_contents の min(created)→max(updated)
  content_count: number; // 難易度本数
  interview_config_span_hours: number | null;
  published_at: string | null;
};

/** 議案ごとに集計したログ */
export type BillLogGroup = {
  bill_id: string | null;
  bill_name: string | null;
  total_minutes: number;
  by_type: Record<OpsActivityType, number>;
  entries: OpsActivityLogListItem[];
};
```

- [ ] **Step 2: 作業種別ラベルを作成**

`admin/src/features/ops-activity-log/shared/utils/activity-type-labels.ts`:

```ts
import type { OpsActivityType } from "../types";

/** 表示順（フォームの選択肢・集計の列順に使う） */
export const ACTIVITY_TYPE_ORDER: OpsActivityType[] = [
  "selection",
  "content",
  "interview_config",
  "review",
  "other",
];

export const ACTIVITY_TYPE_LABELS: Record<OpsActivityType, string> = {
  selection: "議案選定",
  content: "コンテンツ作成",
  interview_config: "インタビュー設定",
  review: "レビュー・公開",
  other: "その他",
};

export function getActivityTypeLabel(type: OpsActivityType): string {
  return ACTIVITY_TYPE_LABELS[type];
}
```

- [ ] **Step 3: 型チェック**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm --filter admin typecheck`
Expected: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add admin/src/features/ops-activity-log/shared/types/index.ts admin/src/features/ops-activity-log/shared/utils/activity-type-labels.ts
git commit -m "feat(ops-log): shared 型と作業種別ラベルを追加"
```

---

## Task 3: 純粋関数 `formatMinutes`（TDD）

**Files:**
- Create: `admin/src/features/ops-activity-log/shared/utils/format-minutes.ts`
- Test: `admin/src/features/ops-activity-log/shared/utils/format-minutes.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`admin/src/features/ops-activity-log/shared/utils/format-minutes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatMinutes, minutesToHours } from "./format-minutes";

describe("formatMinutes", () => {
  it("60分未満は「N分」", () => {
    expect(formatMinutes(45)).toBe("45分");
  });
  it("ちょうど時間は「N時間」", () => {
    expect(formatMinutes(120)).toBe("2時間");
  });
  it("時間+分は「N時間M分」", () => {
    expect(formatMinutes(90)).toBe("1時間30分");
  });
  it("0は「0分」", () => {
    expect(formatMinutes(0)).toBe("0分");
  });
});

describe("minutesToHours", () => {
  it("小数第1位に丸める", () => {
    expect(minutesToHours(90)).toBe(1.5);
    expect(minutesToHours(100)).toBe(1.7);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/shared/utils/format-minutes.test.ts`
Expected: FAIL（`format-minutes` が存在しない）。

- [ ] **Step 3: 最小実装**

`admin/src/features/ops-activity-log/shared/utils/format-minutes.ts`:

```ts
/** 分を「N時間M分」形式に整形する。 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

/** 分を時間（小数第1位）に変換する。 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/shared/utils/format-minutes.test.ts`
Expected: PASS（6 アサーション）。

- [ ] **Step 5: コミット**

```bash
git add admin/src/features/ops-activity-log/shared/utils/format-minutes.ts admin/src/features/ops-activity-log/shared/utils/format-minutes.test.ts
git commit -m "feat(ops-log): formatMinutes 純粋関数を追加"
```

---

## Task 4: 純粋関数 `groupLogsByBill`（TDD）

**Files:**
- Create: `admin/src/features/ops-activity-log/shared/utils/aggregate-logs.ts`
- Test: `admin/src/features/ops-activity-log/shared/utils/aggregate-logs.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`admin/src/features/ops-activity-log/shared/utils/aggregate-logs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { OpsActivityLogListItem } from "../types";
import { groupLogsByBill } from "./aggregate-logs";

function item(
  over: Partial<OpsActivityLogListItem> &
    Pick<OpsActivityLogListItem, "id" | "activity_type" | "minutes">
): OpsActivityLogListItem {
  return {
    bill_id: "bill-1",
    bill_name: "議案A",
    note: null,
    occurred_on: "2026-06-18",
    created_at: "2026-06-18T00:00:00Z",
    updated_at: "2026-06-18T00:00:00Z",
    ...over,
  };
}

describe("groupLogsByBill", () => {
  it("議案ごとに合計分と種別内訳を集計する", () => {
    const items: OpsActivityLogListItem[] = [
      item({ id: "1", activity_type: "content", minutes: 60 }),
      item({ id: "2", activity_type: "review", minutes: 30 }),
      item({ id: "3", activity_type: "content", minutes: 20 }),
    ];

    const groups = groupLogsByBill(items);

    expect(groups).toHaveLength(1);
    expect(groups[0].bill_id).toBe("bill-1");
    expect(groups[0].total_minutes).toBe(110);
    expect(groups[0].by_type.content).toBe(80);
    expect(groups[0].by_type.review).toBe(30);
    expect(groups[0].by_type.selection).toBe(0);
    expect(groups[0].entries).toHaveLength(3);
  });

  it("bill_id が null の作業は1グループにまとめる", () => {
    const items: OpsActivityLogListItem[] = [
      item({ id: "1", bill_id: null, bill_name: null, activity_type: "other", minutes: 15 }),
      item({ id: "2", bill_id: "bill-1", bill_name: "議案A", activity_type: "content", minutes: 40 }),
    ];

    const groups = groupLogsByBill(items);

    expect(groups).toHaveLength(2);
    const nullGroup = groups.find((g) => g.bill_id === null);
    expect(nullGroup?.total_minutes).toBe(15);
  });

  it("合計分の降順で並ぶ", () => {
    const items: OpsActivityLogListItem[] = [
      item({ id: "1", bill_id: "a", bill_name: "A", activity_type: "content", minutes: 10 }),
      item({ id: "2", bill_id: "b", bill_name: "B", activity_type: "content", minutes: 50 }),
    ];

    const groups = groupLogsByBill(items);
    expect(groups[0].bill_id).toBe("b");
    expect(groups[1].bill_id).toBe("a");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/shared/utils/aggregate-logs.test.ts`
Expected: FAIL（`aggregate-logs` が存在しない）。

- [ ] **Step 3: 最小実装**

`admin/src/features/ops-activity-log/shared/utils/aggregate-logs.ts`:

```ts
import type {
  BillLogGroup,
  OpsActivityLogListItem,
  OpsActivityType,
} from "../types";
import { ACTIVITY_TYPE_ORDER } from "./activity-type-labels";

function emptyByType(): Record<OpsActivityType, number> {
  const result = {} as Record<OpsActivityType, number>;
  for (const type of ACTIVITY_TYPE_ORDER) {
    result[type] = 0;
  }
  return result;
}

/** ログを議案ごとに集計する。bill_id が null の作業は1グループにまとめる。 */
export function groupLogsByBill(
  items: OpsActivityLogListItem[]
): BillLogGroup[] {
  const map = new Map<string, BillLogGroup>();

  for (const entry of items) {
    const key = entry.bill_id ?? "__null__";
    let group = map.get(key);
    if (!group) {
      group = {
        bill_id: entry.bill_id,
        bill_name: entry.bill_name,
        total_minutes: 0,
        by_type: emptyByType(),
        entries: [],
      };
      map.set(key, group);
    }
    group.total_minutes += entry.minutes;
    group.by_type[entry.activity_type] += entry.minutes;
    group.entries.push(entry);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.total_minutes - a.total_minutes
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/shared/utils/aggregate-logs.test.ts`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add admin/src/features/ops-activity-log/shared/utils/aggregate-logs.ts admin/src/features/ops-activity-log/shared/utils/aggregate-logs.test.ts
git commit -m "feat(ops-log): groupLogsByBill 集計関数を追加"
```

---

## Task 5: 純粋関数 `buildBillReferenceSignals`（TDD）

**Files:**
- Create: `admin/src/features/ops-activity-log/shared/utils/build-bill-reference-signals.ts`
- Test: `admin/src/features/ops-activity-log/shared/utils/build-bill-reference-signals.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`admin/src/features/ops-activity-log/shared/utils/build-bill-reference-signals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildBillReferenceSignals } from "./build-bill-reference-signals";

const bills = [
  { id: "bill-1", name: "議案A", published_at: "2026-06-10T00:00:00Z" },
  { id: "bill-2", name: "議案B", published_at: null },
];

describe("buildBillReferenceSignals", () => {
  it("bill_contents の min(created)→max(updated) を時間に換算する", () => {
    const contents = [
      {
        bill_id: "bill-1",
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T02:00:00Z",
      },
      {
        bill_id: "bill-1",
        created_at: "2026-06-01T01:00:00Z",
        updated_at: "2026-06-01T03:00:00Z",
      },
    ];
    const signals = buildBillReferenceSignals(bills, contents, []);
    const a = signals.find((s) => s.bill_id === "bill-1");
    expect(a?.content_span_hours).toBe(3); // 00:00 → 03:00
    expect(a?.content_count).toBe(2);
  });

  it("interview_configs の経過時間を換算する", () => {
    const configs = [
      {
        bill_id: "bill-2",
        created_at: "2026-06-02T00:00:00Z",
        updated_at: "2026-06-02T00:30:00Z",
      },
    ];
    const signals = buildBillReferenceSignals(bills, [], configs);
    const b = signals.find((s) => s.bill_id === "bill-2");
    expect(b?.interview_config_span_hours).toBe(0.5);
  });

  it("信号がない議案は null/0 を返す", () => {
    const signals = buildBillReferenceSignals(bills, [], []);
    const b = signals.find((s) => s.bill_id === "bill-2");
    expect(b?.content_span_hours).toBeNull();
    expect(b?.content_count).toBe(0);
    expect(b?.interview_config_span_hours).toBeNull();
    expect(b?.published_at).toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/shared/utils/build-bill-reference-signals.test.ts`
Expected: FAIL。

- [ ] **Step 3: 最小実装**

`admin/src/features/ops-activity-log/shared/utils/build-bill-reference-signals.ts`:

```ts
import type { BillReferenceSignal } from "../types";

type BillRow = { id: string; name: string; published_at: string | null };
type TimeRow = { bill_id: string; created_at: string; updated_at: string };

/** ミリ秒差を時間（小数第1位）に丸める。 */
function spanHours(minCreated: number, maxUpdated: number): number {
  return Math.round(((maxUpdated - minCreated) / 3_600_000) * 10) / 10;
}

function computeSpan(rows: TimeRow[]): number | null {
  if (rows.length === 0) return null;
  let minCreated = Number.POSITIVE_INFINITY;
  let maxUpdated = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    minCreated = Math.min(minCreated, new Date(row.created_at).getTime());
    maxUpdated = Math.max(maxUpdated, new Date(row.updated_at).getTime());
  }
  return spanHours(minCreated, maxUpdated);
}

/**
 * 議案ごとの参考シグナル（既存タイムスタンプから算出した事実）を組み立てる純粋関数。
 * これらは「着手〜更新のカレンダー経過」であり実作業時間ではない（設計 §1）。
 */
export function buildBillReferenceSignals(
  bills: BillRow[],
  billContents: TimeRow[],
  interviewConfigs: TimeRow[]
): BillReferenceSignal[] {
  return bills.map((bill) => {
    const contents = billContents.filter((c) => c.bill_id === bill.id);
    const configs = interviewConfigs.filter((c) => c.bill_id === bill.id);
    return {
      bill_id: bill.id,
      bill_name: bill.name,
      content_span_hours: computeSpan(contents),
      content_count: contents.length,
      interview_config_span_hours: computeSpan(configs),
      published_at: bill.published_at,
    };
  });
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/shared/utils/build-bill-reference-signals.test.ts`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
git add admin/src/features/ops-activity-log/shared/utils/build-bill-reference-signals.ts admin/src/features/ops-activity-log/shared/utils/build-bill-reference-signals.test.ts
git commit -m "feat(ops-log): buildBillReferenceSignals 純粋関数を追加"
```

---

## Task 6: zod スキーマと DB エラーマッパー（TDD）

**Files:**
- Create: `admin/src/features/ops-activity-log/shared/utils/ops-activity-log-schema.ts`
- Test: `admin/src/features/ops-activity-log/shared/utils/ops-activity-log-schema.test.ts`
- Create: `admin/src/features/ops-activity-log/shared/utils/map-ops-db-error.ts`
- Test: `admin/src/features/ops-activity-log/shared/utils/map-ops-db-error.test.ts`

- [ ] **Step 1: スキーマのテストを書く**

`admin/src/features/ops-activity-log/shared/utils/ops-activity-log-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createOpsActivityLogSchema } from "./ops-activity-log-schema";

const valid = {
  bill_id: null,
  activity_type: "content" as const,
  minutes: 30,
  note: null,
  occurred_on: "2026-06-18",
};

describe("createOpsActivityLogSchema", () => {
  it("正しい入力を通す", () => {
    expect(createOpsActivityLogSchema.safeParse(valid).success).toBe(true);
  });
  it("minutes が 0 以下を弾く", () => {
    expect(
      createOpsActivityLogSchema.safeParse({ ...valid, minutes: 0 }).success
    ).toBe(false);
  });
  it("minutes が非整数を弾く", () => {
    expect(
      createOpsActivityLogSchema.safeParse({ ...valid, minutes: 1.5 }).success
    ).toBe(false);
  });
  it("未知の activity_type を弾く", () => {
    expect(
      createOpsActivityLogSchema.safeParse({ ...valid, activity_type: "xxx" })
        .success
    ).toBe(false);
  });
  it("occurred_on の形式違反を弾く", () => {
    expect(
      createOpsActivityLogSchema.safeParse({ ...valid, occurred_on: "2026/06/18" })
        .success
    ).toBe(false);
  });
  it("bill_id が UUID 文字列を受け入れる", () => {
    expect(
      createOpsActivityLogSchema.safeParse({
        ...valid,
        bill_id: "00000000-0000-0000-0000-000000000000",
      }).success
    ).toBe(true);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/shared/utils/ops-activity-log-schema.test.ts`
Expected: FAIL。

- [ ] **Step 3: スキーマを実装**

`admin/src/features/ops-activity-log/shared/utils/ops-activity-log-schema.ts`:

```ts
import { z } from "zod";

export const opsActivityTypeSchema = z.enum([
  "selection",
  "content",
  "interview_config",
  "review",
  "other",
]);

export const createOpsActivityLogSchema = z.object({
  bill_id: z.string().uuid().nullable(),
  activity_type: opsActivityTypeSchema,
  minutes: z.number().int().positive(),
  note: z.string().max(2000).nullish(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CreateOpsActivityLogParsed = z.infer<
  typeof createOpsActivityLogSchema
>;
```

- [ ] **Step 4: スキーマのテストが通ることを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/shared/utils/ops-activity-log-schema.test.ts`
Expected: PASS。

- [ ] **Step 5: エラーマッパーのテストを書く**

`admin/src/features/ops-activity-log/shared/utils/map-ops-db-error.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapOpsDbError } from "./map-ops-db-error";

describe("mapOpsDbError", () => {
  it("PGRST116（レコードなし）", () => {
    expect(mapOpsDbError({ code: "PGRST116", message: "no rows" }, "削除")).toBe(
      "作業ログが見つかりません"
    );
  });
  it("23514（CHECK 違反 = minutes<=0）", () => {
    expect(mapOpsDbError({ code: "23514", message: "check" }, "作成")).toBe(
      "作業時間は1分以上で入力してください"
    );
  });
  it("23503（外部キー違反 = 無効な議案）", () => {
    expect(mapOpsDbError({ code: "23503", message: "fk" }, "作成")).toBe(
      "指定された議案が存在しません"
    );
  });
  it("未知コードは操作名付き汎用メッセージ", () => {
    expect(mapOpsDbError({ code: "42501", message: "denied" }, "作成")).toBe(
      "作業ログの作成に失敗しました: denied"
    );
  });
});
```

- [ ] **Step 6: テストが失敗することを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/shared/utils/map-ops-db-error.test.ts`
Expected: FAIL。

- [ ] **Step 7: エラーマッパーを実装**

`admin/src/features/ops-activity-log/shared/utils/map-ops-db-error.ts`:

```ts
type DbError = {
  code: string;
  message: string;
};

type OpsOperation = "作成" | "削除";

/** 作業ログ操作の DB エラーコードを日本語メッセージに変換する純粋関数。 */
export function mapOpsDbError(error: DbError, operation: OpsOperation): string {
  if (error.code === "PGRST116") {
    return "作業ログが見つかりません";
  }
  if (error.code === "23514") {
    return "作業時間は1分以上で入力してください";
  }
  if (error.code === "23503") {
    return "指定された議案が存在しません";
  }
  return `作業ログの${operation}に失敗しました: ${error.message}`;
}
```

- [ ] **Step 8: エラーマッパーのテストが通ることを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/shared/utils/map-ops-db-error.test.ts`
Expected: PASS。

- [ ] **Step 9: コミット**

```bash
git add admin/src/features/ops-activity-log/shared/utils/ops-activity-log-schema.ts admin/src/features/ops-activity-log/shared/utils/ops-activity-log-schema.test.ts admin/src/features/ops-activity-log/shared/utils/map-ops-db-error.ts admin/src/features/ops-activity-log/shared/utils/map-ops-db-error.test.ts
git commit -m "feat(ops-log): zod スキーマと DB エラーマッパーを追加"
```

---

## Task 7: repository（createAdminClient 経由 CRUD + 参考シグナル元データ取得）

**Files:**
- Create: `admin/src/features/ops-activity-log/server/repositories/ops-activity-log-repository.ts`

- [ ] **Step 1: repository を実装**

`admin/src/features/ops-activity-log/server/repositories/ops-activity-log-repository.ts`:

```ts
import "server-only";

import { createAdminClient } from "@mirai-gikai/supabase";
import type { CreateOpsActivityLogInput } from "../../shared/types";

/** 全ログを議案名込みで取得（occurred_on 降順）。 */
export async function findAllOpsActivityLogs() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ops_activity_log")
    .select("*, bills(name)")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`作業ログの取得に失敗しました: ${error.message}`);
  }
  return data;
}

/** フォームの議案選択肢（id, name）を取得。 */
export async function findBillOptions() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .select("id, name")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`議案一覧の取得に失敗しました: ${error.message}`);
  }
  return data;
}

/** 参考シグナルの元データ: 議案（公開日時付き）。 */
export async function findBillsForSignals() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .select("id, name, published_at");

  if (error) {
    throw new Error(`議案の取得に失敗しました: ${error.message}`);
  }
  return data;
}

/** 参考シグナルの元データ: bill_contents のタイムスタンプ。 */
export async function findBillContentTimes() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bill_contents")
    .select("bill_id, created_at, updated_at");

  if (error) {
    throw new Error(`コンテンツ情報の取得に失敗しました: ${error.message}`);
  }
  return data;
}

/** 参考シグナルの元データ: interview_configs のタイムスタンプ。 */
export async function findInterviewConfigTimes() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("interview_configs")
    .select("bill_id, created_at, updated_at");

  if (error) {
    throw new Error(`インタビュー設定の取得に失敗しました: ${error.message}`);
  }
  return data;
}

export async function createOpsActivityLogRecord(
  input: CreateOpsActivityLogInput
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ops_activity_log")
    .insert({
      bill_id: input.bill_id,
      activity_type: input.activity_type,
      minutes: input.minutes,
      note: input.note ?? null,
      occurred_on: input.occurred_on,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23514" || error.code === "23503") {
      return { data: null, error: { code: error.code, message: error.message } };
    }
    throw new Error(`作業ログの作成に失敗しました: ${error.message}`);
  }
  return { data, error: null };
}

export async function deleteOpsActivityLogRecord(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ops_activity_log")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.code === "PGRST116") {
      return { error: { code: error.code, message: error.message } };
    }
    throw new Error(`作業ログの削除に失敗しました: ${error.message}`);
  }
  return { error: null };
}
```

- [ ] **Step 2: 型チェック**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm --filter admin typecheck`
Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add admin/src/features/ops-activity-log/server/repositories/ops-activity-log-repository.ts
git commit -m "feat(ops-log): repository を追加"
```

---

## Task 8: repository 統合テスト（ローカル Supabase 実接続）

**Files:**
- Create: `tests/supabase/ops-activity-log-repository.test.ts`

- [ ] **Step 1: 統合テストを書く**

`tests/supabase/ops-activity-log-repository.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { adminClient } from "./utils";

/**
 * ops_activity_log の CRUD をローカル Supabase 実接続で検証する。
 * createAdminClient と同じ secret key クライアント（adminClient）を使用。
 */
describe("ops_activity_log repository (integration)", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await adminClient.from("ops_activity_log").delete().in("id", createdIds);
    }
  });

  it("bill_id=null の作業ログを作成・取得・削除できる", async () => {
    const { data: inserted, error: insertError } = await adminClient
      .from("ops_activity_log")
      .insert({
        bill_id: null,
        activity_type: "other",
        minutes: 25,
        note: "統合テスト",
        occurred_on: "2026-06-18",
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(inserted).not.toBeNull();
    if (inserted) createdIds.push(inserted.id);

    const { data: fetched } = await adminClient
      .from("ops_activity_log")
      .select("*")
      .eq("id", inserted?.id ?? "");
    expect(fetched?.[0]?.minutes).toBe(25);

    const { error: deleteError } = await adminClient
      .from("ops_activity_log")
      .delete()
      .eq("id", inserted?.id ?? "");
    expect(deleteError).toBeNull();
  });

  it("minutes <= 0 は CHECK 制約で拒否される", async () => {
    const { error } = await adminClient.from("ops_activity_log").insert({
      bill_id: null,
      activity_type: "other",
      minutes: 0,
      occurred_on: "2026-06-18",
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23514");
  });
});
```

- [ ] **Step 2: 統合テストを実行**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && dotenv -e .env -- vitest run --config tests/supabase/vitest.config.mts tests/supabase/ops-activity-log-repository.test.ts`
Expected: PASS（2 テスト）。失敗時は `npx supabase status` で DB 起動を確認。

- [ ] **Step 3: コミット**

```bash
git add tests/supabase/ops-activity-log-repository.test.ts
git commit -m "test(ops-log): repository 統合テストを追加"
```

---

## Task 9: loader

**Files:**
- Create: `admin/src/features/ops-activity-log/server/loaders/load-ops-activity-logs.ts`

- [ ] **Step 1: loader を実装**

`admin/src/features/ops-activity-log/server/loaders/load-ops-activity-logs.ts`:

```ts
import type {
  BillLogGroup,
  BillOption,
  BillReferenceSignal,
  OpsActivityLogListItem,
} from "../../shared/types";
import { groupLogsByBill } from "../../shared/utils/aggregate-logs";
import { buildBillReferenceSignals } from "../../shared/utils/build-bill-reference-signals";
import {
  findAllOpsActivityLogs,
  findBillContentTimes,
  findBillOptions,
  findBillsForSignals,
  findInterviewConfigTimes,
} from "../repositories/ops-activity-log-repository";

export type OpsActivityLogPageData = {
  groups: BillLogGroup[];
  billOptions: BillOption[];
  referenceSignals: BillReferenceSignal[];
};

export async function loadOpsActivityLogs(): Promise<OpsActivityLogPageData> {
  const [logs, billOptions, bills, contentTimes, configTimes] =
    await Promise.all([
      findAllOpsActivityLogs(),
      findBillOptions(),
      findBillsForSignals(),
      findBillContentTimes(),
      findInterviewConfigTimes(),
    ]);

  const items: OpsActivityLogListItem[] = (logs ?? []).map((log) => ({
    id: log.id,
    bill_id: log.bill_id,
    activity_type: log.activity_type,
    minutes: log.minutes,
    note: log.note,
    occurred_on: log.occurred_on,
    created_at: log.created_at,
    updated_at: log.updated_at,
    bill_name: log.bills?.name ?? null,
  }));

  return {
    groups: groupLogsByBill(items),
    billOptions: (billOptions ?? []).map((b) => ({ id: b.id, name: b.name })),
    referenceSignals: buildBillReferenceSignals(
      bills ?? [],
      contentTimes ?? [],
      configTimes ?? []
    ),
  };
}
```

- [ ] **Step 2: 型チェック**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm --filter admin typecheck`
Expected: エラーなし。`log.bills` の型が単一オブジェクトか配列かで差が出た場合、`Array.isArray(log.bills) ? log.bills[0]?.name : log.bills?.name` に調整する。

- [ ] **Step 3: コミット**

```bash
git add admin/src/features/ops-activity-log/server/loaders/load-ops-activity-logs.ts
git commit -m "feat(ops-log): loader を追加"
```

---

## Task 10: server actions（作成 / 削除）

**Files:**
- Create: `admin/src/features/ops-activity-log/server/actions/create-ops-activity-log.ts`
- Create: `admin/src/features/ops-activity-log/server/actions/delete-ops-activity-log.ts`

- [ ] **Step 1: create アクションを実装**

`admin/src/features/ops-activity-log/server/actions/create-ops-activity-log.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import { routes } from "@/lib/routes";
import type { CreateOpsActivityLogInput } from "../../shared/types";
import { mapOpsDbError } from "../../shared/utils/map-ops-db-error";
import { createOpsActivityLogSchema } from "../../shared/utils/ops-activity-log-schema";
import { createOpsActivityLogRecord } from "../repositories/ops-activity-log-repository";

export async function createOpsActivityLog(input: CreateOpsActivityLogInput) {
  try {
    await requireAdmin();

    const parsed = createOpsActivityLogSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "入力内容が正しくありません" };
    }

    const result = await createOpsActivityLogRecord({
      bill_id: parsed.data.bill_id,
      activity_type: parsed.data.activity_type,
      minutes: parsed.data.minutes,
      note: parsed.data.note ?? null,
      occurred_on: parsed.data.occurred_on,
    });

    if (result.error) {
      return { error: mapOpsDbError(result.error, "作成") };
    }

    revalidatePath(routes.opsActivityLog());
    return { data: result.data };
  } catch (error) {
    console.error("Create ops activity log error:", error);
    return {
      error: getErrorMessage(error, "作業ログの作成中にエラーが発生しました"),
    };
  }
}
```

- [ ] **Step 2: delete アクションを実装**

`admin/src/features/ops-activity-log/server/actions/delete-ops-activity-log.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import { routes } from "@/lib/routes";
import type { DeleteOpsActivityLogInput } from "../../shared/types";
import { mapOpsDbError } from "../../shared/utils/map-ops-db-error";
import { deleteOpsActivityLogRecord } from "../repositories/ops-activity-log-repository";

export async function deleteOpsActivityLog(input: DeleteOpsActivityLogInput) {
  try {
    await requireAdmin();

    const result = await deleteOpsActivityLogRecord(input.id);
    if (result.error) {
      return { error: mapOpsDbError(result.error, "削除") };
    }

    revalidatePath(routes.opsActivityLog());
    return { success: true };
  } catch (error) {
    console.error("Delete ops activity log error:", error);
    return {
      error: getErrorMessage(error, "作業ログの削除中にエラーが発生しました"),
    };
  }
}
```

> 注: `routes.opsActivityLog()` は Task 12 で追加する。Task 12 まで typecheck は通らないので、本タスクでは typecheck を行わず次へ進む（Task 12 完了後にまとめて検証）。

- [ ] **Step 3: コミット**

```bash
git add admin/src/features/ops-activity-log/server/actions/
git commit -m "feat(ops-log): 作成/削除 server action を追加"
```

---

## Task 11: client コンポーネント（フォーム + 削除ボタン）

**Files:**
- Create: `admin/src/features/ops-activity-log/client/components/ops-activity-log-form.tsx`
- Create: `admin/src/features/ops-activity-log/client/components/ops-activity-log-delete-button.tsx`

- [ ] **Step 1: フォームを実装**

`admin/src/features/ops-activity-log/client/components/ops-activity-log-form.tsx`:

```tsx
"use client";

import type { FormEvent } from "react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOpsActivityLog } from "../../server/actions/create-ops-activity-log";
import type { BillOption, OpsActivityType } from "../../shared/types";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ORDER,
} from "../../shared/utils/activity-type-labels";

const NO_BILL = "__none__";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OpsActivityLogForm({ bills }: { bills: BillOption[] }) {
  const billId = useId();
  const typeId = useId();
  const minutesId = useId();
  const dateId = useId();
  const noteId = useId();

  const [bill, setBill] = useState<string>(NO_BILL);
  const [activityType, setActivityType] = useState<OpsActivityType>("content");
  const [minutes, setMinutes] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayString());
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const minutesNum = Number(minutes);
    if (!Number.isInteger(minutesNum) || minutesNum <= 0) {
      toast.error("作業時間は1分以上の整数で入力してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOpsActivityLog({
        bill_id: bill === NO_BILL ? null : bill,
        activity_type: activityType,
        minutes: minutesNum,
        note: note.trim() === "" ? null : note.trim(),
        occurred_on: occurredOn,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("作業ログを追加しました");
        setMinutes("");
        setNote("");
      }
    } catch (error) {
      console.error("Create ops activity log error:", error);
      toast.error("作業ログの追加に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={billId}>議案（任意）</Label>
          <Select value={bill} onValueChange={setBill}>
            <SelectTrigger id={billId}>
              <SelectValue placeholder="議案を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_BILL}>議案に紐づかない作業</SelectItem>
              {bills.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={typeId}>作業種別</Label>
          <Select
            value={activityType}
            onValueChange={(v) => setActivityType(v as OpsActivityType)}
          >
            <SelectTrigger id={typeId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPE_ORDER.map((type) => (
                <SelectItem key={type} value={type}>
                  {ACTIVITY_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={minutesId}>作業時間（分）</Label>
          <Input
            id={minutesId}
            type="number"
            min={1}
            step={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="例: 90"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={dateId}>作業日</Label>
          <Input
            id={dateId}
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={noteId}>メモ（任意・ボトルネック等）</Label>
        <Input
          id={noteId}
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="詰まったポイントなど"
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "追加中..." : "作業ログを追加"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: 削除ボタンを実装**

`admin/src/features/ops-activity-log/client/components/ops-activity-log-delete-button.tsx`:

```tsx
"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteOpsActivityLog } from "../../server/actions/delete-ops-activity-log";

export function OpsActivityLogDeleteButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("この作業ログを削除しますか？")) {
      return;
    }
    setIsDeleting(true);
    try {
      const result = await deleteOpsActivityLog({ id });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("作業ログを削除しました");
      }
    } catch (error) {
      console.error("Delete ops activity log error:", error);
      toast.error("作業ログの削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={isDeleting}
      aria-label="削除"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
```

- [ ] **Step 3: コミット**

```bash
git add admin/src/features/ops-activity-log/client/components/
git commit -m "feat(ops-log): フォームと削除ボタンの client コンポーネントを追加"
```

---

## Task 12: ルート定義とナビゲーション

**Files:**
- Modify: `admin/src/lib/routes.ts`
- Modify: `admin/src/app/(protected)/layout/navigation-links.tsx`

- [ ] **Step 1: ルートを追加**

`admin/src/lib/routes.ts` の `routes` オブジェクト内、`interviewOpinionBackfill` の行の直後に追加:

```ts
  opsActivityLog: () => "/ops-activity-log" as const,
```

- [ ] **Step 2: ナビゲーションリンクを追加**

`admin/src/app/(protected)/layout/navigation-links.tsx` の `navigationLinks` 配列、`{ href: routes.admins(), label: "管理者" }` の直前に追加:

```ts
  { href: routes.opsActivityLog(), label: "作業ログ" },
```

- [ ] **Step 3: コミット**

```bash
git add admin/src/lib/routes.ts admin/src/app/(protected)/layout/navigation-links.tsx
git commit -m "feat(ops-log): ルート定義とナビゲーションリンクを追加"
```

---

## Task 13: server コンポーネント（一覧表示）とページ

**Files:**
- Create: `admin/src/features/ops-activity-log/server/components/ops-activity-log-view.tsx`
- Create: `admin/src/app/(protected)/ops-activity-log/page.tsx`

- [ ] **Step 1: 一覧 view を実装**

`admin/src/features/ops-activity-log/server/components/ops-activity-log-view.tsx`:

```tsx
import type {
  BillLogGroup,
  BillReferenceSignal,
} from "../../shared/types";
import { getActivityTypeLabel } from "../../shared/utils/activity-type-labels";
import { formatMinutes } from "../../shared/utils/format-minutes";
import { OpsActivityLogDeleteButton } from "../../client/components/ops-activity-log-delete-button";

function ReferenceSignals({ signals }: { signals: BillReferenceSignal[] }) {
  const withSignal = signals.filter(
    (s) =>
      s.content_span_hours !== null ||
      s.interview_config_span_hours !== null ||
      s.published_at !== null
  );
  if (withSignal.length === 0) return null;

  return (
    <section className="rounded-lg border bg-white p-6">
      <h2 className="mb-1 text-lg font-semibold">参考: 着手〜更新の経過</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        既存データから算出したカレンダー経過です。実作業時間ではないため、入力の目安としてのみ参照してください。
      </p>
      <ul className="space-y-2 text-sm">
        {withSignal.map((s) => (
          <li key={s.bill_id} className="flex flex-wrap gap-x-4">
            <span className="font-medium">{s.bill_name}</span>
            {s.content_span_hours !== null && (
              <span>
                コンテンツ: 約{s.content_span_hours}時間（{s.content_count}本）
              </span>
            )}
            {s.interview_config_span_hours !== null && (
              <span>設定: 約{s.interview_config_span_hours}時間</span>
            )}
            {s.published_at && (
              <span>公開: {s.published_at.slice(0, 10)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OpsActivityLogView({
  groups,
  referenceSignals,
}: {
  groups: BillLogGroup[];
  referenceSignals: BillReferenceSignal[];
}) {
  return (
    <div className="space-y-8">
      <ReferenceSignals signals={referenceSignals} />

      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">記録一覧（議案別）</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            まだ作業ログがありません。上のフォームから追加してください。
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.bill_id ?? "__null__"}>
                <h3 className="mb-2 font-medium">
                  {group.bill_name ?? "議案に紐づかない作業"}
                  <span className="ml-2 text-sm text-muted-foreground">
                    合計 {formatMinutes(group.total_minutes)}
                  </span>
                </h3>
                <ul className="divide-y">
                  {group.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="flex flex-wrap gap-x-3">
                        <span className="text-muted-foreground">
                          {entry.occurred_on}
                        </span>
                        <span>{getActivityTypeLabel(entry.activity_type)}</span>
                        <span className="font-medium">
                          {formatMinutes(entry.minutes)}
                        </span>
                        {entry.note && (
                          <span className="text-muted-foreground">
                            {entry.note}
                          </span>
                        )}
                      </span>
                      <OpsActivityLogDeleteButton id={entry.id} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: ページを実装**

`admin/src/app/(protected)/ops-activity-log/page.tsx`:

```tsx
import { OpsActivityLogForm } from "@/features/ops-activity-log/client/components/ops-activity-log-form";
import { OpsActivityLogView } from "@/features/ops-activity-log/server/components/ops-activity-log-view";
import { loadOpsActivityLogs } from "@/features/ops-activity-log/server/loaders/load-ops-activity-logs";

export default async function OpsActivityLogPage() {
  const { groups, billOptions, referenceSignals } =
    await loadOpsActivityLogs();

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-2 text-2xl font-bold">作業ログ</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        議案を公開状態にするまでの作業時間を記録します。PoC の労力実測に使います。
      </p>

      <section className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">作業を記録</h2>
        <OpsActivityLogForm bills={billOptions} />
      </section>

      <OpsActivityLogView groups={groups} referenceSignals={referenceSignals} />
    </div>
  );
}
```

- [ ] **Step 3: routes.test.ts が通ることを確認（page と routes の同期）**

Run: `pnpm --filter admin exec vitest run src/lib/routes.test.ts`
Expected: PASS（`/ops-activity-log` が page と routes の双方に存在）。

- [ ] **Step 4: コミット**

```bash
git add admin/src/features/ops-activity-log/server/components/ops-activity-log-view.tsx "admin/src/app/(protected)/ops-activity-log/page.tsx"
git commit -m "feat(ops-log): 一覧 view と専用ページを追加"
```

---

## Task 14: RLS default-deny テストに新テーブルを追加

**Files:**
- Modify: `tests/supabase/rls/default-deny.test.ts`

- [ ] **Step 1: tables 配列に追加**

`tests/supabase/rls/default-deny.test.ts` の `tables` 配列の `"interview_report",` の直後に追加:

```ts
  "ops_activity_log",
```

- [ ] **Step 2: RLS テストを実行**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && dotenv -e .env -- vitest run --config tests/supabase/vitest.config.mts tests/supabase/rls/default-deny.test.ts`
Expected: PASS（`ops_activity_log` の anon SELECT が空 or エラーになる）。

- [ ] **Step 3: コミット**

```bash
git add tests/supabase/rls/default-deny.test.ts
git commit -m "test(ops-log): RLS default-deny テストに ops_activity_log を追加"
```

---

## Task 15: Grafana パネル追加

**Files:**
- Modify: `observability/grafana/dashboards/poc-overview.json`

- [ ] **Step 1: パネルを追加**

`observability/grafana/dashboards/poc-overview.json` の `panels` 配列の末尾（最後のパネルオブジェクトの後ろ、`]` の前）に、以下3パネルをカンマ区切りで追加する。既存の最後のパネルは `id: 9` / `gridPos.y: 20` のため、`y` は 28 以降にする。

```json
,
{
  "id": 10,
  "title": "議案あたり作業時間 (時間)",
  "type": "barchart",
  "datasource": { "type": "postgres", "uid": "mirai-supabase" },
  "gridPos": { "h": 8, "w": 12, "x": 0, "y": 28 },
  "fieldConfig": { "defaults": { "unit": "h" }, "overrides": [] },
  "options": { "orientation": "horizontal", "legend": { "showLegend": false } },
  "targets": [
    {
      "datasource": { "type": "postgres", "uid": "mirai-supabase" },
      "format": "table",
      "rawQuery": true,
      "rawSql": "select coalesce(b.name, '（議案に紐づかない作業）') as \"議案\", round(sum(o.minutes)/60.0, 1) as \"作業時間\" from ops_activity_log o left join bills b on b.id = o.bill_id group by b.name order by 2 desc;",
      "refId": "A"
    }
  ]
},
{
  "id": 11,
  "title": "作業種別別の作業時間 (時間)",
  "type": "piechart",
  "datasource": { "type": "postgres", "uid": "mirai-supabase" },
  "gridPos": { "h": 8, "w": 12, "x": 12, "y": 28 },
  "fieldConfig": { "defaults": { "unit": "h" }, "overrides": [] },
  "options": { "legend": { "displayMode": "list", "placement": "right", "showLegend": true } },
  "targets": [
    {
      "datasource": { "type": "postgres", "uid": "mirai-supabase" },
      "format": "table",
      "rawQuery": true,
      "rawSql": "select case activity_type when 'selection' then '議案選定' when 'content' then 'コンテンツ作成' when 'interview_config' then 'インタビュー設定' when 'review' then 'レビュー・公開' else 'その他' end as \"種別\", round(sum(minutes)/60.0, 1) as \"作業時間\" from ops_activity_log group by activity_type order by 2 desc;",
      "refId": "A"
    }
  ]
},
{
  "id": 12,
  "title": "当月の累計作業時間 (時間)",
  "type": "stat",
  "datasource": { "type": "postgres", "uid": "mirai-supabase" },
  "gridPos": { "h": 8, "w": 12, "x": 0, "y": 36 },
  "fieldConfig": { "defaults": { "unit": "h" }, "overrides": [] },
  "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "colorMode": "value", "graphMode": "none" },
  "targets": [
    {
      "datasource": { "type": "postgres", "uid": "mirai-supabase" },
      "format": "table",
      "rawQuery": true,
      "rawSql": "select round(coalesce(sum(minutes),0)/60.0, 1) as \"当月作業時間\" from ops_activity_log where occurred_on >= date_trunc('month', current_date);",
      "refId": "A"
    }
  ]
}
```

- [ ] **Step 2: JSON が壊れていないか検証**

Run: `python3 -c "import json; json.load(open('observability/grafana/dashboards/poc-overview.json')); print('valid')"`
Expected: `valid`。

- [ ] **Step 3: コミット**

```bash
git add observability/grafana/dashboards/poc-overview.json
git commit -m "feat(ops-log): Grafana に作業時間パネルを追加"
```

---

## Task 16: 全体検証（push 前ゲート）

**Files:** なし（検証のみ）

- [ ] **Step 1: lint**

Run: `pnpm lint`
Expected: エラーなし（警告は既存分のみ）。差分があれば `pnpm lint:fix` で整形して再確認。

- [ ] **Step 2: 型チェック**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm typecheck`
Expected: 全ワークスペースでエラーなし。

- [ ] **Step 3: ユニットテスト**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm test`
Expected: 全 PASS（新規 5 ファイルの純粋関数テスト + routes.test.ts を含む）。

- [ ] **Step 4: 統合テスト**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && dotenv -e .env -- vitest run --config tests/supabase/vitest.config.mts tests/supabase/ops-activity-log-repository.test.ts tests/supabase/rls/default-deny.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: ビルド**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm build`
Expected: web/admin ともにビルド成功。

- [ ] **Step 6: フォーマット整形差分があればコミット**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore(ops-log): lint 整形"
```

セルフレビュー（`/simplify` → `/review`）の後、push・PR 作成（base: `poc/saitama-mirai-gikai`）に進む。UI 変更を含むため `/pr-screenshot` 対象。

---

## Self-Review 結果（プラン作成者による確認）

- **Spec coverage**: §2 データモデル→Task1 / §3 参考シグナル→Task5,9,13 / §4 admin機能→Task2-13 / §5 Grafana→Task15 / §6 エラーハンドリング→Task6,10,11 / §7 テスト→Task3-8,13,14 / §9 受け入れ条件→Task16。漏れなし。
- **Placeholder scan**: TBD/TODO 無し。全ステップに具体コード・コマンド・期待値を記載。
- **Type consistency**: `OpsActivityType` / `OpsActivityLogListItem` / `BillLogGroup` / `BillReferenceSignal` / `BillOption` / `CreateOpsActivityLogInput` / `DeleteOpsActivityLogInput` は Task2 で定義し、以降で一貫使用。`createOpsActivityLog` / `deleteOpsActivityLog` / `routes.opsActivityLog()` のシグネチャは定義箇所と利用箇所で一致。
- **既知の前後依存**: Task10 の action は `routes.opsActivityLog()`（Task12）に依存するため、Task10 単体では typecheck せず Task12 以降でまとめて検証する旨を明記済み。
