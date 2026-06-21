import { describe, expect, it } from "vitest";
import { isValidCalendarDate } from "./is-valid-calendar-date";

describe("isValidCalendarDate", () => {
  it("実在する日付は true", () => {
    expect(isValidCalendarDate("2026-06-03")).toBe(true);
    expect(isValidCalendarDate("2024-02-29")).toBe(true); // 閏年
  });

  it("書式が不正な場合は false", () => {
    expect(isValidCalendarDate("2026/06/03")).toBe(false);
    expect(isValidCalendarDate("2026-6-3")).toBe(false);
    expect(isValidCalendarDate("")).toBe(false);
    expect(isValidCalendarDate("abc")).toBe(false);
  });

  it("書式は合っていても存在しない暦日は false", () => {
    expect(isValidCalendarDate("2026-02-31")).toBe(false);
    expect(isValidCalendarDate("2026-13-01")).toBe(false);
    expect(isValidCalendarDate("2026-00-10")).toBe(false);
    expect(isValidCalendarDate("2025-02-29")).toBe(false); // 平年
  });
});
