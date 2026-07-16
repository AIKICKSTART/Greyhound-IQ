\set ON_ERROR_STOP on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30min';

DO $$
DECLARE
  observed_phase text;
  blocking_rows bigint;
  ready_manifest_pairs bigint;
  manifest_blockers bigint;
  direct_saturation_blockers bigint;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'merge plan database mismatch';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto') THEN
    RAISE EXCEPTION 'merge plan requires pgcrypto for its run-bound attestation';
  END IF;
  SELECT phase INTO STRICT observed_phase FROM _giq_history_merge.run WHERE id=1;
  IF observed_phase NOT IN ('normalized','canonical_merged','delta_applied','verified') THEN
    RAISE EXCEPTION 'merge plan requires normalized or later phase, observed %',observed_phase;
  END IF;
  IF to_regclass('_giq_history_merge.authoritative_pedigree_saturation_manifest') IS NULL
     OR to_regclass('_giq_history_merge.nonpedigree_saturation_manifest') IS NULL
     OR to_regclass('_giq_history_merge.duplicate_quarantine_proof_manifest') IS NULL
     OR to_regclass('_giq_history_stage.duplicate_quarantine_proof_resolution') IS NULL THEN
    RAISE EXCEPTION 'merge plan requires all three saturation and duplicate/quarantine proof manifests';
  END IF;

  SELECT count(*) INTO ready_manifest_pairs
  FROM _giq_history_merge.run run
  JOIN _giq_history_merge.authoritative_pedigree_saturation_manifest pedigree ON pedigree.id=1
  JOIN _giq_history_merge.nonpedigree_saturation_manifest nonpedigree ON nonpedigree.id=1
  JOIN _giq_history_merge.duplicate_quarantine_proof_manifest duplicate_proof ON duplicate_proof.id=1
  WHERE run.id=1
    AND run.normalized_transform_version='thedogs-normalized-harvest/v2'
    AND pedigree.schema_version='giq-authoritative-pedigree-saturation/v1'
    AND nonpedigree.schema_version='giq-nonpedigree-saturation/v1'
    AND duplicate_proof.schema_version='giq-duplicate-quarantine-proof/v1'
    AND pedigree.status='ready' AND nonpedigree.status='ready' AND duplicate_proof.status='ready'
    AND pedigree.normalized_manifest_sha256=run.normalized_manifest_sha256
    AND nonpedigree.normalized_manifest_sha256=run.normalized_manifest_sha256
    AND pedigree.normalized_manifest_sha256=nonpedigree.normalized_manifest_sha256
    AND duplicate_proof.normalized_manifest_sha256=run.normalized_manifest_sha256
    AND duplicate_proof.normalized_manifest_sha256=pedigree.normalized_manifest_sha256
    AND duplicate_proof.normalized_transform_version=run.normalized_transform_version
    AND pedigree.source_history_cutoff=run.source_history_cutoff
    AND nonpedigree.source_history_cutoff=run.source_history_cutoff
    AND pedigree.source_history_cutoff=nonpedigree.source_history_cutoff
    AND duplicate_proof.source_history_cutoff=run.source_history_cutoff
    AND duplicate_proof.source_history_cutoff=pedigree.source_history_cutoff
    AND pedigree.source_lineage->>'normalizedManifestSha256'=run.normalized_manifest_sha256
    AND pedigree.source_lineage->>'normalizedTransformVersion'=run.normalized_transform_version
    AND jsonb_typeof(pedigree.blockers)='object'
    AND jsonb_typeof(nonpedigree.blockers)='object'
    AND jsonb_typeof(duplicate_proof.blockers)='object'
    AND jsonb_object_length(pedigree.blockers)=22
    AND jsonb_object_length(nonpedigree.blockers)=11
    AND jsonb_object_length(duplicate_proof.blockers)=19
    AND pedigree.blockers ?& ARRAY[
      'retrievalRequired','unverifiedIdentityEvidence','unverifiedPedigreeEvidence',
      'conflictOrRejectedIdentityEvidence','conflictOrRejectedPedigreeEvidence',
      'selfParentRows','galtdConflictRows','galtdCompositeRowsPendingAuthoritativeResolution',
      'ambiguousCompositeRows','providerStubs','raceObservedParentProfiles',
      'preservedProductionConflicts','identityAmbiguities','pedigreeRelationshipConflicts',
      'reviewOnlyRemovals','canonicalWriteProofGaps','quarantineReleaseProofGaps',
      'blockingQuarantineRows','unaccountedIdentityRows','unaccountedPedigreeRows',
      'unaccountedQuarantineRows','sourceLineageGaps'
    ]
    AND nonpedigree.blockers ?& ARRAY[
      'authoritativeFetchQueue','dogIdentityCollisions','dogTargetRelinks',
      'unlinkedIdentityClaims','nonverifiedIdentityClaims','r2OnlyIdentityRetrievalRequired',
      'unresolvedDogIdentities','compositeDogReviews','duplicateNoLossReviews',
      'unresolvedPseudoRaceRows','unresolvedSourceQuarantine'
    ]
    AND duplicate_proof.blockers ?& ARRAY[
      'nonFinalIdentityAuditedSource','sourceRowsWithoutProof','sourceBindingUnproven',
      'wholeDatabaseSearchUnproven','authoritativeIdentityUnproven',
      'duplicateRawRowIdentityOrFieldComparisonUnproven','duplicateIdentityConflicts',
      'existingCanonicalTargetUnproven','similarityOnlyProofs','verifiedFieldMergeUnproven',
      'provenanceOrIdentifierPreservationUnproven','relationshipPreservationUnproven',
      'referenceInventoryUnproven','unvalidatedInboundForeignKeyProofGaps',
      'referenceConservationUnproven','relationshipIntegrityUnproven',
      'noDataLossUnproven','appendOnlyAuditUnrecorded','unresolvedRows'
    ]
    AND duplicate_proof.source_datasets=(
      SELECT jsonb_object_agg(dataset,jsonb_build_object(
        'rows',expected_rows,'bytes',expected_bytes,'sha256',expected_sha256
      ) ORDER BY dataset)
      FROM _giq_history_merge.export_dataset_manifest
      WHERE dataset IN ('duplicates','quarantine')
    )
    AND (SELECT count(*)=2 AND bool_and(observed_rows=expected_rows AND staged_at IS NOT NULL)
         FROM _giq_history_merge.export_dataset_manifest
         WHERE dataset IN ('duplicates','quarantine'))
    AND NOT EXISTS(
      SELECT 1 FROM jsonb_each(pedigree.blockers) blocker
      WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
         OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
         OR blocker.value <> '0'::jsonb
    )
    AND NOT EXISTS(
      SELECT 1 FROM jsonb_each(nonpedigree.blockers) blocker
      WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
         OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
         OR blocker.value <> '0'::jsonb
    )
    AND NOT EXISTS(
      SELECT 1 FROM jsonb_each(duplicate_proof.blockers) blocker
      WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
         OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
         OR blocker.value <> '0'::jsonb
    );
  IF ready_manifest_pairs<>1 THEN
    RAISE EXCEPTION 'merge plan saturation/proof manifests are absent, stale, incomplete, or not ready';
  END IF;

  SELECT count(*) INTO manifest_blockers
  FROM (
    SELECT value FROM _giq_history_merge.authoritative_pedigree_saturation_manifest manifest
    CROSS JOIN LATERAL jsonb_each(manifest.blockers) item
    WHERE manifest.id=1
    UNION ALL
    SELECT value FROM _giq_history_merge.nonpedigree_saturation_manifest manifest
    CROSS JOIN LATERAL jsonb_each(manifest.blockers) item
    WHERE manifest.id=1
    UNION ALL
    SELECT value FROM _giq_history_merge.duplicate_quarantine_proof_manifest manifest
    CROSS JOIN LATERAL jsonb_each(manifest.blockers) item
    WHERE manifest.id=1
  ) blockers
  WHERE jsonb_typeof(value) IS DISTINCT FROM 'number'
     OR value::text !~ '^(0|[1-9][0-9]*)$'
     OR value <> '0'::jsonb;
  IF manifest_blockers<>0 THEN
    RAISE EXCEPTION 'merge plan saturation/proof manifests retain % blocking items',manifest_blockers;
  END IF;

  SELECT
    (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_retrieval_queue)+
    (SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine)+
    (SELECT count(*) FROM _giq_history_stage.authoritative_identity_evidence
      WHERE verification_status<>'verified')+
    (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_evidence
      WHERE verification_status<>'verified')+
    (SELECT count(*) FROM _giq_history_stage.authoritative_identity_resolution
      WHERE verification_status<>'verified'
         OR disposition NOT IN (
           'verified-existing-identity-candidate','verified-new-identity-candidate'
         ) OR canonical_write_eligible IS NOT TRUE
         OR candidate_count IS NULL OR candidate_count>1
         OR strong_candidate_count IS NULL OR strong_candidate_count>1)+
    (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE verification_status<>'verified'
         OR disposition NOT IN ('verified-no-change-candidate','verified-missing-parent-candidate')
         OR canonical_write_eligible IS NOT TRUE
         OR subject_dog_id IS NULL OR parent_dog_id IS NULL
         OR creates_cycle IS DISTINCT FROM false)+
    (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_conflict_ledger)+
    (SELECT count(*) FROM _giq_history_stage.authoritative_consolidation_proof
      WHERE release_eligible IS NOT TRUE)+
    (SELECT count(*) FROM _giq_history_stage.nonpedigree_authoritative_fetch_queue)+
    (SELECT count(*) FROM _giq_history_stage.nonpedigree_dog_composite_review_candidate)+
    (SELECT count(*) FROM _giq_history_stage.nonpedigree_dog_parent_review_candidate)+
    (SELECT count(*) FROM _giq_history_stage.nonpedigree_dog_identity_resolution
      WHERE exact_canonical_candidate_count IS NULL OR exact_canonical_candidate_count>1
         OR disposition='blocked-canonical-target-relink-required'
         OR unlinked_identity_claim_count IS DISTINCT FROM 0
         OR nonverified_identity_claim_count IS DISTINCT FROM 0
         OR (reuse_existing_allowed IS NOT TRUE AND create_new_allowed IS NOT TRUE))+
    (SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE source_dataset='duplicates' AND (
        candidate_count IS DISTINCT FROM 1 OR canonical_entity_id IS NULL
        OR authoritative_identity_proven IS NOT TRUE
        OR no_unique_data_loss_proven IS NOT TRUE
        OR reference_redirection_proven IS NOT TRUE
        OR removal_allowed IS NOT TRUE
        OR audit_ledger_recorded IS NOT TRUE
      ))+
    (SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE issue_type='profile-form-race-unresolved'
        AND disposition IN (
          'blocked-ambiguous-existing-race-candidates',
          'blocked-non-race-dog-url-no-race-creation'
        ))+
    (SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE source_dataset='quarantine' AND relationship_repair_allowed IS NOT TRUE)
    +(SELECT count(*) FROM _giq_history_stage.duplicate_quarantine_proof_resolution
      WHERE resolution_allowed IS NOT TRUE
         OR create_entity_allowed IS NOT FALSE
         OR (source_dataset='duplicates' AND duplicate_removal_allowed IS NOT TRUE)
         OR (source_dataset='quarantine' AND quarantine_release_allowed IS NOT TRUE)
         OR identity_audited_v2_source IS NOT TRUE
         OR source_binding_proven IS NOT TRUE
         OR whole_database_search_proven IS NOT TRUE
         OR exact_authoritative_identity_proven IS NOT TRUE
         OR duplicate_source_rows_same_identity_proven IS NOT TRUE
         OR canonical_target_exists IS NOT TRUE
         OR coalesce(similarity_only_evidence,true)
         OR verified_field_inventory_proven IS NOT TRUE
         OR coalesce(existing_verified_data_preserved,false) IS NOT TRUE
         OR coalesce(source_history_preserved,false) IS NOT TRUE
         OR coalesce(identifiers_preserved,false) IS NOT TRUE
         OR coalesce(relationships_preserved,false) IS NOT TRUE
         OR exhaustive_reference_inventory_proven IS NOT TRUE
         OR unvalidated_reference_constraints_proven IS NOT TRUE
         OR reference_conservation_proven IS NOT TRUE
         OR coalesce(relationship_integrity_verified,false) IS NOT TRUE
         OR coalesce(no_data_loss_verified,false) IS NOT TRUE
         OR coalesce(audit_ledger_recorded,false) IS NOT TRUE)
    +(SELECT CASE WHEN
        (SELECT count(*) FROM _giq_history_stage.duplicate_quarantine_proof_resolution)
          =coalesce(sum(expected_rows),-1)
        THEN 0 ELSE 1 END
      FROM _giq_history_merge.export_dataset_manifest
      WHERE dataset IN ('duplicates','quarantine'))
    +(SELECT CASE WHEN count(*)=2 THEN 0 ELSE 1 END
      FROM pg_trigger
      WHERE tgrelid IN (
          '_giq_history_merge.duplicate_quarantine_resolution_audit'::regclass,
          '_giq_history_merge.duplicate_quarantine_reference_proof'::regclass
        )
        AND tgname IN (
          'duplicate_quarantine_resolution_audit_append_only',
          'duplicate_quarantine_reference_proof_append_only'
        )
        AND tgenabled<>'D')
    +(SELECT count(*)
      FROM (
        SELECT 'duplicates'::text AS source_dataset,source_file,line_number,
          payload->>'issueType' AS issue_type,payload->>'naturalKey' AS source_natural_key,
          payload,encode(digest(payload::text,'sha256'),'hex') AS source_payload_sha256
        FROM _giq_history_stage.export_duplicates
        UNION ALL
        SELECT 'quarantine',source_file,line_number,payload->>'issueType',
          payload->>'naturalKey',payload,encode(digest(payload::text,'sha256'),'hex')
        FROM _giq_history_stage.export_quarantine
      ) source
      FULL JOIN _giq_history_stage.duplicate_quarantine_issue issue
        USING(source_dataset,source_file,line_number)
      WHERE source.source_dataset IS NULL OR issue.source_dataset IS NULL
         OR source.issue_type IS DISTINCT FROM issue.issue_type
         OR source.source_natural_key IS DISTINCT FROM issue.source_natural_key
         OR source.payload IS DISTINCT FROM issue.source_payload
         OR source.source_payload_sha256 IS DISTINCT FROM issue.source_payload_sha256
         OR issue.normalized_manifest_sha256 IS DISTINCT FROM (
           SELECT normalized_manifest_sha256 FROM _giq_history_merge.run WHERE id=1)
         OR issue.source_history_cutoff IS DISTINCT FROM (
           SELECT source_history_cutoff FROM _giq_history_merge.run WHERE id=1))
  INTO direct_saturation_blockers;
  IF direct_saturation_blockers<>0 THEN
    RAISE EXCEPTION 'merge plan source tables retain % queues, conflicts, or review-only removals',
      direct_saturation_blockers;
  END IF;

  SELECT count(*) INTO blocking_rows FROM _giq_history_merge.quarantine WHERE blocking;
  IF blocking_rows<>0 THEN
    RAISE EXCEPTION 'merge plan has % unexplained blocking quarantine rows',blocking_rows;
  END IF;
END
$$;

WITH plan(entity,staged,inserts,existing_targets) AS (
  SELECT 'Track',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_track s LEFT JOIN public."Track" p ON p.id=s.target_id
  UNION ALL
  SELECT 'Trainer',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_trainer s LEFT JOIN public."Trainer" p ON p.id=s.target_id
  UNION ALL
  SELECT 'Dog',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_dog s LEFT JOIN public."Dog" p ON p.id=s.target_id
  UNION ALL
  SELECT 'Meeting',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_meeting s LEFT JOIN public."Meeting" p ON p.id=s.target_id
  UNION ALL
  SELECT 'Race',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_race s LEFT JOIN public."Race" p ON p.id=s.target_id
  UNION ALL
  SELECT 'Runner',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_runner s LEFT JOIN public."Runner" p ON p.id=s.target_id
  UNION ALL
  SELECT 'Result',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_result s LEFT JOIN public."Result" p ON p.id=s.target_id
  UNION ALL
  SELECT 'FormEntry',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_form_entry s LEFT JOIN public."FormEntry" p ON p.id=s.target_id
  UNION ALL
  SELECT 'DogProfileForm',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_profile_form s LEFT JOIN public."DogProfileForm" p ON p.id=s.target_id
  UNION ALL
  SELECT 'RaceVideo',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_race_video s LEFT JOIN public."RaceVideo" p ON p.id=s.target_id
  UNION ALL
  SELECT 'DogProfileArchive',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_dog_profile_archive s LEFT JOIN public."DogProfileArchive" p ON p.id=s.target_id
  UNION ALL
  SELECT 'RaceDayArchive',count(*),count(*) FILTER(WHERE p.id IS NULL),count(*) FILTER(WHERE p.id IS NOT NULL)
  FROM _giq_history_stage.normalized_race_day_archive s LEFT JOIN public."RaceDayArchive" p ON p.id=s.target_id
  UNION ALL
  SELECT 'PedigreeImportRun',9,
    9-count(*),count(*)
  FROM public."PedigreeImportRun"
  WHERE ("sourceProvider"='thedogs' AND "artifactSha256"=(
         SELECT normalized_manifest_sha256 FROM _giq_history_merge.run WHERE id=1
       ))
     OR ("sourceProvider"='galtd' AND "artifactSha256" IN (
       SELECT DISTINCT payload->>'artifactSha256' FROM _giq_history_stage.galtd_observation
     ))
  UNION ALL
  SELECT 'DogSourceIdentity',staged,
    staged-existing,existing
  FROM (
    SELECT
      (SELECT count(*) FROM _giq_history_stage.normalized_dog
       WHERE source_provider='thedogs' AND source_id ~ '^[0-9]+$')+
      (SELECT count(*) FROM _giq_history_stage.galtd_observation) AS staged,
      (SELECT count(*) FROM public."DogSourceIdentity"
       WHERE ("sourceProvider"='thedogs' AND "artifactSha256"=(
              SELECT normalized_manifest_sha256 FROM _giq_history_merge.run WHERE id=1
            ))
          OR ("sourceProvider"='galtd' AND "artifactSha256" IN (
            SELECT DISTINCT payload->>'artifactSha256' FROM _giq_history_stage.galtd_observation))) AS existing
  ) identity_plan
  UNION ALL
  SELECT 'PedigreeAssertion',staged,staged-existing,existing
  FROM (
    SELECT
      (SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge WHERE duplicate_rank=1)+
      (SELECT count(*) FROM _giq_history_stage.galtd_assertion) AS staged,
      (SELECT count(*) FROM public."PedigreeAssertion"
       WHERE ("sourceProvider"='thedogs' AND "artifactSha256"=(
              SELECT normalized_manifest_sha256 FROM _giq_history_merge.run WHERE id=1
            ))
          OR ("sourceProvider"='galtd' AND "artifactSha256" IN (
            SELECT DISTINCT payload->>'artifactSha256' FROM _giq_history_stage.galtd_assertion))) AS existing
  ) assertion_plan
  UNION ALL
  SELECT 'PedigreeMergeLedger',staged,staged-existing,existing
  FROM (
    SELECT
      (SELECT count(*)
       FROM _giq_history_stage.normalized_pedigree_edge edge
       LEFT JOIN public."Dog" dog ON dog.id=edge.child_id
       WHERE edge.duplicate_rank=1
         AND (edge.self_parent OR
              CASE edge.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END IS NOT NULL))+
      (SELECT count(*)*2 FROM _giq_history_stage.galtd_exact_crosswalk WHERE canonical_eligible) AS staged,
      (SELECT count(*) FROM public."PedigreeMergeLedger"
       WHERE ("sourceProvider"='thedogs' AND "artifactSha256"=(
              SELECT normalized_manifest_sha256 FROM _giq_history_merge.run WHERE id=1
            ))
          OR ("sourceProvider"='galtd' AND "artifactSha256" IN (
            SELECT DISTINCT payload->>'artifactSha256' FROM _giq_history_stage.galtd_assertion))) AS existing
  ) ledger_plan
  UNION ALL
  SELECT 'DogParentLink',count(*),
    count(*) FILTER(WHERE existing_parent_id IS NULL),
    count(*) FILTER(WHERE existing_parent_id IS NOT NULL)
  FROM (
    SELECT x.child_id,relationship,
      CASE relationship WHEN 'sire' THEN d."sireId" ELSE d."damId" END AS existing_parent_id
    FROM _giq_history_stage.galtd_exact_crosswalk x
    CROSS JOIN LATERAL unnest(ARRAY['sire','dam']::text[]) relationship
    LEFT JOIN public."Dog" d ON d.id=x.child_id
    WHERE x.canonical_eligible
  ) parent_plan
)
SELECT jsonb_build_object(
  'event','CANONICAL_MERGE_PLAN_VERIFIED',
  'database',current_database(),
  'phase',(SELECT phase FROM _giq_history_merge.run WHERE id=1),
  'candidateOnly',true,
  'sourceAccessModeDeclared','read-only inputs; final proof occurs after before/after source manifests',
  'entities',jsonb_object_agg(entity,jsonb_build_object(
    'staged',staged,'inserts',inserts,'existingTargets',existing_targets
  ) ORDER BY entity),
  'quarantine',jsonb_build_object(
    'total',(SELECT count(*) FROM _giq_history_merge.quarantine),
    'blocking',0,
    'galtdConflictRows',(SELECT count(*) FROM _giq_history_merge.quarantine
      WHERE source_name='galtd' AND reason_code='conflicting-source-observation'),
    'replayProviderConflictRows',(SELECT count(*) FROM _giq_history_merge.quarantine
      WHERE reason_code='quarantined-provider-id-race-conflict')
  )
)
FROM plan;

CREATE TEMP TABLE giq_canonical_merge_plan_attestation (
  id integer PRIMARY KEY CHECK(id=1),
  schema_version text NOT NULL CHECK(schema_version='giq-canonical-merge-plan-attestation/v1'),
  database_name name NOT NULL,
  database_oid oid NOT NULL,
  backend_pid integer NOT NULL,
  clone_operation_id uuid NOT NULL,
  phase text NOT NULL,
  normalized_manifest_sha256 text NOT NULL CHECK(normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  normalized_transform_version text NOT NULL,
  source_history_cutoff timestamptz NOT NULL,
  pedigree_schema_version text NOT NULL,
  pedigree_manifest_sha256 text NOT NULL CHECK(pedigree_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  pedigree_source_history_cutoff timestamptz NOT NULL,
  pedigree_status text NOT NULL,
  pedigree_blockers_sha256 text NOT NULL CHECK(pedigree_blockers_sha256 ~ '^[0-9a-f]{64}$'),
  nonpedigree_schema_version text NOT NULL,
  nonpedigree_manifest_sha256 text NOT NULL CHECK(nonpedigree_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  nonpedigree_source_history_cutoff timestamptz NOT NULL,
  nonpedigree_status text NOT NULL,
  nonpedigree_blockers_sha256 text NOT NULL CHECK(nonpedigree_blockers_sha256 ~ '^[0-9a-f]{64}$'),
  duplicate_proof_schema_version text NOT NULL,
  duplicate_proof_manifest_sha256 text NOT NULL CHECK(duplicate_proof_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  duplicate_proof_source_history_cutoff timestamptz NOT NULL,
  duplicate_proof_status text NOT NULL,
  duplicate_proof_blockers_sha256 text NOT NULL CHECK(duplicate_proof_blockers_sha256 ~ '^[0-9a-f]{64}$'),
  nonce uuid NOT NULL,
  planned_at timestamptz NOT NULL,
  attestation_sha256 text NOT NULL CHECK(attestation_sha256 ~ '^[0-9a-f]{64}$')
) ON COMMIT PRESERVE ROWS;

WITH lineage AS (
  SELECT current_database() AS database_name,
    (SELECT oid FROM pg_database WHERE datname=current_database()) AS database_oid,
    pg_backend_pid() AS backend_pid,
    run.clone_operation_id,run.phase,run.normalized_manifest_sha256,
    run.normalized_transform_version,run.source_history_cutoff,
    pedigree.schema_version AS pedigree_schema_version,
    pedigree.normalized_manifest_sha256 AS pedigree_manifest_sha256,
    pedigree.source_history_cutoff AS pedigree_source_history_cutoff,
    pedigree.status AS pedigree_status,
    encode(digest(convert_to(pedigree.blockers::text,'UTF8'),'sha256'),'hex')
      AS pedigree_blockers_sha256,
    nonpedigree.schema_version AS nonpedigree_schema_version,
    nonpedigree.normalized_manifest_sha256 AS nonpedigree_manifest_sha256,
    nonpedigree.source_history_cutoff AS nonpedigree_source_history_cutoff,
    nonpedigree.status AS nonpedigree_status,
    encode(digest(convert_to(nonpedigree.blockers::text,'UTF8'),'sha256'),'hex')
      AS nonpedigree_blockers_sha256,
    duplicate_proof.schema_version AS duplicate_proof_schema_version,
    duplicate_proof.normalized_manifest_sha256 AS duplicate_proof_manifest_sha256,
    duplicate_proof.source_history_cutoff AS duplicate_proof_source_history_cutoff,
    duplicate_proof.status AS duplicate_proof_status,
    encode(digest(convert_to(duplicate_proof.blockers::text,'UTF8'),'sha256'),'hex')
      AS duplicate_proof_blockers_sha256,
    gen_random_uuid() AS nonce,
    clock_timestamp() AS planned_at
  FROM _giq_history_merge.run run
  JOIN _giq_history_merge.authoritative_pedigree_saturation_manifest pedigree ON pedigree.id=1
  JOIN _giq_history_merge.nonpedigree_saturation_manifest nonpedigree ON nonpedigree.id=1
  JOIN _giq_history_merge.duplicate_quarantine_proof_manifest duplicate_proof ON duplicate_proof.id=1
  WHERE run.id=1
), attestation AS (
  SELECT lineage.*,
    encode(digest(convert_to(jsonb_build_object(
      'schemaVersion','giq-canonical-merge-plan-attestation/v1',
      'database',database_name,
      'databaseOid',database_oid::text,
      'backendPid',backend_pid,
      'cloneOperationId',clone_operation_id::text,
      'phase',phase,
      'normalizedManifestSha256',normalized_manifest_sha256,
      'normalizedTransformVersion',normalized_transform_version,
      'sourceHistoryCutoff',to_char(source_history_cutoff AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'pedigreeSchemaVersion',pedigree_schema_version,
      'pedigreeManifestSha256',pedigree_manifest_sha256,
      'pedigreeSourceHistoryCutoff',to_char(pedigree_source_history_cutoff AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'pedigreeStatus',pedigree_status,
      'pedigreeBlockersSha256',pedigree_blockers_sha256,
      'nonpedigreeSchemaVersion',nonpedigree_schema_version,
      'nonpedigreeManifestSha256',nonpedigree_manifest_sha256,
      'nonpedigreeSourceHistoryCutoff',to_char(nonpedigree_source_history_cutoff AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'nonpedigreeStatus',nonpedigree_status,
      'nonpedigreeBlockersSha256',nonpedigree_blockers_sha256,
      'duplicateProofSchemaVersion',duplicate_proof_schema_version,
      'duplicateProofManifestSha256',duplicate_proof_manifest_sha256,
      'duplicateProofSourceHistoryCutoff',to_char(duplicate_proof_source_history_cutoff AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'duplicateProofStatus',duplicate_proof_status,
      'duplicateProofBlockersSha256',duplicate_proof_blockers_sha256,
      'nonce',nonce::text,
      'plannedAt',to_char(planned_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    )::text,'UTF8'),'sha256'),'hex') AS attestation_sha256
  FROM lineage
)
INSERT INTO pg_temp.giq_canonical_merge_plan_attestation (
  id,schema_version,database_name,database_oid,backend_pid,clone_operation_id,phase,
  normalized_manifest_sha256,normalized_transform_version,source_history_cutoff,
  pedigree_schema_version,pedigree_manifest_sha256,pedigree_source_history_cutoff,
  pedigree_status,pedigree_blockers_sha256,nonpedigree_schema_version,
  nonpedigree_manifest_sha256,nonpedigree_source_history_cutoff,nonpedigree_status,
  nonpedigree_blockers_sha256,duplicate_proof_schema_version,
  duplicate_proof_manifest_sha256,duplicate_proof_source_history_cutoff,
  duplicate_proof_status,duplicate_proof_blockers_sha256,nonce,planned_at,attestation_sha256
)
SELECT 1,'giq-canonical-merge-plan-attestation/v1',database_name,database_oid,backend_pid,
  clone_operation_id,phase,normalized_manifest_sha256,normalized_transform_version,
  source_history_cutoff,pedigree_schema_version,pedigree_manifest_sha256,
  pedigree_source_history_cutoff,pedigree_status,pedigree_blockers_sha256,
  nonpedigree_schema_version,nonpedigree_manifest_sha256,nonpedigree_source_history_cutoff,
  nonpedigree_status,nonpedigree_blockers_sha256,duplicate_proof_schema_version,
  duplicate_proof_manifest_sha256,duplicate_proof_source_history_cutoff,
  duplicate_proof_status,duplicate_proof_blockers_sha256,nonce,planned_at,attestation_sha256
FROM attestation;

COMMIT;
