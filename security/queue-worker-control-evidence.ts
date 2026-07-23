export type QueueWorkSourceDisposition = Readonly<{
  model: string;
  execution: "active-worker" | "synchronous-inbox" | "unwired-outbox";
  payloadFields: readonly string[];
  sourceFiles: readonly string[];
}>;

export const QUEUE_WORK_SOURCE_DISPOSITIONS: readonly QueueWorkSourceDisposition[] = [
  {
    model: "DeletionJob",
    execution: "active-worker",
    payloadFields: [
      "id",
      "targetType",
      "targetUserId",
      "storageBucket",
      "storagePath",
      "status",
      "scheduledFor",
      "requestedByUserId",
    ],
    sourceFiles: ["src/lib/account-service.ts"],
  },
  {
    model: "Notification",
    execution: "active-worker",
    payloadFields: [
      "id",
      "userId",
      "actorProfileId",
      "actorId",
      "type",
      "title",
      "body",
      "href",
      "targetType",
      "targetId",
      "metadataJson",
      "deliveryStatus",
      "deliveryAttempts",
    ],
    sourceFiles: [
      "src/lib/notification-service.ts",
      "src/lib/call-service.ts",
      "src/lib/dog-win-notify.ts",
      "src/lib/media-service.ts",
    ],
  },
  {
    model: "SignupOutbox",
    execution: "unwired-outbox",
    payloadFields: [
      "id",
      "userId",
      "idempotencyKey",
      "correlationId",
      "status",
      "retryCount",
      "nextRetryAt",
      "leaseExpiresAt",
      "leaseToken",
      "sentAt",
      "deadLetteredAt",
      "lastErrorCode",
    ],
    sourceFiles: [
      "src/lib/signup-acceptance.ts",
      "src/lib/signup-acceptance-worker.ts",
      "src/lib/signup-acceptance-worker-store.ts",
    ],
  },
  {
    model: "UsageEvent",
    execution: "active-worker",
    payloadFields: [
      "id",
      "idempotencyKey",
      "metricKey",
      "userId",
      "billingCustomerId",
      "subscriptionId",
      "quantity",
      "metadataJson",
      "occurredAt",
      "status",
      "retryCount",
      "nextRetryAt",
    ],
    sourceFiles: [
      "src/lib/billing/usage-service.ts",
      "src/lib/billing/usage-delivery-service.ts",
      "src/lib/billing/usage-delivery-policy.ts",
      "src/lib/billing/usage-delivery-worker.ts",
      "src/lib/billing/usage-delivery-worker-store.ts",
    ],
  },
  {
    model: "UsageOutbox",
    execution: "active-worker",
    payloadFields: [
      "id",
      "usageEventId",
      "idempotencyKey",
      "metricKey",
      "userId",
      "billingCustomerId",
      "subscriptionId",
      "quantity",
      "metadataJson",
      "occurredAt",
      "status",
      "retryCount",
      "nextRetryAt",
      "leaseExpiresAt",
      "leaseToken",
      "deadLetteredAt",
      "lastErrorCode",
    ],
    sourceFiles: [
      "src/lib/billing/usage-service.ts",
      "src/lib/billing/usage-delivery-service.ts",
      "src/lib/billing/usage-delivery-policy.ts",
      "src/lib/billing/usage-delivery-worker.ts",
      "src/lib/billing/usage-delivery-worker-store.ts",
    ],
  },
  {
    model: "WebhookEvent",
    execution: "synchronous-inbox",
    payloadFields: [
      "id",
      "provider",
      "lagoEventId",
      "eventType",
      "status",
      "payloadHash",
      "payloadJson",
      "headersJson",
      "retryCount",
      "processedAt",
      "error",
    ],
    sourceFiles: [
      "src/lib/billing/lago-webhooks.ts",
      "src/lib/billing/lago-reducer.ts",
      "src/lib/billing/stripe-webhooks.ts",
    ],
  },
] as const;

const QUEUE_WORKER_CONTROL_EVIDENCE = [
  "prisma/schema.prisma",
  "prisma/migrations/20260715110000_add_usage_outbox_delivery_lease/migration.sql",
  "security/source-surface-inventory.ts",
  "security/queue-worker-control-evidence.ts",
  "security/queue-worker-control-evidence.test.ts",
  "src/lib/billing/usage-delivery-service.ts",
  "src/lib/billing/usage-delivery-policy.ts",
  "src/lib/billing/usage-delivery-worker.ts",
  "src/lib/billing/usage-delivery-worker-store.ts",
  "src/lib/billing/usage-delivery-worker.test.ts",
] as const;

const VERIFIED_QUEUE_WORKER_CONTROL_IDS = [
  "security.queue-worker-control.schema",
  "security.queue-worker-control.poison",
  "security.queue-worker-control.fan-out",
] as const;

export const QUEUE_WORKER_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_QUEUE_WORKER_CONTROL_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: QUEUE_WORKER_CONTROL_EVIDENCE },
  ]),
);
