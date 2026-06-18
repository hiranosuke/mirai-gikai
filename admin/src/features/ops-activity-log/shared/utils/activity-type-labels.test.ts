import { describe, expect, it } from "vitest";
import type { OpsActivityType } from "../types";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ORDER,
  getActivityTypeLabel,
} from "./activity-type-labels";

describe("ACTIVITY_TYPE_ORDER / ACTIVITY_TYPE_LABELS", () => {
  it("全種別を重複なく含む", () => {
    const expected: OpsActivityType[] = [
      "selection",
      "content",
      "interview_config",
      "review",
      "other",
    ];
    expect(ACTIVITY_TYPE_ORDER).toEqual(expected);
    expect(new Set(ACTIVITY_TYPE_ORDER).size).toBe(ACTIVITY_TYPE_ORDER.length);
  });

  it("順序の全種別にラベルが定義されている", () => {
    for (const type of ACTIVITY_TYPE_ORDER) {
      expect(ACTIVITY_TYPE_LABELS[type]).toBeTruthy();
    }
  });
});

describe("getActivityTypeLabel", () => {
  it("各種別に対応する日本語ラベルを返す", () => {
    expect(getActivityTypeLabel("selection")).toBe("議案選定");
    expect(getActivityTypeLabel("content")).toBe("コンテンツ作成");
    expect(getActivityTypeLabel("interview_config")).toBe("インタビュー設定");
    expect(getActivityTypeLabel("review")).toBe("レビュー・公開");
    expect(getActivityTypeLabel("other")).toBe("その他");
  });
});
