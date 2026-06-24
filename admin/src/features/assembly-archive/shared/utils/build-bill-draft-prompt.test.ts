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
      {
        doc: doc({ docid: 456, title: "議案 第1号" }),
        fileId: 789,
        fileName: "a.pdf",
      },
      {
        doc: doc({
          docid: 457,
          title: "委員会報告",
          cabinetId: 2,
          folderId: 124,
        }),
        fileId: 791,
        fileName: "b.pdf",
      },
    ]);
    const idx1 = result.indexOf("議案 第1号（docid: 456）");
    const idx2 = result.indexOf("委員会報告（docid: 457）");
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(idx1);
  });
});
