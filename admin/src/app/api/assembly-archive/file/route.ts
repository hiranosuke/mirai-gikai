import { createDiscussCabinetClient } from "@/features/assembly-archive/server/clients/discuss-cabinet-client";
import { requireAdmin } from "@/features/auth/server/lib/auth-server";

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * DiscussCabinet の添付ファイル（PDF等）を admin サーバー経由で取得して返す。
 * DiscussCabinet は POST 遷移のため直リンクできないので、ここでセッションを確立し
 * file_view を POST してファイル本体をストリーム返却する。
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const cabinetId = parsePositiveInt(params.get("cabinetId"));
  const folderId = parsePositiveInt(params.get("folderId"));
  const docid = parsePositiveInt(params.get("docid"));
  const fileId = parsePositiveInt(params.get("fileId"));
  if (
    cabinetId === null ||
    folderId === null ||
    docid === null ||
    fileId === null
  ) {
    return new Response("Invalid parameters", { status: 400 });
  }

  try {
    const client = createDiscussCabinetClient();
    const { body, contentType } = await client.fetchFile({
      cabinetId,
      folderId,
      docid,
      fileId,
    });
    const fileName = params.get("name") ?? "file";
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
          fileName
        )}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[AssemblyArchive] file fetch failed:", error);
    return new Response("ファイルの取得に失敗しました", { status: 502 });
  }
}
