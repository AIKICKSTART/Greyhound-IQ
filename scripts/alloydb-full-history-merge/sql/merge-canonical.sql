\set ON_ERROR_STOP on

BEGIN;
SET LOCAL app.system='true';
SET LOCAL "app.current_role"='system';
SET LOCAL app.current_tier='system';
SET LOCAL synchronous_commit=on;
SET LOCAL statement_timeout=0;

DO $$
DECLARE
  observed_phase text;
  blocking_rows bigint;
  run_clone_operation_id uuid;
  run_manifest_sha256 text;
  run_transform_version text;
  run_source_history_cutoff timestamptz;
  authoritative_schema_version text;
  authoritative_manifest_sha256 text;
  authoritative_source_history_cutoff timestamptz;
  authoritative_status text;
  authoritative_blockers jsonb;
  authoritative_counts jsonb;
  nonpedigree_schema_version text;
  nonpedigree_manifest_sha256 text;
  nonpedigree_source_history_cutoff timestamptz;
  nonpedigree_status text;
  nonpedigree_blockers jsonb;
  duplicate_proof_schema_version text;
  duplicate_proof_manifest_sha256 text;
  duplicate_proof_transform_version text;
  duplicate_proof_source_history_cutoff timestamptz;
  duplicate_proof_source_datasets jsonb;
  duplicate_proof_status text;
  duplicate_proof_blockers jsonb;
  unresolved_direct_rows bigint;
  attestation_relation oid;
  attestation_expected_columns bigint;
  attestation_actual_columns bigint;
  attestation_rows bigint;
  attestation_consumed bigint;
  attestation_schema_version text;
  attestation_database_name name;
  attestation_database_oid oid;
  attestation_backend_pid integer;
  attestation_clone_operation_id uuid;
  attestation_phase text;
  attestation_manifest_sha256 text;
  attestation_transform_version text;
  attestation_source_history_cutoff timestamptz;
  attestation_pedigree_schema_version text;
  attestation_pedigree_manifest_sha256 text;
  attestation_pedigree_source_history_cutoff timestamptz;
  attestation_pedigree_status text;
  attestation_pedigree_blockers_sha256 text;
  attestation_pedigree_terminal_counts_sha256 text;
  attestation_nonpedigree_schema_version text;
  attestation_nonpedigree_manifest_sha256 text;
  attestation_nonpedigree_source_history_cutoff timestamptz;
  attestation_nonpedigree_status text;
  attestation_nonpedigree_blockers_sha256 text;
  attestation_duplicate_proof_schema_version text;
  attestation_duplicate_proof_manifest_sha256 text;
  attestation_duplicate_proof_source_history_cutoff timestamptz;
  attestation_duplicate_proof_status text;
  attestation_duplicate_proof_blockers_sha256 text;
  attestation_nonce uuid;
  attestation_planned_at timestamptz;
  attestation_sha256 text;
  expected_attestation_sha256 text;
  current_database_oid oid;
  current_pedigree_blockers_sha256 text;
  current_pedigree_terminal_counts_sha256 text;
  current_nonpedigree_blockers_sha256 text;
  current_duplicate_proof_blockers_sha256 text;
  evidence_relation record;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'canonical merge database mismatch';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto') THEN
    RAISE EXCEPTION 'canonical merge requires pgcrypto before evidence digest calls';
  END IF;
  SELECT clone_operation_id,phase,normalized_manifest_sha256,
         normalized_transform_version,source_history_cutoff
  INTO STRICT run_clone_operation_id,observed_phase,run_manifest_sha256,
              run_transform_version,run_source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1 FOR UPDATE;
  IF observed_phase<>'normalized' THEN
    RAISE EXCEPTION 'canonical merge requires normalized, observed %',observed_phase;
  END IF;
  IF run_manifest_sha256 !~ '^[0-9a-f]{64}$'
     OR run_transform_version<>'thedogs-normalized-harvest/v2'
     OR run_source_history_cutoff IS NULL THEN
    RAISE EXCEPTION 'canonical merge run lineage is incomplete or uses an unapproved normalization transform';
  END IF;
  IF to_regclass('_giq_history_merge.authoritative_pedigree_saturation_manifest') IS NULL
     OR to_regclass('_giq_history_merge.nonpedigree_saturation_manifest') IS NULL
     OR to_regclass('_giq_history_merge.duplicate_quarantine_proof_manifest') IS NULL
     OR to_regclass('_giq_history_merge.duplicate_quarantine_resolution_audit') IS NULL
     OR to_regclass('_giq_history_merge.duplicate_quarantine_reference_proof') IS NULL
     OR to_regclass('_giq_history_stage.authoritative_pedigree_assertion_occurrence') IS NULL
     OR to_regclass('_giq_history_stage.authoritative_pedigree_terminal_proof_leaf') IS NULL
     OR to_regclass('_giq_history_stage.duplicate_quarantine_proof_resolution') IS NULL
     OR to_regclass('_giq_history_stage.nonpedigree_dog_identity_resolution') IS NULL
     OR to_regclass('_giq_history_stage.authoritative_pedigree_retrieval_queue') IS NULL
     OR to_regclass('_giq_history_stage.nonpedigree_authoritative_fetch_queue') IS NULL
     OR to_regclass('_giq_history_stage.nonpedigree_dog_composite_review_candidate') IS NULL
     OR to_regclass('_giq_history_stage.nonpedigree_dog_parent_review_candidate') IS NULL
     OR to_regclass('_giq_history_stage.authoritative_consolidation_proof') IS NULL
     OR to_regclass('_giq_history_stage.nonpedigree_row_disposition') IS NULL THEN
    RAISE EXCEPTION 'canonical merge requires complete authoritative pedigree, non-pedigree, and duplicate/quarantine proof evidence';
  END IF;

  -- Freeze all staged source and review evidence for the rest of this
  -- transaction. The public canonical tables are locked immediately after this
  -- guard, before any reviewed decision is consumed.
  FOR evidence_relation IN
    SELECT namespace.nspname AS schema_name,relation.relname AS relation_name
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
    WHERE namespace.nspname='_giq_history_stage' AND relation.relkind IN ('r','p')
    ORDER BY relation.relname
  LOOP
    EXECUTE format('LOCK TABLE %I.%I IN SHARE MODE',
      evidence_relation.schema_name,evidence_relation.relation_name);
  END LOOP;
  LOCK TABLE _giq_history_merge.quarantine,
    _giq_history_merge.export_dataset_manifest,
    _giq_history_merge.authoritative_pedigree_saturation_manifest,
    _giq_history_merge.nonpedigree_saturation_manifest,
    _giq_history_merge.duplicate_quarantine_proof_manifest,
    _giq_history_merge.duplicate_quarantine_resolution_audit,
    _giq_history_merge.duplicate_quarantine_reference_proof
  IN SHARE MODE;

  SELECT count(*) INTO blocking_rows FROM _giq_history_merge.quarantine WHERE blocking;
  IF blocking_rows<>0 THEN
    RAISE EXCEPTION 'canonical merge has % unexplained blocking quarantine rows',blocking_rows;
  END IF;

  SELECT schema_version,normalized_manifest_sha256,source_history_cutoff,status,blockers,counts
  INTO STRICT authoritative_schema_version,authoritative_manifest_sha256,
              authoritative_source_history_cutoff,authoritative_status,authoritative_blockers,
              authoritative_counts
  FROM _giq_history_merge.authoritative_pedigree_saturation_manifest WHERE id=1;
  IF authoritative_schema_version<>'giq-authoritative-pedigree-saturation/v2'
     OR authoritative_manifest_sha256 IS DISTINCT FROM run_manifest_sha256
     OR authoritative_source_history_cutoff IS DISTINCT FROM run_source_history_cutoff
     OR authoritative_status<>'ready'
     OR jsonb_typeof(authoritative_blockers)<>'object'
     OR jsonb_object_length(authoritative_blockers)<>7
     OR NOT authoritative_blockers ?& ARRAY[
       'identityPending','relationshipPending','authorityConflict',
       'canonicalIntegrity','persistence','accounting','coverage'
     ]::text[]
     OR jsonb_typeof(authoritative_counts)<>'object'
     OR NOT authoritative_counts ?& ARRAY[
       'assertionOccurrences','pedigreeResolutions','terminalInvalidImpossible',
       'terminalSupersededConflict','terminalUnlinkedConflictCovered',
       'terminalCorroborationOnlyCovered','terminalNonblocking','terminalBlocking',
       'applyCandidates'
     ]::text[]
     OR EXISTS(
       SELECT 1 FROM jsonb_each(authoritative_blockers) blocker
       WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
          OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
          OR blocker.value <> '0'::jsonb
     )
     OR authoritative_counts->'assertionOccurrences' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence))
     OR authoritative_counts->'pedigreeResolutions' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution))
     OR authoritative_counts->'terminalInvalidImpossible' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition='terminal_invalid_impossible'))
     OR authoritative_counts->'terminalSupersededConflict' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition='terminal_superseded_conflict'))
     OR authoritative_counts->'terminalUnlinkedConflictCovered' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition='terminal_unlinked_conflict_covered'))
     OR authoritative_counts->'terminalCorroborationOnlyCovered' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition='terminal_corroboration_only_covered'))
     OR authoritative_counts->'terminalNonblocking' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition IN (
         'terminal_invalid_impossible','terminal_superseded_conflict',
         'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
       ) AND NOT canonical_safety_blocking AND NOT coverage_blocking))
     OR authoritative_counts->'terminalBlocking' IS DISTINCT FROM '0'::jsonb
     OR authoritative_counts->'applyCandidates' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition='verified_apply_candidate' AND canonical_write_eligible)) THEN
    RAISE EXCEPTION 'canonical merge requires an exact, run-bound, blocker-free authoritative pedigree saturation manifest';
  END IF;

  SELECT schema_version,normalized_manifest_sha256,source_history_cutoff,status,blockers
  INTO STRICT nonpedigree_schema_version,nonpedigree_manifest_sha256,
              nonpedigree_source_history_cutoff,nonpedigree_status,nonpedigree_blockers
  FROM _giq_history_merge.nonpedigree_saturation_manifest WHERE id=1;
  IF nonpedigree_schema_version<>'giq-nonpedigree-saturation/v1'
     OR nonpedigree_manifest_sha256 IS DISTINCT FROM run_manifest_sha256
     OR nonpedigree_source_history_cutoff IS DISTINCT FROM run_source_history_cutoff
     OR nonpedigree_status<>'ready'
     OR jsonb_typeof(nonpedigree_blockers)<>'object'
     OR jsonb_object_length(nonpedigree_blockers)<>11
     OR NOT nonpedigree_blockers ?& ARRAY[
       'authoritativeFetchQueue','dogIdentityCollisions','dogTargetRelinks',
       'unlinkedIdentityClaims','nonverifiedIdentityClaims','r2OnlyIdentityRetrievalRequired',
       'unresolvedDogIdentities','compositeDogReviews','duplicateNoLossReviews',
       'unresolvedPseudoRaceRows','unresolvedSourceQuarantine'
     ]::text[]
     OR EXISTS(
       SELECT 1 FROM jsonb_each(nonpedigree_blockers) blocker
       WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
          OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
          OR blocker.value <> '0'::jsonb
     ) THEN
    RAISE EXCEPTION 'canonical merge requires an exact, run-bound, blocker-free non-pedigree saturation manifest';
  END IF;

  SELECT schema_version,normalized_manifest_sha256,normalized_transform_version,
         source_history_cutoff,source_datasets,status,blockers
  INTO STRICT duplicate_proof_schema_version,duplicate_proof_manifest_sha256,
              duplicate_proof_transform_version,duplicate_proof_source_history_cutoff,
              duplicate_proof_source_datasets,duplicate_proof_status,duplicate_proof_blockers
  FROM _giq_history_merge.duplicate_quarantine_proof_manifest WHERE id=1;
  IF duplicate_proof_schema_version<>'giq-duplicate-quarantine-proof/v1'
     OR duplicate_proof_manifest_sha256 IS DISTINCT FROM run_manifest_sha256
     OR duplicate_proof_transform_version IS DISTINCT FROM run_transform_version
     OR duplicate_proof_source_history_cutoff IS DISTINCT FROM run_source_history_cutoff
     OR duplicate_proof_source_datasets IS DISTINCT FROM (
       SELECT jsonb_object_agg(dataset,jsonb_build_object(
         'rows',expected_rows,'bytes',expected_bytes,'sha256',expected_sha256
       ) ORDER BY dataset)
       FROM _giq_history_merge.export_dataset_manifest
       WHERE dataset IN ('duplicates','quarantine')
     )
     OR NOT (SELECT count(*)=2
                    AND bool_and(observed_rows=expected_rows AND staged_at IS NOT NULL)
             FROM _giq_history_merge.export_dataset_manifest
             WHERE dataset IN ('duplicates','quarantine'))
     OR duplicate_proof_status<>'ready'
     OR jsonb_typeof(duplicate_proof_blockers)<>'object'
     OR jsonb_object_length(duplicate_proof_blockers)<>19
     OR NOT duplicate_proof_blockers ?& ARRAY[
       'nonFinalIdentityAuditedSource','sourceRowsWithoutProof','sourceBindingUnproven',
       'wholeDatabaseSearchUnproven','authoritativeIdentityUnproven',
       'duplicateRawRowIdentityOrFieldComparisonUnproven','duplicateIdentityConflicts',
       'existingCanonicalTargetUnproven','similarityOnlyProofs','verifiedFieldMergeUnproven',
       'provenanceOrIdentifierPreservationUnproven','relationshipPreservationUnproven',
       'referenceInventoryUnproven','unvalidatedInboundForeignKeyProofGaps',
       'referenceConservationUnproven','relationshipIntegrityUnproven',
       'noDataLossUnproven','appendOnlyAuditUnrecorded','unresolvedRows'
     ]::text[]
     OR EXISTS(
       SELECT 1 FROM jsonb_each(duplicate_proof_blockers) blocker
       WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
          OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
          OR blocker.value <> '0'::jsonb
     )
     OR (SELECT count(*) FROM _giq_history_stage.duplicate_quarantine_proof_resolution)
        IS DISTINCT FROM (
          SELECT sum(expected_rows) FROM _giq_history_merge.export_dataset_manifest
          WHERE dataset IN ('duplicates','quarantine')
        )
     OR EXISTS(
       SELECT 1 FROM _giq_history_stage.duplicate_quarantine_proof_resolution resolution
       WHERE resolution.resolution_allowed IS NOT TRUE
          OR resolution.create_entity_allowed IS NOT FALSE
          OR (resolution.source_dataset='duplicates'
              AND resolution.duplicate_removal_allowed IS NOT TRUE)
          OR (resolution.source_dataset='quarantine'
              AND resolution.quarantine_release_allowed IS NOT TRUE)
          OR resolution.identity_audited_v2_source IS NOT TRUE
          OR resolution.source_binding_proven IS NOT TRUE
          OR resolution.whole_database_search_proven IS NOT TRUE
          OR resolution.exact_authoritative_identity_proven IS NOT TRUE
          OR resolution.duplicate_source_rows_same_identity_proven IS NOT TRUE
          OR resolution.canonical_target_exists IS NOT TRUE
          OR coalesce(resolution.similarity_only_evidence,true)
          OR resolution.verified_field_inventory_proven IS NOT TRUE
          OR coalesce(resolution.existing_verified_data_preserved,false) IS NOT TRUE
          OR coalesce(resolution.source_history_preserved,false) IS NOT TRUE
          OR coalesce(resolution.identifiers_preserved,false) IS NOT TRUE
          OR coalesce(resolution.relationships_preserved,false) IS NOT TRUE
          OR resolution.exhaustive_reference_inventory_proven IS NOT TRUE
          OR resolution.unvalidated_reference_constraints_proven IS NOT TRUE
          OR resolution.reference_conservation_proven IS NOT TRUE
          OR coalesce(resolution.relationship_integrity_verified,false) IS NOT TRUE
          OR coalesce(resolution.no_data_loss_verified,false) IS NOT TRUE
          OR coalesce(resolution.audit_ledger_recorded,false) IS NOT TRUE
     )
     OR EXISTS(
       WITH source_row AS (
         SELECT 'duplicates'::text AS source_dataset,source_file,line_number,
           payload->>'issueType' AS issue_type,payload->>'naturalKey' AS source_natural_key,
           payload,encode(digest(payload::text,'sha256'),'hex') AS source_payload_sha256
         FROM _giq_history_stage.export_duplicates
         UNION ALL
         SELECT 'quarantine',source_file,line_number,payload->>'issueType',
           payload->>'naturalKey',payload,encode(digest(payload::text,'sha256'),'hex')
         FROM _giq_history_stage.export_quarantine
       )
       SELECT 1
       FROM source_row source
       FULL JOIN _giq_history_stage.duplicate_quarantine_issue issue
         USING(source_dataset,source_file,line_number)
       WHERE source.source_dataset IS NULL OR issue.source_dataset IS NULL
          OR source.issue_type IS DISTINCT FROM issue.issue_type
          OR source.source_natural_key IS DISTINCT FROM issue.source_natural_key
          OR source.payload IS DISTINCT FROM issue.source_payload
          OR source.source_payload_sha256 IS DISTINCT FROM issue.source_payload_sha256
          OR issue.normalized_manifest_sha256 IS DISTINCT FROM run_manifest_sha256
          OR issue.source_history_cutoff IS DISTINCT FROM run_source_history_cutoff
     )
     OR (SELECT count(*) FROM pg_trigger
         WHERE tgrelid IN (
             '_giq_history_merge.duplicate_quarantine_resolution_audit'::regclass,
             '_giq_history_merge.duplicate_quarantine_reference_proof'::regclass
           )
           AND tgname IN (
             'duplicate_quarantine_resolution_audit_append_only',
             'duplicate_quarantine_reference_proof_append_only'
           )
           AND tgenabled<>'D')<>2 THEN
    RAISE EXCEPTION 'canonical merge requires an exact, run-bound, blocker-free duplicate/quarantine proof manifest and exhaustive resolution set';
  END IF;

  attestation_relation := to_regclass('pg_temp.giq_canonical_merge_plan_attestation');
  IF attestation_relation IS NULL OR NOT EXISTS(
    SELECT 1 FROM pg_class relation
    WHERE relation.oid=attestation_relation
      AND relation.relnamespace=pg_my_temp_schema()
      AND relation.relpersistence='t'
      AND relation.relkind='r'
  ) THEN
    RAISE EXCEPTION 'canonical merge requires the same-session read-only plan attestation';
  END IF;

  SELECT count(*) INTO attestation_expected_columns
  FROM (VALUES
    ('id','integer'::regtype),('schema_version','text'::regtype),
    ('database_name','name'::regtype),('database_oid','oid'::regtype),
    ('backend_pid','integer'::regtype),('clone_operation_id','uuid'::regtype),
    ('phase','text'::regtype),('normalized_manifest_sha256','text'::regtype),
    ('normalized_transform_version','text'::regtype),
    ('source_history_cutoff','timestamp with time zone'::regtype),
    ('pedigree_schema_version','text'::regtype),
    ('pedigree_manifest_sha256','text'::regtype),
    ('pedigree_source_history_cutoff','timestamp with time zone'::regtype),
    ('pedigree_status','text'::regtype),('pedigree_blockers_sha256','text'::regtype),
    ('pedigree_terminal_counts_sha256','text'::regtype),
    ('nonpedigree_schema_version','text'::regtype),
    ('nonpedigree_manifest_sha256','text'::regtype),
    ('nonpedigree_source_history_cutoff','timestamp with time zone'::regtype),
    ('nonpedigree_status','text'::regtype),
    ('nonpedigree_blockers_sha256','text'::regtype),
    ('duplicate_proof_schema_version','text'::regtype),
    ('duplicate_proof_manifest_sha256','text'::regtype),
    ('duplicate_proof_source_history_cutoff','timestamp with time zone'::regtype),
    ('duplicate_proof_status','text'::regtype),
    ('duplicate_proof_blockers_sha256','text'::regtype),('nonce','uuid'::regtype),
    ('planned_at','timestamp with time zone'::regtype),('attestation_sha256','text'::regtype)
  ) required(column_name,type_oid)
  JOIN pg_attribute attribute
    ON attribute.attrelid=attestation_relation
   AND attribute.attname=required.column_name
   AND attribute.atttypid=required.type_oid
   AND attribute.attnotnull
   AND attribute.attnum>0
   AND NOT attribute.attisdropped;
  SELECT count(*) INTO attestation_actual_columns
  FROM pg_attribute attribute
  WHERE attribute.attrelid=attestation_relation
    AND attribute.attnum>0 AND NOT attribute.attisdropped;
  IF attestation_expected_columns<>29 OR attestation_actual_columns<>29 THEN
    RAISE EXCEPTION 'canonical merge plan attestation relation has an unapproved shape';
  END IF;

  EXECUTE 'SELECT count(*) FROM pg_temp.giq_canonical_merge_plan_attestation'
    INTO attestation_rows;
  IF attestation_rows<>1 THEN
    RAISE EXCEPTION 'canonical merge plan attestation must contain exactly one row';
  END IF;
  EXECUTE $attestation$
    SELECT schema_version,database_name,database_oid,backend_pid,clone_operation_id,phase,
      normalized_manifest_sha256,normalized_transform_version,source_history_cutoff,
      pedigree_schema_version,pedigree_manifest_sha256,pedigree_source_history_cutoff,
      pedigree_status,pedigree_blockers_sha256,pedigree_terminal_counts_sha256,
      nonpedigree_schema_version,
      nonpedigree_manifest_sha256,nonpedigree_source_history_cutoff,nonpedigree_status,
      nonpedigree_blockers_sha256,duplicate_proof_schema_version,
      duplicate_proof_manifest_sha256,duplicate_proof_source_history_cutoff,
      duplicate_proof_status,duplicate_proof_blockers_sha256,nonce,planned_at,attestation_sha256
    FROM pg_temp.giq_canonical_merge_plan_attestation WHERE id=1
  $attestation$
  INTO STRICT attestation_schema_version,attestation_database_name,attestation_database_oid,
    attestation_backend_pid,attestation_clone_operation_id,attestation_phase,
    attestation_manifest_sha256,attestation_transform_version,
    attestation_source_history_cutoff,attestation_pedigree_schema_version,
    attestation_pedigree_manifest_sha256,attestation_pedigree_source_history_cutoff,
    attestation_pedigree_status,attestation_pedigree_blockers_sha256,
    attestation_pedigree_terminal_counts_sha256,
    attestation_nonpedigree_schema_version,attestation_nonpedigree_manifest_sha256,
    attestation_nonpedigree_source_history_cutoff,attestation_nonpedigree_status,
    attestation_nonpedigree_blockers_sha256,attestation_duplicate_proof_schema_version,
    attestation_duplicate_proof_manifest_sha256,
    attestation_duplicate_proof_source_history_cutoff,attestation_duplicate_proof_status,
    attestation_duplicate_proof_blockers_sha256,attestation_nonce,attestation_planned_at,
    attestation_sha256;

  SELECT oid INTO STRICT current_database_oid
  FROM pg_database WHERE datname=current_database();
  current_pedigree_blockers_sha256 :=
    encode(digest(convert_to(authoritative_blockers::text,'UTF8'),'sha256'),'hex');
  current_pedigree_terminal_counts_sha256 := encode(digest(convert_to(jsonb_build_object(
    'terminalInvalidImpossible',authoritative_counts->'terminalInvalidImpossible',
    'terminalSupersededConflict',authoritative_counts->'terminalSupersededConflict',
    'terminalUnlinkedConflictCovered',authoritative_counts->'terminalUnlinkedConflictCovered',
    'terminalCorroborationOnlyCovered',authoritative_counts->'terminalCorroborationOnlyCovered',
    'terminalNonblocking',authoritative_counts->'terminalNonblocking',
    'terminalBlocking',authoritative_counts->'terminalBlocking'
  )::text,'UTF8'),'sha256'),'hex');
  current_nonpedigree_blockers_sha256 :=
    encode(digest(convert_to(nonpedigree_blockers::text,'UTF8'),'sha256'),'hex');
  current_duplicate_proof_blockers_sha256 :=
    encode(digest(convert_to(duplicate_proof_blockers::text,'UTF8'),'sha256'),'hex');
  expected_attestation_sha256 := encode(digest(convert_to(jsonb_build_object(
    'schemaVersion','giq-canonical-merge-plan-attestation/v2',
    'database',current_database(),
    'databaseOid',current_database_oid::text,
    'backendPid',pg_backend_pid(),
    'cloneOperationId',run_clone_operation_id::text,
    'phase',observed_phase,
    'normalizedManifestSha256',run_manifest_sha256,
    'normalizedTransformVersion',run_transform_version,
    'sourceHistoryCutoff',to_char(run_source_history_cutoff AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'pedigreeSchemaVersion',authoritative_schema_version,
    'pedigreeManifestSha256',authoritative_manifest_sha256,
    'pedigreeSourceHistoryCutoff',to_char(authoritative_source_history_cutoff AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'pedigreeStatus',authoritative_status,
    'pedigreeBlockersSha256',current_pedigree_blockers_sha256,
    'pedigreeTerminalCountsSha256',current_pedigree_terminal_counts_sha256,
    'nonpedigreeSchemaVersion',nonpedigree_schema_version,
    'nonpedigreeManifestSha256',nonpedigree_manifest_sha256,
    'nonpedigreeSourceHistoryCutoff',to_char(nonpedigree_source_history_cutoff AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'nonpedigreeStatus',nonpedigree_status,
    'nonpedigreeBlockersSha256',current_nonpedigree_blockers_sha256,
    'duplicateProofSchemaVersion',duplicate_proof_schema_version,
    'duplicateProofManifestSha256',duplicate_proof_manifest_sha256,
    'duplicateProofSourceHistoryCutoff',to_char(duplicate_proof_source_history_cutoff AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'duplicateProofStatus',duplicate_proof_status,
    'duplicateProofBlockersSha256',current_duplicate_proof_blockers_sha256,
    'nonce',attestation_nonce::text,
    'plannedAt',to_char(attestation_planned_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  )::text,'UTF8'),'sha256'),'hex');

  IF attestation_schema_version<>'giq-canonical-merge-plan-attestation/v2'
     OR attestation_database_name IS DISTINCT FROM current_database()
     OR attestation_database_oid IS DISTINCT FROM current_database_oid
     OR attestation_backend_pid IS DISTINCT FROM pg_backend_pid()
     OR attestation_clone_operation_id IS DISTINCT FROM run_clone_operation_id
     OR attestation_phase IS DISTINCT FROM observed_phase
     OR attestation_manifest_sha256 IS DISTINCT FROM run_manifest_sha256
     OR attestation_transform_version IS DISTINCT FROM run_transform_version
     OR attestation_source_history_cutoff IS DISTINCT FROM run_source_history_cutoff
     OR attestation_pedigree_schema_version IS DISTINCT FROM authoritative_schema_version
     OR attestation_pedigree_manifest_sha256 IS DISTINCT FROM authoritative_manifest_sha256
     OR attestation_pedigree_source_history_cutoff IS DISTINCT FROM authoritative_source_history_cutoff
     OR attestation_pedigree_status IS DISTINCT FROM authoritative_status
     OR attestation_pedigree_blockers_sha256 IS DISTINCT FROM current_pedigree_blockers_sha256
     OR attestation_pedigree_terminal_counts_sha256 IS DISTINCT FROM
        current_pedigree_terminal_counts_sha256
     OR attestation_nonpedigree_schema_version IS DISTINCT FROM nonpedigree_schema_version
     OR attestation_nonpedigree_manifest_sha256 IS DISTINCT FROM nonpedigree_manifest_sha256
     OR attestation_nonpedigree_source_history_cutoff IS DISTINCT FROM nonpedigree_source_history_cutoff
     OR attestation_nonpedigree_status IS DISTINCT FROM nonpedigree_status
     OR attestation_nonpedigree_blockers_sha256 IS DISTINCT FROM current_nonpedigree_blockers_sha256
     OR attestation_duplicate_proof_schema_version IS DISTINCT FROM duplicate_proof_schema_version
     OR attestation_duplicate_proof_manifest_sha256 IS DISTINCT FROM duplicate_proof_manifest_sha256
     OR attestation_duplicate_proof_source_history_cutoff IS DISTINCT FROM duplicate_proof_source_history_cutoff
     OR attestation_duplicate_proof_status IS DISTINCT FROM duplicate_proof_status
     OR attestation_duplicate_proof_blockers_sha256 IS DISTINCT FROM current_duplicate_proof_blockers_sha256
     OR attestation_planned_at < clock_timestamp()-interval '10 minutes'
     OR attestation_planned_at > clock_timestamp()+interval '1 second'
     OR attestation_sha256 !~ '^[0-9a-f]{64}$'
     OR attestation_sha256 IS DISTINCT FROM expected_attestation_sha256 THEN
    RAISE EXCEPTION 'canonical merge plan attestation is stale, malformed, or not bound to this run';
  END IF;

  SELECT
    (SELECT abs(
      (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence)-
      (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution)))+
    (SELECT count(*)-count(DISTINCT occurrence_id)
      FROM _giq_history_stage.authoritative_pedigree_resolution)+
    (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition NOT IN (
        'verified_apply_candidate','applied_verified','verified_no_change',
        'terminal_invalid_impossible','terminal_superseded_conflict',
        'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
      ) OR hard_blocker_class IS NOT NULL)+
    (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition LIKE 'terminal_%' AND (
        terminal_proof_leaf_count IS DISTINCT FROM 1
        OR canonical_contribution_count IS DISTINCT FROM 0
        OR canonical_safety_blocking OR coverage_blocking
        OR quarantine_release_eligible IS NOT TRUE
        OR canonical_write_eligible IS NOT FALSE
      ))+
    (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='verified_apply_candidate' AND (
        canonical_write_eligible IS NOT TRUE
        OR exact_identities_verified IS NOT TRUE
        OR relationship_proof_verified IS NOT TRUE
        OR subject_dog_id IS NULL OR parent_dog_id IS NULL
        OR existing_parent_dog_id IS NOT NULL
        OR creates_cycle IS DISTINCT FROM false
        OR canonical_safety_blocking OR coverage_blocking
      ))+
    (SELECT count(*) FROM (
      SELECT subject_dog_id,relationship
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='verified_apply_candidate'
      GROUP BY subject_dog_id,relationship
      HAVING count(*)<>1
    ) duplicate_apply_target)+
    (SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution sire
      JOIN _giq_history_stage.authoritative_pedigree_resolution dam
        ON dam.subject_dog_id=sire.subject_dog_id
       AND dam.parent_dog_id=sire.parent_dog_id
       AND dam.relationship='dam' AND dam.disposition='verified_apply_candidate'
      WHERE sire.relationship='sire' AND sire.disposition='verified_apply_candidate')+
    (SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution candidate
      JOIN public."PedigreeMergeLedger" ledger
        ON ledger."dogId"=candidate.subject_dog_id
       AND ledger.relationship=candidate.relationship
       AND ledger."verificationStatus"='verified'
       AND ledger.decision IN ('accepted','no_change')
      WHERE candidate.disposition='verified_apply_candidate')+
    (SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution candidate
      WHERE candidate.disposition='verified_apply_candidate' AND EXISTS(
        WITH RECURSIVE ancestry(node_id,path,cycle) AS (
          SELECT candidate.parent_dog_id,
            ARRAY[candidate.subject_dog_id,candidate.parent_dog_id]::text[],
            candidate.parent_dog_id=candidate.subject_dog_id
          UNION ALL
          SELECT edge.parent_dog_id,ancestry.path || edge.parent_dog_id,
            edge.parent_dog_id=ANY(ancestry.path)
          FROM ancestry
          JOIN LATERAL (
            SELECT dog."sireId" AS parent_dog_id FROM public."Dog" dog
            WHERE dog.id=ancestry.node_id AND dog."sireId" IS NOT NULL
            UNION ALL
            SELECT dog."damId" FROM public."Dog" dog
            WHERE dog.id=ancestry.node_id AND dog."damId" IS NOT NULL
            UNION ALL
            SELECT planned.parent_dog_id
            FROM _giq_history_stage.authoritative_pedigree_resolution planned
            WHERE planned.subject_dog_id=ancestry.node_id
              AND planned.disposition='verified_apply_candidate'
          ) edge ON edge.parent_dog_id IS NOT NULL
          WHERE NOT ancestry.cycle
            AND cardinality(ancestry.path)<=(SELECT count(*)+1 FROM public."Dog")
        )
        SELECT 1 FROM ancestry WHERE cycle
      ))+
    (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition IN ('applied_verified','verified_no_change') AND (
        canonical_write_eligible IS NOT FALSE
        OR exact_identities_verified IS NOT TRUE
        OR relationship_proof_verified IS NOT TRUE
        OR subject_dog_id IS NULL OR parent_dog_id IS NULL
        OR existing_parent_dog_id IS DISTINCT FROM parent_dog_id
        OR creates_cycle IS DISTINCT FROM false
        OR canonical_safety_blocking OR coverage_blocking
      ))+
    (SELECT CASE WHEN count(*)=5 THEN 0 ELSE 1 END
      FROM pg_trigger trigger
      WHERE (trigger.tgrelid,trigger.tgname) IN (
        ('_giq_history_stage.authoritative_identity_evidence'::regclass,
         'authoritative_identity_evidence_append_only'),
        ('_giq_history_stage.authoritative_pedigree_evidence'::regclass,
         'authoritative_pedigree_evidence_append_only'),
        ('_giq_history_stage.authoritative_consolidation_proof'::regclass,
         'authoritative_consolidation_proof_append_only'),
        ('_giq_history_stage.authoritative_pedigree_assertion_occurrence'::regclass,
         'authoritative_pedigree_occurrence_append_only'),
        ('_giq_history_stage.authoritative_pedigree_terminal_proof'::regclass,
         'authoritative_pedigree_terminal_proof_append_only')
      ) AND NOT trigger.tgisinternal AND trigger.tgenabled<>'D')+
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
  INTO unresolved_direct_rows;
  IF unresolved_direct_rows<>0 THEN
    RAISE EXCEPTION
      'canonical merge has % unresolved fetch, composite-review, or duplicate-removal proof rows',
      unresolved_direct_rows;
  END IF;

  EXECUTE 'DELETE FROM pg_temp.giq_canonical_merge_plan_attestation WHERE id=1';
  GET DIAGNOSTICS attestation_consumed=ROW_COUNT;
  IF attestation_consumed<>1 THEN
    RAISE EXCEPTION 'canonical merge plan attestation was not consumed exactly once';
  END IF;
END
$$;

LOCK TABLE
  public."Track",public."Trainer",public."Dog",public."Meeting",public."Race",
  public."Runner",public."Result",public."FormEntry",public."DogProfileForm",
  public."RaceVideo",public."DogProfileArchive",public."RaceDayArchive",
  public."PedigreeImportRun",public."DogSourceIdentity",public."PedigreeAssertion",
  public."PedigreeMergeLedger"
IN SHARE ROW EXCLUSIVE MODE;

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

-- Consolidate the one reviewed production track alias before target-identity
-- checks. Normalization intentionally selects The Meadows as the stable target,
-- so alias-owned meetings must be rehomed before comparing their target IDs.
CREATE TABLE _giq_history_merge.track_alias_map (
  source_alias_id text PRIMARY KEY,
  canonical_id text NOT NULL UNIQUE,
  alias_name text NOT NULL,
  canonical_name text NOT NULL,
  authority_uri text NOT NULL,
  authority_title text NOT NULL,
  identity_candidate_inventory jsonb NOT NULL,
  foreign_key_inventory jsonb NOT NULL,
  alias_row_before jsonb NOT NULL,
  canonical_row_before jsonb NOT NULL,
  canonical_row_after jsonb NOT NULL,
  alias_row_sha256 text NOT NULL CHECK(alias_row_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_before_sha256 text NOT NULL CHECK(canonical_before_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_after_sha256 text NOT NULL CHECK(canonical_after_sha256 ~ '^[0-9a-f]{64}$'),
  tracks_before bigint NOT NULL,
  tracks_after bigint NOT NULL,
  meetings_before bigint NOT NULL,
  meetings_after bigint NOT NULL,
  meetings_rehomed bigint NOT NULL,
  form_entries_before bigint NOT NULL,
  form_entries_after bigint NOT NULL,
  form_entries_rehomed bigint NOT NULL,
  whole_database_match_complete boolean NOT NULL,
  authoritative_duplicate_proof boolean NOT NULL,
  unique_verified_fields_merged boolean NOT NULL,
  full_rows_captured boolean NOT NULL,
  all_references_enumerated boolean NOT NULL,
  all_references_redirected boolean NOT NULL,
  reference_conservation_verified boolean NOT NULL,
  relationship_integrity_verified boolean NOT NULL,
  source_history_preserved boolean NOT NULL,
  no_data_loss_verified boolean NOT NULL,
  audit_ledger_recorded boolean NOT NULL,
  release_eligible boolean GENERATED ALWAYS AS (
    whole_database_match_complete AND authoritative_duplicate_proof
    AND unique_verified_fields_merged AND full_rows_captured
    AND all_references_enumerated AND all_references_redirected
    AND reference_conservation_verified AND relationship_integrity_verified
    AND source_history_preserved AND no_data_loss_verified AND audit_ledger_recorded
  ) STORED,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION _giq_history_merge.reject_track_alias_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'track alias consolidation evidence is append-only';
END
$$;

CREATE TRIGGER track_alias_map_append_only
BEFORE UPDATE OR DELETE ON _giq_history_merge.track_alias_map
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_track_alias_ledger_mutation();

DO $$
DECLARE
  authority_uri constant text:='https://www.grv.org.au/venues/the-meadows/';
  authority_title constant text:='The Meadows';
  alias_id text;
  canonical_id text;
  alias_count bigint;
  canonical_count bigint;
  identity_candidate_count bigint;
  identity_candidate_inventory jsonb;
  alias_row_before jsonb;
  canonical_row_before jsonb;
  canonical_row_after jsonb;
  alias_created_at timestamptz;
  canonical_created_at timestamptz;
  foreign_key_count bigint;
  unexpected_foreign_key_count bigint;
  meeting_foreign_key_count bigint;
  form_entry_foreign_key_count bigint;
  foreign_key_inventory jsonb;
  tracks_before bigint;
  tracks_after bigint;
  meetings_total_before bigint;
  meetings_total_after bigint;
  meetings_alias_before bigint;
  meetings_canonical_before bigint;
  meetings_canonical_after bigint;
  meetings_updated bigint;
  forms_total_before bigint;
  forms_total_after bigint;
  forms_alias_before bigint;
  forms_canonical_before bigint;
  forms_canonical_after bigint;
  forms_updated bigint;
  canonical_created_updated bigint;
  tracks_deleted bigint;
BEGIN
  SELECT count(*),min(id) INTO alias_count,alias_id FROM public."Track"
  WHERE lower(btrim(name))='meadows' AND upper(btrim(state))='VIC';
  SELECT count(*),min(id) INTO canonical_count,canonical_id FROM public."Track"
  WHERE lower(btrim(name))='the meadows' AND upper(btrim(state))='VIC';
  IF alias_count>1 OR canonical_count>1 THEN
    RAISE EXCEPTION 'Meadows whole-database identity search found duplicate alias/canonical candidates: %/%',
      alias_count,canonical_count;
  END IF;
  IF alias_count=1 THEN
    IF canonical_count<>1 OR alias_id=canonical_id THEN
      RAISE EXCEPTION 'Meadows alias exists without exactly one distinct canonical The Meadows target';
    END IF;

    SELECT count(*),coalesce(jsonb_agg(to_jsonb(candidate) ORDER BY candidate.id),'[]'::jsonb)
    INTO identity_candidate_count,identity_candidate_inventory
    FROM public."Track" candidate
    WHERE upper(btrim(candidate.state))='VIC'
      AND regexp_replace(lower(btrim(candidate.name)),'^the[[:space:]]+','','g')='meadows';
    IF identity_candidate_count<>2 THEN
      RAISE EXCEPTION
        'Meadows whole-database normalized-name/state search found %, expected exactly the reviewed alias and canonical rows',
        identity_candidate_count;
    END IF;

    SELECT to_jsonb(alias_track),alias_track."createdAt"
    INTO STRICT alias_row_before,alias_created_at
    FROM public."Track" alias_track WHERE alias_track.id=alias_id;
    SELECT to_jsonb(canonical_track),canonical_track."createdAt"
    INTO STRICT canonical_row_before,canonical_created_at
    FROM public."Track" canonical_track WHERE canonical_track.id=canonical_id;

    IF canonical_row_before->>'name' IS DISTINCT FROM authority_title
       OR canonical_row_before->>'state' IS DISTINCT FROM 'VIC'
       OR (alias_row_before - ARRAY['id','name','createdAt']::text[])
            IS DISTINCT FROM
          (canonical_row_before - ARRAY['id','name','createdAt']::text[]) THEN
      RAISE EXCEPTION
        'Meadows alias consolidation lacks official-title or full domain-field equality proof; no row may be removed';
    END IF;

    IF NOT EXISTS(
         SELECT 1 FROM _giq_history_merge.snapshot_core_key
         WHERE table_name='Track' AND primary_key_text=alias_id
       ) OR NOT EXISTS(
         SELECT 1 FROM _giq_history_merge.snapshot_core_key
         WHERE table_name='Track' AND primary_key_text=canonical_id
       ) THEN
      RAISE EXCEPTION 'Meadows alias consolidation is not bound to both snapshot Track identities';
    END IF;
    IF EXISTS(
      SELECT 1 FROM public."Meeting" alias_meeting
      JOIN public."Meeting" canonical_meeting
        ON canonical_meeting."trackId"=canonical_id
       AND canonical_meeting."meetingDate"=alias_meeting."meetingDate"
      WHERE alias_meeting."trackId"=alias_id
    ) THEN
      RAISE EXCEPTION 'Meadows alias consolidation has a meeting-date collision';
    END IF;

    WITH foreign_keys AS (
      SELECT source_namespace.nspname AS source_schema,source_table.relname AS source_table,
        constraint_definition.conname AS constraint_name,
        array_agg(source_attribute.attname ORDER BY key_position.position)::text[] AS source_columns,
        array_agg(target_attribute.attname ORDER BY key_position.position)::text[] AS target_columns
      FROM pg_constraint constraint_definition
      JOIN pg_class source_table ON source_table.oid=constraint_definition.conrelid
      JOIN pg_namespace source_namespace ON source_namespace.oid=source_table.relnamespace
      CROSS JOIN LATERAL generate_subscripts(constraint_definition.conkey,1)
        AS key_position(position)
      JOIN pg_attribute source_attribute
        ON source_attribute.attrelid=constraint_definition.conrelid
       AND source_attribute.attnum=constraint_definition.conkey[key_position.position]
      JOIN pg_attribute target_attribute
        ON target_attribute.attrelid=constraint_definition.confrelid
       AND target_attribute.attnum=constraint_definition.confkey[key_position.position]
      WHERE constraint_definition.contype='f'
        AND constraint_definition.confrelid='public."Track"'::regclass
      GROUP BY source_namespace.nspname,source_table.relname,constraint_definition.conname
    )
    SELECT count(*),
      coalesce(jsonb_agg(jsonb_build_object(
        'sourceSchema',source_schema,'sourceTable',source_table,
        'constraintName',constraint_name,'sourceColumns',source_columns,
        'targetColumns',target_columns
      ) ORDER BY source_schema,source_table,constraint_name),'[]'::jsonb),
      count(*) FILTER(WHERE NOT (
        source_schema='public' AND target_columns=ARRAY['id']::text[] AND (
          (source_table='Meeting' AND source_columns=ARRAY['trackId']::text[])
          OR (source_table='FormEntry' AND source_columns=ARRAY['trackId']::text[])
        )
      )),
      count(*) FILTER(WHERE source_schema='public' AND source_table='Meeting'
        AND source_columns=ARRAY['trackId']::text[] AND target_columns=ARRAY['id']::text[]),
      count(*) FILTER(WHERE source_schema='public' AND source_table='FormEntry'
        AND source_columns=ARRAY['trackId']::text[] AND target_columns=ARRAY['id']::text[])
    INTO foreign_key_count,foreign_key_inventory,unexpected_foreign_key_count,
         meeting_foreign_key_count,form_entry_foreign_key_count
    FROM foreign_keys;
    IF foreign_key_count<>2 OR unexpected_foreign_key_count<>0
       OR meeting_foreign_key_count<>1 OR form_entry_foreign_key_count<>1 THEN
      RAISE EXCEPTION
        'Meadows alias consolidation cannot prove exhaustive Track foreign-key coverage: total %, unexpected %, Meeting %, FormEntry %',
        foreign_key_count,unexpected_foreign_key_count,
        meeting_foreign_key_count,form_entry_foreign_key_count;
    END IF;

    SELECT count(*) INTO tracks_before FROM public."Track";
    SELECT count(*) INTO meetings_total_before FROM public."Meeting";
    SELECT count(*) INTO meetings_alias_before FROM public."Meeting" WHERE "trackId"=alias_id;
    SELECT count(*) INTO meetings_canonical_before FROM public."Meeting" WHERE "trackId"=canonical_id;
    SELECT count(*) INTO forms_total_before FROM public."FormEntry";
    SELECT count(*) INTO forms_alias_before FROM public."FormEntry" WHERE "trackId"=alias_id;
    SELECT count(*) INTO forms_canonical_before FROM public."FormEntry" WHERE "trackId"=canonical_id;

    UPDATE public."Track"
    SET "createdAt"=least(canonical_created_at,alias_created_at)
    WHERE id=canonical_id;
    GET DIAGNOSTICS canonical_created_updated=ROW_COUNT;
    UPDATE public."Meeting" SET "trackId"=canonical_id WHERE "trackId"=alias_id;
    GET DIAGNOSTICS meetings_updated=ROW_COUNT;
    UPDATE public."FormEntry" SET "trackId"=canonical_id WHERE "trackId"=alias_id;
    GET DIAGNOSTICS forms_updated=ROW_COUNT;
    DELETE FROM public."Track" WHERE id=alias_id;
    GET DIAGNOSTICS tracks_deleted=ROW_COUNT;

    SELECT count(*) INTO tracks_after FROM public."Track";
    SELECT count(*) INTO meetings_total_after FROM public."Meeting";
    SELECT count(*) INTO meetings_canonical_after FROM public."Meeting" WHERE "trackId"=canonical_id;
    SELECT count(*) INTO forms_total_after FROM public."FormEntry";
    SELECT count(*) INTO forms_canonical_after FROM public."FormEntry" WHERE "trackId"=canonical_id;
    SELECT to_jsonb(canonical_track) INTO STRICT canonical_row_after
    FROM public."Track" canonical_track WHERE canonical_track.id=canonical_id;

    IF canonical_created_updated<>1 OR meetings_updated<>meetings_alias_before
       OR forms_updated<>forms_alias_before OR tracks_deleted<>1
       OR tracks_after<>tracks_before-1
       OR meetings_total_after<>meetings_total_before
       OR meetings_canonical_after<>meetings_canonical_before+meetings_alias_before
       OR forms_total_after<>forms_total_before
       OR forms_canonical_after<>forms_canonical_before+forms_alias_before
       OR EXISTS(SELECT 1 FROM public."Meeting" WHERE "trackId"=alias_id)
       OR EXISTS(SELECT 1 FROM public."FormEntry" WHERE "trackId"=alias_id)
       OR EXISTS(SELECT 1 FROM public."Meeting" referencing
          LEFT JOIN public."Track" target ON target.id=referencing."trackId"
          WHERE target.id IS NULL)
       OR EXISTS(SELECT 1 FROM public."FormEntry" referencing
          LEFT JOIN public."Track" target ON target.id=referencing."trackId"
          WHERE referencing."trackId" IS NOT NULL AND target.id IS NULL)
       OR (SELECT count(*) FROM public."Track"
           WHERE lower(btrim(name))='the meadows' AND upper(btrim(state))='VIC')<>1
       OR EXISTS(SELECT 1 FROM public."Track"
           WHERE lower(btrim(name))='meadows' AND upper(btrim(state))='VIC') THEN
      RAISE EXCEPTION 'Meadows alias consolidation proof failed';
    END IF;

    INSERT INTO _giq_history_merge.track_alias_map(
      source_alias_id,canonical_id,alias_name,canonical_name,authority_uri,authority_title,
      identity_candidate_inventory,foreign_key_inventory,alias_row_before,canonical_row_before,
      canonical_row_after,alias_row_sha256,canonical_before_sha256,canonical_after_sha256,
      tracks_before,tracks_after,meetings_before,meetings_after,meetings_rehomed,
      form_entries_before,form_entries_after,form_entries_rehomed,
      whole_database_match_complete,authoritative_duplicate_proof,unique_verified_fields_merged,
      full_rows_captured,all_references_enumerated,all_references_redirected,
      reference_conservation_verified,relationship_integrity_verified,source_history_preserved,
      no_data_loss_verified,audit_ledger_recorded
    ) VALUES(
      alias_id,canonical_id,'Meadows',authority_title,authority_uri,authority_title,
      identity_candidate_inventory,foreign_key_inventory,alias_row_before,canonical_row_before,
      canonical_row_after,encode(digest(alias_row_before::text,'sha256'),'hex'),
      encode(digest(canonical_row_before::text,'sha256'),'hex'),
      encode(digest(canonical_row_after::text,'sha256'),'hex'),
      tracks_before,tracks_after,meetings_total_before,meetings_total_after,meetings_alias_before,
      forms_total_before,forms_total_after,forms_alias_before,
      true,true,true,true,true,true,true,true,true,true,true
    );
    IF NOT EXISTS(SELECT 1 FROM _giq_history_merge.track_alias_map proof
      WHERE proof.source_alias_id=alias_id AND proof.canonical_id=canonical_id
        AND proof.release_eligible) THEN
      RAISE EXCEPTION 'Meadows alias consolidation append-only release ledger was not recorded';
    END IF;
  END IF;
END
$$;

DO $$
DECLARE
  alternate_unique_conflicts bigint;
  target_id_identity_conflicts bigint;
  stage_unique_conflicts bigint;
  existing_provenance_rows bigint;
BEGIN
  WITH conflicts AS (
    SELECT n.target_id FROM _giq_history_stage.normalized_dog n
    JOIN public."Dog" p ON p.id<>n.target_id
      AND ((n.ear_brand IS NOT NULL AND p."earBrand"=n.ear_brand)
        OR (n.source_provider IS NOT NULL AND n.source_id IS NOT NULL
          AND lower(p."sourceProvider")=lower(n.source_provider) AND p."sourceId"=n.source_id))
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_meeting n
    JOIN public."Meeting" p ON p.id<>n.target_id
      AND p."trackId"=n.track_id AND p."meetingDate"=n.meeting_date
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_race n
    JOIN public."Race" p ON p.id<>n.target_id
      AND p."meetingId"=n.meeting_id AND p."raceNumber"=n.race_number
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_runner n
    JOIN public."Runner" p ON p.id<>n.target_id
      AND p."raceId"=n.race_id AND p."boxNumber"=n.box_number
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_result n
    JOIN public."Result" p ON p.id<>n.target_id AND p."runnerId"=n.runner_id
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_form_entry n
    JOIN public."FormEntry" p ON p.id<>n.target_id
      AND p."dogId"=n.dog_id AND p."raceId"=n.race_id
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_profile_form n
    JOIN public."DogProfileForm" p ON p.id<>n.target_id
      AND p."dogId"=n.dog_id AND lower(p."sourceProvider")=lower(n.source_provider)
      AND p."sourceId"=n.source_id
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_race_video n
    JOIN public."RaceVideo" p ON p.id<>n.target_id
      AND p."raceId"=n.race_id AND lower(p."sourceProvider")=lower(n.source_provider)
      AND p.kind=n.kind
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_dog_profile_archive n
    JOIN public."DogProfileArchive" p ON p.id<>n.target_id
      AND lower(p."sourceProvider")=lower(n.source_provider) AND p."sourceId"=n.provider_source_id
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_race_day_archive n
    JOIN public."RaceDayArchive" p ON p.id<>n.target_id
      AND lower(p."sourceProvider")=lower(n.source_provider) AND p.date=n.date
  ) SELECT count(*) INTO alternate_unique_conflicts FROM conflicts;

  WITH conflicts AS (
    SELECT n.target_id FROM _giq_history_stage.normalized_track n JOIN public."Track" p ON p.id=n.target_id
      WHERE _giq_history_merge.track_key(p.name,p.state)<>n.natural_key
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_dog n JOIN public."Dog" p ON p.id=n.target_id
      WHERE NOT (
        (n.source_provider IS NOT NULL AND n.source_id IS NOT NULL
          AND lower(p."sourceProvider")=lower(n.source_provider) AND p."sourceId"=n.source_id)
        OR (n.ear_brand IS NOT NULL AND p."earBrand"=n.ear_brand)
        OR (p."earBrand" ~ '^thedogs:[0-9]+$' AND n.source_provider='thedogs'
          AND n.source_id=substring(p."earBrand" FROM 9))
      )
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_meeting n JOIN public."Meeting" p ON p.id=n.target_id
      WHERE (p."trackId",p."meetingDate") IS DISTINCT FROM (n.track_id,n.meeting_date)
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_race n JOIN public."Race" p ON p.id=n.target_id
      WHERE (p."meetingId",p."raceNumber") IS DISTINCT FROM (n.meeting_id,n.race_number)
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_runner n JOIN public."Runner" p ON p.id=n.target_id
      WHERE (p."raceId",p."boxNumber") IS DISTINCT FROM (n.race_id,n.box_number)
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_result n JOIN public."Result" p ON p.id=n.target_id
      WHERE p."runnerId" IS DISTINCT FROM n.runner_id
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_form_entry n JOIN public."FormEntry" p ON p.id=n.target_id
      WHERE (p."dogId",p."raceId") IS DISTINCT FROM (n.dog_id,n.race_id)
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_profile_form n JOIN public."DogProfileForm" p ON p.id=n.target_id
      WHERE (p."dogId",lower(p."sourceProvider"),p."sourceId") IS DISTINCT FROM
            (n.dog_id,lower(n.source_provider),n.source_id)
    UNION ALL
    SELECT n.target_id FROM _giq_history_stage.normalized_race_video n JOIN public."RaceVideo" p ON p.id=n.target_id
      WHERE (p."raceId",lower(p."sourceProvider"),p.kind) IS DISTINCT FROM
            (n.race_id,lower(n.source_provider),n.kind)
  ) SELECT count(*) INTO target_id_identity_conflicts FROM conflicts;

  WITH duplicates AS (
    SELECT 1 FROM _giq_history_stage.normalized_dog
    WHERE source_provider IS NOT NULL AND source_id IS NOT NULL
    GROUP BY lower(source_provider),source_id HAVING count(*)>1
    UNION ALL
    SELECT 1 FROM _giq_history_stage.normalized_profile_form
    GROUP BY dog_id,lower(source_provider),source_id HAVING count(*)>1
    UNION ALL
    SELECT 1 FROM _giq_history_stage.normalized_race_video
    GROUP BY race_id,lower(source_provider),kind HAVING count(*)>1
  ) SELECT count(*) INTO stage_unique_conflicts FROM duplicates;

  SELECT
    (SELECT count(*) FROM public."PedigreeImportRun")+
    (SELECT count(*) FROM public."DogSourceIdentity")+
    (SELECT count(*) FROM public."PedigreeAssertion")+
    (SELECT count(*) FROM public."PedigreeMergeLedger")
  INTO existing_provenance_rows;

  IF alternate_unique_conflicts<>0 OR target_id_identity_conflicts<>0
     OR stage_unique_conflicts<>0 OR existing_provenance_rows<>0 THEN
    RAISE EXCEPTION 'canonical preflight conflict: alternate unique %, target identity %, stage unique %, existing provenance %',
      alternate_unique_conflicts,target_id_identity_conflicts,stage_unique_conflicts,existing_provenance_rows;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION _giq_history_merge.guard_production_nonnull()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb:=to_jsonb(OLD);
  new_row jsonb:=to_jsonb(NEW);
  key text;
  changed text[]:=ARRAY[]::text[];
  allowed boolean;
BEGIN
  FOR key IN SELECT jsonb_object_keys(old_row) LOOP
    IF old_row->key IS NOT DISTINCT FROM new_row->key THEN CONTINUE; END IF;
    changed:=array_append(changed,key);
    IF old_row->key='null'::jsonb THEN CONTINUE; END IF;
    allowed:=false;
    IF TG_TABLE_NAME='Track' AND key='name'
       AND OLD.name IS NOT NULL
       AND NEW.name=_giq_history_merge.canonical_track_name(OLD.name) THEN
      allowed:=true;
    ELSIF TG_TABLE_NAME='Track' AND key='state'
       AND NEW.state=_giq_history_merge.canonical_track_state(NEW.name,OLD.state) THEN
      allowed:=true;
    ELSIF TG_TABLE_NAME='Dog' AND key='earBrand'
       AND OLD."earBrand" ~ '^thedogs:[0-9]+$'
       AND (NEW."earBrand" IS NULL OR (
         nullif(btrim(NEW."earBrand"),'') IS NOT NULL
         AND NEW."earBrand" !~ '^thedogs:[0-9]+$'
       ))
       AND lower(NEW."sourceProvider")='thedogs'
       AND NEW."sourceId"=substring(OLD."earBrand" FROM 9) THEN
      allowed:=true;
    END IF;
    IF NOT allowed THEN
      RAISE EXCEPTION 'authority guard: %.% attempted to overwrite non-null field %',
        TG_TABLE_NAME,OLD.id,key;
    END IF;
  END LOOP;

  IF cardinality(changed)>0 THEN
    INSERT INTO _giq_history_merge.production_row_update_audit
      (table_name,row_id,changed_fields,before_sha256,after_sha256)
    VALUES(
      TG_TABLE_NAME,OLD.id,changed,
      encode(digest(old_row::text,'sha256'),'hex'),
      encode(digest(new_row::text,'sha256'),'hex')
    )
    ON CONFLICT(table_name,row_id) DO UPDATE
    SET changed_fields=(SELECT array_agg(DISTINCT field ORDER BY field)
                        FROM unnest(_giq_history_merge.production_row_update_audit.changed_fields || EXCLUDED.changed_fields) field),
        after_sha256=EXCLUDED.after_sha256,
        changed_at=clock_timestamp();
  END IF;
  RETURN NEW;
END
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
    'DogProfileForm','RaceVideo','DogProfileArchive','RaceDayArchive'
  ] LOOP
    EXECUTE format('CREATE TRIGGER giq_history_authority_guard BEFORE UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.guard_production_nonnull()',table_name);
  END LOOP;
END
$$;

CREATE TABLE _giq_history_merge.canonical_table_delta (
  table_name text PRIMARY KEY,
  before_rows bigint NOT NULL,
  after_rows bigint,
  inserted_rows bigint
);

INSERT INTO _giq_history_merge.canonical_table_delta(table_name,before_rows)
VALUES
('Track',(SELECT count(*) FROM public."Track")),
('Trainer',(SELECT count(*) FROM public."Trainer")),
('Dog',(SELECT count(*) FROM public."Dog")),
('Meeting',(SELECT count(*) FROM public."Meeting")),
('Race',(SELECT count(*) FROM public."Race")),
('Runner',(SELECT count(*) FROM public."Runner")),
('Result',(SELECT count(*) FROM public."Result")),
('FormEntry',(SELECT count(*) FROM public."FormEntry")),
('DogProfileForm',(SELECT count(*) FROM public."DogProfileForm")),
('RaceVideo',(SELECT count(*) FROM public."RaceVideo")),
('DogProfileArchive',(SELECT count(*) FROM public."DogProfileArchive")),
('RaceDayArchive',(SELECT count(*) FROM public."RaceDayArchive")),
('PedigreeImportRun',(SELECT count(*) FROM public."PedigreeImportRun")),
('DogSourceIdentity',(SELECT count(*) FROM public."DogSourceIdentity")),
('PedigreeAssertion',(SELECT count(*) FROM public."PedigreeAssertion")),
('PedigreeMergeLedger',(SELECT count(*) FROM public."PedigreeMergeLedger"));

INSERT INTO public."Track"(
  id,name,state,surface,circumference,"straightLength","boxCount","hasIsolynx","createdAt"
)
SELECT target_id,name,state,surface,circumference,straight_length,box_count,has_isolynx,clock_timestamp()
FROM _giq_history_stage.normalized_track
ON CONFLICT(id) DO UPDATE SET
  name=_giq_history_merge.canonical_track_name(public."Track".name),
  state=_giq_history_merge.canonical_track_state(EXCLUDED.name,public."Track".state),
  surface=coalesce(public."Track".surface,EXCLUDED.surface),
  circumference=coalesce(public."Track".circumference,EXCLUDED.circumference),
  "straightLength"=coalesce(public."Track"."straightLength",EXCLUDED."straightLength"),
  "boxCount"=public."Track"."boxCount",
  "hasIsolynx"=public."Track"."hasIsolynx";

INSERT INTO public."Trainer"(id,name,state,"licenseNumber","createdAt")
SELECT target_id,name,state,license_number,clock_timestamp()
FROM _giq_history_stage.normalized_trainer
ON CONFLICT(id) DO UPDATE SET
  name=public."Trainer".name,
  state=coalesce(public."Trainer".state,EXCLUDED.state),
  "licenseNumber"=coalesce(public."Trainer"."licenseNumber",EXCLUDED."licenseNumber");

DO $$
DECLARE
  invalid_identity_decisions bigint;
  stale_identity_decisions bigint;
BEGIN
  SELECT count(*) INTO invalid_identity_decisions
  FROM _giq_history_stage.normalized_dog normalized
  CROSS JOIN _giq_history_merge.run marker
  LEFT JOIN _giq_history_stage.nonpedigree_dog_identity_resolution decision
    ON decision.natural_key=normalized.natural_key
  WHERE marker.id=1 AND (
    decision.natural_key IS NULL
    OR decision.proposed_target_id IS DISTINCT FROM normalized.target_id
    OR lower(decision.source_provider) IS DISTINCT FROM lower(normalized.source_provider)
    OR decision.source_id IS DISTINCT FROM normalized.source_id
    OR decision.verification_class IS DISTINCT FROM normalized.verification_class
    OR decision.normalized_manifest_sha256 IS DISTINCT FROM marker.normalized_manifest_sha256
    OR decision.source_history_cutoff IS DISTINCT FROM marker.source_history_cutoff
    OR decision.reuse_existing_allowed=decision.create_new_allowed
    OR decision.unlinked_identity_claim_count<>0
    OR decision.nonverified_identity_claim_count<>0
    OR decision.composite_review_candidate_count<>0
    OR decision.parent_relationship_candidate_count<>0
    OR decision.verification_class='r2-preserved'
    OR decision.evidence->'globalSearch' IS DISTINCT FROM jsonb_build_array(
      'Dog.sourceProvider/sourceId','Dog.earBrand','DogSourceIdentity.sourceProvider/sourceId',
      'Dog.name+whelpDate','Dog.name+sex+colour+trainer','Dog.name+sire/dam relationships'
    )
    OR decision.evidence->>'nameOnlyAutoMergeAllowed' IS DISTINCT FROM 'false'
    OR decision.evidence->>'parentRelationshipSearchPerformed' IS DISTINCT FROM 'true'
    OR decision.evidence->>'parentRelationshipCandidateCount' IS DISTINCT FROM '0'
    OR decision.evidence->>'parentRelationshipCandidateEvidenceSha256'
         IS DISTINCT FROM (
           SELECT encode(digest(coalesce(string_agg(
             candidate.existing_dog_id || E'\x1f' || candidate.matched_relationship_count::text
               || E'\x1f' || candidate.evidence::text,
             E'\n' ORDER BY candidate.existing_dog_id
           ),''),'sha256'),'hex')
           FROM _giq_history_stage.nonpedigree_dog_parent_review_candidate candidate
           WHERE candidate.normalized_natural_key=normalized.natural_key
         )
    OR decision.evidence->>'parentRelationshipEvidenceManifestSha256'
         IS DISTINCT FROM marker.normalized_manifest_sha256
    OR decision.evidence->>'parentRelationshipSearchOwnedBy'
         IS DISTINCT FROM 'authoritative-pedigree-resolution'
    OR (decision.reuse_existing_allowed AND (
      decision.exact_canonical_candidate_count<>1
      OR decision.exact_canonical_dog_id IS DISTINCT FROM normalized.target_id
      OR decision.disposition<>'reuse-existing-canonical-by-exact-identity'
      OR NOT EXISTS(SELECT 1 FROM public."Dog" canonical
                    WHERE canonical.id=normalized.target_id)
    ))
    OR (decision.create_new_allowed AND (
      decision.exact_canonical_candidate_count<>0
      OR decision.exact_canonical_dog_id IS NOT NULL
      OR decision.verification_class<>'full-profile'
      OR decision.disposition<>'new-record-supported-by-full-provider-profile'
      OR EXISTS(SELECT 1 FROM public."Dog" canonical
                WHERE canonical.id=normalized.target_id)
    ))
  );

  SELECT count(*) INTO stale_identity_decisions
  FROM _giq_history_stage.nonpedigree_dog_identity_resolution decision
  CROSS JOIN _giq_history_merge.run marker
  LEFT JOIN _giq_history_stage.normalized_dog normalized
    ON normalized.natural_key=decision.natural_key
  WHERE marker.id=1 AND (
    normalized.natural_key IS NULL
    OR decision.normalized_manifest_sha256 IS DISTINCT FROM marker.normalized_manifest_sha256
    OR decision.source_history_cutoff IS DISTINCT FROM marker.source_history_cutoff
  );

  IF invalid_identity_decisions<>0 OR stale_identity_decisions<>0 THEN
    RAISE EXCEPTION
      'canonical Dog insertion is blocked: % normalized rows lack an exact reviewed identity decision and % decision rows are stale or unlinked',
      invalid_identity_decisions,stale_identity_decisions;
  END IF;
END
$$;

INSERT INTO public."Dog"(
  id,name,"earBrand",colour,sex,"whelpDate","sireId","damId","trainerId",
  "sourceProvider","sourceId","profileUrl","ownerName","careerStarts","careerWins",
  "careerSeconds","careerThirds","prizeMoney","winPercentage","placePercentage",
  "profileStatsJson","bestTimesJson","boxHistoryJson","distanceHistoryJson",
  "profileSourceRawJson","lastProfileSyncedAt","retiredAt","createdAt","updatedAt"
)
SELECT
  normalized.target_id,normalized.name,normalized.ear_brand,normalized.colour,normalized.sex,
  normalized.whelp_date,NULL,NULL,normalized.trainer_id,normalized.source_provider,normalized.source_id,
  normalized.profile_url,normalized.owner_name,normalized.career_starts,normalized.career_wins,
  normalized.career_seconds,normalized.career_thirds,normalized.prize_money,
  normalized.win_percentage,normalized.place_percentage,normalized.profile_stats_json,
  normalized.best_times_json,normalized.box_history_json,normalized.distance_history_json,
  normalized.profile_source_raw_json,normalized.last_profile_synced_at,normalized.retired_at,
  normalized.created_at,normalized.updated_at
FROM _giq_history_stage.normalized_dog normalized
JOIN _giq_history_stage.nonpedigree_dog_identity_resolution decision
  ON decision.natural_key=normalized.natural_key
 AND decision.proposed_target_id=normalized.target_id
 AND lower(decision.source_provider) IS NOT DISTINCT FROM lower(normalized.source_provider)
 AND decision.source_id IS NOT DISTINCT FROM normalized.source_id
 AND decision.verification_class=normalized.verification_class
JOIN _giq_history_merge.run marker
  ON marker.id=1
 AND decision.normalized_manifest_sha256=marker.normalized_manifest_sha256
 AND decision.source_history_cutoff=marker.source_history_cutoff
WHERE decision.reuse_existing_allowed OR decision.create_new_allowed
ON CONFLICT(id) DO UPDATE SET
  name=public."Dog".name,
  "earBrand"=CASE WHEN public."Dog"."earBrand" ~ '^thedogs:[0-9]+$'
                    THEN CASE
                      WHEN nullif(btrim(EXCLUDED."earBrand"),'') IS NOT NULL
                       AND EXCLUDED."earBrand" !~ '^thedogs:[0-9]+$'
                        THEN EXCLUDED."earBrand"
                      ELSE NULL
                    END
                  ELSE coalesce(public."Dog"."earBrand",EXCLUDED."earBrand") END,
  colour=coalesce(public."Dog".colour,EXCLUDED.colour),
  sex=coalesce(public."Dog".sex,EXCLUDED.sex),
  "whelpDate"=coalesce(public."Dog"."whelpDate",EXCLUDED."whelpDate"),
  "trainerId"=coalesce(public."Dog"."trainerId",EXCLUDED."trainerId"),
  "sourceProvider"=coalesce(public."Dog"."sourceProvider",EXCLUDED."sourceProvider"),
  "sourceId"=coalesce(public."Dog"."sourceId",EXCLUDED."sourceId"),
  "profileUrl"=coalesce(public."Dog"."profileUrl",EXCLUDED."profileUrl"),
  "ownerName"=coalesce(public."Dog"."ownerName",EXCLUDED."ownerName"),
  "careerStarts"=coalesce(public."Dog"."careerStarts",EXCLUDED."careerStarts"),
  "careerWins"=coalesce(public."Dog"."careerWins",EXCLUDED."careerWins"),
  "careerSeconds"=coalesce(public."Dog"."careerSeconds",EXCLUDED."careerSeconds"),
  "careerThirds"=coalesce(public."Dog"."careerThirds",EXCLUDED."careerThirds"),
  "prizeMoney"=coalesce(public."Dog"."prizeMoney",EXCLUDED."prizeMoney"),
  "winPercentage"=coalesce(public."Dog"."winPercentage",EXCLUDED."winPercentage"),
  "placePercentage"=coalesce(public."Dog"."placePercentage",EXCLUDED."placePercentage"),
  "profileStatsJson"=coalesce(public."Dog"."profileStatsJson",EXCLUDED."profileStatsJson"),
  "bestTimesJson"=coalesce(public."Dog"."bestTimesJson",EXCLUDED."bestTimesJson"),
  "boxHistoryJson"=coalesce(public."Dog"."boxHistoryJson",EXCLUDED."boxHistoryJson"),
  "distanceHistoryJson"=coalesce(public."Dog"."distanceHistoryJson",EXCLUDED."distanceHistoryJson"),
  "profileSourceRawJson"=coalesce(public."Dog"."profileSourceRawJson",EXCLUDED."profileSourceRawJson"),
  "lastProfileSyncedAt"=coalesce(public."Dog"."lastProfileSyncedAt",EXCLUDED."lastProfileSyncedAt"),
  "retiredAt"=coalesce(public."Dog"."retiredAt",EXCLUDED."retiredAt"),
  "createdAt"=public."Dog"."createdAt",
  "updatedAt"=public."Dog"."updatedAt";

INSERT INTO public."Meeting"(
  id,"trackId","meetingDate","meetingType","sourceProvider","sourceId","sourceRawJson","lastSyncedAt","createdAt"
)
SELECT target_id,track_id,meeting_date,meeting_type,source_provider,source_id,source_raw_json,last_synced_at,created_at
FROM _giq_history_stage.normalized_meeting
ON CONFLICT(id) DO UPDATE SET
  "trackId"=public."Meeting"."trackId",
  "meetingDate"=public."Meeting"."meetingDate",
  "meetingType"=coalesce(public."Meeting"."meetingType",EXCLUDED."meetingType"),
  "sourceProvider"=coalesce(public."Meeting"."sourceProvider",EXCLUDED."sourceProvider"),
  "sourceId"=coalesce(public."Meeting"."sourceId",EXCLUDED."sourceId"),
  "sourceRawJson"=coalesce(public."Meeting"."sourceRawJson",EXCLUDED."sourceRawJson"),
  "lastSyncedAt"=coalesce(public."Meeting"."lastSyncedAt",EXCLUDED."lastSyncedAt"),
  "createdAt"=public."Meeting"."createdAt";

INSERT INTO public."Race"(
  id,"meetingId","raceNumber",name,"raceTime",distance,grade,"prizeMoney","resultStatus",
  "replayUrl","photoFinishUrl","sourceProvider","sourceId","sourceRawJson","lastSyncedAt","createdAt"
)
SELECT
  r.target_id,r.meeting_id,r.race_number,r.name,r.race_time,r.distance,r.grade,r.prize_money,
  r.result_status,coalesce(r.replay_url,'/videos/watch/races/' || v.source_id || '/replay'),
  coalesce(r.photo_finish_url,p.photo_finish_url),r.source_provider,r.source_id,r.source_raw_json,
  r.last_synced_at,r.created_at
FROM _giq_history_stage.normalized_race r
LEFT JOIN LATERAL (
  SELECT video.source_id
  FROM _giq_history_stage.normalized_race_video video
  WHERE video.race_id=r.target_id
  ORDER BY video.source_provider,video.source_id,video.target_id
  LIMIT 1
) v ON true
LEFT JOIN _giq_history_stage.normalized_photo_finish p ON p.race_id=r.target_id
ON CONFLICT(id) DO UPDATE SET
  "meetingId"=public."Race"."meetingId",
  "raceNumber"=public."Race"."raceNumber",
  name=coalesce(public."Race".name,EXCLUDED.name),
  "raceTime"=public."Race"."raceTime",
  distance=public."Race".distance,
  grade=coalesce(public."Race".grade,EXCLUDED.grade),
  "prizeMoney"=coalesce(public."Race"."prizeMoney",EXCLUDED."prizeMoney"),
  "resultStatus"=coalesce(public."Race"."resultStatus",EXCLUDED."resultStatus"),
  "replayUrl"=coalesce(public."Race"."replayUrl",EXCLUDED."replayUrl"),
  "photoFinishUrl"=coalesce(public."Race"."photoFinishUrl",EXCLUDED."photoFinishUrl"),
  "sourceProvider"=coalesce(public."Race"."sourceProvider",EXCLUDED."sourceProvider"),
  "sourceId"=coalesce(public."Race"."sourceId",EXCLUDED."sourceId"),
  "sourceRawJson"=coalesce(public."Race"."sourceRawJson",EXCLUDED."sourceRawJson"),
  "lastSyncedAt"=coalesce(public."Race"."lastSyncedAt",EXCLUDED."lastSyncedAt"),
  "createdAt"=public."Race"."createdAt";

INSERT INTO public."Runner"(
  id,"raceId","dogId","boxNumber",weight,"trainerId","startingPrice",scratched,
  "sourceProvider","sourceId","sourceRawJson","createdAt"
)
SELECT target_id,race_id,dog_id,box_number,weight,trainer_id,starting_price,scratched,
       source_provider,source_id,source_raw_json,created_at
FROM _giq_history_stage.normalized_runner
ON CONFLICT(id) DO UPDATE SET
  "raceId"=public."Runner"."raceId","dogId"=public."Runner"."dogId",
  "boxNumber"=public."Runner"."boxNumber",weight=coalesce(public."Runner".weight,EXCLUDED.weight),
  "trainerId"=coalesce(public."Runner"."trainerId",EXCLUDED."trainerId"),
  "startingPrice"=coalesce(public."Runner"."startingPrice",EXCLUDED."startingPrice"),
  scratched=public."Runner".scratched,
  "sourceProvider"=coalesce(public."Runner"."sourceProvider",EXCLUDED."sourceProvider"),
  "sourceId"=coalesce(public."Runner"."sourceId",EXCLUDED."sourceId"),
  "sourceRawJson"=coalesce(public."Runner"."sourceRawJson",EXCLUDED."sourceRawJson"),
  "createdAt"=public."Runner"."createdAt";

INSERT INTO public."Result"(
  id,"runnerId","raceId","finishingPosition","runningTime",margin,"prizeMoneyWon","splitTime",
  sectionals,"gpsData","sourceProvider","sourceId","sourceRawJson","lastSyncedAt","createdAt"
)
SELECT target_id,runner_id,race_id,finishing_position,running_time,margin,prize_money_won,split_time,
       sectionals,gps_data,source_provider,source_id,source_raw_json,last_synced_at,created_at
FROM _giq_history_stage.normalized_result
ON CONFLICT(id) DO UPDATE SET
  "runnerId"=public."Result"."runnerId","raceId"=public."Result"."raceId",
  "finishingPosition"=coalesce(public."Result"."finishingPosition",EXCLUDED."finishingPosition"),
  "runningTime"=coalesce(public."Result"."runningTime",EXCLUDED."runningTime"),
  margin=coalesce(public."Result".margin,EXCLUDED.margin),
  "prizeMoneyWon"=coalesce(public."Result"."prizeMoneyWon",EXCLUDED."prizeMoneyWon"),
  "splitTime"=coalesce(public."Result"."splitTime",EXCLUDED."splitTime"),
  sectionals=coalesce(public."Result".sectionals,EXCLUDED.sectionals),
  "gpsData"=coalesce(public."Result"."gpsData",EXCLUDED."gpsData"),
  "sourceProvider"=coalesce(public."Result"."sourceProvider",EXCLUDED."sourceProvider"),
  "sourceId"=coalesce(public."Result"."sourceId",EXCLUDED."sourceId"),
  "sourceRawJson"=coalesce(public."Result"."sourceRawJson",EXCLUDED."sourceRawJson"),
  "lastSyncedAt"=coalesce(public."Result"."lastSyncedAt",EXCLUDED."lastSyncedAt"),
  "createdAt"=public."Result"."createdAt";

INSERT INTO public."FormEntry"(
  id,"dogId","raceId","trackId",date,"boxNumber",finish,time,distance,grade,weight,"createdAt"
)
SELECT target_id,dog_id,race_id,track_id,date,box_number,finish,time,distance,grade,weight,created_at
FROM _giq_history_stage.normalized_form_entry
ON CONFLICT(id) DO UPDATE SET
  "dogId"=public."FormEntry"."dogId","raceId"=public."FormEntry"."raceId",
  "trackId"=coalesce(public."FormEntry"."trackId",EXCLUDED."trackId"),date=public."FormEntry".date,
  "boxNumber"=coalesce(public."FormEntry"."boxNumber",EXCLUDED."boxNumber"),
  finish=coalesce(public."FormEntry".finish,EXCLUDED.finish),time=coalesce(public."FormEntry".time,EXCLUDED.time),
  distance=coalesce(public."FormEntry".distance,EXCLUDED.distance),grade=coalesce(public."FormEntry".grade,EXCLUDED.grade),
  weight=coalesce(public."FormEntry".weight,EXCLUDED.weight),"createdAt"=public."FormEntry"."createdAt";

INSERT INTO public."DogProfileForm"(
  id,"dogId","sourceProvider","sourceId","raceUrl",date,"trackCode","trackName","raceName",
  "finishText","finishingPosition",starters,"boxNumber",weight,distance,grade,"runningTime",
  "winnerTime","bestOfNightTime","firstSectional",margin,"winnerDogName","winnerDogSourceId",
  "inRunningPositions","startingPrice","hasVideo","sourceRawJson","createdAt","updatedAt"
)
SELECT target_id,dog_id,source_provider,source_id,race_url,date,track_code,track_name,race_name,
  finish_text,finishing_position,starters,box_number,weight,distance,grade,running_time,
  winner_time,best_of_night_time,first_sectional,margin,winner_dog_name,winner_dog_source_id,
  in_running_positions,starting_price,has_video,source_raw_json,created_at,updated_at
FROM _giq_history_stage.normalized_profile_form
ON CONFLICT(id) DO UPDATE SET
  "dogId"=public."DogProfileForm"."dogId","sourceProvider"=public."DogProfileForm"."sourceProvider",
  "sourceId"=public."DogProfileForm"."sourceId","raceUrl"=public."DogProfileForm"."raceUrl",
  date=public."DogProfileForm".date,"trackCode"=coalesce(public."DogProfileForm"."trackCode",EXCLUDED."trackCode"),
  "trackName"=coalesce(public."DogProfileForm"."trackName",EXCLUDED."trackName"),
  "raceName"=coalesce(public."DogProfileForm"."raceName",EXCLUDED."raceName"),
  "finishText"=coalesce(public."DogProfileForm"."finishText",EXCLUDED."finishText"),
  "finishingPosition"=coalesce(public."DogProfileForm"."finishingPosition",EXCLUDED."finishingPosition"),
  starters=coalesce(public."DogProfileForm".starters,EXCLUDED.starters),
  "boxNumber"=coalesce(public."DogProfileForm"."boxNumber",EXCLUDED."boxNumber"),
  weight=coalesce(public."DogProfileForm".weight,EXCLUDED.weight),distance=coalesce(public."DogProfileForm".distance,EXCLUDED.distance),
  grade=coalesce(public."DogProfileForm".grade,EXCLUDED.grade),
  "runningTime"=coalesce(public."DogProfileForm"."runningTime",EXCLUDED."runningTime"),
  "winnerTime"=coalesce(public."DogProfileForm"."winnerTime",EXCLUDED."winnerTime"),
  "bestOfNightTime"=coalesce(public."DogProfileForm"."bestOfNightTime",EXCLUDED."bestOfNightTime"),
  "firstSectional"=coalesce(public."DogProfileForm"."firstSectional",EXCLUDED."firstSectional"),
  margin=coalesce(public."DogProfileForm".margin,EXCLUDED.margin),
  "winnerDogName"=coalesce(public."DogProfileForm"."winnerDogName",EXCLUDED."winnerDogName"),
  "winnerDogSourceId"=coalesce(public."DogProfileForm"."winnerDogSourceId",EXCLUDED."winnerDogSourceId"),
  "inRunningPositions"=coalesce(public."DogProfileForm"."inRunningPositions",EXCLUDED."inRunningPositions"),
  "startingPrice"=coalesce(public."DogProfileForm"."startingPrice",EXCLUDED."startingPrice"),
  "hasVideo"=public."DogProfileForm"."hasVideo",
  "sourceRawJson"=coalesce(public."DogProfileForm"."sourceRawJson",EXCLUDED."sourceRawJson"),
  "createdAt"=public."DogProfileForm"."createdAt","updatedAt"=public."DogProfileForm"."updatedAt";

INSERT INTO public."DogProfileArchive"(
  id,"dogId","sourceProvider","sourceId","profileUrl","fetchedAt","showMorePath","candidateJson",
  "parsedJson","profileHtml","fullFormHtml","createdAt","updatedAt"
)
SELECT target_id,dog_id,source_provider,provider_source_id,profile_url,fetched_at,show_more_path,
  candidate_json,parsed_json,profile_html,full_form_html,created_at,updated_at
FROM _giq_history_stage.normalized_dog_profile_archive
ON CONFLICT(id) DO UPDATE SET
  "dogId"=coalesce(public."DogProfileArchive"."dogId",EXCLUDED."dogId"),
  "sourceProvider"=public."DogProfileArchive"."sourceProvider","sourceId"=public."DogProfileArchive"."sourceId",
  "profileUrl"=coalesce(public."DogProfileArchive"."profileUrl",EXCLUDED."profileUrl"),
  "fetchedAt"=coalesce(public."DogProfileArchive"."fetchedAt",EXCLUDED."fetchedAt"),
  "showMorePath"=coalesce(public."DogProfileArchive"."showMorePath",EXCLUDED."showMorePath"),
  "candidateJson"=coalesce(public."DogProfileArchive"."candidateJson",EXCLUDED."candidateJson"),
  "parsedJson"=coalesce(public."DogProfileArchive"."parsedJson",EXCLUDED."parsedJson"),
  "profileHtml"=coalesce(public."DogProfileArchive"."profileHtml",EXCLUDED."profileHtml"),
  "fullFormHtml"=coalesce(public."DogProfileArchive"."fullFormHtml",EXCLUDED."fullFormHtml"),
  "createdAt"=public."DogProfileArchive"."createdAt","updatedAt"=public."DogProfileArchive"."updatedAt";

INSERT INTO public."RaceDayArchive"(
  id,"sourceProvider",date,"fetchedAt","rawPath",meetings,races,runners,results,dogs,trainers,
  "rawJson","createdAt","updatedAt"
)
SELECT target_id,source_provider,date,fetched_at,raw_path,meetings,races,runners,results,dogs,trainers,
       raw_json,created_at,updated_at
FROM _giq_history_stage.normalized_race_day_archive
ON CONFLICT(id) DO UPDATE SET
  "sourceProvider"=public."RaceDayArchive"."sourceProvider",date=public."RaceDayArchive".date,
  "fetchedAt"=coalesce(public."RaceDayArchive"."fetchedAt",EXCLUDED."fetchedAt"),
  "rawPath"=coalesce(public."RaceDayArchive"."rawPath",EXCLUDED."rawPath"),
  meetings=public."RaceDayArchive".meetings,races=public."RaceDayArchive".races,
  runners=public."RaceDayArchive".runners,results=public."RaceDayArchive".results,
  dogs=public."RaceDayArchive".dogs,trainers=public."RaceDayArchive".trainers,
  "rawJson"=public."RaceDayArchive"."rawJson","createdAt"=public."RaceDayArchive"."createdAt",
  "updatedAt"=public."RaceDayArchive"."updatedAt";

INSERT INTO public."RaceVideo"(
  id,"raceId","sourceProvider","sourceId",kind,"pageUrl","embedSourceType","sourceRawJson","createdAt","updatedAt"
)
SELECT target_id,race_id,source_provider,source_id,kind,page_url,embed_source_type,source_raw_json,created_at,updated_at
FROM _giq_history_stage.normalized_race_video
ON CONFLICT(id) DO UPDATE SET
  "raceId"=public."RaceVideo"."raceId","sourceProvider"=public."RaceVideo"."sourceProvider",
  "sourceId"=public."RaceVideo"."sourceId",kind=public."RaceVideo".kind,
  "pageUrl"=public."RaceVideo"."pageUrl",
  "embedSourceType"=coalesce(public."RaceVideo"."embedSourceType",EXCLUDED."embedSourceType"),
  "sourceRawJson"=coalesce(public."RaceVideo"."sourceRawJson",EXCLUDED."sourceRawJson"),
  "createdAt"=public."RaceVideo"."createdAt","updatedAt"=public."RaceVideo"."updatedAt";

-- TheDogs pedigree evidence and decisions.
DO $$
DECLARE
  thedogs_run_instance_id text;
  galtd_run_instance_id text;
BEGIN
  SELECT export_stage_manifest->>'sourceRunInstanceId',
         galtd_stage_manifest->'export'->>'runInstanceId'
  INTO STRICT thedogs_run_instance_id,galtd_run_instance_id
  FROM _giq_history_merge.run WHERE id=1;
  IF thedogs_run_instance_id !~ '^[A-Za-z0-9._:-]{16,128}$' THEN
    RAISE EXCEPTION 'canonical pedigree evidence requires the real normalized-v2 producer field source.runInstanceId; rebuild the export instead of deriving a run ID from artifact SHA';
  END IF;
  IF galtd_run_instance_id !~ '^[A-Za-z0-9._:-]{16,128}$' THEN
    RAISE EXCEPTION 'canonical pedigree evidence requires strict GALTD report field runInstanceId; regenerate the parser report instead of deriving a run ID from artifact SHA';
  END IF;
  PERFORM (export_stage_manifest->>'sourceGeneratedAt')::timestamptz,
          (galtd_stage_manifest->'export'->>'sourceGeneratedAt')::timestamptz
  FROM _giq_history_merge.run WHERE id=1;
END
$$;

CREATE TABLE _giq_history_stage.thedogs_pedigree_import_run_expected AS
WITH thedogs_lineage AS MATERIALIZED (
  SELECT marker.normalized_manifest_sha256,marker.normalized_transform_version,
    marker.source_history_cutoff,
    (SELECT sum(expected_bytes) FROM _giq_history_merge.export_dataset_manifest) AS artifact_bytes,
    (SELECT count(*) FROM _giq_history_stage.normalized_dog dog
      WHERE dog.source_provider='thedogs' AND dog.source_id ~ '^[0-9]+$') AS identity_rows,
    (SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge edge
    ) AS assertion_rows,
    (SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge edge
      WHERE NOT edge.canonical_eligible) AS issue_rows
  FROM _giq_history_merge.run marker WHERE marker.id=1
)
SELECT
  _giq_history_merge.history_id(
    'pedrun','thedogs:' || marker.normalized_manifest_sha256
  ) AS id,
  'thedogs'::text AS "sourceProvider",200::integer AS "sourceAuthority",
  'verified'::text AS "verificationStatus",'merged'::text AS status,
  'normalized-export:manifest.json'::text AS "artifactUri",
  lineage.normalized_manifest_sha256 AS "artifactSha256",
  lineage.artifact_bytes::bigint AS "artifactBytes",
  'historical-full-export'::text AS "sourceVolume",
  lineage.normalized_transform_version AS "parserVersion",
  lineage.identity_rows::integer AS "recordsObserved",
  lineage.assertion_rows::integer AS "assertionsObserved",
  lineage.issue_rows::integer AS "issuesObserved",
  (marker.export_stage_manifest->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "startedAt",
  (marker.export_stage_manifest->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "completedAt",
  (marker.export_stage_manifest->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "createdAt",
  (marker.export_stage_manifest->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "updatedAt"
FROM thedogs_lineage lineage
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id=1;

INSERT INTO public."PedigreeImportRun"
SELECT * FROM _giq_history_stage.thedogs_pedigree_import_run_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.thedogs_pedigree_import_run_expected expected
    LEFT JOIN public."PedigreeImportRun" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'TheDogs pedigree import-run exact-ID retry detected full-row payload drift';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.thedogs_source_identity AS
WITH occurrence AS MATERIALIZED (
  SELECT n.*,
    row_number() OVER(ORDER BY n.natural_key)::integer AS artifact_offset_line,
    encode(digest(n.source_provenance::text,'sha256'),'hex') AS evidence_sha256
  FROM _giq_history_stage.normalized_dog n
  WHERE n.source_provider='thedogs' AND n.source_id ~ '^[0-9]+$'
)
SELECT occurrence.*,
  marker.export_stage_manifest->>'sourceRunInstanceId' AS source_run_instance_id,
  _giq_history_merge.history_id('dogidentity',concat_ws(':','thedogs',
    marker.export_stage_manifest->>'sourceRunInstanceId',marker.normalized_manifest_sha256,
    occurrence.artifact_offset_line::text,occurrence.evidence_sha256,occurrence.source_id))
    AS identity_id,
  _giq_history_merge.history_id(
    'pedrun','thedogs:' || marker.normalized_manifest_sha256
  ) AS import_run_id
FROM occurrence
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id=1;
CREATE UNIQUE INDEX thedogs_source_identity_dog_key
  ON _giq_history_stage.thedogs_source_identity(target_id);
CREATE UNIQUE INDEX thedogs_source_identity_provider_key
  ON _giq_history_stage.thedogs_source_identity(source_id);

CREATE TABLE _giq_history_stage.thedogs_source_identity_expected AS
SELECT identity_id AS id,target_id AS "dogId",import_run_id AS "importRunId",
  'thedogs'::text AS "sourceProvider",marker.normalized_manifest_sha256 AS "artifactSha256",
  source_id AS "sourceId",name AS "sourceName",_giq_history_merge.slug(name) AS "normalizedName",
  NULL::text AS "registryToken",true AS imported,sex AS "observedSex",colour AS "observedColour",
  whelp_date AT TIME ZONE 'UTC' AS "observedWhelpDate",200::integer AS "sourceAuthority",
  'verified'::text AS "verificationStatus",NULL::integer AS "sourcePage",
  NULL::integer AS "sourceLine",artifact_offset_line AS "artifactOffsetLine",
  evidence_sha256 AS "evidenceSha256",
  (marker.export_stage_manifest->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "createdAt",
  (marker.export_stage_manifest->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "updatedAt"
FROM _giq_history_stage.thedogs_source_identity
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id=1;

INSERT INTO public."DogSourceIdentity"
SELECT * FROM _giq_history_stage.thedogs_source_identity_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.thedogs_source_identity_expected expected
    LEFT JOIN public."DogSourceIdentity" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'TheDogs identity exact-ID retry detected full-row payload drift';
  END IF;
END
$$;

DO $$
DECLARE
  normalized_identities bigint;
  staged_assertions bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM _giq_history_stage.normalized_dog dog
      WHERE dog.source_provider='thedogs' AND dog.source_id ~ '^[0-9]+$'),
    (SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge)
  INTO normalized_identities,staged_assertions;

  IF NOT EXISTS(
    SELECT 1
    FROM public."PedigreeImportRun" import_run
    JOIN _giq_history_stage.thedogs_pedigree_import_run_expected expected USING(id)
    JOIN _giq_history_merge.run marker ON marker.id=1
    WHERE import_run."artifactSha256"=marker.normalized_manifest_sha256
      AND import_run."parserVersion"=marker.normalized_transform_version
      AND import_run."artifactBytes"=expected."artifactBytes"
      AND import_run."recordsObserved"=normalized_identities
      AND import_run."assertionsObserved"=staged_assertions
  ) THEN
    RAISE EXCEPTION 'TheDogs pedigree import-run is not bound to the normalized-v2 run lineage and exact staged totals';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.pedigree_merge_decision AS
SELECT
  e.*,
  resolution.occurrence_id,
  resolution.assertion_id AS winning_assertion_id,
  resolution.source_provider AS winning_source_provider,
  resolution.existing_parent_dog_id AS existing_parent_id,
  CASE
    WHEN resolution.disposition IN ('verified_apply_candidate','applied_verified') THEN 'accepted'
    WHEN resolution.disposition='verified_no_change' THEN 'no_change'
    ELSE 'rejected_ambiguous'
  END AS decision,
  CASE
    WHEN resolution.disposition='verified_apply_candidate'
      THEN 'verified-authoritative-compare-and-set'
    WHEN resolution.disposition='applied_verified' THEN 'verified-authoritative-applied'
    WHEN resolution.disposition='verified_no_change' THEN 'verified-authoritative-no-change'
    ELSE resolution.disposition
  END AS reason_code
FROM _giq_history_stage.normalized_pedigree_edge e
JOIN _giq_history_stage.authoritative_pedigree_resolution resolution
  ON resolution.source_provider='thedogs'
 AND resolution.source_id=e.natural_key;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.pedigree_merge_decision decision
    JOIN _giq_history_stage.authoritative_pedigree_resolution resolution
      USING(occurrence_id)
    WHERE resolution.disposition IN (
      'verified_apply_candidate','applied_verified','verified_no_change'
    ) AND (decision.child_id IS DISTINCT FROM resolution.subject_dog_id
      OR decision.parent_id IS DISTINCT FROM resolution.parent_dog_id
      OR decision.relationship IS DISTINCT FROM resolution.relationship)
  ) THEN
    RAISE EXCEPTION 'authoritative TheDogs pedigree identity differs from the normalized stable-ID projection';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.thedogs_pedigree_assertion_occurrence AS
WITH occurrence AS MATERIALIZED (
  SELECT e.*,
    row_number() OVER(ORDER BY e.natural_key)::integer AS artifact_offset_line,
    encode(digest(e.payload::text,'sha256'),'hex') AS evidence_sha256
  FROM _giq_history_stage.normalized_pedigree_edge e
)
SELECT occurrence.*,
  marker.export_stage_manifest->>'sourceRunInstanceId' AS source_run_instance_id,
  _giq_history_merge.history_id('pedassert',concat_ws(':','thedogs',
    marker.export_stage_manifest->>'sourceRunInstanceId',marker.normalized_manifest_sha256,
    occurrence.artifact_offset_line::text,occurrence.evidence_sha256,
    occurrence.relationship,occurrence.natural_key)) AS assertion_id
FROM occurrence
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id=1;

CREATE UNIQUE INDEX thedogs_pedigree_assertion_occurrence_id_key
  ON _giq_history_stage.thedogs_pedigree_assertion_occurrence(assertion_id);

CREATE TABLE _giq_history_stage.thedogs_pedigree_assertion_expected AS
SELECT occurrence.assertion_id AS id,subject.import_run_id AS "importRunId",
  'thedogs'::text AS "sourceProvider",marker.normalized_manifest_sha256 AS "artifactSha256",
  subject.identity_id AS "subjectIdentityId",
  CASE WHEN occurrence.self_parent THEN NULL ELSE parent.identity_id END AS "parentIdentityId",
  occurrence.relationship,occurrence.parent_name AS "assertedParentName",
  _giq_history_merge.slug(occurrence.parent_name) AS "assertedParentNormalizedName",
  NULL::text AS "assertedParentRegistryToken",200::integer AS "sourceAuthority",
  CASE decision.decision
    WHEN 'accepted' THEN 'verified'
    WHEN 'no_change' THEN 'verified'
    WHEN 'preserved_higher_authority' THEN 'conflict'
    WHEN 'rejected_ambiguous' THEN 'rejected'
    ELSE 'parsed'
  END::text AS "verificationStatus",
  NULL::integer AS "sourcePage",NULL::integer AS "sourceLine",
  occurrence.artifact_offset_line AS "artifactOffsetLine",
  occurrence.evidence_sha256 AS "evidenceSha256",
  (marker.export_stage_manifest->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "createdAt",
  (marker.export_stage_manifest->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "updatedAt"
FROM _giq_history_stage.thedogs_pedigree_assertion_occurrence occurrence
JOIN _giq_history_stage.thedogs_source_identity subject ON subject.target_id=occurrence.child_id
JOIN _giq_history_stage.thedogs_source_identity parent ON parent.target_id=occurrence.parent_id
JOIN _giq_history_stage.pedigree_merge_decision decision
  ON decision.natural_key=occurrence.natural_key
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id=1
  -- A verified no-change already has exactly one canonical authority row.  The
  -- new occurrence remains in the append-only internal evidence model and must
  -- not create a second public winner.
  AND decision.decision='no_change'
  AND false;

INSERT INTO public."PedigreeAssertion"
SELECT * FROM _giq_history_stage.thedogs_pedigree_assertion_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.thedogs_pedigree_assertion_expected expected
    LEFT JOIN public."PedigreeAssertion" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'TheDogs assertion exact-ID retry detected full-row payload drift';
  END IF;
END
$$;

DO $$
DECLARE
  normalized_identities bigint;
  staged_identities bigint;
  canonical_identities bigint;
  staged_assertions bigint;
  canonical_assertions bigint;
  missing_identities bigint;
  missing_assertions bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM _giq_history_stage.normalized_dog
      WHERE natural_key ~ '^thedogs:dog:[0-9]+$'),
    (SELECT count(*) FROM _giq_history_stage.thedogs_source_identity),
    (SELECT count(*) FROM public."DogSourceIdentity"
      WHERE "importRunId"=(SELECT id
        FROM _giq_history_stage.thedogs_pedigree_import_run_expected)),
    (SELECT count(*) FROM _giq_history_stage.thedogs_pedigree_assertion_expected),
    (SELECT count(*) FROM public."PedigreeAssertion"
      WHERE "importRunId"=(SELECT id
        FROM _giq_history_stage.thedogs_pedigree_import_run_expected))
  INTO normalized_identities,staged_identities,canonical_identities,
       staged_assertions,canonical_assertions;

  SELECT count(*) INTO missing_identities
  FROM _giq_history_stage.thedogs_source_identity_expected staged
  LEFT JOIN public."DogSourceIdentity" canonical ON canonical.id=staged.id
  WHERE canonical.id IS NULL;

  SELECT count(*) INTO missing_assertions
  FROM _giq_history_stage.thedogs_pedigree_assertion_expected staged
  LEFT JOIN public."PedigreeAssertion" canonical ON canonical.id=staged.id
  WHERE canonical.id IS NULL;

  IF normalized_identities<>staged_identities
     OR staged_identities<>canonical_identities
     OR staged_assertions<>canonical_assertions
     OR missing_identities<>0 OR missing_assertions<>0
     OR NOT EXISTS(
       SELECT 1
       FROM public."PedigreeImportRun" import_run
       JOIN _giq_history_stage.thedogs_pedigree_import_run_expected expected USING(id)
       JOIN _giq_history_merge.run marker ON marker.id=1
       WHERE import_run."artifactSha256"=marker.normalized_manifest_sha256
         AND import_run."parserVersion"=marker.normalized_transform_version
         AND import_run."artifactBytes"=expected."artifactBytes"
         AND import_run."recordsObserved"=normalized_identities
         AND import_run."assertionsObserved"=(
           SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge)
     ) THEN
    RAISE EXCEPTION
      'TheDogs pedigree provenance conservation failed: normalized/staged/canonical identities %/%/%, staged/canonical assertions %/%, missing identities/assertions %/%',
      normalized_identities,staged_identities,canonical_identities,
      staged_assertions,canonical_assertions,missing_identities,missing_assertions;
  END IF;
END
$$;

-- GALTD provenance: all observations/assertions are retained. The descriptive
-- name + whelp month + parent-name composite is a retrieval hint only; it must
-- never assign a canonical Dog or parent identity.
CREATE TABLE _giq_history_stage.galtd_pedigree_import_run_expected AS
SELECT
  _giq_history_merge.history_id('galtdrun',concat_ws(':','galtd',
    marker.galtd_stage_manifest->'export'->>'runInstanceId',o.payload->>'artifactSha256')) AS id,
  'galtd'::text AS "sourceProvider",100::integer AS "sourceAuthority",
  CASE WHEN count(*) FILTER(WHERE o.payload ? 'conflictGroup')>0
    THEN 'conflict' ELSE 'verified' END::text AS "verificationStatus",
  'merged'::text AS status,
  ('galtd:' || min(o.payload->>'artifact'))::text AS "artifactUri",
  o.payload->>'artifactSha256' AS "artifactSha256",
  min((r.source->>'artifactBytes')::bigint) AS "artifactBytes",
  min(o.payload->>'volume') AS "sourceVolume",
  'galtd-studbook-audit-v1'::text AS "parserVersion",count(*)::integer AS "recordsObserved",
  (SELECT count(*) FROM _giq_history_stage.galtd_assertion a
   WHERE a.payload->>'artifactSha256'=o.payload->>'artifactSha256')::integer AS "assertionsObserved",
  count(*) FILTER(WHERE o.payload ? 'conflictGroup')::integer AS "issuesObserved",
  (marker.galtd_stage_manifest->'export'->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "startedAt",
  (marker.galtd_stage_manifest->'export'->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "completedAt",
  (marker.galtd_stage_manifest->'export'->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "createdAt",
  (marker.galtd_stage_manifest->'export'->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "updatedAt"
FROM _giq_history_stage.galtd_observation o
JOIN LATERAL jsonb_array_elements(
  (SELECT galtd_stage_manifest->'export'->'sources' FROM _giq_history_merge.run WHERE id=1)
) r(source) ON (r.source->>'artifactSha256')=o.payload->>'artifactSha256'
JOIN _giq_history_merge.run marker ON marker.id=1
GROUP BY o.payload->>'artifactSha256'
  ,marker.galtd_stage_manifest;

INSERT INTO public."PedigreeImportRun"
SELECT * FROM _giq_history_stage.galtd_pedigree_import_run_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.galtd_pedigree_import_run_expected expected
    LEFT JOIN public."PedigreeImportRun" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'GALTD pedigree import-run exact-ID retry detected full-row payload drift';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.galtd_source_identity AS
SELECT
  o.payload,
  marker.galtd_stage_manifest->'export'->>'runInstanceId' AS source_run_instance_id,
  _giq_history_merge.history_id('dogidentity',concat_ws(':','galtd',
    marker.galtd_stage_manifest->'export'->>'runInstanceId',o.payload->>'artifactSha256',
    o.payload->>'artifactOffsetLine',o.payload->>'evidenceSha256',o.payload->>'sourceId'))
    AS identity_id,
  _giq_history_merge.history_id('galtdrun',concat_ws(':','galtd',
    marker.galtd_stage_manifest->'export'->>'runInstanceId',o.payload->>'artifactSha256'))
    AS import_run_id,
  x.child_id AS dog_id,
  coalesce(x.canonical_eligible,false) AS crosswalk_eligible
FROM _giq_history_stage.galtd_observation o
JOIN _giq_history_merge.run marker ON marker.id=1
LEFT JOIN _giq_history_stage.galtd_exact_crosswalk x
  ON x.galtd_source_id=o.payload->>'sourceId' AND x.canonical_eligible;
CREATE INDEX galtd_source_identity_source_idx
  ON _giq_history_stage.galtd_source_identity((payload->>'sourceId'));
CREATE UNIQUE INDEX galtd_source_identity_occurrence_id_key
  ON _giq_history_stage.galtd_source_identity(identity_id);

CREATE TABLE _giq_history_stage.galtd_source_identity_expected AS
SELECT
  identity.identity_id AS id,identity.dog_id AS "dogId",identity.import_run_id AS "importRunId",
  'galtd'::text AS "sourceProvider",identity.payload->>'artifactSha256' AS "artifactSha256",
  identity.payload->>'sourceId' AS "sourceId",identity.payload->>'sourceName' AS "sourceName",
  identity.payload->>'normalizedName' AS "normalizedName",
  identity.payload->>'registryToken' AS "registryToken",identity.crosswalk_eligible AS imported,
  identity.payload->>'sex' AS "observedSex",identity.payload->>'colour' AS "observedColour",
  (identity.payload->>'whelpDate')::timestamptz AT TIME ZONE 'UTC' AS "observedWhelpDate",
  100::integer AS "sourceAuthority",
  CASE WHEN payload ? 'conflictGroup' THEN 'conflict'
       WHEN crosswalk_eligible THEN 'verified' ELSE 'rejected' END::text AS "verificationStatus",
  (identity.payload->>'sourcePage')::integer AS "sourcePage",
  (identity.payload->>'sourceLine')::integer AS "sourceLine",
  (identity.payload->>'artifactOffsetLine')::integer AS "artifactOffsetLine",
  identity.payload->>'evidenceSha256' AS "evidenceSha256",
  (marker.galtd_stage_manifest->'export'->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "createdAt",
  (marker.galtd_stage_manifest->'export'->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "updatedAt"
FROM _giq_history_stage.galtd_source_identity identity
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id=1;

INSERT INTO public."DogSourceIdentity"
SELECT * FROM _giq_history_stage.galtd_source_identity_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.galtd_source_identity_expected expected
    LEFT JOIN public."DogSourceIdentity" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'GALTD identity exact-ID retry detected full-row payload drift';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.galtd_pedigree_assertion_occurrence AS
SELECT
  a.payload,subject.import_run_id,subject.identity_id AS subject_identity_id,
  parent.identity_id AS parent_identity_id,coalesce(x.canonical_eligible,false) AS crosswalk_eligible,
  resolution.occurrence_id,resolution.disposition AS resolution_disposition,
  _giq_history_merge.history_id('pedassert',concat_ws(':','galtd',
    marker.galtd_stage_manifest->'export'->>'runInstanceId',a.payload->>'artifactSha256',
    a.payload->>'artifactOffsetLine',a.payload->>'evidenceSha256',
    a.payload->>'relationship',a.payload->>'sourceId')) AS assertion_id
FROM _giq_history_stage.galtd_assertion a
JOIN _giq_history_stage.galtd_source_identity subject
  ON subject.payload->>'sourceId'=a.payload->>'subjectSourceId'
 AND subject.payload->>'artifactSha256'=a.payload->>'artifactSha256'
LEFT JOIN _giq_history_stage.galtd_exact_crosswalk x
  ON x.galtd_source_id=a.payload->>'subjectSourceId' AND x.canonical_eligible
LEFT JOIN _giq_history_stage.thedogs_source_identity parent
  ON parent.target_id=CASE a.payload->>'relationship' WHEN 'sire' THEN x.sire_id ELSE x.dam_id END
JOIN _giq_history_stage.authoritative_pedigree_resolution resolution
  ON resolution.source_provider='galtd'
 AND resolution.artifact_sha256=a.payload->>'artifactSha256'
 AND resolution.source_id=a.payload->>'sourceId'
 AND resolution.relationship=a.payload->>'relationship'
 AND resolution.evidence_sha256=a.payload->>'evidenceSha256'
JOIN _giq_history_merge.run marker ON marker.id=1;

CREATE UNIQUE INDEX galtd_pedigree_assertion_occurrence_id_key
  ON _giq_history_stage.galtd_pedigree_assertion_occurrence(assertion_id);

CREATE TABLE _giq_history_stage.galtd_pedigree_assertion_expected AS
SELECT occurrence.assertion_id AS id,occurrence.import_run_id AS "importRunId",
  'galtd'::text AS "sourceProvider",occurrence.payload->>'artifactSha256' AS "artifactSha256",
  occurrence.subject_identity_id AS "subjectIdentityId",
  occurrence.parent_identity_id AS "parentIdentityId",
  occurrence.payload->>'relationship' AS relationship,
  occurrence.payload->>'assertedParentName' AS "assertedParentName",
  occurrence.payload->>'assertedParentNormalizedName' AS "assertedParentNormalizedName",
  occurrence.payload->>'assertedParentRegistryToken' AS "assertedParentRegistryToken",
  100::integer AS "sourceAuthority",
  CASE WHEN occurrence.payload ? 'conflictGroup' THEN 'conflict'
       WHEN occurrence.crosswalk_eligible THEN 'verified' ELSE 'rejected' END::text
    AS "verificationStatus",
  (occurrence.payload->>'sourcePage')::integer AS "sourcePage",
  (occurrence.payload->>'sourceLine')::integer AS "sourceLine",
  (occurrence.payload->>'artifactOffsetLine')::integer AS "artifactOffsetLine",
  occurrence.payload->>'evidenceSha256' AS "evidenceSha256",
  (marker.galtd_stage_manifest->'export'->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "createdAt",
  (marker.galtd_stage_manifest->'export'->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "updatedAt"
FROM _giq_history_stage.galtd_pedigree_assertion_occurrence occurrence
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id=1
  AND occurrence.resolution_disposition IN ('applied_verified','verified_no_change')
  AND occurrence.crosswalk_eligible;

INSERT INTO public."PedigreeAssertion"
SELECT * FROM _giq_history_stage.galtd_pedigree_assertion_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.galtd_pedigree_assertion_expected expected
    LEFT JOIN public."PedigreeAssertion" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'GALTD assertion exact-ID retry detected full-row payload drift';
  END IF;
END
$$;

DO $$
DECLARE
  staged_identities bigint;
  canonical_identities bigint;
  staged_assertions bigint;
  canonical_assertions bigint;
  missing_identities bigint;
  missing_assertions bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM _giq_history_stage.galtd_source_identity),
    (SELECT count(*) FROM public."DogSourceIdentity" canonical
      WHERE canonical."importRunId" IN (
        SELECT id FROM _giq_history_stage.galtd_pedigree_import_run_expected)),
    (SELECT count(*) FROM _giq_history_stage.galtd_pedigree_assertion_expected),
    (SELECT count(*)
      FROM _giq_history_stage.galtd_pedigree_assertion_expected staged
      JOIN public."PedigreeAssertion" canonical USING(id))
  INTO staged_identities,canonical_identities,staged_assertions,canonical_assertions;

  SELECT count(*) INTO missing_identities
  FROM _giq_history_stage.galtd_source_identity_expected staged
  LEFT JOIN public."DogSourceIdentity" canonical ON canonical.id=staged.id
  WHERE canonical.id IS NULL;

  SELECT count(*) INTO missing_assertions
  FROM _giq_history_stage.galtd_pedigree_assertion_expected staged
  LEFT JOIN public."PedigreeAssertion" canonical ON canonical.id=staged.id
  WHERE canonical.id IS NULL;

  IF staged_identities<>105374::bigint
     OR staged_identities<>canonical_identities
     OR staged_assertions<>canonical_assertions
     OR missing_identities<>0 OR missing_assertions<>0 THEN
    RAISE EXCEPTION
      'GALTD pedigree provenance conservation failed: staged/canonical identities %/%, staged/canonical assertions %/%, missing identities/assertions %/%',
      staged_identities,canonical_identities,staged_assertions,canonical_assertions,
      missing_identities,missing_assertions;
  END IF;
END
$$;

-- Apply only v2 resolutions that are backed by exact, verified identity and
-- relationship evidence.  The input is materialized before any canonical
-- write so the compare-and-set target and immutable evidence payload cannot
-- drift while the transaction is running.
CREATE TABLE _giq_history_stage.authoritative_pedigree_apply_input AS
SELECT
  resolution.occurrence_id,
  resolution.assertion_id AS authoritative_assertion_id,
  occurrence.import_run_id AS source_import_run_id,
  occurrence.artifact_sha256,
  occurrence.source_provider,
  occurrence.source_file,
  occurrence.source_line,
  occurrence.source_id,
  occurrence.relationship,
  occurrence.evidence_sha256,
  occurrence.subject_source_id,
  coalesce(nullif(btrim(occurrence.parent_source_id),''),
    parent_evidence.source_provider || ':' || parent_evidence.source_id)
    AS parent_source_id,
  resolution.subject_dog_id,
  resolution.parent_dog_id,
  subject_evidence.source_name AS subject_source_name,
  nullif(btrim(subject_evidence.registry_token),'') AS subject_registry_token,
  subject_evidence.observed_whelp_date::timestamp(3) without time zone
    AS subject_observed_whelp_date,
  subject_evidence.evidence_sha256 AS subject_evidence_sha256,
  parent_evidence.source_name AS parent_source_name,
  nullif(btrim(parent_evidence.registry_token),'') AS parent_registry_token,
  parent_evidence.observed_whelp_date::timestamp(3) without time zone
    AS parent_observed_whelp_date,
  parent_evidence.evidence_sha256 AS parent_evidence_sha256,
  relationship_evidence.asserted_parent_name,
  policy.authority_rank AS source_authority,
  source_run."artifactBytes" AS artifact_bytes,
  source_run."startedAt"::timestamp(3) without time zone AS evidence_at,
  _giq_history_merge.history_id('pedrun-v2',resolution.occurrence_id)
    AS apply_import_run_id,
  _giq_history_merge.history_id(
    'dogidentity-v2',resolution.occurrence_id || ':subject') AS subject_identity_id,
  _giq_history_merge.history_id(
    'dogidentity-v2',resolution.occurrence_id || ':parent') AS parent_identity_id,
  _giq_history_merge.history_id('pedledger-v2',resolution.occurrence_id)
    AS ledger_id
FROM _giq_history_stage.authoritative_pedigree_resolution resolution
JOIN _giq_history_stage.authoritative_pedigree_assertion_occurrence occurrence
  USING(occurrence_id)
JOIN _giq_history_stage.authoritative_pedigree_evidence_leaf relationship_evidence
  ON relationship_evidence.assertion_id=resolution.assertion_id
JOIN _giq_history_stage.authoritative_identity_evidence subject_evidence
  ON subject_evidence.evidence_id=relationship_evidence.subject_evidence_id
JOIN _giq_history_stage.authoritative_identity_evidence parent_evidence
  ON parent_evidence.evidence_id=relationship_evidence.parent_evidence_id
JOIN _giq_history_stage.authoritative_provider_policy policy
  ON policy.source_provider=occurrence.source_provider
JOIN public."PedigreeImportRun" source_run
  ON source_run.id=occurrence.import_run_id
 AND source_run."sourceProvider"=occurrence.source_provider
 AND source_run."artifactSha256"=occurrence.artifact_sha256
WHERE resolution.disposition='verified_apply_candidate'
  AND resolution.canonical_write_eligible;

CREATE UNIQUE INDEX authoritative_pedigree_apply_occurrence_key
  ON _giq_history_stage.authoritative_pedigree_apply_input(occurrence_id);
CREATE UNIQUE INDEX authoritative_pedigree_apply_target_key
  ON _giq_history_stage.authoritative_pedigree_apply_input(subject_dog_id,relationship);

DO $$
DECLARE
  expected_apply_count bigint;
BEGIN
  SELECT count(*) INTO expected_apply_count
  FROM _giq_history_stage.authoritative_pedigree_resolution
  WHERE disposition='verified_apply_candidate' AND canonical_write_eligible;

  IF expected_apply_count<>(
    SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_apply_input
  ) THEN
    RAISE EXCEPTION
      'authoritative pedigree apply input did not preserve every verified apply candidate';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_apply_input input
    JOIN _giq_history_stage.authoritative_pedigree_resolution resolution
      USING(occurrence_id)
    WHERE resolution.disposition<>'verified_apply_candidate'
       OR resolution.canonical_write_eligible IS NOT TRUE
       OR resolution.exact_identities_verified IS NOT TRUE
       OR resolution.exact_candidate_cardinality_verified IS NOT TRUE
       OR resolution.relationship_proof_verified IS NOT TRUE
       OR resolution.subject_dog_id IS DISTINCT FROM input.subject_dog_id
       OR resolution.parent_dog_id IS DISTINCT FROM input.parent_dog_id
       OR resolution.existing_parent_dog_id IS NOT NULL
       OR resolution.creates_cycle IS DISTINCT FROM false
       OR resolution.source_conflict OR resolution.source_impossible
       OR resolution.canonical_safety_blocking OR resolution.coverage_blocking
       OR resolution.hard_blocker_class IS NOT NULL
       OR input.subject_dog_id=input.parent_dog_id
       OR input.relationship NOT IN ('sire','dam')
       OR input.source_line NOT BETWEEN 1 AND 2147483647
       OR char_length(input.source_file) NOT BETWEEN 1 AND 2048
       OR char_length(btrim(input.subject_source_id)) NOT BETWEEN 1 AND 256
       OR char_length(btrim(input.parent_source_id)) NOT BETWEEN 1 AND 256
       OR char_length(btrim(input.subject_source_name)) NOT BETWEEN 1 AND 200
       OR char_length(btrim(input.parent_source_name)) NOT BETWEEN 1 AND 200
       OR char_length(btrim(input.asserted_parent_name)) NOT BETWEEN 1 AND 200
       OR char_length(btrim(_giq_history_merge.slug(input.subject_source_name)))
            NOT BETWEEN 1 AND 200
       OR char_length(btrim(_giq_history_merge.slug(input.parent_source_name)))
            NOT BETWEEN 1 AND 200
       OR char_length(btrim(_giq_history_merge.slug(input.asserted_parent_name)))
            NOT BETWEEN 1 AND 200
       OR input.subject_registry_token IS NOT NULL
          AND char_length(input.subject_registry_token) NOT BETWEEN 1 AND 100
       OR input.parent_registry_token IS NOT NULL
          AND char_length(input.parent_registry_token) NOT BETWEEN 1 AND 100
  ) THEN
    RAISE EXCEPTION
      'authoritative pedigree apply candidate failed exact identity, proof, or public payload validation';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_apply_input sire
    JOIN _giq_history_stage.authoritative_pedigree_apply_input dam
      ON dam.subject_dog_id=sire.subject_dog_id
     AND dam.parent_dog_id=sire.parent_dog_id
     AND dam.relationship='dam'
    WHERE sire.relationship='sire'
  ) THEN
    RAISE EXCEPTION 'authoritative pedigree apply would assign the same sire and dam';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_apply_input input
    JOIN public."PedigreeMergeLedger" ledger
      ON ledger."dogId"=input.subject_dog_id
     AND ledger.relationship=input.relationship
     AND ledger."verificationStatus"='verified'
     AND ledger.decision IN ('accepted','no_change')
  ) THEN
    RAISE EXCEPTION
      'authoritative pedigree apply found a pre-existing verified winner for a null canonical parent';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_apply_input candidate
    WHERE EXISTS(
      WITH RECURSIVE ancestry(node_id,path,cycle) AS (
        SELECT candidate.parent_dog_id,
          ARRAY[candidate.subject_dog_id,candidate.parent_dog_id]::text[],
          candidate.parent_dog_id=candidate.subject_dog_id
        UNION ALL
        SELECT edge.parent_dog_id,ancestry.path || edge.parent_dog_id,
          edge.parent_dog_id=ANY(ancestry.path)
        FROM ancestry
        JOIN LATERAL (
          SELECT dog."sireId" AS parent_dog_id
          FROM public."Dog" dog
          WHERE dog.id=ancestry.node_id AND dog."sireId" IS NOT NULL
          UNION ALL
          SELECT dog."damId"
          FROM public."Dog" dog
          WHERE dog.id=ancestry.node_id AND dog."damId" IS NOT NULL
          UNION ALL
          SELECT planned.parent_dog_id
          FROM _giq_history_stage.authoritative_pedigree_apply_input planned
          WHERE planned.subject_dog_id=ancestry.node_id
        ) edge ON edge.parent_dog_id IS NOT NULL
        WHERE NOT ancestry.cycle
          AND cardinality(ancestry.path)<=(SELECT count(*)+1 FROM public."Dog")
      )
      SELECT 1 FROM ancestry WHERE cycle
    )
  ) THEN
    RAISE EXCEPTION 'authoritative pedigree apply batch would create a pedigree cycle';
  END IF;
END
$$;

-- SHARE ROW EXCLUSIVE already prevents concurrent table writers; explicit row
-- locks document and enforce the compare-and-set boundary for every subject and
-- parent used by the verified batch.
DO $$
BEGIN
  PERFORM dog.id
  FROM public."Dog" dog
  WHERE dog.id IN (
    SELECT subject_dog_id
    FROM _giq_history_stage.authoritative_pedigree_apply_input
    UNION
    SELECT parent_dog_id
    FROM _giq_history_stage.authoritative_pedigree_apply_input
  )
  ORDER BY dog.id
  FOR UPDATE;

  IF (SELECT count(DISTINCT locked_id)
      FROM (
        SELECT subject_dog_id AS locked_id
        FROM _giq_history_stage.authoritative_pedigree_apply_input
        UNION
        SELECT parent_dog_id
        FROM _giq_history_stage.authoritative_pedigree_apply_input
      ) target) <>
     (SELECT count(*)
      FROM public."Dog" dog
      WHERE dog.id IN (
        SELECT subject_dog_id
        FROM _giq_history_stage.authoritative_pedigree_apply_input
        UNION
        SELECT parent_dog_id
        FROM _giq_history_stage.authoritative_pedigree_apply_input
      )) THEN
    RAISE EXCEPTION 'authoritative pedigree apply could not lock every exact Dog identity';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_apply_input input
    JOIN public."Dog" dog ON dog.id=input.subject_dog_id
    WHERE (CASE input.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
            IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'authoritative pedigree compare-and-set observed a populated parent after locking';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.authoritative_pedigree_apply_import_run_expected AS
SELECT apply_import_run_id AS id,source_provider AS "sourceProvider",
  source_authority AS "sourceAuthority",'verified'::text AS "verificationStatus",
  'merged'::text AS status,source_file AS "artifactUri",
  artifact_sha256 AS "artifactSha256",artifact_bytes AS "artifactBytes",
  'authoritative-v2-apply'::text AS "sourceVolume",
  'authoritative-pedigree-v2'::text AS "parserVersion",
  2::integer AS "recordsObserved",1::integer AS "assertionsObserved",
  0::integer AS "issuesObserved",evidence_at AS "startedAt",
  evidence_at AS "completedAt",evidence_at AS "createdAt",evidence_at AS "updatedAt"
FROM _giq_history_stage.authoritative_pedigree_apply_input;

INSERT INTO public."PedigreeImportRun"
SELECT * FROM _giq_history_stage.authoritative_pedigree_apply_import_run_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_apply_import_run_expected expected
    LEFT JOIN public."PedigreeImportRun" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'authoritative pedigree apply import-run exact-ID retry detected payload drift';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.authoritative_pedigree_apply_identity_expected AS
SELECT identity.id,identity.dog_id AS "dogId",input.apply_import_run_id AS "importRunId",
  input.source_provider AS "sourceProvider",input.artifact_sha256 AS "artifactSha256",
  identity.source_id AS "sourceId",identity.source_name AS "sourceName",
  _giq_history_merge.slug(identity.source_name) AS "normalizedName",
  identity.registry_token AS "registryToken",true AS imported,
  NULL::text AS "observedSex",NULL::text AS "observedColour",
  identity.observed_whelp_date AS "observedWhelpDate",
  input.source_authority AS "sourceAuthority",'verified'::text AS "verificationStatus",
  NULL::integer AS "sourcePage",input.source_line::integer AS "sourceLine",
  input.source_line::integer AS "artifactOffsetLine",
  identity.identity_evidence_sha256 AS "evidenceSha256",
  input.evidence_at AS "createdAt",input.evidence_at AS "updatedAt"
FROM _giq_history_stage.authoritative_pedigree_apply_input input
CROSS JOIN LATERAL (VALUES
  (input.subject_identity_id,input.subject_dog_id,input.subject_source_id,
   input.subject_source_name,input.subject_registry_token,
   input.subject_observed_whelp_date,input.subject_evidence_sha256),
  (input.parent_identity_id,input.parent_dog_id,input.parent_source_id,
   input.parent_source_name,input.parent_registry_token,
   input.parent_observed_whelp_date,input.parent_evidence_sha256)
) identity(id,dog_id,source_id,source_name,registry_token,observed_whelp_date,
           identity_evidence_sha256);

INSERT INTO public."DogSourceIdentity"
SELECT * FROM _giq_history_stage.authoritative_pedigree_apply_identity_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_apply_identity_expected expected
    LEFT JOIN public."DogSourceIdentity" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'authoritative pedigree apply identity exact-ID retry detected payload drift';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.authoritative_pedigree_apply_assertion_expected AS
SELECT occurrence_id AS id,apply_import_run_id AS "importRunId",
  source_provider AS "sourceProvider",artifact_sha256 AS "artifactSha256",
  subject_identity_id AS "subjectIdentityId",parent_identity_id AS "parentIdentityId",
  relationship,asserted_parent_name AS "assertedParentName",
  _giq_history_merge.slug(asserted_parent_name) AS "assertedParentNormalizedName",
  parent_registry_token AS "assertedParentRegistryToken",
  source_authority AS "sourceAuthority",'verified'::text AS "verificationStatus",
  NULL::integer AS "sourcePage",source_line::integer AS "sourceLine",
  source_line::integer AS "artifactOffsetLine",evidence_sha256 AS "evidenceSha256",
  evidence_at AS "createdAt",evidence_at AS "updatedAt"
FROM _giq_history_stage.authoritative_pedigree_apply_input;

INSERT INTO public."PedigreeAssertion"
SELECT * FROM _giq_history_stage.authoritative_pedigree_apply_assertion_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_apply_assertion_expected expected
    LEFT JOIN public."PedigreeAssertion" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'authoritative pedigree apply assertion exact-ID retry detected payload drift';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.authoritative_pedigree_apply_result (
  occurrence_id text PRIMARY KEY,
  dog_id text NOT NULL,
  parent_dog_id text NOT NULL,
  relationship text NOT NULL
);

WITH updated AS (
  UPDATE public."Dog" dog
  SET "sireId"=input.parent_dog_id
  FROM _giq_history_stage.authoritative_pedigree_apply_input input
  WHERE input.relationship='sire'
    AND dog.id=input.subject_dog_id
    AND dog."sireId" IS NULL
  RETURNING input.occurrence_id,dog.id,input.parent_dog_id,input.relationship
)
INSERT INTO _giq_history_stage.authoritative_pedigree_apply_result
SELECT * FROM updated;

WITH updated AS (
  UPDATE public."Dog" dog
  SET "damId"=input.parent_dog_id
  FROM _giq_history_stage.authoritative_pedigree_apply_input input
  WHERE input.relationship='dam'
    AND dog.id=input.subject_dog_id
    AND dog."damId" IS NULL
  RETURNING input.occurrence_id,dog.id,input.parent_dog_id,input.relationship
)
INSERT INTO _giq_history_stage.authoritative_pedigree_apply_result
SELECT * FROM updated;

DO $$
BEGIN
  IF (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_apply_result)<>
     (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_apply_input)
     OR EXISTS(
       SELECT 1
       FROM _giq_history_stage.authoritative_pedigree_apply_input input
       LEFT JOIN _giq_history_stage.authoritative_pedigree_apply_result result
         USING(occurrence_id)
       WHERE result.occurrence_id IS NULL
          OR result.dog_id IS DISTINCT FROM input.subject_dog_id
          OR result.parent_dog_id IS DISTINCT FROM input.parent_dog_id
          OR result.relationship IS DISTINCT FROM input.relationship
     ) THEN
    RAISE EXCEPTION
      'authoritative pedigree compare-and-set did not update every verified null parent exactly once';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.authoritative_pedigree_apply_ledger_expected AS
SELECT ledger_id AS id,apply_import_run_id AS "importRunId",
  source_provider AS "sourceProvider",artifact_sha256 AS "artifactSha256",
  occurrence_id AS "assertionId",occurrence_id AS "winningAssertionId",
  subject_dog_id AS "dogId",NULL::text AS "existingParentDogId",
  parent_dog_id AS "proposedParentDogId",relationship,'accepted'::text AS decision,
  'verified-authoritative-compare-and-set'::text AS "reasonCode",
  source_authority AS "sourceAuthority",'verified'::text AS "verificationStatus",
  evidence_at AS "createdAt"
FROM _giq_history_stage.authoritative_pedigree_apply_input;

INSERT INTO public."PedigreeMergeLedger"
SELECT * FROM _giq_history_stage.authoritative_pedigree_apply_ledger_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_apply_ledger_expected expected
    LEFT JOIN public."PedigreeMergeLedger" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'authoritative pedigree apply ledger exact-ID retry detected payload drift';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_apply_input input
    LEFT JOIN _giq_history_stage.authoritative_pedigree_resolution resolution
      USING(occurrence_id)
    WHERE resolution.occurrence_id IS NULL
       OR resolution.disposition<>'applied_verified'
       OR resolution.canonical_write_eligible IS NOT FALSE
       OR resolution.existing_parent_dog_id IS DISTINCT FROM input.parent_dog_id
       OR resolution.authority_row_count IS DISTINCT FROM 1
       OR resolution.authority_parent_count IS DISTINCT FROM 1
       OR resolution.authority_parent_dog_id IS DISTINCT FROM input.parent_dog_id
       OR resolution.applied_authority IS NOT TRUE
       OR resolution.canonical_safety_blocking OR resolution.coverage_blocking
       OR resolution.hard_blocker_class IS NOT NULL
  ) OR EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE disposition='verified_apply_candidate' OR canonical_write_eligible
  ) THEN
    RAISE EXCEPTION
      'authoritative pedigree apply did not converge to one verified canonical winner per occurrence';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.galtd_merge_decision AS
SELECT
  a.payload,
  assertion.id AS assertion_id,
  assertion."importRunId" AS import_run_id,
  assertion."artifactSha256" AS artifact_sha256,
  x.child_id,
  CASE a.payload->>'relationship' WHEN 'sire' THEN x.sire_id ELSE x.dam_id END AS proposed_parent_id,
  CASE a.payload->>'relationship' WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END AS existing_parent_id,
  a.payload->>'relationship' AS relationship,
  CASE
    WHEN (CASE a.payload->>'relationship' WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END) IS NULL
      THEN 'accepted'
    WHEN (CASE a.payload->>'relationship' WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)=
         (CASE a.payload->>'relationship' WHEN 'sire' THEN x.sire_id ELSE x.dam_id END)
      THEN 'no_change'
    ELSE 'preserved_higher_authority'
  END AS decision,
  CASE
    WHEN (CASE a.payload->>'relationship' WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END) IS NULL
      THEN 'verified-by-exact-galtd-crosswalk'
    WHEN (CASE a.payload->>'relationship' WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)=
         (CASE a.payload->>'relationship' WHEN 'sire' THEN x.sire_id ELSE x.dam_id END)
      THEN 'verified-existing-by-galtd-crosswalk'
    ELSE 'higher-authority-production-conflict'
  END AS reason_code
FROM _giq_history_stage.galtd_assertion a
JOIN _giq_history_stage.galtd_pedigree_assertion_occurrence occurrence
  ON occurrence.payload->>'artifactSha256'=a.payload->>'artifactSha256'
 AND occurrence.payload->>'artifactOffsetLine'=a.payload->>'artifactOffsetLine'
 AND occurrence.payload->>'evidenceSha256'=a.payload->>'evidenceSha256'
 AND occurrence.payload->>'relationship'=a.payload->>'relationship'
 AND occurrence.payload->>'sourceId'=a.payload->>'sourceId'
JOIN _giq_history_stage.galtd_exact_crosswalk x
  ON x.galtd_source_id=a.payload->>'subjectSourceId' AND x.canonical_eligible
JOIN public."PedigreeAssertion" assertion
  ON assertion.id=occurrence.assertion_id
JOIN public."Dog" dog ON dog.id=x.child_id;

CREATE UNIQUE INDEX galtd_merge_decision_child_relationship_key
  ON _giq_history_stage.galtd_merge_decision(child_id,relationship);

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.galtd_merge_decision
    WHERE proposed_parent_id IS NULL OR proposed_parent_id=child_id
  ) THEN
    RAISE EXCEPTION 'exact GALTD crosswalk produced a null or self parent';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.galtd_source_identity
    WHERE crosswalk_eligible
  ) OR EXISTS(
    SELECT 1 FROM _giq_history_stage.galtd_merge_decision
  ) THEN
    RAISE EXCEPTION
      'GALTD descriptive composite evidence cannot mutate canonical Dog parent relationships';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.galtd_pedigree_merge_ledger_expected AS
SELECT
  _giq_history_merge.history_id('pedledger',concat_ws(':','galtd',
    marker.galtd_stage_manifest->'export'->>'runInstanceId',d.artifact_sha256,
    d.assertion_id,d.decision,d.child_id,d.relationship,
    coalesce(d.existing_parent_id,'none'),coalesce(d.proposed_parent_id,'none'))) AS id,
  d.import_run_id AS "importRunId",'galtd'::text AS "sourceProvider",
  d.artifact_sha256 AS "artifactSha256",d.assertion_id AS "assertionId",
  CASE WHEN d.decision IN ('accepted','no_change') THEN d.assertion_id END
    AS "winningAssertionId",
  d.child_id AS "dogId",d.existing_parent_id AS "existingParentDogId",
  d.proposed_parent_id AS "proposedParentDogId",d.relationship,d.decision,
  d.reason_code AS "reasonCode",100::integer AS "sourceAuthority",
  CASE WHEN d.decision IN ('accepted','no_change') THEN 'verified' ELSE 'conflict' END::text
    AS "verificationStatus",
  (marker.galtd_stage_manifest->'export'->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "createdAt"
FROM _giq_history_stage.galtd_merge_decision d
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id=1;

INSERT INTO public."PedigreeMergeLedger"
SELECT * FROM _giq_history_stage.galtd_pedigree_merge_ledger_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.galtd_pedigree_merge_ledger_expected expected
    LEFT JOIN public."PedigreeMergeLedger" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'GALTD merge-ledger exact-ID retry detected full-row payload drift';
  END IF;
END
$$;

-- Re-adjudicate TheDogs assertions only after exact GALTD links have been
-- applied. This preserves production as the highest authority, records exact
-- GALTD corroboration as the winning evidence, and leaves pending only where
-- the canonical parent is still genuinely null.
UPDATE _giq_history_stage.pedigree_merge_decision thedogs
SET decision='no_change',
    reason_code='verified-by-exact-galtd-crosswalk',
    existing_parent_id=galtd.proposed_parent_id,
    winning_assertion_id=galtd.assertion_id,
    winning_source_provider='galtd'
FROM _giq_history_stage.galtd_merge_decision galtd
WHERE thedogs.decision='pending_authoritative_verification'
  AND thedogs.duplicate_rank=1
  AND galtd.child_id=thedogs.child_id
  AND galtd.relationship=thedogs.relationship
  AND galtd.proposed_parent_id=thedogs.parent_id
  AND galtd.decision IN ('accepted','no_change');

UPDATE _giq_history_stage.pedigree_merge_decision thedogs
SET decision='preserved_higher_authority',
    reason_code='higher-authority-canonical-conflict',
    existing_parent_id=CASE thedogs.relationship
      WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END,
    winning_assertion_id=(
      SELECT galtd.assertion_id
      FROM _giq_history_stage.galtd_merge_decision galtd
      WHERE galtd.child_id=thedogs.child_id
        AND galtd.relationship=thedogs.relationship
        AND galtd.proposed_parent_id=CASE thedogs.relationship
          WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END
    ),
    winning_source_provider=CASE WHEN EXISTS(
      SELECT 1 FROM _giq_history_stage.galtd_merge_decision galtd
      WHERE galtd.child_id=thedogs.child_id
        AND galtd.relationship=thedogs.relationship
        AND galtd.proposed_parent_id=CASE thedogs.relationship
          WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END
    ) THEN 'galtd' END
FROM public."Dog" dog
WHERE thedogs.decision='pending_authoritative_verification'
  AND thedogs.duplicate_rank=1
  AND dog.id=thedogs.child_id
  AND (CASE thedogs.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END) IS NOT NULL
  AND (CASE thedogs.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)<>thedogs.parent_id;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.pedigree_merge_decision decision
    JOIN public."Dog" dog ON dog.id=decision.child_id
    WHERE decision.decision='pending_authoritative_verification'
      AND decision.duplicate_rank=1
      AND (CASE decision.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END) IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'post-GALTD pedigree adjudication left a populated canonical parent pending';
  END IF;
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.pedigree_merge_decision decision
    JOIN _giq_history_stage.galtd_merge_decision galtd
      ON galtd.child_id=decision.child_id
     AND galtd.relationship=decision.relationship
     AND galtd.proposed_parent_id=decision.parent_id
    WHERE decision.decision='pending_authoritative_verification'
      AND decision.duplicate_rank=1
      AND galtd.decision IN ('accepted','no_change')
  ) THEN
    RAISE EXCEPTION 'exact GALTD corroboration was not applied to a pending TheDogs assertion';
  END IF;
END
$$;

-- TheDogs assertions were staged before GALTD so every source observation was
-- preserved even when it was not yet authoritative. Reconcile only those
-- run-bound rows after the exact GALTD adjudication, then prove the staged and
-- canonical payloads remain identical.
UPDATE _giq_history_stage.thedogs_pedigree_assertion_expected expected
SET "verificationStatus"=CASE decision.decision
      WHEN 'no_change' THEN 'verified'
      WHEN 'preserved_higher_authority' THEN 'conflict'
      WHEN 'rejected_ambiguous' THEN 'rejected'
      ELSE 'parsed'
    END::text
FROM _giq_history_stage.thedogs_pedigree_assertion_occurrence occurrence
JOIN _giq_history_stage.pedigree_merge_decision decision
  ON decision.natural_key=occurrence.natural_key
WHERE expected.id=occurrence.assertion_id;

UPDATE public."PedigreeAssertion" assertion
SET "verificationStatus"=CASE decision.decision
      WHEN 'no_change' THEN 'verified'
      WHEN 'preserved_higher_authority' THEN 'conflict'
      WHEN 'rejected_ambiguous' THEN 'rejected'
      ELSE 'parsed'
    END::text
FROM _giq_history_stage.thedogs_pedigree_assertion_occurrence occurrence
JOIN _giq_history_stage.pedigree_merge_decision decision
  ON decision.natural_key=occurrence.natural_key
JOIN _giq_history_stage.thedogs_pedigree_assertion_expected expected
  ON expected.id=occurrence.assertion_id
WHERE assertion.id=expected.id
  AND assertion."importRunId"=expected."importRunId"
  AND assertion."artifactSha256"=expected."artifactSha256";

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.thedogs_pedigree_assertion_expected expected
    LEFT JOIN public."PedigreeAssertion" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'post-GALTD TheDogs assertion reconciliation detected full-row payload drift';
  END IF;
END
$$;

CREATE TABLE _giq_history_stage.thedogs_pedigree_merge_ledger_expected AS
SELECT
  _giq_history_merge.history_id('pedledger',concat_ws(':','thedogs',
    marker.export_stage_manifest->>'sourceRunInstanceId',assertion."artifactSha256",
    assertion.id,decision.decision,decision.child_id,decision.relationship,
    coalesce(decision.existing_parent_id,'none'),coalesce(decision.parent_id,'none'),
    coalesce(decision.winning_assertion_id,'none'))) AS id,
  assertion."importRunId",assertion."sourceProvider",assertion."artifactSha256",
  assertion.id AS "assertionId",decision.winning_assertion_id AS "winningAssertionId",
  decision.child_id AS "dogId",decision.existing_parent_id AS "existingParentDogId",
  CASE WHEN decision.self_parent THEN NULL ELSE decision.parent_id END
    AS "proposedParentDogId",
  decision.relationship,decision.decision,decision.reason_code AS "reasonCode",200::integer AS "sourceAuthority",
  CASE WHEN decision.decision='no_change' THEN 'verified'
       WHEN decision.decision='preserved_higher_authority' THEN 'conflict'
       ELSE 'rejected' END::text AS "verificationStatus",
  (marker.export_stage_manifest->>'sourceGeneratedAt')::timestamptz AT TIME ZONE 'UTC'
    AS "createdAt"
FROM _giq_history_stage.pedigree_merge_decision decision
JOIN _giq_history_stage.thedogs_pedigree_assertion_occurrence occurrence
  ON occurrence.natural_key=decision.natural_key
JOIN public."PedigreeAssertion" assertion ON assertion.id=occurrence.assertion_id
CROSS JOIN _giq_history_merge.run marker
WHERE marker.id=1 AND decision.decision='no_change';

INSERT INTO public."PedigreeMergeLedger"
SELECT * FROM _giq_history_stage.thedogs_pedigree_merge_ledger_expected
ON CONFLICT(id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.thedogs_pedigree_merge_ledger_expected expected
    LEFT JOIN public."PedigreeMergeLedger" canonical USING(id)
    WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(expected)
  ) THEN
    RAISE EXCEPTION 'TheDogs merge-ledger exact-ID retry detected full-row payload drift';
  END IF;
END
$$;

INSERT INTO _giq_history_merge.disposition
  (source_name,issue_type,source_key,disposition_code,canonical_entity_type,canonical_natural_key,evidence)
SELECT
  'normalized-export','pedigree-assertion',natural_key,
  CASE
    WHEN decision='accepted'
      THEN 'verified-authoritative-parent-applied'
    WHEN decision='pending_authoritative_verification'
      THEN 'pending-authoritative-verification-no-canonical-link'
    WHEN decision='no_change' AND winning_source_provider='galtd'
      THEN 'exact-galtd-corroborated-parent-linked'
    WHEN decision='no_change'
      THEN 'production-parent-preserved-and-source-observation-matches'
    WHEN decision='preserved_higher_authority'
      THEN 'higher-authority-parent-preserved-over-conflicting-source-observation'
    ELSE 'rejected-ambiguous-no-canonical-link' END,
  'Dog',child_id,
  jsonb_build_object('relationship',relationship,'proposedParentId',parent_id,
    'existingParentId',existing_parent_id,'decision',decision,'reasonCode',reason_code,
    'winningAssertionId',CASE WHEN decision='accepted' THEN occurrence_id
      ELSE winning_assertion_id END,
    'winningSourceProvider',winning_source_provider,
    'verificationStatus',CASE WHEN decision IN ('accepted','no_change') THEN 'verified'
      WHEN decision='preserved_higher_authority' THEN 'conflict'
      WHEN decision='rejected_ambiguous' THEN 'rejected' ELSE 'parsed' END)
FROM _giq_history_stage.pedigree_merge_decision
ON CONFLICT(source_name,issue_type,source_key) DO UPDATE
SET disposition_code=EXCLUDED.disposition_code,
    canonical_entity_type=EXCLUDED.canonical_entity_type,
    canonical_natural_key=EXCLUDED.canonical_natural_key,
    evidence=EXCLUDED.evidence,
    created_at=clock_timestamp();

DO $$
DECLARE
  table_name text;
  changed_or_missing_videos bigint;
  protected record;
  relation_oid oid;
  primary_key_order text;
  current_rows bigint;
  current_md5 text;
  protected_mismatches bigint:=0;
  protected_table_count bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
    'DogProfileForm','RaceVideo','DogProfileArchive','RaceDayArchive'
  ] LOOP
    EXECUTE format('DROP TRIGGER giq_history_authority_guard ON public.%I',table_name);
  END LOOP;

  SELECT count(*) INTO changed_or_missing_videos
  FROM _giq_history_merge.snapshot_race_video_proof proof
  LEFT JOIN public."RaceVideo" video ON video.id=proof.id
  WHERE video.id IS NULL OR encode(digest(to_jsonb(video)::text,'sha256'),'hex')<>proof.row_sha256;
  IF changed_or_missing_videos<>0 THEN
    RAISE EXCEPTION '% snapshot RaceVideo rows were changed or removed',changed_or_missing_videos;
  END IF;
  FOR protected IN
    SELECT * FROM _giq_history_merge.protected_table_manifest ORDER BY table_name
  LOOP
    SELECT c.oid INTO relation_oid
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=protected.table_name AND c.relkind IN ('r','p');
    IF relation_oid IS NULL THEN
      RAISE EXCEPTION 'protected table % disappeared during canonical merge',protected.table_name;
    END IF;
    SELECT 'jsonb_build_array(' || string_agg(format('t.%I',a.attname),
                      ', ' ORDER BY k.ordinality) || ')::text'
    INTO primary_key_order
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality)
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
    WHERE i.indrelid=relation_oid AND i.indisprimary;
    EXECUTE format(
      'SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY %s),'''')) FROM public.%I t',
      primary_key_order,protected.table_name
    ) INTO current_rows,current_md5;
    IF (current_rows,current_md5) IS DISTINCT FROM (protected.row_count,protected.row_md5) THEN
      protected_mismatches:=protected_mismatches+1;
    END IF;
  END LOOP;
  SELECT count(*) INTO protected_table_count
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND c.relname<>ALL(ARRAY[
      'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
      'DogProfileForm','RaceVideo','DogProfileArchive','RaceDayArchive',
      'PedigreeImportRun','DogSourceIdentity','PedigreeAssertion','PedigreeMergeLedger'
    ]::text[]);
  IF protected_mismatches<>0 OR protected_table_count<>
     (SELECT count(*) FROM _giq_history_merge.protected_table_manifest) THEN
    RAISE EXCEPTION 'non-allowlisted table proof failed: digest mismatches %, catalog count %',
      protected_mismatches,protected_table_count;
  END IF;
  -- The trigger already rejects every non-null overwrite. This aggregate proves
  -- all persisted update evidence has a SHA-256 before/after record.
  IF EXISTS (SELECT 1 FROM _giq_history_merge.production_row_update_audit
             WHERE before_sha256 !~ '^[0-9a-f]{64}$' OR after_sha256 !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'production update audit contains an invalid SHA-256';
  END IF;
END
$$;

UPDATE _giq_history_merge.canonical_table_delta d
SET after_rows=counts.rows,inserted_rows=counts.rows-d.before_rows
FROM (
  SELECT 'Track' AS table_name,count(*) AS rows FROM public."Track"
  UNION ALL SELECT 'Trainer',count(*) FROM public."Trainer"
  UNION ALL SELECT 'Dog',count(*) FROM public."Dog"
  UNION ALL SELECT 'Meeting',count(*) FROM public."Meeting"
  UNION ALL SELECT 'Race',count(*) FROM public."Race"
  UNION ALL SELECT 'Runner',count(*) FROM public."Runner"
  UNION ALL SELECT 'Result',count(*) FROM public."Result"
  UNION ALL SELECT 'FormEntry',count(*) FROM public."FormEntry"
  UNION ALL SELECT 'DogProfileForm',count(*) FROM public."DogProfileForm"
  UNION ALL SELECT 'RaceVideo',count(*) FROM public."RaceVideo"
  UNION ALL SELECT 'DogProfileArchive',count(*) FROM public."DogProfileArchive"
  UNION ALL SELECT 'RaceDayArchive',count(*) FROM public."RaceDayArchive"
  UNION ALL SELECT 'PedigreeImportRun',count(*) FROM public."PedigreeImportRun"
  UNION ALL SELECT 'DogSourceIdentity',count(*) FROM public."DogSourceIdentity"
  UNION ALL SELECT 'PedigreeAssertion',count(*) FROM public."PedigreeAssertion"
  UNION ALL SELECT 'PedigreeMergeLedger',count(*) FROM public."PedigreeMergeLedger"
) counts WHERE counts.table_name=d.table_name;

UPDATE _giq_history_merge.verification_check
SET metrics=metrics || jsonb_build_object(
  'assertionOccurrences',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence),
  'appliedVerified',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE disposition='applied_verified'),
  'verifiedNoChange',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_resolution
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
  'hardBlockers',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE hard_blocker_class IS NOT NULL),
  'canonicalWriteEligibleRemaining',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE canonical_write_eligible)
),verified_at=clock_timestamp()
WHERE check_name='thedogs_pedigree_partition';

UPDATE _giq_history_merge.verification_check
SET metrics=metrics || jsonb_build_object(
  'snapshotRaceVideosPreserved',true,
  'canonicalRaceVideosInserted',(SELECT inserted_rows FROM _giq_history_merge.canonical_table_delta WHERE table_name='RaceVideo')
),verified_at=clock_timestamp()
WHERE check_name='race_media_partition';

UPDATE _giq_history_merge.verification_check
SET metrics=metrics || jsonb_build_object(
  'nonNullOverwriteGuardInstalled',true,
  'preexistingNonNullValuesPreservedExceptReviewedCanonicalizations',true,
  'unauthorizedNonNullOverwrites',0,
  'reviewedCanonicalizationRows',(SELECT count(*) FROM _giq_history_merge.production_row_update_audit
    WHERE (table_name='Track' AND changed_fields && ARRAY['name','state']::text[])
       OR (table_name='Dog' AND changed_fields && ARRAY['earBrand','sireId','damId']::text[])),
  'nonAllowlistedTablesUnchanged',true,
  'protectedTableCount',(SELECT count(*) FROM _giq_history_merge.protected_table_manifest),
  'auditedExistingRowUpdates',(SELECT count(*) FROM _giq_history_merge.production_row_update_audit),
  'snapshotRaceVideosPreserved',true
),verified_at=clock_timestamp()
WHERE check_name='protected_production_baseline';

INSERT INTO _giq_history_merge.verification_check(check_name,metrics)
VALUES('canonical_merge_partition',jsonb_build_object(
  'candidateOnlyWrites',true,'sourceAccessModeDeclared','read-only inputs',
  'tables',(SELECT jsonb_object_agg(table_name,jsonb_build_object(
    'before',before_rows,'after',after_rows,'inserted',inserted_rows
  ) ORDER BY table_name) FROM _giq_history_merge.canonical_table_delta),
  'unauthorizedNonNullOverwrites',0,
  'reviewedCanonicalizationRows',(SELECT count(*) FROM _giq_history_merge.production_row_update_audit
    WHERE (table_name='Track' AND changed_fields && ARRAY['name','state']::text[])
       OR (table_name='Dog' AND changed_fields && ARRAY['earBrand','sireId','damId']::text[])),
  'snapshotRaceVideosChanged',0,
  'pedigreeAppliedVerified',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE disposition='applied_verified'),
  'pedigreeVerifiedNoChange',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE disposition='verified_no_change'),
  'pedigreeTerminalProofRows',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_terminal_proof_leaf),
  'pedigreeHardBlockers',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE hard_blocker_class IS NOT NULL),
  'pedigreeCanonicalWriteEligibleRemaining',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE canonical_write_eligible),
  'trackAliasesConsolidated',(SELECT count(*) FROM _giq_history_merge.track_alias_map),
  'trackAliasMeetingsRehomed',(SELECT coalesce(sum(meetings_rehomed),0) FROM _giq_history_merge.track_alias_map),
  'trackAliasFormEntriesRehomed',(SELECT coalesce(sum(form_entries_rehomed),0) FROM _giq_history_merge.track_alias_map)
))
ON CONFLICT(check_name) DO UPDATE SET metrics=EXCLUDED.metrics,verified_at=clock_timestamp();

UPDATE _giq_history_merge.run
SET phase='canonical_merged',canonical_merged_at=clock_timestamp(),
    canonical_merge_manifest=jsonb_build_object(
      'candidateOnlyWrites',true,'sourceAccessModeDeclared','read-only inputs',
      'tableDeltas',(SELECT jsonb_object_agg(table_name,to_jsonb(d)-'table_name')
                     FROM _giq_history_merge.canonical_table_delta d),
      'productionUpdateAuditRows',(SELECT count(*) FROM _giq_history_merge.production_row_update_audit),
      'snapshotRaceVideosPreserved',true,
      'pedigreeImportRuns',(SELECT count(*) FROM public."PedigreeImportRun"),
      'trackAliasConsolidation',jsonb_build_object(
        'aliases',(SELECT count(*) FROM _giq_history_merge.track_alias_map),
        'meetingsRehomed',(SELECT coalesce(sum(meetings_rehomed),0) FROM _giq_history_merge.track_alias_map),
        'formEntriesRehomed',(SELECT coalesce(sum(form_entries_rehomed),0) FROM _giq_history_merge.track_alias_map),
        'snapshotAliasKeysRetained',(SELECT count(*) FROM _giq_history_merge.snapshot_core_key snapshot
          JOIN _giq_history_merge.track_alias_map alias
            ON alias.source_alias_id=snapshot.primary_key_text
          WHERE snapshot.table_name='Track')
      ),
      'pedigreeAuthorityPartition',jsonb_build_object(
        'appliedVerified',(SELECT count(*)
          FROM _giq_history_stage.authoritative_pedigree_resolution
          WHERE disposition='applied_verified'),
        'verifiedNoChange',(SELECT count(*)
          FROM _giq_history_stage.authoritative_pedigree_resolution
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
        'hardBlockers',(SELECT count(*)
          FROM _giq_history_stage.authoritative_pedigree_resolution
          WHERE hard_blocker_class IS NOT NULL),
        'canonicalWriteEligibleRemaining',(SELECT count(*)
          FROM _giq_history_stage.authoritative_pedigree_resolution
          WHERE canonical_write_eligible)
      ),
      'galtdConflictGroupsQuarantined',(SELECT count(DISTINCT payload->>'conflictGroup')
        FROM _giq_history_stage.galtd_observation WHERE payload ? 'conflictGroup'),
      'galtdConflictObservationsQuarantined',(SELECT count(*)
        FROM _giq_history_stage.galtd_observation WHERE payload ? 'conflictGroup'),
      'replayProviderConflictIdsQuarantined',(SELECT count(DISTINCT provider_media_id)
        FROM _giq_history_stage.media_resolution
        WHERE disposition='quarantined-provider-id-race-conflict'),
      'replayProviderConflictRowsQuarantined',(SELECT count(*)
        FROM _giq_history_stage.media_resolution
        WHERE disposition='quarantined-provider-id-race-conflict'),
      'preexistingNonNullValuesPreservedExceptReviewedCanonicalizations',true,
      'unauthorizedNonNullOverwrites',0,
      'nonAllowlistedTablesUnchanged',true
    )
WHERE id=1;

COMMIT;

SELECT jsonb_build_object(
  'event','CANDIDATE_CANONICAL_MERGE_VERIFIED',
  'database',current_database(),'phase',phase,'manifest',canonical_merge_manifest
)
FROM _giq_history_merge.run WHERE id=1;
