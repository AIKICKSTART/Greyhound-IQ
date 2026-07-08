-- Storage RLS hardening for the private-user-media bucket (self-hosted Supabase).
--
-- Managed OUTSIDE prisma/migrations: the `storage` schema is owned by Supabase,
-- not by our Prisma datamodel. Apply manually on the DB VM:
--   sudo docker exec -i supabase-db psql -U postgres < storage-private-media-policies.sql
-- This script is idempotent and forward-only.
--
-- Threat model / delivery model:
--   * The app touches storage ONLY server-side via the service-role key. The
--     `service_role` Postgres role has BYPASSRLS, so signed-URL generation and
--     delivery are unaffected by any policy here.
--   * `anon` and `authenticated` have NO bypass. With RLS enabled and no
--     permissive SELECT policy, direct object reads by those roles are already
--     denied (default-deny). This script LOCKS that invariant so a future
--     permissive policy added by mistake cannot silently expose private media.
--   * Public buckets (site-assets, public-user-media) are served by the storage
--     API's public path via storage.buckets.public = true and do NOT depend on
--     an anon SELECT policy — so we intentionally add none (adding one would let
--     anon enumerate objects through the authenticated list API).
--
-- Upgrade path: if per-user in-DB authorization is ever needed for the private
-- bucket, replace the restrictive deny below with owner-scoped permissive
-- policies keyed to auth.uid() / object path prefix.

begin;

-- storage.objects is owned by supabase_storage_admin; DDL/policy changes must
-- run AS that role. Connect with the storage service DSN (supabase_storage_admin),
-- e.g.:  psql "$(docker exec supabase-storage printenv DATABASE_URL)" -f this.sql
-- (postgres superuser cannot ALTER/CREATE POLICY on this table it does not own.)

-- 1. Guarantee RLS stays on (default-deny for anon/authenticated).
alter table storage.objects enable row level security;

-- 2. Guarantee the private bucket is not flagged public (public flag bypasses
--    RLS on the public delivery path).
update storage.buckets set public = false where id = 'private-user-media' and public is distinct from false;

-- 3. Defense-in-depth: a RESTRICTIVE policy that blocks anon/authenticated reads
--    of private-bucket objects regardless of any permissive policy that may be
--    added later. Restrictive policies are ANDed with permissive ones, so this
--    can only ever subtract access. service_role (BYPASSRLS) is unaffected.
drop policy if exists "deny anon reads of private media" on storage.objects;
create policy "deny anon reads of private media"
  on storage.objects
  as restrictive
  for select
  to anon, authenticated
  using (bucket_id <> 'private-user-media');

commit;

-- Verification (run after apply):
--   select policyname, permissive, roles, cmd, qual
--     from pg_policies where schemaname='storage' and tablename='objects';
--   -- Unsigned anon fetch of a private object must return 400/403:
--   --   curl -sw '%{http_code}' \
--   --     https://<kong-host>/storage/v1/object/private-user-media/<path>
