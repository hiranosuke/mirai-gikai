export type OpsActivityType =
  | "selection"
  | "content"
  | "interview_config"
  | "review"
  | "other";

/** ops_activity_log の1レコード（DB の Row に対応） */
export type OpsActivityLog = {
  id: string;
  bill_id: string | null;
  activity_type: OpsActivityType;
  minutes: number;
  note: string | null;
  occurred_on: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
};

/** 一覧表示用（議案名を join 済み） */
export type OpsActivityLogListItem = OpsActivityLog & {
  bill_name: string | null;
};

export type CreateOpsActivityLogInput = {
  bill_id: string | null;
  activity_type: OpsActivityType;
  minutes: number;
  note?: string | null;
  occurred_on: string;
};

export type DeleteOpsActivityLogInput = {
  id: string;
};

/** フォームの議案選択肢 */
export type BillOption = {
  id: string;
  name: string;
};

/** 議案ごとに集計したログ */
export type BillLogGroup = {
  bill_id: string | null;
  bill_name: string | null;
  total_minutes: number;
  by_type: Record<OpsActivityType, number>;
  entries: OpsActivityLogListItem[];
};
