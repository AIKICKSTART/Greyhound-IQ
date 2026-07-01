CREATE TABLE "DogProfileArchive" (
  "id" TEXT NOT NULL,
  "dogId" TEXT,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "profileUrl" TEXT,
  "fetchedAt" TIMESTAMP(3),
  "showMorePath" TEXT,
  "candidateJson" TEXT,
  "parsedJson" TEXT,
  "profileHtml" TEXT,
  "fullFormHtml" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DogProfileArchive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DogProfileArchive_dogId_idx" ON "DogProfileArchive"("dogId");
CREATE INDEX "DogProfileArchive_fetchedAt_idx" ON "DogProfileArchive"("fetchedAt");
CREATE INDEX "DogProfileArchive_sourceProvider_idx" ON "DogProfileArchive"("sourceProvider");
CREATE UNIQUE INDEX "DogProfileArchive_sourceProvider_sourceId_key" ON "DogProfileArchive"("sourceProvider", "sourceId");

ALTER TABLE "DogProfileArchive"
  ADD CONSTRAINT "DogProfileArchive_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
