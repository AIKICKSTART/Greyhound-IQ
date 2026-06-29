import { z } from "zod";
import { cleanText } from "@/lib/content";

export const conversationStartSchema = z.object({
  recipientProfileId: z.string().trim().min(1).optional(),
  recipientId: z.string().trim().min(1).optional(),
}).refine((value) => value.recipientProfileId || value.recipientId, {
  message: "Recipient is required",
});

export const conversationMessageSchema = z.object({
  body: z.string().trim().min(1).max(5_000).transform(cleanText),
  mediaIds: z.array(z.string().trim().min(1)).max(4).optional().default([]),
});
