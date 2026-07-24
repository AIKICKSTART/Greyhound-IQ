-- Supports bounded previous-official-weight lookups without blocking racing
-- writes while the 4.8M-row FormEntry index is built.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FormEntry_dogId_weight_date_idx"
  ON "FormEntry"("dogId", "date" DESC)
  WHERE "weight" IS NOT NULL;
