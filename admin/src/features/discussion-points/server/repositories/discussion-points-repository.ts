import "server-only";

import { createAdminClient } from "@mirai-gikai/supabase";
import type { DiscussionPointsInput } from "../../shared/types";

export async function findDiscussionPointsByBillId(billId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("discussion_points")
    .select("*")
    .eq("bill_id", billId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      throw new Error(`Failed to fetch discussion points: ${error.message}`);
    }
    return null;
  }

  return data;
}

export async function createDiscussionPoints(
  billId: string,
  input: DiscussionPointsInput
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("discussion_points").insert({
    bill_id: billId,
    pro_points: input.pro_points || null,
    con_points: input.con_points || null,
  });

  if (error) {
    throw new Error(`Failed to create discussion points: ${error.message}`);
  }
}

export async function updateDiscussionPoints(
  id: string,
  input: DiscussionPointsInput
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("discussion_points")
    .update({
      pro_points: input.pro_points || null,
      con_points: input.con_points || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update discussion points: ${error.message}`);
  }
}

export async function deleteDiscussionPoints(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("discussion_points")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete discussion points: ${error.message}`);
  }
}
