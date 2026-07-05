ALTER TABLE "CallRoom" ADD COLUMN "callType" TEXT NOT NULL DEFAULT 'video';

CREATE TABLE "RateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- ponytail: throwaway rate-limit counters; crash-loss acceptable, skip WAL
ALTER TABLE "RateLimit" SET UNLOGGED;
