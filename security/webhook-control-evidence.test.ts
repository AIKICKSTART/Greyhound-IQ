import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  OPEN_WEBHOOK_CONTROL_GAPS,
  WEBHOOK_CONTROL_MASTER_EVIDENCE,
} from "./webhook-control-evidence";

const webhookRoutes = collectRouteFiles("src/app/api")
  .filter((path) => {
    const source = read(path);
    return /ingest(?:Stripe|Lago)Webhook|receiveLiveKitWebhook/.test(source);
  })
  .toSorted();
assert.deepEqual(webhookRoutes, [
  "src/app/api/livekit/webhook/route.ts",
  "src/app/api/webhooks/lago/route.ts",
  "src/app/api/webhooks/stripe/route.ts",
]);

const stripeRoute = read("src/app/api/webhooks/stripe/route.ts");
const lagoRoute = read("src/app/api/webhooks/lago/route.ts");
const liveKitRoute = read("src/app/api/livekit/webhook/route.ts");
assert.match(
  stripeRoute,
  /Buffer\.from\(await readBoundedWebhookBody\(request\)\)/,
);
assert.match(
  lagoRoute,
  /Buffer\.from\(await readBoundedWebhookBody\(request\)\)/,
);
assert.match(
  liveKitRoute,
  /const body = await readBoundedWebhookText\(request\)/,
);
assert.match(
  stripeRoute + lagoRoute + liveKitRoute,
  /webhookBodyErrorResponse\(err\)/,
);
assert.match(liveKitRoute, /message: "Invalid webhook signature"/);
assert.doesNotMatch(stripeRoute + lagoRoute + liveKitRoute, /console\./);

const stripeWebhook = read("src/lib/billing/stripe-webhooks.ts");
assert.match(
  stripeWebhook,
  /class StripeWebhookDuplicateDelivery extends Error/,
);
assert.match(
  stripeWebhook,
  /catch \(err\)[\s\S]*isUniqueConstraintError\(err\)[\s\S]*throw new StripeWebhookDuplicateDelivery\(\)/,
);
assert.match(stripeWebhook, /status: \{ notIn: \["ignored", "processed"\] \}/);
assert.match(stripeWebhook, /status: "failed"/);
assert.match(stripeWebhook, /function stripeWebhookAuditPayload/);
const auditPayloadBlock = stripeWebhook.match(
  /function stripeWebhookAuditPayload[\s\S]*?\n}/,
)?.[0];
assert.ok(auditPayloadBlock);
assert.doesNotMatch(auditPayloadBlock, /data|customer|metadata|object/);
assert.match(stripeWebhook, /assertCheckoutSessionUserBinding/);
assert.match(stripeWebhook, /stripe\.webhook_customer_mismatch/);
assert.match(stripeWebhook, /stripe\.webhook_workos_user_mismatch/);
assert.match(stripeWebhook, /stripe\.webhook_profile_mismatch/);
assert.match(stripeWebhook, /case "invoice\.paid"/);
assert.match(stripeWebhook, /invoice\.status !== "paid"/);
assert.match(stripeWebhook, /subscriptionTier: grant\.plan/);
assert.doesNotMatch(
  stripeWebhook.match(
    /stripeUserBillingUpdateForCheckoutSession[\s\S]*?\n}/,
  )?.[0] ?? "",
  /subscriptionTier/,
);

const lagoWebhook = read("src/lib/billing/lago-webhooks.ts");
assert.match(lagoWebhook, /timingSafeEqual\(receivedBuffer, expectedBuffer\)/);
assert.match(lagoWebhook, /provider: "lago"/);
assert.match(lagoWebhook, /provider_payloadHash/);
assert.match(lagoWebhook, /LAGO_PROCESSING_LEASE_MS = 10 \* 60 \* 1000/);
assert.match(lagoWebhook, /status: \{ in: \["failed", "received"\] \}/);
assert.match(
  lagoWebhook,
  /status: "processing", updatedAt: \{ lt: leaseExpiredBefore \}/,
);
assert.match(lagoWebhook, /const processingToken = randomUUID\(\)/);
assert.match(lagoWebhook, /processingToken,/);
assert.match(
  lagoWebhook,
  /await markLagoWebhookFailed\(event\.id, processingToken, err\)/,
);
assert.match(lagoWebhook, /await reduceLagoWebhook\(/);
const lagoSafeHeaders = lagoWebhook.match(
  /function safeHeaders[\s\S]*?\n}/,
)?.[0];
assert.ok(lagoSafeHeaders);
assert.doesNotMatch(lagoSafeHeaders, /LAGO_SIGNATURE_HEADER/);

const bundledLagoWebhook = read("external/lago/api/app/models/webhook.rb");
const bundledLagoHeaders = bundledLagoWebhook.match(
  /def generate_headers[\s\S]*?^  end/m,
)?.[0];
assert.ok(bundledLagoHeaders);
assert.match(bundledLagoHeaders, /X-Lago-Signature/);
assert.match(bundledLagoHeaders, /X-Lago-Unique-Key/);
assert.doesNotMatch(bundledLagoHeaders, /timestamp|created_at|sent_at/i);

const liveKitAdmin = read("src/lib/livekit-admin.ts");
assert.match(
  liveKitAdmin,
  /new WebhookReceiver\(config\.apiKey, config\.apiSecret\)/,
);
assert.match(
  liveKitAdmin,
  /receiver\.receive\(body, authHeader \?\? undefined\)/,
);
const liveKitHandler = read("src/lib/call-service.ts");
assert.match(liveKitHandler, /where: \{ id: room\.id, status: "active" \}/);
assert.match(liveKitHandler, /joinedAt: null/);
assert.match(liveKitHandler, /leftAt: null/);

const logger = read("src/lib/logger.ts");
assert.match(logger, /"signature"/);
assert.match(logger, /"webhookpayload"/);
assert.match(logger, /"rawproviderpayload"/);

const verifiedIds = Object.keys(WEBHOOK_CONTROL_MASTER_EVIDENCE);
assert.equal(verifiedIds.length, 11);
for (const requirementId of verifiedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    WEBHOOK_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

for (const [requirementId, gap] of Object.entries(OPEN_WEBHOOK_CONTROL_GAPS)) {
  assert.ok(gap.length > 40, `${requirementId}: gap must be explicit`);
  assert.equal(WEBHOOK_CONTROL_MASTER_EVIDENCE[requirementId], undefined);
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), false);
}

console.log(
  "Webhook evidence passed: 11 provider and billing gates verified; 12 explicit cross-provider gaps remain open",
);

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return collectRouteFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

function read(path: string) {
  return readFileSync(path, "utf8");
}
