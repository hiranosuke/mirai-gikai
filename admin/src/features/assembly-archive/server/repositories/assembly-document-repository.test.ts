import { afterEach, describe, expect, it } from "vitest";
import { createAdminClient } from "@mirai-gikai/supabase";
import {
  searchAssemblyDocuments,
  upsertAssemblyDocuments,
  upsertAssemblyFolders,
} from "./assembly-document-repository";

const TEST_DOCIDS = [900001, 900002, 900003];

afterEach(async () => {
  const supabase = createAdminClient();
  await supabase.from("assembly_documents").delete().in("docid", TEST_DOCIDS);
  await supabase.from("assembly_folders").delete().eq("folder_id", 999001);
});

describe("assembly-document-repository", () => {
  it("文書を upsert し、件名+会期で検索できる", async () => {
    await upsertAssemblyDocuments([
      {
        cabinet_id: 1,
        folder_id: 999001,
        docid: 900001,
        title: "令和8年6月定例会議案審議結果一覧",
        doc_date: "2026-06-12",
        raw_date: "2026/06/12",
        folder_path: "/本会議/令和８年/６月定例会/審議結果/",
        session_label: "令和8年6月定例会",
      },
      {
        cabinet_id: 1,
        folder_id: 999001,
        docid: 900002,
        title: "別会期の資料",
        doc_date: "2025-06-12",
        raw_date: "2025/06/12",
        folder_path: "/本会議/令和７年/６月定例会/審議結果/",
        session_label: "令和7年6月定例会",
      },
    ]);

    const results = await searchAssemblyDocuments({
      query: "審議結果",
      sessionLabel: "令和8年6月定例会",
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      docid: 900001,
      title: "令和8年6月定例会議案審議結果一覧",
      sessionLabel: "令和8年6月定例会",
      cabinetId: 1,
    });
  });

  it("docid 衝突時は upsert で更新する", async () => {
    const base = {
      cabinet_id: 1,
      folder_id: 999001,
      docid: 900003,
      doc_date: "2026-06-12",
      raw_date: "2026/06/12",
      folder_path: "/本会議/令和８年/６月定例会/",
      session_label: "令和8年6月定例会",
    };
    await upsertAssemblyDocuments([{ ...base, title: "旧タイトル" }]);
    await upsertAssemblyDocuments([{ ...base, title: "新タイトル" }]);

    const results = await searchAssemblyDocuments({ query: "タイトル" });
    const target = results.filter((r) => r.docid === 900003);
    expect(target).toHaveLength(1);
    expect(target[0].title).toBe("新タイトル");
  });

  it("フォルダを upsert できる", async () => {
    await upsertAssemblyFolders([
      {
        folder_id: 999001,
        cabinet_id: 1,
        parent_folder_id: null,
        name: "６月定例会",
        path: "/本会議/令和８年/６月定例会/",
      },
    ]);
    // 例外が出ないことを確認
    expect(true).toBe(true);
  });
});
