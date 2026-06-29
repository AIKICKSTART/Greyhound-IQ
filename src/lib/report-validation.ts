import { z } from "zod";
import { cleanText } from "@/lib/content";

export const reportTargetTypeSchema = z.enum([
  "post",
  "thread",
  "listing",
  "message",
  "profile",
  "user",
]);

export const reportReasonSchema = z.enum([
  "spam",
  "harassment",
  "misinformation",
  "illegal",
  "other",
]);

export const reportCreateSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().trim().min(1).max(120).transform(cleanText),
  reason: reportReasonSchema,
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((value) => {
      const cleaned = cleanText(value ?? "");
      return cleaned.length > 0 ? cleaned : null;
    }),
});

export const reportResolveSchema = z.object({
  action: z.enum([
    "dismiss",
    "hide_content",
    "warn_user",
    "ban_user",
    "delete_content",
  ]),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((value) => {
      const cleaned = cleanText(value ?? "");
      return cleaned.length > 0 ? cleaned : null;
    }),
});
