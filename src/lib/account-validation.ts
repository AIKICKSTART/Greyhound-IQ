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
  .refine(
    (value) =>
      !value ||
      (z.string().url().safeParse(value).success && /^https?:\/\//i.test(value)),
    { message: "Website must be a valid http(s) URL" }
  )
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
  profileVisibility: z
    .enum(["public", "members", "connections", "only_me"])
    .default("members"),
  contactVisibility: z
    .enum(["public", "members", "connections", "only_me"])
    .default("only_me"),
});

const optionalMediaId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .nullable()
  .transform((value) => value || null);

export const personalActorMediaUpdateSchema = z.object({
  avatarMediaId: optionalMediaId,
  coverMediaId: optionalMediaId,
  removeAvatar: z.boolean().default(false),
  removeCover: z.boolean().default(false),
  coverFocalX: z.coerce.number().min(0).max(1).default(0.5),
  coverFocalY: z.coerce.number().min(0).max(1).default(0.5),
});

export type PersonalActorMediaUpdateInput = z.infer<
  typeof personalActorMediaUpdateSchema
>;

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export function hasProfileMarketingFields(value: ProfileUpdateInput) {
  return Boolean(value.kennelName || value.kennelPrefix || value.website || value.phone);
}

export const dogOwnershipRoleSchema = z.enum([
  "owner",
  "breeder",
  "trainer",
  "co-owner",
]);

export const dogOwnershipClaimSchema = z.object({
  role: dogOwnershipRoleSchema,
  evidence: optionalText(1000),
});

export type DogOwnershipRole = z.infer<typeof dogOwnershipRoleSchema>;
