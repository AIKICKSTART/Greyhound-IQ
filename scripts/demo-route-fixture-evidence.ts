import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEMO_FIXTURE_APPROVED_ASSETS,
  DEMO_FIXTURE_BOUND_SOURCE_FILES,
  DEMO_PRIVATE_FIXTURE_ROW_COUNT,
} from "./demo-route-fixture-contract";

export const DEMO_FIXTURE_EVIDENCE_SCHEMA_VERSION = 16;
export const DEMO_FIXTURE_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
export const DEMO_FIXTURE_EXPECTED_PAYLOAD_SHA256 =
  "9af22bdcf145059d5ce804c111692ef37c6799f39e4aec6bfea6187b5a763b86";
export const DEMO_FIXTURE_EXPECTED_PROVIDER_SENTINEL_SHA256 =
  "827d987a06a9ecfb33520dd945ac08c5a3701427e146ee5cbd50f2e4f439d199";

export const DEMO_FIXTURE_EXPECTED_MODEL_COUNTS = {
  User: 4,
  Profile: 4,
  SocialActor: 5,
  Friendship: 1,
  CustomPage: 1,
  MediaAsset: 6,
  ActorGalleryMedia: 6,
  Thread: 1,
  Post: 1,
  Conversation: 1,
  ConversationParticipant: 2,
  Message: 1,
  Listing: 1,
  ListingLocation: 1,
  ListingSearchIndex: 1,
  ListingStatusHistory: 1,
} as const;

export const DEMO_FIXTURE_EXPECTED_PROVIDER_EMPTY_COUNTS = {
  Dog: 0,
  Track: 0,
  Meeting: 0,
  Race: 0,
} as const;

export const DEMO_FIXTURE_EXPECTED_PROVIDER_SENTINEL_COUNTS = {
  Dog: 1,
  Track: 1,
  Meeting: 1,
  Race: 1,
} as const;

export const DEMO_FIXTURE_EXPECTED_PROBES = [
  {
    probe: "duplicate .test identity with foreign reserved owner",
    expectedError: "demo_fixtures.user_collision",
    transactionRowsAfterFailure: 0,
    status: "verified",
  },
  {
    probe: "reserved thread identifier owned by a foreign synthetic profile",
    expectedError: "demo_fixtures.thread_collision",
    transactionRowsAfterFailure: DEMO_PRIVATE_FIXTURE_ROW_COUNT,
    status: "verified",
  },
] as const;

export const DEMO_FIXTURE_EXPECTED_RUNTIME_IDENTITY = {
  role: "greyhoundiq_runtime",
  sessionRole: "greyhoundiq_runtime",
  database: "greyhoundiq",
  schema: "public",
  canLogin: true,
  superuser: false,
  bypassRls: false,
} as const;

export const DEMO_FIXTURE_MEDIA_STATUS_FIELDS = [
  "createdAt",
  "id",
  "originalName",
  "processingError",
  "processingStatus",
  "scanStatus",
  "updatedAt",
] as const;

export const DEMO_FIXTURE_EXPECTED_DATABASE_OPERATION_PROOFS = [
  {
    queryId: "DB.AUTH.CALLBACK.ACCEPTANCE.TRANSACTION",
    sourceFile: "src/lib/auth-sync.ts",
    sourceSymbol: "syncAuthUser",
    expectedMaximumRows: 4,
    rowsBefore: 0,
    rowsAfter: 1,
    rowCountDelta: 1,
    cases: {
      newIdentity: "created-one-user-profile-actor-outbox",
      repeat: "same-four-rows-bounded-update-and-actor-upsert",
      pendingDeletion: "restored-user-and-inserted-one-audit",
      permanentBan: "returned-without-mutation",
      unverifiedEmail: "duplicate-email-rejected-without-linking",
      requestContext: "exact-user-insert-rejected-by-rls",
      rollback: "four-write-transaction-rolled-back",
      systemContext: "captured-under-nobypassrls-runtime-role",
      providerResidual: "identity-provider-validation-out-of-scope",
      concurrencyResidual: "concurrent-first-login-not-proven",
    },
    statementType: "SELECT",
    tableName: "User",
    namedBinds: [
      { name: "provider.subject", positions: [1] },
      { name: "provider.verifiedEmail", positions: [2] },
      { name: "prisma.take", positions: [3] },
      { name: "prisma.skip", positions: [4] },
    ],
    variants: [
      {
        variant: "verified-identity-lookup",
        statementType: "SELECT",
        tableName: "User",
        namedBinds: [
          { name: "provider.subject", positions: [1] },
          { name: "provider.verifiedEmail", positions: [2] },
          { name: "prisma.take", positions: [3] },
          { name: "prisma.skip", positions: [4] },
        ],
      },
      {
        variant: "unverified-identity-lookup",
        statementType: "SELECT",
        tableName: "User",
        namedBinds: [
          { name: "provider.subject", positions: [1] },
          { name: "prisma.take", positions: [2] },
          { name: "prisma.skip", positions: [3] },
        ],
      },
      {
        variant: "user-insert",
        statementType: "INSERT",
        tableName: "User",
        namedBinds: [
          { name: "user.id", positions: [1] },
          { name: "provider.email", positions: [2] },
          { name: "displayName", positions: [3] },
          { name: "subscriptionTier", positions: [4] },
          { name: "isBanned", positions: [5] },
          { name: "prisma.userTimestamps", positions: [6, 7] },
          { name: "provider.subject", positions: [8] },
        ],
      },
      {
        variant: "profile-insert",
        statementType: "INSERT",
        tableName: "Profile",
        namedBinds: [
          { name: "profile.id", positions: [1] },
          { name: "user.id", positions: [2] },
          { name: "displayName", positions: [3] },
          { name: "profile.role", positions: [4] },
          { name: "profile.flags", positions: [5, 6] },
          { name: "prisma.profileTimestamps", positions: [7, 8] },
        ],
      },
      {
        variant: "social-actor-upsert",
        statementType: "INSERT",
        tableName: "SocialActor",
        namedBinds: [
          { name: "actor.id", positions: [1] },
          { name: "actor.kind", positions: [2] },
          { name: "profile.id", positions: [3, 4, 25] },
          { name: "actor.handle", positions: [5] },
          { name: "displayName", positions: [6, 21] },
          { name: "avatarUrl", positions: [7, 22] },
          { name: "actor.focalDefaults", positions: [8, 9, 12, 13] },
          { name: "actor.zoomDefaults", positions: [10, 14] },
          { name: "actor.rotationDefaults", positions: [11, 15] },
          { name: "profileVisibility", positions: [16] },
          { name: "contactVisibility", positions: [17] },
          { name: "published", positions: [18, 23] },
          { name: "prisma.actorTimestamps", positions: [19, 20, 24] },
        ],
      },
      {
        variant: "signup-outbox-insert",
        statementType: "INSERT",
        tableName: "SignupOutbox",
        namedBinds: [
          { name: "outbox.id", positions: [1] },
          { name: "user.id", positions: [2] },
          { name: "idempotencyKey", positions: [3] },
          { name: "outbox.status", positions: [4] },
          { name: "retryCount", positions: [5] },
          { name: "prisma.outboxTimestamps", positions: [6, 7, 8] },
        ],
      },
      {
        variant: "repeat-user-update",
        statementType: "UPDATE",
        tableName: "User",
        namedBinds: [
          { name: "provider.email", positions: [1] },
          { name: "displayName", positions: [2] },
          { name: "provider.subject", positions: [3] },
          { name: "isBanned", positions: [4] },
          { name: "deletionRequestedAt", positions: [5] },
          { name: "prisma.updatedAt", positions: [6] },
          { name: "user.id", positions: [7] },
        ],
      },
      {
        variant: "restore-audit-insert",
        statementType: "INSERT",
        tableName: "AuditLog",
        namedBinds: [
          { name: "user.id.actor", positions: [1] },
          { name: "actorType", positions: [2] },
          { name: "action", positions: [3] },
          { name: "targetType", positions: [4] },
          { name: "user.id.target", positions: [5] },
          { name: "audit.metadata", positions: [6] },
          { name: "prisma.createdAt", positions: [7] },
        ],
      },
    ],
    status: "verified",
  },
  {
    queryId: "DB.PULSE.CONVERSATION.ACCESS.SELECT",
    sourceFile: "src/lib/conversation-service.ts",
    sourceSymbol: "getConversationForProfile",
    expectedMaximumRows: 1,
    rowsBefore: 1,
    rowsAfter: 1,
    rowCountDelta: 0,
    cases: {
      participant: "returned-one",
      nonParticipant: "conversation.not_found",
      missing: "conversation.not_found",
    },
    statementType: "SELECT",
    tableName: "Conversation",
    namedBinds: [
      { name: "conversationId", positions: [1] },
      { name: "current.profileId", positions: [2, 3] },
      { name: "prisma.take", positions: [4] },
      { name: "prisma.skip", positions: [5] },
    ],
    status: "verified",
  },
  {
    queryId: "DB.MEDIA.ASSET.STATUS.SELECT",
    sourceFile: "src/lib/media-service.ts",
    sourceSymbol: "getMediaStatusForCurrentUser",
    expectedMaximumRows: 1,
    rowsBefore: 6,
    rowsAfter: 6,
    rowCountDelta: 0,
    cases: {
      owner: "returned-seven-field-projection",
      otherOwner: "media.not_found",
      missing: "media.not_found",
    },
    statementType: "SELECT",
    tableName: "MediaAsset",
    namedBinds: [
      { name: "mediaId", positions: [1] },
      { name: "current.dbUserId", positions: [2] },
      { name: "prisma.take", positions: [3] },
      { name: "prisma.skip", positions: [4] },
    ],
    status: "verified",
  },
  {
    queryId: "DB.PULSE.CONVERSATION.BLOCK.UPDATE",
    sourceFile: "src/lib/conversation-service.ts",
    sourceSymbol: "setConversationBlock",
    expectedMaximumRows: 1,
    rowsBefore: 1,
    rowsAfter: 1,
    rowCountDelta: 0,
    cases: {
      rollback: "conversation-and-user-block-rolled-back",
      stranger: "conversation.not_found",
      block: "blocked-by-participant",
      counterpartyUnblock: "auth.forbidden",
      duplicate: "conversation-updated-user-block-row-stable",
      unblock: "conversation-cleared-user-block-removed",
      blockAndUnblockSqlShape: "identical",
    },
    statementType: "UPDATE",
    tableName: "Conversation",
    namedBinds: [
      { name: "next.blockedById", positions: [1] },
      { name: "next.blockedAt", positions: [2] },
      { name: "prisma.updatedAt", positions: [3] },
      { name: "conversation.id", positions: [4] },
    ],
    status: "verified",
  },
  {
    queryId: "DB.PULSE.USER_BLOCK.UPSERT",
    sourceFile: "src/lib/conversation-service.ts",
    sourceSymbol: "setConversationBlock",
    expectedMaximumRows: 1,
    rowsBefore: 0,
    rowsAfter: 0,
    rowCountDelta: 0,
    cases: {
      rollback: "user-block-insert-rolled-back",
      firstBlock: "created-one",
      duplicateBlock: "same-row-retained",
      duplicateSqlPath: "unique-pair-read-no-second-mutation",
      counterpartyUnblock: "auth.forbidden",
      unblock: "deleted-to-zero",
    },
    statementType: "INSERT",
    tableName: "UserBlock",
    namedBinds: [
      { name: "userBlock.id", positions: [1] },
      { name: "current.profileId", positions: [2] },
      { name: "blockedProfileId", positions: [3] },
      { name: "prisma.createdAt", positions: [4] },
    ],
    status: "verified",
  },
  {
    queryId: "DB.AUTH.SIGNUP_OUTBOX.CLAIM",
    sourceFile: "src/lib/signup-acceptance-worker-store.ts",
    sourceSymbol: "signupAcceptanceWorkerStore.claimBatch",
    expectedMaximumRows: 1,
    rowsBefore: 2,
    rowsAfter: 2,
    rowCountDelta: 0,
    cases: {
      locked: "skipped-locked-row",
      requestContext: "returned-zero-and-left-row-pending",
      rollback: "claim-rolled-back",
      eligible: "claimed-one",
      duplicate: "unexpired-processing-row-not-reclaimed",
    },
    statementType: "WITH",
    tableName: "SignupOutbox",
    namedBinds: [
      { name: "maxAttempts", positions: [1] },
      { name: "worker.now", positions: [2, 3, 5, 8] },
      { name: "limit", positions: [4] },
      { name: "leaseExpiresAt", positions: [6] },
      { name: "leaseToken", positions: [7] },
    ],
    status: "verified",
  },
  {
    queryId: "DB.AUTH.SIGNUP_OUTBOX.SETTLE",
    sourceFile: "src/lib/signup-acceptance-worker-store.ts",
    sourceSymbol: "signupAcceptanceWorkerStore.complete/fail",
    expectedMaximumRows: 1,
    rowsBefore: 2,
    rowsAfter: 2,
    rowCountDelta: 0,
    cases: {
      staleLease: "returned-false-and-left-processing",
      requestContext: "all-variants-returned-zero",
      rollback: "all-variants-rolled-back",
      complete: "sent-once-then-false",
      retry: "retried-once-then-lease-lost",
      deadLetter: "dead-lettered-once-then-lease-lost",
      sqlVariants: "three-distinct-parameterized-statements",
    },
    statementType: "UPDATE",
    tableName: "SignupOutbox",
    namedBinds: [
      { name: "completedAt", positions: [1, 2] },
      { name: "claim.id", positions: [3] },
      { name: "claim.leaseToken", positions: [4] },
    ],
    variants: [
      {
        variant: "complete",
        statementType: "UPDATE",
        tableName: "SignupOutbox",
        namedBinds: [
          { name: "completedAt", positions: [1, 2] },
          { name: "claim.id", positions: [3] },
          { name: "claim.leaseToken", positions: [4] },
        ],
      },
      {
        variant: "retry",
        statementType: "UPDATE",
        tableName: "SignupOutbox",
        namedBinds: [
          { name: "retryAt", positions: [1] },
          { name: "errorCode", positions: [2] },
          { name: "failedAt", positions: [3] },
          { name: "claim.id", positions: [4] },
          { name: "claim.leaseToken", positions: [5] },
        ],
      },
      {
        variant: "dead-letter",
        statementType: "UPDATE",
        tableName: "SignupOutbox",
        namedBinds: [
          { name: "failedAt", positions: [1, 3] },
          { name: "errorCode", positions: [2] },
          { name: "claim.id", positions: [4] },
          { name: "claim.leaseToken", positions: [5] },
        ],
      },
    ],
    status: "verified",
  },
  {
    queryId: "DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER",
    sourceFile: "src/lib/signup-acceptance-worker-store.ts",
    sourceSymbol: "signupAcceptanceWorkerStore.claimBatch",
    expectedMaximumRows: 1,
    rowsBefore: 2,
    rowsAfter: 2,
    rowCountDelta: 0,
    cases: {
      bounded: "dead-lettered-one-with-limit-one",
      claimLock: "expired-row-progressed-while-claim-row-locked",
      requestContext: "returned-zero-and-left-row-pending",
      rollback: "dead-letter-rolled-back",
      duplicate: "already-dead-lettered-row-not-reprocessed",
    },
    statementType: "WITH",
    tableName: "SignupOutbox",
    namedBinds: [
      { name: "maxAttempts", positions: [1] },
      { name: "worker.now", positions: [2, 3, 5, 6] },
      { name: "limit", positions: [4] },
    ],
    status: "verified",
  },
  {
    queryId: "DB.MEDIA.ASSET.DELETE.TOMBSTONE",
    sourceFile: "src/lib/media-service.ts",
    sourceSymbol: "deleteMediaForCurrentUser",
    expectedMaximumRows: 1,
    rowsBefore: 6,
    rowsAfter: 6,
    rowCountDelta: 0,
    cases: {
      owner: "tombstoned-one-and-audited-once",
      otherOwner: "media.not_found",
      missing: "media.not_found",
      rlsReplay: "exact-update-returned-zero",
      rollback: "tombstone-and-audit-unchanged",
      duplicate: "one-tombstone-one-audit-retained",
      feedPostResidual: "fixture-unlinked-not-proven",
      realtimeResidual: "disabled-no-event-path-proven",
      storageResidual: "loopback-best-effort-error-path-only",
    },
    statementType: "UPDATE",
    tableName: "MediaAsset",
    namedBinds: [
      { name: "deletedAt", positions: [1] },
      { name: "prisma.updatedAt", positions: [2] },
      { name: "media.id", positions: [3] },
    ],
    status: "verified",
  },
  {
    queryId: "DB.ACCOUNT.DELETION.REQUEST.TRANSACTION",
    sourceFile: "src/lib/account-service.ts",
    sourceSymbol: "requestAccountDeletion",
    expectedMaximumRows: 1,
    rowsBefore: 4,
    rowsAfter: 4,
    rowCountDelta: 0,
    cases: {
      owner: "updated-one-and-audited-once",
      lastAdmin: "admin.last_admin_forbidden",
      missing: "transaction-rejected-no-audit",
      otherUserRls: "exact-update-returned-zero",
      rollback: "user-and-audit-rolled-back",
      repeat: "second-request-updated-and-audited-once",
      advisoryLock: "captured-on-service-transaction",
      auditRls: "exact-insert-returning-rejected",
      auditPolicyResidual: "insert-with-check-true-remains",
    },
    statementType: "UPDATE",
    tableName: "User",
    namedBinds: [
      { name: "deletionRequestEmail", positions: [1] },
      { name: "isBanned", positions: [2] },
      { name: "deletionRequestedAt", positions: [3] },
      { name: "prisma.updatedAt", positions: [4] },
      { name: "current.dbUserId", positions: [5] },
    ],
    variants: [
      {
        variant: "user-update",
        statementType: "UPDATE",
        tableName: "User",
        namedBinds: [
          { name: "deletionRequestEmail", positions: [1] },
          { name: "isBanned", positions: [2] },
          { name: "deletionRequestedAt", positions: [3] },
          { name: "prisma.updatedAt", positions: [4] },
          { name: "current.dbUserId", positions: [5] },
        ],
      },
      {
        variant: "audit-insert",
        statementType: "INSERT",
        tableName: "AuditLog",
        namedBinds: [
          { name: "current.dbUserId.actor", positions: [1] },
          { name: "actorType", positions: [2] },
          { name: "action", positions: [3] },
          { name: "targetType", positions: [4] },
          { name: "current.dbUserId.target", positions: [5] },
          { name: "request.ip", positions: [6] },
          { name: "request.userAgent", positions: [7] },
          { name: "audit.metadata", positions: [8] },
          { name: "prisma.createdAt", positions: [9] },
        ],
      },
    ],
    status: "verified",
  },
  {
    queryId: "DB.RACING.DOG.OPEN.OWNERSHIP.SELECT",
    sourceFile: "src/lib/queries.ts",
    sourceSymbol: "getMyDogOwnership",
    expectedMaximumRows: 1,
    rowsBefore: 1,
    rowsAfter: 1,
    rowCountDelta: 0,
    cases: {
      claimant: "returned-four-field-rejected-projection",
      crossProfileService: "returned-null",
      crossProfileRlsReplay: "exact-select-returned-zero",
      anonymousRlsReplay: "exact-select-returned-zero",
      systemReplay: "exact-select-returned-one",
      missing: "returned-null",
      repeat: "same-row-and-sql-shape",
      readOnly: "row-count-unchanged",
      deployedParityResidual: "local-disposable-runtime-only",
    },
    statementType: "SELECT",
    tableName: "DogOwnership",
    namedBinds: [
      { name: "route.dogId", positions: [1] },
      { name: "current.profileId", positions: [2] },
      { name: "prisma.take", positions: [3] },
      { name: "prisma.skip", positions: [4] },
    ],
    status: "verified",
  },
  {
    queryId: "DB.BILLING.STRIPE_WEBHOOK_EVENT.INSERT",
    sourceFile: "src/lib/billing/stripe-webhooks.ts",
    sourceSymbol: "ingestStripeWebhook",
    expectedMaximumRows: 1,
    rowsBefore: 0,
    rowsAfter: 1,
    rowCountDelta: 1,
    cases: {
      invalidSignature: "rejected-before-database-write",
      verifiedSignature: "created-one-sanitized-receipt",
      systemContext: "committed-under-nobypassrls-runtime-role",
      memberRlsReplay: "exact-insert-rejected",
      anonymousRlsReplay: "exact-insert-rejected",
      moderatorPolicy: "exact-insert-allowed-then-rolled-back",
      duplicate: "one-row-retained-retry-count-incremented",
      conflict: "same-event-different-payload-rejected-without-overwrite",
      redaction: "signature-and-data-object-not-persisted",
      providerResidual: "stripe-network-and-delivery-not-contacted",
      deployedParityResidual: "local-disposable-runtime-only",
    },
    statementType: "INSERT",
    tableName: "WebhookEvent",
    namedBinds: [
      { name: "webhookEvent.id", positions: [1] },
      { name: "provider", positions: [2] },
      { name: "stripeEvent.id", positions: [3] },
      { name: "stripeEvent.type", positions: [4] },
      { name: "status", positions: [5] },
      { name: "payloadHash", positions: [6] },
      { name: "auditPayload", positions: [7] },
      { name: "safeHeaders", positions: [8] },
      { name: "retryCount", positions: [9] },
      { name: "prisma.timestamps", positions: [10, 11, 12] },
    ],
    status: "verified",
  },
  {
    queryId: "DB.RACING.TRACK.OPEN.DETAIL_BUNDLE",
    sourceFile: "src/lib/queries.ts",
    sourceSymbol: "getTrackById",
    expectedMaximumRows: 1_536,
    rowsBefore: 1,
    rowsAfter: 1,
    rowCountDelta: 0,
    cases: {
      public: "returned-complete-track-meeting-race-runner-dog-result-graph",
      anonymousRlsReplay: "all-six-exact-selects-returned-reviewed-public-rows",
      missing: "returned-null-after-one-bounded-track-select",
      topLevel: "one-track",
      meetings: "maximum-eight",
      raceQuery: "maximum-128-with-sixteen-returned-per-meeting",
      runnerQuery: "maximum-1536-with-twelve-returned-per-race",
      populatedBranches: "dog-and-result-relations-observed",
      mutation: "none",
      deployedParityResidual: "local-disposable-runtime-only",
    },
    statementType: "SELECT",
    tableName: "Track",
    namedBinds: [
      { name: "route.trackId", positions: [1] },
      { name: "prisma.take", positions: [2] },
      { name: "prisma.skip", positions: [3] },
    ],
    variants: [
      {
        variant: "track",
        statementType: "SELECT",
        tableName: "Track",
        namedBinds: [
          { name: "route.trackId", positions: [1] },
          { name: "prisma.take", positions: [2] },
          { name: "prisma.skip", positions: [3] },
        ],
      },
      {
        variant: "meetings",
        statementType: "SELECT",
        tableName: "Meeting",
        namedBinds: [
          { name: "route.trackId", positions: [1] },
          { name: "meeting.limit", positions: [2] },
          { name: "prisma.skip", positions: [3] },
        ],
      },
      {
        variant: "races",
        statementType: "SELECT",
        tableName: "Race",
        namedBinds: [
          { name: "meeting.id", positions: [1] },
          { name: "race.queryLimit", positions: [2] },
          { name: "prisma.skip", positions: [3] },
        ],
      },
      {
        variant: "runners",
        statementType: "SELECT",
        tableName: "Runner",
        namedBinds: [
          { name: "loaded.raceIds", positions: [1, 2] },
          { name: "runner.queryLimit", positions: [3] },
          { name: "prisma.skip", positions: [4] },
        ],
      },
      {
        variant: "dogs",
        statementType: "SELECT",
        tableName: "Dog",
        namedBinds: [
          { name: "loaded.dogIds", positions: [1] },
          { name: "prisma.skip", positions: [2] },
        ],
      },
      {
        variant: "results",
        statementType: "SELECT",
        tableName: "Result",
        namedBinds: [
          { name: "loaded.runnerIds", positions: [1, 2] },
          { name: "prisma.skip", positions: [3] },
        ],
      },
    ],
    status: "verified",
  },
  {
    queryId: "DB.ACCOUNT.DATA_EXPORT.AUDIT.INSERT",
    sourceFile: "src/lib/account-service.ts",
    sourceSymbol: "recordUserExportCompletion",
    expectedMaximumRows: 1,
    rowsBefore: 0,
    rowsAfter: 2,
    rowCountDelta: 2,
    cases: {
      routeBinding: "source-bound-post-delegates-to-atomic-service",
      owner: "created-one-under-member-request-context",
      otherUserRlsReplay: "exact-insert-rejected",
      anonymousRlsReplay: "exact-insert-rejected",
      ownerRlsReplay: "exact-insert-allowed-then-rolled-back",
      atomicRollback: "artifact-rejection-rolled-back-audit",
      repeat: "second-pair-created-with-same-bounded-sql-shape",
      deployedParityResidual: "local-disposable-runtime-only",
      metadata: "size-schema-counts-only-no-export-body",
      visibility: "actor-only-for-members",
    },
    statementType: "INSERT",
    tableName: "AuditLog",
    namedBinds: [
      { name: "current.dbUserId.actor", positions: [1] },
      { name: "actorType", positions: [2] },
      { name: "action", positions: [3] },
      { name: "targetType", positions: [4] },
      { name: "current.dbUserId.target", positions: [5] },
      { name: "request.ip", positions: [6] },
      { name: "request.userAgent", positions: [7] },
      { name: "audit.metadata", positions: [8] },
      { name: "prisma.createdAt", positions: [9] },
    ],
    status: "verified",
  },
  {
    queryId: "DB.ACCOUNT.DATA_EXPORT.ARTIFACT.INSERT",
    sourceFile: "src/lib/account-service.ts",
    sourceSymbol: "recordUserExportCompletion",
    expectedMaximumRows: 1,
    rowsBefore: 0,
    rowsAfter: 2,
    rowCountDelta: 2,
    cases: {
      routeBinding: "source-bound-post-delegates-to-atomic-service",
      owner: "created-one-under-member-request-context",
      otherUserRlsReplay: "exact-insert-rejected",
      anonymousRlsReplay: "exact-insert-rejected",
      ownerRlsReplay: "exact-insert-allowed-then-rolled-back",
      atomicRollback: "artifact-rejection-rolled-back-audit",
      repeat: "second-pair-created-with-same-bounded-sql-shape",
      deployedParityResidual: "local-disposable-runtime-only",
      shapePolicy: "storage-and-organization-fields-rejected",
      ownerMutation: "update-and-delete-returned-zero",
      expiry: "exactly-seven-days-after-completion",
      visibility: "target-or-requester-only-for-members",
    },
    statementType: "INSERT",
    tableName: "ExportArtifact",
    namedBinds: [
      { name: "exportArtifact.id", positions: [1] },
      { name: "exportType", positions: [2] },
      { name: "status", positions: [3] },
      { name: "current.dbUserId.target", positions: [4] },
      { name: "current.dbUserId.requester", positions: [5] },
      { name: "sizeBytes", positions: [6] },
      { name: "exportedAt", positions: [7] },
      { name: "expiresAt", positions: [8] },
      { name: "prisma.timestamps", positions: [9, 10] },
    ],
    status: "verified",
  },
] as const;

const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "auditKind",
  "generatedAt",
  "safety",
  "runtimeIdentity",
  "sourceBinding",
  "collisionRollbackProbes",
  "databaseOperationProofs",
  "firstRun",
  "secondRun",
  "providerInitial",
  "providerBefore",
  "providerAfter",
  "cleanup",
  "verdict",
] as const;
const RUNTIME_IDENTITY_KEYS = [
  "role",
  "sessionRole",
  "database",
  "schema",
  "canLogin",
  "superuser",
  "bypassRls",
] as const;
const SAFETY_KEYS = [
  "scope",
  "host",
  "port",
  "database",
  "runtimeRole",
  "runtimeSessionRole",
  "productionOrProviderSystemsContacted",
  "cleanup",
  "elevatedAdminUsedForVerification",
  "elevatedAdminUsedForCleanupOnly",
  "externalRealtimeAndNetworkEffects",
] as const;
const SOURCE_BINDING_KEYS = ["files", "assets", "combinedSha256"] as const;
const ASSET_BINDING_KEYS = [
  "sha256",
  "sizeBytes",
  "publicUrl",
  "provenanceId",
] as const;
const SNAPSHOT_KEYS = [
  "privateRowCount",
  "referenceRowCount",
  "modelCounts",
  "fixtureSha256",
] as const;
const PROVIDER_SNAPSHOT_KEYS = ["counts", "rowsSha256"] as const;
const CLEANUP_KEYS = [
  "role",
  "purpose",
  "deleted",
  "finalPrivateRows",
  "finalProviderRows",
] as const;
const DATABASE_OPERATION_PROOF_KEYS = [
  "queryId",
  "sourceFile",
  "sourceSymbol",
  "runtimeIdentity",
  "expectedMaximumRows",
  "rowsBefore",
  "rowsAfter",
  "rowCountDelta",
  "cases",
  "observedSql",
  "explain",
  "variants",
  "status",
] as const;
const DATABASE_OPERATION_VARIANT_KEYS = [
  "variant",
  "observedSql",
  "explain",
] as const;
const OBSERVED_SQL_KEYS = [
  "statementType",
  "normalizedSql",
  "sha256",
  "parameterCount",
  "namedBinds",
  "persistedParameterValues",
] as const;
const NAMED_BIND_KEYS = ["name", "positions"] as const;
const EXPLAIN_KEYS = [
  "format",
  "analyze",
  "buffers",
  "statementTimeoutMilliseconds",
  "sanitized",
  "plan",
  "planSha256",
] as const;
const EXPLAIN_PLAN_NODE_KEYS = [
  "nodeType",
  "relationName",
  "indexName",
  "joinType",
  "scanDirection",
  "estimatedRows",
  "totalCost",
  "children",
] as const;

const EXPECTED_SAFETY = {
  scope: "literal-loopback-disposable-replay-only",
  host: "127.0.0.1",
  port: 55734,
  database: "greyhoundiq",
  runtimeRole: "greyhoundiq_runtime",
  runtimeSessionRole: "greyhoundiq_runtime",
  productionOrProviderSystemsContacted: false,
  cleanup:
    "A separately guarded postgres session removed only exact verifier-owned identifiers, including the auth-acceptance, signed Stripe receipt, user-export audit/artifact and rejected DogOwnership probe graphs, and the exact synthetic conversation-block, media-delete and account-deletion audit scopes after runtime verification completed.",
  elevatedAdminUsedForVerification: false,
  elevatedAdminUsedForCleanupOnly: true,
  externalRealtimeAndNetworkEffects:
    "Realtime broadcast was disabled; Stripe signature generation and verification used a synthetic local secret without provider delivery or network access; Storage cleanup was directed only to a loopback-unreachable endpoint with a rejected placeholder service role, so the real best-effort error path ran without any provider or external network access.",
} as const;

const EXPECTED_CLEANUP_DELETIONS = {
  ...DEMO_FIXTURE_EXPECTED_MODEL_COUNTS,
  UserCollisionProbe: 0,
  AuthAcceptanceRestoreAuditLog: 1,
  AuthAcceptanceSignupOutbox: 1,
  AuthAcceptanceSocialActor: 1,
  AuthAcceptanceProfile: 1,
  AuthAcceptanceUser: 1,
  StripeWebhookOperationProbe: 1,
  UserExportAuditLog: 2,
  UserExportArtifact: 2,
  SignupOutbox: 2,
  AccountDeletionAuditLog: 2,
  MediaDeleteAuditLog: 1,
  UserBlock: 0,
  ConversationBlockAuditLog: 3,
  DogOwnershipOperationProbe: 1,
  Race: 1,
  Meeting: 1,
  Track: 1,
  Dog: 1,
} as const;

const EMPTY_PROVIDER_ROWS_SHA256 = sha256(
  JSON.stringify({ Dog: [], Meeting: [], Race: [], Track: [] }),
);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CREDENTIAL_URL_PATTERN =
  /(?:postgres(?:ql)?|redis(?:s)?|https?):\/\/[^/\s"'@]+:[^/\s"'@]+@/i;
const BEARER_OR_PRIVATE_KEY_PATTERN =
  /(?:Bearer\s+[A-Za-z0-9._~+/=-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const CREDENTIAL_KEY_PATTERN =
  /^(?:password|passwd|secret|token|accessToken|refreshToken|authorization|apiKey|api_key|credential|credentials)$/i;

export type DemoFixtureSourceBinding = ReturnType<
  typeof buildDemoFixtureSourceBinding
>;

export type DemoFixtureEvidenceValidationOptions = {
  root?: string;
  now?: Date;
  maxAgeMs?: number;
};

export function buildDemoFixtureSourceBinding(root = process.cwd()) {
  const files = Object.fromEntries(
    DEMO_FIXTURE_BOUND_SOURCE_FILES.map((file) => [
      file,
      sha256(readFileSync(resolve(root, file))),
    ]),
  );
  const assets = Object.fromEntries(
    DEMO_FIXTURE_APPROVED_ASSETS.map((asset) => {
      const bytes = readFileSync(resolve(root, asset.filePath));
      assert.equal(
        bytes.byteLength,
        asset.sizeBytes,
        `fixture source asset size changed: ${asset.filePath}`,
      );
      assert.equal(
        sha256(bytes),
        asset.sha256,
        `fixture source asset hash changed: ${asset.filePath}`,
      );
      return [
        asset.filePath,
        {
          sha256: asset.sha256,
          sizeBytes: asset.sizeBytes,
          publicUrl: asset.publicUrl,
          provenanceId: asset.provenance.id,
        },
      ];
    }),
  );
  return {
    files,
    assets,
    combinedSha256: sha256(JSON.stringify({ files, assets })),
  };
}

export function validateDemoFixtureEvidence(
  value: unknown,
  options: DemoFixtureEvidenceValidationOptions = {},
) {
  assertContainsNoCredentials(value);
  const evidence = exactObject(value, TOP_LEVEL_KEYS, "evidence");

  assert.equal(
    evidence.schemaVersion,
    DEMO_FIXTURE_EVIDENCE_SCHEMA_VERSION,
    "evidence.schemaVersion",
  );
  assert.equal(
    evidence.auditKind,
    "synthetic-private-fixture-idempotency",
    "evidence.auditKind",
  );
  assert.equal(evidence.verdict, "verified", "evidence.verdict");
  validateTimestamp(
    evidence.generatedAt,
    options.now ?? new Date(),
    options.maxAgeMs ?? DEMO_FIXTURE_EVIDENCE_MAX_AGE_MS,
  );

  const safety = exactObject(evidence.safety, SAFETY_KEYS, "evidence.safety");
  assert.deepEqual(safety, EXPECTED_SAFETY, "evidence.safety values");

  const runtimeIdentity = exactObject(
    evidence.runtimeIdentity,
    RUNTIME_IDENTITY_KEYS,
    "evidence.runtimeIdentity",
  );
  assert.deepEqual(
    runtimeIdentity,
    DEMO_FIXTURE_EXPECTED_RUNTIME_IDENTITY,
    "evidence.runtimeIdentity values",
  );

  validateSourceBinding(
    evidence.sourceBinding,
    buildDemoFixtureSourceBinding(options.root),
  );

  assert.ok(
    Array.isArray(evidence.collisionRollbackProbes),
    "evidence.collisionRollbackProbes must be an array",
  );
  assert.deepEqual(
    evidence.collisionRollbackProbes,
    DEMO_FIXTURE_EXPECTED_PROBES,
    "evidence.collisionRollbackProbes",
  );
  assert.ok(
    Array.isArray(evidence.databaseOperationProofs),
    "evidence.databaseOperationProofs must be an array",
  );
  validateDatabaseOperationProofs(evidence.databaseOperationProofs);

  const first = validateFixtureSnapshot(evidence.firstRun, "evidence.firstRun");
  const second = validateFixtureSnapshot(
    evidence.secondRun,
    "evidence.secondRun",
  );
  assert.equal(
    second.fixtureSha256,
    first.fixtureSha256,
    "fixture hashes differ between idempotency runs",
  );
  assert.equal(
    first.fixtureSha256,
    DEMO_FIXTURE_EXPECTED_PAYLOAD_SHA256,
    "fixture payload hash does not match the reviewed deterministic graph",
  );

  const providerInitial = validateProviderSnapshot(
    evidence.providerInitial,
    DEMO_FIXTURE_EXPECTED_PROVIDER_EMPTY_COUNTS,
    "evidence.providerInitial",
  );
  assert.equal(
    providerInitial.rowsSha256,
    EMPTY_PROVIDER_ROWS_SHA256,
    "evidence.providerInitial.rowsSha256",
  );
  const providerBefore = validateProviderSnapshot(
    evidence.providerBefore,
    DEMO_FIXTURE_EXPECTED_PROVIDER_SENTINEL_COUNTS,
    "evidence.providerBefore",
  );
  const providerAfter = validateProviderSnapshot(
    evidence.providerAfter,
    DEMO_FIXTURE_EXPECTED_PROVIDER_SENTINEL_COUNTS,
    "evidence.providerAfter",
  );
  assert.equal(
    providerAfter.rowsSha256,
    providerBefore.rowsSha256,
    "provider rows changed during fixture verification",
  );
  assert.equal(
    providerBefore.rowsSha256,
    DEMO_FIXTURE_EXPECTED_PROVIDER_SENTINEL_SHA256,
    "provider sentinel hash does not match the reviewed deterministic rows",
  );

  validateCleanup(evidence.cleanup);
  return evidence;
}

function validateDatabaseOperationProofs(value: unknown[]) {
  assert.equal(
    value.length,
    DEMO_FIXTURE_EXPECTED_DATABASE_OPERATION_PROOFS.length,
    "evidence.databaseOperationProofs length",
  );
  value.forEach((entry, index) => {
    const expected = DEMO_FIXTURE_EXPECTED_DATABASE_OPERATION_PROOFS[index];
    const label = `evidence.databaseOperationProofs.${index}`;
    const proof = exactObject(entry, DATABASE_OPERATION_PROOF_KEYS, label);
    assert.deepEqual(
      {
        queryId: proof.queryId,
        sourceFile: proof.sourceFile,
        sourceSymbol: proof.sourceSymbol,
        expectedMaximumRows: proof.expectedMaximumRows,
        rowsBefore: proof.rowsBefore,
        rowsAfter: proof.rowsAfter,
        rowCountDelta: proof.rowCountDelta,
        cases: proof.cases,
        status: proof.status,
      },
      {
        queryId: expected.queryId,
        sourceFile: expected.sourceFile,
        sourceSymbol: expected.sourceSymbol,
        expectedMaximumRows: expected.expectedMaximumRows,
        rowsBefore: expected.rowsBefore,
        rowsAfter: expected.rowsAfter,
        rowCountDelta: expected.rowCountDelta,
        cases: expected.cases,
        status: expected.status,
      },
      `${label} reviewed outcome`,
    );
    const runtimeIdentity = exactObject(
      proof.runtimeIdentity,
      RUNTIME_IDENTITY_KEYS,
      `${label}.runtimeIdentity`,
    );
    assert.deepEqual(
      runtimeIdentity,
      DEMO_FIXTURE_EXPECTED_RUNTIME_IDENTITY,
      `${label}.runtimeIdentity values`,
    );
    validateObservedSql(proof.observedSql, expected, `${label}.observedSql`);
    validateExplain(proof.explain, expected.tableName, `${label}.explain`);
    assert.ok(Array.isArray(proof.variants), `${label}.variants`);
    if ("variants" in expected) {
      assert.equal(
        proof.variants.length,
        expected.variants.length,
        `${label}.variants length`,
      );
      proof.variants.forEach((entry, variantIndex) => {
        const expectedVariant = expected.variants[variantIndex];
        const variantLabel = `${label}.variants.${variantIndex}`;
        const variant = exactObject(
          entry,
          DATABASE_OPERATION_VARIANT_KEYS,
          variantLabel,
        );
        assert.equal(
          variant.variant,
          expectedVariant.variant,
          `${variantLabel}.variant`,
        );
        validateObservedSql(
          variant.observedSql,
          expectedVariant,
          `${variantLabel}.observedSql`,
        );
        validateExplain(
          variant.explain,
          expectedVariant.tableName,
          `${variantLabel}.explain`,
        );
      });
      assert.deepEqual(
        proof.observedSql,
        exactObject(
          proof.variants[0],
          DATABASE_OPERATION_VARIANT_KEYS,
          `${label}.variants.0`,
        ).observedSql,
        `${label}.primary observedSql must be the complete variant`,
      );
      assert.deepEqual(
        proof.explain,
        exactObject(
          proof.variants[0],
          DATABASE_OPERATION_VARIANT_KEYS,
          `${label}.variants.0`,
        ).explain,
        `${label}.primary explain must be the complete variant`,
      );
    } else {
      assert.deepEqual(proof.variants, [], `${label}.variants`);
    }
  });
}

type ExpectedObservedSql = {
  statementType: string;
  tableName: string;
  namedBinds: readonly {
    name: string;
    positions: readonly number[];
  }[];
};

function validateObservedSql(
  value: unknown,
  expected: ExpectedObservedSql,
  label: string,
) {
  const observed = exactObject(value, OBSERVED_SQL_KEYS, label);
  assert.equal(
    observed.statementType,
    expected.statementType,
    `${label}.statementType`,
  );
  assert.equal(typeof observed.normalizedSql, "string", `${label}.normalizedSql`);
  const normalizedSql = String(observed.normalizedSql);
  assert.match(
    normalizedSql,
    new RegExp(`^${expected.statementType}\\b`, "i"),
    `${label}.normalizedSql statement`,
  );
  const tableMarkers = expected.statementType === "SELECT"
    ? [`FROM "public"."${expected.tableName}"`, `FROM "${expected.tableName}"`]
    : expected.statementType === "UPDATE"
      ? [
          `UPDATE "public"."${expected.tableName}"`,
          `UPDATE "${expected.tableName}"`,
        ]
      : expected.statementType === "INSERT"
        ? [
            `INSERT INTO "public"."${expected.tableName}"`,
            `INSERT INTO "${expected.tableName}"`,
          ]
        : [`"${expected.tableName}"`];
  assert.ok(
    tableMarkers.some((marker) => normalizedSql.includes(marker)),
    `${label}.normalizedSql table`,
  );
  assert.doesNotMatch(
    normalizedSql,
    /;|--|\/\*/,
    `${label}.normalizedSql must be one uncommented statement`,
  );
  assert.doesNotMatch(
    normalizedSql,
    /demo-|@greyhoundiq\.test/i,
    `${label}.normalizedSql contains a persisted fixture value`,
  );
  assertSha256(observed.sha256, `${label}.sha256`);
  assert.equal(observed.sha256, sha256(normalizedSql), `${label}.sha256 value`);
  assert.equal(
    observed.persistedParameterValues,
    false,
    `${label}.persistedParameterValues`,
  );
  assert.ok(Array.isArray(observed.namedBinds), `${label}.namedBinds`);
  const namedBinds = observed.namedBinds.map((entry, index) => {
    const bind = exactObject(entry, NAMED_BIND_KEYS, `${label}.namedBinds.${index}`);
    assert.equal(typeof bind.name, "string", `${label}.namedBinds.${index}.name`);
    assert.ok(
      Array.isArray(bind.positions) &&
        bind.positions.length > 0 &&
        bind.positions.every(
          (position) => Number.isSafeInteger(position) && Number(position) > 0,
        ),
      `${label}.namedBinds.${index}.positions`,
    );
    return { name: bind.name, positions: bind.positions };
  });
  assert.deepEqual(namedBinds, expected.namedBinds, `${label}.namedBinds values`);
  const expectedParameterCount = expected.namedBinds.reduce(
    (count, bind) => count + bind.positions.length,
    0,
  );
  assert.equal(
    observed.parameterCount,
    expectedParameterCount,
    `${label}.parameterCount`,
  );
  const positions = [...normalizedSql.matchAll(/\$(\d+)\b/g)].map((match) =>
    Number(match[1]),
  );
  assert.deepEqual(
    [...new Set(positions)].sort((left, right) => left - right),
    Array.from({ length: expectedParameterCount }, (_, index) => index + 1),
    `${label}.placeholder positions`,
  );
}

function validateExplain(value: unknown, tableName: string, label: string) {
  const explain = exactObject(value, EXPLAIN_KEYS, label);
  assert.equal(explain.format, "postgresql-json-cost-plan", `${label}.format`);
  assert.equal(explain.analyze, false, `${label}.analyze`);
  assert.equal(explain.buffers, false, `${label}.buffers`);
  assert.equal(
    explain.statementTimeoutMilliseconds,
    5_000,
    `${label}.statementTimeoutMilliseconds`,
  );
  assert.equal(explain.sanitized, true, `${label}.sanitized`);
  const plan = validateExplainPlanNode(explain.plan, `${label}.plan`);
  assert.ok(
    flattenExplainRelations(plan).includes(tableName),
    `${label}.plan must include ${tableName}`,
  );
  assertSha256(explain.planSha256, `${label}.planSha256`);
  assert.equal(
    explain.planSha256,
    sha256(JSON.stringify(plan)),
    `${label}.planSha256 value`,
  );
}

type ValidatedExplainPlanNode = {
  nodeType: string;
  relationName: string | null;
  indexName: string | null;
  joinType: string | null;
  scanDirection: string | null;
  estimatedRows: number;
  totalCost: number;
  children: ValidatedExplainPlanNode[];
};

function validateExplainPlanNode(
  value: unknown,
  label: string,
): ValidatedExplainPlanNode {
  const node = exactObject(value, EXPLAIN_PLAN_NODE_KEYS, label);
  assertNonEmptyString(node.nodeType, `${label}.nodeType`);
  for (const key of [
    "relationName",
    "indexName",
    "joinType",
    "scanDirection",
  ] as const) {
    assert.ok(
      node[key] === null ||
        (typeof node[key] === "string" && String(node[key]).length > 0),
      `${label}.${key}`,
    );
  }
  for (const key of ["estimatedRows", "totalCost"] as const) {
    assert.ok(
      typeof node[key] === "number" &&
        Number.isFinite(node[key]) &&
        Number(node[key]) >= 0,
      `${label}.${key}`,
    );
  }
  assert.ok(Array.isArray(node.children), `${label}.children`);
  return {
    nodeType: String(node.nodeType),
    relationName: node.relationName === null ? null : String(node.relationName),
    indexName: node.indexName === null ? null : String(node.indexName),
    joinType: node.joinType === null ? null : String(node.joinType),
    scanDirection:
      node.scanDirection === null ? null : String(node.scanDirection),
    estimatedRows: Number(node.estimatedRows),
    totalCost: Number(node.totalCost),
    children: node.children.map((child, index) =>
      validateExplainPlanNode(child, `${label}.children.${index}`),
    ),
  };
}

function flattenExplainRelations(node: ValidatedExplainPlanNode): string[] {
  return [
    ...(node.relationName ? [node.relationName] : []),
    ...node.children.flatMap(flattenExplainRelations),
  ];
}

function assertNonEmptyString(value: unknown, label: string) {
  assert.ok(typeof value === "string" && value.length > 0, label);
}

function validateSourceBinding(
  value: unknown,
  expected: DemoFixtureSourceBinding,
) {
  const binding = exactObject(
    value,
    SOURCE_BINDING_KEYS,
    "evidence.sourceBinding",
  );
  const files = exactObject(
    binding.files,
    DEMO_FIXTURE_BOUND_SOURCE_FILES,
    "evidence.sourceBinding.files",
  );
  for (const [file, hash] of Object.entries(files)) {
    assertSha256(hash, `evidence.sourceBinding.files.${file}`);
  }
  const assetPaths = DEMO_FIXTURE_APPROVED_ASSETS.map(
    (asset) => asset.filePath,
  );
  const assets = exactObject(
    binding.assets,
    assetPaths,
    "evidence.sourceBinding.assets",
  );
  for (const [file, assetValue] of Object.entries(assets)) {
    const asset = exactObject(
      assetValue,
      ASSET_BINDING_KEYS,
      `evidence.sourceBinding.assets.${file}`,
    );
    assertSha256(asset.sha256, `evidence.sourceBinding.assets.${file}.sha256`);
    assert.ok(
      Number.isSafeInteger(asset.sizeBytes) && Number(asset.sizeBytes) > 0,
      `evidence.sourceBinding.assets.${file}.sizeBytes`,
    );
    assert.equal(typeof asset.publicUrl, "string");
    assert.equal(typeof asset.provenanceId, "string");
  }
  assertSha256(binding.combinedSha256, "evidence.sourceBinding.combinedSha256");
  assert.deepEqual(binding, expected, "evidence source or asset binding is stale");
}

function validateFixtureSnapshot(value: unknown, label: string) {
  const snapshot = exactObject(value, SNAPSHOT_KEYS, label);
  assert.equal(
    snapshot.privateRowCount,
    DEMO_PRIVATE_FIXTURE_ROW_COUNT,
    `${label}.privateRowCount`,
  );
  assert.equal(snapshot.referenceRowCount, 1, `${label}.referenceRowCount`);
  const modelCounts = exactObject(
    snapshot.modelCounts,
    Object.keys(DEMO_FIXTURE_EXPECTED_MODEL_COUNTS),
    `${label}.modelCounts`,
  );
  assert.deepEqual(
    modelCounts,
    DEMO_FIXTURE_EXPECTED_MODEL_COUNTS,
    `${label}.modelCounts values`,
  );
  assert.equal(
    Object.values(modelCounts).reduce((sum, count) => sum + Number(count), 0),
    DEMO_PRIVATE_FIXTURE_ROW_COUNT,
    `${label}.modelCounts total`,
  );
  assertSha256(snapshot.fixtureSha256, `${label}.fixtureSha256`);
  return snapshot;
}

function validateProviderSnapshot(
  value: unknown,
  expectedCounts: Record<string, number>,
  label: string,
) {
  const snapshot = exactObject(value, PROVIDER_SNAPSHOT_KEYS, label);
  const counts = exactObject(
    snapshot.counts,
    Object.keys(expectedCounts),
    `${label}.counts`,
  );
  assert.deepEqual(counts, expectedCounts, `${label}.counts values`);
  assertSha256(snapshot.rowsSha256, `${label}.rowsSha256`);
  return snapshot;
}

function validateCleanup(value: unknown) {
  const cleanup = exactObject(value, CLEANUP_KEYS, "evidence.cleanup");
  assert.equal(cleanup.role, "postgres", "evidence.cleanup.role");
  assert.equal(cleanup.purpose, "cleanup-only", "evidence.cleanup.purpose");
  const deleted = exactObject(
    cleanup.deleted,
    Object.keys(EXPECTED_CLEANUP_DELETIONS),
    "evidence.cleanup.deleted",
  );
  assert.deepEqual(
    deleted,
    EXPECTED_CLEANUP_DELETIONS,
    "evidence.cleanup.deleted values",
  );
  assert.equal(cleanup.finalPrivateRows, 0, "evidence.cleanup.finalPrivateRows");
  const providerRows = exactObject(
    cleanup.finalProviderRows,
    Object.keys(DEMO_FIXTURE_EXPECTED_PROVIDER_EMPTY_COUNTS),
    "evidence.cleanup.finalProviderRows",
  );
  assert.deepEqual(
    providerRows,
    DEMO_FIXTURE_EXPECTED_PROVIDER_EMPTY_COUNTS,
    "evidence.cleanup.finalProviderRows values",
  );
}

function validateTimestamp(value: unknown, now: Date, maxAgeMs: number) {
  assert.equal(typeof value, "string", "evidence.generatedAt must be a string");
  const timestamp = new Date(value as string);
  assert.ok(
    Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === value,
    "evidence.generatedAt must be a canonical ISO timestamp",
  );
  assert.ok(
    timestamp.getTime() <= now.getTime() + 5 * 60 * 1_000,
    "evidence.generatedAt is in the future",
  );
  assert.ok(
    now.getTime() - timestamp.getTime() <= maxAgeMs,
    "evidence.generatedAt is stale",
  );
}

function exactObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
) {
  assert.ok(
    value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype,
    `${label} must be a plain object`,
  );
  const record = value as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(record).sort(),
    [...expectedKeys].sort(),
    `${label} keys`,
  );
  return record;
}

function assertSha256(value: unknown, label: string) {
  assert.ok(
    typeof value === "string" && SHA256_PATTERN.test(value),
    `${label} must be a lowercase sha256`,
  );
}

function assertContainsNoCredentials(value: unknown) {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("evidence must be JSON serializable");
  }
  assert.doesNotMatch(
    serialized,
    CREDENTIAL_URL_PATTERN,
    "evidence contains a password-bearing URL",
  );
  assert.doesNotMatch(
    serialized,
    BEARER_OR_PRIVATE_KEY_PATTERN,
    "evidence contains credential material",
  );
  scanCredentialKeys(value, "evidence");
}

function scanCredentialKeys(value: unknown, label: string) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanCredentialKeys(entry, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    assert.ok(!CREDENTIAL_KEY_PATTERN.test(key), `${label}.${key} is credential material`);
    scanCredentialKeys(entry, `${label}.${key}`);
  }
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
