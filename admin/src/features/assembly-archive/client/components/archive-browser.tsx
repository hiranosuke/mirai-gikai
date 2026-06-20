"use client";

import { useState } from "react";
import type { Cabinet, DocumentNode } from "@/features/assembly-archive/shared/types";
import { ArchiveTree } from "./archive-tree";
import { DocumentDetailPanel } from "./document-detail-panel";

export function ArchiveBrowser({ cabinets }: { cabinets: Cabinet[] }) {
  const [selected, setSelected] = useState<DocumentNode | null>(null);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ArchiveTree cabinets={cabinets} onSelectDocument={setSelected} />
      <DocumentDetailPanel document={selected} />
    </div>
  );
}
