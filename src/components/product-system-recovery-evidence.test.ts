import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_SYSTEM_RECOVERY_EVIDENCE_FILE,
  PRODUCT_SYSTEM_RECOVERY_FOCUSED_CONTRACT_FILES,
  PRODUCT_SYSTEM_RECOVERY_MASTER_EVIDENCE,
  PRODUCT_SYSTEM_RECOVERY_OPEN_GAPS,
  PRODUCT_SYSTEM_RECOVERY_OPEN_REQUIREMENT_IDS,
  PRODUCT_SYSTEM_RECOVERY_REQUIREMENT_IDS,
  PRODUCT_SYSTEM_RECOVERY_TEST_FILE,
} from "./product-system-recovery-evidence";

const repositoryRoot = path.resolve(__dirname, "../..");
const expectedClosed = [
  "SYSTEM.maintenance",
  "SYSTEM.offline",
  "SYSTEM.billing-failure",
  "SYSTEM.rate-limit",
] as const;
const expectedOpen = [
  "SYSTEM.invitation-expired",
  "SYSTEM.invitation-invalid",
  "SYSTEM.unsupported-browser",
  "SYSTEM.auth-callback-loading",
  "SYSTEM.design-lab",
  "SYSTEM.automated-tests",
  "SYSTEM.specific-recovery",
] as const;
const previousUnresolved = [
  "SYSTEM.invitation-expired",
  "SYSTEM.invitation-invalid",
  "SYSTEM.maintenance",
  "SYSTEM.offline",
  "SYSTEM.unsupported-browser",
  "SYSTEM.auth-callback-loading",
  "SYSTEM.billing-failure",
  "SYSTEM.rate-limit",
  "SYSTEM.design-lab",
  "SYSTEM.automated-tests",
  "SYSTEM.specific-recovery",
] as const;

function source(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function compact(value: string) {
  return value.replace(/\s+/g, " ");
}

function assertIncludes(value: string, expected: string, message: string) {
  assert.ok(value.includes(expected), message);
}

assert.deepEqual([...PRODUCT_SYSTEM_RECOVERY_REQUIREMENT_IDS], expectedClosed);
assert.deepEqual([...PRODUCT_SYSTEM_RECOVERY_OPEN_REQUIREMENT_IDS], expectedOpen);
assert.deepEqual(
  [...PRODUCT_SYSTEM_RECOVERY_REQUIREMENT_IDS, ...PRODUCT_SYSTEM_RECOVERY_OPEN_REQUIREMENT_IDS].sort(),
  [...previousUnresolved].sort(),
  "The wave must partition all eleven previously unresolved SYSTEM requirements exactly",
);
assert.deepEqual(Object.keys(PRODUCT_SYSTEM_RECOVERY_MASTER_EVIDENCE), expectedClosed);
assert.deepEqual(Object.keys(PRODUCT_SYSTEM_RECOVERY_OPEN_GAPS), expectedOpen);

const masterIds = new Set(PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id));
for (const requirementId of previousUnresolved) {
  assert.ok(masterIds.has(requirementId), `${requirementId} must remain in the master prompt`);
}

const prohibitedEvidence = [
  "src/components/screen-contracts/community-user-stories.test.ts",
  "src/components/product-source-audit-evidence.test.ts",
  "src/components/product-route-master-evidence.test.ts",
  "scripts/audit-demo-routes.test.ts",
];
for (const requirementId of expectedClosed) {
  const record = PRODUCT_SYSTEM_RECOVERY_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.ok(record.evidence.includes(PRODUCT_SYSTEM_RECOVERY_EVIDENCE_FILE));
  assert.ok(record.evidence.includes(PRODUCT_SYSTEM_RECOVERY_TEST_FILE));
  for (const evidencePath of record.evidence) {
    assert.ok(existsSync(path.join(repositoryRoot, evidencePath)), evidencePath);
    assert.ok(!prohibitedEvidence.includes(evidencePath), `${evidencePath} is not focused proof`);
  }
}
for (const requirementId of expectedOpen) {
  assert.equal(
    (PRODUCT_SYSTEM_RECOVERY_MASTER_EVIDENCE as Readonly<Record<string, unknown>>)[
      requirementId
    ],
    undefined,
  );
  assert.ok(
    PRODUCT_SYSTEM_RECOVERY_OPEN_GAPS[requirementId].length >= 180,
    `${requirementId} needs a precise residual explanation`,
  );
}
for (const contractPath of PRODUCT_SYSTEM_RECOVERY_FOCUSED_CONTRACT_FILES) {
  assert.ok(existsSync(path.join(repositoryRoot, contractPath)), contractPath);
}

const proxy = source("src/proxy.ts");
const maintenance = source("src/lib/maintenance-mode.ts");
const envExample = source(".env.example");
const maintenanceIndex = proxy.indexOf("process.env.MAINTENANCE_MODE");
assert.ok(maintenanceIndex > proxy.indexOf("isCrossOriginBrowserMutation("));
assert.ok(maintenanceIndex < proxy.indexOf("authkitProxy({"));
assertIncludes(proxy, "!isMaintenanceBypassPath(request.nextUrl.pathname)", "Recovery paths need a bypass");
assertIncludes(proxy, "maintenanceModeResponse(request)", "The proxy must return the maintenance experience");
assertIncludes(maintenance, 'status: 503', "Maintenance must be an unavailable response");
assertIncludes(maintenance, '"Retry-After"', "Maintenance must tell clients when to retry");
assertIncludes(maintenance, "GreyhoundIQ will be back shortly.", "Browser maintenance needs usable copy");
assertIncludes(maintenance, 'code: "service.maintenance"', "API maintenance needs a stable code");
assertIncludes(envExample, 'MAINTENANCE_MODE="false"', "Operators need the control documented");

const layout = source("src/app/layout.tsx");
const networkBanner = source("src/components/network-recovery-banner.tsx");
assertIncludes(layout, "<NetworkRecoveryBanner />", "The recovery banner must be globally mounted");
assertIncludes(networkBanner, 'window.addEventListener("offline", sync)', "Offline transitions must be observed");
assertIncludes(networkBanner, 'window.addEventListener("online", sync)', "Restoration must be observed");
assertIncludes(networkBanner, "Previously loaded information may be stale", "Offline data limits must be explicit");
assertIncludes(networkBanner, "Refresh live data", "Restoration needs an explicit refresh action");

for (const routePath of [
  "src/app/api/billing/checkout/route.ts",
  "src/app/api/billing/portal/route.ts",
  "src/app/api/billing/bespoke/checkout/route.ts",
]) {
  const route = compact(source(routePath));
  assertIncludes(route, "if (prefersHtmlRateLimitRecovery(request))", `${routePath} needs browser 429 recovery`);
  assertIncludes(route, "buildBillingRateLimitUrl({", `${routePath} needs a fixed same-origin rate-limit return`);
  assertIncludes(route, "return rateLimitExceededResponse(", `${routePath} must preserve JSON API 429 behavior`);
  assertIncludes(route, "await logRequestError(", `${routePath} must log provider failure safely`);
  assertIncludes(route, "if (prefersHtmlFormNavigation(request))", `${routePath} needs browser provider-failure recovery`);
  assertIncludes(route, "buildBillingFailureUrl({", `${routePath} needs a fixed same-origin failure return`);
}

const pricing = source("src/app/pricing/page.tsx");
const accountBilling = source("src/app/account/billing/page.tsx");
const accountPages = source("src/app/account/pages/page.tsx");
const rateLimitCard = source("src/components/rate-limit-recovery-card.tsx");
assertIncludes(pricing, 'checkout === "failed"', "Pricing needs checkout failure recovery");
assertIncludes(pricing, 'checkout === "rate-limited"', "Pricing needs checkout rate-limit recovery");
assertIncludes(pricing, "No payment was taken and your current plan is unchanged", "Pricing must state the outcome");
assertIncludes(accountBilling, 'billing === "failed"', "Billing needs portal failure recovery");
assertIncludes(accountBilling, 'billing === "rate-limited"', "Billing needs portal rate-limit recovery");
assertIncludes(accountBilling, 'action="/api/billing/portal"', "Billing recovery must retry the intended route");
assertIncludes(accountPages, 'bespokeOutcome === "failed"', "Bespoke billing needs failure recovery");
assertIncludes(accountPages, 'bespokeOutcome === "rate-limited"', "Bespoke billing needs rate-limit recovery");
assertIncludes(accountPages, 'href="#bespoke-design"', "Bespoke recovery must return to its checkout");
assertIncludes(rateLimitCard, "Try again in {remaining}", "Rate limiting needs visible wait guidance");
assertIncludes(rateLimitCard, "{action}", "Rate limiting needs a post-wait recovery action");

assert.ok(!existsSync(path.join(repositoryRoot, "src/app/callback/page.tsx")));
assert.ok(!existsSync(path.join(repositoryRoot, "src/app/callback/loading.tsx")));
assertIncludes(
  source("src/app/admin/invitations/page.tsx"),
  "Read-only GreyhoundIQ organization invitation overview.",
  "Invitation evidence remains administrative rather than recipient-facing",
);

console.log("Product system recovery evidence passed (4 closures, exact 7-item residual partition).");
