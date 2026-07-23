import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  ACCOUNT_DELETION_PENDING_EVIDENCE_PATH,
  ACCOUNT_DELETION_PENDING_VERIFY_CONFIRMATION,
  assertAccountDeletionPendingVerifierTarget,
  validateAccountDeletionPendingEvidence,
} from "./check-account-deletion-pending-select-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertAccountDeletionPendingVerifierTarget(
    runtimeUrl,
    ACCOUNT_DELETION_PENDING_VERIFY_CONFIRMATION,
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
    assertAccountDeletionPendingVerifierTarget(
      invalid,
      ACCOUNT_DELETION_PENDING_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertAccountDeletionPendingVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, ACCOUNT_DELETION_PENDING_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() => validateAccountDeletionPendingEvidence(evidence, root));

const operation = DATABASE_OPERATIONS.find(
  (candidate) => candidate.queryId === "DB.ACCOUNT.DELETION.PENDING.SELECT",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceSymbol, "findPendingAccountDeletionUsers");
assert.equal(operation.databaseRole, "greyhoundiq_runtime");
assert.equal(operation.databaseName, "greyhoundiq");
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 25);
assert.ok(
  operation.indexesExpected.includes(
    "User_isBanned_deletionRequestedAt_id_idx",
  ),
);
const proof = evidence.proof as Record<string, unknown>;
const proofVariants = proof.variants as Array<Record<string, unknown>>;
assert.equal(
  operation.normalizedSql,
  (proof.observedSql as Record<string, unknown>).normalizedSql,
);
assert.deepEqual(
  operation.normalizedSqlVariants?.map((variant) => ({
    variant: variant.variant,
    normalizedSql: variant.normalizedSql,
  })),
  proofVariants.map((variant) => ({
    variant: variant.variant,
    normalizedSql: (variant.observedSql as Record<string, unknown>)
      .normalizedSql,
  })),
);

const serviceSource = readFileSync(
  resolve(root, "src/lib/account-service.ts"),
  "utf8",
);
assert.match(
  serviceSource,
  /const pendingUsers = await findPendingAccountDeletionUsers\(cutoff\)/,
);
const selectorSource = /export async function findPendingAccountDeletionUsers[\s\S]*?(?=\nexport (?:async )?function )/.exec(
  serviceSource,
)?.[0];
assert.ok(selectorSource);
for (const required of [
  "isBanned: true",
  "deletionRequestedAt: { lte: cutoff }",
  'orderBy: [{ deletionRequestedAt: "asc" }, { id: "asc" }]',
  "take: ACCOUNT_DELETION_USER_LIMIT",
  "profile: { select: { id: true } }",
]) {
  assert.ok(selectorSource.includes(required), required);
}
assert.match(
  readFileSync(resolve(root, "prisma/schema.prisma"), "utf8"),
  /@@index\(\[isBanned, deletionRequestedAt, id\]\)/,
);
const migration = readFileSync(
  resolve(
    root,
    "prisma/migrations/20260715053000_add_account_deletion_pending_index/migration.sql",
  ),
  "utf8",
);
assert.match(migration, /CREATE INDEX CONCURRENTLY/);
assert.match(migration, /"isBanned", "deletionRequestedAt", "id"/);
assert.doesNotMatch(migration, /DROP|DELETE|UPDATE|ALTER TABLE/i);

for (const mutate of [
  (candidate: Record<string, unknown>) => {
    candidate.verdict = "conditional";
  },
  (candidate: Record<string, unknown>) => {
    (candidate.sourceBinding as Record<string, unknown>).combinedSha256 =
      "0".repeat(64);
  },
  (candidate: Record<string, unknown>) => {
    const candidateProof = candidate.proof as Record<string, unknown>;
    const variants = candidateProof.variants as Array<Record<string, unknown>>;
    (variants[0].observedSql as Record<string, unknown>).normalizedSql +=
      " /* stale */";
  },
  (candidate: Record<string, unknown>) => {
    const candidateProof = candidate.proof as Record<string, unknown>;
    const cases = candidateProof.cases as Record<string, unknown>;
    cases.anonymousRlsReplay = "both-returned-one";
  },
]) {
  const candidate = structuredClone(evidence);
  mutate(candidate);
  assert.throws(() => validateAccountDeletionPendingEvidence(candidate, root));
}

console.log(
  "dedicated account-deletion pending selector evidence passed: exact SQL, plans, RLS, index, source binding and cleanup",
);
