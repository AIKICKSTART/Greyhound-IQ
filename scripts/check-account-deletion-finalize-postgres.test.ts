import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  ACCOUNT_DELETION_FINALIZE_EVIDENCE_PATH,
  ACCOUNT_DELETION_FINALIZE_VERIFY_CONFIRMATION,
  assertAccountDeletionFinalizeVerifierTarget,
  validateAccountDeletionFinalizeEvidence,
} from "./check-account-deletion-finalize-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertAccountDeletionFinalizeVerifierTarget(
    runtimeUrl,
    ACCOUNT_DELETION_FINALIZE_VERIFY_CONFIRMATION,
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
    assertAccountDeletionFinalizeVerifierTarget(
      invalid,
      ACCOUNT_DELETION_FINALIZE_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertAccountDeletionFinalizeVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, ACCOUNT_DELETION_FINALIZE_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() =>
  validateAccountDeletionFinalizeEvidence(evidence, root),
);

const operation = DATABASE_OPERATIONS.find(
  (candidate) =>
    candidate.queryId === "DB.ACCOUNT.DELETION.FINALIZE.TRANSACTION",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceFile, "src/lib/account-service.ts");
assert.equal(operation.sourceSymbol, "runAccountDeletionMaintenance");
assert.equal(operation.databaseRole, "greyhoundiq_runtime");
assert.equal(operation.databaseName, "greyhoundiq");
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 20_100);
assert.ok(
  operation.tests.includes(
    "scripts/check-account-deletion-finalize-postgres.test.ts",
  ),
);
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes(ACCOUNT_DELETION_FINALIZE_EVIDENCE_PATH),
  ),
);

const source = readFileSync(resolve(root, "src/lib/account-service.ts"), "utf8");
for (const contract of [
  "const ACCOUNT_DELETION_USER_LIMIT = 25;",
  "const ACCOUNT_DELETION_CONTENT_BATCH_LIMIT = 100;",
  "lockAccountDeletionCandidate(",
  "FOR UPDATE",
  "FOR UPDATE SKIP LOCKED",
  "LIMIT ${ACCOUNT_DELETION_CONTENT_BATCH_LIMIT}",
  'action: "user.delete.batch"',
  "if (!batchComplete)",
  "if (counts.finalized) result.finalizedCount += 1",
  "runAccountStorageDeletionJobs(now, deleteBatch)",
]) {
  assert.ok(source.includes(contract), contract);
}
assert.equal(
  source.match(/LIMIT \$\{ACCOUNT_DELETION_CONTENT_BATCH_LIMIT\}/g)?.length,
  8,
);
assert.match(
  source,
  /WHERE m\."senderId" = \$\{profileId\}[\s\S]*?UPDATE "Message" AS target/,
);
assert.doesNotMatch(
  between(source, "async function scrubProfileOwnedContent", "/** @internal Exported for the account-deletion regression test."),
  /\.updateMany\(\s*accountDeletionAuthoredMessageUpdate/,
);

console.log(
  "account-deletion finalize database evidence passed: locked resumable batches, gated finalization, rollback and provider-free cleanup",
);

function between(value: string, start: string, end: string) {
  const from = value.indexOf(start);
  const to = value.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source slice ${start} -> ${end}`);
  return value.slice(from, to);
}
