import { OpsActivityLogForm } from "@/features/ops-activity-log/client/components/ops-activity-log-form";
import { OpsActivityLogView } from "@/features/ops-activity-log/server/components/ops-activity-log-view";
import { loadOpsActivityLogs } from "@/features/ops-activity-log/server/loaders/load-ops-activity-logs";

export default async function OpsActivityLogPage() {
  const { groups, billOptions, referenceSignals } =
    await loadOpsActivityLogs();

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-2 text-2xl font-bold">作業ログ</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        議案を公開状態にするまでの作業時間を記録します。PoC の労力実測に使います。
      </p>

      <section className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">作業を記録</h2>
        <OpsActivityLogForm bills={billOptions} />
      </section>

      <OpsActivityLogView groups={groups} referenceSignals={referenceSignals} />
    </div>
  );
}
