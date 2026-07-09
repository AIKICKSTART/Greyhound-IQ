import "server-only";
import { cache } from "react";
import { withDbRequestContext, withDbSystemContext } from "@/lib/db-context";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { assertPaidFeatureAccess, hasTier } from "@/lib/tier-access";
import { findBannedPhraseMatch } from "@/lib/moderation-service";
import { createAuditLog } from "@/lib/account-service";
import { getPlatformFlag, PLATFORM_FLAGS } from "@/lib/platform-settings";
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
          where: { ownerProfileId: current.profileId, pageType: "dog" },
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
        contentJson: JSON.stringify({ galleryMediaIds: input.galleryMediaIds ?? [] }),
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
        contentJson: JSON.stringify({ galleryMediaIds: input.galleryMediaIds ?? [] }),
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

export function listCustomPagesForCurrentUser(current: CurrentUserProfile) {
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

export const CUSTOM_PAGE_TYPE_LABELS: Record<CustomPageType, string> = {
  trainer: "Trainer",
  punter: "Punter",
  business: "Business",
  dog: "Dog",
};
