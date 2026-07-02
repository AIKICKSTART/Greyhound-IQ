CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "lagoPlanId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceCatalog" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "amountCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "lagoPriceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PriceCatalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanEntitlement" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "limitValue" INTEGER,
  "unit" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PriceCatalog"
  ADD CONSTRAINT "PriceCatalog_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanEntitlement"
  ADD CONSTRAINT "PlanEntitlement_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");
CREATE UNIQUE INDEX "Plan_lagoPlanId_key" ON "Plan"("lagoPlanId");
CREATE INDEX "Plan_status_idx" ON "Plan"("status");

CREATE UNIQUE INDEX "PriceCatalog_lagoPriceId_key" ON "PriceCatalog"("lagoPriceId");
CREATE INDEX "PriceCatalog_planId_idx" ON "PriceCatalog"("planId");
CREATE INDEX "PriceCatalog_planId_status_idx" ON "PriceCatalog"("planId", "status");
CREATE INDEX "PriceCatalog_planId_interval_currency_idx" ON "PriceCatalog"("planId", "interval", "currency");
CREATE INDEX "PriceCatalog_status_idx" ON "PriceCatalog"("status");

CREATE UNIQUE INDEX "PlanEntitlement_planId_featureKey_key" ON "PlanEntitlement"("planId", "featureKey");
CREATE INDEX "PlanEntitlement_planId_idx" ON "PlanEntitlement"("planId");
CREATE INDEX "PlanEntitlement_planId_enabled_idx" ON "PlanEntitlement"("planId", "enabled");
CREATE INDEX "PlanEntitlement_featureKey_idx" ON "PlanEntitlement"("featureKey");
