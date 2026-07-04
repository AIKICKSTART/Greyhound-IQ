CREATE TABLE "MarketplaceCategory" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketplaceCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Listing"
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "listingType" TEXT,
  ADD COLUMN "negotiable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "condition" TEXT,
  ADD COLUMN "contactPreference" TEXT NOT NULL DEFAULT 'message',
  ADD COLUMN "moderationStatus" TEXT NOT NULL DEFAULT 'pending_review',
  ADD COLUMN "moderationReason" TEXT,
  ADD COLUMN "reportCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "greyhoundName" TEXT,
  ADD COLUMN "greyhoundEarbrand" TEXT,
  ADD COLUMN "greyhoundMicrochip" TEXT,
  ADD COLUMN "greyhoundWhelpedAt" TIMESTAMP(3),
  ADD COLUMN "greyhoundSex" TEXT,
  ADD COLUMN "greyhoundColor" TEXT,
  ADD COLUMN "welfareAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "legalAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "itemBrand" TEXT,
  ADD COLUMN "itemModel" TEXT,
  ADD COLUMN "itemCondition" TEXT,
  ADD COLUMN "itemSerialOrIdentifier" TEXT;

CREATE TABLE "ListingLocation" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "state" TEXT,
  "region" TEXT,
  "suburb" TEXT,
  "postcode" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ListingLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListingAttribute" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ListingAttribute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListingStatusHistory" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "actorProfileId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ListingStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedListing" (
  "profileId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SavedListing_pkey" PRIMARY KEY ("profileId", "listingId")
);

CREATE TABLE "ListingEnquiry" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "conversationId" TEXT,
  "fromProfileId" TEXT NOT NULL,
  "toProfileId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ListingEnquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListingReport" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "reporterProfileId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolvedByProfileId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ListingReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListingModerationAction" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "actorProfileId" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ListingModerationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListingView" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "viewerProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ListingView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListingSearchIndex" (
  "listingId" TEXT NOT NULL,
  "searchText" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ListingSearchIndex_pkey" PRIMARY KEY ("listingId")
);

CREATE TABLE "TrustSafetyFlag" (
  "id" TEXT NOT NULL,
  "profileId" TEXT,
  "userId" TEXT,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "flagType" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "reason" TEXT NOT NULL,
  "resolvedByProfileId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrustSafetyFlag_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "MarketplaceCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ListingLocation"
  ADD CONSTRAINT "ListingLocation_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingAttribute"
  ADD CONSTRAINT "ListingAttribute_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingStatusHistory"
  ADD CONSTRAINT "ListingStatusHistory_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingStatusHistory"
  ADD CONSTRAINT "ListingStatusHistory_actorProfileId_fkey"
  FOREIGN KEY ("actorProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SavedListing"
  ADD CONSTRAINT "SavedListing_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedListing"
  ADD CONSTRAINT "SavedListing_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingEnquiry"
  ADD CONSTRAINT "ListingEnquiry_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingEnquiry"
  ADD CONSTRAINT "ListingEnquiry_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ListingEnquiry"
  ADD CONSTRAINT "ListingEnquiry_fromProfileId_fkey"
  FOREIGN KEY ("fromProfileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ListingEnquiry"
  ADD CONSTRAINT "ListingEnquiry_toProfileId_fkey"
  FOREIGN KEY ("toProfileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ListingReport"
  ADD CONSTRAINT "ListingReport_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingReport"
  ADD CONSTRAINT "ListingReport_reporterProfileId_fkey"
  FOREIGN KEY ("reporterProfileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ListingReport"
  ADD CONSTRAINT "ListingReport_resolvedByProfileId_fkey"
  FOREIGN KEY ("resolvedByProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ListingModerationAction"
  ADD CONSTRAINT "ListingModerationAction_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingModerationAction"
  ADD CONSTRAINT "ListingModerationAction_actorProfileId_fkey"
  FOREIGN KEY ("actorProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ListingView"
  ADD CONSTRAINT "ListingView_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingView"
  ADD CONSTRAINT "ListingView_viewerProfileId_fkey"
  FOREIGN KEY ("viewerProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ListingSearchIndex"
  ADD CONSTRAINT "ListingSearchIndex_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MarketplaceCategory_slug_key" ON "MarketplaceCategory"("slug");
CREATE INDEX "MarketplaceCategory_active_sortOrder_idx" ON "MarketplaceCategory"("active", "sortOrder");
CREATE INDEX "Listing_categoryId_idx" ON "Listing"("categoryId");
CREATE INDEX "Listing_listingType_idx" ON "Listing"("listingType");
CREATE INDEX "Listing_moderationStatus_idx" ON "Listing"("moderationStatus");
CREATE INDEX "Listing_status_categoryId_state_createdAt_idx" ON "Listing"("status", "categoryId", "state", "createdAt");
CREATE INDEX "Listing_profileId_status_idx" ON "Listing"("profileId", "status");
CREATE INDEX "Listing_reviewedById_reviewedAt_idx" ON "Listing"("reviewedById", "reviewedAt");
CREATE UNIQUE INDEX "ListingLocation_listingId_key" ON "ListingLocation"("listingId");
CREATE INDEX "ListingLocation_state_region_idx" ON "ListingLocation"("state", "region");
CREATE INDEX "ListingLocation_postcode_idx" ON "ListingLocation"("postcode");
CREATE UNIQUE INDEX "ListingAttribute_listingId_key_key" ON "ListingAttribute"("listingId", "key");
CREATE INDEX "ListingAttribute_key_value_idx" ON "ListingAttribute"("key", "value");
CREATE INDEX "ListingStatusHistory_listingId_createdAt_idx" ON "ListingStatusHistory"("listingId", "createdAt");
CREATE INDEX "ListingStatusHistory_actorProfileId_createdAt_idx" ON "ListingStatusHistory"("actorProfileId", "createdAt");
CREATE INDEX "ListingStatusHistory_toStatus_createdAt_idx" ON "ListingStatusHistory"("toStatus", "createdAt");
CREATE INDEX "SavedListing_listingId_createdAt_idx" ON "SavedListing"("listingId", "createdAt");
CREATE INDEX "ListingEnquiry_listingId_createdAt_idx" ON "ListingEnquiry"("listingId", "createdAt");
CREATE INDEX "ListingEnquiry_conversationId_idx" ON "ListingEnquiry"("conversationId");
CREATE INDEX "ListingEnquiry_fromProfileId_createdAt_idx" ON "ListingEnquiry"("fromProfileId", "createdAt");
CREATE INDEX "ListingEnquiry_toProfileId_status_createdAt_idx" ON "ListingEnquiry"("toProfileId", "status", "createdAt");
CREATE INDEX "ListingReport_status_createdAt_idx" ON "ListingReport"("status", "createdAt");
CREATE INDEX "ListingReport_listingId_createdAt_idx" ON "ListingReport"("listingId", "createdAt");
CREATE INDEX "ListingReport_reporterProfileId_createdAt_idx" ON "ListingReport"("reporterProfileId", "createdAt");
CREATE INDEX "ListingReport_resolvedByProfileId_resolvedAt_idx" ON "ListingReport"("resolvedByProfileId", "resolvedAt");
CREATE INDEX "ListingModerationAction_listingId_createdAt_idx" ON "ListingModerationAction"("listingId", "createdAt");
CREATE INDEX "ListingModerationAction_actorProfileId_createdAt_idx" ON "ListingModerationAction"("actorProfileId", "createdAt");
CREATE INDEX "ListingModerationAction_action_createdAt_idx" ON "ListingModerationAction"("action", "createdAt");
CREATE INDEX "ListingView_listingId_createdAt_idx" ON "ListingView"("listingId", "createdAt");
CREATE INDEX "ListingView_viewerProfileId_createdAt_idx" ON "ListingView"("viewerProfileId", "createdAt");
CREATE INDEX "TrustSafetyFlag_profileId_status_createdAt_idx" ON "TrustSafetyFlag"("profileId", "status", "createdAt");
CREATE INDEX "TrustSafetyFlag_userId_status_createdAt_idx" ON "TrustSafetyFlag"("userId", "status", "createdAt");
CREATE INDEX "TrustSafetyFlag_targetType_targetId_idx" ON "TrustSafetyFlag"("targetType", "targetId");
CREATE INDEX "TrustSafetyFlag_status_severity_createdAt_idx" ON "TrustSafetyFlag"("status", "severity", "createdAt");

INSERT INTO "MarketplaceCategory" ("id", "slug", "name", "description", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('marketplace-category-pups', 'pups', 'Pups', 'Greyhound pups and litters requiring welfare and legal review before public listing.', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('marketplace-category-dogs', 'dogs', 'Dogs', 'Greyhound sale or transfer listings with linked dog context where available.', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('marketplace-category-stud', 'stud-services', 'Stud services', 'Stud service listings and related breeding enquiries.', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('marketplace-category-wanted', 'wanted', 'Wanted', 'Buyer or owner wanted notices.', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('marketplace-category-shares', 'shares', 'Shares', 'Ownership share and syndicate-style listings.', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('marketplace-category-equipment', 'equipment', 'Equipment', 'Non-dog greyhound racing equipment and related items.', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Listing"
SET
  "listingType" = COALESCE("listingType", "type"),
  "moderationStatus" = CASE
    WHEN "status" = 'active' THEN 'approved'
    WHEN "status" = 'rejected' THEN 'rejected'
    WHEN "status" = 'removed' THEN 'removed'
    WHEN "status" = 'pending_review' THEN 'pending_review'
    ELSE "status"
  END;

UPDATE "Listing"
SET "categoryId" = (SELECT "id" FROM "MarketplaceCategory" WHERE "slug" = 'pups')
WHERE "type" = 'pup_for_sale' AND "categoryId" IS NULL;

UPDATE "Listing"
SET "categoryId" = (SELECT "id" FROM "MarketplaceCategory" WHERE "slug" = 'dogs')
WHERE "type" = 'dog_for_sale' AND "categoryId" IS NULL;

UPDATE "Listing"
SET "categoryId" = (SELECT "id" FROM "MarketplaceCategory" WHERE "slug" = 'stud-services')
WHERE "type" = 'stud_service' AND "categoryId" IS NULL;

UPDATE "Listing"
SET "categoryId" = (SELECT "id" FROM "MarketplaceCategory" WHERE "slug" = 'wanted')
WHERE "type" = 'wanted' AND "categoryId" IS NULL;

UPDATE "Listing"
SET "categoryId" = (SELECT "id" FROM "MarketplaceCategory" WHERE "slug" = 'shares')
WHERE "type" = 'share' AND "categoryId" IS NULL;

INSERT INTO "ListingLocation" ("id", "listingId", "state", "createdAt", "updatedAt")
SELECT 'listing-location-' || "id", "id", "state", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Listing"
WHERE "state" IS NOT NULL
ON CONFLICT ("listingId") DO NOTHING;

INSERT INTO "ListingStatusHistory" ("id", "listingId", "fromStatus", "toStatus", "reason", "createdAt")
SELECT 'listing-status-' || "id", "id", NULL, "status", 'Backfilled current listing status', "createdAt"
FROM "Listing";

INSERT INTO "ListingSearchIndex" ("listingId", "searchText", "updatedAt")
SELECT
  "id",
  concat_ws(' ', "title", "description", "type", "state", "greyhoundName", "itemBrand", "itemModel"),
  CURRENT_TIMESTAMP
FROM "Listing"
ON CONFLICT ("listingId") DO UPDATE
SET
  "searchText" = EXCLUDED."searchText",
  "updatedAt" = EXCLUDED."updatedAt";
