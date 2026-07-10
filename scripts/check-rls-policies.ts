import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260706223000_add_rls_entitlement_policies",
  "migration.sql"
);

const sql = readFileSync(migrationPath, "utf8");
const findings: string[] = [];

const rlsTables = [
  "User",
  "Profile",
  "Dog",
  "Race",
  "Result",
  "Listing",
  "SavedListing",
  "ListingEnquiry",
  "Conversation",
  "Message",
  "Thread",
  "Post",
  "FeedPost",
  "FeedComment",
  "FeedReaction",
  "BillingCustomer",
  "Subscription",
  "WebhookEvent",
  "CallRoom",
  "CallParticipant",
  "CallInvite",
  "CallEvent",
  "CallReport",
  "CallPermission",
  "AuditLog",
  "RateLimit",
];

const requiredNeedles = [
  "CREATE OR REPLACE FUNCTION public.giq_current_user_id()",
  "CREATE OR REPLACE FUNCTION public.giq_current_profile_id()",
  "CREATE OR REPLACE FUNCTION public.giq_is_pro()",
  "CREATE OR REPLACE FUNCTION public.giq_require_pro_write()",
  "CREATE TRIGGER giq_profile_marketing_tier",
  "CREATE TRIGGER giq_listing_pro_write",
  "CREATE TRIGGER giq_listing_enquiry_pro_write",
  "CREATE TRIGGER giq_message_pro_write",
  "CREATE TRIGGER giq_thread_pro_write",
  "CREATE TRIGGER giq_call_room_pro_write",
  "CREATE POLICY giq_listing_insert",
  "CREATE POLICY giq_saved_listing_insert",
  "CREATE POLICY giq_listing_enquiry_insert",
  "CREATE POLICY giq_message_insert",
  "CREATE POLICY giq_thread_insert",
  "CREATE POLICY giq_call_room_insert",
  "CREATE POLICY giq_webhook_event_system",
];

const requiredPatterns: [RegExp, string][] = [
  [
    /CREATE TRIGGER giq_listing_pro_write\s+BEFORE INSERT OR UPDATE ON "Listing"/,
    "Listing trigger must guard insert and update",
  ],
  [
    /CREATE POLICY giq_listing_update ON "Listing" FOR UPDATE USING \(\s*public\.giq_is_moderator\(\) OR \(public\.giq_is_pro\(\) AND "profileId" = public\.giq_current_profile_id\(\)\)/,
    "Listing update must require Pro for owners",
  ],
  [
    /CREATE POLICY giq_thread_update ON "Thread" FOR UPDATE USING \(public\.giq_is_moderator\(\) OR \(public\.giq_is_pro\(\) AND "authorId" = public\.giq_current_profile_id\(\)\)/,
    "Thread update must require Pro for owners",
  ],
  [
    /CREATE POLICY giq_post_update ON "Post" FOR UPDATE USING \(public\.giq_is_moderator\(\) OR \(public\.giq_is_pro\(\) AND "authorId" = public\.giq_current_profile_id\(\)\)/,
    "Post update must require Pro for owners",
  ],
  [
    /CREATE POLICY giq_conversation_update ON "Conversation" FOR UPDATE USING \(\s*public\.giq_is_moderator\(\)\s*OR \(public\.giq_is_pro\(\) AND "participantAId" = public\.giq_current_profile_id\(\)\)/,
    "Conversation update must require Pro for participants",
  ],
  [
    /CREATE POLICY giq_message_update ON "Message" FOR UPDATE USING \(\s*public\.giq_is_moderator\(\)\s*OR \(public\.giq_is_pro\(\) AND "senderId" = public\.giq_current_profile_id\(\)\)/,
    "Message update must require Pro for participants",
  ],
  [
    /CREATE POLICY giq_billing_customer_write ON "BillingCustomer" FOR ALL USING \(public\.giq_is_system\(\) OR public\.giq_is_moderator\(\)\)/,
    "BillingCustomer writes must be system or moderator only",
  ],
  [
    /CREATE POLICY giq_subscription_write ON "Subscription" FOR ALL USING \(public\.giq_is_system\(\) OR public\.giq_is_moderator\(\)\)/,
    "Subscription writes must be system or moderator only",
  ],
  [
    /CREATE POLICY giq_entitlement_snapshot_write ON "EntitlementSnapshot" FOR ALL USING \(public\.giq_is_system\(\) OR public\.giq_is_moderator\(\)\)/,
    "EntitlementSnapshot writes must be system or moderator only",
  ],
];

const forbiddenPatterns: [RegExp, string][] = [
  [
    /CREATE POLICY giq_(billing_customer|subscription|entitlement_snapshot|invoice|payment|refund|credit_note|billing_event|usage_event|usage_outbox|usage_aggregate)_access ON "[^"]+" FOR ALL USING \("userId" = public\.giq_current_user_id\(\)/,
    "billing and entitlement tables must not allow user-owned FOR ALL writes",
  ],
];

for (const table of rlsTables) {
  must(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`, `${table} RLS enabled`);
}

for (const needle of requiredNeedles) {
  must(needle, needle);
}

for (const [pattern, label] of requiredPatterns) {
  mustMatch(pattern, label);
}

for (const [pattern, label] of forbiddenPatterns) {
  mustNotMatch(pattern, label);
}

if (!/\bNOBYPASSRLS\b/.test(sql)) {
  findings.push("runtime role must be documented/created as NOBYPASSRLS");
}

const forceMigrationSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260708170000_force_row_level_security",
    "migration.sql"
  ),
  "utf8"
);
if (!/FORCE ROW LEVEL SECURITY/.test(forceMigrationSql)) {
  findings.push("force-RLS migration must FORCE ROW LEVEL SECURITY");
}

// Static gate for the remaining-tables migration: every newly protected table
// must declare both ENABLE and FORCE ROW LEVEL SECURITY in that migration file.
const remainingRlsSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260708190000_add_rls_remaining_tables",
    "migration.sql"
  ),
  "utf8"
);
const remainingRlsTables = [
  "TermsAcceptance",
  "ConsentEvent",
  "MarketingPreference",
  "Organization",
  "Membership",
  "OrganizationInvitation",
  "SupportTicket",
  "SupportMessage",
  "Feedback",
  "BugReport",
  "RetentionPolicy",
  "DeletionJob",
  "ExportArtifact",
  "DogOwnership",
  "ListingReport",
  "ListingModerationAction",
  "ListingView",
  "TrustSafetyFlag",
  "BannedPhrase",
  "MessageModerationAction",
  "AgentRun",
  "AgentRunUsage",
  "MemoryEntry",
  "ConversationContext",
  "AdminAction",
  "JobRun",
  "DataSourceHealth",
  "Report",
];
for (const table of remainingRlsTables) {
  if (!remainingRlsSql.includes(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)) {
    findings.push(`${table} RLS enable missing in remaining-tables migration`);
  }
  if (!remainingRlsSql.includes(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`)) {
    findings.push(`${table} RLS force missing in remaining-tables migration`);
  }
}

// CustomPage (user-created public pages) must be RLS+FORCE with published-only
// public reads and owner/moderator/system writes.
const customPageSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260709100000_add_custom_pages",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  'ALTER TABLE "CustomPage" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "CustomPage" FORCE ROW LEVEL SECURITY',
  "CREATE POLICY giq_custom_page_select",
  "CREATE POLICY giq_custom_page_insert",
  "CREATE POLICY giq_custom_page_update",
  "CREATE POLICY giq_custom_page_delete",
]) {
  if (!customPageSql.includes(needle)) {
    findings.push(`CustomPage RLS missing: ${needle}`);
  }
}

// Personal feed posts, comments, reactions, and attachments are available to
// Free members. Publishing or attaching media as a CustomPage stays Pro-only
// and must be bound to the page owner in RLS.
const freeFeedWritesSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710133000_free_personal_feed_writes",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  'DROP TRIGGER IF EXISTS giq_feed_post_pro_write ON "FeedPost"',
  'DROP TRIGGER IF EXISTS giq_feed_comment_pro_write ON "FeedComment"',
  'DROP TRIGGER IF EXISTS giq_feed_reaction_pro_write ON "FeedReaction"',
  "FUNCTION public.giq_can_publish_feed_as(",
  "FUNCTION public.giq_feed_post_write_guard()",
  "FUNCTION public.giq_personal_feed_write_guard()",
  "CREATE TRIGGER giq_feed_post_pro_write",
  "CREATE TRIGGER giq_feed_comment_pro_write",
  "CREATE TRIGGER giq_feed_reaction_pro_write",
  "EXECUTE FUNCTION public.giq_feed_post_write_guard()",
  "EXECUTE FUNCTION public.giq_personal_feed_write_guard()",
  'DROP POLICY IF EXISTS giq_feed_post_insert ON "FeedPost"',
  'DROP POLICY IF EXISTS giq_feed_post_media_write ON "FeedPostMedia"',
  'DROP POLICY IF EXISTS giq_feed_comment_insert ON "FeedComment"',
  'DROP POLICY IF EXISTS giq_feed_reaction_insert ON "FeedReaction"',
  "CREATE POLICY giq_feed_post_insert",
  "CREATE POLICY giq_feed_post_update",
  "CREATE POLICY giq_feed_post_media_write",
  "CREATE POLICY giq_feed_comment_insert",
  "CREATE POLICY giq_feed_comment_update",
  "CREATE POLICY giq_feed_reaction_insert",
  "CREATE POLICY giq_feed_reaction_delete",
  'target_page_id IS NULL',
  'public.giq_is_pro()',
  'page."ownerProfileId" = public.giq_current_profile_id()',
  'page."moderationStatus" <> \'removed\'',
]) {
  if (!freeFeedWritesSql.includes(needle)) {
    findings.push(`free personal feed RLS missing: ${needle}`);
  }
}
for (const policyName of [
  "giq_feed_comment_insert",
  "giq_feed_comment_update",
  "giq_feed_reaction_insert",
  "giq_feed_reaction_delete",
]) {
  const policySql = freeFeedWritesSql.match(
    new RegExp(`CREATE POLICY ${policyName}[\\s\\S]*?;`)
  )?.[0];
  if (!policySql) continue;
  if (policySql.includes("giq_is_pro()")) {
    findings.push(`${policyName} must not require Pro`);
  }
}
if (freeFeedWritesSql.includes("EXECUTE FUNCTION public.giq_require_pro_write()")) {
  findings.push("free personal feed triggers must not execute the paid-write guard");
}

// CustomDesignRequest ($500 concierge) must be RLS+FORCE: buyer reads own,
// moderators/system manage.
const bespokeSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260709140000_add_custom_design_requests",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  'ALTER TABLE "CustomDesignRequest" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "CustomDesignRequest" FORCE ROW LEVEL SECURITY',
  "CREATE POLICY giq_custom_design_request_select",
  "CREATE POLICY giq_custom_design_request_write",
]) {
  if (!bespokeSql.includes(needle)) {
    findings.push(`CustomDesignRequest RLS missing: ${needle}`);
  }
}

// Member hub (2026-07-10): friend-request writes, free-reply messaging, and
// free call receivers. These SUPERSEDE some 20260706 policies asserted above
// (that file is history and stays byte-stable); the current semantics are:
// - Friendship: members insert pending requests, recipients accept, either
//   participant deletes.
// - Message/Conversation: every tier may start and reply within personal
//   Profile-to-Profile conversations.
// - Call invite/participant/event/permission: self-scoped access no longer
//   requires Pro (receivers), while CallRoom INSERT keeps giq_is_pro().
const friendshipWritesSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710120500_friendship_member_writes",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  'ADD COLUMN "requestedByProfileId"',
  'CONSTRAINT "Friendship_requestedBy_participant"',
  "CREATE POLICY giq_friendship_insert",
  "CREATE POLICY giq_friendship_accept",
  "CREATE POLICY giq_friendship_delete",
  `"requestedByProfileId" <> public.giq_current_profile_id()`,
]) {
  if (!friendshipWritesSql.includes(needle)) {
    findings.push(`Friendship member-writes RLS missing: ${needle}`);
  }
}

const freeReplySql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710121000_free_reply_messaging",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  "FUNCTION public.giq_message_write_guard()",
  "FUNCTION public.giq_conversation_write_guard()",
  "FUNCTION public.giq_is_conversation_participant(",
  'DROP POLICY IF EXISTS giq_message_insert ON "Message"',
  'public.giq_is_conversation_participant("conversationId")',
  '"senderId" = public.giq_current_profile_id()',
]) {
  if (!freeReplySql.includes(needle)) {
    findings.push(`free-reply messaging RLS missing: ${needle}`);
  }
}
// The reply INSERT arm must never be unconditional: sender-scoped AND
// participant-scoped, with pro as the only alternative.
if (
  !/CREATE POLICY giq_message_insert ON "Message" FOR INSERT WITH CHECK \(\s*"senderId" = public\.giq_current_profile_id\(\)\s*AND \(\s*public\.giq_is_pro\(\)\s*OR \(/.test(
    freeReplySql
  )
) {
  findings.push(
    "giq_message_insert must stay sender-scoped with pro-or-participant-reply"
  );
}

const freeConversationStartSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710133700_free_personal_conversation_start",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  "FUNCTION public.giq_conversation_write_guard()",
  "CREATE POLICY giq_conversation_insert",
  "public.giq_current_profile_id() IN",
  "FUNCTION public.giq_is_profile_in_conversation(",
  "CREATE POLICY giq_conversation_participant_write",
]) {
  if (!freeConversationStartSql.includes(needle)) {
    findings.push(`free personal conversation RLS missing: ${needle}`);
  }
}

const legacyFreeWriteTriggerFixSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710141000_drop_legacy_free_write_triggers",
    "migration.sql"
  ),
  "utf8"
);
for (const [trigger, table] of [
  ["giq_feed_post_pro_insert", "FeedPost"],
  ["giq_feed_comment_pro_insert", "FeedComment"],
  ["giq_feed_reaction_pro_insert", "FeedReaction"],
  ["giq_message_pro_insert", "Message"],
  ["giq_conversation_pro_insert", "Conversation"],
] as const) {
  const needle = `DROP TRIGGER IF EXISTS ${trigger} ON "${table}"`;
  if (!legacyFreeWriteTriggerFixSql.includes(needle)) {
    findings.push(`legacy free-write trigger fix missing: ${needle}`);
  }
}
for (const paidTrigger of [
  "giq_call_room_pro_insert",
  "giq_listing_pro_insert",
  "giq_listing_enquiry_pro_insert",
  "giq_thread_pro_insert",
  "giq_post_pro_insert",
]) {
  if (legacyFreeWriteTriggerFixSql.includes(`DROP TRIGGER IF EXISTS ${paidTrigger}`)) {
    findings.push(`legacy trigger fix must retain paid gate: ${paidTrigger}`);
  }
}

const actorFoundationSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710134000_add_social_actor_media_foundation",
    "migration.sql"
  ),
  "utf8"
);

const actorUpsertRlsFixSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710140000_fix_social_actor_upsert_rls",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  "ALTER POLICY giq_social_actor_select",
  "public.giq_is_system()",
  "public.giq_is_moderator()",
  '"ownerProfileId" = public.giq_current_profile_id()',
  "public.giq_actor_visible(id)",
]) {
  if (!actorUpsertRlsFixSql.includes(needle)) {
    findings.push(`SocialActor upsert RLS fix missing: ${needle}`);
  }
}

const feedPostReturningRlsFixSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710142000_fix_feed_post_returning_rls",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  "ALTER POLICY giq_feed_post_select",
  '"deletedAt" IS NULL',
  "public.giq_is_system()",
  "public.giq_is_moderator()",
  '"authorProfileId" = public.giq_current_profile_id()',
  "public.giq_feed_post_visible(id)",
]) {
  if (!feedPostReturningRlsFixSql.includes(needle)) {
    findings.push(`FeedPost RETURNING RLS fix missing: ${needle}`);
  }
}
for (const table of [
  "SocialActor",
  "ActorFollow",
  "ActorTopicFollow",
  "ActorMute",
  "ActorGalleryMedia",
  "SavedFeedPost",
  "FeedMention",
  "FeedShare",
]) {
  for (const action of ["ENABLE", "FORCE"]) {
    if (
      !actorFoundationSql.includes(
        `ALTER TABLE "${table}" ${action} ROW LEVEL SECURITY`
      )
    ) {
      findings.push(`${table} ${action.toLowerCase()} RLS missing in actor foundation`);
    }
  }
}
for (const needle of [
  'CONSTRAINT "SocialActor_identity_xor"',
  'CONSTRAINT "SocialActor_kind_identity"',
  "FUNCTION public.giq_social_actor_identity_valid(",
  "FUNCTION public.giq_actor_can_act(",
  "FUNCTION public.giq_media_owned_by_actor(",
  "CREATE TRIGGER giq_social_actor_identity_guard",
  "CREATE POLICY giq_social_actor_insert",
  "CREATE POLICY giq_social_actor_update",
  "CREATE POLICY giq_actor_gallery_write",
  "public.giq_media_owned_by_actor(\"actorId\", \"mediaId\")",
  "CREATE POLICY giq_feed_post_select",
  "CREATE POLICY giq_feed_reaction_update",
  'CONSTRAINT giq_feed_reaction_target_xor_check',
  'CONSTRAINT giq_feed_reaction_type_check',
  "FUNCTION public.giq_conversation_actor_can_start(",
  "FUNCTION public.giq_message_actor_pair_valid(",
  "CREATE TRIGGER giq_call_room_person_only",
  "REVOKE ALL ON FUNCTION public.giq_social_actor_identity_valid",
]) {
  if (!actorFoundationSql.includes(needle)) {
    findings.push(`actor/privacy RLS missing: ${needle}`);
  }
}
for (const [table, trigger] of [
  ["FeedPost", "giq_feed_post_pro_write"],
  ["Message", "giq_message_pro_write"],
  ["Conversation", "giq_conversation_pro_write"],
]) {
  for (const action of ["DISABLE", "ENABLE"]) {
    const statement = `ALTER TABLE "${table}" ${action} TRIGGER ${trigger};`;
    if (!actorFoundationSql.includes(statement)) {
      findings.push(`actor backfill trigger guard missing: ${statement}`);
    }
  }
}
for (const functionName of [
  "giq_social_actor_identity_valid",
  "giq_actor_can_act",
  "giq_media_owned_by_actor",
  "giq_conversation_actor_pair_valid",
  "giq_conversation_actor_can_start",
  "giq_message_actor_pair_valid",
  "giq_is_profile_in_conversation",
]) {
  const functionSql = actorFoundationSql.match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION public\\.${functionName}\\([\\s\\S]*?\\$\\$;`
    )
  )?.[0];
  if (
    !functionSql ||
    !functionSql.includes("SECURITY DEFINER") ||
    !functionSql.includes("SET search_path = ''")
  ) {
    findings.push(`${functionName} must be SECURITY DEFINER with an empty search_path`);
  }
}

const blockedCommentVisibilitySql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710135500_blocked_feed_comment_visibility",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  'DROP POLICY IF EXISTS giq_feed_comment_select ON "FeedComment"',
  "CREATE POLICY giq_feed_comment_select",
  'block."blockerProfileId" = public.giq_current_profile_id()',
  'block."blockedProfileId" = public.giq_current_profile_id()',
]) {
  if (!blockedCommentVisibilitySql.includes(needle)) {
    findings.push(`blocked-comment RLS missing: ${needle}`);
  }
}

const actorBlockContactSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710136000_harden_actor_block_and_contact_access",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  "FUNCTION public.giq_profiles_blocked(",
  "FUNCTION public.giq_actor_connected(",
  "FUNCTION public.giq_actor_visible(",
  "NOT public.giq_profiles_blocked(",
  "FUNCTION public.giq_is_conversation_participant(",
  'FROM public."Conversation" conversation',
  "SECURITY DEFINER",
  "SET search_path = ''",
  "CREATE VIEW public.giq_public_social_actor_profiles",
  "WITH (security_barrier = true)",
  'actor."contactVisibility" = \'public\'',
  'REVOKE SELECT ON public."CustomPage", public."Profile" FROM PUBLIC',
  "FOREACH direct_role IN ARRAY ARRAY['anon', 'authenticated']",
  "GRANT SELECT ON public.giq_public_social_actor_profiles",
]) {
  if (!actorBlockContactSql.includes(needle)) {
    findings.push(`actor block/contact RLS missing: ${needle}`);
  }
}

const privateRealtimeSql = readFileSync(
  join(
    process.cwd(),
    "scripts",
    "sql",
    "supabase-private-realtime-policies.sql"
  ),
  "utf8"
);
for (const needle of [
  "create table if not exists public.giq_realtime_topic_grants",
  "alter table public.giq_realtime_topic_grants enable row level security",
  "alter table public.giq_realtime_topic_grants force row level security",
  "create or replace function public.giq_replace_realtime_topic_grants(",
  "create or replace function public.giq_realtime_topic_allowed(",
  "security definer",
  "set search_path = ''",
  "grant execute on function public.giq_replace_realtime_topic_grants(text, jsonb, timestamptz)",
  "to service_role",
  "grant execute on function public.giq_realtime_topic_allowed(text, text)",
  "to authenticated",
  "alter table realtime.messages enable row level security",
  "create policy giq_private_topic_receive",
  "create policy giq_private_topic_receive_guard",
  "create policy giq_private_topic_send",
  "create policy giq_private_topic_send_guard",
  "as restrictive",
  "(select realtime.topic())",
  "g.profile_id = nullif(auth.jwt() ->> 'profile_id', '')",
  "where expires_at <= now() or profile_id = requested_profile_id",
  "pg_catalog.pg_advisory_xact_lock(",
  "notify pgrst, 'reload schema'",
]) {
  if (!privateRealtimeSql.includes(needle)) {
    findings.push(`private Realtime RLS missing: ${needle}`);
  }
}
if (/giq_realtime_topic_allowed\(text, text, text\)/i.test(privateRealtimeSql)) {
  findings.push("private Realtime authorization must not accept a caller-supplied profile id");
}

const realtimeService = readFileSync(
  join(process.cwd(), "src", "lib", "realtime-service.ts"),
  "utf8"
);
for (const needle of [
  'getSupabaseAdminClient().rpc(',
  '"giq_replace_realtime_topic_grants"',
  "requested_profile_id: current.profileId",
]) {
  if (!realtimeService.includes(needle)) {
    findings.push(`private Realtime engine sync missing: ${needle}`);
  }
}
if (realtimeService.includes("realtimeTopicGrant")) {
  findings.push("private Realtime grants must not be written to the Prisma application database");
}

const aggregateRefreshSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710139000_secure_aggregate_matview_refresh",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  "FUNCTION public.giq_refresh_aggregate_matview(",
  "SECURITY DEFINER",
  "SET search_path = ''",
  "requested_name IS NULL OR NOT requested_name = ANY",
  "REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I",
  "REVOKE ALL ON FUNCTION public.giq_refresh_aggregate_matview(text) FROM PUBLIC",
  "GRANT EXECUTE ON FUNCTION public.giq_refresh_aggregate_matview(text)",
]) {
  if (!aggregateRefreshSql.includes(needle)) {
    findings.push(`aggregate refresh authorization missing: ${needle}`);
  }
}

const liveSyncService = readFileSync(
  join(process.cwd(), "src", "lib", "live", "sync.ts"),
  "utf8"
);
if (!liveSyncService.includes("public.giq_refresh_aggregate_matview(${view})::text")) {
  findings.push("live sync must call the allowlisted aggregate refresh function");
}
if (liveSyncService.includes("REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}")) {
  findings.push("live sync must not refresh materialized views directly as the runtime role");
}
if (liveSyncService.includes("await refreshAggregateMaterializedViews();")) {
  findings.push("live result ingestion must not wait for aggregate refresh maintenance");
}

const freeCallReceiversSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260710121500_free_call_receivers",
    "migration.sql"
  ),
  "utf8"
);
for (const needle of [
  "CREATE POLICY giq_call_invite_access",
  "CREATE POLICY giq_call_participant_access",
  "CREATE POLICY giq_call_event_access",
  "CREATE POLICY giq_call_permission_access",
]) {
  if (!freeCallReceiversSql.includes(needle)) {
    findings.push(`free-call-receivers RLS missing: ${needle}`);
  }
}
// CallRoom creation must NOT be relaxed by this migration (comments may
// reference the policy name; only DDL against it is forbidden).
if (/(CREATE|DROP|ALTER) POLICY (IF EXISTS )?giq_call_room_insert/.test(freeCallReceiversSql)) {
  findings.push(
    "free-call-receivers migration must not touch giq_call_room_insert (initiation stays Pro)"
  );
}
// CallPermission writes stay paid/system — only reads were opened to receivers.
if (
  !/WITH CHECK \(\s*public\.giq_is_system\(\)\s*OR public\.giq_is_moderator\(\)\s*OR \(public\.giq_is_pro\(\) AND "profileId" = public\.giq_current_profile_id\(\)\)/.test(
    freeCallReceiversSql
  )
) {
  findings.push("CallPermission WITH CHECK must keep the pro gate on writes");
}

void main();

async function main() {
  await checkDatabaseState();

  if (findings.length > 0) {
    console.error("RLS policy gate failed:");
    for (const finding of findings) console.error(`- ${finding}`);
    process.exit(1);
  }

  console.log("RLS policy gate passed.");
}

// Live-database assertions: the runtime role must stay unable to bypass RLS,
// and every RLS-enabled table must have FORCE so table owners are bound too.
async function checkDatabaseState() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const roles = await prisma.$queryRaw<
      { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
    >`SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname IN ('greyhoundiq_app', 'greyhoundiq_runtime', 'greyhoundiq_migrator')`;
    if (roles.length === 0) {
      findings.push(
        "no greyhoundiq runtime roles found in database (expected greyhoundiq_app/greyhoundiq_runtime)"
      );
    }
    for (const role of roles) {
      if (role.rolsuper) findings.push(`${role.rolname} must not be SUPERUSER`);
      if (role.rolbypassrls) findings.push(`${role.rolname} must be NOBYPASSRLS`);
    }

    const writeProbeRole = roles.some((role) => role.rolname === "greyhoundiq_app")
      ? "greyhoundiq_app"
      : roles.some((role) => role.rolname === "greyhoundiq_runtime")
        ? "greyhoundiq_runtime"
        : null;
    if (writeProbeRole) {
      await checkSocialWriteReturningRls(prisma, writeProbeRole);
    }

    const directRoles = await prisma.$queryRaw<
      {
        rolname: string;
        custom_page_select: boolean;
        custom_page_email_select: boolean;
        profile_select: boolean;
        profile_phone_select: boolean;
        safe_actor_view_select: boolean;
      }[]
    >`SELECT
        rolname,
        has_table_privilege(rolname, 'public."CustomPage"', 'SELECT') AS custom_page_select,
        has_column_privilege(rolname, 'public."CustomPage"', 'contactEmail', 'SELECT') AS custom_page_email_select,
        has_table_privilege(rolname, 'public."Profile"', 'SELECT') AS profile_select,
        has_column_privilege(rolname, 'public."Profile"', 'phone', 'SELECT') AS profile_phone_select,
        has_table_privilege(rolname, 'public.giq_public_social_actor_profiles', 'SELECT') AS safe_actor_view_select
      FROM pg_roles
      WHERE rolname IN ('anon', 'authenticated')`;
    for (const role of directRoles) {
      if (role.custom_page_select || role.custom_page_email_select) {
        findings.push(`${role.rolname} must not read CustomPage base/contact columns`);
      }
      if (role.profile_select || role.profile_phone_select) {
        findings.push(`${role.rolname} must not read Profile base/contact columns`);
      }
      if (!role.safe_actor_view_select) {
        findings.push(`${role.rolname} must read only the safe actor profile view`);
      }
    }

    const definerOwners = await prisma.$queryRaw<
      {
        proname: string;
        owner_name: string;
        rolsuper: boolean;
        rolbypassrls: boolean;
      }[]
    >`SELECT
        procedure.proname,
        owner.rolname AS owner_name,
        owner.rolsuper,
        owner.rolbypassrls
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      JOIN pg_roles owner ON owner.oid = procedure.proowner
      WHERE namespace.nspname = 'public'
        AND procedure.proname IN (
          'giq_actor_connected',
          'giq_actor_visible',
          'giq_profiles_blocked',
          'giq_is_conversation_participant',
          'giq_realtime_topic_allowed'
        )`;
    for (const fn of definerOwners) {
      if (!fn.rolsuper && !fn.rolbypassrls) {
        findings.push(
          `${fn.proname} owner ${fn.owner_name} cannot safely read FORCE-RLS tables`,
        );
      }
    }

    const obsoleteFreeWriteTriggers = await prisma.$queryRaw<
      { table_name: string; trigger_name: string }[]
    >`SELECT relation.relname AS table_name, trigger.tgname AS trigger_name
      FROM pg_trigger trigger
      JOIN pg_class relation ON relation.oid = trigger.tgrelid
      WHERE NOT trigger.tgisinternal
        AND (relation.relname, trigger.tgname) IN (
          ('FeedPost', 'giq_feed_post_pro_insert'),
          ('FeedComment', 'giq_feed_comment_pro_insert'),
          ('FeedReaction', 'giq_feed_reaction_pro_insert'),
          ('Message', 'giq_message_pro_insert'),
          ('Conversation', 'giq_conversation_pro_insert')
        )
      ORDER BY relation.relname, trigger.tgname`;
    for (const trigger of obsoleteFreeWriteTriggers) {
      findings.push(
        `${trigger.table_name}.${trigger.trigger_name} obsolete paid-write trigger remains`,
      );
    }

    const unforced = await prisma.$queryRaw<{ relname: string }[]>`
      SELECT relname
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relkind = 'r'
        AND relrowsecurity
        AND NOT relforcerowsecurity
      ORDER BY relname`;
    for (const table of unforced) {
      findings.push(`"${table.relname}" has RLS enabled but not FORCE ROW LEVEL SECURITY`);
    }
  } catch (err) {
    findings.push(
      `database state check failed: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function checkSocialWriteReturningRls(
  prisma: PrismaClient,
  role: "greyhoundiq_app" | "greyhoundiq_runtime",
) {
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const rollbackMessage = "social-write-returning-rls-probe.rollback";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      await tx.$executeRaw`SELECT
        set_config('app.system', 'true', true),
        set_config('app.current_user_id', '', true),
        set_config('app.current_profile_id', '', true),
        set_config('app.current_actor_id', '', true),
        set_config('app.current_tier', 'system', true),
        set_config('app.current_role', 'system', true)`;

      const user = await tx.user.create({
        data: {
          email: `actor-rls-${marker}@example.invalid`,
          workosUserId: `actor-rls-${marker}`,
          subscriptionTier: "free",
        },
        select: { id: true },
      });
      const profile = await tx.profile.create({
        data: {
          userId: user.id,
          displayName: "Actor RLS probe",
          role: "member",
        },
        select: { id: true },
      });
      const actor = await tx.socialActor.upsert({
        where: { profileId: profile.id },
        create: {
          kind: "personal",
          profileId: profile.id,
          ownerProfileId: profile.id,
          handle: `actor-rls-${marker}`,
          displayName: "Actor RLS probe",
          profileVisibility: "members",
          contactVisibility: "only_me",
          published: true,
        },
        update: { displayName: "Actor RLS probe" },
        select: { id: true },
      });
      if (!actor.id) throw new Error("SocialActor upsert returned no actor");

      const updatedActor = await tx.socialActor.upsert({
        where: { profileId: profile.id },
        create: {
          kind: "personal",
          profileId: profile.id,
          ownerProfileId: profile.id,
          handle: `actor-rls-${marker}`,
          displayName: "Actor RLS probe updated",
          profileVisibility: "members",
          contactVisibility: "only_me",
          published: true,
        },
        update: { displayName: "Actor RLS probe updated" },
        select: { id: true, displayName: true },
      });
      if (
        updatedActor.id !== actor.id ||
        updatedActor.displayName !== "Actor RLS probe updated"
      ) {
        throw new Error("SocialActor conflict upsert was not stable");
      }

      await tx.$executeRaw`SELECT
        set_config('app.current_user_id', ${user.id}, true),
        set_config('app.current_profile_id', ${profile.id}, true),
        set_config('app.current_actor_id', '', true),
        set_config('app.current_tier', 'free', true),
        set_config('app.current_role', 'member', true),
        set_config('app.system', 'false', true)`;

      const feedPost = await tx.feedPost.create({
        data: {
          authorProfileId: profile.id,
          authorActorId: actor.id,
          body: "FeedPost RETURNING RLS probe",
          visibility: "connections",
          status: "active",
          publishedAt: new Date(),
        },
        select: { id: true },
      });
      if (!feedPost.id) throw new Error("FeedPost create returned no post");

      throw new Error(rollbackMessage);
    });
    findings.push("Social write RETURNING RLS probe committed unexpectedly");
  } catch (err) {
    if (!(err instanceof Error) || err.message !== rollbackMessage) {
      const code =
        err && typeof err === "object" && "code" in err
          ? ` (${String(err.code)})`
          : "";
      findings.push(
        `SocialActor/FeedPost RETURNING fails under ${role} context${code}`,
      );
    }
  }
}

function must(needle: string, label: string) {
  if (!sql.includes(needle)) findings.push(label);
}

function mustMatch(pattern: RegExp, label: string) {
  if (!pattern.test(sql)) findings.push(label);
}

function mustNotMatch(pattern: RegExp, label: string) {
  if (pattern.test(sql)) findings.push(label);
}
