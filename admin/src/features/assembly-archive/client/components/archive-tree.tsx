"use client";

import {
  ChevronDown,
  ChevronRight,
  DownloadCloud,
  FileText,
  Folder,
  Loader2,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchDocumentDetail } from "@/features/assembly-archive/server/actions/fetch-document-detail";
import { fetchTreeChildren } from "@/features/assembly-archive/server/actions/fetch-tree-children";
import { importAssemblySubtree } from "@/features/assembly-archive/server/actions/import-assembly-subtree-action";
import type {
  Cabinet,
  DocumentDetail,
  DocumentFile,
  DocumentNode,
  SelectedFile,
  TreeChild,
} from "@/features/assembly-archive/shared/types";
import { deriveDocCheckState } from "@/features/assembly-archive/shared/utils/derive-doc-check-state";

type SelectionProps = {
  isFileSelected: (docid: number, fileId: number) => boolean;
  onToggleFile: (file: SelectedFile) => void;
  onToggleAllFiles: (
    doc: DocumentNode,
    files: DocumentFile[],
    selectAll: boolean
  ) => void;
};

type ExpandableProps = SelectionProps & {
  label: string;
  cabinetId: number;
  folderId: number;
  move: "cabinet" | "down";
  depth: number;
  path: string;
  onSelectDocument: (doc: DocumentNode) => void;
};

function FileRow({
  doc,
  file,
  depth,
  isFileSelected,
  onToggleFile,
}: {
  doc: DocumentNode;
  file: DocumentFile;
  depth: number;
} & Pick<SelectionProps, "isFileSelected" | "onToggleFile">) {
  return (
    <div
      className="flex items-center gap-2 py-1"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <Checkbox
        checked={isFileSelected(doc.docid, file.fileId)}
        onCheckedChange={() =>
          onToggleFile({ doc, fileId: file.fileId, fileName: file.fileName })
        }
        aria-label={`${file.fileName} を選択`}
      />
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="line-clamp-2 min-w-0 flex-1 text-left text-sm">
        {file.fileName}
      </span>
    </div>
  );
}

function DocumentItem({
  doc,
  depth,
  onSelectDocument,
  isFileSelected,
  onToggleFile,
  onToggleAllFiles,
}: {
  doc: DocumentNode;
  depth: number;
  onSelectDocument: (doc: DocumentNode) => void;
} & SelectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  async function loadDetail(): Promise<DocumentDetail | null> {
    if (detail !== null) return detail;
    if (loadingRef.current) return null;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDocumentDetail({
        cabinetId: doc.cabinetId,
        folderId: doc.folderId,
        docid: doc.docid,
      });
      if ("error" in result) {
        setError(result.error);
        return null;
      }
      setDetail(result.data);
      return result.data;
    } catch {
      setError("文書の取得に失敗しました");
      return null;
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  async function toggleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    await loadDetail();
  }

  async function toggleAll() {
    const data = detail ?? (await loadDetail());
    if (!data) return;
    setExpanded(true);
    const selectedCount = data.files.filter((f) =>
      isFileSelected(doc.docid, f.fileId)
    ).length;
    const selectAll = selectedCount < data.files.length;
    onToggleAllFiles(doc, data.files, selectAll);
  }

  const checkState = detail
    ? deriveDocCheckState(
        detail.files.length,
        detail.files.filter((f) => isFileSelected(doc.docid, f.fileId)).length
      )
    : false;

  return (
    <div>
      <div
        className="flex items-center gap-2"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={toggleExpand}
          aria-label={expanded ? "折りたたむ" : "展開する"}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </Button>
        <Checkbox
          checked={checkState}
          onCheckedChange={() => {
            void toggleAll();
          }}
          aria-label={`${doc.title} の全ファイルを選択`}
        />
        <Button
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start gap-2 py-1 font-normal whitespace-normal"
          onClick={() => onSelectDocument(doc)}
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2 text-left">{doc.title}</span>
        </Button>
        {loading && <Loader2 className="size-4 shrink-0 animate-spin" />}
      </div>
      {expanded && error && (
        <p
          className="py-1 text-sm text-destructive"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          {error}
        </p>
      )}
      {expanded &&
        detail?.files.map((file) => (
          <FileRow
            key={`file-${doc.docid}-${file.fileId}`}
            doc={doc}
            file={file}
            depth={depth + 1}
            isFileSelected={isFileSelected}
            onToggleFile={onToggleFile}
          />
        ))}
    </div>
  );
}

function ExpandableFolder({
  label,
  cabinetId,
  folderId,
  move,
  depth,
  path,
  onSelectDocument,
  isFileSelected,
  onToggleFile,
  onToggleAllFiles,
}: ExpandableProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<TreeChild[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function runImport() {
    if (importing) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const result = await importAssemblySubtree({
        cabinetId,
        folderId,
        basePath: path,
      });
      setImportMsg(
        "error" in result
          ? result.error
          : `取り込み完了: フォルダ${result.data.folderCount}件 / 文書${result.data.documentCount}件`
      );
    } catch {
      setImportMsg("取り込みに失敗しました");
    } finally {
      setImporting(false);
    }
  }

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (children !== null || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTreeChildren({ cabinetId, folderId, move });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setChildren(result.data);
    } catch {
      setError("議会資料の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center">
        <Button
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start gap-2 py-1 font-normal whitespace-normal"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={toggle}
        >
          {expanded ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
          <Folder className="size-4 shrink-0 text-primary" />
          <span className="line-clamp-2 min-w-0 flex-1 text-left">{label}</span>
          {loading && <Loader2 className="size-4 shrink-0 animate-spin" />}
        </Button>
        {move === "down" && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={() => {
              void runImport();
            }}
            disabled={importing}
            aria-label={`${label} 配下をインデックスに取り込む`}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DownloadCloud className="size-4" />
            )}
          </Button>
        )}
      </div>
      {expanded && error && (
        <p
          className="py-1 text-sm text-destructive"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          {error}
        </p>
      )}
      {importMsg && (
        <p
          className="py-1 text-sm text-muted-foreground"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          {importMsg}
        </p>
      )}
      {expanded &&
        children?.map((child) =>
          child.kind === "folder" ? (
            <ExpandableFolder
              key={`f-${child.folderId}`}
              label={child.name}
              cabinetId={child.cabinetId}
              folderId={child.folderId}
              move="down"
              depth={depth + 1}
              path={`${path}${child.name}/`}
              onSelectDocument={onSelectDocument}
              isFileSelected={isFileSelected}
              onToggleFile={onToggleFile}
              onToggleAllFiles={onToggleAllFiles}
            />
          ) : (
            <DocumentItem
              key={`d-${child.docid}`}
              doc={child}
              depth={depth + 1}
              onSelectDocument={onSelectDocument}
              isFileSelected={isFileSelected}
              onToggleFile={onToggleFile}
              onToggleAllFiles={onToggleAllFiles}
            />
          )
        )}
    </div>
  );
}

export function ArchiveTree({
  cabinets,
  onSelectDocument,
  isFileSelected,
  onToggleFile,
  onToggleAllFiles,
}: {
  cabinets: Cabinet[];
  onSelectDocument: (doc: DocumentNode) => void;
} & SelectionProps) {
  return (
    <div className="rounded-lg border bg-white p-2">
      {cabinets.map((cabinet) => (
        <ExpandableFolder
          key={`c-${cabinet.cabinetId}`}
          label={cabinet.name}
          cabinetId={cabinet.cabinetId}
          folderId={0}
          move="cabinet"
          depth={0}
          path={`/${cabinet.name}/`}
          onSelectDocument={onSelectDocument}
          isFileSelected={isFileSelected}
          onToggleFile={onToggleFile}
          onToggleAllFiles={onToggleAllFiles}
        />
      ))}
    </div>
  );
}
