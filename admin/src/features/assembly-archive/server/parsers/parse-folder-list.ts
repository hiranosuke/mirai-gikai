import "server-only";

import { parse } from "node-html-parser";
import type { ParsedFolderList } from "../../shared/types";

export class DiscussCabinetParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscussCabinetParseError";
  }
}

function assertNotErrorScreen(root: ReturnType<typeof parse>): void {
  const title = root.querySelector("title")?.text ?? "";
  if (title.includes("エラー")) {
    throw new DiscussCabinetParseError(
      "DiscussCabinet がエラー画面を返しました"
    );
  }
}

export function parseFolderList(html: string): ParsedFolderList {
  const root = parse(html);
  assertNotErrorScreen(root);

  const folders: ParsedFolderList["folders"] = [];
  for (const button of root.querySelectorAll("button.folder_icon")) {
    const onclick = button.getAttribute("onclick") ?? "";
    const idMatch = onclick.match(/setFolderid\('(\d+)'/);
    if (!idMatch) continue;
    const name = (button.getAttribute("title") ?? button.text).trim();
    folders.push({ folderId: Number(idMatch[1]), name });
  }

  const documents: ParsedFolderList["documents"] = [];
  for (const tr of root.querySelectorAll("tr")) {
    const button = tr.querySelector("button");
    const onclick = button?.getAttribute("onclick") ?? "";
    const docMatch = onclick.match(/doSubmitWithDocid\('doc_view',\s*(\d+)\)/);
    if (!docMatch) continue;
    const cells = tr
      .querySelectorAll("td")
      .filter((td) => td.getAttribute("class") !== "img");
    const title = cells[0]?.text.trim() ?? "";
    const date = cells[1]?.text.trim() ?? "";
    documents.push({ docid: Number(docMatch[1]), title, date });
  }

  return { folders, documents };
}
