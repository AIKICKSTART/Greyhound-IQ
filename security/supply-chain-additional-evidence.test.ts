import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { assertManifestLockPolicy } from "../scripts/check-supply-chain-policy";
import { SUPPLY_CHAIN_ADDITIONAL_MASTER_EVIDENCE } from "./supply-chain-additional-evidence";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
const lockSummary = assertManifestLockPolicy(manifest, lockfile);
assert.ok(lockSummary.lockEntries > 0);
assert.ok(lockSummary.uniqueLockComponents > 0);
assert.equal(
  manifest.scripts["check:terraform-source"],
  "node infra/terraform/contract.test.mjs && node infra/terraform/private-datastore-policy.test.mjs && node infra/terraform-production/contract.test.mjs",
);

const dependabot = readFileSync(".github/dependabot.yml", "utf8");
assert.match(dependabot, /package-ecosystem: npm/);
assert.match(dependabot, /package-ecosystem: github-actions/);
assert.match(dependabot, /interval: weekly/);
assert.match(dependabot, /timezone: Australia\/Sydney/);
assert.match(dependabot, /open-pull-requests-limit: 5/);

const codeOwners = readFileSync(".github/CODEOWNERS", "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
assert.ok(
  codeOwners.some((line) => /^\*\s+@[-A-Za-z0-9_]+(?:\s+@[-A-Za-z0-9_]+)*$/.test(line)),
  "all source, security, infrastructure and workflow files require an explicit owner",
);

const expectedIds = Object.keys(SUPPLY_CHAIN_ADDITIONAL_MASTER_EVIDENCE);
assert.equal(expectedIds.length, 4);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    SUPPLY_CHAIN_ADDITIONAL_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

for (const unprovenId of [
  "security.supply-chain-control.container-image-scanning",
  "security.supply-chain-control.license-review",
  "security.supply-chain-control.malicious-package-detection",
  "security.supply-chain-control.build-reproducibility-where-practical",
  "security.supply-chain-control.deployment-approval",
  "security.supply-chain-control.protected-branches",
  "security.supply-chain-control.required-code-review",
  "security.supply-chain-control.release-signing-or-provenance-where-supported",
] as const) {
  assert.equal(
    SUPPLY_CHAIN_ADDITIONAL_MASTER_EVIDENCE[unprovenId],
    undefined,
    `${unprovenId}: requires a separate implemented or deployed control`,
  );
}

console.log(
  "Supply-chain additions passed: registry provenance, weekly dependency updates, repository-wide ownership, and CI IaC scanning",
);
