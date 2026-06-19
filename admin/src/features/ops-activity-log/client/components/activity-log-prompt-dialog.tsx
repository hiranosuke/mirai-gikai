"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOpsActivityLog } from "@/features/ops-activity-log/server/actions/create-ops-activity-log";
import type { OpsActivityType } from "@/features/ops-activity-log/shared/types";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ORDER,
} from "@/features/ops-activity-log/shared/utils/activity-type-labels";
import { computeElapsedMinutes } from "../utils/compute-elapsed-minutes";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ActivityLogPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string;
  elapsedMs: number;
  defaultActivityType: OpsActivityType;
  onRecorded: () => void;
}

export function ActivityLogPromptDialog({
  open,
  onOpenChange,
  billId,
  elapsedMs,
  defaultActivityType,
  onRecorded,
}: ActivityLogPromptDialogProps) {
  const minutesId = useId();
  const typeId = useId();
  const noteId = useId();

  const [minutes, setMinutes] = useState("");
  const [activityType, setActivityType] =
    useState<OpsActivityType>(defaultActivityType);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ダイアログを開くたびに、計測値・初期種別で内容を初期化する
  useEffect(() => {
    if (open) {
      setMinutes(String(computeElapsedMinutes(elapsedMs)));
      setActivityType(defaultActivityType);
      setNote("");
    }
  }, [open, elapsedMs, defaultActivityType]);

  const handleRecord = async () => {
    const minutesNum = Number(minutes);
    if (!Number.isInteger(minutesNum) || minutesNum <= 0) {
      toast.error("作業時間は1分以上の整数で入力してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const noteTrimmed = note.trim();
      const result = await createOpsActivityLog({
        bill_id: billId,
        activity_type: activityType,
        minutes: minutesNum,
        note: noteTrimmed === "" ? null : noteTrimmed,
        occurred_on: todayString(),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("作業ログに記録しました");
      onRecorded();
    } catch (error) {
      console.error("Record activity log error:", error);
      toast.error("作業ログの記録に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const measuredMinutes = computeElapsedMinutes(elapsedMs);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>作業ログに記録しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            今回の編集の計測時間: 約 {measuredMinutes} 分
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor={minutesId}>作業時間（分）</Label>
              <Input
                id={minutesId}
                type="number"
                min={1}
                step={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor={typeId}>種別</Label>
              <Select
                value={activityType}
                onValueChange={(v) => setActivityType(v as OpsActivityType)}
              >
                <SelectTrigger id={typeId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPE_ORDER.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ACTIVITY_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={noteId}>メモ（任意）</Label>
            <Input
              id={noteId}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="詰まったポイントなど"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            記録しない
          </Button>
          <Button type="button" onClick={handleRecord} disabled={isSubmitting}>
            {isSubmitting ? "記録中..." : "記録する"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
