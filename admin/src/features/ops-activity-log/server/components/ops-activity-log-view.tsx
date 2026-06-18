import "server-only";

import { OpsActivityLogDeleteButton } from "../../client/components/ops-activity-log-delete-button";
import type { BillLogGroup, BillReferenceSignal } from "../../shared/types";
import { getActivityTypeLabel } from "../../shared/utils/activity-type-labels";
import { formatMinutes } from "../../shared/utils/format-minutes";

function ReferenceSignals({ signals }: { signals: BillReferenceSignal[] }) {
  const withSignal = signals.filter(
    (s) =>
      s.content_span_hours !== null ||
      s.interview_config_span_hours !== null ||
      s.published_at !== null
  );
  if (withSignal.length === 0) return null;

  return (
    <section className="rounded-lg border bg-white p-6">
      <h2 className="mb-1 text-lg font-semibold">参考: 着手〜更新の経過</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        既存データから算出したカレンダー経過です。実作業時間ではないため、入力の目安としてのみ参照してください。
      </p>
      <ul className="space-y-2 text-sm">
        {withSignal.map((s) => (
          <li key={s.bill_id} className="flex flex-wrap gap-x-4">
            <span className="font-medium">{s.bill_name}</span>
            {s.content_span_hours !== null && (
              <span>
                コンテンツ: 約{s.content_span_hours}時間（{s.content_count}本）
              </span>
            )}
            {s.interview_config_span_hours !== null && (
              <span>設定: 約{s.interview_config_span_hours}時間</span>
            )}
            {s.published_at && <span>公開: {s.published_at.slice(0, 10)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OpsActivityLogView({
  groups,
  referenceSignals,
}: {
  groups: BillLogGroup[];
  referenceSignals: BillReferenceSignal[];
}) {
  return (
    <div className="space-y-8">
      <ReferenceSignals signals={referenceSignals} />

      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">記録一覧（議案別）</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            まだ作業ログがありません。上のフォームから追加してください。
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.bill_id ?? "__null__"}>
                <h3 className="mb-2 font-medium">
                  {group.bill_name ?? "議案に紐づかない作業"}
                  <span className="ml-2 text-sm text-muted-foreground">
                    合計 {formatMinutes(group.total_minutes)}
                  </span>
                </h3>
                <ul className="divide-y">
                  {group.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="flex flex-wrap gap-x-3">
                        <span className="text-muted-foreground">
                          {entry.occurred_on}
                        </span>
                        <span>{getActivityTypeLabel(entry.activity_type)}</span>
                        <span className="font-medium">
                          {formatMinutes(entry.minutes)}
                        </span>
                        {entry.note && (
                          <span className="text-muted-foreground">
                            {entry.note}
                          </span>
                        )}
                      </span>
                      <OpsActivityLogDeleteButton id={entry.id} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
