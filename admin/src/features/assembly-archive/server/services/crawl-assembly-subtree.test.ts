import { describe, expect, it } from "vitest";
import type { DiscussCabinetClient } from "../clients/discuss-cabinet-client";
import { crawlAssemblySubtree } from "./crawl-assembly-subtree";

// folderId ごとに異なるHTMLを返すフェイク。
// 212526(起点): サブフォルダ 223218(審議結果) + 文書 15337
// 223218: 文書 15400 のみ
function fakeClient(): DiscussCabinetClient {
  const byFolder: Record<number, string> = {
    212526: `
      <html><body>
      <button class="folder_icon" onclick="setFolderid('223218','down');" title="審議結果"><span>審議結果</span></button>
      <table><tr>
        <td class="img"><button onclick="doSubmitWithDocid('doc_view',15337)">詳細</button></td>
        <td class="img"><img/></td>
        <td>令和８年６月定例会議案付託表</td>
        <td>2026/06/03</td>
      </tr></table>
      </body></html>`,
    223218: `
      <html><body>
      <table><tr>
        <td class="img"><button onclick="doSubmitWithDocid('doc_view',15400)">詳細</button></td>
        <td class="img"><img/></td>
        <td>令和８年６月定例会議案審議結果一覧</td>
        <td>2026/06/12</td>
      </tr></table>
      </body></html>`,
  };
  return {
    fetchFolderList: async ({ folderId }) =>
      byFolder[folderId] ?? "<html></html>",
    fetchDocView: async () => "",
    fetchFile: async () => ({
      body: new ArrayBuffer(0),
      contentType: "application/pdf",
    }),
  };
}

describe("crawlAssemblySubtree", () => {
  it("サブツリーを再帰的に辿り、フォルダと文書の行を返す", async () => {
    const result = await crawlAssemblySubtree(
      {
        cabinetId: 1,
        folderId: 212526,
        basePath: "/本会議/令和８年/６月定例会/",
        delayMs: 0,
      },
      fakeClient()
    );

    expect(result.folders).toEqual([
      {
        folder_id: 223218,
        cabinet_id: 1,
        parent_folder_id: 212526,
        name: "審議結果",
        path: "/本会議/令和８年/６月定例会/審議結果/",
      },
    ]);

    expect(result.documents).toEqual([
      {
        cabinet_id: 1,
        folder_id: 212526,
        docid: 15337,
        title: "令和８年６月定例会議案付託表",
        doc_date: "2026-06-03",
        raw_date: "2026/06/03",
        folder_path: "/本会議/令和８年/６月定例会/",
        session_label: "令和8年6月定例会",
      },
      {
        cabinet_id: 1,
        folder_id: 223218,
        docid: 15400,
        title: "令和８年６月定例会議案審議結果一覧",
        doc_date: "2026-06-12",
        raw_date: "2026/06/12",
        folder_path: "/本会議/令和８年/６月定例会/審議結果/",
        session_label: "令和8年6月定例会",
      },
    ]);
  });
});
