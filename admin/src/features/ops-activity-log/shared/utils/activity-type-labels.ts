import type { OpsActivityType } from "../types";

/** 表示順（フォームの選択肢・集計の列順に使う） */
export const ACTIVITY_TYPE_ORDER: OpsActivityType[] = [
  "selection",
  "content",
  "interview_config",
  "review",
  "other",
];

export const ACTIVITY_TYPE_LABELS: Record<OpsActivityType, string> = {
  selection: "議案選定",
  content: "コンテンツ作成",
  interview_config: "インタビュー設定",
  review: "レビュー・公開",
  other: "その他",
};

export function getActivityTypeLabel(type: OpsActivityType): string {
  return ACTIVITY_TYPE_LABELS[type];
}
