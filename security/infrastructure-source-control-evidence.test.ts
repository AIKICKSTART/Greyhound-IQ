import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  INFRASTRUCTURE_SOURCE_CONTROL_MASTER_EVIDENCE,
  VERIFIED_INFRASTRUCTURE_SOURCE_CONTROL_IDS,
} from "./infrastructure-source-control-evidence";

const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const deploy = readFileSync(".github/workflows/cloud-run-deploy.yml", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");
const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  engines?: { node?: string };
};
const nextManifest = JSON.parse(
  readFileSync("node_modules/next/package.json", "utf8"),
) as { engines?: { node?: string } };

assert.match(ci, /^\s*pull_request:\s*$/m);
assert.match(ci, /^permissions:\s*\r?\n\s+contents:\s*read\s*$/m);
assert.doesNotMatch(
  ci,
  /\$\{\{\s*secrets\./,
  "untrusted pull-request CI must not receive repository secrets",
);
assert.doesNotMatch(deploy, /^\s*pull_request:/m);

for (const identity of [
  "GCP_BUILD_SERVICE_ACCOUNT",
  "GCP_DEPLOY_SERVICE_ACCOUNT",
  "GCP_RUNTIME_SERVICE_ACCOUNT",
]) {
  assert.ok(deploy.includes(identity), `${identity}: missing deployment identity`);
}
assert.match(deploy, /Validate distinct workload identities/);
assert.match(
  deploy,
  /Build, deploy and runtime service accounts must be distinct\./,
);
assert.match(deploy, /id-token:\s*write/);
assert.doesNotMatch(deploy, /credentials_json:|service_account_key:/);

assert.match(dockerfile, /^FROM node:24-bookworm-slim AS base$/m);
assert.match(dockerfile, /ENV NODE_ENV=production/);
assert.match(deploy, /env_vars="NODE_ENV=production,/);
assert.doesNotMatch(deploy, /LIVE_SYNC_DEBUG|NODE_OPTIONS=.*inspect/i);
for (const productionDisabledSource of [
  "src/components/design-lab-contract-inspector-prototype.tsx",
  "src/components/prototype-switcher.tsx",
]) {
  assert.match(
    readFileSync(productionDisabledSource, "utf8"),
    /process\.env\.NODE_ENV === "production"/,
  );
}

assert.equal(manifest.engines?.node, ">=22.11 <25");
assert.match(nextManifest.engines?.node ?? "", />=20\.9\.0/);
assert.ok((ci.match(/node-version:\s*24/g) ?? []).length >= 2);

assert.equal(VERIFIED_INFRASTRUCTURE_SOURCE_CONTROL_IDS.length, 4);
for (const requirementId of VERIFIED_INFRASTRUCTURE_SOURCE_CONTROL_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    INFRASTRUCTURE_SOURCE_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "Infrastructure source controls passed: secretless PR CI, distinct keyless identities, production debug-off and supported Node 24 runtime.",
);
