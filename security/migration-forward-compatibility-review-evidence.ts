export const MIGRATION_FORWARD_COMPATIBILITY_REVIEW_REQUIREMENT_ID =
  "security.migration-review.forward";

export type MigrationForwardSource = Readonly<{
  path: string;
  source: string;
}>;

export type MigrationForwardReviewFacts = Readonly<{
  migrationProvider: string;
  migrationCount: number;
  structureIssues: readonly string[];
  backwardCompatibilityIssues: readonly string[];
  backwardCompatibilityRiskCount: number;
  nullabilityIssueCount: number;
  addedColumnCount: number;
  defaultValueIssueCount: number;
  reviewedDefaultCount: number;
  tableRewriteIssues: readonly string[];
  tableRewriteRiskCount: number;
  constraintValidationIssues: readonly string[];
  constraintCount: number;
  pendingConstraintCount: number;
  indexCreationIssues: readonly string[];
  indexCount: number;
  reviewedImmediateIndexCount: number;
  lockDurationIssues: readonly string[];
  alterTableCount: number;
}>;

export function auditMigrationForwardStructure(
  sources: readonly MigrationForwardSource[],
) {
  const issues: string[] = [];
  const paths = new Set<string>();
  const timestamps = new Set<string>();
  const names = new Set<string>();
  const records: Array<Readonly<{ path: string; timestamp: string; name: string }>> = [];

  if (sources.length < 1) {
    issues.push("FORWARD_COMPATIBILITY_SOURCE_INVENTORY_VACUOUS");
  }
  for (const source of sources) {
    const path = source.path.replaceAll("\\", "/");
    if (!path || paths.has(path)) {
      issues.push(`FORWARD_COMPATIBILITY_SOURCE_PATH_INVALID:${path || "missing"}`);
      continue;
    }
    paths.add(path);
    const pathMatch =
      /^prisma\/migrations\/(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\/migration\.sql$/u.exec(
        path,
      );
    if (!pathMatch) {
      issues.push(`FORWARD_COMPATIBILITY_MIGRATION_NAME_INVALID:${path}`);
      continue;
    }
    const [, timestamp, name] = pathMatch;
    if (timestamps.has(timestamp)) {
      issues.push(`FORWARD_COMPATIBILITY_TIMESTAMP_DUPLICATE:${timestamp}`);
    }
    if (names.has(`${timestamp}_${name}`)) {
      issues.push(`FORWARD_COMPATIBILITY_MIGRATION_DUPLICATE:${timestamp}_${name}`);
    }
    timestamps.add(timestamp);
    names.add(`${timestamp}_${name}`);
    records.push({ path, timestamp, name });

    const sql = maskSqlComments(source.source);
    if (!sql.trim()) {
      issues.push(`FORWARD_COMPATIBILITY_MIGRATION_EMPTY:${path}`);
    }
    if (/^\s*--\s*(?:migrate:?\s*down|down\s+migration)\b/imu.test(source.source)) {
      issues.push(`FORWARD_COMPATIBILITY_INLINE_DOWN_MIGRATION_FORBIDDEN:${path}`);
    }
    for (const [pattern, code] of FORBIDDEN_FORWARD_OPERATIONS) {
      if (pattern.test(sql)) {
        issues.push(`FORWARD_COMPATIBILITY_${code}:${path}`);
      }
    }
  }

  return {
    records: records.toSorted(
      (left, right) =>
        left.timestamp.localeCompare(right.timestamp) ||
        left.name.localeCompare(right.name),
    ),
    issues: [...new Set(issues)].sort(),
  } as const;
}

const FORBIDDEN_FORWARD_OPERATIONS = [
  [/\bCREATE\s+DATABASE\b/iu, "CREATE_DATABASE_FORBIDDEN"],
  [/\bDROP\s+DATABASE\b/iu, "DROP_DATABASE_FORBIDDEN"],
  [/\bDROP\s+SCHEMA\b/iu, "DROP_SCHEMA_FORBIDDEN"],
  [/\bALTER\s+SYSTEM\b/iu, "ALTER_SYSTEM_FORBIDDEN"],
  [/\bREASSIGN\s+OWNED\b/iu, "REASSIGN_OWNED_FORBIDDEN"],
  [/\bDROP\s+OWNED\b/iu, "DROP_OWNED_FORBIDDEN"],
  [/\bSET\s+(?:LOCAL\s+|SESSION\s+)?session_replication_role\b/iu, "REPLICATION_ROLE_BYPASS_FORBIDDEN"],
] as const satisfies readonly (readonly [RegExp, string])[];

export function assessMigrationForwardCompatibility(
  facts: MigrationForwardReviewFacts,
) {
  const issues: string[] = [];
  if (facts.migrationProvider !== "postgresql") {
    issues.push("FORWARD_COMPATIBILITY_PROVIDER_UNEXPECTED");
  }
  if (facts.migrationCount < 90) {
    issues.push("FORWARD_COMPATIBILITY_MIGRATION_INVENTORY_INCOMPLETE");
  }
  addChildIssues("STRUCTURE", facts.structureIssues, issues);
  addChildIssues(
    "BACKWARD_CONTRACT",
    facts.backwardCompatibilityIssues,
    issues,
  );
  if (facts.backwardCompatibilityRiskCount < 1) {
    issues.push("FORWARD_COMPATIBILITY_CONTRACT_REVIEW_VACUOUS");
  }
  if (facts.nullabilityIssueCount !== 0 || facts.addedColumnCount < 90) {
    issues.push("FORWARD_COMPATIBILITY_NULLABILITY_REVIEW_INCOMPLETE");
  }
  if (facts.defaultValueIssueCount !== 0 || facts.reviewedDefaultCount < 200) {
    issues.push("FORWARD_COMPATIBILITY_DEFAULT_REVIEW_INCOMPLETE");
  }
  addChildIssues("TABLE_REWRITE", facts.tableRewriteIssues, issues);
  if (facts.tableRewriteRiskCount < 1) {
    issues.push("FORWARD_COMPATIBILITY_REWRITE_REVIEW_VACUOUS");
  }
  addChildIssues(
    "CONSTRAINT_VALIDATION",
    facts.constraintValidationIssues,
    issues,
  );
  if (facts.constraintCount < 300 || facts.pendingConstraintCount < 1) {
    issues.push("FORWARD_COMPATIBILITY_CONSTRAINT_REVIEW_INCOMPLETE");
  }
  addChildIssues("INDEX_CREATION", facts.indexCreationIssues, issues);
  if (facts.indexCount < 400 || facts.reviewedImmediateIndexCount < 1) {
    issues.push("FORWARD_COMPATIBILITY_INDEX_REVIEW_INCOMPLETE");
  }
  addChildIssues("LOCK_DURATION", facts.lockDurationIssues, issues);
  if (facts.alterTableCount < 400) {
    issues.push("FORWARD_COMPATIBILITY_LOCK_REVIEW_INCOMPLETE");
  }
  return [...new Set(issues)].sort();
}

function addChildIssues(
  family: string,
  childIssues: readonly string[],
  issues: string[],
) {
  for (const issue of childIssues) {
    issues.push(`FORWARD_COMPATIBILITY_${family}:${issue}`);
  }
}

function maskSqlComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) =>
      comment.replace(/[^\n]/gu, " "),
    )
    .replace(/--[^\n]*/gu, (comment) => " ".repeat(comment.length));
}

export const MIGRATION_FORWARD_COMPATIBILITY_REVIEW_SCOPE =
  "The exact ordered PostgreSQL migration source inventory is reviewed structurally and composed with the complete backward-contract, nullability, default, table-rewrite, constraint-validation, index-creation and lock-duration source audits. Unsafe database-wide operations and inline down migrations fail closed. This verifies the source review obligation only; it does not claim zero-downtime rolling compatibility, successful replay, deployed schema parity, representative data behavior or production readiness.";

export const MIGRATION_FORWARD_COMPATIBILITY_REVIEW_EVIDENCE = [
  "prisma/schema.prisma",
  "prisma/migrations",
  "prisma/migrations/migration_lock.toml",
  "scripts/check-database-compatibility-inventory.ts",
  "security/migration-backward-compatibility-review-evidence.ts",
  "security/migration-nullability-review-evidence.ts",
  "security/migration-default-value-review-evidence.ts",
  "security/migration-table-rewrite-review-evidence.ts",
  "security/migration-constraint-validation-review-evidence.ts",
  "security/migration-index-creation-review-evidence.ts",
  "security/migration-lock-duration-review-evidence.ts",
  "security/migration-forward-compatibility-review-evidence.ts",
  "security/migration-forward-compatibility-review-evidence.test.ts",
] as const;

export const MIGRATION_FORWARD_COMPATIBILITY_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_FORWARD_COMPATIBILITY_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: MIGRATION_FORWARD_COMPATIBILITY_REVIEW_EVIDENCE,
  },
} as const;
