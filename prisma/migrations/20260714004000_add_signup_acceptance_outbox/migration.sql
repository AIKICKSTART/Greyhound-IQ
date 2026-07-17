-- New table only: no existing rows are rewritten or backfilled.
CREATE TABLE "SignupOutbox" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseExpiresAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deadLetteredAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SignupOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SignupOutbox_retryCount_check" CHECK ("retryCount" >= 0),
  CONSTRAINT "SignupOutbox_status_check" CHECK (
    "status" IN ('pending', 'processing', 'sent', 'dead_letter')
  )
);

CREATE UNIQUE INDEX "SignupOutbox_userId_key" ON "SignupOutbox"("userId");
CREATE UNIQUE INDEX "SignupOutbox_idempotencyKey_key" ON "SignupOutbox"("idempotencyKey");
CREATE INDEX "SignupOutbox_status_nextRetryAt_createdAt_idx"
  ON "SignupOutbox"("status", "nextRetryAt", "createdAt");

ALTER TABLE "SignupOutbox"
  ADD CONSTRAINT "SignupOutbox_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SignupOutbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignupOutbox" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_signup_outbox_system ON "SignupOutbox"
  FOR ALL
  USING (public.giq_is_system())
  WITH CHECK (public.giq_is_system());
