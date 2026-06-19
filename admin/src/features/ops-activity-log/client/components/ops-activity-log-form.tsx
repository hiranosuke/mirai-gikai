"use client";

import type { FormEvent } from "react";
import { useId, useState } from "react";
import { toast } from "sonner";
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
import { createOpsActivityLog } from "../../server/actions/create-ops-activity-log";
import type { BillOption, OpsActivityType } from "../../shared/types";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ORDER,
} from "../../shared/utils/activity-type-labels";

const NO_BILL = "__none__";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OpsActivityLogForm({ bills }: { bills: BillOption[] }) {
  const billId = useId();
  const typeId = useId();
  const minutesId = useId();
  const dateId = useId();
  const noteId = useId();

  const [bill, setBill] = useState<string>(NO_BILL);
  const [activityType, setActivityType] = useState<OpsActivityType>("content");
  const [minutes, setMinutes] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayString());
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const minutesNum = Number(minutes);
    if (!Number.isInteger(minutesNum) || minutesNum <= 0) {
      toast.error("作業時間は1分以上の整数で入力してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOpsActivityLog({
        bill_id: bill === NO_BILL ? null : bill,
        activity_type: activityType,
        minutes: minutesNum,
        note: note.trim() === "" ? null : note.trim(),
        occurred_on: occurredOn,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("作業ログを追加しました");
        setMinutes("");
        setNote("");
      }
    } catch (error) {
      console.error("Create ops activity log error:", error);
      toast.error("作業ログの追加に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={billId}>議案（任意）</Label>
          <Select value={bill} onValueChange={setBill}>
            <SelectTrigger id={billId}>
              <SelectValue placeholder="議案を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_BILL}>議案に紐づかない作業</SelectItem>
              {bills.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={typeId}>作業種別</Label>
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

        <div className="space-y-2">
          <Label htmlFor={minutesId}>作業時間（分）</Label>
          <Input
            id={minutesId}
            type="number"
            min={1}
            step={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="例: 90"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={dateId}>作業日</Label>
          <Input
            id={dateId}
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={noteId}>メモ（任意・ボトルネック等）</Label>
        <Input
          id={noteId}
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="詰まったポイントなど"
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "追加中..." : "作業ログを追加"}
      </Button>
    </form>
  );
}
