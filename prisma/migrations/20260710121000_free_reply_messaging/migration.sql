-- Free members may REPLY inside conversations a paid member started, mark
-- messages read/delivered, and react. Starting a conversation stays Pro-only
-- (giq_conversation_insert + app gate in startOrGetConversation unchanged).

CREATE OR REPLACE FUNCTION public.giq_is_conversation_participant(conversation_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Conversation" c
    WHERE c.id = conversation_id
      AND public.giq_current_profile_id() IN (c."participantAId", c."participantBId")
  );
$$;

-- Message trigger: pro/moderator/system unchanged; free tier may insert a reply
-- into a conversation it participates in, and update messages it sent/received
-- (read flags, soft-delete).
CREATE OR REPLACE FUNCTION public.giq_message_write_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.giq_is_pro() OR public.giq_is_moderator() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."conversationId" IS NOT NULL
      AND NEW."senderId" = public.giq_current_profile_id()
      AND public.giq_is_conversation_participant(NEW."conversationId") THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF public.giq_current_profile_id() IN (NEW."senderId", NEW."recipientId") THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'payment.required'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS giq_message_pro_write ON "Message";
CREATE TRIGGER giq_message_pro_write
BEFORE INSERT OR UPDATE ON "Message"
FOR EACH ROW EXECUTE FUNCTION public.giq_message_write_guard();

-- Conversation trigger: INSERT stays pro-gated; participants of any tier may
-- UPDATE their own conversation (lastMessageAt refresh on free reply).
CREATE OR REPLACE FUNCTION public.giq_conversation_write_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.giq_is_pro() OR public.giq_is_moderator() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND public.giq_current_profile_id() IN (NEW."participantAId", NEW."participantBId") THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'payment.required'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS giq_conversation_pro_write ON "Conversation";
CREATE TRIGGER giq_conversation_pro_write
BEFORE INSERT OR UPDATE ON "Conversation"
FOR EACH ROW EXECUTE FUNCTION public.giq_conversation_write_guard();

-- Policies: drop the pro requirement from participant-scoped writes. The
-- triggers above remain the tier gate for the reply/start distinction.

DROP POLICY IF EXISTS giq_message_insert ON "Message";
CREATE POLICY giq_message_insert ON "Message" FOR INSERT WITH CHECK (
  "senderId" = public.giq_current_profile_id()
  AND (
    public.giq_is_pro()
    OR (
      "conversationId" IS NOT NULL
      AND public.giq_is_conversation_participant("conversationId")
    )
  )
);

DROP POLICY IF EXISTS giq_message_update ON "Message";
CREATE POLICY giq_message_update ON "Message" FOR UPDATE USING (
  public.giq_is_moderator()
  OR "senderId" = public.giq_current_profile_id()
  OR "recipientId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator()
  OR "senderId" = public.giq_current_profile_id()
  OR "recipientId" = public.giq_current_profile_id()
);

DROP POLICY IF EXISTS giq_conversation_update ON "Conversation";
CREATE POLICY giq_conversation_update ON "Conversation" FOR UPDATE USING (
  public.giq_is_moderator()
  OR "participantAId" = public.giq_current_profile_id()
  OR "participantBId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator()
  OR "participantAId" = public.giq_current_profile_id()
  OR "participantBId" = public.giq_current_profile_id()
);

-- Read-path side tables written by free recipients (markConversationRead):
-- delivery receipts, read receipts, reactions, participant read-state.

DROP POLICY IF EXISTS giq_message_delivery_write ON "MessageDeliveryReceipt";
CREATE POLICY giq_message_delivery_write ON "MessageDeliveryReceipt" FOR ALL USING (
  public.giq_is_moderator() OR "profileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator() OR "profileId" = public.giq_current_profile_id()
);

DROP POLICY IF EXISTS giq_message_read_write ON "MessageReadReceipt";
CREATE POLICY giq_message_read_write ON "MessageReadReceipt" FOR ALL USING (
  public.giq_is_moderator() OR "profileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator() OR "profileId" = public.giq_current_profile_id()
);

DROP POLICY IF EXISTS giq_message_reaction_write ON "MessageReaction";
CREATE POLICY giq_message_reaction_write ON "MessageReaction" FOR ALL USING (
  public.giq_is_moderator() OR "profileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator() OR "profileId" = public.giq_current_profile_id()
);

DROP POLICY IF EXISTS giq_conversation_participant_write ON "ConversationParticipant";
CREATE POLICY giq_conversation_participant_write ON "ConversationParticipant" FOR ALL USING (
  public.giq_is_moderator()
  OR ("profileId" = public.giq_current_profile_id()
    AND public.giq_is_conversation_participant("conversationId"))
) WITH CHECK (
  public.giq_is_moderator()
  OR ("profileId" = public.giq_current_profile_id()
    AND public.giq_is_conversation_participant("conversationId"))
);

-- Message attachments: scope to the message sender (tighter than the old
-- pro-only-but-any-message policy); recipients keep read via the select policy.
DROP POLICY IF EXISTS giq_message_media_write ON "MessageMedia";
CREATE POLICY giq_message_media_write ON "MessageMedia" FOR ALL USING (
  public.giq_is_moderator()
  OR EXISTS (
    SELECT 1 FROM "Message" m
    WHERE m.id = "messageId"
      AND public.giq_current_profile_id() IN (m."senderId", m."recipientId")
  )
) WITH CHECK (
  public.giq_is_moderator()
  OR EXISTS (
    SELECT 1 FROM "Message" m
    WHERE m.id = "messageId"
      AND m."senderId" = public.giq_current_profile_id()
  )
);
