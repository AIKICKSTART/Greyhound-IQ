-- AuditLog uses the only sequence in the application schema. Runtime roles
-- need nextval access so system-context audit writes can run without BYPASSRLS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT USAGE ON SEQUENCE public."AuditLog_id_seq" TO greyhoundiq_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT USAGE ON SEQUENCE public."AuditLog_id_seq" TO greyhoundiq_app;
  END IF;
END;
$$;
