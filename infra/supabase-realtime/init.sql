\set ON_ERROR_STOP on

SELECT format(
  'CREATE ROLE supabase_admin LOGIN CREATEDB CREATEROLE PASSWORD %L',
  :'supabase_admin_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin')
\gexec

SELECT format(
  'ALTER ROLE supabase_admin WITH LOGIN CREATEDB CREATEROLE PASSWORD %L',
  :'supabase_admin_password'
)
\gexec

GRANT alloydbsuperuser TO supabase_admin;
GRANT supabase_admin TO postgres;

-- PostgreSQL 16 requires explicit ADMIN membership before a CREATEROLE user
-- can grant a role that it created. Realtime's upstream migration grants this
-- role to postgres, so make supabase_admin its administrator up front.
SELECT 'CREATE ROLE supabase_realtime_admin NOLOGIN NOINHERIT ADMIN supabase_admin'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin'
)
\gexec

SELECT 'CREATE ROLE anon NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
\gexec

SELECT 'CREATE ROLE authenticated NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
\gexec

SELECT 'CREATE ROLE service_role NOLOGIN BYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
\gexec

ALTER ROLE service_role NOLOGIN BYPASSRLS;

SELECT 'CREATE ROLE dashboard_user NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_user')
\gexec

-- Realtime switches each authorization transaction to the JWT role. Standard
-- self-hosted Postgres grants this through its superuser; AlloyDB's managed
-- superuser role requires the memberships to be explicit.
GRANT anon, authenticated, service_role
  TO supabase_admin, supabase_realtime_admin;

SELECT format(
  'CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD %L',
  :'authenticator_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator')
\gexec

SELECT format(
  'ALTER ROLE authenticator WITH LOGIN NOINHERIT PASSWORD %L',
  :'authenticator_password'
)
\gexec

GRANT anon, authenticated, service_role TO authenticator;

SELECT 'CREATE DATABASE giq_realtime_stage11 OWNER supabase_admin'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = 'giq_realtime_stage11'
)
\gexec

ALTER DATABASE giq_realtime_stage11 OWNER TO supabase_admin;
REVOKE CONNECT ON DATABASE giq_realtime_stage11 FROM PUBLIC;
GRANT CONNECT ON DATABASE giq_realtime_stage11
  TO supabase_admin, authenticator, anon, authenticated, service_role;

\connect giq_realtime_stage11

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_admin;
CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION supabase_admin;
CREATE SCHEMA IF NOT EXISTS realtime AUTHORIZATION supabase_admin;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb
$$;

REVOKE ALL ON SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;

GRANT USAGE, CREATE ON SCHEMA public TO supabase_admin;
GRANT USAGE, CREATE ON SCHEMA _realtime TO supabase_admin;
GRANT USAGE, CREATE ON SCHEMA realtime TO supabase_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

DO $$
BEGIN
  IF to_regclass('_realtime.extensions') IS NOT NULL THEN
    UPDATE _realtime.extensions
    SET settings = jsonb_set(settings, '{ssl_enforced}', 'true'::jsonb, true)
    WHERE tenant_external_id = 'realtime-dev'
      AND type = 'postgres_cdc_rls';
  END IF;
END;
$$;
