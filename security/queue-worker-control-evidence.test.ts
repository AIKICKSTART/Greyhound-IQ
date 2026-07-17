import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  BACKGROUND_WORKER_MEMBERS,
  QUEUE_CONSUMER_MEMBERS,
  QUEUE_MODEL_DISPOSITIONS,
  QUEUE_PUBLISHER_MEMBERS,
  discoverQueueModels,
} from "./source-surface-inventory";
import {
  QUEUE_WORKER_CONTROL_MASTER_EVIDENCE,
  QUEUE_WORK_SOURCE_DISPOSITIONS,
} from "./queue-worker-control-evidence";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const modelNames = discoverQueueModels();

assert.deepEqual(
  QUEUE_WORK_SOURCE_DISPOSITIONS.map(({ model }) => model).toSorted(),
  modelNames,
  "every durable queue/inbox model needs an explicit source disposition",
);
assert.deepEqual(
  QUEUE_MODEL_DISPOSITIONS.filter(({ consumerGap }) => consumerGap).map(
    ({ model }) => model,
  ),
  ["SignupOutbox"],
  "the concrete signup side-effect handler and production invoker remain explicit gaps",
);
assert.equal(QUEUE_PUBLISHER_MEMBERS.length, 10);
assert.equal(QUEUE_CONSUMER_MEMBERS.length, 6);
assert.equal(BACKGROUND_WORKER_MEMBERS.length, 17);

for (const disposition of QUEUE_WORK_SOURCE_DISPOSITIONS) {
  const block = prismaModelBlock(schema, disposition.model);
  for (const field of disposition.payloadFields) {
    assert.match(
      block,
      new RegExp(`^\\s*${field}\\s+`, "m"),
      `${disposition.model}: ${field} is missing from the durable envelope`,
    );
  }
  for (const sourceFile of disposition.sourceFiles) {
    assert.ok(readFileSync(sourceFile, "utf8").length > 0, sourceFile);
  }
}

const account = readFileSync("src/lib/account-service.ts", "utf8");
assert.match(account, /function parseAccountStorageDeletionJob\(/);
assert.match(account, /data: \{ status: "failed", completedAt: null \}/);
assert.match(account, /take: STORAGE_DELETION_JOB_LIMIT/);
assert.match(account, /paths\.slice\(0, STORAGE_DELETION_OBJECT_LIMIT\)/);

const notifications = readFileSync("src/lib/notification-service.ts", "utf8");
assert.match(notifications, /deliveryAttempts: \{ lt: maxAttempts \}/);
assert.match(notifications, /take: NOTIFICATION_DELIVERY_LIMIT/);
assert.match(
  notifications,
  /value <= NOTIFICATION_DELIVERY_MAX_ATTEMPTS_LIMIT/,
);
assert.match(notifications, /deliveryAttempts: \{ increment: 1 \}/g);

const signupWorker = readFileSync(
  "src/lib/signup-acceptance-worker.ts",
  "utf8",
);
assert.match(signupWorker, /const MAX_BATCH_SIZE = 25/);
assert.match(signupWorker, /limit: 1,/);
assert.match(signupWorker, /signup\.claim_idempotency_invalid/);
assert.match(signupWorker, /false,/);
assert.match(signupWorker, /disposition === "dead-letter"/);

const callWorker = readFileSync("src/lib/call-service.ts", "utf8");
assert.equal(
  [...callWorker.matchAll(/take: CALL_MAINTENANCE_LIMIT/g)].length,
  2,
  "both call-maintenance scans must be capped",
);
const dogWinWorker = readFileSync("src/lib/dog-win-notify.ts", "utf8");
assert.match(dogWinWorker, /take: WIN_NOTIFY_BATCH/);
assert.match(dogWinWorker, /created >= WIN_NOTIFY_BATCH/);
const mediaWorker = readFileSync("src/lib/media-service.ts", "utf8");
assert.match(mediaWorker, /take: MEDIA_MAINTENANCE_LIMIT/);
assert.match(mediaWorker, /take: MEDIA_PROCESSING_LIMIT/);

const usageWorker = readFileSync(
  "src/lib/billing/usage-delivery-worker.ts",
  "utf8",
);
assert.match(usageWorker, /export async function processUsageDeliveryBatch/);
assert.match(usageWorker, /assertUsageDeliveryClaim\(claim\)/);
assert.match(usageWorker, /DEFAULT_CONCURRENCY = 5/);
assert.match(usageWorker, /MAX_CONCURRENCY = 10/);
assert.match(usageWorker, /DEFAULT_MAX_ATTEMPTS = 5/);
assert.match(usageWorker, /usageDeliveryRetryDelayMs/);
assert.match(usageWorker, /stableHash/);
assert.match(usageWorker, /claim\.attempt < maxAttempts/);
assert.match(usageWorker, /UsageDeliveryOutcome = "sent" \| "ignored"/);
assert.match(usageWorker, /billing\.usage_handler_failed/);
assert.doesNotMatch(usageWorker, /error\.message/);

const usageStore = readFileSync(
  "src/lib/billing/usage-delivery-worker-store.ts",
  "utf8",
);
assert.match(usageStore, /FOR UPDATE SKIP LOCKED/g);
assert.match(usageStore, /"leaseToken" = \$\{leaseToken\}/);
assert.match(usageStore, /"leaseToken" = \$\{claim\.leaseToken\}/g);
assert.match(usageStore, /"status" = 'dead_letter'/);
assert.match(usageStore, /"status" = 'processing'/);
assert.match(usageStore, /status: "processed"/);
assert.match(usageStore, /status: retryAt \? "retrying" : "failed"/);
const usagePolicy = readFileSync(
  "src/lib/billing/usage-delivery-policy.ts",
  "utf8",
);
assert.match(usagePolicy, /subscription\.userId !== user\.id/);
assert.match(usagePolicy, /user\.isBanned \|\| user\.deletionRequestedAt/);
assert.match(usagePolicy, /subscription\.status !== "active"/);

const usageDelivery = readFileSync(
  "src/lib/billing/usage-delivery-service.ts",
  "utf8",
);
assert.match(usageDelivery, /transaction_id: claim\.idempotencyKey/);
assert.match(
  usageDelivery,
  /external_subscription_id: target\.externalSubscriptionId/,
);
assert.match(usageDelivery, /properties: \{ quantity: claim\.quantity \}/);
assert.match(usageDelivery, /status === 429 \|\| status >= 500/);

const usageRoute = readFileSync(
  "src/app/api/internal/usage-delivery/route.ts",
  "utf8",
);
assert.ok(
  usageRoute.indexOf("requireInternalRequest(request)") <
    usageRoute.indexOf('executeScheduledTask("usage-delivery"'),
);
assert.match(usageRoute, /execution\.status === "overlap"/);

const usageMigration = readFileSync(
  "prisma/migrations/20260715110000_add_usage_outbox_delivery_lease/migration.sql",
  "utf8",
);
for (const field of [
  "leaseExpiresAt",
  "leaseToken",
  "deadLetteredAt",
  "lastErrorCode",
]) {
  assert.match(usageMigration, new RegExp(`ADD COLUMN "${field}"`));
}
assert.doesNotMatch(usageMigration, /DROP|DELETE|TRUNCATE/i);

const lago = readFileSync("src/lib/billing/lago-reducer.ts", "utf8");
assert.match(lago, /if \(!payload\)[\s\S]{0,180}markWebhookEventIgnored/);
const stripe = readFileSync("src/lib/billing/stripe-webhooks.ts", "utf8");
assert.match(stripe, /verifyStripeWebhook\(headers, rawBody\)/);
assert.match(stripe, /await persistFailedStripeWebhook\(receipt, retryError\)/);
assert.match(stripe, /await persistFailedStripeWebhook\(receipt, err\)/);
assert.match(
  stripe,
  /tx\.webhookEvent\.createMany\(\{[\s\S]*skipDuplicates: true/,
);
assert.match(stripe, /status: \{ notIn: \["ignored", "processed"\] \}/);
assert.match(stripe, /retryCount: \{ increment: 1 \}/);

const expectedIds = Object.keys(QUEUE_WORKER_CONTROL_MASTER_EVIDENCE);
assert.deepEqual(expectedIds, [
  "security.queue-worker-control.schema",
  "security.queue-worker-control.poison",
  "security.queue-worker-control.fan-out",
]);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    QUEUE_WORKER_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

for (const openId of [
  "security.queue-worker-control.validate",
  "security.queue-worker-control.infrastructure-trust",
  "security.queue-worker-control.tenant",
  "security.queue-worker-control.actor",
  "security.queue-worker-control.reauthorize",
  "security.queue-worker-control.permission-change",
  "security.queue-worker-control.retry",
  "security.queue-worker-control.dead-letter",
  "security.queue-worker-control.idempotency",
  "security.queue-worker-control.attempts",
  "security.queue-worker-control.record-outcome",
  "security.queue-worker-control.no-secrets",
] as const) {
  assert.equal(
    QUEUE_WORKER_CONTROL_MASTER_EVIDENCE[openId],
    undefined,
    `${openId}: incomplete coverage must remain open`,
  );
}

console.log(
  `Queue/worker controls passed: ${modelNames.length} durable models, ${QUEUE_CONSUMER_MEMBERS.length} consumers, and ${BACKGROUND_WORKER_MEMBERS.length} background workers source-audited; usage delivery is wired, signup sink/invoker remains open, and 3 controls are verified`,
);

function prismaModelBlock(source: string, model: string) {
  const match = source.match(
    new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m"),
  );
  assert.ok(match, `${model}: Prisma model is missing`);
  return match[1];
}
