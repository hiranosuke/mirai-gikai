import { describe, expect, it } from "vitest";
import { mapOpsDbError } from "./map-ops-db-error";

describe("mapOpsDbError", () => {
  it("PGRST116（レコードなし）", () => {
    expect(
      mapOpsDbError({ code: "PGRST116", message: "no rows" }, "削除")
    ).toBe("作業ログが見つかりません");
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
