CREATE TABLE "ExportArtifact" (
  "id" TEXT NOT NULL,
  "exportType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'created',
  "targetUserId" TEXT,
  "organizationId" TEXT,
  "requestedByUserId" TEXT,
  "storageBucket" TEXT,
  "storagePath" TEXT,
  "sha256" TEXT,
  "sizeBytes" INTEGER,
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExportArtifact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ExportArtifact"
  ADD CONSTRAINT "ExportArtifact_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExportArtifact"
  ADD CONSTRAINT "ExportArtifact_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExportArtifact"
  ADD CONSTRAINT "ExportArtifact_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ExportArtifact_exportType_createdAt_idx" ON "ExportArtifact"("exportType", "createdAt");
CREATE INDEX "ExportArtifact_status_createdAt_idx" ON "ExportArtifact"("status", "createdAt");
CREATE INDEX "ExportArtifact_targetUserId_createdAt_idx" ON "ExportArtifact"("targetUserId", "createdAt");
CREATE INDEX "ExportArtifact_organizationId_createdAt_idx" ON "ExportArtifact"("organizationId", "createdAt");
CREATE INDEX "ExportArtifact_requestedByUserId_createdAt_idx" ON "ExportArtifact"("requestedByUserId", "createdAt");
CREATE INDEX "ExportArtifact_storageBucket_storagePath_idx" ON "ExportArtifact"("storageBucket", "storagePath");
CREATE INDEX "ExportArtifact_expiresAt_idx" ON "ExportArtifact"("expiresAt");
