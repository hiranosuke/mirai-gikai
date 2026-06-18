import type { BillReferenceSignal } from "../types";

type BillRow = { id: string; name: string; published_at: string | null };
type TimeRow = { bill_id: string; created_at: string; updated_at: string };

/** ミリ秒差を時間（小数第1位）に丸める。 */
function spanHours(minCreated: number, maxUpdated: number): number {
  return Math.round(((maxUpdated - minCreated) / 3_600_000) * 10) / 10;
}

function computeSpan(rows: TimeRow[]): number | null {
  if (rows.length === 0) return null;
  let minCreated = Number.POSITIVE_INFINITY;
  let maxUpdated = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    minCreated = Math.min(minCreated, new Date(row.created_at).getTime());
    maxUpdated = Math.max(maxUpdated, new Date(row.updated_at).getTime());
  }
  return spanHours(minCreated, maxUpdated);
}

/**
 * 議案ごとの参考シグナル（既存タイムスタンプから算出した事実）を組み立てる純粋関数。
 * これらは「着手〜更新のカレンダー経過」であり実作業時間ではない（設計 §1）。
 */
export function buildBillReferenceSignals(
  bills: BillRow[],
  billContents: TimeRow[],
  interviewConfigs: TimeRow[]
): BillReferenceSignal[] {
  return bills.map((bill) => {
    const contents = billContents.filter((c) => c.bill_id === bill.id);
    const configs = interviewConfigs.filter((c) => c.bill_id === bill.id);
    return {
      bill_id: bill.id,
      bill_name: bill.name,
      content_span_hours: computeSpan(contents),
      content_count: contents.length,
      interview_config_span_hours: computeSpan(configs),
      published_at: bill.published_at,
    };
  });
}
