CREATE TABLE "RaceDayArchive" (
  "id" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "fetchedAt" TIMESTAMP(3),
  "rawPath" TEXT,
  "meetings" INTEGER NOT NULL DEFAULT 0,
  "races" INTEGER NOT NULL DEFAULT 0,
  "runners" INTEGER NOT NULL DEFAULT 0,
  "results" INTEGER NOT NULL DEFAULT 0,
  "dogs" INTEGER NOT NULL DEFAULT 0,
  "trainers" INTEGER NOT NULL DEFAULT 0,
  "rawJson" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RaceDayArchive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RaceDayArchive_date_idx" ON "RaceDayArchive"("date");
CREATE INDEX "RaceDayArchive_sourceProvider_idx" ON "RaceDayArchive"("sourceProvider");
CREATE UNIQUE INDEX "RaceDayArchive_sourceProvider_date_key"
  ON "RaceDayArchive"("sourceProvider", "date");
