import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { CurrentUserProfile } from "@/lib/auth-types";
import {
  type DbContextClient,
  type DbContextUser,
  withDbAnonymousContext,
  withDbRequestContext,
} from "@/lib/db-context";
import type { PersonalActorMediaUpdateInput } from "@/lib/account-validation";
import {
  assertMediaAttachable,
  mediaDeliveryUrl,
} from "@/lib/media-service";
import { createInAppNotification } from "@/lib/notification-service";
import {
  canViewAudience,
  defaultActorVisibility,
  isSocialAudience,
} from "@/lib/social-privacy";

export type SocialActorSummary = {
  id: string;
  kind: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  avatarFocalX: number;
  avatarFocalY: number;
  coverUrl: string | null;
  coverFocalX: number;
  coverFocalY: number;
  profileVisibility: string;
  contactVisibility: string;
  published: boolean;
  profileId: string | null;
  pageId: string | null;
  ownerProfileId: string;
};

const actorSelect = {
  id: true,
  kind: true,
  handle: true,
  displayName: true,
  avatarUrl: true,
  avatarFocalX: true,
  avatarFocalY: true,
  coverUrl: true,
  coverFocalX: true,
  coverFocalY: true,
  profileVisibility: true,
  contactVisibility: true,
  published: true,
  profileId: true,
  pageId: true,
  ownerProfileId: true,
} satisfies Prisma.SocialActorSelect;

const actorProfileSelect = {
  ...actorSelect,
  profile: {
    select: {
      id: true,
      bio: true,
      avatarUrl: true,
      state: true,
      kennelName: true,
      role: true,
      verified: true,
      website: true,
      phone: true,
      createdAt: true,
      user: {
        select: {
          isBanned: true,
          deletionRequestedAt: true,
        },
      },
    },
  },
  page: {
    select: {
      id: true,
      pageType: true,
      tagline: true,
      about: true,
      businessCategory: true,
      contactEmail: true,
      contactPhone: true,
      website: true,
      accentColor: true,
      published: true,
      moderationStatus: true,
    },
  },
} satisfies Prisma.SocialActorSelect;

export type SocialActorProfileView = {
  actor: SocialActorSummary;
  profile: {
    id: string;
    bio: string | null;
    avatarUrl: string | null;
    state: string | null;
    kennelName: string | null;
    role: string;
    verified: boolean;
    createdAt: Date;
  } | null;
  page: {
    id: string;
    pageType: string;
    tagline: string | null;
    about: string | null;
    businessCategory: string | null;
    accentColor: string | null;
  } | null;
  contact: {
    email: string | null;
    phone: string | null;
    website: string | null;
  } | null;
  timeline: Array<{
    id: string;
    sourcePostId: string;
    body: string;
    visibility: string;
    createdAt: Date;
    editedAt: Date | null;
    commentCount: number;
    reactionCount: number;
    mediaCount: number;
    sharedFrom: { handle: string; displayName: string } | null;
  }>;
  gallery: Array<{
    mediaId: string;
    url: string;
    altText: string | null;
    position: number;
  }>;
  friends: Array<{
    profileId: string;
    handle: string | null;
    displayName: string;
    avatarUrl: string | null;
    verified: boolean;
  }>;
  friendCount: number | null;
  followerCount: number;
  viewer: {
    isOwner: boolean;
    isConnected: boolean;
    isFollowing: boolean;
    canViewContact: boolean;
  };
};

export async function getSocialActorProfileByHandle(
  handle: string,
  viewer: DbContextUser | null,
): Promise<SocialActorProfileView | null> {
  const normalizedHandle = handle.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(normalizedHandle)) return null;

  return withActorReadContext(viewer, async (tx) => {
    const actor = await tx.socialActor.findFirst({
      where: { handle: normalizedHandle, published: true },
      select: actorProfileSelect,
    });
    if (!actor || (actor.kind !== "personal" && actor.kind !== "page")) {
      return null;
    }
    if (
      actor.kind === "personal" &&
      (!actor.profile ||
        actor.profile.user.isBanned ||
        actor.profile.user.deletionRequestedAt)
    ) {
      return null;
    }
    if (
      actor.kind === "page" &&
      (!actor.page ||
        !actor.page.published ||
        actor.page.moderationStatus === "removed")
    ) {
      return null;
    }

    const isOwner = viewer?.profileId === actor.ownerProfileId;
    if (viewer && !isOwner) {
      const [blockState] = await tx.$queryRaw<{ blocked: boolean }[]>`
        SELECT public.giq_profiles_blocked(
          ${viewer.profileId},
          ${actor.ownerProfileId}
        ) AS blocked
      `;
      if (blockState?.blocked) return null;
    }
    const viewerActor = viewer
      ? await tx.socialActor.findUnique({
          where: { profileId: viewer.profileId },
          select: { id: true },
        })
      : null;
    const follow =
      viewerActor && viewerActor.id !== actor.id
        ? await tx.actorFollow.findUnique({
            where: {
              followerActorId_followedActorId: {
                followerActorId: viewerActor.id,
                followedActorId: actor.id,
              },
            },
            select: { createdAt: true },
          })
        : null;
    const isFollowing = Boolean(follow);
    const personalConnection =
      viewer && actor.kind === "personal" && actor.profileId && !isOwner
        ? await tx.friendship.findFirst({
            where: {
              status: "accepted",
              OR: [
                {
                  profileAId: viewer.profileId,
                  profileBId: actor.profileId,
                },
                {
                  profileAId: actor.profileId,
                  profileBId: viewer.profileId,
                },
              ],
            },
            select: { id: true },
          })
        : null;
    const isConnected =
      isOwner ||
      (actor.kind === "page" ? isFollowing : Boolean(personalConnection));
    const contactAudience = isSocialAudience(actor.contactVisibility)
      ? actor.contactVisibility
      : "only_me";
    const canViewContact = canViewAudience(contactAudience, {
      authenticated: Boolean(viewer),
      owner: isOwner,
      connected: isConnected,
    });

    const timelineRows = await tx.feedPost.findMany({
      where: {
        authorActorId: actor.id,
        status: "active",
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        body: true,
        visibility: true,
        createdAt: true,
        editedAt: true,
        _count: {
          select: {
            comments: true,
            reactions: true,
            media: true,
          },
        },
      },
    });
    const shareRows = await tx.feedShare.findMany({
      where: {
        actorId: actor.id,
        sourcePost: { status: "active", deletedAt: null },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        body: true,
        createdAt: true,
        sourcePost: {
          select: {
            id: true,
            body: true,
            visibility: true,
            editedAt: true,
            authorActor: {
              select: { handle: true, displayName: true },
            },
            author: { select: { displayName: true } },
            _count: {
              select: { comments: true, reactions: true, media: true },
            },
          },
        },
      },
    });

    const galleryRows = isOwner
      ? await tx.actorGalleryMedia.findMany({
          where: {
            actorId: actor.id,
            media: {
              deletedAt: null,
              scanStatus: "clean",
              processingStatus: "ready",
            },
          },
          orderBy: { position: "asc" },
          take: 24,
          select: {
            mediaId: true,
            position: true,
            altText: true,
            media: {
              select: {
                id: true,
                storageBucket: true,
                storagePath: true,
                publicUrl: true,
              },
            },
          },
        })
      : [];

    let friendCount: number | null = null;
    let friends: SocialActorProfileView["friends"] = [];
    if (actor.kind === "personal" && actor.profileId && isOwner) {
      const friendshipWhere = {
        status: "accepted",
        OR: [{ profileAId: actor.profileId }, { profileBId: actor.profileId }],
      } satisfies Prisma.FriendshipWhereInput;
      friendCount = await tx.friendship.count({ where: friendshipWhere });
      const friendshipRows = await tx.friendship.findMany({
        where: friendshipWhere,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 12,
        select: {
          profileAId: true,
          profileA: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              verified: true,
              socialActor: {
                select: { handle: true, published: true },
              },
            },
          },
          profileBId: true,
          profileB: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              verified: true,
              socialActor: {
                select: { handle: true, published: true },
              },
            },
          },
        },
      });
      friends = friendshipRows.map((friendship) => {
        const other =
          friendship.profileAId === actor.profileId
            ? friendship.profileB
            : friendship.profileA;
        return {
          profileId: other.id,
          handle: other.socialActor?.published
            ? other.socialActor.handle
            : null,
          displayName: other.displayName,
          avatarUrl: other.avatarUrl,
          verified: other.verified,
        };
      });
    }

    const followerCount = await tx.actorFollow.count({
      where: { followedActorId: actor.id },
    });
    const contact = canViewContact
      ? actor.kind === "page" && actor.page
        ? {
            email: actor.page.contactEmail,
            phone: actor.page.contactPhone,
            website: actor.page.website,
          }
        : actor.profile
          ? {
              email: null,
              phone: actor.profile.phone,
              website: actor.profile.website,
            }
          : null
      : null;

    return {
      actor: pickActorSummary(actor),
      profile: actor.profile
        ? {
            id: actor.profile.id,
            bio: actor.profile.bio,
            avatarUrl: actor.profile.avatarUrl,
            state: actor.profile.state,
            kennelName: actor.profile.kennelName,
            role: actor.profile.role,
            verified: actor.profile.verified,
            createdAt: actor.profile.createdAt,
          }
        : null,
      page: actor.page
        ? {
            id: actor.page.id,
            pageType: actor.page.pageType,
            tagline: actor.page.tagline,
            about: actor.page.about,
            businessCategory: actor.page.businessCategory,
            accentColor: actor.page.accentColor,
          }
        : null,
      contact,
      timeline: [
        ...timelineRows.map((post) => ({
          id: post.id,
          sourcePostId: post.id,
          body: post.body,
          visibility: post.visibility,
          createdAt: post.createdAt,
          editedAt: post.editedAt,
          commentCount: post._count.comments,
          reactionCount: post._count.reactions,
          mediaCount: post._count.media,
          sharedFrom: null,
        })),
        ...shareRows.map((share) => ({
          id: `share-${share.id}`,
          sourcePostId: share.sourcePost.id,
          body: share.body || share.sourcePost.body,
          visibility: share.sourcePost.visibility,
          createdAt: share.createdAt,
          editedAt: share.sourcePost.editedAt,
          commentCount: share.sourcePost._count.comments,
          reactionCount: share.sourcePost._count.reactions,
          mediaCount: share.sourcePost._count.media,
          sharedFrom: {
            handle: share.sourcePost.authorActor?.handle ?? "",
            displayName:
              share.sourcePost.authorActor?.displayName ??
              share.sourcePost.author.displayName,
          },
        })),
      ]
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, 20),
      gallery: galleryRows.map((item) => ({
        mediaId: item.mediaId,
        url: mediaDeliveryUrl(item.media),
        altText: item.altText,
        position: item.position,
      })),
      friends,
      friendCount,
      followerCount,
      viewer: {
        isOwner,
        isConnected,
        isFollowing,
        canViewContact,
      },
    };
  });
}

export async function toggleActorFollow(
  current: CurrentUserProfile,
  followedActorId: string,
) {
  const result = await withDbRequestContext(current, async (tx) => {
    const follower = await ensurePersonalActor(current, tx);
    const followed = await tx.socialActor.findFirst({
      where: {
        id: followedActorId,
        kind: "page",
        published: true,
      },
      select: {
        id: true,
        handle: true,
        ownerProfileId: true,
        displayName: true,
        ownerProfile: { select: { userId: true } },
      },
    });
    if (!followed) throw new Error("actor.not_found");
    if (followed.ownerProfileId === current.profileId) {
      throw new Error("actor.cannot_follow_owned");
    }
    const blocked = await tx.userBlock.findFirst({
      where: {
        OR: [
          {
            blockerProfileId: current.profileId,
            blockedProfileId: followed.ownerProfileId,
          },
          {
            blockerProfileId: followed.ownerProfileId,
            blockedProfileId: current.profileId,
          },
        ],
      },
      select: { id: true },
    });
    if (blocked) throw new Error("actor.follow_blocked");

    const key = {
      followerActorId: follower.id,
      followedActorId: followed.id,
    };
    const existing = await tx.actorFollow.findUnique({
      where: { followerActorId_followedActorId: key },
      select: { createdAt: true },
    });
    if (existing) {
      await tx.actorFollow.delete({
        where: { followerActorId_followedActorId: key },
      });
    } else {
      await tx.actorFollow.create({ data: key });
    }
    return {
      followed: !existing,
      handle: followed.handle,
      followedDisplayName: followed.displayName,
      followedOwnerUserId: followed.ownerProfile.userId,
      followerActorId: follower.id,
    };
  });
  if (result.followed) {
    await createInAppNotification({
      userId: result.followedOwnerUserId,
      actorProfileId: current.profileId,
      actorId: result.followerActorId,
      type: "actor_follow",
      title: `${current.displayName} followed ${result.followedDisplayName}`,
      href: `/p/${result.handle}`,
      targetType: "social_actor",
      targetId: followedActorId,
    });
  }
  return { followed: result.followed, handle: result.handle };
}

function withActorReadContext<T>(
  viewer: DbContextUser | null,
  fn: (tx: DbContextClient) => Promise<T>,
) {
  return viewer ? withDbRequestContext(viewer, fn) : withDbAnonymousContext(fn);
}

function pickActorSummary(actor: {
  id: string;
  kind: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  avatarFocalX: number;
  avatarFocalY: number;
  coverUrl: string | null;
  coverFocalX: number;
  coverFocalY: number;
  profileVisibility: string;
  contactVisibility: string;
  published: boolean;
  profileId: string | null;
  pageId: string | null;
  ownerProfileId: string;
}): SocialActorSummary {
  return {
    id: actor.id,
    kind: actor.kind,
    handle: actor.handle,
    displayName: actor.displayName,
    avatarUrl: actor.avatarUrl,
    avatarFocalX: actor.avatarFocalX,
    avatarFocalY: actor.avatarFocalY,
    coverUrl: actor.coverUrl,
    coverFocalX: actor.coverFocalX,
    coverFocalY: actor.coverFocalY,
    profileVisibility: actor.profileVisibility,
    contactVisibility: actor.contactVisibility,
    published: actor.published,
    profileId: actor.profileId,
    pageId: actor.pageId,
    ownerProfileId: actor.ownerProfileId,
  };
}

export async function ensurePersonalActor(
  current: CurrentUserProfile,
  tx?: DbContextClient,
): Promise<SocialActorSummary> {
  if (tx) return ensurePersonalActorWithClient(tx, current.profileId);
  return withDbRequestContext(current, (client) =>
    ensurePersonalActorWithClient(client, current.profileId),
  );
}

const PERSONAL_AVATAR_MEDIA = "social_actor_avatar";
const PERSONAL_COVER_MEDIA = "social_actor_cover";

export type PersonalActorMedia = {
  avatarMediaId: string | null;
  coverMediaId: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  avatarFocalX: number;
  avatarFocalY: number;
  coverFocalX: number;
  coverFocalY: number;
};

export async function getPersonalActorMedia(
  current: CurrentUserProfile,
): Promise<PersonalActorMedia> {
  return withDbRequestContext(current, async (tx) => {
    const actor = await ensurePersonalActor(current, tx);
    const [media, gallerySlots] = await Promise.all([
      tx.mediaAsset.findMany({
        where: {
          uploaderId: current.dbUserId,
          linkedEntityId: actor.id,
          linkedEntityType: {
            in: [PERSONAL_AVATAR_MEDIA, PERSONAL_COVER_MEDIA],
          },
          deletedAt: null,
        },
        select: { id: true, linkedEntityType: true },
      }),
      tx.actorGalleryMedia.findMany({
        where: {
          actorId: actor.id,
          position: { in: [-2, -1] },
          media: { uploaderId: current.dbUserId, deletedAt: null },
        },
        select: { mediaId: true, position: true },
      }),
    ]);
    return {
      avatarMediaId:
        media.find((item) => item.linkedEntityType === PERSONAL_AVATAR_MEDIA)
          ?.id ??
        gallerySlots.find((item) => item.position === -2)?.mediaId ??
        null,
      coverMediaId:
        media.find((item) => item.linkedEntityType === PERSONAL_COVER_MEDIA)
          ?.id ??
        gallerySlots.find((item) => item.position === -1)?.mediaId ??
        null,
      avatarUrl: actor.avatarUrl,
      coverUrl: actor.coverUrl,
      avatarFocalX: actor.avatarFocalX,
      avatarFocalY: actor.avatarFocalY,
      coverFocalX: actor.coverFocalX,
      coverFocalY: actor.coverFocalY,
    };
  });
}

export async function updatePersonalActorMedia(
  current: CurrentUserProfile,
  input: PersonalActorMediaUpdateInput,
) {
  const requestedIds = [input.avatarMediaId, input.coverMediaId].filter(
    (id): id is string => Boolean(id),
  );
  const media = await assertMediaAttachable(current, requestedIds, 2, {
    allowPending: true,
  });
  if (media.some((item) => !item.mimeType.startsWith("image/"))) {
    throw new Error("media.image_required");
  }
  const byId = new Map(media.map((item) => [item.id, item]));
  const avatar = input.avatarMediaId
    ? byId.get(input.avatarMediaId) ?? null
    : null;
  const cover = input.coverMediaId
    ? byId.get(input.coverMediaId) ?? null
    : null;

  return withDbRequestContext(current, async (tx) => {
    const actor = await ensurePersonalActor(current, tx);
    const previous = await tx.mediaAsset.findMany({
      where: {
        uploaderId: current.dbUserId,
        linkedEntityId: actor.id,
        linkedEntityType: {
          in: [PERSONAL_AVATAR_MEDIA, PERSONAL_COVER_MEDIA],
        },
      },
      select: { id: true },
    });
    const touchedIds = [
      ...new Set([...previous.map((item) => item.id), ...requestedIds]),
    ];

    await tx.actorGalleryMedia.deleteMany({
      where: {
        actorId: actor.id,
        OR: [
          { position: { in: [-2, -1] } },
          ...(touchedIds.length > 0 ? [{ mediaId: { in: touchedIds } }] : []),
        ],
      },
    });
    if (previous.length > 0) {
      await tx.mediaAsset.updateMany({
        where: { id: { in: previous.map((item) => item.id) } },
        data: { linkedEntityType: null, linkedEntityId: null },
      });
    }
    if (avatar) {
      await tx.mediaAsset.update({
        where: { id: avatar.id },
        data: {
          linkedEntityType: PERSONAL_AVATAR_MEDIA,
          linkedEntityId: actor.id,
        },
      });
    }
    if (cover) {
      await tx.mediaAsset.update({
        where: { id: cover.id },
        data: {
          linkedEntityType: PERSONAL_COVER_MEDIA,
          linkedEntityId: actor.id,
        },
      });
    }
    const attachments = [
      ...(avatar
        ? [
            {
              actorId: actor.id,
              mediaId: avatar.id,
              position: -2,
              altText: avatar.altText ?? "Profile picture",
            },
          ]
        : []),
      ...(cover
        ? [
            {
              actorId: actor.id,
              mediaId: cover.id,
              position: -1,
              altText: cover.altText ?? "Profile cover",
            },
          ]
        : []),
    ];
    if (attachments.length > 0) {
      await tx.actorGalleryMedia.createMany({ data: attachments });
    }

    const avatarUrl = avatar
      ? mediaDeliveryUrl(avatar)
      : input.removeAvatar
        ? null
        : actor.avatarUrl;
    const coverUrl = cover
      ? mediaDeliveryUrl(cover)
      : input.removeCover
        ? null
        : actor.coverUrl;
    await tx.profile.update({
      where: { id: current.profileId },
      data: { avatarUrl },
    });
    return tx.socialActor.update({
      where: { id: actor.id },
      data: {
        avatarUrl,
        coverUrl,
        ...(input.avatarFocalX === undefined
          ? {}
          : { avatarFocalX: input.avatarFocalX }),
        ...(input.avatarFocalY === undefined
          ? {}
          : { avatarFocalY: input.avatarFocalY }),
        coverFocalX: input.coverFocalX,
        coverFocalY: input.coverFocalY,
      },
      select: actorSelect,
    });
  });
}

export async function ensureOwnedPageActor(
  current: CurrentUserProfile,
  pageId: string,
  tx?: DbContextClient,
): Promise<SocialActorSummary> {
  const run = async (client: DbContextClient) => {
    const page = await client.customPage.findFirst({
      where: { id: pageId, ownerProfileId: current.profileId },
      select: {
        id: true,
        handle: true,
        title: true,
        published: true,
        ownerProfileId: true,
        createdAt: true,
      },
    });
    if (!page) throw new Error("actor.page_not_owned");
    return client.socialActor.upsert({
      where: { pageId: page.id },
      create: {
        kind: "page",
        pageId: page.id,
        ownerProfileId: page.ownerProfileId,
        handle: page.handle,
        displayName: page.title,
        profileVisibility: defaultActorVisibility("page"),
        contactVisibility: "only_me",
        published: page.published,
      },
      update: {
        handle: page.handle,
        displayName: page.title,
        published: page.published,
      },
      select: actorSelect,
    });
  };
  return tx ? run(tx) : withDbRequestContext(current, run);
}

export async function requireOwnedActor(
  current: CurrentUserProfile,
  actorId?: string | null,
  tx?: DbContextClient,
): Promise<SocialActorSummary> {
  const run = async (client: DbContextClient) => {
    if (!actorId) return ensurePersonalActor(current, client);
    const actor = await client.socialActor.findFirst({
      where: { id: actorId, ownerProfileId: current.profileId },
      select: actorSelect,
    });
    if (!actor) throw new Error("actor.not_owned");
    return actor;
  };
  return tx ? run(tx) : withDbRequestContext(current, run);
}

async function ensurePersonalActorWithClient(
  tx: DbContextClient,
  profileId: string,
): Promise<SocialActorSummary> {
  const profile = await tx.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
    },
  });
  if (!profile) throw new Error("profile.not_found");
  return tx.socialActor.upsert({
    where: { profileId },
    create: {
      kind: "personal",
      profileId,
      ownerProfileId: profileId,
      handle: personalActorHandle(profileId),
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      profileVisibility: defaultActorVisibility("personal"),
      contactVisibility: "only_me",
      published: true,
    },
    update: {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      published: true,
    },
    select: actorSelect,
  });
}

export function personalActorHandle(profileId: string) {
  return `member-${createHash("md5").update(profileId).digest("hex")}`;
}
