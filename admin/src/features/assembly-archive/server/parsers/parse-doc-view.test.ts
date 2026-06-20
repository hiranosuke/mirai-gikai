import { describe, expect, it } from "vitest";
import { parseDocView } from "./parse-doc-view";
import { DiscussCabinetParseError } from "./parse-folder-list";

const DOC_VIEW_HTML = `
<html><head><title>文書詳細画面</title></head><body>
<table>
<tr><th>件名:</th><td> 令和８年６月定例会議案審議結果一覧 </td></tr>
<tr><th>日付:</th><td>2026/06/12</td></tr>
<tr><th>フォルダ名:</th><td>/本会議/令和８年/６月定例会/審議結果/</td></tr>
<tr><th>本文テキスト:</th><td> 議案番号 提出日 件名 議決結果 議決日第106号令和8年6月3日専決処分の報告及び承認を求めることについて承認 </td></tr>
<tr><th>ファイル名:</th><td>
  <a href="#" onClick="setFile('17114');doSubmitWithNewWin('file_view');return false;">令和８年６月定例会議案審議結果一覧.pdf</a>
</td></tr>
</table>
</body></html>`;

const EMPTY_BODY_HTML = `
<html><head><title>文書詳細画面</title></head><body>
<table>
<tr><th>件名:</th><td>テスト議案</td></tr>
<tr><th>フォルダ名:</th><td>/本会議/令和８年/</td></tr>
<tr><th>本文テキスト:</th><td>  </td></tr>
</table>
</body></html>`;

const ERROR_HTML = `<html><head><title>エラー画面</title></head><body></body></html>`;

describe("parseDocView", () => {
  it("件名・フォルダパス・本文テキスト・ファイルを抽出する", () => {
    const result = parseDocView(DOC_VIEW_HTML);
    expect(result.title).toBe("令和８年６月定例会議案審議結果一覧");
    expect(result.folderPath).toBe("/本会議/令和８年/６月定例会/審議結果/");
    expect(result.bodyText).toContain("第106号令和8年6月3日専決処分の報告");
    expect(result.files).toEqual([
      { fileId: 17114, fileName: "令和８年６月定例会議案審議結果一覧.pdf" },
    ]);
  });

  it("本文テキストが空白のみのときは空文字を返す", () => {
    const result = parseDocView(EMPTY_BODY_HTML);
    expect(result.bodyText).toBe("");
    expect(result.files).toEqual([]);
  });

  it("エラー画面では DiscussCabinetParseError を throw する", () => {
    expect(() => parseDocView(ERROR_HTML)).toThrow(DiscussCabinetParseError);
  });
});
