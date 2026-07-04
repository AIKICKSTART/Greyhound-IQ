import { z } from "zod";
import { cleanText } from "@/lib/content";

const listingAttributeSchema = z.object({
  key: z.string().trim().min(1).max(40).transform(cleanText),
  value: z.string().trim().min(1).max(120).transform(cleanText),
});

export const listingWriteSchema = z.object({
  type: z.enum(["pup_for_sale", "dog_for_sale", "stud_service", "wanted", "share"]),
  categoryId: z.string().trim().min(1).max(120).optional().nullable(),
  title: z.string().trim().min(5).max(100).transform(cleanText),
  description: z.string().trim().min(20).max(5_000).transform(cleanText),
  state: z.string().trim().max(8).optional().nullable(),
  region: z.string().trim().max(120).optional().nullable().transform((value) => cleanText(value ?? "") || null),
  suburb: z.string().trim().max(120).optional().nullable().transform((value) => cleanText(value ?? "") || null),
  postcode: z.string().trim().max(16).optional().nullable().transform((value) => cleanText(value ?? "") || null),
  condition: z.string().trim().max(80).optional().nullable().transform((value) => cleanText(value ?? "") || null),
  negotiable: z.boolean().optional().default(false),
  contactPreference: z.enum(["message", "email", "phone"]).optional().default("message"),
  dogId: z.string().trim().optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
  welfareAcknowledged: z.boolean().optional().default(false),
  legalAcknowledged: z.boolean().optional().default(false),
  mediaIds: z.array(z.string().trim().min(1)).max(11).optional().default([]),
  attributes: z.array(listingAttributeSchema).max(8).optional().default([]),
});

export const listingPatchSchema = listingWriteSchema.partial().extend({
  mediaIds: z.array(z.string().trim().min(1)).max(11).optional(),
});
