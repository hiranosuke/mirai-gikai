import { describe, expect, it } from "vitest";
import { buildFileUrl } from "./build-file-url";

describe("buildFileUrl", () => {
  it("PDFプロキシAPIのURLをクエリ付きで生成する", () => {
    const url = buildFileUrl({
      cabinetId: 1,
      folderId: 224514,
      docid: 15337,
      fileId: 17114,
      fileName: "令和８年６月定例会議案審議結果一覧.pdf",
    });
    expect(url).toContain("/api/assembly-archive/file?");
    expect(url).toContain("cabinetId=1");
    expect(url).toContain("folderId=224514");
    expect(url).toContain("docid=15337");
    expect(url).toContain("fileId=17114");
  });

  it("ファイル名をURLエンコードする", () => {
    const url = buildFileUrl({
      cabinetId: 1,
      folderId: 2,
      docid: 3,
      fileId: 4,
      fileName: "a b.pdf",
    });
    expect(url).toContain("name=a+b.pdf");
  });
});
