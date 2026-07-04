CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Race_raceNumber_idx"
  ON "Race" ("raceNumber");

CREATE INDEX IF NOT EXISTS "Race_distance_idx"
  ON "Race" ("distance");

CREATE INDEX IF NOT EXISTS "Race_name_trgm_idx"
  ON "Race" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Race_grade_trgm_idx"
  ON "Race" USING GIN ("grade" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Track_name_trgm_idx"
  ON "Track" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Track_state_trgm_idx"
  ON "Track" USING GIN ("state" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Dog_name_trgm_idx"
  ON "Dog" USING GIN ("name" gin_trgm_ops);
