\set ON_ERROR_STOP on

-- Supabase Realtime v2.116.1 does not ship a PostgreSQL 16 tenant dump. Its
-- sequential migration fallback contains three functions with a
-- `SET log_min_messages` clause, which AlloyDB does not permit tenant roles to
-- define. Apply the equivalent upstream definitions without that logging-only
-- clause and register those three migrations before Realtime resumes the rest.
-- Upstream source:
--   lib/realtime/tenants/repo/migrations/20230328144023_create_list_changes_function.ex
--   lib/realtime/tenants/repo/migrations/20260326120000_list_changes_with_slot_count.ex
--   lib/realtime/tenants/repo/migrations/20260528120000_wal2json_escape_special_chars.ex

DO $$
BEGIN
  IF to_regtype('realtime.wal_rls') IS NULL
    OR to_regprocedure('realtime.apply_rls(jsonb,integer)') IS NULL THEN
    RAISE EXCEPTION
      'Realtime prerequisite migrations have not reached version 20230328144023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION realtime.wal2json_escape_identifier(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  SELECT regexp_replace(name, '([\\,.[:space:]])', '\\\1', 'g')
$$;

CREATE OR REPLACE FUNCTION realtime.quote_wal2json(entity regclass)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  SELECT
    realtime.wal2json_escape_identifier(nsp.nspname::text)
    || '.'
    || realtime.wal2json_escape_identifier(pc.relname::text)
  FROM pg_class pc
  JOIN pg_namespace nsp ON pc.relnamespace = nsp.oid
  WHERE pc.oid = entity
$$;

ALTER FUNCTION realtime.wal2json_escape_identifier(text)
  OWNER TO supabase_admin;
ALTER FUNCTION realtime.quote_wal2json(regclass)
  OWNER TO supabase_admin;

DROP FUNCTION IF EXISTS realtime.list_changes(name, name, int, int);

CREATE FUNCTION realtime.list_changes(
  publication name,
  slot_name name,
  max_changes int,
  max_record_bytes int
)
RETURNS TABLE(
  wal jsonb,
  is_rls_enabled boolean,
  subscription_ids uuid[],
  errors text[],
  slot_changes_count bigint
)
LANGUAGE sql
AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(
            format('%I.%I', schemaname, tablename)::regclass
          ),
          ','
        ) FILTER (WHERE ppt.tablename IS NOT NULL),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
      pg_logical_slot_get_changes(
        slot_name, null, max_changes,
        'include-pk', 'true',
        'include-transaction', 'false',
        'include-timestamp', 'true',
        'include-type-oids', 'true',
        'format-version', '2',
        'actions', pub.w2j_actions,
        'add-tables', pub.w2j_add_tables
      ) x
  ),
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
      realtime.apply_rls(
        wal := w2j.data::jsonb,
        max_record_bytes := max_record_bytes
      ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;

ALTER FUNCTION realtime.list_changes(name, name, integer, integer)
  OWNER TO supabase_admin;

INSERT INTO realtime.schema_migrations (version, inserted_at)
VALUES
  (20230328144023, now()),
  (20260326120000, now()),
  (20260528120000, now())
ON CONFLICT (version) DO NOTHING;
