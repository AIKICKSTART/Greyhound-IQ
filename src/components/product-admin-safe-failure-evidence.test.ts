import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  PRODUCT_ADMIN_SAFE_FAILURE_EVIDENCE_FILE,
  PRODUCT_ADMIN_SAFE_FAILURE_MASTER_EVIDENCE,
  PRODUCT_ADMIN_SAFE_FAILURE_REQUIREMENT_IDS,
  PRODUCT_ADMIN_SAFE_FAILURE_SCOPE,
  PRODUCT_ADMIN_SAFE_FAILURE_TEST_FILE,
} from "./product-admin-safe-failure-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-ADMIN-SAFE-FAILURE

const requirementId = "ROUTE.ADMIN.safe-failure" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  (candidate) => candidate.id === requirementId,
);
assert.ok(requirement, requirementId);
assert.equal(
  requirement.requirement,
  "Show a safe reference and retry path for sensitive failures.",
);
assert.deepEqual(PRODUCT_ADMIN_SAFE_FAILURE_REQUIREMENT_IDS, [requirementId]);
assert.deepEqual(Object.keys(PRODUCT_ADMIN_SAFE_FAILURE_MASTER_EVIDENCE), [
  requirementId,
]);

const evidence = PRODUCT_ADMIN_SAFE_FAILURE_MASTER_EVIDENCE[requirementId];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_ADMIN_SAFE_FAILURE_EVIDENCE_FILE,
  PRODUCT_ADMIN_SAFE_FAILURE_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

assert.match(PRODUCT_ADMIN_SAFE_FAILURE_SCOPE, /Focused source verification/i);
assert.match(PRODUCT_ADMIN_SAFE_FAILURE_SCOPE, /Next\.js 16\.2 error boundary/i);
assert.match(PRODUCT_ADMIN_SAFE_FAILURE_SCOPE, /safe digest reference/i);
assert.match(PRODUCT_ADMIN_SAFE_FAILURE_SCOPE, /does not prove a hydrated browser transition/i);

const source = readFileSync("src/app/admin/error.tsx", "utf8");
for (const signal of [
  '"use client"',
  "error: Error & { digest?: string }",
  "unstable_retry: () => void",
  'console.error("admin.segment_error", { digest: error.digest ?? "unknown" })',
  "No success state has been recorded.",
  "Reference {error.digest}",
  "onClick={() => unstable_retry()}",
  "Retry securely",
  '<Link href="/admin"',
  "Admin dashboard",
]) {
  assert.ok(source.includes(signal), signal);
}
for (const unsafe of [
  "error.message",
  "error.stack",
  "JSON.stringify(error)",
  "String(error)",
]) {
  assert.equal(source.includes(unsafe), false, unsafe);
}

const evidenceSource = readFileSync(
  PRODUCT_ADMIN_SAFE_FAILURE_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Administrator safe-failure evidence passed in isolation: safe digest reference, secure retry and dashboard recovery are ready for exact +1 central wiring.",
);
