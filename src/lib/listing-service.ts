import type { CurrentUserProfile } from "@/lib/auth";
import { createAuditLog } from "@/lib/account-service";
import { prisma } from "@/lib/db";
import {
  assertMediaAttachable,
  attachMediaToListing,
} from "@/lib/media-service";

const LISTING_DURATION_DAYS = 90;
const SOLD_SEARCH_DAYS = 30;
const MAX_LISTING_IMAGES = 10;
const MAX_LISTING_VIDEOS = 1;

export interface ListingMaintenanceResult {
  expiredCount: number;
  archivedSoldCount: number;
  ranAt: string;
}

export interface ListingWriteInput {
  type: string;
  title: string;
  description: string;
  state?: string | null;
  dogId?: string | null;
  price?: number | null;
  mediaIds?: string[];
}

export async function createListingForCurrentUser(
  current: CurrentUserProfile,
  input: ListingWriteInput
) {
  const dogId = input.dogId || null;
  if (dogId) await assertDogExists(dogId);
  const mediaIds = input.mediaIds ?? [];
  await assertListingMediaAttachable(current, mediaIds);

  const listing = await prisma.$transaction(async (tx) => {
    const created = await tx.listing.create({
      data: {
        profileId: current.profileId,
        type: input.type,
        title: input.title,
        description: input.description,
        state: input.state || null,
        dogId,
        price: input.price ?? null,
        currency: "AUD",
        status: "active",
        expiresAt: listingExpiryDate(),
        soldAt: null,
        archivedAt: null,
      },
    });
    await attachMediaToListing(tx, created.id, mediaIds);
    return created;
  });

  await auditListing(current, "listing.create", listing.id);
  return listing;
}

export async function updateListingForCurrentUser(
  current: CurrentUserProfile,
  listingId: string,
  input: Partial<ListingWriteInput>
) {
  const existing = await getOwnedListing(current, listingId);
  const dogId = input.dogId === undefined ? existing.dogId : input.dogId || null;
  if (dogId) await assertDogExists(dogId);
  if (input.mediaIds) {
    await assertListingMediaAttachable(current, input.mediaIds);
  }

  const listing = await prisma.$transaction(async (tx) => {
    const updated = await tx.listing.update({
      where: { id: existing.id },
      data: {
        type: input.type ?? existing.type,
        title: input.title ?? existing.title,
        description: input.description ?? existing.description,
        state: input.state === undefined ? existing.state : input.state || null,
        dogId,
        price: input.price === undefined ? existing.price : input.price ?? null,
      },
    });

    if (input.mediaIds) {
      await tx.listingMedia.deleteMany({ where: { listingId: existing.id } });
      await attachMediaToListing(tx, existing.id, input.mediaIds);
    }

    return updated;
  });

  await auditListing(current, "listing.update", listing.id);
  return listing;
}

export async function renewListingForCurrentUser(
  current: CurrentUserProfile,
  listingId: string
) {
  const existing = await getOwnedListing(current, listingId);
  const listing = await prisma.listing.update({
    where: { id: existing.id },
    data: {
      status: "active",
      expiresAt: listingExpiryDate(),
      soldAt: null,
      archivedAt: null,
    },
  });

  await auditListing(current, "listing.renew", listing.id);
  return listing;
}

export async function markListingSoldForCurrentUser(
  current: CurrentUserProfile,
  listingId: string
) {
  const existing = await getOwnedListing(current, listingId);
  const listing = await prisma.listing.update({
    where: { id: existing.id },
    data: {
      status: "sold",
      soldAt: new Date(),
      archivedAt: null,
    },
  });

  await auditListing(current, "listing.sold", listing.id);
  return listing;
}

export async function withdrawListingForCurrentUser(
  current: CurrentUserProfile,
  listingId: string
) {
  const existing = await getOwnedListing(current, listingId);
  const listing = await prisma.listing.update({
    where: { id: existing.id },
    data: {
      status: "withdrawn",
      archivedAt: null,
    },
  });

  await auditListing(current, "listing.withdraw", listing.id);
  return listing;
}

export async function getPublicListingById(listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: listingInclude(),
  });
  if (!listing || listing.status === "archived" || listing.archivedAt) {
    throw new Error("listing.not_found");
  }

  return prisma.listing.update({
    where: { id: listing.id },
    data: { views: { increment: 1 } },
    include: listingInclude(),
  });
}

export async function runListingMaintenance(
  now = new Date()
): Promise<ListingMaintenanceResult> {
  const soldCutoff = soldSearchCutoffDate(now);

  const [expired, archivedSold] = await prisma.$transaction([
    prisma.listing.updateMany({
      where: {
        status: "active",
        archivedAt: null,
        expiresAt: { lt: now },
      },
      data: {
        status: "expired",
      },
    }),
    prisma.listing.updateMany({
      where: {
        status: "sold",
        archivedAt: null,
        soldAt: { lt: soldCutoff },
      },
      data: {
        status: "archived",
        archivedAt: now,
      },
    }),
  ]);

  if (expired.count > 0 || archivedSold.count > 0) {
    await createAuditLog({
      actorType: "system",
      action: "listing.maintenance",
      targetType: "listing",
      metadata: {
        expiredCount: expired.count,
        archivedSoldCount: archivedSold.count,
        soldCutoff: soldCutoff.toISOString(),
        ranAt: now.toISOString(),
      },
    });
  }

  return {
    expiredCount: expired.count,
    archivedSoldCount: archivedSold.count,
    ranAt: now.toISOString(),
  };
}

export function listingIsExpired(listing: { expiresAt: Date | null }) {
  return Boolean(listing.expiresAt && listing.expiresAt < new Date());
}

export function listingExpiryDate(date = new Date()) {
  const expiresAt = new Date(date);
  expiresAt.setDate(expiresAt.getDate() + LISTING_DURATION_DAYS);
  return expiresAt;
}

export function soldSearchCutoffDate(date = new Date()) {
  const cutoff = new Date(date);
  cutoff.setDate(cutoff.getDate() - SOLD_SEARCH_DAYS);
  return cutoff;
}

export function listingInclude() {
  return {
    profile: { include: { user: { select: { email: true } } } },
    media: {
      orderBy: { position: "asc" },
      include: { media: true },
    },
    dog: {
      include: {
        sire: { select: { name: true } },
        dam: { select: { name: true } },
      },
    },
  } as const;
}

async function getOwnedListing(
  current: CurrentUserProfile,
  listingId: string
) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, profileId: current.profileId },
  });
  if (!listing) throw new Error("listing.not_found");
  return listing;
}

async function assertDogExists(dogId: string) {
  const dog = await prisma.dog.findUnique({ where: { id: dogId } });
  if (!dog) throw new Error("listing.dog_not_found");
}

async function assertListingMediaAttachable(
  current: CurrentUserProfile,
  mediaIds: string[]
) {
  const media = await assertMediaAttachable(current, mediaIds, 11);
  const imageCount = media.filter((item) => item.mimeType.startsWith("image/")).length;
  const videoCount = media.filter((item) => item.mimeType.startsWith("video/")).length;

  if (imageCount + videoCount !== media.length) {
    throw new Error("listing.media_unsupported");
  }
  if (imageCount > MAX_LISTING_IMAGES) {
    throw new Error("listing.too_many_images");
  }
  if (videoCount > MAX_LISTING_VIDEOS) {
    throw new Error("listing.too_many_videos");
  }

  return media;
}

async function auditListing(
  current: CurrentUserProfile,
  action: string,
  listingId: string
) {
  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action,
    targetType: "listing",
    targetId: listingId,
  });
}
