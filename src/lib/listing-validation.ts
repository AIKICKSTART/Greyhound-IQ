import { z } from "zod";
import { cleanText } from "@/lib/content";

const listingAttributeSchema = z.object({
  key: z.string().trim().min(1).max(40).transform(cleanText),
  value: z.string().trim().min(1).max(120).transform(cleanText),
});

export const listingWriteSchema = z.object({
  type: z.enum([
    "pup_for_sale",
    "dog_for_sale",
    "stud_service",
    "wanted",
    "share",
    "equipment",
    "float_trailer",
    "caravan",
    "supplies",
    "other",
  ]),
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
  sireDogId: z.string().trim().optional().nullable(),
  damDogId: z.string().trim().optional().nullable(),
  itemBrand: z.string().trim().max(80).optional().nullable().transform((value) => cleanText(value ?? "") || null),
  itemModel: z.string().trim().max(80).optional().nullable().transform((value) => cleanText(value ?? "") || null),
  price: z.number().nonnegative().optional().nullable(),
  welfareAcknowledged: z.boolean().optional().default(false),
  legalAcknowledged: z.boolean().optional().default(false),
  mediaIds: z.array(z.string().trim().min(1)).max(11).optional().default([]),
  attributes: z.array(listingAttributeSchema).max(8).optional().default([]),
}).strict();

export const listingPatchSchema = listingWriteSchema
  .partial()
  .extend({
    negotiable: z.boolean().optional(),
    contactPreference: z.enum(["message", "email", "phone"]).optional(),
    welfareAcknowledged: z.boolean().optional(),
    legalAcknowledged: z.boolean().optional(),
    mediaIds: z.array(z.string().trim().min(1)).max(11).optional(),
    attributes: z.array(listingAttributeSchema).max(8).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one listing field is required",
  });

export const listingEnquirySchema = z.object({
  message: z.string().trim().min(5).max(2_000).transform(cleanText),
});
