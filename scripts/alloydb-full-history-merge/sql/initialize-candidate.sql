\set ON_ERROR_STOP on
SELECT to_regprocedure('pg_catalog.sha256(bytea)') IS NOT NULL AS core_sha256_available \gset
\if :core_sha256_available
\else
  \warn 'PostgreSQL core sha256(bytea) is unavailable; deterministic candidate hashing is refused'
  \quit 3
\endif

SELECT (
  current_database()='giq_production_candidate_20260716_r1'
  AND (:'clone_claim'::jsonb->>'phase')='source_restored'
  AND (:'clone_claim'::jsonb->'candidate'->>'database')=current_database()
  AND (:'clone_claim'::jsonb->'candidate'->>'owner')=(
    SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()
  )
  AND (:'clone_claim'::jsonb->'candidate'->>'oid')::oid=(
    SELECT oid FROM pg_database WHERE datname=current_database()
  )
  AND (SELECT pg_database_size(oid)>0
       FROM pg_database WHERE datname=current_database())
  AND abs((:'clone_claim'::jsonb->'candidate'->>'bytes')::bigint-(
        SELECT pg_database_size(oid) FROM pg_database WHERE datname=current_database()
      )) <= GREATEST(1::bigint,LEAST(67108864::bigint,
        (:'clone_claim'::jsonb->'candidate'->>'bytes')::bigint/100))
) AS physical_clone_identity_valid \gset
\if :physical_clone_identity_valid
\else
  \warn 'physical template clone candidate identity or pre-initialization byte count changed'
  \quit 3
\endif

BEGIN;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle = 'ISO, MDY';
SET LOCAL IntervalStyle = 'postgres';
SET LOCAL bytea_output = 'hex';
SET LOCAL extra_float_digits = 1;
SET LOCAL lock_timeout = '10s';
SET LOCAL app.system = 'true';
SET LOCAL "app.current_role" = 'system';
SET LOCAL app.current_tier = 'system';

CREATE TEMP TABLE physical_clone_input AS
SELECT :'clone_claim'::jsonb AS claim;

DO $$
DECLARE
  relation record;
BEGIN
  FOR relation IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
    ORDER BY c.relname
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',relation.table_name);
  END LOOP;
END
$$;

DO $$
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'candidate initialization database mismatch';
  END IF;
  IF to_regnamespace('_giq_history_merge') IS NOT NULL
     OR to_regnamespace('_giq_history_stage') IS NOT NULL THEN
    RAISE EXCEPTION 'candidate merge schemas already exist';
  END IF;
END
$$;

CREATE SCHEMA _giq_history_merge;
CREATE SCHEMA _giq_history_stage;
REVOKE ALL ON SCHEMA _giq_history_merge FROM PUBLIC;
REVOKE ALL ON SCHEMA _giq_history_stage FROM PUBLIC;

CREATE TABLE _giq_history_merge.run (
  id integer PRIMARY KEY CHECK (id = 1),
  workflow_version text NOT NULL,
  phase text NOT NULL CHECK (phase IN (
    'cloned',
    'schema_migrated',
    'r2_staged',
    'export_staged',
    'galtd_staged',
    'normalized',
    'canonical_merged',
    'delta_applied',
    'verified'
  )),
  source_production_database text NOT NULL,
  source_history_database text NOT NULL,
  source_history_archive_sha256 text NOT NULL,
  source_history_max_race_epoch_ms bigint NOT NULL,
  source_history_cutoff timestamptz NOT NULL,
  normalized_manifest_sha256 text NOT NULL,
  normalized_transform_version text NOT NULL,
  clone_operation_id uuid NOT NULL,
  clone_method text NOT NULL CHECK (clone_method = 'physical_template'),
  source_production_oid oid NOT NULL,
  candidate_database_oid oid NOT NULL,
  clone_completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  clone_proof jsonb NOT NULL CHECK (jsonb_typeof(clone_proof) = 'object'),
  schema_migrated_at timestamptz,
  migration_source_sha256 text,
  migration_manifest jsonb,
  post_migration_catalog jsonb,
  r2_staged_at timestamptz,
  r2_stage_manifest jsonb,
  export_load_started_at timestamptz,
  export_staged_at timestamptz,
  export_stage_manifest jsonb,
  galtd_load_started_at timestamptz,
  galtd_staged_at timestamptz,
  galtd_stage_manifest jsonb,
  normalized_at timestamptz,
  normalization_manifest jsonb,
  replay_normalization_verified_at timestamptz,
  replay_artifact_sha256 text,
  replay_artifact_rows bigint,
  replay_evidence_contract_sha256 text,
  replay_evidence_staged_at timestamptz,
  canonical_merged_at timestamptz,
  canonical_merge_manifest jsonb,
  replay_backfill_completed_at timestamptz,
  replay_backfill_manifest jsonb,
  live_delta_applied_at timestamptz,
  live_delta_source_manifest jsonb,
  verified_at timestamptz,
  verification_manifest jsonb,
  runtime_grants_verified_at timestamptz,
  runtime_grants_manifest jsonb
);

CREATE TABLE _giq_history_merge.snapshot_table_manifest (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  row_digest text NOT NULL,
  min_primary_key text,
  max_primary_key text,
  historical_core boolean NOT NULL
);

CREATE TABLE _giq_history_merge.source_snapshot_manifest (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  row_digest text NOT NULL,
  row_security boolean NOT NULL,
  force_rls boolean NOT NULL
);
CREATE TABLE _giq_history_merge.physical_clone_proof (
  id integer PRIMARY KEY CHECK(id=1),
  operation_id uuid NOT NULL,
  source_database text NOT NULL,
  source_oid oid NOT NULL,
  source_owner text NOT NULL,
  source_bytes bigint NOT NULL,
  candidate_database text NOT NULL,
  candidate_oid oid NOT NULL,
  candidate_owner text NOT NULL,
  candidate_bytes bigint NOT NULL,
  sessions_observed bigint NOT NULL,
  sessions_terminated bigint NOT NULL,
  sessions_already_gone bigint NOT NULL,
  source_connection_restored boolean NOT NULL,
  database_metadata_intentionally_isolated boolean NOT NULL,
  force_rls_table_count bigint NOT NULL,
  all_tables_hashed boolean NOT NULL,
  force_rls_restored boolean NOT NULL,
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object')
);

CREATE TABLE _giq_history_merge.snapshot_core_key (
  table_name text NOT NULL,
  primary_key_text text NOT NULL,
  PRIMARY KEY(table_name,primary_key_text)
);

CREATE TABLE _giq_history_merge.quarantine (
  source_name text NOT NULL,
  entity_type text NOT NULL,
  source_key text NOT NULL,
  reason_code text NOT NULL,
  disposition text NOT NULL,
  blocking boolean NOT NULL DEFAULT true,
  evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (source_name, entity_type, source_key, reason_code)
);

CREATE TABLE _giq_history_merge.disposition (
  source_name text NOT NULL,
  issue_type text NOT NULL,
  source_key text NOT NULL,
  disposition_code text NOT NULL,
  canonical_entity_type text,
  canonical_natural_key text,
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (source_name, issue_type, source_key)
);

CREATE TABLE _giq_history_merge.reconciliation_manifest (
  entity_type text PRIMARY KEY,
  r2_rows bigint NOT NULL,
  export_rows bigint NOT NULL,
  normalized_rows bigint NOT NULL,
  overlap_rows bigint NOT NULL,
  r2_only_rows bigint NOT NULL,
  export_only_rows bigint NOT NULL,
  quarantined_rows bigint NOT NULL,
  details jsonb NOT NULL
);

CREATE TABLE _giq_history_merge.verification_check (
  check_name text PRIMARY KEY,
  metrics jsonb NOT NULL CHECK (jsonb_typeof(metrics) = 'object'),
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TEMP TABLE physical_table_catalog ON COMMIT DROP AS
SELECT c.oid AS relation_oid,
       c.relname AS table_name,
       c.relrowsecurity AS row_security,
       c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p');

DO $$
DECLARE
  claim jsonb;
  relation record;
BEGIN
  SELECT input.claim INTO claim FROM physical_clone_input input;

  IF claim->>'phase' <> 'source_restored'
     OR claim->>'workflowVersion' <> 'giq-full-history-merge/v3'
     OR claim->'source'->>'database' <> 'giq_rehearsal_restore_v8'
     OR claim->'source'->>'owner' <> 'postgres'
     OR claim->'candidate'->>'database' <> current_database()
     OR claim->'candidate'->>'owner' <> 'postgres'
     OR (claim->'candidate'->>'bytes')::bigint <= 0
     OR (claim->'candidate'->>'bytes')::bigint > (claim->'source'->>'bytes')::bigint
     OR (claim->'source'->>'bytes')::bigint-(claim->'candidate'->>'bytes')::bigint >
        GREATEST(1::bigint,
          LEAST(67108864::bigint,(claim->'source'->>'bytes')::bigint/100))
     OR coalesce((claim->'evidence'->'physicalCloneSizeCompatibility'->>'verified')::boolean,false) IS NOT TRUE
     OR coalesce((claim->'evidence'->'physicalCloneSizeCompatibility'->>'sizeIsAllocationSanityOnly')::boolean,false) IS NOT TRUE
     OR coalesce((claim->'evidence'->'physicalCloneSizeCompatibility'->>'sourceBytes')::bigint,-1)
          <> (claim->'source'->>'bytes')::bigint
     OR coalesce((claim->'evidence'->'physicalCloneSizeCompatibility'->>'candidateBytes')::bigint,-1)
          <> (claim->'candidate'->>'bytes')::bigint
     OR coalesce((claim->'evidence'->'physicalCloneSizeCompatibility'->>'deltaBytes')::bigint,-1)
          <> (claim->'source'->>'bytes')::bigint-(claim->'candidate'->>'bytes')::bigint
     OR coalesce((claim->'evidence'->'physicalCloneSizeCompatibility'->>'allowedDeltaBytes')::bigint,-1)
          <> GREATEST(1::bigint,
            LEAST(67108864::bigint,(claim->'source'->>'bytes')::bigint/100))
     OR coalesce((claim->'evidence'->'candidateAllocationObservation'->>'verified')::boolean,false) IS NOT TRUE
     OR coalesce((claim->'evidence'->'candidateAllocationObservation'->>'sizeIsAllocationSanityOnly')::boolean,false) IS NOT TRUE
     OR coalesce((claim->'evidence'->'candidateAllocationObservation'->>'creationBytes')::bigint,-1)
          <> (claim->'candidate'->>'bytes')::bigint
     OR coalesce((claim->'evidence'->'candidateAllocationObservation'->>'observedBytes')::bigint,-1)
          <> coalesce((claim->'evidence'->'candidateIsolation'->'candidateMetadata'->>'bytes')::bigint,-2)
     OR coalesce((claim->'evidence'->'candidateAllocationObservation'->>'absoluteDeltaBytes')::bigint,-1)
          <> abs((claim->'candidate'->>'bytes')::bigint-
            coalesce((claim->'evidence'->'candidateAllocationObservation'->>'observedBytes')::bigint,-2))
     OR coalesce((claim->'evidence'->'candidateAllocationObservation'->>'allowedDeltaBytes')::bigint,-1)
          <> GREATEST(1::bigint,
            LEAST(67108864::bigint,(claim->'candidate'->>'bytes')::bigint/100))
     OR coalesce((claim->'evidence'->'candidateAllocationObservation'->>'absoluteDeltaBytes')::bigint,-1) >
          coalesce((claim->'evidence'->'candidateAllocationObservation'->>'allowedDeltaBytes')::bigint,-2)
     OR coalesce((claim->'evidence'->'sourceFence'->>'restored')::boolean, false) IS NOT TRUE
     OR coalesce((claim->'evidence'->'terminationProof'->>'refused')::bigint, -1) <> 0
     OR coalesce((claim->'evidence'->'candidateIsolation'->>'publicPrivilegesRevoked')::boolean, false) IS NOT TRUE
     OR coalesce((claim->'evidence'->'candidateIsolation'->>'databaseSettingsNotCopied')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'physical template clone claim is incomplete or inconsistent';
  END IF;

  IF (claim->'evidence'->'terminationProof'->>'expected')::bigint <>
     (claim->'evidence'->'terminationProof'->>'terminated')::bigint +
     (claim->'evidence'->'terminationProof'->>'alreadyGone')::bigint
     OR (claim->'evidence'->'terminationProof'->>'expected')::bigint <>
        (claim->'evidence'->'postFenceSessions'->>'total')::bigint
     OR coalesce((claim->'evidence'->'drainedSessions'->>'total')::bigint,-1) <> 0 THEN
    RAISE EXCEPTION 'physical template clone session termination proof does not reconcile';
  END IF;

  IF coalesce((claim->'evidence'->'automationInventory'->>'enabledSubscriptions')::bigint,-1) <> 0
     OR coalesce((claim->'evidence'->'automationInventory'->>'activeCronJobs')::bigint,-1) <> 0
     OR coalesce((claim->'evidence'->'automationInventory'->>'activePgAgentJobs')::bigint,-1) <> 0
     OR coalesce((claim->'evidence'->'automationInventory'->>'preparedTransactions')::bigint,-1) <> 0
     OR coalesce((claim->'evidence'->'automationInventory'->>'enabledEventTriggers')::bigint,-1) <> 0 THEN
    RAISE EXCEPTION 'physical template clone source automation inventory is unsafe';
  END IF;

  IF has_database_privilege('public',current_database(),'CONNECT')
     OR has_database_privilege('public',current_database(),'CREATE')
     OR has_database_privilege('public',current_database(),'TEMP')
     OR EXISTS(
        SELECT 1 FROM pg_db_role_setting
        WHERE setdatabase=(SELECT oid FROM pg_database WHERE datname=current_database())
     )
     OR EXISTS(
       SELECT 1
       FROM pg_database database
       CROSS JOIN LATERAL aclexplode(
         coalesce(database.datacl,acldefault('d',database.datdba))
       ) privilege
       WHERE database.datname=current_database()
         AND privilege.grantee<>database.datdba
     )
     OR (
       SELECT array_agg(privilege.privilege_type ORDER BY privilege.privilege_type)
       FROM pg_database database
       CROSS JOIN LATERAL aclexplode(
         coalesce(database.datacl,acldefault('d',database.datdba))
       ) privilege
       WHERE database.datname=current_database()
         AND privilege.grantee=database.datdba
     ) IS DISTINCT FROM ARRAY['CONNECT','CREATE','TEMPORARY']::text[]
     THEN
    RAISE EXCEPTION 'physical template clone candidate database metadata is not isolated';
  END IF;

  IF (SELECT count(*) FROM physical_table_catalog) = 0 THEN
    RAISE EXCEPTION 'physical template clone contains no public tables';
  END IF;

  FOR relation IN
    SELECT table_name FROM physical_table_catalog WHERE force_rls ORDER BY table_name
  LOOP
    EXECUTE format('ALTER TABLE ONLY public.%I NO FORCE ROW LEVEL SECURITY', relation.table_name);
  END LOOP;
END
$$;

SET LOCAL row_security=off;

DO $$
DECLARE
  relation record;
  primary_key_order text;
  primary_key_column_count integer;
  primary_key_single_name text;
  row_count_value bigint;
  row_digest_value text;
  min_key_value text;
  max_key_value text;
BEGIN
  FOR relation IN
    SELECT relation_oid AS oid, table_name AS relname, row_security, force_rls
    FROM physical_table_catalog
    ORDER BY table_name
  LOOP
    SELECT 'jsonb_build_array(' || string_agg(format('t.%I', a.attname), ', ' ORDER BY k.ordinality) || ')::text COLLATE "C"',
           count(*)::integer,
           CASE WHEN count(*) = 1 THEN min(a.attname) END
    INTO primary_key_order, primary_key_column_count, primary_key_single_name
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    WHERE i.indrelid = relation.oid
      AND i.indisprimary;

    IF primary_key_order IS NULL THEN
      RAISE EXCEPTION 'public table % has no primary key', relation.relname;
    END IF;

    EXECUTE format(
      'SELECT count(*), encode(pg_catalog.sha256(convert_to(COALESCE(string_agg(encode(pg_catalog.sha256(convert_to(to_jsonb(t)::text, ''UTF8'')), ''hex''), '''' ORDER BY %s), ''''), ''UTF8'')), ''hex''), min(%s), max(%s) FROM public.%I t',
      primary_key_order,
      primary_key_order,
      primary_key_order,
      relation.relname
    )
    INTO row_count_value, row_digest_value, min_key_value, max_key_value;

    INSERT INTO _giq_history_merge.source_snapshot_manifest (
      table_name, row_count, row_digest, row_security, force_rls
    ) VALUES (
      relation.relname, row_count_value, row_digest_value,
      relation.row_security, relation.force_rls
    );

    INSERT INTO _giq_history_merge.snapshot_table_manifest (
      table_name,
      row_count,
      row_digest,
      min_primary_key,
      max_primary_key,
      historical_core
    ) VALUES (
      relation.relname,
      row_count_value,
      row_digest_value,
      min_key_value,
      max_key_value,
      relation.relname = ANY (ARRAY[
        'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
        'DogProfileForm','RaceVideo','RaceDayArchive','DogProfileArchive'
      ])
    );
    IF relation.relname = ANY (ARRAY[
      'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
      'DogProfileForm','RaceVideo','RaceDayArchive','DogProfileArchive'
    ]) THEN
      IF primary_key_column_count <> 1 OR primary_key_single_name <> 'id' THEN
        RAISE EXCEPTION 'historical core table % no longer has the reviewed single id primary key',relation.relname;
      END IF;
      EXECUTE format(
        'INSERT INTO _giq_history_merge.snapshot_core_key(table_name,primary_key_text) '
        'SELECT %L,id::text FROM public.%I',relation.relname,relation.relname);
    END IF;
  END LOOP;

  IF EXISTS(
    SELECT 1
    FROM _giq_history_merge.source_snapshot_manifest source
    FULL JOIN _giq_history_merge.snapshot_table_manifest restored USING(table_name)
    WHERE source.table_name IS NULL OR restored.table_name IS NULL
      OR (source.row_count,source.row_digest) IS DISTINCT FROM (restored.row_count,restored.row_digest)
  ) THEN
    RAISE EXCEPTION 'physical candidate full-row manifest is not internally exact';
  END IF;
END
$$;

DO $$
DECLARE
  relation record;
  claim jsonb;
BEGIN
  FOR relation IN
    SELECT table_name FROM physical_table_catalog WHERE force_rls ORDER BY table_name
  LOOP
    EXECUTE format('ALTER TABLE ONLY public.%I FORCE ROW LEVEL SECURITY', relation.table_name);
  END LOOP;

  IF EXISTS(
    SELECT 1
    FROM physical_table_catalog source
    FULL JOIN (
      SELECT c.relname AS table_name,
             c.relrowsecurity AS row_security,
             c.relforcerowsecurity AS force_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p')
    ) observed_catalog USING(table_name)
    WHERE source.table_name IS NULL OR observed_catalog.table_name IS NULL
       OR (source.row_security,source.force_rls) IS DISTINCT FROM
          (observed_catalog.row_security,observed_catalog.force_rls)
  ) THEN
    RAISE EXCEPTION 'candidate row-security flags were not restored exactly';
  END IF;

  SELECT input.claim INTO claim FROM physical_clone_input input;
  INSERT INTO _giq_history_merge.physical_clone_proof (
    id, operation_id,
    source_database, source_oid, source_owner, source_bytes,
    candidate_database, candidate_oid, candidate_owner, candidate_bytes,
    sessions_observed, sessions_terminated, sessions_already_gone,
    source_connection_restored, database_metadata_intentionally_isolated,
    force_rls_table_count, all_tables_hashed, force_rls_restored, evidence
  ) VALUES (
    1,
    (claim->>'operationId')::uuid,
    claim->'source'->>'database',
    (claim->'source'->>'oid')::oid,
    claim->'source'->>'owner',
    (claim->'source'->>'bytes')::bigint,
    claim->'candidate'->>'database',
    (claim->'candidate'->>'oid')::oid,
    claim->'candidate'->>'owner',
    (claim->'candidate'->>'bytes')::bigint,
    (claim->'evidence'->'postFenceSessions'->>'total')::bigint,
    (claim->'evidence'->'terminationProof'->>'terminated')::bigint,
    (claim->'evidence'->'terminationProof'->>'alreadyGone')::bigint,
    true,
    true,
    (SELECT count(*) FROM physical_table_catalog WHERE force_rls),
    true,
    true,
    claim->'evidence'
  );
END
$$;

SET LOCAL row_security=on;

INSERT INTO _giq_history_merge.run (
  id,
  workflow_version,
  phase,
  source_production_database,
  source_history_database,
  source_history_archive_sha256,
  source_history_max_race_epoch_ms,
  source_history_cutoff,
  normalized_manifest_sha256,
  normalized_transform_version,
  clone_operation_id,
  clone_method,
  source_production_oid,
  candidate_database_oid,
  clone_completed_at,
  clone_proof
)
VALUES (
  1,
  :'workflow_version',
  'cloned',
  :'production_database',
  :'history_database',
  :'history_archive_sha256',
  :'history_max_race_epoch_ms'::bigint,
  :'history_source_cutoff'::timestamptz,
  :'normalized_manifest_sha256',
  :'normalized_transform_version',
  ((SELECT claim FROM physical_clone_input)->>'operationId')::uuid,
  'physical_template',
  ((SELECT claim FROM physical_clone_input)->'source'->>'oid')::oid,
  ((SELECT claim FROM physical_clone_input)->'candidate'->>'oid')::oid,
  ((SELECT claim FROM physical_clone_input)->'evidence'->'sourceFence'->>'restoredAt')::timestamptz,
  jsonb_build_object(
    'baseTables', (
      SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ),
    'completedMigrations', (
      SELECT count(*) FROM public."_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ),
    'unfinishedMigrations', (
      SELECT count(*) FROM public."_prisma_migrations"
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ),
    'foreignKeys', (SELECT count(*) FROM pg_constraint WHERE contype = 'f'),
    'invalidForeignKeys', (
      SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND NOT convalidated
    ),
    'invalidConstraints', (
      SELECT jsonb_agg(conname ORDER BY conname)
      FROM pg_constraint WHERE NOT convalidated
    ),
    'disabledTriggers', (SELECT count(*) FROM pg_trigger WHERE tgenabled = 'D'),
    'users', (SELECT count(*) FROM public."User"),
    'races', (SELECT count(*) FROM public."Race"),
    'runners', (SELECT count(*) FROM public."Runner"),
    'results', (SELECT count(*) FROM public."Result"),
    'raceVideos', (SELECT count(*) FROM public."RaceVideo"),
    'latestRaceTime', (SELECT max("raceTime") FROM public."Race"),
    'latestRaceSync', (SELECT max("lastSyncedAt") FROM public."Race"),
    'physicalTemplateProof',(
      SELECT to_jsonb(proof) FROM _giq_history_merge.physical_clone_proof proof WHERE id=1
    ),
    'allTablesHashed',true,
    'forceRlsRestored',true,
    'databaseMetadataIntentionallyIsolated',true
  )
);

REVOKE ALL ON ALL TABLES IN SCHEMA _giq_history_merge FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA _giq_history_stage FROM PUBLIC;

COMMIT;

ANALYZE _giq_history_merge.run;

SELECT jsonb_build_object(
  'event', 'CANDIDATE_PHYSICAL_TEMPLATE_INITIALIZED',
  'database', current_database(),
  'phase', phase,
  'cloneOperationId', clone_operation_id,
  'cloneMethod', clone_method,
  'sourceOid', source_production_oid,
  'candidateOid', candidate_database_oid,
  'proof', clone_proof
)
FROM _giq_history_merge.run
WHERE id = 1;
