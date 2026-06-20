import "server-only";

import type { DocumentDetail } from "../../shared/types";
import {
  createDiscussCabinetClient,
  type DiscussCabinetClient,
} from "../clients/discuss-cabinet-client";
import { parseDocView } from "../parsers/parse-doc-view";

export async function loadDocumentDetail(
  input: { cabinetId: number; folderId: number; docid: number },
  client: DiscussCabinetClient = createDiscussCabinetClient()
): Promise<DocumentDetail> {
  const html = await client.fetchDocView(input);
  const parsed = parseDocView(html);
  return {
    title: parsed.title,
    folderPath: parsed.folderPath,
    bodyText: parsed.bodyText,
    files: parsed.files,
  };
}
