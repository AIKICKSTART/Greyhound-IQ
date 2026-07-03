CREATE TABLE "UsageAggregate" (
  "id" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "userId" TEXT,
  "billingCustomerId" TEXT,
  "subscriptionId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UsageAggregate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UsageAggregate"
  ADD CONSTRAINT "UsageAggregate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UsageAggregate"
  ADD CONSTRAINT "UsageAggregate_billingCustomerId_fkey"
  FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UsageAggregate"
  ADD CONSTRAINT "UsageAggregate_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "UsageAggregate_metricKey_periodStart_idx" ON "UsageAggregate"("metricKey", "periodStart");
CREATE INDEX "UsageAggregate_userId_periodStart_idx" ON "UsageAggregate"("userId", "periodStart");
CREATE INDEX "UsageAggregate_billingCustomerId_periodStart_idx" ON "UsageAggregate"("billingCustomerId", "periodStart");
CREATE INDEX "UsageAggregate_subscriptionId_periodStart_idx" ON "UsageAggregate"("subscriptionId", "periodStart");
CREATE INDEX "UsageAggregate_status_periodEnd_idx" ON "UsageAggregate"("status", "periodEnd");
