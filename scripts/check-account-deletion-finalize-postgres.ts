import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "@prisma/client";

import type { DbContextClient } from "../src/lib/db-context";
import type { DisposableReplayQueryEvent } from "../src/lib/db";

export const ACCOUNT_DELETION_FINALIZE_VERIFY_CONFIRMATION =
  "verify-account-deletion-finalize-on-disposable-loopback-55734";
export const ACCOUNT_DELETION_FINALIZE_EVIDENCE_PATH =
  "output/database-audit/account-deletion-finalize.json";
export const ACCOUNT_DELETION_FINALIZE_EVIDENCE_SCHEMA_VERSION = 1;

const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const EXPECTED_MAXIMUM_ROWS = 20_100;
const CONTENT_BATCH_LIMIT = 100;
const RUN_AT = new Date("2026-07-15T00:00:00.000Z");
const REQUESTED_AT = new Date("2026-06-01T00:00:00.000Z");
const MAIN_USER_ID = "account-finalize-main-user-proof";
const MAIN_PROFILE_ID = "account-finalize-main-profile-proof";
const COUNTER_USER_ID = "account-finalize-counter-user-proof";
const COUNTER_PROFILE_ID = "account-finalize-counter-profile-proof";
const ROLLBACK_USER_ID = "account-finalize-rollback-user-proof";
const ROLLBACK_PROFILE_ID = "account-finalize-rollback-profile-proof";
const BLOCKER_USER_ID = "account-finalize-blocker-user-proof";
const ACTOR_ID = "account-finalize-actor-proof";
const CATEGORY_ID = "account-finalize-category-proof";
const THREAD_ID = "account-finalize-thread-proof";
const POST_ID = "account-finalize-post-proof";
const LISTING_ID = "account-finalize-listing-proof";
const COUNTER_MESSAGE_ID = "account-finalize-counter-message-proof";
const ROLLBACK_MESSAGE_ID = "account-finalize-rollback-message-proof";
const MEDIA_ID = "account-finalize-media-proof";
const MEMORY_ID = "account-finalize-memory-proof";
const CONTEXT_ID = "account-finalize-context-proof";
const AGENT_RUN_ID = "account-finalize-agent-run-proof";
const MAIN_MESSAGE_IDS = Array.from(
  { length: 101 },
  (_, index) => `account-finalize-message-${String(index).padStart(3, "0")}-proof`,
);
const ALL_USER_IDS = [
  MAIN_USER_ID,
  COUNTER_USER_ID,
  ROLLBACK_USER_ID,
  BLOCKER_USER_ID,
] as const;
const ALL_PROFILE_IDS = [
  MAIN_PROFILE_ID,
  COUNTER_PROFILE_ID,
  ROLLBACK_PROFILE_ID,
] as const;
const ALL_MESSAGE_IDS = [
  ...MAIN_MESSAGE_IDS,
  COUNTER_MESSAGE_ID,
  ROLLBACK_MESSAGE_ID,
];
const SOURCE_FILES = [
  "prisma/schema.prisma",
  "prisma/migrations/20260708190000_add_rls_remaining_tables/migration.sql",
  "prisma/migrations/20260715053000_add_account_deletion_pending_index/migration.sql",
  "scripts/check-account-deletion-finalize-postgres.ts",
  "scripts/check-account-deletion-finalize-postgres.test.ts",
  "security/database-operations.ts",
  "src/lib/account-deletion.test.ts",
  "src/lib/account-service.ts",
  "src/lib/db-context.ts",
  "src/lib/db.ts",
] as const;

type RuntimeIdentity = {
  role: string;
  sessionRole: string;
  database: string;
  schema: string;
  canLogin: boolean;
  superuser: boolean;
  bypassRls: boolean;
};

type SourceBinding = {
  files: Record<string, string>;
  combinedSha256: string;
};

type TransactionRunner = <T>(
  fn: (tx: DbContextClient) => Promise<T>,
) => Promise<T>;

type ObservedStatement = {
  variant: string;
  normalizedSql: string;
  parameters: unknown[];
  evidence: {
    statementType: "SELECT-FOR-UPDATE" | "INSERT" | "UPDATE" | "DELETE" | "WITH-DML";
    normalizedSql: string;
    sha256: string;
    parameterCount: number;
    persistedParameterValues: false;
  };
};

export function assertAccountDeletionFinalizeVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, ACCOUNT_DELETION_FINALIZE_VERIFY_CONFIRMATION);
  const url = new URL(value);
  assert.ok(url.protocol === "postgresql:" || url.protocol === "postgres:");
  assert.ok(url.hostname === "127.0.0.1" || url.hostname === "::1");
  assert.equal(url.port, "55734");
  assert.equal(url.pathname, "/greyhoundiq");
  assert.equal(decodeURIComponent(url.username), "greyhoundiq_runtime");
  assert.equal(url.password, "");
  for (const parameter of [
    "database",
    "dbname",
    "host",
    "hostaddr",
    "port",
    "service",
    "socket",
  ]) {
    assert.equal(url.searchParams.has(parameter), false);
  }
  return url;
}

export function buildAccountDeletionFinalizeSourceBinding(
  root = process.cwd(),
): SourceBinding {
  const files = Object.fromEntries(
    SOURCE_FILES.map((path) => [
      path,
      sha256(readFileSync(resolve(root, path))),
    ]),
  );
  return {
    files,
    combinedSha256: sha256(
      SOURCE_FILES.map((path) => `${path}:${files[path]}`).join("\n"),
    ),
  };
}

export function validateAccountDeletionFinalizeEvidence(
  value: unknown,
  root = process.cwd(),
) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const evidence = value as Record<string, unknown>;
  assert.deepEqual(Object.keys(evidence).sort(), [
    "auditKind",
    "cleanup",
    "generatedAt",
    "proof",
    "runtimeIdentity",
    "safety",
    "schemaVersion",
    "sourceBinding",
    "verdict",
  ]);
  assert.equal(
    evidence.schemaVersion,
    ACCOUNT_DELETION_FINALIZE_EVIDENCE_SCHEMA_VERSION,
  );
  assert.equal(
    evidence.auditKind,
    "account-deletion-finalize-disposable-proof",
  );
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(
    evidence.sourceBinding,
    buildAccountDeletionFinalizeSourceBinding(root),
  );
  assert.deepEqual(evidence.runtimeIdentity, {
    role: "greyhoundiq_runtime",
    sessionRole: "greyhoundiq_runtime",
    database: "greyhoundiq",
    schema: "public",
    canLogin: true,
    superuser: false,
    bypassRls: false,
  });
  assert.deepEqual(evidence.safety, {
    scope: "literal-loopback-disposable-replay-only",
    host: "127.0.0.1",
    port: 55734,
    productionOrProviderSystemsContacted: false,
    storageBatchHandler: "injected-provider-free-completion",
    fixtureOwner: "account-deletion-finalize-dedicated-proof",
    broadCleanupUsed: false,
  });
  assert.deepEqual(evidence.cleanup, {
    auditRowsDeleted: 5,
    deletionJobRowsDeleted: 2,
    messageRowsDeleted: 103,
    postRowsDeleted: 1,
    listingRowsDeleted: 1,
    threadRowsDeleted: 1,
    categoryRowsDeleted: 1,
    socialActorRowsDeleted: 1,
    mediaRowsDeleted: 1,
    memoryRowsDeleted: 1,
    contextRowsDeleted: 0,
    agentRunRowsDeleted: 1,
    profileRowsDeleted: 3,
    userRowsDeleted: 4,
    remainingRows: 0,
  });

  const proof = evidence.proof as Record<string, unknown>;
  assert.equal(
    proof.queryId,
    "DB.ACCOUNT.DELETION.FINALIZE.TRANSACTION",
  );
  assert.equal(proof.sourceFile, "src/lib/account-service.ts");
  assert.equal(proof.sourceSymbol, "runAccountDeletionMaintenance");
  assert.equal(proof.contentBatchLimit, CONTENT_BATCH_LIMIT);
  assert.equal(proof.expectedMaximumRows, EXPECTED_MAXIMUM_ROWS);
  assert.equal(proof.status, "verified");
  assert.deepEqual(proof.partialPass, {
    finalizedCount: 0,
    messagesScrubbed: 100,
    postsScrubbed: 1,
    threadsScrubbed: 1,
    listingsArchived: 1,
    mediaTombstoned: 1,
    storageDeletionJobsQueued: 0,
    memoriesDeleted: 1,
    contextsDeleted: 1,
    agentRunsScrubbed: 1,
    unsanitizedMessagesRemaining: 1,
    batchAuditRows: 1,
    storageCalls: 0,
  });
  assert.deepEqual(proof.finalPass, {
    finalizedCount: 1,
    messagesScrubbed: 1,
    postsScrubbed: 0,
    threadsScrubbed: 0,
    listingsArchived: 0,
    mediaTombstoned: 0,
    storageDeletionJobsQueued: 2,
    storageDeletionJobsCompleted: 2,
    storageObjectsDeleted: 0,
    remoteProviderReferencesRetained: 3,
    memoriesDeleted: 0,
    contextsDeleted: 0,
    agentRunsScrubbed: 0,
    storageCalls: 2,
  });
  assert.deepEqual(proof.idempotentPass, {
    finalizedCount: 0,
    messagesScrubbed: 0,
    storageDeletionJobsQueued: 0,
    storageCalls: 2,
  });
  assert.deepEqual(proof.dataOutcome, {
    targetMessagesScrubbed: 101,
    counterpartyAuthoredMessagePreserved: true,
    profileAnonymized: true,
    listingArchived: true,
    mediaTombstoned: true,
    memoryTombstoned: true,
    contextDeleted: true,
    agentRunScrubbed: true,
    userAnonymized: true,
    remoteProviderReferencesRetained: true,
    storageJobsCompleted: 2,
    auditRows: 5,
  });
  assert.deepEqual(proof.rollback, {
    forcedUniqueEmailConflict: true,
    authoredMessageUnchanged: true,
    profileUnchanged: true,
    userStillPending: true,
    deletionJobsCreated: 0,
    finalizationAuditsCreated: 0,
  });
  assert.deepEqual(proof.cases, {
    candidateLock:
      "due-user-revalidated-under-for-update-before-each-batch-transaction",
    boundedProgress:
      "one-hundred-one-authored-messages-required-two-maintenance-passes",
    finalizationGate:
      "user-jobs-and-final-audit-written-only-after-all-batches-drained",
    senderOnlyMessageScrub:
      "recipient-copy-authored-by-counterparty-remained-unchanged",
    providerIsolation:
      "two-storage-jobs-completed-by-injected-zero-object-handler",
    rollback:
      "late-user-email-conflict-rolled-back-earlier-message-and-profile-writes",
    repeat: "third-pass-returned-zero-without-duplicate-jobs-or-audits",
  });
  const statements = proof.statements as Array<Record<string, unknown>>;
  assert.equal(statements.length, proof.statementCount);
  assert.ok(statements.length >= 15);
  assert.equal(
    new Set(statements.map((statement) => statement.variant)).size,
    statements.length,
  );
  for (const statement of statements) {
    const observedSql = statement.observedSql as Record<string, unknown>;
    assert.equal(observedSql.persistedParameterValues, false);
    assert.equal(observedSql.sha256, sha256(String(observedSql.normalizedSql)));
    const sql = String(observedSql.normalizedSql);
    if (/^WITH targets AS/i.test(sql)) {
      assert.match(sql, /LIMIT \$\d+ FOR UPDATE SKIP LOCKED/i);
    }
    const explain = statement.explain as Record<string, unknown>;
    assert.equal(explain.format, "postgresql-json-cost-plan");
    assert.equal(explain.analyze, false);
    assert.equal(explain.buffers, false);
    assert.equal(explain.sanitized, true);
    assert.equal(
      explain.statementTimeoutMilliseconds,
      EXPLAIN_STATEMENT_TIMEOUT_MS,
    );
  }
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, /account-finalize-(?:main|counter|rollback|blocker)/i);
  assert.doesNotMatch(serialized, /stripe-account-finalize|workos-account-finalize/i);
  return evidence;
}

export async function runAccountDeletionFinalizeVerifier() {
  const root = process.cwd();
  const runtimeUrl = assertAccountDeletionFinalizeVerifierTarget(
    requiredEnvironment("ACCOUNT_DELETION_FINALIZE_VERIFY_DATABASE_URL"),
    process.env.ACCOUNT_DELETION_FINALIZE_VERIFY_CONFIRM,
  );
  const applicationUrl = new URL(runtimeUrl);
  applicationUrl.searchParams.set("connection_limit", "6");
  process.env.DATABASE_URL = applicationUrl.toString();
  process.env.DIRECT_URL = applicationUrl.toString();
  process.env.DEMO_FIXTURE_QUERY_EVIDENCE_MODE = QUERY_EVIDENCE_MODE;
  const cleanupUrl = new URL(runtimeUrl);
  cleanupUrl.username = "postgres";

  const [
    { PrismaClient },
    { prisma, captureDisposableReplayQueries },
    { withDbSystemContext },
    { runAccountDeletionMaintenance },
  ] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/db"),
    import("../src/lib/db-context"),
    import("../src/lib/account-service"),
  ]);
  const cleanupPrisma = new PrismaClient({
    datasources: { db: { url: cleanupUrl.toString() } },
  });
  let cleanupRequired = false;
  try {
    const identities = await prisma.$queryRaw<RuntimeIdentity[]>`
      SELECT
        current_user AS "role",
        session_user AS "sessionRole",
        current_database() AS "database",
        current_schema() AS "schema",
        rol.rolcanlogin AS "canLogin",
        rol.rolsuper AS "superuser",
        rol.rolbypassrls AS "bypassRls"
      FROM pg_roles AS rol
      WHERE rol.rolname = current_user
    `;
    assert.deepEqual(identities, [
      {
        role: "greyhoundiq_runtime",
        sessionRole: "greyhoundiq_runtime",
        database: "greyhoundiq",
        schema: "public",
        canLogin: true,
        superuser: false,
        bypassRls: false,
      },
    ]);

    await setupMainFixture(cleanupPrisma);
    cleanupRequired = true;
    let storageCalls = 0;
    const providerFreeStorageBatch = async () => {
      storageCalls += 1;
      return { objectsDeleted: 0, completed: true };
    };

    const partialCapture = await captureDisposableReplayQueries(() =>
      runAccountDeletionMaintenance(RUN_AT, providerFreeStorageBatch),
    );
    const partial = partialCapture.result;
    assert.equal(partial.finalizedCount, 0);
    assert.equal(partial.messagesScrubbed, 100);
    assert.equal(partial.postsScrubbed, 1);
    assert.equal(partial.threadsScrubbed, 1);
    assert.equal(partial.listingsArchived, 1);
    assert.equal(partial.mediaTombstoned, 1);
    assert.equal(partial.memoriesDeleted, 1);
    assert.equal(partial.contextsDeleted, 1);
    assert.equal(partial.agentRunsScrubbed, 1);
    assert.equal(partial.storageDeletionJobsQueued, 0);
    assert.equal(storageCalls, 0);
    const unsanitizedMessagesRemaining = await cleanupPrisma.message.count({
      where: {
        id: { in: MAIN_MESSAGE_IDS },
        NOT: { body: "This message was removed after account deletion." },
      },
    });
    assert.equal(unsanitizedMessagesRemaining, 1);
    const batchAuditRows = await cleanupPrisma.auditLog.count({
      where: {
        action: "user.delete.batch",
        targetId: MAIN_USER_ID,
      },
    });
    assert.equal(batchAuditRows, 1);
    const partialUser = await cleanupPrisma.user.findUniqueOrThrow({
      where: { id: MAIN_USER_ID },
      select: { deletionRequestedAt: true },
    });
    assert.equal(partialUser.deletionRequestedAt?.toISOString(), REQUESTED_AT.toISOString());

    const finalCapture = await captureDisposableReplayQueries(() =>
      runAccountDeletionMaintenance(RUN_AT, providerFreeStorageBatch),
    );
    const finalPass = finalCapture.result;
    assert.equal(finalPass.finalizedCount, 1);
    assert.equal(finalPass.messagesScrubbed, 1);
    assert.equal(finalPass.storageDeletionJobsQueued, 2);
    assert.equal(finalPass.storageDeletionJobsCompleted, 2);
    assert.equal(finalPass.storageObjectsDeleted, 0);
    assert.equal(finalPass.remoteProviderReferencesRetained, 3);
    assert.equal(storageCalls, 2);

    const idempotentPass = await runAccountDeletionMaintenance(
      RUN_AT,
      providerFreeStorageBatch,
    );
    assert.equal(idempotentPass.finalizedCount, 0);
    assert.equal(idempotentPass.messagesScrubbed, 0);
    assert.equal(idempotentPass.storageDeletionJobsQueued, 0);
    assert.equal(storageCalls, 2);

    const dataOutcome = await inspectMainOutcome(cleanupPrisma);
    assert.deepEqual(dataOutcome, {
      targetMessagesScrubbed: 101,
      counterpartyAuthoredMessagePreserved: true,
      profileAnonymized: true,
      listingArchived: true,
      mediaTombstoned: true,
      memoryTombstoned: true,
      contextDeleted: true,
      agentRunScrubbed: true,
      userAnonymized: true,
      remoteProviderReferencesRetained: true,
      storageJobsCompleted: 2,
      auditRows: 5,
    });

    await setupRollbackFixture(cleanupPrisma);
    await assert.rejects(
      () =>
        runAccountDeletionMaintenance(RUN_AT, providerFreeStorageBatch),
      /Unique constraint failed|duplicate key value/i,
    );
    const rollback = await inspectRollbackOutcome(cleanupPrisma);
    assert.deepEqual(rollback, {
      forcedUniqueEmailConflict: true,
      authoredMessageUnchanged: true,
      profileUnchanged: true,
      userStillPending: true,
      deletionJobsCreated: 0,
      finalizationAuditsCreated: 0,
    });

    const statements = collectObservedStatements([
      ...partialCapture.queries,
      ...finalCapture.queries,
    ]);
    assert.ok(statements.length >= 15);
    assert.ok(
      statements.some(
        (statement) =>
          statement.evidence.statementType === "SELECT-FOR-UPDATE" &&
          statement.normalizedSql.includes('FROM "User" AS u'),
      ),
    );
    const boundedTables = [
      "Message",
      "Post",
      "Thread",
      "Listing",
      "MediaAsset",
      "MemoryEntry",
      "ConversationContext",
      "AgentRun",
    ];
    for (const table of boundedTables) {
      assert.ok(
        statements.some(
          (statement) =>
            statement.normalizedSql.includes(`\"${table}\"`) &&
            /LIMIT \$\d+ FOR UPDATE SKIP LOCKED/i.test(
              statement.normalizedSql,
            ) &&
            statement.parameters.includes(CONTENT_BATCH_LIMIT),
        ),
        `${table} must carry the database batch limit`,
      );
    }
    const statementEvidence = [];
    for (const statement of statements) {
      statementEvidence.push({
        variant: statement.variant,
        observedSql: statement.evidence,
        explain: await explainObservedStatement(withDbSystemContext, statement),
      });
    }

    const removed = await cleanupFixtures(cleanupPrisma, true);
    cleanupRequired = false;
    const remainingRows = await countFixtureRows(cleanupPrisma);
    assert.equal(remainingRows, 0);

    const report = {
      schemaVersion: ACCOUNT_DELETION_FINALIZE_EVIDENCE_SCHEMA_VERSION,
      auditKind: "account-deletion-finalize-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: runtimeUrl.hostname,
        port: Number(runtimeUrl.port),
        productionOrProviderSystemsContacted: false,
        storageBatchHandler: "injected-provider-free-completion",
        fixtureOwner: "account-deletion-finalize-dedicated-proof",
        broadCleanupUsed: false,
      },
      runtimeIdentity: identities[0],
      sourceBinding: buildAccountDeletionFinalizeSourceBinding(root),
      proof: {
        queryId: "DB.ACCOUNT.DELETION.FINALIZE.TRANSACTION",
        sourceFile: "src/lib/account-service.ts",
        sourceSymbol: "runAccountDeletionMaintenance",
        contentBatchLimit: CONTENT_BATCH_LIMIT,
        expectedMaximumRows: EXPECTED_MAXIMUM_ROWS,
        partialPass: {
          finalizedCount: partial.finalizedCount,
          messagesScrubbed: partial.messagesScrubbed,
          postsScrubbed: partial.postsScrubbed,
          threadsScrubbed: partial.threadsScrubbed,
          listingsArchived: partial.listingsArchived,
          mediaTombstoned: partial.mediaTombstoned,
          storageDeletionJobsQueued: partial.storageDeletionJobsQueued,
          memoriesDeleted: partial.memoriesDeleted,
          contextsDeleted: partial.contextsDeleted,
          agentRunsScrubbed: partial.agentRunsScrubbed,
          unsanitizedMessagesRemaining,
          batchAuditRows,
          storageCalls: 0,
        },
        finalPass: {
          finalizedCount: finalPass.finalizedCount,
          messagesScrubbed: finalPass.messagesScrubbed,
          postsScrubbed: finalPass.postsScrubbed,
          threadsScrubbed: finalPass.threadsScrubbed,
          listingsArchived: finalPass.listingsArchived,
          mediaTombstoned: finalPass.mediaTombstoned,
          storageDeletionJobsQueued: finalPass.storageDeletionJobsQueued,
          storageDeletionJobsCompleted: finalPass.storageDeletionJobsCompleted,
          storageObjectsDeleted: finalPass.storageObjectsDeleted,
          remoteProviderReferencesRetained:
            finalPass.remoteProviderReferencesRetained,
          memoriesDeleted: finalPass.memoriesDeleted,
          contextsDeleted: finalPass.contextsDeleted,
          agentRunsScrubbed: finalPass.agentRunsScrubbed,
          storageCalls,
        },
        idempotentPass: {
          finalizedCount: idempotentPass.finalizedCount,
          messagesScrubbed: idempotentPass.messagesScrubbed,
          storageDeletionJobsQueued:
            idempotentPass.storageDeletionJobsQueued,
          storageCalls,
        },
        dataOutcome,
        rollback,
        cases: {
          candidateLock:
            "due-user-revalidated-under-for-update-before-each-batch-transaction",
          boundedProgress:
            "one-hundred-one-authored-messages-required-two-maintenance-passes",
          finalizationGate:
            "user-jobs-and-final-audit-written-only-after-all-batches-drained",
          senderOnlyMessageScrub:
            "recipient-copy-authored-by-counterparty-remained-unchanged",
          providerIsolation:
            "two-storage-jobs-completed-by-injected-zero-object-handler",
          rollback:
            "late-user-email-conflict-rolled-back-earlier-message-and-profile-writes",
          repeat:
            "third-pass-returned-zero-without-duplicate-jobs-or-audits",
        },
        statementCount: statementEvidence.length,
        statements: statementEvidence,
        status: "verified",
      },
      cleanup: { ...removed, remainingRows },
      verdict: "verified",
    } as const;
    validateAccountDeletionFinalizeEvidence(report, root);
    const outputPath = resolve(root, ACCOUNT_DELETION_FINALIZE_EVIDENCE_PATH);
    const temporaryPath = `${outputPath}.tmp`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    return { report, outputPath };
  } finally {
    if (cleanupRequired) await cleanupFixtures(cleanupPrisma, false);
    await Promise.all([prisma.$disconnect(), cleanupPrisma.$disconnect()]);
  }
}

async function setupMainFixture(prisma: PrismaClient) {
  await cleanupFixtures(prisma, false);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.system', 'true', true)`;
    await tx.user.createMany({
      data: [
        {
          id: MAIN_USER_ID,
          email: "account-finalize-main@greyhoundiq.test",
          name: "Finalize Main",
          subscriptionTier: "pro",
          isBanned: true,
          deletionRequestedAt: REQUESTED_AT,
          workosUserId: "workos-account-finalize-main-proof",
          stripeCustomerId: "stripe-account-finalize-customer-proof",
          stripeSubscriptionId: "stripe-account-finalize-subscription-proof",
        },
        {
          id: COUNTER_USER_ID,
          email: "account-finalize-counter@greyhoundiq.test",
          name: "Finalize Counter",
        },
      ],
    });
    await tx.profile.createMany({
      data: [
        {
          id: MAIN_PROFILE_ID,
          userId: MAIN_USER_ID,
          displayName: "Finalize Main",
          bio: "private main bio",
          phone: "0400000000",
          role: "trainer",
          verified: true,
        },
        {
          id: COUNTER_PROFILE_ID,
          userId: COUNTER_USER_ID,
          displayName: "Finalize Counter",
        },
      ],
    });
    await tx.socialActor.create({
      data: {
        id: ACTOR_ID,
        kind: "personal",
        profileId: MAIN_PROFILE_ID,
        ownerProfileId: MAIN_PROFILE_ID,
        handle: "account-finalize-main-proof",
        displayName: "Finalize Main",
        published: true,
      },
    });
    await tx.forumCategory.create({
      data: { id: CATEGORY_ID, name: "Finalize proof", slug: "account-finalize-proof" },
    });
    await tx.thread.create({
      data: {
        id: THREAD_ID,
        categoryId: CATEGORY_ID,
        authorId: MAIN_PROFILE_ID,
        title: "Private finalize thread",
      },
    });
    await tx.post.create({
      data: {
        id: POST_ID,
        threadId: THREAD_ID,
        authorId: MAIN_PROFILE_ID,
        body: "Private finalize post",
      },
    });
    await tx.listing.create({
      data: {
        id: LISTING_ID,
        profileId: MAIN_PROFILE_ID,
        type: "dog_for_sale",
        title: "Private finalize listing",
        description: "Private finalize listing description",
        price: 1_000,
        state: "NSW",
        imageUrl: "https://example.invalid/account-finalize.jpg",
        status: "active",
      },
    });
    await tx.message.createMany({
      data: [
        ...MAIN_MESSAGE_IDS.map((id, index) => ({
          id,
          senderId: MAIN_PROFILE_ID,
          recipientId: COUNTER_PROFILE_ID,
          body: `Private authored message ${index}`,
          mediaIdsJson: '["private-media"]',
        })),
        {
          id: COUNTER_MESSAGE_ID,
          senderId: COUNTER_PROFILE_ID,
          recipientId: MAIN_PROFILE_ID,
          body: "Counterparty authored message must remain",
        },
      ],
    });
    await tx.mediaAsset.create({
      data: {
        id: MEDIA_ID,
        uploaderId: MAIN_USER_ID,
        storageBucket: "private-user-media",
        storagePath: `users/${MAIN_USER_ID}/private-proof.jpg`,
        originalName: "private-proof.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        sha256: "a".repeat(64),
      },
    });
    await tx.memoryEntry.create({
      data: {
        id: MEMORY_ID,
        userId: MAIN_USER_ID,
        kind: "preference",
        content: "Private account memory",
        source: "explicit_user_input",
        sourceRef: "private-reference",
      },
    });
    await tx.conversationContext.create({
      data: {
        id: CONTEXT_ID,
        userId: MAIN_USER_ID,
        agentType: "race_analyst",
        pendingAction: "private-action",
      },
    });
    await tx.agentRun.create({
      data: {
        id: AGENT_RUN_ID,
        agentType: "race_analyst",
        userId: MAIN_USER_ID,
        inputJson: '{"private":true}',
        outputJson: '{"private":"result"}',
        toolInvocations: '["private-tool"]',
        createdMemoryIds: `["${MEMORY_ID}"]`,
        error: "private-error",
      },
    });
  });
}

async function setupRollbackFixture(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.system', 'true', true)`;
    await tx.user.createMany({
      data: [
        {
          id: ROLLBACK_USER_ID,
          email: "account-finalize-rollback@greyhoundiq.test",
          name: "Rollback User",
          isBanned: true,
          deletionRequestedAt: REQUESTED_AT,
        },
        {
          id: BLOCKER_USER_ID,
          email: `deleted-${ROLLBACK_USER_ID}@deleted.greyhoundiq.local`,
          name: "Deleted email blocker",
        },
      ],
    });
    await tx.profile.create({
      data: {
        id: ROLLBACK_PROFILE_ID,
        userId: ROLLBACK_USER_ID,
        displayName: "Rollback Profile",
        bio: "rollback private bio",
      },
    });
    await tx.message.create({
      data: {
        id: ROLLBACK_MESSAGE_ID,
        senderId: ROLLBACK_PROFILE_ID,
        recipientId: COUNTER_PROFILE_ID,
        body: "Rollback authored message",
        mediaIdsJson: '["rollback-media"]',
      },
    });
  });
}

async function inspectMainOutcome(prisma: PrismaClient) {
  const [
    targetMessagesScrubbed,
    counterMessage,
    profile,
    listing,
    media,
    memory,
    contextCount,
    agentRun,
    user,
    storageJobsCompleted,
    auditRows,
  ] = await Promise.all([
    prisma.message.count({
      where: {
        id: { in: MAIN_MESSAGE_IDS },
        body: "This message was removed after account deletion.",
        mediaIdsJson: null,
        deletedBySenderAt: { not: null },
      },
    }),
    prisma.message.findUniqueOrThrow({ where: { id: COUNTER_MESSAGE_ID } }),
    prisma.profile.findUniqueOrThrow({ where: { id: MAIN_PROFILE_ID } }),
    prisma.listing.findUniqueOrThrow({ where: { id: LISTING_ID } }),
    prisma.mediaAsset.findUniqueOrThrow({ where: { id: MEDIA_ID } }),
    prisma.memoryEntry.findUniqueOrThrow({ where: { id: MEMORY_ID } }),
    prisma.conversationContext.count({ where: { id: CONTEXT_ID } }),
    prisma.agentRun.findUniqueOrThrow({ where: { id: AGENT_RUN_ID } }),
    prisma.user.findUniqueOrThrow({ where: { id: MAIN_USER_ID } }),
    prisma.deletionJob.count({
      where: { targetUserId: MAIN_USER_ID, status: "completed" },
    }),
    prisma.auditLog.count({
      where: {
        OR: [
          { targetId: MAIN_USER_ID },
          { action: "user.delete.storage", targetType: "deletionJob" },
          {
            action: "user.delete.maintenance",
            metadata: { contains: RUN_AT.toISOString() },
          },
        ],
      },
    }),
  ]);
  return {
    targetMessagesScrubbed,
    counterpartyAuthoredMessagePreserved:
      counterMessage.body === "Counterparty authored message must remain" &&
      counterMessage.deletedBySenderAt === null,
    profileAnonymized:
      profile.displayName === "Deleted user" &&
      profile.bio === null &&
      profile.phone === null &&
      profile.role === "member" &&
      profile.verified === false,
    listingArchived:
      listing.status === "archived" &&
      listing.price === null &&
      listing.state === null &&
      listing.imageUrl === null,
    mediaTombstoned:
      media.originalName === null && media.sha256 === null && media.deletedAt !== null,
    memoryTombstoned:
      memory.content === "Account memory removed after account deletion." &&
      memory.sourceRef === null &&
      memory.deletedAt !== null,
    contextDeleted: contextCount === 0,
    agentRunScrubbed:
      agentRun.userId === null &&
      agentRun.inputJson === "{}" &&
      agentRun.outputJson === null &&
      agentRun.toolInvocations === null &&
      agentRun.createdMemoryIds === null &&
      agentRun.error === null,
    userAnonymized:
      user.email === `deleted-${MAIN_USER_ID}@deleted.greyhoundiq.local` &&
      user.name === null &&
      user.subscriptionTier === "free" &&
      user.deletionRequestedAt === null &&
      user.isBanned,
    remoteProviderReferencesRetained:
      user.workosUserId !== null &&
      user.stripeCustomerId !== null &&
      user.stripeSubscriptionId !== null,
    storageJobsCompleted,
    auditRows,
  };
}

async function inspectRollbackOutcome(prisma: PrismaClient) {
  const [message, profile, user, deletionJobsCreated, finalizationAuditsCreated] =
    await Promise.all([
      prisma.message.findUniqueOrThrow({ where: { id: ROLLBACK_MESSAGE_ID } }),
      prisma.profile.findUniqueOrThrow({ where: { id: ROLLBACK_PROFILE_ID } }),
      prisma.user.findUniqueOrThrow({ where: { id: ROLLBACK_USER_ID } }),
      prisma.deletionJob.count({ where: { targetUserId: ROLLBACK_USER_ID } }),
      prisma.auditLog.count({
        where: {
          targetId: ROLLBACK_USER_ID,
          action: { in: ["user.delete.batch", "user.delete.finalize"] },
        },
      }),
    ]);
  return {
    forcedUniqueEmailConflict: true,
    authoredMessageUnchanged:
      message.body === "Rollback authored message" &&
      message.mediaIdsJson === '["rollback-media"]' &&
      message.deletedBySenderAt === null,
    profileUnchanged:
      profile.displayName === "Rollback Profile" &&
      profile.bio === "rollback private bio",
    userStillPending:
      user.email === "account-finalize-rollback@greyhoundiq.test" &&
      user.deletionRequestedAt?.toISOString() === REQUESTED_AT.toISOString(),
    deletionJobsCreated,
    finalizationAuditsCreated,
  };
}

async function cleanupFixtures(prisma: PrismaClient, requireExact: boolean) {
  const removed = await prisma.$transaction(async (tx) => {
    const proofJobs = await tx.deletionJob.findMany({
      where: { targetUserId: { in: [...ALL_USER_IDS] } },
      select: { id: true },
    });
    const audit = await tx.auditLog.deleteMany({
      where: {
        OR: [
          { targetId: { in: [...ALL_USER_IDS, ...proofJobs.map((job) => job.id)] } },
          {
            action: "user.delete.maintenance",
            metadata: { contains: RUN_AT.toISOString() },
          },
        ],
      },
    });
    const jobs = await tx.deletionJob.deleteMany({
      where: { targetUserId: { in: [...ALL_USER_IDS] } },
    });
    const messages = await tx.message.deleteMany({
      where: { id: { in: ALL_MESSAGE_IDS } },
    });
    const posts = await tx.post.deleteMany({ where: { id: POST_ID } });
    const listings = await tx.listing.deleteMany({ where: { id: LISTING_ID } });
    const threads = await tx.thread.deleteMany({ where: { id: THREAD_ID } });
    const categories = await tx.forumCategory.deleteMany({ where: { id: CATEGORY_ID } });
    const actors = await tx.socialActor.deleteMany({ where: { id: ACTOR_ID } });
    const media = await tx.mediaAsset.deleteMany({ where: { id: MEDIA_ID } });
    const memories = await tx.memoryEntry.deleteMany({ where: { id: MEMORY_ID } });
    const contexts = await tx.conversationContext.deleteMany({ where: { id: CONTEXT_ID } });
    const agentRuns = await tx.agentRun.deleteMany({ where: { id: AGENT_RUN_ID } });
    const profiles = await tx.profile.deleteMany({
      where: { id: { in: [...ALL_PROFILE_IDS] } },
    });
    const users = await tx.user.deleteMany({
      where: { id: { in: [...ALL_USER_IDS] } },
    });
    return {
      auditRowsDeleted: audit.count,
      deletionJobRowsDeleted: jobs.count,
      messageRowsDeleted: messages.count,
      postRowsDeleted: posts.count,
      listingRowsDeleted: listings.count,
      threadRowsDeleted: threads.count,
      categoryRowsDeleted: categories.count,
      socialActorRowsDeleted: actors.count,
      mediaRowsDeleted: media.count,
      memoryRowsDeleted: memories.count,
      contextRowsDeleted: contexts.count,
      agentRunRowsDeleted: agentRuns.count,
      profileRowsDeleted: profiles.count,
      userRowsDeleted: users.count,
    };
  });
  if (requireExact) {
    assert.deepEqual(removed, {
      auditRowsDeleted: 5,
      deletionJobRowsDeleted: 2,
      messageRowsDeleted: 103,
      postRowsDeleted: 1,
      listingRowsDeleted: 1,
      threadRowsDeleted: 1,
      categoryRowsDeleted: 1,
      socialActorRowsDeleted: 1,
      mediaRowsDeleted: 1,
      memoryRowsDeleted: 1,
      contextRowsDeleted: 0,
      agentRunRowsDeleted: 1,
      profileRowsDeleted: 3,
      userRowsDeleted: 4,
    });
  }
  return removed;
}

async function countFixtureRows(prisma: PrismaClient) {
  const counts = await Promise.all([
    prisma.auditLog.count({
      where: {
        OR: [
          { targetId: { in: [...ALL_USER_IDS] } },
          {
            action: "user.delete.maintenance",
            metadata: { contains: RUN_AT.toISOString() },
          },
        ],
      },
    }),
    prisma.deletionJob.count({ where: { targetUserId: { in: [...ALL_USER_IDS] } } }),
    prisma.message.count({ where: { id: { in: ALL_MESSAGE_IDS } } }),
    prisma.post.count({ where: { id: POST_ID } }),
    prisma.listing.count({ where: { id: LISTING_ID } }),
    prisma.thread.count({ where: { id: THREAD_ID } }),
    prisma.forumCategory.count({ where: { id: CATEGORY_ID } }),
    prisma.socialActor.count({ where: { id: ACTOR_ID } }),
    prisma.mediaAsset.count({ where: { id: MEDIA_ID } }),
    prisma.memoryEntry.count({ where: { id: MEMORY_ID } }),
    prisma.conversationContext.count({ where: { id: CONTEXT_ID } }),
    prisma.agentRun.count({ where: { id: AGENT_RUN_ID } }),
    prisma.profile.count({ where: { id: { in: [...ALL_PROFILE_IDS] } } }),
    prisma.user.count({ where: { id: { in: [...ALL_USER_IDS] } } }),
  ]);
  return counts.reduce((total, count) => total + count, 0);
}

function collectObservedStatements(queries: DisposableReplayQueryEvent[]) {
  const unique = new Map<string, DisposableReplayQueryEvent>();
  for (const event of queries) {
    const normalizedSql = normalizeSql(event.query);
    const statementType = statementTypeFor(normalizedSql);
    if (!statementType) continue;
    assert.doesNotMatch(normalizedSql, /;|--|\/\*/);
    unique.set(normalizedSql, event);
  }
  return [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([normalizedSql, event], index): ObservedStatement => {
      const parameters = parsePrismaParameters(event.params, normalizedSql);
      const statementType = statementTypeFor(normalizedSql);
      assert.ok(statementType);
      return {
        variant: `finalize-${String(index + 1).padStart(2, "0")}`,
        normalizedSql,
        parameters,
        evidence: {
          statementType,
          normalizedSql,
          sha256: sha256(normalizedSql),
          parameterCount: parameters.length,
          persistedParameterValues: false,
        },
      };
    });
}

function statementTypeFor(sql: string): ObservedStatement["evidence"]["statementType"] | null {
  if (/^SELECT[\s\S]*\bFOR UPDATE$/i.test(sql) && sql.includes('FROM "User" AS u')) {
    return "SELECT-FOR-UPDATE";
  }
  if (/^WITH targets AS/i.test(sql)) return "WITH-DML";
  if (/^INSERT\b/i.test(sql)) return "INSERT";
  if (/^UPDATE\b/i.test(sql)) return "UPDATE";
  if (/^DELETE\b/i.test(sql)) return "DELETE";
  return null;
}

function parsePrismaParameters(value: string, normalizedSql: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    assert.ok(
      /^INSERT\b/i.test(normalizedSql) && normalizedSql.includes('"AuditLog"'),
    );
    const fullAuditMatch = /^\[(null|"[^"]*"),"([^"]*)","([^"]*)","([^"]*)",(null|"[^"]*"),(null|"[^"]*"),(null|"[^"]*"),"(\{.*\})","([^"]*)"\]$/.exec(
      value,
    );
    const storageAuditMatch = /^\["([^"]*)","([^"]*)","([^"]*)","([^"]*)","(\{.*\})","([^"]*)"\]$/.exec(
      value,
    );
    if (fullAuditMatch) {
      JSON.parse(fullAuditMatch[8]);
      parsed = [
        JSON.parse(fullAuditMatch[1]),
        fullAuditMatch[2],
        fullAuditMatch[3],
        fullAuditMatch[4],
        JSON.parse(fullAuditMatch[5]),
        JSON.parse(fullAuditMatch[6]),
        JSON.parse(fullAuditMatch[7]),
        fullAuditMatch[8],
        fullAuditMatch[9],
      ];
    } else {
      assert.ok(
        storageAuditMatch,
        "Observed AuditLog parameters must match a fixed insert shape",
      );
      JSON.parse(storageAuditMatch[5]);
      parsed = storageAuditMatch.slice(1);
    }
  }
  assert.ok(Array.isArray(parsed));
  return parsed.map(decodePrismaParameter);
}

function decodePrismaParameter(value: unknown): unknown {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)? UTC$/.test(value)
  ) {
    return new Date(value);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record.prisma__type === "date") {
    assert.equal(typeof record.prisma__value, "string");
    return new Date(record.prisma__value as string);
  }
  return value;
}

function normalizeSql(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function explainObservedStatement(
  runner: TransactionRunner,
  observed: ObservedStatement,
) {
  const rows = await runner(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL statement_timeout = ${EXPLAIN_STATEMENT_TIMEOUT_MS}`,
    );
    return tx.$queryRawUnsafe<unknown[]>(
      `EXPLAIN (FORMAT JSON, ANALYZE FALSE, VERBOSE FALSE, COSTS TRUE, BUFFERS FALSE) ${observed.normalizedSql}`,
      ...observed.parameters,
    );
  });
  const plan = sanitizeExplainResult(rows);
  return {
    format: "postgresql-json-cost-plan",
    analyze: false,
    buffers: false,
    statementTimeoutMilliseconds: EXPLAIN_STATEMENT_TIMEOUT_MS,
    sanitized: true,
    plan,
    planSha256: sha256(JSON.stringify(plan)),
  } as const;
}

function sanitizeExplainResult(value: unknown) {
  assert.ok(Array.isArray(value) && value.length === 1);
  const row = plainObject(value[0], "EXPLAIN row");
  const rawQueryPlan = row["QUERY PLAN"];
  const queryPlan =
    typeof rawQueryPlan === "string"
      ? (JSON.parse(rawQueryPlan) as unknown)
      : rawQueryPlan;
  assert.ok(Array.isArray(queryPlan) && queryPlan.length === 1);
  return sanitizeExplainNode(
    plainObject(queryPlan[0], "EXPLAIN plan container").Plan,
  );
}

function sanitizeExplainNode(value: unknown): {
  nodeType: string;
  relationName: string | null;
  indexName: string | null;
  joinType: string | null;
  scanDirection: string | null;
  estimatedRows: number;
  totalCost: number;
  children: ReturnType<typeof sanitizeExplainNode>[];
} {
  const node = plainObject(value, "EXPLAIN plan node");
  const children = node.Plans ?? [];
  assert.ok(Array.isArray(children));
  return {
    nodeType: requiredPlanString(node["Node Type"], "Node Type"),
    relationName: optionalPlanString(node["Relation Name"], "Relation Name"),
    indexName: optionalPlanString(node["Index Name"], "Index Name"),
    joinType: optionalPlanString(node["Join Type"], "Join Type"),
    scanDirection: optionalPlanString(node["Scan Direction"], "Scan Direction"),
    estimatedRows: requiredPlanNumber(node["Plan Rows"], "Plan Rows"),
    totalCost: requiredPlanNumber(node["Total Cost"], "Total Cost"),
    children: children.map(sanitizeExplainNode),
  };
}

function plainObject(value: unknown, label: string) {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  return value as Record<string, unknown>;
}

function requiredPlanString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`EXPLAIN ${label} must be a non-empty string`);
  }
  return value;
}

function optionalPlanString(value: unknown, label: string): string | null {
  if (value === undefined) return null;
  return requiredPlanString(value, label);
}

function requiredPlanNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`EXPLAIN ${label} must be a non-negative finite number`);
  }
  return value;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const { report, outputPath } = await runAccountDeletionFinalizeVerifier();
  console.log(
    JSON.stringify({
      verdict: report.verdict,
      queryId: report.proof.queryId,
      statements: report.proof.statementCount,
      evidence: outputPath,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
