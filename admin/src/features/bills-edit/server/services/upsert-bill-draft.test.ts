import { describe, expect, it, vi } from "vitest";

const CREATED_ID = "12345678-0000-4000-a000-000000000001";

const mocks = vi.hoisted(() => ({
  createBillRecord: vi
    .fn()
    .mockResolvedValue({ id: "12345678-0000-4000-a000-000000000001" }),
  updateBillRecord: vi.fn().mockResolvedValue(undefined),
  upsertBillContent: vi.fn().mockResolvedValue(undefined),
  findBillsTagsByBillId: vi.fn().mockResolvedValue([]),
  deleteBillsTags: vi.fn().mockResolvedValue(undefined),
  createBillsTags: vi.fn().mockResolvedValue(undefined),
  invalidateWebCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/cache-invalidation", () => ({
  invalidateWebCache: mocks.invalidateWebCache,
  WEB_CACHE_TAGS: { BILLS: "bills" },
}));
vi.mock(
  "@/features/bills-edit/server/repositories/bill-edit-repository",
  () => ({
    createBillRecord: mocks.createBillRecord,
    updateBillRecord: mocks.updateBillRecord,
    upsertBillContent: mocks.upsertBillContent,
    findBillsTagsByBillId: mocks.findBillsTagsByBillId,
    deleteBillsTags: mocks.deleteBillsTags,
    createBillsTags: mocks.createBillsTags,
  })
);
vi.mock("@/lib/utils/calculate-set-diff", () => ({
  calculateSetDiff: (existing: string[], next: string[]) => ({
    toAdd: next.filter((id) => !existing.includes(id)),
    toDelete: existing.filter((id) => !next.includes(id)),
  }),
}));

import { upsertBillFromDraft } from "./upsert-bill-draft";

const BASE_INPUT = {
  name: "テスト議案",
  status: "preparing" as const,
  originating_house: "HR" as const,
  is_featured: false,
  is_review_completed: false,
  use_knowledge_source_in_chat: false,
};

describe("upsertBillFromDraft", () => {
  it("billIdなし: createBillRecordを呼び created=true を返す", async () => {
    mocks.createBillRecord.mockClear();
    mocks.updateBillRecord.mockClear();
    const result = await upsertBillFromDraft(BASE_INPUT);
    expect(mocks.createBillRecord).toHaveBeenCalledWith(
      expect.objectContaining({ name: "テスト議案" })
    );
    expect(mocks.updateBillRecord).not.toHaveBeenCalled();
    expect(result.created).toBe(true);
    expect(result.billId).toBe(CREATED_ID);
  });

  it("billIdあり: updateBillRecordを呼び created=false を返す", async () => {
    mocks.createBillRecord.mockClear();
    mocks.updateBillRecord.mockClear();
    const existingId = "12345678-0000-4000-a000-000000000002";
    const result = await upsertBillFromDraft({
      ...BASE_INPUT,
      billId: existingId,
    });
    expect(mocks.updateBillRecord).toHaveBeenCalledWith(
      existingId,
      expect.objectContaining({ name: "テスト議案" })
    );
    expect(mocks.createBillRecord).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.billId).toBe(existingId);
  });

  it("contents指定: upsertBillContentを各difficultyで呼ぶ", async () => {
    mocks.upsertBillContent.mockClear();
    await upsertBillFromDraft({
      ...BASE_INPUT,
      contents: {
        normal: { title: "ふつうタイトル", summary: "要約", content: "本文" },
        hard: { title: "難しいタイトル", summary: "要約", content: "本文" },
      },
    });
    expect(mocks.upsertBillContent).toHaveBeenCalledTimes(2);
    expect(mocks.upsertBillContent).toHaveBeenCalledWith(
      expect.objectContaining({ difficultyLevel: "normal" })
    );
    expect(mocks.upsertBillContent).toHaveBeenCalledWith(
      expect.objectContaining({ difficultyLevel: "hard" })
    );
  });

  it("contentsが全空文字のdifficultyはスキップ", async () => {
    mocks.upsertBillContent.mockClear();
    await upsertBillFromDraft({
      ...BASE_INPUT,
      contents: {
        normal: { title: "", summary: "", content: "" },
        hard: { title: "難しいタイトル", summary: "要約", content: "本文" },
      },
    });
    expect(mocks.upsertBillContent).toHaveBeenCalledTimes(1);
    expect(mocks.upsertBillContent).toHaveBeenCalledWith(
      expect.objectContaining({ difficultyLevel: "hard" })
    );
  });

  it("tagIds指定: タグを差分更新する", async () => {
    mocks.deleteBillsTags.mockClear();
    mocks.createBillsTags.mockClear();
    const existingTag = "12345678-0000-4000-a000-000000000010";
    const newTag = "12345678-0000-4000-a000-000000000020";
    mocks.findBillsTagsByBillId.mockResolvedValueOnce([existingTag]);

    await upsertBillFromDraft({ ...BASE_INPUT, tagIds: [newTag] });
    expect(mocks.deleteBillsTags).toHaveBeenCalledWith(expect.any(String), [
      existingTag,
    ]);
    expect(mocks.createBillsTags).toHaveBeenCalledWith(expect.any(String), [
      newTag,
    ]);
  });

  it("tagIds未指定: タグ操作をスキップ", async () => {
    mocks.findBillsTagsByBillId.mockClear();
    await upsertBillFromDraft(BASE_INPUT);
    expect(mocks.findBillsTagsByBillId).not.toHaveBeenCalled();
  });

  it("submitted_dateをISO形式に変換して渡す", async () => {
    mocks.createBillRecord.mockClear();
    await upsertBillFromDraft({ ...BASE_INPUT, submitted_date: "2026-06-03" });
    expect(mocks.createBillRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        submitted_date: "2026-06-03T00:00:00+09:00",
      })
    );
  });
});
