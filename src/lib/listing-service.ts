import type { CurrentUserProfile } from "@/lib/auth-types";
import { isModeratorRole } from "@/lib/auth-roles";
import { assertPaidFeatureAccess } from "@/lib/tier-access";
import type { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/account-service";
import {
  sendConversationMessage,
  startOrGetConversation,
} from "@/lib/conversation-service";
import { prisma } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";
import {
  assertListingAcknowledgements,
  assertListingMediaPolicy,
} from "@/lib/listing-policy";
import {
  assertMediaAttachable,
  attachMediaToListing,
} from "@/lib/media-service";
import {
  createInAppNotification,
  notificationBodySnippet,
} from "@/lib/notification-service";
import { findBannedPhraseMatch } from "@/lib/moderation-service";

const LISTING_DURATION_DAYS = 90;
const SOLD_SEARCH_DAYS = 30;
const LISTING_STATUS_ACTIVE = "active";
const LISTING_STATUS_PENDING_REVIEW = "pending_review";
const LISTING_STATUS_REJECTED = "rejected";
const LISTING_STATUS_REMOVED = "removed";
const LISTING_MODERATION_APPROVED = "approved";

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
  region?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  categoryId?: string | null;
  condition?: string | null;
  negotiable?: boolean;
  contactPreference?: string | null;
  dogId?: string | null;
  price?: number | null;
  welfareAcknowledged?: boolean;
  legalAcknowledged?: boolean;
  mediaIds?: string[];
  attributes?: ListingAttributeInput[];
}

export interface ListingAttributeInput {
  key: string;
  value: string;
}

export async function createListingForCurrentUser(
  current: CurrentUserProfile,
  input: ListingWriteInput
) {
  assertPaidFeatureAccess(current);
  const dogId = input.dogId || null;
  if (dogId) await assertDogExists(dogId);
  const categoryId = input.categoryId || (await defaultCategoryIdForType(input.type));
  if (categoryId) await assertCategoryExists(categoryId);
  assertListingAcknowledgements(input);
  const mediaIds = input.mediaIds ?? [];
  await assertListingMediaAttachable(current, mediaIds);
  const now = new Date();
  const phraseMatch = await findBannedPhraseMatch(
    `${input.title} ${input.description}`,
    "listing"
  );
  const moderationReason = phraseMatch
    ? `Keyword flag: ${phraseMatch.reason ?? phraseMatch.phrase}`
    : null;

  const listing = await withDbRequestContext(current, async (tx) => {
    const created = await tx.listing.create({
      data: {
        profileId: current.profileId,
        categoryId,
        type: input.type,
        listingType: input.type,
        title: input.title,
        description: input.description,
        state: input.state || null,
        condition: input.condition || null,
        negotiable: input.negotiable ?? false,
        contactPreference: input.contactPreference || "message",
        dogId,
        price: input.price ?? null,
        currency: "AUD",
        status: LISTING_STATUS_PENDING_REVIEW,
        moderationStatus: LISTING_STATUS_PENDING_REVIEW,
        moderationReason,
        welfareAcknowledgedAt: input.welfareAcknowledged ? now : null,
        legalAcknowledgedAt: input.legalAcknowledged ? now : null,
        expiresAt: null,
        soldAt: null,
        archivedAt: null,
      },
    });
    await tx.listingStatusHistory.create({
      data: {
        listingId: created.id,
        toStatus: LISTING_STATUS_PENDING_REVIEW,
        actorProfileId: current.profileId,
        reason: moderationReason ?? "Listing submitted for moderator review",
      },
    });
    await upsertListingLocation(tx, created.id, input);
    await replaceListingAttributes(tx, created.id, input.attributes);
    await upsertListingSearchIndex(tx, {
      ...created,
      region: input.region,
      suburb: input.suburb,
      postcode: input.postcode,
      attributes: input.attributes,
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
  assertPaidFeatureAccess(current);
  const existing = await getOwnedListing(current, listingId);
  const dogId = input.dogId === undefined ? existing.dogId : input.dogId || null;
  if (dogId) await assertDogExists(dogId);
  if (input.categoryId) await assertCategoryExists(input.categoryId);
  if (input.mediaIds) {
    await assertListingMediaAttachable(current, input.mediaIds);
  }
  const phraseMatch =
    input.title || input.description
      ? await findBannedPhraseMatch(
          `${input.title ?? existing.title} ${input.description ?? existing.description}`,
          "listing"
        )
      : null;
  const moderationReason = phraseMatch
    ? `Keyword flag: ${phraseMatch.reason ?? phraseMatch.phrase}`
    : existing.status === LISTING_STATUS_ACTIVE
      ? null
      : existing.moderationReason;
  const nextStatus =
    existing.status === LISTING_STATUS_ACTIVE
      ? LISTING_STATUS_PENDING_REVIEW
      : existing.status;

  const listing = await prisma.$transaction(async (tx) => {
    const updated = await tx.listing.update({
      where: { id: existing.id },
      data: {
        categoryId:
          input.categoryId === undefined
            ? existing.categoryId
            : input.categoryId || null,
        type: input.type ?? existing.type,
        listingType: input.type ?? existing.listingType ?? existing.type,
        title: input.title ?? existing.title,
        description: input.description ?? existing.description,
        state: input.state === undefined ? existing.state : input.state || null,
        condition:
          input.condition === undefined
            ? existing.condition
            : input.condition || null,
        negotiable: input.negotiable ?? existing.negotiable,
        contactPreference:
          input.contactPreference === undefined
            ? existing.contactPreference
            : input.contactPreference || "message",
        dogId,
        price: input.price === undefined ? existing.price : input.price ?? null,
        status: nextStatus,
        moderationStatus:
          existing.status === LISTING_STATUS_ACTIVE
            ? LISTING_STATUS_PENDING_REVIEW
            : existing.moderationStatus,
        moderationReason,
        reviewedById:
          existing.status === LISTING_STATUS_ACTIVE
            ? null
            : existing.reviewedById,
        reviewedAt:
          existing.status === LISTING_STATUS_ACTIVE ? null : existing.reviewedAt,
        expiresAt:
          existing.status === LISTING_STATUS_ACTIVE ? null : existing.expiresAt,
      },
    });
    if (existing.status !== nextStatus) {
      await tx.listingStatusHistory.create({
        data: {
          listingId: existing.id,
          fromStatus: existing.status,
          toStatus: nextStatus,
          actorProfileId: current.profileId,
          reason: moderationReason ?? "Listing edited and returned to review",
        },
      });
    }
    await upsertListingLocation(tx, existing.id, {
      state: updated.state,
      region: input.region,
      suburb: input.suburb,
      postcode: input.postcode,
    });
    if (input.attributes !== undefined) {
      await replaceListingAttributes(tx, existing.id, input.attributes);
    }
    const searchAttributes =
      input.attributes === undefined
        ? await tx.listingAttribute.findMany({
            where: { listingId: existing.id },
            select: { key: true, value: true },
          })
        : input.attributes;
    await upsertListingSearchIndex(tx, {
      ...updated,
      region: input.region,
      suburb: input.suburb,
      postcode: input.postcode,
      attributes: searchAttributes,
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

export async function getMarketplaceCategoriesForModerator() {
  return prisma.marketplaceCategory.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { listings: true },
      },
    },
  });
}

export async function createMarketplaceCategoryForModerator(
  current: CurrentUserProfile,
  input: {
    name: string;
    slug?: string | null;
    description?: string | null;
    sortOrder: number;
  }
) {
  assertModerator(current);
  const slug = normalizeCategorySlug(input.slug ?? input.name);
  const category = await prisma.marketplaceCategory.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      sortOrder: input.sortOrder,
      active: true,
    },
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: "marketplace.category.create",
    targetType: "marketplace_category",
    targetId: category.id,
    metadata: { slug },
  });

  return category;
}

export async function setMarketplaceCategoryActiveForModerator(
  current: CurrentUserProfile,
  categoryId: string,
  active: boolean
) {
  assertModerator(current);
  const category = await prisma.marketplaceCategory.update({
    where: { id: categoryId },
    data: { active },
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: active
      ? "marketplace.category.activate"
      : "marketplace.category.deactivate",
    targetType: "marketplace_category",
    targetId: category.id,
    metadata: { slug: category.slug },
  });

  return category;
}

export async function renewListingForCurrentUser(
  current: CurrentUserProfile,
  listingId: string
) {
  assertPaidFeatureAccess(current);
  const existing = await getOwnedListing(current, listingId);
  const listing = await prisma.$transaction(async (tx) => {
    const updated = await tx.listing.update({
      where: { id: existing.id },
      data: {
        status: LISTING_STATUS_PENDING_REVIEW,
        moderationStatus: LISTING_STATUS_PENDING_REVIEW,
        moderationReason: null,
        reviewedById: null,
        reviewedAt: null,
        expiresAt: null,
        soldAt: null,
        archivedAt: null,
      },
    });
    await tx.listingStatusHistory.create({
      data: {
        listingId: existing.id,
        fromStatus: existing.status,
        toStatus: LISTING_STATUS_PENDING_REVIEW,
        actorProfileId: current.profileId,
        reason: "Listing renewed and returned to review",
      },
    });
    return updated;
  });

  await auditListing(current, "listing.renew", listing.id);
  return listing;
}

export async function markListingSoldForCurrentUser(
  current: CurrentUserProfile,
  listingId: string
) {
  const existing = await getOwnedListing(current, listingId);
  const listing = await prisma.$transaction(async (tx) => {
    const updated = await tx.listing.update({
      where: { id: existing.id },
      data: {
        status: "sold",
        soldAt: new Date(),
        archivedAt: null,
      },
    });
    await tx.listingStatusHistory.create({
      data: {
        listingId: existing.id,
        fromStatus: existing.status,
        toStatus: "sold",
        actorProfileId: current.profileId,
        reason: "Owner marked listing sold",
      },
    });
    return updated;
  });

  await auditListing(current, "listing.sold", listing.id);
  return listing;
}

export async function withdrawListingForCurrentUser(
  current: CurrentUserProfile,
  listingId: string
) {
  const existing = await getOwnedListing(current, listingId);
  const listing = await prisma.$transaction(async (tx) => {
    const updated = await tx.listing.update({
      where: { id: existing.id },
      data: {
        status: "withdrawn",
        archivedAt: null,
      },
    });
    await tx.listingStatusHistory.create({
      data: {
        listingId: existing.id,
        fromStatus: existing.status,
        toStatus: "withdrawn",
        actorProfileId: current.profileId,
        reason: "Owner withdrew listing",
      },
    });
    return updated;
  });

  await auditListing(current, "listing.withdraw", listing.id);
  return listing;
}

export async function approveListingForModerator(
  current: CurrentUserProfile,
  listingId: string
) {
  assertModerator(current);
  const existing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!existing) throw new Error("listing.not_found");
  const listing = await prisma.$transaction(async (tx) => {
    const updated = await tx.listing.update({
      where: { id: listingId },
      data: {
        status: LISTING_STATUS_ACTIVE,
        moderationStatus: LISTING_MODERATION_APPROVED,
        moderationReason: null,
        reviewedById: current.profileId,
        reviewedAt: new Date(),
        expiresAt: listingExpiryDate(),
        soldAt: null,
        archivedAt: null,
      },
    });
    await tx.listingStatusHistory.create({
      data: {
        listingId,
        fromStatus: existing.status,
        toStatus: LISTING_STATUS_ACTIVE,
        actorProfileId: current.profileId,
        reason: "Approved marketplace listing",
      },
    });
    return updated;
  });

  await auditListingModeration(
    current,
    "listing.approve",
    listing.id,
    "Approved marketplace listing"
  );
  return listing;
}

export async function rejectListingForModerator(
  current: CurrentUserProfile,
  listingId: string,
  reason: string
) {
  assertModerator(current);
  const existing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!existing) throw new Error("listing.not_found");
  const listing = await prisma.$transaction(async (tx) => {
    const updated = await tx.listing.update({
      where: { id: listingId },
      data: {
        status: LISTING_STATUS_REJECTED,
        moderationStatus: LISTING_STATUS_REJECTED,
        moderationReason: reason,
        reviewedById: current.profileId,
        reviewedAt: new Date(),
        archivedAt: null,
      },
    });
    await tx.listingStatusHistory.create({
      data: {
        listingId,
        fromStatus: existing.status,
        toStatus: LISTING_STATUS_REJECTED,
        actorProfileId: current.profileId,
        reason,
      },
    });
    return updated;
  });

  await auditListingModeration(current, "listing.reject", listing.id, reason);
  return listing;
}

export async function removeListingForModerator(
  current: CurrentUserProfile,
  listingId: string,
  reason: string
) {
  assertModerator(current);
  const existing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!existing) throw new Error("listing.not_found");
  const listing = await prisma.$transaction(async (tx) => {
    const updated = await tx.listing.update({
      where: { id: listingId },
      data: {
        status: LISTING_STATUS_REMOVED,
        moderationStatus: LISTING_STATUS_REMOVED,
        moderationReason: reason,
        reviewedById: current.profileId,
        reviewedAt: new Date(),
        archivedAt: new Date(),
      },
    });
    await tx.listingStatusHistory.create({
      data: {
        listingId,
        fromStatus: existing.status,
        toStatus: LISTING_STATUS_REMOVED,
        actorProfileId: current.profileId,
        reason,
      },
    });
    return updated;
  });

  await auditListingModeration(current, "listing.remove", listing.id, reason);
  return listing;
}

export async function getPublicListingById(listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: listingInclude(),
  });
  if (!listing || !listingIsPublic(listing)) {
    throw new Error("listing.not_found");
  }

  return listing;
}

export async function getListingForViewerById(
  listingId: string,
  current?: { profileId: string | null; role: string | null } | null
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: listingInclude(),
  });
  if (!listing) throw new Error("listing.not_found");

  if (listingIsPublic(listing)) {
    return listing;
  }

  const canView =
    current?.profileId === listing.profileId || isModeratorRole(current?.role);
  if (!canView) throw new Error("listing.not_found");
  return listing;
}

export async function createListingEnquiryForCurrentUser(
  current: CurrentUserProfile,
  listingId: string,
  message: string
) {
  assertPaidFeatureAccess(current);
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { profile: true },
  });
  if (!listing || !listingIsPublic(listing)) throw new Error("listing.not_found");
  if (listing.profileId === current.profileId) {
    throw new Error("listing.cannot_enquire_own_listing");
  }

  const conversation = await startOrGetConversation(current, listing.profileId);
  await sendConversationMessage(current, conversation.id, {
    body: `Listing enquiry: ${listing.title}\n\n${message}`,
  });

  const enquiry = await withDbRequestContext(current, (tx) => tx.listingEnquiry.create({
    data: {
      listingId: listing.id,
      conversationId: conversation.id,
      fromProfileId: current.profileId,
      toProfileId: listing.profileId,
      message,
      status: "open",
    },
  }));

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "listing.enquiry.create",
    targetType: "listing",
    targetId: listing.id,
    metadata: {
      enquiryId: enquiry.id,
      conversationId: conversation.id,
      sellerProfileId: listing.profileId,
    },
  });
  await createInAppNotification({
    userId: listing.profile.userId,
    actorProfileId: current.profileId,
    type: "listing_enquiry",
    title: `New enquiry for ${listing.title}`,
    body: notificationBodySnippet(message),
    href: `/pulse/${conversation.id}`,
    targetType: "listing",
    targetId: listing.id,
    metadata: { enquiryId: enquiry.id },
  });

  return { enquiry, conversationId: conversation.id };
}

export async function toggleSavedListingForCurrentUser(
  current: CurrentUserProfile,
  listingId: string
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      profileId: true,
      status: true,
      moderationStatus: true,
      archivedAt: true,
      expiresAt: true,
    },
  });
  if (!listing || !listingIsPublic(listing)) throw new Error("listing.not_found");
  if (listing.profileId === current.profileId) {
    throw new Error("listing.cannot_save_own_listing");
  }

  const where = {
    profileId_listingId: {
      profileId: current.profileId,
      listingId: listing.id,
    },
  };
  const existing = await prisma.savedListing.findUnique({ where });
  if (existing) {
    await withDbRequestContext(current, (tx) => tx.savedListing.delete({ where }));
    return { saved: false };
  }

  await withDbRequestContext(current, (tx) => tx.savedListing.create({
    data: {
      profileId: current.profileId,
      listingId: listing.id,
    },
  }));
  return { saved: true };
}

export async function getSavedListingIdsForProfile(
  profileId: string,
  listingIds: string[]
) {
  if (listingIds.length === 0) return new Set<string>();
  const rows = await prisma.savedListing.findMany({
    where: { profileId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return new Set(rows.map((row) => row.listingId));
}

export async function getSavedListingsForCurrentUser(
  current: CurrentUserProfile
) {
  const now = new Date();
  return prisma.savedListing.findMany({
    where: {
      profileId: current.profileId,
      listing: {
        status: LISTING_STATUS_ACTIVE,
        moderationStatus: LISTING_MODERATION_APPROVED,
        archivedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
    },
    orderBy: { createdAt: "desc" },
    include: { listing: { include: listingInclude() } },
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

export function listingIsPublic(listing: {
  status: string;
  moderationStatus: string;
  archivedAt: Date | null;
  expiresAt: Date | null;
}) {
  return (
    listing.status === LISTING_STATUS_ACTIVE &&
    listing.moderationStatus === LISTING_MODERATION_APPROVED &&
    !listing.archivedAt &&
    !listingIsExpired(listing)
  );
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
    profile: {
      select: {
        id: true,
        displayName: true,
        kennelName: true,
        state: true,
        verified: true,
      },
    },
    category: true,
    location: true,
    attributes: { orderBy: { key: "asc" } },
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

async function assertCategoryExists(categoryId: string) {
  const category = await prisma.marketplaceCategory.findFirst({
    where: { id: categoryId, active: true },
    select: { id: true },
  });
  if (!category) throw new Error("listing.category_not_found");
}

async function defaultCategoryIdForType(type: string) {
  const slugByType: Record<string, string> = {
    pup_for_sale: "pups",
    dog_for_sale: "dogs",
    stud_service: "stud-services",
    wanted: "wanted",
    share: "shares",
  };
  const slug = slugByType[type];
  if (!slug) return null;
  const category = await prisma.marketplaceCategory.findUnique({
    where: { slug },
    select: { id: true },
  });
  return category?.id ?? null;
}

function normalizeCategorySlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!slug) throw new Error("listing.category_slug_required");
  return slug;
}

async function assertListingMediaAttachable(
  current: CurrentUserProfile,
  mediaIds: string[]
) {
  const media = await assertMediaAttachable(current, mediaIds, 11);
  assertListingMediaPolicy(media);

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

async function upsertListingLocation(
  tx: Prisma.TransactionClient,
  listingId: string,
  input: {
    state?: string | null;
    region?: string | null;
    suburb?: string | null;
    postcode?: string | null;
  }
) {
  if (!input.state && !input.region && !input.suburb && !input.postcode) {
    return;
  }

  await tx.listingLocation.upsert({
    where: { listingId },
    update: {
      state: input.state || null,
      region: input.region || null,
      suburb: input.suburb || null,
      postcode: input.postcode || null,
    },
    create: {
      listingId,
      state: input.state || null,
      region: input.region || null,
      suburb: input.suburb || null,
      postcode: input.postcode || null,
    },
  });
}

async function upsertListingSearchIndex(
  tx: Prisma.TransactionClient,
  listing: {
    id: string;
    type: string;
    title: string;
    description: string;
    state: string | null;
    condition?: string | null;
    greyhoundName?: string | null;
    itemBrand?: string | null;
    itemModel?: string | null;
    region?: string | null;
    suburb?: string | null;
    postcode?: string | null;
    attributes?: ListingAttributeInput[];
  }
) {
  await tx.listingSearchIndex.upsert({
    where: { listingId: listing.id },
    update: { searchText: listingSearchText(listing) },
    create: {
      listingId: listing.id,
      searchText: listingSearchText(listing),
    },
  });
}

function listingSearchText(listing: {
  type: string;
  title: string;
  description: string;
  state: string | null;
  condition?: string | null;
  greyhoundName?: string | null;
  itemBrand?: string | null;
  itemModel?: string | null;
  region?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  attributes?: ListingAttributeInput[];
}) {
  return [
    listing.title,
    listing.description,
    listing.type,
    listing.state,
    listing.condition,
    listing.greyhoundName,
    listing.itemBrand,
    listing.itemModel,
    listing.region,
    listing.suburb,
    listing.postcode,
    ...(listing.attributes ?? []).flatMap((attribute) => [
      attribute.key,
      attribute.value,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

async function replaceListingAttributes(
  tx: Prisma.TransactionClient,
  listingId: string,
  rawAttributes: ListingAttributeInput[] = []
) {
  const attributes = normaliseListingAttributes(rawAttributes);
  await tx.listingAttribute.deleteMany({ where: { listingId } });
  if (attributes.length === 0) return;

  await tx.listingAttribute.createMany({
    data: attributes.map((attribute) => ({
      listingId,
      key: attribute.key,
      value: attribute.value,
    })),
  });
}

function normaliseListingAttributes(attributes: ListingAttributeInput[]) {
  const seen = new Set<string>();
  const normalized: ListingAttributeInput[] = [];
  for (const attribute of attributes) {
    const key = normalizeAttributeText(attribute.key);
    const value = normalizeAttributeText(attribute.value);
    if (!key || !value) continue;
    const dedupeKey = key.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalized.push({ key, value });
  }
  return normalized.slice(0, 8);
}

function normalizeAttributeText(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

function assertModerator(current: CurrentUserProfile) {
  if (!isModeratorRole(current.profileRole)) throw new Error("auth.forbidden");
}

async function auditListingModeration(
  current: CurrentUserProfile,
  action: string,
  listingId: string,
  reason: string
) {
  await prisma.$transaction([
    prisma.adminAction.create({
      data: {
        adminId: current.dbUserId,
        action,
        targetType: "listing",
        targetId: listingId,
        reason,
      },
    }),
    prisma.listingModerationAction.create({
      data: {
        listingId,
        actorProfileId: current.profileId,
        action,
        reason,
      },
    }),
  ]);

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action,
    targetType: "listing",
    targetId: listingId,
    metadata: { reason },
  });
}
