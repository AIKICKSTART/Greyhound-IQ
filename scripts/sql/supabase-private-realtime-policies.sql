-- Apply to the self-hosted Supabase engine database, not the Prisma app DB.
-- The app calls the replacement RPC with service_role before issuing a
-- five-minute browser JWT. Realtime policies then authorize only exact,
-- unexpired topic/extension pairs from that JWT's profile_id claim.

begin;

create table if not exists public.giq_realtime_topic_grants (
  topic text not null,
  profile_id text not null,
  extension text not null check (extension in ('broadcast', 'presence')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (topic, profile_id, extension)
);

create index if not exists giq_realtime_topic_grants_expiry_idx
  on public.giq_realtime_topic_grants (expires_at);

alter table public.giq_realtime_topic_grants enable row level security;
alter table public.giq_realtime_topic_grants force row level security;
revoke all on public.giq_realtime_topic_grants from public, anon, authenticated;

drop policy if exists giq_realtime_topic_grants_owner_access
  on public.giq_realtime_topic_grants;
create policy giq_realtime_topic_grants_owner_access
  on public.giq_realtime_topic_grants for all
  to postgres
  using (true)
  with check (true);

create or replace function public.giq_replace_realtime_topic_grants(
  requested_profile_id text,
  requested_grants jsonb,
  requested_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_profile_id is null or requested_profile_id = ''
     or jsonb_typeof(requested_grants) <> 'array'
     or jsonb_array_length(requested_grants) = 0
     or jsonb_array_length(requested_grants) > 250
     or requested_expires_at <= now()
     or requested_expires_at > now() + interval '15 minutes' then
    raise exception 'invalid realtime grant request';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_grants) as g(topic text, extension text)
    where g.topic is null
       or g.topic !~ '^(conversation|profile|presence):[0-9a-f]{48}$'
       or g.extension is null
       or g.extension not in ('broadcast', 'presence')
  ) then
    raise exception 'invalid realtime grant';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requested_profile_id, 0)
  );

  delete from public.giq_realtime_topic_grants
  where expires_at <= now() or profile_id = requested_profile_id;

  insert into public.giq_realtime_topic_grants (
    topic,
    profile_id,
    extension,
    expires_at
  )
  select distinct
    g.topic,
    requested_profile_id,
    g.extension,
    requested_expires_at
  from jsonb_to_recordset(requested_grants) as g(topic text, extension text);
end;
$$;

create or replace function public.giq_realtime_topic_allowed(
  requested_topic text,
  requested_extension text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_extension in ('broadcast', 'presence')
    and exists (
      select 1
      from public.giq_realtime_topic_grants g
      where g.topic = requested_topic
        and g.profile_id = nullif(auth.jwt() ->> 'profile_id', '')
        and g.extension = requested_extension
        and g.expires_at > now()
    );
$$;

create or replace function public.giq_revoke_realtime_topic_grants(
  requested_profile_ids text[],
  requested_topics text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_profile_ids is null
     or cardinality(requested_profile_ids) < 1
     or cardinality(requested_profile_ids) > 10
     or requested_topics is null
     or cardinality(requested_topics) < 1
     or cardinality(requested_topics) > 10
     or exists (
       select 1
       from unnest(requested_profile_ids) as requested_profile(profile_id)
       where requested_profile.profile_id is null
          or requested_profile.profile_id = ''
          or length(requested_profile.profile_id) > 128
     )
     or exists (
       select 1
       from unnest(requested_topics) as requested_topic(topic)
       where requested_topic.topic is null
          or requested_topic.topic !~ '^conversation:[0-9a-f]{48}$'
     ) then
    raise exception 'invalid realtime grant revocation';
  end if;

  -- Serialize against grant replacement for each affected profile. Sorting
  -- makes multi-profile block revocations acquire locks deterministically.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_profile.profile_id, 0)
  )
  from (
    select distinct requested_profile.profile_id
    from unnest(requested_profile_ids) as requested_profile(profile_id)
    order by requested_profile.profile_id
  ) as locked_profile;

  delete from public.giq_realtime_topic_grants
  where profile_id = any(requested_profile_ids)
    and topic = any(requested_topics);
end;
$$;

revoke all on function public.giq_replace_realtime_topic_grants(text, jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function public.giq_revoke_realtime_topic_grants(text[], text[])
  from public, anon, authenticated;
revoke all on function public.giq_realtime_topic_allowed(text, text)
  from public, anon, service_role;
grant execute on function public.giq_replace_realtime_topic_grants(text, jsonb, timestamptz)
  to service_role;
grant execute on function public.giq_revoke_realtime_topic_grants(text[], text[])
  to service_role;
grant execute on function public.giq_realtime_topic_allowed(text, text)
  to authenticated;

alter table realtime.messages enable row level security;

drop policy if exists giq_private_topic_receive on realtime.messages;
create policy giq_private_topic_receive
  on realtime.messages for select
  to authenticated
  using (
    extension in ('broadcast', 'presence')
    and public.giq_realtime_topic_allowed((select realtime.topic()), extension)
  );

drop policy if exists giq_private_topic_receive_guard on realtime.messages;
create policy giq_private_topic_receive_guard
  on realtime.messages as restrictive for select
  to authenticated
  using (
    extension in ('broadcast', 'presence')
    and public.giq_realtime_topic_allowed((select realtime.topic()), extension)
  );

drop policy if exists giq_private_topic_send on realtime.messages;
create policy giq_private_topic_send
  on realtime.messages for insert
  to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and public.giq_realtime_topic_allowed((select realtime.topic()), extension)
  );

drop policy if exists giq_private_topic_send_guard on realtime.messages;
create policy giq_private_topic_send_guard
  on realtime.messages as restrictive for insert
  to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and public.giq_realtime_topic_allowed((select realtime.topic()), extension)
  );

commit;

notify pgrst, 'reload schema';
