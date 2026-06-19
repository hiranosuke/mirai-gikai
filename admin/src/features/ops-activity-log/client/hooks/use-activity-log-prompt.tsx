"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import type { OpsActivityType } from "@/features/ops-activity-log/shared/types";
import { ActivityLogPromptDialog } from "../components/activity-log-prompt-dialog";
import { useActivityTimer } from "./use-activity-timer";

/**
 * 編集ページの保存成功後に、計測時間の記録確認ダイアログを開くための hook。
 * promptAfterSave() を保存成功時に呼び、返り値の dialog をフォーム JSX に描画する。
 */
export function useActivityLogPrompt(params: {
  billId: string;
  defaultActivityType: OpsActivityType;
}): { promptAfterSave: () => void; dialog: ReactNode } {
  const { billId, defaultActivityType } = params;
  const { getElapsedMs, reset } = useActivityTimer();
  const [open, setOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const promptAfterSave = useCallback(() => {
    setElapsedMs(getElapsedMs());
    setOpen(true);
  }, [getElapsedMs]);

  const handleRecorded = useCallback(() => {
    reset();
    setOpen(false);
  }, [reset]);

  const dialog = (
    <ActivityLogPromptDialog
      open={open}
      onOpenChange={setOpen}
      billId={billId}
      elapsedMs={elapsedMs}
      defaultActivityType={defaultActivityType}
      onRecorded={handleRecorded}
    />
  );

  return { promptAfterSave, dialog };
}
