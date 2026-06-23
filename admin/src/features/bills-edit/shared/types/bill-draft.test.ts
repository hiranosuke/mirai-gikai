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

  describe("バリデーションエラーメッセージの日本語化", () => {
    /** 指定パスのissueメッセージを取り出すヘルパー */
    function messageForPath(input: unknown, path: string): string | undefined {
      const result = billDraftSchema.safeParse(input);
      if (result.success) return undefined;
      return result.error.issues.find((i) => i.path.join(".") === path)
        ?.message;
    }

    it("nameが欠落した場合は日本語メッセージ", () => {
      expect(messageForPath({}, "name")).toBe("議案名（name）は必須です");
    });

    it("nameが型違い（数値）の場合は日本語メッセージ", () => {
      expect(messageForPath({ name: 123 }, "name")).toBe(
        "議案名（name）は必須です"
      );
    });

    it("nameが空文字の場合は日本語メッセージ", () => {
      expect(messageForPath({ name: "" }, "name")).toBe(
        "議案名（name）は必須です"
      );
    });

    it("statusが不正な値の場合は日本語メッセージ", () => {
      expect(
        messageForPath({ name: "テスト", status: "unknown" }, "status")
      ).toBe(
        "ステータス（status）は preparing / introduced / in_originating_house / in_receiving_house / enacted / rejected のいずれかで入力してください"
      );
    });

    it("originating_houseが不正な値の場合は日本語メッセージ", () => {
      expect(
        messageForPath(
          { name: "テスト", originating_house: "XX" },
          "originating_house"
        )
      ).toBe("提出院（originating_house）は HR または HC で入力してください");
    });

    it("submitted_dateが型違い（数値）の場合は日本語メッセージ", () => {
      expect(
        messageForPath(
          { name: "テスト", submitted_date: 20260603 },
          "submitted_date"
        )
      ).toBe("提出日（submitted_date）は文字列で入力してください");
    });

    it("submitted_dateが不正な暦日の場合は日本語メッセージ", () => {
      expect(
        messageForPath(
          { name: "テスト", submitted_date: "2026-02-31" },
          "submitted_date"
        )
      ).toBe(
        "提出日（submitted_date）は YYYY-MM-DD 形式の実在する日付で入力してください"
      );
    });

    it("billIdが不正なUUIDの場合は日本語メッセージ", () => {
      expect(
        messageForPath({ name: "テスト", billId: "not-a-uuid" }, "billId")
      ).toBe("billId はUUID形式で入力してください");
    });

    it("is_featuredが型違いの場合は日本語メッセージ", () => {
      expect(
        messageForPath({ name: "テスト", is_featured: "yes" }, "is_featured")
      ).toBe("is_featured は真偽値（true / false）で入力してください");
    });

    it("tagIdsが配列でない場合は日本語メッセージ", () => {
      expect(messageForPath({ name: "テスト", tagIds: "x" }, "tagIds")).toBe(
        "tagIds はUUIDの配列で入力してください"
      );
    });

    it("contents.normal.titleが型違いの場合は日本語メッセージ", () => {
      expect(
        messageForPath(
          { name: "テスト", contents: { normal: { title: 123 } } },
          "contents.normal.title"
        )
      ).toBe("タイトル（title）は文字列で入力してください");
    });
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
