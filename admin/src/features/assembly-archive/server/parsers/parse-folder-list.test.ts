import { describe, expect, it } from "vitest";
import { DiscussCabinetParseError, parseFolderList } from "./parse-folder-list";

const FOLDER_LIST_HTML = `
<html><body>
<button type="button" id="btn_folder_list_212526"
  class="btn_size8 folder_icon cursor_pointer"
  onclick="javascript:setFolderid('212526','down');doSubmit('list');"
  title="令和８年"><span>令和８年</span></button>
<button type="button" id="btn_folder_list_177110"
  class="btn_size8 folder_icon cursor_pointer"
  onclick="javascript:setFolderid('177110','down');doSubmit('list');"
  title="令和７年"><span>令和７年</span></button>
<table>
<tr>
  <td class="img"><button onclick="javascript:doSubmitWithDocid('doc_view',15338)">詳細</button></td>
  <td class="img"><img src="x.png" alt=""/></td>
  <td>令和８年６月定例会請願審議結果一覧</td>
  <td>2026/06/12</td>
</tr>
<tr>
  <td class="img"><button onclick="javascript:doSubmitWithDocid('doc_view',15337)">詳細</button></td>
  <td class="img"><img src="x.png" alt=""/></td>
  <td>令和８年６月定例会議案審議結果一覧</td>
  <td>2026/06/12</td>
</tr>
</table>
</body></html>`;

const ERROR_HTML = `
<html><head><title>エラー画面</title></head>
<body><div class="w_t_39_2">エラー</div></body></html>`;

describe("parseFolderList", () => {
  it("フォルダボタンから folderId と name を抽出する", () => {
    const result = parseFolderList(FOLDER_LIST_HTML);
    expect(result.folders).toEqual([
      { folderId: 212526, name: "令和８年" },
      { folderId: 177110, name: "令和７年" },
    ]);
  });

  it("文書行から docid・件名・日付を抽出する", () => {
    const result = parseFolderList(FOLDER_LIST_HTML);
    expect(result.documents).toEqual([
      {
        docid: 15338,
        title: "令和８年６月定例会請願審議結果一覧",
        date: "2026/06/12",
      },
      {
        docid: 15337,
        title: "令和８年６月定例会議案審議結果一覧",
        date: "2026/06/12",
      },
    ]);
  });

  it("エラー画面では DiscussCabinetParseError を throw する", () => {
    expect(() => parseFolderList(ERROR_HTML)).toThrow(DiscussCabinetParseError);
  });
});
