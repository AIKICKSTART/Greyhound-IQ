\set ON_ERROR_STOP on
\getenv fdw_password ADMIN_DATABASE_PASSWORD

SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='postgres_fdw') AS fdw_preexisting \gset

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL app.system='true';
SET LOCAL "app.current_role"='system';
SET LOCAL app.current_tier='system';
SET LOCAL synchronous_commit=on;
SET LOCAL statement_timeout=0;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle='ISO, MDY';
SET LOCAL extra_float_digits=1;
SET LOCAL giq.write_freeze_ack TO :'write_freeze_ack';

DO $$
DECLARE observed_phase text;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'live delta database mismatch';
  END IF;
  IF current_setting('giq.write_freeze_ack',true)<>'I_ACKNOWLEDGE_PRODUCTION_WRITES_ARE_FROZEN' THEN
    RAISE EXCEPTION 'live delta lacks the exact write-freeze acknowledgement';
  END IF;
  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id=1 FOR UPDATE;
  IF observed_phase<>'canonical_merged' THEN
    RAISE EXCEPTION 'live delta requires canonical_merged, observed %',observed_phase;
  END IF;
  IF (SELECT replay_backfill_completed_at IS NULL OR replay_backfill_manifest IS NULL
      FROM _giq_history_merge.run WHERE id=1) THEN
    RAISE EXCEPTION 'live delta requires the reviewed candidate replay backfill marker';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto') THEN
    RAISE EXCEPTION 'live delta requires pgcrypto';
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE SERVER giq_frozen_production_source
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS(
    host '10.240.116.2',port '5432',dbname 'giq_rehearsal_restore_v8',sslmode 'require',
    application_name 'giq_candidate_frozen_live_delta',
    options '-c default_transaction_read_only=on -c TimeZone=UTC -c DateStyle=ISO,MDY -c extra_float_digits=1'
  );
CREATE USER MAPPING FOR CURRENT_USER SERVER giq_frozen_production_source
  OPTIONS(user 'postgres',password :'fdw_password');
CREATE SCHEMA _giq_live_delta_remote;
IMPORT FOREIGN SCHEMA public LIMIT TO (:source_table_list)
  FROM SERVER giq_frozen_production_source INTO _giq_live_delta_remote;

DO $$
DECLARE inventory_mismatches bigint;
BEGIN
  SELECT count(*) INTO inventory_mismatches
  FROM (
    SELECT remote.relname,
      (SELECT md5(coalesce(string_agg(column_name || ':' || data_type || ':' || is_nullable,',' ORDER BY ordinal_position),''))
       FROM information_schema.columns WHERE table_schema='_giq_live_delta_remote' AND table_name=remote.relname) AS remote_columns,
      (SELECT md5(coalesce(string_agg(column_name || ':' || data_type || ':' || is_nullable,',' ORDER BY ordinal_position),''))
       FROM information_schema.columns WHERE table_schema='public' AND table_name=remote.relname) AS local_columns
    FROM pg_foreign_table foreign_table
    JOIN pg_class remote ON remote.oid=foreign_table.ftrelid
    JOIN pg_namespace remote_ns ON remote_ns.oid=remote.relnamespace
    WHERE remote_ns.nspname='_giq_live_delta_remote'
  ) compared
  WHERE remote_columns IS DISTINCT FROM local_columns;
  IF inventory_mismatches<>0 THEN
    RAISE EXCEPTION '% frozen source tables differ from candidate column inventory',inventory_mismatches;
  END IF;
END
$$;

CREATE TABLE _giq_history_merge.live_delta_sequence_snapshot (
  sequence_schema text NOT NULL,
  sequence_name text NOT NULL,
  last_value bigint,
  start_value bigint NOT NULL,
  increment_by bigint NOT NULL,
  owned_table text,
  owned_column text,
  PRIMARY KEY(sequence_schema,sequence_name)
);
INSERT INTO _giq_history_merge.live_delta_sequence_snapshot
SELECT item->>'schema',item->>'name',(item->>'lastValue')::bigint,
  (item->>'startValue')::bigint,(item->>'incrementBy')::bigint,
  item->>'ownedTable',item->>'ownedColumn'
FROM jsonb_array_elements(:'sequence_manifest'::jsonb) item;

CREATE TABLE _giq_history_merge.live_delta_source_before (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  row_md5 text NOT NULL,
  column_manifest_md5 text NOT NULL
);
CREATE TABLE _giq_history_merge.live_delta_source_after
  (LIKE _giq_history_merge.live_delta_source_before INCLUDING ALL);

DO $$
DECLARE relation record; pk_order text; rows bigint; digest_value text; columns_md5 text;
BEGIN
  FOR relation IN
    SELECT remote.relname,local.oid AS local_oid
    FROM pg_foreign_table foreign_table
    JOIN pg_class remote ON remote.oid=foreign_table.ftrelid
    JOIN pg_namespace remote_ns ON remote_ns.oid=remote.relnamespace
    JOIN pg_class local ON local.relname=remote.relname
    JOIN pg_namespace local_ns ON local_ns.oid=local.relnamespace AND local_ns.nspname='public'
    WHERE remote_ns.nspname='_giq_live_delta_remote' AND local.relkind IN ('r','p')
    ORDER BY remote.relname
  LOOP
    SELECT string_agg(format('COALESCE(t.%I::text,'''')',a.attname),
                      ' || ''|'' || ' ORDER BY key.ord)
    INTO pk_order
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY key(attnum,ord)
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=key.attnum
    WHERE i.indrelid=relation.local_oid AND i.indisprimary;
    IF pk_order IS NULL THEN RAISE EXCEPTION 'delta source table % has no candidate primary key',relation.relname; END IF;
    EXECUTE format(
      'SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY %s),'''')) FROM _giq_live_delta_remote.%I t',
      pk_order,relation.relname) INTO rows,digest_value;
    SELECT md5(coalesce(string_agg(column_name || ':' || data_type || ':' || is_nullable,',' ORDER BY ordinal_position),''))
    INTO columns_md5 FROM information_schema.columns
    WHERE table_schema='_giq_live_delta_remote' AND table_name=relation.relname;
    INSERT INTO _giq_history_merge.live_delta_source_before
    VALUES(relation.relname,rows,digest_value,columns_md5);
  END LOOP;
END
$$;

DO $$
DECLARE conflicts bigint;
BEGIN
  WITH alternate AS (
    SELECT source.id FROM _giq_live_delta_remote."Dog" source JOIN public."Dog" target
      ON target.id<>source.id AND (
        (source."earBrand" IS NOT NULL AND source."earBrand" !~ '^thedogs:[0-9]+$'
          AND target."earBrand"=source."earBrand") OR
        (source."sourceProvider" IS NOT NULL AND source."sourceId" IS NOT NULL
          AND lower(target."sourceProvider")=lower(source."sourceProvider") AND target."sourceId"=source."sourceId"))
    UNION ALL SELECT source.id FROM _giq_live_delta_remote."Meeting" source JOIN public."Meeting" target
      ON target.id<>source.id AND (target."trackId",target."meetingDate")=(source."trackId",source."meetingDate")
    UNION ALL SELECT source.id FROM _giq_live_delta_remote."Race" source JOIN public."Race" target
      ON target.id<>source.id AND (target."meetingId",target."raceNumber")=(source."meetingId",source."raceNumber")
    UNION ALL SELECT source.id FROM _giq_live_delta_remote."Runner" source JOIN public."Runner" target
      ON target.id<>source.id AND (target."raceId",target."boxNumber")=(source."raceId",source."boxNumber")
    UNION ALL SELECT source.id FROM _giq_live_delta_remote."Result" source JOIN public."Result" target
      ON target.id<>source.id AND target."runnerId"=source."runnerId"
    UNION ALL SELECT source.id FROM _giq_live_delta_remote."FormEntry" source JOIN public."FormEntry" target
      ON target.id<>source.id AND (target."dogId",target."raceId")=(source."dogId",source."raceId")
    UNION ALL SELECT source.id FROM _giq_live_delta_remote."DogProfileForm" source JOIN public."DogProfileForm" target
      ON target.id<>source.id AND (target."dogId",lower(target."sourceProvider"),target."sourceId")=
        (source."dogId",lower(source."sourceProvider"),source."sourceId")
    UNION ALL SELECT source.id FROM _giq_live_delta_remote."RaceVideo" source JOIN public."RaceVideo" target
      ON target.id<>source.id AND (target."raceId",lower(target."sourceProvider"),target.kind)=
        (source."raceId",lower(source."sourceProvider"),source.kind)
    UNION ALL SELECT source.id FROM _giq_live_delta_remote."DogProfileArchive" source JOIN public."DogProfileArchive" target
      ON target.id<>source.id AND (lower(target."sourceProvider"),target."sourceId")=
        (lower(source."sourceProvider"),source."sourceId")
    UNION ALL SELECT source.id FROM _giq_live_delta_remote."RaceDayArchive" source JOIN public."RaceDayArchive" target
      ON target.id<>source.id AND (lower(target."sourceProvider"),target.date)=
        (lower(source."sourceProvider"),source.date)
  ) SELECT count(*) INTO conflicts FROM alternate;
  IF conflicts<>0 THEN
    RAISE EXCEPTION 'frozen production delta has % alternate-key conflicts; reclone instead of guessing identity',conflicts;
  END IF;
END
$$;

SET LOCAL session_replication_role=replica;

DO $$
DECLARE
  relation record;
  column_list text;
  select_list text;
  update_list text;
  is_historical_core boolean;
  is_protected boolean;
BEGIN
  FOR relation IN
    SELECT remote.relname
    FROM pg_foreign_table foreign_table
    JOIN pg_class remote ON remote.oid=foreign_table.ftrelid
    JOIN pg_namespace remote_ns ON remote_ns.oid=remote.relnamespace
    JOIN pg_class local ON local.relname=remote.relname
    JOIN pg_namespace local_ns ON local_ns.oid=local.relnamespace AND local_ns.nspname='public'
    WHERE remote_ns.nspname='_giq_live_delta_remote' AND local.relkind IN ('r','p')
      AND remote.relname<>'_prisma_migrations'
    ORDER BY remote.relname
  LOOP
    is_historical_core:=relation.relname=ANY(ARRAY[
      'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
      'DogProfileForm','RaceVideo','DogProfileArchive','RaceDayArchive',
      'PedigreeImportRun','DogSourceIdentity','PedigreeAssertion','PedigreeMergeLedger'
    ]::text[]);
    is_protected:=NOT is_historical_core;

    SELECT string_agg(format('%I',remote.column_name),',' ORDER BY remote.ordinal_position),
           string_agg(
             CASE
               WHEN relation.relname='Track' AND remote.column_name='name'
                 THEN '_giq_history_merge.canonical_track_name(source.name)'
               WHEN relation.relname='Track' AND remote.column_name='state'
                 THEN '_giq_history_merge.canonical_track_state(source.name,source.state)'
               WHEN relation.relname='Dog' AND remote.column_name='earBrand'
                 THEN 'CASE WHEN source."earBrand" ~ ''^thedogs:[0-9]+$'' THEN NULL ELSE source."earBrand" END'
               WHEN relation.relname='Dog' AND remote.column_name='sourceProvider'
                 THEN 'coalesce(source."sourceProvider",CASE WHEN source."earBrand" ~ ''^thedogs:[0-9]+$'' THEN ''thedogs'' END)'
               WHEN relation.relname='Dog' AND remote.column_name='sourceId'
                 THEN 'coalesce(source."sourceId",CASE WHEN source."earBrand" ~ ''^thedogs:[0-9]+$'' THEN substring(source."earBrand" FROM 9) END)'
               ELSE format('source.%I',remote.column_name)
             END,',' ORDER BY remote.ordinal_position),
           string_agg(
             CASE WHEN remote.column_name='id' THEN NULL
               WHEN is_protected THEN format('%1$I=EXCLUDED.%1$I',remote.column_name)
               ELSE format('%1$I=coalesce(EXCLUDED.%1$I,target.%1$I)',remote.column_name)
             END,',' ORDER BY remote.ordinal_position)
    INTO column_list,select_list,update_list
    FROM information_schema.columns remote
    JOIN information_schema.columns local
      ON local.table_schema='public' AND local.table_name=remote.table_name
     AND local.column_name=remote.column_name
    WHERE remote.table_schema='_giq_live_delta_remote' AND remote.table_name=relation.relname
      AND local.is_generated='NEVER';

    IF column_list IS NULL OR update_list IS NULL THEN
      RAISE EXCEPTION 'delta table % has no mergeable id/update columns',relation.relname;
    END IF;
    EXECUTE format(
      'INSERT INTO public.%1$I AS target(%2$s) SELECT %3$s FROM _giq_live_delta_remote.%1$I source '
      'ON CONFLICT(id) DO UPDATE SET %4$s',
      relation.relname,column_list,select_list,update_list);

    IF is_protected THEN
      EXECUTE format(
        'DELETE FROM public.%1$I target WHERE NOT EXISTS('
        'SELECT 1 FROM _giq_live_delta_remote.%1$I source WHERE source.id=target.id)',
        relation.relname);
    END IF;
  END LOOP;
END
$$;

SET LOCAL session_replication_role=origin;

DO $$
DECLARE fk record; child_columns text; join_predicate text; nonnull_predicate text; orphan_rows bigint;
BEGIN
  FOR fk IN
    SELECT constraint_row.oid,constraint_row.conname,constraint_row.conrelid,constraint_row.confrelid,
           constraint_row.conkey,constraint_row.confkey,
           constraint_row.conrelid::regclass::text AS child_table,
           constraint_row.confrelid::regclass::text AS parent_table
    FROM pg_constraint constraint_row WHERE constraint_row.contype='f'
  LOOP
    SELECT string_agg(format('child.%I',child_attribute.attname),',' ORDER BY key.ord),
           string_agg(format('child.%I=parent.%I',child_attribute.attname,parent_attribute.attname),' AND ' ORDER BY key.ord),
           string_agg(format('child.%I IS NOT NULL',child_attribute.attname),' AND ' ORDER BY key.ord)
    INTO child_columns,join_predicate,nonnull_predicate
    FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY key(child_attnum,parent_attnum,ord)
    JOIN pg_attribute child_attribute
      ON child_attribute.attrelid=fk.conrelid AND child_attribute.attnum=key.child_attnum
    JOIN pg_attribute parent_attribute
      ON parent_attribute.attrelid=fk.confrelid AND parent_attribute.attnum=key.parent_attnum;
    EXECUTE format('SELECT count(*) FROM %s child WHERE %s AND NOT EXISTS(SELECT 1 FROM %s parent WHERE %s)',
      fk.child_table,nonnull_predicate,fk.parent_table,join_predicate) INTO orphan_rows;
    IF orphan_rows<>0 THEN
      RAISE EXCEPTION 'live delta violates foreign key % with % orphan rows',fk.conname,orphan_rows;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE relation record; pk_order text; rows bigint; digest_value text; columns_md5 text;
BEGIN
  FOR relation IN SELECT before.*,
      local.oid AS local_oid
    FROM _giq_history_merge.live_delta_source_before before
    JOIN pg_class local ON local.relname=before.table_name
    JOIN pg_namespace local_ns ON local_ns.oid=local.relnamespace AND local_ns.nspname='public'
    ORDER BY before.table_name
  LOOP
    SELECT string_agg(format('COALESCE(t.%I::text,'''')',a.attname),
                      ' || ''|'' || ' ORDER BY key.ord)
    INTO pk_order FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY key(attnum,ord)
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=key.attnum
    WHERE i.indrelid=relation.local_oid AND i.indisprimary;
    EXECUTE format('SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY %s),'''')) '
      'FROM _giq_live_delta_remote.%I t',pk_order,relation.table_name) INTO rows,digest_value;
    SELECT md5(coalesce(string_agg(column_name || ':' || data_type || ':' || is_nullable,',' ORDER BY ordinal_position),''))
    INTO columns_md5 FROM information_schema.columns
    WHERE table_schema='_giq_live_delta_remote' AND table_name=relation.table_name;
    INSERT INTO _giq_history_merge.live_delta_source_after
    VALUES(relation.table_name,rows,digest_value,columns_md5);
  END LOOP;
  IF EXISTS(
    SELECT 1 FROM _giq_history_merge.live_delta_source_before before
    FULL JOIN _giq_history_merge.live_delta_source_after after USING(table_name)
    WHERE (before.row_count,before.row_md5,before.column_manifest_md5) IS DISTINCT FROM
          (after.row_count,after.row_md5,after.column_manifest_md5)
  ) THEN
    RAISE EXCEPTION 'frozen production source changed during live delta';
  END IF;
END
$$;

DO $$
DECLARE protected record; local_oid oid; pk_order text; rows bigint; digest_value text; columns_md5 text;
BEGIN
  FOR protected IN
    SELECT source.* FROM _giq_history_merge.live_delta_source_after source
    WHERE source.table_name<>ALL(ARRAY[
      '_prisma_migrations','Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
      'DogProfileForm','RaceVideo','DogProfileArchive','RaceDayArchive',
      'PedigreeImportRun','DogSourceIdentity','PedigreeAssertion','PedigreeMergeLedger'
    ]::text[])
    ORDER BY source.table_name
  LOOP
    SELECT c.oid INTO STRICT local_oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=protected.table_name;
    SELECT string_agg(format('COALESCE(t.%I::text,'''')',a.attname),
                      ' || ''|'' || ' ORDER BY key.ord)
    INTO pk_order FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY key(attnum,ord)
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=key.attnum
    WHERE i.indrelid=local_oid AND i.indisprimary;
    EXECUTE format('SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY %s),'''')) FROM public.%I t',
      pk_order,protected.table_name) INTO rows,digest_value;
    SELECT md5(coalesce(string_agg(column_name || ':' || data_type || ':' || is_nullable,',' ORDER BY ordinal_position),''))
    INTO columns_md5 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=protected.table_name;
    IF (rows,digest_value,columns_md5) IS DISTINCT FROM
       (protected.row_count,protected.row_md5,protected.column_manifest_md5) THEN
      RAISE EXCEPTION 'protected table % does not exactly match frozen production',protected.table_name;
    END IF;
  END LOOP;
END
$$;

INSERT INTO _giq_history_merge.verification_check(check_name,metrics)
VALUES('live_delta_partition',jsonb_build_object(
  'writeFreezeAcknowledged',true,'sourceDatabase','giq_rehearsal_restore_v8',
  'sourceReadOnlyEnforced',true,'sourceStableBeforeAfter',true,
  'sourceTables',(SELECT count(*) FROM _giq_history_merge.live_delta_source_after),
  'protectedTablesExactToFrozenProduction',true,'foreignKeyOrphans',0,
  'syntheticEarBrandsAfterDelta',(SELECT count(*) FROM public."Dog" WHERE "earBrand" ~ '^thedogs:[0-9]+$')
))
ON CONFLICT(check_name) DO UPDATE SET metrics=EXCLUDED.metrics,verified_at=clock_timestamp();

UPDATE _giq_history_merge.run
SET phase='delta_applied',live_delta_applied_at=clock_timestamp(),
    live_delta_source_manifest=jsonb_build_object(
      'writeFreezeAcknowledged',true,'sourceReadOnlyEnforced',true,
      'sourceStableBeforeAfter',true,
      'tables',(SELECT jsonb_object_agg(table_name,jsonb_build_object(
        'rows',row_count,'rowMd5',row_md5,'columnsMd5',column_manifest_md5
      ) ORDER BY table_name) FROM _giq_history_merge.live_delta_source_after),
      'protectedTablesExactToFrozenProduction',true,'foreignKeyOrphans',0
    )
WHERE id=1;

DROP SERVER giq_frozen_production_source CASCADE;
DROP SCHEMA _giq_live_delta_remote;
\if :fdw_preexisting
\else
DROP EXTENSION postgres_fdw;
\endif

COMMIT;

SELECT jsonb_build_object('event','FROZEN_LIVE_DELTA_APPLIED','phase',phase,
  'manifest',live_delta_source_manifest)
FROM _giq_history_merge.run WHERE id=1;
