import { z } from "zod";
import {
  PRIVATE_USER_MEDIA_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
  SITE_ASSETS_BUCKET,
  isObjectStorageBucket,
  type ObjectStorageBucket,
} from "@/lib/storage-paths";

export const MEDIA_CONTEXTS = [
  "site",
  "avatars",
  "dogs",
  "listings",
  "feed",
  "forum",
  "messages",
  "verification",
  "agent-outputs",
  "custom-page",
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

const BUCKET_MIME_TYPES: Record<ObjectStorageBucket, MediaMimeType[]> = {
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

export type MediaBucket = ObjectStorageBucket;
export type MediaContext = (typeof MEDIA_CONTEXTS)[number];
export type MediaMimeType = keyof typeof MEDIA_MIME_LIMITS;

export const MEDIA_MAX_DIMENSION_PX = 20_000;
export const MEDIA_MAX_DURATION_SEC = 60 * 60;
export const MEDIA_DURATION_CLAIM_TOLERANCE_SEC = 1;

export type DecodedMediaKind = "image" | "video" | "audio";
export type MediaDimensionDurationMetadata = {
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
};

const MEDIA_EXTENSIONS: Readonly<Record<MediaMimeType, readonly string[]>> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "video/mp4": ["mp4", "m4v"],
  "video/webm": ["webm"],
  "video/quicktime": ["mov", "qt"],
  "audio/mp4": ["m4a", "mp4"],
  "audio/webm": ["webm"],
  "audio/ogg": ["ogg", "oga"],
  "application/pdf": ["pdf"],
};

export const WEBVTT_MAX_BYTES = 256 * 1024;
const WEBVTT_CONTENT_TYPE = "text/vtt";
const WEBVTT_TIMING_LINE = /^(\d{2,}:[0-5]\d:[0-5]\d\.\d{3}|[0-5]\d:[0-5]\d\.\d{3})\s+-->\s+(\d{2,}:[0-5]\d:[0-5]\d\.\d{3}|[0-5]\d:[0-5]\d\.\d{3})(?:\s+.*)?$/;

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
      isObjectStorageBucket(value) ||
      MEDIA_CONTEXTS.includes(value as MediaContext),
    "Unsupported media bucket or context"
  );

const mediaAltTextSchema = z
  .string()
  .max(500)
  .transform((value) =>
    value
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

export function normalizeUploadFilename(filename: string) {
  const leaf = filename.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  const safe = leaf
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 160);
  return safe || "upload.bin";
}

export const mediaSignUploadSchema = z
  .object({
    filename: z.string().trim().min(1).max(160).transform(normalizeUploadFilename),
    mimeType: mimeTypeSchema,
    sizeBytes: z.number().int().positive(),
    bucket: bucketOrLegacyContextSchema.optional(),
    mediaContext: contextSchema.optional(),
    linkedEntityType: z.string().trim().min(1).max(80).optional(),
    linkedEntityId: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .refine(
    (value) => uploadFilenameMatchesMimeType(value.filename, value.mimeType),
    { path: ["filename"], message: "File extension does not match media type" },
  );

export function uploadFilenameMatchesMimeType(
  filename: string,
  mimeType: MediaMimeType,
) {
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const allowed = MEDIA_EXTENSIONS[mimeType];
  return Boolean(extension && allowed?.includes(extension));
}

export function validateDecodedMediaMetadata(
  kind: "image",
  decoded: MediaDimensionDurationMetadata,
  claimed?: MediaDimensionDurationMetadata,
): { width: number; height: number };
export function validateDecodedMediaMetadata(
  kind: "video",
  decoded: MediaDimensionDurationMetadata,
  claimed?: MediaDimensionDurationMetadata,
): {
  width: number;
  height: number;
  durationSec: number;
};
export function validateDecodedMediaMetadata(
  kind: "audio",
  decoded: MediaDimensionDurationMetadata,
  claimed?: MediaDimensionDurationMetadata,
): { durationSec: number };
export function validateDecodedMediaMetadata(
  kind: DecodedMediaKind,
  decoded: MediaDimensionDurationMetadata,
  claimed: MediaDimensionDurationMetadata = {},
): MediaDimensionDurationMetadata {
  if (kind === "audio") {
    if (claimed.width != null || claimed.height != null) {
      throw new Error("media.metadata_mismatch");
    }
  } else {
    validateDecodedDimensions(decoded);
    if (
      (claimed.width != null && claimed.width !== decoded.width) ||
      (claimed.height != null && claimed.height !== decoded.height)
    ) {
      throw new Error("media.metadata_mismatch");
    }
  }

  if (kind === "image") {
    if (claimed.durationSec != null) {
      throw new Error("media.metadata_mismatch");
    }
  } else {
    validateDecodedDuration(decoded.durationSec);
    if (
      claimed.durationSec != null &&
      Math.abs(claimed.durationSec - decoded.durationSec!) >
        MEDIA_DURATION_CLAIM_TOLERANCE_SEC
    ) {
      throw new Error("media.metadata_mismatch");
    }
  }
  if (kind === "image") {
    return { width: decoded.width!, height: decoded.height! };
  }
  if (kind === "audio") {
    return { durationSec: decoded.durationSec! };
  }
  return {
    width: decoded.width!,
    height: decoded.height!,
    durationSec: decoded.durationSec!,
  };
}

function validateDecodedDimensions(decoded: MediaDimensionDurationMetadata) {
  if (
    !Number.isSafeInteger(decoded.width) ||
    !Number.isSafeInteger(decoded.height) ||
    decoded.width! <= 0 ||
    decoded.height! <= 0
  ) {
    throw new Error("media.decoded_metadata_invalid");
  }
  if (
    decoded.width! > MEDIA_MAX_DIMENSION_PX ||
    decoded.height! > MEDIA_MAX_DIMENSION_PX
  ) {
    throw new Error("media.dimensions_exceeded");
  }
}

function validateDecodedDuration(durationSec: number | null | undefined) {
  if (!Number.isFinite(durationSec) || durationSec! <= 0) {
    throw new Error("media.decoded_metadata_invalid");
  }
  if (durationSec! > MEDIA_MAX_DURATION_SEC) {
    throw new Error("media.duration_exceeded");
  }
}

export const mediaFinalizeSchema = z.object({
  sha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "SHA-256 must be 64 hex characters")
    .optional(),
  widthPx: z.number().int().positive().max(MEDIA_MAX_DIMENSION_PX).optional(),
  heightPx: z.number().int().positive().max(MEDIA_MAX_DIMENSION_PX).optional(),
  durationSec: z.number().positive().max(MEDIA_MAX_DURATION_SEC).optional(),
  altText: mediaAltTextSchema.optional(),
}).strict();

export const mediaMetadataUpdateSchema = z
  .object({
    altText: mediaAltTextSchema.nullable().optional(),
  })
  .refine(
    (value) => value.altText !== undefined,
    "At least one media metadata field is required"
  );

export const mediaIdListSchema = z.array(z.string().trim().min(1)).max(4);

export function resolveMediaBucket(input: {
  bucket?: string;
  mediaContext?: MediaContext;
}): MediaBucket {
  const context = resolveMediaContext(input);
  if (context === "site") return SITE_ASSETS_BUCKET;
  return PRIVATE_USER_MEDIA_BUCKET;
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
  bucket: ObjectStorageBucket,
  mimeType: MediaMimeType
) {
  if (!BUCKET_MIME_TYPES[bucket].includes(mimeType)) {
    throw new Error("media.unsupported_for_bucket");
  }
  return MEDIA_MIME_LIMITS[mimeType];
}

export function bucketAllowedMimeTypes(bucket: ObjectStorageBucket) {
  return BUCKET_MIME_TYPES[bucket];
}

export async function readWebVttUpload(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== WEBVTT_CONTENT_TYPE) {
    throw new Error("media.caption_type_invalid");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    if (!/^\d+$/.test(contentLength)) throw new Error("media.caption_invalid");
    if (Number(contentLength) > WEBVTT_MAX_BYTES) throw new Error("media.too_large");
  }

  if (!request.body) throw new Error("media.caption_invalid");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > WEBVTT_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("media.too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  validateWebVttCaption(bytes);
  return bytes;
}

export function validateWebVttCaption(bytes: Uint8Array) {
  if (bytes.byteLength === 0) throw new Error("media.caption_invalid");
  if (bytes.byteLength > WEBVTT_MAX_BYTES) throw new Error("media.too_large");

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("media.caption_invalid");
  }
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) {
    throw new Error("media.caption_invalid");
  }

  const lines = text.split("\n");
  if (!/^WEBVTT(?:[ \t].*)?$/.test(lines[0] ?? "") || lines[1] !== "") {
    throw new Error("media.caption_invalid");
  }

  let cues = 0;
  for (let index = 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes("-->")) continue;
    const match = WEBVTT_TIMING_LINE.exec(line);
    if (
      !match ||
      timestampMilliseconds(match[2]) <= timestampMilliseconds(match[1]) ||
      !lines[index + 1]?.trim()
    ) {
      throw new Error("media.caption_invalid");
    }
    cues += 1;
  }
  if (cues === 0) throw new Error("media.caption_invalid");
}

function timestampMilliseconds(value: string) {
  const parts = value.split(":");
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop());
  const hours = Number(parts.pop() ?? 0);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}
