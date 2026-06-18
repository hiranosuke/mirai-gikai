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
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CreateOpsActivityLogParsed = z.infer<
  typeof createOpsActivityLogSchema
>;
