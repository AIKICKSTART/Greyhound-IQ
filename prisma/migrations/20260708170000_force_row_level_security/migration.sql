-- Close the owner-bypass gap: RLS policies must bind regardless of connecting
-- role (table owners skip plain RLS unless FORCE is set). Superusers still
-- bypass RLS entirely; runtime roles must therefore stay NOSUPERUSER/NOBYPASSRLS.
-- Forward-only and idempotent; rollback is a follow-up NO FORCE migration.

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.oid::regclass AS tbl
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND NOT c.relforcerowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t.tbl);
  END LOOP;
END;
$$;
