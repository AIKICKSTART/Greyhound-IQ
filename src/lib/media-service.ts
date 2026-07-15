import { execFile } from "node:child_process";
import { randomUUID } from "crypto";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Prisma, type MediaAsset } from "@prisma/client";
import { createAuditLog } from "@/lib/account-service";
import { getEntitlementLimitsForCurrentUser } from "@/lib/billing/entitlement-service";
import { recordUsageEvent } from "@/lib/billing/usage-service";
import type { EntitlementLimits } from "@/lib/billing/entitlements";
import type { CurrentUser, CurrentUserProfile } from "@/lib/auth-types";
import { isModeratorRole } from "@/lib/auth-roles";
import {
  withDbAnonymousContext,
  withDbRequestContext,
  withDbSystemContext,
} from "@/lib/db-context";
import { logRequestError } from "@/lib/logger";
import {
  mediaMaxBytes,
  normalizeUploadFilename,
  resolveMediaBucket,
  resolveMediaContext,
  validateDecodedMediaMetadata,
  validateWebVttCaption,
  type MediaContext,
  type MediaMimeType,
} from "@/lib/media-validation";
import { createInAppNotification } from "@/lib/notification-service";
import {
  broadcastConversationRealtimeEvent,
  broadcastFeedRealtimeEvent,
  broadcastProfileRealtimeEvent,
} from "@/lib/realtime-service";
import {
  PRIVATE_USER_MEDIA_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
  SITE_ASSETS_BUCKET,
  isObjectStorageBucket,
  isPublicStorageBucket,
  mediaTypeForMimeType,
  publicStorageUrl,
  type ObjectStorageBucket,
} from "@/lib/storage-paths";
import { objectStorage } from "@/lib/object-storage";
import { sniffMatchesMimeType } from "@/lib/media-sniff";
import {
  canViewAudience,
  isSocialAudience,
} from "@/lib/social-privacy";

const UPLOAD_URL_TTL_MS = 2 * 60 * 60 * 1000;
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;
export const MEDIA_DOWNLOAD_REVOCATION_POLICY = Object.freeze({
  signedUrlTtlSeconds: DOWNLOAD_URL_TTL_SECONDS,
  newAccessAfterDeletion: "denied" as const,
  issuedUrlBehavior:
    "An issued provider URL can remain usable until its 15-minute expiry; emergency containment requires provider or signing-key revocation.",
});
const MEDIA_MAINTENANCE_LIMIT = 100;
const MEDIA_PROCESSING_LIMIT = 5;
const FEED_POST_MEDIA_LIMIT = 10;
const MEDIA_MAINTENANCE_BUDGET_MS = 12 * 60 * 1000;
const MEDIA_MAINTENANCE_SHUTDOWN_BUFFER_MS = 30 * 1000;
const CLAMSCAN_TIMEOUT_MS = 2 * 60 * 1000;
const CLAMAV_MAX_DEFINITION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CLAMAV_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FRESHCLAM_TIMEOUT_MS = 2 * 60 * 1000;
const FRESHCLAM_RETRY_COOLDOWN_MS = 60 * 60 * 1000;
const FFMPEG_TIMEOUT_MS = 10 * 60 * 1000;
const IMAGE_PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;
const MEDIA_PROCESSING_LEASE_MS = 20 * 60 * 1000;
const IMAGE_VARIANT_WIDTHS = [640, 1280, 1920] as const;
const HLS_RENDITIONS = [360, 720] as const;
const execFileAsync = promisify(execFile);
let clamAvRefreshPromise: Promise<void> | null = null;
let lastClamAvRefreshAttemptAt = 0;

type Tx = Prisma.TransactionClient;

type ProcessingMedia = MediaAsset;

type ImageVariant = {
  variant: `image-${number}`;
  path: string;
  width: number;
  height: number;
};

type HlsSegment = {
  variant: `hls-segment-${number}-${number}`;
  path: string;
};

type HlsRendition = {
  variant: `hls-rendition-${number}`;
  path: string;
  width: number;
  height: number;
  bandwidth: number;
  segments: HlsSegment[];
};

type ProcessingMetadata = {
  imageVariants?: ImageVariant[];
  hlsRenditions?: HlsRendition[];
  source?: { width?: number; height?: number; durationSec?: number };
  profileMedia?: ProfileMediaLink;
};

type ProfileMediaLink = {
  actorId: string;
  kind: "avatar" | "cover";
  focalX: number;
  focalY: number;
  zoom: number;
  rotation: number;
};

type ProcessedMedia = {
  playbackPath: string | null;
  posterPath: string | null;
  hlsPath: string | null;
  waveformJson: string | null;
  metadataJson: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  durationSec?: number | null;
  uploadedPaths: string[];
};

export type MediaDeliveryVariant =
  | "original"
  | "playback"
  | "poster"
  | "hls"
  | "caption"
  | `image-${number}`
  | `hls-rendition-${number}`
  | `hls-segment-${number}-${number}`;

export type MediaByteRange = {
  start: number;
  end: number;
};

export class MediaRangeNotSatisfiableError extends Error {
  constructor(readonly sizeBytes: number) {
    super("media.range_not_satisfiable");
  }
}

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
  altText?: string;
}

export interface UpdateMediaMetadataInput {
  altText?: string | null;
}

export async function createSignedUploadIntent(
  current: CurrentUserProfile,
  input: SignedUploadIntentInput,
  _origin?: string
) {
  void _origin;

  const mediaContext = resolveMediaContext(input);
  const requestedBucket = resolveMediaBucket(input);
  const bucket = mediaContext === "site"
    ? PRIVATE_USER_MEDIA_BUCKET
    : requestedBucket;
  const entitlementLimits = await getEntitlementLimitsForCurrentUser(current);
  const mediaLimits = mediaEntitlementLimits(entitlementLimits);
  assertUploadAllowedForContext(bucket, mediaContext, current);
  assertMediaSize(
    requestedBucket,
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
  const signedUpload = await objectStorage.createSignedUpload({
    bucket,
    key: objectPath,
  });
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
    uploadUrl: signedUpload.url,
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
  const media = await withDbRequestContext(current, (tx) => tx.mediaAsset.findFirst({
    where: {
      id: mediaId,
      uploaderId: current.dbUserId,
      deletedAt: null,
    },
  }));
  if (!media) throw new Error("media.not_found");

  const bucket = assertKnownBucket(media.storageBucket);
  const altText = input.altText === undefined
    ? undefined
    : sanitizeMediaAltText(input.altText);

  // Only terminal-bad scan verdicts block finalize; "pending" finalizes and
  // waits for the async scanner to clear it for delivery. Client-reported
  // scanStatus is never trusted — the async scanner (or MEDIA_SCAN_MODE) owns
  // the verdict, in dev and prod alike.
  if (media.scanStatus === "infected") throw new Error("media.infected");
  if (media.scanStatus === "error") throw new Error("media.scan_failed");
  if (media.processingStatus === "failed") {
    throw new Error("media.processing_failed");
  }

  let finalized = media;
  if (media.processingStatus === "pending") {
    await assertStoredBytesMatchMimeType(bucket, media);

    const objectInfo = await objectStorage.getObjectInfo({
      bucket,
      key: media.storagePath,
    });
    const sizeBytes = storageObjectSize(objectInfo, media.sizeBytes);
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

    finalized = await withDbRequestContext(current, async (tx) => {
      const updated = await tx.mediaAsset.updateMany({
        where: {
          id: media.id,
          deletedAt: null,
          scanStatus: "pending",
          processingStatus: "pending",
        },
        data: {
          sha256: input.sha256?.toLowerCase() ?? media.sha256,
          sizeBytes,
          widthPx: input.widthPx ?? media.widthPx,
          heightPx: input.heightPx ?? media.heightPx,
          durationSec: input.durationSec ?? media.durationSec,
          altText,
          mediaType: mediaTypeForMimeType(media.mimeType),
          expiresAt: null,
        },
      });
      const currentMedia = await tx.mediaAsset.findFirst({
        where: { id: media.id, uploaderId: current.dbUserId, deletedAt: null },
      });
      if (!currentMedia) throw new Error("media.not_found");
      if (updated.count !== 1 && currentMedia.processingStatus === "failed") {
        throw new Error("media.processing_failed");
      }
      if (updated.count !== 1 && currentMedia.processingStatus === "pending") {
        throw new Error("media.processing_state_conflict");
      }
      return currentMedia;
    });
  } else if (altText !== undefined) {
    finalized = await withDbRequestContext(current, (tx) =>
      tx.mediaAsset.update({
        where: { id: media.id },
        data: { altText },
      })
    );
  }

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
    await logRequestError("media.usage_record_failed", { mediaId: finalized.id }, err);
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
  const media = await withDbRequestContext(current, (tx) =>
    tx.mediaAsset.findFirst({
      where: ownedMediaWhere(current.dbUserId, mediaId),
    })
  );
  if (!media) throw new Error("media.not_found");
  return media;
}

export function ownedMediaWhere(dbUserId: string, mediaId: string) {
  return { id: mediaId, uploaderId: dbUserId, deletedAt: null } as const;
}

export async function getMediaStatusForCurrentUser(
  current: CurrentUserProfile,
  mediaId: string
) {
  const media = await withDbRequestContext(current, (tx) =>
    tx.mediaAsset.findFirst({
      where: ownedMediaWhere(current.dbUserId, mediaId),
      select: {
        id: true,
        originalName: true,
        scanStatus: true,
        processingStatus: true,
        processingError: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  );
  if (!media) throw new Error("media.not_found");
  return media;
}

export async function updateMediaMetadataForCurrentUser(
  current: CurrentUserProfile,
  mediaId: string,
  input: UpdateMediaMetadataInput
) {
  const media = await withDbRequestContext(current, (tx) =>
    tx.mediaAsset.findFirst({
      where: {
        id: mediaId,
        uploaderId: current.dbUserId,
        deletedAt: null,
      },
    })
  );
  if (!media) throw new Error("media.not_found");

  const altText = input.altText === undefined
    ? undefined
    : input.altText === null
      ? null
      : sanitizeMediaAltText(input.altText);

  const updated = await withDbRequestContext(current, (tx) =>
    tx.mediaAsset.updateMany({
      where: {
        id: media.id,
        uploaderId: current.dbUserId,
        deletedAt: null,
      },
      data: {
        altText,
      },
    })
  );
  if (updated.count !== 1) throw new Error("media.not_found");
  const item = await withDbRequestContext(current, (tx) =>
    tx.mediaAsset.findFirstOrThrow({
      where: { id: media.id, uploaderId: current.dbUserId, deletedAt: null },
    })
  );
  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "media.metadata_update",
    targetType: "media",
    targetId: media.id,
    metadata: {
      altTextUpdated: input.altText !== undefined,
    },
  });
  return item;
}

export async function replaceMediaCaptionForCurrentUser(
  current: CurrentUserProfile,
  mediaId: string,
  bytes: Uint8Array
) {
  validateWebVttCaption(bytes);
  const media = await findOwnedVideoForCaption(current, mediaId);
  const captionPath = `${derivativeBasePath(media)}/caption-${randomUUID()}.vtt`;

  await objectStorage.putObject({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    key: captionPath,
    body: bytes,
    contentType: "text/vtt; charset=utf-8",
    cacheControl: "31536000",
    upsert: true,
  });

  let item: MediaAsset;
  try {
    item = await withDbRequestContext(current, async (tx) => {
      const updated = await tx.mediaAsset.updateMany({
        where: {
          id: media.id,
          uploaderId: current.dbUserId,
          deletedAt: null,
          captionPath: media.captionPath,
        },
        data: { captionPath },
      });
      if (updated.count !== 1) throw new Error("media.caption_conflict");
      return tx.mediaAsset.findFirstOrThrow({
        where: { id: media.id, uploaderId: current.dbUserId, deletedAt: null },
      });
    });
  } catch (err) {
    await objectStorage.deleteObject({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key: captionPath,
    }).catch(
      (cleanupError) =>
        logRequestError("media.caption_rollback_failed", { mediaId }, cleanupError)
    );
    throw err;
  }

  if (media.captionPath) {
    try {
      assertDerivativePath(media, media.captionPath);
      await objectStorage.deleteObject({
        bucket: PRIVATE_USER_MEDIA_BUCKET,
        key: media.captionPath,
      });
    } catch (err) {
      await logRequestError("media.caption_replaced_cleanup_failed", { mediaId }, err);
    }
  }

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "media.caption_replace",
    targetType: "media",
    targetId: media.id,
    metadata: { sizeBytes: bytes.byteLength },
  });
  return item;
}

export async function deleteMediaCaptionForCurrentUser(
  current: CurrentUserProfile,
  mediaId: string
) {
  const media = await findOwnedVideoForCaption(current, mediaId);
  if (!media.captionPath) return media;

  const item = await withDbRequestContext(current, async (tx) => {
    const updated = await tx.mediaAsset.updateMany({
      where: {
        id: media.id,
        uploaderId: current.dbUserId,
        deletedAt: null,
        captionPath: media.captionPath,
      },
      data: { captionPath: null },
    });
    if (updated.count !== 1) throw new Error("media.caption_conflict");
    return tx.mediaAsset.findFirstOrThrow({
      where: { id: media.id, uploaderId: current.dbUserId, deletedAt: null },
    });
  });

  try {
    assertDerivativePath(media, media.captionPath);
    await objectStorage.deleteObject({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key: media.captionPath,
    });
  } catch (err) {
    await logRequestError("media.caption_delete_cleanup_failed", { mediaId }, err);
  }

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "media.caption_delete",
    targetType: "media",
    targetId: media.id,
  });
  return item;
}

export async function createMediaDownloadUrl(
  current: CurrentUserProfile,
  mediaId: string,
  _origin?: string
) {
  void _origin;

  const media = await getMediaForCurrentUser(current, mediaId);
  assertMediaReady(media);

  const bucket = assertKnownBucket(media.storageBucket);
  const variant = media.playbackPath ? "playback" : "original";
  const delivery = resolveMediaDelivery(media, variant);
  const publicUrl = isPublicStorageBucket(bucket)
    ? publicStorageUrl(bucket, delivery.storagePath)
    : null;
  if (publicUrl) {
    return {
      mediaId: media.id,
      url: publicUrl,
      expiresAt: null,
      variant,
      storageMode: "supabase_public",
    };
  }

  const signedUrl = await objectStorage.createSignedDownload({
    bucket,
    key: delivery.storagePath,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
  });
  const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000);

  return {
    mediaId: media.id,
    url: signedUrl,
    expiresAt: expiresAt.toISOString(),
    variant,
    storageMode: "supabase_signed",
  };
}

export async function deleteMediaForCurrentUser(
  current: CurrentUserProfile,
  mediaId: string
) {
  const deletedAt = new Date();
  const deletion = await withDbRequestContext(current, async (tx) => {
    const media = await tx.mediaAsset.findFirst({
      where: ownedMediaWhere(current.dbUserId, mediaId),
    });
    if (!media) throw new Error("media.not_found");
    const posts = await tx.feedPost.findMany({
      where: {
        deletedAt: null,
        media: { some: { mediaId: media.id } },
      },
      orderBy: { id: "asc" },
      take: 1_000,
      select: { id: true, status: true, visibility: true },
    });
    const tombstoned = await tx.mediaAsset.updateMany({
      where: { id: media.id, deletedAt: null },
      data: { deletedAt },
    });
    if (tombstoned.count !== 1) throw new Error("media.not_found");
    await tx.feedPostMedia.deleteMany({ where: { mediaId: media.id } });

    const feedTransitions: Array<{
      postId: string;
      visibility: string;
      status: "active" | "processing" | "failed";
    }> = [];
    for (const post of posts) {
      if (post.status !== "processing" && post.status !== "failed") continue;
      const remaining = await tx.feedPostMedia.findMany({
        where: { postId: post.id },
        orderBy: { position: "asc" },
        take: FEED_POST_MEDIA_LIMIT,
        select: {
          media: {
            select: { processingStatus: true, scanStatus: true },
          },
        },
      });
      const remainingMedia = remaining.map((item) => item.media);
      const nextStatus =
        feedPostStatusForMedia(remainingMedia) ??
        (remainingMedia.length === 0 ? "active" : "processing");
      await tx.feedPost.update({
        where: { id: post.id },
        data: {
          status: nextStatus,
          publishedAt: nextStatus === "active" ? deletedAt : null,
        },
      });
      feedTransitions.push({
        postId: post.id,
        visibility: post.visibility,
        status: nextStatus,
      });
    }
    return { media, feedTransitions };
  });
  const { media, feedTransitions } = deletion;
  const bucket = assertKnownBucket(media.storageBucket);

  const processingPaths = await objectStorage.listObjectKeys({
    bucket,
    prefix: derivativeBasePath(media),
  }).catch(async (err) => {
    await logRequestError(
      "media.delete_derivative_list_failed",
      { mediaId: media.id },
      err,
    );
    return [];
  });
  await objectStorage.deleteObjects({
    bucket,
    keys: [...new Set([
      media.storagePath,
      ...derivativeStoragePaths(media),
      ...processingPaths,
    ])],
  }).catch((err) =>
    logRequestError("media.delete_storage_failed", { mediaId: media.id }, err)
  );
  const deleted = { ...media, deletedAt };

  for (const transition of feedTransitions) {
    if (transition.status === "active" && transition.visibility === "public") {
      await broadcastFeedRealtimeEvent("post_updated", {
        postId: transition.postId,
        action: "media_removed",
      });
    }
  }

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
  const maintenanceDeadline = Date.now() + MEDIA_MAINTENANCE_BUDGET_MS;
  const expired = await withDbSystemContext((tx) => tx.mediaAsset.findMany({
    where: {
      deletedAt: null,
      expiresAt: { lt: now },
    },
    orderBy: { expiresAt: "asc" },
    take: MEDIA_MAINTENANCE_LIMIT,
  }));

  let expiredDeleted = 0;
  let expiredDeleteErrors = 0;
  for (const media of expired) {
    if (!isObjectStorageBucket(media.storageBucket)) {
      expiredDeleteErrors += 1;
      continue;
    }

    try {
      await objectStorage.deleteObject({
        bucket: media.storageBucket,
        key: media.storagePath,
      });
      await withDbSystemContext((tx) => tx.mediaAsset.update({
        where: { id: media.id },
        data: { deletedAt: now },
      }));
      expiredDeleted += 1;
    } catch {
      expiredDeleteErrors += 1;
    }
  }

  const scanMode = mediaScanMode();
  if (scanMode === "clamav") await assertClamAvReady();
  const leaseCutoff = new Date(now.getTime() - mediaProcessingLeaseMs());
  const scanCandidates = scanMode === "disabled"
    ? []
    : await withDbSystemContext((tx) => tx.mediaAsset.findMany({
        where: {
          deletedAt: null,
          expiresAt: null,
          OR: [
            { scanStatus: "pending", processingStatus: "pending" },
            {
              processingStatus: { in: ["scanning", "processing"] },
              OR: [
                { processingStartedAt: null },
                { processingStartedAt: { lt: leaseCutoff } },
              ],
            },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: MEDIA_PROCESSING_LIMIT,
      }));

  let scanClaimed = 0;
  let scanCleaned = 0;
  let scanInfected = 0;
  let scanErrors = 0;
  let processingReady = 0;
  let processingFailed = 0;

  for (const media of scanCandidates) {
    if (Date.now() >= maintenanceDeadline) break;
    const claimed = await claimPendingMedia(
      media.id,
      leaseCutoff,
      profileMediaOnlyMetadataJson(media.metadataJson),
    );
    if (!claimed) continue;
    scanClaimed += 1;
    let scanPassed = false;
    let processed: ProcessedMedia | null = null;

    try {
      const bucket = assertKnownBucket(media.storageBucket);
      assertPrivateProcessingBucket(media);
      const sizeBytes = await verifyStorageObjectForScan(media);
      await assertStoredBytesMatchMimeType(bucket, media, { markFailure: false });

      if (scanMode === "clamav") {
        const result = await scanStorageObjectWithClamAv(
          bucket,
          media.storagePath,
          media.id
        );
        if (result === "infected") {
          const transitions = await failMediaProcessing(
            media.id,
            "infected",
            "media.infected"
          );
          await objectStorage.deleteObject({
            bucket,
            key: media.storagePath,
          }).catch((err) =>
            logRequestError("media.infected_purge_failed", { mediaId: media.id }, err)
          );
          await notifyMediaProcessingVerdict(media, "failed", transitions);
          scanInfected += 1;
          processingFailed += 1;
          continue;
        }
        if (result === "error") {
          throw new Error("media.scan_failed");
        }
      }

      const processingStarted = await markMediaProcessingStarted(media, sizeBytes);
      if (!processingStarted) continue;
      scanPassed = true;
      scanCleaned += 1;

      processed = await processMediaDerivatives(
        media,
        maintenanceDeadline - MEDIA_MAINTENANCE_SHUTDOWN_BUFFER_MS
      );
      const transitions = await completeMediaProcessing(media.id, processed);
      await notifyMediaProcessingVerdict(media, "ready", transitions);
      processingReady += 1;
    } catch (err) {
      if (processed?.uploadedPaths.length) {
        const bucket = assertKnownBucket(media.storageBucket);
        await objectStorage.deleteObjects({
          bucket,
          keys: processed.uploadedPaths,
        }).catch(
          (cleanupErr) =>
            logRequestError(
              "media.derivative_cleanup_failed",
              { mediaId: media.id },
              cleanupErr
            )
        );
      }
      const errorCode = mediaProcessingError(err);
      await logRequestError(
        "media.processing_failed",
        { mediaId: media.id, errorCode },
        err,
      );
      const transitions = await failMediaProcessing(
        media.id,
        scanPassed ? "clean" : "error",
        errorCode
      );
      await notifyMediaProcessingVerdict(media, "failed", transitions);
      if (!scanPassed) scanErrors += 1;
      processingFailed += 1;
    }
  }

  const pendingScanCount = await withDbSystemContext((tx) => tx.mediaAsset.count({
    where: {
      deletedAt: null,
      scanStatus: "pending",
    },
  }));

  return {
    expiredFound: expired.length,
    expiredDeleted,
    expiredDeleteErrors,
    scanMode,
    scanCandidates: scanCandidates.length,
    scanClaimed,
    scanCleaned,
    scanInfected,
    scanErrors,
    scanSkipped: scanMode === "disabled" ? pendingScanCount : 0,
    processingReady,
    processingFailed,
    pendingScanCount,
  };
}

export async function getMediaBlob(
  mediaId: string,
  current: CurrentUser | null,
  options?: {
    variant?: string | null;
    range?: string | null;
    signal?: AbortSignal;
  }
) {
  const viewer = current?.profileId
    ? {
        dbUserId: current.dbUserId ?? "",
        profileId: current.profileId,
        profileRole: current.role ?? "",
        tier: current.tier,
      }
    : null;
  const media = await findAuthorizedMedia(mediaId, viewer);
  assertMediaReady(media);
  const bucket = assertKnownBucket(media.storageBucket);
  const variant = parseMediaDeliveryVariant(options?.variant);
  const delivery = resolveMediaDelivery(media, variant);
  const objectInfo = await objectStorage.getObjectInfo({
    bucket,
    key: delivery.storagePath,
  });
  const sizeBytes = storageObjectSize(
    objectInfo,
    variant === "original" ? media.sizeBytes : null
  );
  if (
    sizeBytes >
    mediaMaxBytes(bucket, media.mimeType as MediaMimeType)
  ) {
    throw new Error("media.too_large");
  }
  const range = parseMediaByteRange(options?.range ?? null, sizeBytes);
  const body = await objectStorage.streamObject({
    bucket,
    key: delivery.storagePath,
    range: range ?? undefined,
    signal: options?.signal,
  });

  return {
    media,
    body,
    delivery: {
      ...delivery,
      sizeBytes,
      contentLength: range ? range.end - range.start + 1 : sizeBytes,
      contentRange: range
        ? `bytes ${range.start}-${range.end}/${sizeBytes}`
        : null,
      status: range ? 206 : 200,
    },
  };
}

export async function assertMediaAttachable(
  current: CurrentUserProfile,
  mediaIds: string[],
  max = 4,
  opts?: { allowPending?: boolean }
) {
  const uniqueIds = [...new Set(mediaIds)];
  const boundedMax = Math.min(Math.max(1, Math.trunc(max)), 100);
  if (uniqueIds.length > boundedMax) throw new Error("media.too_many");
  if (uniqueIds.length !== mediaIds.length) throw new Error("media.duplicate");
  if (uniqueIds.length === 0) return [];

  const media = await withDbRequestContext(current, (tx) => tx.mediaAsset.findMany({
    where: {
      id: { in: uniqueIds },
      uploaderId: current.dbUserId,
      deletedAt: null,
    },
    take: Math.min(Math.max(1, boundedMax), 100),
  }));

  if (media.length !== uniqueIds.length) throw new Error("media.not_found");
  for (const item of media) {
    if (opts?.allowPending) {
      if (item.scanStatus === "infected") throw new Error("media.infected");
      if (item.scanStatus === "error") throw new Error("media.scan_failed");
      if (item.processingStatus === "failed") {
        throw new Error("media.processing_failed");
      }
    } else {
      assertMediaReady(item);
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
  playbackPath?: string | null;
}) {
  const publicUrl = mediaPublicUrl(media);
  if (publicUrl) return publicUrl;
  const variant = media.playbackPath ? "playback" : "original";
  return `/api/media/${media.id}/blob?variant=${variant}`;
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

export function parseMediaDeliveryVariant(
  value: string | null | undefined
): MediaDeliveryVariant {
  if (!value || value === "original") return "original";
  if (
    value === "playback" ||
    value === "poster" ||
    value === "hls" ||
    value === "caption"
  ) {
    return value;
  }
  if (/^image-[1-9]\d{0,4}$/.test(value)) {
    return value as `image-${number}`;
  }
  if (/^hls-rendition-[1-9]\d{0,3}$/.test(value)) {
    return value as `hls-rendition-${number}`;
  }
  if (/^hls-segment-[1-9]\d{0,3}-\d{1,5}$/.test(value)) {
    return value as `hls-segment-${number}-${number}`;
  }
  throw new Error("media.variant_invalid");
}

export function parseMediaByteRange(
  value: string | null,
  sizeBytes: number
): MediaByteRange | null {
  if (!value) return null;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new MediaRangeNotSatisfiableError(Math.max(0, sizeBytes));
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) {
    throw new MediaRangeNotSatisfiableError(sizeBytes);
  }

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      throw new MediaRangeNotSatisfiableError(sizeBytes);
    }
    return {
      start: Math.max(0, sizeBytes - suffixLength),
      end: sizeBytes - 1,
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : sizeBytes - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= sizeBytes ||
    requestedEnd < start
  ) {
    throw new MediaRangeNotSatisfiableError(sizeBytes);
  }
  return { start, end: Math.min(requestedEnd, sizeBytes - 1) };
}

function resolveMediaDelivery(
  media: ProcessingMedia,
  variant: MediaDeliveryVariant
) {
  if (variant === "original") {
    return {
      variant,
      storagePath: media.storagePath,
      mimeType: media.mimeType,
    };
  }

  const directPath = variant === "playback"
      ? media.playbackPath
    : variant === "poster"
      ? media.posterPath
      : variant === "hls"
        ? media.hlsPath
        : variant === "caption"
          ? media.captionPath
        : null;
  if (directPath) {
    assertDerivativePath(media, directPath);
    return {
      variant,
      storagePath: directPath,
      mimeType: variant === "poster"
        ? "image/jpeg"
        : variant === "hls"
          ? "application/vnd.apple.mpegurl"
          : variant === "caption"
            ? "text/vtt; charset=utf-8"
          : processedPlaybackMimeType(media.mimeType),
    };
  }

  const metadata = parseProcessingMetadata(media.metadataJson);
  const imageVariant = metadata.imageVariants?.find(
    (candidate) => candidate.variant === variant
  );
  if (imageVariant) {
    assertDerivativePath(media, imageVariant.path);
    return {
      variant,
      storagePath: imageVariant.path,
      mimeType: "image/webp",
    };
  }

  for (const rendition of metadata.hlsRenditions ?? []) {
    if (rendition.variant === variant) {
      assertDerivativePath(media, rendition.path);
      return {
        variant,
        storagePath: rendition.path,
        mimeType: "application/vnd.apple.mpegurl",
      };
    }
    const segment = rendition.segments.find(
      (candidate) => candidate.variant === variant
    );
    if (segment) {
      assertDerivativePath(media, segment.path);
      return {
        variant,
        storagePath: segment.path,
        mimeType: "video/mp2t",
      };
    }
  }
  throw new Error("media.variant_unavailable");
}

function parseProcessingMetadata(value: string | null): ProcessingMetadata {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as ProcessingMetadata;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function mergeProcessingMetadataJson(
  currentValue: string | null,
  processedValue: string | null,
) {
  const current = parseProcessingMetadata(currentValue);
  const processed = parseProcessingMetadata(processedValue);
  const merged: ProcessingMetadata = { ...current, ...processed };
  if (current.profileMedia) merged.profileMedia = current.profileMedia;
  return Object.keys(merged).length > 0 ? JSON.stringify(merged) : null;
}

function parseProfileMediaLink(value: string | null): ProfileMediaLink | null {
  const link = parseProcessingMetadata(value).profileMedia as unknown;
  if (!link || typeof link !== "object" || Array.isArray(link)) return null;
  const candidate = link as Record<string, unknown>;
  const focalX = Number(candidate.focalX);
  const focalY = Number(candidate.focalY);
  const zoom = Number(candidate.zoom);
  const rotation = Number(candidate.rotation);
  if (
    typeof candidate.actorId !== "string" ||
    !candidate.actorId ||
    (candidate.kind !== "avatar" && candidate.kind !== "cover") ||
    !Number.isFinite(focalX) ||
    focalX < 0 ||
    focalX > 1 ||
    !Number.isFinite(focalY) ||
    focalY < 0 ||
    focalY > 1 ||
    !Number.isFinite(zoom) ||
    zoom < 1 ||
    zoom > 3 ||
    !Number.isInteger(rotation) ||
    ![0, 90, 180, 270].includes(rotation)
  ) {
    return null;
  }
  return {
    actorId: candidate.actorId,
    kind: candidate.kind,
    focalX,
    focalY,
    zoom,
    rotation,
  };
}

function profileMediaOnlyMetadataJson(value: string | null) {
  const profileMedia = parseProfileMediaLink(value);
  return profileMedia ? JSON.stringify({ profileMedia }) : null;
}

function processedPlaybackMimeType(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image/webp";
  if (mimeType.startsWith("video/")) return "video/mp4";
  if (mimeType.startsWith("audio/")) return "audio/mpeg";
  return mimeType;
}

function storageObjectSize(objectInfo: unknown, fallback: number | null) {
  const info = objectInfo as {
    size?: unknown;
    metadata?: { size?: unknown } | null;
  };
  const value = info.size ?? info.metadata?.size ?? fallback;
  const size = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("storage.object_size_invalid");
  }
  return size;
}

type MediaViewer = {
  dbUserId: string;
  profileId: string;
  profileRole: string;
  tier: string;
};

export function canAccessActorMediaAudience(
  actor: {
    ownerProfileId: string;
    profileVisibility: string;
    published: boolean;
  },
  viewer: {
    profileId: string | null;
    connected: boolean;
    blocked: boolean;
  }
) {
  if (viewer.blocked) return false;
  const owner = viewer.profileId === actor.ownerProfileId;
  if (!owner && !actor.published) return false;
  const audience = isSocialAudience(actor.profileVisibility)
    ? actor.profileVisibility
    : "only_me";
  return canViewAudience(audience, {
    authenticated: Boolean(viewer.profileId),
    owner,
    connected: viewer.connected,
  });
}

async function findAuthorizedMedia(
  mediaId: string,
  viewer: MediaViewer | null
) {
  const media = await withDbSystemContext((tx) => tx.mediaAsset.findFirst({
    where: { id: mediaId, deletedAt: null },
    include: {
      messageAttachments: { select: { messageId: true, position: true } },
      listingAttachments: { select: { listingId: true, position: true } },
      feedAttachments: { select: { postId: true } },
    },
  }));
  if (!media) throw new Error("media.not_found");

  const authorized = await canViewerAccessMedia(media, viewer);
  if (!authorized) throw new Error("media.not_found");

  const { feedAttachments: _feedAttachments, ...safeMedia } = media;
  void _feedAttachments;
  return safeMedia;
}

async function canViewerAccessMedia(
  media: ProcessingMedia & {
    messageAttachments: { messageId: string; position: number }[];
    listingAttachments: { listingId: string; position: number }[];
    feedAttachments: { postId: string }[];
  },
  viewer: MediaViewer | null
) {
  if (media.storageBucket === SITE_ASSETS_BUCKET) return true;
  if (canAccessMediaByOwnership(media.uploaderId, viewer)) return true;

  if (viewer && await viewerCanAccessMessageMedia(media.id, viewer.profileId)) {
    return true;
  }
  if (await viewerCanAccessListingMedia(media.id, viewer?.profileId ?? null)) {
    return true;
  }
  if (await viewerCanAccessActorMedia(media.id, viewer)) return true;
  return viewerCanAccessFeedMedia(
    media.feedAttachments.map((attachment) => attachment.postId),
    viewer
  );
}

/** @internal Exported for the private-media authorization regression test. */
export function canAccessMediaByOwnership(
  uploaderId: string,
  viewer: { dbUserId: string } | null
) {
  return viewer?.dbUserId === uploaderId;
}

async function viewerCanAccessActorMedia(
  mediaId: string,
  viewer: MediaViewer | null
) {
  return withDbSystemContext(async (tx) => {
    const attachments = await tx.actorGalleryMedia.findMany({
      where: { mediaId },
      orderBy: [{ actorId: "asc" }, { mediaId: "asc" }],
      take: 100,
      select: {
        actor: {
          select: {
            id: true,
            kind: true,
            ownerProfileId: true,
            profileVisibility: true,
            published: true,
          },
        },
      },
    });
    if (attachments.length === 0) return false;

    if (!viewer) {
      return attachments.some(({ actor }) =>
        canAccessActorMediaAudience(actor, {
          profileId: null,
          connected: false,
          blocked: false,
        })
      );
    }

    const actorIds = attachments.map(({ actor }) => actor.id);
    const ownerProfileIds = [
      ...new Set(attachments.map(({ actor }) => actor.ownerProfileId)),
    ];
    const [blocks, follows, friendships] = await Promise.all([
      tx.userBlock.findMany({
        where: {
          OR: [
            {
              blockerProfileId: viewer.profileId,
              blockedProfileId: { in: ownerProfileIds },
            },
            {
              blockerProfileId: { in: ownerProfileIds },
              blockedProfileId: viewer.profileId,
            },
          ],
        },
        take: 200,
        select: { blockerProfileId: true, blockedProfileId: true },
      }),
      tx.actorFollow.findMany({
        where: {
          followedActorId: { in: actorIds },
          followerActor: { ownerProfileId: viewer.profileId },
        },
        take: 100,
        select: { followedActorId: true },
      }),
      tx.friendship.findMany({
        where: {
          status: "accepted",
          OR: [
            {
              profileAId: viewer.profileId,
              profileBId: { in: ownerProfileIds },
            },
            {
              profileAId: { in: ownerProfileIds },
              profileBId: viewer.profileId,
            },
          ],
        },
        take: 200,
        select: { profileAId: true, profileBId: true },
      }),
    ]);
    const blockedOwnerProfileIds = new Set(
      blocks.map((block) =>
        block.blockerProfileId === viewer.profileId
          ? block.blockedProfileId
          : block.blockerProfileId
      )
    );
    const followedActorIds = new Set(
      follows.map((follow) => follow.followedActorId)
    );
    const connectedProfileIds = new Set(
      friendships.map((friendship) =>
        friendship.profileAId === viewer.profileId
          ? friendship.profileBId
          : friendship.profileAId
      )
    );

    return attachments.some(({ actor }) =>
      canAccessActorMediaAudience(actor, {
        profileId: viewer.profileId,
        blocked: blockedOwnerProfileIds.has(actor.ownerProfileId),
        connected:
          actor.kind === "page"
            ? followedActorIds.has(actor.id)
            : connectedProfileIds.has(actor.ownerProfileId),
      })
    );
  });
}

async function viewerCanAccessMessageMedia(mediaId: string, profileId: string) {
  const attachment = await withDbSystemContext((tx) => tx.messageMedia.findFirst({
    where: {
      mediaId,
      message: {
        OR: [
          { senderId: profileId, deletedBySenderAt: null },
          { recipientId: profileId, deletedByRecipientAt: null },
        ],
      },
    },
    select: { mediaId: true },
  }));
  return Boolean(attachment);
}

async function viewerCanAccessListingMedia(
  mediaId: string,
  profileId: string | null
) {
  const attachment = await withDbSystemContext((tx) => tx.listingMedia.findFirst({
    where: {
      mediaId,
      listing: profileId
        ? { OR: [{ profileId }, publicListingMediaWhere()] }
        : publicListingMediaWhere(),
    },
    select: { mediaId: true },
  }));
  return Boolean(attachment);
}

async function viewerCanAccessFeedMedia(
  postIds: string[],
  viewer: MediaViewer | null
) {
  if (postIds.length === 0) return false;
  const check = (tx: Tx) => tx.$queryRaw<Array<{ visible: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[${Prisma.join(postIds)}]::text[]) AS candidate(post_id)
      WHERE public.giq_feed_post_visible(candidate.post_id)
    ) AS visible
  `);
  const rows = viewer
    ? await withDbRequestContext(viewer, check)
    : await withDbAnonymousContext(check);
  if (rows[0]?.visible === true) return true;
  return viewer
    ? viewerOwnedPageFollowerCanAccess(postIds, viewer.profileId)
    : false;
}

async function viewerOwnedPageFollowerCanAccess(
  postIds: string[],
  profileId: string
) {
  const rows = await withDbSystemContext((tx) =>
    tx.$queryRaw<Array<{ visible: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM "FeedPost" p
        JOIN "SocialActor" author_actor ON author_actor.id = p."authorActorId"
        JOIN "ActorFollow" follow ON follow."followedActorId" = author_actor.id
        JOIN "SocialActor" viewer_actor ON viewer_actor.id = follow."followerActorId"
        WHERE p.id IN (${Prisma.join(postIds)})
          AND p."deletedAt" IS NULL
          AND p.status = 'active'
          AND p.visibility = 'connections'
          AND author_actor.kind = 'page'
          AND viewer_actor."ownerProfileId" = ${profileId}
          AND NOT EXISTS (
            SELECT 1 FROM "UserBlock" block
            WHERE (block."blockerProfileId" = ${profileId} AND block."blockedProfileId" = p."authorProfileId")
               OR (block."blockedProfileId" = ${profileId} AND block."blockerProfileId" = p."authorProfileId")
          )
          AND NOT EXISTS (
            SELECT 1 FROM "ActorMute" mute
            WHERE mute."muterActorId" = viewer_actor.id
              AND mute."mutedActorId" = author_actor.id
          )
      ) AS visible
    `)
  );
  return rows[0]?.visible === true;
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

function assertUploadAllowedForContext(
  bucket: ObjectStorageBucket,
  context: MediaContext,
  current: CurrentUserProfile
) {
  if (context === "site") {
    if (bucket !== PRIVATE_USER_MEDIA_BUCKET) {
      throw new Error("media.context_bucket_mismatch");
    }
    if (!isModeratorRole(current.profileRole)) throw new Error("auth.forbidden");
    return;
  }
  if (bucket !== PRIVATE_USER_MEDIA_BUCKET) {
    throw new Error("media.context_bucket_mismatch");
  }
}

function assertMediaSize(
  bucket: ObjectStorageBucket,
  mimeType: MediaMimeType,
  sizeBytes: number,
  uploadFileSizeBytes: number
) {
  const maxBytes = mediaMaxBytes(bucket, mimeType);
  if (
    sizeBytes > maxBytes ||
    entitlementLimitExceeded(0, sizeBytes, uploadFileSizeBytes)
  ) {
    throw new Error("media.too_large");
  }
}

async function assertMonthlyUploadsAvailable(
  current: CurrentUserProfile,
  uploadsPerMonth: number
) {
  if (uploadsPerMonth === -1) return;
  const uploadsThisMonth = await withDbRequestContext(current, (tx) => tx.mediaAsset.count({
    where: {
      uploaderId: current.dbUserId,
      createdAt: { gte: startOfCurrentUtcMonth() },
    },
  }));
  if (entitlementLimitExceeded(uploadsThisMonth, 1, uploadsPerMonth)) {
    throw new Error("media.quota_exceeded");
  }
}

async function assertStorageQuotaAvailable(
  current: CurrentUserProfile,
  candidateBytes: number,
  storageBytes: number
) {
  if (storageBytes === -1) return;
  const usage = await withDbRequestContext(current, (tx) => tx.mediaAsset.aggregate({
    where: {
      uploaderId: current.dbUserId,
      deletedAt: null,
    },
    _sum: { sizeBytes: true },
  }));
  const usedBytes = usage._sum.sizeBytes ?? 0;
  if (entitlementLimitExceeded(usedBytes, candidateBytes, storageBytes)) {
    throw new Error("media.quota_exceeded");
  }
}

/** @internal Exported for entitlement quota regression tests. */
export function entitlementLimitExceeded(
  currentUsage: number,
  requestedUsage: number,
  limit: number
) {
  return limit !== -1 && currentUsage + requestedUsage > limit;
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

async function claimPendingMedia(
  mediaId: string,
  leaseCutoff: Date,
  metadataJson: string | null,
) {
  const claimedAt = new Date();
  const result = await withDbSystemContext((tx) => tx.mediaAsset.updateMany({
    where: {
      id: mediaId,
      deletedAt: null,
      expiresAt: null,
      OR: [
        { scanStatus: "pending", processingStatus: "pending" },
        {
          processingStatus: { in: ["scanning", "processing"] },
          OR: [
            { processingStartedAt: null },
            { processingStartedAt: { lt: leaseCutoff } },
          ],
        },
      ],
    },
    data: {
      scanStatus: "pending",
      scanCompletedAt: null,
      processingStatus: "scanning",
      processingError: null,
      processingAttempts: { increment: 1 },
      processingStartedAt: claimedAt,
      processingCompletedAt: null,
      playbackPath: null,
      posterPath: null,
      hlsPath: null,
      waveformJson: null,
      metadataJson,
    },
  }));
  return result.count === 1;
}

async function markMediaProcessingStarted(
  media: ProcessingMedia,
  sizeBytes: number
) {
  const completedAt = new Date();
  const result = await withDbSystemContext((tx) => tx.mediaAsset.updateMany({
    where: {
      id: media.id,
      deletedAt: null,
      processingStatus: "scanning",
    },
    data: {
      scanStatus: "clean",
      scanCompletedAt: completedAt,
      sizeBytes,
      publicUrl: publicUrlForMedia(
        assertKnownBucket(media.storageBucket),
        media.storagePath
      ),
      processingStatus: "processing",
    },
  }));
  return result.count === 1;
}

async function completeMediaProcessing(
  mediaId: string,
  processed: ProcessedMedia
) {
  return withDbSystemContext(async (tx) => {
    const completedAt = new Date();
    const current = await tx.mediaAsset.findFirst({
      where: {
        id: mediaId,
        deletedAt: null,
        processingStatus: "processing",
      },
      select: { metadataJson: true },
    });
    if (!current) throw new Error("media.processing_state_conflict");
    const result = await tx.mediaAsset.updateMany({
      where: {
        id: mediaId,
        deletedAt: null,
        processingStatus: "processing",
      },
      data: {
        processingStatus: "ready",
        processingError: null,
        processingCompletedAt: completedAt,
        playbackPath: processed.playbackPath,
        posterPath: processed.posterPath,
        hlsPath: processed.hlsPath,
        waveformJson: processed.waveformJson,
        metadataJson: mergeProcessingMetadataJson(
          current.metadataJson,
          processed.metadataJson,
        ),
        widthPx: processed.widthPx,
        heightPx: processed.heightPx,
        durationSec: processed.durationSec,
      },
    });
    if (result.count !== 1) {
      throw new Error("media.processing_state_conflict");
    }
    await promoteReadyPersonalActorMediaWithTx(tx, mediaId);
    return reconcileLinkedFeedPosts(tx, mediaId, completedAt);
  });
}

export function isNewestProfileMediaCandidate(
  mediaId: string,
  candidates: ReadonlyArray<{ id: string; createdAt: Date | string }>,
) {
  let newest: { id: string; createdAt: Date | string } | undefined;
  for (const candidate of candidates) {
    if (!newest) {
      newest = candidate;
      continue;
    }
    const candidateTime = new Date(candidate.createdAt).getTime();
    const newestTime = new Date(newest.createdAt).getTime();
    if (
      candidateTime > newestTime ||
      (candidateTime === newestTime && candidate.id.localeCompare(newest.id) > 0)
    ) {
      newest = candidate;
    }
  }
  return newest?.id === mediaId;
}

export async function promoteReadyPersonalActorMedia(mediaId: string) {
  return withDbSystemContext((tx) =>
    promoteReadyPersonalActorMediaWithTx(tx, mediaId),
  );
}

async function promoteReadyPersonalActorMediaWithTx(tx: Tx, mediaId: string) {
  const media = await tx.mediaAsset.findFirst({
    where: {
      id: mediaId,
      deletedAt: null,
      scanStatus: "clean",
      processingStatus: "ready",
      linkedEntityType: {
        in: ["social_actor_avatar", "social_actor_cover"],
      },
      linkedEntityId: { not: null },
    },
  });
  if (!media?.linkedEntityId || !media.linkedEntityType) return false;

  const link = parseProfileMediaLink(media.metadataJson);
  const kind = media.linkedEntityType === "social_actor_avatar"
    ? "avatar"
    : "cover";
  if (!link || link.actorId !== media.linkedEntityId || link.kind !== kind) {
    return false;
  }

  const actor = await tx.socialActor.findFirst({
    where: { id: link.actorId, kind: "personal" },
    select: {
      id: true,
      profileId: true,
      ownerProfile: { select: { userId: true } },
    },
  });
  if (
    !actor?.profileId ||
    actor.ownerProfile.userId !== media.uploaderId
  ) {
    return false;
  }

  const candidates = await tx.mediaAsset.findMany({
    where: {
      linkedEntityType: media.linkedEntityType,
      linkedEntityId: actor.id,
      deletedAt: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 1_000,
    select: { id: true, createdAt: true },
  });
  if (!isNewestProfileMediaCandidate(media.id, candidates)) return false;

  const url = mediaDeliveryUrl(media);
  const position = kind === "avatar" ? -2 : -1;
  await tx.actorGalleryMedia.deleteMany({
    where: {
      actorId: actor.id,
      OR: [{ position }, { mediaId: media.id }],
    },
  });
  await tx.actorGalleryMedia.create({
    data: {
      actorId: actor.id,
      mediaId: media.id,
      position,
      altText: media.altText ?? (kind === "avatar" ? "Profile picture" : "Profile cover"),
    },
  });

  if (kind === "avatar") {
    await tx.profile.update({
      where: { id: actor.profileId },
      data: { avatarUrl: url },
    });
    await tx.socialActor.update({
      where: { id: actor.id },
      data: {
        avatarUrl: url,
        avatarFocalX: link.focalX,
        avatarFocalY: link.focalY,
        avatarZoom: link.zoom,
        avatarRotation: link.rotation,
      },
    });
  } else {
    await tx.socialActor.update({
      where: { id: actor.id },
      data: {
        coverUrl: url,
        coverFocalX: link.focalX,
        coverFocalY: link.focalY,
        coverZoom: link.zoom,
        coverRotation: link.rotation,
      },
    });
  }

  await tx.mediaAsset.updateMany({
    where: {
      id: { not: media.id },
      linkedEntityType: media.linkedEntityType,
      linkedEntityId: actor.id,
    },
    data: { linkedEntityType: null, linkedEntityId: null },
  });
  return true;
}

async function failMediaProcessing(
  mediaId: string,
  scanStatus: "clean" | "infected" | "error",
  processingError: string
) {
  return withDbSystemContext(async (tx) => {
    const completedAt = new Date();
    await tx.mediaAsset.updateMany({
      where: {
        id: mediaId,
        deletedAt: null,
        processingStatus: { in: ["pending", "scanning", "processing"] },
      },
      data: {
        scanStatus,
        scanCompletedAt: completedAt,
        processingStatus: "failed",
        processingError,
        processingCompletedAt: completedAt,
      },
    });
    return reconcileLinkedFeedPosts(tx, mediaId, completedAt);
  });
}

type FeedPostTransition = {
  postId: string;
  authorProfileId: string;
  visibility: string;
  status: "active" | "failed";
};

async function reconcileLinkedFeedPosts(
  tx: Tx,
  mediaId: string,
  completedAt: Date
) {
  const posts = await tx.feedPost.findMany({
    where: {
      status: "processing",
      deletedAt: null,
      media: { some: { mediaId } },
    },
    orderBy: { id: "asc" },
    take: 1_000,
    select: {
      id: true,
      authorProfileId: true,
      visibility: true,
      media: {
        orderBy: { position: "asc" },
        take: FEED_POST_MEDIA_LIMIT,
        select: {
          media: {
            select: { processingStatus: true, scanStatus: true },
          },
        },
      },
    },
  });
  const transitions: FeedPostTransition[] = [];
  for (const post of posts) {
    const status = feedPostStatusForMedia(
      post.media.map((attachment) => attachment.media)
    );
    if (!status) continue;
    const updated = await tx.feedPost.updateMany({
      where: { id: post.id, status: "processing", deletedAt: null },
      data: {
        status,
        publishedAt: status === "active" ? completedAt : null,
      },
    });
    if (updated.count === 1) {
      transitions.push({
        postId: post.id,
        authorProfileId: post.authorProfileId,
        visibility: post.visibility,
        status,
      });
    }
  }
  return transitions;
}

export function feedPostStatusForMedia(
  media: Array<{ processingStatus: string; scanStatus: string }>
) {
  if (
    media.some((item) =>
      item.processingStatus === "failed" ||
      item.scanStatus === "infected" ||
      item.scanStatus === "error"
    )
  ) {
    return "failed" as const;
  }
  if (
    media.length > 0 &&
    media.every((item) =>
      item.processingStatus === "ready" && item.scanStatus === "clean"
    )
  ) {
    return "active" as const;
  }
  return null;
}

async function notifyMediaProcessingVerdict(
  media: { id: string; uploaderId: string },
  verdict: "ready" | "failed",
  feedTransitions: FeedPostTransition[]
) {
  try {
    const attachment = await withDbSystemContext((tx) => tx.messageMedia.findFirst({
      where: { mediaId: media.id },
      select: { message: { select: { conversationId: true } } },
    }));
    const conversationId = attachment?.message.conversationId ?? null;

    if (verdict === "failed") {
      await createInAppNotification({
        userId: media.uploaderId,
        type: "media",
        title: "Media processing failed",
        body: "Review the attachment and replace or remove it before publishing.",
        href: feedTransitions[0]
          ? "/feed"
          : conversationId
            ? `/pulse/${conversationId}`
            : null,
        targetType: "media",
        targetId: media.id,
      });
    }

    if (conversationId) {
      await broadcastConversationRealtimeEvent(
        conversationId,
        "conversation_updated",
        {
          action: verdict === "ready" ? "media_ready" : "media_failed",
          mediaId: media.id,
        }
      );
    }
    for (const transition of feedTransitions) {
      const payload = {
        postId: transition.postId,
        action: transition.status === "active" ? "media_ready" : "media_failed",
      };
      await broadcastProfileRealtimeEvent(
        transition.authorProfileId,
        "feed_post_updated",
        payload
      );
      if (transition.visibility === "public") {
        await broadcastFeedRealtimeEvent("post_updated", payload);
      }
    }
  } catch (err) {
    await logRequestError(
      "media.processing_notify_failed",
      { mediaId: media.id },
      err,
    );
  }
}

function mediaProcessingError(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  if (message.startsWith("media.")) return message.slice(0, 120);
  if (message.startsWith("storage.")) return message.split(":", 1)[0];
  return "media.processing_failed";
}

function assertPrivateProcessingBucket(media: ProcessingMedia) {
  if (media.storageBucket !== PRIVATE_USER_MEDIA_BUCKET) {
    throw new Error("media.processing_bucket_not_private");
  }
}

// Sniff the stored bytes and confirm they match the client-declared mimeType.
// On mismatch, tombstone the asset (mark error + purge the object) the same way
// a failed scan does, then reject — never let a mislabeled file finalize.
const SNIFF_HEAD_BYTES = 4100;

async function assertStoredBytesMatchMimeType(
  bucket: ObjectStorageBucket,
  media: { id: string; storagePath: string; mimeType: string },
  options?: { markFailure?: boolean }
) {
  const head = await objectStorage.readObjectHead({
    bucket,
    key: media.storagePath,
    bytes: SNIFF_HEAD_BYTES,
  });
  if (sniffMatchesMimeType(head, media.mimeType as MediaMimeType)) return;

  if (options?.markFailure !== false) {
    await failMediaProcessing(media.id, "error", "media.invalid_type");
  }
  await objectStorage.deleteObject({
    bucket,
    key: media.storagePath,
  }).catch((err) =>
    logRequestError("media.invalid_type_purge_failed", { mediaId: media.id }, err)
  );
  throw new Error("media.invalid_type");
}

async function verifyStorageObjectForScan(media: {
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const bucket = assertKnownBucket(media.storageBucket);
  const objectInfo = await objectStorage.getObjectInfo({
    bucket,
    key: media.storagePath,
  });
  const sizeBytes = storageObjectSize(objectInfo, media.sizeBytes);
  assertMediaSize(
    bucket,
    media.mimeType as MediaMimeType,
    sizeBytes,
    mediaMaxBytes(bucket, media.mimeType as MediaMimeType)
  );
  return sizeBytes;
}

async function processMediaDerivatives(
  media: ProcessingMedia,
  deadlineAt: number
): Promise<ProcessedMedia> {
  const bucket = assertKnownBucket(media.storageBucket);
  const tempDir = await mkdtemp(path.join(tmpdir(), "ghiq-media-process-"));
  const inputPath = path.join(tempDir, "source-upload");
  const uploadedPaths: string[] = [];
  const uploadFile = async (
    localPath: string,
    storagePath: string,
    contentType: string
  ) => {
    await objectStorage.putObjectFromFile({
      bucket,
      key: storagePath,
      filePath: localPath,
      contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    uploadedPaths.push(storagePath);
  };
  const uploadBytes = async (
    bytes: Uint8Array,
    storagePath: string,
    contentType: string
  ) => {
    await objectStorage.putObject({
      bucket,
      key: storagePath,
      body: bytes,
      contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    uploadedPaths.push(storagePath);
  };

  try {
    await objectStorage.downloadObjectToFile({
      bucket,
      key: media.storagePath,
      destinationPath: inputPath,
    });

    const processed = media.mimeType.startsWith("image/")
      ? await processImageMedia(
          media,
          inputPath,
          tempDir,
          uploadFile,
          deadlineAt
        )
      : media.mimeType.startsWith("video/")
        ? await processVideoMedia(
            media,
            inputPath,
            tempDir,
            uploadFile,
            uploadBytes,
            deadlineAt
          )
        : media.mimeType.startsWith("audio/")
          ? await processAudioMedia(
              media,
              inputPath,
              tempDir,
              uploadFile,
              deadlineAt
            )
          : emptyProcessedMedia();
    return { ...processed, uploadedPaths };
  } catch (err) {
    await objectStorage.deleteObjects({
      bucket,
      keys: uploadedPaths,
    }).catch((cleanupErr) =>
      logRequestError(
        "media.derivative_cleanup_failed",
        { mediaId: media.id },
        cleanupErr
      )
    );
    throw err;
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => null);
  }
}

function emptyProcessedMedia(): ProcessedMedia {
  return {
    playbackPath: null,
    posterPath: null,
    hlsPath: null,
    waveformJson: null,
    metadataJson: null,
    uploadedPaths: [],
  };
}

async function processImageMedia(
  media: ProcessingMedia,
  inputPath: string,
  tempDir: string,
  uploadFile: (
    localPath: string,
    storagePath: string,
    contentType: string
  ) => Promise<void>,
  deadlineAt: number
) {
  const sharp = (await import("sharp")).default;
  const sourceMetadata = await sharp(inputPath)
    .timeout({ seconds: imageProcessingTimeoutSeconds(deadlineAt) })
    .metadata();
  const source = validateDecodedMediaMetadata(
    "image",
    { width: sourceMetadata.width, height: sourceMetadata.height },
    {
      width: media.widthPx,
      height: media.heightPx,
      durationSec: media.durationSec,
    },
  );
  const targetWidths = [...new Set([
    ...IMAGE_VARIANT_WIDTHS.filter((width) => width < source.width),
    source.width,
  ])].sort((a, b) => a - b);
  const variants: ImageVariant[] = [];

  for (const targetWidth of targetWidths) {
    const outputPath = path.join(tempDir, `image-${targetWidth}.webp`);
    const output = await sharp(inputPath)
      .timeout({ seconds: imageProcessingTimeoutSeconds(deadlineAt) })
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(outputPath);
    const storagePath = `${derivativeBasePath(media)}/image/${output.width}.webp`;
    await uploadFile(outputPath, storagePath, "image/webp");
    if (!variants.some((variant) => variant.width === output.width)) {
      variants.push({
        variant: `image-${output.width}`,
        path: storagePath,
        width: output.width,
        height: output.height,
      });
    }
  }

  const playback = variants.at(-1);
  if (!playback) throw new Error("media.image_processing_failed");
  const metadata: ProcessingMetadata = {
    imageVariants: variants,
    source: {
      width: source.width,
      height: source.height,
    },
  };
  return {
    ...emptyProcessedMedia(),
    playbackPath: playback.path,
    metadataJson: JSON.stringify(metadata),
    widthPx: playback.width,
    heightPx: playback.height,
  };
}

async function processVideoMedia(
  media: ProcessingMedia,
  inputPath: string,
  tempDir: string,
  uploadFile: (
    localPath: string,
    storagePath: string,
    contentType: string
  ) => Promise<void>,
  uploadBytes: (
    bytes: Uint8Array,
    storagePath: string,
    contentType: string
  ) => Promise<void>,
  deadlineAt: number
) {
  const source = validateDecodedMediaMetadata(
    "video",
    await probeMedia(inputPath, deadlineAt),
    {
      width: media.widthPx,
      height: media.heightPx,
      durationSec: media.durationSec,
    },
  );
  const basePath = derivativeBasePath(media);
  const playbackLocal = path.join(tempDir, "playback.mp4");
  const playbackPath = `${basePath}/video/playback.mp4`;
  await runFfmpeg([
    "-y",
    "-i", inputPath,
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    playbackLocal,
  ], deadlineAt);
  await uploadFile(playbackLocal, playbackPath, "video/mp4");

  const posterLocal = path.join(tempDir, "poster.jpg");
  const posterPath = `${basePath}/video/poster.jpg`;
  const posterAt = Math.max(0, Math.min(1, (source.durationSec ?? 0) / 2));
  await runFfmpeg([
    "-y",
    "-ss", posterAt.toFixed(3),
    "-i", inputPath,
    "-frames:v", "1",
    "-vf", "scale='min(1280,iw)':-2",
    "-q:v", "3",
    posterLocal,
  ], deadlineAt);
  await uploadFile(posterLocal, posterPath, "image/jpeg");

  const hls = await processVideoHls(
    media,
    inputPath,
    tempDir,
    source.width,
    source.height,
    uploadFile,
    uploadBytes,
    deadlineAt
  );
  const metadata: ProcessingMetadata = {
    hlsRenditions: hls.renditions,
    source,
  };
  return {
    ...emptyProcessedMedia(),
    playbackPath,
    posterPath,
    hlsPath: hls.masterPath,
    metadataJson: JSON.stringify(metadata),
    widthPx: source.width,
    heightPx: source.height,
    durationSec: source.durationSec ?? null,
  };
}

async function processVideoHls(
  media: ProcessingMedia,
  inputPath: string,
  tempDir: string,
  sourceWidth: number,
  sourceHeight: number,
  uploadFile: (
    localPath: string,
    storagePath: string,
    contentType: string
  ) => Promise<void>,
  uploadBytes: (
    bytes: Uint8Array,
    storagePath: string,
    contentType: string
  ) => Promise<void>,
  deadlineAt: number
) {
  const basePath = `${derivativeBasePath(media)}/hls`;
  const targetHeights = HLS_RENDITIONS.filter(
    (height) => height <= sourceHeight
  );
  const heights = targetHeights.length > 0
    ? [...targetHeights]
    : [Math.max(2, sourceHeight - (sourceHeight % 2))];
  const renditions: HlsRendition[] = [];

  for (const height of heights) {
    const renditionDir = path.join(tempDir, `hls-${height}`);
    await mkdir(renditionDir, { recursive: true });
    const playlistLocal = path.join(renditionDir, "index.m3u8");
    const segmentPattern = path.join(renditionDir, "segment-%05d.ts");
    await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a:0?",
      "-vf", `scale=-2:min(${height}\\,ih)`,
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-sc_threshold", "0",
      "-g", "48",
      "-keyint_min", "48",
      "-hls_time", "6",
      "-hls_playlist_type", "vod",
      "-hls_segment_filename", segmentPattern,
      playlistLocal,
    ], deadlineAt);

    const segmentNames = (await readdir(renditionDir))
      .filter((name) => /^segment-\d{5}\.ts$/.test(name))
      .sort();
    if (segmentNames.length === 0) {
      throw new Error("media.hls_processing_failed");
    }
    const segments: HlsSegment[] = [];
    for (const [index, segmentName] of segmentNames.entries()) {
      const variant = `hls-segment-${height}-${index}` as const;
      const segmentPath = `${basePath}/${height}/${segmentName}`;
      await uploadFile(
        path.join(renditionDir, segmentName),
        segmentPath,
        "video/mp2t"
      );
      segments.push({ variant, path: segmentPath });
    }

    const originalPlaylist = await readFile(playlistLocal, "utf8");
    const authorizedPlaylist = originalPlaylist.replace(
      /segment-(\d{5})\.ts/g,
      (_match, indexText: string) => {
        const index = Number(indexText);
        return mediaVariantUrl(media.id, `hls-segment-${height}-${index}`);
      }
    );
    const playlistPath = `${basePath}/${height}/index.m3u8`;
    await uploadBytes(
      Buffer.from(authorizedPlaylist, "utf8"),
      playlistPath,
      "application/vnd.apple.mpegurl"
    );
    const width = evenDimension((sourceWidth * height) / sourceHeight);
    const bandwidth = height <= 360 ? 900_000 : 2_800_000;
    renditions.push({
      variant: `hls-rendition-${height}`,
      path: playlistPath,
      width,
      height,
      bandwidth,
      segments,
    });
  }

  const master = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    ...renditions.flatMap((rendition) => [
      `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},RESOLUTION=${rendition.width}x${rendition.height}`,
      mediaVariantUrl(media.id, rendition.variant),
    ]),
    "",
  ].join("\n");
  const masterPath = `${basePath}/master.m3u8`;
  await uploadBytes(
    Buffer.from(master, "utf8"),
    masterPath,
    "application/vnd.apple.mpegurl"
  );
  return { masterPath, renditions };
}

async function processAudioMedia(
  media: ProcessingMedia,
  inputPath: string,
  tempDir: string,
  uploadFile: (
    localPath: string,
    storagePath: string,
    contentType: string
  ) => Promise<void>,
  deadlineAt: number
) {
  const source = validateDecodedMediaMetadata(
    "audio",
    await probeMedia(inputPath, deadlineAt),
    {
      width: media.widthPx,
      height: media.heightPx,
      durationSec: media.durationSec,
    },
  );
  const basePath = `${derivativeBasePath(media)}/audio`;
  const playbackLocal = path.join(tempDir, "playback.mp3");
  const playbackPath = `${basePath}/playback.mp3`;
  await runFfmpeg([
    "-y",
    "-i", inputPath,
    "-map", "0:a:0",
    "-vn",
    "-c:a", "libmp3lame",
    "-q:a", "2",
    playbackLocal,
  ], deadlineAt);
  await uploadFile(playbackLocal, playbackPath, "audio/mpeg");

  const waveformLocal = path.join(tempDir, "waveform.pcm");
  await runFfmpeg([
    "-y",
    "-i", inputPath,
    "-map", "0:a:0",
    "-ac", "1",
    "-ar", "8000",
    "-f", "s16le",
    waveformLocal,
  ], deadlineAt);
  const waveform = buildWaveform(await readFile(waveformLocal));
  const metadata: ProcessingMetadata = { source };
  return {
    ...emptyProcessedMedia(),
    playbackPath,
    waveformJson: JSON.stringify(waveform),
    metadataJson: JSON.stringify(metadata),
    durationSec: source.durationSec ?? null,
  };
}

export function buildWaveform(bytes: Uint8Array, points = 100) {
  if (bytes.byteLength < 2 || points <= 0) return [];
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const bucketSize = Math.max(1, Math.ceil(sampleCount / points));
  const waveform: number[] = [];
  for (let bucket = 0; bucket < points; bucket += 1) {
    const start = bucket * bucketSize;
    if (start >= sampleCount) break;
    const end = Math.min(sampleCount, start + bucketSize);
    let peak = 0;
    for (let sample = start; sample < end; sample += 1) {
      peak = Math.max(peak, Math.abs(view.getInt16(sample * 2, true)));
    }
    waveform.push(Number((peak / 32768).toFixed(4)));
  }
  return waveform;
}

async function probeMedia(inputPath: string, deadlineAt: number) {
  const remainingMs = remainingProcessingMs(deadlineAt);
  const { stdout } = await execFileAsync(
    ffprobeBinary(),
    [
      "-v", "error",
      "-show_entries", "format=duration:stream=width,height",
      "-of", "json",
      inputPath,
    ],
    {
      timeout: Math.min(ffmpegTimeoutMs(), remainingMs),
      maxBuffer: 1024 * 1024,
    }
  );
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string | number };
  };
  const video = parsed.streams?.find(
    (stream) => Number(stream.width) > 0 && Number(stream.height) > 0
  );
  const duration = Number(parsed.format?.duration);
  return {
    ...(video
      ? { width: Number(video.width), height: Number(video.height) }
      : {}),
    ...(Number.isFinite(duration) && duration >= 0
      ? { durationSec: duration }
      : {}),
  };
}

async function runFfmpeg(args: string[], deadlineAt: number) {
  const remainingMs = remainingProcessingMs(deadlineAt);
  await execFileAsync(ffmpegBinary(), args, {
    timeout: Math.min(ffmpegTimeoutMs(), remainingMs),
    maxBuffer: 4 * 1024 * 1024,
  });
}

function imageProcessingTimeoutSeconds(deadlineAt: number) {
  const timeoutMs = Math.min(
    IMAGE_PROCESSING_TIMEOUT_MS,
    remainingProcessingMs(deadlineAt),
  );
  return Math.max(1, Math.floor(timeoutMs / 1000));
}

function remainingProcessingMs(deadlineAt: number) {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 1000) throw new Error("media.processing_deadline_exceeded");
  return remainingMs;
}

function ffmpegBinary() {
  return process.env.MEDIA_FFMPEG_BIN?.trim() || "ffmpeg";
}

function ffprobeBinary() {
  return process.env.MEDIA_FFPROBE_BIN?.trim() || "ffprobe";
}

function ffmpegTimeoutMs() {
  const configured = Number(process.env.MEDIA_FFMPEG_TIMEOUT_MS ?? "");
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : FFMPEG_TIMEOUT_MS;
}

function evenDimension(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded - (rounded % 2);
}

function mediaVariantUrl(mediaId: string, variant: MediaDeliveryVariant) {
  return `/api/media/${encodeURIComponent(mediaId)}/blob?variant=${encodeURIComponent(variant)}`;
}

async function scanStorageObjectWithClamAv(
  bucket: ObjectStorageBucket,
  objectPath: string,
  mediaId: string
) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ghiq-media-scan-"));
  const tempFile = path.join(tempDir, "upload.bin");

  try {
    await objectStorage.downloadObjectToFile({
      bucket,
      key: objectPath,
      destinationPath: tempFile,
    });

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
      await logRequestError("media.scan_failed", { mediaId }, err);
      return "error" as const;
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => null);
  }
}

function clamScanBinary() {
  return process.env.MEDIA_CLAMSCAN_BIN?.trim() || "clamscan";
}

async function assertClamAvReady() {
  let definitionDate = await readClamAvDefinitionDate().catch((err) => {
    if ((err as Error).message === "media.clamav_definitions_unavailable") {
      return null;
    }
    throw err;
  });
  if (!definitionDate || clamAvDefinitionsNeedRefresh(definitionDate)) {
    try {
      await refreshClamAvDefinitions();
    } catch (err) {
      await logRequestError("media.clamav_refresh_failed", {}, err);
    }
    definitionDate = await readClamAvDefinitionDate();
  }
  if (Date.now() - definitionDate.getTime() > clamAvMaxDefinitionAgeMs()) {
    throw new Error("media.clamav_definitions_stale");
  }
}

async function readClamAvDefinitionDate() {
  let stdout: string | Buffer;
  try {
    ({ stdout } = await execFileAsync(clamScanBinary(), ["--version"], {
      timeout: 10_000,
      maxBuffer: 64 * 1024,
    }));
  } catch (err) {
    await logRequestError("media.clamav_readiness_failed", {}, err);
    throw new Error("media.clamav_unavailable");
  }
  const definitionDate = parseClamAvDefinitionDate(String(stdout));
  if (!definitionDate) throw new Error("media.clamav_definitions_unavailable");
  return definitionDate;
}

async function refreshClamAvDefinitions() {
  if (clamAvRefreshPromise) {
    await clamAvRefreshPromise;
    return;
  }
  const now = Date.now();
  if (now - lastClamAvRefreshAttemptAt < FRESHCLAM_RETRY_COOLDOWN_MS) return;
  lastClamAvRefreshAttemptAt = now;
  clamAvRefreshPromise = execFileAsync(
    freshClamBinary(),
    freshClamArgs(),
    { timeout: freshClamTimeoutMs(), maxBuffer: 1024 * 1024 }
  ).then(() => undefined).finally(() => {
    clamAvRefreshPromise = null;
  });
  await clamAvRefreshPromise;
}

export function parseClamAvDefinitionDate(output: string) {
  const match = /^[^/\r\n]+\/[^/\r\n]+\/(.+)$/m.exec(output.trim());
  if (!match) return null;
  const timestamp = Date.parse(match[1].trim());
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

export function clamAvDefinitionsNeedRefresh(
  definitionDate: Date,
  now = Date.now(),
  refreshIntervalMs = Math.min(
    clamAvRefreshIntervalMs(),
    clamAvMaxDefinitionAgeMs()
  )
) {
  return now - definitionDate.getTime() >= refreshIntervalMs;
}

function clamAvMaxDefinitionAgeMs() {
  const configured = Number(
    process.env.MEDIA_CLAMAV_MAX_DEFINITION_AGE_MS ?? ""
  );
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : CLAMAV_MAX_DEFINITION_AGE_MS;
}

function clamScanArgs() {
  const database = process.env.MEDIA_CLAMAV_DATABASE?.trim();
  return [
    "--no-summary",
    "--infected",
    ...(database ? [`--database=${database}`] : []),
  ];
}

function freshClamBinary() {
  return process.env.MEDIA_FRESHCLAM_BIN?.trim() || "freshclam";
}

function freshClamArgs() {
  const database = process.env.MEDIA_CLAMAV_DATABASE?.trim();
  return [
    "--stdout",
    "--no-warnings",
    ...(database ? [`--datadir=${database}`] : []),
  ];
}

function freshClamTimeoutMs() {
  const configured = Number(process.env.MEDIA_FRESHCLAM_TIMEOUT_MS ?? "");
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : FRESHCLAM_TIMEOUT_MS;
}

function clamAvRefreshIntervalMs() {
  const configured = Number(process.env.MEDIA_CLAMAV_REFRESH_INTERVAL_MS ?? "");
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : CLAMAV_REFRESH_INTERVAL_MS;
}

function clamScanTimeoutMs() {
  const configured = Number(process.env.MEDIA_CLAMSCAN_TIMEOUT_MS ?? "");
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : CLAMSCAN_TIMEOUT_MS;
}

function mediaProcessingLeaseMs() {
  const configured = Number(process.env.MEDIA_PROCESSING_LEASE_MS ?? "");
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : MEDIA_PROCESSING_LEASE_MS;
}

function mediaScanMode() {
  const configured = process.env.MEDIA_SCAN_MODE?.trim().toLowerCase();
  if (configured === "clamav") return "clamav";
  if (configured === "disabled") return "disabled";
  if (configured === "metadata") {
    return process.env.NODE_ENV === "production" ? "disabled" : "metadata";
  }
  return process.env.NODE_ENV === "production" ? "clamav" : "metadata";
}

function assertMediaReady(media: {
  scanStatus: string;
  processingStatus: string;
}) {
  if (media.scanStatus === "pending") throw new Error("media.scan_pending");
  if (media.scanStatus === "infected") throw new Error("media.infected");
  if (media.scanStatus !== "clean") throw new Error("media.scan_failed");
  if (media.processingStatus === "failed") {
    throw new Error("media.processing_failed");
  }
  if (media.processingStatus !== "ready") {
    throw new Error("media.processing_pending");
  }
}

async function findOwnedVideoForCaption(
  current: CurrentUserProfile,
  mediaId: string
) {
  const media = await withDbRequestContext(current, (tx) =>
    tx.mediaAsset.findFirst({
      where: {
        id: mediaId,
        uploaderId: current.dbUserId,
        deletedAt: null,
      },
    })
  );
  if (!media) throw new Error("media.not_found");
  if (!media.mimeType.startsWith("video/")) {
    throw new Error("media.caption_video_only");
  }
  if (media.storageBucket !== PRIVATE_USER_MEDIA_BUCKET) {
    throw new Error("media.caption_private_required");
  }
  return media;
}

function buildObjectPath(input: {
  bucket: ObjectStorageBucket;
  context: MediaContext;
  userId: string;
  linkedEntityId?: string;
  filename: string;
}) {
  const filename = `${randomUUID()}-${normalizeUploadFilename(input.filename)}`;
  const entityId = sanitizePathSegment(input.linkedEntityId ?? "pending");

  if (input.bucket === SITE_ASSETS_BUCKET) {
    return `site/${entityId}/${filename}`;
  }

  return `users/${sanitizePathSegment(input.userId)}/quarantine/${input.context}/${entityId}/${filename}`;
}

function sanitizeMediaAltText(value: string) {
  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return sanitized || null;
}

function sanitizePathSegment(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-") || "pending"
  );
}

function derivativeBasePath(media: { id: string; uploaderId: string; storageBucket: string }) {
  if (media.storageBucket === SITE_ASSETS_BUCKET) {
    return `site/processed/${sanitizePathSegment(media.id)}`;
  }
  return `users/${sanitizePathSegment(media.uploaderId)}/processed/${sanitizePathSegment(media.id)}`;
}

function assertDerivativePath(
  media: { id: string; uploaderId: string; storageBucket: string },
  storagePath: string
) {
  const base = `${derivativeBasePath(media)}/`;
  if (
    !storagePath.startsWith(base) ||
    storagePath.includes("\\") ||
    storagePath.split("/").includes("..")
  ) {
    throw new Error("media.variant_unavailable");
  }
}

function derivativeStoragePaths(media: ProcessingMedia) {
  const metadata = parseProcessingMetadata(media.metadataJson);
  const candidates = [
    media.playbackPath,
    media.posterPath,
    media.hlsPath,
    media.captionPath,
    ...(metadata.imageVariants ?? []).map((variant) => variant.path),
    ...(metadata.hlsRenditions ?? []).flatMap((rendition) => [
      rendition.path,
      ...rendition.segments.map((segment) => segment.path),
    ]),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(candidates)].filter((storagePath) => {
    try {
      assertDerivativePath(media, storagePath);
      return true;
    } catch {
      return false;
    }
  });
}

function publicUrlForMedia(
  bucket: ObjectStorageBucket,
  objectPath: string
) {
  return isPublicStorageBucket(bucket) ? publicStorageUrl(bucket, objectPath) : null;
}

function assertKnownBucket(bucket: string): ObjectStorageBucket {
  if (
    bucket === SITE_ASSETS_BUCKET ||
    bucket === PUBLIC_USER_MEDIA_BUCKET ||
    bucket === PRIVATE_USER_MEDIA_BUCKET
  ) {
    return bucket;
  }
  throw new Error("media.unknown_bucket");
}
