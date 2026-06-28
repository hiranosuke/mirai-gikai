import "server-only";

import { createAdminClient } from "@mirai-gikai/supabase";
import type {
  AssemblyDocumentRow,
  AssemblyFolderRow,
  AssemblySearchInput,
  AssemblySearchResult,
} from "../../shared/types";

const DEFAULT_LIMIT = 50;

export async function upsertAssemblyFolders(
  rows: AssemblyFolderRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("assembly_folders")
    .upsert(rows, { onConflict: "folder_id" });
  if (error) {
    throw new Error(`Failed to upsert assembly folders: ${error.message}`);
  }
}

export async function upsertAssemblyDocuments(
  rows: AssemblyDocumentRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("assembly_documents")
    .upsert(rows, { onConflict: "cabinet_id,docid" });
  if (error) {
    throw new Error(`Failed to upsert assembly documents: ${error.message}`);
  }
}

export async function searchAssemblyDocuments(
  input: AssemblySearchInput
): Promise<AssemblySearchResult[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("assembly_documents")
    .select(
      "title, doc_date, folder_path, session_label, cabinet_id, folder_id, docid"
    );

  if (input.query) query = query.ilike("title", `%${input.query}%`);
  if (input.sessionLabel) query = query.eq("session_label", input.sessionLabel);
  if (input.cabinetId !== undefined)
    query = query.eq("cabinet_id", input.cabinetId);
  if (input.dateFrom) query = query.gte("doc_date", input.dateFrom);
  if (input.dateTo) query = query.lte("doc_date", input.dateTo);

  const { data, error } = await query
    .order("doc_date", { ascending: false, nullsFirst: false })
    .limit(input.limit ?? DEFAULT_LIMIT);

  if (error) {
    throw new Error(`Failed to search assembly documents: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    title: row.title,
    docDate: row.doc_date,
    folderPath: row.folder_path,
    sessionLabel: row.session_label,
    cabinetId: row.cabinet_id,
    folderId: row.folder_id,
    docid: row.docid,
  }));
}
