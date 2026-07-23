\set ON_ERROR_STOP on

SELECT jsonb_build_object(
  'database', :'source_database',
  'capturedAt', clock_timestamp(),
  'total', count(*),
  'idle', count(*) FILTER (WHERE state = 'idle'),
  'active', count(*) FILTER (WHERE state = 'active'),
  'idleInTransaction', count(*) FILTER (
    WHERE state IN ('idle in transaction', 'idle in transaction (aborted)')
  ),
  'other', count(*) FILTER (
    WHERE state IS NULL OR state NOT IN (
      'idle', 'active', 'idle in transaction', 'idle in transaction (aborted)'
    )
  ),
  'sessions', coalesce(jsonb_agg(jsonb_build_object(
    'pid', pid,
    'backendStart', backend_start,
    'user', usename,
    'applicationName', application_name,
    'clientAddress', client_addr::text,
    'backendType', backend_type,
    'state', state
  ) ORDER BY pid), '[]'::jsonb)
)
FROM pg_stat_activity
WHERE datname = :'source_database';
