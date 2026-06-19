import "server-only";

import type {
  BillLogGroup,
  BillOption,
  OpsActivityLogListItem,
} from "../../shared/types";
import { groupLogsByBill } from "../../shared/utils/aggregate-logs";
import {
  findAllOpsActivityLogs,
  findBillOptions,
} from "../repositories/ops-activity-log-repository";

export type OpsActivityLogPageData = {
  groups: BillLogGroup[];
  billOptions: BillOption[];
};

export async function loadOpsActivityLogs(): Promise<OpsActivityLogPageData> {
  const [logs, billOptions] = await Promise.all([
    findAllOpsActivityLogs(),
    findBillOptions(),
  ]);

  const items: OpsActivityLogListItem[] = (logs ?? []).map((log) => ({
    id: log.id,
    bill_id: log.bill_id,
    activity_type: log.activity_type,
    minutes: log.minutes,
    note: log.note,
    occurred_on: log.occurred_on,
    created_at: log.created_at,
    updated_at: log.updated_at,
    bill_name: log.bills?.name ?? null,
  }));

  return {
    groups: groupLogsByBill(items),
    billOptions: (billOptions ?? []).map((b) => ({ id: b.id, name: b.name })),
  };
}
