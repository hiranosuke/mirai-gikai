import { afterAll, describe, expect, it } from "vitest";
import { adminClient } from "./utils";

/**
 * ops_activity_log の CRUD をローカル Supabase 実接続で検証する。
 * createAdminClient と同じ secret key クライアント（adminClient）を使用。
 */
describe("ops_activity_log repository (integration)", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await adminClient.from("ops_activity_log").delete().in("id", createdIds);
    }
  });

  it("bill_id=null の作業ログを作成・取得・削除できる", async () => {
    const { data: inserted, error: insertError } = await adminClient
      .from("ops_activity_log")
      .insert({
        bill_id: null,
        activity_type: "other",
        minutes: 25,
        note: "統合テスト",
        occurred_on: "2026-06-18",
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(inserted).not.toBeNull();
    if (inserted) createdIds.push(inserted.id);

    const { data: fetched } = await adminClient
      .from("ops_activity_log")
      .select("*")
      .eq("id", inserted?.id ?? "");
    expect(fetched?.[0]?.minutes).toBe(25);

    const { error: deleteError } = await adminClient
      .from("ops_activity_log")
      .delete()
      .eq("id", inserted?.id ?? "");
    expect(deleteError).toBeNull();
  });

  it("minutes <= 0 は CHECK 制約で拒否される", async () => {
    const { error } = await adminClient.from("ops_activity_log").insert({
      bill_id: null,
      activity_type: "other",
      minutes: 0,
      occurred_on: "2026-06-18",
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23514");
  });
});
