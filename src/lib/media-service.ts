import { execFile } from "node:child_process";
import { randomUUID } from "crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/account-service";
import { getEntitlementLimitsForCurrentUser } from "@/lib/billing/entitlement-service";
import { recordUsageEvent } from "@/lib/billing/usage-service";
import type { EntitlementLimits } from "@/lib/billing/entitlements";
import type { CurrentUser, CurrentUserProfile } from "@/lib/auth-types";
import { isModeratorRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";
import { logError } from "@/lib/logger";
import {
  mediaMaxBytes,
  resolveMediaBucket,
  resolveMediaContext,
  type MediaContext,
  type MediaMimeType,
} from "@/lib/media-validation";
import { createInAppNotification } from "@/lib/notification-service";
import { broadcastConversationRealtimeEvent } from "@/lib/realtime-service";
import {
  PRIVATE_USER_MEDIA_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
  SITE_ASSETS_BUCKET,
  isSupabaseStorageBucket,
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
const MEDIA_MAINTENANCE_LIMIT = 100;
const CLAMSCAN_TIMEOUT_MS = 2 * 60 * 1000;
const execFileAsync = promisify(execFile);

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
  const entitlementLimits = await getEntitlementLimitsForCurrentUser(current);
  const mediaLimits = mediaEntitlementLimits(entitlementLimits);
  assertUploadAllowedForContext(bucket, mediaContext, current);
  assertMediaSize(
    bucket,
    input.mimeType,
    input.sizeBytes,
    mediaLimits.uploadFileSizeBytes
  );
  await assertMonthlyUploadsAvailable(current, mediaLimits.uploadsPerMonth);
  await assertStorageQuotaAvailable(
    current,
    input.sizeBytes,
    mediaLimits.storageBytes
  );

  const objectPath = buildObjectPath({
    bucket,
    context: mediaContext,
    userId: current.dbUserId,
    linkedEntityId: input.linkedEntityId,
    filename: input.filename,
  });
  const signedUpload = await createSignedStorageUploadUrl(bucket, objectPath);
  const publicUrl =
    bucket === SITE_ASSETS_BUCKET ? publicUrlForMedia(bucket, objectPath) : null;
  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS);

  const media = await withDbRequestContext(current, (tx) => tx.mediaAsset.create({
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
  }));

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
  const trustClientScanStatus = process.env.NODE_ENV !== "production";

  if (trustClientScanStatus && input.scanStatus === "infected") {
    await markMediaScanStatus(media.id, "infected");
    throw new Error("media.infected");
  }
  if (trustClientScanStatus && input.scanStatus === "error") {
    await markMediaScanStatus(media.id, "error");
    throw new Error("media.scan_failed");
  }

  // Only terminal-bad scan verdicts block finalize; "pending" finalizes and
  // waits for the async scanner to clear it for delivery.
  if (media.scanStatus === "infected") throw new Error("media.infected");
  if (media.scanStatus === "error") throw new Error("media.scan_failed");

  const objectInfo = await getStorageObjectInfo(bucket, media.storagePath);
  const sizeBytes =
    typeof objectInfo.size === "number" && objectInfo.size > 0
      ? objectInfo.size
      : media.sizeBytes;

  const entitlementLimits = await getEntitlementLimitsForCurrentUser(current);
  const mediaLimits = mediaEntitlementLimits(entitlementLimits);
  assertMediaSize(
    bucket,
    media.mimeType as MediaMimeType,
    sizeBytes,
    mediaLimits.uploadFileSizeBytes
  );
  await assertStorageQuotaAvailable(
    current,
    sizeBytes - media.sizeBytes,
    mediaLimits.storageBytes
  );

  const finalized = await withDbRequestContext(current, (tx) => tx.mediaAsset.update({
    where: { id: media.id },
    data: {
      sha256: input.sha256?.toLowerCase() ?? media.sha256,
      sizeBytes,
      widthPx: input.widthPx ?? null,
      heightPx: input.heightPx ?? null,
      durationSec: input.durationSec ?? null,
      mediaType: mediaTypeForMimeType(media.mimeType),
      // publicUrl only when clean: the scanner sets it in runMediaMaintenance
      // once the pending asset passes the scan.
      ...(trustClientScanStatus
        ? {
            scanStatus: "clean",
            scanCompletedAt: new Date(),
            publicUrl: publicUrlForMedia(bucket, media.storagePath),
          }
        : {}),
      expiresAt: null,
    },
  }));

  // Metering is idempotent (keyed on the asset id) and must not surface as a
  // finalize failure after the asset is already finalized — a retry re-records
  // safely, so log and move on.
  try {
    await recordUsageEvent({
      idempotencyKey: `media_upload_bytes:${finalized.id}`,
      metricKey: "media_upload_bytes",
      userId: current.dbUserId,
      quantity: finalized.sizeBytes,
    });
  } catch (err) {
    logError("media.usage_record_failed", { mediaId: finalized.id }, err);
  }

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

  const deleted = await withDbRequestContext(current, (tx) => tx.mediaAsset.update({
    where: { id: media.id },
    data: { deletedAt: new Date() },
  }));

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

export async function runMediaMaintenance() {
  const now = new Date();
  const expired = await prisma.mediaAsset.findMany({
    where: {
      deletedAt: null,
      expiresAt: { lt: now },
    },
    orderBy: { expiresAt: "asc" },
    take: MEDIA_MAINTENANCE_LIMIT,
  });

  let expiredDeleted = 0;
  let expiredDeleteErrors = 0;
  for (const media of expired) {
    if (!isSupabaseStorageBucket(media.storageBucket)) {
      expiredDeleteErrors += 1;
      continue;
    }

    try {
      await removeStorageObject(media.storageBucket, media.storagePath);
      await prisma.mediaAsset.update({
        where: { id: media.id },
        data: { deletedAt: now },
      });
      expiredDeleted += 1;
    } catch {
      expiredDeleteErrors += 1;
    }
  }

  const scanMode = mediaScanMode();
  const scanCandidates =
    scanMode === "metadata" || scanMode === "clamav"
      ? await prisma.mediaAsset.findMany({
          where: {
            deletedAt: null,
            scanStatus: "pending",
            OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          },
          orderBy: { createdAt: "asc" },
          take: MEDIA_MAINTENANCE_LIMIT,
        })
      : [];

  let scanCleaned = 0;
  let scanInfected = 0;
  let scanErrors = 0;
  let scanSkipped = 0;

  for (const media of scanCandidates) {
    if (!isSupabaseStorageBucket(media.storageBucket)) {
      await markMediaScanStatus(media.id, "error");
      scanErrors += 1;
      continue;
    }

    try {
      const sizeBytes = await verifyStorageObjectForScan(media);
      if (scanMode === "clamav") {
        const result = await scanStorageObjectWithClamAv(
          media.storageBucket,
          media.storagePath,
          media.id
        );
        if (result === "infected") {
          await markMediaScanStatus(media.id, "infected");
          // Never keep malware at rest; the DB row stays as an infected tombstone.
          await removeStorageObject(
            media.storageBucket,
            media.storagePath
          ).catch((err) =>
            logError("media.infected_purge_failed", { mediaId: media.id }, err)
          );
          await notifyMessageScanVerdict(media, "infected");
          scanInfected += 1;
          continue;
        }
        if (result === "error") {
          await markMediaScanStatus(media.id, "error");
          scanErrors += 1;
          continue;
        }
      }

      await prisma.mediaAsset.update({
        where: { id: media.id },
        data: {
          scanStatus: "clean",
          scanCompletedAt: now,
          sizeBytes,
          publicUrl: publicUrlForMedia(media.storageBucket, media.storagePath),
        },
      });
      await notifyMessageScanVerdict(media, "clean");
      scanCleaned += 1;
    } catch (err) {
      if (scanMode === "clamav") {
        logError("media.scan_failed", { mediaId: media.id }, err);
        await markMediaScanStatus(media.id, "error");
        scanErrors += 1;
      } else {
        scanSkipped += 1;
      }
    }
  }

  const pendingScanCount = await prisma.mediaAsset.count({
    where: {
      deletedAt: null,
      scanStatus: "pending",
    },
  });

  return {
    expiredFound: expired.length,
    expiredDeleted,
    expiredDeleteErrors,
    scanMode,
    scanCandidates: scanCandidates.length,
    scanCleaned,
    scanInfected,
    scanErrors,
    scanSkipped: scanMode === "disabled" ? pendingScanCount : scanSkipped,
    pendingScanCount,
  };
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
              OR: [
                {
                  listingAttachments: {
                    some: {
                      listing: publicListingMediaWhere(),
                    },
                  },
                },
                {
                  feedAttachments: {
                    some: {
                      post: publicFeedMediaWhere(),
                    },
                  },
                },
              ],
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
  max = 4,
  opts?: { allowPending?: boolean }
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
    if (opts?.allowPending) {
      if (item.scanStatus === "infected") throw new Error("media.infected");
      if (item.scanStatus === "error") throw new Error("media.scan_failed");
    } else {
      assertMediaClean(item.scanStatus);
    }
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
      {
        feedAttachments: {
          some: {
            post: publicFeedMediaWhere(),
          },
        },
      },
    ],
  };
}

function publicListingMediaWhere() {
  const now = new Date();

  return {
    status: "active",
    moderationStatus: "approved",
    archivedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
  };
}

function publicFeedMediaWhere() {
  return {
    status: "active",
    visibility: "public",
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
  sizeBytes: number,
  uploadFileSizeBytes: number
) {
  const maxBytes = mediaMaxBytes(bucket, mimeType);
  if (sizeBytes > maxBytes || sizeBytes > uploadFileSizeBytes) {
    throw new Error("media.too_large");
  }
}

async function assertMonthlyUploadsAvailable(
  current: CurrentUserProfile,
  uploadsPerMonth: number
) {
  const uploadsThisMonth = await prisma.mediaAsset.count({
    where: {
      uploaderId: current.dbUserId,
      createdAt: { gte: startOfCurrentUtcMonth() },
    },
  });
  if (uploadsThisMonth >= uploadsPerMonth) {
    throw new Error("media.quota_exceeded");
  }
}

async function assertStorageQuotaAvailable(
  current: CurrentUserProfile,
  candidateBytes: number,
  storageBytes: number
) {
  const usage = await prisma.mediaAsset.aggregate({
    where: {
      uploaderId: current.dbUserId,
      deletedAt: null,
    },
    _sum: { sizeBytes: true },
  });
  const usedBytes = usage._sum.sizeBytes ?? 0;
  if (usedBytes + candidateBytes > storageBytes) {
    throw new Error("media.quota_exceeded");
  }
}

function mediaEntitlementLimits(limits: EntitlementLimits) {
  return {
    storageBytes: numberEntitlementLimit(limits, "storage_bytes"),
    uploadFileSizeBytes: numberEntitlementLimit(limits, "upload_file_size_bytes"),
    uploadsPerMonth: numberEntitlementLimit(limits, "uploads_per_month"),
  };
}

function numberEntitlementLimit(
  limits: EntitlementLimits,
  key: "storage_bytes" | "upload_file_size_bytes" | "uploads_per_month"
) {
  const value = limits[key];
  if (typeof value !== "number") throw new Error("media.quota_exceeded");
  return value;
}

function startOfCurrentUtcMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
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

async function notifyMessageScanVerdict(
  media: { id: string; uploaderId: string },
  verdict: "clean" | "infected"
) {
  try {
    // MessageMedia is the authoritative link; linkedEntityType is a
    // denormalized copy that later attachments can overwrite.
    const attachment = await prisma.messageMedia.findFirst({
      where: { mediaId: media.id },
      select: { message: { select: { conversationId: true } } },
    });
    if (!attachment) return;
    const conversationId = attachment.message.conversationId;

    if (verdict === "infected") {
      await createInAppNotification({
        userId: media.uploaderId,
        type: "media",
        title: "Attachment failed safety scan",
        href: conversationId ? `/pulse/${conversationId}` : null,
        targetType: "media",
        targetId: media.id,
      });
    }

    if (conversationId) {
      await broadcastConversationRealtimeEvent(
        conversationId,
        "conversation_updated",
        { action: "media_scan_completed", mediaId: media.id }
      );
    }
  } catch (err) {
    logError("media.scan_notify_failed", { mediaId: media.id }, err);
  }
}

async function verifyStorageObjectForScan(media: {
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const bucket = assertKnownBucket(media.storageBucket);
  const objectInfo = await getStorageObjectInfo(bucket, media.storagePath);
  const sizeBytes =
    typeof objectInfo.size === "number" && objectInfo.size > 0
      ? objectInfo.size
      : media.sizeBytes;
  assertMediaSize(
    bucket,
    media.mimeType as MediaMimeType,
    sizeBytes,
    mediaMaxBytes(bucket, media.mimeType as MediaMimeType)
  );
  return sizeBytes;
}

async function scanStorageObjectWithClamAv(
  bucket: SupabaseStorageBucket,
  objectPath: string,
  mediaId: string
) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ghiq-media-scan-"));
  const tempFile = path.join(tempDir, "upload.bin");

  try {
    const blob = await downloadStorageObject(bucket, objectPath);
    const bytes = Buffer.from(await blob.arrayBuffer());
    await writeFile(tempFile, bytes, { mode: 0o600 });

    try {
      await execFileAsync(clamScanBinary(), [...clamScanArgs(), tempFile], {
        timeout: clamScanTimeoutMs(),
        maxBuffer: 1024 * 1024,
      });
      return "clean" as const;
    } catch (err) {
      const exitCode =
        typeof (err as { code?: unknown }).code === "number"
          ? (err as { code: number }).code
          : null;
      if (exitCode === 1) return "infected" as const;
      logError("media.scan_failed", { mediaId }, err);
      return "error" as const;
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => null);
  }
}

function clamScanBinary() {
  return process.env.MEDIA_CLAMSCAN_BIN?.trim() || "clamscan";
}

function clamScanArgs() {
  const database = process.env.MEDIA_CLAMAV_DATABASE?.trim();
  return [
    "--no-summary",
    "--infected",
    ...(database ? [`--database=${database}`] : []),
  ];
}

function clamScanTimeoutMs() {
  const configured = Number(process.env.MEDIA_CLAMSCAN_TIMEOUT_MS ?? "");
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : CLAMSCAN_TIMEOUT_MS;
}

function mediaScanMode() {
  const configured = process.env.MEDIA_SCAN_MODE?.trim().toLowerCase();
  if (configured === "clamav") return "clamav";
  if (configured === "metadata") return "metadata";
  if (configured === "disabled") return "disabled";
  return process.env.NODE_ENV === "production" ? "disabled" : "metadata";
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
