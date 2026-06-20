import { describe, expect, it } from "vitest";
import type { DiscussCabinetClient } from "../clients/discuss-cabinet-client";
import { loadDocumentDetail } from "./load-document-detail";

const DOC_VIEW_HTML = `
<html><head><title>文書詳細画面</title></head><body>
<table>
<tr><th>件名:</th><td>令和８年６月定例会議案審議結果一覧</td></tr>
<tr><th>フォルダ名:</th><td>/本会議/令和８年/６月定例会/審議結果/</td></tr>
<tr><th>本文テキスト:</th><td>議案番号 提出日 件名 議決結果</td></tr>
<tr><th>ファイル名:</th><td><a onClick="setFile('17114');return false;">x.pdf</a></td></tr>
</table>
</body></html>`;

function fakeClient(html: string): DiscussCabinetClient {
  return {
    fetchFolderList: async () => "",
    fetchDocView: async () => html,
  };
}

describe("loadDocumentDetail", () => {
  it("文書詳細を DocumentDetail として返す", async () => {
    const result = await loadDocumentDetail(
      { cabinetId: 1, folderId: 224514, docid: 15337 },
      fakeClient(DOC_VIEW_HTML)
    );
    expect(result).toEqual({
      title: "令和８年６月定例会議案審議結果一覧",
      folderPath: "/本会議/令和８年/６月定例会/審議結果/",
      bodyText: "議案番号 提出日 件名 議決結果",
      files: [{ fileId: 17114, fileName: "x.pdf" }],
    });
  });
});
