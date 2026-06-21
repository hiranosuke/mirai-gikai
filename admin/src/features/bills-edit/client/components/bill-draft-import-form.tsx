"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { upsertBillDraftAction } from "../../server/actions/upsert-bill-draft-action";
import { billDraftSchema } from "../../shared/types/bill-draft";

type ParseState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; preview: BillPreview; raw: unknown };

type BillPreview = {
  name: string;
  status: string;
  billId?: string;
  hasNormalContent: boolean;
  hasHardContent: boolean;
  tagCount: number;
  tagIdsProvided: boolean;
};

function parseJson(
  text: string
): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      message: "JSONのパースに失敗しました。構文を確認してください。",
    };
  }
}

function buildPreview(
  parsed: ReturnType<typeof billDraftSchema.safeParse>
): BillPreview | null {
  if (!parsed.success) return null;
  const draft = parsed.data;
  return {
    name: draft.name,
    status: draft.status,
    billId: draft.billId,
    hasNormalContent: !!(
      draft.contents?.normal?.title || draft.contents?.normal?.content
    ),
    hasHardContent: !!(
      draft.contents?.hard?.title || draft.contents?.hard?.content
    ),
    tagCount: draft.tagIds?.length ?? 0,
    tagIdsProvided: draft.tagIds !== undefined,
  };
}

const STATUS_LABELS: Record<string, string> = {
  preparing: "準備中",
  introduced: "提出済み",
  in_originating_house: "審議中（提出院）",
  in_receiving_house: "審議中（参院）",
  enacted: "可決成立",
  rejected: "否決・廃案",
};

export function BillDraftImportForm() {
  const router = useRouter();
  const [jsonText, setJsonText] = useState("");
  const [parseState, setParseState] = useState<ParseState>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleParse() {
    const jsonResult = parseJson(jsonText.trim());
    if (!jsonResult.ok) {
      setParseState({ status: "error", message: jsonResult.message });
      return;
    }

    const schemaResult = billDraftSchema.safeParse(jsonResult.value);
    if (!schemaResult.success) {
      const messages = schemaResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      setParseState({ status: "error", message: messages });
      return;
    }

    const preview = buildPreview(schemaResult);
    if (!preview) {
      setParseState({
        status: "error",
        message: "プレビューの生成に失敗しました。",
      });
      return;
    }
    setParseState({ status: "ready", preview, raw: jsonResult.value });
    setSubmitError(null);
  }

  async function handleSubmit() {
    if (parseState.status !== "ready") return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const result = await upsertBillDraftAction(parseState.raw);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      router.push(routes.billEdit(result.billId));
    } catch {
      setSubmitError("保存処理中に予期しないエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isReady = parseState.status === "ready";

  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="draft-json"
          className="block text-sm font-medium text-foreground mb-2"
        >
          議案ドラフトJSON
        </label>
        <textarea
          id="draft-json"
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            if (parseState.status !== "idle") {
              setParseState({ status: "idle" });
            }
          }}
          rows={18}
          className="w-full font-mono text-sm border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={JSON.stringify(
            {
              name: "令和8年度補正予算（第1号）",
              status: "preparing",
              submitted_date: "2026-06-03",
              knowledge_source: "本文テキスト...",
              contents: {
                normal: {
                  title: "タイトル",
                  summary: "要約",
                  content: "本文...",
                },
                hard: {
                  title: "タイトル",
                  summary: "要約",
                  content: "本文...",
                },
              },
            },
            null,
            2
          )}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleParse}
        disabled={!jsonText.trim()}
      >
        確認
      </Button>

      {parseState.status === "error" && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-medium text-red-800 mb-1">入力エラー</p>
          <pre className="text-xs text-red-700 whitespace-pre-wrap">
            {parseState.message}
          </pre>
        </div>
      )}

      {isReady && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-green-800">
            {parseState.preview.billId
              ? "✓ 更新対象を確認しました"
              : "✓ 新規作成内容を確認しました"}
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500">操作</dt>
            <dd className="font-medium">
              {parseState.preview.billId
                ? `更新（ID: ${parseState.preview.billId.slice(0, 8)}…）`
                : "新規作成"}
            </dd>
            <dt className="text-gray-500">議案名</dt>
            <dd className="font-medium">{parseState.preview.name}</dd>
            <dt className="text-gray-500">ステータス</dt>
            <dd>
              {STATUS_LABELS[parseState.preview.status] ??
                parseState.preview.status}
            </dd>
            <dt className="text-gray-500">コンテンツ（ふつう）</dt>
            <dd>{parseState.preview.hasNormalContent ? "あり" : "なし"}</dd>
            <dt className="text-gray-500">コンテンツ（難しい）</dt>
            <dd>{parseState.preview.hasHardContent ? "あり" : "なし"}</dd>
            <dt className="text-gray-500">タグ</dt>
            <dd>
              {!parseState.preview.tagIdsProvided
                ? "指定なし（既存を維持）"
                : parseState.preview.tagCount > 0
                  ? `${parseState.preview.tagCount}件`
                  : "0件（既存タグを全て解除）"}
            </dd>
          </dl>

          {submitError && (
            <p className="text-sm text-red-700 border-t border-green-200 pt-2">
              エラー: {submitError}
            </p>
          )}

          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? "保存中..."
              : parseState.preview.billId
                ? "更新する"
                : "作成する"}
          </Button>
        </div>
      )}
    </div>
  );
}
