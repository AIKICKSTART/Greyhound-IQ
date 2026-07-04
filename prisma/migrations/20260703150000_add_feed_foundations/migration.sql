CREATE TABLE "FeedTopic" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rules" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeedTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedPost" (
  "id" TEXT NOT NULL,
  "authorProfileId" TEXT NOT NULL,
  "topicId" TEXT,
  "body" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'public',
  "status" TEXT NOT NULL DEFAULT 'active',
  "pinnedAt" TIMESTAMP(3),
  "reportCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedPostMedia" (
  "postId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FeedPostMedia_pkey" PRIMARY KEY ("postId", "mediaId")
);

CREATE TABLE "FeedComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "authorProfileId" TEXT NOT NULL,
  "parentCommentId" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "reportCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeedComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedReaction" (
  "id" TEXT NOT NULL,
  "postId" TEXT,
  "commentId" TEXT,
  "profileId" TEXT NOT NULL,
  "reactionType" TEXT NOT NULL DEFAULT 'like',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FeedReaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FeedPost"
  ADD CONSTRAINT "FeedPost_authorProfileId_fkey"
  FOREIGN KEY ("authorProfileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeedPost"
  ADD CONSTRAINT "FeedPost_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "FeedTopic"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeedPostMedia"
  ADD CONSTRAINT "FeedPostMedia_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "FeedPost"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedPostMedia"
  ADD CONSTRAINT "FeedPostMedia_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeedComment"
  ADD CONSTRAINT "FeedComment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "FeedPost"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedComment"
  ADD CONSTRAINT "FeedComment_authorProfileId_fkey"
  FOREIGN KEY ("authorProfileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeedComment"
  ADD CONSTRAINT "FeedComment_parentCommentId_fkey"
  FOREIGN KEY ("parentCommentId") REFERENCES "FeedComment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeedReaction"
  ADD CONSTRAINT "FeedReaction_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "FeedPost"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedReaction"
  ADD CONSTRAINT "FeedReaction_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "FeedComment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedReaction"
  ADD CONSTRAINT "FeedReaction_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "FeedTopic_slug_key" ON "FeedTopic"("slug");
CREATE INDEX "FeedTopic_active_sortOrder_idx" ON "FeedTopic"("active", "sortOrder");
CREATE INDEX "FeedPost_status_createdAt_idx" ON "FeedPost"("status", "createdAt");
CREATE INDEX "FeedPost_topicId_status_createdAt_idx" ON "FeedPost"("topicId", "status", "createdAt");
CREATE INDEX "FeedPost_authorProfileId_createdAt_idx" ON "FeedPost"("authorProfileId", "createdAt");
CREATE INDEX "FeedPost_pinnedAt_idx" ON "FeedPost"("pinnedAt");
CREATE UNIQUE INDEX "FeedPostMedia_postId_position_key" ON "FeedPostMedia"("postId", "position");
CREATE INDEX "FeedPostMedia_mediaId_idx" ON "FeedPostMedia"("mediaId");
CREATE INDEX "FeedComment_postId_status_createdAt_idx" ON "FeedComment"("postId", "status", "createdAt");
CREATE INDEX "FeedComment_authorProfileId_createdAt_idx" ON "FeedComment"("authorProfileId", "createdAt");
CREATE INDEX "FeedComment_parentCommentId_idx" ON "FeedComment"("parentCommentId");
CREATE UNIQUE INDEX "FeedReaction_postId_profileId_reactionType_key" ON "FeedReaction"("postId", "profileId", "reactionType");
CREATE UNIQUE INDEX "FeedReaction_commentId_profileId_reactionType_key" ON "FeedReaction"("commentId", "profileId", "reactionType");
CREATE INDEX "FeedReaction_profileId_createdAt_idx" ON "FeedReaction"("profileId", "createdAt");

INSERT INTO "FeedTopic" ("id", "slug", "name", "rules", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('feed-topic-general', 'general', 'General', 'Greyhound racing discussion, product questions, and community updates.', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('feed-topic-racing', 'racing', 'Racing', 'Race cards, form notes, sectional observations, and track context.', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('feed-topic-breeding', 'breeding', 'Breeding', 'Breeding, bloodlines, litters, kennel context, and ownership experience.', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('feed-topic-marketplace', 'marketplace', 'Marketplace', 'Listing context, safe enquiries, seller questions, and buyer diligence.', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
