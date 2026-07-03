CREATE TABLE "Feedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BugReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "severity" TEXT NOT NULL DEFAULT 'normal',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRunUsage" (
  "id" TEXT NOT NULL,
  "agentRunId" TEXT,
  "userId" TEXT,
  "metricKey" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AgentRunUsage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BugReport"
  ADD CONSTRAINT "BugReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentRunUsage"
  ADD CONSTRAINT "AgentRunUsage_agentRunId_fkey"
  FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentRunUsage"
  ADD CONSTRAINT "AgentRunUsage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");
CREATE INDEX "Feedback_status_updatedAt_idx" ON "Feedback"("status", "updatedAt");
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

CREATE INDEX "BugReport_userId_idx" ON "BugReport"("userId");
CREATE INDEX "BugReport_status_updatedAt_idx" ON "BugReport"("status", "updatedAt");
CREATE INDEX "BugReport_severity_status_idx" ON "BugReport"("severity", "status");
CREATE INDEX "BugReport_createdAt_idx" ON "BugReport"("createdAt");

CREATE INDEX "AgentRunUsage_agentRunId_idx" ON "AgentRunUsage"("agentRunId");
CREATE INDEX "AgentRunUsage_userId_occurredAt_idx" ON "AgentRunUsage"("userId", "occurredAt");
CREATE INDEX "AgentRunUsage_metricKey_occurredAt_idx" ON "AgentRunUsage"("metricKey", "occurredAt");
CREATE INDEX "AgentRunUsage_occurredAt_idx" ON "AgentRunUsage"("occurredAt");
