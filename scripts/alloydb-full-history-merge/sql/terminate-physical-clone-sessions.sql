\set ON_ERROR_STOP on

WITH expected AS (
  SELECT *
  FROM jsonb_to_recordset(:'session_inventory'::jsonb->'sessions') AS session(
    pid integer,
    "backendStart" timestamptz,
    "user" text,
    state text
  )
), observed AS (
  SELECT expected.*,
         activity.pid AS observed_pid,
         activity.backend_start AS observed_backend_start,
         activity.usename AS observed_user,
         activity.state AS observed_state
  FROM expected
  LEFT JOIN pg_stat_activity activity
    ON activity.pid = expected.pid
   AND activity.datname = :'source_database'
), terminated AS (
  SELECT *,
    CASE
      WHEN observed_pid IS NULL THEN 'already_gone'
      WHEN observed_backend_start IS DISTINCT FROM "backendStart"
        OR observed_user IS DISTINCT FROM "user"
        OR observed_state IS DISTINCT FROM 'idle' THEN 'refused_identity_or_state_changed'
      WHEN pg_terminate_backend(observed_pid, 5000) THEN 'terminated'
      ELSE 'termination_failed'
    END AS outcome
  FROM observed
)
SELECT jsonb_build_object(
  'database', :'source_database',
  'capturedAt', clock_timestamp(),
  'expected', count(*),
  'terminated', count(*) FILTER (WHERE outcome = 'terminated'),
  'alreadyGone', count(*) FILTER (WHERE outcome = 'already_gone'),
  'refused', count(*) FILTER (WHERE outcome NOT IN ('terminated', 'already_gone')),
  'sessions', coalesce(jsonb_agg(jsonb_build_object(
    'pid', pid,
    'backendStart', "backendStart",
    'user', "user",
    'expectedState', state,
    'observedState', observed_state,
    'outcome', outcome
  ) ORDER BY pid), '[]'::jsonb)
)
FROM terminated;
