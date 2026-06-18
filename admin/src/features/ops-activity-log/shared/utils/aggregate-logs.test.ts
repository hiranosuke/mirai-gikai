import { describe, expect, it } from "vitest";
import type { OpsActivityLogListItem } from "../types";
import { groupLogsByBill } from "./aggregate-logs";

function item(
  over: Partial<OpsActivityLogListItem> &
    Pick<OpsActivityLogListItem, "id" | "activity_type" | "minutes">
): OpsActivityLogListItem {
  return {
    bill_id: "bill-1",
    bill_name: "議案A",
    note: null,
    occurred_on: "2026-06-18",
    created_at: "2026-06-18T00:00:00Z",
    updated_at: "2026-06-18T00:00:00Z",
    ...over,
  };
}

describe("groupLogsByBill", () => {
  it("議案ごとに合計分と種別内訳を集計する", () => {
    const items: OpsActivityLogListItem[] = [
      item({ id: "1", activity_type: "content", minutes: 60 }),
      item({ id: "2", activity_type: "review", minutes: 30 }),
      item({ id: "3", activity_type: "content", minutes: 20 }),
    ];

    const groups = groupLogsByBill(items);

    expect(groups).toHaveLength(1);
    expect(groups[0].bill_id).toBe("bill-1");
    expect(groups[0].total_minutes).toBe(110);
    expect(groups[0].by_type.content).toBe(80);
    expect(groups[0].by_type.review).toBe(30);
    expect(groups[0].by_type.selection).toBe(0);
    expect(groups[0].entries).toHaveLength(3);
  });

  it("bill_id が null の作業は1グループにまとめる", () => {
    const items: OpsActivityLogListItem[] = [
      item({ id: "1", bill_id: null, bill_name: null, activity_type: "other", minutes: 15 }),
      item({ id: "2", bill_id: "bill-1", bill_name: "議案A", activity_type: "content", minutes: 40 }),
    ];

    const groups = groupLogsByBill(items);

    expect(groups).toHaveLength(2);
    const nullGroup = groups.find((g) => g.bill_id === null);
    expect(nullGroup?.total_minutes).toBe(15);
  });

  it("合計分の降順で並ぶ", () => {
    const items: OpsActivityLogListItem[] = [
      item({ id: "1", bill_id: "a", bill_name: "A", activity_type: "content", minutes: 10 }),
      item({ id: "2", bill_id: "b", bill_name: "B", activity_type: "content", minutes: 50 }),
    ];

    const groups = groupLogsByBill(items);
    expect(groups[0].bill_id).toBe("b");
    expect(groups[1].bill_id).toBe("a");
  });
});
