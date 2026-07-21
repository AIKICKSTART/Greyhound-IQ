\set ON_ERROR_STOP on

BEGIN;
SET LOCAL synchronous_commit = on;
SET LOCAL statement_timeout = 0;

DO $$
DECLARE
  observed_phase text;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'authoritative pedigree staging database mismatch';
  END IF;

  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run
  WHERE id = 1
  FOR UPDATE;

  IF observed_phase <> 'normalized' THEN
    RAISE EXCEPTION 'authoritative pedigree staging requires normalized, observed %', observed_phase;
  END IF;

  IF to_regclass('_giq_history_stage.normalized_dog') IS NULL
     OR to_regclass('_giq_history_stage.normalized_pedigree_edge') IS NULL
     OR to_regclass('_giq_history_stage.galtd_exact_crosswalk') IS NULL THEN
    RAISE EXCEPTION 'authoritative pedigree staging requires the complete normalized pedigree stage';
  END IF;
END
$$;

-- This registry is policy, not a claim that an external source is licensed or
-- reachable. External evidence is accepted only with a reviewed usage approval
-- reference. Automated retrieval remains disabled until a separate provider
-- agreement and bounded client are reviewed.
CREATE TABLE _giq_history_stage.authoritative_provider_policy (
  source_provider text PRIMARY KEY,
  authority_rank integer NOT NULL UNIQUE CHECK(authority_rank > 0),
  can_establish_new_identity boolean NOT NULL,
  automated_retrieval_allowed boolean NOT NULL DEFAULT false,
  usage_approval_required boolean NOT NULL,
  evidence_role text NOT NULL CHECK(evidence_role IN (
    'canonical-authority','authoritative-provider','historical-observation','official-studbook'
  ))
);

INSERT INTO _giq_history_stage.authoritative_provider_policy
  (source_provider,authority_rank,can_establish_new_identity,
   automated_retrieval_allowed,usage_approval_required,evidence_role)
VALUES
  ('production',1000,true,true,false,'canonical-authority'),
  ('greyhound_recorder',900,true,false,true,'authoritative-provider'),
  ('fasttrack',800,true,false,true,'authoritative-provider'),
  ('approved_fasttrack_resource',750,true,false,true,'authoritative-provider'),
  ('thedogs',200,false,false,false,'historical-observation'),
  ('galtd',100,false,false,false,'official-studbook');

DO $$
BEGIN
  IF (SELECT authority_rank FROM _giq_history_stage.authoritative_provider_policy
      WHERE source_provider='production') <=
     (SELECT authority_rank FROM _giq_history_stage.authoritative_provider_policy
      WHERE source_provider='greyhound_recorder')
     OR (SELECT authority_rank FROM _giq_history_stage.authoritative_provider_policy
         WHERE source_provider='greyhound_recorder') <=
        (SELECT authority_rank FROM _giq_history_stage.authoritative_provider_policy
         WHERE source_provider='fasttrack')
     OR (SELECT authority_rank FROM _giq_history_stage.authoritative_provider_policy
         WHERE source_provider='fasttrack') <=
        (SELECT authority_rank FROM _giq_history_stage.authoritative_provider_policy
         WHERE source_provider='approved_fasttrack_resource') THEN
    RAISE EXCEPTION 'authoritative provider precedence changed';
  END IF;

  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.authoritative_provider_policy
    WHERE source_provider <> 'production' AND automated_retrieval_allowed
  ) THEN
    RAISE EXCEPTION 'external provider retrieval cannot be enabled by this stage';
  END IF;

  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.authoritative_provider_policy
    WHERE source_provider IN ('thedogs','galtd') AND can_establish_new_identity
  ) THEN
    RAISE EXCEPTION 'TheDogs and GALTD cannot establish a new canonical identity';
  END IF;
END
$$;

-- Every staged assertion is retained once under an immutable occurrence key.
-- The key binds the import run, artifact, provider/source, physical source line,
-- relationship and evidence digest; no descriptive match participates in it.
CREATE TABLE _giq_history_stage.authoritative_pedigree_assertion_occurrence (
  occurrence_id text PRIMARY KEY,
  import_run_id text NOT NULL,
  artifact_sha256 text NOT NULL CHECK(artifact_sha256 ~ '^[0-9a-f]{64}$'),
  source_provider text NOT NULL
    REFERENCES _giq_history_stage.authoritative_provider_policy(source_provider),
  source_file text NOT NULL,
  source_line bigint NOT NULL CHECK(source_line > 0),
  source_id text NOT NULL,
  relationship text NOT NULL CHECK(relationship IN ('sire','dam')),
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  subject_source_id text NOT NULL,
  parent_source_id text,
  staged_subject_dog_id text,
  staged_parent_dog_id text,
  source_conflict boolean NOT NULL,
  source_impossible boolean NOT NULL,
  corroboration_only boolean NOT NULL,
  stable_bridge boolean NOT NULL,
  evidence_payload jsonb NOT NULL,
  UNIQUE(import_run_id,artifact_sha256,source_provider,source_file,source_line,
         source_id,relationship,evidence_sha256),
  CHECK(NOT (corroboration_only AND stable_bridge))
);

WITH source_occurrence AS MATERIALIZED (
  SELECT
    _giq_history_merge.history_id(
      'pedrun','thedogs:' || marker.normalized_manifest_sha256
    ) AS import_run_id,
    marker.normalized_manifest_sha256 AS artifact_sha256,
    'thedogs'::text AS source_provider,
    edge.source_file,
    edge.source_line,
    edge.natural_key AS source_id,
    edge.relationship,
    edge.evidence_sha256,
    edge.payload->>'childNaturalKey' AS subject_source_id,
    edge.payload->>'parentNaturalKey' AS parent_source_id,
    edge.child_id AS staged_subject_dog_id,
    edge.parent_id AS staged_parent_dog_id,
    false AS source_conflict,
    edge.self_parent AS source_impossible,
    false AS corroboration_only,
    false AS stable_bridge,
    edge.payload AS evidence_payload
  FROM _giq_history_stage.normalized_pedigree_edge edge
  CROSS JOIN _giq_history_merge.run marker
  WHERE marker.id=1
  UNION ALL
  SELECT
    _giq_history_merge.history_id('galtdrun',concat_ws(':','galtd',
      marker.galtd_stage_manifest->'export'->>'runInstanceId',
      assertion.payload->>'artifactSha256')),
    assertion.payload->>'artifactSha256',
    'galtd',
    coalesce(assertion.payload->>'artifact','galtd:' || assertion.payload->>'artifactSha256'),
    CASE WHEN assertion.payload->>'artifactOffsetLine' ~ '^[1-9][0-9]*$'
      THEN (assertion.payload->>'artifactOffsetLine')::bigint
      ELSE assertion.line_number END,
    assertion.payload->>'sourceId',
    assertion.payload->>'relationship',
    assertion.payload->>'evidenceSha256',
    assertion.payload->>'subjectSourceId',
    assertion.payload->>'assertedParentRegistryToken',
    NULL,NULL,
    observation.payload ? 'conflictGroup',
    false,
    true,
    false,
    assertion.payload || jsonb_build_object(
      'subjectConflict',observation.payload ? 'conflictGroup',
      'sourceObservationEvidenceSha256',observation.payload->>'evidenceSha256'
    )
  FROM _giq_history_stage.galtd_assertion assertion
  JOIN _giq_history_stage.galtd_observation observation
    ON observation.payload->>'sourceId'=assertion.payload->>'subjectSourceId'
  CROSS JOIN _giq_history_merge.run marker
  WHERE marker.id=1
), keyed AS (
  SELECT source_occurrence.*,
    _giq_history_merge.history_id('pedassert-v2',concat_ws(':',
      import_run_id,artifact_sha256,source_provider,source_id,
      source_file,source_line::text,relationship,evidence_sha256
    )) AS occurrence_id
  FROM source_occurrence
)
INSERT INTO _giq_history_stage.authoritative_pedigree_assertion_occurrence
SELECT occurrence_id,import_run_id,artifact_sha256,source_provider,source_file,
       source_line,source_id,relationship,evidence_sha256,subject_source_id,
       parent_source_id,staged_subject_dog_id,staged_parent_dog_id,
       source_conflict,source_impossible,corroboration_only,stable_bridge,
       evidence_payload
FROM keyed;

CREATE INDEX authoritative_pedigree_occurrence_subject_idx
  ON _giq_history_stage.authoritative_pedigree_assertion_occurrence
     (source_provider,subject_source_id,relationship);
CREATE INDEX authoritative_pedigree_occurrence_parent_idx
  ON _giq_history_stage.authoritative_pedigree_assertion_occurrence
     (source_provider,parent_source_id);

DO $$
DECLARE
  expected_occurrences bigint;
  observed_occurrences bigint;
BEGIN
  SELECT (SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge)+
         (SELECT count(*) FROM _giq_history_stage.galtd_assertion)
  INTO expected_occurrences;
  SELECT count(*) INTO observed_occurrences
  FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence;

  IF observed_occurrences<>expected_occurrences THEN
    RAISE EXCEPTION 'pedigree assertion occurrence accounting changed: expected %, observed %',
      expected_occurrences,observed_occurrences;
  END IF;
  IF EXISTS(
    SELECT 1
    FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence
    WHERE source_provider='galtd' AND (NOT corroboration_only OR stable_bridge)
  ) THEN
    RAISE EXCEPTION 'GALTD source occurrences must remain corroboration-only without a stable bridge';
  END IF;
END
$$;

-- Operator-supplied evidence is append-only. It must come from production or
-- an explicitly approved provider export/API/manual authoritative document.
-- Names, dates and parent names are search dimensions, never identity proof.
CREATE TABLE _giq_history_stage.authoritative_identity_evidence (
  evidence_id text PRIMARY KEY,
  supersedes_evidence_id text
    REFERENCES _giq_history_stage.authoritative_identity_evidence(evidence_id),
  source_provider text NOT NULL REFERENCES _giq_history_stage.authoritative_provider_policy(source_provider),
  source_id text NOT NULL,
  asserted_canonical_dog_id text,
  registry_token text,
  ear_brand text,
  source_name text NOT NULL,
  observed_whelp_date date,
  asserted_sire_name text,
  asserted_dam_name text,
  artifact_uri text NOT NULL,
  artifact_sha256 text NOT NULL CHECK(artifact_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  verification_status text NOT NULL CHECK(verification_status IN (
    'parsed','verified','conflict','rejected'
  )),
  verification_method text NOT NULL CHECK(verification_method IN (
    'production-record','provider-export','provider-api',
    'manual-authoritative-document','dna-parentage-certificate','parsed-observation'
  )),
  usage_approval_ref text,
  corroboration_only boolean NOT NULL DEFAULT false,
  stable_bridge boolean NOT NULL DEFAULT false,
  observed_at timestamptz NOT NULL,
  evidence_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(source_provider,source_id,artifact_sha256),
  CHECK(nullif(btrim(source_id),'') IS NOT NULL),
  CHECK(nullif(btrim(source_name),'') IS NOT NULL),
  CHECK(verification_status <> 'verified'
    OR verification_method <> 'parsed-observation'),
  CHECK(verification_status <> 'verified'
    OR source_provider = 'production'
    OR nullif(btrim(usage_approval_ref),'') IS NOT NULL),
  CHECK(NOT (corroboration_only AND stable_bridge)),
  CHECK(supersedes_evidence_id IS NULL OR supersedes_evidence_id<>evidence_id)
);

CREATE TABLE _giq_history_stage.authoritative_pedigree_evidence (
  assertion_id text PRIMARY KEY,
  occurrence_id text NOT NULL
    REFERENCES _giq_history_stage.authoritative_pedigree_assertion_occurrence(occurrence_id),
  supersedes_assertion_id text
    REFERENCES _giq_history_stage.authoritative_pedigree_evidence(assertion_id),
  subject_evidence_id text NOT NULL REFERENCES _giq_history_stage.authoritative_identity_evidence(evidence_id),
  relationship text NOT NULL CHECK(relationship IN ('sire','dam')),
  parent_evidence_id text REFERENCES _giq_history_stage.authoritative_identity_evidence(evidence_id),
  asserted_parent_source_provider text REFERENCES _giq_history_stage.authoritative_provider_policy(source_provider),
  asserted_parent_source_id text,
  asserted_parent_name text NOT NULL,
  artifact_sha256 text NOT NULL CHECK(artifact_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  verification_status text NOT NULL CHECK(verification_status IN (
    'parsed','verified','conflict','rejected'
  )),
  corroboration_only boolean NOT NULL DEFAULT false,
  stable_bridge boolean NOT NULL DEFAULT false,
  evidence_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(occurrence_id,evidence_sha256),
  CHECK(nullif(btrim(asserted_parent_name),'') IS NOT NULL),
  CHECK((asserted_parent_source_provider IS NULL) = (asserted_parent_source_id IS NULL)),
  CHECK(NOT (corroboration_only AND stable_bridge)),
  CHECK(supersedes_assertion_id IS NULL OR supersedes_assertion_id<>assertion_id)
);

CREATE TABLE _giq_history_stage.authoritative_consolidation_proof (
  proof_id text PRIMARY KEY,
  evidence_id text NOT NULL REFERENCES _giq_history_stage.authoritative_identity_evidence(evidence_id),
  surviving_dog_id text NOT NULL,
  duplicate_dog_id text NOT NULL,
  authoritative_duplicate_proof boolean NOT NULL DEFAULT false,
  unique_verified_fields_merged boolean NOT NULL DEFAULT false,
  all_references_redirected boolean NOT NULL DEFAULT false,
  relationship_integrity_verified boolean NOT NULL DEFAULT false,
  no_data_loss_verified boolean NOT NULL DEFAULT false,
  merge_ledger_recorded boolean NOT NULL DEFAULT false,
  release_eligible boolean GENERATED ALWAYS AS (
    authoritative_duplicate_proof
    AND unique_verified_fields_merged
    AND all_references_redirected
    AND relationship_integrity_verified
    AND no_data_loss_verified
    AND merge_ledger_recorded
  ) STORED,
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(surviving_dog_id <> duplicate_dog_id)
);

CREATE TABLE _giq_history_stage.authoritative_pedigree_terminal_proof (
  proof_id text PRIMARY KEY,
  occurrence_id text NOT NULL
    REFERENCES _giq_history_stage.authoritative_pedigree_assertion_occurrence(occurrence_id),
  supersedes_proof_id text
    REFERENCES _giq_history_stage.authoritative_pedigree_terminal_proof(proof_id),
  terminal_disposition text NOT NULL CHECK(terminal_disposition IN (
    'terminal_invalid_impossible','terminal_superseded_conflict',
    'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
  )),
  canonical_safety_blocking boolean NOT NULL DEFAULT true,
  coverage_blocking boolean NOT NULL DEFAULT true,
  canonical_contribution_count bigint NOT NULL CHECK(canonical_contribution_count>=0),
  canonical_evidence_sha256 text NOT NULL CHECK(canonical_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  coverage_evidence_sha256 text NOT NULL CHECK(coverage_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(occurrence_id,canonical_evidence_sha256,coverage_evidence_sha256),
  CHECK(supersedes_proof_id IS NULL OR supersedes_proof_id<>proof_id),
  CHECK(canonical_safety_blocking OR coverage_blocking OR canonical_contribution_count=0)
);

CREATE OR REPLACE FUNCTION _giq_history_merge.reject_authoritative_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authoritative evidence is append-only; create a superseding evidence row';
END
$$;

CREATE TRIGGER authoritative_identity_evidence_append_only
BEFORE UPDATE OR DELETE ON _giq_history_stage.authoritative_identity_evidence
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_authoritative_evidence_mutation();

CREATE TRIGGER authoritative_pedigree_evidence_append_only
BEFORE UPDATE OR DELETE ON _giq_history_stage.authoritative_pedigree_evidence
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_authoritative_evidence_mutation();

CREATE TRIGGER authoritative_consolidation_proof_append_only
BEFORE UPDATE OR DELETE ON _giq_history_stage.authoritative_consolidation_proof
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_authoritative_evidence_mutation();

CREATE TRIGGER authoritative_pedigree_occurrence_append_only
BEFORE UPDATE OR DELETE ON _giq_history_stage.authoritative_pedigree_assertion_occurrence
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_authoritative_evidence_mutation();

CREATE TRIGGER authoritative_pedigree_terminal_proof_append_only
BEFORE UPDATE OR DELETE ON _giq_history_stage.authoritative_pedigree_terminal_proof
FOR EACH ROW EXECUTE FUNCTION _giq_history_merge.reject_authoritative_evidence_mutation();

-- Search the entire candidate through every available stable identifier plus
-- weak descriptive dimensions. Weak matches remain visible so that a strong
-- provider-key match cannot silently hide a possible duplicate.
CREATE VIEW _giq_history_stage.authoritative_identity_candidate_search AS
WITH candidate(
  source_evidence_id,dog_id,match_basis,strong_identity_proof,
  corroboration_only,stable_bridge
) AS (
  SELECT evidence.evidence_id,dog.id,'asserted-canonical-dog-id',true,false,true
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."Dog" dog ON dog.id=evidence.asserted_canonical_dog_id
  UNION ALL
  SELECT evidence.evidence_id,dog.id,'canonical-provider-source-key',true,false,true
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."Dog" dog
    ON lower(dog."sourceProvider")=evidence.source_provider
   AND dog."sourceId"=evidence.source_id
  UNION ALL
  SELECT evidence.evidence_id,identity."dogId",'source-identity-provider-key',true,false,true
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."DogSourceIdentity" identity
    ON lower(identity."sourceProvider")=evidence.source_provider
   AND identity."sourceId"=evidence.source_id
  JOIN public."PedigreeImportRun" import_run
    ON import_run.id=identity."importRunId"
   AND import_run."sourceProvider"=identity."sourceProvider"
   AND import_run."artifactSha256"=identity."artifactSha256"
  WHERE identity."dogId" IS NOT NULL
    AND identity."verificationStatus"='verified'
    AND import_run."verificationStatus"='verified'
    AND import_run.status='merged'
  UNION ALL
  SELECT evidence.evidence_id,identity."dogId",'source-identity-registry-token',false,true,false
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."DogSourceIdentity" identity
    ON lower(identity."sourceProvider")=evidence.source_provider
   AND identity."registryToken"=evidence.registry_token
  WHERE evidence.registry_token IS NOT NULL AND identity."dogId" IS NOT NULL
  UNION ALL
  SELECT evidence.evidence_id,dog.id,'ear-brand',false,true,false
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."Dog" dog ON lower(dog."earBrand")=lower(evidence.ear_brand)
  WHERE evidence.ear_brand IS NOT NULL
  UNION ALL
  SELECT evidence.evidence_id,dog.id,'normalized-name-and-whelp-date',false,true,false
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."Dog" dog
    ON _giq_history_merge.slug(dog.name)=_giq_history_merge.slug(evidence.source_name)
   AND dog."whelpDate"::date=evidence.observed_whelp_date
  WHERE evidence.observed_whelp_date IS NOT NULL
  UNION ALL
  SELECT evidence.evidence_id,dog.id,'normalized-name-date-and-parent-names',false,true,false
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."Dog" dog
    ON _giq_history_merge.slug(dog.name)=_giq_history_merge.slug(evidence.source_name)
   AND dog."whelpDate"::date=evidence.observed_whelp_date
  JOIN public."Dog" sire ON sire.id=dog."sireId"
  JOIN public."Dog" dam ON dam.id=dog."damId"
  WHERE evidence.observed_whelp_date IS NOT NULL
    AND evidence.asserted_sire_name IS NOT NULL
    AND evidence.asserted_dam_name IS NOT NULL
    AND _giq_history_merge.slug(sire.name)=_giq_history_merge.slug(evidence.asserted_sire_name)
    AND _giq_history_merge.slug(dam.name)=_giq_history_merge.slug(evidence.asserted_dam_name)
  UNION ALL
  SELECT evidence.evidence_id,dog.id,'source-occurrence',false,true,false
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN _giq_history_stage.authoritative_pedigree_assertion_occurrence occurrence
    ON occurrence.source_provider=evidence.source_provider
   AND (
     occurrence.subject_source_id=evidence.source_id
     OR occurrence.parent_source_id=evidence.source_id
     OR occurrence.subject_source_id='thedogs:dog:' || evidence.source_id
     OR occurrence.parent_source_id='thedogs:dog:' || evidence.source_id
   )
  JOIN public."Dog" dog ON dog.id=CASE
    WHEN occurrence.subject_source_id=evidence.source_id
      OR occurrence.subject_source_id='thedogs:dog:' || evidence.source_id
      THEN occurrence.staged_subject_dog_id
    ELSE occurrence.staged_parent_dog_id
  END
)
SELECT source_evidence_id,dog_id,
       array_agg(DISTINCT match_basis ORDER BY match_basis) AS match_basis,
       bool_or(strong_identity_proof) AS strong_identity_proof,
       bool_and(corroboration_only) AS corroboration_only,
       bool_or(stable_bridge) AS stable_bridge
FROM candidate
GROUP BY source_evidence_id,dog_id;

CREATE VIEW _giq_history_stage.authoritative_identity_resolution AS
WITH counts AS (
  SELECT evidence.evidence_id,
    count(search.dog_id)::integer AS candidate_count,
    count(search.dog_id) FILTER(WHERE search.strong_identity_proof)::integer AS strong_candidate_count,
    count(search.dog_id) FILTER(WHERE search.stable_bridge)::integer AS stable_bridge_candidate_count,
    count(search.dog_id) FILTER(WHERE search.corroboration_only)::integer AS corroboration_candidate_count,
    min(search.dog_id) FILTER(WHERE search.strong_identity_proof) AS strong_dog_id,
    coalesce(jsonb_object_agg(search.dog_id,search.match_basis)
      FILTER(WHERE search.dog_id IS NOT NULL),'{}'::jsonb) AS candidate_evidence
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  LEFT JOIN _giq_history_stage.authoritative_identity_candidate_search search
    ON search.source_evidence_id=evidence.evidence_id
  GROUP BY evidence.evidence_id
)
  SELECT evidence.*,
       policy.authority_rank,counts.candidate_count,counts.strong_candidate_count,
       counts.stable_bridge_candidate_count,counts.corroboration_candidate_count,
       CASE WHEN counts.strong_candidate_count=1 AND counts.candidate_count=1
                  AND counts.stable_bridge_candidate_count=1
             THEN counts.strong_dog_id END AS resolved_dog_id,
       (evidence.verification_status='verified'
         AND counts.strong_candidate_count=1
         AND counts.candidate_count=1
         AND counts.stable_bridge_candidate_count=1) AS exact_existing_identity_verified,
       counts.candidate_evidence,
       CASE
         WHEN evidence.verification_status IN ('conflict','rejected')
           THEN 'quarantined-invalid-or-conflicting-evidence'
         WHEN evidence.verification_status<>'verified'
           THEN 'provider-retrieval-required'
         WHEN policy.usage_approval_required AND nullif(btrim(evidence.usage_approval_ref),'') IS NULL
           THEN 'provider-usage-approval-required'
          WHEN counts.strong_candidate_count>1 OR counts.candidate_count>1
            OR counts.stable_bridge_candidate_count>1
            THEN 'quarantined-ambiguous-existing-identity'
          WHEN counts.strong_candidate_count=1 AND counts.candidate_count=1
               AND counts.stable_bridge_candidate_count=1
            THEN 'verified-existing-identity-candidate'
         WHEN counts.candidate_count=0 AND policy.can_establish_new_identity
           THEN 'verified-new-identity-candidate'
         ELSE 'provider-retrieval-required'
       END AS disposition,
       false AS canonical_write_eligible,
       false AS quarantine_release_eligible
FROM _giq_history_stage.authoritative_identity_evidence evidence
JOIN _giq_history_stage.authoritative_provider_policy policy USING(source_provider)
JOIN counts USING(evidence_id);

-- Existing production pedigree is authority only when a verified assertion,
-- import run and merge-ledger entry all bind the currently stored relationship.
CREATE VIEW _giq_history_stage.verified_production_pedigree_authority AS
SELECT
  ledger."dogId" AS dog_id,
  ledger.relationship,
  parent_identity."dogId" AS parent_dog_id,
  ledger.id AS ledger_id,
  ledger.decision,
  assertion.id AS winning_assertion_id,
  assertion."sourceAuthority" AS source_authority
FROM public."PedigreeMergeLedger" ledger
JOIN public."PedigreeAssertion" assertion
  ON assertion.id=coalesce(ledger."winningAssertionId",ledger."assertionId")
JOIN public."PedigreeImportRun" import_run
  ON import_run.id=assertion."importRunId"
 AND import_run."sourceProvider"=assertion."sourceProvider"
 AND import_run."artifactSha256"=assertion."artifactSha256"
JOIN public."DogSourceIdentity" subject_identity
  ON subject_identity.id=assertion."subjectIdentityId"
 AND subject_identity."dogId"=ledger."dogId"
JOIN public."DogSourceIdentity" parent_identity
  ON parent_identity.id=assertion."parentIdentityId"
JOIN public."Dog" dog ON dog.id=ledger."dogId"
WHERE ledger."verificationStatus"='verified'
  AND ledger.decision IN ('accepted','applied','no_change','verified')
  AND assertion."verificationStatus"='verified'
  AND import_run."verificationStatus"='verified'
  AND import_run.status='merged'
  AND subject_identity."verificationStatus"='verified'
  AND parent_identity."verificationStatus"='verified'
  AND parent_identity."dogId" IS NOT NULL
  AND CASE ledger.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END
      =parent_identity."dogId";

-- Safe source-only terminal rows receive an append-only proof. Any canonical
-- contribution leaves both gates blocking and therefore cannot release.
WITH matching_assertion AS MATERIALIZED (
  SELECT occurrence.occurrence_id,assertion.id AS assertion_id
  FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence occurrence
  JOIN public."PedigreeAssertion" assertion
    ON assertion.id=occurrence.occurrence_id
    OR (
      assertion."importRunId"=occurrence.import_run_id
      AND lower(assertion."sourceProvider")=occurrence.source_provider
      AND assertion."artifactSha256"=occurrence.artifact_sha256
      AND assertion.relationship=occurrence.relationship
      AND assertion."evidenceSha256"=occurrence.evidence_sha256
    )
), assertion_count AS (
  SELECT occurrence_id,count(DISTINCT assertion_id)::bigint AS rows
  FROM matching_assertion GROUP BY occurrence_id
), ledger_count AS (
  SELECT matching_assertion.occurrence_id,count(DISTINCT ledger.id)::bigint AS rows
  FROM matching_assertion
  JOIN public."PedigreeMergeLedger" ledger
    ON ledger."assertionId"=matching_assertion.assertion_id
    OR ledger."winningAssertionId"=matching_assertion.assertion_id
  GROUP BY matching_assertion.occurrence_id
), canonical_contribution AS MATERIALIZED (
  SELECT occurrence.occurrence_id,
    (coalesce(assertion_count.rows,0)+coalesce(ledger_count.rows,0) +
     CASE WHEN occurrence.source_impossible AND
       (CASE occurrence.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
         =occurrence.staged_parent_dog_id THEN 1 ELSE 0 END)::bigint AS contribution_count
  FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence occurrence
  LEFT JOIN assertion_count USING(occurrence_id)
  LEFT JOIN ledger_count USING(occurrence_id)
  LEFT JOIN public."Dog" dog ON dog.id=occurrence.staged_subject_dog_id
), terminal_candidate AS MATERIALIZED (
  SELECT occurrence.*,canonical_contribution.contribution_count,
    CASE
      WHEN occurrence.source_impossible THEN 'terminal_invalid_impossible'
      WHEN occurrence.source_conflict THEN 'terminal_unlinked_conflict_covered'
      ELSE 'terminal_corroboration_only_covered'
    END AS terminal_disposition,
    (occurrence.source_impossible AND EXISTS(
      SELECT 1 FROM _giq_history_merge.quarantine quarantine
      WHERE quarantine.source_name='normalized-export'
        AND quarantine.entity_type='pedigree-edge'
        AND quarantine.source_key=occurrence.source_id
        AND quarantine.reason_code='self-parent'
    )) OR (
      occurrence.source_provider='galtd'
      AND occurrence.corroboration_only
      AND NOT occurrence.stable_bridge
    ) AS coverage_verified
  FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence occurrence
  JOIN canonical_contribution USING(occurrence_id)
  WHERE occurrence.source_impossible
     OR (occurrence.source_provider='galtd' AND occurrence.corroboration_only
         AND NOT occurrence.stable_bridge)
), proof AS (
  SELECT terminal_candidate.*,
    encode(digest(jsonb_build_object(
      'occurrenceId',occurrence_id,
      'canonicalContributionCount',contribution_count,
      'terminalDisposition',terminal_disposition
    )::text,'sha256'),'hex') AS canonical_evidence_sha256,
    encode(digest(jsonb_build_object(
      'occurrenceId',occurrence_id,
      'artifactSha256',artifact_sha256,
      'sourceFile',source_file,
      'sourceLine',source_line,
      'evidenceSha256',evidence_sha256,
      'coverageVerified',coverage_verified
    )::text,'sha256'),'hex') AS coverage_evidence_sha256
  FROM terminal_candidate
)
INSERT INTO _giq_history_stage.authoritative_pedigree_terminal_proof
  (proof_id,occurrence_id,terminal_disposition,canonical_safety_blocking,
   coverage_blocking,canonical_contribution_count,canonical_evidence_sha256,
   coverage_evidence_sha256,evidence_payload)
SELECT
  _giq_history_merge.history_id('pedterminal-v2',concat_ws(':',
    occurrence_id,terminal_disposition,canonical_evidence_sha256,coverage_evidence_sha256
  )),
  occurrence_id,terminal_disposition,contribution_count<>0,NOT coverage_verified,
  contribution_count,canonical_evidence_sha256,coverage_evidence_sha256,
  jsonb_build_object(
    'importRunId',import_run_id,'artifactSha256',artifact_sha256,
    'sourceProvider',source_provider,'sourceId',source_id,
    'sourceFile',source_file,'sourceLine',source_line,
    'relationship',relationship,'evidenceSha256',evidence_sha256,
    'corroborationOnly',corroboration_only,'stableBridge',stable_bridge
  )
FROM proof;

CREATE VIEW _giq_history_stage.authoritative_pedigree_evidence_leaf AS
SELECT evidence.*
FROM _giq_history_stage.authoritative_pedigree_evidence evidence
WHERE NOT EXISTS(
  SELECT 1 FROM _giq_history_stage.authoritative_pedigree_evidence superseding
  WHERE superseding.supersedes_assertion_id=evidence.assertion_id
);

CREATE VIEW _giq_history_stage.authoritative_pedigree_terminal_proof_leaf AS
SELECT proof.*
FROM _giq_history_stage.authoritative_pedigree_terminal_proof proof
WHERE NOT EXISTS(
  SELECT 1 FROM _giq_history_stage.authoritative_pedigree_terminal_proof superseding
  WHERE superseding.supersedes_proof_id=proof.proof_id
);

CREATE VIEW _giq_history_stage.authoritative_pedigree_resolution AS
WITH evidence_count AS (
  SELECT occurrence_id,count(*)::integer AS leaf_count,min(assertion_id) AS assertion_id
  FROM _giq_history_stage.authoritative_pedigree_evidence_leaf
  GROUP BY occurrence_id
), proof_count AS (
  SELECT occurrence_id,count(*)::integer AS leaf_count,min(proof_id) AS proof_id
  FROM _giq_history_stage.authoritative_pedigree_terminal_proof_leaf
  GROUP BY occurrence_id
), resolved AS (
  SELECT occurrence.*,
    evidence.assertion_id,
    coalesce(evidence_count.leaf_count,0) AS evidence_leaf_count,
    evidence.verification_status AS evidence_verification_status,
    evidence.corroboration_only AS evidence_corroboration_only,
    evidence.stable_bridge AS evidence_stable_bridge,
    subject.resolved_dog_id AS subject_dog_id,
    parent.resolved_dog_id AS parent_dog_id,
    coalesce(subject.candidate_count,0) AS subject_candidate_count,
    coalesce(subject.strong_candidate_count,0) AS subject_strong_candidate_count,
    coalesce(subject.stable_bridge_candidate_count,0)
      AS subject_stable_bridge_candidate_count,
    coalesce(parent.candidate_count,0) AS parent_candidate_count,
    coalesce(parent.strong_candidate_count,0) AS parent_strong_candidate_count,
    coalesce(parent.stable_bridge_candidate_count,0)
      AS parent_stable_bridge_candidate_count,
    coalesce(subject.exact_existing_identity_verified,false)
      AS subject_exact_identity_verified,
    coalesce(parent.exact_existing_identity_verified,false)
      AS parent_exact_identity_verified,
    CASE occurrence.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END
      AS existing_parent_dog_id,
    coalesce(proof_count.leaf_count,0) AS terminal_proof_leaf_count,
    proof.terminal_disposition,
    proof.canonical_safety_blocking AS terminal_canonical_safety_blocking,
    proof.coverage_blocking AS terminal_coverage_blocking,
    proof.canonical_contribution_count,
    authority.authority_row_count,
    authority.authority_parent_count,
    authority.authority_parent_dog_id,
    authority.applied_authority,
    authority.no_change_authority
  FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence occurrence
  LEFT JOIN evidence_count ON evidence_count.occurrence_id=occurrence.occurrence_id
  LEFT JOIN _giq_history_stage.authoritative_pedigree_evidence_leaf evidence
    ON evidence.assertion_id=evidence_count.assertion_id AND evidence_count.leaf_count=1
  LEFT JOIN _giq_history_stage.authoritative_identity_resolution subject
    ON subject.evidence_id=evidence.subject_evidence_id
  LEFT JOIN _giq_history_stage.authoritative_identity_resolution parent
    ON parent.evidence_id=evidence.parent_evidence_id
  LEFT JOIN public."Dog" dog ON dog.id=subject.resolved_dog_id
  LEFT JOIN proof_count ON proof_count.occurrence_id=occurrence.occurrence_id
  LEFT JOIN _giq_history_stage.authoritative_pedigree_terminal_proof_leaf proof
    ON proof.proof_id=proof_count.proof_id AND proof_count.leaf_count=1
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS authority_row_count,
      count(DISTINCT verified.parent_dog_id)::integer AS authority_parent_count,
      min(verified.parent_dog_id) AS authority_parent_dog_id,
      bool_or(verified.decision IN ('accepted','applied')) AS applied_authority,
      bool_or(verified.decision IN ('no_change','verified')) AS no_change_authority
    FROM _giq_history_stage.verified_production_pedigree_authority verified
    WHERE verified.dog_id=subject.resolved_dog_id
      AND verified.relationship=occurrence.relationship
  ) authority ON true
), cycle_risk AS (
  SELECT resolved.occurrence_id,
    EXISTS(
      WITH RECURSIVE ancestry(id,path) AS (
        SELECT resolved.parent_dog_id,ARRAY[resolved.parent_dog_id]
        WHERE resolved.parent_dog_id IS NOT NULL
        UNION ALL
        SELECT parent.id,ancestry.path || parent.id
        FROM ancestry
        JOIN public."Dog" node ON node.id=ancestry.id
        CROSS JOIN LATERAL (VALUES(node."sireId"),(node."damId")) edge(parent_id)
        JOIN public."Dog" parent ON parent.id=edge.parent_id
        WHERE NOT parent.id=ANY(ancestry.path)
      )
      SELECT 1 FROM ancestry WHERE id=resolved.subject_dog_id
    ) AS creates_cycle
  FROM resolved
), facts AS (
  SELECT resolved.*,cycle_risk.creates_cycle,
    (resolved.subject_candidate_count=1
      AND resolved.subject_strong_candidate_count=1
      AND resolved.subject_stable_bridge_candidate_count=1
      AND resolved.parent_candidate_count=1
      AND resolved.parent_strong_candidate_count=1
      AND resolved.parent_stable_bridge_candidate_count=1)
      AS exact_candidate_cardinality_verified,
    (resolved.subject_exact_identity_verified
      AND resolved.parent_exact_identity_verified
      AND resolved.subject_dog_id IS NOT NULL
      AND resolved.parent_dog_id IS NOT NULL
      AND resolved.subject_candidate_count=1
      AND resolved.subject_strong_candidate_count=1
      AND resolved.subject_stable_bridge_candidate_count=1
      AND resolved.parent_candidate_count=1
      AND resolved.parent_strong_candidate_count=1
      AND resolved.parent_stable_bridge_candidate_count=1)
      AS exact_identities_verified,
    (resolved.evidence_leaf_count=1
      AND resolved.evidence_verification_status='verified'
      AND resolved.evidence_stable_bridge
      AND NOT coalesce(resolved.evidence_corroboration_only,false)) AS relationship_proof_verified,
    (resolved.evidence_leaf_count>1 OR resolved.terminal_proof_leaf_count>1
      OR (resolved.assertion_id IS NOT NULL AND resolved.relationship IS DISTINCT FROM (
        SELECT evidence.relationship
        FROM _giq_history_stage.authoritative_pedigree_evidence evidence
        WHERE evidence.assertion_id=resolved.assertion_id
      ))
      OR (resolved.subject_dog_id IS NOT NULL
          AND resolved.subject_dog_id=resolved.parent_dog_id)
      OR cycle_risk.creates_cycle) AS integrity_or_accounting_failure
  FROM resolved
  JOIN cycle_risk USING(occurrence_id)
), classified AS (
  SELECT facts.*,
    CASE
      WHEN integrity_or_accounting_failure
        OR (source_impossible AND terminal_proof_leaf_count<>1)
        THEN 'hard_integrity_or_accounting'
      WHEN terminal_proof_leaf_count=1 THEN terminal_disposition
      WHEN NOT exact_identities_verified THEN 'hard_identity_pending'
      WHEN NOT relationship_proof_verified THEN 'hard_relationship_pending'
      WHEN existing_parent_dog_id IS NOT NULL
           AND existing_parent_dog_id<>parent_dog_id THEN 'hard_authority_conflict'
      WHEN existing_parent_dog_id IS NULL
           AND exact_candidate_cardinality_verified
           AND NOT creates_cycle
           AND NOT source_conflict
           AND NOT source_impossible THEN 'verified_apply_candidate'
      WHEN existing_parent_dog_id IS NULL THEN 'hard_relationship_pending'
      WHEN authority_row_count<>1 OR authority_parent_count<>1
           OR authority_parent_dog_id IS DISTINCT FROM parent_dog_id
        THEN 'hard_relationship_pending'
      WHEN applied_authority THEN 'applied_verified'
      WHEN no_change_authority THEN 'verified_no_change'
      ELSE 'hard_integrity_or_accounting'
    END AS disposition
  FROM facts
)
SELECT classified.*,
  CASE
    WHEN disposition IN (
      'terminal_invalid_impossible','terminal_superseded_conflict',
      'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
    ) THEN coalesce(terminal_canonical_safety_blocking,true)
    WHEN disposition IN (
      'verified_apply_candidate','applied_verified','verified_no_change'
    ) THEN false
    ELSE true
  END AS canonical_safety_blocking,
  CASE
    WHEN disposition IN (
      'terminal_invalid_impossible','terminal_superseded_conflict',
      'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
    ) THEN coalesce(terminal_coverage_blocking,true)
    WHEN disposition IN (
      'verified_apply_candidate','applied_verified','verified_no_change'
    ) THEN false
    ELSE true
  END AS coverage_blocking,
  (disposition='verified_apply_candidate'
    AND exact_identities_verified AND exact_candidate_cardinality_verified
    AND relationship_proof_verified AND existing_parent_dog_id IS NULL
    AND NOT creates_cycle AND NOT source_conflict AND NOT source_impossible)
      AS canonical_write_eligible,
  (disposition IN (
      'terminal_invalid_impossible','terminal_superseded_conflict',
      'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
    )
    AND NOT coalesce(terminal_canonical_safety_blocking,true)
    AND NOT coalesce(terminal_coverage_blocking,true)) AS quarantine_release_eligible,
  CASE
    WHEN disposition='hard_identity_pending' THEN 'identity_pending'
    WHEN disposition='hard_relationship_pending' THEN 'relationship_pending'
    WHEN disposition='hard_authority_conflict' THEN 'authority_conflict'
    WHEN disposition='hard_integrity_or_accounting' AND (
      evidence_leaf_count>1 OR terminal_proof_leaf_count>1
    ) THEN 'accounting'
    WHEN disposition='hard_integrity_or_accounting' THEN 'canonical_integrity'
    WHEN disposition IN (
      'terminal_invalid_impossible','terminal_superseded_conflict',
      'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
    ) AND (coalesce(terminal_canonical_safety_blocking,true)
           OR coalesce(terminal_coverage_blocking,true)) THEN 'coverage'
    ELSE NULL
  END AS hard_blocker_class
FROM classified;

CREATE VIEW _giq_history_stage.authoritative_pedigree_conflict_ledger AS
SELECT occurrence_id,assertion_id,import_run_id,artifact_sha256,source_provider,
       source_file,source_line,source_id,evidence_sha256,relationship,subject_dog_id,
       existing_parent_dog_id,parent_dog_id AS proposed_parent_dog_id,
       authority_parent_dog_id,authority_row_count,disposition,
       canonical_safety_blocking,coverage_blocking,hard_blocker_class
FROM _giq_history_stage.authoritative_pedigree_resolution
WHERE disposition IN (
  'terminal_superseded_conflict','terminal_unlinked_conflict_covered',
  'hard_authority_conflict','hard_integrity_or_accounting'
);

-- Current local sources are classified without pretending that descriptive
-- composite matches prove identity. Every row remains blocking until a later
-- reviewed apply phase supplies authoritative evidence and complete merge proof.
CREATE TABLE _giq_history_stage.current_pedigree_quarantine AS
SELECT
  'thedogs'::text AS source_provider,
  'provider-stub'::text AS issue_type,
  dog.natural_key AS source_key,
  'provider-retrieval-required'::text AS disposition,
  true AS blocking,
  false AS quarantine_release_eligible,
  jsonb_build_object(
    'sourceId',dog.source_id,
    'sourceName',dog.name,
    'verificationClass',dog.verification_class,
    'searchProviders',jsonb_build_array(
      'production','greyhound_recorder','fasttrack','approved_fasttrack_resource'
    )
  ) AS evidence
FROM _giq_history_stage.normalized_dog dog
WHERE dog.verification_class='provider-stub'
UNION ALL
SELECT DISTINCT
  'thedogs',
  'race-observed-parent-profile-required',
  dog.natural_key,
  'provider-retrieval-required',
  true,false,
  jsonb_build_object(
    'sourceId',dog.source_id,
    'sourceName',dog.name,
    'verificationClass',dog.verification_class,
    'searchProviders',jsonb_build_array(
      'production','greyhound_recorder','fasttrack','approved_fasttrack_resource'
    )
  )
FROM _giq_history_stage.normalized_dog dog
JOIN _giq_history_stage.normalized_pedigree_edge edge
  ON edge.parent_id=dog.target_id
WHERE dog.verification_class='race-observed'
UNION ALL
SELECT
  'thedogs','self-parent',edge.natural_key,'quarantined-self-parent',true,false,
  edge.payload || jsonb_build_object('childId',edge.child_id,'parentId',edge.parent_id)
FROM _giq_history_stage.normalized_pedigree_edge edge
WHERE edge.self_parent
UNION ALL
SELECT
  'galtd','conflicting-source-observation',observation.payload->>'sourceId',
  'provider-retrieval-required',true,false,observation.payload
FROM _giq_history_stage.galtd_observation observation
WHERE observation.payload ? 'conflictGroup'
UNION ALL
SELECT
  'galtd','composite-crosswalk-candidate',
  crosswalk.galtd_source_id || ':' || crosswalk.child_natural_key,
  CASE
    WHEN crosswalk.higher_authority_conflict THEN 'preserved-production-conflict'
    WHEN crosswalk.thedogs_candidates<>1 OR crosswalk.galtd_candidates<>1
      THEN 'quarantined-ambiguous-composite-match'
    ELSE 'provider-retrieval-required'
  END,
  true,false,
  jsonb_build_object(
    'galtdSourceId',crosswalk.galtd_source_id,
    'theDogsNaturalKey',crosswalk.child_natural_key,
    'matchBasis','normalized-name-whelp-month-sire-name-dam-name',
    'theDogsCandidates',crosswalk.thedogs_candidates,
    'galtdCandidates',crosswalk.galtd_candidates,
    'higherAuthorityConflict',crosswalk.higher_authority_conflict
  )
FROM _giq_history_stage.galtd_exact_crosswalk crosswalk;

ALTER TABLE _giq_history_stage.current_pedigree_quarantine
  ADD PRIMARY KEY(source_provider,issue_type,source_key);

CREATE VIEW _giq_history_stage.authoritative_pedigree_retrieval_queue AS
SELECT source_provider,issue_type,source_key,disposition,evidence
FROM _giq_history_stage.current_pedigree_quarantine
WHERE disposition IN (
  'provider-retrieval-required','quarantined-ambiguous-composite-match',
  'preserved-production-conflict'
)
UNION ALL
SELECT source_provider,'identity-evidence',evidence_id,disposition,
  jsonb_build_object(
    'sourceId',source_id,'sourceName',source_name,'candidateCount',candidate_count,
    'strongCandidateCount',strong_candidate_count,'candidateEvidence',candidate_evidence
  )
FROM _giq_history_stage.authoritative_identity_resolution
WHERE disposition NOT IN (
  'verified-existing-identity-candidate','verified-new-identity-candidate'
)
UNION ALL
SELECT source_provider,'assertion-occurrence',occurrence_id,disposition,
  jsonb_build_object(
    'importRunId',import_run_id,'artifactSha256',artifact_sha256,
    'sourceFile',source_file,'sourceLine',source_line,'sourceId',source_id,
    'relationship',relationship,'evidenceSha256',evidence_sha256,
    'hardBlockerClass',hard_blocker_class
  )
FROM _giq_history_stage.authoritative_pedigree_resolution
WHERE hard_blocker_class IS NOT NULL;

DO $$
DECLARE
  provider_stubs bigint;
  race_observed_parents bigint;
  self_parents bigint;
  galtd_conflicts bigint;
  composite_rows bigint;
  expected_provider_stubs bigint;
  expected_race_observed_parents bigint;
  expected_self_parents bigint;
  expected_galtd_conflicts bigint;
  expected_composite_rows bigint;
  occurrence_rows bigint;
  disposition_rows bigint;
BEGIN
  SELECT count(*) FILTER(WHERE issue_type='provider-stub'),
         count(*) FILTER(WHERE issue_type='race-observed-parent-profile-required'),
         count(*) FILTER(WHERE issue_type='self-parent'),
         count(*) FILTER(WHERE issue_type='conflicting-source-observation'),
         count(*) FILTER(WHERE issue_type='composite-crosswalk-candidate')
  INTO provider_stubs,race_observed_parents,self_parents,galtd_conflicts,composite_rows
  FROM _giq_history_stage.current_pedigree_quarantine;

  SELECT count(*) INTO expected_provider_stubs
  FROM _giq_history_stage.normalized_dog
  WHERE verification_class='provider-stub';
  SELECT count(DISTINCT dog.natural_key) INTO expected_race_observed_parents
  FROM _giq_history_stage.normalized_dog dog
  JOIN _giq_history_stage.normalized_pedigree_edge edge
    ON edge.parent_id=dog.target_id
  WHERE dog.verification_class='race-observed';
  SELECT count(*) INTO expected_self_parents
  FROM _giq_history_stage.normalized_pedigree_edge
  WHERE self_parent;
  SELECT count(*) INTO expected_galtd_conflicts
  FROM _giq_history_stage.galtd_observation
  WHERE payload ? 'conflictGroup';
  SELECT count(*) INTO expected_composite_rows
  FROM _giq_history_stage.galtd_exact_crosswalk;

  IF provider_stubs<>expected_provider_stubs
     OR race_observed_parents<>expected_race_observed_parents
     OR self_parents<>expected_self_parents
     OR galtd_conflicts<>expected_galtd_conflicts
     OR composite_rows<>expected_composite_rows THEN
    RAISE EXCEPTION
      'pedigree quarantine inventory changed: provider stubs %, race-observed parents %, self parents %, GALTD conflicts %, composite rows %',
      provider_stubs,race_observed_parents,self_parents,galtd_conflicts,composite_rows;
  END IF;

  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.current_pedigree_quarantine
    WHERE NOT blocking OR quarantine_release_eligible
  ) OR EXISTS(
    SELECT 1 FROM _giq_history_stage.authoritative_identity_resolution
    WHERE canonical_write_eligible OR quarantine_release_eligible
  ) THEN
    RAISE EXCEPTION 'legacy quarantine or identity staging exposed an unsafe release path';
  END IF;

  SELECT count(*) INTO occurrence_rows
  FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence;
  SELECT count(*) INTO disposition_rows
  FROM _giq_history_stage.authoritative_pedigree_resolution;
  IF occurrence_rows<>disposition_rows THEN
    RAISE EXCEPTION 'pedigree v2 disposition accounting changed: occurrences %, dispositions %',
      occurrence_rows,disposition_rows;
  END IF;

  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE disposition NOT IN (
      'verified_apply_candidate','applied_verified','verified_no_change',
      'terminal_invalid_impossible',
      'terminal_superseded_conflict','terminal_unlinked_conflict_covered',
      'terminal_corroboration_only_covered','hard_identity_pending',
      'hard_relationship_pending','hard_authority_conflict',
      'hard_integrity_or_accounting'
    )
  ) THEN
    RAISE EXCEPTION 'pedigree v2 emitted an unknown or non-disjoint disposition';
  END IF;

  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE disposition IN (
      'terminal_invalid_impossible','terminal_superseded_conflict',
      'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
    )
      AND quarantine_release_eligible IS DISTINCT FROM
          (NOT canonical_safety_blocking AND NOT coverage_blocking)
  ) OR EXISTS(
    SELECT 1 FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE disposition NOT IN (
      'terminal_invalid_impossible','terminal_superseded_conflict',
      'terminal_unlinked_conflict_covered','terminal_corroboration_only_covered'
    ) AND quarantine_release_eligible
  ) THEN
    RAISE EXCEPTION 'pedigree terminal release requires both safety and coverage gates';
  END IF;

  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE canonical_write_eligible IS DISTINCT FROM (
      disposition='verified_apply_candidate'
      AND exact_identities_verified AND exact_candidate_cardinality_verified
      AND relationship_proof_verified AND existing_parent_dog_id IS NULL
      AND NOT creates_cycle AND NOT source_conflict AND NOT source_impossible
    ) OR (disposition='hard_relationship_pending' AND canonical_write_eligible)
  ) THEN
    RAISE EXCEPTION 'canonical relationship eligibility must be an exact verified apply candidate only';
  END IF;

  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE (disposition='applied_verified' AND (
      existing_parent_dog_id IS DISTINCT FROM parent_dog_id
      OR authority_row_count<>1 OR authority_parent_count<>1
      OR authority_parent_dog_id IS DISTINCT FROM parent_dog_id
      OR NOT coalesce(applied_authority,false)
    )) OR (disposition='verified_no_change' AND (
      existing_parent_dog_id IS DISTINCT FROM parent_dog_id
      OR authority_row_count<>1 OR authority_parent_count<>1
      OR authority_parent_dog_id IS DISTINCT FROM parent_dog_id
      OR NOT coalesce(no_change_authority,false)
    ))
  ) THEN
    RAISE EXCEPTION 'post-apply pedigree disposition lacks its verified canonical relationship ledger';
  END IF;

  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.galtd_exact_crosswalk
    WHERE canonical_eligible OR stable_bridge OR NOT corroboration_only
  ) THEN
    RAISE EXCEPTION 'descriptive GALTD/TheDogs composite matching must remain corroboration-only';
  END IF;
END
$$;

REVOKE ALL ON _giq_history_stage.authoritative_pedigree_assertion_occurrence FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.authoritative_identity_evidence FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.authoritative_pedigree_evidence FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.authoritative_consolidation_proof FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.authoritative_pedigree_terminal_proof FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.authoritative_provider_policy FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.current_pedigree_quarantine FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event','AUTHORITATIVE_PEDIGREE_RESOLUTION_STAGED',
  'database',current_database(),
  'providerStubs',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
    WHERE issue_type='provider-stub'),
  'raceObservedParents',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
    WHERE issue_type='race-observed-parent-profile-required'),
  'selfParents',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
    WHERE issue_type='self-parent'),
  'galtdConflicts',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
    WHERE issue_type='conflicting-source-observation'),
  'compositeCandidates',(SELECT count(*) FROM _giq_history_stage.current_pedigree_quarantine
    WHERE issue_type='composite-crosswalk-candidate'),
  'assertionOccurrences',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_assertion_occurrence),
  'dispositions',(SELECT jsonb_object_agg(disposition,rows ORDER BY disposition)
    FROM (SELECT disposition,count(*) AS rows
      FROM _giq_history_stage.authoritative_pedigree_resolution
      GROUP BY disposition) grouped),
  'canonicalWriteEligible',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE canonical_write_eligible),
  'terminalReleaseEligible',(SELECT count(*)
    FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE quarantine_release_eligible)
);
