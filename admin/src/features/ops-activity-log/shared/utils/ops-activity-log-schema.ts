import { z } from "zod";

export const opsActivityTypeSchema = z.enum([
  "selection",
  "content",
  "interview_config",
  "review",
  "other",
]);

export const createOpsActivityLogSchema = z.object({
  bill_id: z.string().uuid().nullable(),
  activity_type: opsActivityTypeSchema,
  minutes: z.number().int().positive(),
  note: z.string().max(2000).nullish(),
  // 書式だけでなく実在日付までを検証する（例: 2026-13-99 を弾く）
  occurred_on: z.iso.date(),
});

export type CreateOpsActivityLogParsed = z.infer<
  typeof createOpsActivityLogSchema
>;
