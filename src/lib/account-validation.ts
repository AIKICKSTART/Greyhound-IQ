import { z } from "zod";
import { cleanText } from "@/lib/content";

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      const cleaned = cleanText(value ?? "");
      return cleaned.length > 0 ? cleaned : null;
    });
}

const optionalWebsite = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable()
  .transform((value) => cleanText(value ?? ""))
  .refine((value) => !value || z.string().url().safeParse(value).success, {
    message: "Website must be a valid URL",
  })
  .transform((value) => (value.length > 0 ? value : null));

export const profileUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .transform(cleanText)
    .refine((value) => value.length >= 2, {
      message: "Display name must be at least 2 characters",
    }),
  bio: optionalText(1000),
  state: optionalText(8),
  kennelName: optionalText(120),
  kennelPrefix: optionalText(40),
  website: optionalWebsite,
  phone: optionalText(40),
});

export const dogOwnershipRoleSchema = z.enum([
  "owner",
  "breeder",
  "trainer",
  "co-owner",
]);

export const dogOwnershipClaimSchema = z.object({
  role: dogOwnershipRoleSchema,
});

export type DogOwnershipRole = z.infer<typeof dogOwnershipRoleSchema>;
