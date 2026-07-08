-- Extend RLS to every remaining public table that lacked it.
-- Mirrors the idiom from 20260706223000_add_rls_entitlement_policies:
--   helper functions public.giq_is_system() / giq_is_moderator() /
--   giq_current_user_id() / giq_current_profile_id(), policy naming
--   giq_<table>_<action>. Every table gets ENABLE + FORCE ROW LEVEL SECURITY
--   (the 20260708170000 migration forced pre-existing tables dynamically;
--   new tables must declare both explicitly). Forward-only.

-- === Consent / preferences (user-owned; system writes) ===

ALTER TABLE "TermsAcceptance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TermsAcceptance" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_terms_acceptance_select ON "TermsAcceptance" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_terms_acceptance_write ON "TermsAcceptance" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "ConsentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_consent_event_select ON "ConsentEvent" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_consent_event_write ON "ConsentEvent" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "MarketingPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketingPreference" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_marketing_preference_select ON "MarketingPreference" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_marketing_preference_write ON "MarketingPreference" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);

-- === Organizations (owner/member scoped; system + moderator manage) ===
-- SECURITY DEFINER helpers break the Organization<->Membership policy cycle
-- (same pattern as 20260708130000_fix_call_rls_recursion).

CREATE OR REPLACE FUNCTION public.giq_org_current_user_is_member(org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM "Membership" m
    WHERE m."organizationId" = $1
      AND m."userId" = public.giq_current_user_id()
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.giq_org_current_user_is_owner(org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM "Organization" o
    WHERE o.id = $1
      AND o."ownerId" = public.giq_current_user_id()
  ), false);
$$;

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_organization_select ON "Organization" FOR SELECT USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "ownerId" = public.giq_current_user_id()
  OR public.giq_org_current_user_is_member(id)
);
CREATE POLICY giq_organization_write ON "Organization" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_membership_select ON "Membership" FOR SELECT USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "userId" = public.giq_current_user_id()
  OR public.giq_org_current_user_is_owner("organizationId")
);
CREATE POLICY giq_membership_write ON "Membership" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "OrganizationInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationInvitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_organization_invitation_select ON "OrganizationInvitation" FOR SELECT USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "invitedByUserId" = public.giq_current_user_id()
  OR public.giq_org_current_user_is_owner("organizationId")
);
CREATE POLICY giq_organization_invitation_write ON "OrganizationInvitation" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

-- === Support / feedback (user-owned reads; author may insert) ===

ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTicket" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_support_ticket_select ON "SupportTicket" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_support_ticket_insert ON "SupportTicket" FOR INSERT WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_support_ticket_update ON "SupportTicket" FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "SupportMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportMessage" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_support_message_select ON "SupportMessage" FOR SELECT USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "userId" = public.giq_current_user_id()
  OR EXISTS (
    SELECT 1 FROM "SupportTicket" t
    WHERE t.id = "ticketId" AND t."userId" = public.giq_current_user_id()
  )
);
CREATE POLICY giq_support_message_insert ON "SupportMessage" FOR INSERT WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_support_message_update ON "SupportMessage" FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Feedback" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_feedback_select ON "Feedback" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_feedback_insert ON "Feedback" FOR INSERT WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_feedback_update ON "Feedback" FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "BugReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BugReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_bug_report_select ON "BugReport" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_bug_report_insert ON "BugReport" FOR INSERT WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_bug_report_update ON "BugReport" FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

-- === Retention / deletion / export (system + moderator operational) ===

ALTER TABLE "RetentionPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetentionPolicy" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_retention_policy_read ON "RetentionPolicy" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator()
);
CREATE POLICY giq_retention_policy_write ON "RetentionPolicy" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "DeletionJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeletionJob" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_deletion_job_read ON "DeletionJob" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "targetUserId" = public.giq_current_user_id()
);
CREATE POLICY giq_deletion_job_write ON "DeletionJob" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "ExportArtifact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExportArtifact" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_export_artifact_read ON "ExportArtifact" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "targetUserId" = public.giq_current_user_id()
);
CREATE POLICY giq_export_artifact_write ON "ExportArtifact" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

-- === Dog ownership (profile-owned claim; system/moderator verify) ===

ALTER TABLE "DogOwnership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DogOwnership" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_dog_ownership_select ON "DogOwnership" FOR SELECT USING (true);
CREATE POLICY giq_dog_ownership_write ON "DogOwnership" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

-- === Listing trust & safety (reporter reads own; moderator manages) ===

ALTER TABLE "ListingReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_listing_report_select ON "ListingReport" FOR SELECT USING (
  public.giq_is_moderator() OR "reporterProfileId" = public.giq_current_profile_id()
);
CREATE POLICY giq_listing_report_insert ON "ListingReport" FOR INSERT WITH CHECK (
  public.giq_is_moderator() OR "reporterProfileId" = public.giq_current_profile_id()
);
CREATE POLICY giq_listing_report_update ON "ListingReport" FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "ListingModerationAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingModerationAction" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_listing_moderation_action_select ON "ListingModerationAction" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator()
);
CREATE POLICY giq_listing_moderation_action_write ON "ListingModerationAction" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "ListingView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingView" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_listing_view_select ON "ListingView" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator()
);
CREATE POLICY giq_listing_view_write ON "ListingView" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "TrustSafetyFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrustSafetyFlag" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_trust_safety_flag_select ON "TrustSafetyFlag" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator()
);
CREATE POLICY giq_trust_safety_flag_write ON "TrustSafetyFlag" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "BannedPhrase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BannedPhrase" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_banned_phrase_select ON "BannedPhrase" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator()
);
CREATE POLICY giq_banned_phrase_write ON "BannedPhrase" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "MessageModerationAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageModerationAction" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_message_moderation_action_select ON "MessageModerationAction" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator()
);
CREATE POLICY giq_message_moderation_action_write ON "MessageModerationAction" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

-- === Agent runs & memory (user-owned reads; system writes) ===

ALTER TABLE "AgentRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_agent_run_select ON "AgentRun" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_agent_run_write ON "AgentRun" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "AgentRunUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentRunUsage" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_agent_run_usage_select ON "AgentRunUsage" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_agent_run_usage_write ON "AgentRunUsage" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "MemoryEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemoryEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_memory_entry_select ON "MemoryEntry" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_memory_entry_write ON "MemoryEntry" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "ConversationContext" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationContext" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_conversation_context_select ON "ConversationContext" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "userId" = public.giq_current_user_id()
);
CREATE POLICY giq_conversation_context_write ON "ConversationContext" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

-- === Admin & operational logs (system + moderator; actors read own) ===

ALTER TABLE "AdminAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAction" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_admin_action_select ON "AdminAction" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "adminId" = public.giq_current_user_id()
);
CREATE POLICY giq_admin_action_write ON "AdminAction" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "JobRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_job_run_select ON "JobRun" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator()
);
CREATE POLICY giq_job_run_write ON "JobRun" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "DataSourceHealth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataSourceHealth" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_data_source_health_select ON "DataSourceHealth" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator()
);
CREATE POLICY giq_data_source_health_write ON "DataSourceHealth" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_report_select ON "Report" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator() OR "reporterId" = public.giq_current_user_id()
);
CREATE POLICY giq_report_insert ON "Report" FOR INSERT WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR "reporterId" = public.giq_current_user_id()
);
CREATE POLICY giq_report_update ON "Report" FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

-- === Runtime grants ===
-- The runtime role already holds table-level DML from the earlier
-- 'GRANT ... ON ALL TABLES IN SCHEMA public' plus ALTER DEFAULT PRIVILEGES,
-- so these pre-existing tables are already covered. Re-run the conditional
-- grant defensively in case privileges drifted; it is idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO greyhoundiq_runtime;
  END IF;
END;
$$;
