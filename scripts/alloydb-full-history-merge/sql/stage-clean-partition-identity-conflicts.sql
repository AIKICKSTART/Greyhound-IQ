\set ON_ERROR_STOP on

BEGIN;
SET LOCAL app.system = 'true';
SET LOCAL "app.current_role" = 'system';
SET LOCAL app.current_tier = 'system';
SET LOCAL synchronous_commit = on;
SET LOCAL statement_timeout = 0;

SELECT pg_advisory_xact_lock(hashtextextended(
  'giq-clean-partition-identity-conflicts/v1', 0
));

DO $$
DECLARE
  marker _giq_history_merge.run%ROWTYPE;
  control _giq_history_merge.clean_partition_control%ROWTYPE;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'clean identity-conflict stage database mismatch';
  END IF;
  SELECT * INTO STRICT marker FROM _giq_history_merge.run WHERE id = 1;
  SELECT * INTO STRICT control
  FROM _giq_history_merge.clean_partition_control WHERE id = 1;
  IF marker.phase <> 'normalized'
     OR marker.canonical_merged_at IS NOT NULL
     OR control.status <> 'ready'
     OR control.candidate_database_oid <> marker.candidate_database_oid
     OR control.normalized_manifest_sha256 <> marker.normalized_manifest_sha256
     OR to_regclass('_giq_history_merge.clean_partition_apply_manifest') IS NOT NULL
     OR to_regclass('_giq_history_merge.clean_partition_identity_conflict_control') IS NOT NULL THEN
    RAISE EXCEPTION 'clean identity-conflict stage requires the untouched ready partition';
  END IF;
END
$$;

CREATE TABLE _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type text NOT NULL CHECK (entity_type IN (
    'Meeting','Race','Runner','Result','FormEntry','RaceVideo','PhotoFinish'
  )),
  source_target_id text NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'target-id-identity-conflict','parent-identity-conflict'
  )),
  parent_entity_type text,
  parent_target_id text,
  natural_key text NOT NULL,
  normalized_manifest_sha256 text NOT NULL CHECK (
    normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'
  ),
  excluded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (entity_type, source_target_id),
  CHECK ((parent_entity_type IS NULL) = (parent_target_id IS NULL)),
  CHECK (
    reason <> 'parent-identity-conflict' OR parent_entity_type IS NOT NULL
  )
);

INSERT INTO _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type, source_target_id, reason, natural_key,
  normalized_manifest_sha256
)
SELECT 'Meeting', clean.target_id, 'target-id-identity-conflict',
  clean.natural_key, marker.normalized_manifest_sha256
FROM _giq_history_stage.clean_meeting clean
JOIN public."Meeting" canonical ON canonical.id = clean.target_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id = 1
  AND (canonical."trackId", canonical."meetingDate") IS DISTINCT FROM
      (clean.track_id, clean.meeting_date);

INSERT INTO _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type, source_target_id, reason, natural_key,
  normalized_manifest_sha256
)
SELECT 'Race', clean.target_id, 'target-id-identity-conflict',
  clean.natural_key, marker.normalized_manifest_sha256
FROM _giq_history_stage.clean_race clean
JOIN public."Race" canonical ON canonical.id = clean.target_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id = 1
  AND (canonical."meetingId", canonical."raceNumber") IS DISTINCT FROM
      (clean.meeting_id, clean.race_number);

INSERT INTO _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type, source_target_id, reason, parent_entity_type,
  parent_target_id, natural_key, normalized_manifest_sha256
)
SELECT 'Race', clean.target_id, 'parent-identity-conflict', 'Meeting',
  clean.meeting_id, clean.natural_key, marker.normalized_manifest_sha256
FROM _giq_history_stage.clean_race clean
JOIN _giq_history_merge.clean_partition_identity_conflict_exclusion parent
  ON parent.entity_type = 'Meeting'
 AND parent.source_target_id = clean.meeting_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id = 1
ON CONFLICT (entity_type, source_target_id) DO NOTHING;

INSERT INTO _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type, source_target_id, reason, natural_key,
  normalized_manifest_sha256
)
SELECT 'Runner', clean.target_id, 'target-id-identity-conflict',
  clean.natural_key, marker.normalized_manifest_sha256
FROM _giq_history_stage.clean_runner clean
JOIN public."Runner" canonical ON canonical.id = clean.target_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id = 1
  AND (canonical."raceId", canonical."dogId", canonical."boxNumber")
    IS DISTINCT FROM (clean.race_id, clean.dog_id, clean.box_number);

INSERT INTO _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type, source_target_id, reason, parent_entity_type,
  parent_target_id, natural_key, normalized_manifest_sha256
)
SELECT 'Runner', clean.target_id, 'parent-identity-conflict', 'Race',
  clean.race_id, clean.natural_key, marker.normalized_manifest_sha256
FROM _giq_history_stage.clean_runner clean
JOIN _giq_history_merge.clean_partition_identity_conflict_exclusion parent
  ON parent.entity_type = 'Race' AND parent.source_target_id = clean.race_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id = 1
ON CONFLICT (entity_type, source_target_id) DO NOTHING;

INSERT INTO _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type, source_target_id, reason, natural_key,
  normalized_manifest_sha256
)
SELECT 'Result', clean.target_id, 'target-id-identity-conflict',
  clean.natural_key, marker.normalized_manifest_sha256
FROM _giq_history_stage.clean_result clean
JOIN public."Result" canonical ON canonical.id = clean.target_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id = 1
  AND (canonical."runnerId", canonical."raceId") IS DISTINCT FROM
      (clean.runner_id, clean.race_id);

INSERT INTO _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type, source_target_id, reason, parent_entity_type,
  parent_target_id, natural_key, normalized_manifest_sha256
)
SELECT 'Result', clean.target_id, 'parent-identity-conflict', 'Runner',
  clean.runner_id, clean.natural_key, marker.normalized_manifest_sha256
FROM _giq_history_stage.clean_result clean
JOIN _giq_history_merge.clean_partition_identity_conflict_exclusion parent
  ON parent.entity_type = 'Runner'
 AND parent.source_target_id = clean.runner_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id = 1
ON CONFLICT (entity_type, source_target_id) DO NOTHING;

INSERT INTO _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type, source_target_id, reason, parent_entity_type,
  parent_target_id, natural_key, normalized_manifest_sha256
)
SELECT 'FormEntry', clean.target_id, 'parent-identity-conflict', 'Race',
  clean.race_id, clean.natural_key, marker.normalized_manifest_sha256
FROM _giq_history_stage.clean_form_entry clean
JOIN _giq_history_merge.clean_partition_identity_conflict_exclusion parent
  ON parent.entity_type = 'Race' AND parent.source_target_id = clean.race_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id = 1;

INSERT INTO _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type, source_target_id, reason, parent_entity_type,
  parent_target_id, natural_key, normalized_manifest_sha256
)
SELECT 'RaceVideo', clean.target_id, 'parent-identity-conflict', 'Race',
  clean.race_id, clean.natural_key, marker.normalized_manifest_sha256
FROM _giq_history_stage.clean_race_video clean
JOIN _giq_history_merge.clean_partition_identity_conflict_exclusion parent
  ON parent.entity_type = 'Race' AND parent.source_target_id = clean.race_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id = 1;

INSERT INTO _giq_history_merge.clean_partition_identity_conflict_exclusion (
  entity_type, source_target_id, reason, parent_entity_type,
  parent_target_id, natural_key, normalized_manifest_sha256
)
SELECT 'PhotoFinish', clean.race_id, 'parent-identity-conflict', 'Race',
  clean.race_id, 'race:' || clean.race_id, marker.normalized_manifest_sha256
FROM _giq_history_stage.clean_photo_finish clean
JOIN _giq_history_merge.clean_partition_identity_conflict_exclusion parent
  ON parent.entity_type = 'Race' AND parent.source_target_id = clean.race_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id = 1;

CREATE VIEW _giq_history_stage.release_meeting AS
SELECT clean.* FROM _giq_history_stage.clean_meeting clean
WHERE NOT EXISTS (
  SELECT 1 FROM _giq_history_merge.clean_partition_identity_conflict_exclusion x
  WHERE x.entity_type = 'Meeting' AND x.source_target_id = clean.target_id
);
CREATE VIEW _giq_history_stage.release_race AS
SELECT clean.* FROM _giq_history_stage.clean_race clean
WHERE NOT EXISTS (
  SELECT 1 FROM _giq_history_merge.clean_partition_identity_conflict_exclusion x
  WHERE x.entity_type = 'Race' AND x.source_target_id = clean.target_id
);
CREATE VIEW _giq_history_stage.release_runner AS
SELECT clean.* FROM _giq_history_stage.clean_runner clean
WHERE NOT EXISTS (
  SELECT 1 FROM _giq_history_merge.clean_partition_identity_conflict_exclusion x
  WHERE x.entity_type = 'Runner' AND x.source_target_id = clean.target_id
);
CREATE VIEW _giq_history_stage.release_result AS
SELECT clean.* FROM _giq_history_stage.clean_result clean
WHERE NOT EXISTS (
  SELECT 1 FROM _giq_history_merge.clean_partition_identity_conflict_exclusion x
  WHERE x.entity_type = 'Result' AND x.source_target_id = clean.target_id
);
CREATE VIEW _giq_history_stage.release_form_entry AS
SELECT clean.* FROM _giq_history_stage.clean_form_entry clean
WHERE NOT EXISTS (
  SELECT 1 FROM _giq_history_merge.clean_partition_identity_conflict_exclusion x
  WHERE x.entity_type = 'FormEntry' AND x.source_target_id = clean.target_id
);
CREATE VIEW _giq_history_stage.release_race_video AS
SELECT clean.* FROM _giq_history_stage.clean_race_video clean
WHERE NOT EXISTS (
  SELECT 1 FROM _giq_history_merge.clean_partition_identity_conflict_exclusion x
  WHERE x.entity_type = 'RaceVideo' AND x.source_target_id = clean.target_id
);
CREATE VIEW _giq_history_stage.release_photo_finish AS
SELECT clean.* FROM _giq_history_stage.clean_photo_finish clean
WHERE NOT EXISTS (
  SELECT 1 FROM _giq_history_merge.clean_partition_identity_conflict_exclusion x
  WHERE x.entity_type = 'PhotoFinish' AND x.source_target_id = clean.race_id
);

CREATE TABLE _giq_history_merge.clean_partition_identity_conflict_control (
  id integer PRIMARY KEY CHECK (id = 1),
  schema_version text NOT NULL CHECK (
    schema_version = 'giq-clean-partition-identity-conflicts/v1'
  ),
  status text NOT NULL CHECK (status = 'ready'),
  candidate_database text NOT NULL,
  candidate_database_oid oid NOT NULL,
  normalized_manifest_sha256 text NOT NULL CHECK (
    normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'
  ),
  direct_conflict_rows bigint NOT NULL,
  cascaded_rows bigint NOT NULL,
  release_insert_eligible_rows bigint NOT NULL,
  entity_counts jsonb NOT NULL,
  staged_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $$
DECLARE
  marker _giq_history_merge.run%ROWTYPE;
  clean_control _giq_history_merge.clean_partition_control%ROWTYPE;
  release_rows bigint;
  excluded_insert_rows bigint;
BEGIN
  SELECT * INTO STRICT marker FROM _giq_history_merge.run WHERE id = 1;
  SELECT * INTO STRICT clean_control
  FROM _giq_history_merge.clean_partition_control WHERE id = 1;

  IF (SELECT count(*) FROM _giq_history_stage.release_race) <>
     (SELECT count(*) FROM _giq_history_stage.release_race race
      JOIN _giq_history_stage.release_meeting meeting
        ON meeting.target_id = race.meeting_id)
  OR (SELECT count(*) FROM _giq_history_stage.release_runner) <>
     (SELECT count(*) FROM _giq_history_stage.release_runner runner
      JOIN _giq_history_stage.release_race race ON race.target_id = runner.race_id
      JOIN _giq_history_stage.clean_dog dog ON dog.target_id = runner.dog_id)
  OR (SELECT count(*) FROM _giq_history_stage.release_result) <>
     (SELECT count(*) FROM _giq_history_stage.release_result result
      JOIN _giq_history_stage.release_runner runner ON runner.target_id = result.runner_id
      JOIN _giq_history_stage.release_race race ON race.target_id = result.race_id)
  OR (SELECT count(*) FROM _giq_history_stage.release_form_entry) <>
     (SELECT count(*) FROM _giq_history_stage.release_form_entry form
      JOIN _giq_history_stage.release_race race ON race.target_id = form.race_id)
  OR (SELECT count(*) FROM _giq_history_stage.release_race_video) <>
     (SELECT count(*) FROM _giq_history_stage.release_race_video video
      JOIN _giq_history_stage.release_race race ON race.target_id = video.race_id)
  OR (SELECT count(*) FROM _giq_history_stage.release_photo_finish) <>
     (SELECT count(*) FROM _giq_history_stage.release_photo_finish photo
      JOIN _giq_history_stage.release_race race ON race.target_id = photo.race_id) THEN
    RAISE EXCEPTION 'clean identity-conflict release views contain an FK gap';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _giq_history_stage.release_meeting clean
    JOIN public."Meeting" canonical ON canonical.id = clean.target_id
    WHERE (canonical."trackId", canonical."meetingDate") IS DISTINCT FROM
          (clean.track_id, clean.meeting_date)
  ) OR EXISTS (
    SELECT 1 FROM _giq_history_stage.release_race clean
    JOIN public."Race" canonical ON canonical.id = clean.target_id
    WHERE (canonical."meetingId", canonical."raceNumber") IS DISTINCT FROM
          (clean.meeting_id, clean.race_number)
  ) OR EXISTS (
    SELECT 1 FROM _giq_history_stage.release_runner clean
    JOIN public."Runner" canonical ON canonical.id = clean.target_id
    WHERE (canonical."raceId", canonical."dogId", canonical."boxNumber")
      IS DISTINCT FROM (clean.race_id, clean.dog_id, clean.box_number)
  ) OR EXISTS (
    SELECT 1 FROM _giq_history_stage.release_result clean
    JOIN public."Result" canonical ON canonical.id = clean.target_id
    WHERE (canonical."runnerId", canonical."raceId") IS DISTINCT FROM
          (clean.runner_id, clean.race_id)
  ) THEN
    RAISE EXCEPTION 'clean identity-conflict release still contains a target-ID mismatch';
  END IF;

  SELECT
    (SELECT count(*) FROM _giq_history_stage.clean_track) +
    (SELECT count(*) FROM _giq_history_stage.clean_trainer) +
    (SELECT count(*) FROM _giq_history_stage.clean_dog) +
    (SELECT count(*) FROM _giq_history_stage.release_meeting) +
    (SELECT count(*) FROM _giq_history_stage.release_race) +
    (SELECT count(*) FROM _giq_history_stage.release_runner) +
    (SELECT count(*) FROM _giq_history_stage.release_result) +
    (SELECT count(*) FROM _giq_history_stage.release_form_entry) +
    (SELECT count(*) FROM _giq_history_stage.clean_profile_form) +
    (SELECT count(*) FROM _giq_history_stage.release_race_video) +
    (SELECT count(*) FROM _giq_history_stage.clean_dog_profile_archive) +
    (SELECT count(*) FROM _giq_history_stage.clean_race_day_archive)
  INTO release_rows;

  SELECT count(*) INTO excluded_insert_rows
  FROM _giq_history_merge.clean_partition_identity_conflict_exclusion
  WHERE entity_type <> 'PhotoFinish';
  IF release_rows <> clean_control.normalized_insert_eligible_rows - excluded_insert_rows
     OR release_rows < 17800000 THEN
    RAISE EXCEPTION 'clean identity-conflict release conservation failed';
  END IF;

  INSERT INTO _giq_history_merge.clean_partition_identity_conflict_control (
    id, schema_version, status, candidate_database, candidate_database_oid,
    normalized_manifest_sha256, direct_conflict_rows, cascaded_rows,
    release_insert_eligible_rows, entity_counts
  )
  WITH entity_counts AS (
    SELECT entity_type, count(*) AS row_count
    FROM _giq_history_merge.clean_partition_identity_conflict_exclusion
    GROUP BY entity_type
  ), totals AS (
    SELECT
      count(*) FILTER (WHERE reason = 'target-id-identity-conflict') AS direct_rows,
      count(*) FILTER (WHERE reason = 'parent-identity-conflict') AS cascade_rows
    FROM _giq_history_merge.clean_partition_identity_conflict_exclusion
  )
  SELECT 1, 'giq-clean-partition-identity-conflicts/v1', 'ready',
    current_database(), marker.candidate_database_oid,
    marker.normalized_manifest_sha256, totals.direct_rows,
    totals.cascade_rows, release_rows,
    (SELECT jsonb_object_agg(entity_type, row_count ORDER BY entity_type)
     FROM entity_counts)
  FROM totals;
END
$$;

CREATE TRIGGER clean_partition_identity_conflict_exclusion_append_only
BEFORE UPDATE OR DELETE
ON _giq_history_merge.clean_partition_identity_conflict_exclusion
FOR EACH ROW EXECUTE FUNCTION
  _giq_history_merge.reject_clean_partition_evidence_mutation();
CREATE TRIGGER clean_partition_identity_conflict_control_append_only
BEFORE UPDATE OR DELETE
ON _giq_history_merge.clean_partition_identity_conflict_control
FOR EACH ROW EXECUTE FUNCTION
  _giq_history_merge.reject_clean_partition_evidence_mutation();

REVOKE ALL ON _giq_history_merge.clean_partition_identity_conflict_exclusion
FROM PUBLIC;
REVOKE ALL ON _giq_history_merge.clean_partition_identity_conflict_control
FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.release_meeting,
  _giq_history_stage.release_race, _giq_history_stage.release_runner,
  _giq_history_stage.release_result, _giq_history_stage.release_form_entry,
  _giq_history_stage.release_race_video,
  _giq_history_stage.release_photo_finish FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event', 'CLEAN_PARTITION_IDENTITY_CONFLICTS_STAGED',
  'directConflicts', direct_conflict_rows,
  'cascadedRows', cascaded_rows,
  'releaseInsertEligibleRows', release_insert_eligible_rows,
  'entityCounts', entity_counts
)
FROM _giq_history_merge.clean_partition_identity_conflict_control
WHERE id = 1;
