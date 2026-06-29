import { z } from "zod";

export const MEDIA_BUCKETS = [
  "messages",
  "listings",
  "avatars",
  "agent-outputs",
] as const;

export const MEDIA_MIME_LIMITS = {
  "image/jpeg": 10 * 1024 * 1024,
  "image/png": 10 * 1024 * 1024,
  "image/webp": 10 * 1024 * 1024,
  "video/mp4": 200 * 1024 * 1024,
  "video/webm": 200 * 1024 * 1024,
  "audio/mp4": 5 * 1024 * 1024,
  "audio/webm": 5 * 1024 * 1024,
  "audio/ogg": 5 * 1024 * 1024,
} as const;

export type MediaBucket = (typeof MEDIA_BUCKETS)[number];
export type MediaMimeType = keyof typeof MEDIA_MIME_LIMITS;

const mimeTypeSchema = z
  .string()
  .trim()
  .refine((value): value is MediaMimeType => value in MEDIA_MIME_LIMITS, {
    message: "Unsupported media type",
  });

export const mediaSignUploadSchema = z.object({
  filename: z.string().trim().min(1).max(160),
  mimeType: mimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  bucket: z.enum(MEDIA_BUCKETS).optional().default("messages"),
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

export function mediaMaxBytes(mimeType: MediaMimeType) {
  return MEDIA_MIME_LIMITS[mimeType];
}
