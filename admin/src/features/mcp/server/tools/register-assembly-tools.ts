import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchAssemblyDocuments } from "@/features/assembly-archive/server/repositories/assembly-document-repository";
import { jsonResult } from "../utils/json-result";

export function registerAssemblyTools(server: McpServer): void {
  server.registerTool(
    "search_assembly_documents",
    {
      title: "議会資料メタを検索",
      description:
        "取り込み済みのDiscussCabinet議会資料メタデータを件名で検索する。ノイズを避けるため sessionLabel（例: 令和8年6月定例会）で会期を絞ることを推奨。結果の cabinetId/folderId/docid は議案ドラフト生成のPDF取得にそのまま使える。",
      inputSchema: {
        query: z.string().optional(),
        sessionLabel: z.string().optional(),
        cabinetId: z.number().int().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ query, sessionLabel, cabinetId, dateFrom, dateTo, limit }) => {
      const results = await searchAssemblyDocuments({
        query,
        sessionLabel,
        cabinetId,
        dateFrom,
        dateTo,
        limit,
      });
      return jsonResult(results);
    }
  );
}
