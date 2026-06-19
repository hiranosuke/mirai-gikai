import { describe, expect, it } from "vitest";
import { sumActiveMs } from "./sum-active-ms";

describe("sumActiveMs", () => {
  it("空配列は0", () => {
    expect(sumActiveMs([])).toBe(0);
  });
  it("単一区間の差分を返す", () => {
    expect(sumActiveMs([{ start: 0, end: 1000 }])).toBe(1000);
  });
  it("複数区間を合計する", () => {
    expect(
      sumActiveMs([
        { start: 0, end: 1000 },
        { start: 2000, end: 2500 },
      ])
    ).toBe(1500);
  });
  it("終了が開始より前の異常区間は0として扱う", () => {
    expect(sumActiveMs([{ start: 1000, end: 500 }])).toBe(0);
  });
});
