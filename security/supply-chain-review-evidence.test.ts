import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  SUPPLY_CHAIN_REVIEW_MASTER_EVIDENCE,
  VERIFIED_SUPPLY_CHAIN_REVIEW_IDS,
} from "./supply-chain-review-evidence";
import { assertSupplyChainDependencyReview } from "../scripts/check-supply-chain-policy";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
const dependencyReview = JSON.parse(
  readFileSync("security/supply-chain-review.snapshot.json", "utf8"),
);
const dependencyReviewSummary = assertSupplyChainDependencyReview(
  manifest,
  lockfile,
  dependencyReview,
);

const policy = readFileSync("scripts/check-supply-chain-policy.ts", "utf8");
const review = readFileSync("docs/security/supply-chain-review.md", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");

assert.equal(VERIFIED_SUPPLY_CHAIN_REVIEW_IDS.length, 12);
assert.deepEqual(dependencyReviewSummary, {
  reviewedDirectDependencies: 42,
  reviewedLifecyclePackages: 8,
  duplicateLibraryFamilies: 78,
  deprecatedDevelopmentPackages: 3,
});
assert.match(policy, /forbidden URL, Git/i);
assert.match(policy, /assertWorkflowActionPins/);
assert.match(policy, /CycloneDX/);
assert.match(review, /exact HTTPS distribution URL on `registry\.npmjs\.org`/);
assert.match(review, /GitHub Action reference is pinned to an immutable full commit SHA/);
assert.match(review, /container base image is selected by a mutable tag/i);
assert.match(review, /non-root lock entries/i);
assert.match(review, /clean advisory scan is not proof/i);
assert.match(dockerfile, /^FROM\s+\S+/m);

for (const id of VERIFIED_SUPPLY_CHAIN_REVIEW_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[id],
    SUPPLY_CHAIN_REVIEW_MASTER_EVIDENCE[id],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of SECURITY_MASTER_EVIDENCE[id].evidence) {
    assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
  }
}

const internalPublishingId =
  "security.supply-chain-review.internal-package-publishing";
const internalPublishingRequirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) =>
    candidate.prompt === "security" && candidate.id === internalPublishingId,
);
assert.ok(internalPublishingRequirement, `${internalPublishingId}: missing requirement`);
assert.equal(isMasterRequirementComplete(internalPublishingRequirement), true);
const internalPublishingJustification =
  SUPPLY_CHAIN_REVIEW_MASTER_EVIDENCE[internalPublishingId]
    .notApplicableJustification;
assert.ok(internalPublishingJustification);
assert.match(
  internalPublishingJustification,
  /private npm package.*no workspaces.*internal package namespace/i,
);

console.log("supply-chain review evidence passed: 12 exact reviews and 1 justified not-applicable review");
