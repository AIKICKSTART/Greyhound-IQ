-- A member may author a message only on a support ticket they own.
-- Moderators and the system context retain their existing support workflow access.
DROP POLICY IF EXISTS giq_support_message_insert ON "SupportMessage";

CREATE POLICY giq_support_message_insert ON "SupportMessage" FOR INSERT WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "userId" = public.giq_current_user_id()
    AND EXISTS (
      SELECT 1
      FROM "SupportTicket" t
      WHERE t.id = "ticketId"
        AND t."userId" = public.giq_current_user_id()
    )
  )
);
