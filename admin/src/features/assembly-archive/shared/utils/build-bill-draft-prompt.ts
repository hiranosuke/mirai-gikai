import type { SelectedFile } from "../types";

const INTRO = `以下のさいたま市議会の会議資料PDFを参照して、mirai-gikai の議案ドラフトを作成してください。
\`bill-draft-from-archive\` スキルに従って、DiscussCabinet から各PDFを取得し、議案ドラフトJSONを生成してMCPで登録してください。

## 参照資料
`;

export function buildBillDraftPrompt(files: SelectedFile[]): string {
  const order: number[] = [];
  const groups = new Map<number, SelectedFile[]>();
  for (const file of files) {
    const docid = file.doc.docid;
    if (!groups.has(docid)) {
      groups.set(docid, []);
      order.push(docid);
    }
    groups.get(docid)?.push(file);
  }

  const sections = order.map((docid) => {
    const groupFiles = groups.get(docid) ?? [];
    const { doc } = groupFiles[0];
    const heading = `### ${doc.title}（docid: ${docid}）`;
    const lines = groupFiles.map(
      (f) =>
        `- ${f.fileName}  cabinetId=${f.doc.cabinetId}  folderId=${f.doc.folderId}  docid=${f.doc.docid}  fileId=${f.fileId}`
    );
    return [heading, ...lines].join("\n");
  });

  return `${INTRO}\n${sections.join("\n\n")}\n`;
}
