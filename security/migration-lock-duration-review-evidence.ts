export const MIGRATION_LOCK_DURATION_REVIEW_REQUIREMENT_ID =
  "security.migration-review.lock";

export type MigrationLockSource = Readonly<{
  path: string;
  source: string;
}>;

export type MigrationLockStrategy =
  | "existing-blocking-operation"
  | "existing-catalog-operation"
  | "existing-rewrite-operation"
  | "existing-validation-scan"
  | "new-relation-operation";

export type MigrationLockRecord = Readonly<{
  path: string;
  line: number;
  relation: string;
  signature: string;
  strategy: MigrationLockStrategy;
}>;

export type ReviewedBlockingAlterTable = Readonly<{
  path: string;
  signature: string;
  disposition: string;
}>;

const IDENTIFIER = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const QUALIFIED_IDENTIFIER = String.raw`${IDENTIFIER}(?:\s*\.\s*${IDENTIFIER})*`;

const TRIGGER_TOGGLE_LOCK_DISPOSITION =
  "This exact trigger toggle is accepted only in the pre-production migration history where it brackets a deterministic actor backfill. Any equivalent production change requires representative row counts, a measured maintenance window, lock timeout, monitoring and an abort plan.";

export const REVIEWED_BLOCKING_ALTER_TABLES = [
  ...[
    "ALTER TABLE FeedPost DISABLE TRIGGER giq_feed_post_pro_write;",
    "ALTER TABLE Message DISABLE TRIGGER giq_message_pro_write;",
    "ALTER TABLE Conversation DISABLE TRIGGER giq_conversation_pro_write;",
    "ALTER TABLE FeedPost ENABLE TRIGGER giq_feed_post_pro_write;",
    "ALTER TABLE Message ENABLE TRIGGER giq_message_pro_write;",
    "ALTER TABLE Conversation ENABLE TRIGGER giq_conversation_pro_write;",
  ].map((signature) => ({
    path: "prisma/migrations/20260710134000_add_social_actor_media_foundation/migration.sql",
    signature,
    disposition: TRIGGER_TOGGLE_LOCK_DISPOSITION,
  })),
  ...[
    "ALTER TABLE Conversation DISABLE TRIGGER giq_conversation_pro_write;",
    "ALTER TABLE Conversation ENABLE TRIGGER giq_conversation_pro_write;",
  ].map((signature) => ({
    path: "prisma/migrations/20260710138000_actor_scoped_conversations/migration.sql",
    signature,
    disposition: TRIGGER_TOGGLE_LOCK_DISPOSITION,
  })),
] as const satisfies readonly ReviewedBlockingAlterTable[];

export function auditMigrationLockDuration(
  sources: readonly MigrationLockSource[],
  reviews: readonly ReviewedBlockingAlterTable[] =
    REVIEWED_BLOCKING_ALTER_TABLES,
) {
  const records: MigrationLockRecord[] = [];
  const issues: string[] = [];
  const sourcePaths = new Set<string>();

  if (sources.length < 1) issues.push("MIGRATION_LOCK_SOURCE_INVENTORY_VACUOUS");
  for (const source of sources.toSorted((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    const sourcePath = source.path.replaceAll("\\", "/");
    if (!sourcePath || sourcePaths.has(sourcePath)) {
      issues.push(`MIGRATION_LOCK_SOURCE_PATH_INVALID:${sourcePath || "missing"}`);
      continue;
    }
    sourcePaths.add(sourcePath);
    const sql = maskSqlComments(source.source);
    const occurrences = [...sql.matchAll(/\bALTER\s+TABLE\b/giu)].length;
    const statements = [
      ...sql.matchAll(
        new RegExp(
          `\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(${QUALIFIED_IDENTIFIER})\\s+([\\s\\S]*?);`,
          "giu",
        ),
      ),
    ];
    const dynamicForceStatements = [
      ...sql.matchAll(/\bALTER\s+TABLE\s+%s\s+FORCE\s+ROW\s+LEVEL\s+SECURITY\b/giu),
    ];
    if (statements.length + dynamicForceStatements.length !== occurrences) {
      issues.push(
        `MIGRATION_LOCK_ALTER_PARSE_COVERAGE_MISMATCH:${sourcePath}:${statements.length + dynamicForceStatements.length}/${occurrences}`,
      );
    }

    const createdRelations = new Set(
      [
        ...sql.matchAll(
          new RegExp(
            `\\bCREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${QUALIFIED_IDENTIFIER})`,
            "giu",
          ),
        ),
      ].map((match) => normalizeIdentifier(match[1])),
    );

    for (const match of statements) {
      const relation = normalizeIdentifier(match[1]);
      const body = normalizeSql(match[2]);
      const strategy = classifyAlterTable(relation, body, createdRelations);
      const line = lineAt(sql, match.index);
      if (!strategy) {
        issues.push(
          `MIGRATION_LOCK_ALTER_OPERATION_UNCLASSIFIED:${sourcePath}:${line}`,
        );
        continue;
      }
      const record = {
        path: sourcePath,
        line,
        relation,
        signature: `ALTER TABLE ${relation} ${body};`,
        strategy,
      } as const;
      records.push(record);
    }
    for (const match of dynamicForceStatements) {
      records.push({
        path: sourcePath,
        line: lineAt(sql, match.index),
        relation: "%s",
        signature: "ALTER TABLE %s FORCE ROW LEVEL SECURITY;",
        strategy: "existing-catalog-operation",
      });
    }

    rejectMatches(
      sourcePath,
      sql,
      /\b(?:TRUNCATE|VACUUM\s+FULL|CLUSTER|REINDEX|LOCK\s+TABLE)\b/giu,
      "MIGRATION_LOCK_UNBOUNDED_MAINTENANCE_FORBIDDEN",
      issues,
    );
    rejectMatches(
      sourcePath,
      sql,
      /\bREFRESH\s+MATERIALIZED\s+VIEW\s+(?!CONCURRENTLY\b)/giu,
      "MIGRATION_LOCK_NONCONCURRENT_REFRESH_FORBIDDEN",
      issues,
    );
  }

  validateBlockingReviews(records, reviews, issues);
  for (const record of records.filter(
    ({ strategy }) => strategy === "existing-rewrite-operation",
  )) {
    issues.push(
      `MIGRATION_LOCK_REWRITE_OPERATION_UNREVIEWED:${record.path}:${record.line}`,
    );
  }
  if (records.length < 1) issues.push("MIGRATION_LOCK_ALTER_INVENTORY_VACUOUS");

  return {
    records,
    issues: [...new Set(issues)].sort(),
    counts: Object.fromEntries(
      [
        "new-relation-operation",
        "existing-catalog-operation",
        "existing-validation-scan",
        "existing-rewrite-operation",
        "existing-blocking-operation",
      ].map((strategy) => [
        strategy,
        records.filter((record) => record.strategy === strategy).length,
      ]),
    ) as Readonly<Record<MigrationLockStrategy, number>>,
  } as const;
}

function classifyAlterTable(
  relation: string,
  body: string,
  createdRelations: ReadonlySet<string>,
): MigrationLockStrategy | undefined {
  if (createdRelations.has(relation)) return "new-relation-operation";
  if (/\b(?:SET\s+(?:UNLOGGED|LOGGED)|(?:DISABLE|ENABLE)\s+TRIGGER)\b/iu.test(body)) {
    return "existing-blocking-operation";
  }
  if (/\b(?:ALTER\s+COLUMN\b[\s\S]*\bTYPE\b|SET\s+DATA\s+TYPE\b)/iu.test(body)) {
    return "existing-rewrite-operation";
  }
  if (
    /\b(?:ADD\s+CONSTRAINT|VALIDATE\s+CONSTRAINT|SET\s+NOT\s+NULL)\b/iu.test(
      body,
    )
  ) {
    return "existing-validation-scan";
  }
  if (
    /^(?:ADD\s+COLUMN|DROP\s+COLUMN|ALTER\s+COLUMN|RENAME\s+(?:COLUMN|TO)|DROP\s+CONSTRAINT|ENABLE\s+ROW\s+LEVEL\s+SECURITY|FORCE\s+ROW\s+LEVEL\s+SECURITY|REPLICA\s+IDENTITY|OWNER\s+TO)\b/iu.test(
      body,
    )
  ) {
    return "existing-catalog-operation";
  }
  return undefined;
}

function validateBlockingReviews(
  records: readonly MigrationLockRecord[],
  reviews: readonly ReviewedBlockingAlterTable[],
  issues: string[],
) {
  const seen = new Set<string>();
  for (const review of reviews) {
    const key = reviewKey(review.path, review.signature);
    if (seen.has(key)) issues.push(`MIGRATION_LOCK_BLOCKING_REVIEW_DUPLICATE:${key}`);
    seen.add(key);
    if (
      review.disposition.length < 140 ||
      !/\bpre-production\b/iu.test(review.disposition) ||
      !/\bmaintenance window\b/iu.test(review.disposition) ||
      !/\babort\b/iu.test(review.disposition)
    ) {
      issues.push(`MIGRATION_LOCK_BLOCKING_DISPOSITION_INCOMPLETE:${key}`);
    }
  }

  const matched = new Set<string>();
  for (const record of records.filter(
    ({ strategy }) => strategy === "existing-blocking-operation",
  )) {
    const key = reviewKey(record.path, record.signature);
    if (!seen.has(key)) {
      issues.push(`MIGRATION_LOCK_BLOCKING_OPERATION_UNREVIEWED:${record.path}:${record.line}`);
    } else {
      matched.add(key);
    }
  }
  for (const review of reviews) {
    const key = reviewKey(review.path, review.signature);
    if (!matched.has(key)) issues.push(`MIGRATION_LOCK_BLOCKING_REVIEW_STALE:${key}`);
  }
}

function rejectMatches(
  path: string,
  sql: string,
  pattern: RegExp,
  issue: string,
  issues: string[],
) {
  for (const match of sql.matchAll(pattern)) {
    issues.push(`${issue}:${path}:${lineAt(sql, match.index)}`);
  }
}

function maskSqlComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) =>
      comment.replace(/[^\n]/gu, " "),
    )
    .replace(/--[^\n]*/gu, (comment) => " ".repeat(comment.length));
}

function normalizeIdentifier(value: string) {
  return value.replace(/\s+/gu, "").replaceAll('"', "");
}

function normalizeSql(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function reviewKey(path: string, signature: string) {
  return `${path}:${signature}`;
}

function lineAt(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

export const MIGRATION_LOCK_DURATION_REVIEW_SCOPE =
  "Every ALTER TABLE in the hash-frozen migration inventory is parsed and classified as new-relation, catalog-only, validation-scan, rewrite, or explicitly reviewed blocking work. Index locks are joined to the exact index-creation review; unbounded maintenance and non-concurrent materialized-view refresh are forbidden. This source review does not claim measured lock duration on deployed data: equivalent production changes require representative timing, a maintenance window, lock timeout, monitoring and abort plan.";

export const MIGRATION_LOCK_DURATION_REVIEW_EVIDENCE = [
  "prisma/migrations",
  "security/migration-index-creation-review-evidence.ts",
  "security/migration-index-creation-review-evidence.test.ts",
  "security/migration-lock-duration-review-evidence.ts",
  "security/migration-lock-duration-review-evidence.test.ts",
] as const;

export const MIGRATION_LOCK_DURATION_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_LOCK_DURATION_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: MIGRATION_LOCK_DURATION_REVIEW_EVIDENCE,
  },
} as const;
