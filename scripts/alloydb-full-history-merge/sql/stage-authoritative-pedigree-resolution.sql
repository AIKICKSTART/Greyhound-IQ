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
END
$$;

-- Operator-supplied evidence is append-only. It must come from production or
-- an explicitly approved provider export/API/manual authoritative document.
-- Names, dates and parent names are search dimensions, never identity proof.
CREATE TABLE _giq_history_stage.authoritative_identity_evidence (
  evidence_id text PRIMARY KEY,
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
    OR nullif(btrim(usage_approval_ref),'') IS NOT NULL)
);

CREATE TABLE _giq_history_stage.authoritative_pedigree_evidence (
  assertion_id text PRIMARY KEY,
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
  evidence_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(subject_evidence_id,relationship,artifact_sha256),
  CHECK(nullif(btrim(asserted_parent_name),'') IS NOT NULL),
  CHECK((asserted_parent_source_provider IS NULL) = (asserted_parent_source_id IS NULL))
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

-- Search the entire candidate through every available stable identifier plus
-- weak descriptive dimensions. Weak matches remain visible so that a strong
-- provider-key match cannot silently hide a possible duplicate.
CREATE VIEW _giq_history_stage.authoritative_identity_candidate_search AS
WITH candidate(source_evidence_id,dog_id,match_basis,strong_identity_proof) AS (
  SELECT evidence.evidence_id,dog.id,'asserted-canonical-dog-id',true
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."Dog" dog ON dog.id=evidence.asserted_canonical_dog_id
  UNION ALL
  SELECT evidence.evidence_id,dog.id,'canonical-provider-source-key',true
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."Dog" dog
    ON lower(dog."sourceProvider")=evidence.source_provider
   AND dog."sourceId"=evidence.source_id
  UNION ALL
  SELECT evidence.evidence_id,identity."dogId",'source-identity-provider-key',true
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."DogSourceIdentity" identity
    ON lower(identity."sourceProvider")=evidence.source_provider
   AND identity."sourceId"=evidence.source_id
  WHERE identity."dogId" IS NOT NULL
  UNION ALL
  SELECT evidence.evidence_id,identity."dogId",'source-identity-registry-token',true
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."DogSourceIdentity" identity
    ON lower(identity."sourceProvider")=evidence.source_provider
   AND identity."registryToken"=evidence.registry_token
  WHERE evidence.registry_token IS NOT NULL AND identity."dogId" IS NOT NULL
  UNION ALL
  SELECT evidence.evidence_id,dog.id,'ear-brand',false
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."Dog" dog ON lower(dog."earBrand")=lower(evidence.ear_brand)
  WHERE evidence.ear_brand IS NOT NULL
  UNION ALL
  SELECT evidence.evidence_id,dog.id,'normalized-name-and-whelp-date',false
  FROM _giq_history_stage.authoritative_identity_evidence evidence
  JOIN public."Dog" dog
    ON _giq_history_merge.slug(dog.name)=_giq_history_merge.slug(evidence.source_name)
   AND dog."whelpDate"::date=evidence.observed_whelp_date
  WHERE evidence.observed_whelp_date IS NOT NULL
  UNION ALL
  SELECT evidence.evidence_id,dog.id,'normalized-name-date-and-parent-names',false
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
)
SELECT source_evidence_id,dog_id,
       array_agg(DISTINCT match_basis ORDER BY match_basis) AS match_basis,
       bool_or(strong_identity_proof) AS strong_identity_proof
FROM candidate
GROUP BY source_evidence_id,dog_id;

CREATE VIEW _giq_history_stage.authoritative_identity_resolution AS
WITH counts AS (
  SELECT evidence.evidence_id,
    count(search.dog_id)::integer AS candidate_count,
    count(search.dog_id) FILTER(WHERE search.strong_identity_proof)::integer AS strong_candidate_count,
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
       CASE WHEN counts.strong_candidate_count=1 AND counts.candidate_count=1
            THEN counts.strong_dog_id END AS resolved_dog_id,
       counts.candidate_evidence,
       CASE
         WHEN evidence.verification_status IN ('conflict','rejected')
           THEN 'quarantined-invalid-or-conflicting-evidence'
         WHEN evidence.verification_status<>'verified'
           THEN 'provider-retrieval-required'
         WHEN policy.usage_approval_required AND nullif(btrim(evidence.usage_approval_ref),'') IS NULL
           THEN 'provider-usage-approval-required'
         WHEN counts.strong_candidate_count>1 OR counts.candidate_count>1
           THEN 'quarantined-ambiguous-existing-identity'
         WHEN counts.strong_candidate_count=1 AND counts.candidate_count=1
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

CREATE VIEW _giq_history_stage.authoritative_pedigree_resolution AS
WITH resolved AS (
  SELECT assertion.*,
    subject.resolved_dog_id AS subject_dog_id,
    parent.resolved_dog_id AS parent_dog_id,
    subject.disposition AS subject_disposition,
    parent.disposition AS parent_disposition,
    subject.authority_rank,
    CASE assertion.relationship
      WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END AS existing_parent_dog_id
  FROM _giq_history_stage.authoritative_pedigree_evidence assertion
  JOIN _giq_history_stage.authoritative_identity_resolution subject
    ON subject.evidence_id=assertion.subject_evidence_id
  LEFT JOIN _giq_history_stage.authoritative_identity_resolution parent
    ON parent.evidence_id=assertion.parent_evidence_id
  LEFT JOIN public."Dog" dog ON dog.id=subject.resolved_dog_id
), cycle_risk AS (
  SELECT resolved.assertion_id,
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
)
SELECT resolved.*,
  cycle_risk.creates_cycle,
  CASE
    WHEN resolved.verification_status IN ('conflict','rejected')
      THEN 'quarantined-invalid-or-conflicting-assertion'
    WHEN resolved.verification_status<>'verified'
      THEN 'provider-retrieval-required'
    WHEN resolved.subject_dog_id IS NULL OR resolved.parent_dog_id IS NULL
      THEN 'provider-retrieval-required'
    WHEN resolved.subject_dog_id=resolved.parent_dog_id
      THEN 'quarantined-self-parent'
    WHEN cycle_risk.creates_cycle
      THEN 'quarantined-ancestry-cycle-risk'
    WHEN resolved.existing_parent_dog_id=resolved.parent_dog_id
      THEN 'verified-no-change-candidate'
    WHEN resolved.existing_parent_dog_id IS NOT NULL
      THEN 'preserved-production-conflict'
    ELSE 'verified-missing-parent-candidate'
  END AS disposition,
  false AS canonical_write_eligible,
  false AS quarantine_release_eligible
FROM resolved
JOIN cycle_risk USING(assertion_id);

CREATE VIEW _giq_history_stage.authoritative_pedigree_conflict_ledger AS
SELECT assertion_id,subject_evidence_id,relationship,subject_dog_id,
       existing_parent_dog_id,parent_dog_id AS proposed_parent_dog_id,
       authority_rank,verification_status,disposition,evidence_sha256,
       created_at AS observed_at
FROM _giq_history_stage.authoritative_pedigree_resolution
WHERE disposition IN (
  'quarantined-invalid-or-conflicting-assertion',
  'quarantined-self-parent',
  'quarantined-ancestry-cycle-risk',
  'preserved-production-conflict'
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
);

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
  ) OR EXISTS(
    SELECT 1 FROM _giq_history_stage.authoritative_pedigree_resolution
    WHERE canonical_write_eligible OR quarantine_release_eligible
  ) THEN
    RAISE EXCEPTION 'authoritative pedigree staging exposed an apply or quarantine-release path';
  END IF;

  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.galtd_exact_crosswalk WHERE canonical_eligible
  ) THEN
    RAISE EXCEPTION 'descriptive GALTD/TheDogs composite matching cannot be canonical eligible';
  END IF;
END
$$;

REVOKE ALL ON _giq_history_stage.authoritative_identity_evidence FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.authoritative_pedigree_evidence FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.authoritative_consolidation_proof FROM PUBLIC;
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
  'canonicalWrites',0,
  'quarantineReleases',0
);
