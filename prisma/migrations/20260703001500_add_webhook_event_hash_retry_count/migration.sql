ALTER TABLE "WebhookEvent" ADD COLUMN "payloadHash" TEXT;
ALTER TABLE "WebhookEvent" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "WebhookEvent_provider_eventType_payloadHash_idx"
ON "WebhookEvent"("provider", "eventType", "payloadHash");

CREATE UNIQUE INDEX "WebhookEvent_provider_payloadHash_key"
ON "WebhookEvent"("provider", "payloadHash");
