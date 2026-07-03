CREATE TABLE "PaymentRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "billingCustomerId" TEXT,
  "subscriptionId" TEXT,
  "invoiceRecordId" TEXT,
  "lagoPaymentId" TEXT,
  "pspPaymentId" TEXT,
  "status" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefundRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "billingCustomerId" TEXT,
  "subscriptionId" TEXT,
  "invoiceRecordId" TEXT,
  "paymentRecordId" TEXT,
  "lagoRefundId" TEXT,
  "pspRefundId" TEXT,
  "status" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditNoteRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "billingCustomerId" TEXT,
  "subscriptionId" TEXT,
  "invoiceRecordId" TEXT,
  "lagoCreditNoteId" TEXT,
  "pspCreditNoteId" TEXT,
  "status" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CreditNoteRecord_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentRecord"
  ADD CONSTRAINT "PaymentRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRecord"
  ADD CONSTRAINT "PaymentRecord_billingCustomerId_fkey"
  FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRecord"
  ADD CONSTRAINT "PaymentRecord_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRecord"
  ADD CONSTRAINT "PaymentRecord_invoiceRecordId_fkey"
  FOREIGN KEY ("invoiceRecordId") REFERENCES "InvoiceRecord"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RefundRecord"
  ADD CONSTRAINT "RefundRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RefundRecord"
  ADD CONSTRAINT "RefundRecord_billingCustomerId_fkey"
  FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RefundRecord"
  ADD CONSTRAINT "RefundRecord_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RefundRecord"
  ADD CONSTRAINT "RefundRecord_invoiceRecordId_fkey"
  FOREIGN KEY ("invoiceRecordId") REFERENCES "InvoiceRecord"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RefundRecord"
  ADD CONSTRAINT "RefundRecord_paymentRecordId_fkey"
  FOREIGN KEY ("paymentRecordId") REFERENCES "PaymentRecord"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditNoteRecord"
  ADD CONSTRAINT "CreditNoteRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditNoteRecord"
  ADD CONSTRAINT "CreditNoteRecord_billingCustomerId_fkey"
  FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditNoteRecord"
  ADD CONSTRAINT "CreditNoteRecord_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditNoteRecord"
  ADD CONSTRAINT "CreditNoteRecord_invoiceRecordId_fkey"
  FOREIGN KEY ("invoiceRecordId") REFERENCES "InvoiceRecord"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PaymentRecord_lagoPaymentId_key" ON "PaymentRecord"("lagoPaymentId");
CREATE UNIQUE INDEX "PaymentRecord_pspPaymentId_key" ON "PaymentRecord"("pspPaymentId");
CREATE INDEX "PaymentRecord_userId_occurredAt_idx" ON "PaymentRecord"("userId", "occurredAt");
CREATE INDEX "PaymentRecord_billingCustomerId_occurredAt_idx" ON "PaymentRecord"("billingCustomerId", "occurredAt");
CREATE INDEX "PaymentRecord_subscriptionId_occurredAt_idx" ON "PaymentRecord"("subscriptionId", "occurredAt");
CREATE INDEX "PaymentRecord_invoiceRecordId_occurredAt_idx" ON "PaymentRecord"("invoiceRecordId", "occurredAt");
CREATE INDEX "PaymentRecord_status_occurredAt_idx" ON "PaymentRecord"("status", "occurredAt");
CREATE INDEX "PaymentRecord_occurredAt_idx" ON "PaymentRecord"("occurredAt");

CREATE UNIQUE INDEX "RefundRecord_lagoRefundId_key" ON "RefundRecord"("lagoRefundId");
CREATE UNIQUE INDEX "RefundRecord_pspRefundId_key" ON "RefundRecord"("pspRefundId");
CREATE INDEX "RefundRecord_userId_occurredAt_idx" ON "RefundRecord"("userId", "occurredAt");
CREATE INDEX "RefundRecord_billingCustomerId_occurredAt_idx" ON "RefundRecord"("billingCustomerId", "occurredAt");
CREATE INDEX "RefundRecord_subscriptionId_occurredAt_idx" ON "RefundRecord"("subscriptionId", "occurredAt");
CREATE INDEX "RefundRecord_invoiceRecordId_occurredAt_idx" ON "RefundRecord"("invoiceRecordId", "occurredAt");
CREATE INDEX "RefundRecord_paymentRecordId_occurredAt_idx" ON "RefundRecord"("paymentRecordId", "occurredAt");
CREATE INDEX "RefundRecord_status_occurredAt_idx" ON "RefundRecord"("status", "occurredAt");
CREATE INDEX "RefundRecord_occurredAt_idx" ON "RefundRecord"("occurredAt");

CREATE UNIQUE INDEX "CreditNoteRecord_lagoCreditNoteId_key" ON "CreditNoteRecord"("lagoCreditNoteId");
CREATE UNIQUE INDEX "CreditNoteRecord_pspCreditNoteId_key" ON "CreditNoteRecord"("pspCreditNoteId");
CREATE INDEX "CreditNoteRecord_userId_occurredAt_idx" ON "CreditNoteRecord"("userId", "occurredAt");
CREATE INDEX "CreditNoteRecord_billingCustomerId_occurredAt_idx" ON "CreditNoteRecord"("billingCustomerId", "occurredAt");
CREATE INDEX "CreditNoteRecord_subscriptionId_occurredAt_idx" ON "CreditNoteRecord"("subscriptionId", "occurredAt");
CREATE INDEX "CreditNoteRecord_invoiceRecordId_occurredAt_idx" ON "CreditNoteRecord"("invoiceRecordId", "occurredAt");
CREATE INDEX "CreditNoteRecord_status_occurredAt_idx" ON "CreditNoteRecord"("status", "occurredAt");
CREATE INDEX "CreditNoteRecord_occurredAt_idx" ON "CreditNoteRecord"("occurredAt");
