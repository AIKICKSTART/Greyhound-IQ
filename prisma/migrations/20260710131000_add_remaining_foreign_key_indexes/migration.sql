-- The managed migration workflow prebuilds these concurrently on populated databases.
-- These idempotent statements keep fresh and disposable databases self-contained.
CREATE INDEX IF NOT EXISTS "DogOwnership_reviewedByProfileId_idx"
ON "DogOwnership"("reviewedByProfileId");

CREATE INDEX IF NOT EXISTS "OrganizationInvitation_invitedByUserId_idx"
ON "OrganizationInvitation"("invitedByUserId");

CREATE INDEX IF NOT EXISTS "CallInvite_callRoomId_toProfileId_status_createdAt_idx"
ON "CallInvite"("callRoomId", "toProfileId", "status", "createdAt");
