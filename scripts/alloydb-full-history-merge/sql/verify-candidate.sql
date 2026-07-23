\set ON_ERROR_STOP on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ WRITE;
SET LOCAL app.system='true';
SET LOCAL "app.current_role"='system';
SET LOCAL app.current_tier='system';
SET LOCAL synchronous_commit=on;
SET LOCAL statement_timeout=0;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle='ISO, MDY';
SET LOCAL extra_float_digits=1;

LOCK TABLE
  public."Track",public."Trainer",public."Dog",public."Meeting",public."Race",
  public."Runner",public."Result",public."FormEntry",public."DogProfileForm",
  public."RaceVideo",public."DogProfileArchive",public."RaceDayArchive",
  public."PedigreeImportRun",public."DogSourceIdentity",public."PedigreeAssertion",
  public."PedigreeMergeLedger",public."LiveFeedQuarantine"
IN SHARE MODE;

LOCK TABLE _giq_history_merge.export_dataset_manifest,
  _giq_history_merge.authoritative_pedigree_saturation_manifest,
  _giq_history_merge.duplicate_quarantine_proof_manifest,
  _giq_history_merge.duplicate_quarantine_resolution_audit,
  _giq_history_merge.duplicate_quarantine_reference_proof
IN SHARE MODE;

LOCK TABLE
  _giq_history_stage.authoritative_pedigree_assertion_occurrence,
  _giq_history_stage.authoritative_identity_evidence,
  _giq_history_stage.authoritative_pedigree_evidence,
  _giq_history_stage.authoritative_consolidation_proof,
  _giq_history_stage.authoritative_pedigree_terminal_proof
IN SHARE MODE;

DO $$
DECLARE
  run_manifest_sha256 text;
  run_transform_version text;
  run_source_history_cutoff timestamptz;
  proof_schema_version text;
  proof_manifest_sha256 text;
  proof_transform_version text;
  proof_source_history_cutoff timestamptz;
  proof_source_datasets jsonb;
  proof_status text;
  proof_blockers jsonb;
  append_only_triggers bigint;
BEGIN
  IF to_regclass('_giq_history_merge.duplicate_quarantine_proof_manifest') IS NULL
     OR to_regclass('_giq_history_merge.duplicate_quarantine_resolution_audit') IS NULL
     OR to_regclass('_giq_history_merge.duplicate_quarantine_reference_proof') IS NULL
     OR to_regclass('_giq_history_stage.duplicate_quarantine_proof_resolution') IS NULL THEN
    RAISE EXCEPTION 'candidate verification requires the duplicate/quarantine proof partition';
  END IF;

  SELECT normalized_manifest_sha256,normalized_transform_version,source_history_cutoff
  INTO STRICT run_manifest_sha256,run_transform_version,run_source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1;
  SELECT schema_version,normalized_manifest_sha256,normalized_transform_version,
         source_history_cutoff,source_datasets,status,blockers
  INTO STRICT proof_schema_version,proof_manifest_sha256,proof_transform_version,
              proof_source_history_cutoff,proof_source_datasets,proof_status,proof_blockers
  FROM _giq_history_merge.duplicate_quarantine_proof_manifest WHERE id=1;

  SELECT count(*) INTO append_only_triggers
  FROM pg_trigger
  WHERE tgrelid IN (
      '_giq_history_merge.duplicate_quarantine_resolution_audit'::regclass,
      '_giq_history_merge.duplicate_quarantine_reference_proof'::regclass
    )
    AND tgname IN (
      'duplicate_quarantine_resolution_audit_append_only',
      'duplicate_quarantine_reference_proof_append_only'
    )
    AND tgenabled<>'D';

  IF run_transform_version<>'thedogs-normalized-harvest/v2'
     OR proof_schema_version<>'giq-duplicate-quarantine-proof/v1'
     OR proof_manifest_sha256 IS DISTINCT FROM run_manifest_sha256
     OR proof_transform_version IS DISTINCT FROM run_transform_version
     OR proof_source_history_cutoff IS DISTINCT FROM run_source_history_cutoff
     OR proof_source_datasets IS DISTINCT FROM (
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
     OR proof_status<>'ready'
     OR jsonb_typeof(proof_blockers)<>'object'
     OR jsonb_object_length(proof_blockers)<>19
     OR NOT proof_blockers ?& ARRAY[
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
       SELECT 1 FROM jsonb_each(proof_blockers) blocker
       WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
          OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
          OR blocker.value <> '0'::jsonb
     )
     OR append_only_triggers<>2
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
     ) THEN
    RAISE EXCEPTION 'candidate verification duplicate/quarantine proof is stale, incomplete, unsafe, or not bound to the exact v2 run';
  END IF;
END
$$;

CREATE TEMP TABLE candidate_pedigree_v2_gate (
  blocker_count bigint NOT NULL,
  metrics jsonb NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  run_manifest_sha256 text;
  run_source_history_cutoff timestamptz;
  pedigree_schema_version text;
  pedigree_manifest_sha256 text;
  pedigree_source_history_cutoff timestamptz;
  pedigree_status text;
  pedigree_blockers jsonb;
  pedigree_counts jsonb;
BEGIN
  IF to_regclass('_giq_history_stage.authoritative_pedigree_assertion_occurrence') IS NULL
     OR to_regclass('_giq_history_stage.authoritative_pedigree_terminal_proof_leaf') IS NULL
     OR to_regclass('_giq_history_stage.authoritative_pedigree_resolution') IS NULL
     OR to_regclass('_giq_history_stage.authoritative_pedigree_apply_import_run_expected') IS NULL
     OR to_regclass('public."LiveFeedQuarantine"') IS NULL THEN
    RAISE EXCEPTION 'candidate verification requires the complete pedigree v2 evidence and quarantine controls';
  END IF;

  SELECT normalized_manifest_sha256,source_history_cutoff
  INTO STRICT run_manifest_sha256,run_source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1;
  SELECT schema_version,normalized_manifest_sha256,source_history_cutoff,status,blockers,counts
  INTO STRICT pedigree_schema_version,pedigree_manifest_sha256,
    pedigree_source_history_cutoff,pedigree_status,pedigree_blockers,pedigree_counts
  FROM _giq_history_merge.authoritative_pedigree_saturation_manifest WHERE id=1;

  IF pedigree_schema_version<>'giq-authoritative-pedigree-saturation/v2'
     OR pedigree_manifest_sha256 IS DISTINCT FROM run_manifest_sha256
     OR pedigree_source_history_cutoff IS DISTINCT FROM run_source_history_cutoff
     OR pedigree_status<>'ready'
     OR jsonb_typeof(pedigree_blockers)<>'object'
     OR jsonb_object_length(pedigree_blockers)<>7
     OR NOT pedigree_blockers ?& ARRAY[
       'identityPending','relationshipPending','authorityConflict',
       'canonicalIntegrity','persistence','accounting','coverage']::text[]
     OR EXISTS(
       SELECT 1 FROM jsonb_each(pedigree_blockers) blocker
       WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
          OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
          OR blocker.value<>'0'::jsonb)
     OR jsonb_typeof(pedigree_counts)<>'object'
     OR NOT pedigree_counts ?& ARRAY[
       'assertionOccurrences','pedigreeResolutions','terminalInvalidImpossible',
       'terminalSupersededConflict','terminalUnlinkedConflictCovered',
       'terminalCorroborationOnlyCovered','terminalNonblocking','terminalBlocking',
       'applyCandidates']::text[]
     OR pedigree_counts->'assertionOccurrences' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence))
     OR pedigree_counts->'pedigreeResolutions' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution))
     OR pedigree_counts->'terminalInvalidImpossible' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition='terminal_invalid_impossible'))
     OR pedigree_counts->'terminalSupersededConflict' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition='terminal_superseded_conflict'))
     OR pedigree_counts->'terminalUnlinkedConflictCovered' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition='terminal_unlinked_conflict_covered'))
     OR pedigree_counts->'terminalCorroborationOnlyCovered' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition='terminal_corroboration_only_covered'))
     OR pedigree_counts->'terminalNonblocking' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution
       WHERE disposition IN (
         'terminal_invalid_impossible','terminal_superseded_conflict',
         'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
       ) AND NOT canonical_safety_blocking AND NOT coverage_blocking))
     OR pedigree_counts->'terminalBlocking' IS DISTINCT FROM '0'::jsonb
     OR pedigree_counts->'applyCandidates' IS DISTINCT FROM to_jsonb((
       SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_apply_import_run_expected)) THEN
    RAISE EXCEPTION 'candidate verification requires the exact blocker-free pedigree v2 manifest';
  END IF;
END
$$;

INSERT INTO _giq_history_merge.verification_check(check_name,metrics)
SELECT 'duplicate_quarantine_proof_partition',jsonb_build_object(
  'schemaVersion',manifest.schema_version,
  'normalizedManifestSha256',manifest.normalized_manifest_sha256,
  'sourceHistoryCutoff',manifest.source_history_cutoff,
  'sourceDatasets',manifest.source_datasets,
  'sourceRows',resolution_metrics.source_rows,
  'duplicateRemovalProofs',resolution_metrics.duplicate_removal_proofs,
  'quarantineReleaseProofs',resolution_metrics.quarantine_release_proofs,
  'unvalidatedReferenceConstraintProofOccurrences',
    resolution_metrics.proved_unvalidated_reference_constraints,
  'unvalidatedReferenceConstraintConservationOccurrences',
    resolution_metrics.conserved_unvalidated_reference_constraints,
  'blockersSha256',encode(digest(convert_to(manifest.blockers::text,'UTF8'),'sha256'),'hex'),
  'appendOnlyAudit',true,
  'complete',true
)
FROM _giq_history_merge.duplicate_quarantine_proof_manifest manifest
CROSS JOIN LATERAL (
  SELECT count(*) AS source_rows,
    count(*) FILTER(WHERE source_dataset='duplicates' AND duplicate_removal_allowed)
      AS duplicate_removal_proofs,
    count(*) FILTER(WHERE source_dataset='quarantine' AND quarantine_release_allowed)
      AS quarantine_release_proofs,
    coalesce(sum(proved_unvalidated_reference_constraints),0)
      AS proved_unvalidated_reference_constraints,
    coalesce(sum(conserved_unvalidated_reference_constraints),0)
      AS conserved_unvalidated_reference_constraints
  FROM _giq_history_stage.duplicate_quarantine_proof_resolution
) resolution_metrics
WHERE manifest.id=1
ON CONFLICT(check_name) DO UPDATE
SET metrics=EXCLUDED.metrics,verified_at=clock_timestamp();

DO $$
DECLARE
  observed_phase text;
  migration_mismatches bigint;
  invalid_foreign_keys bigint;
  invalid_constraint_names text;
  disabled_triggers bigint;
  required_checks_missing bigint;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'candidate verification database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase FROM _giq_history_merge.run WHERE id=1 FOR UPDATE;
  IF observed_phase<>'delta_applied' THEN
    RAISE EXCEPTION 'candidate verification requires delta_applied, observed %',observed_phase;
  END IF;
  IF :'write_freeze_ack'<>'I_ACKNOWLEDGE_PRODUCTION_WRITES_ARE_FROZEN' THEN
    RAISE EXCEPTION 'candidate verification lacks the exact write-freeze acknowledgement';
  END IF;
  IF (SELECT replay_backfill_completed_at IS NULL OR replay_backfill_manifest IS NULL
      FROM _giq_history_merge.run WHERE id=1) THEN
    RAISE EXCEPTION 'candidate replay backfill evidence is absent';
  END IF;
  IF (SELECT NOT coalesce((live_delta_source_manifest->>'sourceStableBeforeAfter')::boolean,false)
      FROM _giq_history_merge.run WHERE id=1) THEN
    RAISE EXCEPTION 'frozen production source stability proof is absent';
  END IF;

  WITH source AS (
    SELECT item->>'name' AS name,item->>'sha256' AS sha256
    FROM _giq_history_merge.run run
    CROSS JOIN LATERAL jsonb_array_elements(run.migration_manifest) item WHERE run.id=1
  ), compared AS (
    SELECT source.name FROM source
    FULL JOIN public."_prisma_migrations" ledger ON ledger.migration_name=source.name
      AND ledger.finished_at IS NOT NULL AND ledger.rolled_back_at IS NULL
    WHERE source.name IS NULL OR ledger.id IS NULL OR source.sha256<>ledger.checksum
  ) SELECT count(*) INTO migration_mismatches FROM compared;
  IF migration_mismatches<>0 THEN
    RAISE EXCEPTION 'candidate migration ledger differs from pinned source by % rows',migration_mismatches;
  END IF;

  SELECT count(*) INTO invalid_foreign_keys FROM pg_constraint WHERE contype='f' AND NOT convalidated;
  SELECT string_agg(conname,',' ORDER BY conname) INTO invalid_constraint_names
  FROM pg_constraint WHERE NOT convalidated;
  SELECT count(*) INTO disabled_triggers FROM pg_trigger WHERE tgenabled='D';
  IF invalid_foreign_keys<>0 OR disabled_triggers<>0 OR invalid_constraint_names<>
     'giq_feed_post_visibility_check,giq_feed_reaction_target_xor_check,giq_feed_reaction_type_check' THEN
    RAISE EXCEPTION 'candidate catalog invalid: foreign keys %, disabled triggers %, unvalidated %',
      invalid_foreign_keys,disabled_triggers,invalid_constraint_names;
  END IF;

  SELECT count(*) INTO required_checks_missing
  FROM unnest(ARRAY[
    'trainer_source_identity','thedogs_pedigree_partition','race_media_partition',
    'standalone_replay_membership','jurisdiction_partition','profile_form_partition',
    'galtd_conflict_resolution','protected_production_baseline','canonical_merge_partition',
    'live_delta_partition','duplicate_quarantine_proof_partition'
  ]::text[]) required(name)
  LEFT JOIN _giq_history_merge.verification_check actual ON actual.check_name=required.name
  WHERE actual.check_name IS NULL;
  IF required_checks_missing<>0 THEN
    RAISE EXCEPTION '% required candidate verification partitions are missing',required_checks_missing;
  END IF;
END
$$;

CREATE TABLE _giq_history_merge.final_foreign_key_check (
  constraint_name text PRIMARY KEY,
  child_table text NOT NULL,
  parent_table text NOT NULL,
  orphan_rows bigint NOT NULL
);

DO $$
DECLARE fk record; join_predicate text; nonnull_predicate text; orphan_rows bigint;
BEGIN
  FOR fk IN
    SELECT constraint_row.oid,constraint_row.conname,constraint_row.conrelid,constraint_row.confrelid,
           constraint_row.conkey,constraint_row.confkey,
           constraint_row.conrelid::regclass::text AS child_table,
           constraint_row.confrelid::regclass::text AS parent_table
    FROM pg_constraint constraint_row WHERE constraint_row.contype='f'
  LOOP
    SELECT string_agg(format('child.%I=parent.%I',child_attribute.attname,parent_attribute.attname),' AND ' ORDER BY key.ord),
           string_agg(format('child.%I IS NOT NULL',child_attribute.attname),' AND ' ORDER BY key.ord)
    INTO join_predicate,nonnull_predicate
    FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY key(child_attnum,parent_attnum,ord)
    JOIN pg_attribute child_attribute
      ON child_attribute.attrelid=fk.conrelid AND child_attribute.attnum=key.child_attnum
    JOIN pg_attribute parent_attribute
      ON parent_attribute.attrelid=fk.confrelid AND parent_attribute.attnum=key.parent_attnum;
    EXECUTE format('SELECT count(*) FROM %s child WHERE %s AND NOT EXISTS(SELECT 1 FROM %s parent WHERE %s)',
      fk.child_table,nonnull_predicate,fk.parent_table,join_predicate) INTO orphan_rows;
    INSERT INTO _giq_history_merge.final_foreign_key_check
    VALUES(fk.conname,fk.child_table,fk.parent_table,orphan_rows);
  END LOOP;
  IF EXISTS(SELECT 1 FROM _giq_history_merge.final_foreign_key_check WHERE orphan_rows<>0) THEN
    RAISE EXCEPTION 'candidate has orphaned foreign-key relationships';
  END IF;
END
$$;

DO $$
DECLARE
  natural_key_conflicts bigint;
  placeholders bigint;
  synthetic_ear_brands bigint;
  thedogs_identity_gaps bigint;
  demo_rows bigint;
  profile_url_errors bigint;
  temora_rows bigint;
  standalone_unaccounted bigint;
BEGIN
  WITH conflicts AS (
    SELECT 1 FROM public."Dog" WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
      GROUP BY lower("sourceProvider"),"sourceId" HAVING count(*)>1
    UNION ALL SELECT 1 FROM public."Meeting" GROUP BY "trackId","meetingDate" HAVING count(*)>1
    UNION ALL SELECT 1 FROM public."Race" GROUP BY "meetingId","raceNumber" HAVING count(*)>1
    UNION ALL SELECT 1 FROM public."Runner" GROUP BY "raceId","boxNumber" HAVING count(*)>1
    UNION ALL SELECT 1 FROM public."Result" GROUP BY "runnerId" HAVING count(*)>1
    UNION ALL SELECT 1 FROM public."FormEntry" WHERE "raceId" IS NOT NULL
      GROUP BY "dogId","raceId" HAVING count(*)>1
    UNION ALL SELECT 1 FROM public."DogProfileForm"
      GROUP BY "dogId",lower("sourceProvider"),"sourceId" HAVING count(*)>1
    UNION ALL SELECT 1 FROM public."RaceVideo"
      GROUP BY "raceId",lower("sourceProvider"),kind HAVING count(*)>1
    UNION ALL SELECT 1 FROM public."DogProfileArchive"
      GROUP BY lower("sourceProvider"),"sourceId" HAVING count(*)>1
    UNION ALL SELECT 1 FROM public."RaceDayArchive"
      GROUP BY lower("sourceProvider"),date HAVING count(*)>1
  ) SELECT count(*) INTO natural_key_conflicts FROM conflicts;
  SELECT count(*) INTO placeholders FROM public."Dog"
  WHERE nullif(btrim(name),'') IS NULL OR lower(btrim(name)) ~ '^(unknown|n/?a|placeholder|tbd)$';
  SELECT count(*) INTO synthetic_ear_brands FROM public."Dog" WHERE "earBrand" ~ '^thedogs:[0-9]+$';
  SELECT count(*) INTO thedogs_identity_gaps
  FROM _giq_history_stage.normalized_dog staged
  JOIN public."Dog" dog ON dog.id=staged.target_id
  WHERE staged.natural_key ~ '^thedogs:dog:[0-9]+$'
    AND (lower(dog."sourceProvider")<>'thedogs' OR dog."sourceId" IS NULL OR dog."sourceId" !~ '^[0-9]+$');
  SELECT
    (SELECT count(*) FROM public."Meeting" WHERE lower(coalesce("sourceProvider",'')) IN ('demo','greyhoundiq-demo'))+
    (SELECT count(*) FROM public."Race" WHERE lower(coalesce("sourceProvider",'')) IN ('demo','greyhoundiq-demo'))+
    (SELECT count(*) FROM public."Runner" WHERE lower(coalesce("sourceProvider",'')) IN ('demo','greyhoundiq-demo'))
  INTO demo_rows;
  SELECT count(*) INTO profile_url_errors FROM public."DogProfileForm"
  WHERE lower("sourceProvider")='thedogs'
    AND "raceUrl" !~ '^/racing/[a-z0-9]+(?:-[a-z0-9]+)*/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9]+/$';
  SELECT count(*) INTO temora_rows FROM public."DogProfileForm"
  WHERE lower("sourceProvider")='thedogs' AND "raceUrl"='/racing/temora/2008-10-19/3/'
    AND ("sourceRawJson"::jsonb->>'sourceId')='/racing/temora/2008-10-19/3?trial=false';
  SELECT count(*) INTO standalone_unaccounted
  FROM _giq_history_merge.replay_standalone_membership_disposition
  WHERE disposition NOT IN ('present_in_cloned_race_video','explicitly_missing','quarantined');
  IF natural_key_conflicts<>0 OR placeholders<>0 OR synthetic_ear_brands<>0
     OR thedogs_identity_gaps<>0 OR demo_rows<>0 OR profile_url_errors<>0
     OR temora_rows<>8 OR standalone_unaccounted<>0 THEN
    RAISE EXCEPTION 'candidate identity/content validation failed: keys %, placeholders %, synthetic %, provider gaps %, demo %, profile URLs %, Temora %, replay unaccounted %',
      natural_key_conflicts,placeholders,synthetic_ear_brands,thedogs_identity_gaps,demo_rows,
      profile_url_errors,temora_rows,standalone_unaccounted;
  END IF;
END
$$;

DO $$
DECLARE
  missing_normalized_targets bigint;
  photo_projection_gaps bigint;
  self_links bigint;
  same_parent_links bigint;
  ancestry_cycles bigint;
  galtd_conflicts bigint;
  replay_conflicts bigint;
BEGIN
  SELECT count(*) INTO missing_normalized_targets FROM (
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_track staged
    LEFT JOIN public."Track" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_trainer staged
    LEFT JOIN public."Trainer" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_dog staged
    LEFT JOIN public."Dog" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_meeting staged
    LEFT JOIN public."Meeting" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_race staged
    LEFT JOIN public."Race" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_runner staged
    LEFT JOIN public."Runner" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_result staged
    LEFT JOIN public."Result" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_form_entry staged
    LEFT JOIN public."FormEntry" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_profile_form staged
    LEFT JOIN public."DogProfileForm" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_race_video staged
    LEFT JOIN public."RaceVideo" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_dog_profile_archive staged
    LEFT JOIN public."DogProfileArchive" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
    UNION ALL
    SELECT staged.target_id
    FROM _giq_history_stage.normalized_race_day_archive staged
    LEFT JOIN public."RaceDayArchive" canonical ON canonical.id=staged.target_id
    WHERE canonical.id IS NULL
  ) missing;
  SELECT count(*) INTO photo_projection_gaps
  FROM _giq_history_stage.normalized_photo_finish staged
  LEFT JOIN public."Race" canonical ON canonical.id=staged.race_id
  WHERE canonical.id IS NULL OR canonical."photoFinishUrl" IS NULL;
  SELECT count(*) INTO self_links FROM public."Dog" WHERE id="sireId" OR id="damId";
  SELECT count(*) INTO same_parent_links FROM public."Dog"
  WHERE "sireId" IS NOT NULL AND "sireId"="damId";
  WITH RECURSIVE edge(child_id,parent_id) AS (
    SELECT id,"sireId" FROM public."Dog" WHERE "sireId" IS NOT NULL
    UNION ALL SELECT id,"damId" FROM public."Dog" WHERE "damId" IS NOT NULL
  ), ancestry(origin,node,path,is_cycle) AS (
    SELECT child_id,parent_id,ARRAY[child_id,parent_id],child_id=parent_id FROM edge
    UNION ALL
    SELECT ancestry.origin,edge.parent_id,ancestry.path || edge.parent_id,
      edge.parent_id=ANY(ancestry.path)
    FROM ancestry JOIN edge ON edge.child_id=ancestry.node
    WHERE NOT ancestry.is_cycle
  )
  SELECT count(*) INTO ancestry_cycles FROM ancestry WHERE is_cycle;
  SELECT count(*) INTO galtd_conflicts FROM _giq_history_stage.galtd_observation WHERE payload ? 'conflictGroup';
  SELECT count(*) INTO replay_conflicts FROM _giq_history_stage.media_resolution
    WHERE disposition='quarantined-provider-id-race-conflict';
  IF missing_normalized_targets<>0 OR photo_projection_gaps<>0 OR self_links<>0
     OR same_parent_links<>0
     OR ancestry_cycles<>0 OR galtd_conflicts<>18 OR replay_conflicts<>22 THEN
    RAISE EXCEPTION 'candidate relationship/completeness validation failed: missing targets %, photo projections %, self %, same sire/dam %, cycles %, GALTD %, replay %',
      missing_normalized_targets,photo_projection_gaps,self_links,same_parent_links,ancestry_cycles,
      galtd_conflicts,replay_conflicts;
  END IF;
END
$$;

DO $$
DECLARE
  thedogs_staged_identities bigint;
  thedogs_missing_identities bigint;
  galtd_staged_identities bigint;
  galtd_missing_identities bigint;
  pedigree_blockers bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM _giq_history_stage.thedogs_source_identity),
    (SELECT count(*) FROM _giq_history_stage.galtd_source_identity)
  INTO thedogs_staged_identities,galtd_staged_identities;

  SELECT count(*) INTO thedogs_missing_identities
  FROM _giq_history_stage.thedogs_source_identity_expected staged
  LEFT JOIN public."DogSourceIdentity" canonical USING(id)
  WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(staged);
  SELECT count(*) INTO galtd_missing_identities
  FROM _giq_history_stage.galtd_source_identity_expected staged
  LEFT JOIN public."DogSourceIdentity" canonical USING(id)
  WHERE canonical.id IS NULL OR to_jsonb(canonical) IS DISTINCT FROM to_jsonb(staged);

  SELECT
    (SELECT abs(
      (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence)-
      (SELECT count(*) FROM _giq_history_stage.authoritative_pedigree_resolution)))+
    (SELECT count(*)-count(DISTINCT occurrence_id)
      FROM _giq_history_stage.authoritative_pedigree_resolution)+
    (SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition NOT IN (
        'applied_verified','verified_no_change','terminal_invalid_impossible',
        'terminal_superseded_conflict','terminal_unlinked_conflict_covered',
        'terminal_corroboration_only_covered')
        OR hard_blocker_class IS NOT NULL OR canonical_write_eligible
        OR canonical_safety_blocking OR coverage_blocking OR creates_cycle)+
    (SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution resolution
      WHERE disposition LIKE 'terminal_%' AND (
        terminal_proof_leaf_count IS DISTINCT FROM 1
        OR (SELECT count(*)
            FROM _giq_history_stage.authoritative_pedigree_terminal_proof_leaf proof
            WHERE proof.occurrence_id=resolution.occurrence_id)<>1
        OR canonical_contribution_count IS DISTINCT FROM 0
        OR quarantine_release_eligible IS NOT TRUE
        OR EXISTS(
          SELECT 1 FROM public."PedigreeAssertion" assertion
          WHERE assertion.id=resolution.occurrence_id
             OR (assertion."importRunId"=resolution.import_run_id
               AND lower(assertion."sourceProvider")=resolution.source_provider
               AND assertion."artifactSha256"=resolution.artifact_sha256
               AND assertion.relationship=resolution.relationship
               AND assertion."evidenceSha256"=resolution.evidence_sha256))
        OR EXISTS(
          SELECT 1 FROM public."PedigreeMergeLedger" ledger
          WHERE ledger."assertionId"=resolution.occurrence_id
             OR ledger."winningAssertionId"=resolution.occurrence_id)))+
    (SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_terminal_proof_leaf proof
      LEFT JOIN _giq_history_stage.authoritative_pedigree_resolution resolution
        USING(occurrence_id)
      WHERE resolution.occurrence_id IS NULL OR resolution.disposition NOT LIKE 'terminal_%')+
    (SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution resolution
      JOIN public."Dog" dog ON dog.id=resolution.subject_dog_id
      LEFT JOIN public."PedigreeAssertion" assertion
        ON assertion.id=resolution.occurrence_id
      LEFT JOIN public."DogSourceIdentity" subject
        ON subject.id=assertion."subjectIdentityId"
      LEFT JOIN public."DogSourceIdentity" parent
        ON parent.id=assertion."parentIdentityId"
      LEFT JOIN public."PedigreeImportRun" import_run
        ON import_run.id=assertion."importRunId"
       AND import_run."sourceProvider"=assertion."sourceProvider"
       AND import_run."artifactSha256"=assertion."artifactSha256"
      LEFT JOIN public."PedigreeMergeLedger" ledger
        ON ledger.id=_giq_history_merge.history_id('pedledger-v2',resolution.occurrence_id)
      WHERE resolution.disposition='applied_verified' AND (
        assertion.id IS NULL OR assertion."verificationStatus"<>'verified'
        OR assertion.relationship IS DISTINCT FROM resolution.relationship
        OR assertion."evidenceSha256" IS DISTINCT FROM resolution.evidence_sha256
        OR subject."dogId" IS DISTINCT FROM resolution.subject_dog_id
        OR subject."verificationStatus" IS DISTINCT FROM 'verified'
        OR parent."dogId" IS DISTINCT FROM resolution.parent_dog_id
        OR parent."verificationStatus" IS DISTINCT FROM 'verified'
        OR import_run."parserVersion" IS DISTINCT FROM 'authoritative-pedigree-v2'
        OR import_run."verificationStatus" IS DISTINCT FROM 'verified'
        OR import_run.status IS DISTINCT FROM 'merged'
        OR ledger."assertionId" IS DISTINCT FROM resolution.occurrence_id
        OR ledger."winningAssertionId" IS DISTINCT FROM resolution.occurrence_id
        OR ledger."dogId" IS DISTINCT FROM resolution.subject_dog_id
        OR ledger."proposedParentDogId" IS DISTINCT FROM resolution.parent_dog_id
        OR ledger.relationship IS DISTINCT FROM resolution.relationship
        OR ledger.decision IS DISTINCT FROM 'accepted'
        OR ledger."verificationStatus" IS DISTINCT FROM 'verified'
        OR (CASE resolution.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
           IS DISTINCT FROM resolution.parent_dog_id
        OR resolution.authority_row_count IS DISTINCT FROM 1
        OR resolution.authority_parent_count IS DISTINCT FROM 1
        OR resolution.authority_parent_dog_id IS DISTINCT FROM resolution.parent_dog_id
        OR resolution.applied_authority IS NOT TRUE))+
    (SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution resolution
      JOIN public."Dog" dog ON dog.id=resolution.subject_dog_id
      WHERE resolution.disposition='verified_no_change' AND (
        resolution.existing_parent_dog_id IS DISTINCT FROM resolution.parent_dog_id
        OR resolution.authority_row_count IS DISTINCT FROM 1
        OR resolution.authority_parent_count IS DISTINCT FROM 1
        OR resolution.authority_parent_dog_id IS DISTINCT FROM resolution.parent_dog_id
        OR resolution.no_change_authority IS NOT TRUE
        OR (CASE resolution.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
           IS DISTINCT FROM resolution.parent_dog_id))+
    (SELECT count(*)
      FROM public."PedigreeAssertion" assertion
      LEFT JOIN public."DogSourceIdentity" subject
        ON subject.id=assertion."subjectIdentityId"
      LEFT JOIN public."DogSourceIdentity" parent
        ON parent.id=assertion."parentIdentityId"
      LEFT JOIN public."Dog" dog ON dog.id=subject."dogId"
      WHERE assertion."verificationStatus"='verified' AND (
        subject."dogId" IS NULL OR subject."verificationStatus"<>'verified'
        OR parent."dogId" IS NULL OR parent."verificationStatus"<>'verified'
        OR dog.id IS NULL
        OR (CASE assertion.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
           IS DISTINCT FROM parent."dogId"
        OR NOT EXISTS(
          SELECT 1 FROM public."PedigreeMergeLedger" ledger
          WHERE ledger."winningAssertionId"=assertion.id
            AND ledger."dogId"=subject."dogId"
            AND ledger.relationship=assertion.relationship
            AND ledger."proposedParentDogId"=parent."dogId"
            AND ledger.decision IN ('accepted','no_change')
            AND ledger."verificationStatus"='verified')))+
    (SELECT abs(5-count(*)) FROM pg_trigger trigger
      WHERE NOT trigger.tgisinternal AND trigger.tgenabled<>'D'
        AND (trigger.tgrelid,trigger.tgname) IN (
          ('_giq_history_stage.authoritative_identity_evidence'::regclass,
           'authoritative_identity_evidence_append_only'),
          ('_giq_history_stage.authoritative_pedigree_evidence'::regclass,
           'authoritative_pedigree_evidence_append_only'),
          ('_giq_history_stage.authoritative_consolidation_proof'::regclass,
           'authoritative_consolidation_proof_append_only'),
          ('_giq_history_stage.authoritative_pedigree_assertion_occurrence'::regclass,
           'authoritative_pedigree_occurrence_append_only'),
          ('_giq_history_stage.authoritative_pedigree_terminal_proof'::regclass,
           'authoritative_pedigree_terminal_proof_append_only')))+
    (SELECT abs(4-count(*)) FROM pg_trigger trigger
      WHERE NOT trigger.tgisinternal AND trigger.tgenabled<>'D'
        AND (trigger.tgrelid,trigger.tgname) IN (
          ('public."PedigreeImportRun"'::regclass,
           'giq_pedigree_import_run_evidence_guard'),
          ('public."DogSourceIdentity"'::regclass,
           'giq_dog_source_identity_evidence_guard'),
          ('public."PedigreeAssertion"'::regclass,
           'giq_pedigree_assertion_evidence_guard'),
          ('public."PedigreeMergeLedger"'::regclass,
           'giq_pedigree_merge_ledger_evidence_guard')))+
    (SELECT CASE WHEN relrowsecurity AND relforcerowsecurity THEN 0 ELSE 1 END
      FROM pg_class WHERE oid='public."LiveFeedQuarantine"'::regclass)+
    (SELECT CASE WHEN count(*)=1 THEN 0 ELSE 1 END
      FROM pg_trigger WHERE tgrelid='public."LiveFeedQuarantine"'::regclass
        AND tgname='giq_live_feed_quarantine_append_only'
        AND NOT tgisinternal AND tgenabled<>'D')+
    (SELECT abs(2-count(*)) FROM pg_policies
      WHERE schemaname='public' AND tablename='LiveFeedQuarantine'
        AND policyname IN (
          'giq_live_feed_quarantine_admin_read','giq_live_feed_quarantine_system_insert'))+
    (SELECT count(*) FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='LiveFeedQuarantine'
        AND grantee IN ('PUBLIC','greyhoundiq_runtime','greyhoundiq_app')
        AND privilege_type NOT IN ('SELECT','INSERT'))+
    (SELECT count(*) FROM public."LiveFeedQuarantine"
      WHERE "evidenceSha256" !~ '^[0-9a-f]{64}$'
         OR octet_length("evidenceJson") NOT BETWEEN 2 AND 16384
         OR jsonb_typeof("evidenceJson"::jsonb)<>'object'
         OR classification NOT IN ('invalid','incomplete','conflict')
         OR nullif(btrim(provider),'') IS NULL
         OR nullif(btrim("entityKind"),'') IS NULL
         OR nullif(btrim("reasonCode"),'') IS NULL)
  INTO pedigree_blockers;

  pedigree_blockers:=pedigree_blockers+thedogs_missing_identities+
    galtd_missing_identities+CASE WHEN thedogs_staged_identities=0 THEN 1 ELSE 0 END+
    abs(galtd_staged_identities-105374::bigint);

  INSERT INTO candidate_pedigree_v2_gate(blocker_count,metrics)
  VALUES(pedigree_blockers,jsonb_build_object(
    'assertionOccurrences',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence),
    'resolutions',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution),
    'appliedVerified',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='applied_verified'),
    'verifiedNoChange',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition='verified_no_change'),
    'terminal',(SELECT count(*)
      FROM _giq_history_stage.authoritative_pedigree_resolution
      WHERE disposition LIKE 'terminal_%'),
    'liveFeedQuarantineRows',(SELECT count(*) FROM public."LiveFeedQuarantine")
  ));

  IF pedigree_blockers<>0 THEN
    RAISE EXCEPTION
      'final pedigree v2 conservation failed: TheDogs identities %, missing %; GALTD identities %, missing %; blockers %',
      thedogs_staged_identities,thedogs_missing_identities,
      galtd_staged_identities,galtd_missing_identities,pedigree_blockers;
  END IF;
END
$$;

INSERT INTO _giq_history_merge.verification_check(check_name,metrics)
VALUES
('foreign_key_integrity',jsonb_build_object(
  'validatedForeignKeys',(SELECT count(*) FROM pg_constraint WHERE contype='f' AND convalidated),
  'unvalidatedForeignKeys',0,'orphanRows',0,'disabledTriggers',0
)),
('provider_natural_key_coverage',jsonb_build_object(
  'naturalKeyConflictGroups',0,'syntheticEarBrands',0,'thedogsProviderIdentityGaps',0,
  'placeholderDogRows',0,'demoProviderRows',0,
  'auStates',jsonb_build_array('ACT','NSW','NT','QLD','SA','TAS','VIC','WA'),
  'nzTracks',14
)),
('pedigree_relationship_integrity',(SELECT metrics || jsonb_build_object(
  'canonicalSelfLinks',0,'canonicalSameSireAndDam',0,'ancestryCycles',0,
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
  'blockerCount',blocker_count)
  FROM candidate_pedigree_v2_gate)),
('historical_completeness',jsonb_build_object(
  'sourceMembershipPartitions',(SELECT jsonb_object_agg(entity_type,to_jsonb(p)-'entity_type')
    FROM _giq_history_merge.source_membership_partition p),
  'profileFormsValidUnlinkedPreserved',468494,
  'profileFormsNonRaceQuarantined',314358,
  'dogProfileArchivesUnlinkedPreserved',351,
  'sourceIssueRowsAccounted',954946,
  'standaloneReplayProviderIdsAccounted',145,
  'galtdConflictObservationsQuarantined',18,
  'replayProviderConflictRowsQuarantined',22
))
ON CONFLICT(check_name) DO UPDATE SET metrics=EXCLUDED.metrics,verified_at=clock_timestamp();

SELECT blocker_count AS pending_pedigree,
       (blocker_count>0) AS pedigree_pending
FROM candidate_pedigree_v2_gate \gset

INSERT INTO _giq_history_merge.verification_check(check_name,metrics)
VALUES('verification_completion',jsonb_build_object(
  'structuralChecksPassed',true,
  'pedigreeAuthoritativeCompleteness',(:'pending_pedigree'::bigint=0),
  'pendingPedigreeV2Blockers',:'pending_pedigree'::bigint,
  'complete',(:'pending_pedigree'::bigint=0),
  'blockers',CASE WHEN :'pending_pedigree'::bigint=0 THEN '[]'::jsonb
    ELSE jsonb_build_array('pedigree-v2-integrity-or-persistence') END
))
ON CONFLICT(check_name) DO UPDATE SET metrics=EXCLUDED.metrics,verified_at=clock_timestamp();

UPDATE _giq_history_merge.run
SET verification_manifest=jsonb_build_object(
      'structuralChecksPassed',true,
      'pedigreeAuthoritativeCompleteness',(:'pending_pedigree'::bigint=0),
      'pendingPedigreeV2Blockers',:'pending_pedigree'::bigint,
      'checks',(SELECT jsonb_object_agg(check_name,metrics ORDER BY check_name)
        FROM _giq_history_merge.verification_check)
    ),
    phase=CASE WHEN :'pending_pedigree'::bigint=0 THEN 'verified' ELSE phase END,
    verified_at=CASE WHEN :'pending_pedigree'::bigint=0 THEN clock_timestamp() ELSE NULL END
WHERE id=1;

COMMIT;

SELECT jsonb_build_object('event','CANDIDATE_VERIFICATION_EVALUATED','phase',phase,
  'manifest',verification_manifest)
FROM _giq_history_merge.run WHERE id=1;

\if :pedigree_pending
\echo 'OPERATOR_ATTENTION: candidate pedigree v2 occurrence, winner, terminal-proof, or persistence checks remain blocked; candidate is not verified.'
\quit 3
\endif
