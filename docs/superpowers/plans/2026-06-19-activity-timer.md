# 編集ページ作業時間タイマー実測 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** コンテンツ編集・インタビュー設定の保存時に、編集ページを開いていた実時間を計測してダイアログで確認し、`ops_activity_log` に登録する。

**Architecture:** `ops-activity-log` feature の `client/` に共有部品（visibility対応の累積タイマー hook・確認ダイアログ・束ねる hook・純粋関数2本）を追加し、2つの編集フォームから `useActivityLogPrompt` を呼ぶ。登録は3-Bの `createOpsActivityLog` を再利用。DB・Grafana 変更なし。

**Tech Stack:** Next.js 15 (App Router, Client Components) / React hooks / Radix AlertDialog (`@/components/ui/alert-dialog`) / sonner / Vitest

## Global Constraints

- Biome: 2スペース・ダブルクォート・セミコロン・80桁・LF。
- アイコンは `lucide-react`、ボタンは `@/components/ui/button` の `Button`（生 `<button>` 禁止）。インラインカラー禁止。
- `pnpm` は `corepack pnpm`。`pnpm -r` 系（`typecheck`/`build`/`test`）は `export PATH="/tmp/pnpm-shim:$PATH"` を前置。単一テストは `pnpm --filter admin exec vitest run <admin相対パス>`。
- 作業ディレクトリは worktree `../mirai-gikai-activity-timer`（ブランチ `saitama/activity-timer`、base `poc/saitama-mirai-gikai`）。
- 設計: [docs/superpowers/specs/2026-06-19-activity-timer-design.md](../specs/2026-06-19-activity-timer-design.md)。

## ファイル構成（作成/変更）

- Create: `admin/src/features/ops-activity-log/client/utils/sum-active-ms.ts` (+ `.test.ts`)
- Create: `admin/src/features/ops-activity-log/client/utils/compute-elapsed-minutes.ts` (+ `.test.ts`)
- Create: `admin/src/features/ops-activity-log/client/hooks/use-activity-timer.ts`
- Create: `admin/src/features/ops-activity-log/client/components/activity-log-prompt-dialog.tsx`
- Create: `admin/src/features/ops-activity-log/client/hooks/use-activity-log-prompt.tsx`
- Modify: `admin/src/features/bills-edit/client/components/bill-contents-edit-form.tsx`
- Modify: `admin/src/features/interview-config/client/components/interview-config-form.tsx`

---

## Task 1: 純粋関数 `sumActiveMs`（TDD）

**Files:**
- Create: `admin/src/features/ops-activity-log/client/utils/sum-active-ms.ts`
- Test: `admin/src/features/ops-activity-log/client/utils/sum-active-ms.test.ts`

**Interfaces:**
- Produces: `type ActiveSegment = { start: number; end: number }`、`sumActiveMs(segments: ActiveSegment[]): number`

- [ ] **Step 1: 失敗するテストを書く**

`admin/src/features/ops-activity-log/client/utils/sum-active-ms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sumActiveMs } from "./sum-active-ms";

describe("sumActiveMs", () => {
  it("空配列は0", () => {
    expect(sumActiveMs([])).toBe(0);
  });
  it("単一区間の差分を返す", () => {
    expect(sumActiveMs([{ start: 0, end: 1000 }])).toBe(1000);
  });
  it("複数区間を合計する", () => {
    expect(
      sumActiveMs([
        { start: 0, end: 1000 },
        { start: 2000, end: 2500 },
      ])
    ).toBe(1500);
  });
  it("終了が開始より前の異常区間は0として扱う", () => {
    expect(sumActiveMs([{ start: 1000, end: 500 }])).toBe(0);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/client/utils/sum-active-ms.test.ts`
Expected: FAIL（`sum-active-ms` が存在しない）。

- [ ] **Step 3: 最小実装**

`admin/src/features/ops-activity-log/client/utils/sum-active-ms.ts`:

```ts
export type ActiveSegment = { start: number; end: number };

/** アクティブ区間（ミリ秒タイムスタンプ）の合計ミリ秒。異常区間は0として扱う。 */
export function sumActiveMs(segments: ActiveSegment[]): number {
  return segments.reduce(
    (total, segment) => total + Math.max(0, segment.end - segment.start),
    0
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/client/utils/sum-active-ms.test.ts`
Expected: PASS（4 tests）。

- [ ] **Step 5: コミット**

```bash
git add admin/src/features/ops-activity-log/client/utils/sum-active-ms.ts admin/src/features/ops-activity-log/client/utils/sum-active-ms.test.ts
git commit -m "feat(ops-log): sumActiveMs 純粋関数を追加"
```

---

## Task 2: 純粋関数 `computeElapsedMinutes`（TDD）

**Files:**
- Create: `admin/src/features/ops-activity-log/client/utils/compute-elapsed-minutes.ts`
- Test: `admin/src/features/ops-activity-log/client/utils/compute-elapsed-minutes.test.ts`

**Interfaces:**
- Produces: `computeElapsedMinutes(activeMs: number): number`

- [ ] **Step 1: 失敗するテストを書く**

`admin/src/features/ops-activity-log/client/utils/compute-elapsed-minutes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeElapsedMinutes } from "./compute-elapsed-minutes";

describe("computeElapsedMinutes", () => {
  it("0ms は最低1分", () => {
    expect(computeElapsedMinutes(0)).toBe(1);
  });
  it("1分未満は最低1分に切り上げる", () => {
    expect(computeElapsedMinutes(20_000)).toBe(1);
  });
  it("四捨五入する（1.5分→2分）", () => {
    expect(computeElapsedMinutes(90_000)).toBe(2);
  });
  it("23分相当を23に丸める", () => {
    expect(computeElapsedMinutes(1_380_000)).toBe(23);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/client/utils/compute-elapsed-minutes.test.ts`
Expected: FAIL。

- [ ] **Step 3: 最小実装**

`admin/src/features/ops-activity-log/client/utils/compute-elapsed-minutes.ts`:

```ts
/** アクティブ時間(ミリ秒)を表示用の「分」に変換する。`minutes > 0` 制約のため最低1分。 */
export function computeElapsedMinutes(activeMs: number): number {
  return Math.max(1, Math.round(activeMs / 60_000));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm --filter admin exec vitest run src/features/ops-activity-log/client/utils/compute-elapsed-minutes.test.ts`
Expected: PASS（4 tests）。

- [ ] **Step 5: コミット**

```bash
git add admin/src/features/ops-activity-log/client/utils/compute-elapsed-minutes.ts admin/src/features/ops-activity-log/client/utils/compute-elapsed-minutes.test.ts
git commit -m "feat(ops-log): computeElapsedMinutes 純粋関数を追加"
```

---

## Task 3: `useActivityTimer` hook

**Files:**
- Create: `admin/src/features/ops-activity-log/client/hooks/use-activity-timer.ts`

**Interfaces:**
- Consumes: `sumActiveMs`, `type ActiveSegment`（Task 1）
- Produces: `useActivityTimer(): { getElapsedMs: () => number; reset: () => void }`

- [ ] **Step 1: 実装**

`admin/src/features/ops-activity-log/client/hooks/use-activity-timer.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef } from "react";
import { type ActiveSegment, sumActiveMs } from "../utils/sum-active-ms";

/**
 * マウント中のアクティブ時間を累積する。タブ非表示（document.hidden）の間は
 * 計測を一時停止する。getElapsedMs で現在までの累積ミリ秒、reset で計測をやり直す。
 */
export function useActivityTimer(): {
  getElapsedMs: () => number;
  reset: () => void;
} {
  const segmentsRef = useRef<ActiveSegment[]>([]);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    // マウント時、表示中なら計測開始
    startRef.current = document.hidden ? null : Date.now();

    const handleVisibility = () => {
      if (document.hidden) {
        if (startRef.current !== null) {
          segmentsRef.current.push({
            start: startRef.current,
            end: Date.now(),
          });
          startRef.current = null;
        }
      } else {
        startRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const getElapsedMs = useCallback(() => {
    const closed = sumActiveMs(segmentsRef.current);
    const open = startRef.current !== null ? Date.now() - startRef.current : 0;
    return closed + open;
  }, []);

  const reset = useCallback(() => {
    segmentsRef.current = [];
    startRef.current = document.hidden ? null : Date.now();
  }, []);

  return { getElapsedMs, reset };
}
```

- [ ] **Step 2: 型チェック**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm --filter admin typecheck`
Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add admin/src/features/ops-activity-log/client/hooks/use-activity-timer.ts
git commit -m "feat(ops-log): useActivityTimer hook を追加"
```

---

## Task 4: `ActivityLogPromptDialog` コンポーネント

**Files:**
- Create: `admin/src/features/ops-activity-log/client/components/activity-log-prompt-dialog.tsx`

**Interfaces:**
- Consumes: `computeElapsedMinutes`（Task 2）、`createOpsActivityLog`（3-B, `@/features/ops-activity-log/server/actions/create-ops-activity-log`）、`OpsActivityType`（`@/features/ops-activity-log/shared/types`）、`ACTIVITY_TYPE_ORDER`/`ACTIVITY_TYPE_LABELS`（`@/features/ops-activity-log/shared/utils/activity-type-labels`）
- Produces: `ActivityLogPromptDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; billId: string; elapsedMs: number; defaultActivityType: OpsActivityType; onRecorded: () => void }): JSX.Element`

- [ ] **Step 1: 実装**

`admin/src/features/ops-activity-log/client/components/activity-log-prompt-dialog.tsx`:

```tsx
"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { createOpsActivityLog } from "@/features/ops-activity-log/server/actions/create-ops-activity-log";
import type { OpsActivityType } from "@/features/ops-activity-log/shared/types";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ORDER,
} from "@/features/ops-activity-log/shared/utils/activity-type-labels";
import { computeElapsedMinutes } from "../utils/compute-elapsed-minutes";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ActivityLogPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string;
  elapsedMs: number;
  defaultActivityType: OpsActivityType;
  onRecorded: () => void;
}

export function ActivityLogPromptDialog({
  open,
  onOpenChange,
  billId,
  elapsedMs,
  defaultActivityType,
  onRecorded,
}: ActivityLogPromptDialogProps) {
  const minutesId = useId();
  const typeId = useId();
  const noteId = useId();

  const [minutes, setMinutes] = useState("");
  const [activityType, setActivityType] =
    useState<OpsActivityType>(defaultActivityType);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ダイアログを開くたびに、計測値・初期種別で内容を初期化する
  useEffect(() => {
    if (open) {
      setMinutes(String(computeElapsedMinutes(elapsedMs)));
      setActivityType(defaultActivityType);
      setNote("");
    }
  }, [open, elapsedMs, defaultActivityType]);

  const handleRecord = async () => {
    const minutesNum = Number(minutes);
    if (!Number.isInteger(minutesNum) || minutesNum <= 0) {
      toast.error("作業時間は1分以上の整数で入力してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOpsActivityLog({
        bill_id: billId,
        activity_type: activityType,
        minutes: minutesNum,
        note: note.trim() === "" ? null : note.trim(),
        occurred_on: todayString(),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("作業ログに記録しました");
      onRecorded();
    } catch (error) {
      console.error("Record activity log error:", error);
      toast.error("作業ログの記録に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const measuredMinutes = computeElapsedMinutes(elapsedMs);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>作業ログに記録しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            今回の編集の計測時間: 約 {measuredMinutes} 分
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor={minutesId}>作業時間（分）</Label>
              <Input
                id={minutesId}
                type="number"
                min={1}
                step={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor={typeId}>種別</Label>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor={noteId}>メモ（任意）</Label>
            <Input
              id={noteId}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="詰まったポイントなど"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            記録しない
          </Button>
          <Button type="button" onClick={handleRecord} disabled={isSubmitting}>
            {isSubmitting ? "記録中..." : "記録する"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm --filter admin typecheck`
Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add admin/src/features/ops-activity-log/client/components/activity-log-prompt-dialog.tsx
git commit -m "feat(ops-log): 作業ログ記録確認ダイアログを追加"
```

---

## Task 5: `useActivityLogPrompt` hook（タイマー＋ダイアログを束ねる）

**Files:**
- Create: `admin/src/features/ops-activity-log/client/hooks/use-activity-log-prompt.tsx`

**Interfaces:**
- Consumes: `useActivityTimer`（Task 3）、`ActivityLogPromptDialog`（Task 4）、`OpsActivityType`
- Produces: `useActivityLogPrompt(params: { billId: string; defaultActivityType: OpsActivityType }): { promptAfterSave: () => void; dialog: React.ReactNode }`

> 注: JSX を返すため拡張子は `.tsx`。

- [ ] **Step 1: 実装**

`admin/src/features/ops-activity-log/client/hooks/use-activity-log-prompt.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import type { OpsActivityType } from "@/features/ops-activity-log/shared/types";
import { ActivityLogPromptDialog } from "../components/activity-log-prompt-dialog";
import { useActivityTimer } from "./use-activity-timer";

/**
 * 編集ページの保存成功後に、計測時間の記録確認ダイアログを開くための hook。
 * promptAfterSave() を保存成功時に呼び、返り値の dialog をフォーム JSX に描画する。
 */
export function useActivityLogPrompt(params: {
  billId: string;
  defaultActivityType: OpsActivityType;
}): { promptAfterSave: () => void; dialog: ReactNode } {
  const { billId, defaultActivityType } = params;
  const timer = useActivityTimer();
  const [open, setOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const promptAfterSave = useCallback(() => {
    setElapsedMs(timer.getElapsedMs());
    setOpen(true);
  }, [timer]);

  const dialog = (
    <ActivityLogPromptDialog
      open={open}
      onOpenChange={setOpen}
      billId={billId}
      elapsedMs={elapsedMs}
      defaultActivityType={defaultActivityType}
      onRecorded={() => {
        timer.reset();
        setOpen(false);
      }}
    />
  );

  return { promptAfterSave, dialog };
}
```

- [ ] **Step 2: 型チェック**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm --filter admin typecheck`
Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add admin/src/features/ops-activity-log/client/hooks/use-activity-log-prompt.tsx
git commit -m "feat(ops-log): useActivityLogPrompt hook を追加"
```

---

## Task 6: コンテンツ編集フォームに組み込み

**Files:**
- Modify: `admin/src/features/bills-edit/client/components/bill-contents-edit-form.tsx`

**Interfaces:**
- Consumes: `useActivityLogPrompt`（Task 5）

- [ ] **Step 1: import を追加**

`bill-contents-edit-form.tsx` の import 群の末尾（`import { billContentsUpdateSchema, ... } from "../../shared/types/bill-contents";` の後）に追加:

```tsx
import { useActivityLogPrompt } from "@/features/ops-activity-log/client/hooks/use-activity-log-prompt";
```

- [ ] **Step 2: hook を呼び出す**

`export function BillContentsEditForm(...)` 内、`const [error, setError] = useState<string | null>(null);` の直後に追加:

```tsx
  const { promptAfterSave, dialog } = useActivityLogPrompt({
    billId: bill.id,
    defaultActivityType: "content",
  });
```

- [ ] **Step 3: 保存成功時に prompt を呼ぶ**

`onSubmit` 内の成功分岐を次のように変更:

```tsx
    if (result.success) {
      toast.success("議案コンテンツを更新しました");
      promptAfterSave();
    } else {
```

- [ ] **Step 4: ダイアログを描画する**

`return (` の最初の要素 `<Card>` を `dialog` と並べるため、`<Card>` 全体を Fragment で包む。`return (` 直後を次の形にする（`<Card>` の閉じ `</Card>` の後に `{dialog}` を置く）:

```tsx
  return (
    <>
      <Card>
```

そして末尾の `</Card>` の直後（`);` の前）に追加:

```tsx
      </Card>
      {dialog}
    </>
  );
```

- [ ] **Step 5: 型チェック**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm --filter admin typecheck`
Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add admin/src/features/bills-edit/client/components/bill-contents-edit-form.tsx
git commit -m "feat(ops-log): コンテンツ編集の保存時に作業時間記録ダイアログを表示"
```

---

## Task 7: インタビュー設定フォームに組み込み

**Files:**
- Modify: `admin/src/features/interview-config/client/components/interview-config-form.tsx`

**Interfaces:**
- Consumes: `useActivityLogPrompt`（Task 5）

> 注: 新規作成は保存後に別ページへ遷移するため計測ダイアログは出さない。**更新（既存設定の保存）成功時のみ** prompt を呼ぶ。

- [ ] **Step 1: import を追加**

`interview-config-form.tsx` の import 群の末尾（`import { generateDefaultConfigName } from "../../shared/utils/default-config-name";` の後）に追加:

```tsx
import { useActivityLogPrompt } from "@/features/ops-activity-log/client/hooks/use-activity-log-prompt";
```

- [ ] **Step 2: hook を呼び出す**

`export function InterviewConfigForm(...)` 内、`const isNew = !config;` の直後に追加:

```tsx
  const { promptAfterSave, dialog } = useActivityLogPrompt({
    billId,
    defaultActivityType: "interview_config",
  });
```

- [ ] **Step 3: 更新成功時に prompt を呼ぶ**

`handleSubmit` 内、`else { ... router.refresh(); }` ブロックを次のように変更:

```tsx
        } else {
          toast.success("インタビュー設定を保存しました");
          promptAfterSave();
          router.refresh();
        }
```

- [ ] **Step 4: ダイアログを描画する**

`return (` 直後の `<div className="space-y-4">` の中の末尾（最後の `</Card>` の後、`</div>` の前）に `{dialog}` を追加:

```tsx
      </Card>
      {dialog}
    </div>
  );
```

- [ ] **Step 5: 型チェック**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm --filter admin typecheck`
Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add admin/src/features/interview-config/client/components/interview-config-form.tsx
git commit -m "feat(ops-log): インタビュー設定の保存時に作業時間記録ダイアログを表示"
```

---

## Task 8: 全体検証（push 前ゲート）

**Files:** なし（検証のみ）

- [ ] **Step 1: lint**

Run: `pnpm lint`
Expected: エラーなし（警告は既存分のみ）。差分があれば `pnpm lint:fix` で整形して再確認。

- [ ] **Step 2: 型チェック**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm typecheck`
Expected: 全ワークスペースでエラーなし。

- [ ] **Step 3: テスト**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm test`
Expected: 全 PASS（新規 `sum-active-ms` / `compute-elapsed-minutes` テストを含む）。

- [ ] **Step 4: ビルド**

Run: `export PATH="/tmp/pnpm-shim:$PATH" && pnpm build`
Expected: web/admin ともにビルド成功。

- [ ] **Step 5: フォーマット整形差分があればコミット**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore(ops-log): lint 整形"
```

セルフレビュー（`/simplify` → `/review`）の後、push・PR 作成（base: `poc/saitama-mirai-gikai`）に進む。UI 変更を含むため `/pr-screenshot` 対象。

---

## Self-Review 結果（プラン作成者による確認）

- **Spec coverage**: §1 計測方式→Task3（visibility停止）/ §2 対象2ボタン→Task6,7 / §3 ダイアログ→Task4 / §4 アーキテクチャ→Task1-5 / §5 エラーハンドリング→Task4（失敗時トースト・非リセット・分バリデーション）/ §6 テスト→Task1,2（純粋関数）/ §8 受け入れ条件→Task8。漏れなし。
- **Placeholder scan**: TBD/TODO 無し。全ステップに具体コード・コマンド・期待値。
- **Type consistency**: `ActiveSegment`/`sumActiveMs`（T1）→ `useActivityTimer`（T3）で一致。`computeElapsedMinutes`（T2）→ ダイアログ（T4）で一致。`useActivityLogPrompt({billId, defaultActivityType})` の戻り `{promptAfterSave, dialog}`（T5）→ フォーム（T6,7）で一致。`createOpsActivityLog` の入力 `{bill_id, activity_type, minutes, note, occurred_on}` は 3-B の `CreateOpsActivityLogInput` と一致。
- **既知の留意**: インタビュー新規作成は遷移するため prompt 非対象（Task7 冒頭に明記）。フォーム JSX は Fragment 追加が必要（Task6 Step4 / Task7 Step4 に具体手順）。
