import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { DESIGN_LAB_LOCAL_DATA_POLICY } from "../../security/local-data-policy";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import {
  PRODUCT_GLOBAL_SECURITY_INVARIANT_EVIDENCE_FILE,
  PRODUCT_GLOBAL_SECURITY_INVARIANT_EVIDENCE_SCOPE,
  PRODUCT_GLOBAL_SECURITY_INVARIANT_EXPECTED_GAIN,
  PRODUCT_GLOBAL_SECURITY_INVARIANT_MASTER_EVIDENCE,
  PRODUCT_GLOBAL_SECURITY_INVARIANT_OPEN_GAPS,
  PRODUCT_GLOBAL_SECURITY_INVARIANT_OPEN_REQUIREMENT_IDS,
  PRODUCT_GLOBAL_SECURITY_INVARIANT_REQUIREMENT_IDS,
  PRODUCT_GLOBAL_SECURITY_INVARIANT_TEST_FILE,
} from "./product-global-security-invariant-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { resolveWorkosReturnTo } from "../lib/workos-redirect";

const completedIds = [...PRODUCT_GLOBAL_SECURITY_INVARIANT_REQUIREMENT_IDS];
const intentionallyOpenIds = [
  ...PRODUCT_GLOBAL_SECURITY_INVARIANT_OPEN_REQUIREMENT_IDS,
];

assert.equal(completedIds.length, 4);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.equal(intentionallyOpenIds.length, 6);
assert.equal(PRODUCT_GLOBAL_SECURITY_INVARIANT_EXPECTED_GAIN, 4);
assert.deepEqual(
  Object.keys(PRODUCT_GLOBAL_SECURITY_INVARIANT_MASTER_EVIDENCE),
  completedIds,
);

const globalSecurityRequirements = PRODUCT_MASTER_REQUIREMENTS.filter(
  ({ id }) => id.startsWith("GLOBAL.SEC."),
);
assert.equal(globalSecurityRequirements.length, 11);
const preExistingCompletedIds = ["GLOBAL.SEC.thread-metadata"] as const;
assert.deepEqual(
  [...completedIds, ...intentionallyOpenIds, ...preExistingCompletedIds].toSorted(),
  globalSecurityRequirements.map(({ id }) => id).toSorted(),
  "The new invariants, explicit residuals and prior thread-metadata proof must partition GLOBAL.SEC",
);

for (const requirementId of completedIds) {
  const record = PRODUCT_GLOBAL_SECURITY_INVARIANT_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", requirementId);
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_GLOBAL_SECURITY_INVARIANT_EVIDENCE_FILE,
    PRODUCT_GLOBAL_SECURITY_INVARIANT_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  const centralRecord = PRODUCT_MASTER_EVIDENCE[requirementId];
  assert.ok(centralRecord, requirementId);
  assert.ok(
    centralRecord.status === record.status || centralRecord.status === "verified",
    `${requirementId}: central evidence must retain or strengthen the bounded status`,
  );
  for (const supportingPath of record.evidence.slice(2)) {
    assert.ok(
      centralRecord.evidence.includes(supportingPath),
      `${requirementId}: central evidence lost ${supportingPath}`,
    );
  }
}

for (const requirementId of intentionallyOpenIds) {
  assert.equal(
    requirementId in PRODUCT_GLOBAL_SECURITY_INVARIANT_MASTER_EVIDENCE,
    false,
    `${requirementId} must remain open`,
  );
  assert.ok(
    PRODUCT_GLOBAL_SECURITY_INVARIANT_OPEN_GAPS[requirementId].length > 160,
    `${requirementId} needs a precise residual-gap explanation`,
  );
}
assert.match(PRODUCT_GLOBAL_SECURITY_INVARIANT_OPEN_GAPS["GLOBAL.SEC.signed-out"], /does not yet cover every protected payload/i);
assert.match(PRODUCT_GLOBAL_SECURITY_INVARIANT_OPEN_GAPS["GLOBAL.SEC.client-secrets"], /production client bundles.*not been rebuilt and scanned/i);

const evidenceSource = readFileSync(
  PRODUCT_GLOBAL_SECURITY_INVARIANT_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_GLOBAL_SECURITY_INVARIANT_EVIDENCE_SCOPE, /Deterministic source and focused-unit/i);
assert.match(PRODUCT_GLOBAL_SECURITY_INVARIANT_EVIDENCE_SCOPE, /does not prove deployed identity-provider behavior/i);
assert.match(PRODUCT_GLOBAL_SECURITY_INVARIANT_EVIDENCE_SCOPE, /production readiness/i);

for (const returnTo of [
  "https://attacker.example/account",
  "//attacker.example/account",
  "/sign-in?returnTo=/account",
  "/callback?code=fake",
  "/\\attacker.example/account",
  "/%2f%2fattacker.example/account",
]) {
  assert.equal(resolveWorkosReturnTo({ returnTo }), "/feed", returnTo);
}
assert.equal(
  resolveWorkosReturnTo({ returnTo: "/account/profile?tab=media" }),
  "/account/profile?tab=media",
);
const signInSource = readFileSync("src/app/sign-in/route.ts", "utf8");
const callbackSource = readFileSync("src/app/callback/route.ts", "utf8");
assert.match(signInSource, /resolveWorkosReturnTo/);
assert.match(signInSource, /resolveWorkosRedirectUri/);
assert.doesNotMatch(callbackSource, /searchParams\.get\("returnTo"\)/);

const pricingSource = readFileSync("src/app/pricing/page.tsx", "utf8");
const stripeWebhookSource = readFileSync(
  "src/lib/billing/stripe-webhooks.ts",
  "utf8",
);
assert.match(pricingSource, /We are verifying the signed Stripe webhook/);
assert.match(pricingSource, /tier only changes\s+after that trusted confirmation/);
assert.doesNotMatch(
  pricingSource,
  /\bsubscriptionTier\b|\bdb\.user\.update\b|\bprisma\b/,
);
assert.match(stripeWebhookSource, /webhooks\.constructEvent/);
assert.match(stripeWebhookSource, /case "invoice\.paid"/);
assert.match(stripeWebhookSource, /subscriptionTier: grant\.plan/);

const apiErrorsSource = readFileSync("src/lib/api-errors.ts", "utf8");
const authErrorSource = readFileSync("src/app/auth/error/page.tsx", "utf8");
assert.match(callbackSource, /const referenceId = crypto\.randomUUID\(\)/);
assert.match(callbackSource, /recoveryUrl\.searchParams\.set\("ref", referenceId\)/);
assert.match(authErrorSource, /parseAuthCallbackReference/);
assert.match(apiErrorsSource, /const requestId = requestCorrelation\.requestId \?\? createRequestId\(\)/);
assert.match(apiErrorsSource, /response\.headers\.set\(REQUEST_ID_HEADER, requestId\)/);
assert.match(apiErrorsSource, /message: status >= 500 \? fallback : message/);

const schemaSource = readFileSync("prisma/schema.prisma", "utf8");
const schemaModels = [...schemaSource.matchAll(/^model\s+(\w+)\s*\{/gm)].map(
  (match) => match[1],
);
const policyModels = Object.keys(DESIGN_LAB_LOCAL_DATA_POLICY);
assert.equal(schemaModels.length, 114);
assert.deepEqual(policyModels.toSorted(), schemaModels.toSorted());
for (const policy of Object.values(DESIGN_LAB_LOCAL_DATA_POLICY)) {
  assert.equal(policy.productionDatabaseCopy, "DENY", policy.model);
  assert.ok(policy.classificationIds.length > 0, policy.model);
  assert.ok(policy.relationStrategy.trim(), policy.model);
}
const localDatabaseSource = readFileSync("scripts/local-database.ts", "utf8");
const fixtureLoaderSource = readFileSync(
  "scripts/seed-demo-route-fixtures.ts",
  "utf8",
);
const fixtureEntry = fixtureLoaderSource.slice(
  fixtureLoaderSource.indexOf("export async function seedDemoRouteFixtures()"),
  fixtureLoaderSource.indexOf("async function ensureDemoFixtureIntegrity"),
);
assert.ok(
  localDatabaseSource.indexOf("assertLocalDatabaseUrl(LOCAL_DATABASE_URL)") <
    localDatabaseSource.indexOf("switch (command as Command"),
  "The local target guard must precede loader dispatch",
);
assert.ok(
  fixtureEntry.indexOf("assertDemoTarget()") >= 0 &&
    fixtureEntry.indexOf("assertDemoTarget()") <
      fixtureEntry.indexOf("withDbSystemContext"),
  "The fixture target guard must precede its write context",
);
for (const source of [localDatabaseSource, fixtureLoaderSource]) {
  assert.doesNotMatch(
    source,
    /PRODUCTION_DATABASE_URL|PRODUCTION_DIRECT_URL|PRODUCTION_SUPABASE_DATABASE_URL/,
  );
}

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_GLOBAL_SECURITY_INVARIANT_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly four completed requirements",
);

console.log(
  "Product global security invariants passed: 4 bounded source/unit gates; 6 exhaustive gaps remain open.",
);
