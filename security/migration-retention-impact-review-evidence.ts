export const MIGRATION_RETENTION_IMPACT_REVIEW_REQUIREMENT_ID =
  "security.migration-review.retention";

export type MigrationRetentionSource = Readonly<{
  path: string;
  source: string;
}>;

export type MigrationRetentionOperation =
  | "create-column"
  | "add-column"
  | "alter-column"
  | "rename-column"
  | "drop-column";

export type MigrationRetentionCandidate = Readonly<{
  key: string;
  path: string;
  relation: string;
  column: string;
  operation: MigrationRetentionOperation;
}>;

export type MigrationRetentionReview = Readonly<{
  key: string;
  decision:
    | "retention-schedule-binding"
    | "operational-validity-only"
    | "lifecycle-marker-only";
  scheduleRequirementId: `security.retention-schedule.${string}` | null;
  rationale: string;
}>;

export type MigrationRetentionAudit = Readonly<{
  candidates: readonly MigrationRetentionCandidate[];
  issues: readonly string[];
}>;

const MIGRATION_PATH =
  /^prisma\/migrations\/\d{14}_[a-z0-9_]+\/migration\.sql$/u;
const RETENTION_SEMANTIC_COLUMN =
  /(?:expires?|expiry|retention|archiv|delet|purg|eras|scheduledFor|completedAt)/iu;

const BASELINE =
  "prisma/migrations/20260630093000_baseline/migration.sql";
const BILLING_SNAPSHOTS =
  "prisma/migrations/20260702232228_add_core_billing_snapshots/migration.sql";
const ORGANIZATION_INVITATIONS =
  "prisma/migrations/20260703120000_add_organization_invitations/migration.sql";
const OPERATIONAL_ADMIN =
  "prisma/migrations/20260703123000_add_operational_admin_models/migration.sql";
const RETENTION_FOUNDATIONS =
  "prisma/migrations/20260703133000_add_retention_deletion_foundations/migration.sql";
const EXPORT_ARTIFACTS =
  "prisma/migrations/20260703140000_add_export_artifacts/migration.sql";
const CALL_FOUNDATIONS =
  "prisma/migrations/20260703153000_add_call_foundations/migration.sql";
const MESSAGING_FOUNDATIONS =
  "prisma/migrations/20260703160000_add_messaging_foundations/migration.sql";
const SOCIAL_ACTOR_MEDIA =
  "prisma/migrations/20260710134000_add_social_actor_media_foundation/migration.sql";
const REALTIME_AUTHORIZATION =
  "prisma/migrations/20260710135000_private_realtime_authorization/migration.sql";
const SIGNUP_OUTBOX =
  "prisma/migrations/20260714004000_add_signup_acceptance_outbox/migration.sql";
const USAGE_OUTBOX_LEASE =
  "prisma/migrations/20260715110000_add_usage_outbox_delivery_lease/migration.sql";

export const REVIEWED_MIGRATION_RETENTION_IMPACTS = [
  ...bindToSchedule(
    [key(BASELINE, "User", "deletionRequestedAt", "create-column"), key(BASELINE, "MemoryEntry", "deletedAt", "create-column")],
    "security.retention-schedule.deleted-account-data",
    "These account-graph lifecycle fields initiate or record user-data deletion. The deleted-account schedule supplies the bounded recovery window and final account-graph disposal rule; the columns are not evidence that cleanup has executed.",
  ),
  ...bindToSchedule(
    [key(BASELINE, "Listing", "expiresAt", "create-column"), key(BASELINE, "Listing", "archivedAt", "create-column")],
    "security.retention-schedule.listings",
    "Listing expiry and archive timestamps are lifecycle inputs to the listing schedule. That schedule starts its bounded disposal window after archive, deletion, or dispute closure; these fields alone do not perform content or media cleanup.",
  ),
  ...bindToSchedule(
    [
      key(BASELINE, "Message", "deletedBySenderAt", "create-column"),
      key(BASELINE, "Message", "deletedByRecipientAt", "create-column"),
      key(MESSAGING_FOUNDATIONS, "ConversationParticipant", "archivedAt", "create-column"),
    ],
    "security.retention-schedule.messages",
    "Participant deletion and archive markers affect private-message visibility and the point at which a valid retention purpose may end. The message schedule remains the authority for eventual content, attachment, and metadata disposal.",
  ),
  ...bindToSchedule(
    [key(BASELINE, "MediaAsset", "expiresAt", "create-column"), key(BASELINE, "MediaAsset", "deletedAt", "create-column")],
    "security.retention-schedule.media",
    "Media expiry and deletion markers are direct inputs to the media disposition lifecycle. The media schedule requires originals, derivatives, signed access, and caches to be removed; database timestamps do not prove those external effects.",
  ),
  ...bindToSchedule(
    [key(BASELINE, "AgentRun", "completedAt", "create-column")],
    "security.retention-schedule.ai-prompts-and-responses",
    "Agent-run completion starts the short recovery window for transient prompt and response content under the AI schedule. The completion timestamp is only a trigger marker and does not demonstrate provider-copy or database deletion.",
  ),
  ...bindToSchedule(
    [key(EXPORT_ARTIFACTS, "ExportArtifact", "completedAt", "create-column"), key(EXPORT_ARTIFACTS, "ExportArtifact", "expiresAt", "create-column")],
    "security.retention-schedule.exports",
    "Export completion and expiry bound the authenticated download window governed by the one-day export schedule. The fields define lifecycle timing but do not prove archive deletion, signed-access expiry, or audit minimisation.",
  ),
  ...bindToSchedule(
    [key(SOCIAL_ACTOR_MEDIA, "FeedPost", "deletedAt", "add-column")],
    "security.retention-schedule.posts",
    "The feed-post deletion marker changes visibility and supplies a disposal trigger for post content. The posts schedule retains responsibility for bounded purging, cache invalidation, and any narrowly held moderation evidence.",
  ),
  ...bindToSchedule(
    [key(SOCIAL_ACTOR_MEDIA, "FeedComment", "deletedAt", "add-column")],
    "security.retention-schedule.comments",
    "The feed-comment deletion marker changes visibility and supplies a disposal trigger for comment content. The comments schedule retains responsibility for bounded purging, identifier removal, and derived cache cleanup.",
  ),
  ...nonBinding(
    [
      key(BASELINE, "MediaAsset", "scanCompletedAt", "create-column"),
      key(SOCIAL_ACTOR_MEDIA, "MediaAsset", "processingCompletedAt", "add-column"),
      key(OPERATIONAL_ADMIN, "JobRun", "completedAt", "create-column"),
      key(RETENTION_FOUNDATIONS, "RetentionPolicy", "retentionDays", "create-column"),
      key(RETENTION_FOUNDATIONS, "DeletionJob", "scheduledFor", "create-column"),
      key(RETENTION_FOUNDATIONS, "DeletionJob", "completedAt", "create-column"),
    ],
    "lifecycle-marker-only",
    "These fields record processing, administration, policy metadata, or deletion-workflow timing. They can support later retention enforcement, but none is itself a record-specific disposal deadline or proof that primary/provider data was removed.",
  ),
  ...nonBinding(
    [
      key(BILLING_SNAPSHOTS, "EntitlementSnapshot", "expiresAt", "create-column"),
      key(ORGANIZATION_INVITATIONS, "OrganizationInvitation", "expiresAt", "create-column"),
      key(CALL_FOUNDATIONS, "CallInvite", "expiresAt", "create-column"),
      key(REALTIME_AUTHORIZATION, "RealtimeTopicGrant", "expiresAt", "create-column"),
      key(SIGNUP_OUTBOX, "SignupOutbox", "leaseExpiresAt", "create-column"),
      key(USAGE_OUTBOX_LEASE, "UsageOutbox", "leaseExpiresAt", "add-column"),
    ],
    "operational-validity-only",
    "These expiry fields bound entitlement, invitation, call, realtime-grant, or worker-lease validity. Expiry prevents stale use or claims; it is not a data-retention disposition and must not be represented as deleting the underlying record.",
  ),
] as const satisfies readonly MigrationRetentionReview[];

export const MIGRATION_RETENTION_IMPACT_REVIEW_SCOPE =
  "Source-only review of every retention-semantic column created, added, altered, renamed, or dropped across the complete checked-in Prisma migration history. Each exact migration operation must have an explicit decision that either binds it to an existing retention schedule or identifies it as an operational-validity or lifecycle marker that does not itself dispose of data. This verifies migration retention-impact review only; it does not assert retention-job execution, provider configuration, deletion completion, legal compliance, deployed-database parity, or production readiness.";

export const MIGRATION_RETENTION_IMPACT_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_RETENTION_IMPACT_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "prisma/migrations",
      "security/retention-schedule.ts",
      "security/migration-retention-impact-review-evidence.ts",
      "security/migration-retention-impact-review-evidence.test.ts",
    ],
  },
};

export function auditMigrationRetentionImpacts(
  sources: readonly MigrationRetentionSource[],
  reviews: readonly MigrationRetentionReview[],
  scheduleRequirementIds: readonly string[],
): MigrationRetentionAudit {
  const issues: string[] = [];
  const paths = sources.map(({ path }) => normalisePath(path));

  if (sources.length === 0) {
    issues.push("MIGRATION_RETENTION_SOURCE_INVENTORY_VACUOUS");
  }
  if (new Set(paths).size !== paths.length) {
    issues.push("MIGRATION_RETENTION_SOURCE_PATH_DUPLICATE");
  }
  for (const path of paths) {
    if (!MIGRATION_PATH.test(path)) {
      issues.push(`MIGRATION_RETENTION_SOURCE_PATH_INVALID:${path}`);
    }
  }

  const candidates = sources
    .flatMap(({ path, source }) =>
      discoverRetentionCandidates(normalisePath(path), source),
    )
    .sort((left, right) => left.key.localeCompare(right.key));

  if (candidates.length === 0) {
    issues.push("MIGRATION_RETENTION_CANDIDATE_INVENTORY_VACUOUS");
  }

  const candidateKeys = candidates.map(({ key }) => key);
  if (new Set(candidateKeys).size !== candidateKeys.length) {
    issues.push("MIGRATION_RETENTION_CANDIDATE_DUPLICATE");
  }

  const reviewKeys = reviews.map(({ key }) => key);
  if (reviews.length === 0) {
    issues.push("MIGRATION_RETENTION_REVIEW_INVENTORY_VACUOUS");
  }
  if (new Set(reviewKeys).size !== reviewKeys.length) {
    issues.push("MIGRATION_RETENTION_REVIEW_DUPLICATE");
  }

  const candidateKeySet = new Set(candidateKeys);
  const reviewKeySet = new Set(reviewKeys);
  for (const key of candidateKeys) {
    if (!reviewKeySet.has(key)) {
      issues.push(`MIGRATION_RETENTION_CANDIDATE_UNREVIEWED:${key}`);
    }
  }
  for (const key of reviewKeys) {
    if (!candidateKeySet.has(key)) {
      issues.push(`MIGRATION_RETENTION_REVIEW_STALE:${key}`);
    }
  }

  const scheduleIdSet = new Set(scheduleRequirementIds);
  if (scheduleIdSet.size === 0) {
    issues.push("MIGRATION_RETENTION_SCHEDULE_INVENTORY_VACUOUS");
  }
  if (scheduleIdSet.size !== scheduleRequirementIds.length) {
    issues.push("MIGRATION_RETENTION_SCHEDULE_DUPLICATE");
  }

  for (const review of reviews) {
    const rationale = review.rationale.trim();
    if (rationale.length < 100) {
      issues.push(`MIGRATION_RETENTION_RATIONALE_INCOMPLETE:${review.key}`);
    }
    if (review.decision === "retention-schedule-binding") {
      if (
        review.scheduleRequirementId === null ||
        !scheduleIdSet.has(review.scheduleRequirementId)
      ) {
        issues.push(`MIGRATION_RETENTION_SCHEDULE_INVALID:${review.key}`);
      }
    } else if (review.scheduleRequirementId !== null) {
      issues.push(`MIGRATION_RETENTION_NON_BINDING_HAS_SCHEDULE:${review.key}`);
    }
  }

  return { candidates, issues };
}

export function discoverRetentionCandidates(
  path: string,
  source: string,
): MigrationRetentionCandidate[] {
  const candidates: MigrationRetentionCandidate[] = [];
  const sql = maskSqlComments(source);

  for (const match of sql.matchAll(
    /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"([^"]+)"\s*\(([\s\S]*?)\)\s*;/giu,
  )) {
    const [, relation, body] = match;
    for (const columnMatch of body.matchAll(/^\s*"([^"]+)"\s+[^,\r\n]+/gmu)) {
      const column = columnMatch[1];
      if (RETENTION_SEMANTIC_COLUMN.test(column)) {
        candidates.push(candidate(path, relation, column, "create-column"));
      }
    }
  }

  for (const match of sql.matchAll(
    /ALTER\s+TABLE(?:\s+IF\s+EXISTS)?\s+"([^"]+)"([\s\S]*?);/giu,
  )) {
    const [, relation, body] = match;
    for (const add of body.matchAll(
      /ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/giu,
    )) {
      if (RETENTION_SEMANTIC_COLUMN.test(add[1])) {
        candidates.push(candidate(path, relation, add[1], "add-column"));
      }
    }
    for (const alter of body.matchAll(/ALTER\s+COLUMN\s+"([^"]+)"/giu)) {
      if (RETENTION_SEMANTIC_COLUMN.test(alter[1])) {
        candidates.push(candidate(path, relation, alter[1], "alter-column"));
      }
    }
    for (const rename of body.matchAll(
      /RENAME\s+COLUMN\s+"([^"]+)"\s+TO\s+"([^"]+)"/giu,
    )) {
      if (
        RETENTION_SEMANTIC_COLUMN.test(rename[1]) ||
        RETENTION_SEMANTIC_COLUMN.test(rename[2])
      ) {
        candidates.push(
          candidate(
            path,
            relation,
            `${rename[1]}->${rename[2]}`,
            "rename-column",
          ),
        );
      }
    }
    for (const drop of body.matchAll(
      /DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/giu,
    )) {
      if (RETENTION_SEMANTIC_COLUMN.test(drop[1])) {
        candidates.push(candidate(path, relation, drop[1], "drop-column"));
      }
    }
  }

  return candidates;
}

function bindToSchedule(
  keys: readonly string[],
  scheduleRequirementId: `security.retention-schedule.${string}`,
  rationale: string,
): MigrationRetentionReview[] {
  return keys.map((reviewKey) => ({
    key: reviewKey,
    decision: "retention-schedule-binding",
    scheduleRequirementId,
    rationale,
  }));
}

function nonBinding(
  keys: readonly string[],
  decision: "operational-validity-only" | "lifecycle-marker-only",
  rationale: string,
): MigrationRetentionReview[] {
  return keys.map((reviewKey) => ({
    key: reviewKey,
    decision,
    scheduleRequirementId: null,
    rationale,
  }));
}

function key(
  path: string,
  relation: string,
  column: string,
  operation: MigrationRetentionOperation,
) {
  return `${path}#${relation}.${column}:${operation}`;
}

function candidate(
  path: string,
  relation: string,
  column: string,
  operation: MigrationRetentionOperation,
): MigrationRetentionCandidate {
  return {
    key: `${path}#${relation}.${column}:${operation}`,
    path,
    relation,
    column,
    operation,
  };
}

function maskSqlComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\r\n]/gu, " "))
    .replace(/--[^\r\n]*/gu, (comment) => " ".repeat(comment.length));
}

function normalisePath(path: string) {
  return path.replaceAll("\\", "/");
}
