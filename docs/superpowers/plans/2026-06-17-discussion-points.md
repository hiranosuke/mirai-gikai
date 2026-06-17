# 「論点整理」転用（mirai_stances → discussion_points）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** さいたま市版で「チームみらいの賛否」を、特定主体が賛否を表明する構造ごと廃止し、議案の賛成論拠／反対論拠を中立に併記する「論点整理」へ転用する。

**Architecture:** DB テーブル `mirai_stances` を `discussion_points` にリネームし、賛否判定カラム `type` とロゴ/バッジ/党装飾の表示を撤去。`pro_points`/`con_points` の2テキストで賛成・反対の論拠を保持し、web は中立な `DiscussionPointsCard` で表示、admin は2テキスト欄で手動編集する。`stance_type_enum` は市民回答（`interview_report.stance`）で使うため温存する。

**Tech Stack:** Next.js (web/admin), Supabase (Postgres + 生成型), Vitest, pnpm workspace, Biome。

参照スペック: [`docs/superpowers/specs/2026-06-17-discussion-points-design.md`](../specs/2026-06-17-discussion-points-design.md)

---

## File Structure

**DB**
- Create: `supabase/migrations/20260617120000_rename_mirai_stances_to_discussion_points.sql`
- Modify (生成): `packages/supabase/types/supabase.types.ts`

**web**
- Modify: `web/src/features/bills/shared/types/index.ts`（型のリネーム・不要エクスポート削除）
- Delete: `web/src/features/bills/shared/utils/stance-styles.ts`, `web/src/features/bills/shared/utils/stance-styles.test.ts`
- Delete: `web/src/features/bills/client/components/bill-detail/mirai-stance-card.tsx`
- Create: `web/src/features/bills/client/components/bill-detail/discussion-points-card.tsx`
- Modify: `web/src/features/bills/server/components/bill-detail/bill-detail-layout.tsx`
- Modify: `web/src/features/bills/server/repositories/bill-repository.ts`
- Modify: `web/src/features/bills/server/loaders/get-bill-by-id.ts`, `get-bill-by-id-admin.ts`
- Modify: `web/src/features/bills/server/repositories/bill-repository.integration.test.ts`

**admin**（feature ディレクトリを `mirai-stance` → `discussion-points` にリネーム）
- Move/Modify: `admin/src/features/discussion-points/shared/types/index.ts`
- Move/Modify: `admin/src/features/discussion-points/server/repositories/discussion-points-repository.ts`
- Move/Modify: `admin/src/features/discussion-points/server/actions/{create,update,delete}-discussion-points.ts`
- Move/Modify: `admin/src/features/discussion-points/server/loaders/get-discussion-points-by-bill-id.ts`
- Move/Modify: `admin/src/features/discussion-points/client/components/discussion-points-form.tsx`
- Modify: `admin/src/app/(protected)/bills/[id]/edit/page.tsx`

**seed / test-utils**
- Modify: `packages/seed/main/data.ts`, `packages/seed/main/run.ts`, `packages/seed/shared/helper.ts`
- Modify: `tests/supabase/utils.ts`

---

## Task 1: DB migration（テーブル転用）+ 型再生成

**Files:**
- Create: `supabase/migrations/20260617120000_rename_mirai_stances_to_discussion_points.sql`
- Modify (生成): `packages/supabase/types/supabase.types.ts`

- [ ] **Step 1: マイグレーションファイルを作成**

`supabase/migrations/20260617120000_rename_mirai_stances_to_discussion_points.sql`:

```sql
-- mirai_stances を中立な「論点整理」テーブルへ転用する。
-- さいたま市議会版では特定主体（政党）が賛否を表明する前提を廃止し、
-- 賛成の論拠／反対の論拠を中立に併記する構造へ変更する。
-- stance_type_enum は interview_report.stance 等で使うため温存する。

alter table mirai_stances rename to discussion_points;

-- インデックス: bill_id はリネーム、type 用は廃止
alter index idx_mirai_stances_bill_id rename to idx_discussion_points_bill_id;
drop index if exists idx_mirai_stances_type;

-- updated_at トリガをリネーム
alter trigger update_mirai_stances_updated_at on discussion_points
  rename to update_discussion_points_updated_at;

-- 党の賛否判定カラム・コメントを廃止し、賛成論拠／反対論拠を追加
alter table discussion_points drop column type;
alter table discussion_points drop column comment;
alter table discussion_points add column pro_points text;
alter table discussion_points add column con_points text;

-- 主体の賛否表明を前提としたコメントを中立な説明へ置換
comment on table discussion_points is '議案ごとの論点整理（賛成の論拠／反対の論拠を中立に併記）';

-- RLS（ポリシーは定義しない＝デフォルト全拒否。アクセスは createAdminClient 経由）
alter table discussion_points enable row level security;
```

- [ ] **Step 2: マイグレーションを適用**

Run: `pnpm db:reset`
Expected: 成功（`Applying migration 20260617120000_...` が表示され、最後まで通る。seed はこの時点では旧 `mirai_stances` を挿入しようとして失敗する可能性があるため、Task 6 まではエラーが出ても可。確実に確認したい場合は Step 3 へ進む）

> 注: `pnpm db:reset` は migration 適用後に seed を走らせる。seed（Task 6 未対応）が `mirai_stances` を参照して失敗する場合があるが、migration 自体の適用可否は psql で確認できる（Step 3）。

- [ ] **Step 3: テーブル構造を確認**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54432/postgres" -c "\d discussion_points"
```
Expected: `discussion_points` テーブルが存在し、列に `id, bill_id, created_at, updated_at, pro_points, con_points` がある。`type`・`comment` 列が**無い**こと。

- [ ] **Step 4: 型を再生成**

Run: `pnpm db:types:gen`
Expected: `packages/supabase/types/supabase.types.ts` が更新され、`mirai_stances` が消え `discussion_points`（`pro_points: string | null`, `con_points: string | null`）が生成される。

- [ ] **Step 5: コミット**

```bash
git add supabase/migrations/20260617120000_rename_mirai_stances_to_discussion_points.sql packages/supabase/types/supabase.types.ts
git commit -m "DB: mirai_stances を discussion_points へ転用（賛否判定を廃止し賛成/反対論拠を追加）"
```

---

## Task 2: web 型の更新と不要ユーティリティの削除

**Files:**
- Modify: `web/src/features/bills/shared/types/index.ts`
- Delete: `web/src/features/bills/shared/utils/stance-styles.ts`
- Delete: `web/src/features/bills/shared/utils/stance-styles.test.ts`

- [ ] **Step 1: stance-styles とそのテストを削除**

```bash
git rm web/src/features/bills/shared/utils/stance-styles.ts \
       web/src/features/bills/shared/utils/stance-styles.test.ts
```

> これらは賛否バッジの色分け・ラベル専用で、削除する `MiraiStanceCard` からのみ使われている。

- [ ] **Step 2: 型定義を更新**

`web/src/features/bills/shared/types/index.ts` の該当行を変更する。

14行目を変更:

```ts
// 変更前
export type MiraiStance = Database["public"]["Tables"]["mirai_stances"]["Row"];
// 変更後
export type DiscussionPoints =
  Database["public"]["Tables"]["discussion_points"]["Row"];
```

19行目（`StanceTypeEnum`）を削除する（web 内では本ファイルでの宣言以外に使用箇所が無く、削除する `STANCE_LABELS` のためだけに存在していた）:

```ts
// この行を削除
export type StanceTypeEnum = Database["public"]["Enums"]["stance_type_enum"];
```

34-36行目（`BillWithStance`）を変更:

```ts
// 変更前
export type BillWithStance = Bill & {
  mirai_stance?: MiraiStance;
};
// 変更後
export type BillWithDiscussionPoints = Bill & {
  discussion_points?: DiscussionPoints;
};
```

51行目（`BillWithContent` 内）を変更:

```ts
// 変更前
  mirai_stance?: MiraiStance;
// 変更後
  discussion_points?: DiscussionPoints;
```

109-117行目（`STANCE_LABELS`）を削除する（`StanceTypeEnum` を参照しており、削除した stance-styles からのみ使われていた）:

```ts
// このブロックを丸ごと削除
export const STANCE_LABELS: Record<StanceTypeEnum, string> = {
  for: "賛成",
  against: "反対",
  neutral: "中立",
  conditional_for: "条件付き賛成",
  conditional_against: "条件付き反対",
  considering: "検討中",
  continued_deliberation: "継続審査中",
};
```

- [ ] **Step 3: 型エラーで残参照を洗い出す**

Run: `pnpm --filter web typecheck`
Expected: FAIL。`bill-detail-layout.tsx`（`mirai_stance` / `MiraiStanceCard`）, `mirai-stance-card.tsx`, loaders, repository で型エラー。これらは Task 3〜4 で解消する。

> このタスク単独ではコミットしない（Task 3・4 で参照を直してからまとめてコミットする）。

---

## Task 3: web 表示コンポーネントを DiscussionPointsCard へ作り替え

**Files:**
- Delete: `web/src/features/bills/client/components/bill-detail/mirai-stance-card.tsx`
- Create: `web/src/features/bills/client/components/bill-detail/discussion-points-card.tsx`
- Modify: `web/src/features/bills/server/components/bill-detail/bill-detail-layout.tsx`

- [ ] **Step 1: 旧カードを削除**

```bash
git rm web/src/features/bills/client/components/bill-detail/mirai-stance-card.tsx
```

- [ ] **Step 2: DiscussionPointsCard を作成**

`web/src/features/bills/client/components/bill-detail/discussion-points-card.tsx`:

```tsx
import type { DiscussionPoints } from "../../../shared/types";

interface DiscussionPointsCardProps {
  discussionPoints?: DiscussionPoints;
}

export function DiscussionPointsCard({
  discussionPoints,
}: DiscussionPointsCardProps) {
  const pro = discussionPoints?.pro_points?.trim();
  const con = discussionPoints?.con_points?.trim();

  // 賛成・反対の論拠がどちらも無ければ非表示
  if (!pro && !con) {
    return null;
  }

  return (
    <section>
      <h2 className="text-[22px] font-bold mb-2">論点整理</h2>
      <p className="text-sm text-mirai-text-muted mb-4">
        議案資料・議事録をもとにAIが整理し、運営者が確認した賛否の主な論拠です。特定の立場を推奨するものではありません。
      </p>
      <div className="flex flex-col gap-4">
        {pro && (
          <div className="bg-stance-for-bg rounded-lg px-6 py-5">
            <h3 className="text-lg font-bold text-primary-accent mb-2">
              賛成の論拠
            </h3>
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {pro}
            </p>
          </div>
        )}
        {con && (
          <div className="bg-stance-against-bg rounded-lg px-6 py-5">
            <h3 className="text-lg font-bold text-stance-against mb-2">
              反対の論拠
            </h3>
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {con}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
```

> 使用トークン（`text-mirai-text-muted`, `bg-stance-for-bg`, `text-primary-accent`, `bg-stance-against-bg`, `text-stance-against`）はいずれも旧 stance-styles で使用済みのため `globals.css` に定義済み。ロゴ画像・グラデーション・スタンスバッジ・`preparing` 特別表示は意図的に撤去している。

- [ ] **Step 3: bill-detail-layout.tsx を更新**

10行目の import を差し替え:

```tsx
// 変更前
import { MiraiStanceCard } from "../../../client/components/bill-detail/mirai-stance-card";
// 変更後
import { DiscussionPointsCard } from "../../../client/components/bill-detail/discussion-points-card";
```

25行目の `showMiraiStance` 定義を、論点整理の有無判定へ差し替え:

```tsx
// 変更前
  const showMiraiStance = bill.status === "preparing" || bill.mirai_stance;
// 変更後
  const discussionPoints = bill.discussion_points;
  const hasDiscussionPoints = Boolean(
    discussionPoints?.pro_points?.trim() ||
      discussionPoints?.con_points?.trim()
  );
```

78-85行目の表示ブロックを差し替え:

```tsx
// 変更前
        {showMiraiStance && (
          <div className="my-8">
            <MiraiStanceCard
              stance={bill.mirai_stance}
              billStatus={bill.status}
            />
          </div>
        )}
// 変更後
        {hasDiscussionPoints && (
          <div className="my-8">
            <DiscussionPointsCard discussionPoints={discussionPoints} />
          </div>
        )}
```

---

## Task 4: web リポジトリ／ローダーの参照更新

**Files:**
- Modify: `web/src/features/bills/server/repositories/bill-repository.ts`
- Modify: `web/src/features/bills/server/loaders/get-bill-by-id.ts`
- Modify: `web/src/features/bills/server/loaders/get-bill-by-id-admin.ts`

- [ ] **Step 1: repository の取得関数を更新**

`web/src/features/bills/server/repositories/bill-repository.ts` の81-97行目を変更:

```ts
// 変更後
/**
 * 議案の論点整理を取得
 */
export async function findDiscussionPointsByBillId(billId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("discussion_points")
    .select("*")
    .eq("bill_id", billId)
    .single();

  if (error) {
    return null;
  }

  return data;
}
```

- [ ] **Step 2: get-bill-by-id.ts を更新**

import（6-10行目）と取得・返却を変更:

```ts
// import を変更
import {
  findPublishedBillById,
  findDiscussionPointsByBillId,
  findTagsByBillId,
} from "../repositories/bill-repository";
```

```ts
// Promise.all（26-31行目）を変更
    const [bill, discussionPoints, billContent, billTags] = await Promise.all([
      findPublishedBillById(id),
      findDiscussionPointsByBillId(id),
      getBillContentWithDifficulty(id, difficultyLevel),
      findTagsByBillId(id),
    ]);
```

```ts
// 返却（45-50行目）を変更
    return {
      ...bill,
      discussion_points: discussionPoints || undefined,
      bill_content: billContent || undefined,
      tags,
    };
```

- [ ] **Step 3: get-bill-by-id-admin.ts を更新**

import（3-7行目）、Promise.all（21-26行目）、返却（40-44行目）を Step 2 と同様に変更:

```ts
import {
  findBillById,
  findDiscussionPointsByBillId,
  findTagsByBillId,
} from "../repositories/bill-repository";
```

```ts
  const [bill, discussionPoints, billContent, billTags] = await Promise.all([
    findBillById(id),
    findDiscussionPointsByBillId(id),
    getBillContentWithDifficulty(id, difficultyLevel),
    findTagsByBillId(id),
  ]);
```

```ts
  return {
    ...bill,
    discussion_points: discussionPoints || undefined,
    bill_content: billContent || undefined,
    tags,
  };
```

- [ ] **Step 4: web の型チェック**

Run: `pnpm --filter web typecheck`
Expected: PASS（テストファイルの参照は Task 5 で直す。テストは typecheck 対象外なら PASS。FAIL する場合は integration test の参照のみのはずなので Task 5 で解消）

- [ ] **Step 5: コミット（Task 2〜4 をまとめて）**

```bash
git add web/src/features/bills
git commit -m "web: 議案詳細を中立な論点整理カードへ転用（賛否バッジ・党装飾を撤去）"
```

---

## Task 5: web 統合テストの更新

**Files:**
- Modify: `tests/supabase/utils.ts`
- Modify: `web/src/features/bills/server/repositories/bill-repository.integration.test.ts`

- [ ] **Step 1: テストヘルパーを更新**

`tests/supabase/utils.ts` の254-275行目（`createTestMiraiStance`）を差し替え:

```ts
/** テスト用 discussion_points を作成 */
export async function createTestDiscussionPoints(
  billId: string,
  overrides: Partial<{
    pro_points: string;
    con_points: string;
  }> = {}
) {
  const defaults = {
    bill_id: billId,
    pro_points: "賛成の論拠（テスト）",
    con_points: "反対の論拠（テスト）",
    ...overrides,
  };
  const { data, error } = await adminClient
    .from("discussion_points")
    .insert(defaults)
    .select()
    .single();
  if (error)
    throw new Error(`discussion_points 作成失敗: ${error.message}`);
  return data;
}
```

- [ ] **Step 2: 統合テストの import と describe ブロックを更新**

`bill-repository.integration.test.ts` の import（9行目, 18行目）を変更:

```ts
// 9行目
  createTestDiscussionPoints,
// 18行目（findMiraiStanceByBillId → findDiscussionPointsByBillId）
  findDiscussionPointsByBillId,
```

165-194行目の describe ブロックを差し替え:

```ts
  // ============================================================
  // findDiscussionPointsByBillId
  // ============================================================

  describe("findDiscussionPointsByBillId", () => {
    it("議案の論点整理を取得できる", async () => {
      const bill = await createTestBill();
      billIds.push(bill.id);
      await createTestDiscussionPoints(bill.id, {
        pro_points: "賛成の論拠",
        con_points: "反対の論拠",
      });

      const result = await findDiscussionPointsByBillId(bill.id);

      expect(result).not.toBeNull();
      expect(result?.pro_points).toBe("賛成の論拠");
      expect(result?.con_points).toBe("反対の論拠");
    });

    it("論点整理が存在しない場合はnullを返す", async () => {
      const bill = await createTestBill();
      billIds.push(bill.id);

      const result = await findDiscussionPointsByBillId(bill.id);

      expect(result).toBeNull();
    });
  });
```

- [ ] **Step 3: 統合テストを実行**

Run: `pnpm --filter web test src/features/bills/server/repositories/bill-repository.integration.test.ts`
Expected: PASS（ローカル Supabase が起動済みであること。未起動なら `npx supabase start`）

- [ ] **Step 4: コミット**

```bash
git add tests/supabase/utils.ts web/src/features/bills/server/repositories/bill-repository.integration.test.ts
git commit -m "test: 論点整理（discussion_points）の統合テストへ更新"
```

---

## Task 6: seed データを論点整理（pro/con）へ更新

**Files:**
- Modify: `packages/seed/main/data.ts`
- Modify: `packages/seed/main/run.ts`
- Modify: `packages/seed/shared/helper.ts`

- [ ] **Step 1: data.ts の型・データ・生成関数を更新**

4-5行目の型エイリアスを変更:

```ts
// 変更前
type MiraiStanceInsert =
  Database["public"]["Tables"]["mirai_stances"]["Insert"];
// 変更後
type DiscussionPointsInsert =
  Database["public"]["Tables"]["discussion_points"]["Insert"];
```

88-122行目（`miraiStancesData` と `createMiraiStances`）を差し替え:

```ts
// 議案ごとの論点整理。
// さいたま市議には該当議員（特定政党）がいないため、主体の賛否は表明せず、
// 賛成の論拠／反対の論拠を中立に併記する。
const discussionPointsData: Omit<DiscussionPointsInsert, "bill_id">[] = [
  {
    pro_points: `- 近年の猛暑で、空調のない体育館は熱中症リスクが高く、児童・生徒の安全と授業（体育・式典）の実施に支障が出ている。
- 体育館は災害時の指定避難所を兼ねており、空調整備は防災対策としても効果が大きい。
- 周辺自治体でも整備が進んでおり、教育環境の地域間格差を是正する必要がある。`,
    con_points: `- 全校整備には多額の初期費用に加え、電気代・保守などの継続的な維持費が市財政を圧迫する。
- 限られた予算の中で、老朽校舎の改修やトイレ改善など他の優先課題との兼ね合いを問う声がある。
- 稼働日数が限られる体育館への大規模投資より、断熱・送風など費用対効果の高い代替策を先に検討すべきとの指摘。`,
  },
];

export function createDiscussionPoints(
  insertedBills: { id: string; name: string }[]
): DiscussionPointsInsert[] {
  return discussionPointsData.map((points, index) => ({
    ...points,
    bill_id: insertedBills[index]?.id || "",
  }));
}
```

- [ ] **Step 2: run.ts の投入処理を更新**

16行目のコメントと121-138行目の投入ブロックを変更。まず import を確認し `createMiraiStances` を `createDiscussionPoints` に変更する（`packages/seed/main/run.ts` の data import 行）。

121-138行目を差し替え:

```ts
    // Insert discussion_points (= 論点整理)
    console.log("🎯 Inserting discussion points (論点整理)...");
    const discussionPoints = createDiscussionPoints(insertedBills);

    const { data: insertedPoints, error: pointsError } = await supabase
      .from("discussion_points")
      .insert(discussionPoints)
      .select("id");

    if (pointsError) {
      throw new Error(
        `Failed to insert discussion points: ${pointsError.message}`
      );
    }

    if (!insertedPoints) {
      throw new Error("No discussion points were inserted");
    }

    console.log(`✅ Inserted ${insertedPoints.length} discussion points`);
```

16行目のコメント `mirai_stances` を `discussion_points` に修正。

- [ ] **Step 3: helper.ts のクリア対象テーブル名を更新**

`packages/seed/shared/helper.ts` の19行目を変更:

```ts
// 変更前
  "mirai_stances",
// 変更後
  "discussion_points",
```

- [ ] **Step 4: seed を実行して確認**

Run: `pnpm db:reset`
Expected: PASS。`✅ Inserted 1 discussion points` が表示され、最後まで通る。

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54432/postgres" -t -A -c "select count(*), bool_and(pro_points is not null and con_points is not null) from discussion_points;"
```
Expected: `1|t`（1件、pro/con とも非null）

- [ ] **Step 5: コミット**

```bash
git add packages/seed
git commit -m "seed: 論点整理（pro_points/con_points）へ置換"
```

---

## Task 7: admin feature を discussion-points へリネーム

**Files:**
- Move: `admin/src/features/mirai-stance/` → `admin/src/features/discussion-points/`（各ファイル）
- Modify: 配下の types / repository / actions / loader / form
- Modify: `admin/src/app/(protected)/bills/[id]/edit/page.tsx`

- [ ] **Step 1: ディレクトリを git mv でリネーム**

```bash
cd admin/src/features
git mv mirai-stance discussion-points
git mv discussion-points/server/repositories/mirai-stance-repository.ts \
       discussion-points/server/repositories/discussion-points-repository.ts
git mv discussion-points/server/loaders/get-stance-by-bill-id.ts \
       discussion-points/server/loaders/get-discussion-points-by-bill-id.ts
git mv discussion-points/server/actions/create-stance.ts \
       discussion-points/server/actions/create-discussion-points.ts
git mv discussion-points/server/actions/update-stance.ts \
       discussion-points/server/actions/update-discussion-points.ts
git mv discussion-points/server/actions/delete-stance.ts \
       discussion-points/server/actions/delete-discussion-points.ts
git mv discussion-points/client/components/stance-form.tsx \
       discussion-points/client/components/discussion-points-form.tsx
cd ../../../..
```

- [ ] **Step 2: types/index.ts を書き換え**

`admin/src/features/discussion-points/shared/types/index.ts` を全置換:

```ts
import type { Database } from "@mirai-gikai/supabase";
import { z } from "zod";

export type DiscussionPoints =
  Database["public"]["Tables"]["discussion_points"]["Row"];

// フォーム入力用の型とスキーマ
export const discussionPointsInputSchema = z.object({
  pro_points: z.string().optional(),
  con_points: z.string().optional(),
});

export type DiscussionPointsInput = z.infer<
  typeof discussionPointsInputSchema
>;
```

- [ ] **Step 3: repository を書き換え**

`admin/src/features/discussion-points/server/repositories/discussion-points-repository.ts` を全置換:

```ts
import "server-only";

import { createAdminClient } from "@mirai-gikai/supabase";
import type { DiscussionPointsInput } from "../../shared/types";

export async function findDiscussionPointsByBillId(billId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("discussion_points")
    .select("*")
    .eq("bill_id", billId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      throw new Error(`Failed to fetch discussion points: ${error.message}`);
    }
    return null;
  }

  return data;
}

export async function createDiscussionPoints(
  billId: string,
  input: DiscussionPointsInput
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("discussion_points").insert({
    bill_id: billId,
    pro_points: input.pro_points || null,
    con_points: input.con_points || null,
  });

  if (error) {
    throw new Error(`Failed to create discussion points: ${error.message}`);
  }
}

export async function updateDiscussionPoints(
  id: string,
  input: DiscussionPointsInput
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("discussion_points")
    .update({
      pro_points: input.pro_points || null,
      con_points: input.con_points || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update discussion points: ${error.message}`);
  }
}

export async function deleteDiscussionPoints(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("discussion_points")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete discussion points: ${error.message}`);
  }
}
```

- [ ] **Step 4: loader を書き換え**

`admin/src/features/discussion-points/server/loaders/get-discussion-points-by-bill-id.ts` を全置換:

```ts
import type { DiscussionPoints } from "../../shared/types";
import { findDiscussionPointsByBillId } from "../repositories/discussion-points-repository";

export async function getDiscussionPointsByBillId(
  billId: string
): Promise<DiscussionPoints | null> {
  return findDiscussionPointsByBillId(billId);
}
```

- [ ] **Step 5: actions を書き換え**

`create-discussion-points.ts`:

```ts
"use server";

import {
  invalidateWebCache,
  WEB_CACHE_TAGS,
} from "@/lib/utils/cache-invalidation";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import type { DiscussionPointsInput } from "../../shared/types";
import { createDiscussionPoints as createDiscussionPointsRepo } from "../repositories/discussion-points-repository";

export async function createDiscussionPoints(
  billId: string,
  data: DiscussionPointsInput
) {
  try {
    await createDiscussionPointsRepo(billId, data);

    invalidateWebCache([WEB_CACHE_TAGS.BILLS]);
    return { success: true };
  } catch (error) {
    console.error("Error in createDiscussionPoints:", error);
    return {
      success: false,
      error: getErrorMessage(error, "予期しないエラーが発生しました"),
    };
  }
}
```

`update-discussion-points.ts`:

```ts
"use server";

import {
  invalidateWebCache,
  WEB_CACHE_TAGS,
} from "@/lib/utils/cache-invalidation";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import type { DiscussionPointsInput } from "../../shared/types";
import { updateDiscussionPoints as updateDiscussionPointsRepo } from "../repositories/discussion-points-repository";

export async function updateDiscussionPoints(
  id: string,
  data: DiscussionPointsInput
) {
  try {
    await updateDiscussionPointsRepo(id, data);

    invalidateWebCache([WEB_CACHE_TAGS.BILLS]);
    return { success: true };
  } catch (error) {
    console.error("Error in updateDiscussionPoints:", error);
    return {
      success: false,
      error: getErrorMessage(error, "予期しないエラーが発生しました"),
    };
  }
}
```

`delete-discussion-points.ts`:

```ts
"use server";

import {
  invalidateWebCache,
  WEB_CACHE_TAGS,
} from "@/lib/utils/cache-invalidation";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import { deleteDiscussionPoints as deleteDiscussionPointsRepo } from "../repositories/discussion-points-repository";

export async function deleteDiscussionPoints(id: string) {
  try {
    await deleteDiscussionPointsRepo(id);

    invalidateWebCache([WEB_CACHE_TAGS.BILLS]);
    return { success: true };
  } catch (error) {
    console.error("Error in deleteDiscussionPoints:", error);
    return {
      success: false,
      error: getErrorMessage(error, "予期しないエラーが発生しました"),
    };
  }
}
```

- [ ] **Step 6: form を書き換え**

`admin/src/features/discussion-points/client/components/discussion-points-form.tsx` を全置換:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

import { createDiscussionPoints } from "../../server/actions/create-discussion-points";
import { deleteDiscussionPoints } from "../../server/actions/delete-discussion-points";
import { updateDiscussionPoints } from "../../server/actions/update-discussion-points";
import {
  type DiscussionPoints,
  type DiscussionPointsInput,
  discussionPointsInputSchema,
} from "../../shared/types";

interface DiscussionPointsFormProps {
  billId: string;
  discussionPoints?: DiscussionPoints | null;
}

export function DiscussionPointsForm({
  billId,
  discussionPoints,
}: DiscussionPointsFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<DiscussionPointsInput>({
    resolver: zodResolver(discussionPointsInputSchema),
    defaultValues: {
      pro_points: discussionPoints?.pro_points || "",
      con_points: discussionPoints?.con_points || "",
    },
  });

  const handleSubmit = async (data: DiscussionPointsInput) => {
    setIsSubmitting(true);
    try {
      const result = discussionPoints
        ? await updateDiscussionPoints(discussionPoints.id, data)
        : await createDiscussionPoints(billId, data);

      if (result.success) {
        toast.success(
          discussionPoints ? "論点整理を更新しました" : "論点整理を作成しました"
        );
        router.refresh();
      } else {
        toast.error(result.error || "エラーが発生しました");
      }
    } catch (error) {
      console.error("Error submitting discussion points:", error);
      toast.error("予期しないエラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (
      !discussionPoints ||
      !confirm("この論点整理を削除してもよろしいですか？")
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteDiscussionPoints(discussionPoints.id);

      if (result.success) {
        toast.success("論点整理を削除しました");
        window.location.reload();
      } else {
        toast.error(result.error || "削除に失敗しました");
      }
    } catch (error) {
      console.error("Error deleting discussion points:", error);
      toast.error("予期しないエラーが発生しました");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>論点整理</CardTitle>
        <p className="text-sm text-muted-foreground">
          賛成・反対それぞれの論拠を中立に併記します。特定の立場を推奨する内容にはしないでください。
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="pro_points"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>賛成の論拠（任意）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="賛成側の主な論拠を入力"
                      className="min-h-[120px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="con_points"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>反対の論拠（任意）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="反対側の主な論拠を入力"
                      className="min-h-[120px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "保存中..."
                  : discussionPoints
                    ? "更新"
                    : "作成"}
              </Button>
              {discussionPoints && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? "削除中..." : "削除"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: 議案編集ページを更新**

`admin/src/app/(protected)/bills/[id]/edit/page.tsx`:

10-11行目の import を変更:

```tsx
import { DiscussionPointsForm } from "@/features/discussion-points/client/components/discussion-points-form";
import { getDiscussionPointsByBillId } from "@/features/discussion-points/server/loaders/get-discussion-points-by-bill-id";
```

22-25行目あたりの並列取得で `getStanceByBillId(id)` を `getDiscussionPointsByBillId(id)` に、分割代入の変数名 `stance` を `discussionPoints` に変更:

```tsx
  const [bill, discussionPoints, allTags, selectedTagIds, dietSessions] =
    await Promise.all([
      // ...（他はそのまま）
      getDiscussionPointsByBillId(id),
      // ...
    ]);
```

54行目の `<StanceForm ... />` を差し替え（`billStatus` prop は不要になったため削除）:

```tsx
        <DiscussionPointsForm billId={bill.id} discussionPoints={discussionPoints} />
```

- [ ] **Step 8: admin の型チェック**

Run: `pnpm --filter admin typecheck`
Expected: PASS

- [ ] **Step 9: コミット**

```bash
git add admin/src
git commit -m "admin: スタンス編集を論点整理（賛成/反対論拠）編集へ転用"
```

---

## Task 8: 全体検証

- [ ] **Step 1: DB を作り直して seed まで通す**

Run: `pnpm db:reset`
Expected: PASS（`✅ Inserted 1 discussion points`）

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 5: Test**

Run: `pnpm test`
Expected: PASS（ローカル Supabase 起動済みであること）

- [ ] **Step 6: 中立性チェック（残存物が無いことを確認）**

Run:
```bash
grep -rn "mirai_stances\|MiraiStance\|mirai_stance\|チームみらいの賛否\|党内で検討" \
  web/src admin/src packages tests supabase/migrations \
  | grep -v "20250904184400\|20250928124621\|20251015183100"
```
Expected: 出力なし（過去マイグレーション履歴を除き、`mirai_stances`/`MiraiStance`/賛否表明前提の文言がコードから消えている）。残っていれば該当箇所を修正する。

---

## Self-Review（記入済み）

- **スペック網羅**: データモデル(Task1) / web表示(Task3) / web型・repo・loader(Task2,4) / admin(Task7) / seed(Task6) / テスト(Task5) / スコープ外(AI生成・トグルは計画に含めず) を確認。
- **プレースホルダ**: なし（全ステップに具体コードと実行コマンド・期待結果を記載）。
- **型整合性**: `DiscussionPoints` / `DiscussionPointsInput` / `discussionPointsInputSchema` / `findDiscussionPointsByBillId`（web・admin で別ファイル定義、用途別）/ `createTestDiscussionPoints` / `discussion_points` フィールド名が各タスク間で一致。
