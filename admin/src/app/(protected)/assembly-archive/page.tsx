import { ArchiveBrowser } from "@/features/assembly-archive/client/components/archive-browser";
import { ROOT_CABINETS } from "@/features/assembly-archive/shared/constants";

export default function AssemblyArchivePage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-8">議会資料</h1>
      <ArchiveBrowser cabinets={ROOT_CABINETS} />
    </div>
  );
}
