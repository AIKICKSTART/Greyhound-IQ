import "./load-env";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  getPublishedCustomPageByHandle,
  resolveCustomPageMedia,
} from "../src/lib/custom-page-service";
import { getConversationForProfile } from "../src/lib/conversation-service";
import { prisma } from "../src/lib/db";
import {
  type DbContextClient,
  type DbContextUser,
  setDbRequestContext,
  withDbSystemContext,
} from "../src/lib/db-context";
import { getListingForViewerById } from "../src/lib/listing-service";
import { DEMO_PROVIDER_ROUTE_PATHS } from "../src/lib/demo-route-sample-contract";
import { findDemoProviderRouteSamples } from "../src/lib/demo-route-samples";
import { getSocialActorProfileByHandle } from "../src/lib/social-actor-service";
import { SITE_ASSETS_BUCKET } from "../src/lib/storage-paths";
import {
  assertDemoFixtureManifest,
  DEMO_CONTROL_ROOM_AVATAR,
  DEMO_FIXTURE_APPROVED_ASSETS,
  DEMO_FIXTURE_MANIFEST,
  DEMO_FIXTURE_TIMESTAMP,
} from "./demo-route-fixture-contract";

const [ADMIN_ACCOUNT, PEER_ACCOUNT, FREE_ACCOUNT, PRO_PLUS_ACCOUNT] =
  DEMO_FIXTURE_MANIFEST.accounts;
const { page: PAGE, conversation: CONVERSATION, listing: LISTING } =
  DEMO_FIXTURE_MANIFEST;
const { community: COMMUNITY } = DEMO_FIXTURE_MANIFEST;
const DEMO_PAGE_MEDIA_ASSETS = DEMO_FIXTURE_MANIFEST.pageMedia;
const FIXTURE_TIME = new Date(DEMO_FIXTURE_TIMESTAMP);

const DEMO_PAGE_CONTENT = JSON.stringify({
  avatarMediaId: "demo-page-media-avatar",
  bannerMediaId: "demo-page-media-banner",
  logoMediaId: "demo-page-media-logo",
  cardMediaId: null,
  galleryMediaIds: [
    "demo-page-media-gallery-stats",
    "demo-page-media-gallery-breeding",
    "demo-page-media-gallery-ai",
  ],
});

export function assertDemoTarget(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.APP_ENV !== "demo") {
    throw new Error("demo_fixtures.blocked: APP_ENV must equal demo");
  }
  if (env.DEMO_AUTH_MODE !== "full-access") {
    throw new Error(
      "demo_fixtures.blocked: DEMO_AUTH_MODE must equal full-access",
    );
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("demo_fixtures.blocked: DATABASE_URL is required");

  const urls = [
    databaseUrl,
    env.NEXT_PUBLIC_APP_URL,
    env.NEXTAUTH_URL,
    env.WORKOS_REDIRECT_URI,
  ].filter((value): value is string => Boolean(value));

  for (const value of urls) {
    let host: string;
    try {
      host = new URL(value).hostname.toLowerCase();
    } catch {
      throw new Error("demo_fixtures.blocked: target URL is invalid");
    }
    if (
      /(^|[.-])(prod|production)([.-]|$)/.test(host) ||
      /^(www\.)?greyhounds?iq\.com\.au$/.test(host)
    ) {
      throw new Error(`demo_fixtures.blocked_production_host: ${host}`);
    }
  }

  const database = new URL(databaseUrl);
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(
    database.hostname.toLowerCase(),
  );
  if (!loopback) {
    const expectedProjectRef = env.DEMO_STAGING_SUPABASE_PROJECT_REF
      ?.trim()
      .toLowerCase();
    if (!expectedProjectRef || !/^[a-z0-9]{10,40}$/.test(expectedProjectRef)) {
      throw new Error(
        "demo_fixtures.blocked: DEMO_STAGING_SUPABASE_PROJECT_REF is required for remote writes",
      );
    }
    const databaseUsername = decodeURIComponent(database.username).toLowerCase();
    const databaseMatches =
      database.hostname.toLowerCase().includes(`.${expectedProjectRef}.`) ||
      database.hostname.toLowerCase() === `db.${expectedProjectRef}.supabase.co` ||
      databaseUsername.endsWith(`.${expectedProjectRef}`);
    if (!databaseMatches) {
      throw new Error("demo_fixtures.blocked: remote database project ref mismatch");
    }

    const publicSupabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (publicSupabaseUrl) {
      const publicProjectRef = new URL(publicSupabaseUrl).hostname
        .toLowerCase()
        .split(".")[0];
      if (publicProjectRef !== expectedProjectRef) {
        throw new Error(
          "demo_fixtures.blocked: public Supabase project ref mismatch",
        );
      }
    }
  }
}

async function ensureDemoIdentities(tx: DbContextClient) {
  for (const account of DEMO_FIXTURE_MANIFEST.accounts) {
    const userCollisions = await tx.user.findMany({
      where: { OR: [{ id: account.userId }, { email: account.email }] },
    });
    if (
      userCollisions.length > 1 ||
      userCollisions.some(
        (user) =>
          user.id !== account.userId ||
          user.email !== account.email ||
          user.workosUserId !== null ||
          user.stripeCustomerId !== null ||
          user.stripeSubscriptionId !== null,
      )
    ) {
      throw new Error(`demo_fixtures.user_collision: ${account.userId}`);
    }
    const user = await tx.user.upsert({
      where: { id: account.userId },
      update: {
        email: account.email,
        name: account.displayName,
        subscriptionTier: account.tier,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isBanned: false,
        deletionRequestedAt: null,
        workosUserId: null,
        createdAt: FIXTURE_TIME,
      },
      create: {
        id: account.userId,
        email: account.email,
        name: account.displayName,
        subscriptionTier: account.tier,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isBanned: false,
        deletionRequestedAt: null,
        workosUserId: null,
        createdAt: FIXTURE_TIME,
      },
    });
    const profileCollisions = await tx.profile.findMany({
      where: { OR: [{ id: account.profileId }, { userId: user.id }] },
    });
    if (
      profileCollisions.length > 1 ||
      profileCollisions.some(
        (profile) =>
          profile.id !== account.profileId || profile.userId !== account.userId,
      )
    ) {
      throw new Error(`demo_fixtures.profile_collision: ${account.profileId}`);
    }
    await tx.profile.upsert({
      where: { id: account.profileId },
      update: {
        userId: user.id,
        displayName: account.displayName,
        bio: null,
        role: account.role,
        verified: account.verified,
        avatarUrl: account.avatarUrl,
        state: null,
        kennelName: null,
        kennelPrefix: null,
        isFounder: false,
        website: null,
        phone: null,
        createdAt: FIXTURE_TIME,
      },
      create: {
        id: account.profileId,
        userId: user.id,
        displayName: account.displayName,
        role: account.role,
        verified: account.verified,
        avatarUrl: account.avatarUrl,
        bio: null,
        state: null,
        kennelName: null,
        kennelPrefix: null,
        isFounder: false,
        website: null,
        phone: null,
        createdAt: FIXTURE_TIME,
      },
    });
  }
}

async function ensurePersonalActor(
  tx: DbContextClient,
  profile: { id: string; displayName: string; avatarUrl: string | null },
  account: (typeof DEMO_FIXTURE_MANIFEST.accounts)[number],
) {
  const collisions = await tx.socialActor.findMany({
    where: {
      OR: [
        { id: account.actorId },
        { profileId: profile.id },
        { handle: account.actorHandle },
      ],
    },
  });
  if (
    collisions.length > 1 ||
    collisions.some(
      (actor) =>
        actor.id !== account.actorId ||
        actor.kind !== "personal" ||
        actor.profileId !== profile.id ||
        actor.pageId !== null ||
        actor.ownerProfileId !== profile.id ||
        actor.handle !== account.actorHandle,
    )
  ) {
    throw new Error(`demo_fixtures.personal_actor_collision: ${account.actorId}`);
  }

  return tx.socialActor.upsert({
    where: { id: account.actorId },
    update: {
      kind: "personal",
      profileId: profile.id,
      pageId: null,
      ownerProfileId: profile.id,
      handle: account.actorHandle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarFocalX: 0.5,
      avatarFocalY: 0.5,
      avatarZoom: 1,
      avatarRotation: 0,
      coverUrl: null,
      coverFocalX: 0.5,
      coverFocalY: 0.5,
      coverZoom: 1,
      coverRotation: 0,
      profileVisibility: "public",
      contactVisibility: "only_me",
      published: true,
      createdAt: FIXTURE_TIME,
    },
    create: {
      id: account.actorId,
      kind: "personal",
      profileId: profile.id,
      ownerProfileId: profile.id,
      handle: account.actorHandle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarFocalX: 0.5,
      avatarFocalY: 0.5,
      avatarZoom: 1,
      avatarRotation: 0,
      coverUrl: null,
      coverFocalX: 0.5,
      coverFocalY: 0.5,
      coverZoom: 1,
      coverRotation: 0,
      profileVisibility: "public",
      contactVisibility: "only_me",
      published: true,
      createdAt: FIXTURE_TIME,
    },
  });
}

async function validateDemoPageMediaAssets() {
  const approvedAssets = new Map(
    await Promise.all(
      DEMO_FIXTURE_APPROVED_ASSETS.map(async (asset) => {
        const bytes = await readFile(path.join(process.cwd(), asset.filePath));
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        if (sha256 !== asset.sha256 || bytes.byteLength !== asset.sizeBytes) {
          throw new Error(`demo_fixtures.media_hash_mismatch: ${asset.id}`);
        }
        return [asset.id, asset] as const;
      }),
    ),
  );

  return DEMO_PAGE_MEDIA_ASSETS.map((pageAsset) => {
    const asset = approvedAssets.get(pageAsset.assetId);
    if (!asset) {
      throw new Error(`demo_fixtures.media_not_approved: ${pageAsset.id}`);
    }
    return { ...pageAsset, sizeBytes: asset.sizeBytes };
  });
}

async function ensureCommunityFixtures(
  tx: DbContextClient,
  authorProfileId: string,
) {
  const category = await tx.forumCategory.findUnique({
    where: { slug: COMMUNITY.categorySlug },
  });
  if (!category || category.id !== COMMUNITY.categoryId) {
    throw new Error(`demo_fixtures.reference_category_missing: ${COMMUNITY.categoryId}`);
  }
  const threadCollision = await tx.thread.findUnique({
    where: { id: COMMUNITY.threadId },
  });
  if (
    threadCollision &&
    (threadCollision.categoryId !== category.id ||
      threadCollision.authorId !== authorProfileId)
  ) {
    throw new Error(`demo_fixtures.thread_collision: ${COMMUNITY.threadId}`);
  }
  const thread = await tx.thread.upsert({
    where: { id: COMMUNITY.threadId },
    update: {
      categoryId: category.id,
      title: "GreyhoundIQ demo race-night discussion",
      authorId: authorProfileId,
      pinned: true,
      locked: false,
      views: 42,
      createdAt: FIXTURE_TIME,
    },
    create: {
      id: COMMUNITY.threadId,
      categoryId: category.id,
      title: "GreyhoundIQ demo race-night discussion",
      authorId: authorProfileId,
      pinned: true,
      locked: false,
      views: 42,
      createdAt: FIXTURE_TIME,
    },
  });
  const postCollision = await tx.post.findUnique({
    where: { id: COMMUNITY.postId },
  });
  if (
    postCollision &&
    (postCollision.threadId !== thread.id ||
      postCollision.authorId !== authorProfileId)
  ) {
    throw new Error(`demo_fixtures.post_collision: ${COMMUNITY.postId}`);
  }
  await tx.post.upsert({
    where: { id: COMMUNITY.postId },
    update: {
      threadId: thread.id,
      authorId: authorProfileId,
      body: "A deterministic local-only discussion fixture used to verify both forum and groups detail routes.",
      editedAt: null,
      createdAt: FIXTURE_TIME,
    },
    create: {
      id: COMMUNITY.postId,
      threadId: thread.id,
      authorId: authorProfileId,
      body: "A deterministic local-only discussion fixture used to verify both forum and groups detail routes.",
      editedAt: null,
      createdAt: FIXTURE_TIME,
    },
  });

  return { category, thread };
}

async function resolveProviderRouteSamples(tx: DbContextClient) {
  const samples = await findDemoProviderRouteSamples(tx);
  if (!samples) {
    throw new Error(
      "demo_fixtures.provider_samples_missing: load approved provider data before private fixtures",
    );
  }
  return samples;
}

async function loadDemoAccount(
  tx: DbContextClient,
  account: (typeof DEMO_FIXTURE_MANIFEST.accounts)[number],
) {
  const user = await tx.user.findUnique({
    where: { id: account.userId },
    include: { profile: true },
  });
  if (
    !user?.profile ||
    user.email !== account.email ||
    user.name !== account.displayName ||
    user.subscriptionTier !== account.tier ||
    user.profile.id !== account.profileId ||
    user.profile.displayName !== account.displayName ||
    user.profile.role !== account.role ||
    user.profile.verified !== account.verified ||
    user.profile.avatarUrl !== account.avatarUrl ||
    user.isBanned ||
    user.deletionRequestedAt
  ) {
    throw new Error(`demo_fixtures.identity_invalid: ${account.userId}`);
  }
  return { ...user, profile: user.profile };
}

export async function seedDemoRouteFixtures() {
  assertDemoTarget();
  assertDemoFixtureManifest();
  const pageMediaAssets = await validateDemoPageMediaAssets();

  const fixtures = await withDbSystemContext(async (tx) => {
    await ensureDemoIdentities(tx);
    const [admin, peer, freeMember, proPlusMember] = await Promise.all([
      loadDemoAccount(tx, ADMIN_ACCOUNT),
      loadDemoAccount(tx, PEER_ACCOUNT),
      loadDemoAccount(tx, FREE_ACCOUNT),
      loadDemoAccount(tx, PRO_PLUS_ACCOUNT),
    ]);

    const [adminActor, peerActor, freeActor, proPlusActor] = await Promise.all([
      ensurePersonalActor(tx, admin.profile, ADMIN_ACCOUNT),
      ensurePersonalActor(tx, peer.profile, PEER_ACCOUNT),
      ensurePersonalActor(tx, freeMember.profile, FREE_ACCOUNT),
      ensurePersonalActor(tx, proPlusMember.profile, PRO_PLUS_ACCOUNT),
    ]);
    await setDbRequestContext(tx, {
      dbUserId: admin.id,
      profileId: admin.profile.id,
      profileRole: "admin",
      tier: "pro_plus",
    });
    const providerRoutes = await resolveProviderRouteSamples(tx);
    const communityRoutes = await ensureCommunityFixtures(tx, admin.profile.id);

    const friendshipPair =
      admin.profile.id < peer.profile.id
        ? { profileAId: admin.profile.id, profileBId: peer.profile.id }
        : { profileAId: peer.profile.id, profileBId: admin.profile.id };
    const friendshipCollisions = await tx.friendship.findMany({
      where: {
        OR: [{ id: DEMO_FIXTURE_MANIFEST.friendship.id }, friendshipPair],
      },
    });
    if (
      friendshipCollisions.length > 1 ||
      friendshipCollisions.some(
        (friendship) =>
          friendship.id !== DEMO_FIXTURE_MANIFEST.friendship.id ||
          friendship.profileAId !== friendshipPair.profileAId ||
          friendship.profileBId !== friendshipPair.profileBId,
      )
    ) {
      throw new Error("demo_fixtures.friendship_collision");
    }
    await tx.friendship.upsert({
      where: { id: DEMO_FIXTURE_MANIFEST.friendship.id },
      update: {
        ...friendshipPair,
        status: "accepted",
        requestedByProfileId: admin.profile.id,
        createdAt: FIXTURE_TIME,
      },
      create: {
        id: DEMO_FIXTURE_MANIFEST.friendship.id,
        ...friendshipPair,
        status: "accepted",
        requestedByProfileId: admin.profile.id,
        createdAt: FIXTURE_TIME,
      },
    });

    const pageCollisions = await tx.customPage.findMany({
      where: { OR: [{ id: PAGE.id }, { handle: PAGE.handle }] },
    });
    if (
      pageCollisions.length > 1 ||
      pageCollisions.some(
        (page) =>
          page.id !== PAGE.id ||
          page.handle !== PAGE.handle ||
          page.ownerProfileId !== admin.profile.id,
      )
    ) {
      throw new Error("demo_fixtures.page_collision");
    }
    const pageData = {
      ownerProfileId: admin.profile.id,
      pageType: "business",
      handle: PAGE.handle,
      title: "GreyhoundIQ Demo Control Room",
      tagline: "Australian greyhound racing intelligence, ready to explore.",
      about: "A safe, fully authenticated demonstration workspace for GreyhoundIQ.",
      businessCategory: "other",
      contactEmail: null,
      contactPhone: null,
      website: null,
      accentColor: "#A127CE",
      heroMediaId: null,
      dogId: null,
      saleStatus: null,
      priceOrFee: null,
      contentJson: DEMO_PAGE_CONTENT,
      published: true,
      moderationStatus: "approved",
      bespoke: true,
      views: 0,
      createdAt: FIXTURE_TIME,
    } as const;
    const page = await tx.customPage.upsert({
      where: { id: PAGE.id },
      update: pageData,
      create: {
        id: PAGE.id,
        ...pageData,
      },
    });

    const pageActorCollisions = await tx.socialActor.findMany({
      where: {
        OR: [{ id: PAGE.actorId }, { pageId: page.id }, { handle: PAGE.handle }],
      },
    });
    if (
      pageActorCollisions.length > 1 ||
      pageActorCollisions.some(
        (actor) =>
          actor.id !== PAGE.actorId ||
          actor.kind !== "page" ||
          actor.profileId !== null ||
          actor.pageId !== page.id ||
          actor.ownerProfileId !== admin.profile.id ||
          actor.handle !== PAGE.handle,
      )
    ) {
      throw new Error("demo_fixtures.page_actor_collision");
    }
    const pageActorData = {
      kind: "page",
      profileId: null,
      pageId: page.id,
      ownerProfileId: admin.profile.id,
      handle: PAGE.handle,
      displayName: page.title,
      avatarUrl: DEMO_CONTROL_ROOM_AVATAR,
      avatarFocalX: 0.5,
      avatarFocalY: 0.5,
      avatarZoom: 1,
      avatarRotation: 0,
      coverUrl: null,
      coverFocalX: 0.5,
      coverFocalY: 0.5,
      coverZoom: 1,
      coverRotation: 0,
      profileVisibility: "public",
      contactVisibility: "only_me",
      published: true,
      createdAt: FIXTURE_TIME,
    } as const;
    const pageActor = await tx.socialActor.upsert({
      where: { id: PAGE.actorId },
      update: pageActorData,
      create: {
        id: PAGE.actorId,
        ...pageActorData,
      },
    });

    for (const asset of pageMediaAssets) {
      const storagePath = `site/demo-control-room/${path.basename(asset.publicUrl)}`;
      const collisions = await tx.mediaAsset.findMany({
        where: {
          OR: [{ id: asset.id }, { storageBucket: SITE_ASSETS_BUCKET, storagePath }],
        },
      });
      if (
        collisions.length > 1 ||
        collisions.some(
          (media) =>
            media.id !== asset.id ||
            media.uploaderId !== admin.id ||
            media.storageBucket !== SITE_ASSETS_BUCKET ||
            media.storagePath !== storagePath ||
            media.linkedEntityType !== "custom_page" ||
            media.linkedEntityId !== page.id,
        )
      ) {
        throw new Error(`demo_fixtures.page_media_collision: ${asset.id}`);
      }
      const mediaData = {
        uploaderId: admin.id,
        storageBucket: SITE_ASSETS_BUCKET,
        storagePath,
        publicUrl: asset.publicUrl,
        mediaType: "image",
        originalName: path.basename(asset.publicUrl),
        mimeType: "image/webp",
        sizeBytes: asset.sizeBytes,
        widthPx: asset.width,
        heightPx: asset.height,
        durationSec: null,
        linkedEntityType: "custom_page",
        linkedEntityId: page.id,
        scanStatus: "clean",
        scanCompletedAt: FIXTURE_TIME,
        processingStatus: "ready",
        processingError: null,
        processingAttempts: 0,
        processingStartedAt: null,
        processingCompletedAt: FIXTURE_TIME,
        playbackPath: null,
        posterPath: null,
        hlsPath: null,
        waveformJson: null,
        metadataJson: null,
        altText: asset.altText,
        captionPath: null,
        sha256: asset.sha256,
        expiresAt: null,
        deletedAt: null,
        createdAt: FIXTURE_TIME,
      } as const;
      await tx.mediaAsset.upsert({
        where: { id: asset.id },
        update: mediaData,
        create: {
          id: asset.id,
          ...mediaData,
        },
      });
    }
    const galleryMediaIds: string[] = pageMediaAssets.map((asset) => asset.id);
    const galleryCollisions = await tx.actorGalleryMedia.findMany({
      where: {
        OR: [
          { actorId: pageActor.id },
          { mediaId: { in: galleryMediaIds } },
        ],
      },
    });
    if (
      galleryCollisions.length > galleryMediaIds.length ||
      galleryCollisions.some(
        (entry) =>
          entry.actorId !== pageActor.id ||
          !galleryMediaIds.includes(entry.mediaId) ||
          entry.position !== galleryMediaIds.indexOf(entry.mediaId),
      )
    ) {
      throw new Error("demo_fixtures.gallery_collision");
    }
    await Promise.all(
      pageMediaAssets.map((asset, position) =>
        tx.actorGalleryMedia.upsert({
          where: {
            actorId_mediaId: { actorId: pageActor.id, mediaId: asset.id },
          },
          update: { position, altText: asset.altText, createdAt: FIXTURE_TIME },
          create: {
            actorId: pageActor.id,
            mediaId: asset.id,
            position,
            altText: asset.altText,
            createdAt: FIXTURE_TIME,
          },
        }),
      ),
    );

    const [participantA, participantB] =
      admin.profile.id < peer.profile.id
        ? [
            { profile: admin.profile, actor: adminActor },
            { profile: peer.profile, actor: peerActor },
          ]
        : [
            { profile: peer.profile, actor: peerActor },
            { profile: admin.profile, actor: adminActor },
          ];
    const pair = {
      participantAId: participantA.profile.id,
      participantAActorId: participantA.actor.id,
      participantBId: participantB.profile.id,
      participantBActorId: participantB.actor.id,
    };
    const conversationCollisions = await tx.conversation.findMany({
      where: { OR: [{ id: CONVERSATION.id }, pair] },
    });
    if (
      conversationCollisions.length > 1 ||
      conversationCollisions.some(
        (candidate) =>
          candidate.id !== CONVERSATION.id ||
          candidate.participantAId !== pair.participantAId ||
          candidate.participantAActorId !== pair.participantAActorId ||
          candidate.participantBId !== pair.participantBId ||
          candidate.participantBActorId !== pair.participantBActorId,
      )
    ) {
      throw new Error("demo_fixtures.conversation_collision");
    }
    const conversation = await tx.conversation.upsert({
      where: { id: CONVERSATION.id },
      update: {
        ...pair,
        lastMessageAt: FIXTURE_TIME,
        blockedById: null,
        blockedAt: null,
        createdAt: FIXTURE_TIME,
      },
      create: {
        id: CONVERSATION.id,
        ...pair,
        lastMessageAt: FIXTURE_TIME,
        createdAt: FIXTURE_TIME,
      },
    });

    await Promise.all([participantA, participantB].map(async ({ profile, actor }) => {
      const participantId =
        profile.id === admin.profile.id
          ? CONVERSATION.participantIds[0]
          : CONVERSATION.participantIds[1];
      const collisions = await tx.conversationParticipant.findMany({
        where: {
          OR: [
            { id: participantId },
            { conversationId: conversation.id, profileId: profile.id },
          ],
        },
      });
      if (
        collisions.length > 1 ||
        collisions.some(
          (participant) =>
            participant.id !== participantId ||
            participant.conversationId !== conversation.id ||
            participant.profileId !== profile.id,
        )
      ) {
        throw new Error(`demo_fixtures.conversation_participant_collision: ${participantId}`);
      }
      await tx.conversationParticipant.upsert({
        where: { id: participantId },
        update: {
          conversationId: conversation.id,
          profileId: profile.id,
          actorId: actor.id,
          role: "member",
          joinedAt: FIXTURE_TIME,
          lastReadMessageId: null,
          mutedAt: null,
          archivedAt: null,
          createdAt: FIXTURE_TIME,
        },
        create: {
          id: participantId,
          conversationId: conversation.id,
          profileId: profile.id,
          actorId: actor.id,
          role: "member",
          joinedAt: FIXTURE_TIME,
          createdAt: FIXTURE_TIME,
        },
      });
    }));
    const messageCollision = await tx.message.findUnique({
      where: { id: CONVERSATION.messageId },
    });
    if (
      messageCollision &&
      (messageCollision.conversationId !== conversation.id ||
        messageCollision.senderId !== admin.profile.id ||
        messageCollision.senderActorId !== adminActor.id ||
        messageCollision.recipientId !== peer.profile.id ||
        messageCollision.recipientActorId !== peerActor.id)
    ) {
      throw new Error("demo_fixtures.message_collision");
    }
    const messageData = {
      conversationId: conversation.id,
      senderId: admin.profile.id,
      senderActorId: adminActor.id,
      recipientId: peer.profile.id,
      recipientActorId: peerActor.id,
      body: "Welcome to the GreyhoundIQ interactive demo conversation.",
      mediaIdsJson: null,
      read: false,
      readAt: null,
      deletedBySenderAt: null,
      deletedByRecipientAt: null,
      createdAt: FIXTURE_TIME,
    } as const;
    await tx.message.upsert({
      where: { id: CONVERSATION.messageId },
      update: messageData,
      create: {
        id: CONVERSATION.messageId,
        ...messageData,
      },
    });

    const listingCollision = await tx.listing.findUnique({
      where: { id: LISTING.id },
    });
    if (listingCollision && listingCollision.profileId !== admin.profile.id) {
      throw new Error("demo_fixtures.listing_collision");
    }
    const listingData = {
      profileId: admin.profile.id,
      categoryId: null,
      type: "wanted",
      listingType: "wanted",
      title: "GreyhoundIQ Demo Racing Toolkit",
      description: "Demo-only marketplace record for the interactive GreyhoundIQ walkthrough.",
      price: 490,
      currency: "AUD",
      negotiable: true,
      condition: "new",
      contactPreference: "message",
      state: "NSW",
      dogId: null,
      sireDogId: null,
      damDogId: null,
      imageUrl: null,
      status: "active",
      moderationStatus: "approved",
      moderationReason: null,
      reportCount: 0,
      reviewedById: admin.profile.id,
      reviewedAt: FIXTURE_TIME,
      greyhoundName: null,
      greyhoundEarbrand: null,
      greyhoundMicrochip: null,
      greyhoundWhelpedAt: null,
      greyhoundSex: null,
      greyhoundColor: null,
      welfareAcknowledgedAt: FIXTURE_TIME,
      legalAcknowledgedAt: FIXTURE_TIME,
      itemBrand: null,
      itemModel: null,
      itemCondition: null,
      itemSerialOrIdentifier: null,
      expiresAt: new Date("2099-12-31T00:00:00.000Z"),
      soldAt: null,
      archivedAt: null,
      views: 0,
      createdAt: FIXTURE_TIME,
    } as const;
    const listing = await tx.listing.upsert({
      where: { id: LISTING.id },
      update: listingData,
      create: {
        id: LISTING.id,
        ...listingData,
      },
    });
    const locationCollisions = await tx.listingLocation.findMany({
      where: { OR: [{ id: LISTING.locationId }, { listingId: listing.id }] },
    });
    if (
      locationCollisions.length > 1 ||
      locationCollisions.some(
        (location) =>
          location.id !== LISTING.locationId || location.listingId !== listing.id,
      )
    ) {
      throw new Error("demo_fixtures.listing_location_collision");
    }
    await tx.listingLocation.upsert({
      where: { id: LISTING.locationId },
      update: {
        listingId: listing.id,
        state: "NSW",
        region: "Illawarra",
        suburb: "Wollongong",
        postcode: "2500",
        latitude: null,
        longitude: null,
        createdAt: FIXTURE_TIME,
      },
      create: {
        id: LISTING.locationId,
        listingId: listing.id,
        state: "NSW",
        region: "Illawarra",
        suburb: "Wollongong",
        postcode: "2500",
        createdAt: FIXTURE_TIME,
      },
    });
    await tx.listingSearchIndex.upsert({
      where: { listingId: listing.id },
      update: {
        searchText: "greyhoundiq demo racing toolkit wollongong illawarra nsw wanted",
      },
      create: {
        listingId: listing.id,
        searchText: "greyhoundiq demo racing toolkit wollongong illawarra nsw wanted",
      },
    });
    const historyCollision = await tx.listingStatusHistory.findUnique({
      where: { id: LISTING.historyId },
    });
    if (
      historyCollision &&
      (historyCollision.listingId !== listing.id ||
        historyCollision.actorProfileId !== admin.profile.id ||
        historyCollision.fromStatus !== null ||
        historyCollision.toStatus !== "active" ||
        historyCollision.reason !== "Approved demo fixture" ||
        historyCollision.createdAt.getTime() !== FIXTURE_TIME.getTime())
    ) {
      throw new Error("demo_fixtures.listing_history_collision");
    }
    if (!historyCollision) {
      await tx.listingStatusHistory.create({
        data: {
          id: LISTING.historyId,
          listingId: listing.id,
          fromStatus: null,
          toStatus: "active",
          actorProfileId: admin.profile.id,
          reason: "Approved demo fixture",
          createdAt: FIXTURE_TIME,
        },
      });
    }

    return {
      admin,
      adminActor,
      demoProfileActors: [adminActor, peerActor, freeActor, proPlusActor],
      page,
      pageActor,
      conversation,
      listing,
      publicRoutes: { ...providerRoutes, ...communityRoutes },
    };
  });

  const viewer: DbContextUser = {
    dbUserId: fixtures.admin.id,
    profileId: fixtures.admin.profile!.id,
    profileRole: "admin",
    tier: "pro_plus",
  };
  const [actorView, pageView, pageMediaView, conversationView, listingView] = await Promise.all([
    getSocialActorProfileByHandle(fixtures.pageActor.handle, viewer),
    getPublishedCustomPageByHandle(fixtures.page.handle),
    resolveCustomPageMedia(fixtures.page.contentJson, fixtures.pageActor.id),
    getConversationForProfile(viewer, fixtures.conversation.id),
    getListingForViewerById(fixtures.listing.id, {
      profileId: viewer.profileId,
      role: viewer.profileRole,
    }),
  ]);
  if (!actorView || !pageView || conversationView.id !== fixtures.conversation.id) {
    throw new Error("demo_fixtures.route_resolution_failed");
  }
  if (
    !pageMediaView.avatarUrl ||
    !pageMediaView.bannerUrl ||
    !pageMediaView.logoUrl ||
    pageMediaView.galleryUrls.length !== 3
  ) {
    throw new Error("demo_fixtures.page_media_resolution_failed");
  }
  if (
    listingView.id !== fixtures.listing.id ||
    listingView.status !== "active" ||
    listingView.moderationStatus !== "approved"
  ) {
    throw new Error("demo_fixtures.listing_resolution_failed");
  }

  return {
    personalActor: {
      id: fixtures.adminActor.id,
      handle: fixtures.adminActor.handle,
    },
    demoProfileActors: fixtures.demoProfileActors.map((actor) => ({
      id: actor.id,
      handle: actor.handle,
      avatarUrl: actor.avatarUrl,
    })),
    customPage: { id: fixtures.page.id, handle: fixtures.page.handle },
    customPageMedia: {
      avatar: pageMediaView.avatarUrl,
      banner: pageMediaView.bannerUrl,
      logo: pageMediaView.logoUrl,
      galleryCount: pageMediaView.galleryUrls.length,
    },
    conversation: { id: fixtures.conversation.id },
    listing: { id: fixtures.listing.id },
    publicRoutes: {
      dogId: fixtures.publicRoutes.dog.id,
      meetingId: fixtures.publicRoutes.meeting.id,
      raceId: fixtures.publicRoutes.race.id,
      trackId: fixtures.publicRoutes.track.id,
      categorySlug: fixtures.publicRoutes.category.slug,
      threadId: fixtures.publicRoutes.thread.id,
    },
    routes: [
      DEMO_PROVIDER_ROUTE_PATHS.dog,
      DEMO_PROVIDER_ROUTE_PATHS.meeting,
      DEMO_PROVIDER_ROUTE_PATHS.race,
      DEMO_PROVIDER_ROUTE_PATHS.track,
      `/forum/${fixtures.publicRoutes.category.slug}`,
      `/forum/threads/${fixtures.publicRoutes.thread.id}`,
      `/groups/${fixtures.publicRoutes.category.slug}`,
      `/groups/threads/${fixtures.publicRoutes.thread.id}`,
      `/p/${fixtures.page.handle}`,
      `/messages/${fixtures.conversation.id}`,
      `/pulse/${fixtures.conversation.id}`,
      `/listings/${fixtures.listing.id}`,
      `/marketplace/${fixtures.listing.id}`,
    ],
  };
}

async function main() {
  console.log(JSON.stringify(await seedDemoRouteFixtures(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
