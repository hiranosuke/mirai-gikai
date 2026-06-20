export type FileUrlParams = {
  cabinetId: number;
  folderId: number;
  docid: number;
  fileId: number;
  fileName: string;
};

/**
 * admin の PDF プロキシ API への内部リンクを生成する。
 * DiscussCabinet は POST 遷移で直リンク不能なため、admin サーバー経由で
 * PDF を取得する GET エンドポイントの URL を組み立てる。
 */
export function buildFileUrl(params: FileUrlParams): string {
  const query = new URLSearchParams({
    cabinetId: String(params.cabinetId),
    folderId: String(params.folderId),
    docid: String(params.docid),
    fileId: String(params.fileId),
    name: params.fileName,
  });
  return `/api/assembly-archive/file?${query.toString()}`;
}
