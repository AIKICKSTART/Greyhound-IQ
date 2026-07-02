DROP INDEX IF EXISTS "RaceVideo_sourceProvider_sourceId_kind_key";

CREATE UNIQUE INDEX IF NOT EXISTS "RaceVideo_raceId_sourceProvider_kind_key"
  ON "RaceVideo"("raceId", "sourceProvider", "kind");

CREATE INDEX IF NOT EXISTS "RaceVideo_sourceProvider_sourceId_idx"
  ON "RaceVideo"("sourceProvider", "sourceId");
