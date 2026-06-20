"use server";

import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import type { TreeChild } from "../../shared/types";
import { loadTreeChildren } from "../loaders/load-tree-children";

export async function fetchTreeChildren(input: {
  cabinetId: number;
  folderId: number;
  move: "cabinet" | "down";
}): Promise<{ data: TreeChild[] } | { error: string }> {
  try {
    await requireAdmin();
    const data = await loadTreeChildren(input);
    return { data };
  } catch (error) {
    console.error("fetchTreeChildren error:", error);
    return {
      error: getErrorMessage(
        error,
        "議会資料の取得に失敗しました（DiscussCabinet側の構造変更または一時的な障害の可能性があります）"
      ),
    };
  }
}
