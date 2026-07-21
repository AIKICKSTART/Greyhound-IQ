\set ON_ERROR_STOP on

BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL synchronous_commit=on;
SET LOCAL statement_timeout=0;

SELECT pg_advisory_xact_lock(
  hashtextextended('giq-authoritative-pedigree-saturation/v1-archive',0)
);

CREATE TEMP TABLE _giq_pedigree_v1_archive_anchor(id boolean PRIMARY KEY);

CREATE FUNCTION pg_temp.giq_pedigree_v1_catalog(target_schema text)
RETURNS jsonb
LANGUAGE sql
STABLE
STRICT
AS $catalog$
WITH relations AS (
  SELECT c.oid AS relation_oid,c.relname AS relation_name,c.relkind,c.relpersistence,
         c.relam,c.relfilenode,c.reltablespace,c.relowner,c.relchecks,c.relrowsecurity,
         c.relforcerowsecurity,c.relreplident,c.relispartition,c.reloptions
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname=target_schema
    AND c.relname IN (
      'authoritative_provider_policy','authoritative_identity_evidence',
      'authoritative_pedigree_evidence','authoritative_consolidation_proof',
      'authoritative_identity_candidate_search','authoritative_identity_resolution',
      'authoritative_pedigree_resolution','authoritative_pedigree_conflict_ledger',
      'authoritative_pedigree_retrieval_queue','current_pedigree_quarantine'
    )
)
SELECT coalesce(jsonb_agg(jsonb_build_object(
  'name',relation_name,
  'oid',relation_oid,
  'kind',relkind,
  'persistence',relpersistence,
  'accessMethodOid',relam,
  'fileNode',relfilenode,
  'tablespaceOid',reltablespace,
  'ownerOid',relowner,
  'checkCount',relchecks,
  'rowSecurity',relrowsecurity,
  'forceRowSecurity',relforcerowsecurity,
  'replicaIdentity',relreplident,
  'isPartition',relispartition,
  'options',to_jsonb(reloptions),
  'columns',(
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'number',a.attnum,'name',a.attname,'typeOid',a.atttypid,'typeModifier',a.atttypmod,
      'collationOid',a.attcollation,'notNull',a.attnotnull,'hasDefault',a.atthasdef,
      'identity',a.attidentity,'generated',a.attgenerated,'storage',a.attstorage,
      'compression',a.attcompression,'hasMissing',a.atthasmissing,
      'missingValue',to_jsonb(a.attmissingval)
    ) ORDER BY a.attnum),'[]'::jsonb)
    FROM pg_attribute a
    WHERE a.attrelid=relation_oid AND a.attnum>0 AND NOT a.attisdropped
  ),
  'defaults',(
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'columnNumber',d.adnum,'expression',d.adbin::text
    ) ORDER BY d.adnum),'[]'::jsonb)
    FROM pg_attrdef d WHERE d.adrelid=relation_oid
  ),
  'constraints',(
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name',con.conname,'type',con.contype,'deferrable',con.condeferrable,
      'deferred',con.condeferred,'validated',con.convalidated,
      'parentConstraintOid',con.conparentid,'referencedRelationOid',con.confrelid,
      'keyColumns',con.conkey::text,'referencedColumns',con.confkey::text,
      'foreignMatchType',con.confmatchtype,'foreignUpdateType',con.confupdtype,
      'foreignDeleteType',con.confdeltype,'exclusionOperators',con.conexclop::text,
      'expression',con.conbin::text
    ) ORDER BY con.conname),'[]'::jsonb)
    FROM pg_constraint con WHERE con.conrelid=relation_oid
  ),
  'indexes',(
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'oid',idx.indexrelid,'name',idx_class.relname,'accessMethodOid',idx_class.relam,
      'unique',idx.indisunique,'nullsNotDistinct',idx.indnullsnotdistinct,
      'primary',idx.indisprimary,'exclusion',idx.indisexclusion,
      'immediate',idx.indimmediate,'valid',idx.indisvalid,'ready',idx.indisready,
      'live',idx.indislive,'replicaIdentity',idx.indisreplident,
      'keyAttributeCount',idx.indnkeyatts,'attributeCount',idx.indnatts,
      'keys',idx.indkey::text,'collations',idx.indcollation::text,
      'operatorClasses',idx.indclass::text,'options',idx.indoption::text,
      'expressions',idx.indexprs::text,'predicate',idx.indpred::text
    ) ORDER BY idx_class.relname),'[]'::jsonb)
    FROM pg_index idx
    JOIN pg_class idx_class ON idx_class.oid=idx.indexrelid
    WHERE idx.indrelid=relation_oid
  ),
  'rules',(
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name',rule.rulename,'event',rule.ev_type,'enabled',rule.ev_enabled,
      'instead',rule.is_instead,'action',rule.ev_action::text,'qualification',rule.ev_qual::text
    ) ORDER BY rule.rulename),'[]'::jsonb)
    FROM pg_rewrite rule WHERE rule.ev_class=relation_oid
  ),
  'triggers',(
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'oid',trg.oid,'name',trg.tgname,'functionOid',trg.tgfoid,
      'type',trg.tgtype,'enabled',trg.tgenabled,
      'constraintRelationOid',trg.tgconstrrelid,'constraintOid',trg.tgconstraint,
      'parentTriggerOid',trg.tgparentid,'deferrable',trg.tgdeferrable,
      'initiallyDeferred',trg.tginitdeferred,'argumentCount',trg.tgnargs,
      'columns',trg.tgattr::text,'arguments',encode(trg.tgargs,'hex')
    ) ORDER BY trg.tgname),'[]'::jsonb)
    FROM pg_trigger trg
    WHERE trg.tgrelid=relation_oid AND NOT trg.tgisinternal
      AND trg.tgname<>'pedigree_v1_archive_reject_writes'
  )
) ORDER BY relation_name),'[]'::jsonb)
FROM relations;
$catalog$;

CREATE FUNCTION pg_temp.giq_pedigree_v1_rows(target_schema text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
STRICT
AS $rows$
DECLARE
  relation_name text;
  relation_rows bigint;
  evidence jsonb:='{}'::jsonb;
BEGIN
  IF target_schema NOT IN ('_giq_history_stage','_giq_history_pedigree_v1_archive') THEN
    RAISE EXCEPTION 'unsupported pedigree v1 row-count schema %',target_schema;
  END IF;
  FOREACH relation_name IN ARRAY ARRAY[
    'authoritative_provider_policy','authoritative_identity_evidence',
    'authoritative_pedigree_evidence','authoritative_consolidation_proof',
    'authoritative_identity_candidate_search','authoritative_identity_resolution',
    'authoritative_pedigree_resolution','authoritative_pedigree_conflict_ledger',
    'authoritative_pedigree_retrieval_queue','current_pedigree_quarantine'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I',target_schema,relation_name)
      INTO STRICT relation_rows;
    evidence:=evidence || jsonb_build_object(relation_name,relation_rows);
  END LOOP;
  RETURN evidence;
END
$rows$;

DO $$
DECLARE
  observed_phase text;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id=1 FOR UPDATE;
  IF observed_phase<>'normalized' THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive requires normalized, observed %',observed_phase;
  END IF;
END
$$;

WITH expected(relation_name,relation_kind) AS (
  VALUES
    ('authoritative_provider_policy','r'::"char"),
    ('authoritative_identity_evidence','r'::"char"),
    ('authoritative_pedigree_evidence','r'::"char"),
    ('authoritative_consolidation_proof','r'::"char"),
    ('current_pedigree_quarantine','r'::"char"),
    ('authoritative_identity_candidate_search','v'::"char"),
    ('authoritative_identity_resolution','v'::"char"),
    ('authoritative_pedigree_resolution','v'::"char"),
    ('authoritative_pedigree_conflict_ledger','v'::"char"),
    ('authoritative_pedigree_retrieval_queue','v'::"char")
), observed AS (
  SELECT c.relname AS relation_name,c.relkind AS relation_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='_giq_history_pedigree_v1_archive'
    AND c.relname IN (SELECT relation_name FROM expected)
)
SELECT count(*)=10
   AND NOT EXISTS(
     SELECT 1 FROM expected
     LEFT JOIN observed USING(relation_name,relation_kind)
     WHERE observed.relation_name IS NULL
   )
   AND to_regclass('_giq_history_merge.authoritative_pedigree_saturation_archive_manifest')
       IS NOT NULL AS pedigree_v1_archive_complete
FROM observed
\gset

\if :pedigree_v1_archive_complete
LOCK TABLE
  _giq_history_merge.authoritative_pedigree_saturation_archive_manifest,
  _giq_history_pedigree_v1_archive.authoritative_provider_policy,
  _giq_history_pedigree_v1_archive.authoritative_identity_evidence,
  _giq_history_pedigree_v1_archive.authoritative_pedigree_evidence,
  _giq_history_pedigree_v1_archive.authoritative_consolidation_proof,
  _giq_history_pedigree_v1_archive.current_pedigree_quarantine,
  _giq_history_pedigree_v1_archive.authoritative_identity_candidate_search,
  _giq_history_pedigree_v1_archive.authoritative_identity_resolution,
  _giq_history_pedigree_v1_archive.authoritative_pedigree_resolution,
  _giq_history_pedigree_v1_archive.authoritative_pedigree_conflict_ledger,
  _giq_history_pedigree_v1_archive.authoritative_pedigree_retrieval_queue
IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  archived_manifest jsonb;
  source_manifest_sha256 text;
  source_catalog_sha256 text;
  archived_catalog_sha256 text;
  source_row_counts jsonb;
  archived_row_counts jsonb;
  current_catalog_sha256 text;
  current_row_counts jsonb;
BEGIN
  IF EXISTS(
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
    WHERE namespace.nspname='_giq_history_pedigree_v1_archive'
      AND relation.relkind IN ('r','p','v','m','f')
      AND relation.relname NOT IN (
        'authoritative_provider_policy','authoritative_identity_evidence',
        'authoritative_pedigree_evidence','authoritative_consolidation_proof',
        'authoritative_identity_candidate_search','authoritative_identity_resolution',
        'authoritative_pedigree_resolution','authoritative_pedigree_conflict_ledger',
        'authoritative_pedigree_retrieval_queue','current_pedigree_quarantine'
      )
  ) THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive contains an unexpected relation';
  END IF;
  IF (SELECT count(*)
      FROM _giq_history_merge.authoritative_pedigree_saturation_archive_manifest)<>1 THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive manifest cardinality changed';
  END IF;
  SELECT manifest.source_manifest,manifest.source_manifest_sha256,
         manifest.source_catalog_sha256,manifest.archived_catalog_sha256,
         manifest.source_row_counts,manifest.archived_row_counts
  INTO STRICT archived_manifest,source_manifest_sha256,source_catalog_sha256,
              archived_catalog_sha256,source_row_counts,archived_row_counts
  FROM _giq_history_merge.authoritative_pedigree_saturation_archive_manifest manifest
  WHERE manifest.archive_id='giq-authoritative-pedigree-saturation/v1'
    AND manifest.source_schema='_giq_history_stage'
    AND manifest.archive_schema='_giq_history_pedigree_v1_archive'
    AND manifest.catalog_fingerprint_version='giq-pedigree-v1-catalog/v1';

  current_catalog_sha256:=encode(digest(
    pg_temp.giq_pedigree_v1_catalog('_giq_history_pedigree_v1_archive')::text,'sha256'
  ),'hex');
  current_row_counts:=pg_temp.giq_pedigree_v1_rows('_giq_history_pedigree_v1_archive');
  IF archived_manifest->>'schema_version'<>'giq-authoritative-pedigree-saturation/v1'
     OR archived_manifest->>'status'<>'blocked'
     OR source_manifest_sha256<>encode(digest(archived_manifest::text,'sha256'),'hex')
     OR source_catalog_sha256<>archived_catalog_sha256
     OR archived_catalog_sha256<>current_catalog_sha256
     OR source_row_counts<>archived_row_counts
     OR archived_row_counts<>current_row_counts THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive fingerprint or row parity changed';
  END IF;
  IF source_row_counts->>'authoritative_provider_policy' IS DISTINCT FROM '6'
     OR source_row_counts->>'authoritative_identity_evidence' IS DISTINCT FROM '0'
     OR source_row_counts->>'authoritative_pedigree_evidence' IS DISTINCT FROM '0'
     OR source_row_counts->>'authoritative_consolidation_proof' IS DISTINCT FROM '0'
     OR source_row_counts->>'current_pedigree_quarantine' IS DISTINCT FROM '107004'
     OR source_row_counts->>'authoritative_pedigree_retrieval_queue' IS DISTINCT FROM '106988' THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive is not the reviewed clone partition';
  END IF;
  IF (SELECT count(*)
      FROM pg_trigger trg
      JOIN pg_class relation ON relation.oid=trg.tgrelid
      JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
      WHERE namespace.nspname='_giq_history_pedigree_v1_archive'
        AND relation.relname IN (
          'authoritative_provider_policy','authoritative_identity_evidence',
          'authoritative_pedigree_evidence','authoritative_consolidation_proof',
          'current_pedigree_quarantine'
        )
        AND trg.tgname='pedigree_v1_archive_reject_writes'
        AND NOT trg.tgisinternal AND trg.tgenabled<>'D')<>5 THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive write guards changed';
  END IF;
  IF (SELECT count(*)
      FROM pg_trigger
      WHERE tgrelid='_giq_history_merge.authoritative_pedigree_saturation_archive_manifest'::regclass
        AND tgname='authoritative_pedigree_v1_archive_manifest_append_only'
        AND NOT tgisinternal AND tgenabled<>'D')<>1 THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive manifest is not append-only';
  END IF;
  IF EXISTS(
       SELECT 1
       FROM pg_namespace namespace
       CROSS JOIN LATERAL aclexplode(coalesce(
         namespace.nspacl,acldefault('n',namespace.nspowner)
       )) acl_entry
       WHERE namespace.nspname='_giq_history_pedigree_v1_archive'
         AND acl_entry.grantee=0
     ) OR EXISTS(
       SELECT 1
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
       CROSS JOIN LATERAL aclexplode(coalesce(
         relation.relacl,acldefault('r',relation.relowner)
       )) acl_entry
       WHERE acl_entry.grantee=0 AND (
         namespace.nspname='_giq_history_pedigree_v1_archive'
         OR (namespace.nspname='_giq_history_merge'
             AND relation.relname='authoritative_pedigree_saturation_archive_manifest')
       )
     ) OR EXISTS(
       SELECT 1
       FROM pg_proc routine
       JOIN pg_namespace namespace ON namespace.oid=routine.pronamespace
       CROSS JOIN LATERAL aclexplode(coalesce(
         routine.proacl,acldefault('f',routine.proowner)
       )) acl_entry
       WHERE acl_entry.grantee=0 AND (
         (namespace.nspname='_giq_history_pedigree_v1_archive'
          AND routine.proname='reject_archive_write')
         OR (namespace.nspname='_giq_history_merge'
             AND routine.proname='reject_authoritative_pedigree_archive_manifest_mutation')
       )
     ) THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive exposes PUBLIC privileges';
  END IF;
END
$$;
COMMIT;
\echo 'AUTHORITATIVE_PEDIGREE_V1_ARCHIVE_ALREADY_VERIFIED'
\quit
\endif

DO $$
DECLARE
  missing_or_wrong text;
  observed_v2_partition integer;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='_giq_history_pedigree_v1_archive')
     OR to_regclass('_giq_history_merge.authoritative_pedigree_saturation_archive_manifest')
        IS NOT NULL THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive is partial or mixed';
  END IF;
  WITH expected(relation_name,relation_kind) AS (
    VALUES
      ('authoritative_provider_policy','r'::"char"),
      ('authoritative_identity_evidence','r'::"char"),
      ('authoritative_pedigree_evidence','r'::"char"),
      ('authoritative_consolidation_proof','r'::"char"),
      ('current_pedigree_quarantine','r'::"char"),
      ('authoritative_identity_candidate_search','v'::"char"),
      ('authoritative_identity_resolution','v'::"char"),
      ('authoritative_pedigree_resolution','v'::"char"),
      ('authoritative_pedigree_conflict_ledger','v'::"char"),
      ('authoritative_pedigree_retrieval_queue','v'::"char")
  )
  SELECT string_agg(expected.relation_name,',' ORDER BY expected.relation_name)
  INTO missing_or_wrong
  FROM expected
  LEFT JOIN pg_namespace namespace ON namespace.nspname='_giq_history_stage'
  LEFT JOIN pg_class relation ON relation.relnamespace=namespace.oid
                             AND relation.relname=expected.relation_name
                             AND relation.relkind=expected.relation_kind
  WHERE relation.oid IS NULL;
  IF missing_or_wrong IS NOT NULL THEN
    RAISE EXCEPTION 'authoritative pedigree v1 relation partition is incomplete: %',missing_or_wrong;
  END IF;

  SELECT count(*) INTO observed_v2_partition
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
  WHERE namespace.nspname='_giq_history_stage'
    AND relation.relname IN (
      'authoritative_provider_policy','authoritative_pedigree_assertion_occurrence',
      'authoritative_identity_evidence','authoritative_pedigree_evidence',
      'authoritative_consolidation_proof','authoritative_pedigree_terminal_proof',
      'authoritative_identity_candidate_search','authoritative_identity_resolution',
      'verified_production_pedigree_authority','authoritative_pedigree_evidence_leaf',
      'authoritative_pedigree_terminal_proof_leaf','authoritative_pedigree_resolution',
      'authoritative_pedigree_conflict_ledger','authoritative_pedigree_retrieval_queue',
      'current_pedigree_quarantine'
    );
  IF observed_v2_partition<>10 THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive requires exactly 10 live relations, observed %',
      observed_v2_partition;
  END IF;
END
$$;

LOCK TABLE
  _giq_history_merge.authoritative_pedigree_saturation_manifest,
  _giq_history_stage.authoritative_provider_policy,
  _giq_history_stage.authoritative_identity_evidence,
  _giq_history_stage.authoritative_pedigree_evidence,
  _giq_history_stage.authoritative_consolidation_proof,
  _giq_history_stage.current_pedigree_quarantine,
  _giq_history_stage.authoritative_identity_candidate_search,
  _giq_history_stage.authoritative_identity_resolution,
  _giq_history_stage.authoritative_pedigree_resolution,
  _giq_history_stage.authoritative_pedigree_conflict_ledger,
  _giq_history_stage.authoritative_pedigree_retrieval_queue
IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  v1_manifest jsonb;
  source_rows jsonb;
BEGIN
  IF (SELECT count(*)
      FROM _giq_history_merge.authoritative_pedigree_saturation_manifest)<>1 THEN
    RAISE EXCEPTION 'authoritative pedigree v1 manifest cardinality changed';
  END IF;
  SELECT to_jsonb(manifest) INTO STRICT v1_manifest
  FROM _giq_history_merge.authoritative_pedigree_saturation_manifest manifest
  WHERE id=1 AND schema_version='giq-authoritative-pedigree-saturation/v1'
    AND status='blocked';
  source_rows:=pg_temp.giq_pedigree_v1_rows('_giq_history_stage');
  IF source_rows->>'authoritative_provider_policy' IS DISTINCT FROM '6'
     OR source_rows->>'authoritative_identity_evidence' IS DISTINCT FROM '0'
     OR source_rows->>'authoritative_pedigree_evidence' IS DISTINCT FROM '0'
     OR source_rows->>'authoritative_consolidation_proof' IS DISTINCT FROM '0'
     OR source_rows->>'current_pedigree_quarantine' IS DISTINCT FROM '107004'
     OR source_rows->>'authoritative_pedigree_retrieval_queue' IS DISTINCT FROM '106988' THEN
    RAISE EXCEPTION 'authoritative pedigree v1 live rows are not the reviewed clone partition';
  END IF;
END
$$;

CREATE TEMP TABLE _giq_pedigree_v1_archive_evidence (
  source_manifest jsonb NOT NULL,
  source_catalog jsonb NOT NULL,
  source_row_counts jsonb NOT NULL,
  archived_catalog jsonb,
  archived_row_counts jsonb
);

INSERT INTO _giq_pedigree_v1_archive_evidence
  (source_manifest,source_catalog,source_row_counts)
SELECT to_jsonb(manifest),pg_temp.giq_pedigree_v1_catalog('_giq_history_stage'),
       pg_temp.giq_pedigree_v1_rows('_giq_history_stage')
FROM _giq_history_merge.authoritative_pedigree_saturation_manifest manifest
WHERE id=1;

CREATE SCHEMA _giq_history_pedigree_v1_archive AUTHORIZATION CURRENT_USER;
REVOKE ALL ON SCHEMA _giq_history_pedigree_v1_archive FROM PUBLIC;

ALTER TABLE _giq_history_stage.authoritative_provider_policy
  SET SCHEMA _giq_history_pedigree_v1_archive;
ALTER TABLE _giq_history_stage.authoritative_identity_evidence
  SET SCHEMA _giq_history_pedigree_v1_archive;
ALTER TABLE _giq_history_stage.authoritative_pedigree_evidence
  SET SCHEMA _giq_history_pedigree_v1_archive;
ALTER TABLE _giq_history_stage.authoritative_consolidation_proof
  SET SCHEMA _giq_history_pedigree_v1_archive;
ALTER TABLE _giq_history_stage.current_pedigree_quarantine
  SET SCHEMA _giq_history_pedigree_v1_archive;
ALTER VIEW _giq_history_stage.authoritative_identity_candidate_search
  SET SCHEMA _giq_history_pedigree_v1_archive;
ALTER VIEW _giq_history_stage.authoritative_identity_resolution
  SET SCHEMA _giq_history_pedigree_v1_archive;
ALTER VIEW _giq_history_stage.authoritative_pedigree_resolution
  SET SCHEMA _giq_history_pedigree_v1_archive;
ALTER VIEW _giq_history_stage.authoritative_pedigree_conflict_ledger
  SET SCHEMA _giq_history_pedigree_v1_archive;
ALTER VIEW _giq_history_stage.authoritative_pedigree_retrieval_queue
  SET SCHEMA _giq_history_pedigree_v1_archive;

CREATE FUNCTION _giq_history_pedigree_v1_archive.reject_archive_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authoritative pedigree v1 archive is immutable';
END
$$;

CREATE TRIGGER pedigree_v1_archive_reject_writes
BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
ON _giq_history_pedigree_v1_archive.authoritative_provider_policy
FOR EACH STATEMENT EXECUTE FUNCTION _giq_history_pedigree_v1_archive.reject_archive_write();
CREATE TRIGGER pedigree_v1_archive_reject_writes
BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
ON _giq_history_pedigree_v1_archive.authoritative_identity_evidence
FOR EACH STATEMENT EXECUTE FUNCTION _giq_history_pedigree_v1_archive.reject_archive_write();
CREATE TRIGGER pedigree_v1_archive_reject_writes
BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
ON _giq_history_pedigree_v1_archive.authoritative_pedigree_evidence
FOR EACH STATEMENT EXECUTE FUNCTION _giq_history_pedigree_v1_archive.reject_archive_write();
CREATE TRIGGER pedigree_v1_archive_reject_writes
BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
ON _giq_history_pedigree_v1_archive.authoritative_consolidation_proof
FOR EACH STATEMENT EXECUTE FUNCTION _giq_history_pedigree_v1_archive.reject_archive_write();
CREATE TRIGGER pedigree_v1_archive_reject_writes
BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
ON _giq_history_pedigree_v1_archive.current_pedigree_quarantine
FOR EACH STATEMENT EXECUTE FUNCTION _giq_history_pedigree_v1_archive.reject_archive_write();

REVOKE ALL ON ALL TABLES IN SCHEMA _giq_history_pedigree_v1_archive FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA _giq_history_pedigree_v1_archive FROM PUBLIC;
REVOKE ALL ON FUNCTION _giq_history_pedigree_v1_archive.reject_archive_write() FROM PUBLIC;

UPDATE _giq_pedigree_v1_archive_evidence
SET archived_catalog=pg_temp.giq_pedigree_v1_catalog('_giq_history_pedigree_v1_archive'),
    archived_row_counts=pg_temp.giq_pedigree_v1_rows('_giq_history_pedigree_v1_archive');

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM _giq_pedigree_v1_archive_evidence
    WHERE source_catalog IS DISTINCT FROM archived_catalog
       OR source_row_counts IS DISTINCT FROM archived_row_counts
  ) THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive catalog or row parity failed';
  END IF;
  IF (SELECT count(*)
      FROM pg_trigger trg
      JOIN pg_class relation ON relation.oid=trg.tgrelid
      JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
      WHERE namespace.nspname='_giq_history_pedigree_v1_archive'
        AND trg.tgname='pedigree_v1_archive_reject_writes'
        AND NOT trg.tgisinternal AND trg.tgenabled<>'D')<>5 THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive write guards are incomplete';
  END IF;
END
$$;

CREATE TABLE _giq_history_merge.authoritative_pedigree_saturation_archive_manifest (
  archive_id text PRIMARY KEY
    CHECK(archive_id='giq-authoritative-pedigree-saturation/v1'),
  source_schema text NOT NULL CHECK(source_schema='_giq_history_stage'),
  archive_schema text NOT NULL UNIQUE
    CHECK(archive_schema='_giq_history_pedigree_v1_archive'),
  catalog_fingerprint_version text NOT NULL
    CHECK(catalog_fingerprint_version='giq-pedigree-v1-catalog/v1'),
  source_manifest jsonb NOT NULL,
  source_manifest_sha256 text NOT NULL CHECK(source_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  source_catalog_sha256 text NOT NULL CHECK(source_catalog_sha256 ~ '^[0-9a-f]{64}$'),
  archived_catalog_sha256 text NOT NULL CHECK(archived_catalog_sha256 ~ '^[0-9a-f]{64}$'),
  source_row_counts jsonb NOT NULL,
  archived_row_counts jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(source_catalog_sha256=archived_catalog_sha256),
  CHECK(source_row_counts=archived_row_counts)
);

CREATE FUNCTION _giq_history_merge.reject_authoritative_pedigree_archive_manifest_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authoritative pedigree archive manifest is append-only';
END
$$;

CREATE TRIGGER authoritative_pedigree_v1_archive_manifest_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE
ON _giq_history_merge.authoritative_pedigree_saturation_archive_manifest
FOR EACH STATEMENT
EXECUTE FUNCTION _giq_history_merge.reject_authoritative_pedigree_archive_manifest_mutation();

REVOKE ALL ON _giq_history_merge.authoritative_pedigree_saturation_archive_manifest FROM PUBLIC;
REVOKE ALL ON FUNCTION
  _giq_history_merge.reject_authoritative_pedigree_archive_manifest_mutation() FROM PUBLIC;

INSERT INTO _giq_history_merge.authoritative_pedigree_saturation_archive_manifest (
  archive_id,source_schema,archive_schema,catalog_fingerprint_version,
  source_manifest,source_manifest_sha256,source_catalog_sha256,
  archived_catalog_sha256,source_row_counts,archived_row_counts
)
SELECT 'giq-authoritative-pedigree-saturation/v1','_giq_history_stage',
       '_giq_history_pedigree_v1_archive','giq-pedigree-v1-catalog/v1',
       source_manifest,encode(digest(source_manifest::text,'sha256'),'hex'),
       encode(digest(source_catalog::text,'sha256'),'hex'),
       encode(digest(archived_catalog::text,'sha256'),'hex'),
       source_row_counts,archived_row_counts
FROM _giq_pedigree_v1_archive_evidence;

DO $$
BEGIN
  IF (SELECT count(*)
      FROM _giq_history_merge.authoritative_pedigree_saturation_archive_manifest)<>1
     OR EXISTS(
       SELECT 1
       FROM _giq_history_merge.authoritative_pedigree_saturation_archive_manifest
       WHERE source_manifest->>'schema_version'<>'giq-authoritative-pedigree-saturation/v1'
          OR source_manifest->>'status'<>'blocked'
          OR source_manifest_sha256<>encode(digest(source_manifest::text,'sha256'),'hex')
          OR source_catalog_sha256<>archived_catalog_sha256
          OR source_row_counts<>archived_row_counts
     ) THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive manifest verification failed';
  END IF;
  IF EXISTS(
       SELECT 1
       FROM pg_namespace namespace
       CROSS JOIN LATERAL aclexplode(coalesce(
         namespace.nspacl,acldefault('n',namespace.nspowner)
       )) acl_entry
       WHERE namespace.nspname='_giq_history_pedigree_v1_archive'
         AND acl_entry.grantee=0
     ) OR EXISTS(
       SELECT 1
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
       CROSS JOIN LATERAL aclexplode(coalesce(
         relation.relacl,acldefault('r',relation.relowner)
       )) acl_entry
       WHERE acl_entry.grantee=0 AND (
         namespace.nspname='_giq_history_pedigree_v1_archive'
         OR (namespace.nspname='_giq_history_merge'
             AND relation.relname='authoritative_pedigree_saturation_archive_manifest')
       )
     ) OR EXISTS(
       SELECT 1
       FROM pg_proc routine
       JOIN pg_namespace namespace ON namespace.oid=routine.pronamespace
       CROSS JOIN LATERAL aclexplode(coalesce(
         routine.proacl,acldefault('f',routine.proowner)
       )) acl_entry
       WHERE acl_entry.grantee=0 AND (
         (namespace.nspname='_giq_history_pedigree_v1_archive'
          AND routine.proname='reject_archive_write')
         OR (namespace.nspname='_giq_history_merge'
             AND routine.proname='reject_authoritative_pedigree_archive_manifest_mutation')
       )
     ) THEN
    RAISE EXCEPTION 'authoritative pedigree v1 archive exposes PUBLIC privileges';
  END IF;
END
$$;

COMMIT;

\echo 'AUTHORITATIVE_PEDIGREE_V1_ARCHIVED'
