\set ON_ERROR_STOP on
\getenv fdw_password ADMIN_DATABASE_PASSWORD

SELECT EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'postgres_fdw'
) AS fdw_preexisting \gset

BEGIN;
SET LOCAL app.system = 'true';
SET LOCAL "app.current_role" = 'system';
SET LOCAL app.current_tier = 'system';
SET LOCAL synchronous_commit = on;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle = 'ISO, MDY';
SET LOCAL extra_float_digits = 1;

DO $$
DECLARE
  observed_phase text;
BEGIN
  IF current_setting('TimeZone')<>'UTC'
     OR current_setting('DateStyle')<>'ISO, MDY'
     OR current_setting('extra_float_digits')<>'1' THEN
    RAISE EXCEPTION 'r2 row-manifest serialization settings differ from the pinned source';
  END IF;
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'r2 stage database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE;
  IF observed_phase NOT IN ('schema_migrated', 'cloned') THEN
    RAISE EXCEPTION 'r2 stage requires schema_migrated or the verified serving clone, observed %', observed_phase;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = '_giq_history_stage' AND table_name LIKE 'r2\_%' ESCAPE '\'
  ) THEN
    RAISE EXCEPTION 'partial r2 stage tables already exist';
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE SERVER giq_history_r2_source
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host '10.240.116.2',
    port '5432',
    dbname 'giq_full_history_rehearsal_20260716_r2',
    sslmode 'require',
    application_name 'giq_full_history_stage_r2'
    ,options '-c default_transaction_read_only=on -c TimeZone=UTC -c DateStyle=ISO,MDY -c extra_float_digits=1'
  );
CREATE USER MAPPING FOR CURRENT_USER
  SERVER giq_history_r2_source
  OPTIONS (user 'postgres', password :'fdw_password');

CREATE SCHEMA _giq_history_r2_remote;
IMPORT FOREIGN SCHEMA public LIMIT TO (
  "Track",
  "Trainer",
  "Dog",
  "Meeting",
  "Race",
  "Runner",
  "Result",
  "FormEntry",
  "DogProfileForm",
  "RaceVideo",
  "RaceDayArchive",
  "DogProfileArchive"
) FROM SERVER giq_history_r2_source INTO _giq_history_r2_remote;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
    'DogProfileForm','RaceVideo','RaceDayArchive','DogProfileArchive'
  ]
  LOOP
    EXECUTE format(
      'CREATE TABLE _giq_history_stage.%I AS TABLE _giq_history_r2_remote.%I WITH DATA',
      'r2_' || table_name,
      table_name
    );
    EXECUTE format(
      'CREATE UNIQUE INDEX %I ON _giq_history_stage.%I (id)',
      'r2_' || lower(table_name) || '_id_key',
      'r2_' || table_name
    );
  END LOOP;
END
$$;

CREATE TABLE _giq_history_merge.r2_stage_table_manifest (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  row_md5 text NOT NULL,
  min_id text,
  max_id text
);

DO $$
DECLARE
  table_name text;
  row_count_value bigint;
  row_digest_value text;
  min_id_value text;
  max_id_value text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
    'DogProfileForm','RaceVideo','RaceDayArchive','DogProfileArchive'
  ]
  LOOP
    EXECUTE format(
      'SELECT count(*), md5(COALESCE(string_agg(md5(to_jsonb(t)::text), '''' ORDER BY id), '''')), min(id), max(id) FROM _giq_history_stage.%I t',
      'r2_' || table_name
    ) INTO row_count_value, row_digest_value, min_id_value, max_id_value;
    INSERT INTO _giq_history_merge.r2_stage_table_manifest
      (table_name, row_count, row_md5, min_id, max_id)
    VALUES
      (table_name, row_count_value, row_digest_value, min_id_value, max_id_value);
  END LOOP;
END
$$;

DO $$
DECLARE
  mismatch_count integer;
  digest_mismatch_count integer;
  invalid_constraint_names text;
  observed_max bigint;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM (
    VALUES
      ('RaceDayArchive', 5883::bigint),
      ('DogProfileArchive', 60273::bigint),
      ('Meeting', 76668::bigint),
      ('Race', 838672::bigint),
      ('Runner', 6435322::bigint),
      ('Result', 5627298::bigint),
      ('FormEntry', 5627293::bigint),
      ('Dog', 198947::bigint),
      ('DogProfileForm', 0::bigint),
      ('Trainer', 10682::bigint),
      ('Track', 75::bigint),
      ('RaceVideo', 0::bigint)
  ) expected(table_name, row_count)
  JOIN _giq_history_merge.r2_stage_table_manifest actual USING (table_name)
  WHERE actual.row_count <> expected.row_count;
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'r2 staged table counts differ from the immutable restore contract';
  END IF;

  SELECT count(*) INTO digest_mismatch_count
  FROM (
    VALUES
      ('Track','3281ff17dd627e754edcad3b35c1e6a2'),
      ('Trainer','01b4e5184cc9e1ea86796d537d5c9fe5'),
      ('Dog','0e9b6c862f39e8b2cbf30a3d0fbdd901'),
      ('Meeting','af5b724a395967565981d23d1f837bba'),
      ('Race','e07512f03e988f289206d7d88c98b0f0'),
      ('Runner','9ffcf0e35b3a45a630e76c038eb5f7e5'),
      ('Result','ea1650c7802c99d2f802e29accb2c0e9'),
      ('FormEntry','984578189f1c440ff6572ef10a6c527e'),
      ('DogProfileForm','d41d8cd98f00b204e9800998ecf8427e'),
      ('RaceVideo','d41d8cd98f00b204e9800998ecf8427e'),
      ('RaceDayArchive','bc1c651fb2bc31e8651e5e665d8b2ed6'),
      ('DogProfileArchive','32b5923ec31146dd19e88fa6d3a2440d')
  ) expected(table_name,row_md5)
  JOIN _giq_history_merge.r2_stage_table_manifest actual USING(table_name)
  WHERE actual.row_md5<>expected.row_md5;
  IF digest_mismatch_count<>0 THEN
    RAISE EXCEPTION 'r2 staged MD5 row manifests do not match pinned dump SHA-256 lineage';
  END IF;

  SELECT round(extract(epoch FROM max("raceTime")) * 1000)::bigint
  INTO observed_max FROM _giq_history_stage."r2_Race";
  IF observed_max <> 1783854845281 THEN
    RAISE EXCEPTION 'r2 staged maximum Race time changed';
  END IF;

  SELECT string_agg(conname, ',' ORDER BY conname)
  INTO invalid_constraint_names
  FROM pg_constraint WHERE NOT convalidated;
  IF invalid_constraint_names <>
     'giq_feed_post_visibility_check,giq_feed_reaction_target_xor_check,giq_feed_reaction_type_check' THEN
    RAISE EXCEPTION 'candidate constraint inventory changed during r2 staging';
  END IF;
END
$$;

UPDATE _giq_history_merge.run
SET phase = 'r2_staged',
    r2_staged_at = clock_timestamp(),
    r2_stage_manifest = (
      SELECT jsonb_build_object(
        'sourceDatabase', 'giq_full_history_rehearsal_20260716_r2',
        'sourceArchiveSha256', source_history_archive_sha256,
        'schemaBasis', CASE WHEN schema_migrated_at IS NULL THEN 'serving_clone' ELSE 'migrated' END,
        'rowManifestAlgorithm', 'md5(string_agg(md5(to_jsonb(row)::text) order by id))',
        'sourceMaxRaceEpochMs', source_history_max_race_epoch_ms,
        'tables', (
          SELECT jsonb_object_agg(
            table_name,
            jsonb_build_object(
              'rows', row_count,
              'rowMd5', row_md5,
              'minId', min_id,
              'maxId', max_id
            ) ORDER BY table_name
          )
          FROM _giq_history_merge.r2_stage_table_manifest
        )
      )
      FROM _giq_history_merge.run WHERE id = 1
    )
WHERE id = 1;

DROP SERVER giq_history_r2_source CASCADE;
DROP SCHEMA _giq_history_r2_remote;

\if :fdw_preexisting
\else
DROP EXTENSION postgres_fdw;
\endif

COMMIT;

ANALYZE _giq_history_stage."r2_Track";
ANALYZE _giq_history_stage."r2_Trainer";
ANALYZE _giq_history_stage."r2_Dog";
ANALYZE _giq_history_stage."r2_Meeting";
ANALYZE _giq_history_stage."r2_Race";
ANALYZE _giq_history_stage."r2_Runner";
ANALYZE _giq_history_stage."r2_Result";
ANALYZE _giq_history_stage."r2_FormEntry";
ANALYZE _giq_history_stage."r2_DogProfileForm";
ANALYZE _giq_history_stage."r2_RaceVideo";
ANALYZE _giq_history_stage."r2_RaceDayArchive";
ANALYZE _giq_history_stage."r2_DogProfileArchive";

SELECT jsonb_build_object(
  'event', 'R2_NONCANONICAL_STAGE_VERIFIED',
  'database', current_database(),
  'phase', phase,
  'manifest', r2_stage_manifest
)
FROM _giq_history_merge.run WHERE id = 1;
