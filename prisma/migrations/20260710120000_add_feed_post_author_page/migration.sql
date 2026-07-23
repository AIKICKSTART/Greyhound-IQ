-- Feed posts can be published "as" an owned CustomPage identity.
ALTER TABLE "FeedPost" ADD COLUMN "authorPageId" TEXT;

ALTER TABLE "FeedPost"
  ADD CONSTRAINT "FeedPost_authorPageId_fkey"
  FOREIGN KEY ("authorPageId") REFERENCES "CustomPage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FeedPost_authorPageId_createdAt_idx"
  ON "FeedPost"("authorPageId", "createdAt");
