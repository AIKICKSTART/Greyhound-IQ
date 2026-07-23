CREATE OR REPLACE FUNCTION public.giq_profile_account_active(target_profile_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public."Profile" profile
    JOIN public."User" account ON account.id = profile."userId"
    WHERE profile.id = target_profile_id
      AND account."isBanned" = false
      AND account."deletionRequestedAt" IS NULL
  ), false);
$$;

REVOKE ALL ON FUNCTION public.giq_profile_account_active(text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.giq_profile_account_active(text) TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT EXECUTE ON FUNCTION public.giq_profile_account_active(text) TO greyhoundiq_app;
  END IF;
END
$$;

DROP POLICY IF EXISTS giq_social_actor_select ON public."SocialActor";
CREATE POLICY giq_social_actor_select ON public."SocialActor" FOR SELECT USING (
  (
    kind <> 'personal'
    OR public.giq_profile_account_active("profileId")
  )
  AND (
    public.giq_is_system()
    OR public.giq_is_moderator()
    OR "ownerProfileId" = public.giq_current_profile_id()
    OR (
      NOT public.giq_profiles_blocked(
        public.giq_current_profile_id(),
        "ownerProfileId"
      )
      AND published
      AND CASE "profileVisibility"
        WHEN 'public' THEN true
        WHEN 'members' THEN public.giq_current_profile_id() IS NOT NULL
        WHEN 'connections' THEN public.giq_actor_connected(id)
        ELSE false
      END
    )
  )
);
