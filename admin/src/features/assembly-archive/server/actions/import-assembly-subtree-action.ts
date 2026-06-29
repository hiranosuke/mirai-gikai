"use server";

import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { importAssemblySubtree as runImport } from "../services/import-assembly-subtree";

export async function importAssemblySubtree(input: {
  cabinetId: number;
  folderId: number;
  basePath: string;
}): Promise<
  { data: { folderCount: number; documentCount: number } } | { error: string }
> {
  try {
    await requireAdmin();
    const data = await runImport(input);
    return { data };
  } catch (error) {
    console.error("importAssemblySubtree error:", error);
    // 権限エラー・上限エラー・パースエラー等の既知メッセージはそのまま返し、
    // 想定外の例外のみ汎用メッセージにフォールバックする。
    return {
      error:
        error instanceof Error
          ? error.message
          : "議会資料メタの取り込みに失敗しました（DiscussCabinet側の構造変更または一時的な障害の可能性があります）",
    };
  }
}
