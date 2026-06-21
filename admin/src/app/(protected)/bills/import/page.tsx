import Link from "next/link";
import { routes } from "@/lib/routes";
import { BillDraftImportForm } from "@/features/bills-edit/client/components/bill-draft-import-form";

export default function BillImportPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <Link
          href={routes.bills()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 議案管理
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2">
          ドラフトインポート
        </h1>
        <p className="text-gray-600 mt-1">
          AIが生成した議案ドラフトJSONを貼り付けて議案を作成または更新します。
        </p>
      </div>

      <BillDraftImportForm />
    </div>
  );
}
