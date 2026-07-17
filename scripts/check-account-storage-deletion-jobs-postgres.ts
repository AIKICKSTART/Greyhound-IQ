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

import type { DbContextClient, DbContextUser } from "../src/lib/db-context";
import type { DisposableReplayQueryEvent } from "../src/lib/db";

export const ACCOUNT_STORAGE_DELETION_VERIFY_CONFIRMATION =
  "verify-account-storage-deletion-jobs-on-disposable-loopback-55734";
export const ACCOUNT_STORAGE_DELETION_EVIDENCE_PATH =
  "output/database-audit/account-storage-deletion-jobs.json";
export const ACCOUNT_STORAGE_DELETION_EVIDENCE_SCHEMA_VERSION = 1;

const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const NOW = new Date("2026-07-01T00:00:00.000Z");
const FIXTURE_USER_ID = "account-storage-deletion-user-proof";
const FIXTURE_EMAIL = "account-storage-deletion@greyhoundiq.test";
const FIXTURE_PROFILE_ID = "account-storage-deletion-profile-proof";
const SECRET_PROVIDER_DETAIL = "provider-secret-detail-must-not-persist";
const JOBS = {
  complete: "account-storage-deletion-complete-proof",
  partial: "account-storage-deletion-partial-proof",
  failed: "account-storage-deletion-failed-proof",
  freshLease: "account-storage-deletion-fresh-lease-proof",
  future: "account-storage-deletion-future-proof",
  otherTarget: "account-storage-deletion-other-target-proof",
  contention: "account-storage-deletion-contention-proof",
} as const;
const JOB_IDS = Object.values(JOBS);
const USER_CONTEXT: DbContextUser = {
  dbUserId: FIXTURE_USER_ID,
  profileId: FIXTURE_PROFILE_ID,
  profileRole: "member",
  tier: "free",
};
const SOURCE_FILES = [
  "prisma/schema.prisma",
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "prisma/migrations/20260708190000_add_rls_remaining_tables/migration.sql",
  "prisma/migrations/20260708192000_restrict_audit_ratelimit_rls/migration.sql",
  "scripts/check-account-storage-deletion-jobs-postgres.ts",
  "scripts/check-account-storage-deletion-jobs-postgres.test.ts",
  "security/database-operations.ts",
  "src/lib/account-service.ts",
  "src/lib/db-context.ts",
  "src/lib/db.ts",
  "src/lib/storage-paths.ts",
  "src/lib/supabase-storage.ts",
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

type StatementVariant =
  | "due-job-select"
  | "claim-job-update"
  | "outcome-job-update"
  | "audit-result-insert";

type ObservedStatement = {
  variant: StatementVariant;
  normalizedSql: string;
  parameters: unknown[];
  evidence: {
    statementType: "SELECT" | "UPDATE" | "INSERT";
    normalizedSql: string;
    sha256: string;
    parameterCount: number;
    persistedParameterValues: false;
  };
};

export function assertAccountStorageDeletionVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, ACCOUNT_STORAGE_DELETION_VERIFY_CONFIRMATION);
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

export function buildAccountStorageDeletionSourceBinding(
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

export function validateAccountStorageDeletionEvidence(
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
    ACCOUNT_STORAGE_DELETION_EVIDENCE_SCHEMA_VERSION,
  );
  assert.equal(
    evidence.auditKind,
    "account-storage-deletion-jobs-disposable-proof",
  );
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(
    evidence.sourceBinding,
    buildAccountStorageDeletionSourceBinding(root),
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
    fixtureOwner: "account-storage-deletion-jobs-dedicated-proof",
    broadCleanupUsed: false,
  });
  assert.deepEqual(evidence.cleanup, {
    auditLogRowsDeleted: 4,
    deletionJobRowsDeleted: 7,
    userRowsDeleted: 1,
    remainingAuditLogRows: 0,
    remainingDeletionJobRows: 0,
    remainingUserRows: 0,
  });

  const proof = evidence.proof as Record<string, unknown>;
  assert.equal(proof.queryId, "DB.ACCOUNT.DELETION.STORAGE_JOBS.PROCESS");
  assert.equal(proof.sourceFile, "src/lib/account-service.ts");
  assert.equal(proof.sourceSymbol, "runAccountStorageDeletionJobs");
  assert.equal(proof.expectedMaximumJobs, 10);
  assert.equal(proof.transactionIsolation, "read committed");
  assert.equal(proof.status, "verified");
  assert.deepEqual(proof.workerResult, {
    jobsCompleted: 1,
    jobsFailed: 1,
    objectsDeleted: 503,
  });
  assert.deepEqual(proof.rowCounts, {
    before: { users: 1, jobs: 6, audits: 0 },
    afterOutcomes: { users: 1, jobs: 6, audits: 3 },
    afterContention: { users: 1, jobs: 7, audits: 4 },
    afterNoOp: { users: 1, jobs: 7, audits: 4 },
  });
  assert.deepEqual(proof.cases, {
    completedBatch: "completed-with-three-objects-and-audit",
    partialBatch: "returned-to-pending-with-five-hundred-objects-and-audit",
    providerFailure: "failed-with-safe-error-code-and-no-provider-detail",
    expiredLease: "processing-job-older-than-fifteen-minutes-reclaimed",
    freshLease: "fresh-processing-job-not-selected",
    futureJob: "future-pending-job-not-selected",
    otherTarget: "non-storage-job-not-selected",
    contention: "two-workers-one-claim-one-handler-one-audit",
    noDueJobs: "successful-zero-result-no-op",
    anonymousRead: "exact-due-selector-returned-zero",
    ownerRead: "exact-due-selector-returned-one-owned-pending-job",
    ownerWrite: "exact-claim-update-affected-zero",
    anonymousAudit: "system-audit-insert-denied",
    outcomeAtomicity: "three-status-and-audit-pairs-committed-in-one-transaction-each",
    productionDefault: "real-deleteAccountStoragePrefixBatch-retained",
  });
  assert.deepEqual(proof.outcomes, [
    {
      case: "complete",
      status: "completed",
      completedAt: "exact-worker-now",
      auditAction: "user.delete.storage",
      auditMetadata: { status: "completed", objectsDeleted: 3 },
    },
    {
      case: "failed",
      status: "failed",
      completedAt: null,
      auditAction: "user.delete.storage_failed",
      auditMetadata: { errorCode: "account.storage_provider_unavailable" },
    },
    {
      case: "partial",
      status: "pending",
      completedAt: null,
      auditAction: "user.delete.storage",
      auditMetadata: { status: "pending", objectsDeleted: 500 },
    },
  ]);
  assert.deepEqual(proof.policies, [
    "giq_audit_log_insert",
    "giq_deletion_job_read",
    "giq_deletion_job_write",
  ]);
  assert.deepEqual(proof.indexes, [
    "DeletionJob_status_scheduledFor_idx",
    "DeletionJob_storageBucket_storagePath_idx",
    "DeletionJob_targetType_status_idx",
  ]);
  assert.deepEqual(proof.contention, {
    selectorStatements: 2,
    claimStatements: 2,
    handlerCalls: 1,
    jobsCompleted: 1,
    jobsFailed: 0,
    objectsDeleted: 1,
    auditRows: 1,
  });
  assert.deepEqual(proof.rls, {
    anonymousDueRows: 0,
    ownerDueRows: 1,
    ownerClaimRowsAffected: 0,
    anonymousAuditInsert: "denied",
  });

  const statements = proof.statements as Array<Record<string, unknown>>;
  assert.deepEqual(
    statements.map((statement) => statement.variant),
    [
      "due-job-select",
      "claim-job-update",
      "outcome-job-update",
      "audit-result-insert",
    ],
  );
  assert.deepEqual(
    statements.map((statement) =>
      (statement.observedSql as Record<string, unknown>).statementType,
    ),
    ["SELECT", "UPDATE", "UPDATE", "INSERT"],
  );
  for (const statement of statements) {
    const observedSql = statement.observedSql as Record<string, unknown>;
    assert.equal(observedSql.persistedParameterValues, false);
    assert.equal(observedSql.sha256, sha256(String(observedSql.normalizedSql)));
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
  assert.doesNotMatch(serialized, /account-storage-deletion@/i);
  assert.doesNotMatch(serialized, /provider-secret-detail/i);
  return evidence;
}

export async function runAccountStorageDeletionVerifier() {
  const root = process.cwd();
  const runtimeUrl = assertAccountStorageDeletionVerifierTarget(
    requiredEnvironment("ACCOUNT_STORAGE_DELETION_VERIFY_DATABASE_URL"),
    process.env.ACCOUNT_STORAGE_DELETION_VERIFY_CONFIRM,
  );
  const applicationUrl = new URL(runtimeUrl);
  applicationUrl.searchParams.set("connection_limit", "4");
  process.env.DATABASE_URL = applicationUrl.toString();
  process.env.DIRECT_URL = applicationUrl.toString();
  process.env.DEMO_FIXTURE_QUERY_EVIDENCE_MODE = QUERY_EVIDENCE_MODE;
  const cleanupUrl = new URL(runtimeUrl);
  cleanupUrl.username = "postgres";

  const [
    { PrismaClient },
    { prisma, captureDisposableReplayQueries },
    { withDbAnonymousContext, withDbRequestContext, withDbSystemContext },
    { runAccountStorageDeletionJobs },
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

    await setupFixtures(cleanupPrisma);
    cleanupRequired = true;
    const rowCountsBefore = await countFixtureRows(cleanupPrisma);
    assert.deepEqual(rowCountsBefore, { users: 1, jobs: 6, audits: 0 });

    const policyRows = await cleanupPrisma.$queryRawUnsafe<
      Array<{ policyName: string }>
    >(`
      SELECT policyname AS "policyName"
      FROM pg_policies
      WHERE schemaname = 'public'
        AND (
          (tablename = 'DeletionJob' AND policyname IN (
            'giq_deletion_job_read',
            'giq_deletion_job_write'
          ))
          OR (tablename = 'AuditLog' AND policyname = 'giq_audit_log_insert')
        )
      ORDER BY policyname ASC
    `);
    const policies = policyRows.map((row) => row.policyName);
    assert.deepEqual(policies, [
      "giq_audit_log_insert",
      "giq_deletion_job_read",
      "giq_deletion_job_write",
    ]);
    const indexRows = await cleanupPrisma.$queryRawUnsafe<
      Array<{ indexName: string }>
    >(`
      SELECT indexname AS "indexName"
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'DeletionJob'
        AND indexname IN (
          'DeletionJob_targetType_status_idx',
          'DeletionJob_status_scheduledFor_idx',
          'DeletionJob_storageBucket_storagePath_idx'
        )
      ORDER BY indexname ASC
    `);
    const indexes = indexRows.map((row) => row.indexName);
    assert.deepEqual(indexes, [
      "DeletionJob_status_scheduledFor_idx",
      "DeletionJob_storageBucket_storagePath_idx",
      "DeletionJob_targetType_status_idx",
    ]);
    const isolationRows = await withDbSystemContext((tx) =>
      tx.$queryRawUnsafe<Array<{ transactionIsolation: string }>>(
        `SELECT current_setting('transaction_isolation') AS "transactionIsolation"`,
      ),
    );
    assert.deepEqual(isolationRows, [{ transactionIsolation: "read committed" }]);

    const batchCalls: string[] = [];
    const outcomeCapture = await captureDisposableReplayQueries(() =>
      runAccountStorageDeletionJobs(NOW, async (job) => {
        if (job.id === JOBS.complete) {
          batchCalls.push("complete");
          return { objectsDeleted: 3, completed: true };
        }
        if (job.id === JOBS.partial) {
          batchCalls.push("partial");
          return { objectsDeleted: 500, completed: false };
        }
        if (job.id === JOBS.failed) {
          batchCalls.push("failed");
          throw new Error(
            `account.storage_provider_unavailable: ${SECRET_PROVIDER_DETAIL}`,
          );
        }
        throw new Error("account.unexpected_storage_deletion_fixture");
      }),
    );
    assert.deepEqual(batchCalls, ["complete", "partial", "failed"]);
    assert.deepEqual(outcomeCapture.result, {
      jobsCompleted: 1,
      jobsFailed: 1,
      objectsDeleted: 503,
    });
    const statements = collectObservedStatements(outcomeCapture.queries);
    assert.deepEqual(
      statements.map((statement) => statement.variant),
      [
        "due-job-select",
        "claim-job-update",
        "outcome-job-update",
        "audit-result-insert",
      ],
    );
    assert.deepEqual(countWorkerStatements(outcomeCapture.queries), {
      dueJobSelect: 1,
      claimJobUpdate: 3,
      outcomeJobUpdate: 3,
      auditResultInsert: 3,
    });
    assert.equal(countAtomicOutcomeTransactions(outcomeCapture.queries), 3);
    const statementEvidence = await Promise.all(
      statements.map(async (statement) => ({
        variant: statement.variant,
        observedSql: statement.evidence,
        explain: await explainObservedStatement(
          withDbSystemContext,
          statement,
        ),
      })),
    );

    const outcomes = await readOutcomes(cleanupPrisma);
    assert.deepEqual(outcomes, [
      {
        case: "complete",
        status: "completed",
        completedAt: "exact-worker-now",
        auditAction: "user.delete.storage",
        auditMetadata: { status: "completed", objectsDeleted: 3 },
      },
      {
        case: "failed",
        status: "failed",
        completedAt: null,
        auditAction: "user.delete.storage_failed",
        auditMetadata: { errorCode: "account.storage_provider_unavailable" },
      },
      {
        case: "partial",
        status: "pending",
        completedAt: null,
        auditAction: "user.delete.storage",
        auditMetadata: { status: "pending", objectsDeleted: 500 },
      },
    ]);
    const excludedRows = await cleanupPrisma.deletionJob.findMany({
      where: { id: { in: [JOBS.freshLease, JOBS.future, JOBS.otherTarget] } },
      orderBy: { id: "asc" },
      select: { id: true, status: true, completedAt: true },
    });
    assert.deepEqual(
      excludedRows.map((row) => ({
        case:
          row.id === JOBS.freshLease
            ? "freshLease"
            : row.id === JOBS.future
              ? "future"
              : "otherTarget",
        status: row.status,
        completedAt: row.completedAt,
      })),
      [
        { case: "freshLease", status: "processing", completedAt: null },
        { case: "future", status: "pending", completedAt: null },
        { case: "otherTarget", status: "pending", completedAt: null },
      ],
    );
    const rowCountsAfterOutcomes = await countFixtureRows(cleanupPrisma);
    assert.deepEqual(rowCountsAfterOutcomes, { users: 1, jobs: 6, audits: 3 });

    const selector = statements.find(
      (statement) => statement.variant === "due-job-select",
    );
    const claim = statements.find(
      (statement) => statement.variant === "claim-job-update",
    );
    assert.ok(selector && claim);
    const anonymousDueRows = await withDbAnonymousContext((tx) =>
      tx.$queryRawUnsafe<unknown[]>(
        selector.normalizedSql,
        ...selector.parameters,
      ),
    );
    const ownerDueRows = await withDbRequestContext(USER_CONTEXT, (tx) =>
      tx.$queryRawUnsafe<unknown[]>(
        selector.normalizedSql,
        ...selector.parameters,
      ),
    );
    assert.equal(anonymousDueRows.length, 0);
    assert.equal(ownerDueRows.length, 1);
    const ownerClaimParameters = replaceParameter(
      claim.parameters,
      JOBS.complete,
      JOBS.partial,
    );
    const ownerClaimRowsAffected = await withDbRequestContext(
      USER_CONTEXT,
      (tx) =>
        tx.$executeRawUnsafe(claim.normalizedSql, ...ownerClaimParameters),
    );
    assert.equal(ownerClaimRowsAffected, 0);
    let anonymousAuditDenied = false;
    try {
      await withDbAnonymousContext((tx) =>
        tx.auditLog.create({
          data: {
            actorType: "system",
            action: "user.delete.storage",
            targetType: "deletionJob",
            targetId: JOBS.partial,
            metadata: JSON.stringify({ status: "pending", objectsDeleted: 0 }),
          },
        }),
      );
    } catch {
      anonymousAuditDenied = true;
    }
    assert.equal(anonymousAuditDenied, true);
    assert.deepEqual(await countFixtureRows(cleanupPrisma), {
      users: 1,
      jobs: 6,
      audits: 3,
    });

    await cleanupPrisma.deletionJob.update({
      where: { id: JOBS.partial },
      data: { status: "completed", completedAt: NOW },
    });
    const contentionProof = await proveContention(
      cleanupPrisma,
      captureDisposableReplayQueries,
      runAccountStorageDeletionJobs,
    );
    assert.deepEqual(contentionProof, {
      selectorStatements: 2,
      claimStatements: 2,
      handlerCalls: 1,
      jobsCompleted: 1,
      jobsFailed: 0,
      objectsDeleted: 1,
      auditRows: 1,
    });
    const rowCountsAfterContention = await countFixtureRows(cleanupPrisma);
    assert.deepEqual(rowCountsAfterContention, { users: 1, jobs: 7, audits: 4 });

    const noOpCapture = await captureDisposableReplayQueries(() =>
      runAccountStorageDeletionJobs(NOW, async () => {
        throw new Error("account.noop_handler_must_not_run");
      }),
    );
    assert.deepEqual(noOpCapture.result, {
      jobsCompleted: 0,
      jobsFailed: 0,
      objectsDeleted: 0,
    });
    assert.deepEqual(countWorkerStatements(noOpCapture.queries), {
      dueJobSelect: 1,
      claimJobUpdate: 0,
      outcomeJobUpdate: 0,
      auditResultInsert: 0,
    });
    const rowCountsAfterNoOp = await countFixtureRows(cleanupPrisma);
    assert.deepEqual(rowCountsAfterNoOp, { users: 1, jobs: 7, audits: 4 });

    const removed = await cleanupFixtures(cleanupPrisma);
    cleanupRequired = false;
    assert.deepEqual(removed, {
      auditLogRowsDeleted: 4,
      deletionJobRowsDeleted: 7,
      userRowsDeleted: 1,
    });
    const remaining = await countFixtureRows(cleanupPrisma);
    assert.deepEqual(remaining, { users: 0, jobs: 0, audits: 0 });

    const report = {
      schemaVersion: ACCOUNT_STORAGE_DELETION_EVIDENCE_SCHEMA_VERSION,
      auditKind: "account-storage-deletion-jobs-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: runtimeUrl.hostname,
        port: Number(runtimeUrl.port),
        productionOrProviderSystemsContacted: false,
        fixtureOwner: "account-storage-deletion-jobs-dedicated-proof",
        broadCleanupUsed: false,
      },
      runtimeIdentity: identities[0],
      sourceBinding: buildAccountStorageDeletionSourceBinding(root),
      proof: {
        queryId: "DB.ACCOUNT.DELETION.STORAGE_JOBS.PROCESS",
        sourceFile: "src/lib/account-service.ts",
        sourceSymbol: "runAccountStorageDeletionJobs",
        expectedMaximumJobs: 10,
        transactionIsolation: isolationRows[0].transactionIsolation,
        workerResult: outcomeCapture.result,
        rowCounts: {
          before: rowCountsBefore,
          afterOutcomes: rowCountsAfterOutcomes,
          afterContention: rowCountsAfterContention,
          afterNoOp: rowCountsAfterNoOp,
        },
        cases: {
          completedBatch: "completed-with-three-objects-and-audit",
          partialBatch:
            "returned-to-pending-with-five-hundred-objects-and-audit",
          providerFailure: "failed-with-safe-error-code-and-no-provider-detail",
          expiredLease: "processing-job-older-than-fifteen-minutes-reclaimed",
          freshLease: "fresh-processing-job-not-selected",
          futureJob: "future-pending-job-not-selected",
          otherTarget: "non-storage-job-not-selected",
          contention: "two-workers-one-claim-one-handler-one-audit",
          noDueJobs: "successful-zero-result-no-op",
          anonymousRead: "exact-due-selector-returned-zero",
          ownerRead: "exact-due-selector-returned-one-owned-pending-job",
          ownerWrite: "exact-claim-update-affected-zero",
          anonymousAudit: "system-audit-insert-denied",
          outcomeAtomicity:
            "three-status-and-audit-pairs-committed-in-one-transaction-each",
          productionDefault: "real-deleteAccountStoragePrefixBatch-retained",
        },
        outcomes,
        contention: contentionProof,
        rls: {
          anonymousDueRows: anonymousDueRows.length,
          ownerDueRows: ownerDueRows.length,
          ownerClaimRowsAffected,
          anonymousAuditInsert: "denied",
        },
        policies,
        indexes,
        statements: statementEvidence,
        status: "verified",
      },
      cleanup: {
        ...removed,
        remainingAuditLogRows: remaining.audits,
        remainingDeletionJobRows: remaining.jobs,
        remainingUserRows: remaining.users,
      },
      verdict: "verified",
    } as const;
    validateAccountStorageDeletionEvidence(report, root);
    const outputPath = resolve(root, ACCOUNT_STORAGE_DELETION_EVIDENCE_PATH);
    const temporaryPath = `${outputPath}.tmp`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    return { report, outputPath };
  } finally {
    if (cleanupRequired) await cleanupFixtures(cleanupPrisma);
    await Promise.all([prisma.$disconnect(), cleanupPrisma.$disconnect()]);
  }
}

async function setupFixtures(prisma: PrismaClient) {
  await cleanupFixtures(prisma);
  await prisma.user.create({
    data: {
      id: FIXTURE_USER_ID,
      email: FIXTURE_EMAIL,
      name: "Account storage deletion proof",
    },
  });
  const dueAt = new Date(NOW.getTime() - 60 * 60 * 1000);
  const expiredLeaseAt = new Date(NOW.getTime() - 20 * 60 * 1000);
  const freshLeaseAt = new Date(NOW.getTime() - 5 * 60 * 1000);
  const futureAt = new Date(NOW.getTime() + 60 * 60 * 1000);
  await prisma.deletionJob.createMany({
    data: [
      storageJob(JOBS.complete, "public-user-media", "pending", dueAt, dueAt),
      storageJob(
        JOBS.partial,
        "private-user-media",
        "pending",
        dueAt,
        new Date(dueAt.getTime() + 1_000),
      ),
      storageJob(
        JOBS.failed,
        "public-user-media",
        "processing",
        dueAt,
        expiredLeaseAt,
      ),
      storageJob(
        JOBS.freshLease,
        "private-user-media",
        "processing",
        dueAt,
        freshLeaseAt,
      ),
      storageJob(
        JOBS.future,
        "public-user-media",
        "pending",
        futureAt,
        dueAt,
      ),
      {
        ...storageJob(
          JOBS.otherTarget,
          "private-user-media",
          "pending",
          dueAt,
          dueAt,
        ),
        targetType: "non_storage_fixture",
      },
    ],
  });
}

function storageJob(
  id: string,
  storageBucket: "public-user-media" | "private-user-media",
  status: string,
  scheduledFor: Date,
  updatedAt: Date,
) {
  return {
    id,
    targetType: "user_storage_prefix",
    targetUserId: FIXTURE_USER_ID,
    storageBucket,
    storagePath: `users/${FIXTURE_USER_ID}`,
    status,
    scheduledFor,
    createdAt: updatedAt,
    updatedAt,
  };
}

async function proveContention(
  prisma: PrismaClient,
  captureQueries: typeof import("../src/lib/db").captureDisposableReplayQueries,
  runWorker: typeof import("../src/lib/account-service").runAccountStorageDeletionJobs,
) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await resetContentionFixture(prisma);
    let handlerCalls = 0;
    const capture = await captureQueries(() =>
      Promise.all([
        runWorker(NOW, async (job) => {
          assert.equal(job.id, JOBS.contention);
          handlerCalls += 1;
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
          return { objectsDeleted: 1, completed: true };
        }),
        runWorker(NOW, async (job) => {
          assert.equal(job.id, JOBS.contention);
          handlerCalls += 1;
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
          return { objectsDeleted: 1, completed: true };
        }),
      ]),
    );
    const counts = countWorkerStatements(capture.queries);
    if (counts.dueJobSelect !== 2 || counts.claimJobUpdate !== 2) continue;
    assert.equal(counts.outcomeJobUpdate, 1);
    assert.equal(counts.auditResultInsert, 1);
    assert.equal(handlerCalls, 1);
    const aggregate = capture.result.reduce(
      (result, worker) => ({
        jobsCompleted: result.jobsCompleted + worker.jobsCompleted,
        jobsFailed: result.jobsFailed + worker.jobsFailed,
        objectsDeleted: result.objectsDeleted + worker.objectsDeleted,
      }),
      { jobsCompleted: 0, jobsFailed: 0, objectsDeleted: 0 },
    );
    assert.deepEqual(aggregate, {
      jobsCompleted: 1,
      jobsFailed: 0,
      objectsDeleted: 1,
    });
    const auditRows = await prisma.auditLog.count({
      where: {
        targetType: "deletionJob",
        targetId: JOBS.contention,
        action: "user.delete.storage",
      },
    });
    assert.equal(auditRows, 1);
    const job = await prisma.deletionJob.findUnique({
      where: { id: JOBS.contention },
      select: { status: true, completedAt: true },
    });
    assert.equal(job?.status, "completed");
    assert.equal(job?.completedAt?.toISOString(), NOW.toISOString());
    return {
      selectorStatements: counts.dueJobSelect,
      claimStatements: counts.claimJobUpdate,
      handlerCalls,
      ...aggregate,
      auditRows,
    };
  }
  throw new Error("account.storage_deletion_contention_not_observed");
}

async function resetContentionFixture(prisma: PrismaClient) {
  await prisma.auditLog.deleteMany({
    where: { targetType: "deletionJob", targetId: JOBS.contention },
  });
  await prisma.deletionJob.deleteMany({ where: { id: JOBS.contention } });
  const dueAt = new Date(NOW.getTime() - 30 * 60 * 1000);
  await prisma.deletionJob.create({
    data: storageJob(
      JOBS.contention,
      "public-user-media",
      "pending",
      dueAt,
      dueAt,
    ),
  });
}

async function readOutcomes(prisma: PrismaClient) {
  const rows = await prisma.deletionJob.findMany({
    where: { id: { in: [JOBS.complete, JOBS.partial, JOBS.failed] } },
    select: { id: true, status: true, completedAt: true },
  });
  const audits = await prisma.auditLog.findMany({
    where: {
      targetType: "deletionJob",
      targetId: { in: [JOBS.complete, JOBS.partial, JOBS.failed] },
    },
    select: { action: true, targetId: true, metadata: true },
  });
  return rows
    .map((row) => {
      const audit = audits.find((candidate) => candidate.targetId === row.id);
      assert.ok(audit?.metadata);
      return {
        case: outcomeCase(row.id),
        status: row.status,
        completedAt:
          row.completedAt?.toISOString() === NOW.toISOString()
            ? "exact-worker-now"
            : null,
        auditAction: audit.action,
        auditMetadata: JSON.parse(audit.metadata) as Record<string, unknown>,
      };
    })
    .sort((left, right) => left.case.localeCompare(right.case));
}

function outcomeCase(id: string) {
  if (id === JOBS.complete) return "complete";
  if (id === JOBS.partial) return "partial";
  if (id === JOBS.failed) return "failed";
  throw new Error("account.unknown_storage_deletion_outcome");
}

async function cleanupFixtures(prisma: PrismaClient) {
  const auditLogRowsDeleted = await prisma.auditLog.deleteMany({
    where: { targetType: "deletionJob", targetId: { in: JOB_IDS } },
  });
  const deletionJobRowsDeleted = await prisma.deletionJob.deleteMany({
    where: { id: { in: JOB_IDS } },
  });
  const userRowsDeleted = await prisma.user.deleteMany({
    where: { id: FIXTURE_USER_ID },
  });
  return {
    auditLogRowsDeleted: auditLogRowsDeleted.count,
    deletionJobRowsDeleted: deletionJobRowsDeleted.count,
    userRowsDeleted: userRowsDeleted.count,
  };
}

async function countFixtureRows(prisma: PrismaClient) {
  const [users, jobs, audits] = await Promise.all([
    prisma.user.count({ where: { id: FIXTURE_USER_ID } }),
    prisma.deletionJob.count({ where: { id: { in: JOB_IDS } } }),
    prisma.auditLog.count({
      where: { targetType: "deletionJob", targetId: { in: JOB_IDS } },
    }),
  ]);
  return { users, jobs, audits };
}

function collectObservedStatements(queries: DisposableReplayQueryEvent[]) {
  const unique = new Map<StatementVariant, ObservedStatement>();
  for (const event of queries) {
    const variant = classifyWorkerStatement(event.query);
    if (!variant || unique.has(variant)) continue;
    const normalizedSql = normalizeObservedSql(event.query);
    const parameters = parsePrismaParameters(event.params, variant);
    const statementType = normalizedSql.split(" ", 1)[0] as
      | "SELECT"
      | "UPDATE"
      | "INSERT";
    unique.set(variant, {
      variant,
      normalizedSql,
      parameters,
      evidence: {
        statementType,
        normalizedSql,
        sha256: sha256(normalizedSql),
        parameterCount: parameters.length,
        persistedParameterValues: false,
      },
    });
  }
  const order: StatementVariant[] = [
    "due-job-select",
    "claim-job-update",
    "outcome-job-update",
    "audit-result-insert",
  ];
  const statements = order.map((variant) => unique.get(variant));
  assert.ok(statements.every(Boolean));
  return statements as ObservedStatement[];
}

function countWorkerStatements(queries: DisposableReplayQueryEvent[]) {
  const counts = {
    dueJobSelect: 0,
    claimJobUpdate: 0,
    outcomeJobUpdate: 0,
    auditResultInsert: 0,
  };
  for (const event of queries) {
    const variant = classifyWorkerStatement(event.query);
    if (variant === "due-job-select") counts.dueJobSelect += 1;
    if (variant === "claim-job-update") counts.claimJobUpdate += 1;
    if (variant === "outcome-job-update") counts.outcomeJobUpdate += 1;
    if (variant === "audit-result-insert") counts.auditResultInsert += 1;
  }
  return counts;
}

function classifyWorkerStatement(value: string): StatementVariant | null {
  const sql = normalizeObservedSql(value);
  if (sql.startsWith("SELECT") && sql.includes('FROM "public"."DeletionJob"')) {
    return "due-job-select";
  }
  if (sql.startsWith("UPDATE") && sql.includes('"public"."DeletionJob"')) {
    return sql.includes('"completedAt"')
      ? "outcome-job-update"
      : "claim-job-update";
  }
  if (sql.startsWith("INSERT") && sql.includes('INTO "public"."AuditLog"')) {
    return "audit-result-insert";
  }
  return null;
}

function countAtomicOutcomeTransactions(queries: DisposableReplayQueryEvent[]) {
  let inTransaction = false;
  let outcomeSeen = false;
  let auditSeen = false;
  let pairs = 0;
  for (const event of queries) {
    const sql = normalizeObservedSql(event.query);
    if (sql === "BEGIN") {
      inTransaction = true;
      outcomeSeen = false;
      auditSeen = false;
      continue;
    }
    const variant = classifyWorkerStatement(sql);
    if (inTransaction && variant === "outcome-job-update") outcomeSeen = true;
    if (inTransaction && variant === "audit-result-insert") auditSeen = true;
    if (sql === "COMMIT") {
      if (outcomeSeen && auditSeen) pairs += 1;
      inTransaction = false;
    }
  }
  return pairs;
}

function parsePrismaParameters(value: string, variant: StatementVariant) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    assert.equal(variant, "audit-result-insert");
    const match = /^\["([^"]*)","([^"]*)","([^"]*)","([^"]*)","(\{.*\})","([^"]*)"\]$/.exec(
      value,
    );
    assert.ok(match, "Observed AuditLog parameters must match the fixed shape");
    JSON.parse(match[5]);
    parsed = match.slice(1);
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

function replaceParameter(
  parameters: unknown[],
  currentValue: unknown,
  nextValue: unknown,
) {
  let replacements = 0;
  const result = parameters.map((parameter) => {
    if (parameter !== currentValue) return parameter;
    replacements += 1;
    return nextValue;
  });
  assert.equal(replacements, 1);
  return result;
}

function normalizeObservedSql(value: string) {
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
  const planContainer = plainObject(queryPlan[0], "EXPLAIN plan container");
  return sanitizeExplainNode(planContainer.Plan);
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
    scanDirection: optionalPlanString(
      node["Scan Direction"],
      "Scan Direction",
    ),
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
  const { report, outputPath } = await runAccountStorageDeletionVerifier();
  console.log(
    JSON.stringify({
      verdict: report.verdict,
      queryId: report.proof.queryId,
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
