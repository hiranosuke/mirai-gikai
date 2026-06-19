import { describe, expect, it } from "vitest";
import { computeElapsedMinutes } from "./compute-elapsed-minutes";

describe("computeElapsedMinutes", () => {
  it("0ms は最低1分", () => {
    expect(computeElapsedMinutes(0)).toBe(1);
  });
  it("1分未満は最低1分に切り上げる", () => {
    expect(computeElapsedMinutes(20_000)).toBe(1);
  });
  it("四捨五入する（1.5分→2分）", () => {
    expect(computeElapsedMinutes(90_000)).toBe(2);
  });
  it("23分相当を23に丸める", () => {
    expect(computeElapsedMinutes(1_380_000)).toBe(23);
  });
});
