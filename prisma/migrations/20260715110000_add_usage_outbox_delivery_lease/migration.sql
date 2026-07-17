-- Add an expiring, fenced ownership lease to usage delivery. All columns are
-- nullable so existing pending rows remain claimable without a table rewrite.
ALTER TABLE "UsageOutbox"
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "leaseToken" TEXT,
  ADD COLUMN "deadLetteredAt" TIMESTAMP(3),
  ADD COLUMN "lastErrorCode" TEXT;

CREATE INDEX "UsageOutbox_status_leaseExpiresAt_idx"
  ON "UsageOutbox"("status", "leaseExpiresAt");
