CREATE TABLE "AdminAction" (
  "id" TEXT NOT NULL,
  "adminId" TEXT,
  "affectedUserId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobRun" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "triggeredByAdminId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataSourceHealth" (
  "id" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'unknown',
  "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSuccessAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "latencyMs" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DataSourceHealth_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminAction"
  ADD CONSTRAINT "AdminAction_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminAction"
  ADD CONSTRAINT "AdminAction_affectedUserId_fkey"
  FOREIGN KEY ("affectedUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobRun"
  ADD CONSTRAINT "JobRun_triggeredByAdminId_fkey"
  FOREIGN KEY ("triggeredByAdminId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "DataSourceHealth_sourceProvider_key" ON "DataSourceHealth"("sourceProvider");
CREATE INDEX "AdminAction_adminId_createdAt_idx" ON "AdminAction"("adminId", "createdAt");
CREATE INDEX "AdminAction_affectedUserId_createdAt_idx" ON "AdminAction"("affectedUserId", "createdAt");
CREATE INDEX "AdminAction_action_createdAt_idx" ON "AdminAction"("action", "createdAt");
CREATE INDEX "AdminAction_targetType_targetId_idx" ON "AdminAction"("targetType", "targetId");
CREATE INDEX "JobRun_name_createdAt_idx" ON "JobRun"("name", "createdAt");
CREATE INDEX "JobRun_status_createdAt_idx" ON "JobRun"("status", "createdAt");
CREATE INDEX "JobRun_triggeredByAdminId_createdAt_idx" ON "JobRun"("triggeredByAdminId", "createdAt");
CREATE INDEX "DataSourceHealth_status_lastCheckedAt_idx" ON "DataSourceHealth"("status", "lastCheckedAt");
CREATE INDEX "DataSourceHealth_lastSuccessAt_idx" ON "DataSourceHealth"("lastSuccessAt");
