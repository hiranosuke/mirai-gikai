"use server";

import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import type { DocumentDetail } from "../../shared/types";
import { loadDocumentDetail } from "../loaders/load-document-detail";

export async function fetchDocumentDetail(input: {
  cabinetId: number;
  folderId: number;
  docid: number;
}): Promise<{ data: DocumentDetail } | { error: string }> {
  try {
    await requireAdmin();
    const data = await loadDocumentDetail(input);
    return { data };
  } catch (error) {
    console.error("fetchDocumentDetail error:", error);
    return {
      error: getErrorMessage(
        error,
        "文書の取得に失敗しました（DiscussCabinet側の構造変更または一時的な障害の可能性があります）"
      ),
    };
  }
}
