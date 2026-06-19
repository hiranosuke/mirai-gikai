"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { routes } from "@/lib/routes";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import type { DeleteOpsActivityLogInput } from "../../shared/types";
import { mapOpsDbError } from "../../shared/utils/map-ops-db-error";
import { deleteOpsActivityLogRecord } from "../repositories/ops-activity-log-repository";

export async function deleteOpsActivityLog(input: DeleteOpsActivityLogInput) {
  try {
    await requireAdmin();

    const result = await deleteOpsActivityLogRecord(input.id);
    if (result.error) {
      return { error: mapOpsDbError(result.error, "削除") };
    }

    revalidatePath(routes.opsActivityLog());
    return { success: true };
  } catch (error) {
    console.error("Delete ops activity log error:", error);
    return {
      error: getErrorMessage(error, "作業ログの削除中にエラーが発生しました"),
    };
  }
}
