import "server-only";

import {
  CRAWL_DELAY_MS,
  MAX_CRAWL_DEPTH,
  MAX_CRAWL_DOCUMENTS,
} from "../../shared/constants";
import type {
  AssemblyDocumentRow,
  AssemblyFolderRow,
} from "../../shared/types";
import { deriveSessionLabel } from "../../shared/utils/derive-session-label";
import { parseDocDate } from "../../shared/utils/parse-doc-date";
import {
  createDiscussCabinetClient,
  type DiscussCabinetClient,
} from "../clients/discuss-cabinet-client";
import { parseFolderList } from "../parsers/parse-folder-list";

const sleep = (ms: number) =>
  ms > 0
    ? new Promise((resolve) => setTimeout(resolve, ms))
    : Promise.resolve();

export async function crawlAssemblySubtree(
  input: {
    cabinetId: number;
    folderId: number;
    basePath: string;
    delayMs?: number;
  },
  client: DiscussCabinetClient = createDiscussCabinetClient()
): Promise<{ folders: AssemblyFolderRow[]; documents: AssemblyDocumentRow[] }> {
  const folders: AssemblyFolderRow[] = [];
  const documents: AssemblyDocumentRow[] = [];
  const delayMs = input.delayMs ?? CRAWL_DELAY_MS;

  async function walk(
    folderId: number,
    path: string,
    depth: number
  ): Promise<void> {
    if (depth > MAX_CRAWL_DEPTH) {
      throw new Error(`クロール深さが上限(${MAX_CRAWL_DEPTH})を超えました`);
    }
    await sleep(delayMs);
    const html = await client.fetchFolderList({
      cabinetId: input.cabinetId,
      folderId,
      move: "down",
    });
    const parsed = parseFolderList(html);

    for (const doc of parsed.documents) {
      if (documents.length >= MAX_CRAWL_DOCUMENTS) {
        throw new Error(
          `取り込み文書数が上限(${MAX_CRAWL_DOCUMENTS})を超えました`
        );
      }
      documents.push({
        cabinet_id: input.cabinetId,
        folder_id: folderId,
        docid: doc.docid,
        title: doc.title,
        doc_date: parseDocDate(doc.date),
        raw_date: doc.date,
        folder_path: path,
        session_label: deriveSessionLabel(path),
      });
    }

    for (const folder of parsed.folders) {
      const childPath = `${path}${folder.name}/`;
      folders.push({
        folder_id: folder.folderId,
        cabinet_id: input.cabinetId,
        parent_folder_id: folderId,
        name: folder.name,
        path: childPath,
      });
      await walk(folder.folderId, childPath, depth + 1);
    }
  }

  await walk(input.folderId, input.basePath, 0);
  return { folders, documents };
}
