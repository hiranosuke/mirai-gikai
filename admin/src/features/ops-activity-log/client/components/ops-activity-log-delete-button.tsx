"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteOpsActivityLog } from "../../server/actions/delete-ops-activity-log";

export function OpsActivityLogDeleteButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("この作業ログを削除しますか？")) {
      return;
    }
    setIsDeleting(true);
    try {
      const result = await deleteOpsActivityLog({ id });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("作業ログを削除しました");
      }
    } catch (error) {
      console.error("Delete ops activity log error:", error);
      toast.error("作業ログの削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={isDeleting}
      aria-label="削除"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
