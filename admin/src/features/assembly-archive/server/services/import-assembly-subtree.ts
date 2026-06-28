import "server-only";

import {
  upsertAssemblyDocuments,
  upsertAssemblyFolders,
} from "../repositories/assembly-document-repository";
import { crawlAssemblySubtree } from "./crawl-assembly-subtree";

export async function importAssemblySubtree(input: {
  cabinetId: number;
  folderId: number;
  basePath: string;
}): Promise<{ folderCount: number; documentCount: number }> {
  const { folders, documents } = await crawlAssemblySubtree(input);
  await upsertAssemblyFolders(folders);
  await upsertAssemblyDocuments(documents);
  return { folderCount: folders.length, documentCount: documents.length };
}
