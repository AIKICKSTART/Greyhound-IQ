import type { VerificationStatus } from "./shared";
import { MANDATORY_PUBLIC_RACING_DATABASE_OPERATIONS } from "./mandatory-public-racing-database-operations";

export const DATABASE_OPERATION_TYPES = [
  "select",
  "insert",
  "update",
  "delete",
  "upsert",
  "procedure",
  "transaction",
] as const;

export type DatabaseOperationContract = {
  queryId: string;
  traceId: string;

  sourceFile: string;
  sourceSymbol: string;
  ormOrDriver: string;
  ormOperation: string;

  normalizedSql?: string | null;
  normalizedSqlArtifact?: string | null;
  normalizedSqlVariants?: readonly {
    variant: string;
    normalizedSql: string;
    boundParameters: readonly string[];
    explainPlanEvidence: string;
  }[];
  storedProcedure?: string | null;
  databaseFunction?: string | null;

  databaseRole: string;
  databaseName: string;
  schemaName: string;

  operationType: (typeof DATABASE_OPERATION_TYPES)[number];

  tables: string[];
  views: string[];
  columnsRead: string[];
  columnsWritten: string[];

  boundParameters: string[];
  parameterized: boolean;

  tenantPredicate?: string | null;
  ownershipPredicate?: string | null;
  visibilityPredicate?: string | null;
  rowLevelSecurityPolicies: string[];

  expectedRowCount: string;
  maximumRowCount?: number | null;
  paginationRequired: boolean;

  transactionBoundary?: string | null;
  isolationLevel?: string | null;
  locks?: string[];
  concurrencyControl?: string;

  indexesExpected: string[];
  constraintsReliedOn: string[];
  triggersInvoked: string[];

  timeoutMilliseconds?: number | null;
  explainPlanEvidence?: string | null;

  sensitiveColumns: string[];
  returnedDataShape: string;

  notFoundBehaviour: string;
  unauthorizedBehaviour: string;
  conflictBehaviour: string;
  failureBehaviour: string;

  tests: string[];
  evidence: string[];
  verificationStatus: VerificationStatus;
};

const requestTransaction = "withDbRequestContext Prisma transaction";
const systemTransaction = "withDbSystemContext Prisma transaction";

const DATABASE_OPERATION_RECORDS: readonly DatabaseOperationContract[] = [
  {
    queryId: "DB.ONBOARDING.ANALYTICS.RATE_LIMIT",
    traceId: "ONBOARDING.ANALYTICS.RECORD",
    sourceFile: "src/lib/rate-limit.ts",
    sourceSymbol: "checkRateLimit",
    ormOrDriver: "Prisma tagged SQL",
    ormOperation:
      "atomic insert-or-increment of the single non-identifying onboarding analytics rate-limit window",
    normalizedSql:
      'INSERT INTO "RateLimit" ("key","count","resetAt") VALUES ($1, 1, now() + make_interval(secs => $2)) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END, "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN now() + make_interval(secs => $3) ELSE "RateLimit"."resetAt" END RETURNING "count", "resetAt"',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "upsert",
    tables: ["RateLimit"],
    views: [],
    columnsRead: ["key", "count", "resetAt"],
    columnsWritten: ["key", "count", "resetAt"],
    boundParameters: [
      "constant analytics:onboarding:global key ($1)",
      "60-second window ($2 and $3)",
    ],
    parameterized: true,
    rowLevelSecurityPolicies: ["giq_rate_limit_all"],
    expectedRowCount: "exactly one returned counter row in a healthy database",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary: systemTransaction,
    locks: ["row-level conflict lock on RateLimit_pkey"],
    concurrencyControl:
      "PostgreSQL ON CONFLICT performs one atomic increment for the shared global key",
    indexesExpected: ["RateLimit_pkey"],
    constraintsReliedOn: ["RateLimit_pkey unique key"],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/onboarding-analytics-rate-limit.json: sanitized PostgreSQL JSON COSTS ModifyTable -> Result plan for the exact observed INSERT ... ON CONFLICT statement, with ANALYZE and BUFFERS disabled and a 5 s EXPLAIN statement timeout; normalized SQL SHA-256 8ad6feb381e6420b57fd3646cb0fe5ef14fa7883a9db4ac5b2c4017168a778f0 and plan SHA-256 ab6cc659ffe3b6fa65ba3693325cf35229d2b983992299dda0bd2c59f201c8cd are source-bound and integrity-validated.",
    sensitiveColumns: [],
    returnedDataShape: "count and resetAt only; neither field identifies a user or device",
    notFoundBehaviour:
      "A no-row development stub falls back to the bounded per-process limiter; production PostgreSQL INSERT RETURNING is expected to return one row.",
    unauthorizedBehaviour:
      "The public route cannot select or mutate RateLimit directly; only the server system-context helper owns the operation.",
    conflictBehaviour:
      "Concurrent requests serialize through ON CONFLICT and increment the current window rather than creating duplicate keys.",
    failureBehaviour:
      "The onboarding route calls checkRateLimit with failClosed: true, so database errors deny ingestion with 429 and no analytics body is read.",
    tests: [
      "src/lib/rate-limit.test.ts",
      "src/app/api/analytics/onboarding/route.test.ts",
      "scripts/check-onboarding-analytics-rate-limit-postgres.test.ts",
    ],
    evidence: [
      "The route uses a constant global key, checks the distributed limiter before streaming the 512-byte body and supplies failClosed: true.",
      "output/database-audit/onboarding-analytics-rate-limit.json schema v1 binds the exact production upsert to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public on literal loopback port 55734 and proves the system-only forced-RLS policy, UNLOGGED table and both indexes.",
      "Eight concurrent production calls from count 5,996 finished at 6,004 with exactly four allowed and four denied decisions; an expired count of 42 reset atomically to one, while request and anonymous contexts were denied by RLS.",
      "A real database decision at the 6,000 limit produced HTTP 429 before analytics recording, and exact cleanup removed the sole fixed-key row. Managed staging/production role/catalog parity and a deployed load test remain separate gates.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.AUTH.CALLBACK.ACCEPTANCE.TRANSACTION",
    traceId: "AUTH.CALLBACK.COMPLETE",
    sourceFile: "src/lib/auth-sync.ts",
    sourceSymbol: "syncAuthUser",
    ormOrDriver: "Prisma",
    ormOperation:
      "find local user, create or update User/Profile/SocialActor, optionally insert the pending-deletion restoration AuditLog, and upsert SignupOutbox in one withDbSystemContext transaction",
    normalizedSql:
      'SELECT "public"."User"."id", "public"."User"."email", "public"."User"."name", "public"."User"."subscriptionTier", "public"."User"."stripeCustomerId", "public"."User"."stripeSubscriptionId", "public"."User"."isBanned", "public"."User"."deletionRequestedAt", "public"."User"."createdAt", "public"."User"."updatedAt", "public"."User"."workosUserId" FROM "public"."User" WHERE ("public"."User"."workosUserId" = $1 OR "public"."User"."email" = $2) ORDER BY "public"."User"."createdAt" ASC LIMIT $3 OFFSET $4',
    normalizedSqlVariants: [
      {
        variant: "verified-identity-lookup",
        normalizedSql:
          'SELECT "public"."User"."id", "public"."User"."email", "public"."User"."name", "public"."User"."subscriptionTier", "public"."User"."stripeCustomerId", "public"."User"."stripeSubscriptionId", "public"."User"."isBanned", "public"."User"."deletionRequestedAt", "public"."User"."createdAt", "public"."User"."updatedAt", "public"."User"."workosUserId" FROM "public"."User" WHERE ("public"."User"."workosUserId" = $1 OR "public"."User"."email" = $2) ORDER BY "public"."User"."createdAt" ASC LIMIT $3 OFFSET $4',
        boundParameters: [
          "provider subject ($1)",
          "provider-verified email ($2)",
          "Prisma take=1 ($3)",
          "Prisma offset=0 ($4)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS Limit plan over User with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "unverified-identity-lookup",
        normalizedSql:
          'SELECT "public"."User"."id", "public"."User"."email", "public"."User"."name", "public"."User"."subscriptionTier", "public"."User"."stripeCustomerId", "public"."User"."stripeSubscriptionId", "public"."User"."isBanned", "public"."User"."deletionRequestedAt", "public"."User"."createdAt", "public"."User"."updatedAt", "public"."User"."workosUserId" FROM "public"."User" WHERE "public"."User"."workosUserId" = $1 ORDER BY "public"."User"."createdAt" ASC LIMIT $2 OFFSET $3',
        boundParameters: [
          "provider subject ($1)",
          "Prisma take=1 ($2)",
          "Prisma offset=0 ($3)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS Limit plan over User with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "user-insert",
        normalizedSql:
          'INSERT INTO "public"."User" ("id","email","name","subscriptionTier","isBanned","createdAt","updatedAt","workosUserId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING "public"."User"."id"',
        boundParameters: [
          "generated User.id ($1)",
          "provider email ($2)",
          "server-derived display name ($3)",
          "free subscription tier ($4)",
          "isBanned=false ($5)",
          "Prisma createdAt/updatedAt ($6, $7)",
          "provider subject ($8)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS ModifyTable plan over User with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "profile-insert",
        normalizedSql:
          'INSERT INTO "public"."Profile" ("id","userId","displayName","role","verified","isFounder","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING "public"."Profile"."id", "public"."Profile"."userId", "public"."Profile"."displayName", "public"."Profile"."bio", "public"."Profile"."avatarUrl", "public"."Profile"."state", "public"."Profile"."kennelName", "public"."Profile"."kennelPrefix", "public"."Profile"."role", "public"."Profile"."verified", "public"."Profile"."isFounder", "public"."Profile"."website", "public"."Profile"."phone", "public"."Profile"."createdAt", "public"."Profile"."updatedAt"',
        boundParameters: [
          "generated Profile.id ($1)",
          "created User.id ($2)",
          "server-derived display name ($3)",
          "member role ($4)",
          "verified/isFounder defaults ($5, $6)",
          "Prisma createdAt/updatedAt ($7, $8)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS ModifyTable plan over Profile with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "social-actor-upsert",
        normalizedSql:
          'INSERT INTO "public"."SocialActor" ("id","kind","profileId","ownerProfileId","handle","displayName","avatarUrl","avatarFocalX","avatarFocalY","avatarZoom","avatarRotation","coverFocalX","coverFocalY","coverZoom","coverRotation","profileVisibility","contactVisibility","published","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ON CONFLICT ("profileId") DO UPDATE SET "displayName" = $21, "avatarUrl" = $22, "published" = $23, "updatedAt" = $24 WHERE ("public"."SocialActor"."profileId" = $25 AND 1=1) RETURNING "public"."SocialActor"."id", "public"."SocialActor"."kind", "public"."SocialActor"."profileId", "public"."SocialActor"."pageId", "public"."SocialActor"."ownerProfileId", "public"."SocialActor"."handle", "public"."SocialActor"."displayName", "public"."SocialActor"."avatarUrl", "public"."SocialActor"."avatarFocalX", "public"."SocialActor"."avatarFocalY", "public"."SocialActor"."avatarZoom", "public"."SocialActor"."avatarRotation", "public"."SocialActor"."coverUrl", "public"."SocialActor"."coverFocalX", "public"."SocialActor"."coverFocalY", "public"."SocialActor"."coverZoom", "public"."SocialActor"."coverRotation", "public"."SocialActor"."profileVisibility", "public"."SocialActor"."contactVisibility", "public"."SocialActor"."published", "public"."SocialActor"."createdAt", "public"."SocialActor"."updatedAt"',
        boundParameters: [
          "generated actor ID ($1)",
          "personal kind ($2)",
          "profile/owner/conflict profile ID ($3, $4, $25)",
          "server-derived handle ($5)",
          "display name create/update ($6, $21)",
          "avatar URL create/update ($7, $22)",
          "focal defaults ($8, $9, $12, $13)",
          "zoom defaults ($10, $14)",
          "rotation defaults ($11, $15)",
          "profile visibility ($16)",
          "contact visibility ($17)",
          "published create/update ($18, $23)",
          "Prisma timestamps ($19, $20, $24)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS ModifyTable plan over SocialActor with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "signup-outbox-insert",
        normalizedSql:
          'INSERT INTO "public"."SignupOutbox" ("id","userId","idempotencyKey","status","retryCount","nextRetryAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING "public"."SignupOutbox"."id"',
        boundParameters: [
          "generated outbox ID ($1)",
          "created User.id ($2)",
          "server-derived idempotency key ($3)",
          "pending status ($4)",
          "retryCount=0 ($5)",
          "Prisma nextRetryAt/createdAt/updatedAt ($6, $7, $8)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS ModifyTable plan over SignupOutbox with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "repeat-user-update",
        normalizedSql:
          'UPDATE "public"."User" SET "email" = $1, "name" = $2, "workosUserId" = $3, "isBanned" = $4, "deletionRequestedAt" = $5, "updatedAt" = $6 WHERE ("public"."User"."id" = $7 AND 1=1) RETURNING "public"."User"."id", "public"."User"."email", "public"."User"."name", "public"."User"."subscriptionTier", "public"."User"."stripeCustomerId", "public"."User"."stripeSubscriptionId", "public"."User"."isBanned", "public"."User"."deletionRequestedAt", "public"."User"."createdAt", "public"."User"."updatedAt", "public"."User"."workosUserId"',
        boundParameters: [
          "provider email ($1)",
          "server-derived display name ($2)",
          "provider subject ($3)",
          "isBanned ($4)",
          "deletionRequestedAt ($5)",
          "Prisma updatedAt ($6)",
          "matched User.id ($7)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS ModifyTable plan over User with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "restore-audit-insert",
        normalizedSql:
          'INSERT INTO "public"."AuditLog" ("actorId","actorType","action","targetType","targetId","metadata","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "public"."AuditLog"."id", "public"."AuditLog"."actorId", "public"."AuditLog"."actorType", "public"."AuditLog"."action", "public"."AuditLog"."targetType", "public"."AuditLog"."targetId", "public"."AuditLog"."ip", "public"."AuditLog"."userAgent", "public"."AuditLog"."metadata", "public"."AuditLog"."createdAt"',
        boundParameters: [
          "restored User.id actor ($1)",
          "user actor type ($2)",
          "user.delete.restore action ($3)",
          "user target type ($4)",
          "restored User.id target ($5)",
          "server-derived restore metadata ($6)",
          "Prisma createdAt ($7)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS ModifyTable plan over AuditLog with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
    ],
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "transaction",
    tables: ["User", "Profile", "SocialActor", "SignupOutbox", "AuditLog"],
    views: [],
    columnsRead: [
      "User.id",
      "User.email",
      "User.workosUserId",
      "User.emailVerified provider input is not persisted as a separate column",
      "User.isBanned",
      "User.deletionRequestedAt",
      "Profile identity and display fields",
    ],
    columnsWritten: [
      "User.email",
      "User.name",
      "User.workosUserId",
      "User.subscriptionTier",
      "User.isBanned",
      "User.deletionRequestedAt",
      "Profile.userId",
      "Profile.displayName",
      "Profile.role",
      "SocialActor identity/display/visibility fields",
      "SignupOutbox.userId",
      "SignupOutbox.idempotencyKey",
      "SignupOutbox.correlationId",
      "AuditLog.actorId",
      "AuditLog.actorType",
      "AuditLog.action",
      "AuditLog.targetType",
      "AuditLog.targetId",
      "AuditLog.metadata",
    ],
    boundParameters: [
      "provider subject ($1)",
      "provider-verified email ($2)",
      "Prisma take=1 ($3)",
      "Prisma offset=0 ($4)",
    ],
    parameterized: true,
    ownershipPredicate:
      "No caller-selected local object; the validated provider subject is matched first, with email fallback disabled when emailVerified is false.",
    visibilityPredicate:
      "Banned accounts without a pending deletion are returned without restoration; pending-deletion restoration is server controlled.",
    rowLevelSecurityPolicies: [
      "giq_user_select",
      "giq_user_insert",
      "giq_user_update",
      "giq_profile_select",
      "giq_profile_insert",
      "giq_profile_update",
      "giq_social_actor_select",
      "giq_social_actor_insert",
      "giq_social_actor_update",
      "giq_signup_outbox_system",
      "giq_audit_log_insert",
    ],
    expectedRowCount:
      "one matched or created user; a first local acceptance also creates one profile, one personal actor and one deduplicated outbox row; pending-deletion restoration inserts one AuditLog row",
    maximumRowCount: 4,
    paginationRequired: false,
    transactionBoundary: systemTransaction,
    isolationLevel: "Prisma/PostgreSQL default; runtime isolation level not captured",
    locks: [
      "Unique indexes serialize conflicting User, Profile, SocialActor and SignupOutbox keys; exact lock modes were not captured",
    ],
    concurrencyControl:
      "Unique User email/provider-subject, Profile.userId, SocialActor.profileId and SignupOutbox user/idempotency keys reject duplicates. A captured sequential repeat retained exactly one user, profile, personal actor and outbox row; concurrent first-login behaviour remains untested.",
    indexesExpected: [
      "User_email_key",
      "User_workosUserId_key",
      "Profile_userId_key",
      "SocialActor_profileId_key",
      "SignupOutbox_userId_key",
      "SignupOutbox_idempotencyKey_key",
      "AuditLog_pkey",
    ],
    constraintsReliedOn: [
      "User_email_key",
      "User_workosUserId_key",
      "Profile_userId_key",
      "SocialActor_profileId_key",
      "SignupOutbox_userId_key",
      "SignupOutbox_idempotencyKey_key",
      "SignupOutbox_status_check",
    ],
    triggersInvoked: [
      "giq_profile_marketing_tier",
      "giq_social_actor_identity_guard",
    ],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json schema v16 databaseOperationProofs[0]: sanitized PostgreSQL JSON COSTS Limit lookup and ModifyTable write plans with ANALYZE/BUFFERS disabled and a 5 s statement timeout. The tiny disposable fixture selected sequential User scans, so representative-volume index selection remains a separate scale test; the artifact integrity-validates each current full-plan SHA-256.",
    sensitiveColumns: [
      "User.email",
      "User.workosUserId",
      "SignupOutbox.userId",
      "SignupOutbox.correlationId",
      "AuditLog.metadata",
    ],
    returnedDataShape: "local User with Profile; outbox identifiers are not returned to the browser",
    notFoundBehaviour: "A missing local user enters the bounded create path.",
    unauthorizedBehaviour:
      "An unverified-email identity was looked up only by provider subject and its duplicate-email insert rolled back without linking or mutating the existing user. Exact first-login User INSERT replay under a normal request context was rejected by giq_user_insert RLS. Upstream identity-provider token/session validation was not contacted and remains separate evidence.",
    conflictBehaviour:
      "The captured duplicate-email uniqueness conflict rolled back, and a sequential same-subject repeat retained one four-row acceptance graph. Concurrent first-login collision timing and callback recovery UX remain untested.",
    failureBehaviour:
      "A forced transaction using the exact four first-login mutation shapes rolled back User, Profile, SocialActor and SignupOutbox together. Pending-deletion restoration committed one bounded User update, one restoration AuditLog and one actor upsert; a permanently banned identity returned with no mutation.",
    tests: [
      "src/lib/signup-acceptance.test.ts",
      "src/lib/request-id.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v16 databaseOperationProofs[0] binds the real syncAuthUser path to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal-loopback port 55734. A new verified identity committed exactly one User, Profile, personal SocialActor and SignupOutbox; a same-subject repeat retained those four rows; a pending-deletion account restored with one audit; and a permanent ban returned without mutation.",
      "The source-bound proof captures verified and unverified identity lookup SQL plus exact User/Profile/SocialActor/SignupOutbox/restore-Audit SQL hashes, named bind positions without parameter values, sanitized non-ANALYZE plans, an exact request-context RLS denial, an unverified-email anti-link uniqueness rollback, a forced four-write rollback and cleanup of one exact probe graph plus its audit. Provider authentication/session validation, concurrent first login, representative-volume planning, callback recovery UX, staging and production remain explicit residuals.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER",
    traceId: "AUTH.CALLBACK.COMPLETE",
    sourceFile: "src/lib/signup-acceptance-worker-store.ts",
    sourceSymbol: "signupAcceptanceWorkerStore.claimBatch",
    ormOrDriver: "Prisma parameterized $executeRaw",
    ormOperation:
      "CTE SELECT FOR UPDATE SKIP LOCKED capped by the worker limit, then UPDATE exhausted due SignupOutbox rows to dead_letter",
    normalizedSql:
      'WITH candidates AS ( SELECT "id" FROM "SignupOutbox" WHERE "retryCount" >= $1 AND ( ("status" = \'pending\' AND "nextRetryAt" <= $2) OR ( "status" = \'processing\' AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= $3) ) ) ORDER BY "nextRetryAt" ASC, "createdAt" ASC, "id" ASC FOR UPDATE SKIP LOCKED LIMIT $4 ) UPDATE "SignupOutbox" AS outbox SET "status" = \'dead_letter\', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "deadLetteredAt" = $5, "lastErrorCode" = \'signup.attempts_exhausted\', "updatedAt" = $6 FROM candidates WHERE outbox."id" = candidates."id"',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "update",
    tables: ["SignupOutbox"],
    views: [],
    columnsRead: [
      "SignupOutbox.status",
      "SignupOutbox.retryCount",
      "SignupOutbox.nextRetryAt",
      "SignupOutbox.leaseExpiresAt",
    ],
    columnsWritten: [
      "SignupOutbox.status",
      "SignupOutbox.leaseToken",
      "SignupOutbox.leaseExpiresAt",
      "SignupOutbox.deadLetteredAt",
      "SignupOutbox.lastErrorCode",
      "SignupOutbox.updatedAt",
    ],
    boundParameters: [
      "maximum attempts ($1)",
      "worker clock ($2, $3, $5 and $6)",
      "worker batch limit ($4)",
    ],
    parameterized: true,
    visibilityPredicate:
      "retryCount >= maxAttempts and either a due pending row or an expired/missing processing lease",
    rowLevelSecurityPolicies: ["giq_signup_outbox_system"],
    expectedRowCount: "zero to the requested worker batch limit",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary:
      "First statement in claimBatch's bounded five-second withDbSystemContext transaction.",
    isolationLevel: "Prisma/PostgreSQL default; not captured",
    locks: ["FOR UPDATE SKIP LOCKED on at most the requested worker batch"],
    concurrencyControl:
      "Stable ordering, LIMIT and SKIP LOCKED bound each invocation and let concurrent workers progress without waiting on already-locked exhausted rows.",
    indexesExpected: ["SignupOutbox_status_nextRetryAt_createdAt_idx"],
    constraintsReliedOn: [
      "SignupOutbox_retryCount_check",
      "SignupOutbox_status_check",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 5_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER: sanitized PostgreSQL JSON COSTS plan with ANALYZE/BUFFERS disabled and a 5 s statement timeout. The disposable two-row fixture observed ModifyTable with Limit -> LockRows; its tiny-table Seq Scan is not representative-scale evidence, and the exact plan hash remains artifact-validated rather than an immutable optimizer contract.",
    sensitiveColumns: ["SignupOutbox.leaseToken"],
    returnedDataShape: "affected-row count exposed as expiredDeadLettered",
    notFoundBehaviour: "No exhausted row returns an affected-row count of zero.",
    unauthorizedBehaviour:
      "The disposable runtime-role request context affected zero rows and left the exhausted row pending; only system context could dead-letter it.",
    conflictBehaviour:
      "SKIP LOCKED avoids waiting on rows held by another worker, and a row already moved to dead_letter is not selected again.",
    failureBehaviour:
      "The claimBatch transaction rolls back and no new claim is returned; the worker invocation fails.",
    tests: [
      "src/lib/signup-acceptance-worker.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v8 binds this statement to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public on literal loopback port 55734. With limit=1, one exhausted row progressed while the separate claim row was locked, request context affected zero rows, forced rollback restored pending state, and the committed retry dead-lettered exactly once.",
      "The source-bound artifact captures normalized SQL SHA-256 ebc3c340505c9d10ebd87c904e4758e81cdde2dbd2da82f3cc5ec0495da998cd, all six bind positions without values, a non-ANALYZE PostgreSQL JSON cost plan and exact cleanup. Representative backlog performance, deployed role parity and production timeout behaviour remain separate release evidence.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.AUTH.SIGNUP_OUTBOX.CLAIM",
    traceId: "AUTH.CALLBACK.COMPLETE",
    sourceFile: "src/lib/signup-acceptance-worker-store.ts",
    sourceSymbol: "signupAcceptanceWorkerStore.claimBatch",
    ormOrDriver: "Prisma parameterized $queryRaw",
    ormOperation:
      "CTE SELECT FOR UPDATE SKIP LOCKED LIMIT 1, then UPDATE and RETURN the claimed SignupOutbox row",
    normalizedSql:
      'WITH candidates AS ( SELECT "id" FROM "SignupOutbox" WHERE "retryCount" < $1 AND ( ("status" = \'pending\' AND "nextRetryAt" <= $2) OR ( "status" = \'processing\' AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= $3) ) ) ORDER BY "nextRetryAt" ASC, "createdAt" ASC, "id" ASC FOR UPDATE SKIP LOCKED LIMIT $4 ) UPDATE "SignupOutbox" AS outbox SET "status" = \'processing\', "retryCount" = outbox."retryCount" + 1, "lastAttemptAt" = $5, "leaseExpiresAt" = $6, "leaseToken" = $7, "deadLetteredAt" = NULL, "lastErrorCode" = CASE WHEN outbox."status" = \'processing\' THEN \'signup.lease_expired\' ELSE outbox."lastErrorCode" END, "updatedAt" = $8 FROM candidates WHERE outbox."id" = candidates."id" RETURNING outbox."id", outbox."userId", outbox."idempotencyKey", outbox."correlationId", outbox."retryCount" AS "attempt", outbox."leaseToken", outbox."leaseExpiresAt"',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "update",
    tables: ["SignupOutbox"],
    views: [],
    columnsRead: [
      "SignupOutbox.id",
      "SignupOutbox.userId",
      "SignupOutbox.idempotencyKey",
      "SignupOutbox.correlationId",
      "SignupOutbox.status",
      "SignupOutbox.retryCount",
      "SignupOutbox.nextRetryAt",
      "SignupOutbox.createdAt",
      "SignupOutbox.leaseExpiresAt",
    ],
    columnsWritten: [
      "SignupOutbox.status",
      "SignupOutbox.retryCount",
      "SignupOutbox.lastAttemptAt",
      "SignupOutbox.leaseExpiresAt",
      "SignupOutbox.leaseToken",
      "SignupOutbox.deadLetteredAt",
      "SignupOutbox.lastErrorCode",
      "SignupOutbox.updatedAt",
    ],
    boundParameters: [
      "maximum attempts ($1)",
      "worker clock ($2, $3, $5 and $8)",
      "limit = 1 ($4)",
      "lease expiry derived from worker clock and lease duration ($6)",
      "random UUID lease token ($7)",
    ],
    parameterized: true,
    visibilityPredicate:
      "due pending rows or expired processing leases below the attempt cap",
    rowLevelSecurityPolicies: ["giq_signup_outbox_system"],
    expectedRowCount: "zero or one claimed row for the traced worker caller",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary:
      "Second statement in claimBatch's bounded five-second withDbSystemContext transaction; the handler runs after commit.",
    isolationLevel: "Prisma/PostgreSQL default; exact level not captured",
    locks: ["FOR UPDATE SKIP LOCKED candidate lock", "expiring random leaseToken"],
    concurrencyControl:
      "A real concurrent runtime-role transaction held the eligible row lock while claimBatch returned no claim; after release exactly one claim succeeded. A repeated claim before lease expiry returned none and left retryCount at one.",
    indexesExpected: ["SignupOutbox_status_nextRetryAt_createdAt_idx"],
    constraintsReliedOn: [
      "SignupOutbox_pkey",
      "SignupOutbox_retryCount_check",
      "SignupOutbox_status_check",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 5_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json DB.AUTH.SIGNUP_OUTBOX.CLAIM: sanitized PostgreSQL JSON COSTS plan with ANALYZE/BUFFERS disabled and a 5 s statement timeout; the disposable fixture observed ModifyTable with Limit -> LockRows and the SignupOutbox_status_nextRetryAt_createdAt_idx bitmap path. The artifact integrity-validates its exact full cost-plan SHA-256 without treating optimizer costs as immutable.",
    sensitiveColumns: [
      "SignupOutbox.userId",
      "SignupOutbox.correlationId",
      "SignupOutbox.leaseToken",
    ],
    returnedDataShape:
      "internal claim { id, userId, idempotencyKey, correlationId, attempt, leaseToken, leaseExpiresAt }",
    notFoundBehaviour: "No due row returns an empty claim list.",
    unauthorizedBehaviour:
      "The exact claim SQL under request context returned zero rows and left the due probe pending; only system context under the same non-superuser, non-BYPASSRLS runtime role could claim it.",
    conflictBehaviour:
      "A competing transaction's locked candidate was skipped without waiting for or double-claiming the row.",
    failureBehaviour:
      "Executing the exact captured statement and then forcing a transaction failure restored the pending row with retryCount zero and no lease.",
    tests: [
      "src/lib/signup-acceptance-worker.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v6 binds a literal-loopback port-55734 execution to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public. It proves locked-row skipping, request-context denial, forced rollback, one eligible claim, and no duplicate claim while the lease remains current.",
      "The same source-bound evidence captures sanitized CTE SQL SHA-256 bab2368f26844904057af43d2a80a7682a15952f9a9c15946fe74376caa55472, all eight bind positions without persisted values, and a non-ANALYZE PostgreSQL JSON cost plan. Exact cleanup removed the one SignupOutbox probe and left zero private/provider rows; no staging, production, provider or external network system was contacted.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.AUTH.SIGNUP_OUTBOX.SETTLE",
    traceId: "AUTH.CALLBACK.COMPLETE",
    sourceFile: "src/lib/signup-acceptance-worker-store.ts",
    sourceSymbol: "signupAcceptanceWorkerStore.complete/fail",
    ormOrDriver: "Prisma parameterized $executeRaw",
    ormOperation:
      "UPDATE one processing SignupOutbox row by primary key and exact current lease token to sent, pending or dead_letter",
    normalizedSql:
      'UPDATE "SignupOutbox" SET "status" = \'sent\', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "sentAt" = $1, "lastErrorCode" = NULL, "updatedAt" = $2 WHERE "id" = $3 AND "status" = \'processing\' AND "leaseToken" = $4',
    normalizedSqlVariants: [
      {
        variant: "complete",
        normalizedSql:
          'UPDATE "SignupOutbox" SET "status" = \'sent\', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "sentAt" = $1, "lastErrorCode" = NULL, "updatedAt" = $2 WHERE "id" = $3 AND "status" = \'processing\' AND "leaseToken" = $4',
        boundParameters: [
          "completedAt ($1 and $2)",
          "claim.id ($3)",
          "claim.leaseToken ($4)",
        ],
        explainPlanEvidence:
          "output/database-audit/demo-fixture-idempotency.json complete variant: sanitized non-ANALYZE PostgreSQL JSON cost plan rooted at ModifyTable with SignupOutbox_pkey Index Scan; exact full plan hash is integrity-validated in the artifact.",
      },
      {
        variant: "retry",
        normalizedSql:
          'UPDATE "SignupOutbox" SET "status" = \'pending\', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "nextRetryAt" = $1, "lastErrorCode" = $2, "updatedAt" = $3 WHERE "id" = $4 AND "status" = \'processing\' AND "leaseToken" = $5',
        boundParameters: [
          "retryAt ($1)",
          "errorCode ($2)",
          "failedAt ($3)",
          "claim.id ($4)",
          "claim.leaseToken ($5)",
        ],
        explainPlanEvidence:
          "output/database-audit/demo-fixture-idempotency.json retry variant: sanitized non-ANALYZE PostgreSQL JSON cost plan rooted at ModifyTable with SignupOutbox_pkey Index Scan; exact full plan hash is integrity-validated in the artifact.",
      },
      {
        variant: "dead-letter",
        normalizedSql:
          'UPDATE "SignupOutbox" SET "status" = \'dead_letter\', "leaseToken" = NULL, "leaseExpiresAt" = NULL, "deadLetteredAt" = $1, "lastErrorCode" = $2, "updatedAt" = $3 WHERE "id" = $4 AND "status" = \'processing\' AND "leaseToken" = $5',
        boundParameters: [
          "failedAt ($1 and $3)",
          "errorCode ($2)",
          "claim.id ($4)",
          "claim.leaseToken ($5)",
        ],
        explainPlanEvidence:
          "output/database-audit/demo-fixture-idempotency.json dead-letter variant: sanitized non-ANALYZE PostgreSQL JSON cost plan rooted at ModifyTable with SignupOutbox_pkey Index Scan; exact full plan hash is integrity-validated in the artifact.",
      },
    ],
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "update",
    tables: ["SignupOutbox"],
    views: [],
    columnsRead: [
      "SignupOutbox.id",
      "SignupOutbox.status",
      "SignupOutbox.leaseToken",
    ],
    columnsWritten: [
      "SignupOutbox.status",
      "SignupOutbox.nextRetryAt",
      "SignupOutbox.leaseExpiresAt",
      "SignupOutbox.leaseToken",
      "SignupOutbox.sentAt",
      "SignupOutbox.deadLetteredAt",
      "SignupOutbox.lastErrorCode",
      "SignupOutbox.updatedAt",
    ],
    boundParameters: [
      "complete: completedAt ($1 and $2), claim.id ($3), claim.leaseToken ($4)",
      "retry: retryAt ($1), errorCode ($2), failedAt ($3), claim.id ($4), claim.leaseToken ($5)",
      "dead-letter: failedAt ($1 and $3), errorCode ($2), claim.id ($4), claim.leaseToken ($5)",
    ],
    parameterized: true,
    visibilityPredicate:
      "id matches the claim, status is processing and leaseToken matches the current claim",
    rowLevelSecurityPolicies: ["giq_signup_outbox_system"],
    expectedRowCount: "zero on lease loss or exactly one settled row",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary:
      "A separate bounded five-second withDbSystemContext transaction after the external handler finishes or fails.",
    isolationLevel: "Prisma/PostgreSQL default; exact level not captured",
    locks: ["primary-key row update lock", "exact leaseToken ownership predicate"],
    concurrencyControl:
      "All three variants require the exact current lease token. A wrong or already-consumed lease affected zero rows; complete returned false and failure variants returned lease-lost.",
    indexesExpected: ["SignupOutbox_pkey"],
    constraintsReliedOn: [
      "SignupOutbox_pkey",
      "SignupOutbox_status_check",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 5_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json DB.AUTH.SIGNUP_OUTBOX.SETTLE variants complete/retry/dead-letter: each has distinct sanitized parameterized SQL and its own PostgreSQL JSON COSTS plan with ANALYZE/BUFFERS disabled and a 5 s statement timeout. All three disposable-fixture plans observed ModifyTable -> SignupOutbox_pkey Index Scan; exact full hashes remain artifact-validated rather than immutable registry contracts.",
    sensitiveColumns: ["SignupOutbox.leaseToken"],
    returnedDataShape: "affected-row count converted to complete/retry/dead-letter/lease-lost",
    notFoundBehaviour: "A missing or stale claim is lease-lost, not success.",
    unauthorizedBehaviour:
      "The exact complete, retry and dead-letter SQL each affected zero rows under request context and left the processing row and lease unchanged; system context under the same non-superuser runtime role settled it.",
    conflictBehaviour:
      "A stale or already-consumed lease affected zero rows for every variant; only the exact current processing lease settled once.",
    failureBehaviour:
      "Each exact captured variant was executed inside a forced-failure runtime-role transaction and proved to roll back to the same processing row and lease.",
    tests: [
      "src/lib/signup-acceptance-worker.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v7 binds complete, retry and dead-letter executions to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public. Every variant proves request-context denial, forced rollback, exact-lease success once, and stale/consumed-lease idempotency.",
      "The source-bound artifact stores three distinct SQL variants rather than conflating settlement paths: complete SHA-256 0b77809ad01830d264943a4f6c794d00ef84e7e67484eb3a12a67aeb75fb6856, retry cd41c981684368fd943257ca9aecb028f87336e74c56060b869d4debba304259, and dead-letter 2953f149d9f1a1fba8bdf579a871bd0baac90053b20f8b84191cb2b494a34e10. Parameter values are not persisted, exact cleanup removed the single probe, and no staging, production, provider or external network system was contacted.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.BILLING.STRIPE_WEBHOOK_EVENT.INSERT",
    traceId: "BILLING.WEBHOOK.PROCESS",
    sourceFile: "src/lib/billing/stripe-webhooks.ts",
    sourceSymbol: "ingestStripeWebhook",
    ormOrDriver: "Prisma parameterized create",
    ormOperation:
      "withDbSystemContext tx.webhookEvent.create after local Stripe signature verification",
    normalizedSql:
      'INSERT INTO "public"."WebhookEvent" ("id","provider","lagoEventId","eventType","status","payloadHash","payloadJson","headersJson","retryCount","receivedAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING "public"."WebhookEvent"."id", "public"."WebhookEvent"."eventType", "public"."WebhookEvent"."lagoEventId", "public"."WebhookEvent"."retryCount", "public"."WebhookEvent"."status"',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "insert",
    tables: ["WebhookEvent"],
    views: [],
    columnsRead: [],
    columnsWritten: [
      "provider",
      "lagoEventId",
      "eventType",
      "status",
      "payloadHash",
      "payloadJson",
      "headersJson",
      "retryCount",
      "receivedAt",
      "createdAt",
      "updatedAt",
    ],
    boundParameters: [
      "generated WebhookEvent.id ($1)",
      "provider=stripe ($2)",
      "verified stripeEvent.id ($3)",
      "verified stripeEvent.type ($4)",
      "status=received ($5)",
      "SHA-256 of exact signed raw body ($6)",
      "allowlisted event audit summary without data.object ($7)",
      "allowlisted content-type and Stripe-version headers without signature ($8)",
      "retryCount=0 ($9)",
      "Prisma receivedAt/createdAt/updatedAt ($10, $11, $12)",
    ],
    parameterized: true,
    rowLevelSecurityPolicies: ["giq_webhook_event_system"],
    expectedRowCount: "one new event or a unique-constraint conflict",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary:
      "First mutation in ingestStripeWebhook's withDbSystemContext transaction; the unknown synthetic event is then marked ignored in the same transaction.",
    isolationLevel:
      "PostgreSQL default inside withDbSystemContext; the service does not override it.",
    locks: [],
    concurrencyControl:
      "Unique event ID and provider/payload-hash constraints serialize duplicate identity; a P2002 exits the aborted transaction before duplicate lookup and bounded retry accounting in a fresh system transaction.",
    indexesExpected: [
      "WebhookEvent_lagoEventId_key",
      "WebhookEvent_provider_payloadHash_key",
    ],
    constraintsReliedOn: [
      "WebhookEvent_lagoEventId_key",
      "WebhookEvent_provider_payloadHash_key",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json: sanitized PostgreSQL JSON COSTS ModifyTable -> Result plan for one WebhookEvent INSERT, with ANALYZE and BUFFERS disabled and a 5 s EXPLAIN statement timeout.",
    sensitiveColumns: ["payloadJson", "headersJson"],
    returnedDataShape:
      "eventSelect projection: id, eventType, lagoEventId, retryCount and status only.",
    notFoundBehaviour: "Not applicable to insert.",
    unauthorizedBehaviour:
      "Exact SQL replay is rejected for anonymous/member context; giq_webhook_event_system permits system and moderator context, and the moderator replay was forced to roll back.",
    conflictBehaviour:
      "An exact duplicate retains one row and increments retryCount; reuse of the same event ID with a different payload hash raises stripe.webhook_receipt_conflict without overwriting the terminal receipt.",
    failureBehaviour:
      "Invalid signatures fail before database work. Insert/reducer failure rolls back, records only a bounded sanitized failure receipt where possible, and returns a safe webhook error.",
    tests: [
      "src/lib/billing/stripe-readiness.test.ts",
      "src/lib/billing/stripe-webhook-settlement.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v16 binds the real ingestStripeWebhook receipt INSERT to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public on literal loopback port 55734.",
      "A locally signed unknown event created one receipt, persisted only the allowlisted event summary and safe headers, rejected invalid signatures before a write, rejected member/anonymous exact-SQL replays, allowed then rolled back the policy-authorized moderator replay, retained one row on duplicate delivery, and rejected a same-ID/different-payload conflict without overwrite.",
      "The source-bound artifact captures normalized SQL SHA-256 f14aea7bdce09ef59ea597ff934f488d8cb663aee68183d273296ad02fe637b9, all 12 bind positions without values, a non-ANALYZE PostgreSQL JSON cost plan and exact cleanup. Stripe delivery/network behavior, representative concurrency, deployed role/catalog parity, staging and production remain unproven.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.PULSE.CONVERSATION.ACCESS.SELECT",
    traceId: "PULSE.CONVERSATION.BLOCK",
    sourceFile: "src/lib/conversation-service.ts",
    sourceSymbol: "getConversationForProfile",
    ormOrDriver: "Prisma",
    ormOperation: "tx.conversation.findFirst",
    normalizedSql:
      'SELECT "public"."Conversation"."id", "public"."Conversation"."participantAId", "public"."Conversation"."participantAActorId", "public"."Conversation"."participantBId", "public"."Conversation"."participantBActorId", "public"."Conversation"."lastMessageAt", "public"."Conversation"."blockedById", "public"."Conversation"."blockedAt", "public"."Conversation"."createdAt", "public"."Conversation"."updatedAt" FROM "public"."Conversation" WHERE ("public"."Conversation"."id" = $1 AND ("public"."Conversation"."participantAId" = $2 OR "public"."Conversation"."participantBId" = $3)) LIMIT $4 OFFSET $5',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "select",
    tables: ["Conversation"],
    views: [],
    columnsRead: [
      "id",
      "participantAId",
      "participantAActorId",
      "participantBId",
      "participantBActorId",
      "lastMessageAt",
      "blockedById",
      "blockedAt",
      "createdAt",
      "updatedAt",
    ],
    columnsWritten: [],
    boundParameters: [
      "conversationId ($1)",
      "current.profileId ($2 and $3)",
      "Prisma findFirst take=1 ($4)",
      "Prisma offset=0 ($5)",
    ],
    parameterized: true,
    ownershipPredicate: "id = :conversationId AND (participantAId = :profileId OR participantBId = :profileId)",
    visibilityPredicate: "Conversation must be visible through the participant predicate.",
    rowLevelSecurityPolicies: ["giq_conversation_select"],
    expectedRowCount: "zero or one conversation",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary: requestTransaction,
    isolationLevel: "Prisma/PostgreSQL default; not captured",
    locks: [],
    concurrencyControl: "Block mutation reuses the selected conversation ID inside a later transaction.",
    indexesExpected: ["Conversation_pkey", "Conversation_participantAId_idx", "Conversation_participantBId_idx"],
    constraintsReliedOn: ["Conversation_pkey"],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json databaseOperationProofs[1]: sanitized PostgreSQL JSON COSTS plan with ANALYZE/BUFFERS disabled and a 5 s statement timeout; the observed disposable-fixture plan is Limit -> Conversation_pkey Index Scan. The artifact integrity-validates the exact full cost-plan SHA-256 without treating optimizer costs as a permanent registry contract.",
    sensitiveColumns: ["participantAId", "participantBId", "blockedById"],
    returnedDataShape:
      "Observed ten-field Conversation root projection; CONVERSATION_INCLUDE relations and messages are separate Prisma reads outside this query contract.",
    notFoundBehaviour: "Throws conversation.not_found for missing or inaccessible objects.",
    unauthorizedBehaviour: "Object existence is not separately disclosed.",
    conflictBehaviour: "Not applicable to read.",
    failureBehaviour: "Transaction rolls back and route maps the error through jsonError.",
    tests: [
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json binds an isolated literal-loopback port-55734 execution to getConversationForProfile as login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public: one participant read succeeded, non-participant and missing IDs both returned conversation.not_found, the controlled Conversation row count stayed 1 and exact-ID cleanup returned it to zero.",
      "The same source-bound evidence captures sanitized observed SQL SHA-256 9c5e91112e60a6fb522415995c9c0269b8b35d79e0846b42795d84db51021f18, all five named bind positions with no values persisted, and a non-ANALYZE PostgreSQL JSON cost plan. No staging or production system was contacted.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.PULSE.CONVERSATION.BLOCK.UPDATE",
    traceId: "PULSE.CONVERSATION.BLOCK",
    sourceFile: "src/lib/conversation-service.ts",
    sourceSymbol: "setConversationBlock",
    ormOrDriver: "Prisma",
    ormOperation: "tx.conversation.update",
    normalizedSql:
      'UPDATE "public"."Conversation" SET "blockedById" = $1, "blockedAt" = $2, "updatedAt" = $3 WHERE ("public"."Conversation"."id" = $4 AND 1=1) RETURNING "public"."Conversation"."id", "public"."Conversation"."participantAId", "public"."Conversation"."participantAActorId", "public"."Conversation"."participantBId", "public"."Conversation"."participantBActorId", "public"."Conversation"."lastMessageAt", "public"."Conversation"."blockedById", "public"."Conversation"."blockedAt", "public"."Conversation"."createdAt", "public"."Conversation"."updatedAt"',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "update",
    tables: ["Conversation"],
    views: [],
    columnsRead: [
      "id",
      "participantAId",
      "participantAActorId",
      "participantBId",
      "participantBActorId",
      "lastMessageAt",
      "blockedById",
      "blockedAt",
      "createdAt",
      "updatedAt",
    ],
    columnsWritten: ["blockedById", "blockedAt", "updatedAt"],
    boundParameters: [
      "next.blockedById ($1)",
      "next.blockedAt ($2)",
      "Prisma updatedAt ($3)",
      "conversation.id ($4)",
    ],
    parameterized: true,
    ownershipPredicate: "Object access is established first by getConversationForProfile.",
    rowLevelSecurityPolicies: ["giq_conversation_update"],
    expectedRowCount: "exactly one conversation",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary: requestTransaction,
    isolationLevel: "Prisma/PostgreSQL default; exact level not captured",
    locks: [],
    concurrencyControl:
      "No optimistic version predicate is present. Sequential repeated block was verified to preserve one UserBlock row; simultaneous block/unblock ordering remains last-committer-wins and is not claimed as tested.",
    indexesExpected: ["Conversation_pkey"],
    constraintsReliedOn: ["Conversation_pkey"],
    triggersInvoked: ["giq_conversation_pro_write"],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json DB.PULSE.CONVERSATION.BLOCK.UPDATE: sanitized PostgreSQL JSON COSTS plan with ANALYZE/BUFFERS disabled and a 5 s statement timeout; the observed disposable-fixture plan is ModifyTable -> Conversation_pkey Index Scan. The artifact integrity-validates the exact full cost-plan SHA-256 without treating optimizer costs as a permanent registry contract.",
    sensitiveColumns: ["blockedById", "blockedAt"],
    returnedDataShape: "CONVERSATION_INCLUDE",
    notFoundBehaviour: "Prior participant lookup returns conversation.not_found for missing or inaccessible objects.",
    unauthorizedBehaviour:
      "A stranger receives conversation.not_found; the non-blocking counterparty receives auth.forbidden when attempting to unblock. RLS remains defence in depth.",
    conflictBehaviour:
      "Sequential duplicate block is safe; simultaneous opposing transitions have no optimistic version predicate and remain an explicit residual risk.",
    failureBehaviour:
      "A forced runtime-role transaction failure proved the Conversation update and UserBlock insert roll back together.",
    tests: [
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v5 binds isolated literal-loopback port-55734 block, duplicate-block and unblock executions to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public. It proves stranger denial, counterparty-unblock denial, same-transaction rollback, identical parameterized block/unblock UPDATE shape, and exact cleanup to zero.",
      "The source-bound evidence captures sanitized observed UPDATE SQL SHA-256 73d3b57dab0e4783faa15195fc58f5c62a9f1da6d79ffacaa1800b388e166790, all four named bind positions without persisted values, transaction ordering with the UserBlock insert, and a non-ANALYZE JSON cost plan. Realtime and external network effects were disabled; no staging or production system was contacted.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.PULSE.USER_BLOCK.UPSERT",
    traceId: "PULSE.CONVERSATION.BLOCK",
    sourceFile: "src/lib/conversation-service.ts",
    sourceSymbol: "setConversationBlock",
    ormOrDriver: "Prisma",
    ormOperation: "tx.userBlock.upsert",
    normalizedSql:
      'INSERT INTO "public"."UserBlock" ("id","blockerProfileId","blockedProfileId","createdAt") VALUES ($1,$2,$3,$4) RETURNING "public"."UserBlock"."id"',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "upsert",
    tables: ["UserBlock"],
    views: [],
    columnsRead: ["id", "blockerProfileId", "blockedProfileId"],
    columnsWritten: ["id", "blockerProfileId", "blockedProfileId", "createdAt"],
    boundParameters: [
      "generated UserBlock.id ($1)",
      "current.profileId ($2)",
      "blockedProfileId ($3)",
      "Prisma createdAt ($4)",
    ],
    parameterized: true,
    ownershipPredicate: "blockerProfileId = current.profileId",
    rowLevelSecurityPolicies: ["giq_user_block_access"],
    expectedRowCount: "one existing or new block relation",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary: requestTransaction,
    isolationLevel: "Prisma/PostgreSQL default; exact level not captured",
    locks: [],
    concurrencyControl:
      "The compound unique constraint protects the pair. Runtime evidence shows Prisma emulates this upsert as a unique-pair read plus INSERT on create and no second UserBlock mutation when the row already exists; concurrent first-writer races still rely on the unique constraint.",
    indexesExpected: ["UserBlock_blockerProfileId_blockedProfileId_key"],
    constraintsReliedOn: [
      "UserBlock_blockerProfileId_blockedProfileId_key",
      "UserBlock_no_self_block",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json DB.PULSE.USER_BLOCK.UPSERT: sanitized PostgreSQL JSON COSTS plan with ANALYZE/BUFFERS disabled and a 5 s statement timeout; the observed disposable create-path INSERT plan is ModifyTable -> Result. The artifact integrity-validates the exact full cost-plan SHA-256 without treating optimizer costs as a permanent registry contract.",
    sensitiveColumns: ["blockerProfileId", "blockedProfileId"],
    returnedDataShape: "No UserBlock record returned to the route.",
    notFoundBehaviour: "The participant pre-read returns conversation.not_found before this operation for inaccessible conversations.",
    unauthorizedBehaviour:
      "A stranger never reaches this operation, and RLS rejects a blocker ID outside the current profile context as defence in depth.",
    conflictBehaviour:
      "A sequential duplicate performs a unique-pair read and retains the original row ID and createdAt without a second UserBlock mutation; the compound unique constraint rejects an unresolved concurrent duplicate.",
    failureBehaviour:
      "A forced runtime-role transaction failure proved the create-path INSERT rolls back with the Conversation update; unblock removes the exact pair.",
    tests: [
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v5 binds the isolated create, duplicate, denied counterparty-unblock, rollback and delete-to-zero cases to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public. The duplicate retained the same row ID and createdAt through a unique-pair read with zero second UserBlock mutation.",
      "The source-bound evidence captures sanitized observed create-path INSERT SQL SHA-256 e55293e083cf5012aed28ef92c872ce1520fb4beb681080863b70f44e60a5e12, all four named bind positions without persisted values, same-transaction ordering with the Conversation update, and a non-ANALYZE JSON cost plan. Realtime and external network effects were disabled; exact cleanup left zero UserBlock rows and no synthetic block audit residue.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.PULSE.REALTIME_GRANT.REVOKE",
    traceId: "PULSE.CONVERSATION.BLOCK",
    sourceFile: "src/lib/realtime-service.ts",
    sourceSymbol: "revokeRealtimeTopicGrants",
    ormOrDriver: "Supabase JavaScript client",
    ormOperation: "client.rpc",
    storedProcedure: "giq_revoke_realtime_topic_grants",
    normalizedSql:
      "SELECT public.giq_revoke_realtime_topic_grants(ARRAY[$1,$2]::text[], ARRAY[$3]::text[])",
    databaseRole: "service_role",
    databaseName:
      "Supabase Realtime authorization database (deployment-specific); isolated proof database greyhoundiq_realtime_proof",
    schemaName: "public",
    operationType: "procedure",
    tables: ["giq_realtime_topic_grants"],
    views: [],
    columnsRead: ["profile_id", "topic"],
    columnsWritten: ["matching grant rows deleted"],
    boundParameters: [
      "requested_profile_ids (1..10 non-empty values, each at most 128 characters)",
      "requested_topics (1..10 conversation: plus 48-lowercase-hex values)",
    ],
    parameterized: true,
    ownershipPredicate: "Profile IDs are derived from the already-authorized conversation participants.",
    rowLevelSecurityPolicies: [],
    expectedRowCount:
      "Zero through 200 rows: at most ten profiles multiplied by ten topics and the two allowed extensions.",
    maximumRowCount: 200,
    paginationRequired: false,
    transactionBoundary:
      "One security-definer procedure transaction in the Supabase Realtime authorization database; the preceding app-database conversation block is a separate committed transaction.",
    isolationLevel:
      "PostgreSQL default with deterministic per-profile transaction advisory locks.",
    locks: [
      "pg_advisory_xact_lock(hashtextextended(profile_id, 0)) acquired for distinct profile IDs in sorted order",
    ],
    concurrencyControl:
      "The procedure serializes grant replacement/revocation per profile in deterministic order; future token issuance independently rechecks blocked state, and repeated revocation is idempotent.",
    indexesExpected: [
      "giq_realtime_topic_grants_pkey (topic, profile_id, extension)",
    ],
    constraintsReliedOn: [
      "giq_realtime_topic_grants_pkey",
      "extension check limited to broadcast/presence",
      "procedure profile/topic cardinality and format validation",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 5_000,
    explainPlanEvidence:
      "output/database-audit/realtime-grant-revoke.json schema v1 contains a sanitized PostgreSQL JSON cost plan for the exact internal DELETE shape with ANALYZE and BUFFERS disabled and a 5 s statement timeout; the isolated fixture plan begins at ModifyTable.",
    sensitiveColumns: ["profile grant relationship"],
    returnedDataShape: "Supabase RPC error envelope only",
    notFoundBehaviour:
      "No matching grant is a successful idempotent no-op; the second identical isolated call preserves the remaining row count.",
    unauthorizedBehaviour:
      "PUBLIC, anon and authenticated have no EXECUTE privilege and both role calls tested are denied before the security-definer body; service_role has function EXECUTE but no direct table privilege.",
    conflictBehaviour:
      "Deterministically ordered per-profile advisory locks serialize replacement/revocation, and repeated deletion is idempotent.",
    failureBehaviour:
      "The Supabase request carries a five-second AbortSignal deadline; timeout or RPC error withholds success. The app-database block has already committed, so future token issuance fails closed on blocked state even when stale-grant revocation needs retry; deployed cross-database retry telemetry remains a trace residual.",
    tests: [
      "scripts/check-realtime-grant-revoke-postgres.test.ts",
      "src/lib/realtime-authorization.test.ts",
    ],
    evidence: [
      "output/database-audit/realtime-grant-revoke.json schema v1 is source-bound to the exact self-hosted Supabase policy SQL, application RPC service, verifier/test, unit test and this registry record. On fixed loopback port 55734 it creates only greyhoundiq_realtime_proof, installs the exact table/function/grants, invokes the function as non-superuser service_role, and then drops the database and any proof-created roles without provider contact.",
      "The isolated proof verifies SECURITY DEFINER with an empty search_path, ten-profile/ten-topic bounds, strict conversation topic format, sorted advisory locks, service-role-only function execution, no service-role direct table access, four matching rows deleted from six, two unrelated rows preserved, an idempotent replay, anonymous/authenticated denials, three invalid-input denials, a parameterized three-bind invocation and a sanitized non-ANALYZE delete plan.",
      "The application test proves duplicate/blank profile normalization and the exact RPC payload. Production Supabase deployment parity, cross-database retry/alert telemetry and operational application of the SQL file remain separate release gates.",
      "src/lib/realtime-service.ts applies AbortSignal.timeout(5000) to the production PostgREST RPC builder before awaiting the revocation result.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.MEDIA.ASSET.STATUS.SELECT",
    traceId: "MEDIA.ASSET.READ",
    sourceFile: "src/lib/media-service.ts",
    sourceSymbol: "getMediaStatusForCurrentUser",
    ormOrDriver: "Prisma",
    ormOperation: "tx.mediaAsset.findFirst",
    normalizedSql:
      'SELECT "public"."MediaAsset"."id", "public"."MediaAsset"."originalName", "public"."MediaAsset"."scanStatus", "public"."MediaAsset"."processingStatus", "public"."MediaAsset"."processingError", "public"."MediaAsset"."createdAt", "public"."MediaAsset"."updatedAt" FROM "public"."MediaAsset" WHERE ("public"."MediaAsset"."id" = $1 AND "public"."MediaAsset"."uploaderId" = $2 AND "public"."MediaAsset"."deletedAt" IS NULL) LIMIT $3 OFFSET $4',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "select",
    tables: ["MediaAsset"],
    views: [],
    columnsRead: [
      "id",
      "originalName",
      "scanStatus",
      "processingStatus",
      "processingError",
      "createdAt",
      "updatedAt",
    ],
    columnsWritten: [],
    boundParameters: [
      "mediaId ($1)",
      "current.dbUserId ($2)",
      "Prisma findFirst take=1 ($3)",
      "Prisma offset=0 ($4)",
    ],
    parameterized: true,
    ownershipPredicate: "id = :mediaId AND uploaderId = :dbUserId",
    visibilityPredicate: "deletedAt IS NULL",
    rowLevelSecurityPolicies: ["giq_media_select"],
    expectedRowCount: "zero or one media record",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary: requestTransaction,
    isolationLevel: "Prisma/PostgreSQL default; not captured",
    locks: [],
    concurrencyControl: "Read-only status snapshot.",
    indexesExpected: ["MediaAsset_pkey", "MediaAsset_uploaderId_createdAt_idx"],
    constraintsReliedOn: ["MediaAsset_pkey"],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json databaseOperationProofs[2]: sanitized PostgreSQL JSON COSTS plan with ANALYZE/BUFFERS disabled and a 5 s statement timeout; the six-row disposable fixture observed Limit over MediaAsset with RLS Message/MessageMedia subplans. The artifact integrity-validates the exact full cost-plan SHA-256; this does not claim an immutable optimizer shape or representative-scale performance.",
    sensitiveColumns: ["originalName", "processingError"],
    returnedDataShape: "Explicit seven-field status projection",
    notFoundBehaviour: "Throws media.not_found for missing, deleted or other-owner records.",
    unauthorizedBehaviour: "Other-owner records are indistinguishable from missing records.",
    conflictBehaviour: "Not applicable to read.",
    failureBehaviour: "Transaction rolls back and route maps through jsonError.",
    tests: [
      "src/lib/media-service.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json binds an isolated literal-loopback port-55734 execution to getMediaStatusForCurrentUser as login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public: the owner received the exact seven-field projection, other-owner and missing IDs both returned media.not_found, the six controlled MediaAsset rows had zero count delta and exact-ID cleanup returned them to zero.",
      "The same source-bound evidence captures sanitized observed SQL SHA-256 acd2daa18098c8825e1a3e4780d82d38ee3debbb0a8cdf80b988af1b83fc4301, all four named bind positions with no values persisted, and a non-ANALYZE PostgreSQL JSON cost plan. No staging or production system was contacted; representative-volume plan validation remains separate scale evidence.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.MEDIA.ASSET.DELETE.TOMBSTONE",
    traceId: "MEDIA.ASSET.DELETE",
    sourceFile: "src/lib/media-service.ts",
    sourceSymbol: "deleteMediaForCurrentUser",
    ormOrDriver: "Prisma",
    ormOperation: "tx.mediaAsset.updateMany",
    normalizedSql:
      'UPDATE "public"."MediaAsset" SET "deletedAt" = $1, "updatedAt" = $2 WHERE ("public"."MediaAsset"."id" = $3 AND "public"."MediaAsset"."deletedAt" IS NULL)',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "update",
    tables: ["MediaAsset"],
    views: [],
    columnsRead: ["id", "uploaderId", "deletedAt", "storageBucket", "storagePath"],
    columnsWritten: ["deletedAt"],
    boundParameters: [
      "deletedAt ($1)",
      "Prisma updatedAt ($2)",
      "mediaId ($3)",
    ],
    parameterized: true,
    ownershipPredicate: "Initial find uses id = :mediaId AND uploaderId = :dbUserId.",
    visibilityPredicate: "deletedAt IS NULL",
    rowLevelSecurityPolicies: ["giq_media_select", "giq_media_update"],
    expectedRowCount: "exactly one media record",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary: requestTransaction,
    isolationLevel: "Prisma/PostgreSQL default; runtime isolation level not captured",
    locks: ["PostgreSQL UPDATE row lock; exact lock mode not captured"],
    concurrencyControl:
      "The owner lookup and bounded update run in one captured request transaction; updateMany must affect exactly one row, and the verified duplicate call returns media.not_found while retaining one tombstone and one audit row.",
    indexesExpected: ["MediaAsset_pkey"],
    constraintsReliedOn: ["MediaAsset_pkey"],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json databaseOperationProofs[8]: sanitized PostgreSQL JSON COSTS ModifyTable plan with ANALYZE/BUFFERS disabled and a 5 s statement timeout. The six-row disposable fixture selected a MediaAsset sequential scan with RLS subplans, so representative-volume index selection remains a separate scale test; the artifact integrity-validates exact plan SHA-256 f8c551e607f3573283d09e9cc8fb4c811894eb381944f752ba15e49753f44d1f.",
    sensitiveColumns: ["uploaderId", "storagePath"],
    returnedDataShape: "The previously selected media record with the new deletedAt timestamp.",
    notFoundBehaviour: "Throws media.not_found when owner predicate or affected-row check fails.",
    unauthorizedBehaviour:
      "The service owner predicate makes other-owner objects indistinguishable from missing objects. Exact update SQL replay as a non-owner, non-moderator runtime user affected zero rows under RLS; giq_media_update separately permits system/moderator database contexts, while this service does not expose that override.",
    conflictBehaviour:
      "The verified sequential duplicate affects no row and returns media.not_found; concurrent-delete timing remains unmeasured.",
    failureBehaviour:
      "A forced in-transaction failure rolled back deletedAt. Storage cleanup and AuditLog creation occur after the media transaction; Storage is best effort, while a later audit failure would not undo the committed tombstone.",
    tests: [
      "src/lib/media-service.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v16 databaseOperationProofs[8] binds the real deleteMediaForCurrentUser path to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal-loopback port 55734: the owner created exactly one tombstone and one media.delete audit row; other-owner, missing and duplicate calls returned media.not_found; a forced rollback preserved deletedAt = NULL; exact SQL replay under another runtime user affected zero rows; exact-scope cleanup removed one audit row and all controlled rows.",
      "The source-bound proof captures exact normalized UPDATE SHA-256 2074a0c3129729c0fe28b071456343bd54de1b72b437dbb28d63501e23039353, all three named bind positions without persisting values, a committed service transaction and a non-ANALYZE cost plan. Realtime was disabled and Storage rejected a deliberately invalid synthetic object key before any provider access; the selected fixture has no FeedPostMedia link, so FeedPost transitions, Realtime delivery, provider Storage deletion, concurrency timing and representative-volume planning remain explicit residuals.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.ACCOUNT.DELETION.REQUEST.TRANSACTION",
    traceId: "ACCOUNT.DELETION.EXECUTE",
    sourceFile: "src/lib/account-service.ts",
    sourceSymbol: "requestAccountDeletion",
    ormOrDriver: "Prisma",
    ormOperation:
      "optional tx.profile.count; tx.user.update; tx.auditLog.create in one request-context transaction",
    normalizedSql:
      'UPDATE "public"."User" SET "email" = $1, "isBanned" = $2, "deletionRequestedAt" = $3, "updatedAt" = $4 WHERE ("public"."User"."id" = $5 AND 1=1) RETURNING "public"."User"."id", "public"."User"."email", "public"."User"."name", "public"."User"."subscriptionTier", "public"."User"."stripeCustomerId", "public"."User"."stripeSubscriptionId", "public"."User"."isBanned", "public"."User"."deletionRequestedAt", "public"."User"."createdAt", "public"."User"."updatedAt", "public"."User"."workosUserId"',
    normalizedSqlVariants: [
      {
        variant: "user-update",
        normalizedSql:
          'UPDATE "public"."User" SET "email" = $1, "isBanned" = $2, "deletionRequestedAt" = $3, "updatedAt" = $4 WHERE ("public"."User"."id" = $5 AND 1=1) RETURNING "public"."User"."id", "public"."User"."email", "public"."User"."name", "public"."User"."subscriptionTier", "public"."User"."stripeCustomerId", "public"."User"."stripeSubscriptionId", "public"."User"."isBanned", "public"."User"."deletionRequestedAt", "public"."User"."createdAt", "public"."User"."updatedAt", "public"."User"."workosUserId"',
        boundParameters: [
          "deletion request email ($1)",
          "isBanned=true ($2)",
          "deletionRequestedAt ($3)",
          "Prisma updatedAt ($4)",
          "current.dbUserId ($5)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS ModifyTable plan over User with ANALYZE/BUFFERS disabled and a 5 s statement timeout; exact plan SHA-256 baa0655eee927e449d8f366e4912729e931dc0f769420473970d366ccbe9cedd.",
      },
      {
        variant: "audit-insert",
        normalizedSql:
          'INSERT INTO "public"."AuditLog" ("actorId","actorType","action","targetType","targetId","ip","userAgent","metadata","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING "public"."AuditLog"."id", "public"."AuditLog"."actorId", "public"."AuditLog"."actorType", "public"."AuditLog"."action", "public"."AuditLog"."targetType", "public"."AuditLog"."targetId", "public"."AuditLog"."ip", "public"."AuditLog"."userAgent", "public"."AuditLog"."metadata", "public"."AuditLog"."createdAt"',
        boundParameters: [
          "current.dbUserId actor ($1)",
          "actorType ($2)",
          "action ($3)",
          "targetType ($4)",
          "current.dbUserId target ($5)",
          "request IP ($6)",
          "user agent ($7)",
          "audit metadata ($8)",
          "Prisma createdAt ($9)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS ModifyTable plan over AuditLog with ANALYZE/BUFFERS disabled and a 5 s statement timeout; exact plan SHA-256 9a2e3aa5f922c3e0872f6387dd861c2f80e70dcb4ea8c23ab9a4f61296a72ff4.",
      },
    ],
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "transaction",
    tables: ["Profile", "User", "AuditLog"],
    views: [],
    columnsRead: [
      "Profile.role",
      "Profile.userId",
      "User.isBanned",
      "User.deletionRequestedAt",
    ],
    columnsWritten: [
      "User.email",
      "User.isBanned",
      "User.deletionRequestedAt",
      "AuditLog.actorId",
      "AuditLog.actorType",
      "AuditLog.action",
      "AuditLog.targetType",
      "AuditLog.targetId",
      "AuditLog.ip",
      "AuditLog.userAgent",
      "AuditLog.metadata",
    ],
    boundParameters: [
      "deletion request email ($1)",
      "isBanned=true ($2)",
      "deletionRequestedAt ($3)",
      "Prisma updatedAt ($4)",
      "current.dbUserId ($5)",
    ],
    parameterized: true,
    ownershipPredicate: "User.id = current.dbUserId; actorId and targetId use the same server-derived ID.",
    visibilityPredicate:
      "Active-admin count uses Profile.role = admin and User.isBanned = false and deletionRequestedAt IS NULL.",
    rowLevelSecurityPolicies: [
      "giq_profile_select",
      "giq_user_select",
      "giq_user_update",
      "giq_audit_log_insert",
    ],
    expectedRowCount:
      "exactly one current-user update and one audit insert per accepted request; admin requests also read one scalar count",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary: requestTransaction,
    isolationLevel: "Prisma/PostgreSQL default; runtime isolation level not captured",
    locks: [
      "lockAdminAccessChanges transaction advisory lock captured for administrator requests",
      "PostgreSQL UPDATE row lock; exact lock mode not captured",
    ],
    concurrencyControl:
      "The last-active-administrator count and current-user mutation are serialized in the same captured transaction. Sequential repeat requests each remain bounded to one update and one audit insert; the operation intentionally records a second audit rather than claiming idempotency.",
    indexesExpected: ["User_pkey", "Profile_userId_key", "AuditLog_actorId_createdAt_idx"],
    constraintsReliedOn: ["User_pkey", "User_email_key", "Profile_userId_key"],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json databaseOperationProofs[9]: sanitized PostgreSQL JSON COSTS ModifyTable plans for User and AuditLog with ANALYZE/BUFFERS disabled and a 5 s statement timeout. The four-user disposable fixture selected a User sequential scan, so representative-volume index selection remains a separate scale test; the artifact integrity-validates exact plan SHA-256 values baa0655eee927e449d8f366e4912729e931dc0f769420473970d366ccbe9cedd and 9a2e3aa5f922c3e0872f6387dd861c2f80e70dcb4ea8c23ab9a4f61296a72ff4.",
    sensitiveColumns: ["User.email", "AuditLog.ip", "AuditLog.userAgent", "AuditLog.metadata"],
    returnedDataShape: "requestedAt Date returned to the route",
    notFoundBehaviour:
      "A missing current user causes the transaction to reject before any user or audit mutation.",
    unauthorizedBehaviour:
      "The final active administrator is denied before mutation. Exact User UPDATE replay under another non-system, non-moderator runtime identity returned zero rows under giq_user_update. Exact AuditLog INSERT ... RETURNING replay was rejected because the inserted row is not visible through giq_audit_log_select; however, giq_audit_log_insert still has WITH CHECK (true), so a non-returning direct insert remains an explicit policy residual rather than a security claim.",
    conflictBehaviour:
      "Email uniqueness or concurrent policy conflicts roll back the transaction. Sequential repeats are accepted and create a second bounded audit entry.",
    failureBehaviour:
      "A forced post-update failure rolled back both the User mutation and AuditLog insertion; missing-user and last-admin failures also left both exact scopes unchanged.",
    tests: [
      "src/lib/account-deletion.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v16 databaseOperationProofs[9] binds the real requestAccountDeletion path to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal-loopback port 55734: one owner request updated exactly one User and inserted one user.delete AuditLog row; the final active admin was denied with admin.last_admin_forbidden; a missing user created no audit; a forced transaction failure rolled back both writes; a sequential repeat remained bounded to one update and one new audit.",
      "The source-bound proof captures exact normalized User UPDATE SHA-256 da2d95d4d5cf089616bbb86c70eadfdfada4b7443bf39a7d6de6e94e161faf0a and AuditLog INSERT SHA-256 aa40e5ecfc9ca72336f803f0a2afea7bc44ee9bbfd2d19e94677246a9474708c, every named bind position without persisting values, the administrator advisory lock, and non-ANALYZE cost plans. Exact other-user UPDATE affected zero rows and exact INSERT ... RETURNING was rejected by RLS; permissive AuditLog INSERT WITH CHECK (true), concurrent timing, representative-volume planning, route authentication, provider execution and production recovery remain explicit residuals. Exact-scope cleanup removed both audit rows and all controlled rows.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.ACCOUNT.DELETION.PENDING.SELECT",
    traceId: "ACCOUNT.DELETION.EXECUTE",
    sourceFile: "src/lib/account-service.ts",
    sourceSymbol: "findPendingAccountDeletionUsers",
    ormOrDriver: "Prisma parameterized reads",
    ormOperation:
      "one bounded User.findMany candidate scan followed by the selected Profile.id relation read",
    normalizedSql:
      'SELECT "public"."User"."id", "public"."User"."email", "public"."User"."stripeCustomerId", "public"."User"."stripeSubscriptionId", "public"."User"."workosUserId", "public"."User"."deletionRequestedAt" FROM "public"."User" WHERE ("public"."User"."isBanned" = $1 AND "public"."User"."deletionRequestedAt" <= $2) ORDER BY "public"."User"."deletionRequestedAt" ASC, "public"."User"."id" ASC LIMIT $3 OFFSET $4',
    normalizedSqlVariants: [
      {
        variant: "users",
        normalizedSql:
          'SELECT "public"."User"."id", "public"."User"."email", "public"."User"."stripeCustomerId", "public"."User"."stripeSubscriptionId", "public"."User"."workosUserId", "public"."User"."deletionRequestedAt" FROM "public"."User" WHERE ("public"."User"."isBanned" = $1 AND "public"."User"."deletionRequestedAt" <= $2) ORDER BY "public"."User"."deletionRequestedAt" ASC, "public"."User"."id" ASC LIMIT $3 OFFSET $4',
        boundParameters: [
          "candidate isBanned=true ($1)",
          "30-day deletion cutoff ($2)",
          "candidate limit=25 ($3)",
          "Prisma skip=0 ($4)",
        ],
        explainPlanEvidence:
          "Dedicated schema-v1 disposable proof: Limit -> Sort -> Seq Scan on the one-row User probe; plan SHA-256 06877cbafcce9deaf31787d6189defafea11ca74cf1b57aac65a60d05cc61435. The tiny fixture does not prove representative-volume index selection.",
      },
      {
        variant: "profiles",
        normalizedSql:
          'SELECT "public"."Profile"."id", "public"."Profile"."userId" FROM "public"."Profile" WHERE "public"."Profile"."userId" IN ($1) OFFSET $2',
        boundParameters: [
          "loaded candidate user IDs ($1)",
          "Prisma skip=0 ($2)",
        ],
        explainPlanEvidence:
          "Dedicated schema-v1 disposable proof: Seq Scan on the one-row Profile probe; plan SHA-256 2f48308aaf97ac5a83cff34a026df4645f05af9116c1894e67cfe64fd58822fb. The query is bounded by the at-most-25 candidate IDs.",
      },
    ],
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "select",
    tables: ["User", "Profile"],
    views: [],
    columnsRead: [
      "User.id",
      "User.email",
      "User.stripeCustomerId",
      "User.stripeSubscriptionId",
      "User.workosUserId",
      "User.deletionRequestedAt",
      "Profile.id",
    ],
    columnsWritten: [],
    boundParameters: [
      "candidate isBanned=true ($1)",
      "30-day deletion cutoff ($2)",
      "candidate limit=25 ($3)",
      "Prisma skip=0 ($4)",
    ],
    parameterized: true,
    visibilityPredicate: "User.isBanned = true AND deletionRequestedAt <= cutoff",
    rowLevelSecurityPolicies: ["giq_user_select", "giq_profile_select"],
    expectedRowCount: "zero to 25 due account-deletion candidates",
    maximumRowCount: 25,
    paginationRequired: false,
    transactionBoundary: systemTransaction,
    isolationLevel: "Prisma/PostgreSQL default read committed",
    locks: [],
    concurrencyControl:
      "No candidate lease is acquired; concurrent maintenance invocations are not proven duplicate-safe.",
    indexesExpected: ["User_isBanned_deletionRequestedAt_id_idx"],
    constraintsReliedOn: ["User_pkey", "Profile_userId_key"],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/account-deletion-pending-select.json schema v1 captures the exact User Limit plan and Profile relation plan with ANALYZE/BUFFERS disabled and a 5 s EXPLAIN timeout. The dedicated proof also catalog-verifies User_isBanned_deletionRequestedAt_id_idx; representative-volume index selection remains a load-test residual.",
    sensitiveColumns: [
      "User.email",
      "User.stripeCustomerId",
      "User.stripeSubscriptionId",
      "User.workosUserId",
    ],
    returnedDataShape: "Explicit candidate and Profile.id projection",
    notFoundBehaviour: "An empty result is a successful no-op.",
    unauthorizedBehaviour: "The internal route rejects invalid credentials before this system-context query.",
    conflictBehaviour: "Concurrent maintenance selection is not serialized.",
    failureBehaviour: "The invocation returns a safe internal-route error; no candidate is processed.",
    tests: [
      "src/lib/account-deletion.test.ts",
      "scripts/check-account-deletion-pending-select-postgres.test.ts",
    ],
    evidence: [
      "output/database-audit/account-deletion-pending-select.json schema v1 source-binds the real findPendingAccountDeletionUsers path and executes it as login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal loopback port 55734.",
      "The dedicated proof returns one exact expired banned candidate, captures both exact parameterized SQL statements and sanitized plans, proves an earlier cutoff returns zero through the same bounded User SQL, and retains the probe unchanged until exact cleanup deletes one Profile plus one User and proves zero remain.",
      "Exact replay returns [1,1] rows under system context and [0,1] under anonymous and unrelated-member contexts: sensitive User candidate data is denied, while the already-ID-addressed public Profile.id remains readable by the existing public profile policy. The proof catalog-verifies the forward-only concurrent three-column index. Candidate leasing/concurrent finalization and deployed parity remain separate gates.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.ACCOUNT.DELETION.FINALIZE.TRANSACTION",
    traceId: "ACCOUNT.DELETION.EXECUTE",
    sourceFile: "src/lib/account-service.ts",
    sourceSymbol: "runAccountDeletionMaintenance",
    ormOrDriver: "Prisma plus parameterized PostgreSQL CTE mutations",
    ormOperation:
      "lock and revalidate each due candidate, advance eight ownership tables through ordered 100-row FOR UPDATE SKIP LOCKED CTE mutations, and write final jobs/anonymization/audit only after every batch drains",
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "transaction",
    normalizedSqlArtifact:
      "output/database-audit/account-deletion-finalize.json#proof.statements[*].observedSql.normalizedSql",
    tables: [
      "Message",
      "Post",
      "Thread",
      "Listing",
      "Profile",
      "SocialActor",
      "DeletionJob",
      "MediaAsset",
      "MemoryEntry",
      "ConversationContext",
      "AgentRun",
      "User",
      "AuditLog",
    ],
    views: [],
    columnsRead: ["owned-record identifiers", "User provider reference identifiers"],
    columnsWritten: [
      "authored message tombstone fields",
      "owned post/thread/listing/profile/social-actor anonymization fields",
      "DeletionJob storage target fields",
      "MediaAsset originalName/sha256/deletedAt",
      "MemoryEntry content/sourceRef/importance/deletedAt",
      "AgentRun user/content fields",
      "User email/name/tier/deletionRequestedAt",
      "AuditLog finalization fields",
    ],
    boundParameters: ["candidate user ID", "candidate profile ID", "now", "server-generated tombstones"],
    parameterized: true,
    ownershipPredicate:
      "Each content mutation is constrained by the selected candidate user/profile ID; messages use senderId only.",
    visibilityPredicate: "Only the selected due candidate is finalized in each transaction.",
    rowLevelSecurityPolicies: [
      "system-context policies for User, Profile, SocialActor, Message, Post, Thread, Listing, MediaAsset, MemoryEntry, ConversationContext, AgentRun, DeletionJob and AuditLog",
    ],
    expectedRowCount:
      "per candidate transaction: one locked User, zero to 100 rows from each of eight ownership tables, at most one Profile, one personal SocialActor and one batch audit; a drained final pass instead creates exactly two storage jobs plus one User and one final audit",
    maximumRowCount: 20_100,
    paginationRequired: false,
    transactionBoundary: systemTransaction,
    isolationLevel: "PostgreSQL read committed, captured through the real system-context path",
    locks: [
      "one due User candidate row through SELECT ... FOR UPDATE",
      "up to 100 matching rows per ownership table through ordered FOR UPDATE SKIP LOCKED CTE targets",
    ],
    concurrencyControl:
      "The candidate User lock serializes duplicate workers and the locked due predicate is revalidated after waiting; ordered SKIP LOCKED content batches bound lock scope and finalization occurs only after all eight batches return fewer than 100 rows.",
    indexesExpected: [
      "User_pkey",
      "Profile_userId_key",
      "SocialActor_profileId_key",
      "Message_senderId_idx",
      "Post_authorId_createdAt_idx",
      "Thread_authorId_createdAt_idx",
      "Listing_profileId_idx",
      "DeletionJob_targetUserId_idx",
      "MediaAsset_uploaderId_sha256_idx",
      "MemoryEntry_userId_kind_idx",
      "ConversationContext_userId_agentType_key",
      "AgentRun_userId_idx",
    ],
    constraintsReliedOn: [
      "primary and foreign keys declared in prisma/schema.prisma",
      "User_email_key",
      "Profile_userId_key",
      "SocialActor_profileId_key",
    ],
    triggersInvoked: [
      "effective Profile and Listing entitlement triggers execute under the scoped system context",
    ],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/account-deletion-finalize.json schema v1 captures sanitized PostgreSQL JSON cost plans for 17 exact observed statement variants with ANALYZE/BUFFERS disabled and a 5 s statement timeout. Small disposable fixtures may select sequential scans; representative-volume index selection remains a load-test residual.",
    sensitiveColumns: [
      "private message body/media references",
      "profile contact fields",
      "provider reference identifiers",
      "memory and agent-run content",
    ],
    returnedDataShape: "Per-candidate scrub, archive, tombstone and job counts",
    notFoundBehaviour: "A candidate without a profile still receives user-owned cleanup and anonymization.",
    unauthorizedBehaviour: "Only the authenticated internal system path may initiate maintenance.",
    conflictBehaviour:
      "A transaction conflict rolls back the entire candidate batch; no in-request retry is performed and a later bounded maintenance invocation reselects the still-due candidate.",
    failureBehaviour:
      "All database changes for the current candidate roll back together. Durable storage jobs run only after database finalization; remote WorkOS and Stripe references are retained and explicitly reported rather than falsely claimed deleted.",
    tests: [
      "src/lib/account-deletion.test.ts",
      "scripts/check-account-deletion-finalize-postgres.test.ts",
    ],
    evidence: [
      "output/database-audit/account-deletion-finalize.json schema v1 is source-bound to the maintenance service, database context, effective RLS migrations, Prisma schema and this registry. As login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal loopback port 55734 it captures 17 exact parameterized SQL variants and sanitized plans without provider contact.",
      "A 101-message fixture proves a 100-row partial batch with no finalization or storage calls, a second pass drains the final row and commits two durable storage jobs plus anonymization and audit, and a third pass is an exact no-op. Counterparty-authored content remains unchanged.",
      "A deliberately conflicting deleted-email identity fails at the late User update and proves earlier Message/Profile mutations, jobs and final audit all roll back. Exact cleanup removes 5 audits, 2 jobs and 118 other fixture rows and proves zero proof rows remain.",
      "Managed-page or organization ownership transfer, remote WorkOS/Stripe deletion, session revocation, production deployment parity and representative-volume plan/load evidence remain separate release residuals.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.ACCOUNT.DELETION.STORAGE_JOBS.PROCESS",
    traceId: "ACCOUNT.DELETION.EXECUTE",
    sourceFile: "src/lib/account-service.ts",
    sourceSymbol: "runAccountStorageDeletionJobs",
    ormOrDriver: "Prisma plus Supabase Storage client",
    ormOperation:
      "tx.deletionJob.findMany/updateMany/update and tx.auditLog.create across bounded per-step system transactions",
    normalizedSql:
      'SELECT "public"."DeletionJob"."id", "public"."DeletionJob"."targetType", "public"."DeletionJob"."targetUserId", "public"."DeletionJob"."storageBucket", "public"."DeletionJob"."storagePath" FROM "public"."DeletionJob" WHERE ("public"."DeletionJob"."targetType" = $1 AND "public"."DeletionJob"."scheduledFor" <= $2 AND ("public"."DeletionJob"."status" = $3 OR ("public"."DeletionJob"."status" = $4 AND "public"."DeletionJob"."updatedAt" <= $5))) ORDER BY "public"."DeletionJob"."scheduledFor" ASC, "public"."DeletionJob"."createdAt" ASC LIMIT $6 OFFSET $7',
    normalizedSqlVariants: [
      {
        variant: "due-job-select",
        normalizedSql:
          'SELECT "public"."DeletionJob"."id", "public"."DeletionJob"."targetType", "public"."DeletionJob"."targetUserId", "public"."DeletionJob"."storageBucket", "public"."DeletionJob"."storagePath" FROM "public"."DeletionJob" WHERE ("public"."DeletionJob"."targetType" = $1 AND "public"."DeletionJob"."scheduledFor" <= $2 AND ("public"."DeletionJob"."status" = $3 OR ("public"."DeletionJob"."status" = $4 AND "public"."DeletionJob"."updatedAt" <= $5))) ORDER BY "public"."DeletionJob"."scheduledFor" ASC, "public"."DeletionJob"."createdAt" ASC LIMIT $6 OFFSET $7',
        boundParameters: [
          "user_storage_prefix target type ($1)",
          "worker now ($2)",
          "pending status ($3)",
          "processing status ($4)",
          "15-minute lease cutoff ($5)",
          "take=10 ($6)",
          "offset=0 ($7)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS plan for the exact bounded due-job selector with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "claim-job-update",
        normalizedSql:
          'UPDATE "public"."DeletionJob" SET "status" = $1, "updatedAt" = $2 WHERE ("public"."DeletionJob"."id" = $3 AND ("public"."DeletionJob"."status" = $4 OR ("public"."DeletionJob"."status" = $5 AND "public"."DeletionJob"."updatedAt" <= $6)))',
        boundParameters: [
          "processing status ($1)",
          "Prisma updatedAt ($2)",
          "selected job ID ($3)",
          "pending status ($4)",
          "processing status ($5)",
          "15-minute lease cutoff ($6)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS plan for the exact affected-row lease claim with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "outcome-job-update",
        normalizedSql:
          'UPDATE "public"."DeletionJob" SET "status" = $1, "completedAt" = $2, "updatedAt" = $3 WHERE ("public"."DeletionJob"."id" = $4 AND 1=1) RETURNING "public"."DeletionJob"."id", "public"."DeletionJob"."policyId", "public"."DeletionJob"."targetType", "public"."DeletionJob"."targetUserId", "public"."DeletionJob"."storageBucket", "public"."DeletionJob"."storagePath", "public"."DeletionJob"."status", "public"."DeletionJob"."scheduledFor", "public"."DeletionJob"."completedAt", "public"."DeletionJob"."requestedByUserId", "public"."DeletionJob"."createdAt", "public"."DeletionJob"."updatedAt"',
        boundParameters: [
          "completed, pending or failed outcome status ($1)",
          "worker now or null completedAt ($2)",
          "Prisma updatedAt ($3)",
          "claimed job ID ($4)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS plan for the exact one-job outcome update with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
      {
        variant: "audit-result-insert",
        normalizedSql:
          'INSERT INTO "public"."AuditLog" ("actorType","action","targetType","targetId","metadata","createdAt") VALUES ($1,$2,$3,$4,$5,$6) RETURNING "public"."AuditLog"."id", "public"."AuditLog"."actorId", "public"."AuditLog"."actorType", "public"."AuditLog"."action", "public"."AuditLog"."targetType", "public"."AuditLog"."targetId", "public"."AuditLog"."ip", "public"."AuditLog"."userAgent", "public"."AuditLog"."metadata", "public"."AuditLog"."createdAt"',
        boundParameters: [
          "system actor type ($1)",
          "success or safe failure action ($2)",
          "deletionJob target type ($3)",
          "claimed job ID ($4)",
          "bounded result metadata or safe error code ($5)",
          "Prisma createdAt ($6)",
        ],
        explainPlanEvidence:
          "Sanitized PostgreSQL JSON COSTS plan for the exact system audit insert with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
      },
    ],
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "transaction",
    tables: ["DeletionJob", "AuditLog"],
    views: [],
    columnsRead: [
      "DeletionJob.id",
      "targetType",
      "targetUserId",
      "storageBucket",
      "storagePath",
      "status",
      "scheduledFor",
      "updatedAt",
    ],
    columnsWritten: [
      "DeletionJob.status",
      "DeletionJob.completedAt",
      "AuditLog storage result fields",
    ],
    boundParameters: ["now", "leaseCutoff", "job ID", "batch result", "safe error code"],
    parameterized: true,
    visibilityPredicate:
      "targetType = user_storage_prefix; scheduledFor <= now; pending or expired processing lease",
    rowLevelSecurityPolicies: [
      "giq_deletion_job_read",
      "giq_deletion_job_write",
      "giq_audit_log_insert",
    ],
    expectedRowCount: "zero to 10 selected jobs; each claim/status update targets one job",
    maximumRowCount: 10,
    paginationRequired: false,
    transactionBoundary:
      "Separate withDbSystemContext transactions select, claim and record each job outcome.",
    isolationLevel:
      "PostgreSQL read committed, captured in the same system-context transaction helper used by the worker.",
    locks: [
      "Each updateMany claim takes the row lock required by PostgreSQL UPDATE; a zero affected-row result loses the lease without running the provider handler.",
    ],
    concurrencyControl:
      "updateMany claim must affect one row; stale processing leases are recoverable after 15 minutes.",
    indexesExpected: [
      "DeletionJob_targetType_status_idx",
      "DeletionJob_status_scheduledFor_idx",
      "DeletionJob_storageBucket_storagePath_idx",
    ],
    constraintsReliedOn: ["DeletionJob_pkey"],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/account-storage-deletion-jobs.json schema v1 proof.statements contains sanitized PostgreSQL JSON cost plans for all four exact statement variants with ANALYZE/BUFFERS disabled and a 5 s statement timeout.",
    sensitiveColumns: ["targetUserId", "storageBucket", "storagePath"],
    returnedDataShape: "Completed/failed job and deleted-object counts",
    notFoundBehaviour: "No due jobs is a successful no-op.",
    unauthorizedBehaviour: "Only system context can claim or update jobs under RLS.",
    conflictBehaviour: "A zero-row claim is skipped because another worker won the lease.",
    failureBehaviour:
      "A provider-batch failure records terminal failed plus a safe-code audit in one system transaction; a database failure rolls that outcome transaction back and leaves processing recoverable after the 15-minute lease. Automated retry of terminal failed jobs remains a separate lifecycle residual.",
    tests: [
      "src/lib/account-deletion.test.ts",
      "scripts/check-account-storage-deletion-jobs-postgres.test.ts",
    ],
    evidence: [
      "The test proves a 500-object storage batch, allowed bucket/prefix validation and cross-prefix rejection.",
      "output/database-audit/account-storage-deletion-jobs.json schema v1 is source-bound to the worker, database context, effective RLS migrations and storage implementation. As login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal-loopback port 55734 it proves the bounded selector, completed/partial/failed outcomes, safe provider-error coding, expired-lease recovery, fresh/future/non-storage exclusion, exact member/anonymous denial, two-worker one-winner contention, atomic outcome/audit pairs, no-op behavior, exact SQL/cost plans and exact cleanup without provider contact. Real Supabase response integration, production deployment parity and automated retry or operator requeue of terminal failed jobs remain separate release residuals.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.ACCOUNT.DATA_EXPORT.READ",
    traceId: "ACCOUNT.DATA_EXPORT.DOWNLOAD",
    sourceFile: "src/lib/user-export-service.ts",
    sourceSymbol: "readUserExportData",
    ormOrDriver: "Prisma plus parameterized PostgreSQL LATERAL queries",
    ormOperation:
      "one member-context transaction containing explicit user/profile projections, ten owner-scoped bounded collection reads and per-parent bounded ListingMedia/MessageMedia LATERAL reads",
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "transaction",
    normalizedSqlArtifact:
      "output/database-audit/user-export-read.json#proof.statements[*].observedSql.normalizedSql",
    tables: [
      "User",
      "Profile",
      "DogOwnership",
      "Dog",
      "Thread",
      "ForumCategory",
      "Post",
      "Listing",
      "ListingMedia",
      "MediaAsset",
      "Conversation",
      "Message",
      "MessageMedia",
      "MemoryEntry",
      "AgentRun",
    ],
    views: [],
    columnsRead: [
      "explicit user/profile identity and preference fields",
      "owned dog, community, listing and message fields",
      "safe media metadata",
      "memory content and safe agent-run status/timing fields",
    ],
    columnsWritten: [],
    boundParameters: [
      "current.dbUserId",
      "current.profileId",
      "COLLECTION_TAKE = 501",
      "NESTED_COLLECTION_TAKE = 21",
    ],
    parameterized: true,
    ownershipPredicate:
      "Root reads use current.dbUserId/current.profileId for user, profile, author, listing owner, conversation participant, message sender/recipient, uploader, memory owner and agent-run owner.",
    rowLevelSecurityPolicies: [
      "giq_user_select",
      "giq_profile_select",
      "giq_dog_ownership_select",
      "giq_thread_select",
      "giq_post_select",
      "giq_listing_select",
      "giq_listing_media_select",
      "giq_conversation_select",
      "giq_message_select",
      "giq_message_media_select",
      "giq_media_select",
      "giq_memory_entry_select",
      "giq_agent_run_select",
    ],
    expectedRowCount:
      "zero/one user and profile; each of ten top-level collections reads at most 501 sentinel rows and each selected listing/sent-message/received-message parent reads at most 21 media sentinel rows. Conservative accepted-path ceiling = 2 identity + 5,000 top-level + 5,000 related-projection + (3 x 500 x 21) nested-sentinel rows = 41,502.",
    maximumRowCount: 41_502,
    paginationRequired: false,
    transactionBoundary: requestTransaction,
    isolationLevel: "PostgreSQL read committed, captured through the real member-context transaction",
    locks: [],
    concurrencyControl:
      "One transaction supplies one authenticated member context, but read committed does not provide a repeatable snapshot across all statements; a concurrently changed relation may appear in the later nested-media phase and is retained as a documented consistency residual.",
    indexesExpected: [
      "User_pkey",
      "Profile_pkey",
      "DogOwnership_profileId_status_createdAt_idx",
      "Thread_authorId_createdAt_idx",
      "Post_authorId_createdAt_idx",
      "Listing_profileId_idx",
      "Conversation_participantAId_idx",
      "Conversation_participantBId_idx",
      "Message_senderId_idx",
      "Message_recipientId_idx",
      "MediaAsset_uploaderId_createdAt_idx",
      "MemoryEntry_userId_kind_idx",
      "AgentRun_userId_createdAt_idx",
      "ListingMedia_pkey",
      "MessageMedia_pkey",
    ],
    constraintsReliedOn: [
      "User_pkey",
      "Profile_pkey",
      "Profile_userId_key",
      "ListingMedia_listingId_position_key",
      "MessageMedia_messageId_position_key",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/user-export-read.json schema v1 contains sanitized PostgreSQL JSON cost plans for 18 exact observed SELECT variants with ANALYZE/BUFFERS disabled and a 5 s statement timeout. Small disposable fixtures may select sequential scans; representative-volume index selection remains a load-test residual.",
    sensitiveColumns: ["email", "phone", "messages", "memory content", "media metadata"],
    returnedDataShape: "Explicit greyhoundiq-user-export/v2 DTO; provider/storage/agent-internal fields denied",
    notFoundBehaviour: "Missing optional records serialize as null/empty collections without exposing another user.",
    unauthorizedBehaviour:
      "The POST route authenticates before the service and supplies server-derived current IDs. User, private media, message, conversation, memory and agent rows additionally enforce effective RLS. Profile/forum rows and some approved marketplace rows are intentionally public, so their export isolation relies on the non-user-controlled owner predicates rather than a false RLS-denial claim.",
    conflictBehaviour: "Not applicable to the read snapshot.",
    failureBehaviour:
      "Any read, sentinel or DTO failure returns a private/no-store safe error and writes no completion artifact. A 501st top-level row, 21st per-parent media row or response above 8 MiB fails with export.too_large before audit/artifact completion.",
    tests: [
      "src/lib/user-export-policy.test.ts",
      "src/app/api/users/me/export/route.test.ts",
      "scripts/check-user-export-read-postgres.test.ts",
    ],
    evidence: [
      "output/database-audit/user-export-read.json schema v1 is source-bound to the extracted database service, POST route, DTO policy, database context, effective RLS migrations, Prisma schema and this registry. As login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime on literal loopback port 55734 it captures 18 exact parameterized SELECT variants and sanitized plans without provider contact.",
      "The disposable proof reads all populated private/public workload classes through the real member-context service, records owner/other/anonymous replay counts per exact SQL variant, proves sensitive User/private-media/MemoryEntry/AgentRun rows are owner-visible and other/anonymous-denied, and proves anonymous denial for conversation/message variants. It explicitly records that public rows rely on server-derived owner predicates.",
      "A 501-row AgentRun sentinel proves the top-level collection fails closed; a 21-row ListingMedia sentinel proves the per-parent LATERAL database limit and fails closed. Provider identifiers, storage coordinates/hashes, raw agent inputs/outputs and memory source references are canary-proved absent; the DTO forbidden-field scanner and 8 MiB response policy remain source-bound.",
      "Exact cleanup removes 21 listing links, 2 message links, 23 media rows and the remaining fixed relationship/user graph, then proves zero proof rows remain. Repeatable-read snapshot semantics, a real managed asynchronous export for oversized accounts, deployed parity and representative-volume load evidence remain release residuals.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.ACCOUNT.DATA_EXPORT.AUDIT.INSERT",
    traceId: "ACCOUNT.DATA_EXPORT.DOWNLOAD",
    sourceFile: "src/lib/account-service.ts",
    sourceSymbol: "recordUserExportCompletion",
    ormOrDriver: "Prisma parameterized createMany",
    ormOperation:
      "recordUserExportCompletion -> insertAuditLog -> tx.auditLog.createMany",
    normalizedSql:
      'INSERT INTO "public"."AuditLog" ("actorId","actorType","action","targetType","targetId","ip","userAgent","metadata","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "insert",
    tables: ["AuditLog"],
    views: [],
    columnsRead: [],
    columnsWritten: [
      "actorId",
      "actorType",
      "action",
      "targetType",
      "targetId",
      "ip",
      "userAgent",
      "metadata",
    ],
    boundParameters: [
      "current.dbUserId actor ($1)",
      "actorType=user ($2)",
      "action=user.export ($3)",
      "targetType=user ($4)",
      "current.dbUserId target ($5)",
      "request IP ($6)",
      "request user agent ($7)",
      "format/schema/size/count metadata without export body ($8)",
      "Prisma createdAt ($9)",
    ],
    parameterized: true,
    ownershipPredicate: "actorId and targetId both equal current.dbUserId.",
    rowLevelSecurityPolicies: ["giq_audit_log_insert"],
    expectedRowCount: "one audit record",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary:
      "Same withDbRequestContext transaction as the completed ExportArtifact INSERT.",
    isolationLevel:
      "PostgreSQL default inside withDbRequestContext; the service does not override it.",
    locks: [],
    concurrencyControl: "No idempotency key; the endpoint rate limit bounds repeated records.",
    indexesExpected: ["AuditLog_actorId_createdAt_idx", "AuditLog_action_createdAt_idx"],
    constraintsReliedOn: ["AuditLog_pkey"],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json: sanitized PostgreSQL JSON COSTS ModifyTable -> Result plan for one AuditLog INSERT, with ANALYZE and BUFFERS disabled and a 5 s EXPLAIN statement timeout; normalized SQL SHA-256 af86b600f17132e8e0583e874666a19417651fd04f2e4d900550163c46a1ecfa and plan SHA-256 d83890cecbd67cf96150c668166f7107887c83137dfe0ce6642b6642e94b1d95 are integrity-validated.",
    sensitiveColumns: ["ip", "userAgent", "metadata"],
    returnedDataShape: "createMany count; not returned to the browser",
    notFoundBehaviour: "Not applicable to insert.",
    unauthorizedBehaviour:
      "The owner insert is allowed in member request context; exact SQL replay for another member and anonymous context was rejected by giq_audit_log_insert, and an owner replay was forced to roll back.",
    conflictBehaviour: "No unique idempotency constraint is present.",
    failureBehaviour:
      "The response is withheld on failure. A deliberately RLS-rejected artifact insert rolled back its preceding audit insert in the same transaction.",
    tests: [
      "src/lib/user-export-policy.test.ts",
      "src/app/api/users/me/export/route.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v16 binds the real recordUserExportCompletion path to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public on literal loopback port 55734.",
      "A member-context call committed one AuditLog/ExportArtifact pair, a second call committed exactly one additional pair with the same bounded SQL shapes, other-member and anonymous exact audit replays were rejected, owner replay was allowed then rolled back, and a rejected artifact rolled back its paired audit.",
      "The source-bound POST contract delegates its paired writes exactly once to recordUserExportCompletion. The audit stores only format, schema version, byte size and collection counts; it never stores the export body. Deployed role/catalog parity, representative concurrency, staging and production remain unproven.",
    ],
    verificationStatus: "Verified",
  },
  {
    queryId: "DB.ACCOUNT.DATA_EXPORT.ARTIFACT.INSERT",
    traceId: "ACCOUNT.DATA_EXPORT.DOWNLOAD",
    sourceFile: "src/lib/account-service.ts",
    sourceSymbol: "recordUserExportCompletion",
    ormOrDriver: "Prisma parameterized create",
    ormOperation: "recordUserExportCompletion -> tx.exportArtifact.create",
    normalizedSql:
      'INSERT INTO "public"."ExportArtifact" ("id","exportType","status","targetUserId","requestedByUserId","sizeBytes","completedAt","expiresAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING "public"."ExportArtifact"."id", "public"."ExportArtifact"."exportType", "public"."ExportArtifact"."status", "public"."ExportArtifact"."targetUserId", "public"."ExportArtifact"."organizationId", "public"."ExportArtifact"."requestedByUserId", "public"."ExportArtifact"."storageBucket", "public"."ExportArtifact"."storagePath", "public"."ExportArtifact"."sha256", "public"."ExportArtifact"."sizeBytes", "public"."ExportArtifact"."completedAt", "public"."ExportArtifact"."expiresAt", "public"."ExportArtifact"."createdAt", "public"."ExportArtifact"."updatedAt"',
    databaseRole: "greyhoundiq_runtime",
    databaseName: "greyhoundiq",
    schemaName: "public",
    operationType: "insert",
    tables: ["ExportArtifact"],
    views: [],
    columnsRead: [],
    columnsWritten: [
      "exportType",
      "status",
      "targetUserId",
      "requestedByUserId",
      "sizeBytes",
      "completedAt",
      "expiresAt",
    ],
    boundParameters: [
      "generated ExportArtifact.id ($1)",
      "exportType=user_data ($2)",
      "status=completed ($3)",
      "current.dbUserId target ($4)",
      "current.dbUserId requester ($5)",
      "sizeBytes ($6)",
      "exportedAt ($7)",
      "seven-day expiry ($8)",
      "Prisma createdAt/updatedAt ($9, $10)",
    ],
    parameterized: true,
    ownershipPredicate:
      "targetUserId = current.dbUserId AND requestedByUserId = current.dbUserId in application data and RLS WITH CHECK.",
    visibilityPredicate:
      "owner insert policy additionally requires user_data/completed, no organization and no storage/hash fields.",
    rowLevelSecurityPolicies: [
      "giq_export_artifact_write",
      "giq_export_artifact_owner_insert",
    ],
    expectedRowCount: "one self-owned completed artifact record",
    maximumRowCount: 1,
    paginationRequired: false,
    transactionBoundary:
      "Same withDbRequestContext transaction as the user.export AuditLog INSERT.",
    isolationLevel:
      "PostgreSQL default inside withDbRequestContext; the service does not override it.",
    locks: [],
    concurrencyControl: "No idempotency key; per-user rate limiting bounds duplicates.",
    indexesExpected: [
      "ExportArtifact_targetUserId_createdAt_idx",
      "ExportArtifact_requestedByUserId_createdAt_idx",
      "ExportArtifact_expiresAt_idx",
    ],
    constraintsReliedOn: [
      "ExportArtifact_pkey",
      "ExportArtifact_targetUserId_fkey",
      "ExportArtifact_requestedByUserId_fkey",
    ],
    triggersInvoked: [],
    timeoutMilliseconds: 30_000,
    explainPlanEvidence:
      "output/database-audit/demo-fixture-idempotency.json: sanitized PostgreSQL JSON COSTS ModifyTable -> Result plan for one ExportArtifact INSERT, with ANALYZE and BUFFERS disabled and a 5 s EXPLAIN statement timeout; normalized SQL SHA-256 c0d4ea81b354d8d862cd789acd22d8164ca26fbfe44c1894a6af80ea0dcc0b32 and plan SHA-256 c804761aa043e69e7cba26ba88ae9ee258bb0cc6f841ae8ac981364cb590aeed are integrity-validated.",
    sensitiveColumns: ["targetUserId", "requestedByUserId", "sizeBytes"],
    returnedDataShape: "Created record is not returned to the browser.",
    notFoundBehaviour: "Not applicable to insert.",
    unauthorizedBehaviour:
      "Exact SQL replay for another member and anonymous context was rejected; an owner replay was allowed then rolled back. A member artifact carrying storage fields was rejected, and owner update/delete attempts affected zero rows.",
    conflictBehaviour: "No deduplication constraint is present.",
    failureBehaviour:
      "The response is withheld and marked private/no-store; artifact failure rolls back the paired audit insert in the same transaction.",
    tests: [
      "scripts/check-rls-policies.ts",
      "src/app/api/users/me/export/route.test.ts",
      "scripts/check-demo-route-fixture-idempotency.test.ts",
      "scripts/check-demo-route-fixture-evidence.test.ts",
    ],
    evidence: [
      "output/database-audit/demo-fixture-idempotency.json schema v16 binds the real recordUserExportCompletion INSERT to login-capable, non-superuser, non-BYPASSRLS greyhoundiq_runtime in greyhoundiq/public on literal loopback port 55734.",
      "A member-context call created one self-owned, storage-free completed artifact with exact seven-day expiry; a second call created one additional bounded row. Other-member/anonymous exact replays and a storage-bearing member insert were rejected, owner update/delete affected zero rows, and an owner exact replay was forced to roll back.",
      "The source-bound POST contract delegates its paired writes exactly once to recordUserExportCompletion. A deliberately invalid artifact proved the preceding audit is rolled back atomically. Deployed role/catalog parity, representative concurrency, staging and production remain unproven.",
    ],
    verificationStatus: "Verified",
  },
  ...MANDATORY_PUBLIC_RACING_DATABASE_OPERATIONS,
];

export const DATABASE_OPERATIONS: readonly DatabaseOperationContract[] =
  DATABASE_OPERATION_RECORDS.map((operation) => ({
    normalizedSql: null,
    normalizedSqlArtifact: null,
    storedProcedure: null,
    databaseFunction: null,
    tenantPredicate: null,
    ownershipPredicate: null,
    visibilityPredicate: null,
    maximumRowCount: null,
    transactionBoundary: null,
    isolationLevel: null,
    locks: [],
    timeoutMilliseconds: null,
    explainPlanEvidence: null,
    ...operation,
  }));

export type DatabaseOperationRegistryIssue = {
  code: "DUPLICATE_QUERY_ID" | "TRACE_MISSING";
  queryId: string;
  message: string;
};

export function validateDatabaseOperationLinks(
  operations: readonly DatabaseOperationContract[],
  traceIds: ReadonlySet<string>
) {
  const issues: DatabaseOperationRegistryIssue[] = [];
  const queryIds = new Set<string>();
  for (const operation of operations) {
    if (queryIds.has(operation.queryId)) {
      issues.push({
        code: "DUPLICATE_QUERY_ID",
        queryId: operation.queryId,
        message: `Duplicate database query ID: ${operation.queryId}`,
      });
    }
    queryIds.add(operation.queryId);
    if (!traceIds.has(operation.traceId)) {
      issues.push({
        code: "TRACE_MISSING",
        queryId: operation.queryId,
        message: `Trace does not exist: ${operation.traceId}`,
      });
    }
  }
  return issues;
}
