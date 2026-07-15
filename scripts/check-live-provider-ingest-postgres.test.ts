import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  LIVE_PROVIDER_INGEST_EVIDENCE_PATH,
  LIVE_PROVIDER_INGEST_VERIFY_CONFIRMATION,
  assertLiveProviderIngestVerifierTarget,
  validateLiveProviderIngestEvidence,
} from "./check-live-provider-ingest-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertLiveProviderIngestVerifierTarget(
    runtimeUrl,
    LIVE_PROVIDER_INGEST_VERIFY_CONFIRMATION,
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
    assertLiveProviderIngestVerifierTarget(
      invalid,
      LIVE_PROVIDER_INGEST_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertLiveProviderIngestVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, LIVE_PROVIDER_INGEST_EVIDENCE_PATH), "utf8"),
) as unknown;
assert.doesNotThrow(() => validateLiveProviderIngestEvidence(evidence, root));

const operation = DATABASE_OPERATIONS.find(
  (candidate) => candidate.queryId === "DB.RACING.PROVIDER.INGEST.TRANSACTION",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceFile, "src/lib/live/sync.ts");
assert.equal(operation.databaseRole, "greyhoundiq_runtime with transaction-local app.system=true");
assert.equal(
  operation.normalizedSqlArtifact,
  LIVE_PROVIDER_INGEST_EVIDENCE_PATH,
);
assert.ok(
  operation.tests.includes(
    "scripts/check-live-provider-ingest-postgres.test.ts",
  ),
);
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes(LIVE_PROVIDER_INGEST_EVIDENCE_PATH),
  ),
);
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes("Prisma + AlloyDB for PostgreSQL"),
  ),
);

console.log(
  "live provider ingest database evidence passed: runtime SQL, system context, commit and forced rollback",
);
