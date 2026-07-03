CREATE TABLE "RetentionPolicy" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "retentionDays" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeletionJob" (
  "id" TEXT NOT NULL,
  "policyId" TEXT,
  "targetType" TEXT NOT NULL,
  "targetUserId" TEXT,
  "storageBucket" TEXT,
  "storagePath" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "requestedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeletionJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RetentionPolicy"
  ADD CONSTRAINT "RetentionPolicy_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeletionJob"
  ADD CONSTRAINT "DeletionJob_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "RetentionPolicy"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeletionJob"
  ADD CONSTRAINT "DeletionJob_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeletionJob"
  ADD CONSTRAINT "DeletionJob_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "RetentionPolicy_code_key" ON "RetentionPolicy"("code");
CREATE INDEX "RetentionPolicy_targetType_enabled_idx" ON "RetentionPolicy"("targetType", "enabled");
CREATE INDEX "RetentionPolicy_createdByUserId_idx" ON "RetentionPolicy"("createdByUserId");

CREATE INDEX "DeletionJob_policyId_idx" ON "DeletionJob"("policyId");
CREATE INDEX "DeletionJob_targetType_status_idx" ON "DeletionJob"("targetType", "status");
CREATE INDEX "DeletionJob_status_scheduledFor_idx" ON "DeletionJob"("status", "scheduledFor");
CREATE INDEX "DeletionJob_targetUserId_idx" ON "DeletionJob"("targetUserId");
CREATE INDEX "DeletionJob_requestedByUserId_idx" ON "DeletionJob"("requestedByUserId");
CREATE INDEX "DeletionJob_storageBucket_storagePath_idx" ON "DeletionJob"("storageBucket", "storagePath");
