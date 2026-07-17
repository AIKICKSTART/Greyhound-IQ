-- Self-service exports record their completed artifact under the requesting
-- member's request context. Keep the existing system/moderator policy and add
-- only the insert permission required by that flow.
CREATE POLICY giq_export_artifact_owner_insert ON "ExportArtifact"
FOR INSERT
WITH CHECK (
  "targetUserId" = public.giq_current_user_id()
  AND "requestedByUserId" = public.giq_current_user_id()
  AND "organizationId" IS NULL
  AND "exportType" = 'user_data'
  AND status = 'completed'
  AND "storageBucket" IS NULL
  AND "storagePath" IS NULL
  AND sha256 IS NULL
  AND "sizeBytes" IS NOT NULL
  AND "sizeBytes" >= 0
  AND "completedAt" IS NOT NULL
  AND "expiresAt" IS NOT NULL
);
