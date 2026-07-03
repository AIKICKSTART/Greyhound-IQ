CREATE TABLE "UsageEvent" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "userId" TEXT,
  "billingCustomerId" TEXT,
  "subscriptionId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "metadataJson" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageOutbox" (
  "id" TEXT NOT NULL,
  "usageEventId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "userId" TEXT,
  "billingCustomerId" TEXT,
  "subscriptionId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "metadataJson" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UsageOutbox_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UsageEvent"
  ADD CONSTRAINT "UsageEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UsageEvent"
  ADD CONSTRAINT "UsageEvent_billingCustomerId_fkey"
  FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UsageEvent"
  ADD CONSTRAINT "UsageEvent_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UsageOutbox"
  ADD CONSTRAINT "UsageOutbox_usageEventId_fkey"
  FOREIGN KEY ("usageEventId") REFERENCES "UsageEvent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UsageOutbox"
  ADD CONSTRAINT "UsageOutbox_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UsageOutbox"
  ADD CONSTRAINT "UsageOutbox_billingCustomerId_fkey"
  FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UsageOutbox"
  ADD CONSTRAINT "UsageOutbox_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UsageEvent_idempotencyKey_key" ON "UsageEvent"("idempotencyKey");
CREATE INDEX "UsageEvent_metricKey_occurredAt_idx" ON "UsageEvent"("metricKey", "occurredAt");
CREATE INDEX "UsageEvent_userId_occurredAt_idx" ON "UsageEvent"("userId", "occurredAt");
CREATE INDEX "UsageEvent_billingCustomerId_occurredAt_idx" ON "UsageEvent"("billingCustomerId", "occurredAt");
CREATE INDEX "UsageEvent_subscriptionId_occurredAt_idx" ON "UsageEvent"("subscriptionId", "occurredAt");
CREATE INDEX "UsageEvent_status_nextRetryAt_idx" ON "UsageEvent"("status", "nextRetryAt");
CREATE INDEX "UsageEvent_occurredAt_idx" ON "UsageEvent"("occurredAt");

CREATE UNIQUE INDEX "UsageOutbox_idempotencyKey_key" ON "UsageOutbox"("idempotencyKey");
CREATE INDEX "UsageOutbox_usageEventId_idx" ON "UsageOutbox"("usageEventId");
CREATE INDEX "UsageOutbox_metricKey_occurredAt_idx" ON "UsageOutbox"("metricKey", "occurredAt");
CREATE INDEX "UsageOutbox_userId_occurredAt_idx" ON "UsageOutbox"("userId", "occurredAt");
CREATE INDEX "UsageOutbox_billingCustomerId_occurredAt_idx" ON "UsageOutbox"("billingCustomerId", "occurredAt");
CREATE INDEX "UsageOutbox_subscriptionId_occurredAt_idx" ON "UsageOutbox"("subscriptionId", "occurredAt");
CREATE INDEX "UsageOutbox_status_nextRetryAt_idx" ON "UsageOutbox"("status", "nextRetryAt");
CREATE INDEX "UsageOutbox_occurredAt_idx" ON "UsageOutbox"("occurredAt");
