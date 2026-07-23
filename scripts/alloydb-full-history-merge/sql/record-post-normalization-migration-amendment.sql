\set ON_ERROR_STOP on

BEGIN;
SET LOCAL app.system = 'true';
SET LOCAL "app.current_role" = 'system';
SET LOCAL app.current_tier = 'system';
SET LOCAL synchronous_commit = on;
SET LOCAL giq.authorized_migrations = :'authorized_migrations';
SET LOCAL giq.confirmation = :'confirmation';

SELECT pg_advisory_xact_lock(hashtextextended(
  'giq-post-normalization-migration-amendment/v1', 0
));

CREATE TABLE IF NOT EXISTS _giq_history_merge.post_normalization_migration_amendment (
  id integer PRIMARY KEY CHECK (id = 1),
  schema_version text NOT NULL CHECK (
    schema_version = 'giq-post-normalization-migration-amendment/v1'
  ),
  candidate_database text NOT NULL,
  candidate_database_oid oid NOT NULL,
  normalized_manifest_sha256 text NOT NULL CHECK (
    normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'
  ),
  normalized_at timestamptz NOT NULL,
  baseline_rows bigint NOT NULL,
  baseline_md5 text NOT NULL CHECK (baseline_md5 ~ '^[0-9a-f]{32}$'),
  current_rows bigint NOT NULL,
  current_md5 text NOT NULL CHECK (current_md5 ~ '^[0-9a-f]{32}$'),
  completed_migrations bigint NOT NULL,
  rolled_back_migrations bigint NOT NULL,
  authorized_migrations jsonb NOT NULL CHECK (
    jsonb_typeof(authorized_migrations) = 'array'
  ),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid =
      '_giq_history_merge.post_normalization_migration_amendment'::regclass
      AND tgname = 'post_normalization_migration_amendment_append_only'
  ) THEN
    CREATE TRIGGER post_normalization_migration_amendment_append_only
    BEFORE UPDATE OR DELETE
    ON _giq_history_merge.post_normalization_migration_amendment
    FOR EACH ROW EXECUTE FUNCTION
      _giq_history_merge.reject_clean_partition_evidence_mutation();
  END IF;
END
$$;

DO $$
DECLARE
  marker _giq_history_merge.run%ROWTYPE;
  protected_baseline _giq_history_merge.protected_table_manifest%ROWTYPE;
  migration_manifest jsonb;
  manifest_rows bigint;
  observed_baseline_rows bigint;
  observed_baseline_md5 text;
  observed_current_rows bigint;
  observed_current_md5 text;
  observed_completed_migrations bigint;
  observed_rolled_back_migrations bigint;
  mismatch_rows bigint;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'post-normalization migration amendment database mismatch';
  END IF;
  IF current_setting('giq.confirmation') <>
     'I_CONFIRM_RECORD_EXACT_POST_NORMALIZATION_MIGRATION_LEDGER_ADDITIONS' THEN
    RAISE EXCEPTION 'post-normalization migration amendment confirmation mismatch';
  END IF;

  migration_manifest := current_setting('giq.authorized_migrations')::jsonb;
  IF jsonb_typeof(migration_manifest) <> 'array'
     OR jsonb_array_length(migration_manifest) = 0 THEN
    RAISE EXCEPTION 'authorized migration manifest must be a non-empty JSON array';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(migration_manifest) item
    WHERE item->>'name' !~ '^[0-9]{14}_[a-z0-9_]+$'
       OR item->>'sha256' !~ '^[0-9a-f]{64}$'
       OR item->>'appliedStepsCount' !~ '^[01]$'
  ) OR (
    SELECT count(*) FROM jsonb_array_elements(migration_manifest)
  ) <> (
    SELECT count(DISTINCT item->>'name')
    FROM jsonb_array_elements(migration_manifest) item
  ) THEN
    RAISE EXCEPTION 'authorized migration manifest contains invalid or duplicate entries';
  END IF;

  SELECT * INTO STRICT marker
  FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE;
  SELECT * INTO STRICT protected_baseline
  FROM _giq_history_merge.protected_table_manifest
  WHERE table_name = '_prisma_migrations';

  IF marker.phase <> 'normalized'
     OR marker.normalized_at IS NULL
     OR marker.canonical_merged_at IS NOT NULL
     OR marker.normalized_manifest_sha256 !~ '^[0-9a-f]{64}$'
     OR marker.candidate_database_oid <>
        (SELECT oid FROM pg_database WHERE datname = current_database()) THEN
    RAISE EXCEPTION 'post-normalization migration amendment requires the bound normalized candidate';
  END IF;

  SELECT count(*),
    md5(coalesce(string_agg(md5(to_jsonb(ledger)::text), ''
      ORDER BY jsonb_build_array(ledger.id)::text), ''))
  INTO observed_baseline_rows, observed_baseline_md5
  FROM public."_prisma_migrations" ledger
  WHERE ledger.started_at <= marker.normalized_at;

  IF observed_baseline_rows <> protected_baseline.row_count
     OR observed_baseline_md5 <> protected_baseline.row_md5 THEN
    RAISE EXCEPTION 'pre-existing Prisma migration ledger changed after normalization';
  END IF;

  SELECT jsonb_array_length(migration_manifest) INTO manifest_rows;
  WITH expected AS (
    SELECT item->>'name' AS migration_name, item->>'sha256' AS checksum,
      (item->>'appliedStepsCount')::integer AS applied_steps_count
    FROM jsonb_array_elements(migration_manifest) item
  ), actual AS (
    SELECT migration_name, checksum, finished_at, rolled_back_at,
      applied_steps_count
    FROM public."_prisma_migrations"
    WHERE started_at > marker.normalized_at
  )
  SELECT count(*) INTO mismatch_rows
  FROM expected
  FULL JOIN actual USING (migration_name)
  WHERE expected.migration_name IS NULL
     OR actual.migration_name IS NULL
     OR expected.checksum IS DISTINCT FROM actual.checksum
     OR actual.finished_at IS NULL
     OR actual.rolled_back_at IS NOT NULL
     OR actual.applied_steps_count IS DISTINCT FROM expected.applied_steps_count;

  IF mismatch_rows <> 0 OR (
    SELECT count(*) FROM public."_prisma_migrations"
    WHERE started_at > marker.normalized_at
  ) <> manifest_rows THEN
    RAISE EXCEPTION 'post-normalization Prisma migration additions do not equal the authorized manifest';
  END IF;

  SELECT count(*),
    md5(coalesce(string_agg(md5(to_jsonb(ledger)::text), ''
      ORDER BY jsonb_build_array(ledger.id)::text), '')),
    count(*) FILTER (
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ),
    count(*) FILTER (WHERE rolled_back_at IS NOT NULL)
  INTO observed_current_rows, observed_current_md5,
    observed_completed_migrations, observed_rolled_back_migrations
  FROM public."_prisma_migrations" ledger;

  IF observed_current_rows <> observed_baseline_rows + manifest_rows THEN
    RAISE EXCEPTION 'post-normalization Prisma migration row conservation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM _giq_history_merge.post_normalization_migration_amendment evidence
    WHERE evidence.id = 1
      AND evidence.candidate_database = current_database()
      AND evidence.candidate_database_oid = marker.candidate_database_oid
      AND evidence.normalized_manifest_sha256 = marker.normalized_manifest_sha256
      AND evidence.baseline_rows = observed_baseline_rows
      AND evidence.baseline_md5 = observed_baseline_md5
      AND evidence.current_rows = observed_current_rows
      AND evidence.current_md5 = observed_current_md5
      AND evidence.completed_migrations = observed_completed_migrations
      AND evidence.rolled_back_migrations = observed_rolled_back_migrations
      AND evidence.authorized_migrations = migration_manifest
  ) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM _giq_history_merge.post_normalization_migration_amendment
  ) THEN
    RAISE EXCEPTION 'post-normalization migration amendment evidence already exists with different values';
  END IF;

  INSERT INTO _giq_history_merge.post_normalization_migration_amendment (
    id, schema_version, candidate_database, candidate_database_oid,
    normalized_manifest_sha256, normalized_at, baseline_rows, baseline_md5,
    current_rows, current_md5, completed_migrations, rolled_back_migrations,
    authorized_migrations
  ) VALUES (
    1, 'giq-post-normalization-migration-amendment/v1', current_database(),
    marker.candidate_database_oid, marker.normalized_manifest_sha256,
    marker.normalized_at, observed_baseline_rows, observed_baseline_md5,
    observed_current_rows, observed_current_md5, observed_completed_migrations,
    observed_rolled_back_migrations, migration_manifest
  );
END
$$;

REVOKE ALL ON _giq_history_merge.post_normalization_migration_amendment
FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event', 'POST_NORMALIZATION_MIGRATION_AMENDMENT_RECORDED',
  'database', candidate_database,
  'baselineRows', baseline_rows,
  'currentRows', current_rows,
  'completedMigrations', completed_migrations,
  'rolledBackMigrations', rolled_back_migrations,
  'authorizedMigrations', authorized_migrations
)
FROM _giq_history_merge.post_normalization_migration_amendment
WHERE id = 1;
