-- Application roles do not need database-level temporary-object privileges.
-- PostgreSQL grants TEMPORARY to PUBLIC by default, so revoking it only from
-- greyhoundiq_runtime would still leave the privilege inherited through PUBLIC.
DO $$
BEGIN
  EXECUTE format(
    'REVOKE TEMPORARY ON DATABASE %I FROM PUBLIC',
    current_database()
  );

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    EXECUTE format(
      'REVOKE TEMPORARY ON DATABASE %I FROM greyhoundiq_runtime',
      current_database()
    );
  END IF;
END
$$;
