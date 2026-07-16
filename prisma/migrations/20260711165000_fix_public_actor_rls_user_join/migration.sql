CREATE OR REPLACE FUNCTION public.giq_actor_visible(actor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public."SocialActor" actor
    WHERE actor.id = actor_id
      AND (
        actor.kind <> 'personal'
        OR EXISTS (
          SELECT 1
          FROM public."Profile" profile
          JOIN public."User" account ON account.id = profile."userId"
          WHERE profile.id = actor."profileId"
            AND account."isBanned" = false
            AND account."deletionRequestedAt" IS NULL
        )
      )
      AND (
        public.giq_is_system()
        OR public.giq_is_moderator()
        OR actor."ownerProfileId" = public.giq_current_profile_id()
        OR (
          NOT public.giq_profiles_blocked(
            public.giq_current_profile_id(),
            actor."ownerProfileId"
          )
          AND actor.published
          AND (
            actor."profileVisibility" = 'public'
            OR (actor."profileVisibility" = 'members' AND public.giq_current_profile_id() IS NOT NULL)
            OR (actor."profileVisibility" = 'connections' AND public.giq_actor_connected(actor.id))
          )
        )
      )
  ), false);
$$;
