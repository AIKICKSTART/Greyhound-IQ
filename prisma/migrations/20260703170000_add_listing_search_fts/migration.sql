CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "ListingSearchIndex_searchText_fts_idx"
  ON "ListingSearchIndex"
  USING GIN (to_tsvector('english', COALESCE("searchText", '')));

CREATE INDEX IF NOT EXISTS "ListingSearchIndex_searchText_trgm_idx"
  ON "ListingSearchIndex"
  USING GIN ("searchText" gin_trgm_ops);
