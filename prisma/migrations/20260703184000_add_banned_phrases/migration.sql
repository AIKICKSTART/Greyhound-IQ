CREATE TABLE "BannedPhrase" (
  "id" TEXT NOT NULL,
  "phrase" TEXT NOT NULL,
  "target" TEXT NOT NULL DEFAULT 'all',
  "action" TEXT NOT NULL DEFAULT 'review',
  "reason" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BannedPhrase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BannedPhrase_phrase_key" ON "BannedPhrase"("phrase");
CREATE INDEX "BannedPhrase_active_target_idx" ON "BannedPhrase"("active", "target");
