import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/account-service";
import {
  isModeratorRole,
  type CurrentUser,
  type CurrentUserProfile,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  mediaMaxBytes,
  resolveMediaBucket,
  resolveMediaContext,
  type MediaContext,
  type MediaMimeType,
} from "@/lib/media-validation";
import {
  PRIVATE_USER_MEDIA_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
  SITE_ASSETS_BUCKET,
  isPublicStorageBucket,
  mediaTypeForMimeType,
  publicStorageUrl,
  type SupabaseStorageBucket,
} from "@/lib/storage-paths";
import {
  createSignedStorageDownloadUrl,
  createSignedStorageUploadUrl,
  downloadStorageObject,
  getStorageObjectInfo,
  removeStorageObject,
} from "@/lib/supabase-storage";

const UPLOAD_URL_TTL_MS = 2 * 60 * 60 * 1000;
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

const QUOTA_BYTES = {
  free: 1 * 1024 * 1024 * 1024,
  pro: 10 * 1024 * 1024 * 1024,
  pro_plus: 100 * 1024 * 1024 * 1024,
} as const;

type Tx = Prisma.TransactionClient;

export interface SignedUploadIntentInput {
  filename: string;
  mimeType: MediaMimeType;
  sizeBytes: number;
  bucket?: string;
  mediaContext?: MediaContext;
  linkedEntityType?: string;
  linkedEntityId?: string;
}

export interface FinalizeMediaInput {
  sha256?: string;
  widthPx?: number;
  heightPx?: number;
  durationSec?: number;
  scanStatus?: "clean" | "infected" | "error";
}

export async function createSignedUploadIntent(
  current: CurrentUserProfile,
  input: SignedUploadIntentInput,
  _origin?: string
) {
  void _origin;

  const bucket = resolveMediaBucket(input);
  const mediaContext = resolveMediaContext(input);
  assertUploadAllowedForContext(bucket, mediaContext, current);
  assertMediaSize(bucket, input.mimeType, input.sizeBytes);
  await assertQuotaAvailable(current, input.sizeBytes);

  const objectPath = buildObjectPath({
    bucket,
    context: mediaContext,
    userId: current.dbUserId,
    linkedEntityId: input.linkedEntityId,
    filename: input.filename,
  });
  const signedUpload = await createSignedStorageUploadUrl(bucket, objectPath);
  const publicUrl = publicUrlForMedia(bucket, objectPath);
  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS);

  const media = await prisma.mediaAsset.create({
    data: {
      uploaderId: current.dbUserId,
      storageBucket: bucket,
      storagePath: objectPath,
      publicUrl,
      mediaType: mediaTypeForMimeType(input.mimeType),
      originalName: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      linkedEntityType: input.linkedEntityType ?? null,
      linkedEntityId: input.linkedEntityId ?? null,
      expiresAt,
      scanStatus: "pending",
    },
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "media.sign_upload",
    targetType: "media",
    targetId: media.id,
    metadata: {
      bucket,
      objectPath,
      mediaContext,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageMode: "supabase_storage",
    },
  });

  return {
    mediaId: media.id,
    bucket,
    objectPath,
    uploadUrl: signedUpload.signedUrl,
    uploadToken: signedUpload.token,
    publicUrl,
    expiresAt: expiresAt.toISOString(),
    storageMode: "supabase_storage",
  };
}

export async function finalizeMediaUpload(
  current: CurrentUserProfile,
  mediaId: string,
  input: FinalizeMediaInput
) {
  const media = await prisma.mediaAsset.findFirst({
    where: {
      id: mediaId,
      uploaderId: current.dbUserId,
      deletedAt: null,
    },
  });
  if (!media) throw new Error("media.not_found");

  const bucket = assertKnownBucket(media.storageBucket);

  if (input.scanStatus === "infected") {
    await markMediaScanStatus(media.id, "infected");
    throw new Error("media.infected");
  }
  if (input.scanStatus === "error") {
    await markMediaScanStatus(media.id, "error");
    throw new Error("media.scan_failed");
  }

  const objectInfo = await getStorageObjectInfo(bucket, media.storagePath);
  const sizeBytes =
    typeof objectInfo.size === "number" && objectInfo.size > 0
      ? objectInfo.size
      : media.sizeBytes;

  assertMediaSize(bucket, media.mimeType as MediaMimeType, sizeBytes);
  await assertQuotaAvailable(current, 0);

  const finalized = await prisma.mediaAsset.update({
    where: { id: media.id },
    data: {
      sha256: input.sha256?.toLowerCase() ?? media.sha256,
      sizeBytes,
      widthPx: input.widthPx ?? null,
      heightPx: input.heightPx ?? null,
      durationSec: input.durationSec ?? null,
      mediaType: mediaTypeForMimeType(media.mimeType),
      publicUrl: publicUrlForMedia(bucket, media.storagePath),
      scanStatus: "clean",
      scanCompletedAt: new Date(),
      expiresAt: null,
    },
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "media.finalize",
    targetType: "media",
    targetId: finalized.id,
    metadata: {
      bucket: finalized.storageBucket,
      objectPath: finalized.storagePath,
      mimeType: finalized.mimeType,
      sizeBytes: finalized.sizeBytes,
      scanStatus: finalized.scanStatus,
      storageMode: "supabase_storage",
    },
  });

  return finalized;
}

export async function getMediaForCurrentUser(
  current: CurrentUserProfile,
  mediaId: string
) {
  const media = await prisma.mediaAsset.findFirst({
    where: mediaAccessWhere(mediaId, current),
    include: {
      messageAttachments: { select: { messageId: true, position: true } },
      listingAttachments: { select: { listingId: true, position: true } },
    },
  });
  if (!media) throw new Error("media.not_found");
  return media;
}

export async function createMediaDownloadUrl(
  current: CurrentUserProfile,
  mediaId: string,
  _origin?: string
) {
  void _origin;

  const media = await getMediaForCurrentUser(current, mediaId);
  assertMediaClean(media.scanStatus);

  const bucket = assertKnownBucket(media.storageBucket);
  const publicUrl = mediaPublicUrl(media);
  if (publicUrl) {
    return {
      mediaId: media.id,
      url: publicUrl,
      expiresAt: null,
      storageMode: "supabase_public",
    };
  }

  const signedUrl = await createSignedStorageDownloadUrl(
    bucket,
    media.storagePath,
    DOWNLOAD_URL_TTL_SECONDS
  );
  const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000);

  return {
    mediaId: media.id,
    url: signedUrl,
    expiresAt: expiresAt.toISOString(),
    storageMode: "supabase_signed",
  };
}

export async function deleteMediaForCurrentUser(
  current: CurrentUserProfile,
  mediaId: string
) {
  const media = await prisma.mediaAsset.findFirst({
    where: {
      id: mediaId,
      deletedAt: null,
      OR: [
        { uploaderId: current.dbUserId },
        ...(isModeratorRole(current.profileRole) ? [{}] : []),
      ],
    },
  });
  if (!media) throw new Error("media.not_found");

  const bucket = assertKnownBucket(media.storageBucket);
  await removeStorageObject(bucket, media.storagePath);

  const deleted = await prisma.mediaAsset.update({
    where: { id: media.id },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "media.delete",
    targetType: "media",
    targetId: media.id,
    metadata: {
      bucket: media.storageBucket,
      objectPath: media.storagePath,
    },
  });

  return deleted;
}

export async function getMediaBlob(
  mediaId: string,
  current: CurrentUser | null,
  _expires: string | null,
  _token: string | null
) {
  void _expires;
  void _token;

  const media = current?.profileId
    ? await prisma.mediaAsset.findFirst({
        where: mediaAccessWhere(mediaId, {
          ...current,
          dbUserId: current.dbUserId ?? "",
          profileId: current.profileId,
        }),
      })
    : await prisma.mediaAsset.findFirst({
        where: {
          id: mediaId,
          deletedAt: null,
          scanStatus: "clean",
          OR: [
            { storageBucket: SITE_ASSETS_BUCKET },
            {
              storageBucket: PUBLIC_USER_MEDIA_BUCKET,
              listingAttachments: {
                some: {
                  listing: publicListingMediaWhere(),
                },
              },
            },
          ],
        },
      });

  if (!media) throw new Error("media.not_found");
  assertMediaClean(media.scanStatus);

  const bucket = assertKnownBucket(media.storageBucket);
  const blob = await downloadStorageObject(bucket, media.storagePath);

  return {
    media,
    blob,
  };
}

export async function assertMediaAttachable(
  current: CurrentUserProfile,
  mediaIds: string[],
  max = 4
) {
  const uniqueIds = [...new Set(mediaIds)];
  if (uniqueIds.length > max) throw new Error("media.too_many");
  if (uniqueIds.length !== mediaIds.length) throw new Error("media.duplicate");
  if (uniqueIds.length === 0) return [];

  const media = await prisma.mediaAsset.findMany({
    where: {
      id: { in: uniqueIds },
      uploaderId: current.dbUserId,
      deletedAt: null,
    },
  });

  if (media.length !== uniqueIds.length) throw new Error("media.not_found");
  for (const item of media) {
    assertMediaClean(item.scanStatus);
  }

  const byId = new Map(media.map((item) => [item.id, item]));
  return uniqueIds.map((id) => byId.get(id)!);
}

export async function attachMediaToListing(
  tx: Tx,
  listingId: string,
  mediaIds: string[]
) {
  if (mediaIds.length === 0) return;

  await tx.listingMedia.createMany({
    data: mediaIds.map((mediaId, position) => ({
      listingId,
      mediaId,
      position,
    })),
  });
  await tx.mediaAsset.updateMany({
    where: { id: { in: mediaIds } },
    data: {
      linkedEntityType: "listing",
      linkedEntityId: listingId,
    },
  });
}

export function mediaDeliveryUrl(media: {
  id: string;
  storageBucket: string;
  storagePath: string;
  publicUrl?: string | null;
}) {
  return mediaPublicUrl(media) ?? `/api/media/${media.id}/blob`;
}

export function mediaPublicUrl(media: {
  storageBucket: string;
  storagePath: string;
  publicUrl?: string | null;
}) {
  const bucket = assertKnownBucket(media.storageBucket);
  if (!isPublicStorageBucket(bucket)) return null;
  return media.publicUrl ?? publicStorageUrl(bucket, media.storagePath);
}

function mediaAccessWhere(
  mediaId: string,
  current: { dbUserId: string; profileId: string; profileRole?: string | null }
) {
  return {
    id: mediaId,
    deletedAt: null,
    OR: [
      ...(isModeratorRole(current.profileRole) ? [{}] : []),
      { uploaderId: current.dbUserId },
      {
        messageAttachments: {
          some: {
            message: {
              OR: [
                { senderId: current.profileId, deletedBySenderAt: null },
                { recipientId: current.profileId, deletedByRecipientAt: null },
              ],
            },
          },
        },
      },
      {
        listingAttachments: {
          some: {
            listing: {
              OR: [
                { profileId: current.profileId },
                publicListingMediaWhere(),
              ],
            },
          },
        },
      },
    ],
  };
}

function publicListingMediaWhere() {
  const soldCutoff = new Date();
  soldCutoff.setDate(soldCutoff.getDate() - 30);

  return {
    archivedAt: null,
    OR: [
      { status: "active" },
      { status: "expired" },
      { status: "sold", soldAt: { gte: soldCutoff } },
    ],
  };
}

function assertUploadAllowedForContext(
  bucket: SupabaseStorageBucket,
  context: MediaContext,
  current: CurrentUserProfile
) {
  if (bucket === SITE_ASSETS_BUCKET && !isModeratorRole(current.profileRole)) {
    throw new Error("auth.forbidden");
  }
  if (context === "messages" && bucket !== PRIVATE_USER_MEDIA_BUCKET) {
    throw new Error("media.messages_must_be_private");
  }
  if (context !== "messages" && bucket === PRIVATE_USER_MEDIA_BUCKET) {
    if (context !== "verification") throw new Error("media.context_bucket_mismatch");
  }
}

function assertMediaSize(
  bucket: SupabaseStorageBucket,
  mimeType: MediaMimeType,
  sizeBytes: number
) {
  const maxBytes = mediaMaxBytes(bucket, mimeType);
  if (sizeBytes > maxBytes) throw new Error("media.too_large");
}

async function assertQuotaAvailable(
  current: CurrentUserProfile,
  candidateBytes: number
) {
  const usage = await prisma.mediaAsset.aggregate({
    where: {
      uploaderId: current.dbUserId,
      deletedAt: null,
    },
    _sum: { sizeBytes: true },
  });
  const usedBytes = usage._sum.sizeBytes ?? 0;
  if (usedBytes + candidateBytes > QUOTA_BYTES[current.tier]) {
    throw new Error("media.quota_exceeded");
  }
}

async function markMediaScanStatus(
  mediaId: string,
  scanStatus: "infected" | "error"
) {
  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: { scanStatus, scanCompletedAt: new Date() },
  });
}

function assertMediaClean(scanStatus: string) {
  if (scanStatus === "pending") throw new Error("media.scan_pending");
  if (scanStatus === "infected") throw new Error("media.infected");
  if (scanStatus !== "clean") throw new Error("media.scan_failed");
}

function buildObjectPath(input: {
  bucket: SupabaseStorageBucket;
  context: MediaContext;
  userId: string;
  linkedEntityId?: string;
  filename: string;
}) {
  const filename = `${randomUUID()}-${sanitizeFilename(input.filename)}`;
  const entityId = sanitizePathSegment(input.linkedEntityId ?? "pending");

  if (input.bucket === SITE_ASSETS_BUCKET) {
    return `site/${entityId}/${filename}`;
  }

  return `users/${sanitizePathSegment(input.userId)}/${input.context}/${entityId}/${filename}`;
}

function sanitizeFilename(filename: string) {
  const safe = filename
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "");
  return safe || "upload.bin";
}

function sanitizePathSegment(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-") || "pending"
  );
}

function publicUrlForMedia(
  bucket: SupabaseStorageBucket,
  objectPath: string
) {
  return isPublicStorageBucket(bucket) ? publicStorageUrl(bucket, objectPath) : null;
}

function assertKnownBucket(bucket: string): SupabaseStorageBucket {
  if (
    bucket === SITE_ASSETS_BUCKET ||
    bucket === PUBLIC_USER_MEDIA_BUCKET ||
    bucket === PRIVATE_USER_MEDIA_BUCKET
  ) {
    return bucket;
  }
  throw new Error("media.unknown_bucket");
}
