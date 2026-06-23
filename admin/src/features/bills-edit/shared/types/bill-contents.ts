import type { Database } from "@mirai-gikai/supabase";
import { z } from "zod";

// 既存の型を再利用
export type BillContent = Database["public"]["Tables"]["bill_contents"]["Row"];
export type BillContentUpdate =
  Database["public"]["Tables"]["bill_contents"]["Update"];

// 難易度レベルの型
export type DifficultyLevel = "normal" | "hard";

// バリデーションスキーマ
export const billContentUpdateSchema = z.object({
  title: z
    .string({ error: "タイトル（title）は文字列で入力してください" })
    .max(200, "タイトル（title）は200文字以内で入力してください")
    .optional()
    .default(""),
  summary: z
    .string({ error: "要約（summary）は文字列で入力してください" })
    .max(500, "要約（summary）は500文字以内で入力してください")
    .optional()
    .default(""),
  content: z
    .string({ error: "内容（content）は文字列で入力してください" })
    .max(50000, "内容（content）は50000文字以内で入力してください")
    .optional()
    .default(""),
});

export type BillContentUpdateInput = z.infer<typeof billContentUpdateSchema>;

// 2つの難易度レベル用の入力型
export const billContentsUpdateSchema = z.object({
  normal: billContentUpdateSchema,
  hard: billContentUpdateSchema,
});

export type BillContentsUpdateInput = z.infer<typeof billContentsUpdateSchema>;

// 難易度レベル設定
export const DIFFICULTY_LEVELS: { value: DifficultyLevel; label: string }[] = [
  { value: "normal", label: "ふつう" },
  { value: "hard", label: "難しい" },
];
