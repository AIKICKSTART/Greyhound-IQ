import { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/account-service";
import { isModeratorRole } from "@/lib/auth-roles";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { assertProfilesCanInteract } from "@/lib/conversation-service";
import { safeQuery } from "@/lib/db";
import {
  withDbAnonymousContext,
  withDbRequestContext,
  withDbSystemContext,
} from "@/lib/db-context";
import { assertPaidFeatureAccess } from "@/lib/tier-access";
import { assertMediaAttachable, mediaDeliveryUrl } from "@/lib/media-service";
import {
  createInAppNotification,
  notificationBodySnippet,
} from "@/lib/notification-service";
import { findBannedPhraseMatch } from "@/lib/moderation-service";
import { broadcastFeedRealtimeEvent } from "@/lib/realtime-service";
import { PRIVATE_USER_MEDIA_BUCKET } from "@/lib/storage-paths";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  type FeedCursor,
  type FeedMode,
} from "@/lib/feed-pagination";
import { extractMentionHandles } from "@/lib/feed-mentions";
import { firstPreviewUrl } from "@/lib/link-preview";
import {
  ensureOwnedPageActor,
  ensurePersonalActor,
  requireOwnedActor,
} from "@/lib/social-actor-service";
import {
  canReshareWithoutWidening,
  defaultPostVisibility,
  isSocialAudience,
  type SocialAudience,
} from "@/lib/social-privacy";

const FEED_POST_MEDIA_LIMIT = 10;
export const FEED_REACTION_TYPES = [
  "like",
  "love",
  "celebrate",
  "insightful",
  "support",
] as const;
export type FeedReactionType = (typeof FEED_REACTION_TYPES)[number];

type Tx = Prisma.TransactionClient;
type MentionRecipient = {
  actorId: string;
  displayName: string;
  ownerProfileId: string;
  ownerUserId: string;
};

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
  return getFeedPostsForViewer(limit, null);
}

export type FeedPageOptions = {
  mode?: FeedMode;
  actorId?: string | null;
  cursor?: string | null;
  limit?: number;
  current?: CurrentUserProfile | null;
};

type RankedFeedRow = {
  id: string;
  postId: string;
  shareId: string | null;
  shareBody: string | null;
  shareVisibility: string | null;
  shareActorId: string | null;
  shareActorKind: string | null;
  shareActorHandle: string | null;
  shareActorDisplayName: string | null;
  shareActorAvatarUrl: string | null;
  window: number;
  bucket: number;
  sortAt: Date;
};

export async function getFeedPageForViewer({
  mode = "for-you",
  actorId,
  cursor,
  limit = 20,
  current = null,
}: FeedPageOptions = {}) {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const decodedCursor = decodeFeedCursor(cursor, mode);
  const read = async (db: Prisma.TransactionClient) => {
    const actor = current
      ? await requireOwnedActor(current, actorId, db)
      : null;
    if (actor) {
      await db.$executeRaw`SELECT set_config('app.current_actor_id', ${actor.id}, true)`;
    }
    const affinity = actor
      ? await getFeedAffinity(db, current!, actor.id, actor.kind, mode)
      : {
          actorIds: [] as string[],
          topicIds: [] as string[],
          mutedActorIds: [] as string[],
        };
    const ranked = await rankedFeedRows(
      db,
      mode,
      decodedCursor,
      boundedLimit + 1,
      affinity
    );
    const pageRows = ranked.slice(0, boundedLimit);
    const posts = pageRows.length
      ? await db.feedPost.findMany({
          where: { id: { in: [...new Set(pageRows.map((row) => row.postId))] } },
          include: feedPostInclude(
            current?.profileId ?? null,
            actor?.id ?? null
          ),
        })
      : [];
    const postsById = new Map(posts.map((post) => [post.id, post]));
    const items = pageRows.flatMap((row) => {
      const post = postsById.get(row.postId);
      if (!post) return [];
      return [{
        ...post,
        feedEntryId: row.id,
        reshare: row.shareId
          ? {
              id: row.shareId,
              body: row.shareBody,
              visibility: row.shareVisibility!,
              createdAt: row.sortAt,
              actor: row.shareActorId
                ? {
                    id: row.shareActorId,
                    kind: row.shareActorKind!,
                    handle: row.shareActorHandle!,
                    displayName: row.shareActorDisplayName!,
                    avatarUrl: row.shareActorAvatarUrl,
                  }
                : null,
            }
          : null,
      }];
    });
    const last = pageRows.at(-1);
    return {
      items,
      nextCursor:
        ranked.length > boundedLimit && last
          ? encodeFeedCursor({
              version: 1,
              mode,
              window: last.window as FeedCursor["window"],
              bucket: last.bucket as FeedCursor["bucket"],
              createdAt: last.sortAt.toISOString(),
              id: last.id,
            })
          : null,
      actorId: actor?.id ?? null,
      mode,
    };
  };

  return safeQuery(
    () =>
      current
        ? withDbRequestContext(current, read)
        : withDbAnonymousContext(read),
    { items: [], nextCursor: null, actorId: null, mode }
  );
}

export async function getFeedPostsForViewer(
  limit = 30,
  current?: CurrentUserProfile | null
) {
  return (await getFeedPageForViewer({ limit, current })).items;
}

export async function getFeedPostForViewer(
  postId: string,
  options: {
    current?: CurrentUserProfile | null;
    actorId?: string | null;
  } = {}
) {
  const read = async (tx: Tx) => {
    const actor = options.current
      ? await requireOwnedActor(options.current, options.actorId, tx)
      : null;
    if (actor) {
      await tx.$executeRaw`SELECT set_config('app.current_actor_id', ${actor.id}, true)`;
    }
    const post = await tx.feedPost.findFirst({
      where: {
        id: postId,
        deletedAt: null,
        OR: [
          { status: "active" },
          ...(options.current
            ? [
                {
                  authorProfileId: options.current.profileId,
                  status: { in: ["processing", "failed"] },
                },
              ]
            : []),
        ],
      },
      include: feedPostInclude(
        options.current?.profileId ?? null,
        actor?.id ?? null
      ),
    });
    if (!post) throw new Error("feed.post_not_found");
    return post;
  };
  return options.current
    ? withDbRequestContext(options.current, read)
    : withDbAnonymousContext(read);
}

export async function getFeedCommentsForViewer(
  postId: string,
  options: {
    current?: CurrentUserProfile | null;
    cursor?: string | null;
    limit?: number;
  } = {}
) {
  const requestedLimit = Number(options.limit ?? 20);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50)
    : 20;
  const read = async (tx: Tx) => {
    const post = await tx.feedPost.findFirst({
      where: { id: postId, status: "active", deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new Error("feed.post_not_found");
    const cursor = options.cursor
      ? await tx.feedComment.findFirst({
          where: { id: options.cursor, postId, parentCommentId: null },
          select: { id: true, createdAt: true },
        })
      : null;
    if (options.cursor && !cursor) throw new Error("feed.invalid_cursor");
    const rows = await tx.feedComment.findMany({
      where: {
        postId,
        parentCommentId: null,
        status: "active",
        deletedAt: null,
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      include: {
        author: { select: { displayName: true } },
        authorActor: {
          select: { id: true, handle: true, displayName: true, avatarUrl: true },
        },
        replies: {
          where: { status: "active", deletedAt: null },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            author: { select: { displayName: true } },
            authorActor: {
              select: { id: true, handle: true, displayName: true, avatarUrl: true },
            },
            reactions: {
              where: {
                profileId: {
                  in: options.current?.profileId
                    ? [options.current.profileId]
                    : [],
                },
              },
              select: { profileId: true, reactionType: true },
            },
            _count: { select: { reactions: true } },
          },
        },
        reactions: {
          where: {
            profileId: {
              in: options.current?.profileId ? [options.current.profileId] : [],
            },
          },
          select: { profileId: true, reactionType: true },
        },
        _count: { select: { reactions: true, replies: true } },
      },
    });
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null,
    };
  };
  return options.current
    ? withDbRequestContext(options.current, read)
    : withDbAnonymousContext(read);
}

async function getFeedAffinity(
  db: Prisma.TransactionClient,
  current: CurrentUserProfile,
  actorId: string,
  actorKind: string,
  mode: FeedMode
) {
  const [follows, topics, friendships, mutes] = await Promise.all([
    mode === "for-you" ? db.actorFollow.findMany({
      where: { followerActorId: actorId },
      select: { followedActorId: true },
    }) : Promise.resolve([]),
    mode === "for-you" ? db.actorTopicFollow.findMany({
      where: { actorId },
      select: { topicId: true },
    }) : Promise.resolve([]),
    mode === "for-you" && actorKind === "personal"
      ? db.friendship.findMany({
          where: {
            status: "accepted",
            OR: [
              { profileAId: current.profileId },
              { profileBId: current.profileId },
            ],
          },
          select: { profileAId: true, profileBId: true },
        })
      : Promise.resolve([]),
    db.actorMute.findMany({
      where: { muterActorId: actorId },
      select: { mutedActorId: true },
    }),
  ]);
  const friendProfileIds = friendships.map((friendship) =>
    friendship.profileAId === current.profileId
      ? friendship.profileBId
      : friendship.profileAId
  );
  const friendActors = friendProfileIds.length
    ? await db.socialActor.findMany({
        where: { profileId: { in: friendProfileIds } },
        select: { id: true },
      })
    : [];
  return {
    actorIds: [
      ...new Set([
        ...follows.map((follow) => follow.followedActorId),
        ...friendActors.map((friend) => friend.id),
      ]),
    ],
    topicIds: topics.map((topic) => topic.topicId),
    mutedActorIds: mutes.map((mute) => mute.mutedActorId),
  };
}

async function rankedFeedRows(
  db: Prisma.TransactionClient,
  mode: FeedMode,
  cursor: FeedCursor | null,
  limit: number,
  affinity: {
    actorIds: string[];
    topicIds: string[];
    mutedActorIds: string[];
  }
) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const actorIds = sqlList(affinity.actorIds);
  const topicIds = sqlList(affinity.topicIds);
  const postMuteFilter = affinity.mutedActorIds.length
    ? Prisma.sql`AND (p."authorActorId" IS NULL OR p."authorActorId" NOT IN ${sqlList(affinity.mutedActorIds)})`
    : Prisma.empty;
  const shareMuteFilter = affinity.mutedActorIds.length
    ? Prisma.sql`AND s."actorId" NOT IN ${sqlList(affinity.mutedActorIds)}`
    : Prisma.empty;
  const postRanks =
    mode === "latest"
      ? Prisma.sql`0::integer AS "window", 0::integer AS "bucket", p."createdAt" AS "sortAt"`
      : Prisma.sql`
          CASE WHEN p."pinnedAt" IS NOT NULL OR p."createdAt" >= ${cutoff}
            THEN 0 ELSE 1 END::integer AS "window",
          CASE
            WHEN p."pinnedAt" IS NOT NULL THEN 0
            WHEN p."authorActorId" IN ${actorIds} THEN 1
            WHEN p."topicId" IN ${topicIds} THEN 2
            ELSE 3
          END::integer AS "bucket",
          COALESCE(p."pinnedAt", p."createdAt") AS "sortAt"`;
  const shareRanks =
    mode === "latest"
      ? Prisma.sql`0::integer AS "window", 0::integer AS "bucket", s."createdAt" AS "sortAt"`
      : Prisma.sql`
          CASE WHEN s."createdAt" >= ${cutoff} THEN 0 ELSE 1 END::integer AS "window",
          CASE
            WHEN s."actorId" IN ${actorIds} THEN 1
            WHEN p."topicId" IN ${topicIds} THEN 2
            ELSE 3
          END::integer AS "bucket",
          s."createdAt" AS "sortAt"`;
  const afterCursor = cursor
    ? Prisma.sql`
        WHERE (
          ranked."window" > ${cursor.window}
          OR (ranked."window" = ${cursor.window} AND ranked."bucket" > ${cursor.bucket})
          OR (
            ranked."window" = ${cursor.window}
            AND ranked."bucket" = ${cursor.bucket}
            AND ranked."sortAt" < ${new Date(cursor.createdAt)}
          )
          OR (
            ranked."window" = ${cursor.window}
            AND ranked."bucket" = ${cursor.bucket}
            AND ranked."sortAt" = ${new Date(cursor.createdAt)}
            AND ranked.id < ${cursor.id}
          )
        )`
    : Prisma.empty;
  return db.$queryRaw<RankedFeedRow[]>(Prisma.sql`
    WITH ranked AS (
      SELECT
        ('post:' || p.id) AS id,
        p.id AS "postId",
        NULL::text AS "shareId",
        NULL::text AS "shareBody",
        NULL::text AS "shareVisibility",
        NULL::text AS "shareActorId",
        NULL::text AS "shareActorKind",
        NULL::text AS "shareActorHandle",
        NULL::text AS "shareActorDisplayName",
        NULL::text AS "shareActorAvatarUrl",
        ${postRanks}
      FROM "FeedPost" p
      WHERE p."deletedAt" IS NULL
        AND (
          p.status = 'active'
          OR (
            p."authorProfileId" = public.giq_current_profile_id()
            AND p.status IN ('processing', 'failed')
          )
        )
        ${postMuteFilter}
        AND NOT EXISTS (
          SELECT 1
          FROM "UserBlock" b
          WHERE (
            b."blockerProfileId" = public.giq_current_profile_id()
            AND b."blockedProfileId" = p."authorProfileId"
          ) OR (
            b."blockedProfileId" = public.giq_current_profile_id()
            AND b."blockerProfileId" = p."authorProfileId"
          )
        )
      UNION ALL
      SELECT
        ('share:' || s.id) AS id,
        p.id AS "postId",
        s.id AS "shareId",
        s.body AS "shareBody",
        s.visibility AS "shareVisibility",
        a.id AS "shareActorId",
        a.kind AS "shareActorKind",
        a.handle AS "shareActorHandle",
        a."displayName" AS "shareActorDisplayName",
        a."avatarUrl" AS "shareActorAvatarUrl",
        ${shareRanks}
      FROM "FeedShare" s
      JOIN "FeedPost" p ON p.id = s."sourcePostId"
      LEFT JOIN "SocialActor" a ON a.id = s."actorId"
      WHERE p.status = 'active'
        AND p."deletedAt" IS NULL
        ${shareMuteFilter}
        AND NOT EXISTS (
          SELECT 1
          FROM "UserBlock" b
          WHERE (
            b."blockerProfileId" = public.giq_current_profile_id()
            AND b."blockedProfileId" = s."accountableProfileId"
          ) OR (
            b."blockedProfileId" = public.giq_current_profile_id()
            AND b."blockerProfileId" = s."accountableProfileId"
          )
        )
    )
    SELECT ranked.*
    FROM ranked
    ${afterCursor}
    ORDER BY ranked."window" ASC, ranked."bucket" ASC,
      ranked."sortAt" DESC, ranked.id DESC
    LIMIT ${limit}
  `);
}

function sqlList(values: string[]) {
  return values.length
    ? Prisma.sql`(${Prisma.join(values)})`
    : Prisma.sql`(NULL)`;
}

export async function createFeedPostForCurrentUser(
  current: CurrentUserProfile,
  input: {
    topicId?: string | null;
    body: string;
    mediaIds?: string[];
    pageId?: string | null;
    visibility?: string;
  }
) {
  const topicId = input.topicId || null;
  if (topicId) await assertActiveTopic(topicId);
  const pageId = input.pageId || null;
  if (pageId) assertPaidFeatureAccess(current);
  const mediaIds = input.mediaIds ?? [];
  const media = await assertFeedMediaAttachable(current, mediaIds);
  const phraseMatch = await findBannedPhraseMatch(input.body, "feed");
  if (phraseMatch?.action === "block") throw new Error("feed.blocked_phrase");
  const hasProcessingMedia = media.some(
    (item) => item.processingStatus !== "ready" || item.scanStatus !== "clean"
  );
  const status = phraseMatch
    ? "hidden"
    : hasProcessingMedia
      ? "processing"
      : "active";
  const previewUrl = firstPreviewUrl(input.body);

  let mentionRecipients: MentionRecipient[] = [];
  let actingActorId: string | null = null;
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
    const actor = pageId
      ? await ensureOwnedPageActor(current, pageId, tx)
      : await ensurePersonalActor(current, tx);
    actingActorId = actor.id;
    const visibility = input.visibility ?? defaultPostVisibility(
      actor.kind === "page" ? "page" : "personal"
    );
    if (!isSocialAudience(visibility)) throw new Error("feed.invalid_visibility");
    const created = await tx.feedPost.create({
      data: {
        authorProfileId: current.profileId,
        authorPageId: pageId,
        authorActorId: actor.id,
        topicId,
        body: input.body,
        status,
        visibility,
        publishedAt: status === "active" ? new Date() : null,
        linkPreviewUrl: previewUrl,
        linkPreviewStatus: previewUrl ? "pending" : null,
      },
    });
    await attachMediaToFeedPost(tx, created.id, mediaIds);
    mentionRecipients = await recordFeedMentions(tx, current, input.body, {
      postId: created.id,
    });
    return created;
  });

  await notifyFeedMentions(
    current,
    mentionRecipients,
    post.id,
    null,
    actingActorId
  );

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
  if (status === "active" && post.visibility === "public") {
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
  if (post.visibility === "public") {
    await broadcastFeedRealtimeEvent("post_updated", {
      postId: post.id,
      action: input.action,
    });
  }

  return post;
}

export async function createFeedCommentForCurrentUser(
  current: CurrentUserProfile,
  postId: string,
  input: {
    body: string;
    parentCommentId?: string | null;
    actorId?: string | null;
  }
) {
  const post = await withDbRequestContext(current, (tx) => tx.feedPost.findFirst({
    where: { id: postId, status: "active", deletedAt: null },
    select: {
      id: true,
      authorProfileId: true,
      authorActorId: true,
      visibility: true,
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
  let parentRecipient: {
    authorProfileId: string;
    author: { userId: string };
  } | null = null;
  if (parentCommentId) {
    const parent = await withDbRequestContext(current, (tx) => tx.feedComment.findFirst({
      where: {
        id: parentCommentId,
        postId,
        status: "active",
        deletedAt: null,
        parentCommentId: null,
      },
      select: {
        id: true,
        authorProfileId: true,
        author: { select: { userId: true } },
      },
    }));
    if (!parent) throw new Error("feed.comment_not_found");
    parentRecipient = parent;
  }
  const phraseMatch = await findBannedPhraseMatch(input.body, "feed");
  if (phraseMatch?.action === "block") throw new Error("feed.blocked_phrase");
  const status = phraseMatch ? "hidden" : "active";

  let mentionRecipients: MentionRecipient[] = [];
  let actingActorId: string | null = null;
  let actingActorName = current.displayName;
  const comment = await withDbRequestContext(current, async (tx) => {
    const actor = await requireOwnedActor(current, input.actorId, tx);
    actingActorId = actor.id;
    actingActorName = actor.displayName;
    if (actor.kind === "page") assertPaidFeatureAccess(current);
    const created = await tx.feedComment.create({
      data: {
        postId,
        authorProfileId: current.profileId,
        authorActorId: actor.id,
        parentCommentId,
        body: input.body,
        status,
      },
    });
    mentionRecipients = await recordFeedMentions(tx, current, input.body, {
      commentId: created.id,
    });
    return created;
  });

  await notifyFeedMentions(
    current,
    mentionRecipients,
    postId,
    comment.id,
    actingActorId
  );

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "feed.comment.create",
    targetType: "feed_post",
    targetId: postId,
    metadata: { commentId: comment.id, parentCommentId, phraseFlag: phraseMatch?.id },
  });
  if (status === "active" && post.visibility === "public") {
    await broadcastFeedRealtimeEvent("comment_created", {
      postId,
      commentId: comment.id,
    });
  }
  if (status === "active" && post.authorProfileId !== current.profileId) {
    await createInAppNotification({
      userId: post.author.userId,
      actorProfileId: current.profileId,
      actorId: actingActorId,
      type: "feed_comment",
      title: `${actingActorName} commented on your feed post`,
      body: notificationBodySnippet(input.body),
      href: "/feed",
      targetType: "feed_post",
      targetId: postId,
      metadata: { commentId: comment.id },
    });
  }
  if (
    status === "active" &&
    parentRecipient &&
    parentCommentId &&
    parentRecipient.authorProfileId !== current.profileId &&
    parentRecipient.authorProfileId !== post.authorProfileId
  ) {
    await createInAppNotification({
      userId: parentRecipient.author.userId,
      actorProfileId: current.profileId,
      actorId: actingActorId,
      type: "feed_reply",
      title: `${actingActorName} replied to your comment`,
      body: notificationBodySnippet(input.body),
      href: "/feed",
      targetType: "feed_comment",
      targetId: parentCommentId,
      metadata: { postId, commentId: comment.id },
    });
  }

  return comment;
}

export async function toggleFeedPostReactionForCurrentUser(
  current: CurrentUserProfile,
  postId: string,
  input: { reactionType?: FeedReactionType; actorId?: string | null } = {}
) {
  const reactionType = input.reactionType ?? "like";
  if (!FEED_REACTION_TYPES.includes(reactionType)) {
    throw new Error("feed.invalid_reaction");
  }
  const post = await withDbRequestContext(current, (tx) => tx.feedPost.findFirst({
    where: { id: postId, status: "active", deletedAt: null },
    select: {
      id: true,
      authorProfileId: true,
      visibility: true,
      author: { select: { userId: true } },
    },
  }));
  if (!post) throw new Error("feed.post_not_found");
  await assertProfilesCanInteract(
    current.profileId,
    post.authorProfileId,
    "feed.blocked"
  );

  const actor = await withDbRequestContext(current, (tx) =>
    requireOwnedActor(current, input.actorId, tx)
  );
  if (actor.kind === "page") assertPaidFeatureAccess(current);
  const existing = await withDbRequestContext(current, (tx) =>
    tx.feedReaction.findFirst({
      where: { postId, profileId: current.profileId },
      select: { id: true, actorId: true, reactionType: true },
    })
  );

  if (existing) {
    if (existing.actorId !== actor.id || existing.reactionType !== reactionType) {
      await withDbRequestContext(current, (tx) =>
        tx.feedReaction.update({
          where: { id: existing.id },
          data: { actorId: actor.id, reactionType },
        })
      );
      if (post.visibility === "public") {
        await broadcastFeedRealtimeEvent("reaction_updated", { postId });
      }
      return { active: true, liked: true, reactionType };
    }
    await withDbRequestContext(current, (tx) =>
      tx.feedReaction.delete({ where: { id: existing.id } })
    );
    if (post.visibility === "public") {
      await broadcastFeedRealtimeEvent("reaction_updated", { postId });
    }
    return { active: false, liked: false, reactionType };
  }

  await withDbRequestContext(current, (tx) => tx.feedReaction.create({
    data: {
      postId,
      profileId: current.profileId,
      actorId: actor.id,
      reactionType,
    },
  }));
  if (post.visibility === "public") {
    await broadcastFeedRealtimeEvent("reaction_updated", { postId });
  }
  if (post.authorProfileId !== current.profileId) {
    await createInAppNotification({
      userId: post.author.userId,
      actorProfileId: current.profileId,
      actorId: actor.id,
      type: "feed_reaction",
      title: `${actor.displayName} reacted to your feed post`,
      href: "/feed",
      targetType: "feed_post",
      targetId: postId,
    });
  }
  return { active: true, liked: true, reactionType };
}

export async function editFeedCommentForCurrentUser(
  current: CurrentUserProfile,
  commentId: string,
  body: string
) {
  const phraseMatch = await findBannedPhraseMatch(body, "feed");
  if (phraseMatch?.action === "block") throw new Error("feed.blocked_phrase");
  const result = await withDbRequestContext(current, async (tx) => {
    const existing = await tx.feedComment.findFirst({
      where: {
        id: commentId,
        authorProfileId: current.profileId,
        deletedAt: null,
      },
      select: {
        id: true,
        postId: true,
        authorActorId: true,
        post: { select: { visibility: true } },
      },
    });
    if (!existing) throw new Error("feed.comment_not_found");
    if (existing.authorActorId) {
      const actor = await requireOwnedActor(current, existing.authorActorId, tx);
      if (actor.kind === "page") assertPaidFeatureAccess(current);
    }
    const comment = await tx.feedComment.update({
      where: { id: commentId },
      data: {
        body,
        editedAt: new Date(),
        status: phraseMatch ? "hidden" : "active",
      },
    });
    await tx.feedMention.deleteMany({
      where: { commentId, accountableProfileId: current.profileId },
    });
    const mentions = await recordFeedMentions(tx, current, body, { commentId });
    return { comment, mentions, visibility: existing.post.visibility };
  });
  await notifyFeedMentions(
    current,
    result.mentions,
    result.comment.postId,
    result.comment.id,
    result.comment.authorActorId
  );
  if (result.visibility === "public") {
    await broadcastFeedRealtimeEvent("comment_updated", {
      postId: result.comment.postId,
      commentId,
      action: "edit",
    });
  }
  return result.comment;
}

export async function deleteFeedCommentForCurrentUser(
  current: CurrentUserProfile,
  commentId: string
) {
  const deletedAt = new Date();
  const result = await withDbRequestContext(current, async (tx) => {
    const comment = await tx.feedComment.findFirst({
      where: {
        id: commentId,
        authorProfileId: current.profileId,
        deletedAt: null,
      },
      select: {
        id: true,
        postId: true,
        post: { select: { visibility: true } },
      },
    });
    if (!comment) throw new Error("feed.comment_not_found");
    await tx.feedComment.update({
      where: { id: commentId },
      data: { status: "removed", deletedAt },
    });
    return comment;
  });
  if (result.post.visibility === "public") {
    await broadcastFeedRealtimeEvent("comment_updated", {
      postId: result.postId,
      commentId,
      action: "delete",
    });
  }
  return { id: commentId, deletedAt };
}

export async function toggleFeedCommentReactionForCurrentUser(
  current: CurrentUserProfile,
  commentId: string,
  input: { reactionType?: FeedReactionType; actorId?: string | null } = {}
) {
  const reactionType = input.reactionType ?? "like";
  if (!FEED_REACTION_TYPES.includes(reactionType)) {
    throw new Error("feed.invalid_reaction");
  }
  const result = await withDbRequestContext(current, async (tx) => {
    const [comment, actor] = await Promise.all([
      tx.feedComment.findFirst({
        where: { id: commentId, status: "active", deletedAt: null },
        select: {
          id: true,
          postId: true,
          authorProfileId: true,
          author: { select: { userId: true } },
          post: { select: { visibility: true } },
        },
      }),
      requireOwnedActor(current, input.actorId, tx),
    ]);
    if (!comment) throw new Error("feed.comment_not_found");
    if (actor.kind === "page") assertPaidFeatureAccess(current);
    const existing = await tx.feedReaction.findFirst({
      where: { commentId, profileId: current.profileId },
      select: { id: true, actorId: true, reactionType: true },
    });
    if (existing) {
      if (
        existing.actorId !== actor.id ||
        existing.reactionType !== reactionType
      ) {
        await tx.feedReaction.update({
          where: { id: existing.id },
          data: { actorId: actor.id, reactionType },
        });
        return {
          item: { active: true, reactionType },
          postId: comment.postId,
          visibility: comment.post.visibility,
        };
      }
      await tx.feedReaction.delete({ where: { id: existing.id } });
      return {
        item: { active: false, reactionType },
        postId: comment.postId,
        visibility: comment.post.visibility,
      };
    }
    await tx.feedReaction.create({
      data: {
        commentId,
        profileId: current.profileId,
        actorId: actor.id,
        reactionType,
      },
    });
    return {
      item: { active: true, reactionType },
      postId: comment.postId,
      visibility: comment.post.visibility,
      notification:
        comment.authorProfileId === current.profileId
          ? null
          : {
              userId: comment.author.userId,
              actorId: actor.id,
              actorName: actor.displayName,
            },
    };
  });
  if (result.visibility === "public") {
    await broadcastFeedRealtimeEvent("reaction_updated", {
      postId: result.postId,
    });
  }
  if ("notification" in result && result.notification) {
    await createInAppNotification({
      userId: result.notification.userId,
      actorProfileId: current.profileId,
      actorId: result.notification.actorId,
      type: "feed_comment_reaction",
      title: `${result.notification.actorName} reacted to your comment`,
      href: "/feed",
      targetType: "feed_comment",
      targetId: commentId,
    });
  }
  return result.item;
}

export async function blockFeedPostAuthorForCurrentUser(
  current: CurrentUserProfile,
  postId: string
) {
  const post = await withDbRequestContext(current, (tx) => tx.feedPost.findFirst({
    where: { id: postId, status: "active", deletedAt: null },
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

function feedPostInclude(
  viewerProfileId?: string | null,
  viewerActorId?: string | null
) {
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
    authorActor: {
      select: {
        id: true,
        kind: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
      },
    },
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
    topic: {
      include: {
        followers: {
          where: { actorId: { in: viewerActorId ? [viewerActorId] : [] } },
          select: { actorId: true },
        },
      },
    },
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
            durationSec: true,
            processingStatus: true,
            processingError: true,
            playbackPath: true,
            posterPath: true,
            hlsPath: true,
            waveformJson: true,
            altText: true,
            captionPath: true,
          },
        },
      },
    },
    comments: {
      where: commentWhere,
      orderBy: { createdAt: "asc" },
      take: 3,
      include: {
        author: { select: { displayName: true } },
        authorActor: {
          select: { id: true, handle: true, displayName: true, avatarUrl: true },
        },
        reactions: {
          where: {
            profileId: { in: viewerProfileId ? [viewerProfileId] : [] },
          },
          select: { profileId: true, reactionType: true },
        },
        _count: { select: { reactions: true, replies: true } },
      },
    },
    reactions: {
      // Viewer-only: the card just needs whether the current user liked the
      // post; the total comes from _count.reactions. Empty `in` matches none
      // for signed-out viewers.
      where: {
        reactionType: "like",
        OR: viewerActorId
          ? [
              { actorId: viewerActorId },
              {
                actorId: null,
                profileId: { in: viewerProfileId ? [viewerProfileId] : [] },
              },
            ]
          : [{ profileId: { in: viewerProfileId ? [viewerProfileId] : [] } }],
      },
      select: { profileId: true, actorId: true },
    },
    savedBy: {
      where: { actorId: { in: viewerActorId ? [viewerActorId] : [] } },
      select: { actorId: true },
    },
    shares: {
      where: { actorId: { in: viewerActorId ? [viewerActorId] : [] } },
      select: { actorId: true },
    },
    _count: {
      select: {
        comments: { where: commentWhere },
        reactions: true,
        shares: true,
      },
    },
  } as const;
}

export async function editFeedPostForCurrentUser(
  current: CurrentUserProfile,
  postId: string,
  input: { body: string; visibility: SocialAudience }
) {
  if (!isSocialAudience(input.visibility)) {
    throw new Error("feed.invalid_visibility");
  }
  const phraseMatch = await findBannedPhraseMatch(input.body, "feed");
  if (phraseMatch?.action === "block") throw new Error("feed.blocked_phrase");
  let mentionRecipients: MentionRecipient[] = [];
  let actingActorId: string | null = null;
  let previousVisibility: string | null = null;
  const updated = await withDbRequestContext(current, async (tx) => {
    const existing = await tx.feedPost.findFirst({
      where: { id: postId, authorProfileId: current.profileId, deletedAt: null },
      select: { id: true, authorActorId: true, visibility: true },
    });
    if (!existing) throw new Error("feed.post_not_found");
    previousVisibility = existing.visibility;
    if (existing.authorActorId) {
      const actor = await requireOwnedActor(current, existing.authorActorId, tx);
      actingActorId = actor.id;
      if (actor.kind === "page") assertPaidFeatureAccess(current);
    }
    const changed = await tx.feedPost.update({
      where: { id: postId },
      data: {
        body: input.body,
        visibility: input.visibility,
        editedAt: new Date(),
        status: phraseMatch ? "hidden" : undefined,
        linkPreviewUrl: firstPreviewUrl(input.body),
        linkPreviewStatus: firstPreviewUrl(input.body) ? "pending" : null,
        linkPreviewJson: null,
      },
    });
    await tx.feedMention.deleteMany({
      where: { postId, accountableProfileId: current.profileId },
    });
    mentionRecipients = await recordFeedMentions(tx, current, input.body, {
      postId,
    });
    return changed;
  });
  await notifyFeedMentions(
    current,
    mentionRecipients,
    postId,
    null,
    actingActorId
  );
  if (previousVisibility === "public" || updated.visibility === "public") {
    await broadcastFeedRealtimeEvent("post_updated", { postId, action: "edit" });
  }
  return updated;
}

export async function deleteFeedPostForCurrentUser(
  current: CurrentUserProfile,
  postId: string
) {
  const deletedAt = new Date();
  const removed = await withDbRequestContext(current, async (tx) => {
    const post = await tx.feedPost.findFirst({
      where: { id: postId, authorProfileId: current.profileId, deletedAt: null },
      select: { id: true, visibility: true },
    });
    if (!post) throw new Error("feed.post_not_found");
    await tx.feedPost.update({
      where: { id: postId },
      data: { status: "removed", deletedAt },
    });
    return post;
  });
  if (removed.visibility === "public") {
    await broadcastFeedRealtimeEvent("post_updated", { postId, action: "delete" });
  }
  return { id: postId, deletedAt };
}

export async function toggleSavedFeedPostForCurrentUser(
  current: CurrentUserProfile,
  postId: string,
  actorId?: string | null
) {
  return withDbRequestContext(current, async (tx) => {
    const [post, actor] = await Promise.all([
      tx.feedPost.findFirst({
        where: { id: postId, status: "active", deletedAt: null },
        select: { id: true },
      }),
      requireOwnedActor(current, actorId, tx),
    ]);
    if (!post) throw new Error("feed.post_not_found");
    const existing = await tx.savedFeedPost.findUnique({
      where: { actorId_postId: { actorId: actor.id, postId } },
      select: { postId: true },
    });
    if (existing) {
      await tx.savedFeedPost.delete({
        where: { actorId_postId: { actorId: actor.id, postId } },
      });
      return { saved: false };
    }
    await tx.savedFeedPost.create({ data: { actorId: actor.id, postId } });
    return { saved: true };
  });
}

export async function shareFeedPostForCurrentUser(
  current: CurrentUserProfile,
  postId: string,
  input: {
    body?: string | null;
    visibility: SocialAudience;
    actorId?: string | null;
  }
) {
  if (!isSocialAudience(input.visibility)) {
    throw new Error("feed.invalid_visibility");
  }
  const share = await withDbRequestContext(current, async (tx) => {
    const [source, actor] = await Promise.all([
      tx.feedPost.findFirst({
        where: { id: postId, status: "active", deletedAt: null },
        select: { id: true, visibility: true, authorProfileId: true, author: { select: { userId: true } } },
      }),
      requireOwnedActor(current, input.actorId, tx),
    ]);
    if (!source || !isSocialAudience(source.visibility)) {
      throw new Error("feed.post_not_found");
    }
    if (!canReshareWithoutWidening(source.visibility, input.visibility)) {
      throw new Error("feed.share_widens_audience");
    }
    if (actor.kind === "page") assertPaidFeatureAccess(current);
    const created = await tx.feedShare.upsert({
      where: { sourcePostId_actorId: { sourcePostId: postId, actorId: actor.id } },
      update: { body: input.body ?? null, visibility: input.visibility },
      create: {
        sourcePostId: postId,
        actorId: actor.id,
        accountableProfileId: current.profileId,
        body: input.body ?? null,
        visibility: input.visibility,
      },
    });
    return { created, source, actor };
  });
  if (share.source.visibility === "public") {
    await broadcastFeedRealtimeEvent("post_updated", { postId, action: "share" });
  }
  if (share.source.authorProfileId !== current.profileId) {
    await createInAppNotification({
      userId: share.source.author.userId,
      actorProfileId: current.profileId,
      actorId: share.actor.id,
      type: "feed_share",
      title: `${share.actor.displayName} shared your feed post`,
      href: "/feed",
      targetType: "feed_post",
      targetId: postId,
    });
  }
  return share.created;
}

export async function toggleActorMuteForCurrentUser(
  current: CurrentUserProfile,
  mutedActorId: string,
  muterActorId?: string | null
) {
  return withDbRequestContext(current, async (tx) => {
    const [muter, target] = await Promise.all([
      requireOwnedActor(current, muterActorId, tx),
      tx.socialActor.findFirst({
        where: { id: mutedActorId },
        select: { id: true },
      }),
    ]);
    if (!target) throw new Error("actor.not_found");
    if (muter.id === target.id) throw new Error("actor.cannot_mute_self");
    if (muter.kind === "page") assertPaidFeatureAccess(current);
    const key = {
      muterActorId_mutedActorId: {
        muterActorId: muter.id,
        mutedActorId: target.id,
      },
    };
    const existing = await tx.actorMute.findUnique({
      where: key,
      select: { mutedActorId: true },
    });
    if (existing) {
      await tx.actorMute.delete({ where: key });
      return { muted: false };
    }
    await tx.actorMute.create({
      data: { muterActorId: muter.id, mutedActorId: target.id },
    });
    return { muted: true };
  });
}

export async function toggleActorTopicFollowForCurrentUser(
  current: CurrentUserProfile,
  topicId: string,
  actorId?: string | null
) {
  return withDbRequestContext(current, async (tx) => {
    const [actor, topic] = await Promise.all([
      requireOwnedActor(current, actorId, tx),
      tx.feedTopic.findFirst({
        where: { id: topicId, active: true },
        select: { id: true },
      }),
    ]);
    if (!topic) throw new Error("feed.topic_not_found");
    if (actor.kind === "page") assertPaidFeatureAccess(current);
    const key = {
      actorId_topicId: { actorId: actor.id, topicId: topic.id },
    };
    const existing = await tx.actorTopicFollow.findUnique({
      where: key,
      select: { actorId: true },
    });
    if (existing) {
      await tx.actorTopicFollow.delete({ where: key });
      return { followed: false };
    }
    await tx.actorTopicFollow.create({
      data: { actorId: actor.id, topicId: topic.id },
    });
    return { followed: true };
  });
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
    FEED_POST_MEDIA_LIMIT,
    { allowPending: true }
  );
  if (media.some((item) => item.storageBucket !== PRIVATE_USER_MEDIA_BUCKET)) {
    throw new Error("feed.media_must_be_private");
  }
  if (
    media.some(
      (item) =>
        !item.mimeType.startsWith("image/") &&
        !item.mimeType.startsWith("video/") &&
        !item.mimeType.startsWith("audio/")
    )
  ) {
    throw new Error("feed.media_unsupported");
  }
  const images = media.filter((item) => item.mimeType.startsWith("image/")).length;
  const audioVideo = media.length - images;
  if (audioVideo > 1 || (audioVideo === 1 && images > 4)) {
    throw new Error("feed.media_mix_invalid");
  }
  return media;
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

async function recordFeedMentions(
  tx: Tx,
  current: CurrentUserProfile,
  body: string,
  target: { postId?: string; commentId?: string }
) {
  const handles = extractMentionHandles(body);
  if (handles.length === 0) return [];
  const actors = await tx.socialActor.findMany({
    where: { handle: { in: handles }, published: true },
    select: {
      id: true,
      displayName: true,
      ownerProfileId: true,
      ownerProfile: { select: { userId: true } },
    },
  });
  if (actors.length === 0) return [];
  await tx.feedMention.createMany({
    data: actors.map((actor) => ({
      actorId: actor.id,
      accountableProfileId: current.profileId,
      postId: target.postId ?? null,
      commentId: target.commentId ?? null,
    })),
    skipDuplicates: true,
  });
  return actors.map((actor) => ({
    actorId: actor.id,
    displayName: actor.displayName,
    ownerProfileId: actor.ownerProfileId,
    ownerUserId: actor.ownerProfile.userId,
  }));
}

async function notifyFeedMentions(
  current: CurrentUserProfile,
  recipients: MentionRecipient[],
  postId: string,
  commentId: string | null,
  actingActorId: string | null
) {
  await Promise.all(
    recipients
      .filter((recipient) => recipient.ownerProfileId !== current.profileId)
      .map((recipient) =>
        createInAppNotification({
          userId: recipient.ownerUserId,
          actorProfileId: current.profileId,
          actorId: actingActorId,
          type: commentId ? "feed_comment_mention" : "feed_post_mention",
          title: `${current.displayName} mentioned ${recipient.displayName}`,
          href: `/feed#post-${postId}`,
          targetType: commentId ? "feed_comment" : "feed_post",
          targetId: commentId ?? postId,
          metadata: { postId },
        })
      )
  );
}
