import "server-only";

import { parse } from "node-html-parser";
import type { DocumentFile, ParsedDocView } from "../../shared/types";
import { DiscussCabinetParseError } from "./parse-folder-list";

function findValueByLabel(
  root: ReturnType<typeof parse>,
  label: string
): string {
  for (const tr of root.querySelectorAll("tr")) {
    const th = tr.querySelector("th");
    if (th && th.text.trim().startsWith(label)) {
      return tr.querySelector("td")?.text.trim() ?? "";
    }
  }
  return "";
}

export function parseDocView(html: string): ParsedDocView {
  const root = parse(html);
  const title = root.querySelector("title")?.text ?? "";
  if (title.includes("エラー")) {
    throw new DiscussCabinetParseError(
      "DiscussCabinet がエラー画面を返しました"
    );
  }

  const files: DocumentFile[] = [];
  for (const anchor of root.querySelectorAll("a")) {
    const onclick = anchor.getAttribute("onclick") ?? "";
    const match = onclick.match(/setFile\('(\d+)'\)/);
    if (!match) continue;
    files.push({ fileId: Number(match[1]), fileName: anchor.text.trim() });
  }

  return {
    title: findValueByLabel(root, "件名"),
    folderPath: findValueByLabel(root, "フォルダ名"),
    bodyText: findValueByLabel(root, "本文テキスト"),
    files,
  };
}
