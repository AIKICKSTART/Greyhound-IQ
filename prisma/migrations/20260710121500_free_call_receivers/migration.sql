-- Free members may RECEIVE calls: see + accept/decline their own invites, be
-- stamped as participants on join, log their own call events, and read their
-- own CallPermission rows (callRoomJoinWhere resolves through them).
-- Call INITIATION stays paid: giq_call_room_insert keeps giq_is_pro() and
-- createCallRoomForConversation keeps assertPaidFeatureAccess.

DROP POLICY IF EXISTS giq_call_invite_access ON "CallInvite";
CREATE POLICY giq_call_invite_access ON "CallInvite" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "fromProfileId" = public.giq_current_profile_id()
  OR "toProfileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "fromProfileId" = public.giq_current_profile_id()
  OR "toProfileId" = public.giq_current_profile_id()
);

DROP POLICY IF EXISTS giq_call_participant_access ON "CallParticipant";
CREATE POLICY giq_call_participant_access ON "CallParticipant" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "profileId" = public.giq_current_profile_id()
  OR (public.giq_is_pro() AND EXISTS (
    SELECT 1 FROM "CallRoom" r
    WHERE r.id = "callRoomId" AND r."createdByProfileId" = public.giq_current_profile_id()
  ))
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "profileId" = public.giq_current_profile_id()
  OR (public.giq_is_pro() AND EXISTS (
    SELECT 1 FROM "CallRoom" r
    WHERE r.id = "callRoomId" AND r."createdByProfileId" = public.giq_current_profile_id()
  ))
);

DROP POLICY IF EXISTS giq_call_event_access ON "CallEvent";
CREATE POLICY giq_call_event_access ON "CallEvent" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "profileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "profileId" = public.giq_current_profile_id()
);

DROP POLICY IF EXISTS giq_call_permission_access ON "CallPermission";
CREATE POLICY giq_call_permission_access ON "CallPermission" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "profileId" = public.giq_current_profile_id()
  OR (public.giq_is_pro() AND EXISTS (
    SELECT 1 FROM "CallRoom" r
    WHERE r.id = "callRoomId" AND r."createdByProfileId" = public.giq_current_profile_id()
  ))
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND EXISTS (
    SELECT 1 FROM "CallRoom" r
    WHERE r.id = "callRoomId" AND r."createdByProfileId" = public.giq_current_profile_id()
  ))
);
