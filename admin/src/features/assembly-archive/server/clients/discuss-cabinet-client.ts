import "server-only";

import { DISCUSS_CABINET_BASE_URL } from "../../shared/constants";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface DiscussCabinetClient {
  fetchFolderList(input: {
    cabinetId: number;
    folderId: number;
    move: "cabinet" | "down";
  }): Promise<string>;
  fetchDocView(input: {
    cabinetId: number;
    folderId: number;
    docid: number;
  }): Promise<string>;
  fetchFile(input: {
    cabinetId: number;
    folderId: number;
    docid: number;
    fileId: number;
  }): Promise<{ body: ArrayBuffer; contentType: string }>;
}

const FORM_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
};

function extractCookie(response: Response): string {
  // Node(undici)では getSetCookie() が使える
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

export function createDiscussCabinetClient(
  fetchImpl: FetchLike = fetch
): DiscussCabinetClient {
  async function establishSession(): Promise<string> {
    const response = await fetchImpl(`${DISCUSS_CABINET_BASE_URL}/list`, {
      method: "POST",
      headers: FORM_HEADERS,
      body: "",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(
        `DiscussCabinet セッション確立に失敗: HTTP ${response.status}`
      );
    }
    return extractCookie(response);
  }

  async function postForm(
    path: string,
    params: Record<string, string | number>
  ): Promise<string> {
    const cookie = await establishSession();
    const body = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    const response = await fetchImpl(`${DISCUSS_CABINET_BASE_URL}${path}`, {
      method: "POST",
      headers: { ...FORM_HEADERS, Cookie: cookie },
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`DiscussCabinet 取得に失敗: HTTP ${response.status}`);
    }
    return response.text();
  }

  return {
    fetchFolderList({ cabinetId, folderId, move }) {
      return postForm("/list", {
        cabinet_id: cabinetId,
        folder_id: folderId,
        move,
        actions: "",
        order: "",
        start: 0,
        docid: "",
        refer: "",
      });
    },
    fetchDocView({ cabinetId, folderId, docid }) {
      return postForm("/doc_view", {
        cabinet_id: cabinetId,
        folder_id: folderId,
        docid,
        move: "",
        actions: "",
        order: "",
        start: 0,
        refer: "",
      });
    },
    async fetchFile({ cabinetId, folderId, docid, fileId }) {
      const cookie = await establishSession();
      const body = new URLSearchParams({
        userid: "",
        password: "",
        cabinet_id: String(cabinetId),
        folder_id: String(folderId),
        docid: String(docid),
        refer: "",
        fileid: String(fileId),
        tmpid: "",
        new_arrival: "",
        order: "",
        start: "0",
        actions: "return",
        filerefer: "docview",
      }).toString();
      const response = await fetchImpl(
        `${DISCUSS_CABINET_BASE_URL}/file_view`,
        {
          method: "POST",
          headers: { ...FORM_HEADERS, Cookie: cookie },
          body,
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!response.ok) {
        throw new Error(
          `DiscussCabinet ファイル取得に失敗: HTTP ${response.status}`
        );
      }
      return {
        body: await response.arrayBuffer(),
        contentType:
          response.headers.get("content-type") ?? "application/octet-stream",
      };
    },
  };
}
