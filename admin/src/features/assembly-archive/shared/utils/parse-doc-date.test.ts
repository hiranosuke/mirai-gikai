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

  it("実在しない日付（月末・閏年）は null", () => {
    expect(parseDocDate("2026/02/31")).toBeNull(); // 2月31日は存在しない
    expect(parseDocDate("2026/04/31")).toBeNull(); // 4月は30日まで
    expect(parseDocDate("2025/02/29")).toBeNull(); // 非閏年の2月29日
  });

  it("閏年の2月29日は有効", () => {
    expect(parseDocDate("2024/02/29")).toBe("2024-02-29");
  });
});
