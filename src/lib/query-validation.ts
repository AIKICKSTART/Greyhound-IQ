import { z } from "zod";

import { cleanText } from "@/lib/content";
import { canonicalFeedMode } from "@/lib/feed-pagination";

const queryIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/);

const searchTextSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => cleanText(value).replace(/\s+/g, " "));

const boundedIntegerSchema = (maximum: number, fallback: number) =>
  z.coerce.number().int().min(1).max(maximum).default(fallback);

export const listingCreatePrefillQuerySchema = z
  .object({
    dogId: queryIdentifierSchema.optional(),
    title: searchTextSchema(100).optional(),
    price: z
      .string()
      .trim()
      .regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/)
      .optional(),
  })
  .strict();

export const directorySearchQuerySchema = z
  .object({
    q: searchTextSchema(80).default(""),
    // Autocomplete pickers pass a small limit; clamp 1..100.
    limit: boundedIntegerSchema(100, 20),
    // Breeding surfaces pass breeding=1 to include non-racing studbook dogs.
    breeding: z.enum(["0", "1"]).optional(),
  })
  .strict();

export const feedPageQuerySchema = z
  .object({
    mode: z
      .enum(["public", "friends", "for-you", "latest"])
      .default("public")
      .transform(canonicalFeedMode),
    actorId: queryIdentifierSchema.optional(),
    cursor: z.string().trim().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
    limit: boundedIntegerSchema(50, 20),
  })
  .strict();

export const feedCommentPageQuerySchema = z
  .object({
    cursor: queryIdentifierSchema.optional(),
    limit: boundedIntegerSchema(50, 20),
  })
  .strict();

export const messageSearchQuerySchema = z
  .object({
    q: searchTextSchema(100).default(""),
    before: queryIdentifierSchema.optional(),
    limit: boundedIntegerSchema(50, 20),
  })
  .strict();

export const messageThreadQuerySchema = z
  .object({
    before: queryIdentifierSchema.optional(),
    call: z.enum(["voice", "video", "answer"]).optional(),
    q: searchTextSchema(100).default(""),
  })
  .strict();

export const listingApiQuerySchema = z
  .object({
    limit: boundedIntegerSchema(100, 100),
    type: z
      .enum(["pup_for_sale", "dog_for_sale", "stud_service", "wanted", "share"])
      .optional(),
    categoryId: queryIdentifierSchema.optional(),
    category: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"]).optional(),
    dog: queryIdentifierSchema.optional(),
    dogId: queryIdentifierSchema.optional(),
    q: searchTextSchema(100).optional(),
    sort: z.enum(["created_at", "price", "expires_at"]).optional(),
  })
  .strict();

export function queryParamsObject(searchParams: URLSearchParams) {
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  return query;
}
