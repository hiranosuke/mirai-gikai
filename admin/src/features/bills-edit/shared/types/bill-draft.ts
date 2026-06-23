import { z } from "zod";
import { isValidCalendarDate } from "../utils/is-valid-calendar-date";
import { billContentUpdateSchema } from "./bill-contents";

const billDraftMetaSchema = z.object({
  billId: z
    .string({ error: "billId は文字列で入力してください" })
    .uuid("billId はUUID形式で入力してください")
    .optional(),
  name: z
    .string({ error: "議案名（name）は必須です" })
    .min(1, "議案名（name）は必須です")
    .max(200, "議案名（name）は200文字以内で入力してください"),
  status: z
    .enum(
      [
        "preparing",
        "introduced",
        "in_originating_house",
        "in_receiving_house",
        "enacted",
        "rejected",
      ],
      {
        error:
          "ステータス（status）は preparing / introduced / in_originating_house / in_receiving_house / enacted / rejected のいずれかで入力してください",
      }
    )
    .default("preparing"),
  originating_house: z
    .enum(["HR", "HC"], {
      error: "提出院（originating_house）は HR または HC で入力してください",
    })
    .default("HR"),
  status_note: z
    .string({
      error: "ステータス備考（status_note）は文字列で入力してください",
    })
    .max(500, "ステータス備考（status_note）は500文字以内で入力してください")
    .nullable()
    .optional(),
  submitted_date: z
    .string({ error: "提出日（submitted_date）は文字列で入力してください" })
    .refine(
      (val) => val === "" || isValidCalendarDate(val),
      "提出日（submitted_date）は YYYY-MM-DD 形式の実在する日付で入力してください"
    )
    .optional(),
  slug: z
    .string({ error: "スラッグ（slug）は文字列で入力してください" })
    .max(200, "スラッグ（slug）は200文字以内で入力してください")
    .nullable()
    .optional(),
  diet_session_id: z
    .string({
      error: "国会回次ID（diet_session_id）は文字列で入力してください",
    })
    .uuid("国会回次ID（diet_session_id）はUUID形式で入力してください")
    .nullable()
    .optional(),
  knowledge_source: z
    .string({
      error: "ナレッジソース（knowledge_source）は文字列で入力してください",
    })
    .max(
      40_000,
      "ナレッジソース（knowledge_source）は40,000文字以内で入力してください"
    )
    .optional(),
  use_knowledge_source_in_chat: z
    .boolean({
      error:
        "use_knowledge_source_in_chat は真偽値（true / false）で入力してください",
    })
    .optional()
    .default(false),
  is_featured: z
    .boolean({
      error: "is_featured は真偽値（true / false）で入力してください",
    })
    .optional()
    .default(false),
  is_review_completed: z
    .boolean({
      error: "is_review_completed は真偽値（true / false）で入力してください",
    })
    .optional()
    .default(false),
});

export const billDraftSchema = billDraftMetaSchema.extend({
  contents: z
    .object(
      {
        normal: billContentUpdateSchema.optional(),
        hard: billContentUpdateSchema.optional(),
      },
      { error: "contents はオブジェクトで入力してください" }
    )
    .optional(),
  tagIds: z
    .array(z.string().uuid("tagIds の各要素はUUID形式で入力してください"), {
      error: "tagIds はUUIDの配列で入力してください",
    })
    .optional(),
});

export type BillDraftInput = z.infer<typeof billDraftSchema>;
