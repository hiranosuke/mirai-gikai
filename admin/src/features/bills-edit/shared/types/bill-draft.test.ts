import { describe, expect, it } from "vitest";
import { billDraftSchema } from "./bill-draft";

describe("billDraftSchema", () => {
  it("nameのみで作成できる（他はデフォルト）", () => {
    const result = billDraftSchema.safeParse({ name: "令和8年度補正予算" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("preparing");
    expect(result.data.originating_house).toBe("HR");
    expect(result.data.is_featured).toBe(false);
    expect(result.data.is_review_completed).toBe(false);
  });

  it("billId付きで更新用としてパースできる", () => {
    const uuid = "12345678-1234-4234-a234-123456789abc";
    const result = billDraftSchema.safeParse({
      billId: uuid,
      name: "テスト議案",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.billId).toBe(uuid);
  });

  it("contentsを含む典型的なAI生成JSONをパースできる", () => {
    const input = {
      name: "令和8年度補正予算（第1号）",
      status: "preparing",
      submitted_date: "2026-06-03",
      slug: "2026-r8-hosei1",
      knowledge_source: "本文テキスト...",
      contents: {
        normal: {
          title: "補正予算について",
          summary: "概要",
          content: "詳細...",
        },
        hard: {
          title: "一般会計補正予算",
          summary: "詳細概要",
          content: "詳細...",
        },
      },
    };
    const result = billDraftSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("nameが空文字の場合はエラー", () => {
    const result = billDraftSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("billIdが不正なUUIDの場合はエラー", () => {
    const result = billDraftSchema.safeParse({
      billId: "not-a-uuid",
      name: "テスト",
    });
    expect(result.success).toBe(false);
  });

  it("submitted_dateがYYYY-MM-DD以外の場合はエラー", () => {
    const result = billDraftSchema.safeParse({
      name: "テスト",
      submitted_date: "2026/06/03",
    });
    expect(result.success).toBe(false);
  });

  it("submitted_dateが書式は正しくても存在しない暦日の場合はエラー", () => {
    const result = billDraftSchema.safeParse({
      name: "テスト",
      submitted_date: "2026-02-31",
    });
    expect(result.success).toBe(false);
  });

  it("tagIdsは任意でUUID配列", () => {
    const result = billDraftSchema.safeParse({
      name: "テスト",
      tagIds: [
        "12345678-1234-4234-a234-000000000001",
        "12345678-1234-4234-a234-000000000002",
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tagIds).toHaveLength(2);
  });

  it("tagIdsに不正な文字列が含まれる場合はエラー", () => {
    const result = billDraftSchema.safeParse({
      name: "テスト",
      tagIds: ["not-a-valid-uuid"],
    });
    expect(result.success).toBe(false);
  });
});
