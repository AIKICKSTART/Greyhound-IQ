\set ON_ERROR_STOP on

-- This audit never persists evidence or changes canonical data. It uses only
-- pg_temp working tables inside one repeatable-read transaction and ends with
-- an unconditional rollback after emitting one aggregate manifest.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL app.system='true';
SET LOCAL "app.current_role"='system';
SET LOCAL app.current_tier='system';
SET LOCAL statement_timeout=0;
SET LOCAL lock_timeout='5s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle='ISO, MDY';
SET LOCAL extra_float_digits=1;

DO $preflight$
DECLARE
  required_relation text;
  missing_relations text[] := ARRAY[]::text[];
BEGIN
  FOREACH required_relation IN ARRAY ARRAY[
    '_giq_history_merge.run',
    '_giq_history_merge.source_snapshot_manifest',
    '_giq_history_merge.physical_clone_proof',
    '_giq_history_merge.snapshot_core_key',
    '_giq_history_merge.quarantine',
    '_giq_history_merge.disposition',
    '_giq_history_merge.snapshot_race_video_proof',
    '_giq_history_merge.replay_standalone_membership_disposition',
    '_giq_history_stage.normalized_track',
    '_giq_history_stage.normalized_trainer',
    '_giq_history_stage.normalized_dog',
    '_giq_history_stage.normalized_meeting',
    '_giq_history_stage.normalized_race',
    '_giq_history_stage.normalized_runner',
    '_giq_history_stage.normalized_result',
    '_giq_history_stage.normalized_form_entry',
    '_giq_history_stage.normalized_profile_form',
    '_giq_history_stage.normalized_race_video',
    '_giq_history_stage.normalized_photo_finish',
    '_giq_history_stage.normalized_dog_profile_archive',
    '_giq_history_stage.normalized_race_day_archive',
    '_giq_history_stage.media_resolution',
    '_giq_history_stage.replay_standalone_only_provider_id',
    '_giq_history_stage.thedogs_source_identity',
    '_giq_history_stage.normalized_pedigree_edge',
    '_giq_history_stage.pedigree_merge_decision',
    '_giq_history_stage.galtd_source_identity',
    '_giq_history_stage.galtd_assertion',
    '_giq_history_stage.galtd_merge_decision',
    'public."Dog"',
    'public."RaceVideo"',
    'public."PedigreeImportRun"',
    'public."DogSourceIdentity"',
    'public."PedigreeAssertion"',
    'public."PedigreeMergeLedger"'
  ]::text[] LOOP
    IF to_regclass(required_relation) IS NULL THEN
      missing_relations := array_append(missing_relations,required_relation);
    END IF;
  END LOOP;

  IF cardinality(missing_relations)<>0 THEN
    RAISE EXCEPTION 'candidate canonical audit lacks required relations: %',
      array_to_string(missing_relations,',');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto') THEN
    RAISE EXCEPTION 'candidate canonical audit requires the existing pgcrypto extension';
  END IF;
  IF (SELECT count(*) FROM _giq_history_merge.run)<>1
     OR NOT EXISTS(SELECT 1 FROM _giq_history_merge.run WHERE id=1) THEN
    RAISE EXCEPTION 'candidate canonical audit requires exactly one id=1 merge marker';
  END IF;
END
$preflight$;

CREATE TEMP TABLE giq_audit_check (
  check_name text PRIMARY KEY,
  status text NOT NULL CHECK(status IN ('pass','fail')),
  blocking boolean NOT NULL,
  metrics jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
SELECT
  'workflow_markers',
  CASE WHEN phase IN ('canonical_merged','delta_applied','verified')
             AND normalized_at IS NOT NULL
             AND replay_normalization_verified_at IS NOT NULL
             AND canonical_merged_at IS NOT NULL
             AND normalization_manifest IS NOT NULL
             AND canonical_merge_manifest IS NOT NULL
             AND (
               phase='canonical_merged'
               OR (live_delta_applied_at IS NOT NULL AND live_delta_source_manifest IS NOT NULL)
             )
             AND (
               phase<>'verified'
               OR (verified_at IS NOT NULL AND verification_manifest IS NOT NULL)
             )
             AND clone_method='physical_template'
             AND EXISTS(
               SELECT 1 FROM _giq_history_merge.physical_clone_proof proof
               WHERE proof.id=1
                 AND proof.operation_id=clone_operation_id
                 AND proof.source_oid=source_production_oid
                 AND proof.candidate_oid=candidate_database_oid
                  AND proof.candidate_bytes>0
                  AND proof.candidate_bytes<=proof.source_bytes
                  AND proof.source_bytes-proof.candidate_bytes<=
                      GREATEST(1::bigint,
                        LEAST(power(2,26)::bigint,proof.source_bytes/100))
                 AND proof.sessions_observed=
                     proof.sessions_terminated+proof.sessions_already_gone
                 AND proof.source_connection_restored
                 AND proof.database_metadata_intentionally_isolated
                 AND proof.force_rls_table_count>0
                 AND proof.all_tables_hashed
                 AND proof.force_rls_restored
                 AND coalesce((proof.evidence->'terminationProof'->>'refused')::bigint,-1)=0
                 AND coalesce((proof.evidence->'candidateIsolation'->>'publicPrivilegesRevoked')::boolean,false)
                  AND coalesce((proof.evidence->'candidateIsolation'->>'databaseSettingsNotCopied')::boolean,false)
                   AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'verified')::boolean,false)
                   AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'sizeIsAllocationSanityOnly')::boolean,false)
                   AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'sourceBytes')::bigint,-1)=proof.source_bytes
                   AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'candidateBytes')::bigint,-1)=proof.candidate_bytes
                   AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'deltaBytes')::bigint,-1)=
                       proof.source_bytes-proof.candidate_bytes
                   AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'allowedDeltaBytes')::bigint,-1)=
                       GREATEST(1::bigint,
                         LEAST(power(2,26)::bigint,proof.source_bytes/100))
                   AND coalesce((proof.evidence->'candidateAllocationObservation'->>'verified')::boolean,false)
                   AND coalesce((proof.evidence->'candidateAllocationObservation'->>'sizeIsAllocationSanityOnly')::boolean,false)
                   AND coalesce((proof.evidence->'candidateAllocationObservation'->>'creationBytes')::bigint,-1)=proof.candidate_bytes
                   AND coalesce((proof.evidence->'candidateAllocationObservation'->>'observedBytes')::bigint,-1)=
                       coalesce((proof.evidence->'candidateIsolation'->'candidateMetadata'->>'bytes')::bigint,-2)
                   AND coalesce((proof.evidence->'candidateAllocationObservation'->>'absoluteDeltaBytes')::bigint,-1)=
                       abs(proof.candidate_bytes-
                         coalesce((proof.evidence->'candidateAllocationObservation'->>'observedBytes')::bigint,-2))
                   AND coalesce((proof.evidence->'candidateAllocationObservation'->>'allowedDeltaBytes')::bigint,-1)=
                       GREATEST(1::bigint,
                         LEAST(power(2,26)::bigint,proof.candidate_bytes/100))
                   AND coalesce((proof.evidence->'candidateAllocationObservation'->>'absoluteDeltaBytes')::bigint,-1)<=
                       coalesce((proof.evidence->'candidateAllocationObservation'->>'allowedDeltaBytes')::bigint,-2)
             )
       THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'phase',phase,
    'normalizedAt',normalized_at,
    'replayNormalizationVerifiedAt',replay_normalization_verified_at,
    'canonicalMergedAt',canonical_merged_at,
    'liveDeltaAppliedAt',live_delta_applied_at,
    'physicalTemplateProof',(
      SELECT jsonb_build_object(
        'operationId',operation_id,
        'sourceOid',source_oid,
        'candidateOid',candidate_oid,
        'sourceBytes',source_bytes,
        'candidateBytes',candidate_bytes,
        'sessionsObserved',sessions_observed,
        'sessionsTerminated',sessions_terminated,
        'sessionsAlreadyGone',sessions_already_gone,
        'sourceConnectionRestored',source_connection_restored,
        'databaseMetadataIntentionallyIsolated',database_metadata_intentionally_isolated,
        'allTablesHashed',all_tables_hashed,
        'forceRlsRestored',force_rls_restored
      )
      FROM _giq_history_merge.physical_clone_proof WHERE id=1
    )
  )
FROM _giq_history_merge.run
WHERE id=1;

CREATE TEMP TABLE giq_audit_public_table ON COMMIT DROP AS
SELECT
  relation.oid AS relation_oid,
  relation.relname AS table_name,
  relation.relkind,
  relation.relrowsecurity AS rls_enabled,
  relation.relforcerowsecurity AS rls_forced,
  coalesce(primary_key.pk_columns,ARRAY[]::text[]) AS pk_columns,
  coalesce(cardinality(primary_key.pk_columns),0) AS pk_column_count,
  CASE
    WHEN relation.relname='_prisma_migrations' THEN 'migration_ledger'
    WHEN relation.relname=ANY(ARRAY[
      'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
      'DogProfileForm','RaceVideo','DogProfileArchive','RaceDayArchive'
    ]::text[]) THEN 'historical_core'
    WHEN relation.relname=ANY(ARRAY[
      'PedigreeImportRun','DogSourceIdentity','PedigreeAssertion','PedigreeMergeLedger'
    ]::text[]) THEN 'pedigree_provenance'
    ELSE 'production_protected'
  END AS policy,
  0::bigint AS row_count
FROM pg_class relation
JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
LEFT JOIN LATERAL (
  SELECT array_agg(attribute.attname ORDER BY key_column.ordinality)::text[] AS pk_columns
  FROM pg_index index_row
  CROSS JOIN LATERAL unnest(index_row.indkey) WITH ORDINALITY
    AS key_column(attnum,ordinality)
  JOIN pg_attribute attribute
    ON attribute.attrelid=index_row.indrelid
   AND attribute.attnum=key_column.attnum
  WHERE index_row.indrelid=relation.oid
    AND index_row.indisprimary
    AND key_column.ordinality<=index_row.indnkeyatts
) primary_key ON true
WHERE namespace.nspname='public'
  AND relation.relkind IN ('r','p');

DO $table_counts$
DECLARE
  table_row record;
  observed_rows bigint;
BEGIN
  FOR table_row IN
    SELECT table_name FROM giq_audit_public_table ORDER BY table_name
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',table_row.table_name)
      INTO observed_rows;
    UPDATE giq_audit_public_table
    SET row_count=observed_rows
    WHERE table_name=table_row.table_name;
  END LOOP;
END
$table_counts$;

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
SELECT
  'public_table_primary_keys',
  CASE WHEN count(*) FILTER(WHERE pk_column_count=0)=0
             AND max(invalid_unique_indexes)=0
       THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'publicTables',count(*),
    'tablesWithoutPrimaryKey',count(*) FILTER(WHERE pk_column_count=0),
    'compositePrimaryKeys',count(*) FILTER(WHERE pk_column_count>1),
    'nonIdPrimaryKeys',count(*) FILTER(
      WHERE pk_column_count>0 AND pk_columns<>ARRAY['id']::text[]
    ),
    'invalidUniqueIndexes',max(invalid_unique_indexes)
  )
FROM giq_audit_public_table
CROSS JOIN LATERAL (
  SELECT count(*)::bigint AS invalid_unique_indexes
  FROM pg_index index_row
  JOIN pg_class relation ON relation.oid=index_row.indrelid
  JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
  WHERE namespace.nspname='public'
    AND (index_row.indisprimary OR index_row.indisunique)
    AND NOT index_row.indisvalid
) invalid;

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
SELECT
  'public_table_policy_coverage',
  CASE WHEN count(*) FILTER(WHERE policy IS NULL)=0 THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'catalogTables',count(*),
    'classifiedTables',count(*) FILTER(WHERE policy IS NOT NULL),
    'unclassifiedTables',count(*) FILTER(WHERE policy IS NULL),
    'policies',(
      SELECT jsonb_object_agg(policy,policy_rows ORDER BY policy)
      FROM (
        SELECT policy,count(*) AS policy_rows
        FROM giq_audit_public_table GROUP BY policy
      ) grouped
    )
  )
FROM giq_audit_public_table;

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
WITH comparison AS (
  SELECT
    count(*) FILTER(
      WHERE snapshot.table_name IS NOT NULL
        AND catalog.table_name IS NULL
    ) AS missing_snapshot_tables,
    count(*) FILTER(
      WHERE snapshot.table_name IS NOT NULL
        AND catalog.table_name IS NOT NULL
        AND (snapshot.row_security,snapshot.force_rls)
          IS DISTINCT FROM (catalog.rls_enabled,catalog.rls_forced)
    ) AS snapshot_flag_drift,
    count(*) FILTER(
      WHERE catalog.rls_forced AND NOT catalog.rls_enabled
    ) AS invalid_force_rls
  FROM _giq_history_merge.source_snapshot_manifest snapshot
  FULL JOIN giq_audit_public_table catalog USING(table_name)
)
SELECT
  'rls_catalog_flags',
  CASE WHEN missing_snapshot_tables=0
             AND snapshot_flag_drift=0
             AND invalid_force_rls=0
       THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'missingSnapshotTables',missing_snapshot_tables,
    'snapshotFlagDrift',snapshot_flag_drift,
    'forcedWithoutEnabled',invalid_force_rls,
    'rlsEnabledTables',(SELECT count(*) FROM giq_audit_public_table WHERE rls_enabled),
    'forceRlsTables',(SELECT count(*) FROM giq_audit_public_table WHERE rls_forced)
  )
FROM comparison;

CREATE TEMP TABLE giq_audit_foreign_key (
  child_schema text NOT NULL,
  child_table text NOT NULL,
  constraint_name text NOT NULL,
  parent_schema text NOT NULL,
  parent_table text NOT NULL,
  child_columns text[] NOT NULL,
  parent_columns text[] NOT NULL,
  match_type "char" NOT NULL,
  constraint_valid boolean NOT NULL,
  orphan_rows bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(child_schema,child_table,constraint_name)
) ON COMMIT DROP;

INSERT INTO giq_audit_foreign_key(
  child_schema,child_table,constraint_name,parent_schema,parent_table,
  child_columns,parent_columns,match_type,constraint_valid
)
SELECT
  child_namespace.nspname,
  child_relation.relname,
  constraint_row.conname,
  parent_namespace.nspname,
  parent_relation.relname,
  key_columns.child_columns,
  key_columns.parent_columns,
  constraint_row.confmatchtype,
  constraint_row.convalidated
FROM pg_constraint constraint_row
JOIN pg_class child_relation ON child_relation.oid=constraint_row.conrelid
JOIN pg_namespace child_namespace ON child_namespace.oid=child_relation.relnamespace
JOIN pg_class parent_relation ON parent_relation.oid=constraint_row.confrelid
JOIN pg_namespace parent_namespace ON parent_namespace.oid=parent_relation.relnamespace
CROSS JOIN LATERAL (
  SELECT
    array_agg(child_attribute.attname ORDER BY paired.ordinality)::text[] AS child_columns,
    array_agg(parent_attribute.attname ORDER BY paired.ordinality)::text[] AS parent_columns
  FROM unnest(constraint_row.conkey,constraint_row.confkey) WITH ORDINALITY
    AS paired(child_attnum,parent_attnum,ordinality)
  JOIN pg_attribute child_attribute
    ON child_attribute.attrelid=constraint_row.conrelid
   AND child_attribute.attnum=paired.child_attnum
  JOIN pg_attribute parent_attribute
    ON parent_attribute.attrelid=constraint_row.confrelid
   AND parent_attribute.attnum=paired.parent_attnum
) key_columns
WHERE constraint_row.contype='f'
  AND child_namespace.nspname='public';

DO $foreign_keys$
DECLARE
  foreign_key record;
  join_predicate text;
  all_nonnull_predicate text;
  any_nonnull_predicate text;
  enforcement_predicate text;
  observed_orphans bigint;
BEGIN
  FOR foreign_key IN
    SELECT * FROM giq_audit_foreign_key
    ORDER BY child_schema,child_table,constraint_name
  LOOP
    SELECT
      string_agg(
        format('child.%I IS NOT DISTINCT FROM parent.%I',child_column,parent_column),
        ' AND ' ORDER BY ordinality
      ),
      string_agg(format('child.%I IS NOT NULL',child_column),' AND ' ORDER BY ordinality),
      string_agg(format('child.%I IS NOT NULL',child_column),' OR ' ORDER BY ordinality)
    INTO join_predicate,all_nonnull_predicate,any_nonnull_predicate
    FROM unnest(foreign_key.child_columns,foreign_key.parent_columns) WITH ORDINALITY
      AS paired(child_column,parent_column,ordinality);

    enforcement_predicate:=CASE foreign_key.match_type
      WHEN 'f' THEN '(' || any_nonnull_predicate || ')'
      ELSE '(' || all_nonnull_predicate || ')'
    END;

    EXECUTE format(
      'SELECT count(*) FROM %I.%I child WHERE %s '
      'AND NOT EXISTS(SELECT 1 FROM %I.%I parent WHERE %s)',
      foreign_key.child_schema,foreign_key.child_table,enforcement_predicate,
      foreign_key.parent_schema,foreign_key.parent_table,join_predicate
    ) INTO observed_orphans;

    UPDATE giq_audit_foreign_key
    SET orphan_rows=observed_orphans
    WHERE child_schema=foreign_key.child_schema
      AND child_table=foreign_key.child_table
      AND constraint_name=foreign_key.constraint_name;
  END LOOP;
END
$foreign_keys$;

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
SELECT
  'foreign_key_integrity',
  CASE WHEN count(*) FILTER(WHERE NOT constraint_valid)=0
             AND coalesce(sum(orphan_rows),0)=0
       THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'foreignKeys',count(*),
    'unvalidatedForeignKeys',count(*) FILTER(WHERE NOT constraint_valid),
    'orphanRows',coalesce(sum(orphan_rows),0),
    'compositeForeignKeys',count(*) FILTER(WHERE cardinality(child_columns)>1)
  )
FROM giq_audit_foreign_key;

CREATE TEMP TABLE giq_audit_duplicate_identity (
  entity_type text NOT NULL,
  identity_kind text NOT NULL,
  duplicate_groups bigint NOT NULL,
  PRIMARY KEY(entity_type,identity_kind)
) ON COMMIT DROP;

INSERT INTO giq_audit_duplicate_identity(entity_type,identity_kind,duplicate_groups)
VALUES
('Track','canonical_name_state',(SELECT count(*) FROM (
  SELECT 1 FROM public."Track"
  GROUP BY CASE WHEN lower(btrim(name)) IN ('meadows','the meadows')
                  THEN 'the meadows' ELSE lower(btrim(name)) END,
           upper(btrim(state)) HAVING count(*)>1
) duplicate_group)),
('Trainer','license_number',(SELECT count(*) FROM (
  SELECT 1 FROM public."Trainer" WHERE nullif(btrim("licenseNumber"),'') IS NOT NULL
  GROUP BY lower(btrim("licenseNumber")) HAVING count(*)>1
) duplicate_group)),
('Dog','provider_source',(SELECT count(*) FROM (
  SELECT 1 FROM public."Dog"
  WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
  GROUP BY lower("sourceProvider"),"sourceId" HAVING count(*)>1
) duplicate_group)),
('Dog','ear_brand',(SELECT count(*) FROM (
  SELECT 1 FROM public."Dog" WHERE nullif(btrim("earBrand"),'') IS NOT NULL
  GROUP BY upper(btrim("earBrand")) HAVING count(*)>1
) duplicate_group)),
('Meeting','track_date',(SELECT count(*) FROM (
  SELECT 1 FROM public."Meeting" GROUP BY "trackId","meetingDate" HAVING count(*)>1
) duplicate_group)),
('Meeting','provider_source',(SELECT count(*) FROM (
  SELECT 1 FROM public."Meeting"
  WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
  GROUP BY lower("sourceProvider"),"sourceId" HAVING count(*)>1
) duplicate_group)),
('Race','meeting_number',(SELECT count(*) FROM (
  SELECT 1 FROM public."Race" GROUP BY "meetingId","raceNumber" HAVING count(*)>1
) duplicate_group)),
('Race','provider_source',(SELECT count(*) FROM (
  SELECT 1 FROM public."Race"
  WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
  GROUP BY lower("sourceProvider"),"sourceId" HAVING count(*)>1
) duplicate_group)),
('Runner','race_box',(SELECT count(*) FROM (
  SELECT 1 FROM public."Runner" GROUP BY "raceId","boxNumber" HAVING count(*)>1
) duplicate_group)),
('Runner','provider_source',(SELECT count(*) FROM (
  SELECT 1 FROM public."Runner"
  WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
  GROUP BY lower("sourceProvider"),"sourceId" HAVING count(*)>1
) duplicate_group)),
('Result','runner',(SELECT count(*) FROM (
  SELECT 1 FROM public."Result" GROUP BY "runnerId" HAVING count(*)>1
) duplicate_group)),
('Result','provider_source',(SELECT count(*) FROM (
  SELECT 1 FROM public."Result"
  WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
  GROUP BY lower("sourceProvider"),"sourceId" HAVING count(*)>1
) duplicate_group)),
('FormEntry','dog_race',(SELECT count(*) FROM (
  SELECT 1 FROM public."FormEntry" WHERE "raceId" IS NOT NULL
  GROUP BY "dogId","raceId" HAVING count(*)>1
) duplicate_group)),
('DogProfileForm','dog_provider_source',(SELECT count(*) FROM (
  SELECT 1 FROM public."DogProfileForm"
  GROUP BY "dogId",lower("sourceProvider"),"sourceId" HAVING count(*)>1
) duplicate_group)),
('RaceVideo','race_provider_kind',(SELECT count(*) FROM (
  SELECT 1 FROM public."RaceVideo"
  GROUP BY "raceId",lower("sourceProvider"),kind HAVING count(*)>1
) duplicate_group)),
('DogProfileArchive','provider_source',(SELECT count(*) FROM (
  SELECT 1 FROM public."DogProfileArchive"
  GROUP BY lower("sourceProvider"),"sourceId" HAVING count(*)>1
) duplicate_group)),
('RaceDayArchive','provider_date',(SELECT count(*) FROM (
  SELECT 1 FROM public."RaceDayArchive"
  GROUP BY lower("sourceProvider"),date HAVING count(*)>1
) duplicate_group)),
('DogSourceIdentity','provider_source_artifact',(SELECT count(*) FROM (
  SELECT 1 FROM public."DogSourceIdentity"
  GROUP BY lower("sourceProvider"),"sourceId","artifactSha256" HAVING count(*)>1
) duplicate_group)),
('PedigreeAssertion','subject_relationship',(SELECT count(*) FROM (
  SELECT 1 FROM public."PedigreeAssertion"
  GROUP BY "subjectIdentityId",relationship HAVING count(*)>1
) duplicate_group)),
('PedigreeMergeLedger','assertion_dog_decision',(SELECT count(*) FROM (
  SELECT 1 FROM public."PedigreeMergeLedger"
  GROUP BY "assertionId","dogId",decision HAVING count(*)>1
) duplicate_group));

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
WITH content AS (
  SELECT
    (SELECT count(*) FROM public."Dog"
      WHERE nullif(btrim(name),'') IS NULL
         OR lower(btrim(name))~'^(unknown|n/?a|placeholder|tbd)$') AS placeholder_dogs,
    (SELECT count(*) FROM public."Dog"
      WHERE "earBrand"~'^thedogs:[0-9]+$') AS synthetic_ear_brands,
    (SELECT count(*) FROM public."Track"
      WHERE lower(btrim(name))='meadows' AND upper(btrim(state))='VIC') AS meadows_aliases
)
SELECT
  'alternate_identity_uniqueness',
  CASE WHEN (SELECT coalesce(sum(duplicate_groups),0) FROM giq_audit_duplicate_identity)=0
             AND placeholder_dogs=0
             AND synthetic_ear_brands=0
             AND meadows_aliases=0
       THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'duplicateGroups',(SELECT coalesce(sum(duplicate_groups),0)
                       FROM giq_audit_duplicate_identity),
    'placeholderDogs',placeholder_dogs,
    'syntheticEarBrands',synthetic_ear_brands,
    'meadowsAliases',meadows_aliases
  )
FROM content;

CREATE TEMP TABLE giq_audit_sequence ON COMMIT DROP AS
SELECT
  sequence_relation.oid AS sequence_oid,
  sequence_namespace.nspname AS sequence_schema,
  sequence_relation.relname AS sequence_name,
  sequence_catalog.seqstart::numeric AS start_value,
  sequence_catalog.seqincrement::numeric AS increment_by,
  sequence_catalog.seqmin::numeric AS minimum_value,
  sequence_catalog.seqmax::numeric AS maximum_value,
  sequence_catalog.seqcache::numeric AS cache_size,
  sequence_catalog.seqcycle AS cycles,
  coalesce(ownership.owner_count,0) AS owner_count,
  ownership.owner_schema,
  ownership.owner_table,
  ownership.owner_column,
  NULL::numeric AS last_value,
  NULL::boolean AS is_called,
  NULL::numeric AS owner_min,
  NULL::numeric AS owner_max,
  NULL::numeric AS next_value,
  false AS next_value_safe
FROM pg_class sequence_relation
JOIN pg_namespace sequence_namespace ON sequence_namespace.oid=sequence_relation.relnamespace
JOIN pg_sequence sequence_catalog ON sequence_catalog.seqrelid=sequence_relation.oid
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS owner_count,
    min(owner_namespace.nspname::text) AS owner_schema,
    min(owner_relation.relname::text) AS owner_table,
    min(owner_attribute.attname::text) AS owner_column
  FROM pg_depend dependency
  JOIN pg_class owner_relation ON owner_relation.oid=dependency.refobjid
  JOIN pg_namespace owner_namespace ON owner_namespace.oid=owner_relation.relnamespace
  JOIN pg_attribute owner_attribute
    ON owner_attribute.attrelid=dependency.refobjid
   AND owner_attribute.attnum=dependency.refobjsubid
  WHERE dependency.classid='pg_class'::regclass
    AND dependency.objid=sequence_relation.oid
    AND dependency.objsubid=0
    AND dependency.refclassid='pg_class'::regclass
    AND dependency.deptype IN ('a','i')
) ownership ON true
WHERE sequence_namespace.nspname='public';

DO $sequences$
DECLARE
  sequence_row record;
  observed_last numeric;
  observed_called boolean;
  observed_min numeric;
  observed_max numeric;
  observed_next numeric;
  observed_safe boolean;
BEGIN
  FOR sequence_row IN
    SELECT * FROM giq_audit_sequence ORDER BY sequence_schema,sequence_name
  LOOP
    EXECUTE format('SELECT last_value::numeric,is_called FROM %I.%I',
      sequence_row.sequence_schema,sequence_row.sequence_name)
      INTO observed_last,observed_called;

    observed_min:=NULL;
    observed_max:=NULL;
    IF sequence_row.owner_count=1 THEN
      EXECUTE format('SELECT min(%I)::numeric,max(%I)::numeric FROM %I.%I',
        sequence_row.owner_column,sequence_row.owner_column,
        sequence_row.owner_schema,sequence_row.owner_table)
        INTO observed_min,observed_max;
    END IF;

    observed_next:=CASE WHEN observed_called
      THEN observed_last+sequence_row.increment_by
      ELSE observed_last
    END;
    observed_safe:=sequence_row.owner_count=1
      AND observed_next BETWEEN sequence_row.minimum_value AND sequence_row.maximum_value
      AND CASE
        WHEN sequence_row.increment_by>0 THEN observed_max IS NULL OR observed_next>observed_max
        WHEN sequence_row.increment_by<0 THEN observed_min IS NULL OR observed_next<observed_min
        ELSE false
      END;

    UPDATE giq_audit_sequence
    SET last_value=observed_last,
        is_called=observed_called,
        owner_min=observed_min,
        owner_max=observed_max,
        next_value=observed_next,
        next_value_safe=observed_safe
    WHERE sequence_oid=sequence_row.sequence_oid;
  END LOOP;
END
$sequences$;

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
SELECT
  'sequence_ownership_next_value',
  CASE WHEN count(*)>0
             AND count(*) FILTER(WHERE owner_count<>1 OR NOT next_value_safe OR cycles)=0
       THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'publicSequences',count(*),
    'unownedOrMultiplyOwned',count(*) FILTER(WHERE owner_count<>1),
    'unsafeNextValues',count(*) FILTER(WHERE NOT next_value_safe),
    'cyclingSequences',count(*) FILTER(WHERE cycles)
  )
FROM giq_audit_sequence;

CREATE TEMP TABLE giq_audit_required_state (
  state text PRIMARY KEY
) ON COMMIT DROP;
INSERT INTO giq_audit_required_state(state)
VALUES ('ACT'),('NSW'),('NT'),('QLD'),('SA'),('TAS'),('VIC'),('WA');

CREATE TEMP TABLE giq_audit_jurisdiction_coverage ON COMMIT DROP AS
WITH canonical AS (
  SELECT
    upper(btrim(track.state)) AS state,
    count(DISTINCT track.id) AS tracks,
    count(DISTINCT meeting.id) AS meetings,
    count(DISTINCT race.id) AS races,
    count(DISTINCT runner.id) AS runners,
    count(DISTINCT result.id) AS results,
    min(race."raceTime") AS first_race_time,
    max(race."raceTime") AS last_race_time
  FROM public."Track" track
  JOIN public."Meeting" meeting ON meeting."trackId"=track.id
  JOIN public."Race" race ON race."meetingId"=meeting.id
  LEFT JOIN public."Runner" runner ON runner."raceId"=race.id
  LEFT JOIN public."Result" result ON result."raceId"=race.id
  GROUP BY upper(btrim(track.state))
), historical AS (
  SELECT
    upper(btrim(track.state)) AS state,
    count(DISTINCT track.target_id) AS normalized_tracks,
    count(DISTINCT meeting.target_id) AS normalized_meetings,
    count(DISTINCT race.target_id) AS normalized_races,
    count(DISTINCT runner.target_id) AS normalized_runners,
    count(DISTINCT result.target_id) AS normalized_results,
    min(race.race_time) AS first_historical_race_time,
    max(race.race_time) AS last_historical_race_time
  FROM _giq_history_stage.normalized_track track
  JOIN _giq_history_stage.normalized_meeting meeting ON meeting.track_id=track.target_id
  JOIN _giq_history_stage.normalized_race race ON race.meeting_id=meeting.target_id
  LEFT JOIN _giq_history_stage.normalized_runner runner ON runner.race_id=race.target_id
  LEFT JOIN _giq_history_stage.normalized_result result ON result.race_id=race.target_id
  GROUP BY upper(btrim(track.state))
)
SELECT
  required.state,
  coalesce(canonical.tracks,0)::bigint AS canonical_tracks,
  coalesce(canonical.meetings,0)::bigint AS canonical_meetings,
  coalesce(canonical.races,0)::bigint AS canonical_races,
  coalesce(canonical.runners,0)::bigint AS canonical_runners,
  coalesce(canonical.results,0)::bigint AS canonical_results,
  canonical.first_race_time,
  canonical.last_race_time,
  coalesce(historical.normalized_tracks,0)::bigint AS normalized_tracks,
  coalesce(historical.normalized_meetings,0)::bigint AS normalized_meetings,
  coalesce(historical.normalized_races,0)::bigint AS normalized_races,
  coalesce(historical.normalized_runners,0)::bigint AS normalized_runners,
  coalesce(historical.normalized_results,0)::bigint AS normalized_results,
  historical.first_historical_race_time,
  historical.last_historical_race_time
FROM giq_audit_required_state required
LEFT JOIN canonical USING(state)
LEFT JOIN historical USING(state)
ORDER BY required.state;

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
WITH gaps AS (
  SELECT
    count(*) FILTER(
      WHERE canonical_tracks=0 OR canonical_meetings=0 OR canonical_races=0
         OR canonical_runners=0 OR canonical_results=0
         OR normalized_tracks=0 OR normalized_meetings=0 OR normalized_races=0
         OR normalized_runners=0 OR normalized_results=0
    ) AS states_with_gaps,
    (SELECT count(*) FROM public."Track" track
      WHERE nullif(btrim(track.state),'') IS NULL
         OR (
           upper(btrim(track.state))<>'NZ'
           AND NOT EXISTS(
             SELECT 1 FROM giq_audit_required_state required
             WHERE required.state=upper(btrim(track.state))
           )
         )) AS unclassified_track_states
  FROM giq_audit_jurisdiction_coverage
)
SELECT
  'all_state_race_history_coverage',
  CASE WHEN states_with_gaps=0 AND unclassified_track_states=0
       THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'requiredStates',(SELECT jsonb_agg(state ORDER BY state) FROM giq_audit_required_state),
    'statesWithCoverageGaps',states_with_gaps,
    'unclassifiedTrackStates',unclassified_track_states
  )
FROM gaps;

CREATE TEMP TABLE giq_audit_normalized_entity (
  entity_type text PRIMARY KEY,
  canonical_table text NOT NULL UNIQUE,
  stage_table text NOT NULL UNIQUE,
  history_id_prefix text NOT NULL,
  stage_rows bigint NOT NULL DEFAULT 0,
  missing_targets bigint NOT NULL DEFAULT 0,
  identity_mismatches bigint NOT NULL DEFAULT 0,
  unexpected_history_rows bigint NOT NULL DEFAULT 0
) ON COMMIT DROP;

INSERT INTO giq_audit_normalized_entity(
  entity_type,canonical_table,stage_table,history_id_prefix
)
VALUES
('Track','Track','normalized_track','hist_track_'),
('Trainer','Trainer','normalized_trainer','hist_trainer_'),
('Dog','Dog','normalized_dog','hist_dog_'),
('Meeting','Meeting','normalized_meeting','hist_meeting_'),
('Race','Race','normalized_race','hist_race_'),
('Runner','Runner','normalized_runner','hist_runner_'),
('Result','Result','normalized_result','hist_result_'),
('FormEntry','FormEntry','normalized_form_entry','hist_form_'),
('DogProfileForm','DogProfileForm','normalized_profile_form','hist_profileform_'),
('RaceVideo','RaceVideo','normalized_race_video','hist_video_'),
('DogProfileArchive','DogProfileArchive','normalized_dog_profile_archive','hist_dogarchive_'),
('RaceDayArchive','RaceDayArchive','normalized_race_day_archive','hist_dayarchive_');

DO $normalized_targets$
DECLARE
  entity record;
  observed_stage bigint;
  observed_missing bigint;
  observed_unexpected bigint;
BEGIN
  FOR entity IN
    SELECT * FROM giq_audit_normalized_entity ORDER BY entity_type
  LOOP
    EXECUTE format('SELECT count(*) FROM _giq_history_stage.%I',entity.stage_table)
      INTO observed_stage;
    EXECUTE format(
      'SELECT count(*) FROM _giq_history_stage.%I staged '
      'LEFT JOIN public.%I canonical ON canonical.id=staged.target_id '
      'WHERE canonical.id IS NULL',
      entity.stage_table,entity.canonical_table
    ) INTO observed_missing;
    EXECUTE format(
      'SELECT count(*) FROM public.%I canonical '
      'WHERE canonical.id LIKE %L '
      'AND NOT EXISTS(SELECT 1 FROM _giq_history_stage.%I staged '
      'WHERE staged.target_id=canonical.id)',
      entity.canonical_table,entity.history_id_prefix || '%',entity.stage_table
    ) INTO observed_unexpected;

    UPDATE giq_audit_normalized_entity
    SET stage_rows=observed_stage,
        missing_targets=observed_missing,
        unexpected_history_rows=observed_unexpected
    WHERE entity_type=entity.entity_type;
  END LOOP;
END
$normalized_targets$;

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_track staged
  JOIN public."Track" canonical ON canonical.id=staged.target_id
  WHERE (canonical.name,canonical.state) IS DISTINCT FROM (staged.name,staged.state)
) WHERE entity_type='Track';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_trainer staged
  JOIN public."Trainer" canonical ON canonical.id=staged.target_id
  WHERE staged.target_id LIKE 'hist_trainer_%'
    AND (canonical.name,canonical.state,canonical."licenseNumber")
      IS DISTINCT FROM (staged.name,staged.state,staged.license_number)
) WHERE entity_type='Trainer';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_dog staged
  JOIN public."Dog" canonical ON canonical.id=staged.target_id
  WHERE (
      staged.source_provider IS NOT NULL AND staged.source_id IS NOT NULL
      AND (lower(canonical."sourceProvider"),canonical."sourceId")
        IS DISTINCT FROM (lower(staged.source_provider),staged.source_id)
    ) OR (
      staged.target_id LIKE 'hist_dog_%'
      AND (canonical.name,canonical."earBrand",canonical.colour,canonical.sex,
           canonical."whelpDate",canonical."trainerId")
        IS DISTINCT FROM (staged.name,staged.ear_brand,staged.colour,staged.sex,
                          staged.whelp_date,staged.trainer_id)
    )
) WHERE entity_type='Dog';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_meeting staged
  JOIN public."Meeting" canonical ON canonical.id=staged.target_id
  WHERE (canonical."trackId",canonical."meetingDate")
    IS DISTINCT FROM (staged.track_id,staged.meeting_date)
) WHERE entity_type='Meeting';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_race staged
  JOIN public."Race" canonical ON canonical.id=staged.target_id
  WHERE (canonical."meetingId",canonical."raceNumber")
      IS DISTINCT FROM (staged.meeting_id,staged.race_number)
     OR (staged.target_id LIKE 'hist_race_%'
         AND (canonical."raceTime",canonical.distance)
           IS DISTINCT FROM (staged.race_time,staged.distance))
) WHERE entity_type='Race';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_runner staged
  JOIN public."Runner" canonical ON canonical.id=staged.target_id
  WHERE (canonical."raceId",canonical."dogId",canonical."boxNumber")
    IS DISTINCT FROM (staged.race_id,staged.dog_id,staged.box_number)
) WHERE entity_type='Runner';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_result staged
  JOIN public."Result" canonical ON canonical.id=staged.target_id
  WHERE (canonical."runnerId",canonical."raceId")
    IS DISTINCT FROM (staged.runner_id,staged.race_id)
) WHERE entity_type='Result';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_form_entry staged
  JOIN public."FormEntry" canonical ON canonical.id=staged.target_id
  WHERE (canonical."dogId",canonical."raceId")
    IS DISTINCT FROM (staged.dog_id,staged.race_id)
) WHERE entity_type='FormEntry';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_profile_form staged
  JOIN public."DogProfileForm" canonical ON canonical.id=staged.target_id
  WHERE (canonical."dogId",lower(canonical."sourceProvider"),canonical."sourceId",
         canonical."raceUrl",canonical.date)
    IS DISTINCT FROM (staged.dog_id,lower(staged.source_provider),staged.source_id,
                      staged.race_url,staged.date)
) WHERE entity_type='DogProfileForm';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_race_video staged
  JOIN public."RaceVideo" canonical ON canonical.id=staged.target_id
  WHERE (canonical."raceId",lower(canonical."sourceProvider"),canonical.kind)
      IS DISTINCT FROM (staged.race_id,lower(staged.source_provider),staged.kind)
     OR (staged.target_id LIKE 'hist_video_%'
         AND (canonical."sourceId",canonical."pageUrl",canonical."embedSourceType",
              canonical."sourceRawJson")
           IS DISTINCT FROM (staged.source_id,staged.page_url,staged.embed_source_type,
                             staged.source_raw_json))
) WHERE entity_type='RaceVideo';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_dog_profile_archive staged
  JOIN public."DogProfileArchive" canonical ON canonical.id=staged.target_id
  WHERE (lower(canonical."sourceProvider"),canonical."sourceId")
    IS DISTINCT FROM (lower(staged.source_provider),staged.provider_source_id)
) WHERE entity_type='DogProfileArchive';

UPDATE giq_audit_normalized_entity SET identity_mismatches=(
  SELECT count(*) FROM _giq_history_stage.normalized_race_day_archive staged
  JOIN public."RaceDayArchive" canonical ON canonical.id=staged.target_id
  WHERE (lower(canonical."sourceProvider"),canonical.date)
    IS DISTINCT FROM (lower(staged.source_provider),staged.date)
) WHERE entity_type='RaceDayArchive';

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
SELECT
  'normalized_entity_reconciliation',
  CASE WHEN count(*) FILTER(
              WHERE stage_rows=0 OR missing_targets<>0 OR identity_mismatches<>0
                 OR unexpected_history_rows<>0
            )=0
       THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'entities',count(*),
    'emptyStageEntities',count(*) FILTER(WHERE stage_rows=0),
    'missingTargets',coalesce(sum(missing_targets),0),
    'identityMismatches',coalesce(sum(identity_mismatches),0),
    'unexpectedHistoryRows',coalesce(sum(unexpected_history_rows),0)
  )
FROM giq_audit_normalized_entity;

CREATE TEMP TABLE giq_audit_media_partition ON COMMIT DROP AS
SELECT media_class,disposition,count(*)::bigint AS rows
FROM _giq_history_stage.media_resolution
GROUP BY media_class,disposition;

CREATE TEMP TABLE giq_audit_media_metric (
  metric text PRIMARY KEY,
  value bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_audit_media_metric(metric,value)
VALUES
('unclassifiedMediaRows',(SELECT count(*) FROM _giq_history_stage.media_resolution
  WHERE disposition NOT IN ('eligible-race-replay','eligible-photo-finish')
    AND disposition NOT LIKE 'quarantined-%')),
('eligibleReplayMissingNormalized',(SELECT count(*)
  FROM _giq_history_stage.media_resolution media
  LEFT JOIN _giq_history_stage.normalized_race_video video
    ON video.race_id=media.race_id
   AND video.source_id=media.provider_media_id
   AND lower(video.source_provider)='thedogs'
   AND video.kind='replay'
  WHERE media.disposition='eligible-race-replay' AND video.target_id IS NULL)),
('normalizedReplayMissingEligible',(SELECT count(*)
  FROM _giq_history_stage.normalized_race_video video
  LEFT JOIN _giq_history_stage.media_resolution media
    ON media.race_id=video.race_id
   AND media.provider_media_id=video.source_id
   AND media.disposition='eligible-race-replay'
  WHERE media.source_file IS NULL)),
('eligiblePhotoMissingNormalized',(SELECT count(*)
  FROM _giq_history_stage.media_resolution media
  LEFT JOIN _giq_history_stage.normalized_photo_finish photo
    ON photo.race_id=media.race_id
   AND photo.source_id=media.payload->>'sourceId'
  WHERE media.disposition='eligible-photo-finish' AND photo.race_id IS NULL)),
('normalizedPhotoMissingEligible',(SELECT count(*)
  FROM _giq_history_stage.normalized_photo_finish photo
  LEFT JOIN _giq_history_stage.media_resolution media
    ON media.race_id=photo.race_id
   AND media.payload->>'sourceId'=photo.source_id
   AND media.disposition='eligible-photo-finish'
  WHERE media.source_file IS NULL)),
('quarantinedMediaMissingEvidence',(SELECT count(*)
  FROM _giq_history_stage.media_resolution media
  LEFT JOIN _giq_history_merge.quarantine quarantine
    ON quarantine.source_name='normalized-export'
   AND quarantine.entity_type='race-media'
   AND quarantine.source_key=media.source_file || ':' || media.line_number
   AND quarantine.reason_code=media.disposition
   AND quarantine.disposition=media.disposition
  WHERE media.disposition LIKE 'quarantined-%'
    AND quarantine.source_key IS NULL)),
('orphanMediaQuarantineEvidence',(SELECT count(*)
  FROM _giq_history_merge.quarantine quarantine
  LEFT JOIN _giq_history_stage.media_resolution media
    ON quarantine.source_key=media.source_file || ':' || media.line_number
   AND quarantine.reason_code=media.disposition
   AND quarantine.disposition=media.disposition
  WHERE quarantine.source_name='normalized-export'
    AND quarantine.entity_type='race-media'
    AND media.source_file IS NULL)),
('canonicalReplayProjectionGaps',(SELECT count(*)
  FROM _giq_history_stage.normalized_race_video staged
  LEFT JOIN public."RaceVideo" canonical ON canonical.id=staged.target_id
  WHERE canonical.id IS NULL
     OR (canonical."raceId",lower(canonical."sourceProvider"),canonical.kind)
       IS DISTINCT FROM (staged.race_id,lower(staged.source_provider),staged.kind))),
('snapshotReplayProofGaps',(SELECT count(*)
  FROM _giq_history_merge.snapshot_race_video_proof proof
  LEFT JOIN public."RaceVideo" canonical ON canonical.id=proof.id
  CROSS JOIN _giq_history_merge.run marker
  WHERE marker.id=1
    AND marker.live_delta_applied_at IS NULL
    AND (canonical.id IS NULL
      OR encode(digest(to_jsonb(canonical)::text,'sha256'),'hex')<>proof.row_sha256))),
('standaloneMembershipMissing',(SELECT count(*)
  FROM _giq_history_stage.replay_standalone_only_provider_id staged
  LEFT JOIN _giq_history_merge.replay_standalone_membership_disposition disposition
    ON disposition.provider_video_id=staged.provider_video_id
   AND disposition.last_evidence_status=staged.last_evidence_status
  WHERE disposition.provider_video_id IS NULL)),
('standaloneMembershipUnexpected',(SELECT count(*)
  FROM _giq_history_merge.replay_standalone_membership_disposition disposition
  LEFT JOIN _giq_history_stage.replay_standalone_only_provider_id staged
    ON staged.provider_video_id=disposition.provider_video_id
   AND staged.last_evidence_status=disposition.last_evidence_status
  WHERE staged.provider_video_id IS NULL)),
('standaloneDispositionInvalid',(SELECT count(*)
  FROM _giq_history_merge.replay_standalone_membership_disposition
  WHERE disposition NOT IN ('present_in_cloned_race_video','explicitly_missing','quarantined')));

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
SELECT
  'replay_media_partition',
  CASE WHEN coalesce(sum(value),0)=0 THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'partitionRows',(SELECT coalesce(sum(rows),0) FROM giq_audit_media_partition),
    'partitionCells',(SELECT count(*) FROM giq_audit_media_partition),
    'gapMetrics',coalesce(jsonb_object_agg(metric,value ORDER BY metric),'{}'::jsonb)
  )
FROM giq_audit_media_metric;

CREATE TEMP TABLE giq_audit_pedigree_metric (
  metric text PRIMARY KEY,
  value bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_audit_pedigree_metric(metric,value)
VALUES
('dogSelfParents',(SELECT count(*) FROM public."Dog"
  WHERE id="sireId" OR id="damId")),
('sameSireAndDam',(SELECT count(*) FROM public."Dog"
  WHERE "sireId" IS NOT NULL AND "sireId"="damId")),
('invalidAssertionRelationships',(SELECT count(*) FROM public."PedigreeAssertion"
  WHERE relationship NOT IN ('sire','dam'))),
('unresolvedAssertionSubjects',(SELECT count(*)
  FROM public."PedigreeAssertion" assertion
  JOIN public."DogSourceIdentity" subject ON subject.id=assertion."subjectIdentityId"
  WHERE subject."dogId" IS NULL)),
('unresolvedAssertionParents',(SELECT count(*)
  FROM public."PedigreeAssertion" assertion
  LEFT JOIN public."DogSourceIdentity" parent ON parent.id=assertion."parentIdentityId"
  WHERE assertion."verificationStatus" NOT IN ('rejected','conflict')
    AND (assertion."parentIdentityId" IS NULL OR parent."dogId" IS NULL))),
('unresolvedAssertionVerification',(SELECT count(*) FROM public."PedigreeAssertion"
  WHERE "verificationStatus" NOT IN ('verified','conflict','rejected'))),
('unresolvedIdentityVerification',(SELECT count(*) FROM public."DogSourceIdentity"
  WHERE "verificationStatus" NOT IN ('verified','conflict','rejected'))),
('unresolvedImportRunVerification',(SELECT count(*) FROM public."PedigreeImportRun"
  WHERE "verificationStatus" NOT IN ('verified','conflict','rejected')
     OR "completedAt" IS NULL)),
('invalidAssertionEvidenceHashes',(SELECT count(*) FROM public."PedigreeAssertion"
  WHERE "evidenceSha256" !~ '^[0-9a-f]{64}$')),
('invalidIdentityEvidenceHashes',(SELECT count(*) FROM public."DogSourceIdentity"
  WHERE "evidenceSha256" !~ '^[0-9a-f]{64}$')),
('thedogsIdentityProjectionGaps',(SELECT count(*)
  FROM _giq_history_stage.thedogs_source_identity staged
  LEFT JOIN public."DogSourceIdentity" canonical ON canonical.id=staged.identity_id
  WHERE canonical.id IS NULL
     OR (canonical."dogId",lower(canonical."sourceProvider"),canonical."sourceId",
         canonical."importRunId")
       IS DISTINCT FROM (staged.target_id,'thedogs',staged.source_id,staged.import_run_id))),
('thedogsAssertionProjectionGaps',(SELECT count(*)
  FROM _giq_history_stage.normalized_pedigree_edge staged
  JOIN _giq_history_stage.thedogs_source_identity subject
    ON subject.target_id=staged.child_id
  LEFT JOIN _giq_history_stage.thedogs_source_identity parent
    ON parent.target_id=staged.parent_id
  JOIN _giq_history_stage.pedigree_merge_decision decision
    ON decision.natural_key=staged.natural_key
  LEFT JOIN public."PedigreeAssertion" canonical
    ON canonical.id=_giq_history_merge.history_id('pedassert',staged.natural_key)
  WHERE staged.duplicate_rank=1
    AND (canonical.id IS NULL
      OR (lower(canonical."sourceProvider"),canonical."subjectIdentityId",
          canonical."parentIdentityId",canonical.relationship,
          canonical."assertedParentName",canonical."verificationStatus")
        IS DISTINCT FROM (
          'thedogs',subject.identity_id,
          CASE WHEN staged.self_parent THEN NULL ELSE parent.identity_id END,
          staged.relationship,staged.parent_name,
          CASE decision.decision
            WHEN 'no_change' THEN 'verified'
            WHEN 'preserved_higher_authority' THEN 'conflict'
            WHEN 'rejected_ambiguous' THEN 'rejected'
            ELSE 'parsed'
          END
        )))),
('unexpectedThedogsIdentities',(SELECT count(*)
  FROM public."DogSourceIdentity" canonical
  WHERE lower(canonical."sourceProvider")='thedogs'
    AND EXISTS(
      SELECT 1 FROM _giq_history_stage.thedogs_source_identity staged_run
      WHERE staged_run.import_run_id=canonical."importRunId"
    )
    AND NOT EXISTS(
      SELECT 1 FROM _giq_history_stage.thedogs_source_identity staged
      WHERE staged.identity_id=canonical.id
    ))),
('unexpectedThedogsAssertions',(SELECT count(*)
  FROM public."PedigreeAssertion" canonical
  WHERE lower(canonical."sourceProvider")='thedogs'
    AND EXISTS(
      SELECT 1 FROM _giq_history_stage.thedogs_source_identity staged_run
      WHERE staged_run.import_run_id=canonical."importRunId"
    )
    AND NOT EXISTS(
      SELECT 1 FROM _giq_history_stage.normalized_pedigree_edge staged
      WHERE staged.duplicate_rank=1
        AND _giq_history_merge.history_id('pedassert',staged.natural_key)=canonical.id
    ))),
('galtdIdentityProjectionGaps',(SELECT count(*)
  FROM _giq_history_stage.galtd_source_identity staged
  LEFT JOIN public."DogSourceIdentity" canonical ON canonical.id=staged.identity_id
  WHERE canonical.id IS NULL
     OR (canonical."dogId",lower(canonical."sourceProvider"),canonical."sourceId",
         canonical."importRunId",canonical."artifactSha256")
       IS DISTINCT FROM (staged.dog_id,'galtd',staged.payload->>'sourceId',
                         staged.import_run_id,staged.payload->>'artifactSha256'))),
('galtdAssertionProjectionGaps',(SELECT count(*)
  FROM _giq_history_stage.galtd_assertion staged
  LEFT JOIN public."PedigreeAssertion" canonical
    ON canonical.id=_giq_history_merge.history_id(
      'pedassert','galtd:' || (staged.payload->>'sourceId')
    )
  WHERE canonical.id IS NULL
     OR (lower(canonical."sourceProvider"),canonical.relationship,
         canonical."artifactSha256",canonical."evidenceSha256")
       IS DISTINCT FROM ('galtd',staged.payload->>'relationship',
                         staged.payload->>'artifactSha256',staged.payload->>'evidenceSha256'))),
('unexpectedGaltdIdentities',(SELECT count(*)
  FROM public."DogSourceIdentity" canonical
  WHERE lower(canonical."sourceProvider")='galtd'
    AND EXISTS(
      SELECT 1 FROM _giq_history_stage.galtd_source_identity staged_run
      WHERE staged_run.import_run_id=canonical."importRunId"
    )
    AND NOT EXISTS(
      SELECT 1 FROM _giq_history_stage.galtd_source_identity staged
      WHERE staged.identity_id=canonical.id
    ))),
('unexpectedGaltdAssertions',(SELECT count(*)
  FROM public."PedigreeAssertion" canonical
  WHERE lower(canonical."sourceProvider")='galtd'
    AND EXISTS(
      SELECT 1 FROM _giq_history_stage.galtd_source_identity staged_run
      WHERE staged_run.import_run_id=canonical."importRunId"
    )
    AND NOT EXISTS(
      SELECT 1 FROM _giq_history_stage.galtd_assertion staged
      WHERE _giq_history_merge.history_id(
        'pedassert','galtd:' || (staged.payload->>'sourceId')
      )=canonical.id
    ))),
('pendingAuthoritativeDecisions',(SELECT count(*)
  FROM _giq_history_stage.pedigree_merge_decision
  WHERE duplicate_rank=1 AND decision='pending_authoritative_verification')),
('thedogsLedgerGaps',(SELECT count(*)
  FROM _giq_history_stage.pedigree_merge_decision staged
  LEFT JOIN public."PedigreeMergeLedger" ledger
    ON ledger."assertionId"=_giq_history_merge.history_id('pedassert',staged.natural_key)
   AND ledger."dogId"=staged.child_id
   AND ledger.decision=staged.decision
  WHERE staged.duplicate_rank=1
    AND staged.decision<>'pending_authoritative_verification'
    AND ledger.id IS NULL)),
('galtdLedgerGaps',(SELECT count(*)
  FROM _giq_history_stage.galtd_merge_decision staged
  LEFT JOIN public."PedigreeMergeLedger" ledger
    ON ledger."assertionId"=staged.assertion_id
   AND ledger."dogId"=staged.child_id
   AND ledger.decision=staged.decision
  WHERE ledger.id IS NULL)),
('unexpectedPedigreeLedgerRows',(SELECT count(*)
  FROM public."PedigreeMergeLedger" ledger
  WHERE lower(ledger."sourceProvider") IN ('thedogs','galtd')
    AND NOT EXISTS(
      SELECT 1 FROM _giq_history_stage.pedigree_merge_decision staged
      WHERE staged.duplicate_rank=1
        AND staged.decision<>'pending_authoritative_verification'
        AND _giq_history_merge.history_id('pedassert',staged.natural_key)=ledger."assertionId"
        AND staged.child_id=ledger."dogId"
        AND staged.decision=ledger.decision
    )
    AND NOT EXISTS(
      SELECT 1 FROM _giq_history_stage.galtd_merge_decision staged
      WHERE staged.assertion_id=ledger."assertionId"
        AND staged.child_id=ledger."dogId"
        AND staged.decision=ledger.decision
    ))),
('canonicalPedigreeDecisionMismatches',(SELECT count(*)
  FROM (
    SELECT staged.child_id,staged.relationship,staged.parent_id AS expected_parent
    FROM _giq_history_stage.pedigree_merge_decision staged
    WHERE staged.duplicate_rank=1 AND staged.decision='no_change'
    UNION ALL
    SELECT staged.child_id,staged.relationship,staged.existing_parent_id
    FROM _giq_history_stage.pedigree_merge_decision staged
    WHERE staged.duplicate_rank=1 AND staged.decision='preserved_higher_authority'
    UNION ALL
    SELECT staged.child_id,staged.relationship,staged.proposed_parent_id
    FROM _giq_history_stage.galtd_merge_decision staged
    WHERE staged.decision IN ('accepted','no_change')
  ) decision
  JOIN public."Dog" dog ON dog.id=decision.child_id
  WHERE (CASE decision.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
    IS DISTINCT FROM decision.expected_parent)),
('blockingPedigreeQuarantines',(SELECT count(*)
  FROM _giq_history_merge.quarantine
  WHERE blocking AND (
    entity_type ILIKE '%dog%' OR entity_type ILIKE '%pedigree%'
    OR reason_code ILIKE '%parent%' OR reason_code ILIKE '%identity%'
  )));

CREATE TEMP TABLE giq_audit_pedigree_edge (
  child_id text NOT NULL,
  parent_id text NOT NULL,
  PRIMARY KEY(child_id,parent_id)
) ON COMMIT DROP;
INSERT INTO giq_audit_pedigree_edge(child_id,parent_id)
SELECT id,"sireId" FROM public."Dog" WHERE "sireId" IS NOT NULL
UNION
SELECT id,"damId" FROM public."Dog" WHERE "damId" IS NOT NULL;
CREATE INDEX giq_audit_pedigree_edge_parent_idx
  ON giq_audit_pedigree_edge(parent_id);

CREATE TEMP TABLE giq_audit_pedigree_cycle_result (
  initial_edges bigint NOT NULL,
  pruned_edges bigint NOT NULL,
  remaining_edges bigint NOT NULL,
  pruning_rounds integer NOT NULL
) ON COMMIT DROP;

DO $pedigree_cycle$
DECLARE
  initial_count bigint;
  remaining_count bigint;
  removed_count bigint;
  total_removed bigint:=0;
  rounds integer:=0;
BEGIN
  SELECT count(*) INTO initial_count FROM giq_audit_pedigree_edge;
  LOOP
    DELETE FROM giq_audit_pedigree_edge edge
    WHERE NOT EXISTS(
      SELECT 1 FROM giq_audit_pedigree_edge parent_edge
      WHERE parent_edge.child_id=edge.parent_id
    );
    GET DIAGNOSTICS removed_count=ROW_COUNT;
    EXIT WHEN removed_count=0;
    total_removed:=total_removed+removed_count;
    rounds:=rounds+1;
  END LOOP;
  SELECT count(*) INTO remaining_count FROM giq_audit_pedigree_edge;
  INSERT INTO giq_audit_pedigree_cycle_result
  VALUES(initial_count,total_removed,remaining_count,rounds);
END
$pedigree_cycle$;

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
SELECT
  'pedigree_assertion_resolution',
  CASE WHEN coalesce(sum(value),0)=0 THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'gapMetrics',coalesce(jsonb_object_agg(metric,value ORDER BY metric),'{}'::jsonb),
    'importRuns',(SELECT count(*) FROM public."PedigreeImportRun"),
    'sourceIdentities',(SELECT count(*) FROM public."DogSourceIdentity"),
    'assertions',(SELECT count(*) FROM public."PedigreeAssertion"),
    'mergeLedgerRows',(SELECT count(*) FROM public."PedigreeMergeLedger")
  )
FROM giq_audit_pedigree_metric;

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
SELECT
  'pedigree_acyclicity',
  CASE WHEN remaining_edges=0 THEN 'pass' ELSE 'fail' END,
  true,
  jsonb_build_object(
    'initialEdges',initial_edges,
    'prunedEdges',pruned_edges,
    'remainingCycleBoundEdges',remaining_edges,
    'pruningRounds',pruning_rounds,
    'algorithm','indexed-root-pruning'
  )
FROM giq_audit_pedigree_cycle_result;

INSERT INTO giq_audit_check(check_name,status,blocking,metrics)
WITH classification AS (
  SELECT
    (SELECT count(*) FROM _giq_history_merge.disposition disposition
      WHERE nullif(btrim(disposition.disposition_code),'') IS NULL) AS blank_dispositions,
    (SELECT count(*) FROM _giq_history_merge.disposition disposition
      WHERE disposition.canonical_entity_type IS NOT NULL
        AND NOT EXISTS(
          SELECT 1 FROM giq_audit_public_table catalog
          WHERE catalog.table_name=disposition.canonical_entity_type
        )) AS unknown_canonical_entity_types,
    (SELECT count(*) FROM _giq_history_merge.quarantine quarantine
      WHERE nullif(btrim(quarantine.entity_type),'') IS NULL
         OR nullif(btrim(quarantine.reason_code),'') IS NULL
         OR nullif(btrim(quarantine.disposition),'') IS NULL) AS blank_quarantine_classifications,
    (SELECT count(*) FROM _giq_history_merge.quarantine WHERE blocking) AS blocking_quarantines,
    (SELECT coalesce(value,0) FROM giq_audit_media_metric
      WHERE metric='unclassifiedMediaRows') AS unclassified_media_rows,
    (SELECT count(*) FROM giq_audit_jurisdiction_coverage
      WHERE canonical_races=0 OR normalized_races=0) AS unclassified_required_states,
    (SELECT coalesce(sum(unexpected_history_rows),0)
      FROM giq_audit_normalized_entity) AS unclassified_history_rows
)
SELECT
  'zero_unclassified_entities',
  CASE WHEN blank_dispositions=0
             AND unknown_canonical_entity_types=0
             AND blank_quarantine_classifications=0
             AND blocking_quarantines=0
             AND unclassified_media_rows=0
             AND unclassified_required_states=0
             AND unclassified_history_rows=0
       THEN 'pass' ELSE 'fail' END,
  true,
  to_jsonb(classification)
FROM classification;

CREATE TEMP TABLE giq_audit_manifest (
  manifest jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO giq_audit_manifest(manifest)
SELECT jsonb_build_object(
  'schemaVersion','giq-candidate-canonical-integrity/v1',
  'status',CASE WHEN EXISTS(
    SELECT 1 FROM giq_audit_check WHERE blocking AND status='fail'
  ) THEN 'blocked' ELSE 'pass' END,
  'sourceOnly',true,
  'persistentWrites',false,
  'database',current_database(),
  'capturedAt',transaction_timestamp(),
  'phase',(SELECT phase FROM _giq_history_merge.run WHERE id=1),
  'checks',(SELECT jsonb_object_agg(
    check_name,jsonb_build_object('status',status,'blocking',blocking,'metrics',metrics)
    ORDER BY check_name
  ) FROM giq_audit_check),
  'blockers',(SELECT coalesce(jsonb_agg(check_name ORDER BY check_name),'[]'::jsonb)
    FROM giq_audit_check WHERE blocking AND status='fail'),
  'publicTables',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table',catalog.table_name,
    'policy',catalog.policy,
    'rows',catalog.row_count,
    'orderedPrimaryKey',to_jsonb(catalog.pk_columns),
    'rlsEnabled',catalog.rls_enabled,
    'rlsForced',catalog.rls_forced,
    'policies',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'name',policy.polname,
        'command',policy.polcmd,
        'permissive',policy.polpermissive
      ) ORDER BY policy.polname)
      FROM pg_policy policy WHERE policy.polrelid=catalog.relation_oid
    ),'[]'::jsonb)
  ) ORDER BY catalog.table_name),'[]'::jsonb) FROM giq_audit_public_table catalog),
  'foreignKeys',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'constraint',constraint_name,
    'child',child_schema || '.' || child_table,
    'parent',parent_schema || '.' || parent_table,
    'childColumns',to_jsonb(child_columns),
    'parentColumns',to_jsonb(parent_columns),
    'validated',constraint_valid,
    'orphanRows',orphan_rows
  ) ORDER BY child_schema,child_table,constraint_name),'[]'::jsonb)
  FROM giq_audit_foreign_key),
  'alternateIdentities',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'entity',entity_type,'identity',identity_kind,'duplicateGroups',duplicate_groups
  ) ORDER BY entity_type,identity_kind),'[]'::jsonb)
  FROM giq_audit_duplicate_identity),
  'sequences',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'sequence',sequence_schema || '.' || sequence_name,
    'owner',CASE WHEN owner_count=1 THEN owner_schema || '.' || owner_table || '.' || owner_column END,
    'increment',increment_by,
    'lastValue',last_value,
    'isCalled',is_called,
    'nextValue',next_value,
    'ownerMin',owner_min,
    'ownerMax',owner_max,
    'nextValueSafe',next_value_safe
  ) ORDER BY sequence_schema,sequence_name),'[]'::jsonb)
  FROM giq_audit_sequence),
  'jurisdictions',(SELECT jsonb_agg(to_jsonb(coverage) ORDER BY state)
    FROM giq_audit_jurisdiction_coverage coverage),
  'normalizedEntities',(SELECT jsonb_agg(to_jsonb(entity) ORDER BY entity_type)
    FROM giq_audit_normalized_entity entity),
  'mediaPartitions',(SELECT coalesce(jsonb_agg(to_jsonb(partition)
    ORDER BY media_class,disposition),'[]'::jsonb) FROM giq_audit_media_partition partition),
  'pedigree',(SELECT jsonb_build_object(
    'metrics',(SELECT jsonb_object_agg(metric,value ORDER BY metric)
      FROM giq_audit_pedigree_metric),
    'cycleProof',(SELECT to_jsonb(cycle) FROM giq_audit_pedigree_cycle_result cycle)
  ))
);

SELECT manifest AS candidate_canonical_integrity_manifest
FROM giq_audit_manifest;
SELECT (manifest->>'status'='pass') AS audit_pass
FROM giq_audit_manifest
\gset

ROLLBACK;

\if :audit_pass
\echo 'CANDIDATE_CANONICAL_INTEGRITY_AUDIT: PASS'
\else
\echo 'OPERATOR_ATTENTION: candidate canonical integrity audit is blocked; inspect the emitted manifest.'
\quit 3
\endif
