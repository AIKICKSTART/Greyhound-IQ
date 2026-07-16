import {
  withDbRequestContext,
  withDbSystemContext,
  type DbContextClient,
} from "@/lib/db-context";
import type { CurrentUserProfile } from "@/lib/auth-types";
import {
  assertLastAdminAccessChange,
  lockAdminAccessChanges,
} from "@/lib/admin-access-contract";
import {
  PRIVATE_USER_MEDIA_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
  type ObjectStorageBucket,
} from "@/lib/storage-paths";
import { objectStorage } from "@/lib/object-storage";

const ACCOUNT_DELETION_GRACE_DAYS = 30;
const DELETED_EMAIL_DOMAIN = "deleted.greyhoundiq.local";
const DELETION_REQUEST_EMAIL_PREFIX = "deletion-requested";
const DELETED_PROFILE_NAME = "Deleted user";
const DELETED_THREAD_TITLE = "Deleted thread";
const DELETED_POST_BODY = "This post was removed after account deletion.";
const DELETED_MESSAGE_BODY = "This message was removed after account deletion.";
const DELETED_LISTING_TITLE = "Deleted listing";
const DELETED_LISTING_DESCRIPTION =
  "This listing was removed after account deletion.";
const DELETED_MEMORY_CONTENT = "Account memory removed after account deletion.";
const ACCOUNT_STORAGE_DELETION_TARGET = "user_storage_prefix";
const ACCOUNT_DELETION_USER_LIMIT = 25;
const ACCOUNT_DELETION_CONTENT_BATCH_LIMIT = 100;
const STORAGE_DELETION_JOB_LIMIT = 10;
const STORAGE_DELETION_OBJECT_LIMIT = 500;
const STORAGE_DELETION_LEASE_MS = 15 * 60 * 1000;
const USER_EXPORT_ARTIFACT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface AuditInput {
  actorId?: string | null;
  actorType: "user" | "agent" | "system" | "admin";
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UserExportCompletionInput {
  exportedAt: Date;
  sizeBytes: number;
  schemaVersion: "greyhoundiq-user-export/v2";
  ip?: string | null;
  userAgent?: string | null;
  counts: {
    threads: number;
    posts: number;
    listings: number;
    conversations: number;
    messagesSent: number;
    messagesReceived: number;
    mediaAssets: number;
    memoryEntries: number;
    agentRuns: number;
  };
}

export interface AccountDeletionMaintenanceResult {
  finalizedCount: number;
  messagesScrubbed: number;
  postsScrubbed: number;
  threadsScrubbed: number;
  listingsArchived: number;
  mediaTombstoned: number;
  storageDeletionJobsQueued: number;
  storageDeletionJobsCompleted: number;
  storageDeletionJobsFailed: number;
  storageObjectsDeleted: number;
  remoteProviderReferencesRetained: number;
  memoriesDeleted: number;
  contextsDeleted: number;
  agentRunsScrubbed: number;
  ranAt: string;
  cutoff: string;
}

export async function createAuditLog(input: AuditInput) {
  // createMany emits no RETURNING clause, so the insert never depends on the
  // AuditLog SELECT policy — audit writes succeed regardless of RLS context.
  return withDbSystemContext((tx) => insertAuditLog(tx, input));
}

export async function recordUserExportCompletion(
  current: CurrentUserProfile,
  input: UserExportCompletionInput
) {
  return withDbRequestContext(current, async (tx) => {
    await insertAuditLog(tx, {
      actorId: current.dbUserId,
      actorType: "user",
      action: "user.export",
      targetType: "user",
      targetId: current.dbUserId,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: {
        format: "json",
        schemaVersion: input.schemaVersion,
        sizeBytes: input.sizeBytes,
        counts: input.counts,
      },
    });

    return tx.exportArtifact.create({
      data: {
        exportType: "user_data",
        status: "completed",
        targetUserId: current.dbUserId,
        requestedByUserId: current.dbUserId,
        sizeBytes: input.sizeBytes,
        completedAt: input.exportedAt,
        expiresAt: new Date(
          input.exportedAt.getTime() + USER_EXPORT_ARTIFACT_TTL_MS
        ),
      },
    });
  });
}

function insertAuditLog(tx: DbContextClient, input: AuditInput) {
  return tx.auditLog.createMany({
    data: {
      actorId: input.actorId ?? null,
      actorType: input.actorType,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function requestAccountDeletion(
  current: CurrentUserProfile,
  meta: { ip?: string | null; userAgent?: string | null } = {}
) {
  const requestedAt = new Date();

  await withDbRequestContext(current, async (tx) => {
    await lockAdminAccessChanges(tx);
    const target = await tx.user.findUnique({
      where: { id: current.dbUserId },
      select: {
        isBanned: true,
        deletionRequestedAt: true,
        profile: { select: { role: true } },
      },
    });
    if (target?.profile?.role === "admin") {
      const activeAdminCount = await tx.profile.count({
        where: {
          role: "admin",
          user: { isBanned: false, deletionRequestedAt: null },
        },
      });
      assertLastAdminAccessChange({
        targetCurrentRole: target.profile.role,
        targetCurrentlyActive:
          !target.isBanned && target.deletionRequestedAt === null,
        nextRole: target.profile.role,
        nextBanned: true,
        activeAdminCount,
      });
    }
    await tx.user.update({
      where: { id: current.dbUserId },
      data: {
        email: deletionRequestEmailForUser(current.dbUserId),
        isBanned: true,
        deletionRequestedAt: requestedAt,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.dbUserId,
        actorType: "user",
        action: "user.delete",
        targetType: "user",
        targetId: current.dbUserId,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        metadata: JSON.stringify({
          status: "requested",
          graceDays: 30,
          requestedAt: requestedAt.toISOString(),
        }),
      },
    });
  });

  return requestedAt;
}

export async function runAccountDeletionMaintenance(
  now = new Date(),
  deleteBatch: AccountStorageDeletionBatchHandler =
    deleteAccountStoragePrefixBatch,
): Promise<AccountDeletionMaintenanceResult> {
  const cutoff = accountDeletionCutoffDate(now);
  const pendingUsers = await findPendingAccountDeletionUsers(cutoff);

  const result: AccountDeletionMaintenanceResult = {
    finalizedCount: 0,
    messagesScrubbed: 0,
    postsScrubbed: 0,
    threadsScrubbed: 0,
    listingsArchived: 0,
    mediaTombstoned: 0,
    storageDeletionJobsQueued: 0,
    storageDeletionJobsCompleted: 0,
    storageDeletionJobsFailed: 0,
    storageObjectsDeleted: 0,
    remoteProviderReferencesRetained: 0,
    memoriesDeleted: 0,
    contextsDeleted: 0,
    agentRunsScrubbed: 0,
    ranAt: now.toISOString(),
    cutoff: cutoff.toISOString(),
  };

  for (const user of pendingUsers) {
    const profileId = user.profile?.id ?? null;
    const counts = await withDbSystemContext(async (tx) => {
      const lockedUser = await lockAccountDeletionCandidate(
        tx,
        user.id,
        cutoff,
      );
      if (!lockedUser) {
        return {
          ...emptyProfileCounts(),
          finalized: false,
          skipped: true,
          mediaTombstoned: 0,
          storageDeletionJobsQueued: 0,
          remoteProviderReferencesRetained: 0,
          memoriesDeleted: 0,
          contextsDeleted: 0,
          agentRunsScrubbed: 0,
        };
      }

      const profileBatch = profileId
        ? await scrubProfileOwnedContent(tx, profileId, now)
        : { counts: emptyProfileCounts(), complete: true };
      const [media, memories, contexts, agentRuns] = await Promise.all([
        tombstoneAccountMediaBatch(tx, user.id, now),
        tombstoneAccountMemoryBatch(tx, user.id, now),
        deleteAccountContextBatch(tx, user.id),
        scrubAccountAgentRunBatch(tx, user.id),
      ]);
      const batchComplete =
        profileBatch.complete &&
        media.length < ACCOUNT_DELETION_CONTENT_BATCH_LIMIT &&
        memories.length < ACCOUNT_DELETION_CONTENT_BATCH_LIMIT &&
        contexts.length < ACCOUNT_DELETION_CONTENT_BATCH_LIMIT &&
        agentRuns.length < ACCOUNT_DELETION_CONTENT_BATCH_LIMIT;
      if (!batchComplete) {
        await tx.auditLog.create({
          data: {
            actorType: "system",
            action: "user.delete.batch",
            targetType: "user",
            targetId: user.id,
            metadata: JSON.stringify({
              finalized: false,
              ...profileBatch.counts,
              mediaTombstoned: media.length,
              memoriesDeleted: memories.length,
              contextsDeleted: contexts.length,
              agentRunsScrubbed: agentRuns.length,
            }),
          },
        });
        return {
          ...profileBatch.counts,
          finalized: false,
          skipped: false,
          mediaTombstoned: media.length,
          storageDeletionJobsQueued: 0,
          remoteProviderReferencesRetained: 0,
          memoriesDeleted: memories.length,
          contextsDeleted: contexts.length,
          agentRunsScrubbed: agentRuns.length,
        };
      }

      const storageJobs = await tx.deletionJob.createMany({
        data: accountStorageDeletionJobsForUser(user.id, now),
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          email: deletedEmailForUser(user.id),
          name: null,
          subscriptionTier: "free",
          isBanned: true,
          deletionRequestedAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: "system",
          action: "user.delete.finalize",
          targetType: "user",
          targetId: user.id,
          metadata: JSON.stringify({
            anonymizedEmail: deletedEmailForUser(user.id),
            requestedAt:
              lockedUser.deletionRequestedAt?.toISOString() ?? null,
            finalizedAt: now.toISOString(),
            ...profileBatch.counts,
            mediaTombstoned: media.length,
            storageDeletionJobsQueued: storageJobs.count,
            remoteProviders: {
              workos: lockedUser.workosUserId
                ? "reference_retained_remote_record_not_deleted"
                : "not_linked",
              stripeCustomer: lockedUser.stripeCustomerId
                ? "reference_retained_remote_record_not_deleted"
                : "not_linked",
              stripeSubscription: lockedUser.stripeSubscriptionId
                ? "reference_retained_remote_record_not_deleted"
                : "not_linked",
            },
            memoriesDeleted: memories.length,
            contextsDeleted: contexts.length,
            agentRunsScrubbed: agentRuns.length,
          }),
        },
      });

      return {
        ...profileBatch.counts,
        finalized: true,
        skipped: false,
        mediaTombstoned: media.length,
        storageDeletionJobsQueued: storageJobs.count,
        remoteProviderReferencesRetained: [
          lockedUser.workosUserId,
          lockedUser.stripeCustomerId,
          lockedUser.stripeSubscriptionId,
        ].filter(Boolean).length,
        memoriesDeleted: memories.length,
        contextsDeleted: contexts.length,
        agentRunsScrubbed: agentRuns.length,
      };
    });

    if (counts.skipped) continue;
    if (counts.finalized) result.finalizedCount += 1;
    result.messagesScrubbed += counts.messagesScrubbed;
    result.postsScrubbed += counts.postsScrubbed;
    result.threadsScrubbed += counts.threadsScrubbed;
    result.listingsArchived += counts.listingsArchived;
    result.mediaTombstoned += counts.mediaTombstoned;
    result.storageDeletionJobsQueued += counts.storageDeletionJobsQueued;
    result.remoteProviderReferencesRetained +=
      counts.remoteProviderReferencesRetained;
    result.memoriesDeleted += counts.memoriesDeleted;
    result.contextsDeleted += counts.contextsDeleted;
    result.agentRunsScrubbed += counts.agentRunsScrubbed;
  }

  const storage = await runAccountStorageDeletionJobs(now, deleteBatch);
  result.storageDeletionJobsCompleted = storage.jobsCompleted;
  result.storageDeletionJobsFailed = storage.jobsFailed;
  result.storageObjectsDeleted = storage.objectsDeleted;

  if (result.finalizedCount > 0) {
    await createAuditLog({
      actorType: "system",
      action: "user.delete.maintenance",
      targetType: "user",
      metadata: { ...result },
    });
  }

  return result;
}

export async function findPendingAccountDeletionUsers(cutoff: Date) {
  return withDbSystemContext((tx) =>
    tx.user.findMany({
      where: {
        isBanned: true,
        deletionRequestedAt: { lte: cutoff },
      },
      orderBy: [{ deletionRequestedAt: "asc" }, { id: "asc" }],
      take: ACCOUNT_DELETION_USER_LIMIT,
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        workosUserId: true,
        deletionRequestedAt: true,
        profile: { select: { id: true } },
      },
    }),
  );
}

export function accountDeletionCutoffDate(date = new Date()) {
  const cutoff = new Date(date);
  cutoff.setDate(cutoff.getDate() - ACCOUNT_DELETION_GRACE_DAYS);
  return cutoff;
}

function deletedEmailForUser(userId: string) {
  return `deleted-${userId}@${DELETED_EMAIL_DOMAIN}`;
}

function deletionRequestEmailForUser(userId: string) {
  return `${DELETION_REQUEST_EMAIL_PREFIX}-${userId}@${DELETED_EMAIL_DOMAIN}`;
}

type AccountTransactionClient = DbContextClient;

type ProfileContentCounts = Pick<
  AccountDeletionMaintenanceResult,
  "messagesScrubbed" | "postsScrubbed" | "threadsScrubbed" | "listingsArchived"
>;

async function scrubProfileOwnedContent(
  tx: AccountTransactionClient,
  profileId: string,
  now: Date
): Promise<{ counts: ProfileContentCounts; complete: boolean }> {
  const [messages, posts, threads, listings] = await Promise.all([
    scrubAccountMessageBatch(tx, profileId, now),
    scrubAccountPostBatch(tx, profileId, now),
    scrubAccountThreadBatch(tx, profileId, now),
    scrubAccountListingBatch(tx, profileId, now),
  ]);

  await tx.profile.update({
    where: { id: profileId },
    data: {
      displayName: DELETED_PROFILE_NAME,
      bio: null,
      avatarUrl: null,
      state: null,
      kennelName: null,
      kennelPrefix: null,
      role: "member",
      verified: false,
      website: null,
      phone: null,
    },
  });

  await tx.socialActor.updateMany({
    where: { profileId },
    data: {
      handle: `deleted-${profileId}`,
      displayName: DELETED_PROFILE_NAME,
      avatarUrl: null,
      coverUrl: null,
      profileVisibility: "only_me",
      contactVisibility: "only_me",
      published: false,
    },
  });

  return {
    counts: {
      messagesScrubbed: messages.length,
      postsScrubbed: posts.length,
      threadsScrubbed: threads.length,
      listingsArchived: listings.length,
    },
    complete: [messages, posts, threads, listings].every(
      (rows) => rows.length < ACCOUNT_DELETION_CONTENT_BATCH_LIMIT,
    ),
  };
}

type LockedAccountDeletionUser = {
  id: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  workosUserId: string | null;
  deletionRequestedAt: Date | null;
};

function lockAccountDeletionCandidate(
  tx: AccountTransactionClient,
  userId: string,
  cutoff: Date,
) {
  return tx.$queryRaw<LockedAccountDeletionUser[]>`
    SELECT
      u.id,
      u."stripeCustomerId",
      u."stripeSubscriptionId",
      u."workosUserId",
      u."deletionRequestedAt"
    FROM "User" AS u
    WHERE u.id = ${userId}
      AND u."isBanned" = true
      AND u."deletionRequestedAt" <= ${cutoff}
    FOR UPDATE
  `.then((rows) => rows[0] ?? null);
}

function scrubAccountMessageBatch(
  tx: AccountTransactionClient,
  profileId: string,
  now: Date,
) {
  return tx.$queryRaw<Array<{ id: string }>>`
    WITH targets AS (
      SELECT m.id
      FROM "Message" AS m
      WHERE m."senderId" = ${profileId}
        AND (
          m.body IS DISTINCT FROM ${DELETED_MESSAGE_BODY}
          OR m."mediaIdsJson" IS NOT NULL
          OR m."deletedBySenderAt" IS NULL
        )
      ORDER BY m.id ASC
      LIMIT ${ACCOUNT_DELETION_CONTENT_BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "Message" AS target
    SET
      body = ${DELETED_MESSAGE_BODY},
      "mediaIdsJson" = NULL,
      "deletedBySenderAt" = ${now}
    FROM targets
    WHERE target.id = targets.id
    RETURNING target.id
  `;
}

function scrubAccountPostBatch(
  tx: AccountTransactionClient,
  profileId: string,
  now: Date,
) {
  return tx.$queryRaw<Array<{ id: string }>>`
    WITH targets AS (
      SELECT p.id
      FROM "Post" AS p
      WHERE p."authorId" = ${profileId}
        AND p.body IS DISTINCT FROM ${DELETED_POST_BODY}
      ORDER BY p.id ASC
      LIMIT ${ACCOUNT_DELETION_CONTENT_BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "Post" AS target
    SET body = ${DELETED_POST_BODY}, "editedAt" = ${now}
    FROM targets
    WHERE target.id = targets.id
    RETURNING target.id
  `;
}

function scrubAccountThreadBatch(
  tx: AccountTransactionClient,
  profileId: string,
  now: Date,
) {
  return tx.$queryRaw<Array<{ id: string }>>`
    WITH targets AS (
      SELECT t.id
      FROM "Thread" AS t
      WHERE t."authorId" = ${profileId}
        AND (
          t.title IS DISTINCT FROM ${DELETED_THREAD_TITLE}
          OR t.locked = false
        )
      ORDER BY t.id ASC
      LIMIT ${ACCOUNT_DELETION_CONTENT_BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "Thread" AS target
    SET title = ${DELETED_THREAD_TITLE}, locked = true, "updatedAt" = ${now}
    FROM targets
    WHERE target.id = targets.id
    RETURNING target.id
  `;
}

function scrubAccountListingBatch(
  tx: AccountTransactionClient,
  profileId: string,
  now: Date,
) {
  return tx.$queryRaw<Array<{ id: string }>>`
    WITH targets AS (
      SELECT l.id
      FROM "Listing" AS l
      WHERE l."profileId" = ${profileId}
        AND (
          l.title IS DISTINCT FROM ${DELETED_LISTING_TITLE}
          OR l.description IS DISTINCT FROM ${DELETED_LISTING_DESCRIPTION}
          OR l.price IS NOT NULL
          OR l.state IS NOT NULL
          OR l."dogId" IS NOT NULL
          OR l."imageUrl" IS NOT NULL
          OR l.status IS DISTINCT FROM 'archived'
          OR l."archivedAt" IS NULL
        )
      ORDER BY l.id ASC
      LIMIT ${ACCOUNT_DELETION_CONTENT_BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "Listing" AS target
    SET
      title = ${DELETED_LISTING_TITLE},
      description = ${DELETED_LISTING_DESCRIPTION},
      price = NULL,
      state = NULL,
      "dogId" = NULL,
      "imageUrl" = NULL,
      status = 'archived',
      "archivedAt" = ${now},
      "updatedAt" = ${now}
    FROM targets
    WHERE target.id = targets.id
    RETURNING target.id
  `;
}

function tombstoneAccountMediaBatch(
  tx: AccountTransactionClient,
  userId: string,
  now: Date,
) {
  return tx.$queryRaw<Array<{ id: string }>>`
    WITH targets AS (
      SELECT m.id
      FROM "MediaAsset" AS m
      WHERE m."uploaderId" = ${userId} AND m."deletedAt" IS NULL
      ORDER BY m.id ASC
      LIMIT ${ACCOUNT_DELETION_CONTENT_BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "MediaAsset" AS target
    SET
      "originalName" = NULL,
      sha256 = NULL,
      "deletedAt" = ${now},
      "updatedAt" = ${now}
    FROM targets
    WHERE target.id = targets.id
    RETURNING target.id
  `;
}

function tombstoneAccountMemoryBatch(
  tx: AccountTransactionClient,
  userId: string,
  now: Date,
) {
  return tx.$queryRaw<Array<{ id: string }>>`
    WITH targets AS (
      SELECT m.id
      FROM "MemoryEntry" AS m
      WHERE m."userId" = ${userId} AND m."deletedAt" IS NULL
      ORDER BY m.id ASC
      LIMIT ${ACCOUNT_DELETION_CONTENT_BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "MemoryEntry" AS target
    SET
      content = ${DELETED_MEMORY_CONTENT},
      "sourceRef" = NULL,
      importance = 0.1,
      "deletedAt" = ${now},
      "updatedAt" = ${now}
    FROM targets
    WHERE target.id = targets.id
    RETURNING target.id
  `;
}

function deleteAccountContextBatch(
  tx: AccountTransactionClient,
  userId: string,
) {
  return tx.$queryRaw<Array<{ id: string }>>`
    WITH targets AS (
      SELECT c.id
      FROM "ConversationContext" AS c
      WHERE c."userId" = ${userId}
      ORDER BY c.id ASC
      LIMIT ${ACCOUNT_DELETION_CONTENT_BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM "ConversationContext" AS target
    USING targets
    WHERE target.id = targets.id
    RETURNING target.id
  `;
}

function scrubAccountAgentRunBatch(
  tx: AccountTransactionClient,
  userId: string,
) {
  return tx.$queryRaw<Array<{ id: string }>>`
    WITH targets AS (
      SELECT a.id
      FROM "AgentRun" AS a
      WHERE a."userId" = ${userId}
      ORDER BY a.id ASC
      LIMIT ${ACCOUNT_DELETION_CONTENT_BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "AgentRun" AS target
    SET
      "userId" = NULL,
      "inputJson" = '{}',
      "outputJson" = NULL,
      "toolInvocations" = NULL,
      "createdMemoryIds" = NULL,
      error = NULL
    FROM targets
    WHERE target.id = targets.id
    RETURNING target.id
  `;
}

/** @internal Exported for the account-deletion regression test. */
export function accountDeletionAuthoredMessageUpdate(
  profileId: string,
  now: Date
) {
  return {
    where: { senderId: profileId },
    data: {
      body: DELETED_MESSAGE_BODY,
      mediaIdsJson: null,
      deletedBySenderAt: now,
    },
  } as const;
}

type AccountStorageDeletionJob = {
  id: string;
  targetType: string;
  targetUserId: string | null;
  storageBucket: string | null;
  storagePath: string | null;
};

type UserMediaBucket =
  | typeof PUBLIC_USER_MEDIA_BUCKET
  | typeof PRIVATE_USER_MEDIA_BUCKET;

export function accountStoragePrefix(userId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) {
    throw new Error("account.invalid_storage_identity");
  }
  return `users/${userId}`;
}

/** @internal Exported for the durable-job regression test. */
export function accountStorageDeletionJobsForUser(userId: string, now: Date) {
  return [PUBLIC_USER_MEDIA_BUCKET, PRIVATE_USER_MEDIA_BUCKET].map(
    (storageBucket) => ({
      targetType: ACCOUNT_STORAGE_DELETION_TARGET,
      targetUserId: userId,
      storageBucket,
      storagePath: accountStoragePrefix(userId),
      status: "pending",
      scheduledFor: now,
    })
  );
}

/** @internal Exported for the storage-deletion regression test. */
export function parseAccountStorageDeletionJob(job: AccountStorageDeletionJob) {
  if (
    job.targetType !== ACCOUNT_STORAGE_DELETION_TARGET ||
    !job.targetUserId ||
    job.storagePath !== accountStoragePrefix(job.targetUserId) ||
    (job.storageBucket !== PUBLIC_USER_MEDIA_BUCKET &&
      job.storageBucket !== PRIVATE_USER_MEDIA_BUCKET)
  ) {
    throw new Error("account.invalid_storage_deletion_job");
  }
  return {
    bucket: job.storageBucket as UserMediaBucket,
    prefix: job.storagePath,
  };
}

/** @internal A bounded, injectable unit used by the maintenance worker. */
export async function deleteAccountStoragePrefixBatch(
  job: AccountStorageDeletionJob,
  storage: {
    list: (
      bucket: ObjectStorageBucket,
      prefix: string,
      maxObjects: number
    ) => Promise<string[]>;
    remove: (
      bucket: ObjectStorageBucket,
      paths: string[]
    ) => Promise<void>;
  } = {
    list: (bucket, prefix, maxObjects) =>
      objectStorage.listObjectKeys({ bucket, prefix, maxObjects }),
    remove: (bucket, paths) =>
      objectStorage.deleteObjects({ bucket, keys: paths }),
  }
) {
  const { bucket, prefix } = parseAccountStorageDeletionJob(job);
  const paths = await storage.list(
    bucket,
    prefix,
    STORAGE_DELETION_OBJECT_LIMIT + 1
  );
  if (
    paths.some(
      (path) =>
        !path.startsWith(`${prefix}/`) ||
        path.includes("\\") ||
        path.split("/").includes("..")
    )
  ) {
    throw new Error("account.invalid_storage_deletion_path");
  }
  const batch = paths.slice(0, STORAGE_DELETION_OBJECT_LIMIT);
  if (batch.length > 0) await storage.remove(bucket, batch);
  return {
    objectsDeleted: batch.length,
    completed: paths.length <= STORAGE_DELETION_OBJECT_LIMIT,
  };
}

type AccountStorageDeletionBatchHandler = (
  job: AccountStorageDeletionJob,
) => Promise<{ objectsDeleted: number; completed: boolean }>;

/** @internal Exported so the database worker can be proved without provider I/O. */
export async function runAccountStorageDeletionJobs(
  now: Date,
  deleteBatch: AccountStorageDeletionBatchHandler =
    deleteAccountStoragePrefixBatch,
) {
  const leaseCutoff = new Date(now.getTime() - STORAGE_DELETION_LEASE_MS);
  const jobs = await withDbSystemContext((tx) =>
    tx.deletionJob.findMany({
      where: {
        targetType: ACCOUNT_STORAGE_DELETION_TARGET,
        scheduledFor: { lte: now },
        OR: [
          { status: "pending" },
          { status: "processing", updatedAt: { lte: leaseCutoff } },
        ],
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take: STORAGE_DELETION_JOB_LIMIT,
      select: {
        id: true,
        targetType: true,
        targetUserId: true,
        storageBucket: true,
        storagePath: true,
      },
    })
  );

  const result = { jobsCompleted: 0, jobsFailed: 0, objectsDeleted: 0 };
  for (const job of jobs) {
    const claimed = await withDbSystemContext((tx) =>
      tx.deletionJob.updateMany({
        where: {
          id: job.id,
          OR: [
            { status: "pending" },
            { status: "processing", updatedAt: { lte: leaseCutoff } },
          ],
        },
        data: { status: "processing" },
      })
    );
    if (claimed.count !== 1) continue;

    try {
      const batch = await deleteBatch(job);
      await withDbSystemContext(async (tx) => {
        await tx.deletionJob.update({
          where: { id: job.id },
          data: batch.completed
            ? { status: "completed", completedAt: now }
            : { status: "pending", completedAt: null },
        });
        await tx.auditLog.create({
          data: {
            actorType: "system",
            action: "user.delete.storage",
            targetType: "deletionJob",
            targetId: job.id,
            metadata: JSON.stringify({
              status: batch.completed ? "completed" : "pending",
              objectsDeleted: batch.objectsDeleted,
            }),
          },
        });
      });
      result.objectsDeleted += batch.objectsDeleted;
      if (batch.completed) result.jobsCompleted += 1;
    } catch (err) {
      await withDbSystemContext(async (tx) => {
        await tx.deletionJob.update({
          where: { id: job.id },
          data: { status: "failed", completedAt: null },
        });
        await tx.auditLog.create({
          data: {
            actorType: "system",
            action: "user.delete.storage_failed",
            targetType: "deletionJob",
            targetId: job.id,
            metadata: JSON.stringify({ errorCode: safeDeletionErrorCode(err) }),
          },
        });
      });
      result.jobsFailed += 1;
    }
  }
  return result;
}

function safeDeletionErrorCode(err: unknown) {
  const message = err instanceof Error ? err.message : "account.storage_delete_failed";
  const code = message.split(":", 1)[0];
  return /^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(code)
    ? code
    : "account.storage_delete_failed";
}

function emptyProfileCounts(): ProfileContentCounts {
  return {
    messagesScrubbed: 0,
    postsScrubbed: 0,
    threadsScrubbed: 0,
    listingsArchived: 0,
  };
}
