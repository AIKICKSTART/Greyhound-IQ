CREATE OR REPLACE FUNCTION public.giq_call_room_current_profile_is_creator(room_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM "CallRoom" r
    WHERE r.id = $1
      AND r."createdByProfileId" = public.giq_current_profile_id()
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.giq_call_room_current_profile_has_access(room_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.giq_call_room_current_profile_is_creator($1)
    OR EXISTS (
      SELECT 1
      FROM "CallParticipant" p
      WHERE p."callRoomId" = $1
        AND p."profileId" = public.giq_current_profile_id()
    )
    OR EXISTS (
      SELECT 1
      FROM "CallPermission" p
      WHERE p."callRoomId" = $1
        AND p."profileId" = public.giq_current_profile_id()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.giq_call_room_current_profile_can_join(room_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM "CallPermission" p
    WHERE p."callRoomId" = $1
      AND p."profileId" = public.giq_current_profile_id()
      AND p."canJoin" = true
  ), false);
$$;

DROP POLICY IF EXISTS giq_call_room_select ON "CallRoom";
DROP POLICY IF EXISTS giq_call_room_update ON "CallRoom";
DROP POLICY IF EXISTS giq_call_participant_access ON "CallParticipant";
DROP POLICY IF EXISTS giq_call_permission_access ON "CallPermission";

CREATE POLICY giq_call_room_select ON "CallRoom" FOR SELECT USING (
  public.giq_is_moderator()
  OR public.giq_call_room_current_profile_has_access(id)
);

CREATE POLICY giq_call_room_update ON "CallRoom" FOR UPDATE USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "createdByProfileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND public.giq_call_room_current_profile_can_join(id))
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "createdByProfileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND public.giq_call_room_current_profile_can_join(id))
);

CREATE POLICY giq_call_participant_access ON "CallParticipant" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND public.giq_call_room_current_profile_is_creator("callRoomId"))
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND public.giq_call_room_current_profile_is_creator("callRoomId"))
);

CREATE POLICY giq_call_permission_access ON "CallPermission" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND public.giq_call_room_current_profile_is_creator("callRoomId"))
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (public.giq_is_pro() AND "profileId" = public.giq_current_profile_id())
  OR (public.giq_is_pro() AND public.giq_call_room_current_profile_is_creator("callRoomId"))
);
