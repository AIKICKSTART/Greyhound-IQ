import { z } from "zod";
import {
  PRIVATE_USER_MEDIA_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
  SITE_ASSETS_BUCKET,
  isSupabaseStorageBucket,
  type SupabaseStorageBucket,
} from "@/lib/storage-paths";

export const MEDIA_CONTEXTS = [
  "site",
  "avatars",
  "dogs",
  "listings",
  "forum",
  "messages",
  "verification",
  "agent-outputs",
] as const;

export const MEDIA_MIME_LIMITS = {
  "image/jpeg": 10 * 1024 * 1024,
  "image/png": 10 * 1024 * 1024,
  "image/webp": 10 * 1024 * 1024,
  "image/avif": 10 * 1024 * 1024,
  "video/mp4": 200 * 1024 * 1024,
  "video/webm": 200 * 1024 * 1024,
  "video/quicktime": 200 * 1024 * 1024,
  "audio/mp4": 5 * 1024 * 1024,
  "audio/webm": 5 * 1024 * 1024,
  "audio/ogg": 5 * 1024 * 1024,
  "application/pdf": 25 * 1024 * 1024,
} as const;

const BUCKET_MIME_TYPES: Record<SupabaseStorageBucket, MediaMimeType[]> = {
  [SITE_ASSETS_BUCKET]: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "video/mp4",
    "video/webm",
  ],
  [PUBLIC_USER_MEDIA_BUCKET]: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ],
  [PRIVATE_USER_MEDIA_BUCKET]: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "audio/mp4",
    "audio/webm",
    "audio/ogg",
    "application/pdf",
  ],
};

export type MediaBucket = SupabaseStorageBucket;
export type MediaContext = (typeof MEDIA_CONTEXTS)[number];
export type MediaMimeType = keyof typeof MEDIA_MIME_LIMITS;

const mimeTypeSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value): value is MediaMimeType => value in MEDIA_MIME_LIMITS, {
    message: "Unsupported media type",
  });

const contextSchema = z
  .string()
  .trim()
  .refine((value): value is MediaContext =>
    MEDIA_CONTEXTS.includes(value as MediaContext)
  );

const bucketOrLegacyContextSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      isSupabaseStorageBucket(value) ||
      MEDIA_CONTEXTS.includes(value as MediaContext),
    "Unsupported media bucket or context"
  );

export const mediaSignUploadSchema = z.object({
  filename: z.string().trim().min(1).max(160),
  mimeType: mimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  bucket: bucketOrLegacyContextSchema.optional(),
  mediaContext: contextSchema.optional(),
  linkedEntityType: z.string().trim().min(1).max(80).optional(),
  linkedEntityId: z.string().trim().min(1).max(160).optional(),
});

export const mediaFinalizeSchema = z.object({
  sha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "SHA-256 must be 64 hex characters")
    .optional(),
  widthPx: z.number().int().positive().max(20_000).optional(),
  heightPx: z.number().int().positive().max(20_000).optional(),
  durationSec: z.number().positive().max(60 * 60).optional(),
  scanStatus: z.enum(["clean", "infected", "error"]).optional(),
});

export const mediaIdListSchema = z.array(z.string().trim().min(1)).max(4);

export function resolveMediaBucket(input: {
  bucket?: string;
  mediaContext?: MediaContext;
}): MediaBucket {
  if (input.bucket && isSupabaseStorageBucket(input.bucket)) {
    return input.bucket;
  }

  const context = resolveMediaContext(input);
  if (context === "site") return SITE_ASSETS_BUCKET;
  if (context === "messages" || context === "verification") {
    return PRIVATE_USER_MEDIA_BUCKET;
  }
  return PUBLIC_USER_MEDIA_BUCKET;
}

export function resolveMediaContext(input: {
  bucket?: string;
  mediaContext?: MediaContext;
}): MediaContext {
  if (input.mediaContext) return input.mediaContext;
  if (input.bucket && MEDIA_CONTEXTS.includes(input.bucket as MediaContext)) {
    return input.bucket as MediaContext;
  }
  if (input.bucket === SITE_ASSETS_BUCKET) return "site";
  if (input.bucket === PRIVATE_USER_MEDIA_BUCKET) return "messages";
  return "messages";
}

export function mediaMaxBytes(
  bucket: SupabaseStorageBucket,
  mimeType: MediaMimeType
) {
  if (!BUCKET_MIME_TYPES[bucket].includes(mimeType)) {
    throw new Error("media.unsupported_for_bucket");
  }
  return MEDIA_MIME_LIMITS[mimeType];
}

export function bucketAllowedMimeTypes(bucket: SupabaseStorageBucket) {
  return BUCKET_MIME_TYPES[bucket];
}
