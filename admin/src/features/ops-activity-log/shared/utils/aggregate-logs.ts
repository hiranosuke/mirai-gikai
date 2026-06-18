import type {
  BillLogGroup,
  OpsActivityLogListItem,
  OpsActivityType,
} from "../types";
import { ACTIVITY_TYPE_ORDER } from "./activity-type-labels";

function emptyByType(): Record<OpsActivityType, number> {
  const result = {} as Record<OpsActivityType, number>;
  for (const type of ACTIVITY_TYPE_ORDER) {
    result[type] = 0;
  }
  return result;
}

/** ログを議案ごとに集計する。bill_id が null の作業は1グループにまとめる。 */
export function groupLogsByBill(
  items: OpsActivityLogListItem[]
): BillLogGroup[] {
  const map = new Map<string, BillLogGroup>();

  for (const entry of items) {
    const key = entry.bill_id ?? "__null__";
    let group = map.get(key);
    if (!group) {
      group = {
        bill_id: entry.bill_id,
        bill_name: entry.bill_name,
        total_minutes: 0,
        by_type: emptyByType(),
        entries: [],
      };
      map.set(key, group);
    }
    group.total_minutes += entry.minutes;
    group.by_type[entry.activity_type] += entry.minutes;
    group.entries.push(entry);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.total_minutes - a.total_minutes
  );
}
