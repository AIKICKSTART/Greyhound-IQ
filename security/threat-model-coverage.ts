export const THREAT_MODEL_CONTROL_STATUSES = [
  "partially-verified",
  "not-verified",
  "control-missing",
  "blocked-from-release",
] as const;

export type ThreatModelControlStatus =
  (typeof THREAT_MODEL_CONTROL_STATUSES)[number];

type ThreatModelAreaRecord = {
  area: string;
  threatModelRequirementId: string;
  abuseCaseRequirementId: string;
  assets: readonly string[];
  entryPoints: readonly string[];
  trustBoundary: string;
  abuseCases: readonly string[];
  currentControlStatus: ThreatModelControlStatus;
  evidence: readonly string[];
  releaseDecision: string;
};

const THREAT_MODEL_EVIDENCE = [
  "docs/security/threat-model.md",
  "docs/security/abuse-case-map.md",
  "docs/security/risk-register.md",
] as const;

export const THREAT_MODEL_AREA_RECORDS: readonly ThreatModelAreaRecord[] = [
  {
    area: "public website",
    threatModelRequirementId:
      "security.threat-model-governance.public-website-threat-model",
    abuseCaseRequirementId:
      "security.threat-model-governance.public-website-abuse-cases",
    assets: ["public content", "contact submissions", "authentication return state"],
    entryPoints: ["public pages", "contact forms", "authentication callbacks"],
    trustBoundary: "Untrusted internet traffic crosses the edge into public and authentication handlers.",
    abuseCases: ["submission spam and injection", "redirect manipulation", "scraping and cache poisoning"],
    currentControlStatus: "not-verified",
    evidence: THREAT_MODEL_EVIDENCE,
    releaseDecision: "Keep route-wide malformed-input, cache and anti-abuse validation release-blocking.",
  },
  {
    area: "racing intelligence",
    threatModelRequirementId:
      "security.threat-model-governance.racing-intelligence-threat-model",
    abuseCaseRequirementId:
      "security.threat-model-governance.racing-intelligence-abuse-cases",
    assets: ["provider credentials", "race records", "provenance", "replay media"],
    entryPoints: ["provider ingestion", "race search", "statistics queries", "replay URLs"],
    trustBoundary: "External provider data crosses ingestion and media boundaries before becoming public racing data.",
    abuseCases: ["malformed or conflicting feed records", "expensive query abuse", "restricted-record enumeration"],
    currentControlStatus: "partially-verified",
    evidence: THREAT_MODEL_EVIDENCE,
    releaseDecision: "Provider identity, parser, query-budget and SSRF evidence remains required.",
  },
  {
    area: "community and Feed",
    threatModelRequirementId:
      "security.threat-model-governance.community-and-feed-threat-model",
    abuseCaseRequirementId:
      "security.threat-model-governance.community-and-feed-abuse-cases",
    assets: ["posts", "comments", "profiles", "relationships", "moderation records"],
    entryPoints: ["post and comment mutations", "social graph actions", "search", "reports"],
    trustBoundary: "User content and relationship state cross from untrusted clients into shared community views.",
    abuseCases: ["stored XSS and spam", "privacy or block bypass", "ownership and moderator bypass"],
    currentControlStatus: "partially-verified",
    evidence: THREAT_MODEL_EVIDENCE,
    releaseDecision: "Cross-object, stored-render and moderator-negative tests remain release evidence.",
  },
  {
    area: "messaging and Pulse",
    threatModelRequirementId:
      "security.threat-model-governance.messaging-and-pulse-threat-model",
    abuseCaseRequirementId:
      "security.threat-model-governance.messaging-and-pulse-abuse-cases",
    assets: ["messages", "attachments", "presence", "call tokens", "room membership"],
    entryPoints: ["message API", "Realtime topics", "call invitations", "provider webhooks"],
    trustBoundary: "Participant identity and relationship state cross HTTP, Realtime and media-provider boundaries.",
    abuseCases: ["conversation enumeration", "stale grant or block bypass", "call spam and token theft"],
    currentControlStatus: "blocked-from-release",
    evidence: THREAT_MODEL_EVIDENCE,
    releaseDecision: "Relationship-scoped presence and cross-user Realtime tests remain release-blocking.",
  },
  {
    area: "Marketplace",
    threatModelRequirementId:
      "security.threat-model-governance.marketplace-threat-model",
    abuseCaseRequirementId:
      "security.threat-model-governance.marketplace-abuse-cases",
    assets: ["listings", "seller identity", "enquiries", "media", "listing status"],
    entryPoints: ["listing mutations", "publication", "enquiries", "search", "media upload"],
    trustBoundary: "Buyer and seller input crosses listing ownership, moderation, search and media boundaries.",
    abuseCases: ["ownership or publication bypass", "enquiry spam and scraping", "malicious media and status forgery"],
    currentControlStatus: "partially-verified",
    evidence: THREAT_MODEL_EVIDENCE,
    releaseDecision: "Seller-negative, transition, quota and live media-pipeline tests remain required.",
  },
  {
    area: "account",
    threatModelRequirementId:
      "security.threat-model-governance.account-threat-model",
    abuseCaseRequirementId:
      "security.threat-model-governance.account-abuse-cases",
    assets: ["profile", "sessions", "privacy settings", "teams", "billing and export data"],
    entryPoints: ["account mutations", "invitations", "billing returns", "exports", "deletion"],
    trustBoundary: "Authenticated requests cross ownership, tenant, identity-provider and billing-provider boundaries.",
    abuseCases: ["account takeover or stale sessions", "role and invitation theft", "invoice, export or support BOLA"],
    currentControlStatus: "blocked-from-release",
    evidence: THREAT_MODEL_EVIDENCE,
    releaseDecision: "Step-up, cross-user, last-owner and provider lifecycle evidence remains release-blocking.",
  },
  {
    area: "administration",
    threatModelRequirementId:
      "security.threat-model-governance.administration-threat-model",
    abuseCaseRequirementId:
      "security.threat-model-governance.administration-abuse-cases",
    assets: ["privileged data", "user status", "audit records", "jobs", "provider operations"],
    entryPoints: ["admin pages", "moderation queues", "bulk actions", "job and webhook reprocessing"],
    trustBoundary: "Staff sessions cross moderator, administrator, support and service-identity privilege boundaries.",
    abuseCases: ["moderator escalation", "unsafe bulk or repeat mutations", "audit tampering and diagnostic leakage"],
    currentControlStatus: "blocked-from-release",
    evidence: THREAT_MODEL_EVIDENCE,
    releaseDecision: "Runtime negative tests, append-only audit integrity and route-specific workload identities remain blockers.",
  },
  {
    area: "AI tools",
    threatModelRequirementId:
      "security.threat-model-governance.ai-tools-threat-model",
    abuseCaseRequirementId:
      "security.threat-model-governance.ai-tools-abuse-cases",
    assets: ["prompts", "retrieved context", "tool permissions", "provider budget", "secrets"],
    entryPoints: ["agent runs", "retrieval", "tool calls", "rendered model output"],
    trustBoundary: "Untrusted prompts and retrieved content cross model-provider and privileged-tool boundaries.",
    abuseCases: ["prompt injection and tool misuse", "cross-user data leakage", "cost and runtime exhaustion"],
    currentControlStatus: "blocked-from-release",
    evidence: THREAT_MODEL_EVIDENCE,
    releaseDecision: "Tool allowlists, ordinary authorization, isolation and atomic budget enforcement remain blockers.",
  },
  {
    area: "Design Lab",
    threatModelRequirementId:
      "security.threat-model-governance.design-lab-threat-model",
    abuseCaseRequirementId:
      "security.threat-model-governance.design-lab-abuse-cases",
    assets: ["synthetic fixtures", "role simulations", "production configuration", "release evidence"],
    entryPoints: ["Design Lab routes", "selector query parameters", "preview links", "release workflow"],
    trustBoundary: "Synthetic preview controls must remain isolated from production identities, data and mutations.",
    abuseCases: ["public indexing or sharing", "selector-driven privilege change", "production data or mutation access"],
    currentControlStatus: "partially-verified",
    evidence: THREAT_MODEL_EVIDENCE,
    releaseDecision: "Built-deployment isolation and selector-permutation tests remain required.",
  },
];

type ThreatCoverageSeed = readonly [
  slug: string,
  threat: string,
  status: ThreatModelControlStatus,
  abusePath: string,
  requiredValidation: string,
];

function threatRecords(
  section:
    | "threat-public"
    | "threat-racing"
    | "threat-community"
    | "threat-messaging"
    | "threat-marketplace"
    | "threat-account"
    | "threat-administration"
    | "threat-ai"
    | "threat-design-lab",
  area: string,
  seeds: readonly ThreatCoverageSeed[],
) {
  return seeds.map(([slug, threat, status, abusePath, requiredValidation]) => ({
    requirementId: `security.${section}.${slug}`,
    area,
    threat,
    abusePath,
    affectedAssets: THREAT_MODEL_AREA_RECORDS.find((record) => record.area === area)!
      .assets,
    currentControlStatus: status,
    requiredValidation,
    residualRisk: `The ${threat.toLowerCase()} path remains ${status.replaceAll("-", " ")} until the required validation passes.`,
    owner: "GreyhoundIQ security lead",
    evidence: THREAT_MODEL_EVIDENCE,
  }));
}

const PUBLIC_THREATS = [
  ["contact-form-spam", "Contact-form spam", "not-verified", "Automated clients flood public contact or support entry points.", "Per-IP, per-device and destination quotas with safe rejection tests."],
  ["form-injection", "Form injection", "not-verified", "Attacker-controlled form fields reach templates, queries or downstream providers.", "Strict-schema, control-character and downstream-encoding tests."],
  ["email-header-injection", "Email-header injection", "not-verified", "Newlines or crafted addresses alter outbound mail headers.", "Header allowlists and CRLF rejection tests."],
  ["excessive-submissions", "Excessive submissions", "not-verified", "One actor or distributed bots exhaust form, email or staff capacity.", "Burst and sustained quotas with queue and cost ceilings."],
  ["authentication-open-redirects", "Authentication open redirects", "partially-verified", "A return target sends users from authentication to an attacker-controlled origin.", "Allowlisted local-return tests plus staging callback integration."],
  ["account-enumeration", "Account enumeration", "not-verified", "Response text, status or timing reveals whether an account exists.", "Generic response and timing tests across sign-in and recovery."],
  ["legal-page-availability", "Legal-page availability", "not-verified", "A deployment or routing failure removes required legal and policy pages.", "Synthetic availability checks and release-route assertions."],
  ["cache-poisoning", "Cache poisoning", "not-verified", "Untrusted headers or query values influence a shared public cache entry.", "Cache-key, host/header, variant and private-response tests."],
  ["public-data-scraping", "Public-data scraping", "not-verified", "Bots extract public datasets or force expensive origin generation.", "Edge bot controls, pagination, query budgets and origin-rate tests."],
  ["public-error-leakage", "Public error leakage", "partially-verified", "Malformed requests expose stack, schema, provider or identifier details.", "Route-wide malformed-input and production error-body tests."],
] as const satisfies readonly ThreatCoverageSeed[];

const RACING_THREATS = [
  ["unauthorized-provider-access", "Unauthorized provider access", "not-verified", "An untrusted actor invokes a provider client or ingestion path.", "Workload identity, private ingress and direct-access denial tests."],
  ["provider-key-exposure", "Provider-key exposure", "not-verified", "A provider credential reaches client bundles, logs or broad service identities.", "Bundle, log and secret-scope scans with rotation evidence."],
  ["data-source-impersonation", "Data-source impersonation", "not-verified", "A forged feed or callback is accepted as an authoritative racing provider.", "Provider identity, host and payload-authenticity tests."],
  ["corrupt-or-malformed-feed-data", "Corrupt or malformed feed data", "partially-verified", "Malformed provider values break ingestion or poison normalized records.", "Schema, boundary and adversarial parser fixtures."],
  ["stale-data", "Stale data", "partially-verified", "Old provider data is presented as current after feed delay or failure.", "Freshness thresholds, stale labeling and source-health tests."],
  ["duplicate-records", "Duplicate records", "partially-verified", "Replay or provider duplication creates multiple logical race records.", "Natural-key, idempotent ingestion and replay tests."],
  ["conflicting-records", "Conflicting records", "partially-verified", "Providers or updates disagree and silently overwrite authoritative values.", "Conflict policy, provenance and correction workflow tests."],
  ["unbounded-race-searches", "Unbounded race searches", "not-verified", "Broad search parameters force unbounded rows or CPU work.", "Maximum-row, pagination, timeout and query-plan tests."],
  ["high-cost-statistics-queries", "High-cost statistics queries", "not-verified", "Repeated or adversarial statistics filters exhaust database resources.", "Complexity budgets, indexes, concurrency limits and load tests."],
  ["enumeration-of-unpublished-records", "Enumeration of unpublished records", "not-verified", "Sequential identifiers reveal draft or restricted racing records.", "Direct object-state and negative enumeration tests."],
  ["mixing-public-and-restricted-data", "Mixing public and restricted data", "not-verified", "A shared projection or cache returns provider-restricted fields publicly.", "Explicit projection, classification and cross-tier response tests."],
  ["cache-leakage", "Cache leakage", "not-verified", "A cache key omits entitlement, visibility or source restriction context.", "Security-context cache-key and downgrade tests."],
  ["unsafe-replay-or-media-urls", "Unsafe replay or media URLs", "partially-verified", "Provider URLs trigger SSRF, unsafe redirects or untrusted media delivery.", "Private/link-local, DNS-rebinding, redirect, size and timeout tests."],
  ["data-provenance-loss", "Data-provenance loss", "partially-verified", "Normalized values lose provider, timestamp or correction history.", "Source and ingestion lineage assertions through API output."],
  ["administrative-correction-auditability", "Administrative correction auditability", "not-verified", "Privileged racing corrections cannot be attributed or reconstructed.", "Before/after, reason, actor and append-only audit tests."],
] as const satisfies readonly ThreatCoverageSeed[];

const MESSAGING_THREATS = [
  ["conversation-id-enumeration", "Conversation ID enumeration", "partially-verified", "A user changes a conversation identifier to discover another room.", "Cross-user direct API and Realtime subscription tests."],
  ["non-member-message-access", "Non-member message access", "partially-verified", "A non-participant reads or mutates messages in a conversation.", "Participant-denial tests for every HTTP and Realtime entry point."],
  ["block-bypass", "Messaging block bypass", "partially-verified", "A blocked actor sends, reads or receives presence through stale grants.", "Bidirectional block and grant-revocation tests."],
  ["attachment-access", "Attachment access", "partially-verified", "A non-member or former participant reuses an attachment URL.", "Signed URL, membership-change, cache and deletion tests."],
  ["message-replay", "Message replay", "not-verified", "A client or reconnect repeats an accepted message mutation.", "Idempotency-key and duplicate-delivery tests."],
  ["message-impersonation", "Message impersonation", "not-verified", "Client input supplies another sender identity.", "Server-derived actor and forged-sender rejection tests."],
  ["read-receipt-privacy", "Read-receipt privacy", "not-verified", "Receipt state leaks activity to an unauthorized or blocked actor.", "Participant, privacy and post-block receipt tests."],
  ["presence-leakage", "Presence leakage", "blocked-from-release", "Shared presence topics expose activity outside allowed relationships.", "Relationship-scoped grants and cross-user staging subscription tests."],
  ["notification-content-leakage", "Notification-content leakage", "not-verified", "Push or in-app notifications expose protected message content.", "Redaction and relationship-change notification tests."],
  ["websocket-room-access", "WebSocket room access", "partially-verified", "A client subscribes to a room without current membership.", "Exact grant, revocation, stale-token and alternate-channel tests."],
  ["call-token-theft", "Call-token theft", "partially-verified", "A scoped media token is reused by another actor or after membership changes.", "Audience, subject, expiry, reuse and revocation tests."],
  ["call-invitation-spam", "Call invitation spam", "not-verified", "A caller repeatedly rings one or many recipients.", "Caller/callee cooldown, active-room cap and abuse alerts."],
  ["provider-credential-exposure", "Messaging provider credential exposure", "partially-verified", "Realtime or media provider credentials leak to clients or logs.", "Credential-scope, bundle, log and rotation tests."],
  ["failed-message-duplication", "Failed-message duplication", "not-verified", "Retry and reconnect paths create duplicate messages or notifications.", "Bounded retry, dedupe and reconnect-storm tests."],
  ["deleted-message-retention", "Deleted-message retention", "not-verified", "Deleted content remains in attachments, search, notifications, logs or backups.", "Lifecycle tests across primary data, media, cache, search and retention."],
] as const satisfies readonly ThreatCoverageSeed[];

const COMMUNITY_THREATS = [
  ["stored-xss", "Stored XSS", "partially-verified", "Attacker-controlled post, comment, profile or media text is rendered to another user.", "Stored-render tests for HTML, Markdown, URLs and provider or AI strings."],
  ["spam", "Spam", "not-verified", "A user or bot creates high-volume posts, comments or reports.", "Per-actor, per-object and new-account quotas with alert evidence."],
  ["automated-reactions", "Automated reactions", "not-verified", "Distributed clients inflate engagement through repeated reaction mutations.", "Uniqueness, actor/object rate and distributed-abuse tests."],
  ["automated-friend-requests", "Automated friend requests", "not-verified", "An account floods recipients or bypasses relationship cooldowns.", "Sender, recipient and new-account cooldown tests including block state."],
  ["private-profile-leakage", "Private-profile leakage", "partially-verified", "Search, feeds, notifications or direct object requests reveal private profile data.", "Cross-role direct API, search and notification projection tests."],
  ["block-bypass", "Block bypass", "partially-verified", "A blocked actor uses alternate routes, notifications or shares to access a target.", "Bidirectional block tests across every read and mutation entry point."],
  ["deleted-content-leakage", "Deleted-content leakage", "partially-verified", "Deleted records remain visible through search, cache, share or notification paths.", "Post-delete API, search, cache and notification tests."],
  ["unauthorized-edit-or-deletion", "Unauthorized edit or deletion", "not-verified", "An authenticated actor changes another owner's community object.", "Direct cross-owner mutation tests for posts, comments and media."],
  ["comment-ownership", "Comment ownership", "not-verified", "A user changes or removes a comment they do not own.", "Owner, non-owner, moderator and administrator mutation matrix."],
  ["share-link-privacy", "Share-link privacy", "partially-verified", "A share URL exposes content after visibility or relationship state changes.", "Private, blocked, deleted and revoked share-link tests."],
  ["notification-privacy", "Notification privacy", "partially-verified", "Notification payloads reveal protected content or actor details.", "Recipient and redaction tests after privacy, block and deletion changes."],
  ["search-result-privacy", "Search-result privacy", "partially-verified", "Search indexes or projections return private, blocked or deleted records.", "Cross-user search tests plus index deletion and cache validation."],
  ["group-membership-bypass", "Group-membership bypass", "control-missing", "A non-member calls group reads or mutations directly.", "Implement membership states, then run non-member and stale-membership tests."],
  ["forum-moderation-bypass", "Forum moderation bypass", "control-missing", "A member invokes moderator-only forum operations or evades moderation state.", "Scoped moderator policy and direct negative tests."],
  ["media-abuse", "Media abuse", "partially-verified", "A user uploads malicious, oversized or misleading community media.", "Live scanner, quarantine, size, type and post-delete access tests."],
  ["report-abuse", "Report abuse", "partially-verified", "A user submits duplicate or retaliatory reports to overload moderation.", "Actor/target/type quotas, deduplication and retaliation review tests."],
  ["moderator-privilege-escalation", "Moderator privilege escalation", "partially-verified", "A moderator reaches administrator data or mutations through an alternate path.", "Runtime moderator-vs-administrator route, API and mutation denial tests."],
] as const satisfies readonly ThreatCoverageSeed[];

const MARKETPLACE_THREATS = [
  ["listing-ownership-bypass", "Listing ownership bypass", "partially-verified", "A buyer or another seller accesses an owner-only listing operation.", "Cross-seller direct API tests for every listing mutation."],
  ["unauthorized-editing", "Unauthorized editing", "partially-verified", "A non-owner modifies listing fields through an alternate endpoint.", "Owner and non-owner tests with immutable-field assertions."],
  ["unauthorized-publication", "Unauthorized publication", "partially-verified", "A seller bypasses moderation or verification state to publish.", "Invalid-role and invalid-state transition tests."],
  ["verification-status-forgery", "Verification-status forgery", "not-verified", "Client input attempts to set authoritative verification state.", "Unknown and security-field rejection tests."],
  ["seller-impersonation", "Seller impersonation", "not-verified", "A client supplies another seller identity or contact projection.", "Server-derived seller identity and cross-seller tests."],
  ["mass-assignment", "Mass assignment", "not-verified", "Extra request properties overwrite protected listing fields.", "Strict-schema unknown-field and protected-field tests."],
  ["enquiry-spam", "Enquiry spam", "not-verified", "A buyer floods one or many sellers with enquiries.", "Buyer/listing/seller/day quotas and duplicate detection."],
  ["buyer-or-seller-privacy-leakage", "Buyer or seller privacy leakage", "not-verified", "Enquiry, search or listing responses expose private contact data.", "Explicit projection and cross-party response tests."],
  ["saved-listing-enumeration", "Saved-listing enumeration", "not-verified", "A user enumerates another account's saved listing identifiers.", "Cross-user list and direct-object BOLA tests."],
  ["media-manipulation", "Media manipulation", "partially-verified", "A non-owner reorders, replaces or deletes listing media.", "Cross-owner media mutation and integrity tests."],
  ["malicious-files", "Malicious files", "partially-verified", "An upload contains malware, polyglot content or unsafe metadata.", "Live scan, quarantine, MIME/content and delivery-origin tests."],
  ["false-disclosure", "False disclosure", "not-verified", "A seller omits or falsifies mandatory disclosure data.", "Required disclosure schema and moderation-state tests."],
  ["status-transition-bypass", "Status-transition bypass", "partially-verified", "A client skips allowed listing lifecycle transitions.", "Complete state-machine matrix including concurrency."],
  ["archived-or-deleted-listing-leakage", "Archived or deleted listing leakage", "partially-verified", "Search, detail or cache paths expose unavailable listings.", "Search/detail/cache tests for every status."],
  ["search-scraping", "Search scraping", "not-verified", "Bots extract inventory or force expensive search patterns.", "Page, complexity, actor and edge-rate budgets."],
  ["payment-state-manipulation-where-applicable", "Payment-state manipulation", "not-verified", "Browser return or client metadata attempts to assert payment state.", "Signed webhook/provider verification and return-is-informational tests."],
] as const satisfies readonly ThreatCoverageSeed[];

const ACCOUNT_THREATS = [
  ["profile-takeover", "Profile takeover", "not-verified", "A stolen or stale session changes profile or security settings.", "Step-up, revocation and suspicious-session tests."],
  ["email-change-abuse", "Email-change abuse", "not-verified", "A session changes the login email without reauthentication or confirmation.", "Reauthentication, dual notification and rollback tests."],
  ["session-persistence-after-security-changes", "Session persistence after security changes", "not-verified", "Old sessions remain valid after password, email or account-security changes.", "Session version and global revocation tests."],
  ["notification-setting-manipulation", "Notification-setting manipulation", "not-verified", "A user edits another user's notification preferences.", "Cross-user property authorization and audit tests."],
  ["privacy-setting-bypass", "Privacy-setting bypass", "not-verified", "A client changes or ignores another user's privacy settings.", "Direct mutation and downstream projection tests."],
  ["saved-item-leakage", "Saved-item leakage", "not-verified", "Saved dogs, races or listings are returned to another user.", "Cross-user collection and object tests."],
  ["team-invitation-theft", "Team invitation theft", "blocked-from-release", "A token is replayed, transferred or accepted outside its tenant.", "Single-use, recipient, tenant and expiry tests."],
  ["role-escalation", "Role escalation", "blocked-from-release", "An invitation or member mutation grants a role beyond the actor's authority.", "Role allowlist and lower-role negative tests."],
  ["last-owner-removal", "Last-owner removal", "blocked-from-release", "Concurrent requests remove the last tenant owner.", "Transactional concurrent last-owner tests."],
  ["page-ownership-transfer", "Page ownership transfer", "blocked-from-release", "Ownership is transferred to an invalid actor or without required approval.", "Eligible-recipient, authorization, audit and concurrency tests."],
  ["billing-return-manipulation", "Billing-return manipulation", "partially-verified", "Query parameters or client state assert a paid plan.", "Return-is-informational and provider-authoritative state tests."],
  ["invoice-access", "Invoice access", "partially-verified", "A user changes an invoice identifier to read another account's invoice.", "Cross-user direct endpoint and provider-customer binding tests."],
  ["data-export-access", "Data export access", "partially-verified", "A user requests or downloads another account's export.", "Cross-user request, status, download and expiry tests."],
  ["account-deletion", "Account deletion", "partially-verified", "Deletion is triggered without reauthentication or leaves provider, media or session data.", "Reauth, idempotency, provider, storage, session and backup lifecycle tests."],
  ["support-ticket-privacy", "Support-ticket privacy", "partially-verified", "Ticket identifiers expose another user's support content.", "Cross-user and support-scope response tests."],
  ["onboarding-state-tampering", "Onboarding-state tampering", "not-verified", "Client state skips mandatory account or consent steps.", "Server-derived completion and invalid-transition tests."],
] as const satisfies readonly ThreatCoverageSeed[];

const ADMINISTRATION_THREATS = [
  ["moderator-to-administrator-escalation", "Moderator-to-administrator escalation", "partially-verified", "A moderator reaches administrator-only data or mutations directly.", "Runtime route, API, action and projection denial matrix."],
  ["insecure-direct-object-references", "Administrative insecure direct object references", "not-verified", "Privileged but incorrectly scoped staff changes an object identifier to access another tenant or user.", "Object and tenant authorization tests for every dynamic administrator endpoint."],
  ["bulk-action-mistakes", "Bulk-action mistakes", "not-verified", "A broad selector or repeated submission affects unintended records.", "Preview, explicit target count, confirmation, bounds and idempotency tests."],
  ["self-lockout", "Self-lockout", "partially-verified", "An administrator disables or demotes their own final recovery path.", "Self-target and independent-break-glass tests."],
  ["last-administrator-removal", "Last-administrator removal", "partially-verified", "Concurrent mutations remove the final active administrator.", "Real database concurrent advisory-lock and rollback tests."],
  ["missing-required-reasons", "Missing required reasons", "partially-verified", "A privileged mutation proceeds without an attributable reason.", "Strict non-empty reason schema and audit persistence tests."],
  ["audit-log-tampering", "Audit-log tampering", "blocked-from-release", "A privileged actor modifies or deletes evidence of their actions.", "Append-only role, integrity, retention and tamper-alert tests."],
  ["export-abuse", "Administrative export abuse", "not-verified", "Staff exports excessive or out-of-scope personal data.", "Scope, row/byte, rate, approval and immutable audit tests."],
  ["user-impersonation", "User impersonation", "not-verified", "Support or administrative tooling assumes a user identity without bounded authorization and disclosure.", "Explicit approval, banner, expiry, prohibited-action and audit tests."],
  ["support-access-overreach", "Support-access overreach", "partially-verified", "Support staff reads or changes data beyond the ticket and assigned scope.", "Purpose-bound projection and mutation-denial tests."],
  ["webhook-replay", "Administrative webhook replay", "not-verified", "A staff reprocess action duplicates a provider event or bypasses freshness checks.", "Provider refetch, dedupe, idempotency, reason and audit tests."],
  ["payment-mutation", "Administrative payment mutation", "not-verified", "A privileged action changes payment state without authoritative provider confirmation.", "Provider-authoritative transition, dual-control and audit tests."],
  ["plan-or-entitlement-manipulation", "Plan or entitlement manipulation", "partially-verified", "Free-form or cross-tenant input grants an invalid tier or entitlement.", "Server allowlist, tenant binding, expiry and audit tests."],
  ["source-health-command-injection", "Source-health command injection", "partially-verified", "Administrator-supplied diagnostics reach a shell, URL or provider command unsafely.", "Typed command allowlist and metacharacter/SSRF rejection tests."],
  ["unsafe-job-reprocessing", "Unsafe job reprocessing", "not-verified", "A poison, completed or cross-tenant job is replayed with unsafe effects.", "Exact job-type allowlist, lease, idempotency and downstream-bound tests."],
  ["sensitive-diagnostic-leakage", "Sensitive diagnostic leakage", "blocked-from-release", "Admin health or debug output exposes credentials, PII or provider payloads.", "Response allowlist, redaction, direct-route and production-mode tests."],
  ["cross-tenant-administration-mistakes", "Cross-tenant administration mistakes", "not-verified", "A privileged actor selects or mutates records in the wrong tenant.", "Tenant-scoped queries, confirmation context and cross-tenant negative tests."],
] as const satisfies readonly ThreatCoverageSeed[];

const AI_THREATS = [
  ["prompt-injection", "Prompt injection", "not-verified", "A user prompt changes system intent or requests privileged tool use.", "Adversarial prompt corpus, instruction hierarchy and tool-denial tests."],
  ["indirect-prompt-injection", "Indirect prompt injection", "not-verified", "Retrieved or provider content supplies hidden instructions to the model.", "Untrusted-content isolation, provenance and tool-boundary tests."],
  ["secret-exposure", "AI secret exposure", "not-verified", "Prompts, context or output reveal credentials or protected configuration.", "Input/output secret scanning, redaction and canary tests."],
  ["cross-user-data-leakage", "AI cross-user data leakage", "not-verified", "Retrieval or memory includes another user's records.", "Adversarial cross-user retrieval and output tests."],
  ["cross-tenant-data-leakage", "AI cross-tenant data leakage", "not-verified", "Tenant filters are omitted from retrieval or tool operations.", "Cross-tenant index, retrieval and tool authorization tests."],
  ["unauthorized-tool-invocation", "Unauthorized tool invocation", "not-verified", "Model output invokes a tool the actor cannot call directly.", "Strict tool allowlist and ordinary server-policy denial tests."],
  ["excessive-agency", "Excessive agency", "not-verified", "An agent chains or repeats consequential actions without bounded approval.", "Step, duration, concurrency and human-approval limits."],
  ["protected-data-mutation", "Protected-data mutation", "not-verified", "Generated output silently changes protected application data.", "Explicit confirmation, idempotency and normal authorization tests."],
  ["malicious-retrieved-content", "Malicious retrieved content", "not-verified", "Poisoned documents steer recommendations or tool calls.", "Source trust, content isolation and poisoned-retrieval tests."],
  ["unsafe-external-urls", "Unsafe external URLs", "not-verified", "Model-supplied URLs trigger SSRF, redirects or untrusted downloads.", "Host/scheme allowlist, DNS-rebinding, redirect and size tests."],
  ["cost-exhaustion", "AI cost exhaustion", "partially-verified", "Actors create unbounded runs, tokens or provider spend.", "Atomic run/token/cost reservation, tenant quota and kill-switch tests."],
  ["output-injection", "AI output injection", "not-verified", "Generated Markdown, HTML or links execute or mislead when rendered.", "Structured output, sanitization and stored-render tests."],
  ["hallucinated-permissions", "Hallucinated permissions", "not-verified", "The model asserts that an actor may perform an operation they cannot.", "Server denial independent of model text and safe user feedback tests."],
  ["unsafe-logging-of-prompts-or-responses", "Unsafe AI logging", "not-verified", "Logs retain prompts, outputs, secrets or personal information.", "Structured redaction, sample-log and retention tests."],
  ["model-provider-retention", "Model-provider retention", "not-verified", "Provider policy retains prompts or outputs beyond approved purpose.", "Contract, configuration, deletion and incident-contact evidence."],
  ["insecure-plugin-or-tool-credentials", "Insecure plugin or tool credentials", "not-verified", "Broad or long-lived credentials are exposed to agent tools.", "Per-tool workload identity, scope, rotation and egress tests."],
] as const satisfies readonly ThreatCoverageSeed[];

const DESIGN_LAB_THREATS = [
  ["public-indexing", "Design Lab public indexing", "partially-verified", "Search engines or unauthorised users discover preview routes.", "Built-deployment robots, header, sitemap and direct-access tests."],
  ["production-enablement", "Design Lab production enablement", "partially-verified", "Preview-only behavior is enabled on the public production application.", "Environment policy and production-build route tests."],
  ["production-data-access", "Design Lab production-data access", "partially-verified", "A selector or preview request reads live personal or billing data.", "Network-deny, credential absence and synthetic-fixture provenance tests."],
  ["production-mutations", "Design Lab production mutations", "partially-verified", "A simulated action reaches a production mutation endpoint.", "Request capture, read-only guard and direct API isolation tests."],
  ["real-user-impersonation", "Design Lab real-user impersonation", "not-verified", "Role simulation assumes a real user's identity or session.", "Synthetic identity and production-session isolation tests."],
  ["leaked-environment-variables", "Design Lab leaked environment variables", "partially-verified", "Preview output or client bundles expose server configuration or secrets.", "Bundle, HTML, error and fixture secret scans."],
  ["debug-routes", "Design Lab debug routes", "not-verified", "Development or diagnostic endpoints remain accessible in a production build.", "Production route inventory and direct-access denial tests."],
  ["fixture-sanitization", "Design Lab fixture sanitization", "partially-verified", "Fixtures contain copied PII, credentials or unsafe rendered content.", "PII/secret scan and stored-render fixture tests."],
  ["authentication-bypass-leaking-into-production-code", "Design Lab authentication bypass leakage", "partially-verified", "Demo authentication branches weaken normal production authorization.", "Production build, direct API and branch-isolation tests."],
  ["selector-query-parameters-altering-production-permissions", "Design Lab selector permission manipulation", "not-verified", "Role, tier or permission query values become authoritative server inputs.", "Selector permutation tests proving unchanged server authorization."],
  ["preview-links-shared-outside-authorized-environments", "Design Lab preview link sharing", "not-verified", "A copied preview URL grants unintended access or exposes sensitive state.", "Authentication, expiry, no-secret URL and external-access tests."],
] as const satisfies readonly ThreatCoverageSeed[];

export const THREAT_MODEL_COVERAGE_RECORDS = [
  ...threatRecords("threat-public", "public website", PUBLIC_THREATS),
  ...threatRecords("threat-racing", "racing intelligence", RACING_THREATS),
  ...threatRecords("threat-community", "community and Feed", COMMUNITY_THREATS),
  ...threatRecords("threat-messaging", "messaging and Pulse", MESSAGING_THREATS),
  ...threatRecords("threat-marketplace", "Marketplace", MARKETPLACE_THREATS),
  ...threatRecords("threat-account", "account", ACCOUNT_THREATS),
  ...threatRecords("threat-administration", "administration", ADMINISTRATION_THREATS),
  ...threatRecords("threat-ai", "AI tools", AI_THREATS),
  ...threatRecords("threat-design-lab", "Design Lab", DESIGN_LAB_THREATS),
] as const;

export function validateThreatModelCoverage() {
  const failures: string[] = [];
  const ids = new Set<string>();

  for (const area of THREAT_MODEL_AREA_RECORDS) {
    for (const field of [
      "area",
      "threatModelRequirementId",
      "abuseCaseRequirementId",
      "trustBoundary",
      "releaseDecision",
    ] as const) {
      if (!area[field].trim()) failures.push(`${area.area}:${field}`);
    }
    if (area.assets.length === 0) failures.push(`${area.area}:assets`);
    if (area.entryPoints.length === 0) failures.push(`${area.area}:entryPoints`);
    if (area.abuseCases.length === 0) failures.push(`${area.area}:abuseCases`);
  }

  for (const record of THREAT_MODEL_COVERAGE_RECORDS) {
    if (ids.has(record.requirementId)) {
      failures.push(`${record.requirementId}:duplicate`);
    }
    ids.add(record.requirementId);
    for (const field of [
      "area",
      "threat",
      "abusePath",
      "requiredValidation",
      "residualRisk",
      "owner",
    ] as const) {
      if (!record[field].trim()) failures.push(`${record.requirementId}:${field}`);
    }
    if (record.affectedAssets.length === 0) {
      failures.push(`${record.requirementId}:affectedAssets`);
    }
  }

  return failures;
}
