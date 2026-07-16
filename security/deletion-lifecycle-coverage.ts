export const DELETION_LIFECYCLE_STATUSES = [
  "partially-verified",
  "not-verified",
  "control-missing",
] as const;

type DeletionLifecycleStatus = (typeof DELETION_LIFECYCLE_STATUSES)[number];

type DeletionLifecycleSeed = readonly [
  slug: string,
  behavior: string,
  status: DeletionLifecycleStatus,
  currentContract: string,
  requiredValidation: string,
];

const DELETION_LIFECYCLE_SEEDS = [
  ["immediate-deletion", "immediate deletion", "partially-verified", "A request records deletion intent immediately, while irreversible personal-data removal waits for the documented grace and exception checks.", "Verify reauthentication, session restriction, notice and the exact records changed at request time."],
  ["soft-deletion", "soft deletion", "partially-verified", "Account deletion uses a 30-day grace state and selected content uses tombstone/deleted markers instead of unsafe immediate removal.", "Test visibility, recovery, uniqueness and relationship behavior throughout the grace period."],
  ["delayed-deletion", "delayed deletion", "partially-verified", "Bounded maintenance finalizes eligible accounts after the grace deadline and processes leased storage jobs.", "Prove scheduler identity, backlog recovery, idempotency and complete provider/storage execution in staging."],
  ["legal-retention", "legal retention", "not-verified", "The lifecycle reserves explicit legal-retention exceptions but no approved Australian retention decision matrix exists.", "Privacy/legal owner must approve categories, basis, duration, access and eventual deletion."],
  ["de-identification", "de-identification", "partially-verified", "Local finalization scrubs selected identity, social, message and AI fields while preserving counterparty-authored records.", "Validate every table, uniqueness impact, re-identification risk and export/search projection."],
  ["backup-expiry", "backup expiry", "not-verified", "Deleted data is intended to remain beyond use until encrypted backups expire; no tested expiry or non-reactivation control is evidenced.", "Prove backup retention, deletion markers, isolated restore handling and expiry monitoring."],
  ["search-index-deletion", "search-index deletion", "control-missing", "The deletion contract requires removal from search indexes, but no complete index deletion ledger is evidenced.", "Implement idempotent per-subject index removal and verify search absence after retry and restore."],
  ["cache-deletion", "cache deletion", "not-verified", "The deletion contract requires cache invalidation, but no complete subject-key inventory or runtime proof exists.", "Inventory affected keys and test invalidation, stale fallback and full cache recovery."],
  ["object-storage-deletion", "object-storage deletion", "partially-verified", "Durable jobs delete bounded batches under exact per-user public/private prefixes after bucket and prefix validation.", "Execute against authorised staging storage and verify derived objects, retries, leases and audit outcomes."],
  ["third-party-deletion", "third-party deletion", "control-missing", "WorkOS, Stripe/Lago, LiveKit and other provider deletion/cancellation is required but deliberately not claimed as implemented.", "Define provider-specific eligibility, issue/delete calls, reconcile responses and alert persistent failures."],
  ["analytics-deletion", "analytics deletion", "not-verified", "Analytics and telemetry deletion is required when applicable, but provider and identifier scope is not inventoried completely.", "Inventory analytics processors, identifiers, retention and deletion/de-identification mechanisms."],
  ["ai-provider-deletion-where-supported", "AI-provider deletion where supported", "not-verified", "Local AI memory and run fields are scrubbed; provider retention and deletion capability remain unverified.", "Approve provider terms/configuration and test deletion or documented non-retention behavior."],
] as const satisfies readonly DeletionLifecycleSeed[];

const DELETION_EVIDENCE = [
  "docs/security/privacy-data-lifecycle.md",
  "docs/security/risk-register.md",
  "docs/security/backup-and-recovery.md",
] as const;

export const DELETION_LIFECYCLE_RECORDS = DELETION_LIFECYCLE_SEEDS.map(
  ([slug, behavior, status, currentContract, requiredValidation]) => ({
    requirementId: `security.deletion-lifecycle.${slug}`,
    behavior,
    status,
    currentContract,
    requiredValidation,
    owner: "GreyhoundIQ privacy and data platform leads",
    evidence: DELETION_EVIDENCE,
  }),
);

export function validateDeletionLifecycleCoverage() {
  const failures: string[] = [];
  const ids = new Set<string>();
  for (const record of DELETION_LIFECYCLE_RECORDS) {
    if (ids.has(record.requirementId)) failures.push(`${record.requirementId}:duplicate`);
    ids.add(record.requirementId);
    for (const field of ["behavior", "currentContract", "requiredValidation", "owner"] as const) {
      if (!record[field].trim()) failures.push(`${record.requirementId}:${field}`);
    }
  }
  return failures;
}
