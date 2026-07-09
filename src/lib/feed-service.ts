import type { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/account-service";
import { isModeratorRole } from "@/lib/auth-roles";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { assertProfilesCanInteract } from "@/lib/conversation-service";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext, withDbSystemContext } from "@/lib/db-context";
import { assertPaidFeatureAccess } from "@/lib/tier-access";
import { assertMediaAttachable, mediaDeliveryUrl } from "@/lib/media-service";
import {
  createInAppNotification,
  notificationBodySnippet,
} from "@/lib/notification-service";
import { findBannedPhraseMatch } from "@/lib/moderation-service";
import { broadcastFeedRealtimeEvent } from "@/lib/realtime-service";
import { PUBLIC_USER_MEDIA_BUCKET } from "@/lib/storage-paths";

const FEED_POST_MEDIA_LIMIT = 4;

type Tx = Prisma.TransactionClient;

export async function getFeedTopics() {
  return safeQuery(
    () =>
      withDbSystemContext((tx) =>
        tx.feedTopic.findMany({
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      ),
    []
  );
}

export async function getFeedAdminTopics() {
  return safeQuery(
    () =>
      withDbSystemContext((tx) =>
        tx.feedTopic.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            _count: {
              select: { posts: true },
            },
          },
        })
      ),
    []
  );
}

export async function getFeedAdminPosts(limit = 50) {
  return safeQuery(
    () =>
      withDbSystemContext((tx) =>
        tx.feedPost.findMany({
          orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
          take: limit,
          include: {
            author: true,
            topic: true,
            _count: {
              select: {
                comments: true,
                reactions: true,
              },
            },
          },
        })
      ),
    []
  );
}

export async function getFeedPosts(limit = 30) {
  return getFeedPostsForViewer(limit);
}

export async function getFeedPostsForViewer(
  limit = 30,
  viewerProfileId?: string | null
) {
  const blockFilter: Prisma.FeedPostWhereInput | undefined = viewerProfileId
    ? {
        author: {
          userBlocksReceived: { none: { blockerProfileId: viewerProfileId } },
          userBlocksInitiated: { none: { blockedProfileId: viewerProfileId } },
        },
      }
    : undefined;

  return safeQuery(
    () =>
      withDbSystemContext((tx) =>
        tx.feedPost.findMany({
          where: {
            status: "active",
            visibility: "public",
            ...(blockFilter ?? {}),
          },
          orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
          take: limit,
          include: feedPostInclude(viewerProfileId),
        })
      ),
    []
  );
}

export async function createFeedPostForCurrentUser(
  current: CurrentUserProfile,
  input: {
    topicId?: string | null;
    body: string;
    mediaIds?: string[];
    pageId?: string | null;
  }
) {
  assertPaidFeatureAccess(current);
  const topicId = input.topicId || null;
  if (topicId) await assertActiveTopic(topicId);
  const pageId = input.pageId || null;
  const mediaIds = input.mediaIds ?? [];
  await assertFeedMediaAttachable(current, mediaIds);
  const phraseMatch = await findBannedPhraseMatch(input.body, "feed");
  if (phraseMatch?.action === "block") throw new Error("feed.blocked_phrase");
  const status = phraseMatch ? "hidden" : "active";

  const post = await withDbRequestContext(current, async (tx) => {
    if (pageId) {
      // Server-side ownership check: never trust a client-supplied page id.
      const owned = await tx.customPage.findFirst({
        where: {
          id: pageId,
          ownerProfileId: current.profileId,
          moderationStatus: { not: "removed" },
        },
        select: { id: true },
      });
      if (!owned) throw new Error("feed.page_not_owned");
    }
    const created = await tx.feedPost.create({
      data: {
        authorProfileId: current.profileId,
        authorPageId: pageId,
        topicId,
        body: input.body,
        status,
        visibility: "public",
      },
    });
    await attachMediaToFeedPost(tx, created.id, mediaIds);
    return created;
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "feed.post.create",
    targetType: "feed_post",
    targetId: post.id,
    metadata: {
      mediaCount: mediaIds.length,
      topicId,
      pageId,
      phraseFlag: phraseMatch?.id,
    },
  });
  if (status === "active") {
    await broadcastFeedRealtimeEvent("post_created", {
      postId: post.id,
      topicId,
    });
  }

  return post;
}

function assertModerator(current: CurrentUserProfile) {
  if (!isModeratorRole(current.profileRole)) throw new Error("auth.forbidden");
}

export async function createFeedTopicForModerator(
  current: CurrentUserProfile,
  input: {
    name: string;
    slug?: string | null;
    rules?: string | null;
    sortOrder: number;
  }
) {
  assertModerator(current);
  const slug = normalizeTopicSlug(input.slug ?? input.name);
  const topic = await withDbRequestContext(current, (tx) => tx.feedTopic.create({
    data: {
      name: input.name,
      slug,
      rules: input.rules ?? null,
      sortOrder: input.sortOrder,
      active: true,
    },
  }));

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: "feed.topic.create",
    targetType: "feed_topic",
    targetId: topic.id,
    metadata: { slug },
  });
  await broadcastFeedRealtimeEvent("topic_updated", { topicId: topic.id });

  return topic;
}

export async function setFeedTopicActiveForModerator(
  current: CurrentUserProfile,
  topicId: string,
  active: boolean
) {
  assertModerator(current);
  const topic = await withDbRequestContext(current, (tx) => tx.feedTopic.update({
    where: { id: topicId },
    data: { active },
  }));

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: active ? "feed.topic.activate" : "feed.topic.deactivate",
    targetType: "feed_topic",
    targetId: topic.id,
    metadata: { slug: topic.slug },
  });
  await broadcastFeedRealtimeEvent("topic_updated", { topicId: topic.id });

  return topic;
}

export async function moderateFeedPostForModerator(
  current: CurrentUserProfile,
  postId: string,
  input: {
    action: "pin" | "unpin" | "hide" | "remove" | "restore";
    reason?: string | null;
  }
) {
  assertModerator(current);
  const data: Prisma.FeedPostUpdateInput =
    input.action === "pin"
      ? { pinnedAt: new Date() }
      : input.action === "unpin"
        ? { pinnedAt: null }
        : input.action === "restore"
          ? { status: "active" }
          : { status: input.action === "hide" ? "hidden" : "removed" };

  const post = await withDbRequestContext(current, (tx) => tx.feedPost.update({
    where: { id: postId },
    data,
  }));

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: `feed.post.${input.action}`,
    targetType: "feed_post",
    targetId: post.id,
    metadata: { reason: input.reason ?? null },
  });
  await broadcastFeedRealtimeEvent("post_updated", {
    postId: post.id,
    action: input.action,
  });

  return post;
}

export async function createFeedCommentForCurrentUser(
  current: CurrentUserProfile,
  postId: string,
  input: { body: string; parentCommentId?: string | null }
) {
  assertPaidFeatureAccess(current);
  const post = await withDbRequestContext(current, (tx) => tx.feedPost.findFirst({
    where: { id: postId, status: "active", visibility: "public" },
    select: {
      id: true,
      authorProfileId: true,
      author: { select: { userId: true } },
    },
  }));
  if (!post) throw new Error("feed.post_not_found");
  await assertProfilesCanInteract(
    current.profileId,
    post.authorProfileId,
    "feed.blocked"
  );

  const parentCommentId = input.parentCommentId || null;
  if (parentCommentId) {
    const parent = await withDbRequestContext(current, (tx) => tx.feedComment.findFirst({
      where: { id: parentCommentId, postId, status: "active" },
      select: { id: true },
    }));
    if (!parent) throw new Error("feed.comment_not_found");
  }
  const phraseMatch = await findBannedPhraseMatch(input.body, "feed");
  if (phraseMatch?.action === "block") throw new Error("feed.blocked_phrase");
  const status = phraseMatch ? "hidden" : "active";

  const comment = await withDbRequestContext(current, (tx) => tx.feedComment.create({
    data: {
      postId,
      authorProfileId: current.profileId,
      parentCommentId,
      body: input.body,
      status,
    },
  }));

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "feed.comment.create",
    targetType: "feed_post",
    targetId: postId,
    metadata: { commentId: comment.id, parentCommentId, phraseFlag: phraseMatch?.id },
  });
  if (status === "active") {
    await broadcastFeedRealtimeEvent("comment_created", {
      postId,
      commentId: comment.id,
    });
  }
  if (status === "active" && post.authorProfileId !== current.profileId) {
    await createInAppNotification({
      userId: post.author.userId,
      actorProfileId: current.profileId,
      type: "feed_comment",
      title: `${current.displayName} commented on your feed post`,
      body: notificationBodySnippet(input.body),
      href: "/feed",
      targetType: "feed_post",
      targetId: postId,
      metadata: { commentId: comment.id },
    });
  }

  return comment;
}

export async function toggleFeedPostReactionForCurrentUser(
  current: CurrentUserProfile,
  postId: string
) {
  assertPaidFeatureAccess(current);
  const post = await withDbRequestContext(current, (tx) => tx.feedPost.findFirst({
    where: { id: postId, status: "active", visibility: "public" },
    select: {
      id: true,
      authorProfileId: true,
      author: { select: { userId: true } },
    },
  }));
  if (!post) throw new Error("feed.post_not_found");
  await assertProfilesCanInteract(
    current.profileId,
    post.authorProfileId,
    "feed.blocked"
  );

  const existing = await withDbRequestContext(current, (tx) => tx.feedReaction.findFirst({
    where: { postId, profileId: current.profileId, reactionType: "like" },
    select: { id: true },
  }));

  if (existing) {
    await withDbRequestContext(current, (tx) =>
      tx.feedReaction.delete({ where: { id: existing.id } })
    );
    await broadcastFeedRealtimeEvent("reaction_updated", { postId });
    return { liked: false };
  }

  await withDbRequestContext(current, (tx) => tx.feedReaction.create({
    data: {
      postId,
      profileId: current.profileId,
      reactionType: "like",
    },
  }));
  await broadcastFeedRealtimeEvent("reaction_updated", { postId });
  if (post.authorProfileId !== current.profileId) {
    await createInAppNotification({
      userId: post.author.userId,
      actorProfileId: current.profileId,
      type: "feed_reaction",
      title: `${current.displayName} liked your feed post`,
      href: "/feed",
      targetType: "feed_post",
      targetId: postId,
    });
  }
  return { liked: true };
}

export async function blockFeedPostAuthorForCurrentUser(
  current: CurrentUserProfile,
  postId: string
) {
  const post = await withDbRequestContext(current, (tx) => tx.feedPost.findFirst({
    where: { id: postId, status: "active", visibility: "public" },
    select: { id: true, authorProfileId: true },
  }));
  if (!post) throw new Error("feed.post_not_found");
  if (post.authorProfileId === current.profileId) {
    throw new Error("feed.cannot_block_self");
  }

  const block = await withDbRequestContext(current, (tx) => tx.userBlock.upsert({
    where: {
      blockerProfileId_blockedProfileId: {
        blockerProfileId: current.profileId,
        blockedProfileId: post.authorProfileId,
      },
    },
    update: { reason: "feed_author_block" },
    create: {
      blockerProfileId: current.profileId,
      blockedProfileId: post.authorProfileId,
      reason: "feed_author_block",
    },
  }));

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "feed.author.block",
    targetType: "profile",
    targetId: post.authorProfileId,
    metadata: { postId: post.id },
  });

  return block;
}

export function feedPostMediaUrl(media: {
  id: string;
  storageBucket: string;
  storagePath: string;
  publicUrl?: string | null;
}) {
  return mediaDeliveryUrl(media);
}

function feedPostInclude(viewerProfileId?: string | null) {
  const commentWhere: Prisma.FeedCommentWhereInput = {
    status: "active",
    ...(viewerProfileId
      ? {
          author: {
            userBlocksReceived: {
              none: { blockerProfileId: viewerProfileId },
            },
            userBlocksInitiated: {
              none: { blockedProfileId: viewerProfileId },
            },
          },
        }
      : {}),
  };

  return {
    author: { select: { displayName: true } },
    authorPage: {
      select: {
        id: true,
        handle: true,
        title: true,
        pageType: true,
        published: true,
        accentColor: true,
        contentJson: true,
      },
    },
    topic: true,
    media: {
      orderBy: { position: "asc" },
      include: {
        media: {
          select: {
            id: true,
            storageBucket: true,
            storagePath: true,
            publicUrl: true,
            originalName: true,
            mimeType: true,
            widthPx: true,
            heightPx: true,
          },
        },
      },
    },
    comments: {
      where: commentWhere,
      orderBy: { createdAt: "asc" },
      take: 3,
      include: { author: { select: { displayName: true } } },
    },
    reactions: {
      // Viewer-only: the card just needs whether the current user liked the
      // post; the total comes from _count.reactions. Empty `in` matches none
      // for signed-out viewers.
      where: {
        reactionType: "like",
        profileId: { in: viewerProfileId ? [viewerProfileId] : [] },
      },
      select: { profileId: true },
    },
    _count: {
      select: {
        comments: true,
        reactions: true,
      },
    },
  } as const;
}

async function assertActiveTopic(topicId: string) {
  const topic = await withDbSystemContext((tx) => tx.feedTopic.findFirst({
    where: { id: topicId, active: true },
    select: { id: true },
  }));
  if (!topic) throw new Error("feed.topic_not_found");
}

function normalizeTopicSlug(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!slug) throw new Error("feed.topic_slug_invalid");
  return slug;
}

async function assertFeedMediaAttachable(
  current: CurrentUserProfile,
  mediaIds: string[]
) {
  const media = await assertMediaAttachable(
    current,
    mediaIds,
    FEED_POST_MEDIA_LIMIT
  );
  if (media.some((item) => item.storageBucket !== PUBLIC_USER_MEDIA_BUCKET)) {
    throw new Error("feed.media_must_be_public");
  }
  if (
    media.some(
      (item) =>
        !item.mimeType.startsWith("image/") && !item.mimeType.startsWith("video/")
    )
  ) {
    throw new Error("feed.media_unsupported");
  }
}

async function attachMediaToFeedPost(
  tx: Tx,
  postId: string,
  mediaIds: string[]
) {
  if (mediaIds.length === 0) return;

  await tx.feedPostMedia.createMany({
    data: mediaIds.map((mediaId, position) => ({
      postId,
      mediaId,
      position,
    })),
  });
  await tx.mediaAsset.updateMany({
    where: { id: { in: mediaIds } },
    data: {
      linkedEntityType: "feed_post",
      linkedEntityId: postId,
    },
  });
}
