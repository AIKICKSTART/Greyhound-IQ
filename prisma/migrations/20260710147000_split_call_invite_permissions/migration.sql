-- Free members may respond to an incoming invite, but only the Pro room
-- creator may create one. Call identity columns are immutable after insert.
DROP POLICY IF EXISTS giq_call_invite_access ON public."CallInvite";
DROP POLICY IF EXISTS giq_call_invite_select ON public."CallInvite";
DROP POLICY IF EXISTS giq_call_invite_insert ON public."CallInvite";
DROP POLICY IF EXISTS giq_call_invite_update ON public."CallInvite";
DROP POLICY IF EXISTS giq_call_invite_delete ON public."CallInvite";

CREATE POLICY giq_call_invite_select
ON public."CallInvite"
FOR SELECT
USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "fromProfileId" <> "toProfileId"
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "fromProfileId")
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "toProfileId")
    AND public.giq_current_profile_id() IN ("fromProfileId", "toProfileId")
  )
);

CREATE POLICY giq_call_invite_insert
ON public."CallInvite"
FOR INSERT
WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_is_pro()
    AND "fromProfileId" = public.giq_current_profile_id()
    AND "fromProfileId" <> "toProfileId"
    AND public.giq_call_room_current_profile_is_creator("callRoomId")
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "fromProfileId")
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "toProfileId")
  )
);

CREATE POLICY giq_call_invite_update
ON public."CallInvite"
FOR UPDATE
USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "fromProfileId" <> "toProfileId"
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "fromProfileId")
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "toProfileId")
    AND public.giq_current_profile_id() IN ("fromProfileId", "toProfileId")
  )
)
WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "fromProfileId" <> "toProfileId"
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "fromProfileId")
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "toProfileId")
    AND public.giq_current_profile_id() IN ("fromProfileId", "toProfileId")
  )
);

CREATE POLICY giq_call_invite_delete
ON public."CallInvite"
FOR DELETE
USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_is_pro()
    AND "fromProfileId" = public.giq_current_profile_id()
    AND public.giq_call_room_current_profile_is_creator("callRoomId")
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
  IF OLD."callRoomId" IS DISTINCT FROM NEW."callRoomId"
    OR OLD."fromProfileId" IS DISTINCT FROM NEW."fromProfileId"
    OR OLD."toProfileId" IS DISTINCT FROM NEW."toProfileId" THEN
    RAISE EXCEPTION 'call.invite_identity_immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS giq_call_invite_identity_immutable ON public."CallInvite";
CREATE TRIGGER giq_call_invite_identity_immutable
BEFORE UPDATE OF "callRoomId", "fromProfileId", "toProfileId"
ON public."CallInvite"
FOR EACH ROW EXECUTE FUNCTION public.giq_call_invite_identity_guard();

REVOKE ALL ON FUNCTION public.giq_call_invite_identity_guard() FROM PUBLIC;
