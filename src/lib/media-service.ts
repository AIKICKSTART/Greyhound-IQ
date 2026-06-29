import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/account-service";
import type { CurrentUser, CurrentUserProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  mediaMaxBytes,
  type MediaBucket,
  type MediaMimeType,
} from "@/lib/media-validation";

const UPLOAD_URL_TTL_MS = 10 * 60 * 1000;
const DOWNLOAD_URL_TTL_MS = 15 * 60 * 1000;
const EICAR_SIGNATURE =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

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
  bucket: MediaBucket;
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
  origin: string
) {
  assertMediaSize(input.mimeType, input.sizeBytes);
  tokenSecret();
  await assertQuotaAvailable(current, input.sizeBytes);

  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS);
  const storagePath = [
    input.bucket,
    current.dbUserId,
    randomUUID(),
    sanitizeFilename(input.filename),
  ].join("/");

  const media = await prisma.mediaAsset.create({
    data: {
      uploaderId: current.dbUserId,
      storageBucket: input.bucket,
      storagePath,
      originalName: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
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
      bucket: input.bucket,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageMode: "local_signed",
    },
  });

  const expires = expiresAt.getTime().toString();
  const token = signToken("upload", media.id, expires);
  const uploadUrl = new URL(
    `/api/media/${media.id}/local-upload`,
    origin
  );
  uploadUrl.searchParams.set("expires", expires);
  uploadUrl.searchParams.set("token", token);

  return {
    mediaId: media.id,
    uploadUrl: uploadUrl.toString(),
    storagePath: media.storagePath,
    expiresAt: expiresAt.toISOString(),
    storageMode: "local_signed",
  };
}

export async function acceptLocalUpload(
  mediaId: string,
  expires: string | null,
  token: string | null,
  request: Request
) {
  verifyToken("upload", mediaId, expires, token);

  const media = await prisma.mediaAsset.findFirst({
    where: { id: mediaId, deletedAt: null },
  });
  if (!media) throw new Error("media.not_found");
  if (media.scanStatus !== "pending") throw new Error("media.already_finalized");
  if (media.expiresAt && media.expiresAt < new Date()) {
    throw new Error("media.upload_expired");
  }

  const contentType = request.headers.get("content-type")?.split(";")[0];
  if (contentType && contentType !== media.mimeType) {
    throw new Error("media.mime_mismatch");
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength !== media.sizeBytes) {
    throw new Error("media.size_mismatch");
  }
  assertMediaSize(media.mimeType as MediaMimeType, body.byteLength);

  const absolutePath = localPathForStoragePath(media.storagePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, body);

  const sha256 = createHash("sha256").update(body).digest("hex");
  await prisma.mediaAsset.update({
    where: { id: media.id },
    data: {
      sha256,
      sizeBytes: body.byteLength,
    },
  });

  return { mediaId: media.id, sha256 };
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

  if (input.scanStatus === "infected") {
    await markMediaScanStatus(media.id, "infected");
    throw new Error("media.infected");
  }
  if (input.scanStatus === "error") {
    await markMediaScanStatus(media.id, "error");
    throw new Error("media.scan_failed");
  }

  const localPath = localPathForStoragePath(media.storagePath);
  const localFile = await localFileExists(localPath);
  const sha256 =
    input.sha256?.toLowerCase() ??
    media.sha256 ??
    (localFile ? await hashFile(localPath) : null);

  if (!sha256) throw new Error("media.hash_required");
  if (localFile && (await localFileLooksInfected(localPath))) {
    await markMediaScanStatus(media.id, "infected");
    throw new Error("media.infected");
  }

  assertMediaSize(media.mimeType as MediaMimeType, media.sizeBytes);
  await assertQuotaAvailable(current, 0);

  const finalized = await prisma.mediaAsset.update({
    where: { id: media.id },
    data: {
      sha256,
      widthPx: input.widthPx ?? null,
      heightPx: input.heightPx ?? null,
      durationSec: input.durationSec ?? null,
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
      mimeType: finalized.mimeType,
      sizeBytes: finalized.sizeBytes,
      scanStatus: finalized.scanStatus,
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
  origin: string
) {
  const media = await getMediaForCurrentUser(current, mediaId);
  assertMediaClean(media.scanStatus);

  const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_MS);
  const expires = expiresAt.getTime().toString();
  const token = signToken("download", media.id, expires);
  const url = new URL(`/api/media/${media.id}/blob`, origin);
  url.searchParams.set("expires", expires);
  url.searchParams.set("token", token);

  return {
    mediaId: media.id,
    url: url.toString(),
    expiresAt: expiresAt.toISOString(),
    storageMode: "local_signed",
  };
}

export async function deleteMediaForCurrentUser(
  current: CurrentUserProfile,
  mediaId: string
) {
  const media = await prisma.mediaAsset.findFirst({
    where: {
      id: mediaId,
      uploaderId: current.dbUserId,
      deletedAt: null,
    },
  });
  if (!media) throw new Error("media.not_found");

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
  });

  return deleted;
}

export async function getMediaBlob(
  mediaId: string,
  current: CurrentUser | null,
  expires: string | null,
  token: string | null
) {
  const tokenValid =
    expires !== null && token !== null
      ? isTokenValid("download", mediaId, expires, token)
      : false;

  const media = tokenValid
    ? await prisma.mediaAsset.findFirst({
        where: { id: mediaId, deletedAt: null, scanStatus: "clean" },
      })
    : current?.profileId
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
            listingAttachments: {
              some: {
                listing: publicListingMediaWhere(),
              },
            },
          },
        });

  if (!media) throw new Error("media.not_found");
  assertMediaClean(media.scanStatus);

  const absolutePath = localPathForStoragePath(media.storagePath);
  if (!(await localFileExists(absolutePath))) {
    throw new Error("media.file_not_found");
  }

  return {
    media,
    absolutePath,
    stream: createReadStream(absolutePath),
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
}

function mediaAccessWhere(
  mediaId: string,
  current: { dbUserId: string; profileId: string }
) {
  return {
    id: mediaId,
    deletedAt: null,
    OR: [
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

function assertMediaSize(mimeType: MediaMimeType, sizeBytes: number) {
  const maxBytes = mediaMaxBytes(mimeType);
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

function sanitizeFilename(filename: string) {
  const safe = filename
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
  return safe || "upload.bin";
}

function localMediaRoot() {
  return path.resolve(process.cwd(), ".local-media");
}

function localPathForStoragePath(storagePath: string) {
  const root = localMediaRoot();
  const resolved = path.resolve(root, ...storagePath.split("/").filter(Boolean));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("media.invalid_path");
  }
  return resolved;
}

async function localFileExists(absolutePath: string) {
  try {
    const info = await stat(absolutePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function hashFile(absolutePath: string) {
  const hash = createHash("sha256");
  const stream = createReadStream(absolutePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function localFileLooksInfected(absolutePath: string) {
  const buffer = await readFile(absolutePath);
  return buffer.includes(Buffer.from(EICAR_SIGNATURE));
}

function tokenSecret() {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.WORKOS_CLIENT_SECRET ??
    null;
  if (!secret) throw new Error("media.secret_not_configured");
  return secret;
}

function signToken(scope: "upload" | "download", mediaId: string, expires: string) {
  return createHmac("sha256", tokenSecret())
    .update(`${scope}:${mediaId}:${expires}`)
    .digest("hex");
}

function verifyToken(
  scope: "upload" | "download",
  mediaId: string,
  expires: string | null,
  token: string | null
) {
  if (!isTokenValid(scope, mediaId, expires, token)) {
    throw new Error("auth.forbidden");
  }
}

function isTokenValid(
  scope: "upload" | "download",
  mediaId: string,
  expires: string | null,
  token: string | null
) {
  if (!expires || !token) return false;
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = signToken(scope, mediaId, expires);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(token, "hex");
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
