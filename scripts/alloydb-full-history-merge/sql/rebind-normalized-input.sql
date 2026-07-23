\set ON_ERROR_STOP on

BEGIN;
SET LOCAL app.system = 'true';
SET LOCAL "app.current_role" = 'system';
SET LOCAL "app.current_tier" = 'system';
SET LOCAL synchronous_commit = on;
SET LOCAL giq.expected_legacy_manifest_sha256 TO :'expected_legacy_manifest_sha256';
SET LOCAL giq.expected_legacy_source_cutoff TO :'expected_legacy_source_cutoff';
SET LOCAL giq.normalized_manifest_sha256 TO :'normalized_manifest_sha256';
SET LOCAL giq.normalized_transform_version TO :'normalized_transform_version';
SET LOCAL giq.history_source_cutoff TO :'history_source_cutoff';
SET LOCAL giq.confirmation TO :'confirmation';

SELECT pg_advisory_xact_lock(hashtextextended('giq-rebind-normalized-input/v1', 0));

CREATE TABLE IF NOT EXISTS _giq_history_merge.normalized_input_rebinding (
  id integer PRIMARY KEY CHECK (id = 1),
  previous_manifest_sha256 text NOT NULL CHECK (previous_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  previous_source_cutoff timestamptz NOT NULL,
  next_manifest_sha256 text NOT NULL CHECK (next_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  next_transform_version text NOT NULL,
  next_source_cutoff timestamptz NOT NULL,
  rebounded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $$
DECLARE
  marker _giq_history_merge.run%ROWTYPE;
  export_relation_count bigint;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'normalized input rebind database mismatch';
  END IF;
  IF current_setting('giq.confirmation') <>
     'I_CONFIRM_REBIND_UNSTAGED_CANDIDATE_INPUT_FROM_LEGACY_V1_TO_VERIFIED_V2' THEN
    RAISE EXCEPTION 'normalized input rebind confirmation mismatch';
  END IF;
  SELECT * INTO STRICT marker FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE;
  IF marker.phase <> 'r2_staged'
     OR marker.export_load_started_at IS NOT NULL
     OR marker.export_staged_at IS NOT NULL
     OR marker.normalized_at IS NOT NULL
     OR marker.canonical_merged_at IS NOT NULL
     OR marker.normalized_manifest_sha256 <> current_setting('giq.expected_legacy_manifest_sha256')
     OR marker.source_history_cutoff <> current_setting('giq.expected_legacy_source_cutoff')::timestamptz
     OR marker.normalized_transform_version <> 'thedogs-normalized-harvest/v2' THEN
    RAISE EXCEPTION 'normalized input rebind requires the exact never-staged legacy candidate';
  END IF;
  SELECT count(*) INTO export_relation_count
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = '_giq_history_stage'
    AND relation.relkind IN ('r', 'p')
    AND relation.relname LIKE 'export!_%' ESCAPE '!';
  IF export_relation_count <> 0
     OR to_regclass('_giq_history_merge.export_dataset_manifest') IS NOT NULL THEN
    RAISE EXCEPTION 'normalized input rebind refuses a candidate with export stage relations';
  END IF;
  IF EXISTS (SELECT 1 FROM _giq_history_merge.normalized_input_rebinding) THEN
    RAISE EXCEPTION 'normalized input rebind is append-only and already recorded';
  END IF;

  INSERT INTO _giq_history_merge.normalized_input_rebinding (
    id, previous_manifest_sha256, previous_source_cutoff,
    next_manifest_sha256, next_transform_version, next_source_cutoff
  ) VALUES (
    1, marker.normalized_manifest_sha256, marker.source_history_cutoff,
    current_setting('giq.normalized_manifest_sha256'),
    current_setting('giq.normalized_transform_version'),
    current_setting('giq.history_source_cutoff')::timestamptz
  );

  UPDATE _giq_history_merge.run
  SET normalized_manifest_sha256 = current_setting('giq.normalized_manifest_sha256'),
      normalized_transform_version = current_setting('giq.normalized_transform_version'),
      source_history_cutoff = current_setting('giq.history_source_cutoff')::timestamptz
  WHERE id = 1;
END
$$;

COMMIT;

SELECT jsonb_build_object(
  'event', 'NORMALIZED_INPUT_REBOUND',
  'database', current_database(),
  'previousManifestSha256', previous_manifest_sha256,
  'nextManifestSha256', next_manifest_sha256,
  'nextSourceCutoff', next_source_cutoff
)
FROM _giq_history_merge.normalized_input_rebinding WHERE id = 1;
