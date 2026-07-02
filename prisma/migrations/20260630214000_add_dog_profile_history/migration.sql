ALTER TABLE "Dog"
  ADD COLUMN "sourceProvider" TEXT,
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "profileUrl" TEXT,
  ADD COLUMN "ownerName" TEXT,
  ADD COLUMN "careerStarts" INTEGER,
  ADD COLUMN "careerWins" INTEGER,
  ADD COLUMN "careerSeconds" INTEGER,
  ADD COLUMN "careerThirds" INTEGER,
  ADD COLUMN "prizeMoney" DOUBLE PRECISION,
  ADD COLUMN "winPercentage" DOUBLE PRECISION,
  ADD COLUMN "placePercentage" DOUBLE PRECISION,
  ADD COLUMN "profileStatsJson" TEXT,
  ADD COLUMN "bestTimesJson" TEXT,
  ADD COLUMN "boxHistoryJson" TEXT,
  ADD COLUMN "distanceHistoryJson" TEXT,
  ADD COLUMN "profileSourceRawJson" TEXT,
  ADD COLUMN "lastProfileSyncedAt" TIMESTAMP(3);

CREATE TABLE "DogProfileForm" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "raceUrl" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "trackCode" TEXT,
  "trackName" TEXT,
  "raceName" TEXT,
  "finishText" TEXT,
  "finishingPosition" INTEGER,
  "starters" INTEGER,
  "boxNumber" INTEGER,
  "weight" DOUBLE PRECISION,
  "distance" INTEGER,
  "grade" TEXT,
  "runningTime" DOUBLE PRECISION,
  "winnerTime" DOUBLE PRECISION,
  "bestOfNightTime" DOUBLE PRECISION,
  "firstSectional" DOUBLE PRECISION,
  "margin" DOUBLE PRECISION,
  "winnerDogName" TEXT,
  "winnerDogSourceId" TEXT,
  "inRunningPositions" TEXT,
  "startingPrice" DOUBLE PRECISION,
  "hasVideo" BOOLEAN NOT NULL DEFAULT false,
  "sourceRawJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DogProfileForm_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Dog_sourceProvider_idx" ON "Dog"("sourceProvider");
CREATE UNIQUE INDEX "Dog_sourceProvider_sourceId_key" ON "Dog"("sourceProvider", "sourceId");
CREATE INDEX "DogProfileForm_dogId_idx" ON "DogProfileForm"("dogId");
CREATE INDEX "DogProfileForm_date_idx" ON "DogProfileForm"("date");
CREATE INDEX "DogProfileForm_sourceProvider_idx" ON "DogProfileForm"("sourceProvider");
CREATE UNIQUE INDEX "DogProfileForm_dogId_sourceProvider_sourceId_key" ON "DogProfileForm"("dogId", "sourceProvider", "sourceId");

ALTER TABLE "DogProfileForm"
  ADD CONSTRAINT "DogProfileForm_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
