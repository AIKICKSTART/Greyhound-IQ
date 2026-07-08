-- pg_trgm powers the trigram GIN indexes used by dog/race name search.
-- Idempotent: the extension and Dog_name_trgm_idx already exist from
-- 20260704120000_add_race_search_indexes; this re-asserts them safely.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN on Dog(name) — not expressible as a Prisma @@index (GIN + gin_trgm_ops),
-- kept in raw SQL. Already created by 20260704120000; IF NOT EXISTS makes this a no-op.
CREATE INDEX IF NOT EXISTS "Dog_name_trgm_idx"
  ON "Dog" USING gin ("name" gin_trgm_ops);

-- Backs the default marketplace listing query in fetchMarketplaceListings:
-- WHERE status='active' AND moderationStatus='approved' AND (expiresAt IS NULL OR expiresAt >= now)
-- ORDER BY createdAt DESC. Mirrored by @@index in schema.prisma (Listing).
CREATE INDEX IF NOT EXISTS "Listing_status_moderationStatus_expiresAt_createdAt_idx"
  ON "Listing" ("status", "moderationStatus", "expiresAt", "createdAt");

-- Backs the public feed query in getFeedPostsForViewer:
-- WHERE status='active' AND visibility='public' ORDER BY pinnedAt DESC, createdAt DESC.
-- Mirrored by @@index in schema.prisma (FeedPost).
CREATE INDEX IF NOT EXISTS "FeedPost_status_visibility_pinnedAt_createdAt_idx"
  ON "FeedPost" ("status", "visibility", "pinnedAt", "createdAt");
