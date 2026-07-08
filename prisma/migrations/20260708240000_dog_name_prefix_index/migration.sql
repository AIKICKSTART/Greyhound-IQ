-- Case-insensitive prefix index for short dog-search queries. A plain btree
-- (Dog_name_idx) can't serve ILIKE 'b%' (case mismatch) and the trigram GIN is
-- useless for 1-2 chars, so short "filter as you type" queries seq-scanned
-- 200k+ rows. text_pattern_ops on lower(name) makes lower(name) LIKE 'b%' an
-- index range scan.
CREATE INDEX IF NOT EXISTS "Dog_lower_name_prefix_idx"
  ON "Dog" (lower("name") text_pattern_ops);
