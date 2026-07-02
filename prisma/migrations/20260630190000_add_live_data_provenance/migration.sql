ALTER TABLE "Meeting" ADD COLUMN "sourceProvider" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

ALTER TABLE "Race" ADD COLUMN "sourceProvider" TEXT;
ALTER TABLE "Race" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "Race" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE INDEX "Meeting_sourceProvider_idx" ON "Meeting"("sourceProvider");
CREATE INDEX "Meeting_lastSyncedAt_idx" ON "Meeting"("lastSyncedAt");
CREATE INDEX "Race_sourceProvider_idx" ON "Race"("sourceProvider");
CREATE INDEX "Race_lastSyncedAt_idx" ON "Race"("lastSyncedAt");
