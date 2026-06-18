import type { Database } from "@mirai-gikai/supabase";
import { z } from "zod";

export type DiscussionPoints =
  Database["public"]["Tables"]["discussion_points"]["Row"];

// フォーム入力用の型とスキーマ
export const discussionPointsInputSchema = z.object({
  pro_points: z.string().optional(),
  con_points: z.string().optional(),
});

export type DiscussionPointsInput = z.infer<typeof discussionPointsInputSchema>;
