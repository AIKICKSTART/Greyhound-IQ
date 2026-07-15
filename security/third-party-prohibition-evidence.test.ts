import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { THIRD_PARTIES } from "./third-parties";
import {
  THIRD_PARTY_PERMISSION_BINDINGS,
  THIRD_PARTY_PROHIBITION_MASTER_EVIDENCE,
  THIRD_PARTY_RETRY_BINDINGS,
} from "./third-party-prohibition-evidence";

for (const binding of [
  ...THIRD_PARTY_RETRY_BINDINGS,
  ...THIRD_PARTY_PERMISSION_BINDINGS,
]) {
  const source = readFile(binding.sourceFile);
  for (const marker of binding.requiredMarkers) {
    assert.ok(
      source.includes(marker),
      `${binding.surface}: required marker drifted: ${marker}`,
    );
  }
}

assert.equal(
  THIRD_PARTIES.every(({ retryPolicy }) => retryPolicy.trim().length > 0),
  true,
  "every registered provider must declare its retry posture",
);

const stripeService = readFile("src/lib/billing/stripe-service.ts");
assert.equal(
  (stripeService.match(/\.create\(/g) ?? []).length,
  4,
  "every current Stripe create call is covered by the four explicit idempotency bindings",
);
assert.equal(
  (stripeService.match(/stripeMutationOptions\(/g) ?? []).length,
  4,
  "three call sites plus the helper definition must remain explicit",
);
assert.match(stripeService, /createHash\("sha256"\)[\s\S]*\.slice\(0, 24\)/);

const notificationService = readFile("src/lib/notification-service.ts");
assert.match(notificationService, /deliveryAttempts: \{ lt: maxAttempts \}/);
assert.match(notificationService, /deliveryAttempts: \{ increment: 1 \}/);

const topaz = readFile("src/lib/live/topaz.ts");
const topazGet = sourceBetween(
  topaz,
  "async get<T>",
  "\n}\n\nexport function mapMeeting",
);
assert.match(topazGet, /response\.status === 429/);
assert.match(topazGet, /response\.status >= 500/);
assert.doesNotMatch(topazGet, /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/i);

const stripeWebhooks = readFile("src/lib/billing/stripe-webhooks.ts");
const invoiceEntitlement = sourceBetween(
  stripeWebhooks,
  "export function stripeInvoicePaidEntitlement",
  "\nfunction invoiceLineSubscriptionId",
);
assert.match(invoiceEntitlement, /const plan = planForStripePriceId\(priceId\)/);
assert.doesNotMatch(invoiceEntitlement, /parseBillingPlan\(metadata\?\.plan\)/);
assert.match(
  stripeWebhooks,
  /if \(metadataUserId && metadataUserId !== byCustomer\.id\)/,
);

const authorizationSources = [
  "src/lib/auth.ts",
  "src/lib/auth-sync.ts",
  "src/lib/billing/stripe-webhooks.ts",
  "src/lib/call-service.ts",
].map(readFile).join("\n");
assert.doesNotMatch(
  authorizationSources,
  /metadata\??\.(?:admin|isAdmin|permission|permissions|profileRole|role|subscriptionTier|tier)\b/i,
  "provider metadata must not be read as a local authority field",
);

const expectedIds = Object.keys(THIRD_PARTY_PROHIBITION_MASTER_EVIDENCE);
assert.deepEqual(expectedIds.toSorted(), [
  "security.third-party-prohibition.metadata-permission",
  "security.third-party-prohibition.non-idempotent-retry",
]);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    THIRD_PARTY_PROHIBITION_MASTER_EVIDENCE[
      requirementId as keyof typeof THIRD_PARTY_PROHIBITION_MASTER_EVIDENCE
    ],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    ({ id }) => id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "Third-party prohibitions passed: mutating retries are idempotency-bound and provider metadata cannot grant local authority",
);

function sourceBetween(
  source: string,
  startMarker: string,
  endMarker: string,
  endOccurrence = 0,
) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  let end = start;
  for (let index = 0; index <= endOccurrence; index += 1) {
    end = source.indexOf(endMarker, end + 1);
    assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  }
  return source.slice(start, end);
}

function readFile(path: string) {
  return readFileSync(path, "utf8");
}
