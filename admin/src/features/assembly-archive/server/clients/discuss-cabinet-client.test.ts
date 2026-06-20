import { describe, expect, it, vi } from "vitest";
import { createDiscussCabinetClient } from "./discuss-cabinet-client";

function makeResponse(body: string, setCookie?: string): Response {
  const headers = new Headers();
  if (setCookie) headers.append("set-cookie", setCookie);
  return new Response(body, { status: 200, headers });
}

describe("discussCabinetClient", () => {
  it("セッション確立後、cookie付きで list を POST し HTML を返す", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return makeResponse("<html></html>", "SESSION=abc; path=/");
      }
      return makeResponse("<html>folders</html>");
    });

    const client = createDiscussCabinetClient(fetchImpl);
    const html = await client.fetchFolderList({
      cabinetId: 1,
      folderId: 0,
      move: "cabinet",
    });

    expect(html).toBe("<html>folders</html>");
    // 1回目: セッション確立、2回目: 本リクエスト
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain("/list");
    expect(calls[1].init.method).toBe("POST");
    const body = String(calls[1].init.body);
    expect(body).toContain("cabinet_id=1");
    expect(body).toContain("folder_id=0");
    expect(body).toContain("move=cabinet");
    expect((calls[1].init.headers as Record<string, string>).Cookie).toContain(
      "SESSION=abc"
    );
  });

  it("fetchDocView は doc_view を docid 付きで POST する", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return makeResponse("<html></html>", "SESSION=z; path=/");
      }
      return makeResponse("<html>doc</html>");
    });

    const client = createDiscussCabinetClient(fetchImpl);
    const html = await client.fetchDocView({
      cabinetId: 1,
      folderId: 224514,
      docid: 15337,
    });

    expect(html).toBe("<html>doc</html>");
    expect(calls[1].url).toContain("/doc_view");
    const body = String(calls[1].init.body);
    expect(body).toContain("docid=15337");
    expect(body).toContain("folder_id=224514");
  });
});
