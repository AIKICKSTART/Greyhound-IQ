\set ON_ERROR_STOP on

BEGIN;
SET LOCAL synchronous_commit=on;
SET LOCAL statement_timeout=0;

DO $$
DECLARE
  observed_phase text;
  missing_relations text;
  missing_columns text;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'authoritative pedigree saturation database mismatch';
  END IF;

  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id=1 FOR UPDATE;
  IF observed_phase<>'normalized' THEN
    RAISE EXCEPTION 'authoritative pedigree saturation requires normalized, observed %',observed_phase;
  END IF;

  SELECT string_agg(relation_name,',' ORDER BY relation_name)
  INTO missing_relations
  FROM unnest(ARRAY[
    '_giq_history_merge.export_dataset_manifest',
    '_giq_history_stage.authoritative_provider_policy',
    '_giq_history_stage.authoritative_pedigree_assertion_occurrence',
    '_giq_history_stage.authoritative_identity_evidence',
    '_giq_history_stage.authoritative_pedigree_evidence',
    '_giq_history_stage.authoritative_consolidation_proof',
    '_giq_history_stage.authoritative_pedigree_terminal_proof',
    '_giq_history_stage.authoritative_identity_resolution',
    '_giq_history_stage.authoritative_pedigree_resolution',
    '_giq_history_stage.authoritative_pedigree_conflict_ledger',
    '_giq_history_stage.authoritative_pedigree_retrieval_queue',
    '_giq_history_stage.current_pedigree_quarantine'
  ]) relation_name
  WHERE to_regclass(relation_name) IS NULL;
  IF missing_relations IS NOT NULL THEN
    RAISE EXCEPTION 'authoritative pedigree saturation relations are incomplete: %',missing_relations;
  END IF;

  WITH required(table_schema,table_name,column_name) AS (
    VALUES
      ('_giq_history_merge','run','normalized_manifest_sha256'),
      ('_giq_history_merge','run','normalized_transform_version'),
      ('_giq_history_merge','run','source_history_cutoff'),
      ('_giq_history_merge','run','export_stage_manifest'),
      ('_giq_history_merge','run','galtd_stage_manifest'),
      ('_giq_history_stage','authoritative_pedigree_assertion_occurrence','import_run_id'),
      ('_giq_history_stage','authoritative_pedigree_assertion_occurrence','artifact_sha256'),
      ('_giq_history_stage','authoritative_pedigree_assertion_occurrence','source_file'),
      ('_giq_history_stage','authoritative_pedigree_assertion_occurrence','source_line'),
      ('_giq_history_stage','authoritative_pedigree_assertion_occurrence','relationship'),
      ('_giq_history_stage','authoritative_pedigree_assertion_occurrence','evidence_sha256'),
      ('_giq_history_stage','authoritative_identity_evidence','verification_status'),
      ('_giq_history_stage','authoritative_identity_evidence','corroboration_only'),
      ('_giq_history_stage','authoritative_identity_evidence','stable_bridge'),
      ('_giq_history_stage','authoritative_identity_resolution','canonical_write_eligible'),
      ('_giq_history_stage','authoritative_identity_resolution','quarantine_release_eligible'),
      ('_giq_history_stage','authoritative_pedigree_evidence','verification_status'),
      ('_giq_history_stage','authoritative_pedigree_evidence','occurrence_id'),
      ('_giq_history_stage','authoritative_pedigree_evidence','corroboration_only'),
      ('_giq_history_stage','authoritative_pedigree_evidence','stable_bridge'),
      ('_giq_history_stage','authoritative_pedigree_terminal_proof','canonical_safety_blocking'),
      ('_giq_history_stage','authoritative_pedigree_terminal_proof','coverage_blocking'),
      ('_giq_history_stage','authoritative_pedigree_resolution','canonical_write_eligible'),
      ('_giq_history_stage','authoritative_pedigree_resolution','quarantine_release_eligible'),
      ('_giq_history_stage','authoritative_pedigree_resolution','canonical_safety_blocking'),
      ('_giq_history_stage','authoritative_pedigree_resolution','coverage_blocking'),
      ('_giq_history_stage','authoritative_pedigree_resolution','hard_blocker_class'),
      ('_giq_history_stage','authoritative_consolidation_proof','release_eligible'),
      ('_giq_history_stage','current_pedigree_quarantine','blocking'),
      ('_giq_history_stage','current_pedigree_quarantine','quarantine_release_eligible')
  )
  SELECT string_agg(format('%I.%I.%I',required.table_schema,required.table_name,required.column_name),','
                    ORDER BY required.table_schema,required.table_name,required.column_name)
  INTO missing_columns
  FROM required
  LEFT JOIN information_schema.columns existing USING(table_schema,table_name,column_name)
  WHERE existing.column_name IS NULL;
  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'authoritative pedigree saturation columns are incomplete: %',missing_columns;
  END IF;

  IF (SELECT count(*) FROM _giq_history_stage.authoritative_provider_policy)<>6
     OR (SELECT count(*) FROM _giq_history_stage.authoritative_provider_policy
         WHERE (source_provider,authority_rank) IN (
           ('production',1000),('greyhound_recorder',900),('fasttrack',800),
           ('approved_fasttrack_resource',750),('thedogs',200),('galtd',100)
         ))<>6 THEN
    RAISE EXCEPTION 'authoritative pedigree provider policy partition is incomplete';
  END IF;

  IF (SELECT count(*) FROM _giq_history_merge.export_dataset_manifest
      WHERE dataset IN (
        'profiles','pedigree_edges','profile_forms','meetings','races','runners',
        'results','archives','race_media','duplicates','orphans','quarantine'
      ) AND observed_rows=expected_rows AND staged_at IS NOT NULL)<>12
     OR (SELECT count(*) FROM _giq_history_merge.export_dataset_manifest)<>12 THEN
    RAISE EXCEPTION 'authoritative pedigree source dataset partition is incomplete';
  END IF;

  IF (SELECT count(*) FROM pg_trigger
      WHERE tgrelid IN (
        '_giq_history_stage.authoritative_identity_evidence'::regclass,
        '_giq_history_stage.authoritative_pedigree_evidence'::regclass,
        '_giq_history_stage.authoritative_consolidation_proof'::regclass,
        '_giq_history_stage.authoritative_pedigree_assertion_occurrence'::regclass,
        '_giq_history_stage.authoritative_pedigree_terminal_proof'::regclass
      ) AND NOT tgisinternal AND tgenabled<>'D')<>5 THEN
    RAISE EXCEPTION 'authoritative pedigree append-only trigger partition is incomplete';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS _giq_history_merge.authoritative_pedigree_saturation_manifest (
  id integer PRIMARY KEY CHECK(id=1),
  schema_version text NOT NULL,
  normalized_manifest_sha256 text NOT NULL,
  source_history_cutoff timestamptz NOT NULL,
  source_lineage jsonb NOT NULL,
  counts jsonb NOT NULL,
  blockers jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('ready','blocked')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

WITH marker AS (
  SELECT source_production_database,source_history_database,source_history_archive_sha256,
         normalized_manifest_sha256,normalized_transform_version,source_history_cutoff,
         export_stage_manifest,galtd_stage_manifest,normalization_manifest
  FROM _giq_history_merge.run WHERE id=1
), datasets AS (
  SELECT coalesce(jsonb_object_agg(dataset,jsonb_build_object(
    'rows',expected_rows,'bytes',expected_bytes,'sha256',expected_sha256
  ) ORDER BY dataset),'{}'::jsonb) AS evidence,
  count(*) AS dataset_count,
  count(*) FILTER(WHERE observed_rows=expected_rows AND staged_at IS NOT NULL) AS verified_count
  FROM _giq_history_merge.export_dataset_manifest
), source AS (
  SELECT marker.*,
    jsonb_build_object(
      'sourceProductionDatabase',marker.source_production_database,
      'sourceHistoryDatabase',marker.source_history_database,
      'sourceHistoryArchiveSha256',marker.source_history_archive_sha256,
      'normalizedManifestSha256',marker.normalized_manifest_sha256,
      'normalizedTransformVersion',marker.normalized_transform_version,
      'sourceHistoryCutoff',marker.source_history_cutoff,
      'exportManifestSha256',marker.export_stage_manifest->>'manifestSha256',
      'exportTransformVersion',marker.export_stage_manifest->>'transformVersion',
      'galtdStrictReportSha256',marker.galtd_stage_manifest->>'strictReportSha256',
      'galtdParserVersion',marker.galtd_stage_manifest->>'parserVersion',
      'datasets',datasets.evidence
    ) AS lineage,
    (
      CASE WHEN marker.source_production_database IS DISTINCT FROM 'giq_rehearsal_restore_v8' THEN 1 ELSE 0 END +
      CASE WHEN marker.source_history_database IS DISTINCT FROM 'giq_full_history_rehearsal_20260716_r2' THEN 1 ELSE 0 END +
      CASE WHEN coalesce(marker.source_history_archive_sha256,'') !~ '^[0-9a-f]{64}$' THEN 1 ELSE 0 END +
      CASE WHEN coalesce(marker.normalized_manifest_sha256,'') !~ '^[0-9a-f]{64}$' THEN 1 ELSE 0 END +
      CASE WHEN marker.normalized_transform_version IS DISTINCT FROM 'thedogs-normalized-harvest/v2' THEN 1 ELSE 0 END +
      CASE WHEN marker.export_stage_manifest IS NULL THEN 1 ELSE 0 END +
      CASE WHEN marker.export_stage_manifest->>'manifestSha256'
                     IS DISTINCT FROM marker.normalized_manifest_sha256 THEN 1 ELSE 0 END +
      CASE WHEN marker.export_stage_manifest->>'transformVersion'
                     IS DISTINCT FROM marker.normalized_transform_version THEN 1 ELSE 0 END +
      CASE WHEN marker.normalization_manifest IS NULL THEN 1 ELSE 0 END +
      CASE WHEN marker.galtd_stage_manifest IS NULL THEN 1 ELSE 0 END +
      CASE WHEN coalesce(marker.galtd_stage_manifest->>'strictReportSha256','') !~ '^[0-9a-f]{64}$'
           THEN 1 ELSE 0 END +
      CASE WHEN marker.galtd_stage_manifest->>'parserVersion'
                     IS DISTINCT FROM 'galtd-studbook-audit-v1' THEN 1 ELSE 0 END +
      CASE WHEN datasets.dataset_count<>12 OR datasets.verified_count<>12 THEN 1 ELSE 0 END
    )::bigint AS lineage_gaps
  FROM marker CROSS JOIN datasets
), disposition_counts AS (
  SELECT
    coalesce(jsonb_object_agg(disposition,rows ORDER BY disposition),'{}'::jsonb) AS evidence,
    coalesce(sum(rows),0)::bigint AS total
  FROM (
    SELECT disposition,count(*)::bigint AS rows
    FROM _giq_history_stage.authoritative_pedigree_resolution
    GROUP BY disposition
  ) grouped
), persistence_check AS (
  SELECT greatest(5-count(*),0)::bigint AS trigger_gaps
  FROM pg_trigger
  WHERE tgrelid IN (
    '_giq_history_stage.authoritative_identity_evidence'::regclass,
    '_giq_history_stage.authoritative_pedigree_evidence'::regclass,
    '_giq_history_stage.authoritative_consolidation_proof'::regclass,
    '_giq_history_stage.authoritative_pedigree_assertion_occurrence'::regclass,
    '_giq_history_stage.authoritative_pedigree_terminal_proof'::regclass
  ) AND NOT tgisinternal AND tgenabled<>'D'
), counts AS (
  SELECT jsonb_build_object(
    'providerPolicies',(SELECT count(*) FROM _giq_history_stage.authoritative_provider_policy),
    'assertionOccurrences',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence),
    'identityEvidence',(SELECT count(*) FROM _giq_history_stage.authoritative_identity_evidence),
    'identityResolutions',(SELECT count(*) FROM _giq_history_stage.authoritative_identity_resolution),
    'pedigreeEvidence',(SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_evidence),
    'pedigreeResolutions',disposition_counts.total,
    'terminalProofs',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_terminal_proof),
    'consolidationProofs',(SELECT count(*)
      FROM _giq_history_stage.authoritative_consolidation_proof),
    'dispositions',disposition_counts.evidence,
    'applyCandidates',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='verified_apply_candidate'),
    'appliedVerified',(SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='applied_verified'),
    'verifiedNoChange',(SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='verified_no_change'),
    'terminalInvalidImpossible',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='terminal_invalid_impossible'),
    'terminalSupersededConflict',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='terminal_superseded_conflict'),
    'terminalUnlinkedConflictCovered',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='terminal_unlinked_conflict_covered'),
    'terminalCorroborationOnlyCovered',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='terminal_corroboration_only_covered'),
    'terminalNonblocking',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition IN (
        'terminal_invalid_impossible','terminal_superseded_conflict',
        'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
      ) AND NOT canonical_safety_blocking AND NOT coverage_blocking),
    'terminalBlocking',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition IN (
        'terminal_invalid_impossible','terminal_superseded_conflict',
        'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
      ) AND (canonical_safety_blocking OR coverage_blocking)),
    'canonicalWriteEligible',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE canonical_write_eligible),
    'quarantineReleaseEligible',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE quarantine_release_eligible),
    'currentQuarantineRows',(SELECT count(*)
      FROM _giq_history_stage.current_pedigree_quarantine),
    'retrievalQueueRows',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_retrieval_queue)
  ) AS evidence
  FROM disposition_counts
), blockers AS (
  SELECT jsonb_build_object(
    'identityPending',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE hard_blocker_class='identity_pending'),
    'relationshipPending',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE hard_blocker_class='relationship_pending'),
    'authorityConflict',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE hard_blocker_class='authority_conflict'),
    'canonicalIntegrity',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE hard_blocker_class='canonical_integrity')+
      (SELECT count(*) FROM _giq_history_stage.authoritative_consolidation_proof
       WHERE NOT release_eligible),
    'persistence',persistence_check.trigger_gaps,
    'accounting',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE hard_blocker_class='accounting')+
      abs((SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence)-
          (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution))+
      (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition LIKE 'hard_%' AND hard_blocker_class IS NULL),
    'coverage',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE hard_blocker_class='coverage')+source.lineage_gaps
  ) AS evidence
  FROM source CROSS JOIN persistence_check
)
INSERT INTO _giq_history_merge.authoritative_pedigree_saturation_manifest
  (id,schema_version,normalized_manifest_sha256,source_history_cutoff,
   source_lineage,counts,blockers,status,updated_at)
SELECT 1,'giq-authoritative-pedigree-saturation/v2',source.normalized_manifest_sha256,
  source.source_history_cutoff,source.lineage,counts.evidence,blockers.evidence,
  CASE WHEN jsonb_object_length(blockers.evidence)<>7 OR EXISTS(
    SELECT 1
    FROM jsonb_each(blockers.evidence) item
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'number'
       OR item.value::text !~ '^(0|[1-9][0-9]*)$'
       OR item.value <> '0'::jsonb
  ) THEN 'blocked' ELSE 'ready' END,
  clock_timestamp()
FROM source CROSS JOIN counts CROSS JOIN blockers
ON CONFLICT(id) DO UPDATE
SET schema_version=EXCLUDED.schema_version,
    normalized_manifest_sha256=EXCLUDED.normalized_manifest_sha256,
    source_history_cutoff=EXCLUDED.source_history_cutoff,
    source_lineage=EXCLUDED.source_lineage,
    counts=EXCLUDED.counts,
    blockers=EXCLUDED.blockers,
    status=EXCLUDED.status,
    updated_at=EXCLUDED.updated_at;

REVOKE ALL ON _giq_history_merge.authoritative_pedigree_saturation_manifest FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event','AUTHORITATIVE_PEDIGREE_SATURATION_FINALIZED',
  'database',current_database(),
  'status',status,
  'normalizedManifestSha256',normalized_manifest_sha256,
  'sourceHistoryCutoff',source_history_cutoff,
  'counts',counts,
  'blockers',blockers,
  'hardBlockerClasses',jsonb_build_array(
    'identityPending','relationshipPending','authorityConflict',
    'canonicalIntegrity','persistence','accounting','coverage'
  )
) FROM _giq_history_merge.authoritative_pedigree_saturation_manifest WHERE id=1;

SELECT (schema_version<>'giq-authoritative-pedigree-saturation/v2'
 OR jsonb_object_length(blockers)<>7 OR status<>'ready' OR EXISTS(
  SELECT 1
  FROM jsonb_each(blockers) item
  WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'number'
     OR item.value::text !~ '^(0|[1-9][0-9]*)$'
     OR item.value <> '0'::jsonb
)) AS authoritative_pedigree_saturation_blocked
FROM _giq_history_merge.authoritative_pedigree_saturation_manifest WHERE id=1
\gset
\if :authoritative_pedigree_saturation_blocked
\echo 'OPERATOR_ATTENTION: pedigree v2 has hard identity, relationship, authority, integrity, persistence, accounting, or coverage blockers; terminal source-only rows do not block after both proof gates pass.'
\quit 3
\endif
