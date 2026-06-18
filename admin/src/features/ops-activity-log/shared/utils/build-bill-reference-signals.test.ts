import { describe, expect, it } from "vitest";
import { buildBillReferenceSignals } from "./build-bill-reference-signals";

const bills = [
  { id: "bill-1", name: "議案A", published_at: "2026-06-10T00:00:00Z" },
  { id: "bill-2", name: "議案B", published_at: null },
];

describe("buildBillReferenceSignals", () => {
  it("bill_contents の min(created)→max(updated) を時間に換算する", () => {
    const contents = [
      {
        bill_id: "bill-1",
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T02:00:00Z",
      },
      {
        bill_id: "bill-1",
        created_at: "2026-06-01T01:00:00Z",
        updated_at: "2026-06-01T03:00:00Z",
      },
    ];
    const signals = buildBillReferenceSignals(bills, contents, []);
    const a = signals.find((s) => s.bill_id === "bill-1");
    expect(a?.content_span_hours).toBe(3); // 00:00 → 03:00
    expect(a?.content_count).toBe(2);
  });

  it("interview_configs の経過時間を換算する", () => {
    const configs = [
      {
        bill_id: "bill-2",
        created_at: "2026-06-02T00:00:00Z",
        updated_at: "2026-06-02T00:30:00Z",
      },
    ];
    const signals = buildBillReferenceSignals(bills, [], configs);
    const b = signals.find((s) => s.bill_id === "bill-2");
    expect(b?.interview_config_span_hours).toBe(0.5);
  });

  it("信号がない議案は null/0 を返す", () => {
    const signals = buildBillReferenceSignals(bills, [], []);
    const b = signals.find((s) => s.bill_id === "bill-2");
    expect(b?.content_span_hours).toBeNull();
    expect(b?.content_count).toBe(0);
    expect(b?.interview_config_span_hours).toBeNull();
    expect(b?.published_at).toBeNull();
  });
});
