\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'physical clone control must be initialized by postgres in the postgres database';
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS _giq_clone_control AUTHORIZATION postgres;
ALTER SCHEMA _giq_clone_control OWNER TO postgres;
REVOKE ALL ON SCHEMA _giq_clone_control FROM PUBLIC;

CREATE TABLE IF NOT EXISTS _giq_clone_control.physical_clone_claim (
  operation_id uuid PRIMARY KEY,
  workflow_version text NOT NULL,
  phase text NOT NULL CHECK (phase IN (
    'prepared',
    'source_fence_armed',
    'source_fenced',
    'source_drained',
    'candidate_create_armed',
    'candidate_created',
    'source_restored',
    'recovered',
    'complete'
  )),
  source_database name NOT NULL,
  source_oid oid NOT NULL,
  source_owner name NOT NULL,
  source_bytes bigint NOT NULL CHECK (source_bytes > 0),
  source_original_allow_connections boolean NOT NULL CHECK (source_original_allow_connections),
  candidate_database name NOT NULL,
  candidate_oid oid,
  candidate_owner name,
  candidate_bytes bigint,
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS physical_clone_claim_one_active_candidate
  ON _giq_clone_control.physical_clone_claim(candidate_database)
  WHERE completed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS physical_clone_claim_one_active_operation
  ON _giq_clone_control.physical_clone_claim((true))
  WHERE completed_at IS NULL;

ALTER TABLE _giq_clone_control.physical_clone_claim OWNER TO postgres;
REVOKE ALL ON TABLE _giq_clone_control.physical_clone_claim FROM PUBLIC;
ALTER TABLE _giq_clone_control.physical_clone_claim ENABLE ROW LEVEL SECURITY;
ALTER TABLE _giq_clone_control.physical_clone_claim FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS physical_clone_claim_postgres_only
  ON _giq_clone_control.physical_clone_claim;
CREATE POLICY physical_clone_claim_postgres_only
  ON _giq_clone_control.physical_clone_claim
  AS PERMISSIVE
  FOR ALL
  TO postgres
  USING (session_user='postgres'::name)
  WITH CHECK (session_user='postgres'::name);

DO $$
DECLARE
  role_name name;
  schema_owner name;
  table_owner name;
  nonowner_schema_acl boolean;
  nonowner_table_acl boolean;
  rls_enabled boolean;
  rls_forced boolean;
  policy_count integer;
  candidate_active_index_valid boolean;
  operation_active_index_valid boolean;
BEGIN
  FOR role_name IN
    SELECT rolname FROM pg_roles WHERE rolname<>'postgres' ORDER BY rolname
  LOOP
    EXECUTE format('REVOKE ALL ON SCHEMA _giq_clone_control FROM %I',role_name);
    EXECUTE format(
      'REVOKE ALL ON TABLE _giq_clone_control.physical_clone_claim FROM %I',role_name
    );
  END LOOP;

  SELECT pg_get_userbyid(nspowner),
         EXISTS(
           SELECT 1
           FROM aclexplode(coalesce(nspacl,acldefault('n',nspowner))) privilege
           WHERE privilege.grantee<>nspowner
         )
  INTO schema_owner, nonowner_schema_acl
  FROM pg_namespace
  WHERE nspname = '_giq_clone_control';

  SELECT pg_get_userbyid(relowner),relrowsecurity,relforcerowsecurity,
         EXISTS(
           SELECT 1
           FROM aclexplode(coalesce(relacl,acldefault('r',relowner))) privilege
           WHERE privilege.grantee<>relowner
         )
  INTO table_owner,rls_enabled,rls_forced,nonowner_table_acl
  FROM pg_class
  WHERE oid = '_giq_clone_control.physical_clone_claim'::regclass;

  SELECT count(*) INTO policy_count
  FROM pg_policy
  WHERE polrelid='_giq_clone_control.physical_clone_claim'::regclass
    AND polname='physical_clone_claim_postgres_only'
    AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='postgres')]::oid[]
    AND polcmd='*' AND polpermissive
    AND lower(pg_get_expr(polqual,polrelid,false))
        IN ('(session_user = ''postgres''::name)','session_user = ''postgres''::name')
    AND lower(pg_get_expr(polwithcheck,polrelid,false))
        IN ('(session_user = ''postgres''::name)','session_user = ''postgres''::name');

  SELECT count(*)=1 INTO candidate_active_index_valid
  FROM pg_index definition
  JOIN pg_class index_relation ON index_relation.oid=definition.indexrelid
  JOIN pg_namespace index_schema ON index_schema.oid=index_relation.relnamespace
  WHERE definition.indrelid='_giq_clone_control.physical_clone_claim'::regclass
    AND index_schema.nspname='_giq_clone_control'
    AND index_relation.relname='physical_clone_claim_one_active_candidate'
    AND definition.indisunique AND definition.indisvalid AND definition.indisready
    AND definition.indnkeyatts=1
    AND pg_get_indexdef(definition.indexrelid,1,true)='candidate_database'
    AND pg_get_expr(definition.indpred,definition.indrelid)
        IN ('completed_at IS NULL','(completed_at IS NULL)');

  SELECT count(*)=1 INTO operation_active_index_valid
  FROM pg_index definition
  JOIN pg_class index_relation ON index_relation.oid=definition.indexrelid
  JOIN pg_namespace index_schema ON index_schema.oid=index_relation.relnamespace
  WHERE definition.indrelid='_giq_clone_control.physical_clone_claim'::regclass
    AND index_schema.nspname='_giq_clone_control'
    AND index_relation.relname='physical_clone_claim_one_active_operation'
    AND definition.indisunique AND definition.indisvalid AND definition.indisready
    AND definition.indnkeyatts=1
    AND pg_get_indexdef(definition.indexrelid,1,true) IN ('true','(true)')
    AND pg_get_expr(definition.indpred,definition.indrelid)
        IN ('completed_at IS NULL','(completed_at IS NULL)');

  RAISE NOTICE 'physical clone control invariants schema_owner=% table_owner=% nonowner_schema_acl=% nonowner_table_acl=% rls_enabled=% rls_forced=% candidate_index=% operation_index=% policy_count=% total_policies=%',
    schema_owner,table_owner,nonowner_schema_acl,nonowner_table_acl,
    rls_enabled,rls_forced,candidate_active_index_valid,operation_active_index_valid,
    policy_count,(SELECT count(*) FROM pg_policy
      WHERE polrelid='_giq_clone_control.physical_clone_claim'::regclass);

  IF schema_owner <> 'postgres' OR table_owner <> 'postgres' OR
     nonowner_schema_acl OR nonowner_table_acl OR NOT rls_enabled OR NOT rls_forced OR
     NOT candidate_active_index_valid OR NOT operation_active_index_valid OR
     policy_count<>1 OR (SELECT count(*) FROM pg_policy
       WHERE polrelid='_giq_clone_control.physical_clone_claim'::regclass)<>1 THEN
    RAISE EXCEPTION 'physical clone control ownership or exclusive privilege invariant failed';
  END IF;
END
$$;

COMMIT;
