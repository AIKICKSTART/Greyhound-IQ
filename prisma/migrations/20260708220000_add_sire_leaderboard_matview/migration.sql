-- Sire leaderboard aggregates Dog x Dog x Runner(6.4M) x Result(5.6M) and was
-- taking 200s+ per page view. Materialize it; refreshed hourly by the
-- live-sync results cron (REFRESH ... CONCURRENTLY needs the unique index).
CREATE MATERIALIZED VIEW IF NOT EXISTS giq_sire_leaderboard AS
SELECT s.id AS sire_id,
       s.name AS name,
       COUNT(DISTINCT child.id)::int AS progeny,
       COUNT(DISTINCT child.id) FILTER (WHERE res."finishingPosition" = 1)::int AS winners,
       COALESCE(SUM(ra."prizeMoney") FILTER (WHERE res."finishingPosition" = 1), 0)::float AS earnings
FROM "Dog" s
JOIN "Dog" child ON child."sireId" = s.id
LEFT JOIN "Runner" rn ON rn."dogId" = child.id
LEFT JOIN "Result" res ON res."runnerId" = rn.id
LEFT JOIN "Race" ra ON ra.id = rn."raceId"
GROUP BY s.id, s.name
HAVING COUNT(DISTINCT child.id) > 0
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS giq_sire_leaderboard_sire_id_idx
  ON giq_sire_leaderboard (sire_id);
CREATE INDEX IF NOT EXISTS giq_sire_leaderboard_rank_idx
  ON giq_sire_leaderboard (winners DESC, progeny DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT ON giq_sire_leaderboard TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT ON giq_sire_leaderboard TO greyhoundiq_app;
  END IF;
END;
$$;
