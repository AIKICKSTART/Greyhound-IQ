import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  "CREATE TRIGGER giq_feed_post_pro_write",
  "CREATE TRIGGER giq_thread_pro_write",
  "CREATE TRIGGER giq_call_room_pro_write",
  "CREATE POLICY giq_listing_insert",
  "CREATE POLICY giq_saved_listing_insert",
  "CREATE POLICY giq_listing_enquiry_insert",
  "CREATE POLICY giq_message_insert",
  "CREATE POLICY giq_feed_post_insert",
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
    /CREATE POLICY giq_feed_reaction_delete ON "FeedReaction" FOR DELETE USING \(public\.giq_is_moderator\(\) OR \(public\.giq_is_pro\(\) AND "profileId" = public\.giq_current_profile_id\(\)\)\);/,
    "Feed reaction delete must require Pro for owners",
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

function must(needle: string, label: string) {
  if (!sql.includes(needle)) findings.push(label);
}

function mustMatch(pattern: RegExp, label: string) {
  if (!pattern.test(sql)) findings.push(label);
}

function mustNotMatch(pattern: RegExp, label: string) {
  if (pattern.test(sql)) findings.push(label);
}
