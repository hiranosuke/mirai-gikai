import { describe, expect, it } from "vitest";
import { createOpsActivityLogSchema } from "./ops-activity-log-schema";

const valid = {
  bill_id: null,
  activity_type: "content" as const,
  minutes: 30,
  note: null,
  occurred_on: "2026-06-18",
};

describe("createOpsActivityLogSchema", () => {
  it("正しい入力を通す", () => {
    expect(createOpsActivityLogSchema.safeParse(valid).success).toBe(true);
  });
  it("minutes が 0 以下を弾く", () => {
    expect(
      createOpsActivityLogSchema.safeParse({ ...valid, minutes: 0 }).success
    ).toBe(false);
  });
  it("minutes が非整数を弾く", () => {
    expect(
      createOpsActivityLogSchema.safeParse({ ...valid, minutes: 1.5 }).success
    ).toBe(false);
  });
  it("未知の activity_type を弾く", () => {
    expect(
      createOpsActivityLogSchema.safeParse({ ...valid, activity_type: "xxx" })
        .success
    ).toBe(false);
  });
  it("occurred_on の形式違反を弾く", () => {
    expect(
      createOpsActivityLogSchema.safeParse({ ...valid, occurred_on: "2026/06/18" })
        .success
    ).toBe(false);
  });
  it("bill_id が UUID 文字列を受け入れる", () => {
    expect(
      createOpsActivityLogSchema.safeParse({
        ...valid,
        bill_id: "00000000-0000-0000-0000-000000000000",
      }).success
    ).toBe(true);
  });
});
