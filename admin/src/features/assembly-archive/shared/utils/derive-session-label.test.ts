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
      deriveSessionLabel(
        "/委員会/令和8年/予算委員会/6月定例会/予算委員会要求資料/"
      )
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
