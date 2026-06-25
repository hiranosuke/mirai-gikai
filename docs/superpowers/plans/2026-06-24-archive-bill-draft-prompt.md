# 議会資料ツリーから議案ドラフト生成プロンプトを作る機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** admin の議会資料ツリーにファイル単位のチェックボックスを追加し、選択した PDF を参照する議案ドラフト生成プロンプトをクリップボードにコピーできるようにする。コピー先の Claude Code は専用スキルに従い DiscussCabinet から PDF を直接取得して議案を MCP 登録する。

**Architecture:** 既存の `assembly-archive` feature（admin）を拡張する。選択状態は `ArchiveBrowser`（Client Component）が `Map` で保持し、`ArchiveTree` にトグル関数を props で渡す。プロンプト生成と選択状態の導出は純粋関数に切り出してユニットテストする。Claude Code 側の処理手順は `.claude/skills/bill-draft-from-archive/SKILL.md` に定義する。

**Tech Stack:** Next.js (App Router) / React Client Components / TypeScript / Radix Checkbox (`@/components/ui/checkbox`) / lucide-react / Vitest / Biome

## Global Constraints

- 作業ベースは `poc/saitama-mirai-gikai`。本 worktree は `poc/archive-bill-draft-prompt`。
- インライン SVG 禁止 → `lucide-react`。素の `<button>` 禁止 → `@/components/ui/button` の `Button`。
- インラインカラーコード禁止 → `globals.css` のカラートークンのみ（`text-muted-foreground` 等）。
- ファイル名はローワーハイフン、コンポーネントは PascalCase、関数は camelCase。
- Biome: 2スペース・LF・ダブルクォート・セミコロン・80文字幅。
- 純粋関数は `shared/utils/` に置き、同階層に `*.test.ts` 必須。
- export 用 `index.ts` は作らず直接 import。
- push 前にローカルで `corepack pnpm --filter admin lint && corepack pnpm --filter admin typecheck && corepack pnpm --filter admin test` を通すこと（PoC は CI なし）。
- コミットメッセージは短い命令形（日本語可）。末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## File Structure

| ファイル | 責務 | 種別 |
|---|---|---|
| `admin/src/features/assembly-archive/shared/types/index.ts` | `SelectedFile` 型を追加 | 変更 |
| `admin/src/features/assembly-archive/shared/utils/derive-doc-check-state.ts` | 配下ファイルの選択状況からドキュメントチェック状態（all/partial/none）を導出する純粋関数 | 新規 |
| `admin/src/features/assembly-archive/shared/utils/derive-doc-check-state.test.ts` | 上のテスト | 新規 |
| `admin/src/features/assembly-archive/shared/utils/build-bill-draft-prompt.ts` | 選択ファイル配列から議案ドラフト生成プロンプト文字列を組み立てる純粋関数 | 新規 |
| `admin/src/features/assembly-archive/shared/utils/build-bill-draft-prompt.test.ts` | 上のテスト | 新規 |
| `admin/src/features/assembly-archive/client/components/archive-tree.tsx` | DocumentRow を DocumentItem + FileRow に拡張（展開でファイル一覧取得・チェックボックス） | 変更 |
| `admin/src/features/assembly-archive/client/components/archive-browser.tsx` | 選択状態を Map で保持し PromptPanel を表示 | 変更 |
| `admin/src/features/assembly-archive/client/components/prompt-panel.tsx` | 選択件数表示・コピー・クリア | 新規 |
| `.claude/skills/bill-draft-from-archive/SKILL.md` | Claude Code の処理手順定義 | 新規 |

---

### Task 1: `SelectedFile` 型を追加

**Files:**
- Modify: `admin/src/features/assembly-archive/shared/types/index.ts`

**Interfaces:**
- Produces: `SelectedFile` 型（`{ doc: DocumentNode; fileId: number; fileName: string }`）。後続の全タスクで使う。

- [ ] **Step 1: 型を追加**

`admin/src/features/assembly-archive/shared/types/index.ts` の末尾に追記する（既存の `DocumentNode` / `DocumentFile` 型はそのまま利用）:

```typescript
export type SelectedFile = {
  doc: DocumentNode;
  fileId: number;
  fileName: string;
};
```

- [ ] **Step 2: typecheck**

Run: `corepack pnpm --filter admin typecheck`
Expected: PASS（型エラーなし）

- [ ] **Step 3: Commit**

```bash
git add admin/src/features/assembly-archive/shared/types/index.ts
git commit -m "feat(admin): 議会資料の選択ファイル型 SelectedFile を追加"
```

---

### Task 2: ドキュメントチェック状態の導出（純粋関数）

ファイル単位の選択集合から、ドキュメント行のチェックボックス状態を導出する。
Radix Checkbox の `checked` は `boolean | "indeterminate"` を受けるため、それに合わせる。

**Files:**
- Create: `admin/src/features/assembly-archive/shared/utils/derive-doc-check-state.ts`
- Test: `admin/src/features/assembly-archive/shared/utils/derive-doc-check-state.test.ts`

**Interfaces:**
- Produces: `deriveDocCheckState(totalFiles: number, selectedCount: number): boolean | "indeterminate"`
  - selectedCount === 0 → `false`
  - 0 < selectedCount < totalFiles → `"indeterminate"`
  - selectedCount === totalFiles（かつ totalFiles > 0）→ `true`
  - totalFiles === 0 → `false`

- [ ] **Step 1: Write the failing test**

`admin/src/features/assembly-archive/shared/utils/derive-doc-check-state.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { deriveDocCheckState } from "./derive-doc-check-state";

describe("deriveDocCheckState", () => {
  it("1件も選択されていなければ false", () => {
    expect(deriveDocCheckState(3, 0)).toBe(false);
  });

  it("一部だけ選択されていれば indeterminate", () => {
    expect(deriveDocCheckState(3, 1)).toBe("indeterminate");
    expect(deriveDocCheckState(3, 2)).toBe("indeterminate");
  });

  it("全件選択されていれば true", () => {
    expect(deriveDocCheckState(3, 3)).toBe(true);
  });

  it("ファイルが0件なら false", () => {
    expect(deriveDocCheckState(0, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter admin test derive-doc-check-state`
Expected: FAIL（`deriveDocCheckState` が未定義）

- [ ] **Step 3: Write minimal implementation**

`admin/src/features/assembly-archive/shared/utils/derive-doc-check-state.ts`:

```typescript
export function deriveDocCheckState(
  totalFiles: number,
  selectedCount: number
): boolean | "indeterminate" {
  if (totalFiles === 0 || selectedCount === 0) return false;
  if (selectedCount >= totalFiles) return true;
  return "indeterminate";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter admin test derive-doc-check-state`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add admin/src/features/assembly-archive/shared/utils/derive-doc-check-state.ts admin/src/features/assembly-archive/shared/utils/derive-doc-check-state.test.ts
git commit -m "feat(admin): ドキュメントチェック状態の導出関数を追加"
```

---

### Task 3: 議案ドラフト生成プロンプトの組み立て（純粋関数）

選択ファイル配列を docid でグルーピングし、Claude Code 向けプロンプト文字列を作る。

**Files:**
- Create: `admin/src/features/assembly-archive/shared/utils/build-bill-draft-prompt.ts`
- Test: `admin/src/features/assembly-archive/shared/utils/build-bill-draft-prompt.test.ts`

**Interfaces:**
- Consumes: `SelectedFile`（Task 1）
- Produces: `buildBillDraftPrompt(files: SelectedFile[]): string`
  - 同一 `docid` のファイルをグルーピングし、入力順を保った見出し順にする。
  - 各ドキュメント見出しは `### {doc.title}（docid: {docid}）`。
  - 各ファイル行は `- {fileName}  cabinetId={…}  folderId={…}  docid={…}  fileId={…}`。
  - 冒頭に固定の指示文（スキル名 `bill-draft-from-archive` への参照を含む）。

- [ ] **Step 1: Write the failing test**

`admin/src/features/assembly-archive/shared/utils/build-bill-draft-prompt.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { DocumentNode } from "../types";
import { buildBillDraftPrompt } from "./build-bill-draft-prompt";

function doc(overrides: Partial<DocumentNode> = {}): DocumentNode {
  return {
    kind: "document",
    cabinetId: 1,
    folderId: 123,
    docid: 456,
    title: "議案 第1号",
    date: "2026-06-01",
    ...overrides,
  };
}

describe("buildBillDraftPrompt", () => {
  it("冒頭にスキル参照を含む指示文を出力する", () => {
    const result = buildBillDraftPrompt([
      { doc: doc(), fileId: 789, fileName: "議案書.pdf" },
    ]);
    expect(result).toContain("bill-draft-from-archive");
  });

  it("ファイル行に取得パラメータを明記する", () => {
    const result = buildBillDraftPrompt([
      { doc: doc(), fileId: 789, fileName: "議案書.pdf" },
    ]);
    expect(result).toContain(
      "- 議案書.pdf  cabinetId=1  folderId=123  docid=456  fileId=789"
    );
  });

  it("同一docidのファイルを1つの見出しにまとめる", () => {
    const result = buildBillDraftPrompt([
      { doc: doc(), fileId: 789, fileName: "議案書.pdf" },
      { doc: doc(), fileId: 790, fileName: "参考資料.pdf" },
    ]);
    const headingCount = (result.match(/### 議案 第1号（docid: 456）/g) ?? [])
      .length;
    expect(headingCount).toBe(1);
    expect(result).toContain("- 議案書.pdf");
    expect(result).toContain("- 参考資料.pdf");
  });

  it("異なるdocidは別々の見出しを入力順で出力する", () => {
    const result = buildBillDraftPrompt([
      { doc: doc({ docid: 456, title: "議案 第1号" }), fileId: 789, fileName: "a.pdf" },
      { doc: doc({ docid: 457, title: "委員会報告", cabinetId: 2, folderId: 124 }), fileId: 791, fileName: "b.pdf" },
    ]);
    const idx1 = result.indexOf("議案 第1号（docid: 456）");
    const idx2 = result.indexOf("委員会報告（docid: 457）");
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(idx1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter admin test build-bill-draft-prompt`
Expected: FAIL（`buildBillDraftPrompt` が未定義）

- [ ] **Step 3: Write minimal implementation**

`admin/src/features/assembly-archive/shared/utils/build-bill-draft-prompt.ts`:

```typescript
import type { SelectedFile } from "../types";

const INTRO = `以下のさいたま市議会の会議資料PDFを参照して、mirai-gikai の議案ドラフトを作成してください。
\`bill-draft-from-archive\` スキルに従って、DiscussCabinet から各PDFを取得し、議案ドラフトJSONを生成してMCPで登録してください。

## 参照資料
`;

export function buildBillDraftPrompt(files: SelectedFile[]): string {
  const order: number[] = [];
  const groups = new Map<number, SelectedFile[]>();
  for (const file of files) {
    const docid = file.doc.docid;
    if (!groups.has(docid)) {
      groups.set(docid, []);
      order.push(docid);
    }
    groups.get(docid)?.push(file);
  }

  const sections = order.map((docid) => {
    const groupFiles = groups.get(docid) ?? [];
    const { doc } = groupFiles[0];
    const heading = `### ${doc.title}（docid: ${docid}）`;
    const lines = groupFiles.map(
      (f) =>
        `- ${f.fileName}  cabinetId=${f.doc.cabinetId}  folderId=${f.doc.folderId}  docid=${f.doc.docid}  fileId=${f.fileId}`
    );
    return [heading, ...lines].join("\n");
  });

  return `${INTRO}\n${sections.join("\n\n")}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm --filter admin test build-bill-draft-prompt`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add admin/src/features/assembly-archive/shared/utils/build-bill-draft-prompt.ts admin/src/features/assembly-archive/shared/utils/build-bill-draft-prompt.test.ts
git commit -m "feat(admin): 議案ドラフト生成プロンプトの組み立て関数を追加"
```

---

### Task 4: ArchiveTree にファイル選択UIを追加

`DocumentRow` を「展開ボタン＋ドキュメントチェックボックス＋タイトル」の `DocumentItem` に
拡張し、展開時に `fetchDocumentDetail` でファイル一覧を取得して `FileRow`（個別チェックボックス）を表示する。

**Files:**
- Modify: `admin/src/features/assembly-archive/client/components/archive-tree.tsx`

**Interfaces:**
- Consumes: `SelectedFile`（Task 1）, `deriveDocCheckState`（Task 2）, 既存 `fetchDocumentDetail`、`DocumentFile` / `DocumentNode` / `DocumentDetail` 型、`Checkbox`（`@/components/ui/checkbox`）。
- Produces: `ArchiveTree` の props を拡張:
  ```typescript
  type SelectionProps = {
    isFileSelected: (docid: number, fileId: number) => boolean;
    onToggleFile: (file: SelectedFile) => void;
    onToggleAllFiles: (doc: DocumentNode, files: DocumentFile[], selectAll: boolean) => void;
  };
  ```
  これらは `ExpandableFolder` を経由して `DocumentItem` まで伝播させる。

- [ ] **Step 1: 実装を書き換える**

`admin/src/features/assembly-archive/client/components/archive-tree.tsx` を以下に置き換える。
（`ExpandableFolder` は selection props を受け取り子へ渡すよう変更。`DocumentRow` を `DocumentItem` に置換。）

```tsx
"use client";

import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchDocumentDetail } from "@/features/assembly-archive/server/actions/fetch-document-detail";
import { fetchTreeChildren } from "@/features/assembly-archive/server/actions/fetch-tree-children";
import type {
  Cabinet,
  DocumentDetail,
  DocumentFile,
  DocumentNode,
  SelectedFile,
  TreeChild,
} from "@/features/assembly-archive/shared/types";
import { deriveDocCheckState } from "@/features/assembly-archive/shared/utils/derive-doc-check-state";

type SelectionProps = {
  isFileSelected: (docid: number, fileId: number) => boolean;
  onToggleFile: (file: SelectedFile) => void;
  onToggleAllFiles: (
    doc: DocumentNode,
    files: DocumentFile[],
    selectAll: boolean
  ) => void;
};

type ExpandableProps = SelectionProps & {
  label: string;
  cabinetId: number;
  folderId: number;
  move: "cabinet" | "down";
  depth: number;
  onSelectDocument: (doc: DocumentNode) => void;
};

function FileRow({
  doc,
  file,
  depth,
  isFileSelected,
  onToggleFile,
}: {
  doc: DocumentNode;
  file: DocumentFile;
  depth: number;
} & Pick<SelectionProps, "isFileSelected" | "onToggleFile">) {
  return (
    <div
      className="flex items-center gap-2 py-1"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <Checkbox
        checked={isFileSelected(doc.docid, file.fileId)}
        onCheckedChange={() =>
          onToggleFile({ doc, fileId: file.fileId, fileName: file.fileName })
        }
        aria-label={`${file.fileName} を選択`}
      />
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-left text-sm">{file.fileName}</span>
    </div>
  );
}

function DocumentItem({
  doc,
  depth,
  onSelectDocument,
  isFileSelected,
  onToggleFile,
  onToggleAllFiles,
}: {
  doc: DocumentNode;
  depth: number;
  onSelectDocument: (doc: DocumentNode) => void;
} & SelectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadDetail(): Promise<DocumentDetail | null> {
    if (detail !== null) return detail;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDocumentDetail({
        cabinetId: doc.cabinetId,
        folderId: doc.folderId,
        docid: doc.docid,
      });
      if ("error" in result) {
        setError(result.error);
        return null;
      }
      setDetail(result.data);
      return result.data;
    } catch {
      setError("文書の取得に失敗しました");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    await loadDetail();
  }

  async function toggleAll() {
    const data = detail ?? (await loadDetail());
    if (!data) return;
    setExpanded(true);
    const selectedCount = data.files.filter((f) =>
      isFileSelected(doc.docid, f.fileId)
    ).length;
    const selectAll = selectedCount < data.files.length;
    onToggleAllFiles(doc, data.files, selectAll);
  }

  const checkState = detail
    ? deriveDocCheckState(
        detail.files.length,
        detail.files.filter((f) => isFileSelected(doc.docid, f.fileId)).length
      )
    : false;

  return (
    <div>
      <div
        className="flex items-center gap-2"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={toggleExpand}
          aria-label={expanded ? "折りたたむ" : "展開する"}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </Button>
        <Checkbox
          checked={checkState}
          onCheckedChange={toggleAll}
          aria-label={`${doc.title} の全ファイルを選択`}
        />
        <Button
          variant="ghost"
          className="h-auto flex-1 justify-start gap-2 py-1 font-normal"
          onClick={() => onSelectDocument(doc)}
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-left">{doc.title}</span>
        </Button>
        {loading && <Loader2 className="size-4 shrink-0 animate-spin" />}
      </div>
      {expanded && error && (
        <p
          className="py-1 text-sm text-destructive"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          {error}
        </p>
      )}
      {expanded &&
        detail?.files.map((file) => (
          <FileRow
            key={`file-${doc.docid}-${file.fileId}`}
            doc={doc}
            file={file}
            depth={depth + 1}
            isFileSelected={isFileSelected}
            onToggleFile={onToggleFile}
          />
        ))}
    </div>
  );
}

function ExpandableFolder({
  label,
  cabinetId,
  folderId,
  move,
  depth,
  onSelectDocument,
  isFileSelected,
  onToggleFile,
  onToggleAllFiles,
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
    try {
      const result = await fetchTreeChildren({ cabinetId, folderId, move });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setChildren(result.data);
    } catch {
      setError("議会資料の取得に失敗しました");
    } finally {
      setLoading(false);
    }
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
              isFileSelected={isFileSelected}
              onToggleFile={onToggleFile}
              onToggleAllFiles={onToggleAllFiles}
            />
          ) : (
            <DocumentItem
              key={`d-${child.docid}`}
              doc={child}
              depth={depth + 1}
              onSelectDocument={onSelectDocument}
              isFileSelected={isFileSelected}
              onToggleFile={onToggleFile}
              onToggleAllFiles={onToggleAllFiles}
            />
          )
        )}
    </div>
  );
}

export function ArchiveTree({
  cabinets,
  onSelectDocument,
  isFileSelected,
  onToggleFile,
  onToggleAllFiles,
}: {
  cabinets: Cabinet[];
  onSelectDocument: (doc: DocumentNode) => void;
} & SelectionProps) {
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
          isFileSelected={isFileSelected}
          onToggleFile={onToggleFile}
          onToggleAllFiles={onToggleAllFiles}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `corepack pnpm --filter admin typecheck`
Expected: PASS。`ArchiveBrowser`（Task 5 で対応）はまだ新 props を渡していないため、ここで型エラーが出る場合は Task 5 を続けて実施するまでコミットしない。先に Task 5 まで一気に実装してからまとめて typecheck する運用でも可。

- [ ] **Step 3: Commit（Task 5 と合わせて可）**

Task 5 まで完了後にまとめてコミットする。単体でコミットする場合:

```bash
git add admin/src/features/assembly-archive/client/components/archive-tree.tsx
git commit -m "feat(admin): 議会資料ツリーにファイル選択チェックボックスを追加"
```

---

### Task 5: ArchiveBrowser に選択状態と PromptPanel を統合

選択状態（`Map<string, SelectedFile>`、キー `${docid}-${fileId}`）を保持し、`ArchiveTree` に
トグル関数を渡す。1件以上選択時に `PromptPanel` を表示する。

**Files:**
- Modify: `admin/src/features/assembly-archive/client/components/archive-browser.tsx`
- Create: `admin/src/features/assembly-archive/client/components/prompt-panel.tsx`

**Interfaces:**
- Consumes: `SelectedFile`（Task 1）, `ArchiveTree` の新 props（Task 4）, `buildBillDraftPrompt`（Task 3）, `DocumentFile` / `DocumentNode` 型, `Button`。
- Produces: `PromptPanel`（`{ files: SelectedFile[]; onClear: () => void }`）。

- [ ] **Step 1: PromptPanel を作成**

`admin/src/features/assembly-archive/client/components/prompt-panel.tsx`:

```tsx
"use client";

import { ClipboardCopy, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SelectedFile } from "@/features/assembly-archive/shared/types";
import { buildBillDraftPrompt } from "@/features/assembly-archive/shared/utils/build-bill-draft-prompt";

export function PromptPanel({
  files,
  onClear,
}: {
  files: SelectedFile[];
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(buildBillDraftPrompt(files));
    setCopied(true);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-white p-4 md:col-span-2">
      <span className="text-sm font-medium">{files.length}ファイル選択中</span>
      <div className="flex items-center gap-2">
        <Button onClick={copyPrompt}>
          <ClipboardCopy className="size-4" />
          {copied ? "コピーしました" : "プロンプトをコピー"}
        </Button>
        <Button variant="outline" onClick={onClear}>
          <X className="size-4" />
          選択をクリア
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ArchiveBrowser を更新**

`admin/src/features/assembly-archive/client/components/archive-browser.tsx`:

```tsx
"use client";

import { useState } from "react";
import type {
  Cabinet,
  DocumentFile,
  DocumentNode,
  SelectedFile,
} from "@/features/assembly-archive/shared/types";
import { ArchiveTree } from "./archive-tree";
import { DocumentDetailPanel } from "./document-detail-panel";
import { PromptPanel } from "./prompt-panel";

function fileKey(docid: number, fileId: number): string {
  return `${docid}-${fileId}`;
}

export function ArchiveBrowser({ cabinets }: { cabinets: Cabinet[] }) {
  const [selected, setSelected] = useState<DocumentNode | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<
    Map<string, SelectedFile>
  >(new Map());

  function isFileSelected(docid: number, fileId: number): boolean {
    return selectedFiles.has(fileKey(docid, fileId));
  }

  function onToggleFile(file: SelectedFile): void {
    setSelectedFiles((prev) => {
      const next = new Map(prev);
      const key = fileKey(file.doc.docid, file.fileId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, file);
      }
      return next;
    });
  }

  function onToggleAllFiles(
    doc: DocumentNode,
    files: DocumentFile[],
    selectAll: boolean
  ): void {
    setSelectedFiles((prev) => {
      const next = new Map(prev);
      for (const file of files) {
        const key = fileKey(doc.docid, file.fileId);
        if (selectAll) {
          next.set(key, {
            doc,
            fileId: file.fileId,
            fileName: file.fileName,
          });
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  }

  const files = [...selectedFiles.values()];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ArchiveTree
        cabinets={cabinets}
        onSelectDocument={setSelected}
        isFileSelected={isFileSelected}
        onToggleFile={onToggleFile}
        onToggleAllFiles={onToggleAllFiles}
      />
      <DocumentDetailPanel document={selected} />
      {files.length > 0 && (
        <PromptPanel files={files} onClear={() => setSelectedFiles(new Map())} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: typecheck + lint**

Run: `corepack pnpm --filter admin typecheck && corepack pnpm --filter admin lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add admin/src/features/assembly-archive/client/components/archive-tree.tsx admin/src/features/assembly-archive/client/components/archive-browser.tsx admin/src/features/assembly-archive/client/components/prompt-panel.tsx
git commit -m "feat(admin): 選択ファイルから議案ドラフトプロンプトを生成するパネルを追加"
```

---

### Task 6: Claude Code スキル `bill-draft-from-archive` を作成

**Files:**
- Create: `.claude/skills/bill-draft-from-archive/SKILL.md`

**Interfaces:**
- Consumes: なし（ドキュメント）。
- Produces: Claude Code が読むスキル定義。

- [ ] **Step 1: スキルファイルを作成**

`.claude/skills/bill-draft-from-archive/SKILL.md`:

````markdown
---
name: bill-draft-from-archive
description: admin議会資料画面で生成された「議案ドラフト生成プロンプト」を受け取ったときに使う。DiscussCabinetからPDFを直接取得して内容を読み、mirai-gikaiの議案ドラフトJSONを生成してMCPで登録する。
---

# 議会資料PDFから議案ドラフトを生成する

admin の議会資料画面（`/assembly-archive`）で「プロンプトをコピー」して渡された
プロンプトを処理する。プロンプトには参照すべきPDFの取得パラメータ
（cabinetId / folderId / docid / fileId / fileName）がドキュメント単位で列挙されている。

## 処理手順

### 1. PDFを DiscussCabinet から直接取得する

DiscussCabinet（`https://www.discusscabinet.net/saitama`）は公開サーバーだが、
ファイル取得は2段階の POST が必要（GETの直リンク不可）。各 fileId ごとに以下を実行する。

```bash
# a. セッション確立（Cookie保存）。ファイル取得のたびに確立し直す
curl -s -c /tmp/dc_cookies.txt -X POST \
  https://www.discusscabinet.net/saitama/list \
  -H "Content-Type: application/x-www-form-urlencoded" -d ""

# b. PDFダウンロード（cabinet_id/folder_id/docid/fileid をプロンプトの値に置換）
curl -s -b /tmp/dc_cookies.txt -X POST \
  https://www.discusscabinet.net/saitama/file_view \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "userid=&password=&cabinet_id=1&folder_id=123&docid=456&refer=&fileid=789&tmpid=&new_arrival=&order=&start=0&actions=return&filerefer=docview" \
  -o /tmp/archive_456_789.pdf
```

取得後、ファイル先頭が `%PDF` で始まることを確認する（HTMLエラーページが返っていないか）。

### 2. PDFの内容を読む

`Read` ツールで `/tmp/archive_<docid>_<fileId>.pdf` を読み、議案の本文・提出日・
提出者・議決結果などを把握する。

### 3. 議案ドラフトJSONを生成する

`admin/src/features/bills-edit/shared/types/bill-draft.ts` の `billDraftSchema` に従う。
主なフィールド:

- `billId`（省略=新規作成 / UUID指定=既存更新）
- `name`（必須・200文字以内）: 議案名
- `status`: `preparing` / `introduced` / `in_originating_house` / `in_receiving_house` / `enacted` / `rejected`
- `originating_house`: `HR` / `HC`（さいたま市議会は一院制のため通常 `HR`）
- `submitted_date`: `YYYY-MM-DD`
- `status_note`: ステータス備考（任意・500文字以内）
- `diet_session_id`: 会期ID（MCP `list_diet_sessions` で確認）
- `contents.normal` / `contents.hard`: `{ title, summary, content }`（ふつう/難しい）
- `tagIds`: タグUUIDの配列（MCP `list_tags` で確認）

### 4. 会期・タグを確認する

MCPツール `list_diet_sessions`・`list_tags` を呼び、対応する `diet_session_id` と
`tagIds` を決定する。該当が無ければ作成系ツール（`create_bill` 等の周辺ツール）も検討する。

### 5. MCPで登録する

MCPツール `upsert_bill_from_draft` に生成したJSONを渡す。複数議案がある場合は議案ごとに呼ぶ。

## 注意

- PDFの内容を要約・脚色しすぎない。原典に忠実に。固有名詞（個人名）は本文に含めない。
- 生成したJSONは登録前にユーザーに提示し、確認を取ること。
````

- [ ] **Step 2: フォーマット確認**

Run: `head -5 .claude/skills/bill-draft-from-archive/SKILL.md`
Expected: frontmatter（name / description）が正しく表示される。

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/bill-draft-from-archive/SKILL.md
git commit -m "docs(skills): 議会資料PDFから議案ドラフトを生成するスキルを追加"
```

---

### Task 7: 全体検証・PR作成

**Files:** なし（検証とPR）

- [ ] **Step 1: ローカル検証一式**

Run:
```bash
corepack pnpm --filter admin lint
corepack pnpm --filter admin typecheck
corepack pnpm --filter admin test
corepack pnpm --filter admin build
```
Expected: すべて PASS

- [ ] **Step 2: セルフレビュー（CLAUDE.md 必須）**

`/simplify` → `/review` を順に実行し、指摘を修正する。

- [ ] **Step 3: push + PR作成（base=poc）**

```bash
git push -u origin poc/archive-bill-draft-prompt
gh pr create --base poc/saitama-mirai-gikai \
  --title "feat(admin): 議会資料ツリーから議案ドラフト生成プロンプトを作る機能" \
  --body "<スコープ概要・テスト記録・スクショは後続で添付>"
```

- [ ] **Step 4: UI変更のスクリーンショット（CLAUDE.md 必須）**

`/pr-screenshot` スキルを実行する（`archive-tree.tsx` 等 UI 変更を含むため）。

- [ ] **Step 5: PR状態確認（CLAUDE.md 必須）**

`gh pr view <番号> --json mergeable,mergeStateStatus` で conflict 確認、CodeRabbit レビューを待って Minor 以上に対応。

---

## Self-Review

**Spec coverage:**
- ファイル単位チェックボックス → Task 4（FileRow）✓
- ドキュメント全選択 → Task 4（DocumentItem の toggleAll）＋ Task 2（状態導出）✓
- 選択状態管理（Map） → Task 5 ✓
- PromptPanel（件数・コピー・クリア） → Task 5 ✓
- プロンプト生成（純粋関数＋テスト） → Task 3 ✓
- `SelectedFile` 型 → Task 1 ✓
- Claude Code スキル → Task 6 ✓
- タイトルクリックで詳細表示の維持 → Task 4（DocumentItem の onSelectDocument）✓
- 既存 DocumentDetailPanel 不変 → 変更対象外 ✓

**Placeholder scan:** PR本文の `<...>` は実行時に埋める想定で、コード上のプレースホルダはなし。

**Type consistency:** `SelectedFile { doc, fileId, fileName }`、`onToggleAllFiles(doc, files, selectAll)`、`deriveDocCheckState(totalFiles, selectedCount)`、`buildBillDraftPrompt(files)` は Task 1〜5 で一貫。`fetchDocumentDetail` の戻り値 `{ data: DocumentDetail } | { error }` と `DocumentDetail.files: DocumentFile[]` は既存実装に準拠。
