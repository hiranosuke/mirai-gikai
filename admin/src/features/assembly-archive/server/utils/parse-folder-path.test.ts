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
