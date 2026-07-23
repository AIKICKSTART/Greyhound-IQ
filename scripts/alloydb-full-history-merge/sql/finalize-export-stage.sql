\set ON_ERROR_STOP on

BEGIN;
SET LOCAL giq.normalized_manifest_sha256 TO :'manifest_sha256';
SET LOCAL giq.source_run_instance_id TO :'source_run_instance_id';
SET LOCAL giq.source_generated_at TO :'source_generated_at';
SET LOCAL synchronous_commit = on;

DO $$
DECLARE
  dataset_record record;
  observed bigint;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'export finalize database mismatch';
  END IF;
  IF (SELECT phase FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE)
     NOT IN ('r2_staged', 'export_staged') THEN
    RAISE EXCEPTION 'export finalize requires r2_staged/export_staged';
  END IF;
  IF (SELECT normalized_manifest_sha256 FROM _giq_history_merge.run WHERE id = 1)
     <> current_setting('giq.normalized_manifest_sha256') THEN
    RAISE EXCEPTION 'export finalize manifest mismatch';
  END IF;
  IF current_setting('giq.source_run_instance_id') !~ '^[A-Za-z0-9._:-]{16,128}$' THEN
    RAISE EXCEPTION 'export finalize requires manifest source.runInstanceId from the producer';
  END IF;
  PERFORM current_setting('giq.source_generated_at')::timestamptz;

  FOR dataset_record IN
    SELECT dataset, expected_rows
    FROM _giq_history_merge.export_dataset_manifest
    ORDER BY dataset
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM _giq_history_stage.%I',
      'export_' || dataset_record.dataset
    ) INTO observed;
    IF observed <> dataset_record.expected_rows THEN
      RAISE EXCEPTION 'export dataset % expected % rows, observed %',
        dataset_record.dataset, dataset_record.expected_rows, observed;
    END IF;
    UPDATE _giq_history_merge.export_dataset_manifest
    SET observed_rows = observed,
        staged_at = clock_timestamp()
    WHERE dataset = dataset_record.dataset;
  END LOOP;
END
$$;

DO $$
DECLARE
  bad_rows bigint;
  quarantine_runner bigint;
  quarantine_race bigint;
  quarantine_profile_source bigint;
BEGIN
  SELECT count(*) INTO bad_rows
  FROM _giq_history_stage.export_profiles
  WHERE payload->>'provider' <> 'thedogs'
     OR payload->>'mergeStatus' <> 'ready'
     OR payload->>'naturalKey' !~ '^thedogs:dog:[0-9]+$'
     OR payload->>'sourceId' !~ '^[0-9]+$';
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'profiles contain % invalid provider/identity rows', bad_rows;
  END IF;

  SELECT count(*) INTO bad_rows
  FROM _giq_history_stage.export_meetings
  WHERE payload->>'provider' <> 'thedogs'
     OR payload->>'mergeStatus' <> 'ready'
     OR nullif(payload->>'naturalKey', '') IS NULL
     OR nullif(payload->>'trackNaturalKey', '') IS NULL
     OR nullif(payload->>'meetingDate', '') IS NULL;
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'meetings contain % invalid normalized rows', bad_rows;
  END IF;

  SELECT count(*) INTO bad_rows
  FROM _giq_history_stage.export_races race
  WHERE NOT (
      race.payload->>'provider' = 'thedogs'
      AND race.payload->>'mergeStatus' = 'ready'
      AND nullif(race.payload->>'naturalKey', '') IS NOT NULL
      AND nullif(race.payload->>'meetingNaturalKey', '') IS NOT NULL
      AND CASE WHEN race.payload->>'distance' ~ '^[0-9]+$'
        THEN (race.payload->>'distance')::bigint > 0 ELSE false END
    )
    AND NOT EXISTS (
      SELECT 1 FROM _giq_history_stage.export_quarantine quarantine
      WHERE quarantine.payload->>'issueType' = 'race-row'
        AND quarantine.payload->>'reason' = 'missing_race_distance'
        AND quarantine.payload->>'naturalKey' = race.payload->>'naturalKey'
    );
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'races contain % invalid rows without exact quarantine evidence', bad_rows;
  END IF;

  SELECT count(*) INTO bad_rows
  FROM _giq_history_stage.export_quarantine quarantine
  WHERE quarantine.payload->>'issueType' = 'race-row'
    AND quarantine.payload->>'reason' = 'missing_race_distance'
    AND NOT EXISTS (
      SELECT 1 FROM _giq_history_stage.export_races race
      WHERE race.payload->>'naturalKey' = quarantine.payload->>'naturalKey'
        AND NOT (
          race.payload->>'provider' = 'thedogs'
          AND race.payload->>'mergeStatus' = 'ready'
          AND nullif(race.payload->>'meetingNaturalKey', '') IS NOT NULL
          AND CASE WHEN race.payload->>'distance' ~ '^[0-9]+$'
            THEN (race.payload->>'distance')::bigint > 0 ELSE false END
        )
    );
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'race quarantine contains % rows without the exact invalid source race', bad_rows;
  END IF;

  SELECT count(*) INTO bad_rows
  FROM _giq_history_stage.export_runners runner
  WHERE NOT (
      runner.payload->>'provider' = 'thedogs'
      AND runner.payload->>'mergeStatus' = 'ready'
      AND nullif(runner.payload->>'naturalKey', '') IS NOT NULL
      AND nullif(runner.payload->>'raceNaturalKey', '') IS NOT NULL
      AND nullif(runner.payload->>'dogNaturalKey', '') IS NOT NULL
      AND CASE WHEN runner.payload->>'boxNumber' ~ '^[0-9]+$'
        THEN (runner.payload->>'boxNumber')::bigint > 0 ELSE false END
    )
    AND NOT EXISTS (
      SELECT 1 FROM _giq_history_stage.export_quarantine quarantine
      WHERE quarantine.payload->>'issueType' = 'runner-row'
        AND quarantine.payload->>'reason' = 'missing_dog_provider_identity'
        AND quarantine.payload->>'naturalKey' = runner.payload->>'naturalKey'
    );
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'runners contain % invalid rows without exact quarantine evidence', bad_rows;
  END IF;

  SELECT count(*) INTO bad_rows
  FROM _giq_history_stage.export_quarantine quarantine
  WHERE quarantine.payload->>'issueType' = 'runner-row'
    AND quarantine.payload->>'reason' = 'missing_dog_provider_identity'
    AND NOT EXISTS (
      SELECT 1 FROM _giq_history_stage.export_runners runner
      WHERE runner.payload->>'naturalKey' = quarantine.payload->>'naturalKey'
        AND NOT (
          runner.payload->>'provider' = 'thedogs'
          AND runner.payload->>'mergeStatus' = 'ready'
          AND nullif(runner.payload->>'raceNaturalKey', '') IS NOT NULL
          AND nullif(runner.payload->>'dogNaturalKey', '') IS NOT NULL
          AND CASE WHEN runner.payload->>'boxNumber' ~ '^[0-9]+$'
            THEN (runner.payload->>'boxNumber')::bigint > 0 ELSE false END
        )
    );
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'runner quarantine contains % rows without the exact invalid source runner', bad_rows;
  END IF;

  SELECT count(*) INTO bad_rows
  FROM _giq_history_stage.export_race_media
  WHERE payload->>'provider' <> 'thedogs'
     OR payload->>'kind' NOT IN ('replay', 'photo-finish')
     OR nullif(payload->>'raceNaturalKey', '') IS NULL
     OR nullif(payload->>'sourceId', '') IS NULL
     OR nullif(payload->>'pageUrl', '') IS NULL;
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'race_media contain % invalid normalized rows', bad_rows;
  END IF;

  SELECT count(*) INTO bad_rows
  FROM _giq_history_stage.export_duplicates
  WHERE payload->>'issueType' <> 'runner-natural-key'
     OR payload->>'selection' <> 'completeness_then_latest_ordinal';
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'duplicate disposition input changed';
  END IF;

  SELECT count(*) INTO bad_rows
  FROM _giq_history_stage.export_quarantine
  WHERE (payload->>'issueType', payload->>'reason') NOT IN (
    ('runner-row', 'missing_dog_provider_identity'),
    ('race-row', 'missing_race_distance'),
    ('source-file', 'unverified_profile_identity')
  );
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'source quarantine taxonomy changed';
  END IF;

  SELECT count(*) FILTER (WHERE payload->>'issueType'='runner-row'),
         count(*) FILTER (WHERE payload->>'issueType'='race-row'),
         count(*) FILTER (WHERE payload->>'issueType'='source-file')
  INTO quarantine_runner, quarantine_race, quarantine_profile_source
  FROM _giq_history_stage.export_quarantine;
  IF (quarantine_runner, quarantine_race, quarantine_profile_source) <>
     (42::bigint, 40::bigint, 115::bigint) THEN
    RAISE EXCEPTION 'source quarantine counts changed: runner %, race %, profile source %',
      quarantine_runner, quarantine_race, quarantine_profile_source;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS export_profiles_natural_key_idx
  ON _giq_history_stage.export_profiles ((payload->>'naturalKey'));
CREATE INDEX IF NOT EXISTS export_pedigree_child_idx
  ON _giq_history_stage.export_pedigree_edges ((payload->>'childNaturalKey'));
CREATE INDEX IF NOT EXISTS export_pedigree_parent_idx
  ON _giq_history_stage.export_pedigree_edges ((payload->>'parentNaturalKey'));
CREATE INDEX IF NOT EXISTS export_profile_forms_dog_idx
  ON _giq_history_stage.export_profile_forms ((payload->>'dogNaturalKey'));
CREATE INDEX IF NOT EXISTS export_profile_forms_race_provider_idx
  ON _giq_history_stage.export_profile_forms ((payload->>'raceProviderKey'));
CREATE INDEX IF NOT EXISTS export_meetings_natural_key_idx
  ON _giq_history_stage.export_meetings ((payload->>'naturalKey'));
CREATE INDEX IF NOT EXISTS export_races_natural_key_idx
  ON _giq_history_stage.export_races ((payload->>'naturalKey'));
CREATE INDEX IF NOT EXISTS export_races_provider_key_idx
  ON _giq_history_stage.export_races ((payload->>'providerKey'));
CREATE INDEX IF NOT EXISTS export_runners_natural_key_idx
  ON _giq_history_stage.export_runners ((payload->>'naturalKey'));
CREATE INDEX IF NOT EXISTS export_runners_race_idx
  ON _giq_history_stage.export_runners ((payload->>'raceNaturalKey'));
CREATE INDEX IF NOT EXISTS export_runners_dog_idx
  ON _giq_history_stage.export_runners ((payload->>'dogNaturalKey'));
CREATE INDEX IF NOT EXISTS export_results_runner_idx
  ON _giq_history_stage.export_results ((payload->>'runnerNaturalKey'));
CREATE INDEX IF NOT EXISTS export_archives_natural_key_idx
  ON _giq_history_stage.export_archives ((payload->>'naturalKey'));
CREATE INDEX IF NOT EXISTS export_race_media_race_idx
  ON _giq_history_stage.export_race_media ((payload->>'raceNaturalKey'));
CREATE INDEX IF NOT EXISTS export_orphans_type_idx
  ON _giq_history_stage.export_orphans ((payload->>'issueType'));

UPDATE _giq_history_merge.run
SET phase = 'export_staged',
    export_staged_at = clock_timestamp(),
    export_stage_manifest = jsonb_build_object(
      'manifestSha256', normalized_manifest_sha256,
      'transformVersion', normalized_transform_version,
      'sourceRunInstanceId', current_setting('giq.source_run_instance_id'),
      'sourceGeneratedAt', current_setting('giq.source_generated_at'),
      'sourceStatus', 'blocked',
      'targetIdAssignments', 0,
      'datasets', (
        SELECT jsonb_object_agg(
          dataset,
          jsonb_build_object(
            'rows', observed_rows,
            'bytes', expected_bytes,
            'sha256', expected_sha256
          ) ORDER BY dataset
        )
        FROM _giq_history_merge.export_dataset_manifest
      )
    )
WHERE id = 1;

COMMIT;

ANALYZE _giq_history_stage.export_profiles;
ANALYZE _giq_history_stage.export_pedigree_edges;
ANALYZE _giq_history_stage.export_profile_forms;
ANALYZE _giq_history_stage.export_meetings;
ANALYZE _giq_history_stage.export_races;
ANALYZE _giq_history_stage.export_runners;
ANALYZE _giq_history_stage.export_results;
ANALYZE _giq_history_stage.export_archives;
ANALYZE _giq_history_stage.export_race_media;
ANALYZE _giq_history_stage.export_duplicates;
ANALYZE _giq_history_stage.export_orphans;
ANALYZE _giq_history_stage.export_quarantine;

SELECT jsonb_build_object(
  'event', 'NORMALIZED_EXPORT_NONCANONICAL_STAGE_VERIFIED',
  'database', current_database(),
  'phase', phase,
  'manifest', export_stage_manifest
)
FROM _giq_history_merge.run WHERE id = 1;
