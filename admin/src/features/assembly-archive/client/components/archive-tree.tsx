"use client";

import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchTreeChildren } from "@/features/assembly-archive/server/actions/fetch-tree-children";
import type {
  Cabinet,
  DocumentNode,
  FolderNode,
  TreeChild,
} from "@/features/assembly-archive/shared/types";

type ExpandableProps = {
  label: string;
  cabinetId: number;
  folderId: number;
  move: "cabinet" | "down";
  depth: number;
  onSelectDocument: (doc: DocumentNode) => void;
};

function DocumentRow({
  doc,
  depth,
  onSelectDocument,
}: {
  doc: DocumentNode;
  depth: number;
  onSelectDocument: (doc: DocumentNode) => void;
}) {
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 font-normal"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onSelectDocument(doc)}
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-left">{doc.title}</span>
    </Button>
  );
}

function ExpandableFolder({
  label,
  cabinetId,
  folderId,
  move,
  depth,
  onSelectDocument,
}: ExpandableProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<TreeChild[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (children !== null || loading) return;
    setLoading(true);
    setError(null);
    const result = await fetchTreeChildren({ cabinetId, folderId, move });
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setChildren(result.data);
  }

  return (
    <div>
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 font-normal"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={toggle}
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
        <Folder className="size-4 shrink-0 text-primary" />
        <span className="truncate text-left">{label}</span>
        {loading && <Loader2 className="size-4 animate-spin" />}
      </Button>
      {expanded && error && (
        <p
          className="py-1 text-sm text-destructive"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          {error}
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
              onSelectDocument={onSelectDocument}
            />
          ) : (
            <DocumentRow
              key={`d-${child.docid}`}
              doc={child}
              depth={depth + 1}
              onSelectDocument={onSelectDocument}
            />
          )
        )}
    </div>
  );
}

export function ArchiveTree({
  cabinets,
  onSelectDocument,
}: {
  cabinets: Cabinet[];
  onSelectDocument: (doc: DocumentNode) => void;
}) {
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
          onSelectDocument={onSelectDocument}
        />
      ))}
    </div>
  );
}

export type { FolderNode };
