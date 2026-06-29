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

  it("月が範囲外なら null", () => {
    expect(parseDocDate("2026/13/01")).toBeNull();
    expect(parseDocDate("2026/00/10")).toBeNull();
  });

  it("日が範囲外なら null", () => {
    expect(parseDocDate("2026/06/32")).toBeNull();
    expect(parseDocDate("2026/06/00")).toBeNull();
  });
});
