"use client";

import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchDocumentDetail } from "@/features/assembly-archive/server/actions/fetch-document-detail";
import { parseFolderPath } from "@/features/assembly-archive/server/utils/parse-folder-path";
import { DISCUSS_CABINET_ENTRY_URL } from "@/features/assembly-archive/shared/constants";
import type {
  DocumentDetail,
  DocumentNode,
} from "@/features/assembly-archive/shared/types";

export function DocumentDetailPanel({
  document: doc,
}: {
  document: DocumentNode | null;
}) {
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    setCopied(false);
    fetchDocumentDetail({
      cabinetId: doc.cabinetId,
      folderId: doc.folderId,
      docid: doc.docid,
    }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDetail(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  async function copyBody() {
    if (!detail?.bodyText) return;
    await navigator.clipboard.writeText(detail.bodyText);
    setCopied(true);
  }

  if (!doc) {
    return (
      <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
        左のツリーから文書を選択してください。
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-1 text-lg font-semibold">{doc.title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{doc.date}</p>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 取得中...
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {detail && (
        <div className="space-y-4">
          {detail.folderPath && (
            <p className="text-sm text-muted-foreground">
              {parseFolderPath(detail.folderPath).join(" / ")}
            </p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">本文テキスト</span>
              {detail.bodyText && (
                <Button variant="outline" size="sm" onClick={copyBody}>
                  <Copy className="size-4" />
                  {copied ? "コピーしました" : "コピー"}
                </Button>
              )}
            </div>
            {detail.bodyText ? (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-sm">
                {detail.bodyText}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                本文テキストが取得できませんでした。原典PDFをご確認ください。
              </p>
            )}
          </div>

          {detail.files.length > 0 && (
            <div>
              <span className="text-sm font-medium">添付ファイル</span>
              <ul className="mt-1 space-y-1 text-sm">
                {detail.files.map((file) => (
                  <li key={file.fileId} className="text-muted-foreground">
                    {file.fileName}（ファイルID: {file.fileId}）
                  </li>
                ))}
              </ul>
            </div>
          )}

          <a
            href={DISCUSS_CABINET_ENTRY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline"
          >
            <ExternalLink className="size-4" />
            DiscussCabinet で開く（文書ID: {doc.docid}）
          </a>
        </div>
      )}
    </div>
  );
}
