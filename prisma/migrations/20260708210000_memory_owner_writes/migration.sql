-- MemoryEntry is a user-owned feature (self-serve create/edit/supersede via
-- /api/memory). 20260708190000 scoped writes to system/moderator only, which
-- would deny owners; align the policy with SupportTicket's owner-write shape.
DROP POLICY IF EXISTS giq_memory_entry_write ON "MemoryEntry";
CREATE POLICY giq_memory_entry_write ON "MemoryEntry" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
