export type RetentionEnforcementStatus =
  | "policy-defined-automation-open"
  | "provider-configuration-open";

export type RetentionSchedule = {
  requirementId: `security.retention-schedule.${string}`;
  category: string;
  recordScope: string;
  primaryPurpose: string;
  activeRetentionCondition: string;
  retentionTrigger: string;
  maximumDaysAfterTrigger: number;
  contentReductionAfterDays?: number;
  disposition: string;
  systems: readonly string[];
  owner: string;
  legalHoldRule: string;
  enforcementStatus: RetentionEnforcementStatus;
  reviewCadenceDays: 365;
};

const POLICY_DEFINED = "policy-defined-automation-open" as const;
const PROVIDER_OPEN = "provider-configuration-open" as const;
const LEGAL_HOLD =
  "A documented Australian-law, regulator, court, fraud or active-dispute hold may pause disposal for the minimum necessary scope and duration; the Privacy Owner records approval, review date and release.";

export const RETENTION_SCHEDULES = [
  schedule({
    id: "user-profiles",
    category: "User profiles",
    scope: "User, Profile and user-controlled preference records",
    purpose: "Operate the account, identity link, preferences and authorised product features.",
    active: "While the account is active and the fields remain necessary for the declared product purpose.",
    trigger: "Verified account-deletion request or field-level purpose ending",
    days: 30,
    disposition: "Delete direct identifiers and de-identify only aggregates that pass re-identification review.",
    systems: ["PostgreSQL", "identity provider"],
    owner: "Privacy Owner",
    enforcement: PROVIDER_OPEN,
  }),
  schedule({
    id: "sessions",
    category: "Sessions",
    scope: "Application cookies, provider sessions, refresh material and revocation metadata",
    purpose: "Maintain authenticated sessions and investigate active session abuse.",
    active: "Only while the session is valid or needed for immediate revocation and abuse response.",
    trigger: "Expiry, logout, revocation or account suspension/deletion",
    days: 30,
    disposition: "Revoke provider state, expire browser state and delete residual session metadata.",
    systems: ["WorkOS AuthKit", "browser cookies", "security audit store"],
    owner: "Identity and Security Owner",
    enforcement: PROVIDER_OPEN,
  }),
  schedule({
    id: "authentication-events",
    category: "Authentication events",
    scope: "Successful, failed, recovery, MFA and session-security events without credential material",
    purpose: "Detect account abuse, investigate incidents and demonstrate access-control operation.",
    active: "Fixed event-retention window with no open-ended account-lifetime retention.",
    trigger: "Event occurrence",
    days: 400,
    disposition: "Delete event details; retain only irreversibly aggregated security trends.",
    systems: ["security audit store", "central logging"],
    owner: "Security Operations Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "posts",
    category: "Posts",
    scope: "Feed post content and post metadata",
    purpose: "Publish and moderate user-requested community content.",
    active: "While published, user-retained or required for an active moderation case.",
    trigger: "Owner deletion, account finalisation or moderation removal",
    days: 30,
    disposition: "Purge content and identifiers; preserve only the minimum reasoned moderation audit where required.",
    systems: ["PostgreSQL", "search index", "CDN/cache"],
    owner: "Community Product Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "comments",
    category: "Comments",
    scope: "Comment content, edit state and relationship metadata",
    purpose: "Support community discussion and moderation.",
    active: "While published, user-retained or required for an active moderation case.",
    trigger: "Owner deletion, parent removal, account finalisation or moderation removal",
    days: 30,
    disposition: "Purge content and direct identifiers and invalidate derived caches/search documents.",
    systems: ["PostgreSQL", "search index", "CDN/cache"],
    owner: "Community Product Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "messages",
    category: "Messages",
    scope: "Private-message text, attachments and delivery metadata",
    purpose: "Deliver participant-authorised private conversations and handle safety reports.",
    active: "While retained by a participant and not subject to a completed deletion request.",
    trigger: "Conversation deletion, participant account finalisation or the last valid purpose ending",
    days: 30,
    disposition: "Delete message content and attachment objects; retain only scoped safety evidence under an approved hold.",
    systems: ["PostgreSQL", "object storage", "realtime provider"],
    owner: "Messaging and Safety Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "media",
    category: "Media",
    scope: "Uploaded images, audio, video, derivatives and technical metadata",
    purpose: "Render user-requested product content and perform security processing.",
    active: "While attached to retained content or quarantined for a bounded security decision.",
    trigger: "Owner deletion, parent deletion, rejected quarantine or account finalisation",
    days: 30,
    disposition: "Delete originals and derivatives, invalidate signed access and purge CDN/cache copies.",
    systems: ["object storage", "PostgreSQL", "CDN/cache", "malware quarantine"],
    owner: "Media Platform Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "listings",
    category: "Listings",
    scope: "Marketplace listing content, price history and publication state",
    purpose: "Operate marketplace listings, disputes and moderation.",
    active: "While draft, published, transacting or within the bounded dispute window.",
    trigger: "Archive, deletion or transaction/dispute closure, whichever is later",
    days: 365,
    disposition: "Delete listing content and media; retain only legally required transaction and audit records separately.",
    systems: ["PostgreSQL", "object storage", "search index", "CDN/cache"],
    owner: "Marketplace Product Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "enquiries",
    category: "Enquiries",
    scope: "Marketplace enquiries and seller/buyer correspondence metadata",
    purpose: "Resolve the enquiry, safety concerns and transaction disputes.",
    active: "While the enquiry or related dispute remains open.",
    trigger: "Enquiry and related dispute closure",
    days: 730,
    disposition: "Delete correspondence and direct identifiers unless a narrower approved hold applies.",
    systems: ["PostgreSQL", "email provider"],
    owner: "Marketplace Operations Owner",
    enforcement: PROVIDER_OPEN,
  }),
  schedule({
    id: "support-tickets",
    category: "Support tickets",
    scope: "Support requests, responses, attachments and resolution metadata",
    purpose: "Resolve support issues, prevent repeated faults and meet user commitments.",
    active: "While the ticket or related escalation remains open.",
    trigger: "Ticket and related escalation closure",
    days: 730,
    disposition: "Delete ticket content and attachments; de-identify reusable problem trends.",
    systems: ["PostgreSQL", "email provider", "object storage"],
    owner: "Support Operations Owner",
    enforcement: PROVIDER_OPEN,
  }),
  schedule({
    id: "moderation-records",
    category: "Moderation records",
    scope: "Reports, decisions, reasons, evidence references and appeals",
    purpose: "Enforce community safety, support appeals and identify repeat abuse.",
    active: "While a case, appeal or linked safety investigation remains open.",
    trigger: "Final decision or appeal closure, whichever is later",
    days: 1095,
    disposition: "Delete evidence content and pseudonymise decision analytics unless an approved safety hold applies.",
    systems: ["PostgreSQL", "object storage", "audit store"],
    owner: "Trust and Safety Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "audit-logs",
    category: "Audit logs",
    scope: "Reasoned privileged, privacy, billing and destructive-action audit records",
    purpose: "Provide tamper-resistant accountability, investigation and compliance evidence.",
    active: "Fixed event-retention window, extended only by an approved legal or incident hold.",
    trigger: "Audit event occurrence",
    days: 2555,
    disposition: "Cryptographically expire archived partitions and retain only non-identifying control metrics.",
    systems: ["PostgreSQL audit tables", "central immutable audit archive"],
    owner: "Security and Compliance Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "security-logs",
    category: "Security logs",
    scope: "Redacted edge, application, identity, database and security-control telemetry",
    purpose: "Detect, contain and investigate security incidents.",
    active: "Fixed event-retention window, extended only for a documented incident.",
    trigger: "Log event occurrence",
    days: 400,
    disposition: "Delete searchable and archived events and retain only non-identifying aggregate metrics.",
    systems: ["Google Cloud Logging", "security analytics archive"],
    owner: "Security Operations Owner",
    enforcement: PROVIDER_OPEN,
  }),
  schedule({
    id: "billing-records",
    category: "Billing records",
    scope: "Payment, refund, credit, subscription and entitlement accounting records without card data",
    purpose: "Operate billing, reconcile providers, resolve disputes and support Australian business records.",
    active: "While the transaction is unsettled, disputed or otherwise operationally active.",
    trigger: "Transaction completion or dispute resolution, whichever is later",
    days: 1825,
    disposition: "Delete or de-identify non-statutory fields; preserve only the minimum confirmed finance record.",
    systems: ["PostgreSQL", "Stripe", "Lago"],
    owner: "Finance and Billing Owner",
    enforcement: PROVIDER_OPEN,
  }),
  schedule({
    id: "invoices",
    category: "Invoices",
    scope: "Invoice identifiers, parties, amounts, currency, tax status and settlement evidence",
    purpose: "Provide customer records, tax/accounting support and payment reconciliation.",
    active: "While unpaid, disputed or subject to an adjustment.",
    trigger: "Issue, final settlement or adjustment, whichever is later",
    days: 1825,
    disposition: "Delete non-required provider payloads and retain the minimum confirmed finance record.",
    systems: ["PostgreSQL", "Stripe", "Lago", "finance archive"],
    owner: "Finance and Billing Owner",
    enforcement: PROVIDER_OPEN,
  }),
  schedule({
    id: "webhook-payloads",
    category: "Webhook payloads",
    scope: "Authenticated provider payloads, minimal receipts and delivery outcomes",
    purpose: "Reduce provider state, deduplicate delivery and investigate bounded integration failures.",
    active: "Only while required for reduction, retry or a documented integration investigation.",
    trigger: "Provider event receipt",
    days: 400,
    reductionDays: 30,
    disposition: "Remove raw payload content after 30 days, then delete the minimal receipt after 400 days unless held.",
    systems: ["PostgreSQL WebhookEvent", "billing audit archive"],
    owner: "Billing Integrations Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "racing-data-snapshots",
    category: "Racing-data snapshots",
    scope: "Raw provider snapshots and ingestion provenance, excluding separately governed published race facts",
    purpose: "Validate feed lineage, replay bounded ingestion failures and correct provider data.",
    active: "While inside the provider-contract and correction window.",
    trigger: "Snapshot ingestion",
    days: 730,
    disposition: "Delete raw snapshots and provider-only fields; retain derived public facts only where the provider contract permits.",
    systems: ["object storage", "PostgreSQL ingestion tables"],
    owner: "Racing Data Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "ai-prompts-and-responses",
    category: "AI prompts and responses",
    scope: "Agent input/output content and provider request metadata, excluding explicitly saved user content",
    purpose: "Complete the requested agent task and diagnose bounded failures.",
    active: "Only while the run is active or within the short user-visible recovery window.",
    trigger: "Agent-run completion or failure",
    days: 30,
    disposition: "Delete prompt/response content and provider copies where supported; retain redacted cost and safety metrics.",
    systems: ["PostgreSQL", "AI provider"],
    owner: "AI Product and Privacy Owner",
    enforcement: PROVIDER_OPEN,
  }),
  schedule({
    id: "exports",
    category: "Exports",
    scope: "Generated personal-data export archives and signed-download metadata",
    purpose: "Deliver one authenticated user-requested export.",
    active: "Only during generation and the short authenticated download window.",
    trigger: "Export generation",
    days: 1,
    disposition: "Delete the archive, expire signed access and retain only a minimal completion audit.",
    systems: ["object storage", "PostgreSQL export metadata"],
    owner: "Privacy Operations Owner",
    enforcement: POLICY_DEFINED,
  }),
  schedule({
    id: "deleted-account-data",
    category: "Deleted-account data",
    scope: "Account graph queued for deletion, provider identities and deletion-job evidence",
    purpose: "Provide the disclosed recovery window and complete verifiable account erasure.",
    active: "Only during the disclosed deletion/recovery window or an approved scoped hold.",
    trigger: "Verified account-deletion request",
    days: 30,
    disposition: "Delete or de-identify the account graph, revoke identity/session state and queue third-party/object cleanup.",
    systems: ["PostgreSQL", "identity provider", "object storage", "third-party providers"],
    owner: "Privacy Operations Owner",
    enforcement: PROVIDER_OPEN,
  }),
  schedule({
    id: "backups",
    category: "Backups",
    scope: "Encrypted database and object-storage recovery copies",
    purpose: "Recover from corruption, deletion and infrastructure failure within the approved RPO/RTO.",
    active: "Fixed rolling recovery window; backups are not an archive for ordinary product access.",
    trigger: "Backup creation",
    days: 35,
    disposition: "Cryptographically expire and delete the recovery copy; deleted primary data ages out through rotation.",
    systems: ["database backup service", "cross-project backup vault", "object versioning"],
    owner: "Database Reliability Owner",
    enforcement: PROVIDER_OPEN,
  }),
] as const satisfies readonly RetentionSchedule[];

function schedule({
  id,
  category,
  scope,
  purpose,
  active,
  trigger,
  days,
  reductionDays,
  disposition,
  systems,
  owner,
  enforcement,
}: {
  id: string;
  category: string;
  scope: string;
  purpose: string;
  active: string;
  trigger: string;
  days: number;
  reductionDays?: number;
  disposition: string;
  systems: readonly string[];
  owner: string;
  enforcement: RetentionEnforcementStatus;
}): RetentionSchedule {
  return {
    requirementId: `security.retention-schedule.${id}`,
    category,
    recordScope: scope,
    primaryPurpose: purpose,
    activeRetentionCondition: active,
    retentionTrigger: trigger,
    maximumDaysAfterTrigger: days,
    ...(reductionDays === undefined
      ? {}
      : { contentReductionAfterDays: reductionDays }),
    disposition,
    systems,
    owner,
    legalHoldRule: LEGAL_HOLD,
    enforcementStatus: enforcement,
    reviewCadenceDays: 365,
  };
}
