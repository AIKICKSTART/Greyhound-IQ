\set ON_ERROR_STOP on
\set GIQ_SNAPSHOT_EXPORT 1
\pset tuples_only on
\pset format unaligned

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '90min';
SET LOCAL lock_timeout = '5s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle = 'ISO, YMD';
SET LOCAL IntervalStyle = 'iso_8601';
SET LOCAL extra_float_digits = 3;

\o /tmp/giq-normalized-local-copy/candidate-proof.json
SELECT jsonb_build_object(
  'run', jsonb_build_object(
    'workflow_version', run.workflow_version,
    'phase', run.phase,
    'source_production_database', run.source_production_database,
    'source_history_database', run.source_history_database,
    'source_history_archive_sha256', run.source_history_archive_sha256,
    'snapshot_sha256', run.snapshot_sha256,
    'snapshot_completed_at', run.snapshot_completed_at,
    'canonical_merged_at', run.canonical_merged_at,
    'live_delta_applied_at', run.live_delta_applied_at,
    'verified_at', run.verified_at
  ),
  'checks', coalesce((
    SELECT jsonb_object_agg(
      check_row.check_name,
      check_row.metrics || jsonb_build_object('verifiedAt', check_row.verified_at)
      ORDER BY check_row.check_name
    )
    FROM _giq_history_merge.verification_check check_row
  ), '{}'::jsonb)
)
FROM _giq_history_merge.run run
WHERE run.id = 1;

\o /tmp/giq-normalized-local-copy/reconciliation.json
\ir reconcile-read-only.sql

\o
\ir export-safe-jsonl.sql

\o /tmp/giq-normalized-local-copy/snapshot-proof.json
SELECT jsonb_build_object(
  'database', current_database(),
  'transactionIsolation', current_setting('transaction_isolation'),
  'transactionReadOnly', current_setting('transaction_read_only')::boolean,
  'snapshot', pg_current_snapshot()::text,
  'timeZone', current_setting('TimeZone'),
  'dateStyle', current_setting('DateStyle'),
  'intervalStyle', current_setting('IntervalStyle'),
  'extraFloatDigits', current_setting('extra_float_digits')::integer,
  'candidateSnapshotSha256', run.snapshot_sha256,
  'candidateVerifiedAt', run.verified_at,
  'tableRows', jsonb_build_object(
    'Track', (SELECT count(*) FROM public."Track"),
    'Trainer', (SELECT count(*) FROM public."Trainer"),
    'Dog', (SELECT count(*) FROM public."Dog"),
    'Meeting', (SELECT count(*) FROM public."Meeting"),
    'Race', (SELECT count(*) FROM public."Race"),
    'RaceVideo', (SELECT count(*) FROM public."RaceVideo"),
    'Runner', (SELECT count(*) FROM public."Runner"),
    'Result', (SELECT count(*) FROM public."Result"),
    'FormEntry', (SELECT count(*) FROM public."FormEntry"),
    'DogProfileForm', (SELECT count(*) FROM public."DogProfileForm"),
    'DogProfileArchive', (SELECT count(*) FROM public."DogProfileArchive"),
    'RaceDayArchive', (SELECT count(*) FROM public."RaceDayArchive"),
    'PedigreeImportRun', (SELECT count(*) FROM public."PedigreeImportRun"),
    'DogSourceIdentity', (SELECT count(*) FROM public."DogSourceIdentity"),
    'PedigreeAssertion', (SELECT count(*) FROM public."PedigreeAssertion"),
    'PedigreeMergeLedger', (SELECT count(*) FROM public."PedigreeMergeLedger")
  )
)
FROM _giq_history_merge.run run
WHERE run.id = 1;
\o

COMMIT;
