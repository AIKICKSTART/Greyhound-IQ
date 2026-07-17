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
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'duplicate/quarantine proof database mismatch';
  END IF;

  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id=1 FOR UPDATE;
  IF observed_phase<>'normalized' THEN
    RAISE EXCEPTION 'duplicate/quarantine proof requires normalized, observed %',observed_phase;
  END IF;

  IF (SELECT count(*) FROM _giq_history_merge.export_dataset_manifest
      WHERE dataset IN ('duplicates','quarantine'))<>2
     OR EXISTS(
       SELECT 1 FROM _giq_history_merge.export_dataset_manifest
       WHERE dataset IN ('duplicates','quarantine')
         AND (observed_rows IS DISTINCT FROM expected_rows OR staged_at IS NULL)
     ) THEN
    RAISE EXCEPTION 'duplicate/quarantine proof requires verified source datasets';
  END IF;

  IF to_regclass('_giq_history_stage.export_duplicates') IS NULL
     OR to_regclass('_giq_history_stage.export_quarantine') IS NULL
     OR to_regclass('_giq_history_stage.runner_map') IS NULL
     OR to_regclass('_giq_history_stage.normalized_race') IS NULL
     OR to_regclass('_giq_history_stage.normalized_runner') IS NULL THEN
    RAISE EXCEPTION 'duplicate/quarantine proof requires complete normalized source tables';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS _giq_history_stage.duplicate_quarantine_issue (
  source_dataset text NOT NULL CHECK(source_dataset IN ('duplicates','quarantine')),
  source_file text NOT NULL,
  line_number bigint NOT NULL,
  issue_id text NOT NULL UNIQUE CHECK(issue_id ~ '^[0-9a-f]{64}$'),
  issue_type text NOT NULL,
  source_natural_key text NOT NULL,
  source_payload_sha256 text NOT NULL CHECK(source_payload_sha256 ~ '^[0-9a-f]{64}$'),
  source_payload jsonb NOT NULL CHECK(jsonb_typeof(source_payload)='object'),
  canonical_entity_type text NOT NULL CHECK(canonical_entity_type IN ('Race','Runner')),
  exact_existing_candidate_id text,
  exact_existing_candidate_count bigint NOT NULL CHECK(exact_existing_candidate_count IN (0,1)),
  similarity_only_match_allowed boolean NOT NULL CHECK(NOT similarity_only_match_allowed),
  create_entity_allowed boolean NOT NULL CHECK(NOT create_entity_allowed),
  required_proofs jsonb NOT NULL CHECK(jsonb_typeof(required_proofs)='array'),
  normalized_manifest_sha256 text NOT NULL CHECK(normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  source_history_cutoff timestamptz NOT NULL,
  PRIMARY KEY(source_dataset,source_file,line_number),
  UNIQUE(source_dataset,source_file,line_number,source_payload_sha256,
         normalized_manifest_sha256,source_history_cutoff)
);

WITH marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
), source_rows AS (
  SELECT
    'duplicates'::text AS source_dataset,d.source_file,d.line_number,
    d.payload->>'issueType' AS issue_type,d.payload->>'naturalKey' AS source_natural_key,
    d.payload,
    'Runner'::text AS canonical_entity_type,
    CASE WHEN canonical.id IS NOT NULL THEN runner.target_id END AS exact_existing_candidate_id,
    CASE WHEN canonical.id IS NOT NULL THEN 1 ELSE 0 END::bigint AS exact_existing_candidate_count
  FROM _giq_history_stage.export_duplicates d
  LEFT JOIN _giq_history_stage.runner_map runner
    ON runner.source_name='export' AND runner.source_id=d.payload->>'naturalKey'
  LEFT JOIN public."Runner" canonical ON canonical.id=runner.target_id

  UNION ALL

  SELECT
    'quarantine',q.source_file,q.line_number,q.payload->>'issueType',q.payload->>'naturalKey',q.payload,
    CASE q.payload->>'issueType' WHEN 'race-row' THEN 'Race' ELSE 'Runner' END,
    CASE
      WHEN q.payload->>'issueType'='race-row' AND canonical_race.id IS NOT NULL THEN race.target_id
      WHEN q.payload->>'issueType'='runner-row' AND canonical_runner.id IS NOT NULL THEN runner.target_id
    END,
    CASE
      WHEN q.payload->>'issueType'='race-row' AND canonical_race.id IS NOT NULL THEN 1
      WHEN q.payload->>'issueType'='runner-row' AND canonical_runner.id IS NOT NULL THEN 1
      ELSE 0
    END::bigint
  FROM _giq_history_stage.export_quarantine q
  LEFT JOIN _giq_history_stage.normalized_race race
    ON q.payload->>'issueType'='race-row' AND race.natural_key=q.payload->>'naturalKey'
  LEFT JOIN public."Race" canonical_race ON canonical_race.id=race.target_id
  LEFT JOIN _giq_history_stage.normalized_runner runner
    ON q.payload->>'issueType'='runner-row' AND runner.natural_key=q.payload->>'naturalKey'
  LEFT JOIN public."Runner" canonical_runner ON canonical_runner.id=runner.target_id
)
INSERT INTO _giq_history_stage.duplicate_quarantine_issue
  (source_dataset,source_file,line_number,issue_id,issue_type,source_natural_key,
   source_payload_sha256,source_payload,canonical_entity_type,
   exact_existing_candidate_id,exact_existing_candidate_count,
   similarity_only_match_allowed,create_entity_allowed,required_proofs,
   normalized_manifest_sha256,source_history_cutoff)
SELECT source.source_dataset,source.source_file,source.line_number,
  encode(digest(concat_ws(E'\x1f',source.source_dataset,source.source_file,
    source.line_number::text,source.payload::text),'sha256'),'hex'),
  source.issue_type,source.source_natural_key,
  encode(digest(source.payload::text,'sha256'),'hex'),source.payload,
  source.canonical_entity_type,source.exact_existing_candidate_id,
  source.exact_existing_candidate_count,false,false,
  jsonb_build_array(
    'identity-audited-v2-source','whole-database-search','authoritative-exact-identity',
    'verified-field-inventory','unique-verified-field-merge','existing-verified-data-preservation',
    'source-history-and-identifier-preservation','relationship-preservation',
    'exhaustive-inbound-reference-inventory','reference-redirection-and-conservation',
    'relationship-integrity','no-data-loss','append-only-audit'
  ),marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM source_rows source CROSS JOIN marker
ON CONFLICT(source_dataset,source_file,line_number) DO NOTHING;

-- One immutable proof may be recorded for a source issue. A bad proof requires a
-- fresh candidate; it cannot be edited into an eligible decision.
CREATE TABLE IF NOT EXISTS _giq_history_merge.duplicate_quarantine_resolution_audit (
  proof_id text PRIMARY KEY CHECK(nullif(btrim(proof_id),'') IS NOT NULL),
  source_dataset text NOT NULL,
  source_file text NOT NULL,
  line_number bigint NOT NULL,
  source_payload_sha256 text NOT NULL CHECK(source_payload_sha256 ~ '^[0-9a-f]{64}$'),
  source_natural_key text NOT NULL,
  issue_type text NOT NULL,
  resolution_kind text NOT NULL CHECK(resolution_kind IN (
    'duplicate-entity-merge','duplicate-source-row-merge','existing-record-repair'
  )),
  canonical_entity_type text NOT NULL CHECK(canonical_entity_type IN ('Race','Runner')),
  canonical_entity_id text NOT NULL CHECK(nullif(btrim(canonical_entity_id),'') IS NOT NULL),
  duplicate_entity_id text,
  authoritative_source_provider text NOT NULL CHECK(authoritative_source_provider IN (
    'production','greyhound_recorder','fasttrack','approved_fasttrack_resource','thedogs','galtd'
  )),
  authoritative_source_id text NOT NULL CHECK(nullif(btrim(authoritative_source_id),'') IS NOT NULL),
  authoritative_artifact_uri text NOT NULL CHECK(nullif(btrim(authoritative_artifact_uri),'') IS NOT NULL),
  authoritative_artifact_sha256 text NOT NULL CHECK(authoritative_artifact_sha256 ~ '^[0-9a-f]{64}$'),
  verification_status text NOT NULL CHECK(verification_status IN ('verified','conflict','rejected')),
  identity_proof_kind text NOT NULL CHECK(identity_proof_kind IN (
    'provider-source-key','registry-token','official-race-and-box-key','authoritative-document','none'
  )),
  authoritative_identity_proven boolean NOT NULL DEFAULT false,
  source_row_comparison_class text NOT NULL DEFAULT 'unresolved' CHECK(source_row_comparison_class IN (
    'unresolved','exact-duplicate','complementary-same-identity','identity-conflict'
  )),
  source_rows_same_real_entity_proven boolean NOT NULL DEFAULT false,
  all_source_fields_compared boolean NOT NULL DEFAULT false,
  selected_source_row_sha256 text
    CHECK(selected_source_row_sha256 IS NULL OR selected_source_row_sha256 ~ '^[0-9a-f]{64}$'),
  dropped_source_row_sha256 text
    CHECK(dropped_source_row_sha256 IS NULL OR dropped_source_row_sha256 ~ '^[0-9a-f]{64}$'),
  selected_dog_provider_id text,
  dropped_dog_provider_id text,
  selected_dog_name text,
  dropped_dog_name text,
  conflicting_dog_identity boolean NOT NULL DEFAULT false,
  whole_database_search_completed boolean NOT NULL DEFAULT false,
  whole_database_search_manifest jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK(jsonb_typeof(whole_database_search_manifest)='object'),
  similarity_only_evidence boolean NOT NULL DEFAULT true,
  verified_field_inventory jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK(jsonb_typeof(verified_field_inventory)='object'),
  unique_verified_fields_merged boolean NOT NULL DEFAULT false,
  existing_verified_data_preserved boolean NOT NULL DEFAULT false,
  source_history_preserved boolean NOT NULL DEFAULT false,
  identifiers_preserved boolean NOT NULL DEFAULT false,
  relationships_preserved boolean NOT NULL DEFAULT false,
  exhaustive_inbound_reference_inventory boolean NOT NULL DEFAULT false,
  relationship_integrity_verified boolean NOT NULL DEFAULT false,
  no_data_loss_verified boolean NOT NULL DEFAULT false,
  audit_ledger_recorded boolean NOT NULL DEFAULT false,
  audit_event_id text,
  audit_event_sha256 text CHECK(audit_event_sha256 IS NULL OR audit_event_sha256 ~ '^[0-9a-f]{64}$'),
  proof_evidence_sha256 text NOT NULL CHECK(proof_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  normalized_manifest_sha256 text NOT NULL CHECK(normalized_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  source_history_cutoff timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(source_dataset,source_file,line_number),
  FOREIGN KEY(source_dataset,source_file,line_number,source_payload_sha256,
              normalized_manifest_sha256,source_history_cutoff)
    REFERENCES _giq_history_stage.duplicate_quarantine_issue
      (source_dataset,source_file,line_number,source_payload_sha256,
       normalized_manifest_sha256,source_history_cutoff),
  CHECK((resolution_kind='duplicate-entity-merge')=(duplicate_entity_id IS NOT NULL)),
  CHECK(duplicate_entity_id IS NULL OR duplicate_entity_id<>canonical_entity_id),
  CHECK(NOT authoritative_identity_proven OR (
    verification_status='verified' AND identity_proof_kind<>'none' AND NOT similarity_only_evidence
  )),
  CHECK(source_dataset<>'duplicates' OR NOT source_rows_same_real_entity_proven OR (
    source_row_comparison_class IN ('exact-duplicate','complementary-same-identity')
    AND all_source_fields_compared AND NOT conflicting_dog_identity
    AND selected_source_row_sha256 IS NOT NULL AND dropped_source_row_sha256 IS NOT NULL
  )),
  CHECK(NOT whole_database_search_completed OR whole_database_search_manifest ?& ARRAY[
    'searchedTables','searchedExternalIds','searchedNames','searchedDates',
    'searchedParentRelationships','searchedStableNaturalKeys','candidateIds','querySha256'
  ]),
  CHECK(NOT audit_ledger_recorded OR (
    nullif(btrim(audit_event_id),'') IS NOT NULL AND audit_event_sha256 IS NOT NULL
  ))
);

CREATE TABLE IF NOT EXISTS _giq_history_merge.duplicate_quarantine_reference_proof (
  proof_id text NOT NULL REFERENCES _giq_history_merge.duplicate_quarantine_resolution_audit(proof_id),
  catalog_key text NOT NULL CHECK(catalog_key ~ '^[0-9a-f]{64}$'),
  redirection_target_entity_type text NOT NULL
    CHECK(redirection_target_entity_type IN ('Race','Runner')),
  redirection_target_entity_id text NOT NULL
    CHECK(nullif(btrim(redirection_target_entity_id),'') IS NOT NULL),
  duplicate_references_before bigint NOT NULL CHECK(duplicate_references_before>=0),
  canonical_references_before bigint NOT NULL CHECK(canonical_references_before>=0),
  duplicate_references_after bigint NOT NULL CHECK(duplicate_references_after>=0),
  canonical_references_after bigint NOT NULL CHECK(canonical_references_after>=0),
  orphan_references_after bigint NOT NULL CHECK(orphan_references_after>=0),
  reference_rows_before_sha256 text NOT NULL CHECK(reference_rows_before_sha256 ~ '^[0-9a-f]{64}$'),
  reference_rows_after_sha256 text NOT NULL CHECK(reference_rows_after_sha256 ~ '^[0-9a-f]{64}$'),
  conservation_proven boolean GENERATED ALWAYS AS (
    duplicate_references_after=0
    AND canonical_references_after=canonical_references_before+duplicate_references_before
  ) STORED,
  no_orphan_references_proven boolean GENERATED ALWAYS AS (
    orphan_references_after=0
  ) STORED,
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(proof_id,catalog_key)
);

CREATE OR REPLACE FUNCTION _giq_history_merge.reject_duplicate_quarantine_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'duplicate/quarantine proof is append-only; rebuild a fresh candidate';
END
$$;

DO $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='_giq_history_merge.duplicate_quarantine_resolution_audit'::regclass
      AND tgname='duplicate_quarantine_resolution_audit_append_only'
  ) THEN
    CREATE TRIGGER duplicate_quarantine_resolution_audit_append_only
    BEFORE UPDATE OR DELETE ON _giq_history_merge.duplicate_quarantine_resolution_audit
    FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_duplicate_quarantine_audit_mutation();
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='_giq_history_merge.duplicate_quarantine_reference_proof'::regclass
      AND tgname='duplicate_quarantine_reference_proof_append_only'
  ) THEN
    CREATE TRIGGER duplicate_quarantine_reference_proof_append_only
    BEFORE UPDATE OR DELETE ON _giq_history_merge.duplicate_quarantine_reference_proof
    FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_duplicate_quarantine_audit_mutation();
  END IF;
END
$$;

CREATE OR REPLACE VIEW _giq_history_stage.duplicate_quarantine_inbound_reference_catalog AS
WITH column_pair AS (
  SELECT constraint_row.oid,parent.relname AS parent_table,
    child_namespace.nspname AS child_schema,child.relname AS child_table,
    constraint_row.conname AS constraint_name,constraint_row.convalidated AS constraint_validated,
    position.ordinality,
    child_attribute.attname AS child_column,parent_attribute.attname AS parent_column
  FROM pg_constraint constraint_row
  JOIN pg_class parent ON parent.oid=constraint_row.confrelid
  JOIN pg_namespace parent_namespace ON parent_namespace.oid=parent.relnamespace
  JOIN pg_class child ON child.oid=constraint_row.conrelid
  JOIN pg_namespace child_namespace ON child_namespace.oid=child.relnamespace
  JOIN LATERAL generate_subscripts(constraint_row.conkey,1) position(ordinality) ON true
  JOIN pg_attribute child_attribute
    ON child_attribute.attrelid=constraint_row.conrelid
   AND child_attribute.attnum=constraint_row.conkey[position.ordinality]
  JOIN pg_attribute parent_attribute
    ON parent_attribute.attrelid=constraint_row.confrelid
   AND parent_attribute.attnum=constraint_row.confkey[position.ordinality]
  WHERE constraint_row.contype='f'
    AND parent_namespace.nspname='public' AND parent.relname IN ('Race','Runner')
), grouped AS (
  SELECT parent_table,child_schema,child_table,constraint_name,
    bool_and(constraint_validated) AS constraint_validated,
    jsonb_agg(child_column ORDER BY ordinality) AS child_columns,
    jsonb_agg(parent_column ORDER BY ordinality) AS parent_columns
  FROM column_pair
  GROUP BY oid,parent_table,child_schema,child_table,constraint_name
)
SELECT parent_table,child_schema,child_table,constraint_name,constraint_validated,
  child_columns,parent_columns,
  encode(digest(concat_ws(E'\x1f',parent_table,child_schema,child_table,constraint_name,
    constraint_validated::text,child_columns::text,parent_columns::text),'sha256'),'hex') AS catalog_key
FROM grouped;

CREATE OR REPLACE VIEW _giq_history_stage.duplicate_quarantine_canonical_entity AS
SELECT 'Race'::text AS entity_type,id AS entity_id FROM public."Race"
UNION ALL
SELECT 'Runner',id FROM public."Runner";

CREATE OR REPLACE VIEW _giq_history_stage.duplicate_quarantine_proof_resolution AS
WITH reference_evaluation AS (
  SELECT proof.proof_id,
    count(catalog.catalog_key) AS expected_reference_constraints,
    count(reference.catalog_key) FILTER(
      WHERE catalog.catalog_key IS NOT NULL
        AND reference.redirection_target_entity_type=proof.canonical_entity_type
        AND reference.redirection_target_entity_id=proof.canonical_entity_id
    )
      AS proved_reference_constraints,
    count(reference.catalog_key) FILTER(WHERE catalog.catalog_key IS NULL)
      AS unrecognized_reference_constraints,
    count(reference.catalog_key) FILTER(
      WHERE catalog.catalog_key IS NOT NULL
        AND reference.redirection_target_entity_type=proof.canonical_entity_type
        AND reference.redirection_target_entity_id=proof.canonical_entity_id
        AND reference.conservation_proven
        AND reference.no_orphan_references_proven
    ) AS conserved_reference_constraints,
    count(catalog.catalog_key) FILTER(WHERE NOT catalog.constraint_validated)
      AS unvalidated_reference_constraints,
    count(reference.catalog_key) FILTER(
      WHERE catalog.catalog_key IS NOT NULL AND NOT catalog.constraint_validated
        AND reference.redirection_target_entity_type=proof.canonical_entity_type
        AND reference.redirection_target_entity_id=proof.canonical_entity_id
    ) AS proved_unvalidated_reference_constraints,
    count(reference.catalog_key) FILTER(
      WHERE catalog.catalog_key IS NOT NULL AND NOT catalog.constraint_validated
        AND reference.redirection_target_entity_type=proof.canonical_entity_type
        AND reference.redirection_target_entity_id=proof.canonical_entity_id
        AND reference.conservation_proven
        AND reference.no_orphan_references_proven
    ) AS conserved_unvalidated_reference_constraints
  FROM _giq_history_merge.duplicate_quarantine_resolution_audit proof
  LEFT JOIN _giq_history_stage.duplicate_quarantine_inbound_reference_catalog catalog
    ON catalog.parent_table=proof.canonical_entity_type
  LEFT JOIN _giq_history_merge.duplicate_quarantine_reference_proof reference
    ON reference.proof_id=proof.proof_id AND reference.catalog_key=catalog.catalog_key
  GROUP BY proof.proof_id
), extra_reference AS (
  SELECT proof.proof_id,count(reference.catalog_key) AS extra_count
  FROM _giq_history_merge.duplicate_quarantine_resolution_audit proof
  JOIN _giq_history_merge.duplicate_quarantine_reference_proof reference
    ON reference.proof_id=proof.proof_id
  LEFT JOIN _giq_history_stage.duplicate_quarantine_inbound_reference_catalog catalog
    ON catalog.parent_table=proof.canonical_entity_type
   AND catalog.catalog_key=reference.catalog_key
  WHERE catalog.catalog_key IS NULL
  GROUP BY proof.proof_id
), evaluated AS (
  SELECT issue.*,
    run.normalized_transform_version='thedogs-normalized-harvest/v2'
      AS identity_audited_v2_source,
    proof.proof_id,
    proof.resolution_kind,
    proof.canonical_entity_id,
    proof.duplicate_entity_id,
    proof.similarity_only_evidence,
    proof.source_row_comparison_class,
    proof.source_rows_same_real_entity_proven,
    proof.all_source_fields_compared,
    proof.selected_source_row_sha256,
    proof.dropped_source_row_sha256,
    proof.selected_dog_provider_id,
    proof.dropped_dog_provider_id,
    proof.selected_dog_name,
    proof.dropped_dog_name,
    proof.conflicting_dog_identity,
    proof.verified_field_inventory,
    proof.unique_verified_fields_merged,
    proof.existing_verified_data_preserved,
    proof.source_history_preserved,
    proof.identifiers_preserved,
    proof.relationships_preserved,
    proof.relationship_integrity_verified,
    proof.no_data_loss_verified,
    proof.audit_ledger_recorded,
    proof.normalized_manifest_sha256=issue.normalized_manifest_sha256
      AND proof.source_history_cutoff=issue.source_history_cutoff AS source_binding_proven,
    coalesce(proof.whole_database_search_completed,false)
      AND proof.whole_database_search_manifest ?& ARRAY[
        'searchedTables','searchedExternalIds','searchedNames','searchedDates',
        'searchedParentRelationships','searchedStableNaturalKeys','candidateIds','querySha256'
      ]
      AND proof.whole_database_search_manifest->'candidateIds' ? proof.canonical_entity_id
      AND jsonb_typeof(proof.whole_database_search_manifest->'searchedTables')='array'
      AND jsonb_typeof(proof.whole_database_search_manifest->'searchedExternalIds')='array'
      AND jsonb_typeof(proof.whole_database_search_manifest->'searchedNames')='array'
      AND jsonb_typeof(proof.whole_database_search_manifest->'searchedDates')='array'
      AND jsonb_typeof(proof.whole_database_search_manifest->'searchedParentRelationships')='array'
      AND jsonb_typeof(proof.whole_database_search_manifest->'searchedStableNaturalKeys')='array'
      AND jsonb_typeof(proof.whole_database_search_manifest->'candidateIds')='array'
      AND coalesce(proof.whole_database_search_manifest->>'querySha256','') ~ '^[0-9a-f]{64}$'
      AS whole_database_search_proven,
    coalesce(proof.authoritative_identity_proven,false)
      AND proof.verification_status='verified'
      AND proof.identity_proof_kind<>'none'
      AND NOT proof.similarity_only_evidence AS exact_authoritative_identity_proven,
    CASE WHEN issue.source_dataset<>'duplicates' THEN true ELSE
      coalesce(proof.source_rows_same_real_entity_proven,false)
      AND coalesce(proof.all_source_fields_compared,false)
      AND proof.source_row_comparison_class IN ('exact-duplicate','complementary-same-identity')
      AND NOT coalesce(proof.conflicting_dog_identity,true)
      AND proof.selected_source_row_sha256 IS NOT NULL
      AND proof.dropped_source_row_sha256 IS NOT NULL
      AND (
        (nullif(btrim(proof.selected_dog_provider_id),'') IS NOT NULL
          AND proof.selected_dog_provider_id=proof.dropped_dog_provider_id)
        OR (proof.verification_status='verified'
          AND proof.identity_proof_kind='official-race-and-box-key')
      )
    END AS duplicate_source_rows_same_identity_proven,
    coalesce(proof.unique_verified_fields_merged,false)
      AND proof.verified_field_inventory ?& ARRAY[
        'sourceRowSha256','canonicalBeforeSha256','canonicalAfterSha256',
        'uniqueVerifiedFields','mergedVerifiedFields','conflicts'
      ]
      AND coalesce(proof.verified_field_inventory->>'sourceRowSha256','') ~ '^[0-9a-f]{64}$'
      AND coalesce(proof.verified_field_inventory->>'canonicalBeforeSha256','') ~ '^[0-9a-f]{64}$'
      AND coalesce(proof.verified_field_inventory->>'canonicalAfterSha256','') ~ '^[0-9a-f]{64}$'
      AND jsonb_typeof(proof.verified_field_inventory->'uniqueVerifiedFields')='array'
      AND jsonb_typeof(proof.verified_field_inventory->'mergedVerifiedFields')='array'
      AND jsonb_typeof(proof.verified_field_inventory->'conflicts')='array'
      AS verified_field_inventory_proven,
    canonical.entity_id IS NOT NULL AS canonical_target_exists,
    duplicate.entity_id IS NOT NULL AS duplicate_target_exists,
    coalesce(proof.exhaustive_inbound_reference_inventory,false)
      AND coalesce(reference.expected_reference_constraints,0)
        =coalesce(reference.proved_reference_constraints,0)
      AND coalesce(extra.extra_count,0)=0
      AS exhaustive_reference_inventory_proven,
    coalesce(reference.unvalidated_reference_constraints,0)
        =coalesce(reference.proved_unvalidated_reference_constraints,0)
      AND coalesce(reference.unvalidated_reference_constraints,0)
        =coalesce(reference.conserved_unvalidated_reference_constraints,0)
      AS unvalidated_reference_constraints_proven,
    coalesce(reference.expected_reference_constraints,0)
      =coalesce(reference.conserved_reference_constraints,0)
      AND coalesce(extra.extra_count,0)=0 AS reference_conservation_proven,
    coalesce(reference.expected_reference_constraints,0) AS expected_reference_constraints,
    coalesce(reference.proved_reference_constraints,0) AS proved_reference_constraints,
    coalesce(reference.unvalidated_reference_constraints,0)
      AS unvalidated_reference_constraints,
    coalesce(reference.proved_unvalidated_reference_constraints,0)
      AS proved_unvalidated_reference_constraints,
    coalesce(reference.conserved_unvalidated_reference_constraints,0)
      AS conserved_unvalidated_reference_constraints,
    coalesce(extra.extra_count,0) AS unrecognized_reference_constraints
  FROM _giq_history_stage.duplicate_quarantine_issue issue
  JOIN _giq_history_merge.run run ON run.id=1
  LEFT JOIN _giq_history_merge.duplicate_quarantine_resolution_audit proof
    ON proof.source_dataset=issue.source_dataset
   AND proof.source_file=issue.source_file AND proof.line_number=issue.line_number
   AND proof.source_payload_sha256=issue.source_payload_sha256
   AND proof.source_natural_key=issue.source_natural_key
   AND proof.issue_type=issue.issue_type
   AND proof.canonical_entity_type=issue.canonical_entity_type
  LEFT JOIN _giq_history_stage.duplicate_quarantine_canonical_entity canonical
    ON canonical.entity_type=proof.canonical_entity_type
   AND canonical.entity_id=proof.canonical_entity_id
  LEFT JOIN _giq_history_stage.duplicate_quarantine_canonical_entity duplicate
    ON duplicate.entity_type=proof.canonical_entity_type
   AND duplicate.entity_id=proof.duplicate_entity_id
  LEFT JOIN reference_evaluation reference ON reference.proof_id=proof.proof_id
  LEFT JOIN extra_reference extra ON extra.proof_id=proof.proof_id
), decision AS (
  SELECT evaluated.*,
    identity_audited_v2_source
    AND proof_id IS NOT NULL
    AND source_binding_proven
    AND whole_database_search_proven
    AND exact_authoritative_identity_proven
    AND duplicate_source_rows_same_identity_proven
    AND canonical_target_exists
    AND NOT coalesce(similarity_only_evidence,true)
    AND verified_field_inventory_proven
    AND coalesce(existing_verified_data_preserved,false)
    AND coalesce(source_history_preserved,false)
    AND coalesce(identifiers_preserved,false)
    AND coalesce(relationships_preserved,false)
    AND exhaustive_reference_inventory_proven
    AND unvalidated_reference_constraints_proven
    AND reference_conservation_proven
    AND coalesce(relationship_integrity_verified,false)
    AND coalesce(no_data_loss_verified,false)
    AND coalesce(audit_ledger_recorded,false)
    AND (resolution_kind<>'duplicate-entity-merge' OR duplicate_target_exists)
      AS resolution_allowed
  FROM evaluated
)
SELECT decision.*,
  false AS create_entity_allowed,
  resolution_allowed AND source_dataset='duplicates' AS duplicate_removal_allowed,
  resolution_allowed AND source_dataset='quarantine' AS quarantine_release_allowed,
  CASE
    WHEN NOT identity_audited_v2_source THEN 'blocked-non-final-identity-audited-source-required'
    WHEN proof_id IS NULL THEN 'blocked-authoritative-proof-required'
    WHEN NOT source_binding_proven THEN 'blocked-source-binding-mismatch'
    WHEN NOT whole_database_search_proven THEN 'blocked-whole-database-search-required'
    WHEN source_dataset='duplicates' AND coalesce(conflicting_dog_identity,false)
      THEN 'blocked-runner-identity-conflict-authoritative-race-result-retrieval-required'
    WHEN NOT exact_authoritative_identity_proven THEN 'blocked-exact-authoritative-identity-required'
    WHEN NOT duplicate_source_rows_same_identity_proven
      THEN 'blocked-selected-dropped-raw-row-identity-and-all-field-comparison-required'
    WHEN NOT canonical_target_exists THEN 'blocked-existing-canonical-target-required-no-create'
    WHEN coalesce(similarity_only_evidence,true) THEN 'blocked-similarity-is-not-identity'
    WHEN NOT verified_field_inventory_proven
      OR NOT coalesce(existing_verified_data_preserved,false)
      OR NOT coalesce(source_history_preserved,false)
      OR NOT coalesce(identifiers_preserved,false)
      OR NOT coalesce(relationships_preserved,false)
      THEN 'blocked-verified-field-or-provenance-preservation-required'
    WHEN NOT unvalidated_reference_constraints_proven
      THEN 'blocked-unvalidated-inbound-foreign-key-proof-and-conservation-required'
    WHEN NOT exhaustive_reference_inventory_proven
      OR NOT reference_conservation_proven
      THEN 'blocked-exhaustive-reference-redirection-and-conservation-required'
    WHEN NOT coalesce(relationship_integrity_verified,false)
      OR NOT coalesce(no_data_loss_verified,false)
      THEN 'blocked-integrity-and-no-loss-proof-required'
    WHEN NOT coalesce(audit_ledger_recorded,false) THEN 'blocked-append-only-audit-required'
    WHEN resolution_kind='duplicate-entity-merge' AND NOT duplicate_target_exists
      THEN 'blocked-duplicate-target-not-found'
    ELSE 'proof-complete-ready-for-separate-reviewed-apply'
  END AS disposition
FROM decision;

CREATE TABLE IF NOT EXISTS _giq_history_merge.duplicate_quarantine_proof_manifest (
  id integer PRIMARY KEY CHECK(id=1),
  schema_version text NOT NULL,
  normalized_manifest_sha256 text NOT NULL,
  normalized_transform_version text NOT NULL,
  source_history_cutoff timestamptz NOT NULL,
  source_datasets jsonb NOT NULL,
  counts jsonb NOT NULL,
  blockers jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('ready','blocked')),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

WITH marker AS (
  SELECT normalized_manifest_sha256,normalized_transform_version,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
), datasets AS (
  SELECT jsonb_object_agg(dataset,jsonb_build_object(
    'rows',expected_rows,'bytes',expected_bytes,'sha256',expected_sha256
  ) ORDER BY dataset) AS evidence
  FROM _giq_history_merge.export_dataset_manifest
  WHERE dataset IN ('duplicates','quarantine')
), counts AS (
  SELECT jsonb_build_object(
    'sourceRows',count(*),
    'duplicateRows',count(*) FILTER(WHERE source_dataset='duplicates'),
    'duplicateNaturalKeys',count(DISTINCT source_natural_key)
      FILTER(WHERE source_dataset='duplicates'),
    'quarantineRows',count(*) FILTER(WHERE source_dataset='quarantine'),
    'quarantineMissingDogIdentityRows',count(*) FILTER(
      WHERE source_dataset='quarantine' AND source_payload->>'reason'='missing_dog_provider_identity'),
    'quarantineMissingRaceDistanceRows',count(*) FILTER(
      WHERE source_dataset='quarantine' AND source_payload->>'reason'='missing_race_distance'),
    'proofRows',count(proof_id),
    'duplicateExactProofs',count(*) FILTER(
      WHERE source_dataset='duplicates' AND source_row_comparison_class='exact-duplicate'),
    'duplicateComplementarySameIdentityProofs',count(*) FILTER(
      WHERE source_dataset='duplicates' AND source_row_comparison_class='complementary-same-identity'),
    'duplicateIdentityConflictProofs',count(*) FILTER(
      WHERE source_dataset='duplicates' AND source_row_comparison_class='identity-conflict'),
    'resolutionAllowedRows',count(*) FILTER(WHERE resolution_allowed),
    'blockedRows',count(*) FILTER(WHERE NOT resolution_allowed)
  ) AS evidence
  FROM _giq_history_stage.duplicate_quarantine_proof_resolution
), blockers AS (
  SELECT jsonb_build_object(
    'nonFinalIdentityAuditedSource',CASE WHEN bool_and(identity_audited_v2_source) THEN 0 ELSE 1 END,
    'sourceRowsWithoutProof',count(*) FILTER(WHERE proof_id IS NULL),
    'sourceBindingUnproven',count(*) FILTER(WHERE NOT source_binding_proven),
    'wholeDatabaseSearchUnproven',count(*) FILTER(WHERE NOT whole_database_search_proven),
    'authoritativeIdentityUnproven',count(*) FILTER(WHERE NOT exact_authoritative_identity_proven),
    'duplicateRawRowIdentityOrFieldComparisonUnproven',count(*) FILTER(
      WHERE NOT duplicate_source_rows_same_identity_proven),
    'duplicateIdentityConflicts',count(*) FILTER(
      WHERE source_dataset='duplicates' AND coalesce(conflicting_dog_identity,false)),
    'existingCanonicalTargetUnproven',count(*) FILTER(WHERE NOT canonical_target_exists),
    'similarityOnlyProofs',count(*) FILTER(WHERE coalesce(similarity_only_evidence,true)),
    'verifiedFieldMergeUnproven',count(*) FILTER(WHERE NOT verified_field_inventory_proven
      OR NOT coalesce(existing_verified_data_preserved,false)),
    'provenanceOrIdentifierPreservationUnproven',count(*) FILTER(
      WHERE NOT coalesce(source_history_preserved,false) OR NOT coalesce(identifiers_preserved,false)),
    'relationshipPreservationUnproven',count(*) FILTER(WHERE NOT coalesce(relationships_preserved,false)),
    'referenceInventoryUnproven',count(*) FILTER(WHERE NOT exhaustive_reference_inventory_proven),
    'unvalidatedInboundForeignKeyProofGaps',count(*) FILTER(
      WHERE NOT unvalidated_reference_constraints_proven),
    'referenceConservationUnproven',count(*) FILTER(WHERE NOT reference_conservation_proven),
    'relationshipIntegrityUnproven',count(*) FILTER(WHERE NOT coalesce(relationship_integrity_verified,false)),
    'noDataLossUnproven',count(*) FILTER(WHERE NOT coalesce(no_data_loss_verified,false)),
    'appendOnlyAuditUnrecorded',count(*) FILTER(WHERE NOT coalesce(audit_ledger_recorded,false)),
    'unresolvedRows',count(*) FILTER(WHERE NOT resolution_allowed)
  ) AS evidence
  FROM _giq_history_stage.duplicate_quarantine_proof_resolution
)
INSERT INTO _giq_history_merge.duplicate_quarantine_proof_manifest
  (id,schema_version,normalized_manifest_sha256,normalized_transform_version,
   source_history_cutoff,source_datasets,counts,blockers,status,updated_at)
SELECT 1,'giq-duplicate-quarantine-proof/v1',marker.normalized_manifest_sha256,
  marker.normalized_transform_version,marker.source_history_cutoff,datasets.evidence,
  counts.evidence,blockers.evidence,
  CASE WHEN EXISTS(
    SELECT 1 FROM jsonb_each_text(blockers.evidence) item WHERE item.value::bigint<>0
  ) THEN 'blocked' ELSE 'ready' END,clock_timestamp()
FROM marker CROSS JOIN datasets CROSS JOIN counts CROSS JOIN blockers
ON CONFLICT(id) DO UPDATE
SET schema_version=EXCLUDED.schema_version,
    normalized_manifest_sha256=EXCLUDED.normalized_manifest_sha256,
    normalized_transform_version=EXCLUDED.normalized_transform_version,
    source_history_cutoff=EXCLUDED.source_history_cutoff,
    source_datasets=EXCLUDED.source_datasets,
    counts=EXCLUDED.counts,
    blockers=EXCLUDED.blockers,
    status=EXCLUDED.status,
    updated_at=EXCLUDED.updated_at;

DO $$
DECLARE
  expected_rows bigint;
  observed_rows bigint;
BEGIN
  SELECT sum(expected_rows) INTO STRICT expected_rows
  FROM _giq_history_merge.export_dataset_manifest
  WHERE dataset IN ('duplicates','quarantine');
  SELECT count(*) INTO STRICT observed_rows
  FROM _giq_history_stage.duplicate_quarantine_issue;

  IF observed_rows<>expected_rows THEN
    RAISE EXCEPTION 'duplicate/quarantine issue inventory changed: %/%',observed_rows,expected_rows;
  END IF;
  IF EXISTS(
    WITH source_row AS (
      SELECT 'duplicates'::text AS source_dataset,source_file,line_number,
        payload->>'issueType' AS issue_type,payload->>'naturalKey' AS source_natural_key,
        encode(digest(payload::text,'sha256'),'hex') AS source_payload_sha256
      FROM _giq_history_stage.export_duplicates
      UNION ALL
      SELECT 'quarantine',source_file,line_number,payload->>'issueType',payload->>'naturalKey',
        encode(digest(payload::text,'sha256'),'hex')
      FROM _giq_history_stage.export_quarantine
    )
    SELECT 1
    FROM source_row source
    FULL JOIN _giq_history_stage.duplicate_quarantine_issue issue
      USING(source_dataset,source_file,line_number)
    WHERE source.source_dataset IS NULL OR issue.source_dataset IS NULL
       OR source.issue_type IS DISTINCT FROM issue.issue_type
       OR source.source_natural_key IS DISTINCT FROM issue.source_natural_key
       OR source.source_payload_sha256 IS DISTINCT FROM issue.source_payload_sha256
  ) THEN
    RAISE EXCEPTION 'duplicate/quarantine issue inventory does not exactly reconcile to source rows';
  END IF;
  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.duplicate_quarantine_issue issue
    JOIN _giq_history_merge.run run ON run.id=1
    WHERE issue.normalized_manifest_sha256 IS DISTINCT FROM run.normalized_manifest_sha256
       OR issue.source_history_cutoff IS DISTINCT FROM run.source_history_cutoff
  ) THEN
    RAISE EXCEPTION 'duplicate/quarantine issue evidence is bound to another source';
  END IF;
  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.duplicate_quarantine_issue
    WHERE (source_dataset='duplicates' AND (
      issue_type<>'runner-natural-key'
      OR source_payload->>'selection'<>'completeness_then_latest_ordinal'))
       OR (source_dataset='quarantine' AND
          (issue_type,source_payload->>'reason') NOT IN (
            ('runner-row','missing_dog_provider_identity'),('race-row','missing_race_distance')
          ))
  ) THEN
    RAISE EXCEPTION 'duplicate/quarantine source taxonomy changed';
  END IF;
  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.duplicate_quarantine_proof_resolution
    WHERE create_entity_allowed OR (resolution_allowed AND (
      NOT source_binding_proven OR NOT whole_database_search_proven
      OR NOT exact_authoritative_identity_proven OR NOT canonical_target_exists
      OR NOT duplicate_source_rows_same_identity_proven
      OR coalesce(similarity_only_evidence,true)
      OR NOT verified_field_inventory_proven
      OR NOT coalesce(existing_verified_data_preserved,false)
      OR NOT coalesce(source_history_preserved,false)
      OR NOT coalesce(identifiers_preserved,false)
      OR NOT coalesce(relationships_preserved,false)
      OR NOT unvalidated_reference_constraints_proven
      OR NOT exhaustive_reference_inventory_proven OR NOT reference_conservation_proven
      OR NOT coalesce(relationship_integrity_verified,false)
      OR NOT coalesce(no_data_loss_verified,false)
      OR NOT coalesce(audit_ledger_recorded,false)
    ))
  ) THEN
    RAISE EXCEPTION 'duplicate/quarantine proof allowed an unsafe resolution';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgrelid IN (
        '_giq_history_merge.duplicate_quarantine_resolution_audit'::regclass,
        '_giq_history_merge.duplicate_quarantine_reference_proof'::regclass
      ) AND NOT tgisinternal AND tgenabled<>'D')<>2 THEN
    RAISE EXCEPTION 'duplicate/quarantine append-only trigger partition is incomplete';
  END IF;
END
$$;

REVOKE ALL ON _giq_history_stage.duplicate_quarantine_issue FROM PUBLIC;
REVOKE ALL ON _giq_history_merge.duplicate_quarantine_resolution_audit FROM PUBLIC;
REVOKE ALL ON _giq_history_merge.duplicate_quarantine_reference_proof FROM PUBLIC;
REVOKE ALL ON _giq_history_merge.duplicate_quarantine_proof_manifest FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.duplicate_quarantine_inbound_reference_catalog FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.duplicate_quarantine_canonical_entity FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.duplicate_quarantine_proof_resolution FROM PUBLIC;
REVOKE ALL ON FUNCTION _giq_history_merge.reject_duplicate_quarantine_audit_mutation() FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event','DUPLICATE_QUARANTINE_PROOF_STAGED',
  'database',current_database(),
  'status',status,
  'normalizedManifestSha256',normalized_manifest_sha256,
  'normalizedTransformVersion',normalized_transform_version,
  'sourceHistoryCutoff',source_history_cutoff,
  'counts',counts,
  'blockers',blockers
) FROM _giq_history_merge.duplicate_quarantine_proof_manifest WHERE id=1;

SELECT status<>'ready' AS duplicate_quarantine_proof_blocked
FROM _giq_history_merge.duplicate_quarantine_proof_manifest WHERE id=1;
