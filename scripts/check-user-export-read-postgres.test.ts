import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  USER_EXPORT_READ_EVIDENCE_PATH,
  USER_EXPORT_READ_VERIFY_CONFIRMATION,
  assertUserExportReadVerifierTarget,
  validateUserExportReadEvidence,
} from "./check-user-export-read-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertUserExportReadVerifierTarget(
    runtimeUrl,
    USER_EXPORT_READ_VERIFY_CONFIRMATION,
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
    assertUserExportReadVerifierTarget(
      invalid,
      USER_EXPORT_READ_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertUserExportReadVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, USER_EXPORT_READ_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() => validateUserExportReadEvidence(evidence, root));

const operation = DATABASE_OPERATIONS.find(
  (candidate) => candidate.queryId === "DB.ACCOUNT.DATA_EXPORT.READ",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceFile, "src/lib/user-export-service.ts");
assert.equal(operation.sourceSymbol, "readUserExportData");
assert.equal(operation.databaseRole, "greyhoundiq_runtime");
assert.equal(operation.databaseName, "greyhoundiq");
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 41_502);
assert.ok(
  operation.tests.includes("scripts/check-user-export-read-postgres.test.ts"),
);
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes(USER_EXPORT_READ_EVIDENCE_PATH),
  ),
);

const service = readFileSync(
  resolve(root, "src/lib/user-export-service.ts"),
  "utf8",
);
for (const contract of [
  "export async function readUserExportData(",
  "const COLLECTION_TAKE = USER_EXPORT_COLLECTION_LIMIT + 1;",
  "const NESTED_COLLECTION_TAKE = USER_EXPORT_NESTED_COLLECTION_LIMIT + 1;",
  "CROSS JOIN LATERAL",
  "LIMIT ${NESTED_COLLECTION_TAKE}",
  "assertUserExportCollections({",
  "assertNestedMediaBounds([",
]) {
  assert.ok(service.includes(contract), contract);
}
assert.equal(service.match(/LIMIT \$\{NESTED_COLLECTION_TAKE\}/g)?.length, 2);
for (const forbidden of [
  "stripeCustomerId: true",
  "workosUserId: true",
  "storageBucket: true",
  "storagePath: true",
  "publicUrl: true",
  "sha256: true",
  "inputJson: true",
  "outputJson: true",
  "toolInvocations: true",
  "sourceRef: true",
]) {
  assert.equal(service.includes(forbidden), false, forbidden);
}

const route = readFileSync(
  resolve(root, "src/app/api/users/me/export/route.ts"),
  "utf8",
);
assert.match(route, /await readUserExportData\(current\)/);
assert.doesNotMatch(route, /tx\.(?:user|profile|message|listing)\./);
assert.match(route, /assertUserExportSize\(responseBody\)/);
assert.match(route, /USER_EXPORT_CACHE_CONTROL/);

console.log(
  "user-export read database evidence passed: exact bounded SQL, owner predicates, sensitive RLS, overflow rejection and cleanup",
);
