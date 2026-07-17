-- Only the callee may respond to an invite. Non-system responses are a single
-- pending -> accepted|declined transition and cannot rewrite identity/timing.
ALTER POLICY giq_call_invite_update
ON public."CallInvite"
USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "fromProfileId" <> "toProfileId"
    AND "toProfileId" = public.giq_current_profile_id()
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "fromProfileId")
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "toProfileId")
  )
)
WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "fromProfileId" <> "toProfileId"
    AND "toProfileId" = public.giq_current_profile_id()
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "fromProfileId")
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "toProfileId")
  )
);

CREATE OR REPLACE FUNCTION public.giq_call_invite_identity_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD."callRoomId" IS DISTINCT FROM NEW."callRoomId"
    OR OLD."fromProfileId" IS DISTINCT FROM NEW."fromProfileId"
    OR OLD."toProfileId" IS DISTINCT FROM NEW."toProfileId" THEN
    RAISE EXCEPTION 'call.invite_identity_immutable' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.giq_is_system() OR public.giq_is_moderator())
    AND (
      OLD."expiresAt" IS DISTINCT FROM NEW."expiresAt"
      OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
      OR OLD.status <> 'pending'
      OR NEW.status NOT IN ('accepted', 'declined')
    ) THEN
    RAISE EXCEPTION 'call.invite_response_invalid' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.giq_call_invite_identity_guard() FROM PUBLIC;
