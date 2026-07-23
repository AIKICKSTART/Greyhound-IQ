\set ON_ERROR_STOP on

SELECT (to_regclass('cron.job') IS NOT NULL)::text AS has_cron_job \gset
\if :has_cron_job
  SELECT count(*)::text AS active_cron_jobs FROM cron.job WHERE active \gset
\else
  \set active_cron_jobs 0
\endif

SELECT (to_regclass('pgagent.pga_job') IS NOT NULL)::text AS has_pgagent_job \gset
\if :has_pgagent_job
  SELECT count(*)::text AS active_pgagent_jobs FROM pgagent.pga_job WHERE jobenabled \gset
\else
  \set active_pgagent_jobs 0
\endif

SELECT jsonb_build_object(
  'database', current_database(),
  'capturedAt', clock_timestamp(),
  'enabledSubscriptions', (
    SELECT count(*) FROM pg_subscription WHERE subenabled
  ),
  'activeCronJobs', :'active_cron_jobs'::bigint,
  'activePgAgentJobs', :'active_pgagent_jobs'::bigint,
  'preparedTransactions', (
    SELECT count(*) FROM pg_prepared_xacts WHERE database=current_database()
  ),
  'enabledEventTriggers', (
    SELECT count(*) FROM pg_event_trigger WHERE evtenabled <> 'D'
  )
);
