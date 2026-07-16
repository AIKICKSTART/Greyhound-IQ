-- Personal Profile-to-Profile text conversations are available to every tier.
-- Page/actor conversations remain out of scope; these tables still reference
-- Profile directly. Participant IDs cannot be changed after creation.

CREATE OR REPLACE FUNCTION public.giq_conversation_write_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.giq_is_system() OR public.giq_is_moderator() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
    AND public.giq_current_profile_id() IN (NEW."participantAId", NEW."participantBId") THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."participantAId" = NEW."participantAId"
    AND OLD."participantBId" = NEW."participantBId"
    AND public.giq_current_profile_id() IN (NEW."participantAId", NEW."participantBId") THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'auth.forbidden'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS giq_conversation_pro_write ON "Conversation";
CREATE TRIGGER giq_conversation_pro_write
BEFORE INSERT OR UPDATE ON "Conversation"
FOR EACH ROW EXECUTE FUNCTION public.giq_conversation_write_guard();

DROP POLICY IF EXISTS giq_conversation_insert ON "Conversation";
CREATE POLICY giq_conversation_insert ON "Conversation" FOR INSERT WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR public.giq_current_profile_id() IN ("participantAId", "participantBId")
);

DROP POLICY IF EXISTS giq_conversation_update ON "Conversation";
CREATE POLICY giq_conversation_update ON "Conversation" FOR UPDATE USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR public.giq_current_profile_id() IN ("participantAId", "participantBId")
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR public.giq_current_profile_id() IN ("participantAId", "participantBId")
);

CREATE OR REPLACE FUNCTION public.giq_is_profile_in_conversation(
  conversation_id text,
  profile_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM "Conversation" c
    WHERE c.id = conversation_id
      AND profile_id IN (c."participantAId", c."participantBId")
  ), false);
$$;

DROP POLICY IF EXISTS giq_conversation_participant_write ON "ConversationParticipant";
CREATE POLICY giq_conversation_participant_write ON "ConversationParticipant" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_is_conversation_participant("conversationId")
    AND public.giq_is_profile_in_conversation("conversationId", "profileId")
  )
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_is_conversation_participant("conversationId")
    AND public.giq_is_profile_in_conversation("conversationId", "profileId")
  )
);
