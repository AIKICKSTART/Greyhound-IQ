-- Prisma reads created rows through INSERT ... RETURNING. Keep the existing
-- participant/permission helper for normal reads, but authorize the creator
-- from the row itself so a new room is visible in the same command snapshot.
ALTER POLICY giq_call_room_select
ON public."CallRoom"
USING (
  public.giq_is_moderator()
  OR "createdByProfileId" = public.giq_current_profile_id()
  OR public.giq_call_room_current_profile_has_access(id)
);
