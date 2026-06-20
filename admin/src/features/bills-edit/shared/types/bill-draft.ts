import { z } from "zod";
import { billContentUpdateSchema } from "./bill-contents";

const billDraftMetaSchema = z.object({
  billId: z.string().uuid().optional(),
  name: z
    .string()
    .min(1, "議案名は必須です")
    .max(200, "議案名は200文字以内で入力してください"),
  status: z
    .enum([
      "preparing",
      "introduced",
      "in_originating_house",
      "in_receiving_house",
      "enacted",
      "rejected",
    ])
    .default("preparing"),
  originating_house: z.enum(["HR", "HC"]).default("HR"),
  status_note: z
    .string()
    .max(500, "ステータス備考は500文字以内で入力してください")
    .nullable()
    .optional(),
  submitted_date: z
    .string()
    .refine(
      (val) => val === "" || /^\d{4}-\d{2}-\d{2}$/.test(val),
      "提出日は YYYY-MM-DD 形式で入力してください"
    )
    .optional(),
  slug: z.string().max(200).nullable().optional(),
  diet_session_id: z.string().uuid().nullable().optional(),
  knowledge_source: z
    .string()
    .max(40_000, "ナレッジソースは40,000文字以内で入力してください")
    .optional(),
  use_knowledge_source_in_chat: z.boolean().optional().default(false),
  is_featured: z.boolean().optional().default(false),
  is_review_completed: z.boolean().optional().default(false),
});

export const billDraftSchema = billDraftMetaSchema.extend({
  contents: z
    .object({
      normal: billContentUpdateSchema.optional(),
      hard: billContentUpdateSchema.optional(),
    })
    .optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export type BillDraftInput = z.infer<typeof billDraftSchema>;
