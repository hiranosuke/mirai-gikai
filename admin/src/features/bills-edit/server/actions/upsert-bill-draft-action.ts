"use server";

import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import { billDraftSchema } from "../../shared/types/bill-draft";
import { upsertBillFromDraft } from "../services/upsert-bill-draft";

export type UpsertBillDraftActionResult =
  | { ok: true; billId: string; created: boolean }
  | { ok: false; error: string };

export async function upsertBillDraftAction(
  rawInput: unknown
): Promise<UpsertBillDraftActionResult> {
  try {
    await requireAdmin();

    const parsed = billDraftSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      };
    }

    const result = await upsertBillFromDraft(parsed.data);
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error, "議案の保存中にエラーが発生しました"),
    };
  }
}
