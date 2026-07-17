import { Prisma } from "@prisma/client";

import type { CurrentUserProfile } from "@/lib/auth-types";
import { withDbRequestContext, type DbContextClient } from "@/lib/db-context";
import {
  assertUserExportCollections,
  USER_EXPORT_COLLECTION_LIMIT,
  USER_EXPORT_NESTED_COLLECTION_LIMIT,
} from "@/lib/user-export-policy";

const COLLECTION_TAKE = USER_EXPORT_COLLECTION_LIMIT + 1;
const NESTED_COLLECTION_TAKE = USER_EXPORT_NESTED_COLLECTION_LIMIT + 1;

const SAFE_MEDIA_SELECT = {
  originalName: true,
  mediaType: true,
  mimeType: true,
  sizeBytes: true,
  widthPx: true,
  heightPx: true,
  durationSec: true,
  scanStatus: true,
  scanCompletedAt: true,
  processingStatus: true,
  altText: true,
  expiresAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ExportMediaRow = {
  parentId: string;
  position: number;
  linkCreatedAt: Date;
  originalName: string | null;
  mediaType: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  durationSec: number | null;
  scanStatus: string;
  scanCompletedAt: Date | null;
  processingStatus: string;
  altText: string | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
  mediaCreatedAt: Date;
  mediaUpdatedAt: Date;
};

type ExportMediaLink = {
  position: number;
  createdAt: Date;
  media: {
    originalName: string | null;
    mediaType: string;
    mimeType: string;
    sizeBytes: number;
    widthPx: number | null;
    heightPx: number | null;
    durationSec: number | null;
    scanStatus: string;
    scanCompletedAt: Date | null;
    processingStatus: string;
    altText: string | null;
    expiresAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

export async function readUserExportData(current: CurrentUserProfile) {
  return withDbRequestContext(current, async (tx) => {
    const [
      user,
      profile,
      dogOwnerships,
      threads,
      posts,
      listingRows,
      conversations,
      sentRows,
      receivedRows,
      mediaAssets,
      memoryEntries,
      agentRuns,
    ] = await Promise.all([
      tx.user.findUnique({
        where: { id: current.dbUserId },
        select: {
          email: true,
          name: true,
          subscriptionTier: true,
          isBanned: true,
          deletionRequestedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      tx.profile.findUnique({
        where: { id: current.profileId },
        select: {
          displayName: true,
          bio: true,
          state: true,
          kennelName: true,
          kennelPrefix: true,
          role: true,
          verified: true,
          website: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      tx.dogOwnership.findMany({
        where: { profileId: current.profileId },
        take: Math.min(Math.max(1, COLLECTION_TAKE), 5_000),
        orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
        select: {
          role: true,
          verified: true,
          status: true,
          evidence: true,
          reviewedAt: true,
          rejectionReason: true,
          createdAt: true,
          dog: {
            select: {
              name: true,
              earBrand: true,
              colour: true,
              sex: true,
              whelpDate: true,
            },
          },
        },
      }),
      tx.thread.findMany({
        where: { authorId: current.profileId },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, COLLECTION_TAKE), 5_000),
        select: {
          title: true,
          pinned: true,
          locked: true,
          views: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: { name: true, slug: true, description: true },
          },
          _count: { select: { posts: true } },
        },
      }),
      tx.post.findMany({
        where: { authorId: current.profileId },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, COLLECTION_TAKE), 5_000),
        select: {
          body: true,
          editedAt: true,
          createdAt: true,
          thread: {
            select: {
              title: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      }),
      tx.listing.findMany({
        where: { profileId: current.profileId },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, COLLECTION_TAKE), 5_000),
        select: {
          id: true,
          type: true,
          listingType: true,
          title: true,
          description: true,
          price: true,
          currency: true,
          negotiable: true,
          condition: true,
          contactPreference: true,
          state: true,
          status: true,
          moderationStatus: true,
          moderationReason: true,
          greyhoundName: true,
          greyhoundEarbrand: true,
          greyhoundMicrochip: true,
          greyhoundWhelpedAt: true,
          greyhoundSex: true,
          greyhoundColor: true,
          welfareAcknowledgedAt: true,
          legalAcknowledgedAt: true,
          itemBrand: true,
          itemModel: true,
          itemCondition: true,
          itemSerialOrIdentifier: true,
          expiresAt: true,
          soldAt: true,
          archivedAt: true,
          views: true,
          createdAt: true,
          updatedAt: true,
          dog: {
            select: { name: true, earBrand: true, colour: true, sex: true },
          },
        },
      }),
      tx.conversation.findMany({
        where: {
          OR: [
            { participantAId: current.profileId },
            { participantBId: current.profileId },
          ],
        },
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        take: Math.min(Math.max(1, COLLECTION_TAKE), 5_000),
        select: {
          lastMessageAt: true,
          blockedAt: true,
          createdAt: true,
          updatedAt: true,
          participantA: { select: { displayName: true } },
          participantB: { select: { displayName: true } },
        },
      }),
      tx.message.findMany({
        where: { senderId: current.profileId },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, COLLECTION_TAKE), 5_000),
        select: {
          id: true,
          body: true,
          read: true,
          readAt: true,
          deletedBySenderAt: true,
          deletedByRecipientAt: true,
          createdAt: true,
          recipient: { select: { displayName: true } },
        },
      }),
      tx.message.findMany({
        where: { recipientId: current.profileId },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, COLLECTION_TAKE), 5_000),
        select: {
          id: true,
          body: true,
          read: true,
          readAt: true,
          deletedBySenderAt: true,
          deletedByRecipientAt: true,
          createdAt: true,
          sender: { select: { displayName: true } },
        },
      }),
      tx.mediaAsset.findMany({
        where: { uploaderId: current.dbUserId },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, COLLECTION_TAKE), 5_000),
        select: SAFE_MEDIA_SELECT,
      }),
      tx.memoryEntry.findMany({
        where: { userId: current.dbUserId },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, COLLECTION_TAKE), 5_000),
        select: {
          kind: true,
          content: true,
          source: true,
          importance: true,
          lastAccessedAt: true,
          lastMaintainedAt: true,
          accessCount: true,
          supersededAt: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      tx.agentRun.findMany({
        where: { userId: current.dbUserId },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, COLLECTION_TAKE), 5_000),
        select: {
          agentType: true,
          status: true,
          durationMs: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);

    assertUserExportCollections({
      dogOwnerships,
      threads,
      posts,
      listings: listingRows,
      conversations,
      messagesSent: sentRows,
      messagesReceived: receivedRows,
      mediaAssets,
      memoryEntries,
      agentRuns,
    });

    const [listingMedia, sentMedia, receivedMedia] = await Promise.all([
      readBoundedListingMedia(
        tx,
        listingRows.map((listing) => listing.id),
      ),
      readBoundedMessageMedia(
        tx,
        sentRows.map((message) => message.id),
      ),
      readBoundedMessageMedia(
        tx,
        receivedRows.map((message) => message.id),
      ),
    ]);
    const listingMediaByParent = groupMediaByParent(listingMedia);
    const sentMediaByParent = groupMediaByParent(sentMedia);
    const receivedMediaByParent = groupMediaByParent(receivedMedia);

    assertNestedMediaBounds([
      ...listingMediaByParent.values(),
      ...sentMediaByParent.values(),
      ...receivedMediaByParent.values(),
    ]);

    return {
      user,
      profile: profile ? { ...profile, dogsOwned: dogOwnerships } : null,
      threads,
      posts,
      listings: listingRows.map(({ id, ...listing }) => ({
        ...listing,
        media: listingMediaByParent.get(id) ?? [],
      })),
      conversations,
      messagesSent: sentRows.map(({ id, ...message }) => ({
        ...message,
        media: sentMediaByParent.get(id) ?? [],
      })),
      messagesReceived: receivedRows.map(({ id, ...message }) => ({
        ...message,
        media: receivedMediaByParent.get(id) ?? [],
      })),
      mediaAssets,
      memoryEntries,
      agentRuns,
    };
  });
}

function readBoundedListingMedia(tx: DbContextClient, listingIds: string[]) {
  if (listingIds.length === 0) return Promise.resolve<ExportMediaRow[]>([]);
  const values = Prisma.join(
    listingIds.map((listingId) => Prisma.sql`(${listingId})`),
  );
  return tx.$queryRaw<ExportMediaRow[]>(Prisma.sql`
    SELECT
      bounded."parentId",
      bounded.position,
      bounded."linkCreatedAt",
      bounded."originalName",
      bounded."mediaType",
      bounded."mimeType",
      bounded."sizeBytes",
      bounded."widthPx",
      bounded."heightPx",
      bounded."durationSec",
      bounded."scanStatus",
      bounded."scanCompletedAt",
      bounded."processingStatus",
      bounded."altText",
      bounded."expiresAt",
      bounded."deletedAt",
      bounded."mediaCreatedAt",
      bounded."mediaUpdatedAt"
    FROM (VALUES ${values}) AS selected("parentId")
    CROSS JOIN LATERAL (
      SELECT
        lm."listingId" AS "parentId",
        lm.position,
        lm."createdAt" AS "linkCreatedAt",
        media."originalName",
        media."mediaType",
        media."mimeType",
        media."sizeBytes",
        media."widthPx",
        media."heightPx",
        media."durationSec",
        media."scanStatus",
        media."scanCompletedAt",
        media."processingStatus",
        media."altText",
        media."expiresAt",
        media."deletedAt",
        media."createdAt" AS "mediaCreatedAt",
        media."updatedAt" AS "mediaUpdatedAt"
      FROM "ListingMedia" AS lm
      INNER JOIN "MediaAsset" AS media ON media.id = lm."mediaId"
      WHERE lm."listingId" = selected."parentId"
      ORDER BY lm.position ASC, lm."mediaId" ASC
      LIMIT ${NESTED_COLLECTION_TAKE}
    ) AS bounded
    ORDER BY bounded."parentId" ASC, bounded.position ASC
  `);
}

function readBoundedMessageMedia(tx: DbContextClient, messageIds: string[]) {
  if (messageIds.length === 0) return Promise.resolve<ExportMediaRow[]>([]);
  const values = Prisma.join(
    messageIds.map((messageId) => Prisma.sql`(${messageId})`),
  );
  return tx.$queryRaw<ExportMediaRow[]>(Prisma.sql`
    SELECT
      bounded."parentId",
      bounded.position,
      bounded."linkCreatedAt",
      bounded."originalName",
      bounded."mediaType",
      bounded."mimeType",
      bounded."sizeBytes",
      bounded."widthPx",
      bounded."heightPx",
      bounded."durationSec",
      bounded."scanStatus",
      bounded."scanCompletedAt",
      bounded."processingStatus",
      bounded."altText",
      bounded."expiresAt",
      bounded."deletedAt",
      bounded."mediaCreatedAt",
      bounded."mediaUpdatedAt"
    FROM (VALUES ${values}) AS selected("parentId")
    CROSS JOIN LATERAL (
      SELECT
        mm."messageId" AS "parentId",
        mm.position,
        mm."createdAt" AS "linkCreatedAt",
        media."originalName",
        media."mediaType",
        media."mimeType",
        media."sizeBytes",
        media."widthPx",
        media."heightPx",
        media."durationSec",
        media."scanStatus",
        media."scanCompletedAt",
        media."processingStatus",
        media."altText",
        media."expiresAt",
        media."deletedAt",
        media."createdAt" AS "mediaCreatedAt",
        media."updatedAt" AS "mediaUpdatedAt"
      FROM "MessageMedia" AS mm
      INNER JOIN "MediaAsset" AS media ON media.id = mm."mediaId"
      WHERE mm."messageId" = selected."parentId"
      ORDER BY mm.position ASC, mm."mediaId" ASC
      LIMIT ${NESTED_COLLECTION_TAKE}
    ) AS bounded
    ORDER BY bounded."parentId" ASC, bounded.position ASC
  `);
}

function groupMediaByParent(rows: ExportMediaRow[]) {
  const grouped = new Map<string, ExportMediaLink[]>();
  for (const row of rows) {
    const links = grouped.get(row.parentId) ?? [];
    links.push({
      position: row.position,
      createdAt: row.linkCreatedAt,
      media: {
        originalName: row.originalName,
        mediaType: row.mediaType,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        widthPx: row.widthPx,
        heightPx: row.heightPx,
        durationSec: row.durationSec,
        scanStatus: row.scanStatus,
        scanCompletedAt: row.scanCompletedAt,
        processingStatus: row.processingStatus,
        altText: row.altText,
        expiresAt: row.expiresAt,
        deletedAt: row.deletedAt,
        createdAt: row.mediaCreatedAt,
        updatedAt: row.mediaUpdatedAt,
      },
    });
    grouped.set(row.parentId, links);
  }
  return grouped;
}

function assertNestedMediaBounds(collections: readonly ExportMediaLink[][]) {
  for (const collection of collections) {
    if (collection.length > USER_EXPORT_NESTED_COLLECTION_LIMIT) {
      throw new Error("export.too_large");
    }
  }
}
