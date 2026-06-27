"use client";

import { ClipboardCopy, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SelectedFile } from "@/features/assembly-archive/shared/types";
import { buildBillDraftPrompt } from "@/features/assembly-archive/shared/utils/build-bill-draft-prompt";

export function PromptPanel({
  files,
  onClear,
}: {
  files: SelectedFile[];
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(buildBillDraftPrompt(files));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-white p-4 shadow-lg">
      <span className="text-sm font-medium">{files.length}ファイル選択中</span>
      <div className="flex items-center gap-2">
        <Button onClick={copyPrompt}>
          <ClipboardCopy className="size-4" />
          {copied ? "コピーしました" : "プロンプトをコピー"}
        </Button>
        <Button variant="outline" onClick={onClear}>
          <X className="size-4" />
          選択をクリア
        </Button>
      </div>
    </div>
  );
}
