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
    RAISE EXCEPTION 'non-pedigree saturation database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id=1 FOR UPDATE;
  IF observed_phase<>'normalized' THEN
    RAISE EXCEPTION 'non-pedigree saturation requires normalized, observed %',observed_phase;
  END IF;
  IF to_regclass('public."DogSourceIdentity"') IS NULL THEN
    RAISE EXCEPTION 'non-pedigree saturation requires the source-identity migration';
  END IF;
  IF EXISTS(
    SELECT 1 FROM _giq_history_merge.export_dataset_manifest
    WHERE dataset IN ('profiles','profile_forms','races','runners','duplicates','orphans','quarantine')
      AND (observed_rows IS DISTINCT FROM expected_rows OR staged_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'non-pedigree saturation requires fully verified normalized inputs';
  END IF;
  IF (SELECT count(*) FROM _giq_history_merge.export_dataset_manifest
      WHERE dataset IN ('profiles','profile_forms','races','runners','duplicates','orphans','quarantine'))<>7 THEN
    RAISE EXCEPTION 'non-pedigree saturation source manifest is incomplete';
  END IF;
END
$$;

CREATE TEMP TABLE giq_nonpedigree_exact_dog_candidate ON COMMIT DROP AS
SELECT DISTINCT candidate.natural_key,candidate.dog_id,candidate.evidence_kind
FROM (
  SELECT n.natural_key,d.id AS dog_id,'Dog.sourceProvider/sourceId'::text AS evidence_kind
  FROM _giq_history_stage.normalized_dog n
  JOIN public."Dog" d
    ON n.source_provider IS NOT NULL AND n.source_id IS NOT NULL
   AND lower(btrim(d."sourceProvider"))=lower(btrim(n.source_provider))
   AND d."sourceId"=n.source_id
  UNION ALL
  SELECT n.natural_key,d.id,'Dog.earBrand'
  FROM _giq_history_stage.normalized_dog n
  JOIN public."Dog" d
    ON lower(btrim(n.source_provider))='thedogs'
   AND n.source_id IS NOT NULL
   AND d."earBrand"='thedogs:' || n.source_id
  UNION ALL
  SELECT n.natural_key,identity."dogId",'DogSourceIdentity.' || identity."verificationStatus"
  FROM _giq_history_stage.normalized_dog n
  JOIN public."DogSourceIdentity" identity
    ON n.source_provider IS NOT NULL AND n.source_id IS NOT NULL
   AND lower(btrim(identity."sourceProvider"))=lower(btrim(n.source_provider))
   AND identity."sourceId"=n.source_id
  WHERE identity."dogId" IS NOT NULL
) candidate;

CREATE INDEX giq_nonpedigree_exact_dog_candidate_key_idx
  ON giq_nonpedigree_exact_dog_candidate(natural_key,dog_id);

CREATE TEMP TABLE giq_nonpedigree_identity_claim ON COMMIT DROP AS
SELECT
  n.natural_key,
  count(identity.id) AS claim_count,
  count(*) FILTER(WHERE identity.id IS NOT NULL AND identity."dogId" IS NULL)
    AS unlinked_claim_count,
  count(*) FILTER(WHERE identity.id IS NOT NULL
    AND identity."verificationStatus"<>'verified') AS nonverified_claim_count
FROM _giq_history_stage.normalized_dog n
LEFT JOIN public."DogSourceIdentity" identity
  ON n.source_provider IS NOT NULL AND n.source_id IS NOT NULL
 AND lower(btrim(identity."sourceProvider"))=lower(btrim(n.source_provider))
 AND identity."sourceId"=n.source_id
GROUP BY n.natural_key;

CREATE TABLE IF NOT EXISTS _giq_history_stage.nonpedigree_dog_composite_review_candidate (
  normalized_natural_key text NOT NULL,
  existing_dog_id text NOT NULL,
  evidence_class text NOT NULL,
  evidence jsonb NOT NULL,
  normalized_manifest_sha256 text NOT NULL,
  source_history_cutoff timestamptz NOT NULL,
  PRIMARY KEY(normalized_natural_key,existing_dog_id,evidence_class)
);

WITH source_marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
)
INSERT INTO _giq_history_stage.nonpedigree_dog_composite_review_candidate
  (normalized_natural_key,existing_dog_id,evidence_class,evidence,
   normalized_manifest_sha256,source_history_cutoff)
SELECT
  n.natural_key,d.id,
  CASE
    WHEN n.whelp_date IS NOT NULL AND d."whelpDate" IS NOT NULL
      AND n.whelp_date::date=d."whelpDate"::date THEN 'exact-name-and-whelp-date'
    ELSE 'exact-name-sex-colour-trainer'
  END,
  jsonb_build_object(
    'autoMergeAllowed',false,
    'nameOnlyMatchAllowed',false,
    'sameWhelpDate',n.whelp_date IS NOT NULL AND d."whelpDate" IS NOT NULL
      AND n.whelp_date::date=d."whelpDate"::date,
    'sameSex',nullif(upper(btrim(n.sex)),'') IS NOT NULL
      AND upper(btrim(n.sex))=upper(btrim(d.sex)),
    'sameColour',nullif(lower(btrim(n.colour)),'') IS NOT NULL
      AND lower(btrim(n.colour))=lower(btrim(d.colour)),
    'sameTrainer',n.trainer_id IS NOT NULL AND n.trainer_id=d."trainerId"
  ),
  marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM _giq_history_stage.normalized_dog n
JOIN public."Dog" d
  ON lower(btrim(d.name))=lower(btrim(n.name))
CROSS JOIN source_marker marker
WHERE d.id<>n.target_id
  AND NOT EXISTS(
    SELECT 1 FROM giq_nonpedigree_exact_dog_candidate exact
    WHERE exact.natural_key=n.natural_key
  )
  AND (
    (n.whelp_date IS NOT NULL AND d."whelpDate" IS NOT NULL
      AND n.whelp_date::date=d."whelpDate"::date)
    OR
    (nullif(upper(btrim(n.sex)),'') IS NOT NULL
      AND upper(btrim(n.sex))=upper(btrim(d.sex))
      AND nullif(lower(btrim(n.colour)),'') IS NOT NULL
      AND lower(btrim(n.colour))=lower(btrim(d.colour))
      AND n.trainer_id IS NOT NULL AND n.trainer_id=d."trainerId")
  )
ON CONFLICT DO NOTHING;

-- Parent relationships are a candidate-search dimension, never an automatic
-- merge key. Search every canonical Dog relationship before allowing a new Dog
-- and retain every possible name + sire/dam match for authoritative review.
CREATE TABLE IF NOT EXISTS _giq_history_stage.nonpedigree_dog_parent_review_candidate (
  normalized_natural_key text NOT NULL,
  existing_dog_id text NOT NULL,
  matched_relationship_count bigint NOT NULL,
  evidence jsonb NOT NULL,
  normalized_manifest_sha256 text NOT NULL,
  source_history_cutoff timestamptz NOT NULL,
  PRIMARY KEY(normalized_natural_key,existing_dog_id)
);

WITH source_marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
), normalized_relationship AS MATERIALIZED (
  SELECT child.natural_key AS child_natural_key,child.target_id AS child_target_id,
    child.name AS child_name,edge.relationship,
    parent.natural_key AS parent_natural_key,parent.target_id AS parent_target_id,
    parent.name AS parent_name
  FROM _giq_history_stage.normalized_pedigree_edge edge
  JOIN _giq_history_stage.normalized_dog child ON child.target_id=edge.child_id
  JOIN _giq_history_stage.normalized_dog parent ON parent.target_id=edge.parent_id
  WHERE edge.duplicate_rank=1 AND NOT edge.self_parent
), candidate_evidence AS MATERIALIZED (
  SELECT DISTINCT
    relationship.child_natural_key,existing_child.id AS existing_dog_id,
    relationship.relationship,relationship.parent_natural_key,
    relationship.parent_target_id,relationship.parent_name,
    existing_parent.id AS existing_parent_id,existing_parent.name AS existing_parent_name,
    CASE
      WHEN exact_parent.dog_id=existing_parent.id THEN 'exact-parent-provider-identity'
      WHEN relationship.parent_target_id=existing_parent.id THEN 'aligned-normalized-parent-target'
      ELSE 'normalized-parent-name'
    END AS parent_match_kind
  FROM normalized_relationship relationship
  JOIN public."Dog" existing_child
    ON _giq_history_merge.slug(existing_child.name)=_giq_history_merge.slug(relationship.child_name)
   AND existing_child.id<>relationship.child_target_id
  JOIN public."Dog" existing_parent
    ON existing_parent.id=CASE relationship.relationship
      WHEN 'sire' THEN existing_child."sireId" ELSE existing_child."damId" END
  LEFT JOIN giq_nonpedigree_exact_dog_candidate exact_parent
    ON exact_parent.natural_key=relationship.parent_natural_key
   AND exact_parent.dog_id=existing_parent.id
  WHERE exact_parent.dog_id IS NOT NULL
     OR relationship.parent_target_id=existing_parent.id
     OR _giq_history_merge.slug(existing_parent.name)=_giq_history_merge.slug(relationship.parent_name)
), candidates AS MATERIALIZED (
  SELECT child_natural_key,existing_dog_id,
    count(DISTINCT relationship) AS matched_relationship_count,
    jsonb_agg(jsonb_build_object(
      'relationship',relationship,'parentNaturalKey',parent_natural_key,
      'parentTargetId',parent_target_id,'expectedParentName',parent_name,
      'existingParentId',existing_parent_id,'existingParentName',existing_parent_name,
      'parentMatchKind',parent_match_kind
    ) ORDER BY relationship,parent_natural_key,existing_parent_id) AS relationship_evidence
  FROM candidate_evidence
  GROUP BY child_natural_key,existing_dog_id
)
INSERT INTO _giq_history_stage.nonpedigree_dog_parent_review_candidate
  (normalized_natural_key,existing_dog_id,matched_relationship_count,evidence,
   normalized_manifest_sha256,source_history_cutoff)
SELECT candidates.child_natural_key,candidates.existing_dog_id,
  candidates.matched_relationship_count,
  jsonb_build_object(
    'autoMergeAllowed',false,
    'wholeDatabaseSearchPerformed',true,
    'searchDimensions',jsonb_build_array(
      'Dog.name','Dog.sireId','Dog.damId','DogSourceIdentity.sourceProvider/sourceId','Dog.parent.name'
    ),
    'relationshipEvidence',candidates.relationship_evidence
  ),marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM candidates CROSS JOIN source_marker marker
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS _giq_history_stage.nonpedigree_dog_identity_resolution (
  natural_key text PRIMARY KEY,
  proposed_target_id text NOT NULL,
  source_provider text,
  source_id text,
  verification_class text NOT NULL,
  exact_canonical_candidate_count bigint NOT NULL,
  exact_canonical_dog_id text,
  unlinked_identity_claim_count bigint NOT NULL,
  nonverified_identity_claim_count bigint NOT NULL,
  composite_review_candidate_count bigint NOT NULL,
  parent_relationship_candidate_count bigint NOT NULL,
  disposition text NOT NULL,
  reuse_existing_allowed boolean NOT NULL,
  create_new_allowed boolean NOT NULL,
  evidence jsonb NOT NULL,
  normalized_manifest_sha256 text NOT NULL,
  source_history_cutoff timestamptz NOT NULL
);

WITH exact AS MATERIALIZED (
  SELECT natural_key,count(DISTINCT dog_id) AS candidate_count,
    CASE WHEN count(DISTINCT dog_id)=1 THEN min(dog_id) END AS dog_id,
    jsonb_agg(DISTINCT evidence_kind ORDER BY evidence_kind) AS evidence_kinds
  FROM giq_nonpedigree_exact_dog_candidate
  GROUP BY natural_key
), composite AS MATERIALIZED (
  SELECT normalized_natural_key,count(DISTINCT existing_dog_id) AS candidate_count
  FROM _giq_history_stage.nonpedigree_dog_composite_review_candidate
  GROUP BY normalized_natural_key
), parent_relationship AS MATERIALIZED (
  SELECT normalized.natural_key,
    count(DISTINCT candidate.existing_dog_id) AS candidate_count,
    encode(digest(coalesce(string_agg(
      candidate.existing_dog_id || E'\x1f' || candidate.matched_relationship_count::text
        || E'\x1f' || candidate.evidence::text,
      E'\n' ORDER BY candidate.existing_dog_id
    ),''),'sha256'),'hex') AS candidate_evidence_sha256
  FROM _giq_history_stage.normalized_dog normalized
  LEFT JOIN _giq_history_stage.nonpedigree_dog_parent_review_candidate candidate
    ON candidate.normalized_natural_key=normalized.natural_key
  GROUP BY normalized.natural_key
), source_marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
)
INSERT INTO _giq_history_stage.nonpedigree_dog_identity_resolution
SELECT
  n.natural_key,n.target_id,n.source_provider,n.source_id,n.verification_class,
  coalesce(exact.candidate_count,0),exact.dog_id,
  coalesce(claim.unlinked_claim_count,0),coalesce(claim.nonverified_claim_count,0),
  coalesce(composite.candidate_count,0),parent_relationship.candidate_count,
  CASE
    WHEN n.source_id IS NULL OR n.natural_key LIKE 'thedogs:dog-name:%'
      THEN 'blocked-missing-authoritative-provider-key'
    WHEN coalesce(exact.candidate_count,0)>1
      THEN 'blocked-authoritative-identity-collision'
    WHEN coalesce(claim.unlinked_claim_count,0)>0
      THEN 'blocked-unlinked-authoritative-identity-claim'
    WHEN coalesce(claim.nonverified_claim_count,0)>0
      THEN 'blocked-nonverified-authoritative-identity-claim'
    WHEN n.verification_class='r2-preserved'
      THEN 'blocked-r2-only-identity-retrieval-required'
    WHEN coalesce(exact.candidate_count,0)=1 AND exact.dog_id<>n.target_id
      THEN 'blocked-canonical-target-relink-required'
    WHEN coalesce(exact.candidate_count,0)=1
      THEN 'reuse-existing-canonical-by-exact-identity'
    WHEN coalesce(parent_relationship.candidate_count,0)>0
      THEN 'blocked-parent-relationship-candidate-review-required'
    WHEN coalesce(composite.candidate_count,0)>0
      THEN 'blocked-composite-candidate-review-required'
    WHEN n.verification_class='race-observed'
      THEN 'blocked-authoritative-profile-required-before-create'
    WHEN n.verification_class='provider-stub'
      THEN 'blocked-authoritative-provider-stub'
    WHEN n.verification_class='full-profile'
      THEN 'new-record-supported-by-full-provider-profile'
    ELSE 'blocked-unclassified-dog-identity'
  END,
  coalesce(exact.candidate_count,0)=1 AND exact.dog_id=n.target_id
    AND coalesce(claim.unlinked_claim_count,0)=0
    AND coalesce(claim.nonverified_claim_count,0)=0
    AND n.verification_class<>'r2-preserved',
  coalesce(exact.candidate_count,0)=0
    AND coalesce(claim.unlinked_claim_count,0)=0
    AND coalesce(claim.nonverified_claim_count,0)=0
    AND coalesce(composite.candidate_count,0)=0
    AND coalesce(parent_relationship.candidate_count,0)=0
    AND n.source_id IS NOT NULL
    AND n.natural_key NOT LIKE 'thedogs:dog-name:%'
    AND n.verification_class='full-profile',
  jsonb_build_object(
    'globalSearch',jsonb_build_array(
      'Dog.sourceProvider/sourceId','Dog.earBrand','DogSourceIdentity.sourceProvider/sourceId',
      'Dog.name+whelpDate','Dog.name+sex+colour+trainer','Dog.name+sire/dam relationships'
    ),
    'exactCandidateEvidence',coalesce(exact.evidence_kinds,'[]'::jsonb),
    'nameOnlyAutoMergeAllowed',false,
    'parentRelationshipSearchPerformed',true,
    'parentRelationshipCandidateCount',parent_relationship.candidate_count,
    'parentRelationshipCandidateEvidenceSha256',parent_relationship.candidate_evidence_sha256,
    'parentRelationshipEvidenceManifestSha256',marker.normalized_manifest_sha256,
    'parentRelationshipSearchOwnedBy','authoritative-pedigree-resolution'
  ),
  marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM _giq_history_stage.normalized_dog n
LEFT JOIN exact USING(natural_key)
LEFT JOIN giq_nonpedigree_identity_claim claim USING(natural_key)
LEFT JOIN composite ON composite.normalized_natural_key=n.natural_key
JOIN parent_relationship ON parent_relationship.natural_key=n.natural_key
CROSS JOIN source_marker marker
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE giq_nonpedigree_profile_form_outcome ON COMMIT DROP AS
SELECT
  payload->>'naturalKey' AS natural_key,
  count(*) AS row_count,
  count(*) FILTER(WHERE url_class='canonical-racing-url') AS canonical_url_rows,
  count(*) FILTER(WHERE url_class='dog-url-recovery-only') AS dog_url_rows,
  count(*) FILTER(WHERE race_id IS NOT NULL) AS linked_rows,
  count(*) FILTER(WHERE url_class='dog-url-recovery-only' AND candidate_count=1
    AND dog_id IS NOT NULL AND race_id IS NOT NULL) AS exact_recovery_rows,
  count(*) FILTER(WHERE candidate_count>1) AS ambiguous_rows,
  max(candidate_count) AS candidate_count,
  min(race_id) FILTER(WHERE race_id IS NOT NULL) AS race_id,
  min(race_natural_key) FILTER(WHERE race_id IS NOT NULL) AS race_natural_key
FROM _giq_history_stage.profile_form_resolution
GROUP BY payload->>'naturalKey';
CREATE INDEX giq_nonpedigree_profile_form_outcome_key_idx
  ON giq_nonpedigree_profile_form_outcome(natural_key);

CREATE TABLE IF NOT EXISTS _giq_history_stage.nonpedigree_row_disposition (
  source_dataset text NOT NULL,
  source_file text NOT NULL,
  line_number bigint NOT NULL,
  issue_type text NOT NULL,
  source_natural_key text,
  provider text,
  provider_key text,
  canonical_entity_type text,
  canonical_entity_id text,
  candidate_count bigint NOT NULL,
  disposition text NOT NULL,
  create_entity_allowed boolean NOT NULL,
  relationship_repair_allowed boolean NOT NULL,
  authoritative_identity_proven boolean NOT NULL,
  no_unique_data_loss_proven boolean NOT NULL,
  reference_redirection_proven boolean NOT NULL,
  removal_allowed boolean NOT NULL,
  audit_ledger_recorded boolean NOT NULL,
  evidence jsonb NOT NULL,
  normalized_manifest_sha256 text NOT NULL,
  source_history_cutoff timestamptz NOT NULL,
  PRIMARY KEY(source_dataset,source_file,line_number)
);

WITH source_marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
)
INSERT INTO _giq_history_stage.nonpedigree_row_disposition
  SELECT
  'duplicates',d.source_file,d.line_number,d.payload->>'issueType',d.payload->>'naturalKey',
  'thedogs',NULL,'Runner',runner.target_id,
  CASE WHEN runner.target_id IS NOT NULL THEN 1 ELSE 0 END,
  'review-only-full-row-no-loss-proof-required',
  false,false,false,false,false,false,false,
  jsonb_build_object(
    'selectedRowOrdinal',(d.payload->>'selectedRowOrdinal')::integer,
    'droppedRowOrdinal',(d.payload->>'droppedRowOrdinal')::integer,
    'selection',d.payload->>'selection',
    'selectedCanonicalRunnerPresent',runner.target_id IS NOT NULL,
    'requiredBeforeRemoval',jsonb_build_array(
      'authoritative-identity','full-row-no-data-loss','reference-redirection','append-only-audit-ledger'
    )
  ),marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM _giq_history_stage.export_duplicates d
LEFT JOIN _giq_history_stage.runner_map runner
  ON runner.source_name='export' AND runner.source_id=d.payload->>'naturalKey'
CROSS JOIN source_marker marker
ON CONFLICT DO NOTHING;

WITH source_marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
)
INSERT INTO _giq_history_stage.nonpedigree_row_disposition
SELECT
  'orphans',o.source_file,o.line_number,o.payload->>'issueType',o.payload->>'naturalKey',
  'thedogs',o.payload->>'missingProviderKey','Dog',identity.exact_canonical_dog_id,
  identity.exact_canonical_candidate_count,
  CASE
    WHEN identity.reuse_existing_allowed
      THEN 'existing-canonical-dog-profile-enrichment-required'
    WHEN identity.disposition='blocked-authoritative-identity-collision'
      THEN identity.disposition
    WHEN identity.disposition='blocked-canonical-target-relink-required'
      THEN identity.disposition
    ELSE 'authoritative-profile-fetch-required-before-create'
  END,
  false,identity.reuse_existing_allowed,identity.reuse_existing_allowed,false,false,false,false,
  jsonb_build_object(
    'occurrenceIsNotEntityIdentity',true,
    'providerKeyOnly',true,
    'identityDisposition',identity.disposition,
    'sourceArchiveKey',o.payload->>'sourceArchiveKey'
  ),marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM _giq_history_stage.export_orphans o
JOIN _giq_history_stage.nonpedigree_dog_identity_resolution identity
  ON identity.natural_key=o.payload->>'missingProviderKey'
CROSS JOIN source_marker marker
WHERE o.payload->>'issueType'='runner-dog-profile-unresolved'
ON CONFLICT DO NOTHING;

WITH source_marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
)
INSERT INTO _giq_history_stage.nonpedigree_row_disposition
SELECT
  'orphans',o.source_file,o.line_number,o.payload->>'issueType',o.payload->>'naturalKey',
  'thedogs',o.payload->>'missingProviderKey','Race',profile.race_id,
  coalesce(profile.candidate_count,0),
  CASE
    WHEN coalesce(profile.canonical_url_rows,0)>0 AND coalesce(profile.linked_rows,0)>0
      THEN 'existing-canonical-race-linked'
    WHEN coalesce(profile.canonical_url_rows,0)>0
      THEN 'authoritative-race-fetch-required-no-race-synthesis'
    WHEN coalesce(profile.dog_url_rows,0)>0 AND coalesce(profile.exact_recovery_rows,0)>0
      AND coalesce(profile.ambiguous_rows,0)=0
      THEN 'existing-form-relationship-exactly-recoverable-no-race-creation'
    WHEN coalesce(profile.dog_url_rows,0)>0 AND coalesce(profile.ambiguous_rows,0)>0
      THEN 'blocked-ambiguous-existing-race-candidates'
    WHEN coalesce(profile.dog_url_rows,0)>0
      THEN 'blocked-non-race-dog-url-no-race-creation'
    ELSE 'blocked-unclassified-profile-form-source'
  END,
  false,
  coalesce(profile.dog_url_rows,0)>0 AND coalesce(profile.exact_recovery_rows,0)>0
    AND coalesce(profile.ambiguous_rows,0)=0,
  coalesce(profile.canonical_url_rows,0)>0,
  true,false,false,false,
  jsonb_build_object(
    'providerKeyOnly',true,
    'profileFormRows',coalesce(profile.row_count,0),
    'dogUrlIsRaceIdentity',false,
    'raceCreationAllowed',false,
    'sourceArchiveKey',o.payload->>'sourceArchiveKey'
  ),marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM _giq_history_stage.export_orphans o
LEFT JOIN giq_nonpedigree_profile_form_outcome profile
  ON profile.natural_key=o.payload->>'naturalKey'
CROSS JOIN source_marker marker
WHERE o.payload->>'issueType'='profile-form-race-unresolved'
ON CONFLICT DO NOTHING;

WITH source_marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
), source_quarantine AS (
  SELECT q.*,
    normalized_race.target_id AS race_id,normalized_race.distance AS normalized_distance,
    EXISTS(
      SELECT 1 FROM _giq_history_stage.race_source source
      WHERE source.natural_key=q.payload->>'naturalKey'
        AND source.source_name='r2' AND source.distance IS NOT NULL
    ) AS r2_distance_repair,
    normalized_runner.target_id AS runner_id,normalized_runner.dog_id AS runner_dog_id,
    normalized_runner.dog_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM _giq_history_stage.runner_source source
      WHERE source.natural_key=q.payload->>'naturalKey' AND source.source_name='r2'
    ) AND EXISTS(
      SELECT 1 FROM _giq_history_stage.nonpedigree_dog_identity_resolution identity
      WHERE identity.proposed_target_id=normalized_runner.dog_id
        AND (identity.reuse_existing_allowed OR identity.create_new_allowed)
    ) AS r2_runner_repair
  FROM _giq_history_stage.export_quarantine q
  LEFT JOIN _giq_history_stage.normalized_race normalized_race
    ON q.payload->>'issueType'='race-row'
   AND normalized_race.natural_key=q.payload->>'naturalKey'
  LEFT JOIN _giq_history_stage.normalized_runner normalized_runner
    ON q.payload->>'issueType'='runner-row'
   AND normalized_runner.natural_key=q.payload->>'naturalKey'
)
INSERT INTO _giq_history_stage.nonpedigree_row_disposition
SELECT
  'quarantine',q.source_file,q.line_number,q.payload->>'issueType',q.payload->>'naturalKey',
  'thedogs',NULL,
  CASE q.payload->>'issueType' WHEN 'race-row' THEN 'Race' ELSE 'Runner' END,
  coalesce(q.race_id,q.runner_id),
  CASE WHEN q.r2_distance_repair OR q.r2_runner_repair THEN 1 ELSE 0 END,
  CASE
    WHEN q.payload->>'reason'='missing_race_distance' AND q.r2_distance_repair
      THEN 'missing-distance-repaired-from-existing-r2-race'
    WHEN q.payload->>'reason'='missing_race_distance'
      THEN 'authoritative-race-distance-fetch-required'
    WHEN q.payload->>'reason'='missing_dog_provider_identity' AND q.r2_runner_repair
      THEN 'missing-dog-identity-runner-relationship-repaired-from-r2'
    WHEN q.payload->>'reason'='missing_dog_provider_identity'
      THEN 'authoritative-dog-identity-required-no-name-only-creation'
    ELSE 'blocked-unclassified-source-quarantine'
  END,
  false,q.r2_distance_repair OR q.r2_runner_repair,
  q.r2_distance_repair OR q.r2_runner_repair,true,false,false,false,
  jsonb_build_object(
    'reason',q.payload->>'reason',
    'r2DistanceRepair',q.r2_distance_repair,
    'normalizedDistance',q.normalized_distance,
    'r2RunnerRepair',q.r2_runner_repair,
    'runnerDogId',q.runner_dog_id,
    'nameOnlyDogCreationAllowed',false,
    'sourceArchiveKey',q.payload->>'sourceArchiveKey'
  ),marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM source_quarantine q
CROSS JOIN source_marker marker
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS _giq_history_stage.nonpedigree_authoritative_fetch_queue (
  queue_key text PRIMARY KEY,
  request_kind text NOT NULL,
  provider text NOT NULL,
  source_id text NOT NULL,
  provider_key text NOT NULL,
  occurrence_count bigint NOT NULL,
  source_archive_count bigint NOT NULL,
  first_observed_date date,
  last_observed_date date,
  disposition text NOT NULL,
  existing_canonical_id text,
  create_new_allowed boolean NOT NULL,
  evidence jsonb NOT NULL,
  normalized_manifest_sha256 text NOT NULL,
  source_history_cutoff timestamptz NOT NULL
);

WITH source_marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
), missing AS (
  SELECT
    o.payload->>'missingProviderKey' AS provider_key,
    substring(o.payload->>'missingProviderKey' FROM '^thedogs:dog:([0-9]+)$') AS source_id,
    count(*) AS occurrence_count,
    count(DISTINCT o.payload->>'sourceArchiveKey') AS source_archive_count,
    min(substring(o.payload->>'sourceArchiveKey' FROM '([0-9]{4}-[0-9]{2}-[0-9]{2})$')::date) AS first_date,
    max(substring(o.payload->>'sourceArchiveKey' FROM '([0-9]{4}-[0-9]{2}-[0-9]{2})$')::date) AS last_date
  FROM _giq_history_stage.export_orphans o
  WHERE o.payload->>'issueType'='runner-dog-profile-unresolved'
  GROUP BY o.payload->>'missingProviderKey'
)
INSERT INTO _giq_history_stage.nonpedigree_authoritative_fetch_queue
SELECT
  'dog-profile:thedogs:' || missing.source_id,'dog-profile','thedogs',missing.source_id,
  missing.provider_key,missing.occurrence_count,missing.source_archive_count,
  missing.first_date,missing.last_date,
  CASE WHEN identity.reuse_existing_allowed
    THEN 'authoritative-profile-enrichment-required-for-existing-canonical'
    ELSE 'authoritative-profile-fetch-required-before-create' END,
  identity.exact_canonical_dog_id,false,
  jsonb_build_object(
    'providerKeyOnly',true,
    'globalIdentityDisposition',identity.disposition,
    'automaticPublicWebScrapeAllowed',false
  ),marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM missing
JOIN _giq_history_stage.nonpedigree_dog_identity_resolution identity
  ON identity.natural_key=missing.provider_key
CROSS JOIN source_marker marker
ON CONFLICT DO NOTHING;

WITH source_marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
), missing AS (
  SELECT
    o.payload->>'missingProviderKey' AS provider_key,
    substring(o.payload->>'missingProviderKey' FROM '^thedogs:race:(/racing/.+)$') AS source_id,
    count(*) AS occurrence_count,
    count(DISTINCT o.payload->>'sourceArchiveKey') AS source_archive_count
  FROM _giq_history_stage.export_orphans o
  WHERE o.payload->>'issueType'='profile-form-race-unresolved'
    AND o.payload->>'missingProviderKey' LIKE 'thedogs:race:/racing/%'
  GROUP BY o.payload->>'missingProviderKey'
)
INSERT INTO _giq_history_stage.nonpedigree_authoritative_fetch_queue
SELECT
  'race:thedogs:' || encode(digest(missing.source_id,'sha256'),'hex'),
  'race','thedogs',missing.source_id,missing.provider_key,
  missing.occurrence_count,missing.source_archive_count,NULL,NULL,
  'authoritative-race-fetch-required-no-partial-race-synthesis',NULL,false,
  jsonb_build_object(
    'providerKeyOnly',true,
    'partialProfileFormCannotCreateRace',true,
    'automaticPublicWebScrapeAllowed',false
  ),marker.normalized_manifest_sha256,marker.source_history_cutoff
FROM missing
CROSS JOIN source_marker marker
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS _giq_history_merge.nonpedigree_saturation_manifest (
  id integer PRIMARY KEY CHECK(id=1),
  schema_version text NOT NULL,
  normalized_manifest_sha256 text NOT NULL,
  source_history_cutoff timestamptz NOT NULL,
  source_datasets jsonb NOT NULL,
  counts jsonb NOT NULL,
  blockers jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('ready','blocked')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

WITH marker AS (
  SELECT normalized_manifest_sha256,source_history_cutoff
  FROM _giq_history_merge.run WHERE id=1
), dataset AS (
  SELECT jsonb_object_agg(dataset,jsonb_build_object(
    'rows',expected_rows,'bytes',expected_bytes,'sha256',expected_sha256
  ) ORDER BY dataset) AS evidence
  FROM _giq_history_merge.export_dataset_manifest
  WHERE dataset IN ('profiles','profile_forms','races','runners','duplicates','orphans','quarantine')
), counts AS (
  SELECT jsonb_build_object(
    'rowDispositions',(SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition),
    'runnerMissingProfileOccurrences',(SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE issue_type='runner-dog-profile-unresolved'),
    'runnerMissingProfileIdentities',(SELECT count(*) FROM _giq_history_stage.nonpedigree_authoritative_fetch_queue
      WHERE request_kind='dog-profile'),
    'profileFormMissingRaceOccurrences',(SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE issue_type='profile-form-race-unresolved'),
    'missingRaceProviderIds',(SELECT count(*) FROM _giq_history_stage.nonpedigree_authoritative_fetch_queue
      WHERE request_kind='race'),
    'pseudoRaceDogUrlRows',(SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE issue_type='profile-form-race-unresolved' AND provider_key LIKE 'thedogs:race:/dogs/%'),
    'pseudoRaceDogUrlIdentities',(SELECT count(DISTINCT provider_key)
      FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE issue_type='profile-form-race-unresolved' AND provider_key LIKE 'thedogs:race:/dogs/%'),
    'pseudoRaceExactRelationshipRepairs',(SELECT count(*)
      FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE issue_type='profile-form-race-unresolved'
        AND disposition='existing-form-relationship-exactly-recoverable-no-race-creation'),
    'pseudoRaceNoCandidateRows',(SELECT count(*)
      FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE issue_type='profile-form-race-unresolved'
        AND disposition='blocked-non-race-dog-url-no-race-creation'),
    'pseudoRaceAmbiguousRows',(SELECT count(*)
      FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE issue_type='profile-form-race-unresolved'
        AND disposition='blocked-ambiguous-existing-race-candidates'),
    'runnerDuplicateCandidates',(SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE source_dataset='duplicates'),
    'runnerDuplicateNaturalKeys',(SELECT count(DISTINCT source_natural_key)
      FROM _giq_history_stage.nonpedigree_row_disposition WHERE source_dataset='duplicates'),
    'missingDogProviderIdentityRows',(SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE source_dataset='quarantine' AND evidence->>'reason'='missing_dog_provider_identity'),
    'missingRaceDistanceRows',(SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE source_dataset='quarantine' AND evidence->>'reason'='missing_race_distance'),
    'parentRelationshipDogReviews',(SELECT count(*)
      FROM _giq_history_stage.nonpedigree_dog_parent_review_candidate)
  ) AS evidence
), blockers AS (
  SELECT jsonb_build_object(
    'authoritativeFetchQueue',(SELECT count(*) FROM _giq_history_stage.nonpedigree_authoritative_fetch_queue),
    'dogIdentityCollisions',(SELECT count(*) FROM _giq_history_stage.nonpedigree_dog_identity_resolution
      WHERE exact_canonical_candidate_count>1),
    'dogTargetRelinks',(SELECT count(*) FROM _giq_history_stage.nonpedigree_dog_identity_resolution
      WHERE disposition='blocked-canonical-target-relink-required'),
    'unlinkedIdentityClaims',(SELECT count(*) FROM _giq_history_stage.nonpedigree_dog_identity_resolution
      WHERE unlinked_identity_claim_count>0),
    'nonverifiedIdentityClaims',(SELECT count(*) FROM _giq_history_stage.nonpedigree_dog_identity_resolution
      WHERE nonverified_identity_claim_count>0),
    'r2OnlyIdentityRetrievalRequired',(SELECT count(*)
      FROM _giq_history_stage.nonpedigree_dog_identity_resolution
      WHERE disposition='blocked-r2-only-identity-retrieval-required'),
    'unresolvedDogIdentities',(SELECT count(*)
      FROM _giq_history_stage.nonpedigree_dog_identity_resolution
      WHERE NOT reuse_existing_allowed AND NOT create_new_allowed),
    'compositeDogReviews',(
      SELECT
        (SELECT count(*) FROM _giq_history_stage.nonpedigree_dog_composite_review_candidate)+
        (SELECT count(*) FROM _giq_history_stage.nonpedigree_dog_parent_review_candidate)
    ),
    'duplicateNoLossReviews',(SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE source_dataset='duplicates' AND NOT no_unique_data_loss_proven),
    'unresolvedPseudoRaceRows',(SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE issue_type='profile-form-race-unresolved'
        AND disposition IN ('blocked-ambiguous-existing-race-candidates','blocked-non-race-dog-url-no-race-creation')),
    'unresolvedSourceQuarantine',(SELECT count(*) FROM _giq_history_stage.nonpedigree_row_disposition
      WHERE source_dataset='quarantine' AND NOT relationship_repair_allowed)
  ) AS evidence
)
INSERT INTO _giq_history_merge.nonpedigree_saturation_manifest
  (id,schema_version,normalized_manifest_sha256,source_history_cutoff,
   source_datasets,counts,blockers,status)
SELECT 1,'giq-nonpedigree-saturation/v1',marker.normalized_manifest_sha256,
  marker.source_history_cutoff,dataset.evidence,counts.evidence,blockers.evidence,
  CASE WHEN EXISTS(
    SELECT 1 FROM jsonb_each_text(blockers.evidence) item WHERE item.value::bigint<>0
  ) THEN 'blocked' ELSE 'ready' END
FROM marker CROSS JOIN dataset CROSS JOIN counts CROSS JOIN blockers
ON CONFLICT(id) DO NOTHING;

DO $$
DECLARE
  row_dispositions bigint;
  runner_occurrences bigint;
  profile_occurrences bigint;
  duplicate_rows bigint;
  duplicate_keys bigint;
  missing_identity_rows bigint;
  missing_distance_rows bigint;
  dog_fetch_ids bigint;
  race_fetch_ids bigint;
  pseudo_rows bigint;
  pseudo_ids bigint;
  pseudo_exact_repairs bigint;
  pseudo_no_candidate_rows bigint;
  pseudo_ambiguous_rows bigint;
  unsafe_duplicate_removals bigint;
  pseudo_race_creations bigint;
BEGIN
  SELECT count(*),
    count(*) FILTER(WHERE issue_type='runner-dog-profile-unresolved'),
    count(*) FILTER(WHERE issue_type='profile-form-race-unresolved'),
    count(*) FILTER(WHERE source_dataset='duplicates'),
    count(DISTINCT source_natural_key) FILTER(WHERE source_dataset='duplicates'),
    count(*) FILTER(WHERE source_dataset='quarantine' AND evidence->>'reason'='missing_dog_provider_identity'),
    count(*) FILTER(WHERE source_dataset='quarantine' AND evidence->>'reason'='missing_race_distance'),
    count(*) FILTER(WHERE issue_type='profile-form-race-unresolved' AND provider_key LIKE 'thedogs:race:/dogs/%'),
    count(DISTINCT provider_key) FILTER(WHERE issue_type='profile-form-race-unresolved'
      AND provider_key LIKE 'thedogs:race:/dogs/%'),
    count(*) FILTER(WHERE issue_type='profile-form-race-unresolved'
      AND disposition='existing-form-relationship-exactly-recoverable-no-race-creation'),
    count(*) FILTER(WHERE issue_type='profile-form-race-unresolved'
      AND disposition='blocked-non-race-dog-url-no-race-creation'),
    count(*) FILTER(WHERE issue_type='profile-form-race-unresolved'
      AND disposition='blocked-ambiguous-existing-race-candidates'),
    count(*) FILTER(WHERE source_dataset='duplicates' AND removal_allowed),
    count(*) FILTER(WHERE issue_type='profile-form-race-unresolved'
      AND provider_key LIKE 'thedogs:race:/dogs/%' AND create_entity_allowed)
  INTO row_dispositions,runner_occurrences,profile_occurrences,duplicate_rows,duplicate_keys,
    missing_identity_rows,missing_distance_rows,pseudo_rows,pseudo_ids,
    pseudo_exact_repairs,pseudo_no_candidate_rows,pseudo_ambiguous_rows,
    unsafe_duplicate_removals,pseudo_race_creations
  FROM _giq_history_stage.nonpedigree_row_disposition;

  SELECT count(*) FILTER(WHERE request_kind='dog-profile'),
    count(*) FILTER(WHERE request_kind='race')
  INTO dog_fetch_ids,race_fetch_ids
  FROM _giq_history_stage.nonpedigree_authoritative_fetch_queue;

  IF (row_dispositions,runner_occurrences,profile_occurrences,duplicate_rows,duplicate_keys,
      missing_identity_rows,missing_distance_rows,dog_fetch_ids,race_fetch_ids,pseudo_rows,pseudo_ids) <>
     (1027915::bigint,266534::bigint,759359::bigint,1940::bigint,1939::bigint,
      42::bigint,40::bigint,29516::bigint,66051::bigint,314502::bigint,54944::bigint) THEN
    RAISE EXCEPTION 'non-pedigree saturation partition changed';
  END IF;
  IF (pseudo_exact_repairs,pseudo_no_candidate_rows,pseudo_ambiguous_rows) <>
     (169::bigint,314333::bigint,0::bigint) THEN
    RAISE EXCEPTION 'pseudo-race reconciliation partition changed';
  END IF;
  IF unsafe_duplicate_removals<>0 OR pseudo_race_creations<>0 THEN
    RAISE EXCEPTION 'non-pedigree saturation allowed unsafe deletion or pseudo-race creation';
  END IF;
  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.nonpedigree_authoritative_fetch_queue
    WHERE source_id='' OR provider_key='' OR create_new_allowed
  ) THEN
    RAISE EXCEPTION 'authoritative retrieval queue contains an invalid or create-enabled key';
  END IF;
  IF EXISTS(
    SELECT 1 FROM _giq_history_stage.nonpedigree_dog_identity_resolution
    WHERE create_new_allowed AND (
      source_id IS NULL OR composite_review_candidate_count<>0
      OR parent_relationship_candidate_count<>0
      OR exact_canonical_candidate_count<>0
      OR verification_class<>'full-profile'
    )
  ) THEN
    RAISE EXCEPTION 'global dog search allowed an unverified or colliding insert';
  END IF;
  IF EXISTS(
    SELECT 1
    FROM _giq_history_merge.run run
    CROSS JOIN LATERAL (
      SELECT normalized_manifest_sha256,source_history_cutoff
      FROM _giq_history_stage.nonpedigree_dog_composite_review_candidate
      UNION ALL
      SELECT normalized_manifest_sha256,source_history_cutoff
      FROM _giq_history_stage.nonpedigree_dog_parent_review_candidate
      UNION ALL
      SELECT normalized_manifest_sha256,source_history_cutoff
      FROM _giq_history_stage.nonpedigree_dog_identity_resolution
      UNION ALL
      SELECT normalized_manifest_sha256,source_history_cutoff
      FROM _giq_history_stage.nonpedigree_row_disposition
      UNION ALL
      SELECT normalized_manifest_sha256,source_history_cutoff
      FROM _giq_history_stage.nonpedigree_authoritative_fetch_queue
      UNION ALL
      SELECT normalized_manifest_sha256,source_history_cutoff
      FROM _giq_history_merge.nonpedigree_saturation_manifest
    ) evidence
    WHERE run.id=1 AND (
      evidence.normalized_manifest_sha256 IS DISTINCT FROM run.normalized_manifest_sha256
      OR evidence.source_history_cutoff IS DISTINCT FROM run.source_history_cutoff
    )
  ) THEN
    RAISE EXCEPTION 'non-pedigree saturation evidence is bound to a different source manifest';
  END IF;
END
$$;

REVOKE ALL ON _giq_history_stage.nonpedigree_dog_composite_review_candidate FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.nonpedigree_dog_parent_review_candidate FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.nonpedigree_dog_identity_resolution FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.nonpedigree_row_disposition FROM PUBLIC;
REVOKE ALL ON _giq_history_stage.nonpedigree_authoritative_fetch_queue FROM PUBLIC;
REVOKE ALL ON _giq_history_merge.nonpedigree_saturation_manifest FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event','NONPEDIGREE_SATURATION_STAGED',
  'database',current_database(),
  'status',status,
  'normalizedManifestSha256',normalized_manifest_sha256,
  'sourceHistoryCutoff',source_history_cutoff,
  'counts',counts,
  'blockers',blockers
) FROM _giq_history_merge.nonpedigree_saturation_manifest WHERE id=1;

SELECT (status<>'ready') AS nonpedigree_saturation_blocked
FROM _giq_history_merge.nonpedigree_saturation_manifest WHERE id=1
\gset
\if :nonpedigree_saturation_blocked
\echo 'OPERATOR_ATTENTION: non-pedigree saturation remains blocked; resolve the exact provider queues and review-only candidates before canonical merge.'
\quit 3
\endif
