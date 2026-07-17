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
    '_giq_history_stage.authoritative_identity_evidence',
    '_giq_history_stage.authoritative_pedigree_evidence',
    '_giq_history_stage.authoritative_consolidation_proof',
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
      ('_giq_history_stage','authoritative_identity_evidence','verification_status'),
      ('_giq_history_stage','authoritative_identity_resolution','canonical_write_eligible'),
      ('_giq_history_stage','authoritative_identity_resolution','quarantine_release_eligible'),
      ('_giq_history_stage','authoritative_pedigree_evidence','verification_status'),
      ('_giq_history_stage','authoritative_pedigree_resolution','canonical_write_eligible'),
      ('_giq_history_stage','authoritative_pedigree_resolution','quarantine_release_eligible'),
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
        '_giq_history_stage.authoritative_consolidation_proof'::regclass
      ) AND NOT tgisinternal AND tgenabled<>'D')<>3 THEN
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
), counts AS (
  SELECT jsonb_build_object(
    'providerPolicies',(SELECT count(*) FROM _giq_history_stage.authoritative_provider_policy),
    'identityEvidence',(SELECT count(*) FROM _giq_history_stage.authoritative_identity_evidence),
    'identityResolutions',(SELECT count(*) FROM _giq_history_stage.authoritative_identity_resolution),
    'pedigreeEvidence',(SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_evidence),
    'pedigreeResolutions',(SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution),
    'consolidationProofs',(SELECT count(*) FROM _giq_history_stage.authoritative_consolidation_proof),
    'currentQuarantineRows',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine),
    'retrievalQueueRows',(SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_retrieval_queue),
    'providerStubs',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type='provider-stub'),
    'raceObservedParents',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type='race-observed-parent-profile-required'),
    'selfParents',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type='self-parent'),
    'galtdConflicts',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type='conflicting-source-observation'),
    'galtdCompositeCandidates',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type='composite-crosswalk-candidate'),
    'canonicalWriteEligible',(
      (SELECT count(*) FROM _giq_history_stage.authoritative_identity_resolution
       WHERE canonical_write_eligible)+
      (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE canonical_write_eligible)
    ),
    'quarantineReleaseEligible',(
      (SELECT count(*) FROM _giq_history_stage.authoritative_identity_resolution
       WHERE quarantine_release_eligible)+
      (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE quarantine_release_eligible)+
      (SELECT count(*) FROM _giq_history_stage.authoritative_consolidation_proof
       WHERE release_eligible)
    )
  ) AS evidence
), blockers AS (
  SELECT jsonb_build_object(
    'retrievalRequired',(SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_retrieval_queue),
    'unverifiedIdentityEvidence',(SELECT count(*) FROM _giq_history_stage.authoritative_identity_evidence
      WHERE verification_status<>'verified'),
    'unverifiedPedigreeEvidence',(SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_evidence
      WHERE verification_status<>'verified'),
    'conflictOrRejectedIdentityEvidence',(SELECT count(*)
      FROM _giq_history_stage.authoritative_identity_evidence
      WHERE verification_status IN ('conflict','rejected')),
    'conflictOrRejectedPedigreeEvidence',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_evidence
      WHERE verification_status IN ('conflict','rejected')),
    'selfParentRows',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type='self-parent'),
    'galtdConflictRows',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type='conflicting-source-observation'),
    'galtdCompositeRowsPendingAuthoritativeResolution',(SELECT count(*)
      FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type='composite-crosswalk-candidate'),
    'ambiguousCompositeRows',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
      WHERE disposition='quarantined-ambiguous-composite-match'),
    'providerStubs',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type='provider-stub'),
    'raceObservedParentProfiles',(SELECT count(*)
      FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type='race-observed-parent-profile-required'),
    'preservedProductionConflicts',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='preserved-production-conflict')+
      (SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
       WHERE disposition='preserved-production-conflict'),
    'identityAmbiguities',(SELECT count(*) FROM _giq_history_stage.authoritative_identity_resolution
      WHERE candidate_count>1 OR strong_candidate_count>1),
    'pedigreeRelationshipConflicts',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_conflict_ledger),
    'reviewOnlyRemovals',(SELECT count(*)
      FROM _giq_history_stage.authoritative_consolidation_proof WHERE NOT release_eligible),
    'canonicalWriteProofGaps',(
      SELECT count(*) FROM _giq_history_stage.authoritative_identity_resolution
      WHERE (canonical_write_eligible AND (
          verification_status<>'verified' OR disposition NOT IN (
            'verified-existing-identity-candidate','verified-new-identity-candidate'
          ) OR candidate_count>1 OR strong_candidate_count>1
        )) OR (NOT canonical_write_eligible AND verification_status='verified'
          AND disposition IN (
            'verified-existing-identity-candidate','verified-new-identity-candidate'
          ))
    )+(
      SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE (canonical_write_eligible AND (
          verification_status<>'verified' OR subject_dog_id IS NULL OR parent_dog_id IS NULL
          OR creates_cycle OR disposition NOT IN (
            'verified-no-change-candidate','verified-missing-parent-candidate'
          )
        )) OR (NOT canonical_write_eligible AND verification_status='verified'
          AND disposition IN ('verified-no-change-candidate','verified-missing-parent-candidate'))
    ),
    'quarantineReleaseProofGaps',(
      SELECT count(*) FROM _giq_history_stage.authoritative_identity_resolution
      WHERE quarantine_release_eligible AND (
        verification_status<>'verified' OR candidate_count<>1 OR strong_candidate_count<>1
      )
    )+(
      SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE quarantine_release_eligible AND (
        verification_status<>'verified' OR subject_dog_id IS NULL OR parent_dog_id IS NULL OR creates_cycle
      )
    ),
    'blockingQuarantineRows',(SELECT count(*)
      FROM _giq_history_stage.current_pedigree_quarantine WHERE blocking),
    'unaccountedIdentityRows',abs(
      (SELECT count(*) FROM _giq_history_stage.authoritative_identity_evidence)-
      (SELECT count(*) FROM _giq_history_stage.authoritative_identity_resolution)
    ),
    'unaccountedPedigreeRows',abs(
      (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_evidence)-
      (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution)
    ),
    'unaccountedQuarantineRows',(SELECT count(*)
      FROM _giq_history_stage.current_pedigree_quarantine
      WHERE issue_type NOT IN (
        'provider-stub','race-observed-parent-profile-required','self-parent',
        'conflicting-source-observation','composite-crosswalk-candidate'
      ) OR NOT blocking OR quarantine_release_eligible),
    'sourceLineageGaps',source.lineage_gaps
  ) AS evidence
  FROM source
)
INSERT INTO _giq_history_merge.authoritative_pedigree_saturation_manifest
  (id,schema_version,normalized_manifest_sha256,source_history_cutoff,
   source_lineage,counts,blockers,status,updated_at)
SELECT 1,'giq-authoritative-pedigree-saturation/v1',source.normalized_manifest_sha256,
  source.source_history_cutoff,source.lineage,counts.evidence,blockers.evidence,
  CASE WHEN EXISTS(
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
  'blockers',blockers
) FROM _giq_history_merge.authoritative_pedigree_saturation_manifest WHERE id=1;

SELECT (status<>'ready' OR EXISTS(
  SELECT 1
  FROM jsonb_each(blockers) item
  WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'number'
     OR item.value::text !~ '^(0|[1-9][0-9]*)$'
     OR item.value <> '0'::jsonb
)) AS authoritative_pedigree_saturation_blocked
FROM _giq_history_merge.authoritative_pedigree_saturation_manifest WHERE id=1
\gset
\if :authoritative_pedigree_saturation_blocked
\echo 'OPERATOR_ATTENTION: authoritative pedigree saturation remains blocked; resolve verified provider queues, conflicts, relationship gaps, and review-only removals before canonical merge.'
\quit 3
\endif
