-- Additive replacement for the legacy price-derived trainer leaderboard. The old
-- view remains available until all pre-removal application revisions retire.
CREATE MATERIALIZED VIEW IF NOT EXISTS giq_trainer_performance AS
SELECT t.id AS trainer_id,
       t.name AS name,
       COUNT(*)::int AS starts,
       COUNT(*) FILTER (WHERE res."finishingPosition" = 1)::int AS wins,
       COUNT(*) FILTER (WHERE res."finishingPosition" BETWEEN 1 AND 3)::int AS places,
       ROUND(
         100.0 * COUNT(*) FILTER (WHERE res."finishingPosition" = 1)
         / NULLIF(COUNT(*), 0),
         1
       )::float AS win_rate,
       COALESCE(SUM(res."prizeMoneyWon"), 0)::float AS prize_money
FROM "Runner" rn
JOIN "Result" res ON res."runnerId" = rn.id
JOIN "Trainer" t ON t.id = rn."trainerId"
WHERE res."finishingPosition" IS NOT NULL
GROUP BY t.id, t.name
HAVING COUNT(*) >= 5
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS giq_trainer_performance_trainer_id_idx
  ON giq_trainer_performance (trainer_id);
CREATE INDEX IF NOT EXISTS giq_trainer_performance_rank_idx
  ON giq_trainer_performance (wins DESC, places DESC, prize_money DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT ON giq_trainer_performance TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT ON giq_trainer_performance TO greyhoundiq_app;
  END IF;
END;
$$;
