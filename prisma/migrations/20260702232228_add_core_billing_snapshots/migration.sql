CREATE TABLE "BillingCustomer" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "lagoCustomerId" TEXT NOT NULL,
  "lagoExternalId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadataJson" TEXT,
  "rawJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "billingCustomerId" TEXT,
  "lagoSubscriptionId" TEXT NOT NULL,
  "lagoCustomerId" TEXT,
  "lagoPlanId" TEXT,
  "externalId" TEXT,
  "planCode" TEXT,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "rawJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EntitlementSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "billingCustomerId" TEXT,
  "subscriptionId" TEXT,
  "lagoCustomerId" TEXT,
  "lagoSubscriptionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "entitlementsJson" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EntitlementSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'lago',
  "lagoEventId" TEXT,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "payloadJson" TEXT NOT NULL,
  "headersJson" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "billingCustomerId" TEXT,
  "subscriptionId" TEXT,
  "lagoInvoiceId" TEXT NOT NULL,
  "lagoCustomerId" TEXT,
  "lagoSubscriptionId" TEXT,
  "invoiceNumber" TEXT,
  "status" TEXT NOT NULL,
  "paymentStatus" TEXT,
  "currency" TEXT,
  "totalAmountCents" INTEGER,
  "issuedAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "rawJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvoiceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "billingCustomerId" TEXT,
  "subscriptionId" TEXT,
  "invoiceRecordId" TEXT,
  "webhookEventId" TEXT,
  "lagoEventId" TEXT,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'recorded',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BillingCustomer"
  ADD CONSTRAINT "BillingCustomer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_billingCustomerId_fkey"
  FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EntitlementSnapshot"
  ADD CONSTRAINT "EntitlementSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EntitlementSnapshot"
  ADD CONSTRAINT "EntitlementSnapshot_billingCustomerId_fkey"
  FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EntitlementSnapshot"
  ADD CONSTRAINT "EntitlementSnapshot_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceRecord"
  ADD CONSTRAINT "InvoiceRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceRecord"
  ADD CONSTRAINT "InvoiceRecord_billingCustomerId_fkey"
  FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceRecord"
  ADD CONSTRAINT "InvoiceRecord_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_billingCustomerId_fkey"
  FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_invoiceRecordId_fkey"
  FOREIGN KEY ("invoiceRecordId") REFERENCES "InvoiceRecord"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_webhookEventId_fkey"
  FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "BillingCustomer_userId_key" ON "BillingCustomer"("userId");
CREATE UNIQUE INDEX "BillingCustomer_lagoCustomerId_key" ON "BillingCustomer"("lagoCustomerId");
CREATE UNIQUE INDEX "BillingCustomer_lagoExternalId_key" ON "BillingCustomer"("lagoExternalId");
CREATE INDEX "BillingCustomer_status_idx" ON "BillingCustomer"("status");
CREATE INDEX "BillingCustomer_createdAt_idx" ON "BillingCustomer"("createdAt");

CREATE UNIQUE INDEX "Subscription_lagoSubscriptionId_key" ON "Subscription"("lagoSubscriptionId");
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");
CREATE INDEX "Subscription_billingCustomerId_status_idx" ON "Subscription"("billingCustomerId", "status");
CREATE INDEX "Subscription_lagoCustomerId_idx" ON "Subscription"("lagoCustomerId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

CREATE INDEX "EntitlementSnapshot_userId_effectiveAt_idx" ON "EntitlementSnapshot"("userId", "effectiveAt");
CREATE INDEX "EntitlementSnapshot_billingCustomerId_effectiveAt_idx" ON "EntitlementSnapshot"("billingCustomerId", "effectiveAt");
CREATE INDEX "EntitlementSnapshot_subscriptionId_effectiveAt_idx" ON "EntitlementSnapshot"("subscriptionId", "effectiveAt");
CREATE INDEX "EntitlementSnapshot_lagoCustomerId_idx" ON "EntitlementSnapshot"("lagoCustomerId");
CREATE INDEX "EntitlementSnapshot_lagoSubscriptionId_idx" ON "EntitlementSnapshot"("lagoSubscriptionId");
CREATE INDEX "EntitlementSnapshot_status_idx" ON "EntitlementSnapshot"("status");
CREATE INDEX "EntitlementSnapshot_expiresAt_idx" ON "EntitlementSnapshot"("expiresAt");

CREATE UNIQUE INDEX "WebhookEvent_lagoEventId_key" ON "WebhookEvent"("lagoEventId");
CREATE INDEX "WebhookEvent_eventType_receivedAt_idx" ON "WebhookEvent"("eventType", "receivedAt");
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

CREATE UNIQUE INDEX "InvoiceRecord_lagoInvoiceId_key" ON "InvoiceRecord"("lagoInvoiceId");
CREATE INDEX "InvoiceRecord_userId_status_idx" ON "InvoiceRecord"("userId", "status");
CREATE INDEX "InvoiceRecord_billingCustomerId_status_idx" ON "InvoiceRecord"("billingCustomerId", "status");
CREATE INDEX "InvoiceRecord_subscriptionId_idx" ON "InvoiceRecord"("subscriptionId");
CREATE INDEX "InvoiceRecord_lagoCustomerId_idx" ON "InvoiceRecord"("lagoCustomerId");
CREATE INDEX "InvoiceRecord_lagoSubscriptionId_idx" ON "InvoiceRecord"("lagoSubscriptionId");
CREATE INDEX "InvoiceRecord_status_idx" ON "InvoiceRecord"("status");
CREATE INDEX "InvoiceRecord_issuedAt_idx" ON "InvoiceRecord"("issuedAt");
CREATE INDEX "InvoiceRecord_dueAt_idx" ON "InvoiceRecord"("dueAt");

CREATE INDEX "BillingEvent_userId_occurredAt_idx" ON "BillingEvent"("userId", "occurredAt");
CREATE INDEX "BillingEvent_billingCustomerId_occurredAt_idx" ON "BillingEvent"("billingCustomerId", "occurredAt");
CREATE INDEX "BillingEvent_subscriptionId_occurredAt_idx" ON "BillingEvent"("subscriptionId", "occurredAt");
CREATE INDEX "BillingEvent_invoiceRecordId_idx" ON "BillingEvent"("invoiceRecordId");
CREATE INDEX "BillingEvent_webhookEventId_idx" ON "BillingEvent"("webhookEventId");
CREATE INDEX "BillingEvent_lagoEventId_idx" ON "BillingEvent"("lagoEventId");
CREATE INDEX "BillingEvent_eventType_occurredAt_idx" ON "BillingEvent"("eventType", "occurredAt");
CREATE INDEX "BillingEvent_status_occurredAt_idx" ON "BillingEvent"("status", "occurredAt");
