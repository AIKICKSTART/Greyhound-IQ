\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  observed_phase text;
  observation_count bigint;
  assertion_count bigint;
  invalid_count bigint;
  conflict_groups bigint;
  conflict_observations bigint;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'GALTD finalize database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE;
  IF observed_phase NOT IN ('export_staged', 'galtd_staged') THEN
    RAISE EXCEPTION 'GALTD finalize requires export_staged, observed %', observed_phase;
  END IF;

  SELECT count(*) INTO observation_count FROM _giq_history_stage.galtd_observation;
  SELECT count(*) INTO assertion_count FROM _giq_history_stage.galtd_assertion;
  IF observation_count <> 105374 OR assertion_count <> 210734 THEN
    RAISE EXCEPTION 'GALTD staged counts changed: observations %, assertions %',
      observation_count, assertion_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM _giq_history_stage.galtd_observation
  WHERE payload->>'sourceProvider' <> 'galtd'
     OR payload->>'sourceId' !~ '^galtd:vol-(66|67|68|69|70|71|72|73):page-[0-9]+:line-[0-9]+:offset-[0-9]+$'
     OR nullif(payload->>'sourceName', '') IS NULL
     OR nullif(payload->>'normalizedName', '') IS NULL
     OR payload->>'evidenceSha256' !~ '^[0-9a-f]{64}$'
     OR (payload->>'artifactSha256') !~ '^[0-9a-f]{64}$'
     OR (payload->>'textArtifactSha256') !~ '^[0-9a-f]{64}$'
     OR (payload->>'canonicalPromotionEligible')::boolean;
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'GALTD observations contain % invalid provenance rows', invalid_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM _giq_history_stage.galtd_assertion a
  LEFT JOIN _giq_history_stage.galtd_observation o
    ON o.payload->>'sourceId' = a.payload->>'subjectSourceId'
  WHERE a.payload->>'sourceProvider' <> 'galtd'
     OR a.payload->>'relationship' NOT IN ('sire', 'dam')
     OR nullif(a.payload->>'assertedParentName', '') IS NULL
     OR nullif(a.payload->>'assertedParentNormalizedName', '') IS NULL
     OR a.payload->>'evidenceSha256' !~ '^[0-9a-f]{64}$'
     OR (a.payload->>'canonicalPromotionEligible')::boolean
     OR o.line_number IS NULL;
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'GALTD assertions contain % invalid or orphaned evidence rows', invalid_count;
  END IF;

  SELECT count(DISTINCT payload->>'conflictGroup'),
         count(*) FILTER (WHERE payload ? 'conflictGroup')
  INTO conflict_groups, conflict_observations
  FROM _giq_history_stage.galtd_observation;
  IF conflict_groups <> 5 OR conflict_observations <> 18 THEN
    RAISE EXCEPTION 'GALTD conflict inventory changed: groups %, observations %',
      conflict_groups, conflict_observations;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS galtd_observation_source_id_key
  ON _giq_history_stage.galtd_observation ((payload->>'sourceId'));
CREATE INDEX IF NOT EXISTS galtd_observation_match_idx
  ON _giq_history_stage.galtd_observation (
    (payload->>'normalizedName'),
    (left(payload->>'whelpDate', 7))
  );
CREATE UNIQUE INDEX IF NOT EXISTS galtd_assertion_source_id_key
  ON _giq_history_stage.galtd_assertion ((payload->>'sourceId'));
CREATE INDEX IF NOT EXISTS galtd_assertion_subject_idx
  ON _giq_history_stage.galtd_assertion ((payload->>'subjectSourceId'));

UPDATE _giq_history_merge.run
SET phase = 'galtd_staged',
    galtd_staged_at = clock_timestamp(),
    galtd_stage_manifest = jsonb_build_object(
      'sourceProvider', 'galtd',
      'parserVersion', 'galtd-studbook-audit-v1',
      'strictReportSha256', :'report_sha256',
      'observations', 105374,
      'assertions', 210734,
      'conflictGroups', 5,
      'conflictObservations', 18,
      'canonicalPromotionEligible', 0,
      'observationsSha256', :'observations_sha256',
      'assertionsSha256', :'assertions_sha256',
      'export', :'export_report'::jsonb
    )
WHERE id = 1;

INSERT INTO _giq_history_merge.verification_check (check_name, metrics)
VALUES (
  'galtd_evidence_stage',
  jsonb_build_object(
    'observations', 105374,
    'assertions', 210734,
    'conflictGroups', 5,
    'conflictObservations', 18,
    'canonicalPromotionEligible', 0,
    'allProvenancePreserved', true
  )
)
ON CONFLICT (check_name) DO UPDATE
SET metrics = EXCLUDED.metrics,
    verified_at = clock_timestamp();

COMMIT;

ANALYZE _giq_history_stage.galtd_observation;
ANALYZE _giq_history_stage.galtd_assertion;

SELECT jsonb_build_object(
  'event', 'GALTD_NONCANONICAL_STAGE_VERIFIED',
  'database', current_database(),
  'phase', phase,
  'manifest', galtd_stage_manifest
)
FROM _giq_history_merge.run WHERE id = 1;
