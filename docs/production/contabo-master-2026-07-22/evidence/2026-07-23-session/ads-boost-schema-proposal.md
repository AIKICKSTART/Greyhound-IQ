# Marketplace boost — storage schema proposal (NOT APPLIED)

Status: **BLOCKED, awaiting founder/lead approval.** No migration has been run.
Owner to approve: team lead. Author: advertising/Stripe agent, 2026-07-23.

## Why a schema change is needed

Deliverable 3 (marketplace boost checkout) must "activate the boost" after a
signed Stripe webhook confirms payment. The current `Listing` model
(`prisma/schema.prisma`) has **no** boost / promoted / featured field, and there
is **no** boost-purchase table. Activation needs durable storage for: which
listing is boosted, the package, the hard viewable-impression cap, the active
window, and the payment linkage for finance reconciliation and make-good/refund.

Per repo contract (AGENTS.md forward-only migrations; team-lead instruction to
NOT apply schema changes), this sub-path is stopped here and everything else is
built against the `activateListingBoost` seam in
`src/lib/billing/stripe-webhooks.ts`, which today records the finance
`PaymentRecord` and logs that activation storage is pending. When this migration
is approved and applied, fill in the `db.listingBoost.upsert(...)` at that seam
(marked with a `TODO(schema)` pointing here).

## Proposed Prisma model diff

Add to `prisma/schema.prisma`:

```prisma
model ListingBoost {
  id                      String   @id @default(cuid())
  listingId               String
  listing                 Listing  @relation("ListingBoosts", fields: [listingId], references: [id], onDelete: Cascade)
  buyerProfileId          String
  buyerProfile            Profile  @relation("ListingBoostBuyer", fields: [buyerProfileId], references: [id])
  buyerUserId             String
  packageId               String   // BOOST.STARTER | BOOST.MOMENTUM | BOOST.SHOWCASE
  status                  String   @default("active") // active | expired | refunded | cancelled
  viewableImpressionCap   Int      // booked viewable impressions (hard cap)
  viewableImpressionsUsed Int      @default(0)
  amountCents             Int      // AUD cents charged (GST-inclusive)
  currency                String   @default("aud")
  stripeSessionId         String?  @unique
  stripePaymentId         String?
  activatedAt             DateTime @default(now())
  expiresAt               DateTime // activatedAt + package.maximumDays
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  @@index([listingId, status])
  @@index([buyerProfileId, status])
  @@index([status, expiresAt])
}
```

Add back-relations:

```prisma
// model Listing
boosts        ListingBoost[] @relation("ListingBoosts")

// model Profile
listingBoosts ListingBoost[] @relation("ListingBoostBuyer")
```

## Proposed forward-only migration SQL

`prisma/migrations/<ts>_add_listing_boosts/migration.sql`:

```sql
CREATE TABLE "ListingBoost" (
  "id"                      TEXT NOT NULL,
  "listingId"               TEXT NOT NULL,
  "buyerProfileId"          TEXT NOT NULL,
  "buyerUserId"             TEXT NOT NULL,
  "packageId"               TEXT NOT NULL,
  "status"                  TEXT NOT NULL DEFAULT 'active',
  "viewableImpressionCap"   INTEGER NOT NULL,
  "viewableImpressionsUsed" INTEGER NOT NULL DEFAULT 0,
  "amountCents"             INTEGER NOT NULL,
  "currency"                TEXT NOT NULL DEFAULT 'aud',
  "stripeSessionId"         TEXT,
  "stripePaymentId"         TEXT,
  "activatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"               TIMESTAMP(3) NOT NULL,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
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
CREATE POLICY giq_listing_boost_read ON "ListingBoost" FOR SELECT
  USING (
    "buyerProfileId" = public.giq_current_profile_id()
    OR public.giq_is_system()
    OR public.giq_is_moderator()
  );
CREATE POLICY giq_listing_boost_write ON "ListingBoost" FOR ALL
  USING (public.giq_is_system() OR public.giq_is_moderator())
  WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
```

Confirm the exact helper names against
`prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql`
before applying (`giq_current_profile_id` vs `giq_current_user_id`; PaymentRecord
uses `giq_current_user_id` on `userId`, ListingBoost keys off `buyerProfileId`).

## Seam to fill after approval

`src/lib/billing/stripe-webhooks.ts` → `activateListingBoost(db, settlement)`:
replace the pending-activation log with an idempotent
`db.listingBoost.upsert({ where: { stripeSessionId }, ... })` computing
`expiresAt = activatedAt + package.maximumDays` and
`viewableImpressionCap = package.viewableImpressions`. The `PaymentRecord`
write already lands in the same webhook and is unaffected.
