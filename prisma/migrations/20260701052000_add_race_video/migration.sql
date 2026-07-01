CREATE TABLE "RaceVideo" (
  "id" TEXT NOT NULL,
  "raceId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'replay',
  "pageUrl" TEXT NOT NULL,
  "embedSourceType" TEXT,
  "sourceStatus" INTEGER,
  "sourceCode" TEXT,
  "streamUrl" TEXT,
  "streamContentType" TEXT,
  "title" TEXT,
  "description" TEXT,
  "sourceRawJson" TEXT,
  "fetchedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RaceVideo_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RaceVideo"
  ADD CONSTRAINT "RaceVideo_raceId_fkey"
  FOREIGN KEY ("raceId") REFERENCES "Race"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RaceVideo_raceId_idx" ON "RaceVideo"("raceId");
CREATE INDEX "RaceVideo_kind_idx" ON "RaceVideo"("kind");
CREATE INDEX "RaceVideo_sourceProvider_idx" ON "RaceVideo"("sourceProvider");
CREATE INDEX "RaceVideo_fetchedAt_idx" ON "RaceVideo"("fetchedAt");
CREATE UNIQUE INDEX "RaceVideo_sourceProvider_sourceId_kind_key"
  ON "RaceVideo"("sourceProvider", "sourceId", "kind");
