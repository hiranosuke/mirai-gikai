import "server-only";

import type {
  BillLogGroup,
  BillOption,
  BillReferenceSignal,
  OpsActivityLogListItem,
} from "../../shared/types";
import { groupLogsByBill } from "../../shared/utils/aggregate-logs";
import { buildBillReferenceSignals } from "../../shared/utils/build-bill-reference-signals";
import {
  findAllOpsActivityLogs,
  findBillContentTimes,
  findBillOptions,
  findBillsForSignals,
  findInterviewConfigTimes,
} from "../repositories/ops-activity-log-repository";

export type OpsActivityLogPageData = {
  groups: BillLogGroup[];
  billOptions: BillOption[];
  referenceSignals: BillReferenceSignal[];
};

export async function loadOpsActivityLogs(): Promise<OpsActivityLogPageData> {
  const [logs, billOptions, bills, contentTimes, configTimes] =
    await Promise.all([
      findAllOpsActivityLogs(),
      findBillOptions(),
      findBillsForSignals(),
      findBillContentTimes(),
      findInterviewConfigTimes(),
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
    referenceSignals: buildBillReferenceSignals(
      bills ?? [],
      contentTimes ?? [],
      configTimes ?? []
    ),
  };
}
