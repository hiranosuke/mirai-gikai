"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { routes } from "@/lib/routes";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import type { CreateOpsActivityLogInput } from "../../shared/types";
import { mapOpsDbError } from "../../shared/utils/map-ops-db-error";
import { createOpsActivityLogSchema } from "../../shared/utils/ops-activity-log-schema";
import { createOpsActivityLogRecord } from "../repositories/ops-activity-log-repository";

export async function createOpsActivityLog(input: CreateOpsActivityLogInput) {
  try {
    await requireAdmin();

    const parsed = createOpsActivityLogSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "入力内容が正しくありません" };
    }

    const result = await createOpsActivityLogRecord({
      bill_id: parsed.data.bill_id,
      activity_type: parsed.data.activity_type,
      minutes: parsed.data.minutes,
      note: parsed.data.note ?? null,
      occurred_on: parsed.data.occurred_on,
    });

    if (result.error) {
      return { error: mapOpsDbError(result.error, "作成") };
    }

    revalidatePath(routes.opsActivityLog());
    return { data: result.data };
  } catch (error) {
    console.error("Create ops activity log error:", error);
    return {
      error: getErrorMessage(error, "作業ログの作成中にエラーが発生しました"),
    };
  }
}
