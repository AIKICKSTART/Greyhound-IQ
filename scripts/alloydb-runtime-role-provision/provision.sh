#!/bin/sh
set -eu

umask 077

readonly EXPECTED_HOST="10.240.116.2"
readonly EXPECTED_DATABASE="giq_production_stage11_20260718_r2"
readonly ADMIN_USER="postgres"
readonly RUNTIME_USER="greyhoundiq_runtime"

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

[ -n "${ADMIN_DATABASE_PASSWORD:-}" ] || die "ADMIN_DATABASE_PASSWORD is required"
[ -n "${RUNTIME_DATABASE_PASSWORD:-}" ] || die "RUNTIME_DATABASE_PASSWORD is required"

export PGHOST="$EXPECTED_HOST"
export PGPORT="5432"
export PGDATABASE="$EXPECTED_DATABASE"
export PGUSER="$ADMIN_USER"
export PGPASSWORD="$ADMIN_DATABASE_PASSWORD"
export PGSSLMODE="require"
export PGCONNECT_TIMEOUT="30"

database_identity="$(psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command='SELECT current_database();')"
[ "$database_identity" = "$EXPECTED_DATABASE" ] || \
  die "database identity mismatch: expected $EXPECTED_DATABASE, observed $database_identity"

psql --no-psqlrc --set=ON_ERROR_STOP=1 <<'SQL'
\getenv runtime_password RUNTIME_DATABASE_PASSWORD

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime'
  ) THEN
    CREATE ROLE greyhoundiq_runtime
      NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE greyhoundiq_runtime
  LOGIN
  CONNECTION LIMIT 50
  PASSWORD :'runtime_password'
  VALID UNTIL 'infinity';

GRANT CONNECT ON DATABASE giq_production_stage11_20260718_r2 TO greyhoundiq_runtime;
REVOKE TEMPORARY ON DATABASE giq_production_stage11_20260718_r2 FROM PUBLIC;
REVOKE TEMPORARY ON DATABASE giq_production_stage11_20260718_r2 FROM greyhoundiq_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM greyhoundiq_runtime;
GRANT USAGE ON SCHEMA public TO greyhoundiq_runtime;

DO $$
DECLARE
  relation_name text;
BEGIN
  FOR relation_name IN
    SELECT format('%I.%I', namespace.nspname, relation.relname)
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND relation.relname <> '_prisma_migrations'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO greyhoundiq_runtime',
      relation_name
    );
  END LOOP;
END
$$;

REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations"
  FROM greyhoundiq_runtime;
REVOKE DELETE ON TABLE public."PedigreeImportRun"
  FROM greyhoundiq_runtime;
REVOKE UPDATE, DELETE ON TABLE
  public."DogSourceIdentity",
  public."PedigreeAssertion",
  public."PedigreeMergeLedger",
  public."DogProfileObservation",
  public."DogProfileMergeLedger"
  FROM greyhoundiq_runtime;

GRANT SELECT ON TABLE
  public.giq_box_bias,
  public.giq_public_social_actor_profiles,
  public.giq_sire_leaderboard,
  public.giq_track_records,
  public.giq_trainer_leaderboard,
  public.giq_trainer_performance
  TO greyhoundiq_runtime;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM greyhoundiq_runtime;
GRANT USAGE ON SEQUENCE public."AuditLog_id_seq" TO greyhoundiq_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO greyhoundiq_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM greyhoundiq_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM greyhoundiq_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE
  allowed_routines text[] := ARRAY[
    'giq_actor_accountable(actor_id text, accountable_profile_id text)',
    'giq_actor_belongs_to_profile(actor_id text, profile_id text)',
    'giq_actor_can_act(actor_id text)',
    'giq_actor_connected(actor_id text)',
    'giq_actor_owned(actor_id text)',
    'giq_actor_visible(actor_id text)',
    'giq_audience_rank(audience text)',
    'giq_call_room_current_profile_can_join(room_id text)',
    'giq_call_room_current_profile_has_access(room_id text)',
    'giq_call_room_current_profile_is_creator(room_id text)',
    'giq_call_room_profile_is_conversation_participant(room_id text, profile_id text)',
    'giq_can_publish_feed_as(target_profile_id text, target_page_id text)',
    'giq_claim(name text)',
    'giq_conversation_actor_can_start(profile_a_id text, actor_a_id text, profile_b_id text, actor_b_id text)',
    'giq_conversation_actor_pair_valid(profile_a_id text, actor_a_id text, profile_b_id text, actor_b_id text)',
    'giq_conversation_default_personal_actors()',
    'giq_conversation_write_guard()',
    'giq_current_actor_id()',
    'giq_current_profile_id()',
    'giq_current_role()',
    'giq_current_tier()',
    'giq_current_user_id()',
    'giq_enforce_profile_marketing_tier()',
    'giq_feed_actor_can_publish(actor_id text)',
    'giq_feed_actor_consistent(actor_id text, accountable_profile_id text, page_id text)',
    'giq_feed_post_visible(post_id text)',
    'giq_feed_post_write_guard()',
    'giq_is_admin()',
    'giq_is_conversation_participant(conversation_id text)',
    'giq_is_moderator()',
    'giq_is_pro()',
    'giq_is_profile_in_conversation(conversation_id text, profile_id text)',
    'giq_is_system()',
    'giq_media_owned_by_actor(actor_id text, media_id text)',
    'giq_message_actor_pair_valid(conversation_id text, sender_profile_id text, sender_actor_id text, recipient_profile_id text, recipient_actor_id text)',
    'giq_message_write_guard()',
    'giq_org_current_user_is_member(org_id text)',
    'giq_org_current_user_is_owner(org_id text)',
    'giq_personal_feed_write_guard()',
    'giq_profiles_blocked(profile_a_id text, profile_b_id text)',
    'giq_refresh_aggregate_matview(requested_name text)',
    'giq_reject_page_call()',
    'giq_require_pro_write()',
    'giq_social_actor_identity_guard()',
    'giq_social_actor_identity_valid(actor_kind text, profile_id text, page_id text, owner_profile_id text)'
  ];
  found_count integer;
  routine record;
BEGIN
  FOR routine IN
    SELECT function.oid,
      function.proname || '(' ||
        pg_get_function_identity_arguments(function.oid) || ')' AS identity
    FROM pg_proc AS function
    JOIN pg_namespace AS namespace ON namespace.oid = function.pronamespace
    WHERE namespace.nspname = 'public'
      AND function.proname LIKE 'giq\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM greyhoundiq_runtime',
      routine.oid::regprocedure
    );
    IF routine.identity = ANY (allowed_routines) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO greyhoundiq_runtime',
        routine.oid::regprocedure
      );
    END IF;
  END LOOP;

  SELECT COUNT(*)::integer
  INTO found_count
  FROM pg_proc AS function
  JOIN pg_namespace AS namespace ON namespace.oid = function.pronamespace
  WHERE namespace.nspname = 'public'
    AND (
      function.proname || '(' ||
      pg_get_function_identity_arguments(function.oid) || ')'
    ) = ANY (allowed_routines);

  IF found_count <> cardinality(allowed_routines) THEN
    RAISE EXCEPTION
      'Runtime routine allowlist expected % functions but found %',
      cardinality(allowed_routines),
      found_count;
  END IF;
END
$$;

DO $$
DECLARE
  application_dml_count integer;
  migration_access boolean;
  projection_read_count integer;
  routine_count integer;
  sequence_usage_count integer;
  provenance_grants_valid boolean;
  runtime_role record;
BEGIN
  SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
    rolreplication, rolbypassrls
  INTO STRICT runtime_role
  FROM pg_roles
  WHERE rolname = 'greyhoundiq_runtime';

  IF NOT runtime_role.rolcanlogin
    OR runtime_role.rolsuper
    OR runtime_role.rolcreatedb
    OR runtime_role.rolcreaterole
    OR runtime_role.rolreplication
    OR runtime_role.rolbypassrls THEN
    RAISE EXCEPTION 'Runtime role attributes are outside the approved boundary';
  END IF;

  SELECT COUNT(*)::integer
  INTO application_dml_count
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
    AND relation.relname <> '_prisma_migrations'
    AND 4 = (
      SELECT COUNT(DISTINCT privilege.privilege_type)
      FROM aclexplode(
        COALESCE(relation.relacl, acldefault('r', relation.relowner))
      ) AS privilege
      JOIN pg_roles AS grantee ON grantee.oid = privilege.grantee
      WHERE grantee.rolname = 'greyhoundiq_runtime'
        AND privilege.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    );

  SELECT has_table_privilege(
    'greyhoundiq_runtime', 'public."_prisma_migrations"',
    'SELECT,INSERT,UPDATE,DELETE'
  ) INTO migration_access;

  SELECT COUNT(*)::integer
  INTO projection_read_count
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('v', 'm')
    AND EXISTS (
      SELECT 1
      FROM aclexplode(
        COALESCE(relation.relacl, acldefault('r', relation.relowner))
      ) AS privilege
      JOIN pg_roles AS grantee ON grantee.oid = privilege.grantee
      WHERE grantee.rolname = 'greyhoundiq_runtime'
        AND privilege.privilege_type = 'SELECT'
    );

  SELECT COUNT(*)::integer
  INTO sequence_usage_count
  FROM information_schema.usage_privileges
  WHERE grantee = 'greyhoundiq_runtime'
    AND object_schema = 'public'
    AND object_type = 'SEQUENCE'
    AND privilege_type = 'USAGE';

  SELECT COUNT(*)::integer
  INTO routine_count
  FROM pg_proc AS function
  JOIN pg_namespace AS namespace ON namespace.oid = function.pronamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(function.proacl, acldefault('f', function.proowner))) acl
  JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
  WHERE namespace.nspname = 'public'
    AND grantee.rolname = 'greyhoundiq_runtime'
    AND acl.privilege_type = 'EXECUTE';

  SELECT
    has_table_privilege('greyhoundiq_runtime', 'public."PedigreeImportRun"', 'SELECT')
    AND has_table_privilege('greyhoundiq_runtime', 'public."PedigreeImportRun"', 'INSERT')
    AND has_table_privilege('greyhoundiq_runtime', 'public."PedigreeImportRun"', 'UPDATE')
    AND NOT has_table_privilege('greyhoundiq_runtime', 'public."PedigreeImportRun"', 'DELETE')
    AND (
      SELECT bool_and(
        has_table_privilege('greyhoundiq_runtime', relation_name, 'SELECT')
        AND has_table_privilege('greyhoundiq_runtime', relation_name, 'INSERT')
        AND NOT has_table_privilege('greyhoundiq_runtime', relation_name, 'UPDATE')
        AND NOT has_table_privilege('greyhoundiq_runtime', relation_name, 'DELETE')
      )
      FROM unnest(ARRAY[
        'public."DogSourceIdentity"',
        'public."PedigreeAssertion"',
        'public."PedigreeMergeLedger"',
        'public."DogProfileObservation"',
        'public."DogProfileMergeLedger"'
      ]) AS relation(relation_name)
    )
  INTO provenance_grants_valid;

  IF application_dml_count <> 108
    OR migration_access
    OR projection_read_count <> 6
    OR sequence_usage_count <> 1
    OR routine_count <> 45
    OR NOT provenance_grants_valid THEN
    RAISE EXCEPTION
      'Runtime grants mismatch: dml=% migration_access=% projections=% sequences=% routines=% provenance=%',
      application_dml_count,
      migration_access,
      projection_read_count,
      sequence_usage_count,
      routine_count,
      provenance_grants_valid;
  END IF;
END
$$;

COMMIT;
SQL

export PGUSER="$RUNTIME_USER"
export PGPASSWORD="$RUNTIME_DATABASE_PASSWORD"

runtime_identity="$(psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command="SELECT current_user || ':' || session_user;")"
[ "$runtime_identity" = "$RUNTIME_USER:$RUNTIME_USER" ] || \
  die "runtime login verification failed"

runtime_public_probe="$(psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command="SELECT COUNT(*) FROM public.\"Race\" WHERE \"raceTime\" >= now() - interval '30 days';")"

case "$runtime_public_probe" in
  ''|*[!0-9]*) die "runtime public racing probe returned a non-count result" ;;
esac

printf 'RUNTIME_ROLE_PROVISIONED database=%s role=%s recent_races=%s\n' \
  "$EXPECTED_DATABASE" "$RUNTIME_USER" "$runtime_public_probe"
