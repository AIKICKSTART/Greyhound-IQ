import { z } from "zod";
import { cleanText } from "@/lib/content";

export const listingWriteSchema = z.object({
  type: z.enum(["pup_for_sale", "dog_for_sale", "stud_service", "wanted", "share"]),
  title: z.string().trim().min(5).max(100).transform(cleanText),
  description: z.string().trim().min(20).max(5_000).transform(cleanText),
  state: z.string().trim().max(8).optional().nullable(),
  dogId: z.string().trim().optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
  mediaIds: z.array(z.string().trim().min(1)).max(11).optional().default([]),
});

export const listingPatchSchema = listingWriteSchema.partial().extend({
  mediaIds: z.array(z.string().trim().min(1)).max(11).optional(),
});
