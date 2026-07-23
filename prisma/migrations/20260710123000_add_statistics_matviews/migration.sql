-- /statistics aggregated Result(5.6M) x Runner(6.4M) on every request (box
-- bias, trainer leaderboard, track records) and took minutes. Materialize all
-- three; refreshed hourly by the live-sync results cron alongside
-- giq_sire_leaderboard (REFRESH ... CONCURRENTLY needs the unique indexes).

CREATE MATERIALIZED VIEW IF NOT EXISTS giq_box_bias AS
SELECT rn."boxNumber" AS box,
       COUNT(*)::int AS starts,
       COUNT(*) FILTER (WHERE res."finishingPosition" = 1)::int AS wins
FROM "Result" res
JOIN "Runner" rn ON rn.id = res."runnerId"
WHERE rn."boxNumber" BETWEEN 1 AND 8
GROUP BY rn."boxNumber"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS giq_box_bias_box_idx
  ON giq_box_bias (box);

CREATE MATERIALIZED VIEW IF NOT EXISTS giq_trainer_leaderboard AS
SELECT t.id AS trainer_id,
       t.name AS name,
       COUNT(rn.id)::int AS starters,
       COUNT(*) FILTER (WHERE res."finishingPosition" = 1)::int AS wins,
       COALESCE(SUM(rn."startingPrice") FILTER (WHERE res."finishingPosition" = 1), 0)::float AS winsp
FROM "Runner" rn
JOIN "Result" res ON res."runnerId" = rn.id
JOIN "Trainer" t ON t.id = rn."trainerId"
GROUP BY t.id, t.name
HAVING COUNT(rn.id) >= 5
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS giq_trainer_leaderboard_trainer_id_idx
  ON giq_trainer_leaderboard (trainer_id);
CREATE INDEX IF NOT EXISTS giq_trainer_leaderboard_rank_idx
  ON giq_trainer_leaderboard (wins DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS giq_track_records AS
SELECT DISTINCT ON (tr.name, ra.distance)
       tr.name AS track,
       ra.distance AS dist,
       res."runningTime" AS time,
       d.name AS dog,
       EXTRACT(YEAR FROM ra."raceTime")::int AS year
FROM "Result" res
JOIN "Runner" rn ON rn.id = res."runnerId"
JOIN "Race" ra ON ra.id = rn."raceId"
JOIN "Meeting" m ON m.id = ra."meetingId"
JOIN "Track" tr ON tr.id = m."trackId"
JOIN "Dog" d ON d.id = rn."dogId"
WHERE res."runningTime" IS NOT NULL
ORDER BY tr.name, ra.distance, res."runningTime" ASC
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS giq_track_records_track_dist_idx
  ON giq_track_records (track, dist);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT ON giq_box_bias TO greyhoundiq_runtime;
    GRANT SELECT ON giq_trainer_leaderboard TO greyhoundiq_runtime;
    GRANT SELECT ON giq_track_records TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT ON giq_box_bias TO greyhoundiq_app;
    GRANT SELECT ON giq_trainer_leaderboard TO greyhoundiq_app;
    GRANT SELECT ON giq_track_records TO greyhoundiq_app;
  END IF;
END;
$$;
