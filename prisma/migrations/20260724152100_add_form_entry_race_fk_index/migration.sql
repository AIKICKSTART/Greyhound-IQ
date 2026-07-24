-- The FK-side lookup is required for bounded Race deletes/updates. This
-- migration intentionally runs outside a transaction for the large live table.
SET lock_timeout = '5s';
SET statement_timeout = '30min';

CREATE INDEX CONCURRENTLY IF NOT EXISTS "FormEntry_raceId_idx"
  ON "FormEntry"("raceId")
  WHERE "raceId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "RaceVideo_verificationStatus_lastVerifiedAt_idx"
  ON "RaceVideo"("verificationStatus", "lastVerifiedAt");
