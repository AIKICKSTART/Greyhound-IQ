\set ON_ERROR_STOP on

BEGIN;
SET LOCAL synchronous_commit = on;
SET LOCAL statement_timeout = 0;

DO $$
DECLARE
  observed_phase text;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'normalization database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE;
  IF observed_phase NOT IN ('galtd_staged', 'normalized') THEN
    RAISE EXCEPTION 'normalization requires galtd_staged, observed %', observed_phase;
  END IF;
  IF observed_phase = 'normalized' THEN
    RAISE EXCEPTION 'normalized stage is immutable; clone a fresh candidate to rebuild it';
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Do not depend on an unaccent extension being installed on AlloyDB.
CREATE OR REPLACE FUNCTION _giq_history_merge.unaccent_safe(value text)
RETURNS text
LANGUAGE sql

IMMUTABLE
PARALLEL SAFE
RETURN translate(
  coalesce(value, ''),
  'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ',
  'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
);

CREATE OR REPLACE FUNCTION _giq_history_merge.slug(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURN trim(both '-' FROM regexp_replace(lower(_giq_history_merge.unaccent_safe(value)), '[^a-z0-9]+', '-', 'g'));

CREATE OR REPLACE FUNCTION _giq_history_merge.try_jsonb(value text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN RETURN NULL; END IF;
  RETURN value::jsonb;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION _giq_history_merge.history_id(prefix text, natural_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURN 'hist_' || prefix || '_' || md5(natural_key);

CREATE OR REPLACE FUNCTION _giq_history_merge.canonical_track_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURN CASE
  WHEN lower(btrim(value)) IN ('meadows', 'the meadows') THEN 'The Meadows'
  ELSE btrim(value)
END;

CREATE OR REPLACE FUNCTION _giq_history_merge.canonical_track_state(name text, state text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURN CASE
  WHEN lower(btrim(name)) = 'canberra' THEN 'ACT'
  WHEN lower(btrim(name)) IN (
    'auckland','ashburton','cambridge','christchurch','manukau','manawatu',
    'otago','palmerston - north','southland','taranaki','tokoroa','wellington',
    'waikato','wanganui'
  ) THEN 'NZ'
  ELSE upper(btrim(state))
END;

CREATE OR REPLACE FUNCTION _giq_history_merge.track_key(name text, state text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURN _giq_history_merge.canonical_track_state(name, state) || ':' ||
       _giq_history_merge.slug(_giq_history_merge.canonical_track_name(name));

CREATE TABLE _giq_history_stage.normalized_track (
  natural_key text PRIMARY KEY,
  target_id text NOT NULL UNIQUE,
  name text NOT NULL,
  state text NOT NULL,
  surface text,

  circumference integer,
  straight_length integer,
  box_count integer NOT NULL,
  has_isolynx boolean NOT NULL,
  source_provenance jsonb NOT NULL
);

WITH source_rows AS MATERIALIZED (
  SELECT
    'r2'::text AS source_name,
    t.id AS source_id,
    _giq_history_merge.track_key(t.name, t.state) AS natural_key,
    _giq_history_merge.canonical_track_name(t.name) AS name,
    _giq_history_merge.canonical_track_state(t.name, t.state) AS state,
    t.surface,
    t.circumference,
    t."straightLength" AS straight_length,
    t."boxCount" AS box_count,
    t."hasIsolynx" AS has_isolynx,
    20 AS priority
  FROM _giq_history_stage."r2_Track" t
  WHERE lower(btrim(t.name)) <> 'greyhoundiq demo park'
  UNION ALL
  SELECT DISTINCT ON (e.payload->>'trackNaturalKey')
    'export', e.payload->>'trackNaturalKey',
    _giq_history_merge.track_key(e.payload->>'trackName', e.payload->>'state'),
    _giq_history_merge.canonical_track_name(e.payload->>'trackName'),
    _giq_history_merge.canonical_track_state(e.payload->>'trackName', e.payload->>'state'),
    NULL, NULL, NULL, 8, false, 10
  FROM _giq_history_stage.export_meetings e
  WHERE lower(btrim(e.payload->>'trackName')) <> 'greyhoundiq demo park'
  ORDER BY e.payload->>'trackNaturalKey', e.source_file, e.line_number
), preferred AS (
  SELECT DISTINCT ON (natural_key) *
  FROM source_rows
  ORDER BY natural_key, priority DESC, source_name, source_id
), production_target AS (
  SELECT DISTINCT ON (_giq_history_merge.track_key(t.name, t.state))
    _giq_history_merge.track_key(t.name, t.state) AS natural_key,
    t.id
  FROM public."Track" t
  WHERE lower(btrim(t.name)) <> 'greyhoundiq demo park'
  ORDER BY _giq_history_merge.track_key(t.name, t.state),
           (lower(btrim(t.name)) = 'the meadows') DESC,
           t.id
)
INSERT INTO _giq_history_stage.normalized_track
SELECT
  p.natural_key,
  coalesce(pt.id, _giq_history_merge.history_id('track', p.natural_key)),
  p.name,
  p.state,
  p.surface,
  p.circumference,
  p.straight_length,
  p.box_count,
  p.has_isolynx,
  jsonb_build_object('sources', (
    SELECT jsonb_agg(jsonb_build_object('source', s.source_name, 'id', s.source_id)
                     ORDER BY s.source_name, s.source_id)
    FROM source_rows s WHERE s.natural_key = p.natural_key
  ))
FROM preferred p
LEFT JOIN production_target pt USING (natural_key);

CREATE TABLE _giq_history_stage.track_map (
  source_name text NOT NULL,
  source_id text NOT NULL,
  natural_key text NOT NULL REFERENCES _giq_history_stage.normalized_track(natural_key),
  target_id text NOT NULL,
  PRIMARY KEY (source_name, source_id)
);

INSERT INTO _giq_history_stage.track_map
SELECT 'r2', t.id, n.natural_key, n.target_id
FROM _giq_history_stage."r2_Track" t
JOIN _giq_history_stage.normalized_track n
  ON n.natural_key = _giq_history_merge.track_key(t.name, t.state)
WHERE lower(btrim(t.name)) <> 'greyhoundiq demo park'
UNION ALL
SELECT DISTINCT 'export', e.payload->>'trackNaturalKey', n.natural_key, n.target_id
FROM _giq_history_stage.export_meetings e
JOIN _giq_history_stage.normalized_track n
  ON n.natural_key = _giq_history_merge.track_key(e.payload->>'trackName', e.payload->>'state')
WHERE lower(btrim(e.payload->>'trackName')) <> 'greyhoundiq demo park';

CREATE TABLE _giq_history_stage.trainer_provider_observation AS
SELECT
  r."trainerId" AS source_trainer_id,
  nullif(_giq_history_merge.try_jsonb(r."sourceRawJson")->>'trainerId', '') AS provider_source_id,
  r.id AS runner_id
FROM _giq_history_stage."r2_Runner" r
WHERE r."trainerId" IS NOT NULL;

CREATE INDEX trainer_provider_observation_source_idx
  ON _giq_history_stage.trainer_provider_observation(source_trainer_id);

CREATE TABLE _giq_history_stage.normalized_trainer (
  natural_key text PRIMARY KEY,
  target_id text NOT NULL UNIQUE,
  name text NOT NULL,
  state text,
  license_number text,
  source_provider text,
  source_id text,

  source_provenance jsonb NOT NULL
);

WITH r2_identity AS MATERIALIZED (
  SELECT
    t.id AS source_id,
    CASE
      WHEN count(DISTINCT o.provider_source_id) FILTER (WHERE o.provider_source_id IS NOT NULL) = 1
        THEN 'thedogs:trainer:' || min(o.provider_source_id) FILTER (WHERE o.provider_source_id IS NOT NULL)
      ELSE 'r2:trainer:' || t.id
    END AS natural_key,
    t.name,
    t.state,
    t."licenseNumber" AS license_number,
    CASE WHEN count(DISTINCT o.provider_source_id) FILTER (WHERE o.provider_source_id IS NOT NULL) = 1
      THEN 'thedogs' END AS source_provider,
    CASE WHEN count(DISTINCT o.provider_source_id) FILTER (WHERE o.provider_source_id IS NOT NULL) = 1
      THEN min(o.provider_source_id) FILTER (WHERE o.provider_source_id IS NOT NULL) END AS provider_source_id
  FROM _giq_history_stage."r2_Trainer" t
  LEFT JOIN _giq_history_stage.trainer_provider_observation o
    ON o.source_trainer_id = t.id
  GROUP BY t.id, t.name, t.state, t."licenseNumber"
), export_identity AS MATERIALIZED (
  SELECT DISTINCT ON (e.payload->>'trainerSourceId')
    'export:trainer:' || (e.payload->>'trainerSourceId') AS source_id,
    'thedogs:trainer:' || (e.payload->>'trainerSourceId') AS natural_key,
    e.payload->>'trainerName' AS name,
    NULL::text AS state,
    NULL::text AS license_number,
    'thedogs'::text AS source_provider,
    e.payload->>'trainerSourceId' AS provider_source_id
  FROM _giq_history_stage.export_runners e
  WHERE nullif(e.payload->>'trainerSourceId', '') IS NOT NULL
    AND nullif(e.payload->>'trainerName', '') IS NOT NULL
  ORDER BY e.payload->>'trainerSourceId', e.source_file, e.line_number
), identity AS (
  SELECT *, 20 AS priority FROM r2_identity
  UNION ALL
  SELECT *, 10 FROM export_identity
), preferred AS (
  SELECT DISTINCT ON (natural_key) * FROM identity
  ORDER BY natural_key, priority DESC, source_id
), production_provider_observation AS MATERIALIZED (
  SELECT
    nullif(_giq_history_merge.try_jsonb(r."sourceRawJson")->>'trainerId','') AS provider_source_id,
    r."trainerId" AS trainer_id
  FROM public."Runner" r
  WHERE r."trainerId" IS NOT NULL
), production_provider AS (
  SELECT provider_source_id,min(trainer_id) AS trainer_id
  FROM production_provider_observation
  WHERE provider_source_id IS NOT NULL
  GROUP BY provider_source_id
  HAVING count(DISTINCT trainer_id)=1
)
INSERT INTO _giq_history_stage.normalized_trainer
SELECT
  p.natural_key,
  coalesce(pp.trainer_id, _giq_history_merge.history_id('trainer', p.natural_key)),
  p.name,
  p.state,
  p.license_number,
  p.source_provider,
  p.provider_source_id,
  jsonb_build_object('sourceIds', (
    SELECT jsonb_agg(i.source_id ORDER BY i.source_id)
    FROM identity i WHERE i.natural_key = p.natural_key
  ))
FROM preferred p
LEFT JOIN production_provider pp ON pp.provider_source_id = p.provider_source_id;

INSERT INTO _giq_history_merge.quarantine
  (source_name,entity_type,source_key,reason_code,disposition,blocking,evidence)
SELECT
  'production-snapshot','trainer',provider_source_id,
  'provider-identity-maps-multiple-trainers','requires-explicit-trainer-identity-adjudication',true,
  jsonb_build_object('trainerIds',jsonb_agg(DISTINCT trainer_id ORDER BY trainer_id))
FROM (
  SELECT
    nullif(_giq_history_merge.try_jsonb(r."sourceRawJson")->>'trainerId','') AS provider_source_id,
    r."trainerId" AS trainer_id
  FROM public."Runner" r WHERE r."trainerId" IS NOT NULL
) observed
WHERE provider_source_id IS NOT NULL
GROUP BY provider_source_id
HAVING count(DISTINCT trainer_id)>1
ON CONFLICT DO NOTHING;

CREATE TABLE _giq_history_stage.trainer_map (
  source_name text NOT NULL,
  source_id text NOT NULL,
  natural_key text NOT NULL REFERENCES _giq_history_stage.normalized_trainer(natural_key),
  target_id text NOT NULL,
  PRIMARY KEY (source_name, source_id)
);

WITH r2_identity AS (
  SELECT
    t.id,
    CASE
      WHEN count(DISTINCT o.provider_source_id) FILTER (WHERE o.provider_source_id IS NOT NULL) = 1
        THEN 'thedogs:trainer:' || min(o.provider_source_id) FILTER (WHERE o.provider_source_id IS NOT NULL)
      ELSE 'r2:trainer:' || t.id
    END AS natural_key
  FROM _giq_history_stage."r2_Trainer" t
  LEFT JOIN _giq_history_stage.trainer_provider_observation o ON o.source_trainer_id = t.id
  GROUP BY t.id
)
INSERT INTO _giq_history_stage.trainer_map
SELECT 'r2', r.id, r.natural_key, n.target_id
FROM r2_identity r JOIN _giq_history_stage.normalized_trainer n USING (natural_key)
UNION ALL
SELECT DISTINCT 'export', e.payload->>'trainerSourceId',
  'thedogs:trainer:' || (e.payload->>'trainerSourceId'), n.target_id
FROM _giq_history_stage.export_runners e
JOIN _giq_history_stage.normalized_trainer n
  ON n.natural_key = 'thedogs:trainer:' || (e.payload->>'trainerSourceId')
WHERE nullif(e.payload->>'trainerSourceId', '') IS NOT NULL;

INSERT INTO _giq_history_merge.quarantine
  (source_name, entity_type, source_key, reason_code, disposition, blocking, evidence)
SELECT
  'r2', 'trainer', t.id, 'multiple_provider_identities',
  'preserved_as_distinct_r2_trainer', false,
  jsonb_build_object('providerIds', jsonb_agg(DISTINCT o.provider_source_id ORDER BY o.provider_source_id))
FROM _giq_history_stage."r2_Trainer" t
JOIN _giq_history_stage.trainer_provider_observation o ON o.source_trainer_id = t.id
WHERE o.provider_source_id IS NOT NULL
GROUP BY t.id
HAVING count(DISTINCT o.provider_source_id) > 1
ON CONFLICT DO NOTHING;

CREATE TABLE _giq_history_stage.dog_identity_source (
  natural_key text NOT NULL,
  source_name text NOT NULL,
  source_key text NOT NULL,
  name text,
  source_provider text,
  provider_source_id text,
  PRIMARY KEY (source_name, source_key)
);

INSERT INTO _giq_history_stage.dog_identity_source
SELECT
  CASE
    WHEN d."earBrand" ~ '^thedogs:[0-9]+$' THEN 'thedogs:dog:' || substring(d."earBrand" FROM 9)
    WHEN nullif(d."sourceProvider", '') IS NOT NULL AND nullif(d."sourceId", '') IS NOT NULL
      THEN lower(d."sourceProvider") || ':dog:' || d."sourceId"
    ELSE 'r2:dog:' || d.id
  END,
  'r2', d.id, d.name,
  CASE
    WHEN d."earBrand" ~ '^thedogs:[0-9]+$' THEN 'thedogs'
    ELSE nullif(lower(d."sourceProvider"), '')
  END,
  CASE
    WHEN d."earBrand" ~ '^thedogs:[0-9]+$' THEN substring(d."earBrand" FROM 9)
    ELSE nullif(d."sourceId", '')
  END
FROM _giq_history_stage."r2_Dog" d;

INSERT INTO _giq_history_stage.dog_identity_source
SELECT e.payload->>'naturalKey', 'profile', e.payload->>'naturalKey',
       e.payload->>'name', 'thedogs', e.payload->>'sourceId'
FROM _giq_history_stage.export_profiles e;

INSERT INTO _giq_history_stage.dog_identity_source
SELECT DISTINCT ON (e.payload->>'dogNaturalKey')
       e.payload->>'dogNaturalKey', 'runner', e.payload->>'dogNaturalKey',
       e.payload->>'dogName', 'thedogs', e.payload->>'dogSourceId'
FROM _giq_history_stage.export_runners e
WHERE nullif(e.payload->>'dogNaturalKey', '') IS NOT NULL
ORDER BY e.payload->>'dogNaturalKey', e.source_file, e.line_number;

INSERT INTO _giq_history_stage.dog_identity_source
SELECT DISTINCT ON (e.payload->>'parentNaturalKey')
       e.payload->>'parentNaturalKey', 'pedigree-parent', e.payload->>'parentNaturalKey',
       e.payload->>'parentName', 'thedogs', e.payload->>'parentSourceId'
FROM _giq_history_stage.export_pedigree_edges e
ORDER BY e.payload->>'parentNaturalKey', e.source_file, e.line_number;

CREATE INDEX dog_identity_source_natural_key_idx
  ON _giq_history_stage.dog_identity_source(natural_key);

CREATE TABLE _giq_history_stage.normalized_dog (
  natural_key text PRIMARY KEY,
  target_id text NOT NULL UNIQUE,
  name text NOT NULL,
  ear_brand text,
  colour text,
  sex text,
  whelp_date timestamptz,
  trainer_id text,
  source_provider text,
  source_id text,
  profile_url text,

  owner_name text,
  career_starts integer,
  career_wins integer,
  career_seconds integer,
  career_thirds integer,
  prize_money double precision,
  win_percentage double precision,
  place_percentage double precision,
  profile_stats_json text,
  best_times_json text,
  box_history_json text,
  distance_history_json text,
  profile_source_raw_json text,
  last_profile_synced_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  verification_class text NOT NULL,
  source_provenance jsonb NOT NULL
);

WITH identities AS MATERIALIZED (
  SELECT DISTINCT natural_key FROM _giq_history_stage.dog_identity_source
), r2 AS MATERIALIZED (
  SELECT DISTINCT ON (s.natural_key)
    s.natural_key, d.*
  FROM _giq_history_stage.dog_identity_source s
  JOIN _giq_history_stage."r2_Dog" d ON s.source_name = 'r2' AND s.source_key = d.id
  ORDER BY s.natural_key, d.id
), profile AS MATERIALIZED (
  SELECT DISTINCT ON (payload->>'naturalKey') payload
  FROM _giq_history_stage.export_profiles
  ORDER BY payload->>'naturalKey', source_file, line_number

), production_identity AS MATERIALIZED (
  SELECT DISTINCT ON (natural_key) natural_key, id
  FROM (
    SELECT
      CASE
        WHEN d."earBrand" ~ '^thedogs:[0-9]+$' THEN 'thedogs:dog:' || substring(d."earBrand" FROM 9)
        WHEN nullif(d."sourceProvider", '') IS NOT NULL AND nullif(d."sourceId", '') IS NOT NULL
          THEN lower(d."sourceProvider") || ':dog:' || d."sourceId"
        ELSE 'production:dog:' || d.id
      END AS natural_key,
      d.id
    FROM public."Dog" d
  ) resolved
  ORDER BY natural_key, id
), preferred_name AS MATERIALIZED (
  SELECT DISTINCT ON (natural_key) natural_key, name
  FROM _giq_history_stage.dog_identity_source
  WHERE nullif(btrim(name), '') IS NOT NULL
  ORDER BY natural_key,
    CASE source_name WHEN 'profile' THEN 1 WHEN 'r2' THEN 2 WHEN 'runner' THEN 3 ELSE 4 END,
    source_key
)
INSERT INTO _giq_history_stage.normalized_dog
SELECT
  i.natural_key,
  coalesce(pi.id, _giq_history_merge.history_id('dog', i.natural_key)),
  coalesce(nullif(p.payload->>'name', ''), nullif(r.name, ''), pn.name),
  CASE WHEN r."earBrand" ~ '^thedogs:[0-9]+$' THEN NULL ELSE r."earBrand" END,
  coalesce(nullif(p.payload->>'colour', ''), r.colour),
  coalesce(nullif(p.payload->>'sex', ''), r.sex),
  coalesce(nullif(p.payload->>'whelpDate', '')::timestamptz, r."whelpDate"),
  tm.target_id,
  coalesce(nullif(p.payload->>'provider', ''),
           CASE WHEN r."earBrand" ~ '^thedogs:[0-9]+$' THEN 'thedogs' ELSE r."sourceProvider" END),
  coalesce(nullif(p.payload->>'sourceId', ''),
           CASE WHEN r."earBrand" ~ '^thedogs:[0-9]+$' THEN substring(r."earBrand" FROM 9) ELSE r."sourceId" END),
  coalesce(nullif(p.payload->>'profileUrl', ''), r."profileUrl"),
  coalesce(nullif(p.payload->>'ownerName', ''), r."ownerName"),
  coalesce((p.payload->>'careerStarts')::integer, r."careerStarts"),
  coalesce((p.payload->>'careerWins')::integer, r."careerWins"),
  coalesce((p.payload->>'careerSeconds')::integer, r."careerSeconds"),
  coalesce((p.payload->>'careerThirds')::integer, r."careerThirds"),
  coalesce((p.payload->>'prizeMoney')::double precision, r."prizeMoney"),
  coalesce((p.payload->>'winPercentage')::double precision, r."winPercentage"),
  coalesce((p.payload->>'placePercentage')::double precision, r."placePercentage"),
  coalesce((p.payload->'profileStats')::text, r."profileStatsJson"),
  coalesce((p.payload->'bestTimes')::text, r."bestTimesJson"),
  coalesce((p.payload->'boxHistory')::text, r."boxHistoryJson"),
  coalesce((p.payload->'distanceHistory')::text, r."distanceHistoryJson"),
  r."profileSourceRawJson",
  greatest(nullif(p.payload->>'fetchedAt', '')::timestamptz, r."lastProfileSyncedAt"),
  r."retiredAt",
  coalesce(r."createdAt", nullif(p.payload->>'fetchedAt', '')::timestamptz, clock_timestamp()),
  greatest(coalesce(r."updatedAt", '-infinity'::timestamptz),
           coalesce(nullif(p.payload->>'fetchedAt', '')::timestamptz, '-infinity'::timestamptz)),
  CASE WHEN p.payload IS NOT NULL THEN 'full-profile'
       WHEN EXISTS (SELECT 1 FROM _giq_history_stage.dog_identity_source s WHERE s.natural_key=i.natural_key AND s.source_name='runner')
         THEN 'race-observed'
       WHEN EXISTS (SELECT 1 FROM _giq_history_stage.dog_identity_source s WHERE s.natural_key=i.natural_key AND s.source_name='pedigree-parent')
         THEN 'provider-stub'
       ELSE 'r2-preserved' END,
  jsonb_build_object('identities', (
    SELECT jsonb_agg(jsonb_build_object('source', s.source_name, 'key', s.source_key)
                     ORDER BY s.source_name, s.source_key)
    FROM _giq_history_stage.dog_identity_source s WHERE s.natural_key=i.natural_key
  ))
FROM identities i
LEFT JOIN r2 r USING (natural_key)
LEFT JOIN profile p ON p.payload->>'naturalKey' = i.natural_key
LEFT JOIN preferred_name pn USING (natural_key)
LEFT JOIN production_identity pi USING (natural_key)
LEFT JOIN _giq_history_stage.trainer_map tm ON tm.source_name='r2' AND tm.source_id=r."trainerId"
WHERE coalesce(nullif(p.payload->>'name', ''), nullif(r.name, ''), pn.name) IS NOT NULL;

CREATE TABLE _giq_history_stage.dog_map (
  source_name text NOT NULL,
  source_id text NOT NULL,
  natural_key text NOT NULL REFERENCES _giq_history_stage.normalized_dog(natural_key),
  target_id text NOT NULL,
  PRIMARY KEY (source_name, source_id)
);

INSERT INTO _giq_history_stage.dog_map
SELECT s.source_name, s.source_key, s.natural_key, n.target_id
FROM _giq_history_stage.dog_identity_source s
JOIN _giq_history_stage.normalized_dog n USING (natural_key);

DO $$
DECLARE
  thedogs_identities bigint;
  missing_names bigint;
  synthetic_rows bigint;
BEGIN
  SELECT count(DISTINCT natural_key) INTO thedogs_identities
  FROM _giq_history_stage.dog_identity_source
  WHERE natural_key ~ '^thedogs:dog:[0-9]+$';
  IF thedogs_identities <> 212391 THEN
    RAISE EXCEPTION 'TheDogs identity union expected 212391, observed %', thedogs_identities;
  END IF;
  SELECT count(*) INTO missing_names
  FROM (SELECT DISTINCT natural_key FROM _giq_history_stage.dog_identity_source) i
  LEFT JOIN _giq_history_stage.normalized_dog n USING (natural_key)
  WHERE n.natural_key IS NULL;
  IF missing_names <> 0 THEN
    RAISE EXCEPTION '% provider identities lack a non-placeholder name', missing_names;
  END IF;
  SELECT count(*) INTO synthetic_rows FROM _giq_history_stage."r2_Dog"
  WHERE "earBrand" ~ '^thedogs:[0-9]+$';
  IF synthetic_rows <> 198887 THEN
    RAISE EXCEPTION 'synthetic TheDogs ear-brand contract changed: %', synthetic_rows;
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.normalized_meeting (
  natural_key text PRIMARY KEY,
  target_id text NOT NULL UNIQUE,
  track_id text NOT NULL,
  meeting_date timestamptz NOT NULL,
  meeting_type text,
  source_provider text,
  source_id text,
  source_raw_json text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL,
  source_provenance jsonb NOT NULL
);

CREATE TABLE _giq_history_stage.meeting_source AS
SELECT
  'r2'::text AS source_name,
  m.id AS source_id,
  tm.natural_key || ':meeting:' || to_char(m."meetingDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS natural_key,
  tm.target_id AS track_id,
  m."meetingDate" AS meeting_date,
  m."meetingType" AS meeting_type,
  m."sourceProvider" AS source_provider,
  m."sourceId" AS provider_source_id,
  m."sourceRawJson" AS source_raw_json,
  m."lastSyncedAt" AS last_synced_at,
  m."createdAt" AS created_at,
  20 AS priority
FROM _giq_history_stage."r2_Meeting" m
JOIN _giq_history_stage.track_map tm
  ON tm.source_name='r2' AND tm.source_id=m."trackId"
WHERE coalesce(lower(m."sourceProvider"), '') NOT IN ('demo', 'greyhoundiq-demo')
UNION ALL
SELECT
  'export', e.payload->>'naturalKey',
  tm.natural_key || ':meeting:' || to_char((e.payload->>'meetingDate')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
  tm.target_id,
  (e.payload->>'meetingDate')::timestamptz,
  e.payload->>'meetingType',
  'thedogs', e.payload->>'sourceId', e.payload::text, NULL,
  (e.payload->>'meetingDate')::timestamptz,
  10
FROM _giq_history_stage.export_meetings e
JOIN _giq_history_stage.track_map tm
  ON tm.source_name='export' AND tm.source_id=e.payload->>'trackNaturalKey';


CREATE INDEX meeting_source_natural_key_idx
  ON _giq_history_stage.meeting_source(natural_key);

WITH preferred AS (
  SELECT DISTINCT ON (natural_key) * FROM _giq_history_stage.meeting_source
  ORDER BY natural_key, priority DESC, source_name, source_id
), production AS (
  SELECT DISTINCT ON (natural_key) natural_key, id
  FROM (
    SELECT
      _giq_history_merge.track_key(t.name, t.state) || ':meeting:' ||
        to_char(m."meetingDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS natural_key,
      m.id,
      (m."trackId" = nt.target_id) AS canonical_track
    FROM public."Meeting" m
    JOIN public."Track" t ON t.id=m."trackId"
    JOIN _giq_history_stage.normalized_track nt
      ON nt.natural_key=_giq_history_merge.track_key(t.name,t.state)
    WHERE lower(btrim(t.name)) <> 'greyhoundiq demo park'
      AND coalesce(lower(m."sourceProvider"), '') NOT IN ('demo','greyhoundiq-demo')
  ) candidates
  ORDER BY natural_key, canonical_track DESC, id
)
INSERT INTO _giq_history_stage.normalized_meeting
SELECT
  p.natural_key,
  coalesce(prod.id, _giq_history_merge.history_id('meeting', p.natural_key)),
  p.track_id, p.meeting_date, p.meeting_type, p.source_provider,
  p.provider_source_id, p.source_raw_json, p.last_synced_at, p.created_at,
  jsonb_build_object('sources', (
    SELECT jsonb_agg(jsonb_build_object('source', s.source_name, 'id', s.source_id)
                     ORDER BY s.source_name, s.source_id)
    FROM _giq_history_stage.meeting_source s WHERE s.natural_key=p.natural_key
  ))
FROM preferred p
LEFT JOIN production prod USING (natural_key);

CREATE TABLE _giq_history_stage.meeting_map (
  source_name text NOT NULL,
  source_id text NOT NULL,
  natural_key text NOT NULL REFERENCES _giq_history_stage.normalized_meeting(natural_key),
  target_id text NOT NULL,
  PRIMARY KEY (source_name, source_id)
);

INSERT INTO _giq_history_stage.meeting_map
SELECT s.source_name, s.source_id, s.natural_key, n.target_id
FROM _giq_history_stage.meeting_source s
JOIN _giq_history_stage.normalized_meeting n USING (natural_key);

CREATE TABLE _giq_history_stage.normalized_race (
  natural_key text PRIMARY KEY,
  target_id text NOT NULL UNIQUE,
  meeting_id text NOT NULL,
  race_number integer NOT NULL,
  name text,
  race_time timestamptz NOT NULL,
  distance integer NOT NULL,
  grade text,
  prize_money double precision,
  result_status text,
  replay_url text,
  photo_finish_url text,
  source_provider text,
  source_id text,
  source_raw_json text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL,
  source_provenance jsonb NOT NULL
);

CREATE TABLE _giq_history_stage.race_source AS
SELECT
  'r2'::text AS source_name,
  r.id AS source_id,
  mm.natural_key || ':race:' || r."raceNumber" AS natural_key,
  mm.target_id AS meeting_id,
  r."raceNumber" AS race_number,
  r.name, r."raceTime" AS race_time, r.distance, r.grade, r."prizeMoney" AS prize_money,
  r."resultStatus" AS result_status, r."replayUrl" AS replay_url,
  r."photoFinishUrl" AS photo_finish_url, r."sourceProvider" AS source_provider,
  r."sourceId" AS provider_source_id, r."sourceRawJson" AS source_raw_json,
  r."lastSyncedAt" AS last_synced_at, r."createdAt" AS created_at, 20 AS priority
FROM _giq_history_stage."r2_Race" r
JOIN _giq_history_stage.meeting_map mm
  ON mm.source_name='r2' AND mm.source_id=r."meetingId"
UNION ALL
SELECT
  'export', e.payload->>'naturalKey',
  mm.natural_key || ':race:' || (e.payload->>'raceNumber'),
  mm.target_id, (e.payload->>'raceNumber')::integer,
  e.payload->>'name', (e.payload->>'raceTime')::timestamptz,
  (e.payload->>'distance')::integer, e.payload->>'grade', NULL,
  e.payload->>'resultStatus', NULL, NULL, 'thedogs', e.payload->>'sourceId',
  e.payload::text, NULL, (e.payload->>'raceTime')::timestamptz, 10
FROM _giq_history_stage.export_races e
JOIN _giq_history_stage.meeting_map mm
  ON mm.source_name='export' AND mm.source_id=e.payload->>'meetingNaturalKey';

CREATE INDEX race_source_natural_key_idx ON _giq_history_stage.race_source(natural_key);

WITH preferred AS (
  SELECT DISTINCT ON (natural_key) * FROM _giq_history_stage.race_source
  ORDER BY natural_key, priority DESC, source_name, source_id
), production AS (
  SELECT DISTINCT ON (natural_key) natural_key, id
  FROM (
    SELECT
      _giq_history_merge.track_key(t.name,t.state) || ':meeting:' ||
      to_char(m."meetingDate" AT TIME ZONE 'UTC','YYYY-MM-DD') || ':race:' || r."raceNumber" AS natural_key,

      r.id,
      (m.id=nm.target_id) AS canonical_meeting
    FROM public."Race" r
    JOIN public."Meeting" m ON m.id=r."meetingId"
    JOIN public."Track" t ON t.id=m."trackId"
    JOIN _giq_history_stage.normalized_meeting nm
      ON nm.natural_key=_giq_history_merge.track_key(t.name,t.state) || ':meeting:' ||
        to_char(m."meetingDate" AT TIME ZONE 'UTC','YYYY-MM-DD')
    WHERE lower(btrim(t.name)) <> 'greyhoundiq demo park'
      AND coalesce(lower(m."sourceProvider"), '') NOT IN ('demo','greyhoundiq-demo')
  ) candidates
  ORDER BY natural_key, canonical_meeting DESC, id
)
INSERT INTO _giq_history_stage.normalized_race
SELECT
  p.natural_key,
  coalesce(prod.id, _giq_history_merge.history_id('race',p.natural_key)),
  p.meeting_id,p.race_number,p.name,p.race_time,p.distance,p.grade,p.prize_money,
  p.result_status,p.replay_url,p.photo_finish_url,p.source_provider,p.provider_source_id,
  p.source_raw_json,p.last_synced_at,p.created_at,
  jsonb_build_object('sources',(
    SELECT jsonb_agg(jsonb_build_object('source',s.source_name,'id',s.source_id)
                     ORDER BY s.source_name,s.source_id)
    FROM _giq_history_stage.race_source s WHERE s.natural_key=p.natural_key
  ))
FROM preferred p LEFT JOIN production prod USING(natural_key);

CREATE TABLE _giq_history_stage.race_map (
  source_name text NOT NULL,
  source_id text NOT NULL,
  natural_key text NOT NULL REFERENCES _giq_history_stage.normalized_race(natural_key),
  target_id text NOT NULL,
  PRIMARY KEY(source_name,source_id)
);
INSERT INTO _giq_history_stage.race_map
SELECT s.source_name,s.source_id,s.natural_key,n.target_id
FROM _giq_history_stage.race_source s
JOIN _giq_history_stage.normalized_race n USING(natural_key);

CREATE TABLE _giq_history_stage.normalized_runner (
  natural_key text PRIMARY KEY,
  target_id text NOT NULL UNIQUE,
  race_id text NOT NULL,
  dog_id text NOT NULL,
  box_number integer NOT NULL,
  weight double precision,
  trainer_id text,
  starting_price double precision,
  scratched boolean NOT NULL,

  source_provider text,
  source_id text,
  source_raw_json text,
  created_at timestamptz NOT NULL,
  source_provenance jsonb NOT NULL
);

CREATE TABLE _giq_history_stage.runner_source AS
SELECT
  'r2'::text AS source_name,r.id AS source_id,
  rm.natural_key || ':runner:box:' || r."boxNumber" AS natural_key,
  rm.target_id AS race_id,dm.target_id AS dog_id,r."boxNumber" AS box_number,
  r.weight,tm.target_id AS trainer_id,r."startingPrice" AS starting_price,
  r.scratched,r."sourceProvider" AS source_provider,r."sourceId" AS provider_source_id,
  r."sourceRawJson" AS source_raw_json,r."createdAt" AS created_at,20 AS priority
FROM _giq_history_stage."r2_Runner" r
JOIN _giq_history_stage.race_map rm ON rm.source_name='r2' AND rm.source_id=r."raceId"
JOIN _giq_history_stage.dog_map dm ON dm.source_name='r2' AND dm.source_id=r."dogId"
LEFT JOIN _giq_history_stage.trainer_map tm ON tm.source_name='r2' AND tm.source_id=r."trainerId"
UNION ALL
SELECT
  'export',e.payload->>'naturalKey',rm.natural_key || ':runner:box:' || (e.payload->>'boxNumber'),
  rm.target_id,dm.target_id,(e.payload->>'boxNumber')::integer,
  (e.payload->>'weight')::double precision,tm.target_id,NULL,
  coalesce((e.payload->>'scratched')::boolean,false),'thedogs',e.payload->>'sourceId',
  e.payload::text,clock_timestamp(),10
FROM _giq_history_stage.export_runners e
JOIN _giq_history_stage.race_map rm ON rm.source_name='export' AND rm.source_id=e.payload->>'raceNaturalKey'
JOIN _giq_history_stage.dog_map dm ON dm.source_name='runner' AND dm.source_id=e.payload->>'dogNaturalKey'
LEFT JOIN _giq_history_stage.trainer_map tm ON tm.source_name='export' AND tm.source_id=e.payload->>'trainerSourceId';

CREATE INDEX runner_source_natural_key_idx ON _giq_history_stage.runner_source(natural_key);

WITH preferred AS (
  SELECT DISTINCT ON (natural_key) * FROM _giq_history_stage.runner_source
  ORDER BY natural_key,priority DESC,source_name,source_id
), production_box AS (
  SELECT DISTINCT ON (nr.natural_key || ':runner:box:' || r."boxNumber")
    nr.natural_key || ':runner:box:' || r."boxNumber" AS natural_key,r.id
  FROM public."Runner" r
  JOIN public."Race" race ON race.id=r."raceId"
  JOIN public."Meeting" m ON m.id=race."meetingId"
  JOIN public."Track" t ON t.id=m."trackId"
  JOIN _giq_history_stage.normalized_race nr
    ON nr.natural_key=_giq_history_merge.track_key(t.name,t.state) || ':meeting:' ||
      to_char(m."meetingDate" AT TIME ZONE 'UTC','YYYY-MM-DD') || ':race:' || race."raceNumber"
  WHERE coalesce(lower(m."sourceProvider"),'') NOT IN ('demo','greyhoundiq-demo')
  ORDER BY nr.natural_key || ':runner:box:' || r."boxNumber", r.id
)
INSERT INTO _giq_history_stage.normalized_runner
SELECT p.natural_key,coalesce(pb.id,_giq_history_merge.history_id('runner',p.natural_key)),
  p.race_id,p.dog_id,p.box_number,p.weight,p.trainer_id,p.starting_price,p.scratched,
  p.source_provider,p.provider_source_id,p.source_raw_json,p.created_at,
  jsonb_build_object('sources',(
    SELECT jsonb_agg(jsonb_build_object('source',s.source_name,'id',s.source_id)
                     ORDER BY s.source_name,s.source_id)
    FROM _giq_history_stage.runner_source s WHERE s.natural_key=p.natural_key
  ))
FROM preferred p LEFT JOIN production_box pb USING(natural_key);

CREATE TABLE _giq_history_stage.runner_map (
  source_name text NOT NULL,
  source_id text NOT NULL,
  natural_key text NOT NULL REFERENCES _giq_history_stage.normalized_runner(natural_key),
  target_id text NOT NULL,
  PRIMARY KEY(source_name,source_id)
);
INSERT INTO _giq_history_stage.runner_map
SELECT s.source_name,s.source_id,s.natural_key,n.target_id
FROM _giq_history_stage.runner_source s
JOIN _giq_history_stage.normalized_runner n USING(natural_key);

CREATE TABLE _giq_history_stage.normalized_result (
  natural_key text PRIMARY KEY,
  target_id text NOT NULL UNIQUE,
  runner_id text NOT NULL,
  race_id text NOT NULL,
  finishing_position integer,
  running_time double precision,
  margin double precision,
  prize_money_won double precision,
  split_time double precision,
  sectionals text,
  gps_data text,
  source_provider text,
  source_id text,
  source_raw_json text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL,
  source_provenance jsonb NOT NULL
);

CREATE TABLE _giq_history_stage.result_source AS
SELECT
  'r2'::text AS source_name,res.id AS source_id,rm.natural_key || ':result' AS natural_key,
  rm.target_id AS runner_id,nr.race_id,res."finishingPosition" AS finishing_position,
  res."runningTime" AS running_time,res.margin,res."prizeMoneyWon" AS prize_money_won,
  res."splitTime" AS split_time,res.sectionals,res."gpsData" AS gps_data,
  res."sourceProvider" AS source_provider,res."sourceId" AS provider_source_id,
  res."sourceRawJson" AS source_raw_json,res."lastSyncedAt" AS last_synced_at,
  res."createdAt" AS created_at,20 AS priority
FROM _giq_history_stage."r2_Result" res
JOIN _giq_history_stage.runner_map rm ON rm.source_name='r2' AND rm.source_id=res."runnerId"
JOIN _giq_history_stage.normalized_runner nr ON nr.target_id=rm.target_id
UNION ALL
SELECT
  'export',e.payload->>'naturalKey',rm.natural_key || ':result',rm.target_id,nr.race_id,
  (e.payload->>'finishingPosition')::integer,(e.payload->>'runningTime')::double precision,
  (e.payload->>'margin')::double precision,(e.payload->>'prizeMoneyWon')::double precision,
  (e.payload->>'splitTime')::double precision,(e.payload->'sectionals')::text,NULL,
  'thedogs',e.payload->>'sourceId',e.payload::text,NULL,clock_timestamp(),10
FROM _giq_history_stage.export_results e
JOIN _giq_history_stage.runner_map rm ON rm.source_name='export' AND rm.source_id=e.payload->>'runnerNaturalKey'
JOIN _giq_history_stage.normalized_runner nr ON nr.target_id=rm.target_id;

CREATE INDEX result_source_natural_key_idx ON _giq_history_stage.result_source(natural_key);

WITH preferred AS (
  SELECT DISTINCT ON(natural_key) * FROM _giq_history_stage.result_source
  ORDER BY natural_key,priority DESC,source_name,source_id
), production AS (
  SELECT DISTINCT ON (nr.natural_key || ':result')
    nr.natural_key || ':result' AS natural_key,res.id
  FROM public."Result" res
  JOIN public."Runner" r ON r.id=res."runnerId"
  JOIN public."Race" race ON race.id=r."raceId"
  JOIN public."Meeting" m ON m.id=race."meetingId"
  JOIN public."Track" t ON t.id=m."trackId"
  JOIN _giq_history_stage.normalized_runner nr
    ON nr.natural_key=_giq_history_merge.track_key(t.name,t.state) || ':meeting:' ||
      to_char(m."meetingDate" AT TIME ZONE 'UTC','YYYY-MM-DD') || ':race:' ||

      race."raceNumber" || ':runner:box:' || r."boxNumber"
  WHERE coalesce(lower(m."sourceProvider"),'') NOT IN ('demo','greyhoundiq-demo')
  ORDER BY nr.natural_key || ':result', res.id
)
INSERT INTO _giq_history_stage.normalized_result
SELECT p.natural_key,coalesce(prod.id,_giq_history_merge.history_id('result',p.natural_key)),
  p.runner_id,p.race_id,p.finishing_position,p.running_time,p.margin,p.prize_money_won,
  p.split_time,p.sectionals,p.gps_data,p.source_provider,p.provider_source_id,p.source_raw_json,
  p.last_synced_at,p.created_at,
  jsonb_build_object('sources',(
    SELECT jsonb_agg(jsonb_build_object('source',s.source_name,'id',s.source_id)
                     ORDER BY s.source_name,s.source_id)
    FROM _giq_history_stage.result_source s WHERE s.natural_key=p.natural_key
  ))
FROM preferred p LEFT JOIN production prod USING(natural_key);

CREATE TABLE _giq_history_stage.result_map (
  source_name text NOT NULL,
  source_id text NOT NULL,
  natural_key text NOT NULL REFERENCES _giq_history_stage.normalized_result(natural_key),
  target_id text NOT NULL,
  PRIMARY KEY(source_name,source_id)
);
INSERT INTO _giq_history_stage.result_map
SELECT s.source_name,s.source_id,s.natural_key,n.target_id
FROM _giq_history_stage.result_source s
JOIN _giq_history_stage.normalized_result n USING(natural_key);

DO $$
DECLARE
  export_profiles_mapped bigint;
  export_meetings_sourced bigint;
  export_meetings_mapped bigint;
  export_races_sourced bigint;
  export_races_mapped bigint;
  export_runners_sourced bigint;
  export_runners_mapped bigint;
  export_results_sourced bigint;
  export_results_mapped bigint;
  unmapped_export_rows bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM _giq_history_stage.dog_map WHERE source_name='profile'),
    (SELECT count(*) FROM _giq_history_stage.meeting_source WHERE source_name='export'),
    (SELECT count(*) FROM _giq_history_stage.meeting_map WHERE source_name='export'),
    (SELECT count(*) FROM _giq_history_stage.race_source WHERE source_name='export'),
    (SELECT count(*) FROM _giq_history_stage.race_map WHERE source_name='export'),
    (SELECT count(*) FROM _giq_history_stage.runner_source WHERE source_name='export'),
    (SELECT count(*) FROM _giq_history_stage.runner_map WHERE source_name='export'),
    (SELECT count(*) FROM _giq_history_stage.result_source WHERE source_name='export'),
    (SELECT count(*) FROM _giq_history_stage.result_map WHERE source_name='export')
  INTO export_profiles_mapped,
       export_meetings_sourced,export_meetings_mapped,
       export_races_sourced,export_races_mapped,
       export_runners_sourced,export_runners_mapped,
       export_results_sourced,export_results_mapped;

  IF (
    export_profiles_mapped,
    export_meetings_sourced,export_meetings_mapped,
    export_races_sourced,export_races_mapped,
    export_runners_sourced,export_runners_mapped,
    export_results_sourced,export_results_mapped
  ) <> (
    170780::bigint,
    76620::bigint,76620::bigint,
    838526::bigint,838526::bigint,
    6434145::bigint,6434145::bigint,
    5660837::bigint,5660837::bigint
  ) THEN
    RAISE EXCEPTION
      'export graph conservation failed: profiles %, meetings source/map %/%, races source/map %/%, runners source/map %/%, results source/map %/%',
      export_profiles_mapped,
      export_meetings_sourced,export_meetings_mapped,
      export_races_sourced,export_races_mapped,
      export_runners_sourced,export_runners_mapped,
      export_results_sourced,export_results_mapped;
  END IF;

  SELECT count(*) INTO unmapped_export_rows
  FROM (
    SELECT p.source_file,p.line_number
    FROM _giq_history_stage.export_profiles p
    LEFT JOIN _giq_history_stage.dog_map mapped
      ON mapped.source_name='profile' AND mapped.source_id=p.payload->>'naturalKey'
    WHERE mapped.source_id IS NULL
    UNION ALL
    SELECT meeting.source_file,meeting.line_number
    FROM _giq_history_stage.export_meetings meeting
    LEFT JOIN _giq_history_stage.meeting_map mapped
      ON mapped.source_name='export' AND mapped.source_id=meeting.payload->>'naturalKey'
    WHERE mapped.source_id IS NULL
    UNION ALL
    SELECT race.source_file,race.line_number
    FROM _giq_history_stage.export_races race
    LEFT JOIN _giq_history_stage.race_map mapped
      ON mapped.source_name='export' AND mapped.source_id=race.payload->>'naturalKey'
    WHERE mapped.source_id IS NULL
    UNION ALL
    SELECT runner.source_file,runner.line_number
    FROM _giq_history_stage.export_runners runner
    LEFT JOIN _giq_history_stage.runner_map mapped
      ON mapped.source_name='export' AND mapped.source_id=runner.payload->>'naturalKey'
    WHERE mapped.source_id IS NULL
    UNION ALL
    SELECT result.source_file,result.line_number
    FROM _giq_history_stage.export_results result
    LEFT JOIN _giq_history_stage.result_map mapped
      ON mapped.source_name='export' AND mapped.source_id=result.payload->>'naturalKey'
    WHERE mapped.source_id IS NULL
  ) gap;
  IF unmapped_export_rows<>0 THEN
    RAISE EXCEPTION 'export graph anti-join conservation failed: % unmapped source rows',
      unmapped_export_rows;
  END IF;
END
$$;


CREATE TABLE _giq_history_stage.profile_form_resolution (
  source_file text NOT NULL,
  line_number bigint NOT NULL,
  payload jsonb NOT NULL,
  url_class text NOT NULL,
  dog_id text,
  race_id text,
  race_natural_key text,
  candidate_count integer NOT NULL,
  disposition text NOT NULL,
  PRIMARY KEY(source_file,line_number)
);

CREATE TABLE _giq_history_stage.race_lookup AS
SELECT
  _giq_history_merge.slug(t.name) AS track_slug,
  (m.meeting_date AT TIME ZONE 'UTC')::date AS meeting_date,
  r.race_number,
  r.natural_key,
  r.target_id,
  r.distance
FROM _giq_history_stage.normalized_race r
JOIN _giq_history_stage.normalized_meeting m ON m.target_id=r.meeting_id
JOIN _giq_history_stage.normalized_track t ON t.target_id=m.track_id;
CREATE INDEX race_lookup_exact_idx
  ON _giq_history_stage.race_lookup(track_slug,meeting_date,race_number);

WITH parsed AS MATERIALIZED (
  SELECT
    e.source_file,e.line_number,e.payload,
    dm.target_id AS dog_id,
    CASE
      WHEN coalesce(e.payload->>'raceUrl',e.payload->>'sourceId') ~ '^/racing/[^/]+/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9]+(?:/[^?]*)?(?:\?.*)?$'
        THEN 'canonical-racing-url'
      WHEN coalesce(e.payload->>'raceUrl',e.payload->>'sourceId') ~ '^/dogs/[0-9]+(?:/[^?]*)?(?:\?.*)?$'
        THEN 'dog-url-recovery-only'
      ELSE 'invalid-url'
    END AS url_class,
    regexp_match(coalesce(e.payload->>'raceUrl',e.payload->>'sourceId'),
      '^/racing/([^/]+)/([0-9]{4}-[0-9]{2}-[0-9]{2})/([0-9]+)(?:/[^?]*)?(?:\?.*)?$') AS race_parts
  FROM _giq_history_stage.export_profile_forms e
  LEFT JOIN _giq_history_stage.dog_map dm
    ON dm.source_name='profile' AND dm.source_id=e.payload->>'dogNaturalKey'
), canonical_candidates AS MATERIALIZED (
  SELECT
    p.source_file,p.line_number,
    count(l.*)::integer AS candidate_count,
    min(l.target_id) AS race_id,
    min(l.natural_key) AS race_natural_key
  FROM parsed p
  LEFT JOIN _giq_history_stage.race_lookup l
    ON p.url_class='canonical-racing-url'
   AND l.track_slug=_giq_history_merge.slug(p.race_parts[1])
   AND l.meeting_date=p.race_parts[2]::date
   AND l.race_number=p.race_parts[3]::integer
  WHERE p.url_class='canonical-racing-url'
  GROUP BY p.source_file,p.line_number
), dog_candidates AS MATERIALIZED (
  SELECT
    p.source_file,p.line_number,
    count(*)::integer AS candidate_count,
    min(r.target_id) AS race_id,
    min(r.natural_key) AS race_natural_key
  FROM parsed p
  JOIN _giq_history_stage.normalized_runner runner
    ON p.url_class='dog-url-recovery-only'
   AND p.dog_id IS NOT NULL
   AND runner.dog_id=p.dog_id
   AND runner.box_number=(p.payload->>'boxNumber')::integer
  JOIN _giq_history_stage.normalized_race r
    ON r.target_id=runner.race_id
   AND r.distance=(p.payload->>'distance')::integer
  JOIN _giq_history_stage.normalized_meeting m ON m.target_id=r.meeting_id
  JOIN _giq_history_stage.normalized_track t
    ON t.target_id=m.track_id
   AND _giq_history_merge.slug(t.name)=_giq_history_merge.slug(p.payload->>'trackCode')
  JOIN _giq_history_stage.normalized_result result
    ON result.runner_id=runner.target_id
   AND result.finishing_position=(p.payload->>'finishingPosition')::integer
   AND result.running_time=(p.payload->>'runningTime')::double precision
  WHERE p.url_class='dog-url-recovery-only'
    AND nullif(p.payload->>'boxNumber','') IS NOT NULL
    AND nullif(p.payload->>'distance','') IS NOT NULL
    AND nullif(p.payload->>'finishingPosition','') IS NOT NULL
    AND nullif(p.payload->>'runningTime','') IS NOT NULL
    AND (m.meeting_date AT TIME ZONE 'UTC')::date=(p.payload->>'date')::timestamptz::date
  GROUP BY p.source_file,p.line_number
)
INSERT INTO _giq_history_stage.profile_form_resolution
SELECT
  p.source_file,p.line_number,p.payload,p.url_class,p.dog_id,
  CASE WHEN coalesce(c.candidate_count,d.candidate_count,0)=1 THEN coalesce(c.race_id,d.race_id) END,
  CASE WHEN coalesce(c.candidate_count,d.candidate_count,0)=1 THEN coalesce(c.race_natural_key,d.race_natural_key) END,
  coalesce(c.candidate_count,d.candidate_count,0),
  CASE
    WHEN p.dog_id IS NULL THEN 'quarantined-dog-unresolved'
    WHEN coalesce(c.candidate_count,d.candidate_count,0)=1 AND p.url_class='canonical-racing-url'
      THEN 'verified-canonical-race-url'
    WHEN coalesce(c.candidate_count,d.candidate_count,0)>1 THEN 'quarantined-ambiguous-race'
    WHEN p.url_class='canonical-racing-url'
      THEN 'preserved-provider-racing-url-without-canonical-race'
    WHEN p.url_class='dog-url-recovery-only' AND coalesce(d.candidate_count,0)=1
      THEN 'quarantined-dog-url-exact-recovery-evidence'
    WHEN p.url_class='dog-url-recovery-only' THEN 'quarantined-dog-url-non-race-link'
    WHEN p.url_class='invalid-url' THEN 'quarantined-invalid-url'
    ELSE 'quarantined-unresolved-race'
  END
FROM parsed p
LEFT JOIN canonical_candidates c USING(source_file,line_number)
LEFT JOIN dog_candidates d USING(source_file,line_number);

CREATE INDEX profile_form_resolution_race_idx
  ON _giq_history_stage.profile_form_resolution(race_id);
CREATE INDEX profile_form_resolution_dog_idx
  ON _giq_history_stage.profile_form_resolution(dog_id);

DO $$
DECLARE
  total bigint;
  canonical_count bigint;
  dog_url_count bigint;
  canonical_linked bigint;
  canonical_unlinked bigint;
  temora_slugless bigint;
BEGIN
  SELECT count(*),
         count(*) FILTER(WHERE url_class='canonical-racing-url'),
         count(*) FILTER(WHERE url_class='dog-url-recovery-only')
  INTO total,canonical_count,dog_url_count
  FROM _giq_history_stage.profile_form_resolution;
  IF (total,canonical_count,dog_url_count) <> (6218839::bigint,5904337::bigint,314502::bigint) THEN
    RAISE EXCEPTION 'profile-form URL partition changed: total %, canonical %, dog-url %',
      total,canonical_count,dog_url_count;
  END IF;
  SELECT count(*) FILTER(WHERE disposition='verified-canonical-race-url'),
         count(*) FILTER(WHERE disposition='preserved-provider-racing-url-without-canonical-race')
  INTO canonical_linked,canonical_unlinked
  FROM _giq_history_stage.profile_form_resolution;
  IF (canonical_linked,canonical_unlinked)<>(5459480::bigint,444857::bigint) THEN
    RAISE EXCEPTION 'canonical profile-form linked/unlinked partition changed: linked %, unlinked %',
      canonical_linked,canonical_unlinked;
  END IF;
  SELECT count(*) INTO temora_slugless
  FROM _giq_history_stage.profile_form_resolution
  WHERE payload->>'sourceId'='/racing/temora/2008-10-19/3?trial=false'
    AND payload->>'raceUrl'='/racing/temora/2008-10-19/3/?trial=false';
  IF temora_slugless <> 8 THEN
    RAISE EXCEPTION 'Temora slugless normalization contract changed: %',temora_slugless;
  END IF;
END
$$;

INSERT INTO _giq_history_merge.quarantine
  (source_name,entity_type,source_key,reason_code,disposition,blocking,evidence)
SELECT
  'normalized-export','profile-form',source_file || ':' || line_number,
  disposition,disposition,false,
  jsonb_build_object(
    'naturalKey',payload->>'naturalKey',
    'urlClass',url_class,
    'candidateCount',candidate_count,
    'sourceArchiveKey',payload->>'sourceArchiveKey'
  )
FROM _giq_history_stage.profile_form_resolution
WHERE disposition LIKE 'quarantined-%'

ON CONFLICT DO NOTHING;

CREATE TABLE _giq_history_stage.normalized_profile_form (
  natural_key text PRIMARY KEY,
  target_id text NOT NULL UNIQUE,
  dog_id text NOT NULL,
  source_provider text NOT NULL,

  source_id text NOT NULL,
  race_url text NOT NULL,
  date timestamptz NOT NULL,
  track_code text,
  track_name text,
  race_name text,
  finish_text text,
  finishing_position integer,
  starters integer,
  box_number integer,
  weight double precision,
  distance integer,
  grade text,
  running_time double precision,
  winner_time double precision,
  best_of_night_time double precision,
  first_sectional double precision,
  margin double precision,
  winner_dog_name text,
  winner_dog_source_id text,
  in_running_positions text,
  starting_price double precision,
  has_video boolean NOT NULL,
  source_raw_json text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  resolved_race_id text,
  resolution text NOT NULL
);

WITH ready AS (
  SELECT
    f.*,
    regexp_match(coalesce(payload->>'raceUrl',payload->>'sourceId'),
      '^/racing/([^/]+)/([0-9]{4}-[0-9]{2}-[0-9]{2})/([0-9]+)(?:/[^?]*)?(?:\?.*)?$') AS canonical_parts,
    CASE WHEN url_class='dog-url-recovery-only'
      THEN (payload->>'sourceId') || '#' || to_char((payload->>'date')::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD') ||
           '#' || _giq_history_merge.slug(payload->>'trackCode') || '#box-' || coalesce(payload->>'boxNumber','unknown')
      ELSE payload->>'sourceId' END AS canonical_source_id
  FROM _giq_history_stage.profile_form_resolution f
  WHERE dog_id IS NOT NULL
    AND url_class='canonical-racing-url'
    AND disposition IN (
      'verified-canonical-race-url',
      'preserved-provider-racing-url-without-canonical-race'
    )
), deduped AS (
  SELECT *,row_number() OVER(
    PARTITION BY dog_id,canonical_source_id
    ORDER BY CASE disposition
      WHEN 'verified-canonical-race-url' THEN 1 ELSE 2 END,
      source_file,line_number
  ) AS selection_rank
  FROM ready
), production AS (
  SELECT "dogId",lower("sourceProvider") AS provider,"sourceId",id
  FROM public."DogProfileForm"
)
INSERT INTO _giq_history_stage.normalized_profile_form
SELECT
  'thedogs:profile-form:' || d.dog_id || ':' || d.canonical_source_id,
  coalesce(p.id,_giq_history_merge.history_id('profileform',d.dog_id || ':' || d.canonical_source_id)),
  d.dog_id,'thedogs',d.canonical_source_id,
  CASE WHEN race.target_id IS NOT NULL THEN
    '/racing/' || _giq_history_merge.slug(track.name) || '/' ||
      to_char(meeting.meeting_date AT TIME ZONE 'UTC','YYYY-MM-DD') || '/' || race.race_number || '/'
    ELSE '/racing/' || _giq_history_merge.slug(d.canonical_parts[1]) || '/' ||
      d.canonical_parts[2] || '/' || d.canonical_parts[3]::integer || '/'
  END,
  (d.payload->>'date')::timestamptz,d.payload->>'trackCode',coalesce(track.name,d.payload->>'trackName'),
  d.payload->>'raceName',d.payload->>'finishText',(d.payload->>'finishingPosition')::integer,
  (d.payload->>'starters')::integer,(d.payload->>'boxNumber')::integer,
  (d.payload->>'weight')::double precision,(d.payload->>'distance')::integer,
  d.payload->>'grade',(d.payload->>'runningTime')::double precision,
  (d.payload->>'winnerTime')::double precision,(d.payload->>'bestOfNightTime')::double precision,
  (d.payload->>'firstSectional')::double precision,(d.payload->>'margin')::double precision,
  d.payload->>'winnerDogName',d.payload->>'winnerDogSourceId',d.payload->>'inRunningPositions',
  (d.payload->>'startingPrice')::double precision,
  coalesce((d.payload->>'hasVideo')::boolean,false),d.payload::text,
  clock_timestamp(),clock_timestamp(),d.race_id,d.disposition
FROM deduped d
LEFT JOIN _giq_history_stage.normalized_race race ON race.target_id=d.race_id
LEFT JOIN _giq_history_stage.normalized_meeting meeting ON meeting.target_id=race.meeting_id
LEFT JOIN _giq_history_stage.normalized_track track ON track.target_id=meeting.track_id
LEFT JOIN production p
  ON p."dogId"=d.dog_id AND p.provider='thedogs' AND p."sourceId"=d.canonical_source_id
WHERE d.selection_rank=1;

DO $$
DECLARE
  bad_urls bigint;
  mismatched_urls bigint;
  temora_rows bigint;
  invalid_shape bigint;
BEGIN
  SELECT count(*) INTO bad_urls
  FROM _giq_history_stage.normalized_profile_form
  WHERE race_url ~ '^/dogs/';
  IF bad_urls<>0 THEN
    RAISE EXCEPTION 'normalized DogProfileForm retains % dog-shaped race URLs',bad_urls;
  END IF;
  SELECT count(*) INTO invalid_shape
  FROM _giq_history_stage.normalized_profile_form
  WHERE race_url !~ '^/racing/[a-z0-9]+(?:-[a-z0-9]+)*/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9]+/$';
  IF invalid_shape<>0 THEN
    RAISE EXCEPTION 'normalized DogProfileForm has % non-canonical racing URL shapes',invalid_shape;
  END IF;

  SELECT count(*) INTO mismatched_urls
  FROM _giq_history_stage.normalized_profile_form f
  JOIN _giq_history_stage.normalized_race r ON r.target_id=f.resolved_race_id
  JOIN _giq_history_stage.normalized_meeting m ON m.target_id=r.meeting_id
  JOIN _giq_history_stage.normalized_track t ON t.target_id=m.track_id
  WHERE f.resolved_race_id IS NOT NULL
    AND f.race_url <> '/racing/' || _giq_history_merge.slug(t.name) || '/' ||
    to_char(m.meeting_date AT TIME ZONE 'UTC','YYYY-MM-DD') || '/' || r.race_number || '/';
  IF mismatched_urls<>0 THEN
    RAISE EXCEPTION '% resolved profile-form URLs disagree with their canonical race',mismatched_urls;
  END IF;

  SELECT count(*) INTO temora_rows
  FROM _giq_history_stage.normalized_profile_form
  WHERE _giq_history_merge.try_jsonb(source_raw_json)->>'sourceId'=
      '/racing/temora/2008-10-19/3?trial=false'
    AND race_url='/racing/temora/2008-10-19/3/';
  IF temora_rows<>8 THEN
    RAISE EXCEPTION 'Temora canonical profile-form URL mapping changed: %',temora_rows;
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.normalized_form_entry (
  natural_key text PRIMARY KEY,
  target_id text NOT NULL UNIQUE,
  dog_id text NOT NULL,
  race_id text NOT NULL,
  track_id text,
  date timestamptz NOT NULL,
  box_number integer,
  finish integer,
  time double precision,
  distance integer,
  grade text,
  weight double precision,
  created_at timestamptz NOT NULL,
  source_provenance jsonb NOT NULL
);

WITH r2 AS MATERIALIZED (
  SELECT
    dm.target_id AS dog_id,rm.target_id AS race_id,tm.target_id AS track_id,
    f.date,f."boxNumber" AS box_number,f.finish,f.time,f.distance,f.grade,f.weight,
    f."createdAt" AS created_at,'r2:' || f.id AS source_key,20 AS priority
  FROM _giq_history_stage."r2_FormEntry" f
  JOIN _giq_history_stage.dog_map dm ON dm.source_name='r2' AND dm.source_id=f."dogId"
  JOIN _giq_history_stage.race_map rm ON rm.source_name='r2' AND rm.source_id=f."raceId"
  LEFT JOIN _giq_history_stage.track_map tm ON tm.source_name='r2' AND tm.source_id=f."trackId"
), export AS MATERIALIZED (
  SELECT
    p.dog_id,p.resolved_race_id AS race_id,m.track_id,p.date,p.box_number,
    p.finishing_position AS finish,p.running_time AS time,p.distance,p.grade,p.weight,
    p.created_at,'export:' || p.natural_key AS source_key,10 AS priority
  FROM _giq_history_stage.normalized_profile_form p
  JOIN _giq_history_stage.normalized_race r ON r.target_id=p.resolved_race_id
  JOIN _giq_history_stage.normalized_meeting m ON m.target_id=r.meeting_id
  UNION ALL
  SELECT
    p.dog_id,p.race_id,m.track_id,(p.payload->>'date')::timestamptz,
    (p.payload->>'boxNumber')::integer,(p.payload->>'finishingPosition')::integer,
    (p.payload->>'runningTime')::double precision,(p.payload->>'distance')::integer,
    p.payload->>'grade',(p.payload->>'weight')::double precision,clock_timestamp(),
    'export-dog-url-recovery:' || p.source_file || ':' || p.line_number,10
  FROM _giq_history_stage.profile_form_resolution p
  JOIN _giq_history_stage.normalized_race r ON r.target_id=p.race_id
  JOIN _giq_history_stage.normalized_meeting m ON m.target_id=r.meeting_id
  WHERE p.url_class='dog-url-recovery-only'
    AND p.candidate_count=1
    AND p.dog_id IS NOT NULL
), source AS (
  SELECT * FROM r2 UNION ALL SELECT * FROM export
), preferred AS (
  SELECT DISTINCT ON(dog_id,race_id) * FROM source
  ORDER BY dog_id,race_id,priority DESC,source_key
), production AS (
  SELECT "dogId","raceId",id FROM public."FormEntry" WHERE "raceId" IS NOT NULL
)
INSERT INTO _giq_history_stage.normalized_form_entry
SELECT
  'form:' || p.dog_id || ':' || p.race_id,
  coalesce(prod.id,_giq_history_merge.history_id('form',p.dog_id || ':' || p.race_id)),
  p.dog_id,p.race_id,p.track_id,p.date,p.box_number,p.finish,p.time,p.distance,p.grade,p.weight,
  p.created_at,jsonb_build_object('sources',(

    SELECT jsonb_agg(source_key ORDER BY source_key)
    FROM source s WHERE s.dog_id=p.dog_id AND s.race_id=p.race_id
  ))
FROM preferred p
LEFT JOIN production prod ON prod."dogId"=p.dog_id AND prod."raceId"=p.race_id;

CREATE TABLE _giq_history_stage.media_resolution (
  source_file text NOT NULL,
  line_number bigint NOT NULL,
  payload jsonb NOT NULL,
  race_id text,
  media_class text NOT NULL,
  provider_media_id text,

  disposition text NOT NULL,
  PRIMARY KEY(source_file,line_number)
);

WITH classified AS (
  SELECT
    e.*,
    rm.target_id AS race_id,
    CASE
      WHEN e.payload->>'kind'='photo-finish'
       AND e.payload->>'sourceId' ~ '^/attachments/[A-Za-z0-9][A-Za-z0-9_./%?=&+-]*$'
       AND e.payload->>'sourceId' !~ '(^|/)\.\.(/|$)'
       AND e.payload->>'sourceId' !~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=)'
        THEN 'photo-finish-attachment'
      WHEN e.payload->>'kind'='replay'
       AND e.payload->>'sourceId' ~ '^/videos/watch/races/[0-9]+/replay$'
        THEN 'race-replay'
      WHEN e.payload->>'kind'='replay'
       AND e.payload->>'sourceId' ~ '^/videos/watch/meetings/[0-9]+/preview$'
        THEN 'meeting-preview'
      WHEN e.payload->>'kind'='replay'
       AND e.payload->>'sourceId' ~ '^/videos/watch/live-meeting/[0-9]+$'
        THEN 'live-meeting'
      WHEN e.payload->>'kind'='replay'
       AND e.payload->>'sourceId' ~ '^/videos/watch/races/[0-9]+/preview$'
        THEN 'race-preview'
      ELSE 'unrecognized-provider-path'
    END AS media_class,
    substring(e.payload->>'sourceId' FROM '^/videos/watch/races/([0-9]+)/replay$') AS provider_media_id
  FROM _giq_history_stage.export_race_media e
  LEFT JOIN _giq_history_stage.race_map rm
    ON rm.source_name='export' AND rm.source_id=e.payload->>'raceNaturalKey'
)
INSERT INTO _giq_history_stage.media_resolution
SELECT
  source_file,line_number,payload,race_id,media_class,provider_media_id,
  CASE
    WHEN race_id IS NULL THEN 'quarantined-race-unresolved'
    WHEN media_class='race-replay' AND provider_media_id IN (
      SELECT collision.provider_media_id
      FROM classified collision
      WHERE collision.media_class='race-replay' AND collision.race_id IS NOT NULL
      GROUP BY collision.provider_media_id
      HAVING count(DISTINCT collision.race_id)>1
    ) THEN 'quarantined-provider-id-race-conflict'
    WHEN media_class='race-replay' THEN 'eligible-race-replay'
    WHEN media_class='photo-finish-attachment' THEN 'eligible-photo-finish'
    WHEN media_class IN ('meeting-preview','live-meeting','race-preview')
      THEN 'quarantined-shared-or-preview-media'
    ELSE 'quarantined-unrecognized-provider-path'
  END
FROM classified;

DO $$
DECLARE
  total bigint;
  replay bigint;
  photo bigint;
  race_replay bigint;
  meeting_preview bigint;
  live_meeting bigint;
  race_preview bigint;
  conflicting_rows bigint;
  unique_replay_ids bigint;
  unique_race_ids bigint;
BEGIN
  SELECT count(*),
    count(*) FILTER(WHERE payload->>'kind'='replay'),
    count(*) FILTER(WHERE payload->>'kind'='photo-finish'),
    count(*) FILTER(WHERE media_class='race-replay'),
    count(*) FILTER(WHERE media_class='meeting-preview'),
    count(*) FILTER(WHERE media_class='live-meeting'),
    count(*) FILTER(WHERE media_class='race-preview'),
    count(*) FILTER(WHERE disposition='quarantined-provider-id-race-conflict'),
    count(DISTINCT payload->>'sourceId') FILTER(WHERE payload->>'kind'='replay'),
    count(DISTINCT payload->>'sourceId') FILTER(WHERE media_class='race-replay')
  INTO total,replay,photo,race_replay,meeting_preview,live_meeting,race_preview,
       conflicting_rows,unique_replay_ids,unique_race_ids
  FROM _giq_history_stage.media_resolution;
  IF (total,replay,photo,race_replay,meeting_preview,live_meeting,race_preview,
      conflicting_rows,unique_replay_ids,unique_race_ids) <>
     (538849::bigint,290771::bigint,248078::bigint,289718::bigint,900::bigint,
      117::bigint,36::bigint,22::bigint,290058::bigint,289707::bigint) THEN
    RAISE EXCEPTION 'race-media taxonomy changed';
  END IF;
  IF (SELECT count(DISTINCT payload->>'sourceId') FROM _giq_history_stage.media_resolution
      WHERE media_class='photo-finish-attachment') <> 248078 THEN
    RAISE EXCEPTION 'photo-finish provider identities are no longer one-to-one';
  END IF;
  IF (SELECT count(*) FROM public."RaceVideo") <>
     (SELECT row_count FROM _giq_history_merge.snapshot_table_manifest WHERE table_name='RaceVideo') THEN
    RAISE EXCEPTION 'production RaceVideo baseline changed inside the isolated candidate';
  END IF;
END
$$;

WITH ranked AS (
  SELECT *,
    count(*) OVER(PARTITION BY race_id) AS per_race,
    row_number() OVER(PARTITION BY race_id ORDER BY provider_media_id,source_file,line_number) AS rank
  FROM _giq_history_stage.media_resolution
  WHERE disposition='eligible-race-replay'
)
UPDATE _giq_history_stage.media_resolution target
SET disposition='quarantined-multiple-race-replays'
FROM ranked r
WHERE target.source_file=r.source_file AND target.line_number=r.line_number
  AND r.per_race>1;

DO $$
DECLARE
  multiple_replay_races bigint;
BEGIN
  SELECT count(*) INTO multiple_replay_races
  FROM (
    SELECT race_id
    FROM _giq_history_stage.media_resolution
    WHERE disposition='eligible-race-replay'
    GROUP BY race_id HAVING count(*)>1
  ) duplicates;
  IF multiple_replay_races<>0 THEN
    RAISE EXCEPTION '% races retain multiple eligible historical replays',multiple_replay_races;
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.normalized_race_video (
  natural_key text PRIMARY KEY,
  target_id text NOT NULL UNIQUE,
  race_id text NOT NULL,
  source_provider text NOT NULL,
  source_id text NOT NULL,
  kind text NOT NULL,
  page_url text NOT NULL,
  embed_source_type text,
  source_raw_json text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

WITH production AS (
  SELECT "raceId",lower("sourceProvider") AS provider,kind,id
  FROM public."RaceVideo"
)
INSERT INTO _giq_history_stage.normalized_race_video
SELECT
  'race-video:' || m.race_id || ':thedogs:replay',
  coalesce(p.id,_giq_history_merge.history_id('video',m.race_id || ':thedogs:replay')),
  m.race_id,'thedogs',m.provider_media_id,'replay',
  'https://www.thedogs.com.au' || (m.payload->>'sourceId'),
  'race-replay',m.payload::text,clock_timestamp(),clock_timestamp()
FROM _giq_history_stage.media_resolution m
LEFT JOIN production p ON p."raceId"=m.race_id AND p.provider='thedogs' AND p.kind='replay'
WHERE m.disposition='eligible-race-replay';

CREATE TABLE _giq_history_stage.normalized_photo_finish AS
WITH ranked AS (
  SELECT *,count(*) OVER(PARTITION BY race_id) AS per_race
  FROM _giq_history_stage.media_resolution
  WHERE disposition='eligible-photo-finish'
)
SELECT
  race_id,
  'https://www.thedogs.com.au' || (payload->>'sourceId') AS photo_finish_url,
  payload->>'sourceId' AS source_id
FROM ranked

WHERE per_race=1;
CREATE UNIQUE INDEX normalized_photo_finish_race_key
  ON _giq_history_stage.normalized_photo_finish(race_id);

WITH ranked AS (
  SELECT source_file,line_number,count(*) OVER(PARTITION BY race_id) AS per_race
  FROM _giq_history_stage.media_resolution
  WHERE disposition='eligible-photo-finish'
)
UPDATE _giq_history_stage.media_resolution target
SET disposition='quarantined-multiple-photo-finishes'
FROM ranked r
WHERE target.source_file=r.source_file AND target.line_number=r.line_number
  AND r.per_race>1;

INSERT INTO _giq_history_merge.quarantine
  (source_name,entity_type,source_key,reason_code,disposition,blocking,evidence)
SELECT
  'normalized-export','race-media',source_file || ':' || line_number,
  disposition,disposition,false,
  jsonb_build_object('kind',payload->>'kind','sourceId',payload->>'sourceId',
                     'raceNaturalKey',payload->>'raceNaturalKey','class',media_class)
FROM _giq_history_stage.media_resolution
WHERE disposition LIKE 'quarantined-%'
ON CONFLICT DO NOTHING;

CREATE TABLE _giq_history_stage.normalized_pedigree_edge (
  natural_key text PRIMARY KEY,
  child_id text NOT NULL,
  parent_id text NOT NULL,
  relationship text NOT NULL,
  parent_name text NOT NULL,
  source_provider text NOT NULL,
  source_archive_key text,
  self_parent boolean NOT NULL,

  duplicate_rank integer NOT NULL,
  canonical_eligible boolean NOT NULL,
  payload jsonb NOT NULL
);

WITH resolved AS (
  SELECT
    e.payload->>'naturalKey' AS natural_key,
    child.target_id AS child_id,parent.target_id AS parent_id,
    e.payload->>'relation' AS relationship,e.payload->>'parentName' AS parent_name,
    e.payload->>'sourceArchiveKey' AS source_archive_key,e.payload,
    (child.target_id=parent.target_id) AS self_parent,
    row_number() OVER(PARTITION BY child.target_id,e.payload->>'relation'
                      ORDER BY e.source_file,e.line_number) AS duplicate_rank
  FROM _giq_history_stage.export_pedigree_edges e
  JOIN _giq_history_stage.dog_map child
    ON child.source_name='profile' AND child.source_id=e.payload->>'childNaturalKey'
  JOIN _giq_history_stage.dog_map parent
    ON parent.source_name='pedigree-parent' AND parent.source_id=e.payload->>'parentNaturalKey'
)
INSERT INTO _giq_history_stage.normalized_pedigree_edge
SELECT natural_key,child_id,parent_id,relationship,parent_name,'thedogs',source_archive_key,
       self_parent,duplicate_rank,(NOT self_parent AND duplicate_rank=1),payload
FROM resolved;

DO $$
DECLARE
  staged bigint;
  self_rows bigint;
  duplicate_rows bigint;
BEGIN
  SELECT count(*),count(*) FILTER(WHERE self_parent),
         count(*) FILTER(WHERE duplicate_rank>1)
  INTO staged,self_rows,duplicate_rows
  FROM _giq_history_stage.normalized_pedigree_edge;
  IF staged<>328069 OR self_rows<>16 OR duplicate_rows<>0 THEN
    RAISE EXCEPTION 'TheDogs pedigree partition changed: staged %, self %, duplicate %',
      staged,self_rows,duplicate_rows;
  END IF;
END
$$;

INSERT INTO _giq_history_merge.quarantine
  (source_name,entity_type,source_key,reason_code,disposition,blocking,evidence)
SELECT
  'normalized-export','pedigree-edge',natural_key,
  CASE WHEN self_parent THEN 'self-parent' ELSE 'duplicate-child-relationship' END,
  'preserved-as-rejected-pedigree-assertion',false,payload
FROM _giq_history_stage.normalized_pedigree_edge
WHERE NOT canonical_eligible
ON CONFLICT DO NOTHING;

CREATE TABLE _giq_history_stage.thedogs_pedigree_pair AS
SELECT
  child.natural_key AS child_natural_key,
  child.target_id AS child_id,
  _giq_history_merge.slug(child.name) AS normalized_name,
  to_char(child.whelp_date AT TIME ZONE 'UTC','YYYY-MM') AS whelp_month,
  sire.parent_id AS sire_id,
  _giq_history_merge.slug(sire.parent_name) AS sire_name,
  dam.parent_id AS dam_id,
  _giq_history_merge.slug(dam.parent_name) AS dam_name
FROM _giq_history_stage.normalized_dog child
JOIN _giq_history_stage.normalized_pedigree_edge sire
  ON sire.child_id=child.target_id AND sire.relationship='sire' AND sire.canonical_eligible
JOIN _giq_history_stage.normalized_pedigree_edge dam
  ON dam.child_id=child.target_id AND dam.relationship='dam' AND dam.canonical_eligible
WHERE child.natural_key ~ '^thedogs:dog:[0-9]+$'
  AND child.whelp_date IS NOT NULL;
CREATE UNIQUE INDEX thedogs_pedigree_pair_child_key
  ON _giq_history_stage.thedogs_pedigree_pair(child_natural_key);
CREATE INDEX thedogs_pedigree_pair_evidence_idx
  ON _giq_history_stage.thedogs_pedigree_pair(normalized_name,whelp_month,sire_name,dam_name);

CREATE TABLE _giq_history_stage.galtd_exact_crosswalk AS
WITH galtd_pair AS MATERIALIZED (
  SELECT
    o.payload->>'sourceId' AS galtd_source_id,
    _giq_history_merge.slug(o.payload->>'sourceName') AS normalized_name,
    left(o.payload->>'whelpDate',7) AS whelp_month,
    max(_giq_history_merge.slug(a.payload->>'assertedParentName')) FILTER(WHERE a.payload->>'relationship'='sire') AS sire_name,
    max(_giq_history_merge.slug(a.payload->>'assertedParentName')) FILTER(WHERE a.payload->>'relationship'='dam') AS dam_name,
    o.payload->>'conflictGroup' AS conflict_group
  FROM _giq_history_stage.galtd_observation o
  LEFT JOIN _giq_history_stage.galtd_assertion a
    ON a.payload->>'subjectSourceId'=o.payload->>'sourceId'
  GROUP BY o.payload->>'sourceId',o.payload->>'sourceName',o.payload->>'whelpDate',o.payload->>'conflictGroup'
), candidates AS MATERIALIZED (
  SELECT
    g.*,t.child_natural_key,t.child_id,t.sire_id,t.dam_id,
    count(*) OVER(PARTITION BY g.galtd_source_id) AS thedogs_candidates,
    count(*) OVER(PARTITION BY t.child_natural_key) AS galtd_candidates
  FROM galtd_pair g
  JOIN _giq_history_stage.thedogs_pedigree_pair t
    ON t.normalized_name=g.normalized_name
   AND t.whelp_month=g.whelp_month
   AND t.sire_name=g.sire_name
   AND t.dam_name=g.dam_name
  WHERE g.conflict_group IS NULL
    AND g.whelp_month IS NOT NULL
    AND g.sire_name IS NOT NULL
    AND g.dam_name IS NOT NULL
), higher_authority AS (
  SELECT c.*,
    CASE WHEN d.id IS NULL THEN false
      ELSE (d."sireId" IS NOT NULL AND d."sireId"<>c.sire_id)
        OR (d."damId" IS NOT NULL AND d."damId"<>c.dam_id) END AS higher_authority_conflict
  FROM candidates c
  LEFT JOIN public."Dog" d ON d.id=c.child_id
)
SELECT *,
  (thedogs_candidates=1 AND galtd_candidates=1 AND NOT higher_authority_conflict)
    AS provider_retrieval_candidate,
  false AS canonical_eligible,
  CASE
    WHEN higher_authority_conflict THEN 'preserved-production-conflict'
    WHEN thedogs_candidates<>1 OR galtd_candidates<>1
      THEN 'quarantined-ambiguous-composite-match'
    ELSE 'provider-retrieval-required'
  END AS resolution_status
FROM higher_authority;
CREATE INDEX galtd_exact_crosswalk_source_idx
  ON _giq_history_stage.galtd_exact_crosswalk(galtd_source_id);
CREATE UNIQUE INDEX galtd_exact_crosswalk_eligible_source_key
  ON _giq_history_stage.galtd_exact_crosswalk(galtd_source_id)
  WHERE canonical_eligible;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.galtd_exact_crosswalk
    WHERE canonical_eligible
  ) THEN
    RAISE EXCEPTION 'descriptive GALTD/TheDogs composite matching cannot establish canonical identity';
  END IF;
  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.galtd_exact_crosswalk
    WHERE provider_retrieval_candidate
      AND resolution_status<>'provider-retrieval-required'
  ) THEN
    RAISE EXCEPTION 'GALTD provider-retrieval candidate taxonomy is inconsistent';
  END IF;
END
$$;

INSERT INTO _giq_history_merge.quarantine
  (source_name,entity_type,source_key,reason_code,disposition,blocking,evidence)
SELECT
  'galtd','observation',payload->>'sourceId','conflicting-source-observation',
  'provenance-only-no-canonical-promotion',false,payload
FROM _giq_history_stage.galtd_observation
WHERE payload ? 'conflictGroup'
ON CONFLICT DO NOTHING;

CREATE TABLE _giq_history_stage.normalized_dog_profile_archive AS
SELECT
  a.id AS source_id,

  coalesce(existing.id,_giq_history_merge.history_id('dogarchive',lower(a."sourceProvider") || ':' || a."sourceId")) AS target_id,
  archive_dog.target_id AS dog_id,a."sourceProvider" AS source_provider,a."sourceId" AS provider_source_id,
  a."profileUrl" AS profile_url,a."fetchedAt" AS fetched_at,a."showMorePath" AS show_more_path,
  a."candidateJson" AS candidate_json,a."parsedJson" AS parsed_json,
  a."profileHtml" AS profile_html,a."fullFormHtml" AS full_form_html,
  a."createdAt" AS created_at,a."updatedAt" AS updated_at
FROM _giq_history_stage."r2_DogProfileArchive" a
LEFT JOIN _giq_history_stage.dog_identity_source r2_identity
  ON r2_identity.source_name='r2'
 AND r2_identity.natural_key='thedogs:dog:' || a."sourceId"
LEFT JOIN _giq_history_stage.normalized_dog archive_dog
  ON archive_dog.natural_key=r2_identity.natural_key
LEFT JOIN public."DogProfileArchive" existing
  ON lower(existing."sourceProvider")=lower(a."sourceProvider") AND existing."sourceId"=a."sourceId";
CREATE UNIQUE INDEX normalized_dog_profile_archive_source_key
  ON _giq_history_stage.normalized_dog_profile_archive(source_id);

INSERT INTO _giq_history_merge.quarantine
  (source_name,entity_type,source_key,reason_code,disposition,blocking,evidence)
SELECT
  'r2','dog-profile-archive',source_id,'canonical-dog-identity-unavailable',
  'preserved-unlinked-archive',false,
  jsonb_build_object('sourceProvider',source_provider,'sourceId',provider_source_id,
                     'profileUrl',profile_url)
FROM _giq_history_stage.normalized_dog_profile_archive
WHERE dog_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO _giq_history_merge.disposition
  (source_name,issue_type,source_key,disposition_code,canonical_entity_type,canonical_natural_key,evidence)
SELECT
  'r2','dog-profile-archive',source_id,'preserved-unlinked-archive',
  'DogProfileArchive',lower(source_provider) || ':' || provider_source_id,
  jsonb_build_object('canonicalDogId',NULL,'sourceProvider',source_provider,'sourceId',provider_source_id)
FROM _giq_history_stage.normalized_dog_profile_archive
WHERE dog_id IS NULL
ON CONFLICT DO NOTHING;

CREATE TABLE _giq_history_stage.normalized_race_day_archive AS
SELECT
  a.id AS source_id,
  coalesce(existing.id,_giq_history_merge.history_id('dayarchive',lower(a."sourceProvider") || ':' || a.date::text)) AS target_id,
  a."sourceProvider" AS source_provider,a.date,a."fetchedAt" AS fetched_at,a."rawPath" AS raw_path,
  a.meetings,a.races,a.runners,a.results,a.dogs,a.trainers,a."rawJson" AS raw_json,
  a."createdAt" AS created_at,a."updatedAt" AS updated_at
FROM _giq_history_stage."r2_RaceDayArchive" a
LEFT JOIN public."RaceDayArchive" existing
  ON lower(existing."sourceProvider")=lower(a."sourceProvider") AND existing.date=a.date;
CREATE UNIQUE INDEX normalized_race_day_archive_source_key
  ON _giq_history_stage.normalized_race_day_archive(source_id);

INSERT INTO _giq_history_merge.disposition
  (source_name,issue_type,source_key,disposition_code,canonical_entity_type,canonical_natural_key,evidence)
SELECT
  'normalized-export','archive-metadata',e.payload->>'naturalKey','metadata-only-source-preserved',
  CASE e.payload->>'archiveType' WHEN 'dog-profile' THEN 'DogProfileArchive' ELSE 'RaceDayArchive' END,
  e.payload->>'naturalKey',e.payload
FROM _giq_history_stage.export_archives e
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  dog_archives bigint;
  linked_dog_archives bigint;
BEGIN
  SELECT count(*),count(*) FILTER(WHERE dog_id IS NOT NULL)
  INTO dog_archives,linked_dog_archives
  FROM _giq_history_stage.normalized_dog_profile_archive;
  IF dog_archives<>60273 OR linked_dog_archives<>59922 THEN
    RAISE EXCEPTION 'DogProfileArchive mapping changed: total %, linked %',dog_archives,linked_dog_archives;
  END IF;
  IF (SELECT count(*) FROM _giq_history_merge.quarantine
      WHERE source_name='r2' AND entity_type='dog-profile-archive'
        AND disposition='preserved-unlinked-archive')<>351 THEN
    RAISE EXCEPTION 'DogProfileArchive unlinked disposition count changed';
  END IF;
END
$$;

DO $$
DECLARE
  meeting_duplicates bigint;
  race_duplicates bigint;
  production_meeting_duplicates bigint;
  production_race_duplicates bigint;
  real_meetings bigint;
  real_races bigint;
  real_runners bigint;
  real_results bigint;
BEGIN
  SELECT count(*) INTO meeting_duplicates
  FROM (
    SELECT source_name,natural_key FROM _giq_history_stage.meeting_source
    GROUP BY source_name,natural_key HAVING count(*)>1
  ) duplicate;
  SELECT count(*) INTO race_duplicates
  FROM (
    SELECT source_name,natural_key FROM _giq_history_stage.race_source
    GROUP BY source_name,natural_key HAVING count(*)>1
  ) duplicate;
  IF meeting_duplicates<>0 OR race_duplicates<>0 THEN
    RAISE EXCEPTION 'staged natural-key collision: meeting groups %, race groups %',
      meeting_duplicates,race_duplicates;
  END IF;

  SELECT count(*) INTO production_meeting_duplicates
  FROM (
    SELECT _giq_history_merge.track_key(t.name,t.state),
           (m."meetingDate" AT TIME ZONE 'UTC')::date
    FROM public."Meeting" m JOIN public."Track" t ON t.id=m."trackId"
    WHERE lower(btrim(t.name))<>'greyhoundiq demo park'
      AND coalesce(lower(m."sourceProvider"),'') NOT IN ('demo','greyhoundiq-demo')
    GROUP BY _giq_history_merge.track_key(t.name,t.state),
             (m."meetingDate" AT TIME ZONE 'UTC')::date
    HAVING count(*)>1
  ) duplicate;
  SELECT count(*) INTO production_race_duplicates
  FROM (
    SELECT _giq_history_merge.track_key(t.name,t.state),
           (m."meetingDate" AT TIME ZONE 'UTC')::date,r."raceNumber"
    FROM public."Race" r
    JOIN public."Meeting" m ON m.id=r."meetingId"
    JOIN public."Track" t ON t.id=m."trackId"
    WHERE lower(btrim(t.name))<>'greyhoundiq demo park'
      AND coalesce(lower(m."sourceProvider"),'') NOT IN ('demo','greyhoundiq-demo')
    GROUP BY _giq_history_merge.track_key(t.name,t.state),
             (m."meetingDate" AT TIME ZONE 'UTC')::date,r."raceNumber"
    HAVING count(*)>1
  ) duplicate;
  IF production_meeting_duplicates<>0 OR production_race_duplicates<>0 THEN
    RAISE EXCEPTION 'production natural-key collision: meeting groups %, race groups %',
      production_meeting_duplicates,production_race_duplicates;
  END IF;

  SELECT
    count(DISTINCT m.id),count(DISTINCT r.id),count(DISTINCT runner.id),count(DISTINCT result.id)
  INTO real_meetings,real_races,real_runners,real_results
  FROM _giq_history_stage."r2_Meeting" m
  LEFT JOIN _giq_history_stage."r2_Race" r ON r."meetingId"=m.id
  LEFT JOIN _giq_history_stage."r2_Runner" runner ON runner."raceId"=r.id
  LEFT JOIN _giq_history_stage."r2_Result" result ON result."runnerId"=runner.id
  WHERE coalesce(lower(m."sourceProvider"),'') NOT IN ('demo','greyhoundiq-demo');
  IF (real_meetings,real_races,real_runners,real_results) <>
     (76622::bigint,838536::bigint,6434242::bigint,5627298::bigint) THEN
    RAISE EXCEPTION 'real r2 graph partition changed: meetings %, races %, runners %, results %',
      real_meetings,real_races,real_runners,real_results;
  END IF;
END
$$;

DO $$
DECLARE
  demo_meetings bigint;
  demo_races bigint;
  demo_runners bigint;
  demo_results bigint;
  synthetic_meetings bigint;
  synthetic_races bigint;
  synthetic_runners bigint;
  synthetic_results bigint;
BEGIN
  SELECT count(DISTINCT m.id),count(DISTINCT r.id),count(DISTINCT runner.id),count(DISTINCT result.id)
  INTO demo_meetings,demo_races,demo_runners,demo_results
  FROM _giq_history_stage."r2_Meeting" m
  LEFT JOIN _giq_history_stage."r2_Race" r ON r."meetingId"=m.id
  LEFT JOIN _giq_history_stage."r2_Runner" runner ON runner."raceId"=r.id
  LEFT JOIN _giq_history_stage."r2_Result" result ON result."runnerId"=runner.id
  WHERE lower(m."sourceProvider")='demo';
  SELECT count(DISTINCT m.id),count(DISTINCT r.id),count(DISTINCT runner.id),count(DISTINCT result.id)
  INTO synthetic_meetings,synthetic_races,synthetic_runners,synthetic_results
  FROM _giq_history_stage."r2_Meeting" m
  LEFT JOIN _giq_history_stage."r2_Race" r ON r."meetingId"=m.id
  LEFT JOIN _giq_history_stage."r2_Runner" runner ON runner."raceId"=r.id
  LEFT JOIN _giq_history_stage."r2_Result" result ON result."runnerId"=runner.id
  WHERE lower(m."sourceProvider")='greyhoundiq-demo';
  IF (demo_meetings,demo_races,demo_runners,demo_results) <>
     (45::bigint,135::bigint,1080::bigint,0::bigint)
     OR (synthetic_meetings,synthetic_races,synthetic_runners,synthetic_results) <>
     (1::bigint,1::bigint,0::bigint,0::bigint) THEN
    RAISE EXCEPTION 'demo graph partition changed';
  END IF;
END
$$;

INSERT INTO _giq_history_merge.quarantine
  (source_name,entity_type,source_key,reason_code,disposition,blocking,evidence)
SELECT 'r2','meeting',m.id,'synthetic-demo-graph','excluded-relationship-graph-dog-preserved',false,
       jsonb_build_object('provider',m."sourceProvider",'date',m."meetingDate")
FROM _giq_history_stage."r2_Meeting" m
WHERE lower(m."sourceProvider") IN ('demo','greyhoundiq-demo')
UNION ALL
SELECT 'r2','race',r.id,'synthetic-demo-graph','excluded-relationship-graph-dog-preserved',false,
       jsonb_build_object('meetingId',r."meetingId",'raceNumber',r."raceNumber")
FROM _giq_history_stage."r2_Race" r
JOIN _giq_history_stage."r2_Meeting" m ON m.id=r."meetingId"
WHERE lower(m."sourceProvider") IN ('demo','greyhoundiq-demo')
UNION ALL
SELECT 'r2','runner',runner.id,'synthetic-demo-graph','excluded-relationship-only-dog-preserved',false,
       jsonb_build_object('raceId',runner."raceId",'dogId',runner."dogId",'box',runner."boxNumber")
FROM _giq_history_stage."r2_Runner" runner
JOIN _giq_history_stage."r2_Race" r ON r.id=runner."raceId"
JOIN _giq_history_stage."r2_Meeting" m ON m.id=r."meetingId"
WHERE lower(m."sourceProvider") IN ('demo','greyhoundiq-demo')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  nz_tracks bigint;
  nz_meetings bigint;
  nz_races bigint;
  nz_runners bigint;
  nz_results bigint;
  act_meetings bigint;
  act_races bigint;
  act_first date;
  act_last date;
  states text[];
  meadows_overlap bigint;
BEGIN
  SELECT
    count(DISTINCT t.id),count(DISTINCT m.id),count(DISTINCT r.id),
    count(DISTINCT runner.id),count(DISTINCT result.id)
  INTO nz_tracks,nz_meetings,nz_races,nz_runners,nz_results
  FROM _giq_history_stage."r2_Track" t
  LEFT JOIN _giq_history_stage."r2_Meeting" m ON m."trackId"=t.id
    AND coalesce(lower(m."sourceProvider"),'') NOT IN ('demo','greyhoundiq-demo')
  LEFT JOIN _giq_history_stage."r2_Race" r ON r."meetingId"=m.id
  LEFT JOIN _giq_history_stage."r2_Runner" runner ON runner."raceId"=r.id
  LEFT JOIN _giq_history_stage."r2_Result" result ON result."runnerId"=runner.id
  WHERE lower(btrim(t.name)) IN (
    'auckland','ashburton','cambridge','christchurch','manukau','manawatu',
    'otago','palmerston - north','southland','taranaki','tokoroa','wellington',
    'waikato','wanganui'
  );
  IF (nz_tracks,nz_meetings,nz_races,nz_runners,nz_results) <>
     (14::bigint,3968::bigint,42339::bigint,331978::bigint,328501::bigint) THEN
    RAISE EXCEPTION 'NZ jurisdiction partition changed: tracks %, meetings %, races %, runners %, results %',
      nz_tracks,nz_meetings,nz_races,nz_runners,nz_results;
  END IF;

  SELECT count(DISTINCT m.id),count(DISTINCT r.id),min(m."meetingDate")::date,max(m."meetingDate")::date
  INTO act_meetings,act_races,act_first,act_last
  FROM _giq_history_stage."r2_Track" t
  JOIN _giq_history_stage."r2_Meeting" m ON m."trackId"=t.id
    AND coalesce(lower(m."sourceProvider"),'') NOT IN ('demo','greyhoundiq-demo')
  LEFT JOIN _giq_history_stage."r2_Race" r ON r."meetingId"=m.id

  WHERE lower(btrim(t.name))='canberra';
  IF (act_meetings,act_races,act_first,act_last) <>
     (536::bigint,5681::bigint,'2006-08-06'::date,'2018-04-29'::date) THEN
    RAISE EXCEPTION 'ACT Canberra partition changed';
  END IF;

  SELECT array_agg(DISTINCT state ORDER BY state) INTO states
  FROM _giq_history_stage.normalized_track WHERE state<>'NZ';
  IF states <> ARRAY['ACT','NSW','NT','QLD','SA','TAS','VIC','WA']::text[] THEN
    RAISE EXCEPTION 'AU state coverage changed: %',states;
  END IF;

  SELECT count(*) INTO meadows_overlap
  FROM _giq_history_stage."r2_Meeting" a
  JOIN _giq_history_stage."r2_Track" ta ON ta.id=a."trackId" AND lower(btrim(ta.name))='meadows'
  JOIN _giq_history_stage."r2_Meeting" b ON b."meetingDate"=a."meetingDate"
  JOIN _giq_history_stage."r2_Track" tb ON tb.id=b."trackId" AND lower(btrim(tb.name))='the meadows';
  IF meadows_overlap<>0 THEN
    RAISE EXCEPTION 'Meadows alias dates now conflict';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.export_issue_outcome (
  source_dataset text NOT NULL,
  source_file text NOT NULL,
  line_number bigint NOT NULL,
  issue_type text NOT NULL,
  outcome text NOT NULL,
  canonical_entity_type text,
  canonical_natural_key text,
  payload jsonb NOT NULL,
  PRIMARY KEY(source_dataset,source_file,line_number)
);

INSERT INTO _giq_history_stage.export_issue_outcome
SELECT
  'duplicates',d.source_file,d.line_number,d.payload->>'issueType',
  CASE WHEN r.target_id IS NOT NULL THEN 'selected-runner-exists-by-natural-key'
       ELSE 'unaccounted-duplicate' END,
  'Runner',r.natural_key,d.payload
FROM _giq_history_stage.export_duplicates d
LEFT JOIN _giq_history_stage.runner_map r
  ON r.source_name='export' AND r.source_id=d.payload->>'naturalKey';

WITH profile_outcome AS MATERIALIZED (
  SELECT
    payload->>'naturalKey' AS natural_key,
    count(*) AS rows,
    count(*) FILTER(WHERE race_id IS NOT NULL) AS resolved_rows,
    count(*) FILTER(WHERE disposition='preserved-provider-racing-url-without-canonical-race') AS preserved_unlinked_rows,
    count(*) FILTER(WHERE disposition LIKE 'quarantined-dog-url-%') AS non_race_quarantined_rows,
    count(*) FILTER(WHERE disposition LIKE 'quarantined-%'
                      AND disposition NOT LIKE 'quarantined-dog-url-%') AS other_quarantined_rows,
    min(race_natural_key) FILTER(WHERE race_id IS NOT NULL) AS race_natural_key
  FROM _giq_history_stage.profile_form_resolution
  GROUP BY payload->>'naturalKey'
)
INSERT INTO _giq_history_stage.export_issue_outcome
SELECT
  'orphans',o.source_file,o.line_number,o.payload->>'issueType',
  CASE o.payload->>'issueType'
    WHEN 'pedigree-parent-profile-unresolved' THEN
      CASE WHEN edge.natural_key IS NOT NULL AND parent.target_id IS NOT NULL
        THEN 'provider-stub-created-by-provider-id-and-edge-preserved'
        ELSE 'unaccounted-pedigree-parent-orphan' END
    WHEN 'runner-dog-profile-unresolved' THEN
      CASE WHEN runner.target_id IS NOT NULL AND runner_dog.target_id IS NOT NULL
        THEN 'race-observed-dog-created-by-provider-id-and-runner-linked'
        ELSE 'unaccounted-runner-dog-orphan' END
    WHEN 'profile-form-race-unresolved' THEN
      CASE
        WHEN profile.natural_key IS NULL THEN 'unaccounted-profile-form-orphan'
        WHEN profile.resolved_rows>0 AND profile.preserved_unlinked_rows=0
          AND profile.non_race_quarantined_rows=0 AND profile.other_quarantined_rows=0
          THEN 'profile-form-exactly-reconciled'
        WHEN profile.preserved_unlinked_rows>0 AND profile.resolved_rows=0
          AND profile.non_race_quarantined_rows=0 AND profile.other_quarantined_rows=0
          THEN 'profile-form-valid-unlinked-history-preserved'
        WHEN profile.non_race_quarantined_rows>0 AND profile.resolved_rows=0
          AND profile.preserved_unlinked_rows=0 AND profile.other_quarantined_rows=0
          THEN 'profile-form-non-race-url-quarantined'
        WHEN profile.other_quarantined_rows>0 AND profile.resolved_rows=0
          AND profile.preserved_unlinked_rows=0 THEN 'profile-form-explicitly-quarantined'
        ELSE 'profile-form-mixed-duplicate-outcomes-preserved'
      END
    ELSE 'unaccounted-orphan-type'
  END,
  CASE o.payload->>'issueType'
    WHEN 'pedigree-parent-profile-unresolved' THEN 'Dog'
    WHEN 'runner-dog-profile-unresolved' THEN 'Runner'
    WHEN 'profile-form-race-unresolved' THEN 'DogProfileForm'
  END,
  CASE o.payload->>'issueType'
    WHEN 'pedigree-parent-profile-unresolved' THEN edge.natural_key
    WHEN 'runner-dog-profile-unresolved' THEN runner.natural_key
    WHEN 'profile-form-race-unresolved' THEN profile.race_natural_key
  END,
  o.payload
FROM _giq_history_stage.export_orphans o
LEFT JOIN _giq_history_stage.normalized_pedigree_edge edge
  ON o.payload->>'issueType'='pedigree-parent-profile-unresolved'
 AND edge.natural_key=o.payload->>'naturalKey'
LEFT JOIN _giq_history_stage.normalized_dog parent
  ON parent.natural_key=o.payload->>'missingNaturalKey'
LEFT JOIN _giq_history_stage.runner_map runner
  ON o.payload->>'issueType'='runner-dog-profile-unresolved'
 AND runner.source_name='export' AND runner.source_id=o.payload->>'naturalKey'
LEFT JOIN _giq_history_stage.normalized_dog runner_dog
  ON runner_dog.natural_key=o.payload->>'missingProviderKey'
LEFT JOIN profile_outcome profile
  ON o.payload->>'issueType'='profile-form-race-unresolved'
 AND profile.natural_key=o.payload->>'naturalKey';

INSERT INTO _giq_history_stage.export_issue_outcome
SELECT
  'quarantine',q.source_file,q.line_number,q.payload->>'issueType',
  CASE
    WHEN q.payload->>'issueType'='runner-row' AND q.payload->>'reason'='missing_dog_provider_identity'
      THEN 'quarantined-missing-dog-provider-identity'
    WHEN q.payload->>'issueType'='race-row' AND q.payload->>'reason'='missing_race_distance'
      THEN 'quarantined-missing-race-distance'
    ELSE 'unaccounted-source-quarantine'
  END,
  NULL,NULL,q.payload
FROM _giq_history_stage.export_quarantine q;

DO $$
DECLARE
  duplicates bigint;
  profile_orphans bigint;
  runner_orphans bigint;
  pedigree_orphans bigint;
  quarantine_runner bigint;
  quarantine_race bigint;
  unaccounted bigint;
  valid_unlinked bigint;
  non_race_quarantined bigint;
BEGIN
  SELECT count(*) FILTER(WHERE source_dataset='duplicates'),
    count(*) FILTER(WHERE issue_type='profile-form-race-unresolved'),
    count(*) FILTER(WHERE issue_type='runner-dog-profile-unresolved'),
    count(*) FILTER(WHERE issue_type='pedigree-parent-profile-unresolved'),
    count(*) FILTER(WHERE outcome='quarantined-missing-dog-provider-identity'),
    count(*) FILTER(WHERE outcome='quarantined-missing-race-distance'),
    count(*) FILTER(WHERE outcome LIKE 'unaccounted-%'),
    count(*) FILTER(WHERE outcome='profile-form-valid-unlinked-history-preserved'),
    count(*) FILTER(WHERE outcome='profile-form-non-race-url-quarantined')
  INTO duplicates,profile_orphans,runner_orphans,pedigree_orphans,
       quarantine_runner,quarantine_race,unaccounted,valid_unlinked,non_race_quarantined
  FROM _giq_history_stage.export_issue_outcome;
  IF (duplicates,profile_orphans,runner_orphans,pedigree_orphans,quarantine_runner,quarantine_race) <>
     (1940::bigint,759359::bigint,266534::bigint,162387::bigint,42::bigint,40::bigint)
     OR unaccounted<>0 THEN
    RAISE EXCEPTION 'normalized issue outcome inventory changed or has % unaccounted rows',unaccounted;
  END IF;
  IF (valid_unlinked,non_race_quarantined)<>(444857::bigint,314502::bigint) THEN
    RAISE EXCEPTION 'profile-form orphan preservation partition changed: valid unlinked %, non-race quarantined %',
      valid_unlinked,non_race_quarantined;
  END IF;
  IF (SELECT count(*) FROM _giq_history_stage.export_issue_outcome)<>1190302 THEN
    RAISE EXCEPTION 'normalized issue outcomes do not cover all 1,190,302 source issue rows';
  END IF;
END
$$;

INSERT INTO _giq_history_merge.disposition
  (source_name,issue_type,source_key,disposition_code,canonical_entity_type,canonical_natural_key,evidence)
SELECT
  'normalized-export',source_dataset,source_file || ':' || line_number,
  outcome,canonical_entity_type,canonical_natural_key,
  payload || jsonb_build_object('originalIssueType',issue_type)
FROM _giq_history_stage.export_issue_outcome
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  duplicate_groups bigint;
  duplicate_rows bigint;
  canonical_provider_duplicates bigint;
  production_hist_ids bigint;
BEGIN
  SELECT count(*),coalesce(sum(rows),0) INTO duplicate_groups,duplicate_rows
  FROM (
    SELECT lower(btrim(name)) AS name,count(*) AS rows
    FROM _giq_history_stage."r2_Trainer"
    GROUP BY lower(btrim(name)) HAVING count(*)>1
  ) duplicates;
  IF (duplicate_groups,duplicate_rows)<>(82::bigint,164::bigint) THEN
    RAISE EXCEPTION 'r2 trainer duplicate partition changed: groups %, rows %',duplicate_groups,duplicate_rows;
  END IF;
  SELECT count(*) INTO canonical_provider_duplicates
  FROM (
    SELECT source_provider,source_id FROM _giq_history_stage.normalized_trainer
    WHERE source_provider IS NOT NULL AND source_id IS NOT NULL
    GROUP BY source_provider,source_id HAVING count(*)>1
  ) duplicate;
  IF canonical_provider_duplicates<>0 THEN
    RAISE EXCEPTION 'trainer provider identities remain duplicated';
  END IF;

  SELECT sum(rows) INTO production_hist_ids
  FROM (
    SELECT count(*) AS rows FROM public."Track" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."Trainer" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."Dog" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."Meeting" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."Race" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."RaceVideo" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."Runner" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."Result" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."FormEntry" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."DogProfileForm" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."DogProfileArchive" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
    UNION ALL SELECT count(*) FROM public."RaceDayArchive" WHERE id ~ '^hist_[a-z]+_[0-9a-f]{32}$'
  ) existing;
  IF production_hist_ids<>0 THEN
    RAISE EXCEPTION 'production snapshot already uses reserved history IDs';
  END IF;
END
$$;

CREATE TABLE _giq_history_merge.production_row_update_audit (
  table_name text NOT NULL,
  row_id text NOT NULL,
  changed_fields text[] NOT NULL,
  before_sha256 text NOT NULL,
  after_sha256 text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(table_name,row_id)
);

CREATE TABLE _giq_history_merge.snapshot_race_video_proof AS
SELECT id,encode(digest(to_jsonb(v)::text,'sha256'),'hex') AS row_sha256
FROM public."RaceVideo" v;
ALTER TABLE _giq_history_merge.snapshot_race_video_proof ADD PRIMARY KEY(id);

CREATE TABLE _giq_history_merge.protected_table_manifest (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  row_md5 text NOT NULL
);

DO $$
DECLARE relation record;
BEGIN
  FOR relation IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname<>ALL(ARRAY[
        'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
        'DogProfileForm','RaceVideo','DogProfileArchive','RaceDayArchive',
        'PedigreeImportRun','DogSourceIdentity','PedigreeAssertion','PedigreeMergeLedger'
      ]::text[])
    ORDER BY c.relname
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE MODE',relation.relname);
  END LOOP;
END
$$;

DO $$
DECLARE
  relation record;
  primary_key_order text;
  row_count_value bigint;
  row_md5_value text;
BEGIN
  FOR relation IN
    SELECT c.oid,c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname<>ALL(ARRAY[
        'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
        'DogProfileForm','RaceVideo','DogProfileArchive','RaceDayArchive',
        'PedigreeImportRun','DogSourceIdentity','PedigreeAssertion','PedigreeMergeLedger'
      ]::text[])
    ORDER BY c.relname
  LOOP
    SELECT 'jsonb_build_array(' || string_agg(format('t.%I',a.attname),
                      ', ' ORDER BY k.ordinality) || ')::text'
    INTO primary_key_order
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality)
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
    WHERE i.indrelid=relation.oid AND i.indisprimary;
    IF primary_key_order IS NULL THEN
      RAISE EXCEPTION 'protected public table % has no primary key',relation.relname;
    END IF;
    EXECUTE format(
      'SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY %s),'''')) FROM public.%I t',
      primary_key_order,relation.relname
    ) INTO row_count_value,row_md5_value;
    INSERT INTO _giq_history_merge.protected_table_manifest(table_name,row_count,row_md5)
    VALUES(relation.relname,row_count_value,row_md5_value);
  END LOOP;
END
$$;

CREATE TABLE _giq_history_merge.replay_standalone_membership_disposition AS
SELECT
  evidence.provider_video_id,
  evidence.last_evidence_status,
  matches.snapshot_rows,
  CASE WHEN matches.snapshot_rows=1 THEN 'present_in_cloned_race_video'
       WHEN matches.snapshot_rows=0 THEN 'explicitly_missing'
       ELSE 'quarantined' END AS disposition
FROM _giq_history_stage.replay_standalone_only_provider_id evidence
CROSS JOIN LATERAL (
  SELECT count(*)::integer AS snapshot_rows
  FROM public."RaceVideo" video
  WHERE lower(video."sourceProvider")='thedogs'
    AND video.kind='replay'
    AND video."sourceId"=evidence.provider_video_id
) matches;
ALTER TABLE _giq_history_merge.replay_standalone_membership_disposition
  ADD PRIMARY KEY(provider_video_id);

DO $$
DECLARE
  total bigint;
  accounted bigint;
BEGIN
  SELECT count(*),count(*) FILTER(WHERE disposition IN (
    'present_in_cloned_race_video','explicitly_missing','quarantined'
  )) INTO total,accounted
  FROM _giq_history_merge.replay_standalone_membership_disposition;
  IF total<>145 OR accounted<>145 THEN
    RAISE EXCEPTION 'standalone replay membership proof incomplete: total %, accounted %',total,accounted;
  END IF;
END
$$;

INSERT INTO _giq_history_merge.verification_check(check_name,metrics)
VALUES
('trainer_source_identity',jsonb_build_object(
  'sourceDuplicateGroups',82,'sourceDuplicateRows',164,
  'canonicalProviderDuplicateGroups',0,
  'canonicalTrainers',(SELECT count(*) FROM _giq_history_stage.normalized_trainer),
  'ambiguousProviderRows',(SELECT count(*) FROM _giq_history_merge.quarantine
    WHERE source_name='r2' AND entity_type='trainer' AND reason_code='multiple_provider_identities')
)),
('thedogs_pedigree_partition',jsonb_build_object(
  'staged',328069,'rejectedSelf',16,
  'rejectedDuplicate',(SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge
    WHERE duplicate_rank>1 AND NOT self_parent),
  'canonicalEligible',(SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge WHERE canonical_eligible),
  'verified',0,'replaced',0,
  'quarantined',(SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge WHERE NOT canonical_eligible)
)),
('race_media_partition',jsonb_build_object(
  'staged',538849,'replayStaged',290771,'photoFinishStaged',248078,
  'raceReplayStaged',289718,'raceReplayUniqueProviderIds',289707,
  'providerConflictRows',22,'meetingPreviewRows',900,'meetingPreviewUniqueIds',304,
  'liveMeetingRows',117,'liveMeetingUniqueIds',11,
  'racePreviewRows',36,'racePreviewUniqueIds',36,
  'normalizedRaceVideos',(SELECT count(*) FROM _giq_history_stage.normalized_race_video),
  'normalizedPhotoFinishes',(SELECT count(*) FROM _giq_history_stage.normalized_photo_finish),
  'quarantined',(SELECT count(*) FROM _giq_history_stage.media_resolution WHERE disposition LIKE 'quarantined-%'),
  'snapshotRaceVideos',(SELECT count(*) FROM _giq_history_merge.snapshot_race_video_proof),
  'snapshotRaceVideosPreserved',false
)),
('standalone_replay_membership',jsonb_build_object(
  'contractSha256',(SELECT replay_evidence_contract_sha256 FROM _giq_history_merge.run WHERE id=1),
  'inputProviderIds',145,
  'presentInClonedRaceVideo',(SELECT count(*) FROM _giq_history_merge.replay_standalone_membership_disposition
    WHERE disposition='present_in_cloned_race_video'),
  'explicitlyMissing',(SELECT count(*) FROM _giq_history_merge.replay_standalone_membership_disposition
    WHERE disposition='explicitly_missing'),
  'quarantined',(SELECT count(*) FROM _giq_history_merge.replay_standalone_membership_disposition
    WHERE disposition='quarantined'),
  'importedFromStandaloneLog',0,
  'ephemeralMediaValuesStored',0
)),
('jurisdiction_partition',jsonb_build_object(
  'auStates',jsonb_build_array('ACT','NSW','NT','QLD','SA','TAS','VIC','WA'),
  'nzTracks',14,'nzMeetings',3968,'nzRaces',42339,'nzRunners',331978,'nzResults',328501,
  'actMeetings',536,'actRaces',5681,'demoMeetingsExcluded',46,'demoRacesExcluded',136,
  'demoRunnersExcluded',1080,'demoResultsExcluded',0,'meadowsDateConflicts',0
)),
('profile_form_partition',jsonb_build_object(
  'staged',6218839,'canonicalUrlRows',5904337,'dogUrlRows',314502,'temoraSluglessRows',8,
  'canonicalResolved',(SELECT count(*) FROM _giq_history_stage.profile_form_resolution
    WHERE disposition='verified-canonical-race-url'),
  'validUnlinkedPreserved',(SELECT count(*) FROM _giq_history_stage.profile_form_resolution
    WHERE disposition='preserved-provider-racing-url-without-canonical-race'),
  'dogUrlExactRecoveryEvidence',(SELECT count(*) FROM _giq_history_stage.profile_form_resolution
    WHERE disposition='quarantined-dog-url-exact-recovery-evidence'),
  'nonRaceDogUrlsQuarantined',(SELECT count(*) FROM _giq_history_stage.profile_form_resolution
    WHERE disposition LIKE 'quarantined-dog-url-%'),
  'quarantined',(SELECT count(*) FROM _giq_history_stage.profile_form_resolution
    WHERE disposition LIKE 'quarantined-%'),
  'canonicalDogUrlsWritten',0
)),
('galtd_conflict_resolution',jsonb_build_object(
  'observations',105374,'assertions',210734,'conflictGroups',5,'conflictObservations',18,
  'exactCrosswalkEligible',(SELECT count(*) FROM _giq_history_stage.galtd_exact_crosswalk WHERE canonical_eligible),
  'providerRetrievalCandidates',(SELECT count(*) FROM _giq_history_stage.galtd_exact_crosswalk
    WHERE provider_retrieval_candidate),
  'ambiguousCompositeCandidates',(SELECT count(*) FROM _giq_history_stage.galtd_exact_crosswalk
    WHERE resolution_status='quarantined-ambiguous-composite-match'),
  'crosswalkRejected',(SELECT count(*) FROM _giq_history_stage.galtd_exact_crosswalk WHERE NOT canonical_eligible),
  'arbitraryNameOnlyLinks',0,'allAssertionsPreserved',true
)),
('protected_production_baseline',jsonb_build_object(
  'snapshotTables',(SELECT count(*) FROM _giq_history_merge.snapshot_table_manifest),
  'snapshotRaceVideos',(SELECT count(*) FROM _giq_history_merge.snapshot_race_video_proof),
  'protectedTableCount',(SELECT count(*) FROM _giq_history_merge.protected_table_manifest),
  'reservedHistoryIdCollisions',0,'nonNullOverwriteGuardInstalled',false,
  'nonAllowlistedTablesUnchanged',false
))
ON CONFLICT(check_name) DO UPDATE
SET metrics=EXCLUDED.metrics,verified_at=clock_timestamp();

CREATE TABLE _giq_history_merge.source_membership_partition AS
WITH membership(entity_type,natural_key,source_name) AS (
  SELECT 'Track',natural_key,source_name FROM _giq_history_stage.track_map
  UNION ALL SELECT 'Trainer',natural_key,source_name FROM _giq_history_stage.trainer_map
  UNION ALL SELECT 'Dog',natural_key,CASE WHEN source_name='r2' THEN 'r2' ELSE 'export' END
    FROM _giq_history_stage.dog_identity_source
  UNION ALL SELECT 'Meeting',natural_key,source_name FROM _giq_history_stage.meeting_source
  UNION ALL SELECT 'Race',natural_key,source_name FROM _giq_history_stage.race_source
  UNION ALL SELECT 'Runner',natural_key,source_name FROM _giq_history_stage.runner_source
  UNION ALL SELECT 'Result',natural_key,source_name FROM _giq_history_stage.result_source
  UNION ALL
  SELECT 'FormEntry',f.natural_key,
    CASE WHEN source_key LIKE 'r2:%' THEN 'r2' ELSE 'export' END
  FROM _giq_history_stage.normalized_form_entry f
  CROSS JOIN LATERAL jsonb_array_elements_text(f.source_provenance->'sources') source_key
), grouped AS (
  SELECT entity_type,natural_key,
    bool_or(source_name='r2') AS has_r2,
    bool_or(source_name='export') AS has_export
  FROM membership GROUP BY entity_type,natural_key
)
SELECT entity_type,
  count(*) FILTER(WHERE has_r2) AS r2_identities,
  count(*) FILTER(WHERE has_export) AS export_identities,
  count(*) AS normalized_identities,
  count(*) FILTER(WHERE has_r2 AND has_export) AS overlap_identities,
  count(*) FILTER(WHERE has_r2 AND NOT has_export) AS r2_only_identities,
  count(*) FILTER(WHERE has_export AND NOT has_r2) AS export_only_identities
FROM grouped GROUP BY entity_type;
ALTER TABLE _giq_history_merge.source_membership_partition ADD PRIMARY KEY(entity_type);

CREATE TABLE _giq_history_merge.pedigree_source_partition AS
WITH r2_edges AS (
  SELECT child_map.target_id AS child_id,parent_map.target_id AS parent_id,relationship
  FROM _giq_history_stage."r2_Dog" dog
  JOIN _giq_history_stage.dog_map child_map
    ON child_map.source_name='r2' AND child_map.source_id=dog.id
  CROSS JOIN LATERAL (VALUES('sire',dog."sireId"),('dam',dog."damId")) edge(relationship,parent_source_id)
  JOIN _giq_history_stage.dog_map parent_map
    ON parent_map.source_name='r2' AND parent_map.source_id=edge.parent_source_id
  WHERE edge.parent_source_id IS NOT NULL
), membership AS (
  SELECT child_id,parent_id,relationship,'r2'::text AS source_name FROM r2_edges
  UNION ALL
  SELECT child_id,parent_id,relationship,'export' FROM _giq_history_stage.normalized_pedigree_edge
), grouped AS (
  SELECT child_id,parent_id,relationship,
    bool_or(source_name='r2') AS has_r2,bool_or(source_name='export') AS has_export
  FROM membership GROUP BY child_id,parent_id,relationship
)
SELECT
  count(*) FILTER(WHERE has_r2) AS r2_identities,
  count(*) FILTER(WHERE has_export) AS export_identities,
  count(*) AS normalized_identities,
  count(*) FILTER(WHERE has_r2 AND has_export) AS overlap_identities,
  count(*) FILTER(WHERE has_r2 AND NOT has_export) AS r2_only_identities,
  count(*) FILTER(WHERE has_export AND NOT has_r2) AS export_only_identities
FROM grouped;

DO $$
DECLARE
  mismatches bigint;
BEGIN
  SELECT count(*) INTO mismatches
  FROM _giq_history_merge.source_membership_partition p
  WHERE p.normalized_identities<>CASE p.entity_type
    WHEN 'Track' THEN (SELECT count(*) FROM _giq_history_stage.normalized_track)
    WHEN 'Trainer' THEN (SELECT count(*) FROM _giq_history_stage.normalized_trainer)
    WHEN 'Dog' THEN (SELECT count(*) FROM _giq_history_stage.normalized_dog)
    WHEN 'Meeting' THEN (SELECT count(*) FROM _giq_history_stage.normalized_meeting)
    WHEN 'Race' THEN (SELECT count(*) FROM _giq_history_stage.normalized_race)
    WHEN 'Runner' THEN (SELECT count(*) FROM _giq_history_stage.normalized_runner)
    WHEN 'Result' THEN (SELECT count(*) FROM _giq_history_stage.normalized_result)
    WHEN 'FormEntry' THEN (SELECT count(*) FROM _giq_history_stage.normalized_form_entry)
  END;
  IF mismatches<>0 THEN
    RAISE EXCEPTION '% source-membership partitions do not equal normalized entity counts',mismatches;
  END IF;
  IF EXISTS(
    SELECT 1 FROM _giq_history_merge.pedigree_source_partition
    WHERE r2_identities<>14 OR export_identities<>328069 OR r2_only_identities<>0
       OR normalized_identities<>328069
  ) THEN
    RAISE EXCEPTION 'r2 pedigree relationships are not fully represented in normalized provider evidence';
  END IF;
END
$$;

INSERT INTO _giq_history_merge.reconciliation_manifest
  (entity_type,r2_rows,export_rows,normalized_rows,overlap_rows,r2_only_rows,export_only_rows,quarantined_rows,details)
SELECT p.entity_type,p.r2_identities,p.export_identities,p.normalized_identities,
  p.overlap_identities,p.r2_only_identities,p.export_only_identities,
  CASE p.entity_type WHEN 'Track' THEN 1 WHEN 'Meeting' THEN 46 WHEN 'Race' THEN 136
    WHEN 'Runner' THEN 1080 WHEN 'FormEntry' THEN
      (SELECT count(*) FROM _giq_history_stage.profile_form_resolution WHERE race_id IS NULL)
    ELSE 0 END,
  jsonb_build_object(
    'partitionEquationVerified',p.normalized_identities=
      p.overlap_identities+p.r2_only_identities+p.export_only_identities,
    'rawR2Rows',CASE p.entity_type
      WHEN 'Track' THEN 75 WHEN 'Trainer' THEN 10682 WHEN 'Dog' THEN 198947
      WHEN 'Meeting' THEN 76668 WHEN 'Race' THEN 838672 WHEN 'Runner' THEN 6435322
      WHEN 'Result' THEN 5627298 WHEN 'FormEntry' THEN 5627293 END,
    'rawExportRows',CASE p.entity_type
      WHEN 'Track' THEN 76620 WHEN 'Trainer' THEN 6434145 WHEN 'Dog' THEN 170780
      WHEN 'Meeting' THEN 76620 WHEN 'Race' THEN 838526 WHEN 'Runner' THEN 6434145
      WHEN 'Result' THEN 5660837 WHEN 'FormEntry' THEN 6218839 END
  )
FROM _giq_history_merge.source_membership_partition p
UNION ALL
SELECT 'DogProfileForm',0,count(*),count(*),0,0,count(*),
  (SELECT count(*) FROM _giq_history_stage.profile_form_resolution WHERE disposition LIKE 'quarantined-%'),
  jsonb_build_object(
    'rawExportRows',6218839,
    'validUnlinkedPreserved',(SELECT count(*) FROM _giq_history_stage.normalized_profile_form WHERE resolved_race_id IS NULL),
    'nonRaceDogUrlsQuarantined',(SELECT count(*) FROM _giq_history_stage.profile_form_resolution
      WHERE disposition LIKE 'quarantined-dog-url-%'))
FROM _giq_history_stage.normalized_profile_form
UNION ALL
SELECT 'RaceVideo',0,count(*),count(*),0,0,count(*),
  (SELECT count(*) FROM _giq_history_stage.media_resolution WHERE disposition LIKE 'quarantined-%'),
  jsonb_build_object('rawMediaRows',538849,'exactReplayRows',289718)
FROM _giq_history_stage.normalized_race_video
UNION ALL
SELECT 'PhotoFinish',0,count(*),count(*),0,0,count(*),
  (SELECT count(*) FROM _giq_history_stage.media_resolution
    WHERE media_class='photo-finish-attachment' AND disposition LIKE 'quarantined-%'),
  jsonb_build_object('rawPhotoRows',248078)
FROM _giq_history_stage.normalized_photo_finish
UNION ALL
SELECT 'DogProfileArchive',count(*),0,count(*),0,count(*),0,
  count(*) FILTER(WHERE dog_id IS NULL),jsonb_build_object('linked',count(*) FILTER(WHERE dog_id IS NOT NULL))
FROM _giq_history_stage.normalized_dog_profile_archive
UNION ALL
SELECT 'RaceDayArchive',count(*),0,count(*),0,count(*),0,0,'{}'::jsonb
FROM _giq_history_stage.normalized_race_day_archive
UNION ALL
SELECT 'Pedigree',p.r2_identities,p.export_identities,p.normalized_identities,
  p.overlap_identities,p.r2_only_identities,p.export_only_identities,
  (SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge WHERE NOT canonical_eligible),
  jsonb_build_object('galtdObservations',105374,'galtdAssertions',210734)
FROM _giq_history_merge.pedigree_source_partition p
ON CONFLICT(entity_type) DO UPDATE SET
  r2_rows=EXCLUDED.r2_rows,export_rows=EXCLUDED.export_rows,normalized_rows=EXCLUDED.normalized_rows,
  overlap_rows=EXCLUDED.overlap_rows,r2_only_rows=EXCLUDED.r2_only_rows,
  export_only_rows=EXCLUDED.export_only_rows,quarantined_rows=EXCLUDED.quarantined_rows,
  details=EXCLUDED.details;

UPDATE _giq_history_merge.run
SET phase='normalized',
    normalized_at=clock_timestamp(),
    normalization_manifest=jsonb_build_object(
      'sourceAccessModeDeclared','read-only pg_dump/SELECT-only FDW',
      'sourceDatabases',jsonb_build_array('giq_rehearsal_restore_v8','giq_full_history_rehearsal_20260716_r2'),
      'candidateOnlyWrites',true,
      'reconciliation',(SELECT jsonb_object_agg(entity_type,to_jsonb(r)-'entity_type')
                        FROM _giq_history_merge.reconciliation_manifest r),
      'quarantineRows',(SELECT count(*) FROM _giq_history_merge.quarantine),
      'dispositionRows',(SELECT count(*) FROM _giq_history_merge.disposition)
    ),
    replay_normalization_verified_at=clock_timestamp(),
    replay_artifact_sha256='89b90198d3197238a2476381c0917108f21d2e209c02ca066e8ec90c1e8385b1',
    replay_artifact_rows=538849
WHERE id=1;

REVOKE ALL ON ALL TABLES IN SCHEMA _giq_history_stage FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA _giq_history_merge FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event','CANDIDATE_NORMALIZATION_VERIFIED',
  'database',current_database(),
  'phase',phase,
  'manifest',normalization_manifest
)
FROM _giq_history_merge.run WHERE id=1;
