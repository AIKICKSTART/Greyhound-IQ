import "server-only";
import { cache } from "react";
import {
  withDbRequestContext,
  withDbSystemContext,
  type DbContextUser,
} from "@/lib/db-context";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { assertPaidFeatureAccess, hasTier } from "@/lib/tier-access";
import { findBannedPhraseMatch } from "@/lib/moderation-service";
import { createAuditLog } from "@/lib/account-service";
import { getPlatformFlag, PLATFORM_FLAGS } from "@/lib/platform-settings";
import { mediaDeliveryUrl } from "@/lib/media-service";
import type {
  CustomPageCreateInput,
  CustomPageUpdateInput,
  CustomPageType,
} from "@/lib/custom-page-validation";

// Dog pages included with Pro up to this many; beyond it needs Pro+.
const PRO_DOG_PAGE_LIMIT = 3;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Globally-unique handle for /p/[handle]; append -2, -3… on collision.
async function uniqueHandle(seed: string): Promise<string> {
  const base = slugify(seed) || "page";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const existing = await withDbSystemContext((tx) =>
      tx.customPage.findUnique({ where: { handle: candidate }, select: { id: true } })
    );
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function assertClean(text: string) {
  return findBannedPhraseMatch(text, "listing").then((match) => {
    if (match && match.action === "block") {
      throw new Error("content.blocked_phrase");
    }
  });
}

export async function createCustomPage(
  current: CurrentUserProfile,
  input: CustomPageCreateInput
) {
  // Gates are admin-relaxable via PlatformSetting flags (default strict).
  if (await getPlatformFlag(PLATFORM_FLAGS.requirePro)) {
    assertPaidFeatureAccess(current);
  }
  await assertClean(`${input.title} ${input.tagline ?? ""} ${input.about ?? ""}`);

  // Non-dog types: one per user. Dog type: verify approved ownership, one per dog.
  if (input.pageType !== "dog") {
    const existing = await withDbRequestContext(current, (tx) =>
      tx.customPage.findFirst({
        where: { ownerProfileId: current.profileId, pageType: input.pageType, dogId: null },
        select: { id: true },
      })
    );
    if (existing) throw new Error("custom_page.type_exists");
  } else {
    if (await getPlatformFlag(PLATFORM_FLAGS.requireApprovedOwnership)) {
      const owns = await withDbRequestContext(current, (tx) =>
        tx.dogOwnership.findFirst({
          where: { dogId: input.dogId, profileId: current.profileId, status: "approved" },
          select: { id: true },
        })
      );
      if (!owns) throw new Error("custom_page.dog_not_owned");
    }
    if (await getPlatformFlag(PLATFORM_FLAGS.requireRegisteredDog)) {
      const registered = await withDbRequestContext(current, (tx) =>
        tx.dog.findFirst({
          where: { id: input.dogId, sourceId: { not: null } },
          select: { id: true },
        })
      );
      if (!registered) throw new Error("custom_page.dog_not_registered");
    }
    const dup = await withDbRequestContext(current, (tx) =>
      tx.customPage.findFirst({
        where: { ownerProfileId: current.profileId, pageType: "dog", dogId: input.dogId },
        select: { id: true },
      })
    );
    if (dup) throw new Error("custom_page.dog_page_exists");
    // Pro includes up to PRO_DOG_PAGE_LIMIT dog pages; beyond that needs Pro+.
    if (await getPlatformFlag(PLATFORM_FLAGS.enforceDogPageLimit)) {
      const dogPageCount = await withDbRequestContext(current, (tx) =>
        tx.customPage.count({
          // bespoke (team-built) pages don't consume the self-serve allotment.
          where: { ownerProfileId: current.profileId, pageType: "dog", bespoke: false },
        })
      );
      if (dogPageCount >= PRO_DOG_PAGE_LIMIT && !hasTier(current.tier, "pro_plus")) {
        throw new Error("custom_page.dog_limit_pro_plus");
      }
    }
  }

  const seed =
    input.pageType === "dog"
      ? `${input.title}`
      : `${current.displayName ?? input.title}-${input.pageType}`;
  const handle = await uniqueHandle(seed);

  const page = await withDbRequestContext(current, (tx) =>
    tx.customPage.create({
      data: {
        ownerProfileId: current.profileId,
        pageType: input.pageType,
        handle,
        title: input.title,
        tagline: input.tagline ?? null,
        about: input.about ?? null,
        businessCategory:
          input.pageType === "business" ? input.businessCategory ?? null : null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        website: input.website ?? null,
        accentColor: input.accentColor ?? null,
        heroMediaId: input.heroMediaId ?? null,
        dogId: input.pageType === "dog" ? input.dogId : null,
        saleStatus: input.pageType === "dog" ? input.saleStatus ?? null : null,
        priceOrFee: input.pageType === "dog" ? input.priceOrFee ?? null : null,
        contentJson: JSON.stringify({
          galleryMediaIds: input.galleryMediaIds ?? [],
          avatarMediaId: input.avatarMediaId ?? null,
          bannerMediaId: input.bannerMediaId ?? null,
          logoMediaId: input.logoMediaId ?? null,
        }),
        published: false,
      },
    })
  );

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "custom_page.create",
    targetType: "custom_page",
    targetId: page.id,
    metadata: { pageType: input.pageType, handle },
  });
  return page;
}

async function requireOwnedPage(current: CurrentUserProfile, pageId: string) {
  const page = await withDbRequestContext(current, (tx) =>
    tx.customPage.findFirst({
      where: { id: pageId, ownerProfileId: current.profileId },
    })
  );
  if (!page) throw new Error("custom_page.not_found");
  return page;
}

export async function updateCustomPage(
  current: CurrentUserProfile,
  pageId: string,
  input: CustomPageUpdateInput
) {
  assertPaidFeatureAccess(current);
  const page = await requireOwnedPage(current, pageId);
  await assertClean(`${input.title} ${input.tagline ?? ""} ${input.about ?? ""}`);

  const updated = await withDbRequestContext(current, (tx) =>
    tx.customPage.update({
      where: { id: page.id },
      data: {
        title: input.title,
        tagline: input.tagline ?? null,
        about: input.about ?? null,
        businessCategory:
          page.pageType === "business" ? input.businessCategory ?? null : page.businessCategory,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        website: input.website ?? null,
        accentColor: input.accentColor ?? null,
        heroMediaId: input.heroMediaId ?? null,
        saleStatus: page.pageType === "dog" ? input.saleStatus ?? null : page.saleStatus,
        priceOrFee: page.pageType === "dog" ? input.priceOrFee ?? null : page.priceOrFee,
        contentJson: JSON.stringify({
          galleryMediaIds: input.galleryMediaIds ?? [],
          avatarMediaId: input.avatarMediaId ?? null,
          bannerMediaId: input.bannerMediaId ?? null,
          logoMediaId: input.logoMediaId ?? null,
        }),
      },
    })
  );
  return updated;
}

export async function setCustomPagePublished(
  current: CurrentUserProfile,
  pageId: string,
  published: boolean
) {
  assertPaidFeatureAccess(current);
  const page = await requireOwnedPage(current, pageId);
  const updated = await withDbRequestContext(current, (tx) =>
    tx.customPage.update({ where: { id: page.id }, data: { published } })
  );
  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: published ? "custom_page.publish" : "custom_page.unpublish",
    targetType: "custom_page",
    targetId: page.id,
  });
  return updated;
}

export async function deleteCustomPage(current: CurrentUserProfile, pageId: string) {
  const page = await requireOwnedPage(current, pageId);
  await withDbRequestContext(current, (tx) =>
    tx.customPage.delete({ where: { id: page.id } })
  );
  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "custom_page.delete",
    targetType: "custom_page",
    targetId: page.id,
  });
}

// Dogs the user has admin-approved ownership of — candidates for a dog page.
export function listApprovedOwnedDogs(current: CurrentUserProfile) {
  return withDbRequestContext(current, async (tx) => {
    const owned = await tx.dogOwnership.findMany({
      where: { profileId: current.profileId, status: "approved" },
      select: { dog: { select: { id: true, name: true, sourceId: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return owned.map((o) => o.dog);
  });
}

export function getOwnedCustomPage(current: CurrentUserProfile, pageId: string) {
  return withDbRequestContext(current, (tx) =>
    tx.customPage.findFirst({
      where: { id: pageId, ownerProfileId: current.profileId },
      include: { dog: { select: { id: true, name: true } } },
    })
  );
}

export function listCustomPagesForCurrentUser(current: DbContextUser) {
  return withDbRequestContext(current, (tx) =>
    tx.customPage.findMany({
      where: { ownerProfileId: current.profileId },
      orderBy: [{ pageType: "asc" }, { createdAt: "desc" }],
    })
  );
}

// Public read by handle. System context (public data); returns null unless the
// page is published + not removed. Dog pages include the linked Dog.
export const getPublishedCustomPageByHandle = cache((handle: string) =>
  withDbSystemContext((tx) =>
    tx.customPage.findFirst({
      where: { handle, published: true, moderationStatus: { not: "removed" } },
      include: {
        ownerProfile: { select: { id: true, displayName: true, verified: true } },
        dog: {
          include: {
            trainer: true,
            sire: true,
            dam: true,
            formEntries: { orderBy: { date: "desc" }, take: 20, include: { track: true } },
          },
        },
      },
    })
  )
);

export type PublicCustomPage = NonNullable<
  Awaited<ReturnType<typeof getPublishedCustomPageByHandle>>
>;

// Published, non-removed pages for the sitemap (system context).
export function getPublishedCustomPagesForSitemap() {
  return withDbSystemContext((tx) =>
    tx.customPage.findMany({
      where: { published: true, moderationStatus: { not: "removed" } },
      select: { handle: true, updatedAt: true },
      take: 5000,
    })
  );
}

export const CUSTOM_PAGE_TYPE_LABELS: Record<CustomPageType, string> = {
  trainer: "Trainer",
  punter: "Punter",
  business: "Business",
  dog: "Dog",
};

export type CustomPageContent = {
  galleryMediaIds: string[];
  avatarMediaId: string | null;
  bannerMediaId: string | null;
  logoMediaId: string | null;
  cardMediaId: string | null;
};

export function parseCustomPageContent(contentJson: string | null): CustomPageContent {
  try {
    const raw = contentJson ? (JSON.parse(contentJson) as Partial<CustomPageContent>) : {};
    return {
      galleryMediaIds: Array.isArray(raw.galleryMediaIds) ? raw.galleryMediaIds : [],
      avatarMediaId: raw.avatarMediaId ?? null,
      bannerMediaId: raw.bannerMediaId ?? null,
      logoMediaId: raw.logoMediaId ?? null,
      cardMediaId: raw.cardMediaId ?? null,
    };
  } catch {
    return { galleryMediaIds: [], avatarMediaId: null, bannerMediaId: null, logoMediaId: null, cardMediaId: null };
  }
}

// Batch avatar resolution for feed cards: one MediaAsset query for any number
// of pages (per-post resolveCustomPageMedia would be N queries).
export async function resolvePageAvatarUrls(
  pages: { id: string; contentJson: string | null }[]
): Promise<Map<string, string | null>> {
  const avatarIdByPage = new Map(
    pages.map((page) => [
      page.id,
      parseCustomPageContent(page.contentJson).avatarMediaId,
    ])
  );
  const ids = [...new Set([...avatarIdByPage.values()].filter(Boolean))] as string[];
  const assets = ids.length
    ? await withDbSystemContext((tx) =>
        tx.mediaAsset.findMany({
          where: { id: { in: ids }, scanStatus: "clean" },
          select: { id: true, storageBucket: true, storagePath: true, publicUrl: true },
        })
      )
    : [];
  const urlById = new Map(assets.map((a) => [a.id, mediaDeliveryUrl(a)]));
  return new Map(
    pages.map((page) => {
      const avatarId = avatarIdByPage.get(page.id);
      return [page.id, avatarId ? urlById.get(avatarId) ?? null : null];
    })
  );
}

export type CustomPageMediaUrls = {
  avatarUrl: string | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  cardUrl: string | null;
  galleryUrls: string[];
};

// Resolve stored media ids to clean public URLs (system context read). Only
// scanStatus==='clean' assets surface; missing/pending/infected → dropped.
export async function resolveCustomPageMedia(
  contentJson: string | null
): Promise<CustomPageMediaUrls> {
  const content = parseCustomPageContent(contentJson);
  const ids = [
    content.avatarMediaId,
    content.bannerMediaId,
    content.logoMediaId,
    content.cardMediaId,
    ...content.galleryMediaIds,
  ].filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return { avatarUrl: null, bannerUrl: null, logoUrl: null, cardUrl: null, galleryUrls: [] };
  }
  const assets = await withDbSystemContext((tx) =>
    tx.mediaAsset.findMany({
      where: { id: { in: ids }, scanStatus: "clean" },
      select: { id: true, storageBucket: true, storagePath: true, publicUrl: true },
    })
  );
  const urlById = new Map(assets.map((a) => [a.id, mediaDeliveryUrl(a)]));
  return {
    avatarUrl: content.avatarMediaId ? urlById.get(content.avatarMediaId) ?? null : null,
    bannerUrl: content.bannerMediaId ? urlById.get(content.bannerMediaId) ?? null : null,
    logoUrl: content.logoMediaId ? urlById.get(content.logoMediaId) ?? null : null,
    cardUrl: content.cardMediaId ? urlById.get(content.cardMediaId) ?? null : null,
    galleryUrls: content.galleryMediaIds
      .map((id) => urlById.get(id))
      .filter((u): u is string => Boolean(u)),
  };
}
