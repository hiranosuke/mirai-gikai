import { describe, expect, it } from "vitest";
import type { DiscussCabinetClient } from "../clients/discuss-cabinet-client";
import { loadTreeChildren } from "./load-tree-children";

const FOLDER_LIST_HTML = `
<html><body>
<button class="folder_icon" onclick="setFolderid('223218','down');doSubmit('list');" title="６月定例会"><span>６月定例会</span></button>
<table>
<tr>
  <td class="img"><button onclick="doSubmitWithDocid('doc_view',15337)">詳細</button></td>
  <td class="img"><img/></td>
  <td>令和８年６月定例会議案審議結果一覧</td>
  <td>2026/06/12</td>
</tr>
</table>
</body></html>`;

function fakeClient(html: string): DiscussCabinetClient {
  return {
    fetchFolderList: async () => html,
    fetchDocView: async () => "",
    fetchFile: async () => ({
      body: new ArrayBuffer(0),
      contentType: "application/pdf",
    }),
  };
}

describe("loadTreeChildren", () => {
  it("フォルダを先、文書を後にして cabinetId を付与する", async () => {
    const result = await loadTreeChildren(
      { cabinetId: 1, folderId: 212526, move: "down" },
      fakeClient(FOLDER_LIST_HTML)
    );
    expect(result).toEqual([
      {
        kind: "folder",
        cabinetId: 1,
        folderId: 223218,
        name: "６月定例会",
      },
      {
        kind: "document",
        cabinetId: 1,
        folderId: 212526,
        docid: 15337,
        title: "令和８年６月定例会議案審議結果一覧",
        date: "2026/06/12",
      },
    ]);
  });
});
