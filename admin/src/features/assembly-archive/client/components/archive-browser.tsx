"use client";

import { useState } from "react";
import type {
  Cabinet,
  DocumentFile,
  DocumentNode,
  SelectedFile,
} from "@/features/assembly-archive/shared/types";
import { ArchiveTree } from "./archive-tree";
import { DocumentDetailPanel } from "./document-detail-panel";
import { PromptPanel } from "./prompt-panel";

function fileKey(docid: number, fileId: number): string {
  return `${docid}-${fileId}`;
}

export function ArchiveBrowser({ cabinets }: { cabinets: Cabinet[] }) {
  const [selected, setSelected] = useState<DocumentNode | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Map<string, SelectedFile>>(
    new Map()
  );

  function isFileSelected(docid: number, fileId: number): boolean {
    return selectedFiles.has(fileKey(docid, fileId));
  }

  function onToggleFile(file: SelectedFile): void {
    setSelectedFiles((prev) => {
      const next = new Map(prev);
      const key = fileKey(file.doc.docid, file.fileId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, file);
      }
      return next;
    });
  }

  function onToggleAllFiles(
    doc: DocumentNode,
    files: DocumentFile[],
    selectAll: boolean
  ): void {
    setSelectedFiles((prev) => {
      const next = new Map(prev);
      for (const file of files) {
        const key = fileKey(doc.docid, file.fileId);
        if (selectAll) {
          next.set(key, {
            doc,
            fileId: file.fileId,
            fileName: file.fileName,
          });
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  }

  const files = [...selectedFiles.values()];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ArchiveTree
        cabinets={cabinets}
        onSelectDocument={setSelected}
        isFileSelected={isFileSelected}
        onToggleFile={onToggleFile}
        onToggleAllFiles={onToggleAllFiles}
      />
      <DocumentDetailPanel document={selected} />
      {files.length > 0 && (
        <PromptPanel
          files={files}
          onClear={() => setSelectedFiles(new Map())}
        />
      )}
    </div>
  );
}
