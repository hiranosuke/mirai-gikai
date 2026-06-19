import { describe, expect, it } from "vitest";
import { formatMinutes, minutesToHours } from "./format-minutes";

describe("formatMinutes", () => {
  it("60分未満は「N分」", () => {
    expect(formatMinutes(45)).toBe("45分");
  });
  it("ちょうど時間は「N時間」", () => {
    expect(formatMinutes(120)).toBe("2時間");
  });
  it("時間+分は「N時間M分」", () => {
    expect(formatMinutes(90)).toBe("1時間30分");
  });
  it("0は「0分」", () => {
    expect(formatMinutes(0)).toBe("0分");
  });
});

describe("minutesToHours", () => {
  it("小数第1位に丸める", () => {
    expect(minutesToHours(90)).toBe(1.5);
    expect(minutesToHours(100)).toBe(1.7);
  });
});
