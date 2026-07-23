\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  observed_phase text;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'GALTD stage database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE;
  IF observed_phase NOT IN ('export_staged', 'galtd_staged') THEN
    RAISE EXCEPTION 'GALTD stage requires export_staged, observed %', observed_phase;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS _giq_history_stage.galtd_observation (
  line_number bigint PRIMARY KEY,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS _giq_history_stage.galtd_assertion (
  line_number bigint PRIMARY KEY,
  payload jsonb NOT NULL
);

TRUNCATE _giq_history_stage.galtd_observation;
TRUNCATE _giq_history_stage.galtd_assertion;

UPDATE _giq_history_merge.run
SET galtd_load_started_at = clock_timestamp()
WHERE id = 1;

REVOKE ALL ON _giq_history_stage.galtd_observation FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.galtd_assertion FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event', 'GALTD_STAGE_READY',
  'database', current_database(),
  'phase', phase
)
FROM _giq_history_merge.run WHERE id = 1;
