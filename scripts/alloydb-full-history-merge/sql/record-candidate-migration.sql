\set ON_ERROR_STOP on

BEGIN;
SET LOCAL synchronous_commit=on;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle='ISO, MDY';
SET LOCAL extra_float_digits=1;
SET LOCAL giq.migration_manifest TO :'migration_manifest';

DO $$
DECLARE
  observed_phase text;
  manifest_rows bigint;
  applied_rows bigint;
  mismatch_rows bigint;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'candidate migration record database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id=1 FOR UPDATE;
  IF observed_phase<>'cloned' THEN
    RAISE EXCEPTION 'candidate migration record requires cloned, observed %',observed_phase;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pgcrypto')
     OR NOT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='postgres_fdw') THEN
    RAISE EXCEPTION 'required candidate extensions are unavailable';
  END IF;

  SELECT jsonb_array_length(current_setting('giq.migration_manifest')::jsonb) INTO manifest_rows;
  SELECT count(*) INTO applied_rows
  FROM public."_prisma_migrations"
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
  WITH source AS (
    SELECT item->>'name' AS name,item->>'sha256' AS sha256
    FROM jsonb_array_elements(current_setting('giq.migration_manifest')::jsonb) item
  ), compared AS (
    SELECT source.name
    FROM source
    LEFT JOIN public."_prisma_migrations" ledger
      ON ledger.migration_name=source.name
     AND ledger.finished_at IS NOT NULL
     AND ledger.rolled_back_at IS NULL
     AND ledger.checksum=source.sha256
    WHERE ledger.id IS NULL
  )
  SELECT count(*) INTO mismatch_rows FROM compared;
  IF manifest_rows<>applied_rows OR mismatch_rows<>0 THEN
    RAISE EXCEPTION 'post-migration ledger does not equal pinned source: manifest %, applied %, mismatch %',
      manifest_rows,applied_rows,mismatch_rows;
  END IF;
END
$$;

CREATE TABLE _giq_history_merge.post_migration_table_manifest (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  row_md5 text NOT NULL,
  min_primary_key text,
  max_primary_key text
);

DO $$
DECLARE
  relation record;
  primary_key_order text;
  row_count_value bigint;
  row_digest_value text;
  min_key_value text;
  max_key_value text;
BEGIN
  FOR relation IN
    SELECT c.oid,c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
    ORDER BY c.relname
  LOOP
    SELECT 'jsonb_build_array(' || string_agg(format('t.%I',a.attname),
                      ', ' ORDER BY k.ordinality) || ')::text'
    INTO primary_key_order
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality)
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
    WHERE i.indrelid=relation.oid AND i.indisprimary;
    IF primary_key_order IS NULL THEN
      RAISE EXCEPTION 'public table % has no primary key after migration',relation.relname;
    END IF;
    EXECUTE format(
      'SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY %s),'''')),min(%s),max(%s) FROM public.%I t',
      primary_key_order,primary_key_order,primary_key_order,relation.relname
    ) INTO row_count_value,row_digest_value,min_key_value,max_key_value;
    INSERT INTO _giq_history_merge.post_migration_table_manifest
      (table_name,row_count,row_md5,min_primary_key,max_primary_key)
    VALUES(relation.relname,row_count_value,row_digest_value,min_key_value,max_key_value);
  END LOOP;
END
$$;

UPDATE _giq_history_merge.run
SET phase='schema_migrated',schema_migrated_at=clock_timestamp(),
    migration_source_sha256=:'migration_source_sha256',
    migration_manifest=:'migration_manifest'::jsonb,
    post_migration_catalog=jsonb_build_object(
      'baseTables',(SELECT count(*) FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'),
      'completedMigrations',(SELECT count(*) FROM public."_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
      'unfinishedMigrations',(SELECT count(*) FROM public."_prisma_migrations"
        WHERE finished_at IS NULL AND rolled_back_at IS NULL),
      'foreignKeys',(SELECT count(*) FROM pg_constraint WHERE contype='f'),
      'invalidForeignKeys',(SELECT count(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated),
      'invalidConstraints',(SELECT coalesce(jsonb_agg(conname ORDER BY conname),'[]'::jsonb)
        FROM pg_constraint WHERE NOT convalidated),
      'disabledTriggers',(SELECT count(*) FROM pg_trigger WHERE tgenabled='D')
    )
WHERE id=1;

COMMIT;

SELECT jsonb_build_object(
  'event','CANDIDATE_SCHEMA_MIGRATED','phase',phase,
  'migrationSourceSha256',migration_source_sha256,'catalog',post_migration_catalog
)
FROM _giq_history_merge.run WHERE id=1;
