\set ON_ERROR_STOP on

BEGIN;
SET LOCAL app.system = 'true';
SET LOCAL "app.current_role" = 'system';
SET LOCAL app.current_tier = 'system';
SET LOCAL synchronous_commit = on;
SET LOCAL statement_timeout = 0;

SELECT pg_advisory_xact_lock(hashtextextended('giq-clean-partition-stage/v1', 0));

DO $$
DECLARE
  marker _giq_history_merge.run%ROWTYPE;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'clean partition database mismatch';
  END IF;
  SELECT * INTO STRICT marker FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE;
  IF marker.phase <> 'normalized'
     OR marker.normalized_transform_version <> 'thedogs-normalized-harvest/v2'
     OR marker.normalized_manifest_sha256 !~ '^[0-9a-f]{64}$'
     OR marker.canonical_merged_at IS NOT NULL THEN
    RAISE EXCEPTION 'clean partition requires the untouched normalized-v2 candidate';
  END IF;
  IF (SELECT oid FROM pg_database WHERE datname = current_database())
     <> marker.candidate_database_oid THEN
    RAISE EXCEPTION 'clean partition candidate OID mismatch';
  END IF;
  IF to_regclass('_giq_history_merge.clean_partition_control') IS NOT NULL THEN
    RAISE EXCEPTION 'clean partition stage already exists; it is immutable';
  END IF;
  IF to_regclass('_giq_history_stage.nonpedigree_dog_identity_resolution') IS NULL THEN
    RAISE EXCEPTION 'clean partition requires the whole-candidate Dog identity search';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM _giq_history_merge.export_dataset_manifest
    WHERE observed_rows IS DISTINCT FROM expected_rows OR staged_at IS NULL
  ) OR (SELECT count(*) FROM _giq_history_merge.export_dataset_manifest) <> 12 THEN
    RAISE EXCEPTION 'clean partition requires all twelve normalized-v2 datasets to be staged exactly';
  END IF;
  IF (SELECT count(*) FROM _giq_history_stage.export_issue_outcome) <>
     (SELECT sum(expected_rows) FROM _giq_history_merge.export_dataset_manifest
      WHERE dataset IN ('duplicates', 'orphans', 'quarantine')) THEN
    RAISE EXCEPTION 'clean partition issue evidence is incomplete';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM _giq_history_stage.export_issue_outcome issue
    LEFT JOIN _giq_history_merge.disposition disposition
      ON disposition.source_name = 'normalized-export'
     AND disposition.issue_type = issue.source_dataset
     AND disposition.source_key = issue.source_file || ':' || issue.line_number
    WHERE disposition.source_key IS NULL
  ) THEN
    RAISE EXCEPTION 'clean partition issue disposition evidence is incomplete';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.clean_track
  (LIKE _giq_history_stage.normalized_track INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_track
SELECT * FROM _giq_history_stage.normalized_track;

CREATE TABLE _giq_history_stage.clean_trainer
  (LIKE _giq_history_stage.normalized_trainer INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_trainer
SELECT * FROM _giq_history_stage.normalized_trainer;

CREATE TABLE _giq_history_stage.clean_dog
  (LIKE _giq_history_stage.normalized_dog INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_dog
SELECT dog.*
FROM _giq_history_stage.normalized_dog dog
JOIN _giq_history_stage.nonpedigree_dog_identity_resolution decision
  ON decision.natural_key = dog.natural_key
 AND decision.proposed_target_id = dog.target_id
 AND lower(decision.source_provider) IS NOT DISTINCT FROM lower(dog.source_provider)
 AND decision.source_id IS NOT DISTINCT FROM dog.source_id
 AND decision.verification_class = dog.verification_class
JOIN _giq_history_merge.run marker
  ON marker.id = 1
 AND decision.normalized_manifest_sha256 = marker.normalized_manifest_sha256
 AND decision.source_history_cutoff = marker.source_history_cutoff
WHERE decision.unlinked_identity_claim_count = 0
  AND decision.nonverified_identity_claim_count = 0
  AND decision.composite_review_candidate_count = 0
  AND decision.parent_relationship_candidate_count = 0
  AND (
    decision.reuse_existing_allowed
    AND decision.exact_canonical_candidate_count = 1
    AND decision.exact_canonical_dog_id = dog.target_id
    AND EXISTS (SELECT 1 FROM public."Dog" existing WHERE existing.id = dog.target_id)
    OR
    decision.create_new_allowed
    AND decision.exact_canonical_candidate_count = 0
    AND decision.exact_canonical_dog_id IS NULL
    AND decision.verification_class = 'full-profile'
    AND NOT EXISTS (SELECT 1 FROM public."Dog" existing WHERE existing.id = dog.target_id)
  );

CREATE TABLE _giq_history_stage.clean_meeting
  (LIKE _giq_history_stage.normalized_meeting INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_meeting
SELECT meeting.*
FROM _giq_history_stage.normalized_meeting meeting
JOIN _giq_history_stage.clean_track track ON track.target_id = meeting.track_id;

CREATE TABLE _giq_history_stage.clean_race
  (LIKE _giq_history_stage.normalized_race INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_race
SELECT race.*
FROM _giq_history_stage.normalized_race race
JOIN _giq_history_stage.clean_meeting meeting ON meeting.target_id = race.meeting_id;

CREATE TABLE _giq_history_stage.clean_runner
  (LIKE _giq_history_stage.normalized_runner INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_runner
SELECT runner.*
FROM _giq_history_stage.normalized_runner runner
JOIN _giq_history_stage.clean_race race ON race.target_id = runner.race_id
JOIN _giq_history_stage.clean_dog dog ON dog.target_id = runner.dog_id
LEFT JOIN _giq_history_stage.clean_trainer trainer ON trainer.target_id = runner.trainer_id
WHERE runner.trainer_id IS NULL OR trainer.target_id IS NOT NULL;

CREATE TABLE _giq_history_stage.clean_result
  (LIKE _giq_history_stage.normalized_result INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_result
SELECT result.*
FROM _giq_history_stage.normalized_result result
JOIN _giq_history_stage.clean_runner runner ON runner.target_id = result.runner_id
JOIN _giq_history_stage.clean_race race ON race.target_id = result.race_id
WHERE runner.race_id = result.race_id;

CREATE TABLE _giq_history_stage.clean_form_entry
  (LIKE _giq_history_stage.normalized_form_entry INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_form_entry
SELECT form.*
FROM _giq_history_stage.normalized_form_entry form
JOIN _giq_history_stage.clean_dog dog ON dog.target_id = form.dog_id
JOIN _giq_history_stage.clean_race race ON race.target_id = form.race_id
LEFT JOIN _giq_history_stage.clean_track track ON track.target_id = form.track_id
WHERE form.track_id IS NULL OR track.target_id IS NOT NULL;

CREATE TABLE _giq_history_stage.clean_profile_form
  (LIKE _giq_history_stage.normalized_profile_form INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_profile_form
SELECT form.*
FROM _giq_history_stage.normalized_profile_form form
JOIN _giq_history_stage.clean_dog dog ON dog.target_id = form.dog_id
JOIN _giq_history_stage.clean_race race ON race.target_id = form.resolved_race_id
WHERE form.resolution = 'verified-canonical-race-url';

CREATE TABLE _giq_history_stage.clean_race_video
  (LIKE _giq_history_stage.normalized_race_video INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_race_video
SELECT video.*
FROM _giq_history_stage.normalized_race_video video
JOIN _giq_history_stage.clean_race race ON race.target_id = video.race_id;

CREATE TABLE _giq_history_stage.clean_photo_finish
  (LIKE _giq_history_stage.normalized_photo_finish INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_photo_finish
SELECT photo.*
FROM _giq_history_stage.normalized_photo_finish photo
JOIN _giq_history_stage.clean_race race ON race.target_id = photo.race_id;

CREATE TABLE _giq_history_stage.clean_dog_profile_archive
  (LIKE _giq_history_stage.normalized_dog_profile_archive INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_dog_profile_archive
SELECT archive.*
FROM _giq_history_stage.normalized_dog_profile_archive archive
JOIN _giq_history_stage.clean_dog dog ON dog.target_id = archive.dog_id;

CREATE TABLE _giq_history_stage.clean_race_day_archive
  (LIKE _giq_history_stage.normalized_race_day_archive INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_race_day_archive
SELECT * FROM _giq_history_stage.normalized_race_day_archive;

-- Structural pedigree rows are retained, but this fast path deliberately does
-- not assign parent relationships without the higher-authority verification
-- owned by the strict pedigree workflow.
CREATE TABLE _giq_history_stage.clean_pedigree_edge
  (LIKE _giq_history_stage.normalized_pedigree_edge INCLUDING ALL);
INSERT INTO _giq_history_stage.clean_pedigree_edge
SELECT edge.*
FROM _giq_history_stage.normalized_pedigree_edge edge
JOIN _giq_history_stage.clean_dog child ON child.target_id = edge.child_id
JOIN _giq_history_stage.clean_dog parent ON parent.target_id = edge.parent_id
WHERE edge.canonical_eligible;

CREATE TABLE _giq_history_merge.clean_partition_exclusion (
  entity_type text NOT NULL,
  natural_key text NOT NULL,
  target_id text,
  reason_code text NOT NULL,
  evidence jsonb NOT NULL,
  PRIMARY KEY (entity_type, natural_key)
);

INSERT INTO _giq_history_merge.clean_partition_exclusion
SELECT 'Dog', dog.natural_key, dog.target_id,
  coalesce(decision.disposition, 'missing-whole-database-identity-decision'),
  jsonb_build_object(
    'sourceProvider', dog.source_provider,
    'sourceId', dog.source_id,
    'verificationClass', dog.verification_class,
    'candidateCount', coalesce(decision.exact_canonical_candidate_count, 0)
  )
FROM _giq_history_stage.normalized_dog dog
LEFT JOIN _giq_history_stage.clean_dog clean USING (natural_key)
LEFT JOIN _giq_history_stage.nonpedigree_dog_identity_resolution decision USING (natural_key)
WHERE clean.natural_key IS NULL;

INSERT INTO _giq_history_merge.clean_partition_exclusion
SELECT 'Meeting', source.natural_key, source.target_id, 'parent-track-excluded',
  jsonb_build_object('trackId', source.track_id)
FROM _giq_history_stage.normalized_meeting source
LEFT JOIN _giq_history_stage.clean_meeting clean USING (natural_key)
WHERE clean.natural_key IS NULL
UNION ALL
SELECT 'Race', source.natural_key, source.target_id, 'parent-meeting-excluded',
  jsonb_build_object('meetingId', source.meeting_id)
FROM _giq_history_stage.normalized_race source
LEFT JOIN _giq_history_stage.clean_race clean USING (natural_key)
WHERE clean.natural_key IS NULL
UNION ALL
SELECT 'Runner', source.natural_key, source.target_id, 'parent-race-dog-or-trainer-excluded',
  jsonb_build_object('raceId', source.race_id, 'dogId', source.dog_id, 'trainerId', source.trainer_id)
FROM _giq_history_stage.normalized_runner source
LEFT JOIN _giq_history_stage.clean_runner clean USING (natural_key)
WHERE clean.natural_key IS NULL
UNION ALL
SELECT 'Result', source.natural_key, source.target_id, 'parent-runner-or-race-excluded',
  jsonb_build_object('runnerId', source.runner_id, 'raceId', source.race_id)
FROM _giq_history_stage.normalized_result source
LEFT JOIN _giq_history_stage.clean_result clean USING (natural_key)
WHERE clean.natural_key IS NULL
UNION ALL
SELECT 'FormEntry', source.natural_key, source.target_id, 'parent-dog-race-or-track-excluded',
  jsonb_build_object('dogId', source.dog_id, 'raceId', source.race_id, 'trackId', source.track_id)
FROM _giq_history_stage.normalized_form_entry source
LEFT JOIN _giq_history_stage.clean_form_entry clean USING (natural_key)
WHERE clean.natural_key IS NULL
UNION ALL
SELECT 'DogProfileForm', source.natural_key, source.target_id,
  CASE WHEN source.resolved_race_id IS NULL THEN 'orphan-race-excluded'
       ELSE 'parent-dog-or-race-excluded' END,
  jsonb_build_object('dogId', source.dog_id, 'raceId', source.resolved_race_id,
                     'resolution', source.resolution)
FROM _giq_history_stage.normalized_profile_form source
LEFT JOIN _giq_history_stage.clean_profile_form clean USING (natural_key)
WHERE clean.natural_key IS NULL
UNION ALL
SELECT 'RaceVideo', source.natural_key, source.target_id, 'parent-race-excluded',
  jsonb_build_object('raceId', source.race_id, 'provider', source.source_provider, 'sourceId', source.source_id)
FROM _giq_history_stage.normalized_race_video source
LEFT JOIN _giq_history_stage.clean_race_video clean USING (natural_key)
WHERE clean.natural_key IS NULL
UNION ALL
SELECT 'PhotoFinish', source.race_id, source.race_id, 'parent-race-excluded',
  jsonb_build_object('sourceId', source.source_id)
FROM _giq_history_stage.normalized_photo_finish source
LEFT JOIN _giq_history_stage.clean_photo_finish clean USING (race_id)
WHERE clean.race_id IS NULL
UNION ALL
SELECT 'DogProfileArchive', source.source_id, source.target_id, 'canonical-dog-excluded',
  jsonb_build_object('dogId', source.dog_id, 'provider', source.source_provider,
                     'sourceId', source.provider_source_id)
FROM _giq_history_stage.normalized_dog_profile_archive source
LEFT JOIN _giq_history_stage.clean_dog_profile_archive clean USING (source_id)
WHERE clean.source_id IS NULL
UNION ALL
SELECT 'Pedigree', source.natural_key, source.child_id,
  CASE WHEN NOT source.canonical_eligible THEN 'structurally-ineligible-pedigree-edge'
       ELSE 'parent-or-child-dog-excluded' END,
  jsonb_build_object('childId', source.child_id, 'parentId', source.parent_id,
                     'relationship', source.relationship, 'canonicalEligible', source.canonical_eligible)
FROM _giq_history_stage.normalized_pedigree_edge source
LEFT JOIN _giq_history_stage.clean_pedigree_edge clean USING (natural_key)
WHERE clean.natural_key IS NULL;

CREATE TABLE _giq_history_merge.clean_partition_raw_source_map (
  dataset text NOT NULL,
  source_file text NOT NULL,
  line_number bigint NOT NULL,
  canonical_entity_type text NOT NULL,
  canonical_target_id text NOT NULL,
  PRIMARY KEY (dataset, source_file, line_number),
  UNIQUE (dataset, canonical_entity_type, canonical_target_id)
);

INSERT INTO _giq_history_merge.clean_partition_raw_source_map
SELECT 'profiles', source.source_file, source.line_number, 'Dog', clean.target_id
FROM _giq_history_stage.export_profiles source
JOIN _giq_history_stage.dog_map map
  ON map.source_name = 'profile' AND map.source_id = source.payload->>'naturalKey'
JOIN _giq_history_stage.clean_dog clean ON clean.target_id = map.target_id
UNION ALL
SELECT 'meetings', source.source_file, source.line_number, 'Meeting', clean.target_id
FROM _giq_history_stage.export_meetings source
JOIN _giq_history_stage.meeting_map map
  ON map.source_name = 'export' AND map.source_id = source.payload->>'naturalKey'
JOIN _giq_history_stage.clean_meeting clean ON clean.target_id = map.target_id
UNION ALL
SELECT 'races', source.source_file, source.line_number, 'Race', clean.target_id
FROM _giq_history_stage.export_races source
JOIN _giq_history_stage.race_map map
  ON map.source_name = 'export' AND map.source_id = source.payload->>'naturalKey'
JOIN _giq_history_stage.clean_race clean ON clean.target_id = map.target_id
UNION ALL
SELECT 'runners', source.source_file, source.line_number, 'Runner', clean.target_id
FROM _giq_history_stage.export_runners source
JOIN _giq_history_stage.runner_map map
  ON map.source_name = 'export' AND map.source_id = source.payload->>'naturalKey'
JOIN _giq_history_stage.clean_runner clean ON clean.target_id = map.target_id
UNION ALL
SELECT 'results', source.source_file, source.line_number, 'Result', clean.target_id
FROM _giq_history_stage.export_results source
JOIN _giq_history_stage.result_map map
  ON map.source_name = 'export' AND map.source_id = source.payload->>'naturalKey'
JOIN _giq_history_stage.clean_result clean ON clean.target_id = map.target_id
UNION ALL
SELECT 'pedigree_edges', source.source_file, source.line_number, 'Pedigree', clean.natural_key
FROM _giq_history_stage.export_pedigree_edges source
JOIN _giq_history_stage.clean_pedigree_edge clean
  ON clean.natural_key = source.payload->>'naturalKey';

WITH candidate AS (
  SELECT resolution.source_file, resolution.line_number, clean.target_id,
    row_number() OVER (
      PARTITION BY clean.target_id ORDER BY resolution.source_file, resolution.line_number
    ) AS selection_rank
  FROM _giq_history_stage.profile_form_resolution resolution
  JOIN _giq_history_stage.clean_profile_form clean
    ON clean.dog_id = resolution.dog_id
   AND clean.resolved_race_id = resolution.race_id
   AND clean.source_provider = 'thedogs'
   AND clean.source_id = resolution.payload->>'sourceId'
  WHERE resolution.disposition = 'verified-canonical-race-url'
)
INSERT INTO _giq_history_merge.clean_partition_raw_source_map
SELECT 'profile_forms', source_file, line_number, 'DogProfileForm', target_id
FROM candidate WHERE selection_rank = 1;

INSERT INTO _giq_history_merge.clean_partition_raw_source_map
SELECT 'race_media', media.source_file, media.line_number, 'RaceVideo', video.target_id
FROM _giq_history_stage.media_resolution media
JOIN _giq_history_stage.clean_race_video video
  ON media.disposition = 'eligible-race-replay'
 AND video.race_id = media.race_id
 AND video.source_id = media.provider_media_id
UNION ALL
SELECT 'race_media', media.source_file, media.line_number, 'PhotoFinish', 'photo:' || photo.race_id
FROM _giq_history_stage.media_resolution media
JOIN _giq_history_stage.clean_photo_finish photo
  ON media.disposition = 'eligible-photo-finish'
 AND photo.race_id = media.race_id
 AND photo.source_id = media.payload->>'sourceId';

CREATE OR REPLACE FUNCTION _giq_history_merge.clean_partition_relation_digest(
  relation regclass, key_column text
)
RETURNS TABLE(row_count bigint, row_md5 text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = relation AND attname = key_column AND attnum > 0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'clean partition digest key % is absent from %', key_column, relation;
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT count(*), md5(coalesce(string_agg(md5(to_jsonb(row_value)::text), '''' ORDER BY %I::text), '''')) '
    'FROM %s row_value', key_column, relation
  );
END
$$;

CREATE TABLE _giq_history_merge.clean_partition_normalized_manifest (
  entity_type text PRIMARY KEY,
  source_relation regclass NOT NULL,
  clean_relation regclass NOT NULL,
  key_column text NOT NULL,
  apply_action text NOT NULL CHECK (apply_action IN ('insert', 'deferred-authoritative')),
  source_rows bigint NOT NULL,
  eligible_rows bigint NOT NULL,
  excluded_rows bigint NOT NULL,
  overlap_rows bigint NOT NULL,
  unaccounted_rows bigint NOT NULL,
  eligible_md5 text NOT NULL CHECK (eligible_md5 ~ '^[0-9a-f]{32}$'),
  CHECK (source_rows = eligible_rows + excluded_rows),
  CHECK (overlap_rows = 0),
  CHECK (unaccounted_rows = 0)
);

CREATE TEMP TABLE giq_clean_entity_definition (
  entity_type text PRIMARY KEY,
  source_relation regclass NOT NULL,
  clean_relation regclass NOT NULL,
  key_column text NOT NULL,
  apply_action text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_clean_entity_definition VALUES
('Track', '_giq_history_stage.normalized_track', '_giq_history_stage.clean_track', 'target_id', 'insert'),
('Trainer', '_giq_history_stage.normalized_trainer', '_giq_history_stage.clean_trainer', 'target_id', 'insert'),
('Dog', '_giq_history_stage.normalized_dog', '_giq_history_stage.clean_dog', 'target_id', 'insert'),
('Meeting', '_giq_history_stage.normalized_meeting', '_giq_history_stage.clean_meeting', 'target_id', 'insert'),
('Race', '_giq_history_stage.normalized_race', '_giq_history_stage.clean_race', 'target_id', 'insert'),
('Runner', '_giq_history_stage.normalized_runner', '_giq_history_stage.clean_runner', 'target_id', 'insert'),
('Result', '_giq_history_stage.normalized_result', '_giq_history_stage.clean_result', 'target_id', 'insert'),
('FormEntry', '_giq_history_stage.normalized_form_entry', '_giq_history_stage.clean_form_entry', 'target_id', 'insert'),
('DogProfileForm', '_giq_history_stage.normalized_profile_form', '_giq_history_stage.clean_profile_form', 'target_id', 'insert'),
('RaceVideo', '_giq_history_stage.normalized_race_video', '_giq_history_stage.clean_race_video', 'target_id', 'insert'),
('PhotoFinish', '_giq_history_stage.normalized_photo_finish', '_giq_history_stage.clean_photo_finish', 'race_id', 'insert'),
('DogProfileArchive', '_giq_history_stage.normalized_dog_profile_archive', '_giq_history_stage.clean_dog_profile_archive', 'target_id', 'insert'),
('RaceDayArchive', '_giq_history_stage.normalized_race_day_archive', '_giq_history_stage.clean_race_day_archive', 'target_id', 'insert'),
('Pedigree', '_giq_history_stage.normalized_pedigree_edge', '_giq_history_stage.clean_pedigree_edge', 'natural_key', 'deferred-authoritative');

DO $$
DECLARE
  definition record;
  source_count bigint;
  clean_count bigint;
  excluded_count bigint;
  overlap_count bigint;
  digest_count bigint;
  clean_digest text;
BEGIN
  FOR definition IN SELECT * FROM giq_clean_entity_definition ORDER BY entity_type LOOP
    EXECUTE format('SELECT count(*) FROM %s', definition.source_relation) INTO source_count;
    SELECT row_count, row_md5 INTO STRICT digest_count, clean_digest
    FROM _giq_history_merge.clean_partition_relation_digest(
      definition.clean_relation, definition.key_column
    );
    clean_count := digest_count;
    SELECT count(*) INTO excluded_count
    FROM _giq_history_merge.clean_partition_exclusion
    WHERE entity_type = definition.entity_type;
    EXECUTE format(
      'SELECT count(*) FROM %s source JOIN %s clean USING (%I) '
      'JOIN _giq_history_merge.clean_partition_exclusion excluded '
      'ON excluded.entity_type = %L AND excluded.natural_key = source.%I::text',
      definition.source_relation, definition.clean_relation,
      CASE WHEN definition.entity_type IN ('PhotoFinish') THEN 'race_id'
           WHEN definition.entity_type IN ('DogProfileArchive') THEN 'source_id'
           ELSE CASE WHEN definition.entity_type IN ('Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry','DogProfileForm','RaceVideo','Pedigree')
             THEN 'natural_key' ELSE definition.key_column END END,
      definition.entity_type,
      CASE WHEN definition.entity_type = 'PhotoFinish' THEN 'race_id'
           WHEN definition.entity_type = 'DogProfileArchive' THEN 'source_id'
           ELSE CASE WHEN definition.entity_type IN ('Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry','DogProfileForm','RaceVideo','Pedigree')
             THEN 'natural_key' ELSE definition.key_column END END
    ) INTO overlap_count;
    INSERT INTO _giq_history_merge.clean_partition_normalized_manifest
      (entity_type, source_relation, clean_relation, key_column, apply_action,
       source_rows, eligible_rows, excluded_rows, overlap_rows, unaccounted_rows, eligible_md5)
    VALUES (
      definition.entity_type, definition.source_relation, definition.clean_relation,
      definition.key_column, definition.apply_action, source_count, clean_count,
      excluded_count, overlap_count, source_count - clean_count - excluded_count,
      clean_digest
    );
  END LOOP;
END
$$;

CREATE TABLE _giq_history_merge.clean_partition_raw_manifest (
  dataset text PRIMARY KEY,
  source_rows bigint NOT NULL,
  eligible_rows bigint NOT NULL,
  excluded_rows bigint NOT NULL,
  overlap_rows bigint NOT NULL,
  unaccounted_rows bigint NOT NULL,
  evidence_relation regclass NOT NULL,
  CHECK (source_rows = eligible_rows + excluded_rows),
  CHECK (overlap_rows = 0),
  CHECK (unaccounted_rows = 0)
);

INSERT INTO _giq_history_merge.clean_partition_raw_manifest
SELECT dataset, expected_rows,
  (SELECT count(*) FROM _giq_history_merge.clean_partition_raw_source_map map
   WHERE map.dataset = manifest.dataset),
  expected_rows - (SELECT count(*) FROM _giq_history_merge.clean_partition_raw_source_map map
                   WHERE map.dataset = manifest.dataset),
  0, 0,
  CASE WHEN dataset IN ('duplicates', 'orphans', 'quarantine')
    THEN '_giq_history_stage.export_issue_outcome'::regclass
    ELSE '_giq_history_merge.clean_partition_raw_source_map'::regclass END
FROM _giq_history_merge.export_dataset_manifest manifest;

DO $$
DECLARE
  inserted_eligible bigint;
  raw_source bigint;
  raw_eligible bigint;
  issue_rows bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM _giq_history_merge.clean_partition_normalized_manifest
    WHERE source_rows <> eligible_rows + excluded_rows OR overlap_rows <> 0 OR unaccounted_rows <> 0
  ) OR EXISTS (
    SELECT 1 FROM _giq_history_merge.clean_partition_raw_manifest
    WHERE source_rows <> eligible_rows + excluded_rows OR overlap_rows <> 0 OR unaccounted_rows <> 0
  ) THEN
    RAISE EXCEPTION 'clean partition conservation failed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _giq_history_merge.clean_partition_raw_manifest
    WHERE dataset IN ('duplicates', 'orphans', 'quarantine') AND eligible_rows <> 0
  ) THEN
    RAISE EXCEPTION 'clean partition attempted to promote an issue row';
  END IF;
  SELECT sum(eligible_rows) INTO inserted_eligible
  FROM _giq_history_merge.clean_partition_normalized_manifest
  WHERE apply_action = 'insert' AND entity_type <> 'PhotoFinish';
  SELECT sum(source_rows), sum(eligible_rows) INTO raw_source, raw_eligible
  FROM _giq_history_merge.clean_partition_raw_manifest;
  SELECT sum(source_rows) INTO issue_rows
  FROM _giq_history_merge.clean_partition_raw_manifest
  WHERE dataset IN ('duplicates', 'orphans', 'quarantine');
  IF inserted_eligible < 17800000 THEN
    RAISE EXCEPTION 'clean partition contains only % insert-eligible canonical rows; expected at least 17,800,000',
      inserted_eligible;
  END IF;
  IF issue_rows <> (SELECT count(*) FROM _giq_history_stage.export_issue_outcome) THEN
    RAISE EXCEPTION 'clean partition issue evidence count drifted';
  END IF;

  CREATE TABLE _giq_history_merge.clean_partition_control (
    id integer PRIMARY KEY CHECK (id = 1),
    schema_version text NOT NULL,
    status text NOT NULL CHECK (status = 'ready'),
    candidate_database text NOT NULL,
    candidate_database_oid oid NOT NULL,
    clone_operation_id uuid NOT NULL,
    normalized_manifest_sha256 text NOT NULL CHECK (normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'),
    normalized_transform_version text NOT NULL,
    normalized_insert_eligible_rows bigint NOT NULL,
    normalized_deferred_rows bigint NOT NULL,
    raw_source_rows bigint NOT NULL,
    raw_eligible_rows bigint NOT NULL,
    raw_excluded_rows bigint NOT NULL,
    issue_evidence_rows bigint NOT NULL,
    staged_at timestamptz NOT NULL DEFAULT clock_timestamp()
  );

  INSERT INTO _giq_history_merge.clean_partition_control (
    id, schema_version, status, candidate_database, candidate_database_oid,
    clone_operation_id, normalized_manifest_sha256, normalized_transform_version,
    normalized_insert_eligible_rows, normalized_deferred_rows, raw_source_rows,
    raw_eligible_rows, raw_excluded_rows, issue_evidence_rows
  )
  SELECT 1, 'giq-clean-partition/v1', 'ready', current_database(),
    (SELECT oid FROM pg_database WHERE datname = current_database()),
    marker.clone_operation_id, marker.normalized_manifest_sha256,
    marker.normalized_transform_version, inserted_eligible,
    (SELECT sum(eligible_rows) FROM _giq_history_merge.clean_partition_normalized_manifest
     WHERE apply_action = 'deferred-authoritative'),
    raw_source, raw_eligible, raw_source - raw_eligible, issue_rows
  FROM _giq_history_merge.run marker WHERE marker.id = 1;
END
$$;

CREATE OR REPLACE FUNCTION _giq_history_merge.reject_clean_partition_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'clean partition evidence is append-only; clone a fresh candidate';
END
$$;

CREATE TRIGGER clean_partition_control_append_only
BEFORE UPDATE OR DELETE ON _giq_history_merge.clean_partition_control
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_clean_partition_evidence_mutation();
CREATE TRIGGER clean_partition_normalized_manifest_append_only
BEFORE UPDATE OR DELETE ON _giq_history_merge.clean_partition_normalized_manifest
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_clean_partition_evidence_mutation();
CREATE TRIGGER clean_partition_raw_manifest_append_only
BEFORE UPDATE OR DELETE ON _giq_history_merge.clean_partition_raw_manifest
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_clean_partition_evidence_mutation();
CREATE TRIGGER clean_partition_exclusion_append_only
BEFORE UPDATE OR DELETE ON _giq_history_merge.clean_partition_exclusion
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_clean_partition_evidence_mutation();
CREATE TRIGGER clean_partition_raw_source_map_append_only
BEFORE UPDATE OR DELETE ON _giq_history_merge.clean_partition_raw_source_map
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_clean_partition_evidence_mutation();

REVOKE ALL ON ALL TABLES IN SCHEMA _giq_history_stage FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA _giq_history_merge FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event', 'CLEAN_PARTITION_STAGE_READY',
  'database', candidate_database,
  'manifestSha256', normalized_manifest_sha256,
  'eligibleRows', normalized_insert_eligible_rows,
  'deferredAuthoritativeRows', normalized_deferred_rows,
  'rawSourceRows', raw_source_rows,
  'rawExcludedRows', raw_excluded_rows,
  'issueEvidenceRows', issue_evidence_rows
)
FROM _giq_history_merge.clean_partition_control WHERE id = 1;
