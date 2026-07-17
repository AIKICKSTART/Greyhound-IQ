import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  ACCOUNT_STORAGE_DELETION_EVIDENCE_PATH,
  ACCOUNT_STORAGE_DELETION_VERIFY_CONFIRMATION,
  assertAccountStorageDeletionVerifierTarget,
  validateAccountStorageDeletionEvidence,
} from "./check-account-storage-deletion-jobs-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertAccountStorageDeletionVerifierTarget(
    runtimeUrl,
    ACCOUNT_STORAGE_DELETION_VERIFY_CONFIRMATION,
  ).toString(),
  runtimeUrl,
);
for (const invalid of [
  "postgresql://greyhoundiq_runtime@127.0.0.1:55733/greyhoundiq",
  "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime:secret@127.0.0.1:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@localhost:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/postgres",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq?host=db.invalid",
]) {
  assert.throws(() =>
    assertAccountStorageDeletionVerifierTarget(
      invalid,
      ACCOUNT_STORAGE_DELETION_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertAccountStorageDeletionVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, ACCOUNT_STORAGE_DELETION_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() =>
  validateAccountStorageDeletionEvidence(evidence, root),
);

const operation = DATABASE_OPERATIONS.find(
  (candidate) =>
    candidate.queryId === "DB.ACCOUNT.DELETION.STORAGE_JOBS.PROCESS",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceFile, "src/lib/account-service.ts");
assert.equal(operation.sourceSymbol, "runAccountStorageDeletionJobs");
assert.equal(operation.databaseRole, "greyhoundiq_runtime");
assert.equal(operation.databaseName, "greyhoundiq");
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 10);
assert.ok(operation.rowLevelSecurityPolicies.includes("giq_deletion_job_read"));
assert.ok(operation.rowLevelSecurityPolicies.includes("giq_deletion_job_write"));
assert.ok(operation.rowLevelSecurityPolicies.includes("giq_audit_log_insert"));
const statements = (evidence.proof as Record<string, unknown>)
  .statements as Array<Record<string, unknown>>;
assert.deepEqual(
  operation.normalizedSqlVariants?.map((variant) => ({
    variant: variant.variant,
    normalizedSql: variant.normalizedSql,
  })),
  statements.map((statement) => ({
    variant: statement.variant,
    normalizedSql: (statement.observedSql as Record<string, unknown>)
      .normalizedSql,
  })),
);
assert.equal(
  operation.normalizedSql,
  (statements[0].observedSql as Record<string, unknown>).normalizedSql,
);
assert.ok(
  operation.tests.includes(
    "scripts/check-account-storage-deletion-jobs-postgres.test.ts",
  ),
);
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes(ACCOUNT_STORAGE_DELETION_EVIDENCE_PATH),
  ),
);

const serviceSource = readFileSync(
  resolve(root, "src/lib/account-service.ts"),
  "utf8",
);
assert.match(
  serviceSource,
  /export async function runAccountStorageDeletionJobs\([\s\S]*?deleteBatch: AccountStorageDeletionBatchHandler\s*=\s*deleteAccountStoragePrefixBatch/,
);
assert.match(serviceSource, /const batch = await deleteBatch\(job\)/);
assert.match(
  serviceSource,
  /const storage = await runAccountStorageDeletionJobs\(now, deleteBatch\)/,
);
assert.match(serviceSource, /take: STORAGE_DELETION_JOB_LIMIT/);
assert.match(serviceSource, /if \(claimed\.count !== 1\) continue/);

const rlsSource = readFileSync(
  resolve(
    root,
    "prisma/migrations/20260708190000_add_rls_remaining_tables/migration.sql",
  ),
  "utf8",
);
assert.match(rlsSource, /CREATE POLICY giq_deletion_job_read/);
assert.match(rlsSource, /CREATE POLICY giq_deletion_job_write/);
const auditRlsSource = readFileSync(
  resolve(
    root,
    "prisma/migrations/20260708192000_restrict_audit_ratelimit_rls/migration.sql",
  ),
  "utf8",
);
assert.match(auditRlsSource, /CREATE POLICY giq_audit_log_insert/);
assert.match(auditRlsSource, /public\.giq_is_system\(\)/);

for (const mutate of [
  (candidate: Record<string, unknown>) => {
    candidate.verdict = "conditional";
  },
  (candidate: Record<string, unknown>) => {
    (candidate.sourceBinding as Record<string, unknown>).combinedSha256 =
      "0".repeat(64);
  },
  (candidate: Record<string, unknown>) => {
    const proof = candidate.proof as Record<string, unknown>;
    const candidateStatements = proof.statements as Array<
      Record<string, unknown>
    >;
    (candidateStatements[0].observedSql as Record<string, unknown>).normalizedSql +=
      " /* stale */";
  },
  (candidate: Record<string, unknown>) => {
    const proof = candidate.proof as Record<string, unknown>;
    const cases = proof.cases as Record<string, unknown>;
    cases.contention = "two-handlers-ran";
  },
  (candidate: Record<string, unknown>) => {
    const proof = candidate.proof as Record<string, unknown>;
    const rls = proof.rls as Record<string, unknown>;
    rls.ownerClaimRowsAffected = 1;
  },
]) {
  const candidate = structuredClone(evidence);
  mutate(candidate);
  assert.throws(() =>
    validateAccountStorageDeletionEvidence(candidate, root),
  );
}

console.log(
  "account storage deletion database evidence passed: bounded lifecycle, RLS, contention, provider-failure sanitization and cleanup",
);
