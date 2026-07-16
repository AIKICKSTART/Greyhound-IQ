import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  DEMO_FIXTURE_VERIFY_CONFIRMATION,
  assertDemoFixtureVerifierTarget,
} from "../scripts/check-demo-route-fixture-idempotency";
import {
  resolveStagingLoadBaseUrl,
  resolveStagingSupabaseUrl,
} from "../scripts/staging-load-policy";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  AUTHORISED_TESTING_BOUNDARY_CONTROLS,
  AUTHORISED_TESTING_BOUNDARY_EVIDENCE_SCOPE,
  AUTHORISED_TESTING_BOUNDARY_MASTER_EVIDENCE,
} from "./authorised-testing-boundary-evidence";
import { BROWSER_PERSISTENCE_ALLOWLIST } from "./browser-data-handling-evidence";
import { findSecurityCiWiringIssues } from "./ci-gate-evidence";
import {
  DESIGN_LAB_LOCAL_DATA_POLICY,
  DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY,
} from "./local-data-policy";

const requirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    requirement.section === "authorised-testing-boundary",
);
assert.equal(requirements.length, 12);
assert.equal(AUTHORISED_TESTING_BOUNDARY_CONTROLS.length, 12);
assert.equal(
  new Set(
    AUTHORISED_TESTING_BOUNDARY_CONTROLS.map(
      (control) => control.requirementId,
    ),
  ).size,
  12,
);
assert.deepEqual(
  AUTHORISED_TESTING_BOUNDARY_CONTROLS.map(
    (control) => control.requirementId,
  ).toSorted(),
  requirements.map((requirement) => requirement.id).toSorted(),
);
assert.match(AUTHORISED_TESTING_BOUNDARY_EVIDENCE_SCOPE, /does not authorize/i);

for (const control of AUTHORISED_TESTING_BOUNDARY_CONTROLS) {
  assert.ok(control.control.trim());
  assert.ok(control.enforcement.trim());
  assert.ok(control.residualBoundary.trim());
  for (const evidencePath of control.evidence) {
    assert.ok(existsSync(evidencePath), `${control.requirementId}: ${evidencePath}`);
  }
  const requirement = requirements.find(
    (candidate) => candidate.id === control.requirementId,
  );
  assert.ok(requirement, `${control.requirementId}: immutable requirement missing`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[control.requirementId],
    AUTHORISED_TESTING_BOUNDARY_MASTER_EVIDENCE[control.requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

for (const target of [
  "https://greyhoundsiq.com.au",
  "https://www.greyhoundsiq.com.au",
  "https://greyhoundiq-web-prod-5wsnl4feuq-ts.a.run.app",
  "https://example.com",
]) {
  assert.throws(() => resolveStagingLoadBaseUrl(target));
}
assert.equal(
  resolveStagingLoadBaseUrl("https://staging.greyhoundsiq.com.au"),
  "https://staging.greyhoundsiq.com.au",
);
assert.throws(() =>
  resolveStagingSupabaseUrl(
    "https://production-project.supabase.co",
    "staging-project.supabase.co",
  ),
);

const disposableUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertDemoFixtureVerifierTarget(
    disposableUrl,
    DEMO_FIXTURE_VERIFY_CONFIRMATION,
  ).toString(),
  disposableUrl,
);
for (const target of [
  "postgresql://greyhoundiq_runtime@db.example.com:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@127.0.0.1:5432/greyhoundiq",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/production",
  "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
]) {
  assert.throws(() =>
    assertDemoFixtureVerifierTarget(target, DEMO_FIXTURE_VERIFY_CONFIRMATION),
  );
}
assert.throws(() => assertDemoFixtureVerifierTarget(disposableUrl, undefined));

assert.equal(DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.totalModels, 107);
assert.equal(
  DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.productionDatabaseCopyAllowed,
  0,
);
for (const policy of Object.values(DESIGN_LAB_LOCAL_DATA_POLICY)) {
  assert.equal(policy.productionDatabaseCopy, "DENY");
  if (policy.localSource === "SYNTHETIC_ONLY") {
    assert.match(
      policy.relationStrategy,
      /demo-\*[\s\S]*\.test[\s\S]*never copy/i,
    );
  }
}

assert.deepEqual(
  BROWSER_PERSISTENCE_ALLOWLIST.map(({ key }) => key).toSorted(),
  [
    "ghiq-demo-completed | ghiq-demo-activities | ghiq-demo-owner-sent | ghiq-demo-nominated",
    "greyhoundiq.cookie-consent.v1",
    "greyhoundiq.cookie-consent.v1",
    "greyhoundiq.interactive-help.v1",
  ],
);
for (const entry of BROWSER_PERSISTENCE_ALLOWLIST) {
  assert.doesNotMatch(`${entry.key} ${entry.value}`, /token|session|password|secret/i);
}

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const unitRunner = readFileSync("scripts/run-unit-tests.ts", "utf8");
assert.deepEqual(
  findSecurityCiWiringIssues({ workflow, packageJson, unitRunner }),
  [],
);

const lagoReplay = readFileSync("scripts/lago-webhook-replay.ts", "utf8");
assert.match(lagoReplay, /This inspector requires --dry-run/);
assert.match(lagoReplay, /dbMutations: none/);
assert.match(lagoReplay, /lagoCalls: none/);
assert.doesNotMatch(
  lagoReplay,
  /prisma\.[A-Za-z]+\.(?:create|createMany|delete|deleteMany|update|updateMany|upsert)\s*\(/,
);

const ownedTooling = collectFiles("scripts")
  .filter((file) => /\.(?:cjs|js|mjs|ps1|sh|ts)$/.test(file))
  .filter((file) => !/\.test\.ts$/.test(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
assert.doesNotMatch(
  ownedTooling,
  /\b(?:hydra|medusa|sqlmap|ffuf)\b|passwords?\.txt|credential[-_ ]stuffing/i,
);
assert.doesNotMatch(
  ownedTooling,
  /LOAD_ALLOW_PRODUCTION|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0|rejectUnauthorized\s*:\s*false|DISABLE_(?:AUTH|TLS)/,
);
assert.doesNotMatch(ownedTooling, /EICAR-STANDARD-ANTIVIRUS-TEST-FILE/i);

console.log(
  "authorised testing boundary passed: 12/12 repository controls; production load, destructive DB targets, live replay, private fixtures and bypass switches fail closed",
);

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(target) : [target];
  });
}
