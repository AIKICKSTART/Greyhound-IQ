-- Prisma upserts use INSERT ... ON CONFLICT ... RETURNING, which requires the
-- proposed row to satisfy the SELECT policy before it exists in SocialActor.
-- Keep the existing visibility helper for stored rows, but make privileged and
-- owner visibility row-local so actor creation can complete under FORCE RLS.
ALTER POLICY giq_social_actor_select
ON public."SocialActor"
USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "ownerProfileId" = public.giq_current_profile_id()
  OR public.giq_actor_visible(id)
);
