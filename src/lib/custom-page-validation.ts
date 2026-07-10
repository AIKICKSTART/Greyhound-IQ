import { z } from "zod";
import { cleanText } from "@/lib/content";

export const CUSTOM_PAGE_TYPES = ["trainer", "punter", "business", "dog"] as const;
export type CustomPageType = (typeof CUSTOM_PAGE_TYPES)[number];

export const BUSINESS_CATEGORIES = [
  "stud",
  "transport",
  "vet",
  "supplies",
  "training",
  "other",
] as const;

export const DOG_SALE_STATUSES = ["for_sale", "stud", "not_available"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => {
      const cleaned = cleanText(v ?? "");
      return cleaned.length > 0 ? cleaned : null;
    });

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .optional()
  .nullable();

// Shared fields across every page type.
const baseFields = {
  title: z.string().trim().min(2).max(80).transform(cleanText),
  tagline: optionalText(140),
  about: optionalText(4000),
  contactEmail: z.string().trim().email().max(200).optional().nullable(),
  contactPhone: optionalText(40),
  contactVisibility: z
    .enum(["public", "members", "connections", "only_me"])
    .default("only_me"),
  website: z
    .string()
    .trim()
    .url()
    .max(200)
    .refine((u) => /^https?:\/\//i.test(u), "Only http(s) URLs")
    .optional()
    .nullable(),
  accentColor: hexColor,
  heroMediaId: z.string().trim().min(1).optional().nullable(),
  avatarMediaId: z.string().trim().min(1).optional().nullable(),
  bannerMediaId: z.string().trim().min(1).optional().nullable(),
  logoMediaId: z.string().trim().min(1).optional().nullable(),
  galleryMediaIds: z.array(z.string().trim().min(1)).max(12).default([]),
};

export const customPageCreateSchema = z.discriminatedUnion("pageType", [
  z.object({
    pageType: z.literal("trainer"),
    ...baseFields,
  }),
  z.object({
    pageType: z.literal("punter"),
    ...baseFields,
  }),
  z.object({
    pageType: z.literal("business"),
    ...baseFields,
    businessCategory: z.enum(BUSINESS_CATEGORIES).optional().nullable(),
  }),
  z.object({
    pageType: z.literal("dog"),
    dogId: z.string().trim().min(1),
    saleStatus: z.enum(DOG_SALE_STATUSES).optional().nullable(),
    priceOrFee: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
    ...baseFields,
  }),
]);

export type CustomPageCreateInput = z.infer<typeof customPageCreateSchema>;

// Update: same shape minus the immutable discriminator/dog link.
export const customPageUpdateSchema = z.object({
  ...baseFields,
  businessCategory: z.enum(BUSINESS_CATEGORIES).optional().nullable(),
  saleStatus: z.enum(DOG_SALE_STATUSES).optional().nullable(),
  priceOrFee: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
});

export type CustomPageUpdateInput = z.infer<typeof customPageUpdateSchema>;
