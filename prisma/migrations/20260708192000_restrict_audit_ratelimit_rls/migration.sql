-- Restrict AuditLog and RateLimit RLS policies.
--
-- Prior state (20260706223000_add_rls_entitlement_policies):
--   AuditLog INSERT: WITH CHECK (true)   -- any request context could forge audit rows
--   RateLimit ALL:   USING (true) WITH CHECK (true)  -- any context could read/write limits
--
-- Both are now scoped to the real server-side write paths, no looser.

-- AuditLog INSERT.
-- Real write sites (verified in src/):
--   account-service.createAuditLog          -> withDbSystemContext            (system)
--   account-service.runAccountDeletionMaintenance finalize -> withDbSystemContext (system)
--   auth-sync.syncAuthUser restore          -> withDbSystemContext            (system)
--   admin-service.logAdminMutation          -> admin request context         (moderator)
--   account-service.requestAccountDeletion  -> withDbRequestContext, actorId = current user
-- The last path writes an actor-owned audit row under the user's own request
-- context (not system, not moderator), so the policy must also permit a row the
-- acting user owns. Anything stricter would break self-service deletion logging.
DROP POLICY IF EXISTS giq_audit_log_insert ON "AuditLog";
CREATE POLICY giq_audit_log_insert ON "AuditLog"
FOR INSERT WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "actorId" = public.giq_current_user_id()
);

-- RateLimit.
-- The limiter is a server-side control only; there is no legitimate user-context
-- read or write path. Scope every operation to system context.
--
-- INTEGRATOR NOTE (code gap): src/lib/rate-limit.ts::checkRateLimit currently
-- runs its INSERT ... ON CONFLICT via the bare `prisma` client with NO context,
-- so public.giq_is_system() is FALSE for those queries. Under this policy the
-- upsert will be denied, and because checkRateLimit fails OPEN on DB error the
-- limiter would silently degrade to a no-op. Before/with applying this migration,
-- wrap checkRateLimit's DB access in withDbSystemContext (or otherwise set
-- app.system = 'true' on its connection). Do not ship this migration without
-- that code change.
DROP POLICY IF EXISTS giq_rate_limit_all ON "RateLimit";
CREATE POLICY giq_rate_limit_all ON "RateLimit"
FOR ALL USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
