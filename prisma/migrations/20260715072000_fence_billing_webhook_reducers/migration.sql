-- A processing token fences a recovered Lago receipt from the worker whose
-- lease expired. Existing receipts remain unclaimed until the next delivery.
ALTER TABLE "WebhookEvent" ADD COLUMN "processingToken" TEXT;

-- One provider receipt may produce at most one billing-domain event. This
-- fails closed if historical duplicates exist; operators must investigate
-- rather than silently discarding billing audit evidence.
CREATE UNIQUE INDEX "BillingEvent_webhookEventId_key"
  ON "BillingEvent"("webhookEventId");

CREATE INDEX "WebhookEvent_status_updatedAt_idx"
  ON "WebhookEvent"("status", "updatedAt");
