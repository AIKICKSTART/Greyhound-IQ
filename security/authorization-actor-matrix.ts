export const AUTHORIZATION_ACTOR_STATUSES = [
  "partially-verified",
  "not-verified",
  "control-missing",
] as const;

type AuthorizationActorStatus = (typeof AUTHORIZATION_ACTOR_STATUSES)[number];

type AuthorizationActorSeed = readonly [
  slug: string,
  actor: string,
  authenticationState: string,
  serverAuthority: string,
  permittedScope: string,
  deniedScope: string,
  status: AuthorizationActorStatus,
  requiredValidation: string,
];

const ACTOR_SEEDS = [
  ["signed-out", "Signed-out visitor", "No valid server session", "Public route and object visibility policy", "Marketing, legal and explicitly public racing, profile and listing projections", "Member, private, ownership, billing, staff and mutation surfaces", "partially-verified", "Direct signed-out tests for every protected page, API and server action."],
  ["member", "Ordinary member", "Valid WorkOS session and active local profile", "requireCurrentUserProfile plus object and relationship policies", "Own account and permitted member/community objects", "Other-user private data, staff functions and unentitled features", "partially-verified", "Complete endpoint-wide object/property and suspended/deleted-session tests."],
  ["racing", "Racing member", "Active member session; racing is a product persona rather than an independent role", "Member identity plus record visibility and subscription entitlement", "Public and entitled racing discovery, cards and analysis", "Restricted provider fields, unpublished records and unentitled analysis", "not-verified", "Cross-tier, unpublished-record and provider-field response tests."],
  ["buyer", "Marketplace buyer", "Active member session; buyer capability is inferred from action context", "Member identity plus listing visibility and enquiry ownership", "Public listings, own saves and own enquiries", "Seller-only listing mutation and another buyer's saved/enquiry data", "partially-verified", "Direct buyer/seller/other-buyer matrix for every listing operation."],
  ["seller", "Marketplace seller", "Active member session with listing ownership", "Server-resolved listing seller/owner and listing state", "Own draft, media, publication and enquiry-management operations", "Another seller's listing and invalid state transitions", "partially-verified", "Cross-seller and full lifecycle transition tests."],
  ["owner", "Greyhound owner", "Active member session with verified ownership relationship where required", "Server-resolved dog ownership or claim state", "Own dog profile/claim operations allowed by verification state", "Another owner's dog mutations and forged verification state", "not-verified", "Ownership-claim, verified-owner and cross-owner direct tests."],
  ["breeder", "Breeder", "Active member product persona; no independent server role identified", "Member identity plus owned/linked dog and feature entitlement", "Breeding tools explicitly available to the actor's records", "Unowned dog data mutations and staff verification decisions", "not-verified", "Define breeder relationship model and test owned versus unowned records."],
  ["trainer", "Trainer", "Active member product persona; no independent server role identified", "Member identity plus server-resolved trainer/dog relationship", "Trainer workflows for linked dogs where implemented", "Unlinked dog mutations and privileged racing corrections", "not-verified", "Define trainer relationship source and cross-trainer negative tests."],
  ["community", "Community participant", "Active member with object visibility and relationship state", "Member identity plus privacy, block, ownership and moderation policies", "Permitted posts, comments, reactions, follows and reports", "Private/blocked/deleted content and another actor's mutations", "partially-verified", "Cross-object, block/privacy and moderator-boundary matrix."],
  ["group-member", "Group member", "Active member plus current group membership", "Server-resolved membership state", "Member-visible group content and permitted member actions", "Private groups without membership and moderator-only actions", "control-missing", "Complete group membership state model and direct non-member tests."],
  ["group-moderator", "Group moderator", "Active member plus scoped group moderator assignment", "Server-resolved group and moderator relationship", "Moderation actions only inside the assigned group", "Other groups and platform administrator functions", "control-missing", "Implement scoped policy then test cross-group and admin escalation."],
  ["page-member", "Page member", "Active member plus current page membership", "Server-resolved page membership", "Member-visible page content and explicitly granted actions", "Page management and other-page private data", "not-verified", "Define page permission projection and cross-page negative tests."],
  ["page-manager", "Page manager", "Active member plus server-resolved page management grant", "Page role and permission policy", "Scoped page management operations", "Other pages, tenant-wide roles and platform administration", "not-verified", "Test permission-by-projection and cross-page manager denial."],
  ["team-member", "Team member", "Active member plus current organisation/team membership", "Server-resolved organisation and team membership", "Team resources granted to ordinary members", "Owner-only membership, billing and destructive operations", "not-verified", "Same-ID cross-tenant and member-versus-owner tests."],
  ["team-owner", "Team owner", "Active member plus current owner relationship", "Server-resolved team ownership and last-owner policy", "Owner-scoped invitations, membership and team settings", "Other teams and removal of the final owner", "not-verified", "Concurrent last-owner, invitation theft and cross-team tests."],
  ["support", "Support operator", "Authenticated staff identity; independent support role is not fully represented in the local role model", "Explicit support scope or administrator policy", "Assigned support records with minimum projections", "Broad user impersonation, billing mutation and unrelated tenant data", "control-missing", "Define support identity/scope and purpose-bound access tests."],
  ["moderator", "Moderator", "Active local profile with moderator or administrator role", "requireModeratorProfile plus route-specific least-privilege policy", "Reports and explicitly approved read-only moderation queues", "Administrator-only data, billing, access, jobs and privileged mutations", "partially-verified", "Runtime moderator-negative route/API/mutation tests."],
  ["administrator", "Administrator", "Active local profile with exact administrator role", "requireAdminProfile plus object/property/state policy", "Explicitly registered platform administration operations", "Unbounded access, unsafe self/last-admin mutation and unaudited destructive actions", "partially-verified", "Complete action policy, step-up, audit-integrity and runtime negative tests."],
  ["billing", "Billing operator", "Authenticated staff identity; no dedicated billing role is evidenced", "Explicit billing permission and provider-customer ownership policy", "Approved billing support and reconciliation operations", "Arbitrary entitlement/payment mutation and cross-customer invoices", "control-missing", "Define billing role, dual control and provider-authoritative mutation tests."],
  ["ai", "AI-feature user", "Active member with current server-derived entitlement and budget", "Member identity, entitlement snapshot, quota and ordinary tool authorization", "Bounded AI runs and tools allowed to the same actor directly", "Unentitled runs, cross-user context and protected mutations", "partially-verified", "Atomic quota, cross-user retrieval and strict tool-policy tests."],
  ["design-lab", "Design Lab reviewer", "Local allowed or exact production flag plus administrator; isolated synthetic demo mode is read-only", "evaluateDesignLabAccess and requireDesignLabReviewer", "Synthetic preview, fixture and role/tier simulation", "Production data, real-user impersonation and production mutations", "partially-verified", "Built-deployment selector and no-production-data/mutation tests."],
  ["suspended", "Suspended user", "Session may exist but local account state is suspended or banned", "requireCurrentUserProfile denial based on authoritative local state", "Only safe recovery/sign-out paths explicitly allowed", "Protected reads, writes, Realtime grants and new provider operations", "partially-verified", "Existing-session and direct endpoint tests after suspension."],
  ["blocked", "Blocked user relationship", "Active member session with a server-resolved block relationship", "Object-specific bidirectional block policy", "Own unrelated records and permitted recovery actions", "Target messages, presence, private content and blocked mutations", "partially-verified", "Every alternate HTTP, Realtime, notification, cache and share path after block."],
  ["deleted", "Deleted user", "Deleted/finalized local account or pending deletion state", "Account state, tombstone and session-revocation policy", "Only documented grace-period recovery when eligible", "Normal authentication, protected data and reactivation through stale sessions", "not-verified", "Provider/session revocation, post-finalization access and restore non-reactivation tests."],
] as const satisfies readonly AuthorizationActorSeed[];

const AUTHORIZATION_ACTOR_EVIDENCE = [
  "docs/security/authorization-matrix.md",
  "docs/security/security-architecture.md",
  "docs/security/threat-model.md",
  "docs/product/permissions-matrix.md",
] as const;

export const AUTHORIZATION_ACTOR_RECORDS = ACTOR_SEEDS.map(
  ([slug, actor, authenticationState, serverAuthority, permittedScope, deniedScope, status, requiredValidation]) => ({
    requirementId: `security.authorization-actor.${slug}`,
    actor,
    authenticationState,
    serverAuthority,
    permittedScope,
    deniedScope,
    status,
    requiredValidation,
    owner: "GreyhoundIQ application security and product leads",
    evidence: AUTHORIZATION_ACTOR_EVIDENCE,
  }),
);

export function validateAuthorizationActorMatrix() {
  const failures: string[] = [];
  const ids = new Set<string>();
  for (const record of AUTHORIZATION_ACTOR_RECORDS) {
    if (ids.has(record.requirementId)) failures.push(`${record.requirementId}:duplicate`);
    ids.add(record.requirementId);
    for (const field of [
      "actor",
      "authenticationState",
      "serverAuthority",
      "permittedScope",
      "deniedScope",
      "requiredValidation",
      "owner",
    ] as const) {
      if (!record[field].trim()) failures.push(`${record.requirementId}:${field}`);
    }
  }
  return failures;
}
