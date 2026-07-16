\set ON_ERROR_STOP on

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '90min';

CREATE OR REPLACE FUNCTION pg_temp.giq_try_jsonb(value text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN value::jsonb;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END
$$;

LOCK TABLE
  public."Track", public."Trainer", public."Dog", public."Meeting",
  public."Race", public."RaceVideo", public."Runner", public."Result",
  public."FormEntry", public."DogProfileForm", public."DogProfileArchive",
  public."RaceDayArchive", public."PedigreeImportRun",
  public."DogSourceIdentity", public."PedigreeAssertion",
  public."PedigreeMergeLedger"
IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE giq_private_before (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  content_sha256 text NOT NULL
) ON COMMIT DROP;

DO $$
BEGIN
  IF (SELECT count(*) FROM giq_portable."DogProfileForm") <> 5904337 THEN
    RAISE EXCEPTION 'portable canonical DogProfileForm partition must contain exactly 5904337 rows';
  END IF;
  IF EXISTS (
    SELECT 1 FROM giq_portable."DogProfileForm"
    WHERE "raceUrl" !~ '^/racing/[^?#]+/?$'
       OR "raceUrl" ~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
  ) THEN
    RAISE EXCEPTION 'portable DogProfileForm contains a non-canonical /racing identity';
  END IF;
  IF (
    SELECT count(*) FROM giq_portable."DogProfileForm"
    WHERE lower(coalesce("trackName", '')) = 'temora'
      AND date::date = DATE '2008-10-19'
      AND "raceUrl" = '/racing/temora/2008-10-19/3/'
      AND "sourceId" = '/racing/temora/2008-10-19/3?trial=false'
  ) <> 8 THEN
    RAISE EXCEPTION 'Temora recovery must preserve 8 raw sourceId values and canonical raceUrl values';
  END IF;
END
$$;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> ALL (ARRAY[
        'Track', 'Trainer', 'Dog', 'Meeting', 'Race', 'RaceVideo', 'Runner',
        'Result', 'FormEntry', 'DogProfileForm', 'DogProfileArchive',
        'RaceDayArchive', 'PedigreeImportRun', 'DogSourceIdentity',
        'PedigreeAssertion', 'PedigreeMergeLedger'
      ])
    ORDER BY tablename
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE MODE', item.tablename);
  END LOOP;
END
$$;

DO $$
DECLARE
  item record;
  observed_count bigint;
  observed_sha256 text;
BEGIN
  FOR item IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> ALL (ARRAY[
        'Track', 'Trainer', 'Dog', 'Meeting', 'Race', 'RaceVideo', 'Runner',
        'Result', 'FormEntry', 'DogProfileForm', 'DogProfileArchive',
        'RaceDayArchive', 'PedigreeImportRun', 'DogSourceIdentity',
        'PedigreeAssertion', 'PedigreeMergeLedger'
      ])
    ORDER BY tablename
  LOOP
    EXECUTE format($query$
      SELECT
        count(*),
        encode(sha256(convert_to(coalesce(
          string_agg(length(row_json)::text || ':' || row_json, '' ORDER BY row_json),
          ''
        ), 'UTF8')), 'hex')
      FROM (
        SELECT to_jsonb(value)::text AS row_json FROM public.%I value
      ) row_values
    $query$, item.tablename) INTO observed_count, observed_sha256;
    INSERT INTO giq_private_before VALUES (item.tablename, observed_count, observed_sha256);
  END LOOP;
END
$$;

CREATE TEMP TABLE giq_excluded_race(id text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO giq_excluded_race(id)
SELECT race.id
FROM public."Race" race
JOIN public."Meeting" meeting ON meeting.id = race."meetingId"
JOIN public."Track" track ON track.id = meeting."trackId"
WHERE lower(coalesce(meeting."sourceProvider", '')) IN ('demo', 'greyhoundiq-demo')
   OR lower(coalesce(race."sourceProvider", '')) IN ('demo', 'greyhoundiq-demo')
   OR lower(btrim(track.name)) = 'greyhoundiq demo park';

DELETE FROM public."DogProfileForm"
WHERE "raceUrl" ~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
   OR "raceUrl" !~ '^/racing/[^?#]+/?$';

DELETE FROM public."FormEntry" form USING giq_excluded_race excluded WHERE form."raceId" = excluded.id;
DELETE FROM public."Result" result
USING public."Runner" runner, giq_excluded_race excluded
WHERE result."runnerId" = runner.id AND runner."raceId" = excluded.id;
DELETE FROM public."RaceVideo" video USING giq_excluded_race excluded WHERE video."raceId" = excluded.id;
DELETE FROM public."Runner" runner USING giq_excluded_race excluded WHERE runner."raceId" = excluded.id;
DELETE FROM public."Race" race USING giq_excluded_race excluded WHERE race.id = excluded.id;
DELETE FROM public."Meeting" meeting
USING public."Track" track
WHERE meeting."trackId" = track.id
  AND (
    lower(coalesce(meeting."sourceProvider", '')) IN ('demo', 'greyhoundiq-demo')
    OR lower(btrim(track.name)) = 'greyhoundiq demo park'
  )
  AND NOT EXISTS (SELECT 1 FROM public."Race" race WHERE race."meetingId" = meeting.id);
DELETE FROM public."RaceDayArchive"
WHERE lower("sourceProvider") IN ('demo', 'greyhoundiq-demo');
DELETE FROM public."Track" track
WHERE lower(btrim(track.name)) = 'greyhoundiq demo park'
  AND NOT EXISTS (SELECT 1 FROM public."Meeting" meeting WHERE meeting."trackId" = track.id);

CREATE TEMP TABLE giq_meadows_track_map ON COMMIT DROP AS
SELECT
  track.id AS source_id,
  first_value(track.id) OVER (
    ORDER BY (lower(btrim(track.name)) = 'the meadows') DESC, track.id
  ) AS canonical_id
FROM public."Track" track
WHERE lower(btrim(track.name)) IN ('meadows', 'the meadows');

DO $$
DECLARE
  foreign_key record;
  has_private_reference boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public."Meeting" meeting
    JOIN giq_meadows_track_map map ON map.source_id = meeting."trackId"
    GROUP BY map.canonical_id, meeting."meetingDate"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Meadows alias consolidation would collide on Meeting(trackId, meetingDate)';
  END IF;

  FOR foreign_key IN
    SELECT
      namespace.nspname AS schema_name,
      relation.relname AS table_name,
      attribute.attname AS column_name
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute attribute
      ON attribute.attrelid = constraint_row.conrelid
     AND attribute.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public."Track"'::regclass
      AND cardinality(constraint_row.conkey) = 1
      AND constraint_row.conrelid NOT IN (
        'public."Meeting"'::regclass,
        'public."FormEntry"'::regclass
      )
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I IN (SELECT source_id FROM giq_meadows_track_map WHERE source_id <> canonical_id))',
      foreign_key.schema_name,
      foreign_key.table_name,
      foreign_key.column_name
    ) INTO has_private_reference;
    IF has_private_reference THEN
      RAISE EXCEPTION 'Meadows alias Track is referenced by non-allowlisted %.%; no private row was changed',
        foreign_key.schema_name, foreign_key.table_name;
    END IF;
  END LOOP;
END
$$;

UPDATE public."Meeting" meeting
SET "trackId" = map.canonical_id
FROM giq_meadows_track_map map
WHERE meeting."trackId" = map.source_id
  AND map.source_id <> map.canonical_id;

UPDATE public."FormEntry" form
SET "trackId" = map.canonical_id
FROM giq_meadows_track_map map
WHERE form."trackId" = map.source_id
  AND map.source_id <> map.canonical_id;

DELETE FROM public."Track" track
USING giq_meadows_track_map map
WHERE track.id = map.source_id
  AND map.source_id <> map.canonical_id;

UPDATE public."Track" track
SET name = 'The Meadows'
FROM (SELECT DISTINCT canonical_id FROM giq_meadows_track_map) canonical
WHERE track.id = canonical.canonical_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_portable."Track" source
    JOIN public."Track" target ON target.id = source.id
    WHERE (
      lower(CASE WHEN lower(btrim(source.name)) IN ('meadows', 'the meadows') THEN 'The Meadows' WHEN lower(btrim(source.name)) IN ('palmerston - north', 'palmerston north') THEN 'Palmerston North' ELSE btrim(source.name) END),
      CASE WHEN lower(btrim(source.name)) = 'canberra' THEN 'ACT' WHEN lower(btrim(source.name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') THEN 'NZ' ELSE upper(btrim(source.state)) END
    ) IS DISTINCT FROM (
      lower(CASE WHEN lower(btrim(target.name)) IN ('meadows', 'the meadows') THEN 'The Meadows' WHEN lower(btrim(target.name)) IN ('palmerston - north', 'palmerston north') THEN 'Palmerston North' ELSE btrim(target.name) END),
      CASE WHEN lower(btrim(target.name)) = 'canberra' THEN 'ACT' WHEN lower(btrim(target.name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') THEN 'NZ' ELSE upper(btrim(target.state)) END
    )
  ) THEN
    RAISE EXCEPTION 'portable Track primary key collides with a different local natural key';
  END IF;

END
$$;

CREATE TEMP TABLE giq_portable_track_identity ON COMMIT DROP AS
SELECT
  source.id AS source_id,
  lower(CASE WHEN lower(btrim(source.name)) IN ('meadows', 'the meadows') THEN 'The Meadows' WHEN lower(btrim(source.name)) IN ('palmerston - north', 'palmerston north') THEN 'Palmerston North' ELSE btrim(source.name) END) AS canonical_name,
  CASE WHEN lower(btrim(source.name)) = 'canberra' THEN 'ACT' WHEN lower(btrim(source.name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') THEN 'NZ' ELSE upper(btrim(source.state)) END AS canonical_state,
  first_value(source.id) OVER (
    PARTITION BY
      lower(CASE WHEN lower(btrim(source.name)) IN ('meadows', 'the meadows') THEN 'The Meadows' WHEN lower(btrim(source.name)) IN ('palmerston - north', 'palmerston north') THEN 'Palmerston North' ELSE btrim(source.name) END),
      CASE WHEN lower(btrim(source.name)) = 'canberra' THEN 'ACT' WHEN lower(btrim(source.name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') THEN 'NZ' ELSE upper(btrim(source.state)) END
    ORDER BY (lower(btrim(source.name)) IN ('the meadows', 'palmerston north')) DESC, source.id
  ) AS representative_source_id
FROM giq_portable."Track" source;

CREATE TEMP TABLE giq_track_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO public."Track" (
  id, name, state, surface, circumference, "straightLength", "boxCount",
  "hasIsolynx", "createdAt"
)
SELECT
  source.id,
  CASE WHEN identity.canonical_name = 'the meadows' THEN 'The Meadows' WHEN identity.canonical_name = 'palmerston north' THEN 'Palmerston North' ELSE btrim(source.name) END,
  identity.canonical_state,
  source.surface,
  source.circumference,
  source."straightLength",
  source."boxCount",
  source."hasIsolynx",
  source."createdAt"
FROM giq_portable_track_identity identity
JOIN giq_portable."Track" source ON source.id = identity.source_id
WHERE identity.source_id = identity.representative_source_id
  AND NOT EXISTS (
    SELECT 1 FROM public."Track" target
    WHERE lower(CASE WHEN lower(btrim(target.name)) IN ('meadows', 'the meadows') THEN 'The Meadows' WHEN lower(btrim(target.name)) IN ('palmerston - north', 'palmerston north') THEN 'Palmerston North' ELSE btrim(target.name) END) = identity.canonical_name
      AND CASE WHEN lower(btrim(target.name)) = 'canberra' THEN 'ACT' WHEN lower(btrim(target.name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') THEN 'NZ' ELSE upper(btrim(target.state)) END = identity.canonical_state
  );

INSERT INTO giq_track_map(source_id, target_id)
SELECT identity.source_id, target.id
FROM giq_portable_track_identity identity
JOIN public."Track" target
  ON lower(CASE WHEN lower(btrim(target.name)) IN ('meadows', 'the meadows') THEN 'The Meadows' WHEN lower(btrim(target.name)) IN ('palmerston - north', 'palmerston north') THEN 'Palmerston North' ELSE btrim(target.name) END) = identity.canonical_name
 AND CASE WHEN lower(btrim(target.name)) = 'canberra' THEN 'ACT' WHEN lower(btrim(target.name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') THEN 'NZ' ELSE upper(btrim(target.state)) END = identity.canonical_state;

DO $$
BEGIN
  IF (SELECT count(*) FROM giq_track_map) <> (SELECT count(*) FROM giq_portable."Track")
    OR EXISTS (
      SELECT canonical_name, canonical_state
      FROM giq_portable_track_identity identity
      JOIN giq_track_map map ON map.source_id = identity.source_id
      GROUP BY canonical_name, canonical_state
      HAVING count(DISTINCT map.target_id) <> 1
    )
  THEN
    RAISE EXCEPTION 'portable Track canonical identity did not resolve exactly once';
  END IF;

  IF EXISTS (
    SELECT map.target_id, meeting."meetingDate"
    FROM giq_portable."Meeting" meeting
    JOIN giq_track_map map ON map.source_id = meeting."trackId"
    GROUP BY map.target_id, meeting."meetingDate"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'portable Meadows alias consolidation would collide on Meeting(trackId, meetingDate)';
  END IF;
END
$$;

UPDATE public."Track" target
SET
  name = CASE WHEN identity.canonical_name = 'the meadows' THEN 'The Meadows' WHEN identity.canonical_name = 'palmerston north' THEN 'Palmerston North' ELSE btrim(source.name) END,
  state = identity.canonical_state,
  surface = coalesce(source.surface, target.surface),
  circumference = coalesce(source.circumference, target.circumference),
  "straightLength" = coalesce(source."straightLength", target."straightLength"),
  "boxCount" = source."boxCount",
  "hasIsolynx" = source."hasIsolynx",
  "createdAt" = least(target."createdAt", source."createdAt")
FROM giq_portable_track_identity identity
JOIN giq_portable."Track" source ON source.id = identity.representative_source_id
JOIN giq_track_map map ON map.source_id = identity.source_id
WHERE identity.source_id = identity.representative_source_id
  AND target.id = map.target_id;

CREATE TEMP TABLE giq_trainer_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE giq_local_trainer_provider_identity ON COMMIT DROP AS
SELECT
  runner."trainerId" AS target_id,
  pg_temp.giq_try_jsonb(runner."sourceRawJson")->>'trainerId' AS identity_value
FROM public."Runner" runner
WHERE lower(coalesce(runner."sourceProvider", '')) = 'thedogs'
  AND runner."trainerId" IS NOT NULL
  AND nullif(pg_temp.giq_try_jsonb(runner."sourceRawJson")->>'trainerId', '') IS NOT NULL
GROUP BY runner."trainerId", pg_temp.giq_try_jsonb(runner."sourceRawJson")->>'trainerId';

CREATE TEMP TABLE giq_trainer_exact_match (
  source_id text NOT NULL,
  target_id text NOT NULL,
  evidence_kind text NOT NULL,
  evidence_value text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_trainer_exact_match(source_id, target_id, evidence_kind, evidence_value)
SELECT crosswalk."candidateTrainerId", target.id,
       crosswalk."identityKind", crosswalk."identityValue"
FROM giq_portable."TrainerIdentityCrosswalk" crosswalk
JOIN public."Trainer" target
  ON crosswalk."identityKind" = 'r2-source-trainer-id'
 AND target.id = crosswalk."identityValue";

INSERT INTO giq_trainer_exact_match(source_id, target_id, evidence_kind, evidence_value)
SELECT crosswalk."candidateTrainerId", local_identity.target_id,
       crosswalk."identityKind", crosswalk."identityValue"
FROM giq_portable."TrainerIdentityCrosswalk" crosswalk
JOIN giq_local_trainer_provider_identity local_identity
  ON crosswalk."identityKind" = 'thedogs-provider-id'
 AND local_identity.identity_value = crosswalk."identityValue";

DO $$
BEGIN
  IF EXISTS (
    SELECT target_id
    FROM giq_local_trainer_provider_identity
    GROUP BY target_id
    HAVING count(DISTINCT identity_value) > 1
  ) OR EXISTS (
    SELECT identity_value
    FROM giq_local_trainer_provider_identity
    GROUP BY identity_value
    HAVING count(DISTINCT target_id) > 1
  ) THEN
    RAISE EXCEPTION 'local Runner provider evidence maps Trainer identities ambiguously';
  END IF;

  IF EXISTS (
    SELECT "candidateTrainerId"
    FROM giq_portable."TrainerIdentityCrosswalk"
    WHERE "identityKind" = 'thedogs-provider-id'
    GROUP BY "candidateTrainerId"
    HAVING count(DISTINCT "identityValue") > 1
  ) OR EXISTS (
    SELECT "identityKind", "identityValue"
    FROM giq_portable."TrainerIdentityCrosswalk"
    GROUP BY "identityKind", "identityValue"
    HAVING count(DISTINCT "candidateTrainerId") > 1
  ) THEN
    RAISE EXCEPTION 'portable Trainer identity crosswalk is ambiguous';
  END IF;

  IF EXISTS (
    SELECT target_id
    FROM giq_trainer_exact_match
    GROUP BY target_id
    HAVING count(DISTINCT source_id) > 1
  ) THEN
    RAISE EXCEPTION 'one local Trainer is claimed by multiple portable exact identities';
  END IF;

  IF EXISTS (
    SELECT exact_match.source_id
    FROM giq_trainer_exact_match exact_match
    GROUP BY exact_match.source_id
    HAVING count(DISTINCT exact_match.target_id) > 1
       AND NOT EXISTS (
         SELECT 1
         FROM giq_portable."TrainerIdentityCrosswalk" provider_identity
         WHERE provider_identity."candidateTrainerId" = exact_match.source_id
           AND provider_identity."identityKind" = 'thedogs-provider-id'
       )
  ) THEN
    RAISE EXCEPTION 'multiple local r2 Trainer IDs lack one reviewed provider identity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM giq_portable."Trainer" source
    LEFT JOIN giq_portable."TrainerIdentityCrosswalk" crosswalk
      ON crosswalk."candidateTrainerId" = source.id
    WHERE crosswalk."candidateTrainerId" IS NULL
  ) THEN
    RAISE EXCEPTION 'portable Trainer lacks an exact provider or r2 source identity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM giq_portable."Trainer" source
    LEFT JOIN giq_trainer_exact_match exact_match ON exact_match.source_id = source.id
    JOIN public."Trainer" collision ON collision.id = source.id
    WHERE exact_match.source_id IS NULL
  ) THEN
    RAISE EXCEPTION 'new portable Trainer id already exists locally';
  END IF;
END
$$;

INSERT INTO giq_trainer_map(source_id, target_id)
SELECT DISTINCT ON (source_id) source_id, target_id
FROM giq_trainer_exact_match
ORDER BY
  source_id,
  (target_id = source_id) DESC,
  (evidence_kind = 'thedogs-provider-id') DESC,
  target_id;

INSERT INTO public."Trainer" (id, name, state, "licenseNumber", "createdAt")
SELECT source.id, source.name, source.state, source."licenseNumber", source."createdAt"
FROM giq_portable."Trainer" source
LEFT JOIN giq_trainer_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_trainer_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."Trainer" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."Trainer" target
SET
  name = source.name,
  state = coalesce(source.state, target.state),
  "licenseNumber" = coalesce(source."licenseNumber", target."licenseNumber"),
  "createdAt" = least(target."createdAt", source."createdAt")
FROM giq_portable."Trainer" source
JOIN giq_trainer_map map ON map.source_id = source.id
WHERE target.id = map.target_id;

-- Multiple local r2 Trainer IDs may be consolidated only when the reviewed
-- crosswalk proves that they share one exact provider identity. Name, state and
-- license text are never identity evidence here.
CREATE TEMP TABLE giq_trainer_exact_duplicate ON COMMIT DROP AS
SELECT DISTINCT exact_match.target_id AS duplicate_id, map.target_id
FROM giq_trainer_exact_match exact_match
JOIN giq_trainer_map map ON map.source_id = exact_match.source_id
WHERE exact_match.target_id <> map.target_id;

UPDATE public."Dog" dog
SET "trainerId" = duplicate.target_id
FROM giq_trainer_exact_duplicate duplicate
WHERE dog."trainerId" = duplicate.duplicate_id;

UPDATE public."Runner" runner
SET "trainerId" = duplicate.target_id
FROM giq_trainer_exact_duplicate duplicate
WHERE runner."trainerId" = duplicate.duplicate_id;

DELETE FROM public."Trainer" trainer
USING giq_trainer_exact_duplicate duplicate
WHERE trainer.id = duplicate.duplicate_id;

-- The historical local database contains 44 real Dog rows whose independently
-- generated IDs are not accompanied by an ear brand or complete provider key.
-- Resolve them only through a candidate-stable primary ID or the exact
-- track/date/race/box observation shared by the local and portable race graphs.
-- No dog name, sex, colour or other descriptive field is identity evidence.
CREATE TEMP TABLE giq_residual_local_dog ON COMMIT DROP AS
SELECT dog.id
FROM public."Dog" dog
WHERE nullif(btrim(dog."earBrand"), '') IS NULL
  AND (
    nullif(btrim(dog."sourceProvider"), '') IS NULL
    OR nullif(btrim(dog."sourceId"), '') IS NULL
  );

CREATE UNIQUE INDEX giq_residual_local_dog_id_idx
  ON giq_residual_local_dog(id);

CREATE TEMP TABLE giq_residual_dog_exact_evidence ON COMMIT DROP AS
SELECT
  local_dog.id AS local_id,
  source.id AS source_id,
  'candidate-primary-id'::text AS evidence_kind
FROM giq_residual_local_dog local_dog
JOIN giq_portable."Dog" source ON source.id = local_dog.id
UNION
SELECT DISTINCT
  local_runner."dogId" AS local_id,
  source_runner."dogId" AS source_id,
  'race-track-date-number-box'::text AS evidence_kind
FROM giq_residual_local_dog local_dog
JOIN public."Runner" local_runner ON local_runner."dogId" = local_dog.id
JOIN public."Race" local_race ON local_race.id = local_runner."raceId"
JOIN public."Meeting" local_meeting ON local_meeting.id = local_race."meetingId"
JOIN public."Track" local_track ON local_track.id = local_meeting."trackId"
JOIN giq_portable."Track" source_track
  ON lower(CASE
       WHEN lower(btrim(source_track.name)) IN ('meadows', 'the meadows') THEN 'The Meadows'
       WHEN lower(btrim(source_track.name)) IN ('palmerston - north', 'palmerston north') THEN 'Palmerston North'
       ELSE btrim(source_track.name)
     END) = lower(CASE
       WHEN lower(btrim(local_track.name)) IN ('meadows', 'the meadows') THEN 'The Meadows'
       WHEN lower(btrim(local_track.name)) IN ('palmerston - north', 'palmerston north') THEN 'Palmerston North'
       ELSE btrim(local_track.name)
     END)
 AND CASE
       WHEN lower(btrim(source_track.name)) = 'canberra' THEN 'ACT'
       WHEN lower(btrim(source_track.name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') THEN 'NZ'
       ELSE upper(btrim(source_track.state))
     END = CASE
       WHEN lower(btrim(local_track.name)) = 'canberra' THEN 'ACT'
       WHEN lower(btrim(local_track.name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') THEN 'NZ'
       ELSE upper(btrim(local_track.state))
     END
JOIN giq_portable."Meeting" source_meeting
  ON source_meeting."trackId" = source_track.id
 AND source_meeting."meetingDate" = local_meeting."meetingDate"
JOIN giq_portable."Race" source_race
  ON source_race."meetingId" = source_meeting.id
 AND source_race."raceNumber" = local_race."raceNumber"
JOIN giq_portable."Runner" source_runner
  ON source_runner."raceId" = source_race.id
 AND source_runner."boxNumber" = local_runner."boxNumber"
JOIN giq_portable."Dog" source_dog ON source_dog.id = source_runner."dogId";

CREATE TEMP TABLE giq_residual_dog_resolution ON COMMIT DROP AS
SELECT evidence.local_id, min(evidence.source_id) AS source_id
FROM giq_residual_dog_exact_evidence evidence
GROUP BY evidence.local_id
HAVING count(DISTINCT evidence.source_id) = 1;

CREATE UNIQUE INDEX giq_residual_dog_resolution_local_idx
  ON giq_residual_dog_resolution(local_id);
CREATE UNIQUE INDEX giq_residual_dog_resolution_source_idx
  ON giq_residual_dog_resolution(source_id);

DO $$
DECLARE
  residual_rows bigint;
  synthetic_rows bigint;
BEGIN
  SELECT count(*) INTO residual_rows FROM giq_residual_local_dog;
  SELECT count(*) INTO synthetic_rows
  FROM public."Dog" WHERE "earBrand" ~ '^thedogs:[0-9]+$';

  IF synthetic_rows = 198887 AND residual_rows <> 44 THEN
    RAISE EXCEPTION 'historical local residual Dog inventory changed: expected 44, observed %', residual_rows;
  END IF;
  IF EXISTS (
    SELECT local_id FROM giq_residual_dog_exact_evidence
    GROUP BY local_id HAVING count(DISTINCT source_id) > 1
  ) OR EXISTS (
    SELECT source_id FROM giq_residual_dog_exact_evidence
    GROUP BY source_id HAVING count(DISTINCT local_id) > 1
  ) THEN
    RAISE EXCEPTION 'residual local Dog exact evidence is ambiguous; no local or private row was changed';
  END IF;
  IF (SELECT count(*) FROM giq_residual_dog_resolution) <> residual_rows THEN
    RAISE EXCEPTION 'residual local Dogs lack stable candidate ID or exact race observation: unresolved %',
      residual_rows - (SELECT count(*) FROM giq_residual_dog_resolution);
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT lower(btrim("sourceProvider")), btrim("sourceId")
    FROM public."Dog"
    WHERE nullif(btrim("sourceProvider"), '') IS NOT NULL
      AND nullif(btrim("sourceId"), '') IS NOT NULL
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'local Dog provider identity is ambiguous before exact TheDogs consolidation';
  END IF;
END
$$;

CREATE TEMP TABLE giq_thedogs_local_identity_pair ON COMMIT DROP AS
SELECT
  source.id AS source_id,
  source."sourceId" AS provider_source_id,
  synthetic.id AS synthetic_local_id,
  provider.id AS provider_local_id
FROM giq_portable."Dog" source
JOIN public."Dog" synthetic
  ON synthetic."earBrand" = 'thedogs:' || source."sourceId"
LEFT JOIN public."Dog" provider
  ON lower(btrim(provider."sourceProvider")) = 'thedogs'
 AND provider."sourceId" = source."sourceId"
WHERE lower(btrim(source."sourceProvider")) = 'thedogs'
  AND source."sourceId" ~ '^[0-9]+$';

CREATE TEMP TABLE giq_thedogs_local_identity_proof ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public."Dog" WHERE "earBrand" ~ '^thedogs:[0-9]+$')::bigint AS synthetic_local_rows,
  count(*)::bigint AS exact_pair_rows,
  count(DISTINCT source_id)::bigint AS distinct_candidate_rows,
  count(DISTINCT provider_source_id)::bigint AS distinct_provider_ids,
  count(DISTINCT synthetic_local_id)::bigint AS distinct_synthetic_local_rows
FROM giq_thedogs_local_identity_pair;

DO $$
DECLARE
  proof giq_thedogs_local_identity_proof%ROWTYPE;
BEGIN
  SELECT * INTO proof FROM giq_thedogs_local_identity_proof;
  IF proof.synthetic_local_rows <> 0 AND (
    proof.synthetic_local_rows <> 198887
    OR proof.exact_pair_rows <> 198887
    OR proof.distinct_candidate_rows <> 198887
    OR proof.distinct_provider_ids <> 198887
    OR proof.distinct_synthetic_local_rows <> 198887
  ) THEN
    RAISE EXCEPTION 'local earBrand=thedogs:<id> to candidate provider identity must be exact one-to-one for 198887 rows';
  END IF;
END
$$;

CREATE TEMP TABLE giq_dog_private_reference(
  dog_id text PRIMARY KEY
) ON COMMIT DROP;

DO $$
DECLARE
  foreign_key record;
BEGIN
  FOR foreign_key IN
    SELECT
      namespace.nspname AS schema_name,
      relation.relname AS table_name,
      attribute.attname AS column_name
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute attribute
      ON attribute.attrelid = constraint_row.conrelid
     AND attribute.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public."Dog"'::regclass
      AND cardinality(constraint_row.conkey) = 1
      AND constraint_row.conrelid NOT IN (
        'public."Dog"'::regclass,
        'public."Runner"'::regclass,
        'public."FormEntry"'::regclass,
        'public."DogProfileForm"'::regclass,
        'public."DogProfileArchive"'::regclass,
        'public."DogSourceIdentity"'::regclass,
        'public."PedigreeMergeLedger"'::regclass
      )
  LOOP
    EXECUTE format(
      'INSERT INTO giq_dog_private_reference(dog_id) SELECT DISTINCT %I FROM %I.%I WHERE %I IS NOT NULL ON CONFLICT DO NOTHING',
      foreign_key.column_name,
      foreign_key.schema_name,
      foreign_key.table_name,
      foreign_key.column_name
    );
  END LOOP;
END
$$;

CREATE TEMP TABLE giq_thedogs_local_target ON COMMIT DROP AS
SELECT
  pair.source_id,
  pair.provider_source_id,
  CASE
    WHEN residual_private.dog_id IS NOT NULL THEN residual.local_id
    WHEN provider_private.dog_id IS NOT NULL THEN pair.provider_local_id
    WHEN synthetic_private.dog_id IS NOT NULL THEN pair.synthetic_local_id
    ELSE coalesce(pair.provider_local_id, residual.local_id, pair.synthetic_local_id)
  END AS target_id,
  (SELECT count(DISTINCT private_id)
   FROM unnest(ARRAY[
     residual_private.dog_id,
     provider_private.dog_id,
     synthetic_private.dog_id
   ]) private_id
   WHERE private_id IS NOT NULL) AS private_target_count
FROM giq_thedogs_local_identity_pair pair
LEFT JOIN giq_residual_dog_resolution residual ON residual.source_id = pair.source_id
LEFT JOIN giq_dog_private_reference residual_private ON residual_private.dog_id = residual.local_id
LEFT JOIN giq_dog_private_reference provider_private ON provider_private.dog_id = pair.provider_local_id
LEFT JOIN giq_dog_private_reference synthetic_private ON synthetic_private.dog_id = pair.synthetic_local_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM giq_thedogs_local_target WHERE private_target_count > 1) THEN
    RAISE EXCEPTION 'one exact TheDogs identity has multiple private-referenced local Dogs; no private row was changed';
  END IF;
END
$$;

CREATE TEMP TABLE giq_dog_exact_duplicate ON COMMIT DROP AS
SELECT DISTINCT target.source_id, target.provider_source_id,
       candidate.duplicate_id, target.target_id
FROM giq_thedogs_local_target target
CROSS JOIN LATERAL unnest(ARRAY[
  (SELECT pair.synthetic_local_id FROM giq_thedogs_local_identity_pair pair WHERE pair.source_id = target.source_id),
  (SELECT pair.provider_local_id FROM giq_thedogs_local_identity_pair pair WHERE pair.source_id = target.source_id),
  (SELECT residual.local_id FROM giq_residual_dog_resolution residual WHERE residual.source_id = target.source_id)
]) candidate(duplicate_id)
WHERE candidate.duplicate_id IS NOT NULL
  AND candidate.duplicate_id <> target.target_id;

CREATE UNIQUE INDEX giq_dog_exact_duplicate_id_idx
  ON giq_dog_exact_duplicate(duplicate_id);

DO $$
DECLARE
  foreign_key record;
  has_private_reference boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_dog_exact_duplicate duplicate
    JOIN public."DogSourceIdentity" identity
      ON identity."dogId" = duplicate.duplicate_id
  ) OR EXISTS (
    SELECT 1
    FROM giq_dog_exact_duplicate duplicate
    JOIN public."PedigreeMergeLedger" ledger ON (
      ledger."dogId" = duplicate.duplicate_id
      OR ledger."existingParentDogId" = duplicate.duplicate_id
      OR ledger."proposedParentDogId" = duplicate.duplicate_id
    )
  ) THEN
    RAISE EXCEPTION 'exact duplicate Dog already has immutable pedigree provenance; consolidation must precede provenance insertion';
  END IF;

  FOR foreign_key IN
    SELECT
      namespace.nspname AS schema_name,
      relation.relname AS table_name,
      attribute.attname AS column_name
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute attribute
      ON attribute.attrelid = constraint_row.conrelid
     AND attribute.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public."Dog"'::regclass
      AND cardinality(constraint_row.conkey) = 1
      AND constraint_row.conrelid NOT IN (
        'public."Dog"'::regclass,
        'public."Runner"'::regclass,
        'public."FormEntry"'::regclass,
        'public."DogProfileForm"'::regclass,
        'public."DogProfileArchive"'::regclass,
        'public."DogSourceIdentity"'::regclass,
        'public."PedigreeMergeLedger"'::regclass
      )
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I IN (SELECT duplicate_id FROM giq_dog_exact_duplicate))',
      foreign_key.schema_name,
      foreign_key.table_name,
      foreign_key.column_name
    ) INTO has_private_reference;
    IF has_private_reference THEN
      RAISE EXCEPTION 'exact duplicate Dog is referenced by non-allowlisted %.%; no private row was changed',
        foreign_key.schema_name, foreign_key.table_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM giq_dog_exact_duplicate duplicate
    JOIN public."Runner" duplicate_child ON duplicate_child."dogId" = duplicate.duplicate_id
    JOIN public."Runner" target_child
      ON target_child."dogId" = duplicate.target_id
     AND target_child."raceId" = duplicate_child."raceId"
  ) OR EXISTS (
    SELECT 1
    FROM giq_dog_exact_duplicate duplicate
    JOIN public."FormEntry" duplicate_child ON duplicate_child."dogId" = duplicate.duplicate_id
    JOIN public."FormEntry" target_child
      ON target_child."dogId" = duplicate.target_id
     AND (
       target_child."raceId" IS NOT DISTINCT FROM duplicate_child."raceId"
       OR (
         target_child."raceId" IS NULL
         AND target_child.date = duplicate_child.date
         AND target_child."trackId" IS NOT DISTINCT FROM duplicate_child."trackId"
       )
     )
  ) OR EXISTS (
    SELECT 1
    FROM giq_dog_exact_duplicate duplicate
    JOIN public."DogProfileForm" duplicate_child ON duplicate_child."dogId" = duplicate.duplicate_id
    JOIN public."DogProfileForm" target_child
      ON target_child."dogId" = duplicate.target_id
     AND target_child."sourceProvider" = duplicate_child."sourceProvider"
     AND target_child."sourceId" = duplicate_child."sourceId"
  ) OR EXISTS (
    SELECT 1
    FROM giq_dog_exact_duplicate duplicate
    JOIN public."DogProfileArchive" duplicate_child ON duplicate_child."dogId" = duplicate.duplicate_id
    JOIN public."DogProfileArchive" target_child
      ON target_child."dogId" = duplicate.target_id
     AND target_child."sourceProvider" = duplicate_child."sourceProvider"
     AND target_child."sourceId" = duplicate_child."sourceId"
     AND target_child."fetchedAt" = duplicate_child."fetchedAt"
  ) THEN
    RAISE EXCEPTION 'exact Dog consolidation would duplicate a dependent racing identity';
  END IF;
END
$$;

UPDATE public."Dog" child SET "sireId" = duplicate.target_id
FROM giq_dog_exact_duplicate duplicate WHERE child."sireId" = duplicate.duplicate_id;
UPDATE public."Dog" child SET "damId" = duplicate.target_id
FROM giq_dog_exact_duplicate duplicate WHERE child."damId" = duplicate.duplicate_id;
UPDATE public."Runner" child SET "dogId" = duplicate.target_id
FROM giq_dog_exact_duplicate duplicate WHERE child."dogId" = duplicate.duplicate_id;
UPDATE public."FormEntry" child SET "dogId" = duplicate.target_id
FROM giq_dog_exact_duplicate duplicate WHERE child."dogId" = duplicate.duplicate_id;
UPDATE public."DogProfileForm" child SET "dogId" = duplicate.target_id
FROM giq_dog_exact_duplicate duplicate WHERE child."dogId" = duplicate.duplicate_id;
UPDATE public."DogProfileArchive" child SET "dogId" = duplicate.target_id
FROM giq_dog_exact_duplicate duplicate WHERE child."dogId" = duplicate.duplicate_id;

DELETE FROM public."Dog" dog
USING giq_dog_exact_duplicate duplicate
WHERE dog.id = duplicate.duplicate_id;

CREATE TEMP TABLE giq_dog_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_dog_map(source_id, target_id)
SELECT source_id, target_id
FROM giq_thedogs_local_target;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_residual_dog_resolution residual
    JOIN giq_dog_map mapped ON mapped.source_id = residual.source_id
    LEFT JOIN giq_dog_exact_duplicate duplicate
      ON duplicate.duplicate_id = residual.local_id
     AND duplicate.target_id = mapped.target_id
    WHERE mapped.target_id <> residual.local_id
      AND duplicate.duplicate_id IS NULL
  ) THEN
    RAISE EXCEPTION 'residual local Dog conflicts with an unreviewed provider identity; no local or private row was changed';
  END IF;
END
$$;

INSERT INTO giq_dog_map(source_id, target_id)
SELECT residual.source_id, coalesce(mapped.target_id, residual.local_id)
FROM giq_residual_dog_resolution residual
LEFT JOIN giq_dog_map mapped ON mapped.source_id = residual.source_id
ON CONFLICT (source_id) DO NOTHING;

INSERT INTO giq_dog_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."Dog" source
JOIN public."Dog" target
  ON lower(btrim(target."sourceProvider")) = lower(btrim(source."sourceProvider"))
 AND target."sourceId" = source."sourceId"
WHERE nullif(btrim(source."sourceProvider"), '') IS NOT NULL
  AND nullif(btrim(source."sourceId"), '') IS NOT NULL
ON CONFLICT (source_id) DO UPDATE
SET target_id = EXCLUDED.target_id
WHERE giq_dog_map.target_id = EXCLUDED.target_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_portable."Dog" source
    JOIN giq_dog_map map ON map.source_id = source.id
    JOIN public."Dog" ear_brand_match ON ear_brand_match."earBrand" = source."earBrand"
    WHERE source."earBrand" IS NOT NULL
      AND ear_brand_match.id <> map.target_id
  ) THEN
    RAISE EXCEPTION 'portable Dog provider identity conflicts with a different real ear-brand identity';
  END IF;
END
$$;

INSERT INTO giq_dog_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."Dog" source
JOIN public."Dog" target ON target."earBrand" = source."earBrand"
LEFT JOIN giq_dog_map map ON map.source_id = source.id
WHERE source."earBrand" IS NOT NULL
  AND source."earBrand" !~ '^thedogs:[0-9]+$'
  AND map.source_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_portable."Dog" source
    LEFT JOIN giq_dog_map map ON map.source_id = source.id
    JOIN public."Dog" collision ON collision.id = source.id
    WHERE map.source_id IS NULL
  ) THEN
    RAISE EXCEPTION 'new portable Dog id already exists locally';
  END IF;
END
$$;

INSERT INTO public."Dog" (
  id, name, "earBrand", colour, sex, "whelpDate", "sireId", "damId",
  "trainerId", "sourceProvider", "sourceId", "profileUrl", "ownerName",
  "careerStarts", "careerWins", "careerSeconds", "careerThirds",
  "prizeMoney", "winPercentage", "placePercentage", "profileStatsJson",
  "bestTimesJson", "boxHistoryJson", "distanceHistoryJson",
  "profileSourceRawJson", "lastProfileSyncedAt", "retiredAt", "createdAt",
  "updatedAt"
)
SELECT
  source.id, source.name, source."earBrand", source.colour, source.sex,
  source."whelpDate", NULL, NULL, NULL, source."sourceProvider",
  source."sourceId", source."profileUrl", source."ownerName",
  source."careerStarts", source."careerWins", source."careerSeconds",
  source."careerThirds", source."prizeMoney", source."winPercentage",
  source."placePercentage", source."profileStatsJson", source."bestTimesJson",
  source."boxHistoryJson", source."distanceHistoryJson", NULL,
  source."lastProfileSyncedAt", source."retiredAt", source."createdAt",
  source."updatedAt"
FROM giq_portable."Dog" source
LEFT JOIN giq_dog_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_dog_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."Dog" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."Dog" target
SET
  name = source.name,
  "earBrand" = CASE
    WHEN lower(btrim(source."sourceProvider")) = 'thedogs'
      AND source."sourceId" ~ '^[0-9]+$'
      AND target."earBrand" = 'thedogs:' || source."sourceId"
      THEN source."earBrand"
    ELSE coalesce(source."earBrand", target."earBrand")
  END,
  colour = coalesce(source.colour, target.colour),
  sex = coalesce(source.sex, target.sex),
  "whelpDate" = coalesce(source."whelpDate", target."whelpDate"),
  "trainerId" = trainer_map.target_id,
  "sourceProvider" = coalesce(source."sourceProvider", target."sourceProvider"),
  "sourceId" = coalesce(source."sourceId", target."sourceId"),
  "profileUrl" = coalesce(source."profileUrl", target."profileUrl"),
  "ownerName" = coalesce(source."ownerName", target."ownerName"),
  "careerStarts" = coalesce(source."careerStarts", target."careerStarts"),
  "careerWins" = coalesce(source."careerWins", target."careerWins"),
  "careerSeconds" = coalesce(source."careerSeconds", target."careerSeconds"),
  "careerThirds" = coalesce(source."careerThirds", target."careerThirds"),
  "prizeMoney" = coalesce(source."prizeMoney", target."prizeMoney"),
  "winPercentage" = coalesce(source."winPercentage", target."winPercentage"),
  "placePercentage" = coalesce(source."placePercentage", target."placePercentage"),
  "profileStatsJson" = coalesce(source."profileStatsJson", target."profileStatsJson"),
  "bestTimesJson" = coalesce(source."bestTimesJson", target."bestTimesJson"),
  "boxHistoryJson" = coalesce(source."boxHistoryJson", target."boxHistoryJson"),
  "distanceHistoryJson" = coalesce(source."distanceHistoryJson", target."distanceHistoryJson"),
  "lastProfileSyncedAt" = greatest(source."lastProfileSyncedAt", target."lastProfileSyncedAt"),
  "retiredAt" = coalesce(source."retiredAt", target."retiredAt"),
  "createdAt" = least(source."createdAt", target."createdAt"),
  "updatedAt" = greatest(source."updatedAt", target."updatedAt")
FROM giq_portable."Dog" source
JOIN giq_dog_map map ON map.source_id = source.id
LEFT JOIN giq_trainer_map trainer_map ON trainer_map.source_id = source."trainerId"
WHERE target.id = map.target_id;

CREATE TEMP TABLE giq_meeting_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_meeting_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."Meeting" source
JOIN giq_track_map track_map ON track_map.source_id = source."trackId"
JOIN public."Meeting" target
  ON target."trackId" = track_map.target_id
 AND target."meetingDate" = source."meetingDate";

INSERT INTO public."Meeting" (
  id, "trackId", "meetingDate", "meetingType", "sourceProvider", "sourceId",
  "sourceRawJson", "lastSyncedAt", "createdAt"
)
SELECT
  source.id, track_map.target_id, source."meetingDate", source."meetingType",
  source."sourceProvider", source."sourceId", NULL, source."lastSyncedAt",
  source."createdAt"
FROM giq_portable."Meeting" source
JOIN giq_track_map track_map ON track_map.source_id = source."trackId"
LEFT JOIN giq_meeting_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_meeting_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."Meeting" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."Meeting" target
SET
  "meetingType" = coalesce(source."meetingType", target."meetingType"),
  "sourceProvider" = coalesce(source."sourceProvider", target."sourceProvider"),
  "sourceId" = coalesce(source."sourceId", target."sourceId"),
  "lastSyncedAt" = greatest(source."lastSyncedAt", target."lastSyncedAt"),
  "createdAt" = least(source."createdAt", target."createdAt")
FROM giq_portable."Meeting" source
JOIN giq_meeting_map map ON map.source_id = source.id
WHERE target.id = map.target_id;

CREATE TEMP TABLE giq_race_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_race_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."Race" source
JOIN giq_meeting_map meeting_map ON meeting_map.source_id = source."meetingId"
JOIN public."Race" target
  ON target."meetingId" = meeting_map.target_id
 AND target."raceNumber" = source."raceNumber";

INSERT INTO public."Race" (
  id, "meetingId", "raceNumber", name, "raceTime", distance, grade,
  "prizeMoney", "resultStatus", "replayUrl", "photoFinishUrl",
  "sourceProvider", "sourceId", "sourceRawJson", "lastSyncedAt", "createdAt"
)
SELECT
  source.id, meeting_map.target_id, source."raceNumber", source.name,
  source."raceTime", source.distance, source.grade, source."prizeMoney",
  source."resultStatus", source."replayUrl", source."photoFinishUrl",
  source."sourceProvider", source."sourceId", NULL, source."lastSyncedAt",
  source."createdAt"
FROM giq_portable."Race" source
JOIN giq_meeting_map meeting_map ON meeting_map.source_id = source."meetingId"
LEFT JOIN giq_race_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_race_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."Race" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."Race" target
SET
  name = coalesce(source.name, target.name),
  "raceTime" = source."raceTime",
  distance = source.distance,
  grade = coalesce(source.grade, target.grade),
  "prizeMoney" = coalesce(source."prizeMoney", target."prizeMoney"),
  "resultStatus" = coalesce(source."resultStatus", target."resultStatus"),
  "replayUrl" = coalesce(source."replayUrl", target."replayUrl"),
  "photoFinishUrl" = coalesce(source."photoFinishUrl", target."photoFinishUrl"),
  "sourceProvider" = coalesce(source."sourceProvider", target."sourceProvider"),
  "sourceId" = coalesce(source."sourceId", target."sourceId"),
  "lastSyncedAt" = greatest(source."lastSyncedAt", target."lastSyncedAt"),
  "createdAt" = least(source."createdAt", target."createdAt")
FROM giq_portable."Race" source
JOIN giq_race_map map ON map.source_id = source.id
WHERE target.id = map.target_id;

CREATE TEMP TABLE giq_race_video_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_race_video_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."RaceVideo" source
JOIN giq_race_map race_map ON race_map.source_id = source."raceId"
JOIN public."RaceVideo" target
  ON target."raceId" = race_map.target_id
 AND target."sourceProvider" = source."sourceProvider"
 AND target.kind = source.kind;

INSERT INTO public."RaceVideo" (
  id, "raceId", "sourceProvider", "sourceId", kind, "pageUrl",
  "embedSourceType", "sourceStatus", "sourceCode", "streamUrl",
  "streamContentType", title, description, "sourceRawJson", "fetchedAt",
  "lastSyncedAt", "createdAt", "updatedAt"
)
SELECT
  source.id, race_map.target_id, source."sourceProvider", source."sourceId",
  source.kind, source."pageUrl", source."embedSourceType",
  source."sourceStatus", source."sourceCode", NULL,
  source."streamContentType", source.title, source.description, NULL,
  source."fetchedAt", source."lastSyncedAt", source."createdAt",
  source."updatedAt"
FROM giq_portable."RaceVideo" source
JOIN giq_race_map race_map ON race_map.source_id = source."raceId"
LEFT JOIN giq_race_video_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_race_video_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."RaceVideo" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."RaceVideo" target
SET
  "sourceId" = source."sourceId",
  "pageUrl" = source."pageUrl",
  "embedSourceType" = coalesce(source."embedSourceType", target."embedSourceType"),
  "sourceStatus" = coalesce(source."sourceStatus", target."sourceStatus"),
  "sourceCode" = coalesce(source."sourceCode", target."sourceCode"),
  "streamContentType" = coalesce(source."streamContentType", target."streamContentType"),
  title = coalesce(source.title, target.title),
  description = coalesce(source.description, target.description),
  "fetchedAt" = greatest(source."fetchedAt", target."fetchedAt"),
  "lastSyncedAt" = greatest(source."lastSyncedAt", target."lastSyncedAt"),
  "createdAt" = least(source."createdAt", target."createdAt"),
  "updatedAt" = greatest(source."updatedAt", target."updatedAt")
FROM giq_portable."RaceVideo" source
JOIN giq_race_video_map map ON map.source_id = source.id
WHERE target.id = map.target_id;

CREATE TEMP TABLE giq_runner_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_runner_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."Runner" source
JOIN giq_race_map race_map ON race_map.source_id = source."raceId"
JOIN public."Runner" target
  ON target."raceId" = race_map.target_id
 AND target."boxNumber" = source."boxNumber";

INSERT INTO public."Runner" (
  id, "raceId", "dogId", "boxNumber", weight, "trainerId",
  "startingPrice", scratched, "sourceProvider", "sourceId",
  "sourceRawJson", "createdAt"
)
SELECT
  source.id, race_map.target_id, dog_map.target_id, source."boxNumber",
  source.weight, trainer_map.target_id, source."startingPrice",
  source.scratched, source."sourceProvider", source."sourceId", NULL,
  source."createdAt"
FROM giq_portable."Runner" source
JOIN giq_race_map race_map ON race_map.source_id = source."raceId"
JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
LEFT JOIN giq_trainer_map trainer_map ON trainer_map.source_id = source."trainerId"
LEFT JOIN giq_runner_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_runner_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."Runner" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."Runner" target
SET
  "dogId" = dog_map.target_id,
  weight = coalesce(source.weight, target.weight),
  "trainerId" = trainer_map.target_id,
  "startingPrice" = coalesce(source."startingPrice", target."startingPrice"),
  scratched = source.scratched,
  "sourceProvider" = coalesce(source."sourceProvider", target."sourceProvider"),
  "sourceId" = coalesce(source."sourceId", target."sourceId"),
  "createdAt" = least(source."createdAt", target."createdAt")
FROM giq_portable."Runner" source
JOIN giq_runner_map map ON map.source_id = source.id
JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
LEFT JOIN giq_trainer_map trainer_map ON trainer_map.source_id = source."trainerId"
WHERE target.id = map.target_id;

CREATE TEMP TABLE giq_result_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_result_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."Result" source
JOIN giq_runner_map runner_map ON runner_map.source_id = source."runnerId"
JOIN public."Result" target ON target."runnerId" = runner_map.target_id;

INSERT INTO public."Result" (
  id, "runnerId", "raceId", "finishingPosition", "runningTime", margin,
  "prizeMoneyWon", "splitTime", sectionals, "gpsData", "sourceProvider",
  "sourceId", "sourceRawJson", "lastSyncedAt", "createdAt"
)
SELECT
  source.id, runner_map.target_id, race_map.target_id,
  source."finishingPosition", source."runningTime", source.margin,
  source."prizeMoneyWon", source."splitTime", source.sectionals,
  source."gpsData", source."sourceProvider", source."sourceId", NULL,
  source."lastSyncedAt", source."createdAt"
FROM giq_portable."Result" source
JOIN giq_runner_map runner_map ON runner_map.source_id = source."runnerId"
JOIN giq_race_map race_map ON race_map.source_id = source."raceId"
LEFT JOIN giq_result_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_result_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."Result" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."Result" target
SET
  "finishingPosition" = source."finishingPosition",
  "runningTime" = coalesce(source."runningTime", target."runningTime"),
  margin = coalesce(source.margin, target.margin),
  "prizeMoneyWon" = coalesce(source."prizeMoneyWon", target."prizeMoneyWon"),
  "splitTime" = coalesce(source."splitTime", target."splitTime"),
  sectionals = coalesce(source.sectionals, target.sectionals),
  "gpsData" = coalesce(source."gpsData", target."gpsData"),
  "sourceProvider" = coalesce(source."sourceProvider", target."sourceProvider"),
  "sourceId" = coalesce(source."sourceId", target."sourceId"),
  "lastSyncedAt" = greatest(source."lastSyncedAt", target."lastSyncedAt"),
  "createdAt" = least(source."createdAt", target."createdAt")
FROM giq_portable."Result" source
JOIN giq_result_map map ON map.source_id = source.id
WHERE target.id = map.target_id;

CREATE TEMP TABLE giq_form_entry_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_form_entry_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."FormEntry" source
JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
JOIN giq_race_map race_map ON race_map.source_id = source."raceId"
JOIN public."FormEntry" target
  ON target."dogId" = dog_map.target_id
 AND target."raceId" = race_map.target_id;

INSERT INTO public."FormEntry" (
  id, "dogId", "raceId", "trackId", date, "boxNumber", finish, time,
  distance, grade, weight, "createdAt"
)
SELECT
  source.id, dog_map.target_id, race_map.target_id, track_map.target_id,
  source.date, source."boxNumber", source.finish, source.time,
  source.distance, source.grade, source.weight, source."createdAt"
FROM giq_portable."FormEntry" source
JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
JOIN giq_race_map race_map ON race_map.source_id = source."raceId"
LEFT JOIN giq_track_map track_map ON track_map.source_id = source."trackId"
LEFT JOIN giq_form_entry_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_form_entry_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."FormEntry" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."FormEntry" target
SET
  "trackId" = track_map.target_id,
  date = source.date,
  "boxNumber" = source."boxNumber",
  finish = source.finish,
  time = source.time,
  distance = source.distance,
  grade = source.grade,
  weight = source.weight,
  "createdAt" = least(source."createdAt", target."createdAt")
FROM giq_portable."FormEntry" source
JOIN giq_form_entry_map map ON map.source_id = source.id
LEFT JOIN giq_track_map track_map ON track_map.source_id = source."trackId"
WHERE target.id = map.target_id;

CREATE TEMP TABLE giq_profile_form_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_profile_form_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."DogProfileForm" source
JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
JOIN public."DogProfileForm" target
  ON target."dogId" = dog_map.target_id
 AND target."sourceProvider" = source."sourceProvider"
 AND rtrim(target."sourceId", '/') = rtrim(source."sourceId", '/');

INSERT INTO public."DogProfileForm" (
  id, "dogId", "sourceProvider", "sourceId", "raceUrl", date, "trackCode",
  "trackName", "raceName", "finishText", "finishingPosition", starters,
  "boxNumber", weight, distance, grade, "runningTime", "winnerTime",
  "bestOfNightTime", "firstSectional", margin, "winnerDogName",
  "winnerDogSourceId", "inRunningPositions", "startingPrice", "hasVideo",
  "sourceRawJson", "createdAt", "updatedAt"
)
SELECT
  source.id, dog_map.target_id, source."sourceProvider", source."sourceId",
  source."raceUrl", source.date, source."trackCode", source."trackName",
  source."raceName", source."finishText", source."finishingPosition",
  source.starters, source."boxNumber", source.weight, source.distance,
  source.grade, source."runningTime", source."winnerTime",
  source."bestOfNightTime", source."firstSectional", source.margin,
  source."winnerDogName", source."winnerDogSourceId",
  source."inRunningPositions", source."startingPrice", source."hasVideo",
  NULL, source."createdAt", source."updatedAt"
FROM giq_portable."DogProfileForm" source
JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
LEFT JOIN giq_profile_form_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_profile_form_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."DogProfileForm" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."DogProfileForm" target
SET
  "sourceId" = source."sourceId",
  "raceUrl" = source."raceUrl",
  date = source.date,
  "trackCode" = coalesce(source."trackCode", target."trackCode"),
  "trackName" = coalesce(source."trackName", target."trackName"),
  "raceName" = coalesce(source."raceName", target."raceName"),
  "finishText" = coalesce(source."finishText", target."finishText"),
  "finishingPosition" = coalesce(source."finishingPosition", target."finishingPosition"),
  starters = coalesce(source.starters, target.starters),
  "boxNumber" = coalesce(source."boxNumber", target."boxNumber"),
  weight = coalesce(source.weight, target.weight),
  distance = coalesce(source.distance, target.distance),
  grade = coalesce(source.grade, target.grade),
  "runningTime" = coalesce(source."runningTime", target."runningTime"),
  "winnerTime" = coalesce(source."winnerTime", target."winnerTime"),
  "bestOfNightTime" = coalesce(source."bestOfNightTime", target."bestOfNightTime"),
  "firstSectional" = coalesce(source."firstSectional", target."firstSectional"),
  margin = coalesce(source.margin, target.margin),
  "winnerDogName" = coalesce(source."winnerDogName", target."winnerDogName"),
  "winnerDogSourceId" = coalesce(source."winnerDogSourceId", target."winnerDogSourceId"),
  "inRunningPositions" = coalesce(source."inRunningPositions", target."inRunningPositions"),
  "startingPrice" = coalesce(source."startingPrice", target."startingPrice"),
  "hasVideo" = source."hasVideo",
  "createdAt" = least(source."createdAt", target."createdAt"),
  "updatedAt" = greatest(source."updatedAt", target."updatedAt")
FROM giq_portable."DogProfileForm" source
JOIN giq_profile_form_map map ON map.source_id = source.id
WHERE target.id = map.target_id;

CREATE TEMP TABLE giq_profile_archive_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_profile_archive_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."DogProfileArchive" source
JOIN public."DogProfileArchive" target
  ON target."sourceProvider" = source."sourceProvider"
 AND target."sourceId" = source."sourceId";

INSERT INTO public."DogProfileArchive" (
  id, "dogId", "sourceProvider", "sourceId", "profileUrl", "fetchedAt",
  "showMorePath", "candidateJson", "parsedJson", "profileHtml",
  "fullFormHtml", "createdAt", "updatedAt"
)
SELECT
  source.id, dog_map.target_id, source."sourceProvider", source."sourceId",
  source."profileUrl", source."fetchedAt", source."showMorePath", NULL, NULL,
  NULL, NULL, source."createdAt", source."updatedAt"
FROM giq_portable."DogProfileArchive" source
JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
LEFT JOIN giq_profile_archive_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_profile_archive_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."DogProfileArchive" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."DogProfileArchive" target
SET
  "dogId" = dog_map.target_id,
  "profileUrl" = coalesce(source."profileUrl", target."profileUrl"),
  "fetchedAt" = greatest(source."fetchedAt", target."fetchedAt"),
  "showMorePath" = coalesce(source."showMorePath", target."showMorePath"),
  "createdAt" = least(source."createdAt", target."createdAt"),
  "updatedAt" = greatest(source."updatedAt", target."updatedAt")
FROM giq_portable."DogProfileArchive" source
JOIN giq_profile_archive_map map ON map.source_id = source.id
JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
WHERE target.id = map.target_id;

CREATE TEMP TABLE giq_race_day_archive_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_race_day_archive_map(source_id, target_id)
SELECT source.id, target.id
FROM giq_portable."RaceDayArchive" source
JOIN public."RaceDayArchive" target
  ON target."sourceProvider" = source."sourceProvider"
 AND target.date = source.date;

INSERT INTO public."RaceDayArchive" (
  id, "sourceProvider", date, "fetchedAt", "rawPath", meetings, races,
  runners, results, dogs, trainers, "rawJson", "createdAt", "updatedAt"
)
SELECT
  source.id, source."sourceProvider", source.date, source."fetchedAt", NULL,
  source.meetings, source.races, source.runners, source.results, source.dogs,
  source.trainers, source."rawJson", source."createdAt", source."updatedAt"
FROM giq_portable."RaceDayArchive" source
LEFT JOIN giq_race_day_archive_map map ON map.source_id = source.id
WHERE map.source_id IS NULL;

INSERT INTO giq_race_day_archive_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."RaceDayArchive" source
ON CONFLICT (source_id) DO NOTHING;

UPDATE public."RaceDayArchive" target
SET
  "fetchedAt" = greatest(source."fetchedAt", target."fetchedAt"),
  meetings = source.meetings,
  races = source.races,
  runners = source.runners,
  results = source.results,
  dogs = source.dogs,
  trainers = source.trainers,
  "createdAt" = least(source."createdAt", target."createdAt"),
  "updatedAt" = greatest(source."updatedAt", target."updatedAt")
FROM giq_portable."RaceDayArchive" source
JOIN giq_race_day_archive_map map ON map.source_id = source.id
WHERE target.id = map.target_id;

-- Finish canonical Dog parent resolution before any immutable provenance row
-- is inserted. Evidence below records only already-resolved canonical IDs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_portable."Dog" source
    LEFT JOIN giq_dog_map sire_map ON sire_map.source_id = source."sireId"
    LEFT JOIN giq_dog_map dam_map ON dam_map.source_id = source."damId"
    WHERE (source."sireId" IS NOT NULL AND sire_map.source_id IS NULL)
      OR (source."damId" IS NOT NULL AND dam_map.source_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'portable Dog pedigree references an unmapped canonical parent';
  END IF;
END
$$;

UPDATE public."Dog" target
SET
  "sireId" = sire_map.target_id,
  "damId" = dam_map.target_id
FROM giq_portable."Dog" source
JOIN giq_dog_map map ON map.source_id = source.id
LEFT JOIN giq_dog_map sire_map ON sire_map.source_id = source."sireId"
LEFT JOIN giq_dog_map dam_map ON dam_map.source_id = source."damId"
WHERE target.id = map.target_id;

-- Provenance rows use exported IDs as occurrence identities. Provider keys,
-- names, artifacts and relationships are lookup evidence only and never merge
-- keys. A retry may reuse an ID only when the entire mapped row is identical.
CREATE TEMP TABLE giq_pedigree_occurrence_id_inventory ON COMMIT DROP AS
SELECT 'PedigreeImportRun'::text AS table_name, id FROM giq_portable."PedigreeImportRun"
UNION ALL
SELECT 'DogSourceIdentity', id FROM giq_portable."DogSourceIdentity"
UNION ALL
SELECT 'PedigreeAssertion', id FROM giq_portable."PedigreeAssertion"
UNION ALL
SELECT 'PedigreeMergeLedger', id FROM giq_portable."PedigreeMergeLedger";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM giq_pedigree_occurrence_id_inventory
    WHERE nullif(btrim(id), '') IS NULL
  ) OR EXISTS (
    SELECT table_name, id
    FROM giq_pedigree_occurrence_id_inventory
    GROUP BY table_name, id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'portable pedigree evidence has a missing or duplicate occurrence ID';
  END IF;
END
$$;

CREATE UNIQUE INDEX giq_pedigree_occurrence_id_inventory_key
  ON giq_pedigree_occurrence_id_inventory(table_name, id);

CREATE TEMP TABLE giq_pedigree_run_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_portable."PedigreeImportRun" source
    JOIN public."PedigreeImportRun" target ON target.id = source.id
    WHERE to_jsonb(target) IS DISTINCT FROM to_jsonb(source)
  ) THEN
    RAISE EXCEPTION 'portable pedigree import-run occurrence ID collides with different immutable evidence';
  END IF;
END
$$;

INSERT INTO public."PedigreeImportRun" (
  id, "sourceProvider", "sourceAuthority", "verificationStatus", status,
  "artifactUri", "artifactSha256", "artifactBytes", "sourceVolume",
  "parserVersion", "recordsObserved", "assertionsObserved", "issuesObserved",
  "startedAt", "completedAt", "createdAt", "updatedAt"
)
SELECT
  source.id, source."sourceProvider", source."sourceAuthority",
  source."verificationStatus", source.status, source."artifactUri",
  source."artifactSha256", source."artifactBytes", source."sourceVolume",
  source."parserVersion", source."recordsObserved",
  source."assertionsObserved", source."issuesObserved", source."startedAt",
  source."completedAt", source."createdAt", source."updatedAt"
FROM giq_portable."PedigreeImportRun" source
LEFT JOIN public."PedigreeImportRun" target ON target.id = source.id
WHERE target.id IS NULL;

INSERT INTO giq_pedigree_run_map(source_id, target_id)
SELECT source.id, source.id
FROM giq_portable."PedigreeImportRun" source;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_portable."DogSourceIdentity" source
    LEFT JOIN giq_pedigree_run_map run_map
      ON run_map.source_id = source."importRunId"
    LEFT JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
    WHERE run_map.source_id IS NULL
      OR (source."dogId" IS NOT NULL AND dog_map.source_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'portable dog-source identity references an unmapped run or canonical Dog';
  END IF;
END
$$;

-- Resolve every canonical Dog and final verification status before INSERT.
-- This prepared row is also the byte-for-byte semantic retry contract.
CREATE TEMP TABLE giq_pedigree_identity_expected ON COMMIT DROP AS
SELECT
  source.id, dog_map.target_id AS "dogId", run_map.target_id AS "importRunId",
  source."sourceProvider", source."artifactSha256", source."sourceId",
  source."sourceName", source."normalizedName", source."registryToken",
  source.imported, source."observedSex", source."observedColour",
  source."observedWhelpDate", source."sourceAuthority",
  source."verificationStatus", source."sourcePage", source."sourceLine",
  source."artifactOffsetLine", source."evidenceSha256", source."createdAt",
  source."updatedAt"
FROM giq_portable."DogSourceIdentity" source
JOIN giq_pedigree_run_map run_map ON run_map.source_id = source."importRunId"
LEFT JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_pedigree_identity_expected expected
    JOIN public."DogSourceIdentity" target ON target.id = expected.id
    WHERE to_jsonb(target) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'portable dog-source occurrence ID collides with different immutable evidence';
  END IF;
END
$$;

INSERT INTO public."DogSourceIdentity" (
  id, "dogId", "importRunId", "sourceProvider", "artifactSha256",
  "sourceId", "sourceName", "normalizedName", "registryToken", imported,
  "observedSex", "observedColour", "observedWhelpDate", "sourceAuthority",
  "verificationStatus", "sourcePage", "sourceLine", "artifactOffsetLine",
  "evidenceSha256", "createdAt", "updatedAt"
)
SELECT expected.*
FROM giq_pedigree_identity_expected expected
LEFT JOIN public."DogSourceIdentity" target ON target.id = expected.id
WHERE target.id IS NULL;

CREATE TEMP TABLE giq_pedigree_identity_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_pedigree_identity_map(source_id, target_id)
SELECT expected.id, expected.id FROM giq_pedigree_identity_expected expected;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_portable."PedigreeAssertion" source
    LEFT JOIN giq_pedigree_run_map run_map
      ON run_map.source_id = source."importRunId"
    LEFT JOIN giq_pedigree_identity_map subject_map
      ON subject_map.source_id = source."subjectIdentityId"
    LEFT JOIN giq_pedigree_identity_map parent_map
      ON parent_map.source_id = source."parentIdentityId"
    WHERE run_map.source_id IS NULL
      OR subject_map.source_id IS NULL
      OR (source."parentIdentityId" IS NOT NULL AND parent_map.source_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'portable pedigree assertion references an unmapped run, subject or parent occurrence';
  END IF;
END
$$;

-- Resolve the subject, parent and final status before immutable insertion.
CREATE TEMP TABLE giq_pedigree_assertion_expected ON COMMIT DROP AS
SELECT
  source.id, run_map.target_id AS "importRunId", source."sourceProvider",
  source."artifactSha256", subject_map.target_id AS "subjectIdentityId",
  parent_map.target_id AS "parentIdentityId", source.relationship,
  source."assertedParentName", source."assertedParentNormalizedName",
  source."assertedParentRegistryToken", source."sourceAuthority",
  source."verificationStatus", source."sourcePage", source."sourceLine",
  source."artifactOffsetLine", source."evidenceSha256", source."createdAt",
  source."updatedAt"
FROM giq_portable."PedigreeAssertion" source
JOIN giq_pedigree_run_map run_map ON run_map.source_id = source."importRunId"
JOIN giq_pedigree_identity_map subject_map
  ON subject_map.source_id = source."subjectIdentityId"
LEFT JOIN giq_pedigree_identity_map parent_map
  ON parent_map.source_id = source."parentIdentityId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_pedigree_assertion_expected expected
    JOIN public."PedigreeAssertion" target ON target.id = expected.id
    WHERE to_jsonb(target) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'portable pedigree assertion occurrence ID collides with different immutable evidence';
  END IF;
END
$$;

INSERT INTO public."PedigreeAssertion" (
  id, "importRunId", "sourceProvider", "artifactSha256",
  "subjectIdentityId", "parentIdentityId", relationship,
  "assertedParentName", "assertedParentNormalizedName",
  "assertedParentRegistryToken", "sourceAuthority", "verificationStatus",
  "sourcePage", "sourceLine", "artifactOffsetLine", "evidenceSha256",
  "createdAt", "updatedAt"
)
SELECT expected.*
FROM giq_pedigree_assertion_expected expected
LEFT JOIN public."PedigreeAssertion" target ON target.id = expected.id
WHERE target.id IS NULL;

CREATE TEMP TABLE giq_pedigree_assertion_map (
  source_id text PRIMARY KEY,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_pedigree_assertion_map(source_id, target_id)
SELECT expected.id, expected.id FROM giq_pedigree_assertion_expected expected;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_portable."PedigreeMergeLedger" source
    LEFT JOIN giq_pedigree_run_map run_map
      ON run_map.source_id = source."importRunId"
    LEFT JOIN giq_pedigree_assertion_map assertion_map
      ON assertion_map.source_id = source."assertionId"
    LEFT JOIN giq_pedigree_assertion_map winning_map
      ON winning_map.source_id = source."winningAssertionId"
    LEFT JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
    LEFT JOIN giq_dog_map existing_map
      ON existing_map.source_id = source."existingParentDogId"
    LEFT JOIN giq_dog_map proposed_map
      ON proposed_map.source_id = source."proposedParentDogId"
    WHERE run_map.source_id IS NULL
      OR assertion_map.source_id IS NULL
      OR dog_map.source_id IS NULL
      OR (source."winningAssertionId" IS NOT NULL AND winning_map.source_id IS NULL)
      OR (source."existingParentDogId" IS NOT NULL AND existing_map.source_id IS NULL)
      OR (source."proposedParentDogId" IS NOT NULL AND proposed_map.source_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'portable pedigree ledger references an unmapped evidence occurrence or canonical Dog';
  END IF;
END
$$;

CREATE TEMP TABLE giq_pedigree_ledger_expected ON COMMIT DROP AS
SELECT
  source.id, run_map.target_id AS "importRunId", source."sourceProvider",
  source."artifactSha256", assertion_map.target_id AS "assertionId",
  winning_map.target_id AS "winningAssertionId", dog_map.target_id AS "dogId",
  existing_map.target_id AS "existingParentDogId",
  proposed_map.target_id AS "proposedParentDogId", source.relationship,
  source.decision, source."reasonCode", source."sourceAuthority",
  source."verificationStatus", source."createdAt"
FROM giq_portable."PedigreeMergeLedger" source
JOIN giq_pedigree_run_map run_map ON run_map.source_id = source."importRunId"
JOIN giq_pedigree_assertion_map assertion_map
  ON assertion_map.source_id = source."assertionId"
LEFT JOIN giq_pedigree_assertion_map winning_map
  ON winning_map.source_id = source."winningAssertionId"
JOIN giq_dog_map dog_map ON dog_map.source_id = source."dogId"
LEFT JOIN giq_dog_map existing_map
  ON existing_map.source_id = source."existingParentDogId"
LEFT JOIN giq_dog_map proposed_map
  ON proposed_map.source_id = source."proposedParentDogId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM giq_pedigree_ledger_expected expected
    JOIN public."PedigreeMergeLedger" target ON target.id = expected.id
    WHERE to_jsonb(target) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'portable pedigree ledger occurrence ID collides with different append-only evidence';
  END IF;
END
$$;

INSERT INTO public."PedigreeMergeLedger" (
  id, "importRunId", "sourceProvider", "artifactSha256", "assertionId",
  "winningAssertionId", "dogId", "existingParentDogId",
  "proposedParentDogId", relationship, decision, "reasonCode",
  "sourceAuthority", "verificationStatus", "createdAt"
)
SELECT expected.*
FROM giq_pedigree_ledger_expected expected
LEFT JOIN public."PedigreeMergeLedger" target ON target.id = expected.id
WHERE target.id IS NULL;

DO $$
BEGIN
  IF (SELECT count(*) FROM giq_track_map) <> (SELECT count(*) FROM giq_portable."Track")
    OR (SELECT count(*) FROM giq_trainer_map) <> (SELECT count(*) FROM giq_portable."Trainer")
    OR (SELECT count(*) FROM giq_dog_map) <> (SELECT count(*) FROM giq_portable."Dog")
    OR (SELECT count(*) FROM giq_meeting_map) <> (SELECT count(*) FROM giq_portable."Meeting")
    OR (SELECT count(*) FROM giq_race_map) <> (SELECT count(*) FROM giq_portable."Race")
    OR (SELECT count(*) FROM giq_race_video_map) <> (SELECT count(*) FROM giq_portable."RaceVideo")
    OR (SELECT count(*) FROM giq_runner_map) <> (SELECT count(*) FROM giq_portable."Runner")
    OR (SELECT count(*) FROM giq_result_map) <> (SELECT count(*) FROM giq_portable."Result")
    OR (SELECT count(*) FROM giq_form_entry_map) <> (SELECT count(*) FROM giq_portable."FormEntry")
    OR (SELECT count(*) FROM giq_profile_form_map) <> (SELECT count(*) FROM giq_portable."DogProfileForm")
    OR (SELECT count(*) FROM giq_profile_archive_map) <> (SELECT count(*) FROM giq_portable."DogProfileArchive")
    OR (SELECT count(*) FROM giq_race_day_archive_map) <> (SELECT count(*) FROM giq_portable."RaceDayArchive")
    OR (SELECT count(*) FROM giq_pedigree_run_map) <> (SELECT count(*) FROM giq_portable."PedigreeImportRun")
    OR (SELECT count(*) FROM giq_pedigree_identity_map) <> (SELECT count(*) FROM giq_portable."DogSourceIdentity")
    OR (SELECT count(*) FROM giq_pedigree_assertion_map) <> (SELECT count(*) FROM giq_portable."PedigreeAssertion")
  THEN
    RAISE EXCEPTION 'portable row mapping is incomplete; rolling back all local changes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM giq_portable."PedigreeImportRun" expected
    LEFT JOIN public."PedigreeImportRun" target ON target.id = expected.id
    WHERE target.id IS NULL
      OR to_jsonb(target) IS DISTINCT FROM to_jsonb(expected)
  ) OR EXISTS (
    SELECT 1
    FROM giq_pedigree_identity_expected expected
    LEFT JOIN public."DogSourceIdentity" target ON target.id = expected.id
    WHERE target.id IS NULL
      OR to_jsonb(target) IS DISTINCT FROM to_jsonb(expected)
  ) OR EXISTS (
    SELECT 1
    FROM giq_pedigree_assertion_expected expected
    LEFT JOIN public."PedigreeAssertion" target ON target.id = expected.id
    WHERE target.id IS NULL
      OR to_jsonb(target) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'portable immutable pedigree evidence drifted after insertion; rolling back all local changes';
  END IF;

  IF (SELECT count(*) FROM giq_pedigree_ledger_expected)
       <> (SELECT count(*) FROM giq_portable."PedigreeMergeLedger")
    OR EXISTS (
      SELECT 1
      FROM giq_pedigree_ledger_expected expected
      LEFT JOIN public."PedigreeMergeLedger" target ON target.id = expected.id
      WHERE target.id IS NULL
        OR to_jsonb(target) IS DISTINCT FROM to_jsonb(expected)
    )
  THEN
    RAISE EXCEPTION 'portable pedigree ledger mapping is incomplete; rolling back all local changes';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."Track" WHERE lower(btrim(name)) = 'greyhoundiq demo park')
    OR EXISTS (SELECT 1 FROM public."Meeting" WHERE lower(coalesce("sourceProvider", '')) IN ('demo', 'greyhoundiq-demo'))
    OR EXISTS (SELECT 1 FROM public."Race" WHERE lower(coalesce("sourceProvider", '')) IN ('demo', 'greyhoundiq-demo'))
    OR EXISTS (SELECT 1 FROM public."Runner" WHERE lower(coalesce("sourceProvider", '')) IN ('demo', 'greyhoundiq-demo'))
  THEN
    RAISE EXCEPTION 'synthetic provider graph remains after local apply; rolling back all local changes';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."Track"
    WHERE (lower(btrim(name)) = 'canberra' AND upper(btrim(state)) <> 'ACT')
       OR (lower(btrim(name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') AND upper(btrim(state)) <> 'NZ')
  ) THEN
    RAISE EXCEPTION 'jurisdiction normalization failed; rolling back all local changes';
  END IF;

  IF (SELECT count(*) FROM public."Track" WHERE lower(btrim(name)) IN ('meadows', 'the meadows')) <> 1
    OR EXISTS (SELECT 1 FROM public."Track" WHERE lower(btrim(name)) = 'meadows')
    OR EXISTS (
      SELECT canonical_state, canonical_name
      FROM (
        SELECT
          CASE WHEN lower(btrim(name)) = 'canberra' THEN 'ACT' WHEN lower(btrim(name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') THEN 'NZ' ELSE upper(btrim(state)) END AS canonical_state,
          lower(CASE WHEN lower(btrim(name)) IN ('meadows', 'the meadows') THEN 'The Meadows' WHEN lower(btrim(name)) IN ('palmerston - north', 'palmerston north') THEN 'Palmerston North' ELSE btrim(name) END) AS canonical_name
        FROM public."Track"
      ) normalized
      GROUP BY canonical_state, canonical_name
      HAVING count(*) > 1
    )
  THEN
    RAISE EXCEPTION 'Track aliases are not unique after canonical consolidation; rolling back all local changes';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."DogProfileForm"
    WHERE "raceUrl" ~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
       OR "raceUrl" !~ '^/racing/[^?#]+/?$'
  ) OR EXISTS (
    SELECT 1 FROM public."Race"
    WHERE "sourceId" ~* '(^|/)(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
  ) THEN
    RAISE EXCEPTION 'non-canonical race identity remains after local apply; rolling back all local changes';
  END IF;

  IF (
    SELECT count(*) FROM public."DogProfileForm"
    WHERE lower(coalesce("trackName", '')) = 'temora'
      AND date::date = DATE '2008-10-19'
      AND "raceUrl" = '/racing/temora/2008-10-19/3/'
      AND "sourceId" = '/racing/temora/2008-10-19/3?trial=false'
  ) <> 8 THEN
    RAISE EXCEPTION 'Temora raw sourceId/canonical raceUrl recovery is not exactly 8 rows; rolling back all local changes';
  END IF;

  IF EXISTS (SELECT 1 FROM public."Dog" WHERE "earBrand" ~ '^thedogs:[0-9]+$')
    OR EXISTS (
      SELECT 1 FROM public."Dog"
      WHERE nullif(btrim("earBrand"), '') IS NULL
        AND (
          nullif(btrim("sourceProvider"), '') IS NULL
          OR nullif(btrim("sourceId"), '') IS NULL
        )
    )
    OR EXISTS (
      SELECT lower(btrim("sourceProvider")), btrim("sourceId")
      FROM public."Dog"
      WHERE nullif(btrim("sourceProvider"), '') IS NOT NULL
        AND nullif(btrim("sourceId"), '') IS NOT NULL
      GROUP BY 1, 2
      HAVING count(*) > 1
    )
  THEN
    RAISE EXCEPTION 'Dog identities were not consolidated to stable unique provider keys; rolling back all local changes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."Result" result
    LEFT JOIN public."Runner" runner ON runner.id = result."runnerId"
    WHERE runner.id IS NULL OR runner."raceId" <> result."raceId"
  ) OR EXISTS (
    SELECT 1
    FROM public."FormEntry" form
    LEFT JOIN public."Race" race ON race.id = form."raceId"
    WHERE form."raceId" IS NULL OR race.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public."DogProfileArchive" archive
    LEFT JOIN public."Dog" dog ON dog.id = archive."dogId"
    WHERE archive."dogId" IS NULL OR dog.id IS NULL
  ) THEN
    RAISE EXCEPTION 'public racing relationship integrity failed; rolling back all local changes';
  END IF;

  IF EXISTS (SELECT 1 FROM public."Dog" WHERE id = "sireId" OR id = "damId")
    OR EXISTS (
      WITH RECURSIVE edges(child_id, parent_id) AS (
        SELECT id, "sireId" FROM public."Dog" WHERE "sireId" IS NOT NULL
        UNION
        SELECT id, "damId" FROM public."Dog" WHERE "damId" IS NOT NULL
      ), walk(root_id, dog_id) AS (
        SELECT child_id, parent_id FROM edges
        UNION
        SELECT walk.root_id, edge.parent_id
        FROM walk JOIN edges edge ON edge.child_id = walk.dog_id
      )
      SELECT 1 FROM walk WHERE root_id = dog_id
    )
  THEN
    RAISE EXCEPTION 'pedigree self-link or cycle remains; rolling back all local changes';
  END IF;
END
$$;

CREATE TEMP TABLE giq_private_after (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  content_sha256 text NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  item record;
  observed_count bigint;
  observed_sha256 text;
BEGIN
  FOR item IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> ALL (ARRAY[
        'Track', 'Trainer', 'Dog', 'Meeting', 'Race', 'RaceVideo', 'Runner',
        'Result', 'FormEntry', 'DogProfileForm', 'DogProfileArchive',
        'RaceDayArchive', 'PedigreeImportRun', 'DogSourceIdentity',
        'PedigreeAssertion', 'PedigreeMergeLedger'
      ])
    ORDER BY tablename
  LOOP
    EXECUTE format($query$
      SELECT
        count(*),
        encode(sha256(convert_to(coalesce(
          string_agg(length(row_json)::text || ':' || row_json, '' ORDER BY row_json),
          ''
        ), 'UTF8')), 'hex')
      FROM (
        SELECT to_jsonb(value)::text AS row_json FROM public.%I value
      ) row_values
    $query$, item.tablename) INTO observed_count, observed_sha256;
    INSERT INTO giq_private_after VALUES (item.tablename, observed_count, observed_sha256);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM giq_private_before before_state
    FULL JOIN giq_private_after after_state USING (table_name)
    WHERE before_state.table_name IS NULL
       OR after_state.table_name IS NULL
       OR before_state.row_count <> after_state.row_count
       OR before_state.content_sha256 <> after_state.content_sha256
  ) THEN
    RAISE EXCEPTION 'a non-allowlisted local table changed; rolling back all local changes';
  END IF;
END
$$;

CREATE TEMP TABLE giq_atomic_check (
  name text PRIMARY KEY,
  failures bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_atomic_check(name, failures)
WITH RECURSIVE
required_states(state) AS (
  VALUES ('ACT'), ('NSW'), ('NT'), ('QLD'), ('SA'), ('TAS'), ('VIC'), ('WA')
),
state_counts AS MATERIALIZED (
  SELECT
    required.state,
    count(DISTINCT race.id) AS races,
    count(DISTINCT result.id) AS results
  FROM required_states required
  LEFT JOIN public."Track" track ON upper(btrim(track.state)) = required.state
  LEFT JOIN public."Meeting" meeting ON meeting."trackId" = track.id
  LEFT JOIN public."Race" race ON race."meetingId" = meeting.id
  LEFT JOIN public."Runner" runner ON runner."raceId" = race.id
  LEFT JOIN public."Result" result ON result."runnerId" = runner.id
  GROUP BY required.state
),
pedigree_edges(child_id, parent_id) AS MATERIALIZED (
  SELECT id, "sireId" FROM public."Dog" WHERE "sireId" IS NOT NULL
  UNION
  SELECT id, "damId" FROM public."Dog" WHERE "damId" IS NOT NULL
),
pedigree_walk(root_id, dog_id) AS (
  SELECT child_id, parent_id FROM pedigree_edges
  UNION
  SELECT walk.root_id, edge.parent_id
  FROM pedigree_walk walk
  JOIN pedigree_edges edge ON edge.child_id = walk.dog_id
)
SELECT 'required_state_has_races', sum((races = 0)::int)::bigint FROM state_counts
UNION ALL SELECT 'required_state_has_results', sum((results = 0)::int)::bigint FROM state_counts
UNION ALL SELECT 'dog_minimum', greatest(212391 - count(*), 0) FROM public."Dog"
UNION ALL SELECT 'meeting_minimum', greatest(76622 - count(*), 0) FROM public."Meeting"
UNION ALL SELECT 'race_minimum', greatest(838536 - count(*), 0) FROM public."Race"
UNION ALL SELECT 'runner_minimum', greatest(6434242 - count(*), 0) FROM public."Runner"
UNION ALL SELECT 'result_minimum', greatest(5660837 - count(*), 0) FROM public."Result"
UNION ALL SELECT 'profile_form_minimum', greatest(5904337 - count(*), 0) FROM public."DogProfileForm"
UNION ALL SELECT 'profile_archive_minimum', greatest(170780 - count(*), 0) FROM public."DogProfileArchive"
UNION ALL SELECT 'pedigree_identity_minimum', greatest(212391 - count(*), 0) FROM public."DogSourceIdentity"
UNION ALL SELECT 'profile_form_canonical_racing_url', count(*) FROM public."DogProfileForm"
  WHERE "raceUrl" !~ '^/racing/[^?#]+/?$' OR "raceUrl" ~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
UNION ALL SELECT 'temora_raw_source_id_canonical_race_url_exact', abs(count(*) - 8) FROM public."DogProfileForm"
  WHERE lower(coalesce("trackName", '')) = 'temora' AND date::date = DATE '2008-10-19'
    AND "raceUrl" = '/racing/temora/2008-10-19/3/'
    AND "sourceId" = '/racing/temora/2008-10-19/3?trial=false'
UNION ALL SELECT 'meadows_alias_single_canonical_track', abs(count(*) - 1) FROM public."Track"
  WHERE lower(btrim(name)) IN ('meadows', 'the meadows')
UNION ALL SELECT 'meadows_noncanonical_alias_absent', count(*) FROM public."Track" WHERE lower(btrim(name)) = 'meadows'
UNION ALL SELECT 'thedogs_synthetic_ear_brand_absent', count(*) FROM public."Dog" WHERE "earBrand" ~ '^thedogs:[0-9]+$'
UNION ALL SELECT 'dog_stable_identity', count(*) FROM public."Dog"
  WHERE nullif(btrim("earBrand"), '') IS NULL
    AND (nullif(btrim("sourceProvider"), '') IS NULL OR nullif(btrim("sourceId"), '') IS NULL)
UNION ALL SELECT 'dog_provider_identity_unique', count(*) FROM (
  SELECT lower(btrim("sourceProvider")), btrim("sourceId") FROM public."Dog"
  WHERE nullif(btrim("sourceProvider"), '') IS NOT NULL AND nullif(btrim("sourceId"), '') IS NOT NULL
  GROUP BY 1, 2 HAVING count(*) > 1
) duplicate
UNION ALL SELECT 'result_runner_race_integrity', count(*) FROM public."Result" result
  LEFT JOIN public."Runner" runner ON runner.id = result."runnerId"
  WHERE runner.id IS NULL OR runner."raceId" <> result."raceId"
UNION ALL SELECT 'form_entry_race_integrity', count(*) FROM public."FormEntry" form
  LEFT JOIN public."Race" race ON race.id = form."raceId"
  WHERE form."raceId" IS NULL OR race.id IS NULL
UNION ALL SELECT 'profile_archive_dog_integrity', count(*) FROM public."DogProfileArchive" archive
  LEFT JOIN public."Dog" dog ON dog.id = archive."dogId"
  WHERE archive."dogId" IS NULL OR dog.id IS NULL
UNION ALL SELECT 'race_video_locator_valid', count(*) FROM public."RaceVideo"
  WHERE nullif(btrim("pageUrl"), '') IS NULL
     OR "pageUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)'
UNION ALL SELECT 'photo_finish_not_race_video', count(*) FROM public."RaceVideo"
  WHERE lower(kind) IN ('photo', 'photo-finish', 'photo_finish', 'photofinish')
UNION ALL SELECT 'pedigree_no_self_parent', count(*) FROM public."Dog" WHERE id = "sireId" OR id = "damId"
UNION ALL SELECT 'pedigree_parent_sex', count(*) FROM public."Dog" dog
  LEFT JOIN public."Dog" sire ON sire.id = dog."sireId"
  LEFT JOIN public."Dog" dam ON dam.id = dog."damId"
  WHERE (sire.id IS NOT NULL AND lower(coalesce(sire.sex, '')) IN ('f', 'female', 'bitch'))
     OR (dam.id IS NOT NULL AND lower(coalesce(dam.sex, '')) IN ('m', 'male', 'dog'))
UNION ALL SELECT 'pedigree_no_cycles', count(*) FROM pedigree_walk WHERE root_id = dog_id
UNION ALL SELECT 'galtd_volumes_accounted', count(*)
  FROM (VALUES ('66'), ('67'), ('68'), ('69'), ('70'), ('71'), ('72'), ('73')) required(volume)
  WHERE NOT EXISTS (
    SELECT 1 FROM public."PedigreeImportRun" run
    WHERE lower(run."sourceProvider") = 'galtd'
      AND run."sourceVolume" = required.volume
      AND run."completedAt" IS NOT NULL
  )
UNION ALL SELECT 'non_allowlisted_tables_preserved', count(*)
  FROM giq_private_before before_state
  FULL JOIN giq_private_after after_state USING (table_name)
  WHERE before_state.table_name IS NULL OR after_state.table_name IS NULL
     OR before_state.row_count <> after_state.row_count
     OR before_state.content_sha256 <> after_state.content_sha256;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM giq_atomic_check WHERE failures <> 0) THEN
    RAISE EXCEPTION 'atomic local-copy verification failed; all changes are rolling back: %',
      (SELECT jsonb_agg(jsonb_build_object('name', name, 'failures', failures) ORDER BY name)
       FROM giq_atomic_check WHERE failures <> 0);
  END IF;
END
$$;

DROP SCHEMA giq_portable CASCADE;

\if :{?GIQ_FORCE_LATE_FAILURE}
DO $$
BEGIN
  RAISE EXCEPTION 'forced late local-copy failure; transaction must roll back every mutation';
END
$$;
\endif

SELECT jsonb_build_object(
  'status', 'preserved',
  'algorithm', 'sha256-length-prefixed-canonical-json',
  'tables', jsonb_agg(jsonb_build_object(
    'table', private_state.table_name,
    'rowsBefore', private_state.row_count,
    'rowsAfter', private_state.row_count,
    'sha256Before', private_state.content_sha256,
    'sha256After', private_state.content_sha256
  ) ORDER BY private_state.table_name),
  'atomicVerification', (SELECT jsonb_build_object(
    'auditKind', 'normalized-local-racing-atomic-verification',
    'blockerCount', count(*) FILTER (WHERE failures <> 0),
    'checks', jsonb_agg(jsonb_build_object('name', name, 'failures', failures) ORDER BY name)
  ) FROM giq_atomic_check),
  'thedogsLocalIdentityMapping', (SELECT jsonb_build_object(
    'expectedWhenPresent', 198887,
    'syntheticLocalRowsBefore', synthetic_local_rows,
    'exactPairRows', exact_pair_rows,
    'distinctCandidateRows', distinct_candidate_rows,
    'distinctProviderSourceIds', distinct_provider_ids,
    'distinctSyntheticLocalRows', distinct_synthetic_local_rows,
    'exactDuplicatesConsolidated', (SELECT count(*) FROM giq_dog_exact_duplicate)
  ) FROM giq_thedogs_local_identity_proof),
  'residualLocalDogResolution', jsonb_build_object(
    'expectedHistoricalRows', 44,
    'observedBefore', (SELECT count(*) FROM giq_residual_local_dog),
    'resolved', (SELECT count(*) FROM giq_residual_dog_resolution),
    'candidatePrimaryIdEvidence', (SELECT count(DISTINCT local_id) FROM giq_residual_dog_exact_evidence WHERE evidence_kind = 'candidate-primary-id'),
    'raceNaturalKeyEvidence', (SELECT count(DISTINCT local_id) FROM giq_residual_dog_exact_evidence WHERE evidence_kind = 'race-track-date-number-box'),
    'nameOnlyMatchingAllowed', false
  ),
  'trackAliasConsolidation', jsonb_build_object(
    'canonicalName', 'The Meadows',
    'localAliasesConsolidated', (SELECT count(*) FROM giq_meadows_track_map WHERE source_id <> canonical_id),
    'canonicalRowsAfter', (SELECT count(*) FROM public."Track" WHERE lower(btrim(name)) = 'the meadows')
  )
)
FROM giq_private_before private_state;

COMMIT;
