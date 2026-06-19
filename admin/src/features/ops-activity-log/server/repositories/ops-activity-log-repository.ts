import "server-only";

import { createAdminClient } from "@mirai-gikai/supabase";
import type { CreateOpsActivityLogInput } from "../../shared/types";

/** 全ログを議案名込みで取得（occurred_on 降順）。 */
export async function findAllOpsActivityLogs() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ops_activity_log")
    .select("*, bills(name)")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`作業ログの取得に失敗しました: ${error.message}`);
  }
  return data;
}

/** フォームの議案選択肢（id, name）を取得。 */
export async function findBillOptions() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .select("id, name")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`議案一覧の取得に失敗しました: ${error.message}`);
  }
  return data;
}

export async function createOpsActivityLogRecord(
  input: CreateOpsActivityLogInput
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ops_activity_log")
    .insert({
      bill_id: input.bill_id,
      activity_type: input.activity_type,
      minutes: input.minutes,
      note: input.note ?? null,
      occurred_on: input.occurred_on,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23514" || error.code === "23503") {
      return {
        data: null,
        error: { code: error.code, message: error.message },
      };
    }
    throw new Error(`作業ログの作成に失敗しました: ${error.message}`);
  }
  return { data, error: null };
}

export async function deleteOpsActivityLogRecord(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ops_activity_log")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.code === "PGRST116") {
      return { error: { code: error.code, message: error.message } };
    }
    throw new Error(`作業ログの削除に失敗しました: ${error.message}`);
  }
  return { error: null };
}
