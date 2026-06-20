import "server-only";

import type { TreeChild } from "../../shared/types";
import {
  createDiscussCabinetClient,
  type DiscussCabinetClient,
} from "../clients/discuss-cabinet-client";
import { parseFolderList } from "../parsers/parse-folder-list";

export async function loadTreeChildren(
  input: { cabinetId: number; folderId: number; move: "cabinet" | "down" },
  client: DiscussCabinetClient = createDiscussCabinetClient()
): Promise<TreeChild[]> {
  const html = await client.fetchFolderList(input);
  const parsed = parseFolderList(html);

  const folders: TreeChild[] = parsed.folders.map((folder) => ({
    kind: "folder",
    cabinetId: input.cabinetId,
    folderId: folder.folderId,
    name: folder.name,
  }));

  const documents: TreeChild[] = parsed.documents.map((doc) => ({
    kind: "document",
    cabinetId: input.cabinetId,
    folderId: input.folderId,
    docid: doc.docid,
    title: doc.title,
    date: doc.date,
  }));

  return [...folders, ...documents];
}
