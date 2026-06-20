import Link from "next/link";
import { BillList } from "@/features/bills/server/components/bill-list/bill-list";
import { parseBillSortParams } from "@/features/bills/shared/utils/parse-bill-sort-params";
import { routes } from "@/lib/routes";

interface BillsPageProps {
  searchParams: Promise<{
    sort?: string;
    order?: string;
  }>;
}

export default async function BillsPage({ searchParams }: BillsPageProps) {
  const { sort, order } = await searchParams;
  const sortConfig = parseBillSortParams(sort, order);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">議案管理</h1>
          <p className="text-gray-600 mt-1">議案の一覧を確認・管理できます</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={routes.billImport()}
            className="inline-flex items-center px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            ドラフトインポート
          </Link>
          <Link
            href={routes.billNew()}
            className="inline-flex items-center px-3 py-2 text-sm bg-primary text-white rounded-md hover:opacity-90"
          >
            新規作成
          </Link>
        </div>
      </div>

      <BillList sortConfig={sortConfig} />
    </div>
  );
}
