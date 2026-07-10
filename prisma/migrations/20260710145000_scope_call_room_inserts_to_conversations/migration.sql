-- Calls are person-to-person conversation features. Keep Pro initiation and
-- bind every room to a conversation that includes the accountable creator.
-- The existing giq_call_room_person_only trigger rejects page actors.
ALTER POLICY giq_call_room_insert
ON public."CallRoom"
WITH CHECK (
  public.giq_is_pro()
  AND "createdByProfileId" = public.giq_current_profile_id()
  AND "conversationId" IS NOT NULL
  AND public.giq_is_conversation_participant("conversationId")
);
