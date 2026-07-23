-- The application runtime must never modify migration history or write through
-- views. Future relations now receive SELECT by default; migrations that add a
-- writable base table must grant its required DML explicitly.
DO $$
DECLARE
  relation_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    -- Prisma's shadow replay applies migration SQL without creating its
    -- metadata table. Production deploys do create it, so revoke access when
    -- present without making an otherwise clean source replay fail.
    IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
      EXECUTE
        'REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" '
        'FROM greyhoundiq_runtime';
    END IF;

    FOR relation_name IN
      SELECT format('%I.%I', namespace.nspname, relation.relname)
      FROM pg_class AS relation
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('v', 'm')
    LOOP
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE ON TABLE %s FROM greyhoundiq_runtime',
        relation_name
      );
    END LOOP;

    EXECUTE
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public '
      'REVOKE INSERT, UPDATE, DELETE ON TABLES FROM greyhoundiq_runtime';
  END IF;
END
$$;
