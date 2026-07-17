\set ON_ERROR_STOP on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '2min';

WITH database_manifest AS (
  SELECT jsonb_build_object(
    'owner', pg_get_userbyid(d.datdba),
    'encoding', pg_encoding_to_char(d.encoding),
    'localeProvider', d.datlocprovider,
    'isTemplate', d.datistemplate,
    'allowConnect', d.datallowconn,
    'connectionLimit', d.datconnlimit,
    'tablespace', t.spcname,
    'collate', d.datcollate,
    'ctype', d.datctype,
    'icuLocale', d.daticulocale,
    'icuRules', d.daticurules,
    'collationVersion', d.datcollversion,
    'acl', d.datacl::text,
    'roleSettings', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'role', settings.role_name,
          'settings', settings.setconfig
        )
        ORDER BY settings.role_name
      )
      FROM (
        SELECT CASE
                 WHEN configured.setrole = 0 THEN '<ALL_ROLES>'
                 ELSE pg_get_userbyid(configured.setrole)
               END AS role_name,
               configured.setconfig
        FROM pg_db_role_setting configured
        WHERE configured.setdatabase = d.oid
      ) settings
    ), '[]'::jsonb)
  ) AS payload
  FROM pg_database d
  JOIN pg_tablespace t ON t.oid = d.dattablespace
  WHERE d.datname = current_database()
), schema_manifest AS (
  SELECT n.nspname AS sort_key,
         jsonb_build_object(
           'name', n.nspname,
           'owner', pg_get_userbyid(n.nspowner),
           'acl', n.nspacl::text,
           'extension', (
             SELECT e.extname
             FROM pg_depend d
             JOIN pg_extension e
               ON d.refclassid = 'pg_extension'::regclass
              AND d.refobjid = e.oid
             WHERE d.classid = 'pg_namespace'::regclass
               AND d.objid = n.oid
               AND d.objsubid = 0
               AND d.deptype = 'e'
             ORDER BY e.extname
             LIMIT 1
           )
         ) AS payload
  FROM pg_namespace n
  WHERE n.nspname <> 'information_schema'
    AND n.nspname !~ '^pg_'
), extension_manifest AS (
  SELECT e.extname AS sort_key,
         jsonb_build_object(
           'name', e.extname,
           'owner', pg_get_userbyid(e.extowner),
           'schema', n.nspname,
           'relocatable', e.extrelocatable,
           'version', e.extversion,
           'config', COALESCE((
             SELECT jsonb_agg(
               jsonb_build_object(
                 'relation', cfg.oid::regclass::text,
                 'condition', e.extcondition[cfg.ordinality]
               )
               ORDER BY cfg.ordinality
             )
             FROM unnest(e.extconfig) WITH ORDINALITY AS cfg(oid, ordinality)
           ), '[]'::jsonb)
         ) AS payload
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
), extension_member_manifest AS (
  SELECT concat_ws(E'\x1f', e.extname, d.classid::regclass::text,
                   identified.type, identified.schema, identified.name,
                   identified.identity, d.objsubid::text) AS sort_key,
         jsonb_build_object(
           'extension', e.extname,
           'catalog', d.classid::regclass::text,
           'subObject', d.objsubid,
           'type', identified.type,
           'schema', identified.schema,
           'name', identified.name,
           'identity', identified.identity
         ) AS payload
  FROM pg_depend d
  JOIN pg_extension e
    ON d.refclassid = 'pg_extension'::regclass
   AND d.refobjid = e.oid
  CROSS JOIN LATERAL pg_identify_object(d.classid, d.objid, d.objsubid) AS identified
  WHERE d.deptype = 'e'
), relation_manifest AS (
  SELECT concat_ws(E'\x1f', n.nspname, c.relname, c.relkind::text) AS sort_key,
         jsonb_build_object(
           'schema', n.nspname,
           'name', c.relname,
           'kind', c.relkind,
           'persistence', c.relpersistence,
           'owner', pg_get_userbyid(c.relowner),
           'acl', c.relacl::text,
           'rowSecurity', c.relrowsecurity,
           'forceRowSecurity', c.relforcerowsecurity,
           'replicaIdentity', c.relreplident,
           'isPartition', c.relispartition,
           'partitionBound', pg_get_expr(c.relpartbound, c.oid, false),
           'accessMethod', am.amname,
           'tablespace', ts.spcname,
           'options', c.reloptions,
           'viewDefinitionMd5', CASE
             WHEN c.relkind IN ('v', 'm') THEN md5(pg_get_viewdef(c.oid, false))
             ELSE NULL
           END,
           'extension', (
             SELECT e.extname
             FROM pg_depend d
             JOIN pg_extension e
               ON d.refclassid = 'pg_extension'::regclass
              AND d.refobjid = e.oid
             WHERE d.classid = 'pg_class'::regclass
               AND d.objid = c.oid
               AND d.objsubid = 0
               AND d.deptype = 'e'
             ORDER BY e.extname
             LIMIT 1
           )
         ) AS payload
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_am am ON am.oid = c.relam
  LEFT JOIN pg_tablespace ts ON ts.oid = c.reltablespace
  WHERE n.nspname <> 'information_schema'
    AND n.nspname !~ '^pg_'
), routine_manifest AS (
  SELECT concat_ws(E'\x1f', n.nspname, p.proname,
                   pg_get_function_identity_arguments(p.oid)) AS sort_key,
         jsonb_build_object(
           'schema', n.nspname,
           'name', p.proname,
           'identityArguments', pg_get_function_identity_arguments(p.oid),
           'result', pg_get_function_result(p.oid),
           'kind', p.prokind,
           'language', l.lanname,
           'owner', pg_get_userbyid(p.proowner),
           'securityDefiner', p.prosecdef,
           'leakproof', p.proleakproof,
           'volatility', p.provolatile,
           'parallel', p.proparallel,
           'strict', p.proisstrict,
           'returnsSet', p.proretset,
           'acl', p.proacl::text,
           'config', p.proconfig,
           'implementationMd5', md5(concat_ws(E'\x1f', p.probin, p.prosrc,
             p.prosqlbody::text, p.proconfig::text)),
           'extension', (
             SELECT e.extname
             FROM pg_depend d
             JOIN pg_extension e
               ON d.refclassid = 'pg_extension'::regclass
              AND d.refobjid = e.oid
             WHERE d.classid = 'pg_proc'::regclass
               AND d.objid = p.oid
               AND d.objsubid = 0
               AND d.deptype = 'e'
             ORDER BY e.extname
             LIMIT 1
           )
         ) AS payload
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname <> 'information_schema'
    AND n.nspname !~ '^pg_'
), type_manifest AS (
  SELECT concat_ws(E'\x1f', n.nspname, t.typname) AS sort_key,
         jsonb_build_object(
           'schema', n.nspname,
           'name', t.typname,
           'kind', t.typtype,
           'category', t.typcategory,
           'preferred', t.typispreferred,
           'defined', t.typisdefined,
           'delimiter', t.typdelim,
           'notNull', t.typnotnull,
           'owner', pg_get_userbyid(t.typowner),
           'acl', t.typacl::text,
           'default', t.typdefault,
           'extension', (
             SELECT e.extname
             FROM pg_depend d
             JOIN pg_extension e
               ON d.refclassid = 'pg_extension'::regclass
              AND d.refobjid = e.oid
             WHERE d.classid = 'pg_type'::regclass
               AND d.objid = t.oid
               AND d.objsubid = 0
               AND d.deptype = 'e'
             ORDER BY e.extname
             LIMIT 1
           )
         ) AS payload
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname <> 'information_schema'
    AND n.nspname !~ '^pg_'
)
SELECT jsonb_build_object(
  'database', (SELECT payload FROM database_manifest),
  'schemas', COALESCE((SELECT jsonb_agg(payload ORDER BY sort_key) FROM schema_manifest), '[]'::jsonb),
  'extensions', COALESCE((SELECT jsonb_agg(payload ORDER BY sort_key) FROM extension_manifest), '[]'::jsonb),
  'extensionMembers', COALESCE((SELECT jsonb_agg(payload ORDER BY sort_key) FROM extension_member_manifest), '[]'::jsonb),
  'relations', COALESCE((SELECT jsonb_agg(payload ORDER BY sort_key) FROM relation_manifest), '[]'::jsonb),
  'routines', COALESCE((SELECT jsonb_agg(payload ORDER BY sort_key) FROM routine_manifest), '[]'::jsonb),
  'types', COALESCE((SELECT jsonb_agg(payload ORDER BY sort_key) FROM type_manifest), '[]'::jsonb)
)::text;

ROLLBACK;
