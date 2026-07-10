-- Every call child row must belong to one of the room conversation's two
-- accountable profiles. This prevents a room creator from granting a third
-- profile call access while preserving Free inbound participation.
CREATE OR REPLACE FUNCTION public.giq_call_room_profile_is_conversation_participant(
  room_id text,
  profile_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public."CallRoom" room
    JOIN public."Conversation" conversation
      ON conversation.id = room."conversationId"
    WHERE room.id = room_id
      AND profile_id IS NOT NULL
      AND profile_id IN (
        conversation."participantAId",
        conversation."participantBId"
      )
  ), false);
$$;

ALTER POLICY giq_call_participant_access
ON public."CallParticipant"
USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_call_room_profile_is_conversation_participant("callRoomId", "profileId")
    AND (
      "profileId" = public.giq_current_profile_id()
      OR (public.giq_is_pro()
        AND public.giq_call_room_current_profile_is_creator("callRoomId"))
    )
  )
)
WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_call_room_profile_is_conversation_participant("callRoomId", "profileId")
    AND (
      "profileId" = public.giq_current_profile_id()
      OR (public.giq_is_pro()
        AND public.giq_call_room_current_profile_is_creator("callRoomId"))
    )
  )
);

ALTER POLICY giq_call_permission_access
ON public."CallPermission"
USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_call_room_profile_is_conversation_participant("callRoomId", "profileId")
    AND (
      "profileId" = public.giq_current_profile_id()
      OR (public.giq_is_pro()
        AND public.giq_call_room_current_profile_is_creator("callRoomId"))
    )
  )
)
WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_is_pro()
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "profileId")
    AND (
      "profileId" = public.giq_current_profile_id()
      OR public.giq_call_room_current_profile_is_creator("callRoomId")
    )
  )
);

ALTER POLICY giq_call_invite_access
ON public."CallInvite"
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

ALTER POLICY giq_call_event_access
ON public."CallEvent"
USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "profileId" = public.giq_current_profile_id()
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "profileId")
  )
)
WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "profileId" = public.giq_current_profile_id()
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "profileId")
  )
);

ALTER POLICY giq_call_report_access
ON public."CallReport"
USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "reporterProfileId" = public.giq_current_profile_id()
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "reporterProfileId")
  )
)
WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "reporterProfileId" = public.giq_current_profile_id()
    AND public.giq_call_room_profile_is_conversation_participant("callRoomId", "reporterProfileId")
  )
);

REVOKE ALL ON FUNCTION public.giq_call_room_profile_is_conversation_participant(text, text)
FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.giq_call_room_profile_is_conversation_participant(text, text)
    TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT EXECUTE ON FUNCTION public.giq_call_room_profile_is_conversation_participant(text, text)
    TO greyhoundiq_app;
  END IF;
END;
$$;
