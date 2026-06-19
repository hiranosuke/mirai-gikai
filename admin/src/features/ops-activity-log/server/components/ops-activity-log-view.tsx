import "server-only";

import { OpsActivityLogDeleteButton } from "../../client/components/ops-activity-log-delete-button";
import type { BillLogGroup } from "../../shared/types";
import { getActivityTypeLabel } from "../../shared/utils/activity-type-labels";
import { formatMinutes } from "../../shared/utils/format-minutes";

export function OpsActivityLogView({ groups }: { groups: BillLogGroup[] }) {
  return (
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
  );
}
