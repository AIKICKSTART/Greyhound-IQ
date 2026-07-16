-- Storage RLS hardening for both GreyhoundIQ user-media buckets.
--
-- Prisma migration 20260710133500_private_user_media_quarantine is the source
-- of truth. This idempotent operator script reapplies the same invariant when
-- repairing a self-hosted Supabase Storage schema manually.
--
-- The app generates upload/download signatures server-side with service_role.
-- anon/authenticated must not directly read, insert, update, or delete user
-- media. site-assets remains the only public bucket.

begin;

alter table storage.objects enable row level security;

update storage.buckets
set public = false
where id in ('public-user-media', 'private-user-media')
  and public is distinct from false;

drop policy if exists "GreyhoundIQ public read public user media" on storage.objects;
drop policy if exists "GreyhoundIQ private read own media" on storage.objects;
drop policy if exists "GreyhoundIQ upload public user media" on storage.objects;
drop policy if exists "GreyhoundIQ upload private user media" on storage.objects;
drop policy if exists "GreyhoundIQ update own public user media" on storage.objects;
drop policy if exists "GreyhoundIQ update own private user media" on storage.objects;
drop policy if exists "GreyhoundIQ delete own public user media" on storage.objects;
drop policy if exists "GreyhoundIQ delete own private user media" on storage.objects;
drop policy if exists "deny anon reads of private media" on storage.objects;

drop policy if exists "GreyhoundIQ deny direct user media select" on storage.objects;
create policy "GreyhoundIQ deny direct user media select"
  on storage.objects as restrictive for select to anon, authenticated
  using (bucket_id not in ('public-user-media', 'private-user-media'));

drop policy if exists "GreyhoundIQ deny direct user media insert" on storage.objects;
create policy "GreyhoundIQ deny direct user media insert"
  on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id not in ('public-user-media', 'private-user-media'));

drop policy if exists "GreyhoundIQ deny direct user media update" on storage.objects;
create policy "GreyhoundIQ deny direct user media update"
  on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id not in ('public-user-media', 'private-user-media'))
  with check (bucket_id not in ('public-user-media', 'private-user-media'));

drop policy if exists "GreyhoundIQ deny direct user media delete" on storage.objects;
create policy "GreyhoundIQ deny direct user media delete"
  on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id not in ('public-user-media', 'private-user-media'));

commit;
