# 議会資料メタデータインデックス Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DiscussCabinet のフォルダサブツリーから PDF を読まずに資料メタデータを DB に取り込み、MCP/AI が会期内で関連資料を検索できるようにする。

**Architecture:** 既存 `discuss-cabinet-client` / `parseFolderList` を再利用してサブツリーを逐次クロール（DI で fetch をフェイク化可能）。メタデータを `assembly_folders` / `assembly_documents` に upsert し、MCP ツール `search_assembly_documents` で件名＋会期フィルタ検索する。取り込みトリガーは既存 assembly-archive ツリーUIのフォルダ単位ボタン。

**Tech Stack:** Next.js (admin, App Router) / TypeScript / Supabase (Postgres) / `@modelcontextprotocol/sdk` + `mcp-handler` / Vitest / Biome

設計: [docs/superpowers/specs/2026-06-28-assembly-document-index-design.md](../specs/2026-06-28-assembly-document-index-design.md)

## Global Constraints

- 作業は必ず `develop` から切った git worktree で行う（メインリポジトリで直接変更しない）。
- Biome: 2スペース / LF / ダブルクォート / セミコロン / 80桁。ファイル名はローワーハイフン、型は PascalCase、関数は camelCase。
- Server 専用ファイルには `import "server-only";` を先頭に置く。
- DB アクセスは必ず `createAdminClient()`（`@mirai-gikai/supabase`）経由。RLS 有効・ポリシー無し。
- 純粋関数は `*.test.ts` を同階層に必須。外部API（DiscussCabinet fetch）は `FetchLike` DI でフェイク化。モックに頼らない。
- web/admin 共有ロジックは作らない（本機能は admin 内で完結）。
- PDF 本文・fileId・fileName・本文テキストは保存しない（メタデータのみ）。
- admin 内部リンクは `@/lib/routes`。本機能は新ページを追加しない（既存 assembly-archive ページに追加）。
- push 前に `pnpm lint` / `pnpm typecheck` / `pnpm build` / `pnpm test` を通す。

---

## File Structure

```
supabase/migrations/
  20260628120000_create_assembly_document_index.sql            # 新規

packages/supabase/types/supabase.types.ts                      # 再生成（pnpm db:types:gen）

admin/src/features/assembly-archive/
  shared/constants.ts                                          # クロール上限定数を追加
  shared/types/index.ts                                        # 行型・検索型を追加
  shared/utils/derive-session-label.ts (+ .test.ts)           # 新規（純粋関数）
  shared/utils/parse-doc-date.ts (+ .test.ts)                 # 新規（純粋関数）
  server/repositories/assembly-document-repository.ts          # 新規（upsert / search）
  server/services/crawl-assembly-subtree.ts (+ .test.ts)      # 新規（traversal, DI client）
  server/services/import-assembly-subtree.ts                   # 新規（crawl + upsert）
  server/actions/import-assembly-subtree-action.ts             # 新規（Server Action）
  client/components/archive-tree.tsx                           # path を伝播し取込ボタン追加

admin/src/features/mcp/server/
  tools/register-assembly-tools.ts                            # 新規（MCP検索ツール）
  create-handler.ts                                           # ツール登録を追加
```

---

## Task 1: マイグレーションと型生成

**Files:**
- Create: `supabase/migrations/20260628120000_create_assembly_document_index.sql`
- Modify: `packages/supabase/types/supabase.types.ts`（`pnpm db:types:gen` で再生成）

**Interfaces:**
- Produces: テーブル `assembly_folders`、`assembly_documents`（後続の repository が `.from("assembly_folders")` / `.from("assembly_documents")` で参照）。

- [ ] **Step 1: マイグレーションSQLを作成**

`supabase/migrations/20260628120000_create_assembly_document_index.sql`:

```sql
-- 議会資料メタデータインデックス: DiscussCabinet のフォルダ/文書メタを軽量に取り込み、
-- MCP/AI からの検索性を上げる。PDF本文は保存しない（メタデータのみ）。
-- 設計: docs/superpowers/specs/2026-06-28-assembly-document-index-design.md

CREATE TABLE assembly_folders (
  folder_id        BIGINT PRIMARY KEY,                         -- DiscussCabinet のフォルダID
  cabinet_id       BIGINT NOT NULL,                            -- 1=本会議 / 2=委員会
  parent_folder_id BIGINT,                                     -- ルート取込点は NULL
  name             TEXT NOT NULL,
  path             TEXT NOT NULL,                              -- 例: /本会議/令和８年/６月定例会/審議結果/
  imported_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE assembly_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id    BIGINT NOT NULL,
  folder_id     BIGINT NOT NULL,                              -- assembly_folders.folder_id（FK制約は張らない）
  docid         BIGINT NOT NULL,
  title         TEXT NOT NULL,
  doc_date      DATE,                                         -- 正規化済み。失敗時 NULL
  raw_date      TEXT,                                         -- 元の表示文字列
  folder_path   TEXT NOT NULL,                               -- 文書カードに直接出せるよう非正規化
  session_label TEXT,                                         -- 例: 令和8年6月定例会（パスから導出）
  imported_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (cabinet_id, docid)
);

CREATE INDEX assembly_documents_session_idx ON assembly_documents (session_label);
CREATE INDEX assembly_documents_cabinet_idx ON assembly_documents (cabinet_id);

-- RLS 有効・ポリシー無し（デフォルト全拒否）。アクセスは createAdminClient 経由のみ。
ALTER TABLE assembly_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_documents ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: マイグレーション適用と型生成**

Run: `pnpm db:reset && pnpm db:types:gen`
Expected: エラーなく完了し、`packages/supabase/types/supabase.types.ts` に `assembly_folders` / `assembly_documents` が出現する。

- [ ] **Step 3: 型生成結果を確認**

Run: `grep -c "assembly_documents" packages/supabase/types/supabase.types.ts`
Expected: 1 以上（複数ヒット）

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260628120000_create_assembly_document_index.sql packages/supabase/types/supabase.types.ts
git commit -m "feat(admin): 議会資料メタデータインデックスのテーブルを追加"
```

---

## Task 2: 会期ラベル導出（純粋関数）

**Files:**
- Create: `admin/src/features/assembly-archive/shared/utils/derive-session-label.ts`
- Test: `admin/src/features/assembly-archive/shared/utils/derive-session-label.test.ts`

**Interfaces:**
- Produces: `deriveSessionLabel(path: string): string | null` — クロール時に文書の `session_label` を決めるために使用。

- [ ] **Step 1: 失敗するテストを書く**

`derive-session-label.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { deriveSessionLabel } from "./derive-session-label";

describe("deriveSessionLabel", () => {
  it("本会議パス（全角数字）から会期ラベルを導出する", () => {
    expect(deriveSessionLabel("/本会議/令和８年/６月定例会/審議結果/")).toBe(
      "令和8年6月定例会"
    );
  });

  it("委員会の入れ子パス（委員会名を挟む）から会期ラベルを導出する", () => {
    expect(
      deriveSessionLabel("/委員会/令和8年/予算委員会/6月定例会/予算委員会要求資料/")
    ).toBe("令和8年6月定例会");
  });

  it("平成・元年表記を扱える", () => {
    expect(deriveSessionLabel("/本会議/令和元年/12月定例会/")).toBe(
      "令和元年12月定例会"
    );
  });

  it("年または会期が見つからなければ null", () => {
    expect(deriveSessionLabel("/本会議/令和8年/")).toBeNull();
    expect(deriveSessionLabel("/マニュアル/マニュアル/")).toBeNull();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `pnpm --filter admin test derive-session-label`
Expected: FAIL（`deriveSessionLabel` is not defined）

- [ ] **Step 3: 実装を書く**

`derive-session-label.ts`:

```typescript
const FULLWIDTH_DIGITS = "０１２３４５６７８９";

function toHalfWidthDigits(input: string): string {
  return input.replace(/[０-９]/g, (ch) =>
    String(FULLWIDTH_DIGITS.indexOf(ch))
  );
}

/**
 * フォルダパスから会期ラベル（例: 令和8年6月定例会）を導出する。
 * 年セグメント（令和N年 / 平成N年 / 令和元年）と会期セグメント（N月定例会 / N月臨時会）を
 * パス中から探して連結する。本会議・委員会いずれの入れ子構造でも動く。
 */
export function deriveSessionLabel(path: string): string | null {
  const segments = path
    .split("/")
    .map((s) => toHalfWidthDigits(s.trim()))
    .filter((s) => s.length > 0);

  const year = segments.find((s) => /^(令和|平成)(元|\d+)年$/.test(s));
  const session = segments.find((s) => /^\d+月(定例会|臨時会)$/.test(s));

  if (!year || !session) return null;
  return `${year}${session}`;
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `pnpm --filter admin test derive-session-label`
Expected: PASS（4 件）

- [ ] **Step 5: コミット**

```bash
git add admin/src/features/assembly-archive/shared/utils/derive-session-label.ts admin/src/features/assembly-archive/shared/utils/derive-session-label.test.ts
git commit -m "feat(admin): 会期ラベル導出の純粋関数を追加"
```

---

## Task 3: 日付正規化（純粋関数）

**Files:**
- Create: `admin/src/features/assembly-archive/shared/utils/parse-doc-date.ts`
- Test: `admin/src/features/assembly-archive/shared/utils/parse-doc-date.test.ts`

**Interfaces:**
- Produces: `parseDocDate(raw: string): string | null` — `assembly_documents.doc_date`（`YYYY-MM-DD`）を決めるために使用。DiscussCabinet の表示日付は `2026/06/12` 形式（既に西暦）。

- [ ] **Step 1: 失敗するテストを書く**

`parse-doc-date.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseDocDate } from "./parse-doc-date";

describe("parseDocDate", () => {
  it("YYYY/MM/DD を YYYY-MM-DD に変換する", () => {
    expect(parseDocDate("2026/06/12")).toBe("2026-06-12");
  });

  it("前後の空白を無視する", () => {
    expect(parseDocDate("  2026/06/12 ")).toBe("2026-06-12");
  });

  it("形式が異なる/空なら null", () => {
    expect(parseDocDate("")).toBeNull();
    expect(parseDocDate("令和8年6月12日")).toBeNull();
    expect(parseDocDate("2026-06-12")).toBeNull();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `pnpm --filter admin test parse-doc-date`
Expected: FAIL（`parseDocDate` is not defined）

- [ ] **Step 3: 実装を書く**

`parse-doc-date.ts`:

```typescript
/**
 * DiscussCabinet の表示日付（YYYY/MM/DD、既に西暦）を date 文字列 YYYY-MM-DD に変換する。
 * 形式が一致しない場合は null（DB の doc_date は NULL 許容）。
 */
export function parseDocDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `pnpm --filter admin test parse-doc-date`
Expected: PASS（3 件）

- [ ] **Step 5: コミット**

```bash
git add admin/src/features/assembly-archive/shared/utils/parse-doc-date.ts admin/src/features/assembly-archive/shared/utils/parse-doc-date.test.ts
git commit -m "feat(admin): 議会資料日付の正規化関数を追加"
```

---

## Task 4: 共有型とクロール上限定数

**Files:**
- Modify: `admin/src/features/assembly-archive/shared/types/index.ts`
- Modify: `admin/src/features/assembly-archive/shared/constants.ts`

**Interfaces:**
- Produces:
  - `AssemblyFolderRow = { folder_id: number; cabinet_id: number; parent_folder_id: number | null; name: string; path: string }`
  - `AssemblyDocumentRow = { cabinet_id: number; folder_id: number; docid: number; title: string; doc_date: string | null; raw_date: string; folder_path: string; session_label: string | null }`
  - `AssemblySearchInput = { query?: string; sessionLabel?: string; cabinetId?: number; dateFrom?: string; dateTo?: string; limit?: number }`
  - `AssemblySearchResult = { title: string; docDate: string | null; folderPath: string; sessionLabel: string | null; cabinetId: number; folderId: number; docid: number }`
  - 定数 `MAX_CRAWL_DEPTH = 6`、`MAX_CRAWL_DOCUMENTS = 5000`、`CRAWL_DELAY_MS = 200`

- [ ] **Step 1: 型を追加**

`shared/types/index.ts` の末尾に追記:

```typescript
export type AssemblyFolderRow = {
  folder_id: number;
  cabinet_id: number;
  parent_folder_id: number | null;
  name: string;
  path: string;
};

export type AssemblyDocumentRow = {
  cabinet_id: number;
  folder_id: number;
  docid: number;
  title: string;
  doc_date: string | null;
  raw_date: string;
  folder_path: string;
  session_label: string | null;
};

export type AssemblySearchInput = {
  query?: string;
  sessionLabel?: string;
  cabinetId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export type AssemblySearchResult = {
  title: string;
  docDate: string | null;
  folderPath: string;
  sessionLabel: string | null;
  cabinetId: number;
  folderId: number;
  docid: number;
};
```

- [ ] **Step 2: 定数を追加**

`shared/constants.ts` の末尾に追記:

```typescript
// サブツリー取り込みの暴走防止ガードと負荷配慮の待機時間。
export const MAX_CRAWL_DEPTH = 6;
export const MAX_CRAWL_DOCUMENTS = 5000;
export const CRAWL_DELAY_MS = 200;
```

- [ ] **Step 3: 型チェック**

Run: `pnpm --filter admin typecheck`
Expected: PASS（エラーなし）

- [ ] **Step 4: コミット**

```bash
git add admin/src/features/assembly-archive/shared/types/index.ts admin/src/features/assembly-archive/shared/constants.ts
git commit -m "feat(admin): 議会資料インデックスの共有型とクロール定数を追加"
```

---

## Task 5: リポジトリ層（upsert / 検索）

**Files:**
- Create: `admin/src/features/assembly-archive/server/repositories/assembly-document-repository.ts`
- Test: `admin/src/features/assembly-archive/server/repositories/assembly-document-repository.test.ts`

**Interfaces:**
- Consumes: `AssemblyFolderRow`、`AssemblyDocumentRow`、`AssemblySearchInput`、`AssemblySearchResult`（Task 4）。
- Produces:
  - `upsertAssemblyFolders(rows: AssemblyFolderRow[]): Promise<void>`（`onConflict: "folder_id"`）
  - `upsertAssemblyDocuments(rows: AssemblyDocumentRow[]): Promise<void>`（`onConflict: "cabinet_id,docid"`）
  - `searchAssemblyDocuments(input: AssemblySearchInput): Promise<AssemblySearchResult[]>`

- [ ] **Step 1: 失敗するテストを書く（ローカル Supabase 実体に接続）**

`assembly-document-repository.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { createAdminClient } from "@mirai-gikai/supabase";
import {
  searchAssemblyDocuments,
  upsertAssemblyDocuments,
  upsertAssemblyFolders,
} from "./assembly-document-repository";

const TEST_DOCIDS = [900001, 900002, 900003];

afterEach(async () => {
  const supabase = createAdminClient();
  await supabase
    .from("assembly_documents")
    .delete()
    .in("docid", TEST_DOCIDS);
  await supabase.from("assembly_folders").delete().eq("folder_id", 999001);
});

describe("assembly-document-repository", () => {
  it("文書を upsert し、件名+会期で検索できる", async () => {
    await upsertAssemblyDocuments([
      {
        cabinet_id: 1,
        folder_id: 999001,
        docid: 900001,
        title: "令和8年6月定例会議案審議結果一覧",
        doc_date: "2026-06-12",
        raw_date: "2026/06/12",
        folder_path: "/本会議/令和８年/６月定例会/審議結果/",
        session_label: "令和8年6月定例会",
      },
      {
        cabinet_id: 1,
        folder_id: 999001,
        docid: 900002,
        title: "別会期の資料",
        doc_date: "2025-06-12",
        raw_date: "2025/06/12",
        folder_path: "/本会議/令和７年/６月定例会/審議結果/",
        session_label: "令和7年6月定例会",
      },
    ]);

    const results = await searchAssemblyDocuments({
      query: "審議結果",
      sessionLabel: "令和8年6月定例会",
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      docid: 900001,
      title: "令和8年6月定例会議案審議結果一覧",
      sessionLabel: "令和8年6月定例会",
      cabinetId: 1,
    });
  });

  it("docid 衝突時は upsert で更新する", async () => {
    const base = {
      cabinet_id: 1,
      folder_id: 999001,
      docid: 900003,
      doc_date: "2026-06-12",
      raw_date: "2026/06/12",
      folder_path: "/本会議/令和８年/６月定例会/",
      session_label: "令和8年6月定例会",
    };
    await upsertAssemblyDocuments([{ ...base, title: "旧タイトル" }]);
    await upsertAssemblyDocuments([{ ...base, title: "新タイトル" }]);

    const results = await searchAssemblyDocuments({ query: "タイトル" });
    const target = results.filter((r) => r.docid === 900003);
    expect(target).toHaveLength(1);
    expect(target[0].title).toBe("新タイトル");
  });

  it("フォルダを upsert できる", async () => {
    await upsertAssemblyFolders([
      {
        folder_id: 999001,
        cabinet_id: 1,
        parent_folder_id: null,
        name: "６月定例会",
        path: "/本会議/令和８年/６月定例会/",
      },
    ]);
    // 例外が出ないことを確認
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `pnpm --filter admin test assembly-document-repository`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: 実装を書く**

`assembly-document-repository.ts`:

```typescript
import "server-only";

import { createAdminClient } from "@mirai-gikai/supabase";
import type {
  AssemblyDocumentRow,
  AssemblyFolderRow,
  AssemblySearchInput,
  AssemblySearchResult,
} from "../../shared/types";

const DEFAULT_LIMIT = 50;

export async function upsertAssemblyFolders(
  rows: AssemblyFolderRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("assembly_folders")
    .upsert(rows, { onConflict: "folder_id" });
  if (error) {
    throw new Error(`Failed to upsert assembly folders: ${error.message}`);
  }
}

export async function upsertAssemblyDocuments(
  rows: AssemblyDocumentRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("assembly_documents")
    .upsert(rows, { onConflict: "cabinet_id,docid" });
  if (error) {
    throw new Error(`Failed to upsert assembly documents: ${error.message}`);
  }
}

export async function searchAssemblyDocuments(
  input: AssemblySearchInput
): Promise<AssemblySearchResult[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("assembly_documents")
    .select(
      "title, doc_date, folder_path, session_label, cabinet_id, folder_id, docid"
    );

  if (input.query) query = query.ilike("title", `%${input.query}%`);
  if (input.sessionLabel) query = query.eq("session_label", input.sessionLabel);
  if (input.cabinetId !== undefined)
    query = query.eq("cabinet_id", input.cabinetId);
  if (input.dateFrom) query = query.gte("doc_date", input.dateFrom);
  if (input.dateTo) query = query.lte("doc_date", input.dateTo);

  const { data, error } = await query
    .order("doc_date", { ascending: false, nullsFirst: false })
    .limit(input.limit ?? DEFAULT_LIMIT);

  if (error) {
    throw new Error(`Failed to search assembly documents: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    title: row.title,
    docDate: row.doc_date,
    folderPath: row.folder_path,
    sessionLabel: row.session_label,
    cabinetId: row.cabinet_id,
    folderId: row.folder_id,
    docid: row.docid,
  }));
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `pnpm --filter admin test assembly-document-repository`
Expected: PASS（3 件）。失敗する場合はローカル Supabase が起動しているか（`npx supabase start`）と `.env` を確認。

- [ ] **Step 5: コミット**

```bash
git add admin/src/features/assembly-archive/server/repositories/assembly-document-repository.ts admin/src/features/assembly-archive/server/repositories/assembly-document-repository.test.ts
git commit -m "feat(admin): 議会資料メタの upsert/検索リポジトリを追加"
```

---

## Task 6: サブツリークロール（traversal, DI client）

**Files:**
- Create: `admin/src/features/assembly-archive/server/services/crawl-assembly-subtree.ts`
- Test: `admin/src/features/assembly-archive/server/services/crawl-assembly-subtree.test.ts`

**Interfaces:**
- Consumes: `DiscussCabinetClient`（既存 `../clients/discuss-cabinet-client`）、`parseFolderList`（既存 `../parsers/parse-folder-list`）、`deriveSessionLabel`、`parseDocDate`（Task 2/3）、`AssemblyFolderRow`、`AssemblyDocumentRow`、`MAX_CRAWL_DEPTH`、`MAX_CRAWL_DOCUMENTS`、`CRAWL_DELAY_MS`（Task 4）。
- Produces: `crawlAssemblySubtree(input: { cabinetId: number; folderId: number; basePath: string; delayMs?: number }, client?: DiscussCabinetClient): Promise<{ folders: AssemblyFolderRow[]; documents: AssemblyDocumentRow[] }>`
  - `basePath` は起点フォルダのパス（末尾 `/` 付き、例 `/本会議/令和８年/６月定例会/`）。起点直下の文書は `folder_path = basePath`。

- [ ] **Step 1: 失敗するテストを書く**

`crawl-assembly-subtree.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { DiscussCabinetClient } from "../clients/discuss-cabinet-client";
import { crawlAssemblySubtree } from "./crawl-assembly-subtree";

// folderId ごとに異なるHTMLを返すフェイク。
// 212526(起点): サブフォルダ 223218(審議結果) + 文書 15337
// 223218: 文書 15400 のみ
function fakeClient(): DiscussCabinetClient {
  const byFolder: Record<number, string> = {
    212526: `
      <html><body>
      <button class="folder_icon" onclick="setFolderid('223218','down');" title="審議結果"><span>審議結果</span></button>
      <table><tr>
        <td class="img"><button onclick="doSubmitWithDocid('doc_view',15337)">詳細</button></td>
        <td class="img"><img/></td>
        <td>令和８年６月定例会議案付託表</td>
        <td>2026/06/03</td>
      </tr></table>
      </body></html>`,
    223218: `
      <html><body>
      <table><tr>
        <td class="img"><button onclick="doSubmitWithDocid('doc_view',15400)">詳細</button></td>
        <td class="img"><img/></td>
        <td>令和８年６月定例会議案審議結果一覧</td>
        <td>2026/06/12</td>
      </tr></table>
      </body></html>`,
  };
  return {
    fetchFolderList: async ({ folderId }) => byFolder[folderId] ?? "<html></html>",
    fetchDocView: async () => "",
    fetchFile: async () => ({
      body: new ArrayBuffer(0),
      contentType: "application/pdf",
    }),
  };
}

describe("crawlAssemblySubtree", () => {
  it("サブツリーを再帰的に辿り、フォルダと文書の行を返す", async () => {
    const result = await crawlAssemblySubtree(
      {
        cabinetId: 1,
        folderId: 212526,
        basePath: "/本会議/令和８年/６月定例会/",
        delayMs: 0,
      },
      fakeClient()
    );

    expect(result.folders).toEqual([
      {
        folder_id: 223218,
        cabinet_id: 1,
        parent_folder_id: 212526,
        name: "審議結果",
        path: "/本会議/令和８年/６月定例会/審議結果/",
      },
    ]);

    expect(result.documents).toEqual([
      {
        cabinet_id: 1,
        folder_id: 212526,
        docid: 15337,
        title: "令和８年６月定例会議案付託表",
        doc_date: "2026-06-03",
        raw_date: "2026/06/03",
        folder_path: "/本会議/令和８年/６月定例会/",
        session_label: "令和8年6月定例会",
      },
      {
        cabinet_id: 1,
        folder_id: 223218,
        docid: 15400,
        title: "令和８年６月定例会議案審議結果一覧",
        doc_date: "2026-06-12",
        raw_date: "2026/06/12",
        folder_path: "/本会議/令和８年/６月定例会/審議結果/",
        session_label: "令和8年6月定例会",
      },
    ]);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `pnpm --filter admin test crawl-assembly-subtree`
Expected: FAIL（`crawlAssemblySubtree` is not defined）

- [ ] **Step 3: 実装を書く**

`crawl-assembly-subtree.ts`:

```typescript
import "server-only";

import {
  CRAWL_DELAY_MS,
  MAX_CRAWL_DEPTH,
  MAX_CRAWL_DOCUMENTS,
} from "../../shared/constants";
import type {
  AssemblyDocumentRow,
  AssemblyFolderRow,
} from "../../shared/types";
import { deriveSessionLabel } from "../../shared/utils/derive-session-label";
import { parseDocDate } from "../../shared/utils/parse-doc-date";
import {
  createDiscussCabinetClient,
  type DiscussCabinetClient,
} from "../clients/discuss-cabinet-client";
import { parseFolderList } from "../parsers/parse-folder-list";

const sleep = (ms: number) =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

export async function crawlAssemblySubtree(
  input: {
    cabinetId: number;
    folderId: number;
    basePath: string;
    delayMs?: number;
  },
  client: DiscussCabinetClient = createDiscussCabinetClient()
): Promise<{ folders: AssemblyFolderRow[]; documents: AssemblyDocumentRow[] }> {
  const folders: AssemblyFolderRow[] = [];
  const documents: AssemblyDocumentRow[] = [];
  const delayMs = input.delayMs ?? CRAWL_DELAY_MS;

  async function walk(
    folderId: number,
    path: string,
    depth: number
  ): Promise<void> {
    if (depth > MAX_CRAWL_DEPTH) {
      throw new Error(`クロール深さが上限(${MAX_CRAWL_DEPTH})を超えました`);
    }
    await sleep(delayMs);
    const html = await client.fetchFolderList({
      cabinetId: input.cabinetId,
      folderId,
      move: "down",
    });
    const parsed = parseFolderList(html);

    for (const doc of parsed.documents) {
      if (documents.length >= MAX_CRAWL_DOCUMENTS) {
        throw new Error(
          `取り込み文書数が上限(${MAX_CRAWL_DOCUMENTS})を超えました`
        );
      }
      documents.push({
        cabinet_id: input.cabinetId,
        folder_id: folderId,
        docid: doc.docid,
        title: doc.title,
        doc_date: parseDocDate(doc.date),
        raw_date: doc.date,
        folder_path: path,
        session_label: deriveSessionLabel(path),
      });
    }

    for (const folder of parsed.folders) {
      const childPath = `${path}${folder.name}/`;
      folders.push({
        folder_id: folder.folderId,
        cabinet_id: input.cabinetId,
        parent_folder_id: folderId,
        name: folder.name,
        path: childPath,
      });
      await walk(folder.folderId, childPath, depth + 1);
    }
  }

  await walk(input.folderId, input.basePath, 0);
  return { folders, documents };
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `pnpm --filter admin test crawl-assembly-subtree`
Expected: PASS（1 件）

- [ ] **Step 5: コミット**

```bash
git add admin/src/features/assembly-archive/server/services/crawl-assembly-subtree.ts admin/src/features/assembly-archive/server/services/crawl-assembly-subtree.test.ts
git commit -m "feat(admin): 議会資料サブツリーのクロール処理を追加"
```

---

## Task 7: 取り込みサービス（crawl + upsert）

**Files:**
- Create: `admin/src/features/assembly-archive/server/services/import-assembly-subtree.ts`

**Interfaces:**
- Consumes: `crawlAssemblySubtree`（Task 6）、`upsertAssemblyFolders` / `upsertAssemblyDocuments`（Task 5）。
- Produces: `importAssemblySubtree(input: { cabinetId: number; folderId: number; basePath: string }): Promise<{ folderCount: number; documentCount: number }>`

> このサービスは crawl（テスト済み）と repository（テスト済み）の薄い結合のため、単体テストは追加しない。動作確認は Task 9（Server Action）の手動検証で行う。

- [ ] **Step 1: 実装を書く**

`import-assembly-subtree.ts`:

```typescript
import "server-only";

import {
  upsertAssemblyDocuments,
  upsertAssemblyFolders,
} from "../repositories/assembly-document-repository";
import { crawlAssemblySubtree } from "./crawl-assembly-subtree";

export async function importAssemblySubtree(input: {
  cabinetId: number;
  folderId: number;
  basePath: string;
}): Promise<{ folderCount: number; documentCount: number }> {
  const { folders, documents } = await crawlAssemblySubtree(input);
  await upsertAssemblyFolders(folders);
  await upsertAssemblyDocuments(documents);
  return { folderCount: folders.length, documentCount: documents.length };
}
```

- [ ] **Step 2: 型チェック**

Run: `pnpm --filter admin typecheck`
Expected: PASS（エラーなし）

- [ ] **Step 3: コミット**

```bash
git add admin/src/features/assembly-archive/server/services/import-assembly-subtree.ts
git commit -m "feat(admin): 議会資料サブツリーの取り込みサービスを追加"
```

---

## Task 8: MCP 検索ツール

**Files:**
- Create: `admin/src/features/mcp/server/tools/register-assembly-tools.ts`
- Modify: `admin/src/features/mcp/server/create-handler.ts`

**Interfaces:**
- Consumes: `searchAssemblyDocuments`（Task 5）、`jsonResult`（既存 `../utils/json-result`）。
- Produces: MCP ツール `search_assembly_documents` を登録する `registerAssemblyTools(server: McpServer): void`。

- [ ] **Step 1: ツール登録を書く**

`register-assembly-tools.ts`:

```typescript
import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchAssemblyDocuments } from "@/features/assembly-archive/server/repositories/assembly-document-repository";
import { jsonResult } from "../utils/json-result";

export function registerAssemblyTools(server: McpServer): void {
  server.registerTool(
    "search_assembly_documents",
    {
      title: "議会資料メタを検索",
      description:
        "取り込み済みのDiscussCabinet議会資料メタデータを件名で検索する。ノイズを避けるため sessionLabel（例: 令和8年6月定例会）で会期を絞ることを推奨。結果の cabinetId/folderId/docid は議案ドラフト生成のPDF取得にそのまま使える。",
      inputSchema: {
        query: z.string().optional(),
        sessionLabel: z.string().optional(),
        cabinetId: z.number().int().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ query, sessionLabel, cabinetId, dateFrom, dateTo, limit }) => {
      const results = await searchAssemblyDocuments({
        query,
        sessionLabel,
        cabinetId,
        dateFrom,
        dateTo,
        limit,
      });
      return jsonResult(results);
    }
  );
}
```

- [ ] **Step 2: ハンドラに登録**

`create-handler.ts` を編集。import 追加:

```typescript
import { registerAssemblyTools } from "./tools/register-assembly-tools";
```

登録ブロックに1行追加（`registerTagsTools(server);` の後）:

```typescript
      registerBillsTools(server);
      registerDietSessionsTools(server);
      registerPreviewTools(server);
      registerTagsTools(server);
      registerAssemblyTools(server);
```

- [ ] **Step 3: 型チェックとビルド**

Run: `pnpm --filter admin typecheck`
Expected: PASS（エラーなし）

- [ ] **Step 4: コミット**

```bash
git add admin/src/features/mcp/server/tools/register-assembly-tools.ts admin/src/features/mcp/server/create-handler.ts
git commit -m "feat(admin): 議会資料メタ検索のMCPツールを追加"
```

---

## Task 9: 取り込みトリガー（Server Action + UIボタン）

**Files:**
- Create: `admin/src/features/assembly-archive/server/actions/import-assembly-subtree-action.ts`
- Modify: `admin/src/features/assembly-archive/client/components/archive-tree.tsx`

**Interfaces:**
- Consumes: `importAssemblySubtree`（Task 7）、`requireAdmin`（既存 `@/features/auth/server/lib/auth-server`）、`DiscussCabinetParseError`（既存パーサ）。
- Produces: `importAssemblySubtree`(action) `({ cabinetId, folderId, basePath }) => Promise<{ data: { folderCount; documentCount } } | { error: string }>`。`ExpandableFolder` に `path` prop を伝播し、フォルダ行に「この配下を取り込む」ボタンを追加。

- [ ] **Step 1: Server Action を書く**

`import-assembly-subtree-action.ts`:

```typescript
"use server";

import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { DiscussCabinetParseError } from "../parsers/parse-folder-list";
import { importAssemblySubtree as runImport } from "../services/import-assembly-subtree";

export async function importAssemblySubtree(input: {
  cabinetId: number;
  folderId: number;
  basePath: string;
}): Promise<
  { data: { folderCount: number; documentCount: number } } | { error: string }
> {
  try {
    await requireAdmin();
    const data = await runImport(input);
    return { data };
  } catch (error) {
    console.error("importAssemblySubtree error:", error);
    return {
      error:
        error instanceof DiscussCabinetParseError
          ? error.message
          : "議会資料メタの取り込みに失敗しました（DiscussCabinet側の構造変更または一時的な障害の可能性があります）",
    };
  }
}
```

- [ ] **Step 2: ツリーに path を伝播し取込ボタンを追加**

`archive-tree.tsx` を編集。

(a) import を追加（既存 import 群の末尾付近）:

```typescript
import { DownloadCloud } from "lucide-react";
import { importAssemblySubtree } from "@/features/assembly-archive/server/actions/import-assembly-subtree-action";
```

(b) `ExpandableProps` に `path` を追加:

```typescript
type ExpandableProps = SelectionProps & {
  label: string;
  cabinetId: number;
  folderId: number;
  move: "cabinet" | "down";
  depth: number;
  path: string;
  onSelectDocument: (doc: DocumentNode) => void;
};
```

(c) `ExpandableFolder` の引数に `path` を加え、取込状態と実行関数を追加。`expanded` の `useState` 群の直後に挿入:

```typescript
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function runImport() {
    if (importing) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const result = await importAssemblySubtree({ cabinetId, folderId, path });
      setImportMsg(
        "error" in result
          ? result.error
          : `取り込み完了: フォルダ${result.data.folderCount}件 / 文書${result.data.documentCount}件`
      );
    } catch {
      setImportMsg("取り込みに失敗しました");
    } finally {
      setImporting(false);
    }
  }
```

(d) フォルダ行のトグル `Button` の直後（`{loading && ...}` の後ろ、同じ flex 行内）に、ルートキャビネット以外（`move === "down"`）で取込ボタンを表示:

```typescript
        {move === "down" && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={() => {
              void runImport();
            }}
            disabled={importing}
            aria-label={`${label} 配下をインデックスに取り込む`}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DownloadCloud className="size-4" />
            )}
          </Button>
        )}
```

(e) フォルダの展開エラー表示（`{expanded && error && ...}`）の直後に取込メッセージ表示を追加:

```typescript
      {importMsg && (
        <p
          className="py-1 text-sm text-muted-foreground"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          {importMsg}
        </p>
      )}
```

(f) 子フォルダ再帰呼び出し（`<ExpandableFolder ... />`）に `path` を渡す。`label={child.name}` の直後に追加:

```typescript
              path={`${path}${child.name}/`}
```

(g) `ArchiveTree` のルート `<ExpandableFolder>` に `path` を渡す。`label={cabinet.name}` の直後に追加:

```typescript
          path={`/${cabinet.name}/`}
```

- [ ] **Step 3: 型チェック・lint・ビルド**

Run: `pnpm --filter admin typecheck && pnpm lint && pnpm --filter admin build`
Expected: すべて PASS

- [ ] **Step 4: 手動動作確認**

`pnpm dev` で admin を起動 → `/assembly-archive` を開く → 本会議 > 令和8年 > 6月定例会 の行で取込ボタンを押す → 「取り込み完了: フォルダN件 / 文書M件」が表示される。
DB 確認: `select count(*), session_label from assembly_documents group by session_label;` で `令和8年6月定例会` が入っていること。

- [ ] **Step 5: コミット**

```bash
git add admin/src/features/assembly-archive/server/actions/import-assembly-subtree-action.ts admin/src/features/assembly-archive/client/components/archive-tree.tsx
git commit -m "feat(admin): 議会資料ツリーにサブツリー取り込みボタンを追加"
```

---

## Task 10: 全体検証とセルフレビュー

**Files:** （変更なし）

- [ ] **Step 1: 全体検証コマンドを通す**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`
Expected: すべて PASS

- [ ] **Step 2: セルフレビュー**

`/simplify` → `/review` を実行し、指摘を修正する（AGENTS.md 必須ルール）。

- [ ] **Step 3: PR 作成**

UI 変更（`archive-tree.tsx`）を含むため、PR 作成後に `/pr-screenshot` を実行する。PoC のため base ブランチ等は `poc-pr-workflow` の方針に従う。

---

## Self-Review（plan 作成者によるスペック突合）

- **メタデータ取り込み（spec §1,§3,§4）** → Task 1（テーブル）, Task 6（クロール）, Task 7（取り込み）でカバー。
- **年度＋会期起点 / session_label 正規化（spec §3,§4,§5）** → Task 2（deriveSessionLabel）, Task 6（付与）, Task 9（UIで会期フォルダから起動）でカバー。
- **MCP 件名＋会期検索（spec §6）** → Task 5（検索クエリ）, Task 8（MCPツール）でカバー。
- **ユースケース「下書き議案→同会期で関連検索」（spec §1）** → Task 8 のツール出力（cabinetId/folderId/docid）が既存PDF取得に渡せる形でカバー。
- **PDF本文・fileを保存しない（spec §2 やらないこと）** → スキーマ・行型に fileId/bodyText を含めず遵守。
- **RLS有効・ポリシー無し（Global Constraints）** → Task 1 でカバー。
- **テスト方針（spec §8）** → 純粋関数（Task 2,3）, クロール（Task 6, DIフェイク）, リポジトリ（Task 5, ローカル実体）でカバー。DB function 無しのため統合テスト不要も遵守。
- Placeholder スキャン: TBD/TODO 無し。各コードステップは実コードを記載。
- 型整合: `AssemblyDocumentRow`/`AssemblySearchResult`/`crawlAssemblySubtree`/`importAssemblySubtree`/`searchAssemblyDocuments` の名称・引数が Task 4→5→6→7→8→9 で一貫。
