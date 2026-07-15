import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  ONBOARDING_RATE_LIMIT_EVIDENCE_PATH,
  ONBOARDING_RATE_LIMIT_VERIFY_CONFIRMATION,
  assertOnboardingRateLimitVerifierTarget,
  validateOnboardingRateLimitEvidence,
} from "./check-onboarding-analytics-rate-limit-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertOnboardingRateLimitVerifierTarget(
    runtimeUrl,
    ONBOARDING_RATE_LIMIT_VERIFY_CONFIRMATION,
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
    assertOnboardingRateLimitVerifierTarget(
      invalid,
      ONBOARDING_RATE_LIMIT_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertOnboardingRateLimitVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, ONBOARDING_RATE_LIMIT_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() => validateOnboardingRateLimitEvidence(evidence, root));

const operation = DATABASE_OPERATIONS.find(
  (candidate) =>
    candidate.queryId === "DB.ONBOARDING.ANALYTICS.RATE_LIMIT",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceFile, "src/lib/rate-limit.ts");
assert.equal(operation.sourceSymbol, "checkRateLimit");
assert.equal(operation.databaseRole, "greyhoundiq_runtime");
assert.equal(operation.databaseName, "greyhoundiq");
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 1);
assert.deepEqual(operation.rowLevelSecurityPolicies, ["giq_rate_limit_all"]);
assert.equal(
  operation.locks?.includes("row-level conflict lock on RateLimit_pkey"),
  true,
);
const proof = evidence.proof as Record<string, unknown>;
const statement = proof.statement as Record<string, unknown>;
const observedSql = statement.observedSql as Record<string, unknown>;
assert.equal(operation.normalizedSql, observedSql.normalizedSql);
assert.ok(
  operation.tests.includes(
    "scripts/check-onboarding-analytics-rate-limit-postgres.test.ts",
  ),
);
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes(ONBOARDING_RATE_LIMIT_EVIDENCE_PATH),
  ),
);
assert.ok(
  operation.explainPlanEvidence?.includes(
    ONBOARDING_RATE_LIMIT_EVIDENCE_PATH,
  ),
);

console.log(
  "onboarding analytics rate-limit evidence passed: exact atomic upsert, contention, reset, RLS and route denial proof",
);
