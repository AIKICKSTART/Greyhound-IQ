\set ON_ERROR_STOP on

-- Invoke with psql -v source_evidence_file=... -v retrieval_queue_file=....
-- The files are immutable JSONL artifacts; this stage never retrieves a provider.
\if :{?source_evidence_file}
\else
\quit
\endif
\if :{?retrieval_queue_file}
\else
\quit
\endif
\if :{?manifest_file}
\else
\quit
\endif
\if :{?manifest_sha_file}
\else
\quit
\endif

BEGIN;
SET LOCAL app.system='true';
SET LOCAL "app.current_role"='system';
SET LOCAL synchronous_commit=on;
SET LOCAL statement_timeout=0;

DO $$
DECLARE observed_phase text;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'duplicate/quarantine source evidence database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase FROM _giq_history_merge.run WHERE id=1 FOR UPDATE;
  IF observed_phase<>'normalized' THEN
    RAISE EXCEPTION 'duplicate/quarantine source evidence requires normalized, observed %',observed_phase;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS _giq_history_merge.duplicate_quarantine_source_evidence_manifest (
  manifest_sha256 text PRIMARY KEY CHECK(manifest_sha256='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c'),
  normalized_manifest_sha256 text NOT NULL CHECK(normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  source_inventory_sha256 text NOT NULL CHECK(source_inventory_sha256 ~ '^[0-9a-f]{64}$'),
  source_cutoff timestamptz NOT NULL,
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  retrieval_queue_sha256 text NOT NULL CHECK(retrieval_queue_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_rows bigint NOT NULL CHECK(evidence_rows=2022),
  duplicate_rows bigint NOT NULL CHECK(duplicate_rows=1940),
  quarantine_rows bigint NOT NULL CHECK(quarantine_rows=82),
  preliminary_exact_rows bigint NOT NULL CHECK(preliminary_exact_rows=30),
  preliminary_complementary_rows bigint NOT NULL CHECK(preliminary_complementary_rows=97),
  identity_conflict_or_unknown_rows bigint NOT NULL CHECK(identity_conflict_or_unknown_rows=1895),
  profile_source_artifact_quarantine_rows bigint NOT NULL CHECK(profile_source_artifact_quarantine_rows=115),
  commercial_production_use_authorized boolean NOT NULL CHECK(NOT commercial_production_use_authorized),
  canonical_promotion_eligible boolean NOT NULL CHECK(NOT canonical_promotion_eligible),
  duplicate_removal_eligible boolean NOT NULL CHECK(NOT duplicate_removal_eligible),
  quarantine_release_eligible boolean NOT NULL CHECK(NOT quarantine_release_eligible),
  raw_manifest_body text NOT NULL,
  raw_manifest_sha256 text NOT NULL CHECK(raw_manifest_sha256=manifest_sha256),
  raw_manifest_sidecar text NOT NULL,
  raw_manifest jsonb NOT NULL CHECK(jsonb_typeof(raw_manifest)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Establish the shared immutable issue inventory before source evidence so its
-- deterministic issue_id can be a real FK, never a later mutable attachment.
CREATE TABLE IF NOT EXISTS _giq_history_stage.duplicate_quarantine_issue (
  source_dataset text NOT NULL CHECK(source_dataset IN ('duplicates','quarantine')),
  source_file text NOT NULL,line_number bigint NOT NULL,
  issue_id text NOT NULL UNIQUE CHECK(issue_id ~ '^[0-9a-f]{64}$'),
  issue_type text NOT NULL,source_natural_key text NOT NULL,
  source_payload_sha256 text NOT NULL CHECK(source_payload_sha256 ~ '^[0-9a-f]{64}$'),
  source_payload jsonb NOT NULL CHECK(jsonb_typeof(source_payload)='object'),
  canonical_entity_type text NOT NULL CHECK(canonical_entity_type IN ('Race','Runner','SourceArtifact')),
  exact_existing_candidate_id text,exact_existing_candidate_count bigint NOT NULL CHECK(exact_existing_candidate_count IN (0,1)),
  similarity_only_match_allowed boolean NOT NULL CHECK(NOT similarity_only_match_allowed),
  create_entity_allowed boolean NOT NULL CHECK(NOT create_entity_allowed),
  required_proofs jsonb NOT NULL CHECK(jsonb_typeof(required_proofs)='array'),
  normalized_manifest_sha256 text NOT NULL CHECK(normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'),source_history_cutoff timestamptz NOT NULL,
  PRIMARY KEY(source_dataset,source_file,line_number),
  UNIQUE(source_dataset,source_file,line_number,source_payload_sha256,normalized_manifest_sha256,source_history_cutoff)
);
WITH marker AS (SELECT normalized_manifest_sha256,source_history_cutoff FROM _giq_history_merge.run WHERE id=1), source_rows AS (
  SELECT 'duplicates'::text source_dataset,d.source_file,d.line_number,d.payload->>'issueType' issue_type,d.payload->>'naturalKey' source_natural_key,d.payload,'Runner'::text canonical_entity_type,
    CASE WHEN canonical.id IS NOT NULL THEN runner.target_id END exact_existing_candidate_id,CASE WHEN canonical.id IS NOT NULL THEN 1 ELSE 0 END::bigint exact_existing_candidate_count
  FROM _giq_history_stage.export_duplicates d LEFT JOIN _giq_history_stage.runner_map runner ON runner.source_name='export' AND runner.source_id=d.payload->>'naturalKey' LEFT JOIN public."Runner" canonical ON canonical.id=runner.target_id
  UNION ALL
  SELECT 'quarantine',q.source_file,q.line_number,q.payload->>'issueType',coalesce(nullif(q.payload->>'naturalKey',''),'source-artifact:' || (q.payload->>'sourceSha256')),q.payload,
    CASE q.payload->>'issueType' WHEN 'race-row' THEN 'Race' WHEN 'runner-row' THEN 'Runner' ELSE 'SourceArtifact' END,
    CASE WHEN q.payload->>'issueType'='race-row' AND canonical_race.id IS NOT NULL THEN race.target_id WHEN q.payload->>'issueType'='runner-row' AND canonical_runner.id IS NOT NULL THEN runner.target_id END,
    CASE WHEN q.payload->>'issueType' IN ('race-row','runner-row') AND coalesce(canonical_race.id,canonical_runner.id) IS NOT NULL THEN 1 ELSE 0 END::bigint
  FROM _giq_history_stage.export_quarantine q LEFT JOIN _giq_history_stage.normalized_race race ON q.payload->>'issueType'='race-row' AND race.natural_key=q.payload->>'naturalKey' LEFT JOIN public."Race" canonical_race ON canonical_race.id=race.target_id LEFT JOIN _giq_history_stage.normalized_runner runner ON q.payload->>'issueType'='runner-row' AND runner.natural_key=q.payload->>'naturalKey' LEFT JOIN public."Runner" canonical_runner ON canonical_runner.id=runner.target_id
)
INSERT INTO _giq_history_stage.duplicate_quarantine_issue(source_dataset,source_file,line_number,issue_id,issue_type,source_natural_key,source_payload_sha256,source_payload,canonical_entity_type,exact_existing_candidate_id,exact_existing_candidate_count,similarity_only_match_allowed,create_entity_allowed,required_proofs,normalized_manifest_sha256,source_history_cutoff)
SELECT source_dataset,source_file,line_number,encode(digest(concat_ws(E'\x1f',source_dataset,source_file,line_number::text,payload::text),'sha256'),'hex'),issue_type,source_natural_key,encode(digest(payload::text,'sha256'),'hex'),payload,canonical_entity_type,exact_existing_candidate_id,exact_existing_candidate_count,false,false,jsonb_build_array('immutable-source-evidence','authoritative-exact-identity','canonical-target','verified-field-inventory','reference-conservation','no-data-loss','append-only-audit'),marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM source_rows CROSS JOIN marker ON CONFLICT(source_dataset,source_file,line_number) DO NOTHING;

CREATE TABLE IF NOT EXISTS _giq_history_stage.duplicate_quarantine_source_evidence (
  evidence_id text PRIMARY KEY CHECK(evidence_id ~ '^[0-9a-f]{64}$'),
  manifest_sha256 text NOT NULL REFERENCES _giq_history_merge.duplicate_quarantine_source_evidence_manifest(manifest_sha256),
  issue_id text NOT NULL REFERENCES _giq_history_stage.duplicate_quarantine_issue(issue_id),
  source_dataset text NOT NULL CHECK(source_dataset IN ('duplicates','quarantine')),
  partition_dir text NOT NULL,
  shard_file text NOT NULL,
  source_line bigint NOT NULL CHECK(source_line>0),
  issue_type text NOT NULL,
  natural_key text NOT NULL,
  classification text NOT NULL CHECK(classification IN ('potential-exact-same-identity','potential-complementary-same-identity','identity-conflict-or-unknown')),
  race_path_status text NOT NULL,
  jurisdiction_review_status text NOT NULL CHECK(jurisdiction_review_status IN ('known','unknown')),
  raw_line text NOT NULL,
  raw_line_sha256 text NOT NULL CHECK(raw_line_sha256 ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  canonical_payload_json_sha256 text NOT NULL CHECK(canonical_payload_json_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  source_row_sha256 text NOT NULL CHECK(source_row_sha256 ~ '^[0-9a-f]{64}$'),
  UNIQUE(source_dataset,partition_dir,shard_file,source_line),
  UNIQUE(source_dataset,shard_file,source_line,canonical_payload_json_sha256),
  CHECK(payload->>'evidenceId'=evidence_id),
  CHECK(payload->>'naturalKey'=natural_key)
);

CREATE TABLE IF NOT EXISTS _giq_history_stage.duplicate_quarantine_retrieval_queue (
  provider_key text PRIMARY KEY,
  manifest_sha256 text NOT NULL REFERENCES _giq_history_merge.duplicate_quarantine_source_evidence_manifest(manifest_sha256),
  retrieval_status text NOT NULL,
  issue_occurrence_count bigint NOT NULL CHECK(issue_occurrence_count>0),
  evidence_ids jsonb NOT NULL CHECK(jsonb_typeof(evidence_ids)='array'),
  raw_line text NOT NULL,
  raw_line_sha256 text NOT NULL CHECK(raw_line_sha256 ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  canonical_payload_json_sha256 text NOT NULL CHECK(canonical_payload_json_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK(payload->>'providerKey'=provider_key)
);

CREATE OR REPLACE FUNCTION _giq_history_merge.reject_duplicate_quarantine_source_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'duplicate/quarantine source evidence is append-only; rebuild a fresh candidate';
END
$$;

DO $$
DECLARE target regclass;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    '_giq_history_merge.duplicate_quarantine_source_evidence_manifest'::regclass,
    '_giq_history_stage.duplicate_quarantine_source_evidence'::regclass,
    '_giq_history_stage.duplicate_quarantine_retrieval_queue'::regclass
  ] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=target AND tgname='duplicate_quarantine_source_evidence_append_only') THEN
      EXECUTE format('CREATE TRIGGER duplicate_quarantine_source_evidence_append_only BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_duplicate_quarantine_source_evidence_mutation()',target);
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgrelid IN (
        '_giq_history_merge.duplicate_quarantine_source_evidence_manifest'::regclass,
        '_giq_history_stage.duplicate_quarantine_source_evidence'::regclass,
        '_giq_history_stage.duplicate_quarantine_retrieval_queue'::regclass
      ) AND tgname='duplicate_quarantine_source_evidence_append_only'
        AND NOT tgisinternal AND tgenabled<>'D')<>3 THEN
    RAISE EXCEPTION 'duplicate/quarantine source evidence append-only trigger partition is incomplete';
  END IF;
END
$$;

CREATE TEMP TABLE duplicate_quarantine_manifest_import(input_ordinal bigint GENERATED ALWAYS AS IDENTITY,raw_line text NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE duplicate_quarantine_manifest_sha_import(input_ordinal bigint GENERATED ALWAYS AS IDENTITY,raw_line text NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE duplicate_quarantine_source_evidence_import(input_ordinal bigint GENERATED ALWAYS AS IDENTITY,raw_line text NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE duplicate_quarantine_retrieval_queue_import(input_ordinal bigint GENERATED ALWAYS AS IDENTITY,raw_line text NOT NULL) ON COMMIT DROP;
-- CSV with control delimiter/quote preserves JSON backslashes byte-for-byte.
-- psql does not interpolate variables inside \copy, so expand the complete
-- meta-command first while retaining SQL-literal quoting for each path.
\set copy_duplicate_quarantine_manifest '\\copy duplicate_quarantine_manifest_import(raw_line) FROM ' :'manifest_file' ' WITH (FORMAT csv, DELIMITER E''\x1f'', QUOTE E''\x02'', ESCAPE E''\x02'')'
\set copy_duplicate_quarantine_manifest_sha '\\copy duplicate_quarantine_manifest_sha_import(raw_line) FROM ' :'manifest_sha_file' ' WITH (FORMAT csv, DELIMITER E''\x1f'', QUOTE E''\x02'', ESCAPE E''\x02'')'
\set copy_duplicate_quarantine_source_evidence '\\copy duplicate_quarantine_source_evidence_import(raw_line) FROM ' :'source_evidence_file' ' WITH (FORMAT csv, DELIMITER E''\x1f'', QUOTE E''\x02'', ESCAPE E''\x02'')'
\set copy_duplicate_quarantine_retrieval_queue '\\copy duplicate_quarantine_retrieval_queue_import(raw_line) FROM ' :'retrieval_queue_file' ' WITH (FORMAT csv, DELIMITER E''\x1f'', QUOTE E''\x02'', ESCAPE E''\x02'')'
:copy_duplicate_quarantine_manifest
:copy_duplicate_quarantine_manifest_sha
:copy_duplicate_quarantine_source_evidence
:copy_duplicate_quarantine_retrieval_queue

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM duplicate_quarantine_source_evidence_import WHERE raw_line='' OR raw_line::jsonb IS NULL)
     OR EXISTS(SELECT 1 FROM duplicate_quarantine_retrieval_queue_import WHERE raw_line='' OR raw_line::jsonb IS NULL) THEN
    RAISE EXCEPTION 'duplicate/quarantine source evidence import has an empty or invalid JSON line';
  END IF;
END
$$;

WITH manifest_source AS (
  SELECT string_agg(raw_line,E'\n' ORDER BY input_ordinal) || E'\n' AS raw_body FROM duplicate_quarantine_manifest_import
), manifest AS (
  SELECT raw_body,raw_body::jsonb AS payload,
    (SELECT string_agg(raw_line,E'\n' ORDER BY input_ordinal) || E'\n' FROM duplicate_quarantine_manifest_sha_import) AS sidecar
  FROM manifest_source
)
INSERT INTO _giq_history_merge.duplicate_quarantine_source_evidence_manifest(
  manifest_sha256,normalized_manifest_sha256,source_inventory_sha256,source_cutoff,evidence_sha256,retrieval_queue_sha256,
  evidence_rows,duplicate_rows,quarantine_rows,preliminary_exact_rows,preliminary_complementary_rows,identity_conflict_or_unknown_rows,profile_source_artifact_quarantine_rows,
  commercial_production_use_authorized,canonical_promotion_eligible,duplicate_removal_eligible,quarantine_release_eligible,raw_manifest_body,raw_manifest_sha256,raw_manifest_sidecar,raw_manifest
)
SELECT encode(digest(raw_body,'sha256'),'hex'),
  payload#>>'{source,normalizedManifestSha256}',payload#>>'{source,sourceInventorySha256}',(payload#>>'{source,sourceCutoff}')::timestamptz,
  payload#>>'{evidence,evidenceSha256}',payload#>>'{retrievalQueue,sha256}',(payload#>>'{evidence,rowCount}')::bigint,(payload#>>'{evidence,duplicateRunnerObservations}')::bigint,(payload#>>'{evidence,quarantineObservations}')::bigint,(payload#>>'{evidence,classifications,potential-exact-same-identity}')::bigint,(payload#>>'{evidence,classifications,potential-complementary-same-identity}')::bigint,(payload#>>'{evidence,classifications,identity-conflict-or-unknown}')::bigint,(payload#>>'{source,profileQuarantineRows}')::bigint,false,false,false,false,raw_body,encode(digest(raw_body,'sha256'),'hex'),sidecar,payload
FROM manifest WHERE encode(digest(raw_body,'sha256'),'hex')='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c'
  AND sidecar=encode(digest(raw_body,'sha256'),'hex') || E'\n'
  AND payload->>'manifestVersion'='giq-thedogs-duplicate-quarantine-evidence-manifest/v1'
  AND payload#>>'{evidence,sha256}'='1b8eff0ca0e4c690b32eb858fec05921602cb591b1fbee43e2bc114e52d7fd48'
  AND payload#>>'{retrievalQueue,sha256}'='00d4a507f22a9a983d98c99d99a8788e2e88fec0e945047c9f50ff45b9e79df8'
  AND payload->>'canonicalPromotionEligible'='false' AND payload->>'duplicateRemovalEligible'='false'
ON CONFLICT(manifest_sha256) DO NOTHING;

DO $$
DECLARE expected_evidence_sha text; expected_queue_sha text;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM _giq_history_merge.duplicate_quarantine_source_evidence_manifest stored
    WHERE stored.manifest_sha256='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c'
      AND stored.raw_manifest_body=(SELECT string_agg(raw_line,E'\n' ORDER BY input_ordinal) || E'\n' FROM duplicate_quarantine_manifest_import)
      AND stored.raw_manifest_sidecar=(SELECT string_agg(raw_line,E'\n' ORDER BY input_ordinal) || E'\n' FROM duplicate_quarantine_manifest_sha_import)
      AND stored.raw_manifest_sha256=stored.manifest_sha256
      AND stored.evidence_sha256=stored.raw_manifest#>>'{evidence,evidenceSha256}'
      AND stored.retrieval_queue_sha256=stored.raw_manifest#>>'{retrievalQueue,sha256}'
      AND stored.evidence_rows=(stored.raw_manifest#>>'{evidence,rowCount}')::bigint
      AND stored.duplicate_rows=(stored.raw_manifest#>>'{evidence,duplicateRunnerObservations}')::bigint
      AND stored.quarantine_rows=(stored.raw_manifest#>>'{evidence,quarantineObservations}')::bigint
      AND stored.preliminary_exact_rows=(stored.raw_manifest#>>'{evidence,classifications,potential-exact-same-identity}')::bigint
      AND stored.preliminary_complementary_rows=(stored.raw_manifest#>>'{evidence,classifications,potential-complementary-same-identity}')::bigint
      AND stored.identity_conflict_or_unknown_rows=(stored.raw_manifest#>>'{evidence,classifications,identity-conflict-or-unknown}')::bigint
      AND stored.profile_source_artifact_quarantine_rows=(stored.raw_manifest#>>'{source,profileQuarantineRows}')::bigint
      AND NOT stored.commercial_production_use_authorized AND NOT stored.canonical_promotion_eligible
      AND NOT stored.duplicate_removal_eligible AND NOT stored.quarantine_release_eligible
  ) THEN RAISE EXCEPTION 'duplicate/quarantine pinned manifest preexists with different values'; END IF;
  SELECT raw_manifest#>>'{evidence,sha256}',raw_manifest#>>'{retrievalQueue,sha256}'
  INTO STRICT expected_evidence_sha,expected_queue_sha
  FROM _giq_history_merge.duplicate_quarantine_source_evidence_manifest
  WHERE manifest_sha256='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c';
  IF encode(digest((SELECT string_agg(raw_line,E'\n' ORDER BY input_ordinal) || E'\n' FROM duplicate_quarantine_source_evidence_import),'sha256'),'hex') IS DISTINCT FROM expected_evidence_sha
     OR encode(digest((SELECT string_agg(raw_line,E'\n' ORDER BY input_ordinal) || E'\n' FROM duplicate_quarantine_retrieval_queue_import),'sha256'),'hex') IS DISTINCT FROM expected_queue_sha THEN
    RAISE EXCEPTION 'duplicate/quarantine evidence or retrieval queue bytes do not match the pinned manifest';
  END IF;
  IF EXISTS(SELECT 1 FROM duplicate_quarantine_source_evidence_import WHERE
    (raw_line::jsonb->>'evidenceId') !~ '^[0-9a-f]{64}$'
    OR (raw_line::jsonb->>'evidenceSha256') !~ '^[0-9a-f]{64}$'
    OR (raw_line::jsonb->>'issueKind'='duplicate-runner' AND (
      raw_line::jsonb#>>'{selectedObservation,rowSha256}' !~ '^[0-9a-f]{64}$'
      OR raw_line::jsonb#>>'{droppedObservation,rowSha256}' !~ '^[0-9a-f]{64}$'
      OR jsonb_typeof(raw_line::jsonb->'fieldComparison')<>'object'
      OR NOT (raw_line::jsonb->'fieldComparison') ?& ARRAY['conflicts','droppedOnly','equalPaths','selectedOnly']))
    OR (raw_line::jsonb->>'issueKind' LIKE 'quarantine-%' AND raw_line::jsonb#>>'{quarantinedObservation,rowSha256}' !~ '^[0-9a-f]{64}$')
  ) THEN RAISE EXCEPTION 'duplicate/quarantine evidence builder-contract fields are incomplete'; END IF;
END
$$;

INSERT INTO _giq_history_stage.duplicate_quarantine_source_evidence(
  evidence_id,manifest_sha256,issue_id,source_dataset,partition_dir,shard_file,source_line,issue_type,natural_key,classification,race_path_status,jurisdiction_review_status,
  raw_line,raw_line_sha256,payload,canonical_payload_json_sha256,evidence_sha256,source_row_sha256
)
SELECT payload->>'evidenceId','3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c',issue.issue_id,
  CASE WHEN payload->>'issueKind'='duplicate-runner' THEN 'duplicates' ELSE 'quarantine' END,
  payload#>>'{normalizedIssueSource,partitionDirectory}',payload#>>'{normalizedIssueSource,shardFile}',(payload#>>'{normalizedIssueSource,lineNumber}')::bigint,
  payload->>'issueType',payload->>'naturalKey',payload->>'classification',payload#>>'{racePathEvidence,status}',
  CASE WHEN payload->>'naturalKey' LIKE '%:unknown:%' THEN 'unknown' ELSE 'known' END,
  raw_line,encode(digest(raw_line,'sha256'),'hex'),payload,encode(digest(payload::text,'sha256'),'hex'),payload->>'evidenceSha256',payload#>>'{normalizedIssueSource,rowSha256}'
FROM (SELECT raw_line,raw_line::jsonb AS payload FROM duplicate_quarantine_source_evidence_import) imported
JOIN _giq_history_stage.duplicate_quarantine_issue issue
  ON issue.source_dataset=CASE WHEN payload->>'issueKind'='duplicate-runner' THEN 'duplicates' ELSE 'quarantine' END
 AND issue.source_file=(payload#>>'{normalizedIssueSource,partitionDirectory}') || '/' || (payload#>>'{normalizedIssueSource,shardFile}')
 AND issue.line_number=(payload#>>'{normalizedIssueSource,lineNumber}')::bigint
 AND issue.source_natural_key=payload->>'naturalKey' AND issue.issue_type=payload->>'issueType'
 AND issue.source_payload=CASE
   WHEN payload->>'issueKind'='duplicate-runner' THEN jsonb_build_object(
     'issueType',payload->>'issueType','naturalKey',payload->>'naturalKey',
     'sourceArchiveKey',payload->>'sourceArchiveKey',
     'selectedRowOrdinal',(payload#>>'{rawLocation,selectedRowOrdinal}')::bigint,
     'droppedRowOrdinal',(payload#>>'{rawLocation,droppedRowOrdinal}')::bigint,
     'selection','completeness_then_latest_ordinal'
   )
   ELSE jsonb_build_object(
     'issueType',payload->>'issueType','naturalKey',payload->>'naturalKey',
     'sourceArchiveKey',payload->>'sourceArchiveKey','reason',payload->>'reason'
   )
 END
ON CONFLICT(evidence_id) DO NOTHING;

INSERT INTO _giq_history_stage.duplicate_quarantine_retrieval_queue(
  provider_key,manifest_sha256,retrieval_status,issue_occurrence_count,evidence_ids,raw_line,raw_line_sha256,payload,canonical_payload_json_sha256,evidence_sha256
)
SELECT payload->>'providerKey','3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c',payload->>'retrievalStatus',
  (payload->>'issueOccurrenceCount')::bigint,payload->'evidenceIds',raw_line,encode(digest(raw_line,'sha256'),'hex'),payload,
  encode(digest(payload::text,'sha256'),'hex'),payload->>'evidenceSha256'
FROM (SELECT raw_line,raw_line::jsonb AS payload FROM duplicate_quarantine_retrieval_queue_import) imported
ON CONFLICT(provider_key) DO NOTHING;

DO $$
DECLARE observed_evidence bigint; observed_queue bigint;
BEGIN
  SELECT count(*) INTO observed_evidence FROM _giq_history_stage.duplicate_quarantine_source_evidence
  WHERE manifest_sha256='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c';
  SELECT count(*) INTO observed_queue FROM _giq_history_stage.duplicate_quarantine_retrieval_queue
  WHERE manifest_sha256='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c';
  IF observed_evidence<>2022 OR observed_queue<>1403
     OR (SELECT count(*) FROM duplicate_quarantine_source_evidence_import)<>2022
     OR (SELECT count(*) FROM duplicate_quarantine_retrieval_queue_import)<>1403 THEN
    RAISE EXCEPTION 'duplicate/quarantine source evidence import is partial or changed: evidence % queue %',observed_evidence,observed_queue;
  END IF;
  IF EXISTS(
    SELECT raw_line FROM duplicate_quarantine_source_evidence_import
    EXCEPT
    SELECT raw_line FROM _giq_history_stage.duplicate_quarantine_source_evidence
      WHERE manifest_sha256='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c'
  ) OR EXISTS(
    SELECT raw_line FROM duplicate_quarantine_retrieval_queue_import
    EXCEPT
    SELECT raw_line FROM _giq_history_stage.duplicate_quarantine_retrieval_queue
      WHERE manifest_sha256='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c'
  ) OR EXISTS(
    SELECT raw_line FROM _giq_history_stage.duplicate_quarantine_source_evidence
      WHERE manifest_sha256='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c'
    EXCEPT SELECT raw_line FROM duplicate_quarantine_source_evidence_import
  ) OR EXISTS(
    SELECT raw_line FROM _giq_history_stage.duplicate_quarantine_retrieval_queue
      WHERE manifest_sha256='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c'
    EXCEPT SELECT raw_line FROM duplicate_quarantine_retrieval_queue_import
  ) THEN
    RAISE EXCEPTION 'duplicate/quarantine source evidence import differs from the pinned immutable artifact';
  END IF;
  IF (SELECT count(*) FILTER(WHERE source_dataset='duplicates') FROM _giq_history_stage.duplicate_quarantine_source_evidence)<>1940
     OR (SELECT count(*) FILTER(WHERE source_dataset='quarantine') FROM _giq_history_stage.duplicate_quarantine_source_evidence)<>82
     OR (SELECT count(*) FILTER(WHERE classification='potential-exact-same-identity') FROM _giq_history_stage.duplicate_quarantine_source_evidence)<>30
     OR (SELECT count(*) FILTER(WHERE classification='potential-complementary-same-identity') FROM _giq_history_stage.duplicate_quarantine_source_evidence)<>97
     OR (SELECT count(*) FILTER(WHERE classification='identity-conflict-or-unknown') FROM _giq_history_stage.duplicate_quarantine_source_evidence)<>1895 THEN
    RAISE EXCEPTION 'duplicate/quarantine source evidence classification inventory changed';
  END IF;
  IF (SELECT count(*) FROM _giq_history_stage.duplicate_quarantine_source_evidence evidence
      JOIN _giq_history_stage.duplicate_quarantine_issue issue ON issue.issue_id=evidence.issue_id
      WHERE evidence.manifest_sha256='3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c')<>2022
     OR (SELECT count(*) FROM _giq_history_stage.duplicate_quarantine_issue
         WHERE issue_type='source-file' AND canonical_entity_type='SourceArtifact')<>115 THEN
    RAISE EXCEPTION 'duplicate/quarantine issue linkage or separate profile source-artifact quarantine changed';
  END IF;
END
$$;

REVOKE ALL ON _giq_history_merge.duplicate_quarantine_source_evidence_manifest FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.duplicate_quarantine_source_evidence FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.duplicate_quarantine_retrieval_queue FROM PUBLIC;
REVOKE ALL ON FUNCTION _giq_history_merge.reject_duplicate_quarantine_source_evidence_mutation() FROM PUBLIC;
COMMIT;
