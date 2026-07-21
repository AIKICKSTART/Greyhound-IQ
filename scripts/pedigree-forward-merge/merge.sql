\set ON_ERROR_STOP on

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '55min';
SET LOCAL idle_in_transaction_session_timeout = '60min';
SET LOCAL search_path = public, pg_temp;
SET LOCAL app.system = 'true';

SELECT pg_advisory_xact_lock(hashtextextended('greyhoundiq:pedigree-forward-merge:stage11-r2', 0));

DO $$
BEGIN
  IF to_regclass('public."Dog"') IS NULL
     OR to_regclass('public."PedigreeImportRun"') IS NULL
     OR to_regclass('public."DogSourceIdentity"') IS NULL
     OR to_regclass('public."PedigreeAssertion"') IS NULL
     OR to_regclass('public."PedigreeMergeLedger"') IS NULL THEN
    RAISE EXCEPTION 'required pedigree schema is absent';
  END IF;
  IF to_regprocedure('digest(bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto digest(bytea,text) is required and must already be installed';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.history_id(prefix text, natural_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT 'hist_' || prefix || '_' || md5(natural_key)
$$;

CREATE TEMP TABLE stage_input_manifest(payload jsonb NOT NULL);
CREATE TEMP TABLE stage_galtd_report(payload jsonb NOT NULL);
CREATE TEMP TABLE stage_galtd_observation(payload jsonb NOT NULL);
CREATE TEMP TABLE stage_galtd_assertion(payload jsonb NOT NULL);
CREATE TEMP TABLE stage_thedogs_manifest(payload jsonb NOT NULL);
CREATE TEMP TABLE stage_thedogs_edge(payload jsonb NOT NULL);

\copy stage_input_manifest(payload) FROM PROGRAM 'jq -r "[tojson] | @csv" /app/input-manifest.json' WITH (FORMAT csv)
\copy stage_galtd_report(payload) FROM PROGRAM 'jq -r "[tojson] | @csv" /app/data/strict-audit-report.json' WITH (FORMAT csv)
\copy stage_galtd_observation(payload) FROM PROGRAM 'gzip -dc /app/data/galtd-observations.jsonl.gz | jq -r "[tojson] | @csv"' WITH (FORMAT csv)
\copy stage_galtd_assertion(payload) FROM PROGRAM 'gzip -dc /app/data/galtd-assertions.jsonl.gz | jq -r "[tojson] | @csv"' WITH (FORMAT csv)
\copy stage_thedogs_manifest(payload) FROM PROGRAM 'jq -r "[tojson] | @csv" /app/data/thedogs-manifest.json' WITH (FORMAT csv)
\copy stage_thedogs_edge(payload) FROM PROGRAM 'cat /app/data/thedogs-edges/pedigree_edges-*.jsonl | jq -r "[tojson] | @csv"' WITH (FORMAT csv)

CREATE INDEX stage_galtd_observation_source_idx
  ON stage_galtd_observation ((payload->>'sourceId'));
CREATE INDEX stage_galtd_assertion_subject_idx
  ON stage_galtd_assertion ((payload->>'subjectSourceId'));
CREATE INDEX stage_thedogs_edge_child_idx
  ON stage_thedogs_edge ((payload->>'childNaturalKey'));
CREATE INDEX stage_thedogs_edge_parent_idx
  ON stage_thedogs_edge ((payload->>'parentSourceId'));

ANALYZE stage_galtd_observation;
ANALYZE stage_galtd_assertion;
ANALYZE stage_thedogs_edge;

DO $$
DECLARE
  input jsonb;
  report jsonb;
  thedogs_manifest jsonb;
  observed_volumes integer[];
BEGIN
  IF (SELECT count(*) FROM stage_input_manifest) <> 1
     OR (SELECT count(*) FROM stage_galtd_report) <> 1
     OR (SELECT count(*) FROM stage_thedogs_manifest) <> 1 THEN
    RAISE EXCEPTION 'each input manifest must contain exactly one JSON object';
  END IF;

  SELECT payload INTO STRICT input FROM stage_input_manifest;
  SELECT payload INTO STRICT report FROM stage_galtd_report;
  SELECT payload INTO STRICT thedogs_manifest FROM stage_thedogs_manifest;

  IF input->>'artifactSetId' <> 'pedigree-forward-merge-20260721-r1'
     OR input->'galtd'->>'runInstanceId' <> report->>'runInstanceId'
     OR report->>'runInstanceId' <> 'galtd-audit:609c1505-33b2-4127-97f5-8aa54ca1b045'
     OR report->>'parserVersion' <> 'galtd-studbook-audit-v1'
     OR report->>'mode' <> 'parse-only'
     OR report->>'sourceProvider' <> 'galtd' THEN
    RAISE EXCEPTION 'GALTD lineage metadata mismatch';
  END IF;

  IF input->'thedogs'->>'runInstanceId' <> thedogs_manifest->'source'->>'runInstanceId'
     OR thedogs_manifest->'source'->>'runInstanceId' <> 'thedogs-export:582c410f-200f-4e41-b0ea-d18dbf10ec5a'
     OR thedogs_manifest->>'transformVersion' <> 'thedogs-normalized-harvest/v2'
     OR thedogs_manifest->'datasets'->'pedigree_edges'->>'sha256'
          <> input->'thedogs'->'pedigreeEdges'->>'datasetSha256' THEN
    RAISE EXCEPTION 'TheDogs normalized-v2 lineage metadata mismatch';
  END IF;

  IF (report->'totals'->>'observations')::bigint <> 105374
     OR (report->'totals'->>'assertions')::bigint <> 210734
     OR (report->'totals'->>'issues')::bigint <> 5
     OR (thedogs_manifest->'datasets'->'pedigree_edges'->>'rowCount')::bigint <> 384568
     OR (thedogs_manifest->'datasets'->'pedigree_edges'->>'bytes')::bigint <> 131970236
     OR (thedogs_manifest->'datasets'->'pedigree_edges'->>'shards')::integer <> 64 THEN
    RAISE EXCEPTION 'source manifest totals mismatch';
  END IF;

  SELECT array_agg(volume ORDER BY volume)
  INTO observed_volumes
  FROM (
    SELECT DISTINCT (payload->>'volume')::integer AS volume
    FROM stage_galtd_observation
  ) volumes;

  IF observed_volumes IS DISTINCT FROM ARRAY[66,67,68,69,70,71,72,73] THEN
    RAISE EXCEPTION 'GALTD volume set mismatch: %', observed_volumes;
  END IF;

  IF (SELECT count(*) FROM stage_galtd_observation) <> 105374
     OR (SELECT count(*) FROM stage_galtd_assertion) <> 210734
     OR (SELECT count(*) FROM stage_thedogs_edge) <> 384568 THEN
    RAISE EXCEPTION 'staged source row totals mismatch';
  END IF;
END
$$;

DO $$
DECLARE
  invalid_rows bigint;
  missing_subjects bigint;
  duplicate_edges bigint;
  conflict_observations bigint;
  conflict_assertions bigint;
  conflict_groups bigint;
BEGIN
  SELECT count(*) INTO invalid_rows
  FROM stage_galtd_observation observation
  LEFT JOIN LATERAL (
    SELECT source
    FROM stage_galtd_report report,
         jsonb_array_elements(report.payload->'sources') AS source
    WHERE source->>'artifactSha256'=observation.payload->>'artifactSha256'
  ) source ON true
  WHERE observation.payload->>'sourceProvider' <> 'galtd'
     OR observation.payload->>'sourceId' !~ '^galtd:vol-(66|67|68|69|70|71|72|73):page-[0-9]+:line-[0-9]+:offset-[0-9]+$'
     OR observation.payload->>'sourceName' IS NULL
     OR observation.payload->>'normalizedName' IS NULL
     OR observation.payload->>'evidenceSha256' !~ '^[0-9a-f]{64}$'
     OR observation.payload->>'artifactSha256' !~ '^[0-9a-f]{64}$'
     OR (observation.payload->>'artifactOffsetLine')::integer <= 0
     OR (observation.payload->>'sourcePage')::integer <= 0
     OR (observation.payload->>'sourceLine')::integer <= 0
     OR source IS NULL
     OR (source->>'volume')::integer <> (observation.payload->>'volume')::integer;
  IF invalid_rows <> 0 THEN
    RAISE EXCEPTION 'invalid GALTD observations: %', invalid_rows;
  END IF;

  SELECT count(*) INTO invalid_rows
  FROM stage_galtd_assertion
  WHERE payload->>'sourceProvider' <> 'galtd'
     OR payload->>'relationship' NOT IN ('sire','dam')
     OR payload->>'subjectSourceId' IS NULL
     OR payload->>'assertedParentName' IS NULL
     OR payload->>'assertedParentNormalizedName' IS NULL
     OR payload->>'evidenceSha256' !~ '^[0-9a-f]{64}$'
     OR payload->>'artifactSha256' !~ '^[0-9a-f]{64}$'
     OR (payload->>'artifactOffsetLine')::integer <= 0;
  IF invalid_rows <> 0 THEN
    RAISE EXCEPTION 'invalid GALTD assertions: %', invalid_rows;
  END IF;

  SELECT count(*) INTO missing_subjects
  FROM stage_galtd_assertion assertion
  LEFT JOIN stage_galtd_observation observation
    ON observation.payload->>'sourceId'=assertion.payload->>'subjectSourceId'
   AND observation.payload->>'artifactSha256'=assertion.payload->>'artifactSha256'
  WHERE observation.payload IS NULL;
  IF missing_subjects <> 0 THEN
    RAISE EXCEPTION 'GALTD assertions without exact source observation: %', missing_subjects;
  END IF;

  SELECT count(*), count(DISTINCT payload->>'conflictGroup')
  INTO conflict_observations, conflict_groups
  FROM stage_galtd_observation
  WHERE payload ? 'conflictGroup';
  SELECT count(*) INTO conflict_assertions
  FROM stage_galtd_assertion
  WHERE payload ? 'conflictGroup';
  IF conflict_observations <> 18 OR conflict_assertions <> 36 OR conflict_groups <> 5 THEN
    RAISE EXCEPTION 'GALTD conflict conservation mismatch: observations %, assertions %, groups %',
      conflict_observations, conflict_assertions, conflict_groups;
  END IF;

  SELECT count(*) INTO invalid_rows
  FROM stage_thedogs_edge
  WHERE payload->>'provider' <> 'thedogs'
     OR payload->>'childNaturalKey' !~ '^thedogs:dog:[0-9]+$'
     OR payload->>'parentNaturalKey' !~ '^thedogs:dog:[0-9]+$'
     OR payload->>'parentSourceId' !~ '^[0-9]+$'
     OR payload->>'relation' NOT IN ('sire','dam')
     OR payload->>'resolution' NOT IN ('profile-present','provider-stub')
     OR payload->>'parentName' IS NULL;
  IF invalid_rows <> 0 THEN
    RAISE EXCEPTION 'invalid TheDogs pedigree edges: %', invalid_rows;
  END IF;

  SELECT count(*) - count(DISTINCT (payload->>'childNaturalKey', payload->>'relation'))
  INTO duplicate_edges
  FROM stage_thedogs_edge;
  IF duplicate_edges <> 0 THEN
    RAISE EXCEPTION 'duplicate TheDogs child/relationship edges: %', duplicate_edges;
  END IF;

  IF (SELECT count(*) FROM stage_thedogs_edge WHERE payload->>'resolution'='profile-present') <> 216056
     OR (SELECT count(*) FROM stage_thedogs_edge WHERE payload->>'resolution'='provider-stub') <> 168512
     OR (SELECT count(*) FROM stage_thedogs_edge
         WHERE substring(payload->>'childNaturalKey' FROM '[0-9]+$')=payload->>'parentSourceId') <> 16 THEN
    RAISE EXCEPTION 'TheDogs pedigree resolution or self-parent inventory mismatch';
  END IF;
END
$$;

CREATE TEMP TABLE protected_before (
  relation_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  hash_seed_0 numeric NOT NULL,
  hash_seed_1 numeric NOT NULL
);

INSERT INTO protected_before
SELECT 'Meeting', count(*),
  coalesce(sum(hashtextextended(payload::text,0)::numeric),0),
  coalesce(sum(hashtextextended(payload::text,1)::numeric),0)
FROM (
  SELECT jsonb_build_array(id,"sourceProvider","sourceId") AS payload
  FROM public."Meeting"
) protected
UNION ALL
SELECT 'Race', count(*),
  coalesce(sum(hashtextextended(payload::text,0)::numeric),0),
  coalesce(sum(hashtextextended(payload::text,1)::numeric),0)
FROM (
  SELECT jsonb_build_array(id,"sourceProvider","sourceId","replayUrl") AS payload
  FROM public."Race"
) protected
UNION ALL
SELECT 'RaceVideo', count(*),
  coalesce(sum(hashtextextended(payload::text,0)::numeric),0),
  coalesce(sum(hashtextextended(payload::text,1)::numeric),0)
FROM (SELECT to_jsonb(video) AS payload FROM public."RaceVideo" video) protected
UNION ALL
SELECT 'Runner', count(*),
  coalesce(sum(hashtextextended(payload::text,0)::numeric),0),
  coalesce(sum(hashtextextended(payload::text,1)::numeric),0)
FROM (
  SELECT jsonb_build_array(id,"sourceProvider","sourceId") AS payload
  FROM public."Runner"
) protected
UNION ALL
SELECT 'DogSourceIdentityFields', count(*),
  coalesce(sum(hashtextextended(payload::text,0)::numeric),0),
  coalesce(sum(hashtextextended(payload::text,1)::numeric),0)
FROM (
  SELECT jsonb_build_array(id,"sourceProvider","sourceId") AS payload
  FROM public."Dog"
) protected;

CREATE TEMP TABLE expected_import_run AS
WITH input AS (
  SELECT payload FROM stage_input_manifest
),
galtd_report AS (
  SELECT payload FROM stage_galtd_report
),
galtd_runs AS (
  SELECT
    pg_temp.history_id(
      'galtdrun',
      concat_ws(':','galtd',report.payload->>'runInstanceId',source->>'artifactSha256')
    ) AS id,
    'galtd'::text AS "sourceProvider",
    100::integer AS "sourceAuthority",
    CASE WHEN EXISTS (
      SELECT 1 FROM stage_galtd_observation observation
      WHERE observation.payload->>'artifactSha256'=source->>'artifactSha256'
        AND observation.payload ? 'conflictGroup'
    ) THEN 'conflict' ELSE 'verified' END::text AS "verificationStatus",
    'merged'::text AS status,
    ('gs://giq-full-history-clever-bee-502514-m4/pedigree/galtd-studbooks-v66-v73/' ||
      (source->>'artifact'))::text AS "artifactUri",
    source->>'artifactSha256' AS "artifactSha256",
    (source->>'artifactBytes')::bigint AS "artifactBytes",
    ('Volume ' || (source->>'volume'))::text AS "sourceVolume",
    report.payload->>'parserVersion' AS "parserVersion",
    (source->>'observations')::integer AS "recordsObserved",
    (source->>'assertions')::integer AS "assertionsObserved",
    (SELECT count(*)::integer
     FROM stage_galtd_observation observation
     WHERE observation.payload->>'artifactSha256'=source->>'artifactSha256'
       AND observation.payload ? 'conflictGroup') AS "issuesObserved",
    (report.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "startedAt",
    (report.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "completedAt",
    (report.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "createdAt",
    (report.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "updatedAt"
  FROM galtd_report report,
       jsonb_array_elements(report.payload->'sources') source
),
thedogs_run AS (
  SELECT
    pg_temp.history_id(
      'pedrun',
      'thedogs:' || (manifest.payload->'datasets'->'pedigree_edges'->>'sha256')
    ) AS id,
    'thedogs'::text AS "sourceProvider",
    200::integer AS "sourceAuthority",
    'verified'::text AS "verificationStatus",
    'merged'::text AS status,
    'gs://giq-full-history-clever-bee-502514-m4/normalized/thedogs-normalized-v2-a43d10e4aaa5ef82/pedigree_edges/'::text
      AS "artifactUri",
    manifest.payload->'datasets'->'pedigree_edges'->>'sha256' AS "artifactSha256",
    (manifest.payload->'datasets'->'pedigree_edges'->>'bytes')::bigint AS "artifactBytes",
    'historical-pedigree-edges'::text AS "sourceVolume",
    manifest.payload->>'transformVersion' AS "parserVersion",
    (SELECT count(DISTINCT source_id)::integer
     FROM (
       SELECT substring(payload->>'childNaturalKey' FROM '[0-9]+$') AS source_id
       FROM stage_thedogs_edge
       UNION
       SELECT payload->>'parentSourceId' FROM stage_thedogs_edge
     ) identities) AS "recordsObserved",
    (SELECT count(*)::integer FROM stage_thedogs_edge) AS "assertionsObserved",
    (SELECT count(*)::integer FROM stage_thedogs_edge
     WHERE payload->>'resolution'<>'profile-present'
        OR substring(payload->>'childNaturalKey' FROM '[0-9]+$')=payload->>'parentSourceId')
      AS "issuesObserved",
    (manifest.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "startedAt",
    (manifest.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "completedAt",
    (manifest.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "createdAt",
    (manifest.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "updatedAt"
  FROM stage_thedogs_manifest manifest
)
SELECT * FROM galtd_runs
UNION ALL
SELECT * FROM thedogs_run;

DO $$
BEGIN
  IF (SELECT count(*) FROM expected_import_run WHERE "sourceProvider"='galtd') <> 8
     OR (SELECT count(*) FROM expected_import_run WHERE "sourceProvider"='thedogs') <> 1
     OR (SELECT "recordsObserved" FROM expected_import_run WHERE "sourceProvider"='thedogs') <> 205402 THEN
    RAISE EXCEPTION 'pedigree import-run inventory mismatch';
  END IF;
END
$$;

INSERT INTO public."PedigreeImportRun"
SELECT * FROM expected_import_run
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM expected_import_run expected
    LEFT JOIN public."PedigreeImportRun" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'pedigree import-run exact-ID retry detected full-row payload drift';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public."Dog" dog
    JOIN (
      SELECT payload->>'sourceId' AS source_id
      FROM stage_galtd_observation
      UNION ALL
      SELECT substring(payload->>'childNaturalKey' FROM '[0-9]+$')
      FROM stage_thedogs_edge
      UNION ALL
      SELECT payload->>'parentSourceId'
      FROM stage_thedogs_edge
    ) staged
      ON dog."sourceId"=staged.source_id
     AND dog."sourceProvider"=CASE
       WHEN staged.source_id LIKE 'galtd:%' THEN 'galtd'
       ELSE 'thedogs'
     END
    GROUP BY dog."sourceProvider", dog."sourceId"
    HAVING count(DISTINCT dog.id) > 1
  ) THEN
    RAISE EXCEPTION 'live Dog contains duplicate exact provider/source identities needed by pedigree merge';
  END IF;
END
$$;

CREATE TEMP TABLE galtd_identity_occurrence AS
SELECT
  observation.payload,
  pg_temp.history_id(
    'dogidentity',
    concat_ws(':','galtd',report.payload->>'runInstanceId',
      observation.payload->>'artifactSha256',observation.payload->>'artifactOffsetLine',
      observation.payload->>'evidenceSha256',observation.payload->>'sourceId')
  ) AS identity_id,
  pg_temp.history_id(
    'galtdrun',
    concat_ws(':','galtd',report.payload->>'runInstanceId',observation.payload->>'artifactSha256')
  ) AS import_run_id,
  dog.id AS dog_id
FROM stage_galtd_observation observation
CROSS JOIN stage_galtd_report report
LEFT JOIN public."Dog" dog
  ON dog."sourceProvider"='galtd'
 AND dog."sourceId"=observation.payload->>'sourceId';

CREATE UNIQUE INDEX galtd_identity_occurrence_id_key
  ON galtd_identity_occurrence(identity_id);
CREATE INDEX galtd_identity_occurrence_source_key
  ON galtd_identity_occurrence((payload->>'sourceId'));

CREATE TEMP TABLE expected_galtd_identity AS
SELECT
  occurrence.identity_id AS id,
  occurrence.dog_id AS "dogId",
  occurrence.import_run_id AS "importRunId",
  'galtd'::text AS "sourceProvider",
  occurrence.payload->>'artifactSha256' AS "artifactSha256",
  occurrence.payload->>'sourceId' AS "sourceId",
  left(occurrence.payload->>'sourceName',200) AS "sourceName",
  left(occurrence.payload->>'normalizedName',200) AS "normalizedName",
  nullif(left(occurrence.payload->>'registryToken',100),'') AS "registryToken",
  (occurrence.dog_id IS NOT NULL) AS imported,
  nullif(occurrence.payload->>'sex','') AS "observedSex",
  nullif(left(occurrence.payload->>'colour',100),'') AS "observedColour",
  (occurrence.payload->>'whelpDate')::timestamptz AT TIME ZONE 'UTC' AS "observedWhelpDate",
  100::integer AS "sourceAuthority",
  CASE WHEN occurrence.payload ? 'conflictGroup' THEN 'conflict'
       WHEN occurrence.dog_id IS NOT NULL THEN 'verified'
       ELSE 'parsed' END::text AS "verificationStatus",
  (occurrence.payload->>'sourcePage')::integer AS "sourcePage",
  (occurrence.payload->>'sourceLine')::integer AS "sourceLine",
  (occurrence.payload->>'artifactOffsetLine')::integer AS "artifactOffsetLine",
  occurrence.payload->>'evidenceSha256' AS "evidenceSha256",
  (report.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "createdAt",
  (report.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "updatedAt"
FROM galtd_identity_occurrence occurrence
CROSS JOIN stage_galtd_report report;

INSERT INTO public."DogSourceIdentity"
SELECT * FROM expected_galtd_identity
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM expected_galtd_identity) <> 105374
     OR EXISTS (
       SELECT 1
       FROM expected_galtd_identity expected
       LEFT JOIN public."DogSourceIdentity" canonical USING(id)
       WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
     ) THEN
    RAISE EXCEPTION 'GALTD identity conservation or exact-row retry check failed';
  END IF;
END
$$;

CREATE TEMP TABLE thedogs_identity_source AS
WITH ids AS (
  SELECT substring(payload->>'childNaturalKey' FROM '[0-9]+$') AS source_id
  FROM stage_thedogs_edge
  UNION
  SELECT payload->>'parentSourceId' FROM stage_thedogs_edge
),
names AS (
  SELECT payload->>'parentSourceId' AS source_id,
         min(left(payload->>'parentName',200)) AS source_name
  FROM stage_thedogs_edge
  GROUP BY payload->>'parentSourceId'
)
SELECT
  ids.source_id,
  coalesce(names.source_name,'TheDogs source ' || ids.source_id) AS source_name,
  row_number() OVER(ORDER BY ids.source_id::bigint)::integer AS artifact_offset_line
FROM ids
LEFT JOIN names USING(source_id);

CREATE UNIQUE INDEX thedogs_identity_source_key
  ON thedogs_identity_source(source_id);

ANALYZE thedogs_identity_source;
ANALYZE stage_thedogs_manifest;
ANALYZE expected_import_run;

CREATE TEMP TABLE live_thedogs_dog_map AS
SELECT dog."sourceId" AS source_id,dog.id AS dog_id
FROM public."Dog" dog
WHERE dog."sourceProvider"='thedogs';

CREATE UNIQUE INDEX live_thedogs_dog_map_source_key
  ON live_thedogs_dog_map(source_id);
ANALYZE live_thedogs_dog_map;

CREATE TEMP TABLE thedogs_context AS
SELECT
  run.id AS import_run_id,
  run."artifactSha256" AS artifact_sha256,
  manifest.payload->'source'->>'runInstanceId' AS run_instance_id,
  (manifest.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS generated_at
FROM expected_import_run run
CROSS JOIN stage_thedogs_manifest manifest
WHERE run."sourceProvider"='thedogs';

ANALYZE thedogs_context;

CREATE TEMP TABLE expected_thedogs_identity AS
SELECT
  ('hist_dogidentity_' || md5(concat_ws(':','thedogs',context.run_instance_id,
    context.artifact_sha256,identity.source_id)))::text AS id,
  dog.dog_id AS "dogId",
  context.import_run_id AS "importRunId",
  'thedogs'::text AS "sourceProvider",
  context.artifact_sha256 AS "artifactSha256",
  identity.source_id AS "sourceId",
  identity.source_name AS "sourceName",
  left(lower(btrim(identity.source_name)),200) AS "normalizedName",
  NULL::text AS "registryToken",
  (dog.dog_id IS NOT NULL) AS imported,
  NULL::text AS "observedSex",
  NULL::text AS "observedColour",
  NULL::timestamp AS "observedWhelpDate",
  200::integer AS "sourceAuthority",
  CASE WHEN dog.dog_id IS NULL THEN 'parsed' ELSE 'verified' END::text AS "verificationStatus",
  NULL::integer AS "sourcePage",
  NULL::integer AS "sourceLine",
  identity.artifact_offset_line AS "artifactOffsetLine",
  encode(digest(convert_to(
    concat_ws('|','thedogs',identity.source_id,identity.source_name,context.run_instance_id),
    'UTF8'),'sha256'),'hex') AS "evidenceSha256",
  context.generated_at AS "createdAt",
  context.generated_at AS "updatedAt"
FROM thedogs_identity_source identity
CROSS JOIN thedogs_context context
LEFT JOIN live_thedogs_dog_map dog ON dog.source_id=identity.source_id;

CREATE UNIQUE INDEX expected_thedogs_identity_source_key
  ON expected_thedogs_identity("sourceId");

INSERT INTO public."DogSourceIdentity"
SELECT * FROM expected_thedogs_identity
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM expected_thedogs_identity) <> 205402
     OR EXISTS (
       SELECT 1
       FROM expected_thedogs_identity expected
       LEFT JOIN public."DogSourceIdentity" canonical USING(id)
       WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
     ) THEN
    RAISE EXCEPTION 'TheDogs identity conservation or exact-row retry check failed';
  END IF;
END
$$;

CREATE TEMP TABLE galtd_assertion_occurrence AS
SELECT
  assertion.payload,
  subject.import_run_id,
  subject.identity_id AS subject_identity_id,
  pg_temp.history_id(
    'pedassert',
    concat_ws(':','galtd',report.payload->>'runInstanceId',
      assertion.payload->>'artifactSha256',assertion.payload->>'artifactOffsetLine',
      assertion.payload->>'evidenceSha256',assertion.payload->>'relationship',
      assertion.payload->>'sourceId')
  ) AS assertion_id
FROM stage_galtd_assertion assertion
JOIN galtd_identity_occurrence subject
  ON subject.payload->>'sourceId'=assertion.payload->>'subjectSourceId'
 AND subject.payload->>'artifactSha256'=assertion.payload->>'artifactSha256'
CROSS JOIN stage_galtd_report report;

CREATE UNIQUE INDEX galtd_assertion_occurrence_id_key
  ON galtd_assertion_occurrence(assertion_id);

CREATE TEMP TABLE expected_galtd_assertion AS
SELECT
  occurrence.assertion_id AS id,
  occurrence.import_run_id AS "importRunId",
  'galtd'::text AS "sourceProvider",
  occurrence.payload->>'artifactSha256' AS "artifactSha256",
  occurrence.subject_identity_id AS "subjectIdentityId",
  NULL::text AS "parentIdentityId",
  occurrence.payload->>'relationship' AS relationship,
  left(occurrence.payload->>'assertedParentName',200) AS "assertedParentName",
  left(occurrence.payload->>'assertedParentNormalizedName',200) AS "assertedParentNormalizedName",
  nullif(left(occurrence.payload->>'assertedParentRegistryToken',100),'')
    AS "assertedParentRegistryToken",
  100::integer AS "sourceAuthority",
  CASE WHEN occurrence.payload ? 'conflictGroup' THEN 'conflict'
       ELSE 'parsed' END::text AS "verificationStatus",
  (occurrence.payload->>'sourcePage')::integer AS "sourcePage",
  (occurrence.payload->>'sourceLine')::integer AS "sourceLine",
  (occurrence.payload->>'artifactOffsetLine')::integer AS "artifactOffsetLine",
  occurrence.payload->>'evidenceSha256' AS "evidenceSha256",
  (report.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "createdAt",
  (report.payload->>'generatedAt')::timestamptz AT TIME ZONE 'UTC' AS "updatedAt"
FROM galtd_assertion_occurrence occurrence
CROSS JOIN stage_galtd_report report;

INSERT INTO public."PedigreeAssertion"
SELECT * FROM expected_galtd_assertion
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM expected_galtd_assertion) <> 210734
     OR EXISTS (
       SELECT 1
       FROM expected_galtd_assertion expected
       LEFT JOIN public."PedigreeAssertion" canonical USING(id)
       WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
     ) THEN
    RAISE EXCEPTION 'GALTD assertion conservation or exact-row retry check failed';
  END IF;
END
$$;

CREATE TEMP TABLE thedogs_assertion_occurrence AS
WITH ordered AS (
  SELECT
    edge.payload,
    substring(edge.payload->>'childNaturalKey' FROM '[0-9]+$') AS child_source_id,
    edge.payload->>'parentSourceId' AS parent_source_id,
    row_number() OVER(ORDER BY edge.payload->>'naturalKey')::integer AS artifact_offset_line,
    encode(digest(convert_to(edge.payload::text,'UTF8'),'sha256'),'hex') AS evidence_sha256
  FROM stage_thedogs_edge edge
)
SELECT
  ordered.*,
  subject.id AS subject_identity_id,
  parent.id AS parent_identity_id,
  subject."dogId" AS child_dog_id,
  parent."dogId" AS parent_dog_id,
  context.import_run_id,
  context.artifact_sha256,
  ('hist_pedassert_' || md5(concat_ws(':','thedogs',context.run_instance_id,
    context.artifact_sha256,ordered.artifact_offset_line::text,ordered.evidence_sha256,
    ordered.payload->>'relation',ordered.payload->>'naturalKey')))::text AS assertion_id
FROM ordered
JOIN expected_thedogs_identity subject ON subject."sourceId"=ordered.child_source_id
JOIN expected_thedogs_identity parent ON parent."sourceId"=ordered.parent_source_id
CROSS JOIN thedogs_context context;

CREATE UNIQUE INDEX thedogs_assertion_occurrence_id_key
  ON thedogs_assertion_occurrence(assertion_id);
CREATE UNIQUE INDEX thedogs_assertion_occurrence_child_relation_key
  ON thedogs_assertion_occurrence(child_source_id,((payload->>'relation')));

CREATE TEMP TABLE expected_thedogs_assertion AS
SELECT
  occurrence.assertion_id AS id,
  occurrence.import_run_id AS "importRunId",
  'thedogs'::text AS "sourceProvider",
  occurrence.artifact_sha256 AS "artifactSha256",
  occurrence.subject_identity_id AS "subjectIdentityId",
  CASE WHEN occurrence.child_source_id=occurrence.parent_source_id
       THEN NULL ELSE occurrence.parent_identity_id END AS "parentIdentityId",
  occurrence.payload->>'relation' AS relationship,
  left(occurrence.payload->>'parentName',200) AS "assertedParentName",
  left(lower(btrim(occurrence.payload->>'parentName')),200) AS "assertedParentNormalizedName",
  NULL::text AS "assertedParentRegistryToken",
  200::integer AS "sourceAuthority",
  CASE WHEN occurrence.child_source_id=occurrence.parent_source_id THEN 'rejected'
       WHEN occurrence.payload->>'resolution'='profile-present' THEN 'verified'
       ELSE 'parsed' END::text AS "verificationStatus",
  NULL::integer AS "sourcePage",
  NULL::integer AS "sourceLine",
  occurrence.artifact_offset_line AS "artifactOffsetLine",
  occurrence.evidence_sha256 AS "evidenceSha256",
  context.generated_at AS "createdAt",
  context.generated_at AS "updatedAt"
FROM thedogs_assertion_occurrence occurrence
CROSS JOIN thedogs_context context;

INSERT INTO public."PedigreeAssertion"
SELECT * FROM expected_thedogs_assertion
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM expected_thedogs_assertion) <> 384568
     OR EXISTS (
       SELECT 1
       FROM expected_thedogs_assertion expected
       LEFT JOIN public."PedigreeAssertion" canonical USING(id)
       WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
     ) THEN
    RAISE EXCEPTION 'TheDogs assertion conservation or exact-row retry check failed';
  END IF;
END
$$;

CREATE TEMP TABLE expected_galtd_ledger AS
WITH candidate AS (
  SELECT
    pg_temp.history_id('pedledger','forward:galtd:' || assertion.id) AS id,
    assertion."importRunId",
    assertion."sourceProvider",
    assertion."artifactSha256",
    assertion.id AS "assertionId",
    identity."dogId" AS "dogId",
    CASE assertion.relationship
      WHEN 'sire' THEN dog."sireId" ELSE dog."damId"
    END AS current_parent_id,
    assertion.relationship,
    assertion."verificationStatus",
    assertion."createdAt"
  FROM expected_galtd_assertion assertion
  JOIN expected_galtd_identity identity ON identity.id=assertion."subjectIdentityId"
  JOIN public."Dog" dog ON dog.id=identity."dogId"
)
SELECT
  candidate.id,
  candidate."importRunId",
  candidate."sourceProvider",
  candidate."artifactSha256",
  candidate."assertionId",
  NULL::text AS "winningAssertionId",
  candidate."dogId",
  coalesce(prior."existingParentDogId",candidate.current_parent_id) AS "existingParentDogId",
  NULL::text AS "proposedParentDogId",
  candidate.relationship,
  CASE WHEN candidate."verificationStatus"='conflict'
       THEN 'quarantined_conflict' ELSE 'rejected_ambiguous' END::text AS decision,
  CASE WHEN candidate."verificationStatus"='conflict'
       THEN 'galtd-conflict-quarantined'
       ELSE 'galtd-parent-name-no-stable-id' END::text AS "reasonCode",
  100::integer AS "sourceAuthority",
  CASE WHEN candidate."verificationStatus"='conflict'
       THEN 'conflict' ELSE 'rejected' END::text AS "verificationStatus",
  candidate."createdAt"
FROM candidate
LEFT JOIN public."PedigreeMergeLedger" prior ON prior.id=candidate.id;

INSERT INTO public."PedigreeMergeLedger"
SELECT * FROM expected_galtd_ledger
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM expected_galtd_ledger expected
    LEFT JOIN public."PedigreeMergeLedger" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'GALTD merge-ledger exact-ID retry detected full-row payload drift';
  END IF;
END
$$;

CREATE TEMP TABLE thedogs_decision AS
SELECT
  pg_temp.history_id('pedledger','forward:thedogs:' || assertion.assertion_id) AS ledger_id,
  assertion.assertion_id,
  assertion.import_run_id,
  assertion.artifact_sha256,
  assertion.child_dog_id,
  assertion.parent_dog_id,
  assertion.payload->>'relation' AS relationship,
  CASE assertion.payload->>'relation'
    WHEN 'sire' THEN dog."sireId" ELSE dog."damId"
  END AS existing_parent_id,
  CASE
    WHEN assertion.child_source_id=assertion.parent_source_id THEN 'rejected_ambiguous'
    WHEN assertion.payload->>'resolution'<>'profile-present' THEN 'rejected_ambiguous'
    WHEN assertion.parent_dog_id IS NULL THEN 'rejected_ambiguous'
    WHEN (CASE assertion.payload->>'relation'
          WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END) IS NULL THEN 'accepted'
    WHEN (CASE assertion.payload->>'relation'
          WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)=assertion.parent_dog_id THEN 'no_change'
    ELSE 'preserved_higher_authority'
  END::text AS calculated_decision,
  CASE
    WHEN assertion.child_source_id=assertion.parent_source_id THEN 'self-parent-rejected'
    WHEN assertion.payload->>'resolution'<>'profile-present' THEN 'provider-stub-not-verified'
    WHEN assertion.parent_dog_id IS NULL THEN 'exact-parent-identity-not-present'
    WHEN (CASE assertion.payload->>'relation'
          WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END) IS NULL
      THEN 'stable-provider-parent-linked'
    WHEN (CASE assertion.payload->>'relation'
          WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)=assertion.parent_dog_id
      THEN 'stable-provider-parent-already-linked'
    ELSE 'existing-parent-preserved'
  END::text AS calculated_reason_code
FROM thedogs_assertion_occurrence assertion
JOIN public."Dog" dog ON dog.id=assertion.child_dog_id;

CREATE UNIQUE INDEX thedogs_decision_ledger_key ON thedogs_decision(ledger_id);
CREATE UNIQUE INDEX thedogs_decision_dog_relation_key
  ON thedogs_decision(child_dog_id,relationship);

CREATE TEMP TABLE expected_thedogs_ledger AS
SELECT
  decision.ledger_id AS id,
  decision.import_run_id AS "importRunId",
  'thedogs'::text AS "sourceProvider",
  decision.artifact_sha256 AS "artifactSha256",
  decision.assertion_id AS "assertionId",
  CASE WHEN coalesce(prior.decision,decision.calculated_decision) IN ('accepted','no_change')
       THEN decision.assertion_id ELSE NULL END AS "winningAssertionId",
  decision.child_dog_id AS "dogId",
  CASE WHEN prior.id IS NOT NULL THEN prior."existingParentDogId"
       ELSE decision.existing_parent_id END AS "existingParentDogId",
  CASE WHEN decision.child_dog_id=decision.parent_dog_id
       THEN NULL ELSE decision.parent_dog_id END AS "proposedParentDogId",
  decision.relationship,
  coalesce(prior.decision,decision.calculated_decision) AS decision,
  coalesce(prior."reasonCode",decision.calculated_reason_code) AS "reasonCode",
  200::integer AS "sourceAuthority",
  CASE coalesce(prior.decision,decision.calculated_decision)
    WHEN 'accepted' THEN 'verified'
    WHEN 'no_change' THEN 'verified'
    WHEN 'preserved_higher_authority' THEN 'conflict'
    ELSE 'rejected'
  END::text AS "verificationStatus",
  context.generated_at AS "createdAt"
FROM thedogs_decision decision
LEFT JOIN public."PedigreeMergeLedger" prior ON prior.id=decision.ledger_id
CROSS JOIN thedogs_context context;

INSERT INTO public."PedigreeMergeLedger"
SELECT * FROM expected_thedogs_ledger
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM expected_thedogs_ledger expected
    LEFT JOIN public."PedigreeMergeLedger" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'TheDogs merge-ledger exact-ID retry detected full-row payload drift';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM expected_thedogs_ledger ledger
    JOIN public."Dog" dog ON dog.id=ledger."dogId"
    WHERE ledger.decision='accepted'
      AND (CASE ledger.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
          IS NOT NULL
      AND (CASE ledger.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
          IS DISTINCT FROM ledger."proposedParentDogId"
  ) THEN
    RAISE EXCEPTION 'previously accepted TheDogs parent decision drifted from its exact provider identity';
  END IF;
END
$$;

CREATE TEMP TABLE accepted_parent_update AS
SELECT ledger."dogId" AS child_id,
       ledger."proposedParentDogId" AS parent_id,
       ledger.relationship
FROM expected_thedogs_ledger ledger
JOIN public."Dog" dog ON dog.id=ledger."dogId"
WHERE ledger.decision='accepted'
  AND ledger."proposedParentDogId" IS NOT NULL
  AND (CASE ledger.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END) IS NULL;

CREATE UNIQUE INDEX accepted_parent_update_child_relation_key
  ON accepted_parent_update(child_id,relationship);

DO $$
DECLARE
  cycle_rows bigint;
  depth_limit_rows bigint;
BEGIN
  WITH RECURSIVE ancestry(origin_id,node_id,depth,path,is_cycle) AS (
    SELECT candidate_update.child_id,candidate_update.parent_id,1,
           ARRAY[candidate_update.child_id,candidate_update.parent_id],
           candidate_update.parent_id=candidate_update.child_id
    FROM accepted_parent_update candidate_update
    UNION ALL
    SELECT ancestry.origin_id,parent.parent_id,ancestry.depth+1,
           ancestry.path || parent.parent_id,
           parent.parent_id=ANY(ancestry.path)
    FROM ancestry
    JOIN LATERAL (
      SELECT dog."sireId" AS parent_id
      FROM public."Dog" dog
      WHERE dog.id=ancestry.node_id AND dog."sireId" IS NOT NULL
      UNION ALL
      SELECT dog."damId"
      FROM public."Dog" dog
      WHERE dog.id=ancestry.node_id AND dog."damId" IS NOT NULL
      UNION ALL
      SELECT candidate_update.parent_id
      FROM accepted_parent_update candidate_update
      WHERE candidate_update.child_id=ancestry.node_id
    ) parent ON true
    WHERE NOT ancestry.is_cycle AND ancestry.depth < 64
  )
  SELECT count(*) FILTER(WHERE is_cycle),count(*) FILTER(WHERE depth=64 AND NOT is_cycle)
  INTO cycle_rows,depth_limit_rows
  FROM ancestry;

  IF cycle_rows <> 0 THEN
    RAISE EXCEPTION 'exact-provider parent batch would create or enter a pedigree cycle: % paths', cycle_rows;
  END IF;
  IF depth_limit_rows <> 0 THEN
    RAISE EXCEPTION 'pedigree cycle proof reached its fail-closed depth limit: % paths', depth_limit_rows;
  END IF;
END
$$;

UPDATE public."Dog" dog
SET "sireId"=candidate_update.parent_id,
    "updatedAt"=CURRENT_TIMESTAMP
FROM accepted_parent_update candidate_update
WHERE candidate_update.relationship='sire'
  AND dog.id=candidate_update.child_id
  AND dog."sireId" IS NULL;

UPDATE public."Dog" dog
SET "damId"=candidate_update.parent_id,
    "updatedAt"=CURRENT_TIMESTAMP
FROM accepted_parent_update candidate_update
WHERE candidate_update.relationship='dam'
  AND dog.id=candidate_update.child_id
  AND dog."damId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM accepted_parent_update candidate_update
    JOIN public."Dog" dog ON dog.id=candidate_update.child_id
    WHERE (CASE candidate_update.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
          IS DISTINCT FROM candidate_update.parent_id
  ) THEN
    RAISE EXCEPTION 'accepted exact-provider parent batch was not applied completely';
  END IF;
END
$$;

CREATE TEMP TABLE protected_after (
  relation_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  hash_seed_0 numeric NOT NULL,
  hash_seed_1 numeric NOT NULL
);

INSERT INTO protected_after
SELECT 'Meeting', count(*),
  coalesce(sum(hashtextextended(payload::text,0)::numeric),0),
  coalesce(sum(hashtextextended(payload::text,1)::numeric),0)
FROM (
  SELECT jsonb_build_array(id,"sourceProvider","sourceId") AS payload
  FROM public."Meeting"
) protected
UNION ALL
SELECT 'Race', count(*),
  coalesce(sum(hashtextextended(payload::text,0)::numeric),0),
  coalesce(sum(hashtextextended(payload::text,1)::numeric),0)
FROM (
  SELECT jsonb_build_array(id,"sourceProvider","sourceId","replayUrl") AS payload
  FROM public."Race"
) protected
UNION ALL
SELECT 'RaceVideo', count(*),
  coalesce(sum(hashtextextended(payload::text,0)::numeric),0),
  coalesce(sum(hashtextextended(payload::text,1)::numeric),0)
FROM (SELECT to_jsonb(video) AS payload FROM public."RaceVideo" video) protected
UNION ALL
SELECT 'Runner', count(*),
  coalesce(sum(hashtextextended(payload::text,0)::numeric),0),
  coalesce(sum(hashtextextended(payload::text,1)::numeric),0)
FROM (
  SELECT jsonb_build_array(id,"sourceProvider","sourceId") AS payload
  FROM public."Runner"
) protected
UNION ALL
SELECT 'DogSourceIdentityFields', count(*),
  coalesce(sum(hashtextextended(payload::text,0)::numeric),0),
  coalesce(sum(hashtextextended(payload::text,1)::numeric),0)
FROM (
  SELECT jsonb_build_array(id,"sourceProvider","sourceId") AS payload
  FROM public."Dog"
) protected;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM protected_before before
    FULL JOIN protected_after after USING(relation_name)
    WHERE before.relation_name IS NULL OR after.relation_name IS NULL
       OR before.row_count <> after.row_count
       OR before.hash_seed_0 <> after.hash_seed_0
       OR before.hash_seed_1 <> after.hash_seed_1
  ) THEN
    RAISE EXCEPTION 'protected racing, replay, runner, or dog source identity fields changed';
  END IF;
END
$$;

SELECT jsonb_pretty(jsonb_build_object(
  'mode',CASE WHEN :'apply_mode'::boolean THEN 'apply' ELSE 'verify-rollback' END,
  'galtd',jsonb_build_object(
    'volumes',(SELECT jsonb_agg("sourceVolume" ORDER BY "sourceVolume")
               FROM expected_import_run WHERE "sourceProvider"='galtd'),
    'observations',(SELECT count(*) FROM expected_galtd_identity),
    'assertions',(SELECT count(*) FROM expected_galtd_assertion),
    'directDogIdentities',(SELECT count(*) FROM expected_galtd_identity WHERE "dogId" IS NOT NULL),
    'quarantinedConflicts',(SELECT count(*) FROM expected_galtd_ledger
                            WHERE decision='quarantined_conflict'),
    'nameOnlyParentsLinked',0
  ),
  'thedogs',jsonb_build_object(
    'sourceIdentities',(SELECT count(*) FROM expected_thedogs_identity),
    'directDogIdentities',(SELECT count(*) FROM expected_thedogs_identity WHERE "dogId" IS NOT NULL),
    'assertions',(SELECT count(*) FROM expected_thedogs_assertion),
    'acceptedParentUpdates',(SELECT count(*) FROM accepted_parent_update),
    'decisions',(SELECT jsonb_object_agg(decision,total)
                 FROM (SELECT decision,count(*) AS total
                       FROM expected_thedogs_ledger GROUP BY decision ORDER BY decision) counts)
  ),
  'protectedRelations',(SELECT jsonb_object_agg(relation_name,row_count)
                        FROM protected_after),
  'protectedHashesEqual',true
)) AS pedigree_forward_merge_report;

\if :apply_mode
COMMIT;
\else
ROLLBACK;
\endif
