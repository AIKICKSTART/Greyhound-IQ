-- The managed migration workflow prebuilds these concurrently on populated databases.
-- These idempotent statements keep fresh and disposable databases self-contained.
CREATE INDEX IF NOT EXISTS "Dog_trainerId_idx"
ON "Dog"("trainerId");

CREATE INDEX IF NOT EXISTS "Runner_trainerId_idx"
ON "Runner"("trainerId");

CREATE INDEX IF NOT EXISTS "FormEntry_trackId_date_idx"
ON "FormEntry"("trackId", "date");

CREATE INDEX IF NOT EXISTS "DogOwnership_profileId_status_createdAt_idx"
ON "DogOwnership"("profileId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Thread_authorId_createdAt_idx"
ON "Thread"("authorId", "createdAt");

CREATE INDEX IF NOT EXISTS "Post_authorId_createdAt_idx"
ON "Post"("authorId", "createdAt");

CREATE INDEX IF NOT EXISTS "Listing_dogId_status_createdAt_idx"
ON "Listing"("dogId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Report_reportedId_createdAt_idx"
ON "Report"("reportedId", "createdAt");
