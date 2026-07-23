\set ON_ERROR_STOP on

BEGIN;
SET LOCAL app.system = 'true';
SET LOCAL "app.current_role" = 'system';
SET LOCAL app.current_tier = 'system';
SET LOCAL synchronous_commit = on;
SET LOCAL giq.expected_previous_candidate_oid TO :'expected_previous_candidate_oid';
SET LOCAL giq.source_checkpoint_manifest_sha256 TO :'source_checkpoint_manifest_sha256';
SET LOCAL giq.destination_label TO :'destination_label';
SET LOCAL giq.confirmation TO :'confirmation';

SELECT pg_advisory_xact_lock(hashtextextended('giq-relocated-candidate-rebind/v1', 0));

CREATE TABLE IF NOT EXISTS _giq_history_merge.candidate_oid_rebinding (
  rebind_id text PRIMARY KEY CHECK (rebind_id ~ '^[0-9a-f]{64}$'),
  database_name text NOT NULL,
  previous_candidate_oid oid NOT NULL,
  next_candidate_oid oid NOT NULL,
  destination_label text NOT NULL CHECK (destination_label ~ '^[A-Za-z0-9._-]{1,64}$'),
  source_checkpoint_manifest_sha256 text NOT NULL
    CHECK (source_checkpoint_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  normalized_manifest_sha256 text NOT NULL
    CHECK (normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  stage11_sql_sha256 text NOT NULL CHECK (stage11_sql_sha256 ~ '^[0-9a-f]{64}$'),
  completed_migrations bigint NOT NULL CHECK (completed_migrations >= 100),
  proof_manifests jsonb NOT NULL CHECK (jsonb_typeof(proof_manifests) = 'object'),
  rebound_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (previous_candidate_oid <> next_candidate_oid),
  UNIQUE (previous_candidate_oid, next_candidate_oid, source_checkpoint_manifest_sha256)
);

CREATE OR REPLACE FUNCTION _giq_history_merge.reject_candidate_oid_rebinding_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'candidate OID rebinding evidence is append-only';
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = '_giq_history_merge.candidate_oid_rebinding'::regclass
      AND tgname = 'candidate_oid_rebinding_append_only'
  ) THEN
    CREATE TRIGGER candidate_oid_rebinding_append_only
    BEFORE UPDATE OR DELETE ON _giq_history_merge.candidate_oid_rebinding
    FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_candidate_oid_rebinding_mutation();
  END IF;
END
$$;

DO $$
DECLARE
  marker _giq_history_merge.run%ROWTYPE;
  actual_oid oid;
  expected_previous_oid oid;
  completed_migration_count bigint;
  stage11_hash text;
  proof_manifest_evidence jsonb;
  rebind_key text;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'relocated candidate rebind database mismatch';
  END IF;
  IF current_setting('giq.confirmation') <>
     'I_CONFIRM_REBIND_RELOCATED_NORMALIZED_CANDIDATE_OID_WITH_APPEND_ONLY_EVIDENCE' THEN
    RAISE EXCEPTION 'relocated candidate rebind confirmation mismatch';
  END IF;
  IF current_setting('giq.source_checkpoint_manifest_sha256') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'relocated candidate rebind requires a source checkpoint manifest SHA-256';
  END IF;
  IF current_setting('giq.destination_label') !~ '^[A-Za-z0-9._-]{1,64}$' THEN
    RAISE EXCEPTION 'relocated candidate destination label is invalid';
  END IF;

  SELECT * INTO STRICT marker FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE;
  SELECT oid INTO STRICT actual_oid FROM pg_database WHERE datname = current_database();
  expected_previous_oid := current_setting('giq.expected_previous_candidate_oid')::oid;

  IF marker.phase <> 'normalized'
     OR marker.normalized_transform_version <> 'thedogs-normalized-harvest/v2'
     OR marker.normalized_manifest_sha256 !~ '^[0-9a-f]{64}$'
     OR marker.canonical_merged_at IS NOT NULL THEN
    RAISE EXCEPTION 'relocated candidate rebind requires the untouched normalized-v2 marker';
  END IF;

  IF marker.candidate_database_oid = actual_oid THEN
    IF NOT EXISTS (
      SELECT 1 FROM _giq_history_merge.candidate_oid_rebinding evidence
      WHERE evidence.next_candidate_oid = actual_oid
        AND evidence.source_checkpoint_manifest_sha256 =
          current_setting('giq.source_checkpoint_manifest_sha256')
    ) THEN
      RAISE EXCEPTION 'candidate OID already matches without the supplied rebind evidence';
    END IF;
    RETURN;
  END IF;

  IF marker.candidate_database_oid <> expected_previous_oid OR actual_oid = expected_previous_oid THEN
    RAISE EXCEPTION 'relocated candidate OID chain mismatch: marker %, expected previous %, actual %',
      marker.candidate_database_oid, expected_previous_oid, actual_oid;
  END IF;

  IF (SELECT count(*) FROM _giq_history_merge.normalization_checkpoint) <> 11 THEN
    RAISE EXCEPTION 'relocated candidate requires all eleven normalization checkpoints';
  END IF;
  SELECT sql_sha256 INTO STRICT stage11_hash
  FROM _giq_history_merge.normalization_checkpoint
  WHERE stage_ordinal = 11 AND stage_name = 'archives-and-accounting';
  IF stage11_hash <> 'f9771f6668f5be9ac8362aa6b26df644ac992e2537648545fe8ea69d49f305f2'
     OR EXISTS (
       SELECT 1 FROM _giq_history_merge.normalization_checkpoint
       WHERE sql_sha256 !~ '^[0-9a-f]{64}$' OR completed_at IS NULL
     ) THEN
    RAISE EXCEPTION 'relocated candidate normalization checkpoint lineage changed';
  END IF;

  SELECT count(*) INTO completed_migration_count
  FROM public."_prisma_migrations"
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
  IF completed_migration_count <> 100
     OR to_regclass('public."DogSourceIdentity"') IS NULL
     OR to_regclass('public."DogProfileObservation"') IS NULL THEN
    RAISE EXCEPTION 'relocated candidate schema migration ledger is incomplete: %',
      completed_migration_count;
  END IF;

  IF to_regclass('_giq_history_merge.authoritative_pedigree_saturation_manifest') IS NULL
     OR to_regclass('_giq_history_merge.nonpedigree_saturation_manifest') IS NULL
     OR to_regclass('_giq_history_merge.duplicate_quarantine_proof_manifest') IS NULL THEN
    RAISE EXCEPTION 'relocated candidate proof manifests are incomplete';
  END IF;

  SELECT jsonb_build_object(
    'authoritativePedigree', (SELECT jsonb_build_object(
      'status', status, 'normalizedManifestSha256', normalized_manifest_sha256,
      'sourceHistoryCutoff', source_history_cutoff
    ) FROM _giq_history_merge.authoritative_pedigree_saturation_manifest WHERE id = 1),
    'nonpedigree', (SELECT jsonb_build_object(
      'status', status, 'normalizedManifestSha256', normalized_manifest_sha256,
      'sourceHistoryCutoff', source_history_cutoff
    ) FROM _giq_history_merge.nonpedigree_saturation_manifest WHERE id = 1),
    'duplicateQuarantine', (SELECT jsonb_build_object(
      'status', status, 'normalizedManifestSha256', normalized_manifest_sha256,
      'sourceHistoryCutoff', source_history_cutoff
    ) FROM _giq_history_merge.duplicate_quarantine_proof_manifest WHERE id = 1)
  ) INTO STRICT proof_manifest_evidence;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(proof_manifest_evidence) proof
    WHERE proof.value->>'normalizedManifestSha256' IS DISTINCT FROM marker.normalized_manifest_sha256
       OR (proof.value->>'sourceHistoryCutoff')::timestamptz IS DISTINCT FROM marker.source_history_cutoff
       OR proof.value->>'status' NOT IN ('ready', 'blocked')
  ) THEN
    RAISE EXCEPTION 'relocated candidate proof manifest lineage changed';
  END IF;

  IF to_regclass('_giq_history_merge.clean_partition_control') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM _giq_history_merge.clean_partition_control
      WHERE id = 1 AND status = 'ready' AND candidate_database_oid = expected_previous_oid
    ) THEN
      RAISE EXCEPTION 'relocated candidate clean-partition control does not bind the previous OID';
    END IF;
  END IF;
  IF to_regclass('_giq_history_merge.clean_partition_apply_manifest') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM _giq_history_merge.clean_partition_apply_manifest
      WHERE id = 1 AND status = 'applied' AND candidate_database_oid = expected_previous_oid
    ) THEN
      RAISE EXCEPTION 'relocated candidate clean-partition apply does not bind the previous OID';
    END IF;
  END IF;

  rebind_key := encode(digest(concat_ws(E'\x1f',current_database(),
    expected_previous_oid::text,actual_oid::text,
    current_setting('giq.source_checkpoint_manifest_sha256'),
    marker.normalized_manifest_sha256,stage11_hash),'sha256'),'hex');

  INSERT INTO _giq_history_merge.candidate_oid_rebinding (
    rebind_id,database_name,previous_candidate_oid,next_candidate_oid,destination_label,
    source_checkpoint_manifest_sha256,normalized_manifest_sha256,stage11_sql_sha256,
    completed_migrations,proof_manifests
  ) VALUES (
    rebind_key,current_database(),expected_previous_oid,actual_oid,
    current_setting('giq.destination_label'),
    current_setting('giq.source_checkpoint_manifest_sha256'),
    marker.normalized_manifest_sha256,stage11_hash,completed_migration_count,
    proof_manifest_evidence
  );

  UPDATE _giq_history_merge.run
  SET candidate_database_oid = actual_oid
  WHERE id = 1 AND candidate_database_oid = expected_previous_oid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'relocated candidate marker update lost its OID compare-and-swap';
  END IF;
END
$$;

REVOKE ALL ON _giq_history_merge.candidate_oid_rebinding FROM PUBLIC;
REVOKE ALL ON FUNCTION _giq_history_merge.reject_candidate_oid_rebinding_mutation() FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event','RELOCATED_CANDIDATE_OID_REBOUND',
  'database',database_name,
  'previousCandidateOid',previous_candidate_oid,
  'nextCandidateOid',next_candidate_oid,
  'destination',destination_label,
  'sourceCheckpointManifestSha256',source_checkpoint_manifest_sha256,
  'normalizedManifestSha256',normalized_manifest_sha256,
  'stage11SqlSha256',stage11_sql_sha256,
  'completedMigrations',completed_migrations
)
FROM _giq_history_merge.candidate_oid_rebinding
WHERE next_candidate_oid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY rebound_at DESC
LIMIT 1;
