# 議会資料アーカイブ（assembly-archive）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** admin に「議会資料」ページを追加し、DiscussCabinet の文書ツリーを遅延展開で辿り、文書を選ぶと本文テキスト・メタ・原典リンクを表示できるようにする。

**Architecture:** 保存方式に依存しない `clients`（POST中継・セッション確立）と `parsers`（HTML→型付き構造の純粋関数）を分離し、`loaders` が両者を束ねる。UI は Server Component のページ + Client Component の遅延展開ツリー / 文書詳細パネル。Client からの取得は Server Actions 経由。DB保存はしない（ライブ遅延プロキシ）。

**Tech Stack:** Next.js (App Router) / React Server & Client Components / TypeScript / Zod / Vitest / `node-html-parser`（新規追加）/ Tailwind + 既存デザイントークン / `lucide-react` / `@/components/ui/button`。

## Global Constraints

- 作業は worktree `../mirai-gikai-assembly-archive-spec`（ブランチ `saitama/assembly-archive-spec`、`origin/poc/saitama-mirai-gikai` から分岐）で行う。
- Server側ファイル先頭に `"server-only"`、Client Component 先頭に `"use client"`、Server Action ファイル先頭に `"use server"` を付与する。
- ファイル名はローワーハイフン、コンポーネントは PascalCase、関数は camelCase。
- インラインSVG禁止（アイコンは `lucide-react`）。`<button>` 直書き禁止（`@/components/ui/button` の `Button`）。インラインカラー禁止（`globals.css` のデザイントークンを使用）。
- admin の内部リンク・ルートは文字列直書き禁止。`@/lib/routes` の関数を使う。新規ページ追加時は `admin/src/lib/routes.ts` にもルート関数を追加する（`routes.test.ts` が同期を検証）。
- 純粋関数（`parsers/`・`utils/`）には同階層に `*.test.ts` を必ず作る。外部API（fetch層）は DI でインターフェース化し、テストでは Fake に差し替える。実 DiscussCabinet への通信テストはしない。
- Biome: 2スペース・LF・ダブルクォート・セミコロン・80桁。
- DiscussCabinet ベースURL: `https://www.discusscabinet.net/saitama`。ルートキャビネットは固定値 `本会議=1` / `委員会=2`。
- 単体テスト実行: `pnpm --filter admin exec vitest run <admin相対パス>`。最終ゲート: `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build`。

---

## File Structure

```
admin/
├── package.json                                              # Modify: node-html-parser 追加
└── src/
    ├── app/(protected)/
    │   ├── assembly-archive/page.tsx                         # Create: 薄いページ（ROOT_CABINETS を渡す）
    │   └── layout/navigation-links.tsx                       # Modify: ナビに「議会資料」追加
    ├── lib/routes.ts                                         # Modify: assemblyArchive ルート追加
    └── features/assembly-archive/
        ├── shared/
        │   ├── types/index.ts                                # Create: 型定義
        │   └── constants.ts                                  # Create: ROOT_CABINETS / BASE_URL
        ├── server/
        │   ├── parsers/
        │   │   ├── parse-folder-list.ts                      # Create + test
        │   │   ├── parse-folder-list.test.ts
        │   │   ├── parse-doc-view.ts                         # Create + test
        │   │   └── parse-doc-view.test.ts
        │   ├── utils/
        │   │   ├── parse-folder-path.ts                      # Create + test
        │   │   └── parse-folder-path.test.ts
        │   ├── clients/
        │   │   ├── discuss-cabinet-client.ts                 # Create + test（DI fetch）
        │   │   └── discuss-cabinet-client.test.ts
        │   ├── loaders/
        │   │   ├── load-tree-children.ts                     # Create + test（Fake client）
        │   │   ├── load-tree-children.test.ts
        │   │   ├── load-document-detail.ts                   # Create + test（Fake client）
        │   │   └── load-document-detail.test.ts
        │   └── actions/
        │       ├── fetch-tree-children.ts                    # Create（"use server"）
        │       └── fetch-document-detail.ts                  # Create（"use server"）
        └── client/components/
            ├── archive-browser.tsx                           # Create（選択状態を保持）
            ├── archive-tree.tsx                              # Create（遅延展開）
            └── document-detail-panel.tsx                     # Create（本文+コピー+リンク）
```

---

## Task 1: 依存追加・共通型・定数

**Files:**
- Modify: `admin/package.json`
- Create: `admin/src/features/assembly-archive/shared/types/index.ts`
- Create: `admin/src/features/assembly-archive/shared/constants.ts`

**Interfaces:**
- Produces:
  - `Cabinet = { cabinetId: number; name: string }`
  - `FolderNode = { kind: "folder"; cabinetId: number; folderId: number; name: string }`
  - `DocumentNode = { kind: "document"; cabinetId: number; folderId: number; docid: number; title: string; date: string }`
  - `TreeChild = FolderNode | DocumentNode`
  - `DocumentFile = { fileId: number; fileName: string }`
  - `DocumentDetail = { title: string; folderPath: string; bodyText: string; files: DocumentFile[] }`
  - `ParsedFolderList = { folders: { folderId: number; name: string }[]; documents: { docid: number; title: string; date: string }[] }`
  - `ParsedDocView = { title: string; folderPath: string; bodyText: string; files: DocumentFile[] }`
  - `ROOT_CABINETS: Cabinet[]`、`DISCUSS_CABINET_BASE_URL: string`、`DISCUSS_CABINET_ENTRY_URL: string`

- [ ] **Step 1: node-html-parser を追加**

Run（worktree ルートで）:
```bash
cd /Users/hiranyu1/repo/mirai-gikai-assembly-archive-spec && pnpm --filter admin add node-html-parser
```
Expected: `admin/package.json` の dependencies に `node-html-parser` が入り、lockfile が更新される。

- [ ] **Step 2: 型定義を作成**

Create `admin/src/features/assembly-archive/shared/types/index.ts`:
```ts
export type Cabinet = {
  cabinetId: number;
  name: string;
};

export type FolderNode = {
  kind: "folder";
  cabinetId: number;
  folderId: number;
  name: string;
};

export type DocumentNode = {
  kind: "document";
  cabinetId: number;
  folderId: number;
  docid: number;
  title: string;
  date: string;
};

export type TreeChild = FolderNode | DocumentNode;

export type DocumentFile = {
  fileId: number;
  fileName: string;
};

export type DocumentDetail = {
  title: string;
  folderPath: string;
  bodyText: string;
  files: DocumentFile[];
};

export type ParsedFolderList = {
  folders: { folderId: number; name: string }[];
  documents: { docid: number; title: string; date: string }[];
};

export type ParsedDocView = {
  title: string;
  folderPath: string;
  bodyText: string;
  files: DocumentFile[];
};
```

- [ ] **Step 3: 定数を作成**

Create `admin/src/features/assembly-archive/shared/constants.ts`:
```ts
import type { Cabinet } from "./types";

export const DISCUSS_CABINET_BASE_URL = "https://www.discusscabinet.net/saitama";

export const DISCUSS_CABINET_ENTRY_URL = `${DISCUSS_CABINET_BASE_URL}/`;

// ルートキャビネットは安定IDのため固定値で持つ（本会議=1 / 委員会=2）。
// マニュアルキャビネット(721)は議会資料ではないため対象外。
export const ROOT_CABINETS: Cabinet[] = [
  { cabinetId: 1, name: "本会議" },
  { cabinetId: 2, name: "委員会" },
];
```

- [ ] **Step 4: 型チェック**

Run:
```bash
pnpm --filter admin exec tsc --noEmit
```
Expected: PASS（新規ファイルに型エラーなし）。

- [ ] **Step 5: Commit**

```bash
git add admin/package.json pnpm-lock.yaml admin/src/features/assembly-archive/shared/
git commit -m "feat(assembly-archive): 共通型・定数とnode-html-parser依存を追加"
```

---

## Task 2: parseFolderList（フォルダ一覧HTMLの解析）

**Files:**
- Create: `admin/src/features/assembly-archive/server/parsers/parse-folder-list.ts`
- Test: `admin/src/features/assembly-archive/server/parsers/parse-folder-list.test.ts`

**Interfaces:**
- Consumes: `ParsedFolderList`（Task 1）
- Produces:
  - `class DiscussCabinetParseError extends Error`
  - `parseFolderList(html: string): ParsedFolderList`（`<title>` に「エラー」を含む場合は `DiscussCabinetParseError` を throw）

- [ ] **Step 1: 失敗するテストを書く**

Create `admin/src/features/assembly-archive/server/parsers/parse-folder-list.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  DiscussCabinetParseError,
  parseFolderList,
} from "./parse-folder-list";

const FOLDER_LIST_HTML = `
<html><body>
<button type="button" id="btn_folder_list_212526"
  class="btn_size8 folder_icon cursor_pointer"
  onclick="javascript:setFolderid('212526','down');doSubmit('list');"
  title="令和８年"><span>令和８年</span></button>
<button type="button" id="btn_folder_list_177110"
  class="btn_size8 folder_icon cursor_pointer"
  onclick="javascript:setFolderid('177110','down');doSubmit('list');"
  title="令和７年"><span>令和７年</span></button>
<table>
<tr>
  <td class="img"><button onclick="javascript:doSubmitWithDocid('doc_view',15338)">詳細</button></td>
  <td class="img"><img src="x.png" alt=""/></td>
  <td>令和８年６月定例会請願審議結果一覧</td>
  <td>2026/06/12</td>
</tr>
<tr>
  <td class="img"><button onclick="javascript:doSubmitWithDocid('doc_view',15337)">詳細</button></td>
  <td class="img"><img src="x.png" alt=""/></td>
  <td>令和８年６月定例会議案審議結果一覧</td>
  <td>2026/06/12</td>
</tr>
</table>
</body></html>`;

const ERROR_HTML = `
<html><head><title>エラー画面</title></head>
<body><div class="w_t_39_2">エラー</div></body></html>`;

describe("parseFolderList", () => {
  it("フォルダボタンから folderId と name を抽出する", () => {
    const result = parseFolderList(FOLDER_LIST_HTML);
    expect(result.folders).toEqual([
      { folderId: 212526, name: "令和８年" },
      { folderId: 177110, name: "令和７年" },
    ]);
  });

  it("文書行から docid・件名・日付を抽出する", () => {
    const result = parseFolderList(FOLDER_LIST_HTML);
    expect(result.documents).toEqual([
      { docid: 15338, title: "令和８年６月定例会請願審議結果一覧", date: "2026/06/12" },
      { docid: 15337, title: "令和８年６月定例会議案審議結果一覧", date: "2026/06/12" },
    ]);
  });

  it("エラー画面では DiscussCabinetParseError を throw する", () => {
    expect(() => parseFolderList(ERROR_HTML)).toThrow(DiscussCabinetParseError);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/parsers/parse-folder-list.test.ts
```
Expected: FAIL（`parse-folder-list` が存在しない）。

- [ ] **Step 3: 実装を書く**

Create `admin/src/features/assembly-archive/server/parsers/parse-folder-list.ts`:
```ts
import "server-only";

import { parse } from "node-html-parser";
import type { ParsedFolderList } from "../../shared/types";

export class DiscussCabinetParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscussCabinetParseError";
  }
}

function assertNotErrorScreen(root: ReturnType<typeof parse>): void {
  const title = root.querySelector("title")?.text ?? "";
  if (title.includes("エラー")) {
    throw new DiscussCabinetParseError("DiscussCabinet がエラー画面を返しました");
  }
}

export function parseFolderList(html: string): ParsedFolderList {
  const root = parse(html);
  assertNotErrorScreen(root);

  const folders: ParsedFolderList["folders"] = [];
  for (const button of root.querySelectorAll("button.folder_icon")) {
    const onclick = button.getAttribute("onclick") ?? "";
    const idMatch = onclick.match(/setFolderid\('(\d+)'/);
    if (!idMatch) continue;
    const name = (button.getAttribute("title") ?? button.text).trim();
    folders.push({ folderId: Number(idMatch[1]), name });
  }

  const documents: ParsedFolderList["documents"] = [];
  for (const tr of root.querySelectorAll("tr")) {
    const button = tr.querySelector("button");
    const onclick = button?.getAttribute("onclick") ?? "";
    const docMatch = onclick.match(/doSubmitWithDocid\('doc_view',\s*(\d+)\)/);
    if (!docMatch) continue;
    const cells = tr
      .querySelectorAll("td")
      .filter((td) => td.getAttribute("class") !== "img");
    const title = cells[0]?.text.trim() ?? "";
    const date = cells[1]?.text.trim() ?? "";
    documents.push({ docid: Number(docMatch[1]), title, date });
  }

  return { folders, documents };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/parsers/parse-folder-list.test.ts
```
Expected: PASS（3件）。

- [ ] **Step 5: Commit**

```bash
git add admin/src/features/assembly-archive/server/parsers/parse-folder-list.ts admin/src/features/assembly-archive/server/parsers/parse-folder-list.test.ts
git commit -m "feat(assembly-archive): フォルダ一覧パーサを追加"
```

---

## Task 3: parseDocView（文書詳細HTMLの解析）

**Files:**
- Create: `admin/src/features/assembly-archive/server/parsers/parse-doc-view.ts`
- Test: `admin/src/features/assembly-archive/server/parsers/parse-doc-view.test.ts`

**Interfaces:**
- Consumes: `ParsedDocView`、`DiscussCabinetParseError`（Task 2 から re-import）
- Produces: `parseDocView(html: string): ParsedDocView`（エラー画面は `DiscussCabinetParseError` を throw）

- [ ] **Step 1: 失敗するテストを書く**

Create `admin/src/features/assembly-archive/server/parsers/parse-doc-view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DiscussCabinetParseError } from "./parse-folder-list";
import { parseDocView } from "./parse-doc-view";

const DOC_VIEW_HTML = `
<html><head><title>文書詳細画面</title></head><body>
<table>
<tr><th>件名:</th><td> 令和８年６月定例会議案審議結果一覧 </td></tr>
<tr><th>日付:</th><td>2026/06/12</td></tr>
<tr><th>フォルダ名:</th><td>/本会議/令和８年/６月定例会/審議結果/</td></tr>
<tr><th>本文テキスト:</th><td> 議案番号 提出日 件名 議決結果 議決日第106号令和8年6月3日専決処分の報告及び承認を求めることについて承認 </td></tr>
<tr><th>ファイル名:</th><td>
  <a href="#" onClick="setFile('17114');doSubmitWithNewWin('file_view');return false;">令和８年６月定例会議案審議結果一覧.pdf</a>
</td></tr>
</table>
</body></html>`;

const EMPTY_BODY_HTML = `
<html><head><title>文書詳細画面</title></head><body>
<table>
<tr><th>件名:</th><td>テスト議案</td></tr>
<tr><th>フォルダ名:</th><td>/本会議/令和８年/</td></tr>
<tr><th>本文テキスト:</th><td>  </td></tr>
</table>
</body></html>`;

const ERROR_HTML = `<html><head><title>エラー画面</title></head><body></body></html>`;

describe("parseDocView", () => {
  it("件名・フォルダパス・本文テキスト・ファイルを抽出する", () => {
    const result = parseDocView(DOC_VIEW_HTML);
    expect(result.title).toBe("令和８年６月定例会議案審議結果一覧");
    expect(result.folderPath).toBe("/本会議/令和８年/６月定例会/審議結果/");
    expect(result.bodyText).toContain("第106号令和8年6月3日専決処分の報告");
    expect(result.files).toEqual([
      { fileId: 17114, fileName: "令和８年６月定例会議案審議結果一覧.pdf" },
    ]);
  });

  it("本文テキストが空白のみのときは空文字を返す", () => {
    const result = parseDocView(EMPTY_BODY_HTML);
    expect(result.bodyText).toBe("");
    expect(result.files).toEqual([]);
  });

  it("エラー画面では DiscussCabinetParseError を throw する", () => {
    expect(() => parseDocView(ERROR_HTML)).toThrow(DiscussCabinetParseError);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/parsers/parse-doc-view.test.ts
```
Expected: FAIL（`parse-doc-view` が存在しない）。

- [ ] **Step 3: 実装を書く**

Create `admin/src/features/assembly-archive/server/parsers/parse-doc-view.ts`:
```ts
import "server-only";

import { parse } from "node-html-parser";
import type { DocumentFile, ParsedDocView } from "../../shared/types";
import { DiscussCabinetParseError } from "./parse-folder-list";

function findValueByLabel(
  root: ReturnType<typeof parse>,
  label: string
): string {
  for (const tr of root.querySelectorAll("tr")) {
    const th = tr.querySelector("th");
    if (th && th.text.trim().startsWith(label)) {
      return tr.querySelector("td")?.text.trim() ?? "";
    }
  }
  return "";
}

export function parseDocView(html: string): ParsedDocView {
  const root = parse(html);
  const title = root.querySelector("title")?.text ?? "";
  if (title.includes("エラー")) {
    throw new DiscussCabinetParseError("DiscussCabinet がエラー画面を返しました");
  }

  const files: DocumentFile[] = [];
  for (const anchor of root.querySelectorAll("a")) {
    const onclick = anchor.getAttribute("onclick") ?? "";
    const match = onclick.match(/setFile\('(\d+)'\)/);
    if (!match) continue;
    files.push({ fileId: Number(match[1]), fileName: anchor.text.trim() });
  }

  return {
    title: findValueByLabel(root, "件名"),
    folderPath: findValueByLabel(root, "フォルダ名"),
    bodyText: findValueByLabel(root, "本文テキスト"),
    files,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/parsers/parse-doc-view.test.ts
```
Expected: PASS（3件）。

- [ ] **Step 5: Commit**

```bash
git add admin/src/features/assembly-archive/server/parsers/parse-doc-view.ts admin/src/features/assembly-archive/server/parsers/parse-doc-view.test.ts
git commit -m "feat(assembly-archive): 文書詳細パーサを追加"
```

---

## Task 4: parseFolderPath（パンくず用の純粋関数）

**Files:**
- Create: `admin/src/features/assembly-archive/server/utils/parse-folder-path.ts`
- Test: `admin/src/features/assembly-archive/server/utils/parse-folder-path.test.ts`

**Interfaces:**
- Produces: `parseFolderPath(path: string): string[]`（先頭末尾の `/` を除き、`/` で分割。空セグメントは除外）

- [ ] **Step 1: 失敗するテストを書く**

Create `admin/src/features/assembly-archive/server/utils/parse-folder-path.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseFolderPath } from "./parse-folder-path";

describe("parseFolderPath", () => {
  it("前後のスラッシュを除いてセグメント配列にする", () => {
    expect(parseFolderPath("/本会議/令和８年/６月定例会/審議結果/")).toEqual([
      "本会議",
      "令和８年",
      "６月定例会",
      "審議結果",
    ]);
  });

  it("空文字は空配列を返す", () => {
    expect(parseFolderPath("")).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/utils/parse-folder-path.test.ts
```
Expected: FAIL。

- [ ] **Step 3: 実装を書く**

Create `admin/src/features/assembly-archive/server/utils/parse-folder-path.ts`:
```ts
export function parseFolderPath(path: string): string[] {
  return path.split("/").filter((segment) => segment.trim().length > 0);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/utils/parse-folder-path.test.ts
```
Expected: PASS（2件）。

- [ ] **Step 5: Commit**

```bash
git add admin/src/features/assembly-archive/server/utils/
git commit -m "feat(assembly-archive): フォルダパス分割ユーティリティを追加"
```

---

## Task 5: discussCabinetClient（POST中継・セッション確立）

**Files:**
- Create: `admin/src/features/assembly-archive/server/clients/discuss-cabinet-client.ts`
- Test: `admin/src/features/assembly-archive/server/clients/discuss-cabinet-client.test.ts`

**Interfaces:**
- Consumes: `DISCUSS_CABINET_BASE_URL`（Task 1）
- Produces:
  - `type FetchLike = (url: string, init: RequestInit) => Promise<Response>`
  - `interface DiscussCabinetClient { fetchFolderList(input: { cabinetId: number; folderId: number; move: "cabinet" | "down" }): Promise<string>; fetchDocView(input: { cabinetId: number; folderId: number; docid: number }): Promise<string>; }`
  - `function createDiscussCabinetClient(fetchImpl?: FetchLike): DiscussCabinetClient`
- 動作: 各メソッドで (1) `POST /list`（body空）を呼びセッションcookieを取得 → (2) 取得した cookie を `Cookie` ヘッダに付け、本リクエストを `application/x-www-form-urlencoded` で POST し、レスポンス本文(HTML文字列)を返す。

- [ ] **Step 1: 失敗するテストを書く**

Create `admin/src/features/assembly-archive/server/clients/discuss-cabinet-client.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createDiscussCabinetClient } from "./discuss-cabinet-client";

function makeResponse(body: string, setCookie?: string): Response {
  const headers = new Headers();
  if (setCookie) headers.append("set-cookie", setCookie);
  return new Response(body, { status: 200, headers });
}

describe("discussCabinetClient", () => {
  it("セッション確立後、cookie付きで list を POST し HTML を返す", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return makeResponse("<html></html>", "SESSION=abc; path=/");
      }
      return makeResponse("<html>folders</html>");
    });

    const client = createDiscussCabinetClient(fetchImpl);
    const html = await client.fetchFolderList({
      cabinetId: 1,
      folderId: 0,
      move: "cabinet",
    });

    expect(html).toBe("<html>folders</html>");
    // 1回目: セッション確立、2回目: 本リクエスト
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain("/list");
    expect(calls[1].init.method).toBe("POST");
    const body = String(calls[1].init.body);
    expect(body).toContain("cabinet_id=1");
    expect(body).toContain("folder_id=0");
    expect(body).toContain("move=cabinet");
    expect((calls[1].init.headers as Record<string, string>).Cookie).toContain(
      "SESSION=abc"
    );
  });

  it("fetchDocView は doc_view を docid 付きで POST する", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return makeResponse("<html></html>", "SESSION=z; path=/");
      }
      return makeResponse("<html>doc</html>");
    });

    const client = createDiscussCabinetClient(fetchImpl);
    const html = await client.fetchDocView({
      cabinetId: 1,
      folderId: 224514,
      docid: 15337,
    });

    expect(html).toBe("<html>doc</html>");
    expect(calls[1].url).toContain("/doc_view");
    const body = String(calls[1].init.body);
    expect(body).toContain("docid=15337");
    expect(body).toContain("folder_id=224514");
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/clients/discuss-cabinet-client.test.ts
```
Expected: FAIL。

- [ ] **Step 3: 実装を書く**

Create `admin/src/features/assembly-archive/server/clients/discuss-cabinet-client.ts`:
```ts
import "server-only";

import { DISCUSS_CABINET_BASE_URL } from "../../shared/constants";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface DiscussCabinetClient {
  fetchFolderList(input: {
    cabinetId: number;
    folderId: number;
    move: "cabinet" | "down";
  }): Promise<string>;
  fetchDocView(input: {
    cabinetId: number;
    folderId: number;
    docid: number;
  }): Promise<string>;
}

const FORM_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
};

function extractCookie(response: Response): string {
  // Node(undici)では getSetCookie() が使える
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

export function createDiscussCabinetClient(
  fetchImpl: FetchLike = fetch
): DiscussCabinetClient {
  async function establishSession(): Promise<string> {
    const response = await fetchImpl(`${DISCUSS_CABINET_BASE_URL}/list`, {
      method: "POST",
      headers: FORM_HEADERS,
      body: "",
    });
    return extractCookie(response);
  }

  async function postForm(
    path: string,
    params: Record<string, string | number>
  ): Promise<string> {
    const cookie = await establishSession();
    const body = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    const response = await fetchImpl(`${DISCUSS_CABINET_BASE_URL}${path}`, {
      method: "POST",
      headers: { ...FORM_HEADERS, Cookie: cookie },
      body,
    });
    return response.text();
  }

  return {
    fetchFolderList({ cabinetId, folderId, move }) {
      return postForm("/list", {
        cabinet_id: cabinetId,
        folder_id: folderId,
        move,
        actions: "",
        order: "",
        start: 0,
        docid: "",
        refer: "",
      });
    },
    fetchDocView({ cabinetId, folderId, docid }) {
      return postForm("/doc_view", {
        cabinet_id: cabinetId,
        folder_id: folderId,
        docid,
        move: "",
        actions: "",
        order: "",
        start: 0,
        refer: "",
      });
    },
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/clients/discuss-cabinet-client.test.ts
```
Expected: PASS（2件）。

- [ ] **Step 5: Commit**

```bash
git add admin/src/features/assembly-archive/server/clients/
git commit -m "feat(assembly-archive): DiscussCabinet クライアント（POST中継/セッション確立）を追加"
```

---

## Task 6: loaders（client + parser を束ねる）

**Files:**
- Create: `admin/src/features/assembly-archive/server/loaders/load-tree-children.ts`
- Test: `admin/src/features/assembly-archive/server/loaders/load-tree-children.test.ts`
- Create: `admin/src/features/assembly-archive/server/loaders/load-document-detail.ts`
- Test: `admin/src/features/assembly-archive/server/loaders/load-document-detail.test.ts`

**Interfaces:**
- Consumes: `DiscussCabinetClient`（Task 5）、`parseFolderList`/`parseDocView`（Task 2/3）、型（Task 1）
- Produces:
  - `loadTreeChildren(input: { cabinetId: number; folderId: number; move: "cabinet" | "down" }, client?: DiscussCabinetClient): Promise<TreeChild[]>`
  - `loadDocumentDetail(input: { cabinetId: number; folderId: number; docid: number }, client?: DiscussCabinetClient): Promise<DocumentDetail>`
- `loadTreeChildren` はパース結果に `cabinetId` を付与して `FolderNode[]`（先）+ `DocumentNode[]`（後）を返す。子フォルダの `folderId` は当該フォルダ、`DocumentNode.folderId` は親フォルダ（入力 `folderId`）。

- [ ] **Step 1: 失敗するテスト（load-tree-children）を書く**

Create `admin/src/features/assembly-archive/server/loaders/load-tree-children.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { DiscussCabinetClient } from "../clients/discuss-cabinet-client";
import { loadTreeChildren } from "./load-tree-children";

const FOLDER_LIST_HTML = `
<html><body>
<button class="folder_icon" onclick="setFolderid('223218','down');doSubmit('list');" title="６月定例会"><span>６月定例会</span></button>
<table>
<tr>
  <td class="img"><button onclick="doSubmitWithDocid('doc_view',15337)">詳細</button></td>
  <td class="img"><img/></td>
  <td>令和８年６月定例会議案審議結果一覧</td>
  <td>2026/06/12</td>
</tr>
</table>
</body></html>`;

function fakeClient(html: string): DiscussCabinetClient {
  return {
    fetchFolderList: async () => html,
    fetchDocView: async () => "",
  };
}

describe("loadTreeChildren", () => {
  it("フォルダを先、文書を後にして cabinetId を付与する", async () => {
    const result = await loadTreeChildren(
      { cabinetId: 1, folderId: 212526, move: "down" },
      fakeClient(FOLDER_LIST_HTML)
    );
    expect(result).toEqual([
      {
        kind: "folder",
        cabinetId: 1,
        folderId: 223218,
        name: "６月定例会",
      },
      {
        kind: "document",
        cabinetId: 1,
        folderId: 212526,
        docid: 15337,
        title: "令和８年６月定例会議案審議結果一覧",
        date: "2026/06/12",
      },
    ]);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/loaders/load-tree-children.test.ts
```
Expected: FAIL。

- [ ] **Step 3: load-tree-children を実装**

Create `admin/src/features/assembly-archive/server/loaders/load-tree-children.ts`:
```ts
import "server-only";

import type { TreeChild } from "../../shared/types";
import {
  createDiscussCabinetClient,
  type DiscussCabinetClient,
} from "../clients/discuss-cabinet-client";
import { parseFolderList } from "../parsers/parse-folder-list";

export async function loadTreeChildren(
  input: { cabinetId: number; folderId: number; move: "cabinet" | "down" },
  client: DiscussCabinetClient = createDiscussCabinetClient()
): Promise<TreeChild[]> {
  const html = await client.fetchFolderList(input);
  const parsed = parseFolderList(html);

  const folders: TreeChild[] = parsed.folders.map((folder) => ({
    kind: "folder",
    cabinetId: input.cabinetId,
    folderId: folder.folderId,
    name: folder.name,
  }));

  const documents: TreeChild[] = parsed.documents.map((doc) => ({
    kind: "document",
    cabinetId: input.cabinetId,
    folderId: input.folderId,
    docid: doc.docid,
    title: doc.title,
    date: doc.date,
  }));

  return [...folders, ...documents];
}
```

- [ ] **Step 4: テストが通ることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/loaders/load-tree-children.test.ts
```
Expected: PASS。

- [ ] **Step 5: 失敗するテスト（load-document-detail）を書く**

Create `admin/src/features/assembly-archive/server/loaders/load-document-detail.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { DiscussCabinetClient } from "../clients/discuss-cabinet-client";
import { loadDocumentDetail } from "./load-document-detail";

const DOC_VIEW_HTML = `
<html><head><title>文書詳細画面</title></head><body>
<table>
<tr><th>件名:</th><td>令和８年６月定例会議案審議結果一覧</td></tr>
<tr><th>フォルダ名:</th><td>/本会議/令和８年/６月定例会/審議結果/</td></tr>
<tr><th>本文テキスト:</th><td>議案番号 提出日 件名 議決結果</td></tr>
<tr><th>ファイル名:</th><td><a onClick="setFile('17114');return false;">x.pdf</a></td></tr>
</table>
</body></html>`;

function fakeClient(html: string): DiscussCabinetClient {
  return {
    fetchFolderList: async () => "",
    fetchDocView: async () => html,
  };
}

describe("loadDocumentDetail", () => {
  it("文書詳細を DocumentDetail として返す", async () => {
    const result = await loadDocumentDetail(
      { cabinetId: 1, folderId: 224514, docid: 15337 },
      fakeClient(DOC_VIEW_HTML)
    );
    expect(result).toEqual({
      title: "令和８年６月定例会議案審議結果一覧",
      folderPath: "/本会議/令和８年/６月定例会/審議結果/",
      bodyText: "議案番号 提出日 件名 議決結果",
      files: [{ fileId: 17114, fileName: "x.pdf" }],
    });
  });
});
```

- [ ] **Step 6: テストが落ちることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/loaders/load-document-detail.test.ts
```
Expected: FAIL。

- [ ] **Step 7: load-document-detail を実装**

Create `admin/src/features/assembly-archive/server/loaders/load-document-detail.ts`:
```ts
import "server-only";

import type { DocumentDetail } from "../../shared/types";
import {
  createDiscussCabinetClient,
  type DiscussCabinetClient,
} from "../clients/discuss-cabinet-client";
import { parseDocView } from "../parsers/parse-doc-view";

export async function loadDocumentDetail(
  input: { cabinetId: number; folderId: number; docid: number },
  client: DiscussCabinetClient = createDiscussCabinetClient()
): Promise<DocumentDetail> {
  const html = await client.fetchDocView(input);
  const parsed = parseDocView(html);
  return {
    title: parsed.title,
    folderPath: parsed.folderPath,
    bodyText: parsed.bodyText,
    files: parsed.files,
  };
}
```

- [ ] **Step 8: テストが通ることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/features/assembly-archive/server/loaders/load-document-detail.test.ts
```
Expected: PASS。

- [ ] **Step 9: Commit**

```bash
git add admin/src/features/assembly-archive/server/loaders/
git commit -m "feat(assembly-archive): ツリー子要素・文書詳細 loader を追加"
```

---

## Task 7: Server Actions（Client からの遅延取得）

**Files:**
- Create: `admin/src/features/assembly-archive/server/actions/fetch-tree-children.ts`
- Create: `admin/src/features/assembly-archive/server/actions/fetch-document-detail.ts`

**Interfaces:**
- Consumes: `loadTreeChildren`/`loadDocumentDetail`（Task 6）、`requireAdmin`（`@/features/auth/server/lib/auth-server`）、`getErrorMessage`（`@/lib/utils/get-error-message`）
- Produces:
  - `fetchTreeChildren(input: { cabinetId: number; folderId: number; move: "cabinet" | "down" }): Promise<{ data: TreeChild[] } | { error: string }>`
  - `fetchDocumentDetail(input: { cabinetId: number; folderId: number; docid: number }): Promise<{ data: DocumentDetail } | { error: string }>`

- [ ] **Step 1: fetch-tree-children を実装**

Create `admin/src/features/assembly-archive/server/actions/fetch-tree-children.ts`:
```ts
"use server";

import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import type { TreeChild } from "../../shared/types";
import { loadTreeChildren } from "../loaders/load-tree-children";

export async function fetchTreeChildren(input: {
  cabinetId: number;
  folderId: number;
  move: "cabinet" | "down";
}): Promise<{ data: TreeChild[] } | { error: string }> {
  try {
    await requireAdmin();
    const data = await loadTreeChildren(input);
    return { data };
  } catch (error) {
    console.error("fetchTreeChildren error:", error);
    return {
      error: getErrorMessage(
        error,
        "議会資料の取得に失敗しました（DiscussCabinet側の構造変更または一時的な障害の可能性があります）"
      ),
    };
  }
}
```

- [ ] **Step 2: fetch-document-detail を実装**

Create `admin/src/features/assembly-archive/server/actions/fetch-document-detail.ts`:
```ts
"use server";

import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import type { DocumentDetail } from "../../shared/types";
import { loadDocumentDetail } from "../loaders/load-document-detail";

export async function fetchDocumentDetail(input: {
  cabinetId: number;
  folderId: number;
  docid: number;
}): Promise<{ data: DocumentDetail } | { error: string }> {
  try {
    await requireAdmin();
    const data = await loadDocumentDetail(input);
    return { data };
  } catch (error) {
    console.error("fetchDocumentDetail error:", error);
    return {
      error: getErrorMessage(
        error,
        "文書の取得に失敗しました（DiscussCabinet側の構造変更または一時的な障害の可能性があります）"
      ),
    };
  }
}
```

- [ ] **Step 3: 型チェック（auth/util の import パス確認）**

Run:
```bash
pnpm --filter admin exec tsc --noEmit
```
Expected: PASS。失敗する場合は `admin/src/features/auth/server/lib/auth-server.ts` の `requireAdmin` export と `admin/src/lib/utils/get-error-message.ts` の存在を確認し、import パスを実体に合わせる。

- [ ] **Step 4: Commit**

```bash
git add admin/src/features/assembly-archive/server/actions/
git commit -m "feat(assembly-archive): ツリー・文書取得の Server Actions を追加"
```

---

## Task 8: ルート定義・ナビ・ページ（routes.test 同期）

**Files:**
- Modify: `admin/src/lib/routes.ts`
- Modify: `admin/src/app/(protected)/layout/navigation-links.tsx`
- Create: `admin/src/app/(protected)/assembly-archive/page.tsx`

**Interfaces:**
- Consumes: `ArchiveBrowser`（Task 9 で作成）、`ROOT_CABINETS`（Task 1）
- Produces: `routes.assemblyArchive(): "/assembly-archive"`

> 注: Task 9 で `ArchiveBrowser` を作るまでページはビルドできない。本タスクでは page.tsx で `ArchiveBrowser` を import する前提で書き、ビルド確認は Task 9 のステップで行う。routes.test.ts の同期は本タスクで通す。

- [ ] **Step 1: routes.ts にルートを追加**

Modify `admin/src/lib/routes.ts` の `routes` オブジェクト、`opsActivityLog` の行の直後に追加:
```ts
  opsActivityLog: () => "/ops-activity-log" as const,
  assemblyArchive: () => "/assembly-archive" as const,
```

- [ ] **Step 2: ナビに追加**

Modify `admin/src/app/(protected)/layout/navigation-links.tsx` の `navigationLinks` 配列、`opsActivityLog` の行の直後に追加:
```ts
  { href: routes.opsActivityLog(), label: "作業ログ" },
  { href: routes.assemblyArchive(), label: "議会資料" },
```

- [ ] **Step 3: ページを作成**

Create `admin/src/app/(protected)/assembly-archive/page.tsx`:
```tsx
import { ArchiveBrowser } from "@/features/assembly-archive/client/components/archive-browser";
import { ROOT_CABINETS } from "@/features/assembly-archive/shared/constants";

export default function AssemblyArchivePage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-8">議会資料</h1>
      <ArchiveBrowser cabinets={ROOT_CABINETS} />
    </div>
  );
}
```

- [ ] **Step 4: routes 同期テストが通ることを確認**

Run:
```bash
pnpm --filter admin exec vitest run src/lib/routes.test.ts
```
Expected: PASS（page.tsx と routes 定義が一致）。

- [ ] **Step 5: Commit**

```bash
git add admin/src/lib/routes.ts "admin/src/app/(protected)/layout/navigation-links.tsx" "admin/src/app/(protected)/assembly-archive/page.tsx"
git commit -m "feat(assembly-archive): ルート・ナビ・ページを追加"
```

---

## Task 9: Client Components（遅延展開ツリー・文書詳細パネル）

**Files:**
- Create: `admin/src/features/assembly-archive/client/components/archive-browser.tsx`
- Create: `admin/src/features/assembly-archive/client/components/archive-tree.tsx`
- Create: `admin/src/features/assembly-archive/client/components/document-detail-panel.tsx`

**Interfaces:**
- Consumes: `fetchTreeChildren`/`fetchDocumentDetail`（Task 7）、`parseFolderPath`（Task 4）、型（Task 1）、`DISCUSS_CABINET_ENTRY_URL`（Task 1）、`Button`（`@/components/ui/button`）、`lucide-react`
- Produces:
  - `ArchiveBrowser({ cabinets }: { cabinets: Cabinet[] })`
  - `ArchiveTree({ cabinets, onSelectDocument }: { cabinets: Cabinet[]; onSelectDocument: (doc: DocumentNode) => void })`
  - `DocumentDetailPanel({ document }: { document: DocumentNode | null })`

- [ ] **Step 1: ArchiveTree を実装**

Create `admin/src/features/assembly-archive/client/components/archive-tree.tsx`:
```tsx
"use client";

import { ChevronDown, ChevronRight, FileText, Folder, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchTreeChildren } from "@/features/assembly-archive/server/actions/fetch-tree-children";
import type {
  Cabinet,
  DocumentNode,
  FolderNode,
  TreeChild,
} from "@/features/assembly-archive/shared/types";

type ExpandableProps = {
  label: string;
  cabinetId: number;
  folderId: number;
  move: "cabinet" | "down";
  depth: number;
  onSelectDocument: (doc: DocumentNode) => void;
};

function DocumentRow({
  doc,
  depth,
  onSelectDocument,
}: {
  doc: DocumentNode;
  depth: number;
  onSelectDocument: (doc: DocumentNode) => void;
}) {
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 font-normal"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onSelectDocument(doc)}
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-left">{doc.title}</span>
    </Button>
  );
}

function ExpandableFolder({
  label,
  cabinetId,
  folderId,
  move,
  depth,
  onSelectDocument,
}: ExpandableProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<TreeChild[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (children !== null || loading) return;
    setLoading(true);
    setError(null);
    const result = await fetchTreeChildren({ cabinetId, folderId, move });
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setChildren(result.data);
  }

  return (
    <div>
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 font-normal"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={toggle}
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
        <Folder className="size-4 shrink-0 text-primary" />
        <span className="truncate text-left">{label}</span>
        {loading && <Loader2 className="size-4 animate-spin" />}
      </Button>
      {expanded && error && (
        <p
          className="py-1 text-sm text-destructive"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          {error}
        </p>
      )}
      {expanded &&
        children?.map((child) =>
          child.kind === "folder" ? (
            <ExpandableFolder
              key={`f-${child.folderId}`}
              label={child.name}
              cabinetId={child.cabinetId}
              folderId={child.folderId}
              move="down"
              depth={depth + 1}
              onSelectDocument={onSelectDocument}
            />
          ) : (
            <DocumentRow
              key={`d-${child.docid}`}
              doc={child}
              depth={depth + 1}
              onSelectDocument={onSelectDocument}
            />
          )
        )}
    </div>
  );
}

export function ArchiveTree({
  cabinets,
  onSelectDocument,
}: {
  cabinets: Cabinet[];
  onSelectDocument: (doc: DocumentNode) => void;
}) {
  return (
    <div className="rounded-lg border bg-white p-2">
      {cabinets.map((cabinet) => (
        <ExpandableFolder
          key={`c-${cabinet.cabinetId}`}
          label={cabinet.name}
          cabinetId={cabinet.cabinetId}
          folderId={0}
          move="cabinet"
          depth={0}
          onSelectDocument={onSelectDocument}
        />
      ))}
    </div>
  );
}

export type { FolderNode };
```

- [ ] **Step 2: DocumentDetailPanel を実装**

Create `admin/src/features/assembly-archive/client/components/document-detail-panel.tsx`:
```tsx
"use client";

import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchDocumentDetail } from "@/features/assembly-archive/server/actions/fetch-document-detail";
import { parseFolderPath } from "@/features/assembly-archive/server/utils/parse-folder-path";
import { DISCUSS_CABINET_ENTRY_URL } from "@/features/assembly-archive/shared/constants";
import type {
  DocumentDetail,
  DocumentNode,
} from "@/features/assembly-archive/shared/types";

export function DocumentDetailPanel({
  document: doc,
}: {
  document: DocumentNode | null;
}) {
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    setCopied(false);
    fetchDocumentDetail({
      cabinetId: doc.cabinetId,
      folderId: doc.folderId,
      docid: doc.docid,
    }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  async function copyBody() {
    if (!detail?.bodyText) return;
    await navigator.clipboard.writeText(detail.bodyText);
    setCopied(true);
  }

  if (!doc) {
    return (
      <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
        左のツリーから文書を選択してください。
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-1 text-lg font-semibold">{doc.title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{doc.date}</p>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 取得中...
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {detail && (
        <div className="space-y-4">
          {detail.folderPath && (
            <p className="text-sm text-muted-foreground">
              {parseFolderPath(detail.folderPath).join(" / ")}
            </p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">本文テキスト</span>
              {detail.bodyText && (
                <Button variant="outline" size="sm" onClick={copyBody}>
                  <Copy className="size-4" />
                  {copied ? "コピーしました" : "コピー"}
                </Button>
              )}
            </div>
            {detail.bodyText ? (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-sm">
                {detail.bodyText}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                本文テキストが取得できませんでした。原典PDFをご確認ください。
              </p>
            )}
          </div>

          {detail.files.length > 0 && (
            <div>
              <span className="text-sm font-medium">添付ファイル</span>
              <ul className="mt-1 space-y-1 text-sm">
                {detail.files.map((file) => (
                  <li key={file.fileId} className="text-muted-foreground">
                    {file.fileName}（ファイルID: {file.fileId}）
                  </li>
                ))}
              </ul>
            </div>
          )}

          <a
            href={DISCUSS_CABINET_ENTRY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline"
          >
            <ExternalLink className="size-4" />
            DiscussCabinet で開く（文書ID: {doc.docid}）
          </a>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: ArchiveBrowser を実装**

Create `admin/src/features/assembly-archive/client/components/archive-browser.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { Cabinet, DocumentNode } from "@/features/assembly-archive/shared/types";
import { ArchiveTree } from "./archive-tree";
import { DocumentDetailPanel } from "./document-detail-panel";

export function ArchiveBrowser({ cabinets }: { cabinets: Cabinet[] }) {
  const [selected, setSelected] = useState<DocumentNode | null>(null);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ArchiveTree cabinets={cabinets} onSelectDocument={setSelected} />
      <DocumentDetailPanel document={selected} />
    </div>
  );
}
```

- [ ] **Step 4: 型チェック・ビルド**

Run:
```bash
pnpm --filter admin exec tsc --noEmit
```
Expected: PASS。`muted`/`muted-foreground`/`destructive`/`primary` 等のトークンが `admin` の `globals.css` に未定義でビルドに影響する場合は、`admin/src/app/globals.css` の `@theme inline` を確認し、未定義のものは既存トークン（例: `text-gray-500`、`text-blue-600` 等、ナビで使われている既存クラス）に置き換える。インラインカラー（`text-[#...]`）は使わない。

- [ ] **Step 5: Commit**

```bash
git add admin/src/features/assembly-archive/client/
git commit -m "feat(assembly-archive): 遅延展開ツリーと文書詳細パネルを追加"
```

---

## Task 10: 検証ゲートと手動確認

**Files:** なし（検証のみ）

- [ ] **Step 1: lint**

Run:
```bash
cd /Users/hiranyu1/repo/mirai-gikai-assembly-archive-spec && pnpm lint
```
Expected: PASS（`pnpm -r` 系はハンドオフの `/tmp/pnpm-shim` を PATH 前置して実行）。指摘があれば修正。

- [ ] **Step 2: typecheck**

Run:
```bash
pnpm typecheck
```
Expected: PASS。

- [ ] **Step 3: test（全ワークスペース）**

Run:
```bash
pnpm test
```
Expected: PASS（assembly-archive のパーサ・util・client・loader テストを含む）。

- [ ] **Step 4: build**

Run:
```bash
pnpm build
```
Expected: PASS。dev サーバー稼働中は `web/.next` 破損回避のため dev を停止してから実行する。

- [ ] **Step 5: 手動確認（dev）**

Run:
```bash
pnpm dev
```
確認項目（admin = http://localhost:3001）:
1. ナビに「議会資料」が表示され、クリックで `/assembly-archive` に遷移する。
2. 「本会議」を展開 → 年フォルダが遅延ロードで表示される。
3. 年 → 定例会 → 審議結果 と辿り、文書（例: 議案審議結果一覧）が表示される。
4. 文書をクリック → 右パネルに本文テキスト・フォルダパス・添付ファイル・DiscussCabinet入口リンクが表示される。
5. 「コピー」で本文がクリップボードにコピーされる。

- [ ] **Step 6: 最終コミット（必要なら）と完了報告**

検証で修正が発生した場合のみコミット。完了後、`superpowers:finishing-a-development-branch` で PR 作成に進む（CLAUDE.md のセルフレビュー `/simplify`→`/review`、UI変更のため `/pr-screenshot` を実施）。

---

## Self-Review

**1. Spec coverage:**
- §1 スコープ（client/parser分離・ライブ遅延プロキシ・新規feature+ページ）→ Task 1–9 ✓
- §2 通信仕様（list/doc_view・固定キャビネット・move・file_view非取得）→ Task 5（client）・Task 1（定数）✓
- §3 レイヤー構成（clients/parsers/loaders/actions/client/shared）→ Task 1–9 で全層実装 ✓
- §4 エラー処理（エラー画面検知・本文空表示・タイムアウト/多重抑制）→ パーサのエラー throw（Task 2/3）、本文空文言（Task 9）、多重リクエスト抑制（Task 9 の `loading`/`children!==null` ガード）✓。※タイムアウトは fetch 既定に委ね、明示実装は本PoCでは省略（spec §4 の「例: 20s」は努力目標。必要なら client に `AbortSignal.timeout` を追加可能）。
- §5 テスト（パーサ純粋関数・util・client DI・loader Fake）→ Task 2/3/4/5/6 ✓
- §6 UI（ナビ・routes同期・ツリー・詳細パネル・コピー・トークン）→ Task 8/9 ✓
- §7 受け入れ条件 → Task 10 手動確認で網羅 ✓

**2. Placeholder scan:** 各コード手順に実コードを記載済み。「適切なエラー処理」等の曖昧表現なし。

**3. Type consistency:** `loadTreeChildren`/`loadDocumentDetail`/`fetchTreeChildren`/`fetchDocumentDetail` の引数・戻り値、`TreeChild`/`DocumentNode`/`DocumentDetail`/`DocumentFile` の各プロパティ名はタスク間で一致。`createDiscussCabinetClient` / `DiscussCabinetClient` のメソッド名（`fetchFolderList`/`fetchDocView`）一致。`DiscussCabinetParseError` は Task 2 で定義、Task 3 で re-import。
