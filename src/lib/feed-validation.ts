import { z } from "zod";
import { cleanText } from "@/lib/content";

export const feedPostWriteSchema = z.object({
  topicId: z.string().trim().min(1).max(120).optional().nullable(),
  body: z.string().trim().min(2).max(5000).transform(cleanText),
  mediaIds: z.array(z.string().trim().min(1)).max(4).optional().default([]),
  // Owned CustomPage id to post as; ownership re-verified server-side.
  pageId: z.string().trim().min(1).max(120).optional().nullable(),
});

export const feedCommentWriteSchema = z.object({
  body: z.string().trim().min(2).max(2000).transform(cleanText),
  parentCommentId: z.string().trim().min(1).max(120).optional().nullable(),
});

export const feedReportSchema = z.object({
  reason: z
    .enum(["spam", "harassment", "misinformation", "illegal", "other"])
    .default("other"),
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

export const feedTopicWriteSchema = z.object({
  name: z.string().trim().min(2).max(80).transform(cleanText),
  slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => {
      const cleaned = cleanText(value ?? "");
      return cleaned.length > 0 ? cleaned : null;
    }),
  rules: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => {
      const cleaned = cleanText(value ?? "");
      return cleaned.length > 0 ? cleaned : null;
    }),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const feedPostModerationSchema = z.object({
  action: z.enum(["pin", "unpin", "hide", "remove", "restore"]),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => {
      const cleaned = cleanText(value ?? "");
      return cleaned.length > 0 ? cleaned : null;
    }),
});
