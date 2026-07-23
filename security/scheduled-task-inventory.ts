import {
  SCHEDULED_TASK_POLICIES,
  type ScheduledTaskId,
} from "../src/lib/scheduled-task-policy";

type IdempotencyEvidence = Readonly<{
  sourceFile: string;
  markers: readonly string[];
}>;

export type ScheduledTaskSourceRecord = Readonly<{
  taskId: ScheduledTaskId;
  routeFile: string;
  handlers: readonly string[];
  databaseEvidenceFiles: readonly string[];
  executionIdentity: string;
  databaseRole: string;
  timeoutMs: number;
  schedules: readonly string[];
  attemptDeadlineSeconds: number;
  missedAfterSeconds: number;
  idempotencyEvidence: readonly IdempotencyEvidence[];
  missedRunRecovery: string;
}>;

const INTERNAL_SECRET_IDENTITY =
  "Configured INTERNAL_API_SECRET presented as X-Internal-Secret or Bearer and verified by requireInternalRequest";
const SYSTEM_DATABASE_ROLE =
  "Shared server runtime PostgreSQL identity through Prisma; scheduled work uses the system database context rather than a user context";

export const SCHEDULED_TASK_SOURCE_INVENTORY = [
  task(
    "account-deletion",
    ["runAccountDeletionMaintenance"],
    ["src/lib/account-service.ts"],
    ["37 * * * *"],
    300,
    7_200,
    [
      evidence("src/lib/account-service.ts", [
        "lockAccountDeletionCandidate(",
        "STORAGE_DELETION_JOB_LIMIT",
        'status: "completed"',
      ]),
    ],
    "Replay the bounded due-user and storage-job selectors; completed/finalized records no longer qualify.",
  ),
  task(
    "agent-cleanup",
    ["runAgentCleanup"],
    ["src/lib/agent-service.ts"],
    ["47 * * * *"],
    300,
    7_200,
    [
      evidence("src/lib/agent-service.ts", [
        "tx.agentRun.updateMany({",
        'status: { in: ["pending", "running"] }',
        'status: "failed"',
      ]),
    ],
    "Replay the bounded status transition; already terminal agent runs do not match.",
  ),
  task(
    "aggregate-refresh",
    ["refreshAggregateMaterializedViews"],
    ["src/lib/live/sync.ts"],
    ["20 * * * *"],
    840,
    5_400,
    [
      evidence("src/lib/live/sync.ts", [
        "AGGREGATE_MAINTENANCE_BUDGET_MS = 780_000",
        "giq_refresh_aggregate_matview",
        "pruneExpiredRateLimits()",
      ]),
    ],
    "Replay one refresh after checking the lock; materialized refresh and expired-row pruning are repeat-safe.",
  ),
  task(
    "call-maintenance",
    ["runCallMaintenance"],
    ["src/lib/call-service.ts"],
    ["*/5 * * * *"],
    300,
    1_200,
    [
      evidence("src/lib/call-service.ts", [
        "take: CALL_MAINTENANCE_LIMIT",
        'where: { id: room.id, status: "active" }',
        "if (flip.count === 0)",
      ]),
    ],
    "Replay the capped pending-room/invite scan; compare-and-set transitions suppress duplicate side effects.",
  ),
  task(
    "community-readiness",
    ["withDbSystemContext"],
    ["src/app/api/internal/community-readiness/route.ts"],
    ["*/10 * * * *"],
    180,
    1_800,
    [
      evidence("src/app/api/internal/community-readiness/route.ts", [
        'get("write") === "true"',
        'process.env.ALLOW_COMMUNITY_WRITE_PROBE !== "true"',
        'writeFlow: runWriteProbe',
      ]),
    ],
    "Replay the default read-only probe; never add the write flag during missed-run recovery.",
  ),
  task(
    "dog-profile-sync",
    ["syncDogProfilesBatch"],
    ["src/lib/live/dog-profile-sync.ts"],
    ["*/2 * * * *"],
    300,
    900,
    [
      evidence("src/lib/live/dog-profile-sync.ts", [
        "const LIVE_PROFILE_CANONICAL_WRITES_ENABLED = false",
        "FROM \"DogProfileObservation\" observation",
        "FROM \"LiveFeedQuarantine\" quarantine",
        "PROFILE_REFRESH_INTERVAL_MS = 30 * 24",
        "PROFILE_FAILURE_RETRY_INTERVAL_MS = 7 * 24",
        "saveProfileObservation(tx, dog.id, profile, occurrence)",
        "tx.dogProfileObservation.create({",
      ]),
    ],
    "Replay the capped due-observation selector; latest verified observations and quarantines suppress immediate retries while preserving periodic refresh, and canonical profile writes remain disabled.",
  ),
  task(
    "listing-expiry",
    ["runListingMaintenance"],
    ["src/lib/listing-service.ts"],
    ["17 * * * *"],
    300,
    7_200,
    [
      evidence("src/lib/listing-service.ts", [
        "tx.listing.updateMany({",
        'status: "active"',
        'status: "expired"',
      ]),
    ],
    "Replay the due-state updates; expired or archived listings no longer match the source status.",
  ),
  task(
    "live-sync",
    ["syncLiveData"],
    ["src/lib/live/sync.ts"],
    ["*/5 * * * *", "7 * * * *"],
    300,
    1_200,
    [
      evidence("src/lib/live/sync.ts", [
        "upsertSystemMeetings(",
        "bulkUpsertRaces(",
        "bulkUpsertRunners(",
      ]),
    ],
    "Replay the bounded upcoming/results window; provider identities are reconciled through upserts.",
  ),
  task(
    "media-maintenance",
    ["runMediaMaintenance", "runLinkPreviewMaintenance"],
    ["src/lib/media-service.ts", "src/lib/link-preview-worker.ts"],
    ["*/5 * * * *"],
    900,
    1_200,
    [
      evidence("src/lib/media-service.ts", [
        "take: MEDIA_MAINTENANCE_LIMIT",
        "take: MEDIA_PROCESSING_LIMIT",
        "tx.mediaAsset.updateMany({",
      ]),
      evidence("src/lib/link-preview-worker.ts", [
        "take: LINK_PREVIEW_BATCH_SIZE",
        'where: { id: candidate.id, linkPreviewStatus: "pending" }',
        "if (claimed.count !== 1",
      ]),
    ],
    "Replay the capped pending selectors; conditional claims and terminal states prevent duplicate processing.",
  ),
  task(
    "memory-decay",
    ["runMemoryMaintenance"],
    ["src/lib/agent-service.ts"],
    ["11 3 * * *"],
    300,
    108_000,
    [
      evidence("src/lib/agent-service.ts", [
        "lastMaintainedAt: true",
        "unappliedDecayPeriods(memory, now)",
        "lastMaintainedAt: now",
      ]),
    ],
    "Replay the capped memory selectors; lastMaintainedAt prevents applying the same decay/reinforcement period twice.",
  ),
  task(
    "notification-delivery",
    ["runNotificationDeliveryMaintenance"],
    ["src/lib/notification-service.ts"],
    ["*/5 * * * *"],
    300,
    1_200,
    [
      evidence("src/lib/notification-service.ts", [
        'deliveryStatus: { in: ["pending", "error"] }',
        "take: NOTIFICATION_DELIVERY_LIMIT",
        'deliveryStatus: "delivered"',
      ]),
      evidence("src/lib/notification-webhook-policy.ts", [
        '"idempotency-key": payload.id',
        "AbortSignal.timeout(NOTIFICATION_WEBHOOK_TIMEOUT_MS)",
      ]),
    ],
    "Replay the bounded pending/error selector; the stable notification ID is the downstream idempotency key.",
  ),
  task(
    "usage-delivery",
    ["runUsageDeliveryMaintenance"],
    ["src/lib/billing/usage-delivery-worker-store.ts"],
    ["* * * * *"],
    180,
    600,
    [
      evidence("src/lib/billing/usage-delivery-worker-store.ts", [
        'FOR UPDATE SKIP LOCKED',
        '"leaseToken" = ${leaseToken}',
        '"status" = \'dead_letter\'',
      ]),
      evidence("src/lib/billing/usage-delivery-service.ts", [
        "transaction_id: claim.idempotencyKey",
        "external_subscription_id: target.externalSubscriptionId",
        "properties: { quantity: claim.quantity }",
      ]),
    ],
    "Replay the due selector; fenced leases recover after expiry, Lago deduplicates on transaction_id, and terminal rows no longer qualify.",
  ),
] as const satisfies readonly ScheduledTaskSourceRecord[];

function task(
  taskId: ScheduledTaskId,
  handlers: readonly string[],
  databaseEvidenceFiles: readonly string[],
  schedules: readonly string[],
  attemptDeadlineSeconds: number,
  missedAfterSeconds: number,
  idempotencyEvidence: readonly IdempotencyEvidence[],
  missedRunRecovery: string,
): ScheduledTaskSourceRecord {
  return {
    taskId,
    routeFile: `src/app/api/internal/${taskId}/route.ts`,
    handlers,
    databaseEvidenceFiles,
    executionIdentity: INTERNAL_SECRET_IDENTITY,
    databaseRole: SYSTEM_DATABASE_ROLE,
    timeoutMs: SCHEDULED_TASK_POLICIES[taskId].timeoutMs,
    schedules,
    attemptDeadlineSeconds,
    missedAfterSeconds,
    idempotencyEvidence,
    missedRunRecovery,
  };
}

function evidence(
  sourceFile: string,
  markers: readonly string[],
): IdempotencyEvidence {
  return { sourceFile, markers };
}
