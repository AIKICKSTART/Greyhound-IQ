\set ON_ERROR_STOP on

BEGIN;
SET LOCAL app.system = 'true';
SET LOCAL "app.current_role" = 'system';
SET LOCAL app.current_tier = 'system';
SET LOCAL synchronous_commit = on;
SET LOCAL statement_timeout = 0;
SET LOCAL giq.clean_partition_confirmation = :'clean_partition_confirmation';

SELECT pg_advisory_xact_lock(hashtextextended('giq-clean-partition-apply/v1', 0));

DO $$
DECLARE
  marker _giq_history_merge.run%ROWTYPE;
  control _giq_history_merge.clean_partition_control%ROWTYPE;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'clean partition apply database mismatch';
  END IF;
  IF current_setting('giq.clean_partition_confirmation') <>
     'I_CONFIRM_INSERT_ONLY_CLEAN_PARTITION_INTO_GIQ_PRODUCTION_CANDIDATE_20260716_R1' THEN
    RAISE EXCEPTION 'clean partition apply confirmation mismatch';
  END IF;
  SELECT * INTO STRICT marker FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE;
  SELECT * INTO STRICT control FROM _giq_history_merge.clean_partition_control WHERE id = 1;
  IF marker.phase <> 'normalized'
     OR marker.canonical_merged_at IS NOT NULL
     OR marker.normalized_transform_version <> 'thedogs-normalized-harvest/v2'
     OR control.status <> 'ready'
     OR control.schema_version <> 'giq-clean-partition/v1'
     OR control.candidate_database <> current_database()
     OR control.candidate_database_oid <> (SELECT oid FROM pg_database WHERE datname = current_database())
     OR control.clone_operation_id <> marker.clone_operation_id
     OR control.normalized_manifest_sha256 <> marker.normalized_manifest_sha256
     OR control.normalized_transform_version <> marker.normalized_transform_version THEN
    RAISE EXCEPTION 'clean partition apply is not bound to this untouched normalized-v2 candidate';
  END IF;
  IF to_regclass('_giq_history_merge.clean_partition_apply_manifest') IS NOT NULL THEN
    RAISE EXCEPTION 'clean partition apply evidence already exists; it is immutable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid()
  ) THEN
    RAISE EXCEPTION 'clean partition apply requires an isolated candidate session';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _giq_history_merge.clean_partition_normalized_manifest
    WHERE source_rows <> eligible_rows + excluded_rows OR overlap_rows <> 0 OR unaccounted_rows <> 0
  ) OR EXISTS (
    SELECT 1 FROM _giq_history_merge.clean_partition_raw_manifest
    WHERE source_rows <> eligible_rows + excluded_rows OR overlap_rows <> 0 OR unaccounted_rows <> 0
  ) THEN
    RAISE EXCEPTION 'clean partition conservation evidence is not release eligible';
  END IF;
  IF control.normalized_insert_eligible_rows < 17800000 THEN
    RAISE EXCEPTION 'clean partition insert-eligible count is below the reviewed floor';
  END IF;
END
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Track', 'Trainer', 'Dog', 'Meeting', 'Race', 'Runner', 'Result', 'FormEntry',
    'DogProfileForm', 'RaceVideo', 'DogProfileArchive', 'RaceDayArchive'
  ] LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', table_name);
  END LOOP;

  FOR table_name IN
    SELECT protected.table_name
    FROM _giq_history_merge.protected_table_manifest protected
    ORDER BY protected.table_name
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', table_name);
  END LOOP;
END
$$;

DO $$
DECLARE
  manifest record;
  observed_count bigint;
  observed_md5 text;
BEGIN
  FOR manifest IN
    SELECT * FROM _giq_history_merge.clean_partition_normalized_manifest
    ORDER BY entity_type
  LOOP
    SELECT row_count, row_md5 INTO STRICT observed_count, observed_md5
    FROM _giq_history_merge.clean_partition_relation_digest(
      manifest.clean_relation, manifest.key_column
    );
    IF observed_count <> manifest.eligible_rows OR observed_md5 <> manifest.eligible_md5 THEN
      RAISE EXCEPTION 'clean partition relation % changed after staging', manifest.clean_relation;
    END IF;
  END LOOP;
END
$$;

CREATE TEMP TABLE giq_clean_existing_row (
  table_name text NOT NULL,
  row_id text NOT NULL,
  row_sha256 text NOT NULL,
  PRIMARY KEY (table_name, row_id)
) ON COMMIT DROP;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Track', 'Trainer', 'Dog', 'Meeting', 'Race', 'Runner', 'Result', 'FormEntry',
    'DogProfileForm', 'RaceVideo', 'DogProfileArchive', 'RaceDayArchive'
  ] LOOP
    EXECUTE format(
      'INSERT INTO giq_clean_existing_row(table_name,row_id,row_sha256) '
      'SELECT %L, canonical.id::text, encode(pg_catalog.sha256(convert_to(to_jsonb(canonical)::text,''UTF8'')),''hex'') '
      'FROM public.%I canonical '
      'JOIN _giq_history_merge.snapshot_core_key snapshot '
      'ON snapshot.table_name=%L AND snapshot.primary_key_text=canonical.id::text',
      table_name, table_name, table_name
    );
  END LOOP;
END
$$;

CREATE TABLE _giq_history_merge.clean_partition_apply_delta (
  table_name text PRIMARY KEY,
  eligible_rows bigint NOT NULL,
  before_rows bigint NOT NULL,
  after_rows bigint,
  inserted_rows bigint,
  present_rows bigint,
  identity_mismatch_rows bigint
);

INSERT INTO _giq_history_merge.clean_partition_apply_delta(table_name, eligible_rows, before_rows)
VALUES
('Track', (SELECT count(*) FROM _giq_history_stage.clean_track), (SELECT count(*) FROM public."Track")),
('Trainer', (SELECT count(*) FROM _giq_history_stage.clean_trainer), (SELECT count(*) FROM public."Trainer")),
('Dog', (SELECT count(*) FROM _giq_history_stage.clean_dog), (SELECT count(*) FROM public."Dog")),
('Meeting', (SELECT count(*) FROM _giq_history_stage.clean_meeting), (SELECT count(*) FROM public."Meeting")),
('Race', (SELECT count(*) FROM _giq_history_stage.clean_race), (SELECT count(*) FROM public."Race")),
('Runner', (SELECT count(*) FROM _giq_history_stage.clean_runner), (SELECT count(*) FROM public."Runner")),
('Result', (SELECT count(*) FROM _giq_history_stage.clean_result), (SELECT count(*) FROM public."Result")),
('FormEntry', (SELECT count(*) FROM _giq_history_stage.clean_form_entry), (SELECT count(*) FROM public."FormEntry")),
('DogProfileForm', (SELECT count(*) FROM _giq_history_stage.clean_profile_form), (SELECT count(*) FROM public."DogProfileForm")),
('RaceVideo', (SELECT count(*) FROM _giq_history_stage.clean_race_video), (SELECT count(*) FROM public."RaceVideo")),
('DogProfileArchive', (SELECT count(*) FROM _giq_history_stage.clean_dog_profile_archive), (SELECT count(*) FROM public."DogProfileArchive")),
('RaceDayArchive', (SELECT count(*) FROM _giq_history_stage.clean_race_day_archive), (SELECT count(*) FROM public."RaceDayArchive"));

INSERT INTO public."Track"(
  id, name, state, surface, circumference, "straightLength", "boxCount", "hasIsolynx", "createdAt"
)
SELECT target_id, name, state, surface, circumference, straight_length, box_count, has_isolynx,
  clock_timestamp()
FROM _giq_history_stage.clean_track
ON CONFLICT DO NOTHING;

INSERT INTO public."Trainer"(id, name, state, "licenseNumber", "createdAt")
SELECT target_id, name, state, license_number, clock_timestamp()
FROM _giq_history_stage.clean_trainer
ON CONFLICT DO NOTHING;

INSERT INTO public."Dog"(
  id, name, "earBrand", colour, sex, "whelpDate", "sireId", "damId", "trainerId",
  "sourceProvider", "sourceId", "profileUrl", "ownerName", "careerStarts", "careerWins",
  "careerSeconds", "careerThirds", "prizeMoney", "winPercentage", "placePercentage",
  "profileStatsJson", "bestTimesJson", "boxHistoryJson", "distanceHistoryJson",
  "profileSourceRawJson", "lastProfileSyncedAt", "retiredAt", "createdAt", "updatedAt"
)
SELECT target_id, name, ear_brand, colour, sex, whelp_date, NULL, NULL, trainer_id,
  source_provider, source_id, profile_url, owner_name, career_starts, career_wins,
  career_seconds, career_thirds, prize_money, win_percentage, place_percentage,
  profile_stats_json, best_times_json, box_history_json, distance_history_json,
  profile_source_raw_json, last_profile_synced_at, retired_at, created_at, updated_at
FROM _giq_history_stage.clean_dog
ON CONFLICT DO NOTHING;

INSERT INTO public."Meeting"(
  id, "trackId", "meetingDate", "meetingType", "sourceProvider", "sourceId",
  "sourceRawJson", "lastSyncedAt", "createdAt"
)
SELECT target_id, track_id, meeting_date, meeting_type, source_provider, source_id,
  source_raw_json, last_synced_at, created_at
FROM _giq_history_stage.clean_meeting
ON CONFLICT DO NOTHING;

INSERT INTO public."Race"(
  id, "meetingId", "raceNumber", name, "raceTime", distance, grade, "prizeMoney",
  "resultStatus", "replayUrl", "photoFinishUrl", "sourceProvider", "sourceId",
  "sourceRawJson", "lastSyncedAt", "createdAt"
)
SELECT race.target_id, race.meeting_id, race.race_number, race.name, race.race_time,
  race.distance, race.grade, race.prize_money, race.result_status,
  coalesce(race.replay_url, '/videos/watch/races/' || video.source_id || '/replay'),
  coalesce(race.photo_finish_url, photo.photo_finish_url), race.source_provider,
  race.source_id, race.source_raw_json, race.last_synced_at, race.created_at
FROM _giq_history_stage.clean_race race
LEFT JOIN _giq_history_stage.clean_race_video video ON video.race_id = race.target_id
LEFT JOIN _giq_history_stage.clean_photo_finish photo ON photo.race_id = race.target_id
ON CONFLICT DO NOTHING;

INSERT INTO public."Runner"(
  id, "raceId", "dogId", "boxNumber", weight, "trainerId", "startingPrice", scratched,
  "sourceProvider", "sourceId", "sourceRawJson", "createdAt"
)
SELECT target_id, race_id, dog_id, box_number, weight, trainer_id, starting_price, scratched,
  source_provider, source_id, source_raw_json, created_at
FROM _giq_history_stage.clean_runner
ON CONFLICT DO NOTHING;

INSERT INTO public."Result"(
  id, "runnerId", "raceId", "finishingPosition", "runningTime", margin,
  "prizeMoneyWon", "splitTime", sectionals, "gpsData", "sourceProvider", "sourceId",
  "sourceRawJson", "lastSyncedAt", "createdAt"
)
SELECT target_id, runner_id, race_id, finishing_position, running_time, margin,
  prize_money_won, split_time, sectionals, gps_data, source_provider, source_id,
  source_raw_json, last_synced_at, created_at
FROM _giq_history_stage.clean_result
ON CONFLICT DO NOTHING;

INSERT INTO public."FormEntry"(
  id, "dogId", "raceId", "trackId", date, "boxNumber", finish, time, distance,
  grade, weight, "createdAt"
)
SELECT target_id, dog_id, race_id, track_id, date, box_number, finish, time, distance,
  grade, weight, created_at
FROM _giq_history_stage.clean_form_entry
ON CONFLICT DO NOTHING;

INSERT INTO public."DogProfileForm"(
  id, "dogId", "sourceProvider", "sourceId", "raceUrl", date, "trackCode", "trackName",
  "raceName", "finishText", "finishingPosition", starters, "boxNumber", weight,
  distance, grade, "runningTime", "winnerTime", "bestOfNightTime", "firstSectional",
  margin, "winnerDogName", "winnerDogSourceId", "inRunningPositions", "startingPrice",
  "hasVideo", "sourceRawJson", "createdAt", "updatedAt"
)
SELECT target_id, dog_id, source_provider, source_id, race_url, date, track_code, track_name,
  race_name, finish_text, finishing_position, starters, box_number, weight, distance,
  grade, running_time, winner_time, best_of_night_time, first_sectional, margin,
  winner_dog_name, winner_dog_source_id, in_running_positions, starting_price,
  has_video, source_raw_json, created_at, updated_at
FROM _giq_history_stage.clean_profile_form
ON CONFLICT DO NOTHING;

INSERT INTO public."DogProfileArchive"(
  id, "dogId", "sourceProvider", "sourceId", "profileUrl", "fetchedAt", "showMorePath",
  "candidateJson", "parsedJson", "profileHtml", "fullFormHtml", "createdAt", "updatedAt"
)
SELECT target_id, dog_id, source_provider, provider_source_id, profile_url, fetched_at,
  show_more_path, candidate_json, parsed_json, profile_html, full_form_html, created_at, updated_at
FROM _giq_history_stage.clean_dog_profile_archive
ON CONFLICT DO NOTHING;

INSERT INTO public."RaceDayArchive"(
  id, "sourceProvider", date, "fetchedAt", "rawPath", meetings, races, runners,
  results, dogs, trainers, "rawJson", "createdAt", "updatedAt"
)
SELECT target_id, source_provider, date, fetched_at, raw_path, meetings, races, runners,
  results, dogs, trainers, raw_json, created_at, updated_at
FROM _giq_history_stage.clean_race_day_archive
ON CONFLICT DO NOTHING;

INSERT INTO public."RaceVideo"(
  id, "raceId", "sourceProvider", "sourceId", kind, "pageUrl", "embedSourceType",
  "sourceRawJson", "createdAt", "updatedAt"
)
SELECT target_id, race_id, source_provider, source_id, kind, page_url, embed_source_type,
  source_raw_json, created_at, updated_at
FROM _giq_history_stage.clean_race_video
ON CONFLICT DO NOTHING;

SET CONSTRAINTS ALL IMMEDIATE;

DO $$
DECLARE
  table_name text;
  changed_rows bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Track', 'Trainer', 'Dog', 'Meeting', 'Race', 'Runner', 'Result', 'FormEntry',
    'DogProfileForm', 'RaceVideo', 'DogProfileArchive', 'RaceDayArchive'
  ] LOOP
    EXECUTE format(
      'SELECT count(*) FROM giq_clean_existing_row snapshot '
      'LEFT JOIN public.%I canonical ON canonical.id::text=snapshot.row_id '
      'WHERE snapshot.table_name=%L AND (canonical.id IS NULL '
      'OR encode(pg_catalog.sha256(convert_to(to_jsonb(canonical)::text,''UTF8'')),''hex'')<>snapshot.row_sha256)',
      table_name, table_name
    ) INTO changed_rows;
    IF changed_rows <> 0 THEN
      RAISE EXCEPTION 'clean partition changed or removed % pre-existing % rows', changed_rows, table_name;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  relation record;
  primary_key_order text;
  observed_count bigint;
  observed_md5 text;
BEGIN
  FOR relation IN
    SELECT manifest.table_name, table_class.oid
    FROM _giq_history_merge.protected_table_manifest manifest
    JOIN pg_class table_class ON table_class.relname = manifest.table_name
    JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
    WHERE namespace.nspname = 'public'
    ORDER BY manifest.table_name
  LOOP
    SELECT 'jsonb_build_array(' || string_agg(format('row_value.%I', attribute.attname),
      ', ' ORDER BY key_position.ordinality) || ')::text'
    INTO primary_key_order
    FROM pg_index index_definition
    CROSS JOIN LATERAL unnest(index_definition.indkey) WITH ORDINALITY key_position(attnum, ordinality)
    JOIN pg_attribute attribute
      ON attribute.attrelid = index_definition.indrelid AND attribute.attnum = key_position.attnum
    WHERE index_definition.indrelid = relation.oid AND index_definition.indisprimary;
    EXECUTE format(
      'SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(row_value)::text),'''' ORDER BY %s),'''')) '
      'FROM public.%I row_value', primary_key_order, relation.table_name
    ) INTO observed_count, observed_md5;
    IF NOT EXISTS (
      SELECT 1 FROM _giq_history_merge.protected_table_manifest expected
      WHERE expected.table_name = relation.table_name
        AND expected.row_count = observed_count AND expected.row_md5 = observed_md5
    ) THEN
      RAISE EXCEPTION 'clean partition changed protected public table %', relation.table_name;
    END IF;
  END LOOP;
END
$$;

UPDATE _giq_history_merge.clean_partition_apply_delta
SET after_rows = CASE table_name
    WHEN 'Track' THEN (SELECT count(*) FROM public."Track")
    WHEN 'Trainer' THEN (SELECT count(*) FROM public."Trainer")
    WHEN 'Dog' THEN (SELECT count(*) FROM public."Dog")
    WHEN 'Meeting' THEN (SELECT count(*) FROM public."Meeting")
    WHEN 'Race' THEN (SELECT count(*) FROM public."Race")
    WHEN 'Runner' THEN (SELECT count(*) FROM public."Runner")
    WHEN 'Result' THEN (SELECT count(*) FROM public."Result")
    WHEN 'FormEntry' THEN (SELECT count(*) FROM public."FormEntry")
    WHEN 'DogProfileForm' THEN (SELECT count(*) FROM public."DogProfileForm")
    WHEN 'RaceVideo' THEN (SELECT count(*) FROM public."RaceVideo")
    WHEN 'DogProfileArchive' THEN (SELECT count(*) FROM public."DogProfileArchive")
    WHEN 'RaceDayArchive' THEN (SELECT count(*) FROM public."RaceDayArchive")
  END;

UPDATE _giq_history_merge.clean_partition_apply_delta
SET inserted_rows = after_rows - before_rows,
    present_rows = CASE table_name
      WHEN 'Track' THEN (SELECT count(*) FROM _giq_history_stage.clean_track clean JOIN public."Track" canonical ON canonical.id=clean.target_id)
      WHEN 'Trainer' THEN (SELECT count(*) FROM _giq_history_stage.clean_trainer clean JOIN public."Trainer" canonical ON canonical.id=clean.target_id)
      WHEN 'Dog' THEN (SELECT count(*) FROM _giq_history_stage.clean_dog clean JOIN public."Dog" canonical ON canonical.id=clean.target_id)
      WHEN 'Meeting' THEN (SELECT count(*) FROM _giq_history_stage.clean_meeting clean JOIN public."Meeting" canonical ON canonical.id=clean.target_id)
      WHEN 'Race' THEN (SELECT count(*) FROM _giq_history_stage.clean_race clean JOIN public."Race" canonical ON canonical.id=clean.target_id)
      WHEN 'Runner' THEN (SELECT count(*) FROM _giq_history_stage.clean_runner clean JOIN public."Runner" canonical ON canonical.id=clean.target_id)
      WHEN 'Result' THEN (SELECT count(*) FROM _giq_history_stage.clean_result clean JOIN public."Result" canonical ON canonical.id=clean.target_id)
      WHEN 'FormEntry' THEN (SELECT count(*) FROM _giq_history_stage.clean_form_entry clean JOIN public."FormEntry" canonical ON canonical.id=clean.target_id)
      WHEN 'DogProfileForm' THEN (SELECT count(*) FROM _giq_history_stage.clean_profile_form clean JOIN public."DogProfileForm" canonical ON canonical.id=clean.target_id)
      WHEN 'RaceVideo' THEN (SELECT count(*) FROM _giq_history_stage.clean_race_video clean JOIN public."RaceVideo" canonical ON canonical.id=clean.target_id)
      WHEN 'DogProfileArchive' THEN (SELECT count(*) FROM _giq_history_stage.clean_dog_profile_archive clean JOIN public."DogProfileArchive" canonical ON canonical.id=clean.target_id)
      WHEN 'RaceDayArchive' THEN (SELECT count(*) FROM _giq_history_stage.clean_race_day_archive clean JOIN public."RaceDayArchive" canonical ON canonical.id=clean.target_id)
    END;

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = 0;

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_track clean
  JOIN public."Track" canonical ON canonical.id = clean.target_id
  WHERE _giq_history_merge.track_key(canonical.name, canonical.state) <> clean.natural_key
) WHERE table_name = 'Track';

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_dog clean
  JOIN public."Dog" canonical ON canonical.id = clean.target_id
  WHERE NOT (
    clean.source_provider IS NOT NULL AND clean.source_id IS NOT NULL
    AND lower(canonical."sourceProvider") = lower(clean.source_provider)
    AND canonical."sourceId" = clean.source_id
    OR lower(clean.source_provider) = 'thedogs' AND canonical."earBrand" = 'thedogs:' || clean.source_id
    OR EXISTS (
      SELECT 1 FROM public."DogSourceIdentity" identity
      WHERE identity."dogId" = canonical.id
        AND lower(identity."sourceProvider") = lower(clean.source_provider)
        AND identity."sourceId" = clean.source_id
        AND identity."verificationStatus" = 'verified'
    )
  )
) WHERE table_name = 'Dog';

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_meeting clean
  JOIN public."Meeting" canonical ON canonical.id = clean.target_id
  WHERE (canonical."trackId", canonical."meetingDate") IS DISTINCT FROM
        (clean.track_id, clean.meeting_date)
) WHERE table_name = 'Meeting';

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_race clean
  JOIN public."Race" canonical ON canonical.id = clean.target_id
  WHERE (canonical."meetingId", canonical."raceNumber") IS DISTINCT FROM
        (clean.meeting_id, clean.race_number)
) WHERE table_name = 'Race';

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_runner clean
  JOIN public."Runner" canonical ON canonical.id = clean.target_id
  WHERE (canonical."raceId", canonical."dogId", canonical."boxNumber") IS DISTINCT FROM
        (clean.race_id, clean.dog_id, clean.box_number)
) WHERE table_name = 'Runner';

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_result clean
  JOIN public."Result" canonical ON canonical.id = clean.target_id
  WHERE (canonical."runnerId", canonical."raceId") IS DISTINCT FROM
        (clean.runner_id, clean.race_id)
) WHERE table_name = 'Result';

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_form_entry clean
  JOIN public."FormEntry" canonical ON canonical.id = clean.target_id
  WHERE (canonical."dogId", canonical."raceId") IS DISTINCT FROM
        (clean.dog_id, clean.race_id)
) WHERE table_name = 'FormEntry';

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_profile_form clean
  JOIN public."DogProfileForm" canonical ON canonical.id = clean.target_id
  WHERE (canonical."dogId", lower(canonical."sourceProvider"), canonical."sourceId") IS DISTINCT FROM
        (clean.dog_id, lower(clean.source_provider), clean.source_id)
) WHERE table_name = 'DogProfileForm';

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_race_video clean
  JOIN public."RaceVideo" canonical ON canonical.id = clean.target_id
  WHERE (canonical."raceId", lower(canonical."sourceProvider"), canonical."sourceId", canonical.kind)
    IS DISTINCT FROM (clean.race_id, lower(clean.source_provider), clean.source_id, clean.kind)
) WHERE table_name = 'RaceVideo';

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_dog_profile_archive clean
  JOIN public."DogProfileArchive" canonical ON canonical.id = clean.target_id
  WHERE (canonical."dogId", lower(canonical."sourceProvider"), canonical."sourceId") IS DISTINCT FROM
        (clean.dog_id, lower(clean.source_provider), clean.provider_source_id)
) WHERE table_name = 'DogProfileArchive';

UPDATE _giq_history_merge.clean_partition_apply_delta SET identity_mismatch_rows = (
  SELECT count(*) FROM _giq_history_stage.clean_race_day_archive clean
  JOIN public."RaceDayArchive" canonical ON canonical.id = clean.target_id
  WHERE (lower(canonical."sourceProvider"), canonical.date) IS DISTINCT FROM
        (lower(clean.source_provider), clean.date)
) WHERE table_name = 'RaceDayArchive';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM _giq_history_merge.clean_partition_apply_delta
    WHERE after_rows < before_rows OR inserted_rows < 0
      OR present_rows <> eligible_rows OR identity_mismatch_rows <> 0
  ) THEN
    RAISE EXCEPTION 'clean partition apply conservation or identity verification failed';
  END IF;
END
$$;

CREATE TABLE _giq_history_merge.clean_partition_apply_manifest (
  id integer PRIMARY KEY CHECK (id = 1),
  schema_version text NOT NULL,
  status text NOT NULL CHECK (status = 'applied'),
  candidate_database text NOT NULL,
  candidate_database_oid oid NOT NULL,
  clone_operation_id uuid NOT NULL,
  normalized_manifest_sha256 text NOT NULL CHECK (normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  confirmation_sha256 text NOT NULL CHECK (confirmation_sha256 ~ '^[0-9a-f]{64}$'),
  eligible_rows bigint NOT NULL,
  inserted_rows bigint NOT NULL,
  existing_rows_preserved boolean NOT NULL,
  protected_tables_preserved boolean NOT NULL,
  deferred_authoritative_rows bigint NOT NULL,
  table_deltas jsonb NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO _giq_history_merge.clean_partition_apply_manifest (
  id, schema_version, status, candidate_database, candidate_database_oid,
  clone_operation_id, normalized_manifest_sha256, confirmation_sha256,
  eligible_rows, inserted_rows, existing_rows_preserved, protected_tables_preserved,
  deferred_authoritative_rows, table_deltas
)
SELECT 1, 'giq-clean-partition-apply/v1', 'applied', current_database(),
  (SELECT oid FROM pg_database WHERE datname = current_database()), marker.clone_operation_id,
  marker.normalized_manifest_sha256,
  encode(pg_catalog.sha256(convert_to(
    current_setting('giq.clean_partition_confirmation'), 'UTF8'
  )), 'hex'),
  (SELECT sum(eligible_rows) FROM _giq_history_merge.clean_partition_apply_delta),
  (SELECT sum(inserted_rows) FROM _giq_history_merge.clean_partition_apply_delta),
  true, true,
  (SELECT sum(eligible_rows) FROM _giq_history_merge.clean_partition_normalized_manifest
   WHERE apply_action = 'deferred-authoritative'),
  (SELECT jsonb_object_agg(table_name, jsonb_build_object(
      'eligible', eligible_rows, 'before', before_rows, 'after', after_rows,
      'inserted', inserted_rows, 'present', present_rows,
      'identityMismatches', identity_mismatch_rows
    ) ORDER BY table_name)
   FROM _giq_history_merge.clean_partition_apply_delta)
FROM _giq_history_merge.run marker WHERE marker.id = 1;

CREATE TRIGGER clean_partition_apply_manifest_append_only
BEFORE UPDATE OR DELETE ON _giq_history_merge.clean_partition_apply_manifest
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_clean_partition_evidence_mutation();
CREATE TRIGGER clean_partition_apply_delta_append_only
BEFORE UPDATE OR DELETE ON _giq_history_merge.clean_partition_apply_delta
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_clean_partition_evidence_mutation();

REVOKE ALL ON _giq_history_merge.clean_partition_apply_manifest FROM PUBLIC;
REVOKE ALL ON _giq_history_merge.clean_partition_apply_delta FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event', 'CLEAN_PARTITION_APPLIED',
  'database', candidate_database,
  'manifestSha256', normalized_manifest_sha256,
  'eligibleRows', eligible_rows,
  'insertedRows', inserted_rows,
  'deferredAuthoritativeRows', deferred_authoritative_rows,
  'existingRowsPreserved', existing_rows_preserved,
  'protectedTablesPreserved', protected_tables_preserved
)
FROM _giq_history_merge.clean_partition_apply_manifest WHERE id = 1;
