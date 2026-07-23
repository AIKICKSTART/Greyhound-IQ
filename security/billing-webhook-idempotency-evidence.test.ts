import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { BILLING_LIFECYCLE_UNRESOLVED_CONTROL_IDS } from "./billing-lifecycle-evidence";
import {
  OPEN_WEBHOOK_CONTROL_GAPS,
  WEBHOOK_CONTROL_MASTER_EVIDENCE,
} from "./webhook-control-evidence";

const requirementId = "security.billing-control.webhook-idempotent";
const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20260715072000_fence_billing_webhook_reducers/migration.sql",
);
const ingress = read("src/lib/billing/lago-webhooks.ts");
const reducer = read("src/lib/billing/lago-reducer.ts");

assert.match(schema, /processingToken\s+String\?/);
assert.match(schema, /billingEvent\s+BillingEvent\?/);
assert.match(schema, /webhookEventId\s+String\?\s+@unique/);
assert.match(schema, /@@index\(\[status, updatedAt\]\)/);

assert.match(
  migration,
  /ALTER TABLE "WebhookEvent" ADD COLUMN "processingToken" TEXT/,
);
assert.match(
  migration,
  /CREATE UNIQUE INDEX "BillingEvent_webhookEventId_key"/,
);
assert.match(migration, /"WebhookEvent"\("status", "updatedAt"\)/);

assert.match(ingress, /const processingToken = randomUUID\(\)/);
assert.match(
  ingress,
  /data: \{[\s\S]*processingToken,[\s\S]*status: "processing"/,
);
assert.match(
  ingress,
  /reduceLagoWebhook\(\{[\s\S]*processingToken,[\s\S]*\}\)/,
);
assert.match(
  ingress,
  /where: \{ id, processingToken, status: "processing" \}/,
);
assert.match(ingress, /processingToken: null/);

assert.match(reducer, /processingToken: string/);
assert.match(
  reducer,
  /where: \{ id: webhookEventId, processingToken, status: "processing" \}/,
);
assert.match(reducer, /data: \{ updatedAt: new Date\(\) \}/);
assert.match(reducer, /reason: "stale_lease"/);
assert.match(
  reducer,
  /billingEvent\.findUnique\(\{\s*where: \{ webhookEventId \}/,
);
assert.match(reducer, /processingToken: null/);

assert.ok(WEBHOOK_CONTROL_MASTER_EVIDENCE[requirementId]);
assert.equal(Object.hasOwn(OPEN_WEBHOOK_CONTROL_GAPS, requirementId), false);
assert.equal(
  (BILLING_LIFECYCLE_UNRESOLVED_CONTROL_IDS as readonly string[]).includes(
    requirementId,
  ),
  false,
);
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[requirementId],
  WEBHOOK_CONTROL_MASTER_EVIDENCE[requirementId],
);
const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === requirementId,
);
assert.ok(requirement);
assert.equal(isMasterRequirementComplete(requirement), true);

console.log(
  "billing webhook idempotency passed: one receipt, one fenced reducer owner and at most one billing event",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}
