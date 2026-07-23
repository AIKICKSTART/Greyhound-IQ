-- Marketplace boost purchase storage (test-mode boost checkout).
CREATE TABLE "ListingBoost" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "viewableImpressionCap" INTEGER NOT NULL,
    "viewableImpressionsUsed" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'aud',
    "stripeSessionId" TEXT,
    "stripePaymentId" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingBoost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingBoost_stripeSessionId_key" ON "ListingBoost"("stripeSessionId");
CREATE INDEX "ListingBoost_listingId_status_idx" ON "ListingBoost"("listingId", "status");
CREATE INDEX "ListingBoost_buyerProfileId_status_idx" ON "ListingBoost"("buyerProfileId", "status");
CREATE INDEX "ListingBoost_status_expiresAt_idx" ON "ListingBoost"("status", "expiresAt");

ALTER TABLE "ListingBoost"
    ADD CONSTRAINT "ListingBoost_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingBoost"
    ADD CONSTRAINT "ListingBoost_buyerProfileId_fkey"
    FOREIGN KEY ("buyerProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: seller reads own boosts; only system/moderator writes (mirrors PaymentRecord).
ALTER TABLE "ListingBoost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingBoost" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_listing_boost_read ON "ListingBoost" FOR SELECT
  USING (
    "buyerProfileId" = public.giq_current_profile_id()
    OR public.giq_is_system()
    OR public.giq_is_moderator()
  );
CREATE POLICY giq_listing_boost_write ON "ListingBoost" FOR ALL
  USING (public.giq_is_system() OR public.giq_is_moderator())
  WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());

-- Policies govern rows; runtime roles still need table privileges. Guarded so the
-- migration is a no-op where the roles are absent (e.g. local single-role dev).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON "ListingBoost" TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "ListingBoost" TO greyhoundiq_app;
  END IF;
END
$$;
