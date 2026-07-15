export const MIGRATION_BACKUP_REQUIREMENT_REVIEW_REQUIREMENT_ID =
  "security.migration-review.backup";

export type MigrationBackupSource = Readonly<{
  path: string;
  source: string;
}>;

export type MigrationDataMutationRecord = Readonly<{
  path: string;
  line: number;
  operation: "delete" | "truncate" | "update";
  relation: string;
  decision:
    | "backup-required-before-production"
    | "no-preexisting-data-in-new-relation";
}>;

export type ReviewedNonDmlBackupRequirement = Readonly<{
  riskKey: string;
  decision:
    | "backup-required-before-production"
    | "no-backup-for-new-disposable-relation";
  disposition: string;
}>;

export const REVIEWED_NON_DML_BACKUP_REQUIREMENTS = [
  {
    riskKey:
      "prisma/migrations/20260702090000_rename_supabase_uid_to_workos_user_id/migration.sql:1:User.supabaseUid:column-rename:RENAME COLUMN supabaseUid TO workosUserId",
    decision: "backup-required-before-production",
    disposition:
      "The identity-column rename changes a persisted contract. Before any equivalent production execution, an approved restorable database snapshot or point-in-time recovery marker is required and restoration must be tested separately. This record identifies the requirement; it does not assert a backup exists.",
  },
  {
    riskKey:
      "prisma/migrations/20260705120000_add_rate_limit_and_call_type/migration.sql:14:RateLimit:table-persistence:SET UNLOGGED",
    decision: "no-backup-for-new-disposable-relation",
    disposition:
      "RateLimit is created in this migration and stores disposable abuse-control counters, so this exact source-history persistence change has no pre-existing rows requiring backup. Applying SET UNLOGGED to an existing relation would require a new review and recovery decision.",
  },
] as const satisfies readonly ReviewedNonDmlBackupRequirement[];

export function auditMigrationBackupRequirements(
  sources: readonly MigrationBackupSource[],
) {
  const issues: string[] = [];
  const records: MigrationDataMutationRecord[] = [];
  const paths = new Set<string>();

  if (sources.length < 1) issues.push("MIGRATION_BACKUP_SOURCE_INVENTORY_VACUOUS");
  for (const source of sources.toSorted((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    const path = source.path.replaceAll("\\", "/");
    if (!path || paths.has(path)) {
      issues.push(`MIGRATION_BACKUP_SOURCE_PATH_INVALID:${path || "missing"}`);
      continue;
    }
    paths.add(path);
    const sql = maskStoredRoutineBodies(maskSqlComments(source.source));
    const createdRelations = collectCreatedRelations(sql);
    const mutationSql = maskNonMutationUpdateKeywords(sql);
    const searchableSql = maskQuotedIdentifierContents(mutationSql);

    collectMutations(
      path,
      mutationSql,
      searchableSql,
      "update",
      /(\bUPDATE\s+(?:ONLY\s+)?)((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))*)/giu,
      createdRelations,
      records,
      issues,
    );
    collectMutations(
      path,
      mutationSql,
      searchableSql,
      "delete",
      /(\bDELETE\s+FROM\s+(?:ONLY\s+)?)((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))*)/giu,
      createdRelations,
      records,
      issues,
    );
    collectMutations(
      path,
      mutationSql,
      searchableSql,
      "truncate",
      /(\bTRUNCATE(?:\s+TABLE)?\s+(?:ONLY\s+)?)((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))*)/giu,
      createdRelations,
      records,
      issues,
    );
  }

  if (records.length < 1) issues.push("MIGRATION_BACKUP_MUTATION_INVENTORY_VACUOUS");
  return {
    records: records.toSorted(
      (left, right) =>
        left.path.localeCompare(right.path) ||
        left.line - right.line ||
        left.operation.localeCompare(right.operation),
    ),
    issues: [...new Set(issues)].sort(),
    requiredBackupCount: records.filter(
      ({ decision }) => decision === "backup-required-before-production",
    ).length,
    newRelationCount: records.filter(
      ({ decision }) => decision === "no-preexisting-data-in-new-relation",
    ).length,
  } as const;
}

export function auditReviewedNonDmlBackupRequirements(
  riskKeys: readonly string[],
  reviews: readonly ReviewedNonDmlBackupRequirement[] =
    REVIEWED_NON_DML_BACKUP_REQUIREMENTS,
) {
  const issues: string[] = [];
  const reviewKeys = reviews.map(({ riskKey }) => riskKey);
  const reviewSet = new Set(reviewKeys);
  const riskSet = new Set(riskKeys);
  if (riskKeys.length < 1) issues.push("MIGRATION_BACKUP_NON_DML_RISKS_VACUOUS");
  if (reviewSet.size !== reviewKeys.length) {
    issues.push("MIGRATION_BACKUP_NON_DML_REVIEW_DUPLICATE");
  }
  for (const review of reviews) {
    if (
      review.disposition.length < 160 ||
      !/\bbackup\b/iu.test(review.disposition) ||
      !/\b(?:production|pre-existing)\b/iu.test(review.disposition)
    ) {
      issues.push(`MIGRATION_BACKUP_NON_DML_DISPOSITION_INCOMPLETE:${review.riskKey}`);
    }
    if (!riskSet.has(review.riskKey)) {
      issues.push(`MIGRATION_BACKUP_NON_DML_REVIEW_STALE:${review.riskKey}`);
    }
  }
  for (const riskKey of riskKeys) {
    if (!reviewSet.has(riskKey)) {
      issues.push(`MIGRATION_BACKUP_NON_DML_RISK_UNREVIEWED:${riskKey}`);
    }
  }
  return [...new Set(issues)].sort();
}

function collectMutations(
  path: string,
  sql: string,
  searchableSql: string,
  operation: MigrationDataMutationRecord["operation"],
  pattern: RegExp,
  createdRelations: ReadonlyMap<string, number>,
  records: MigrationDataMutationRecord[],
  issues: string[],
) {
  for (const match of searchableSql.matchAll(pattern)) {
    const relationStart = match.index + match[1].length;
    const relation = normalizeIdentifier(
      sql.slice(relationStart, relationStart + match[2].length),
    );
    if (SQL_CONTEXT_KEYWORDS.has(relation.toUpperCase())) {
      issues.push(
        `MIGRATION_BACKUP_MUTATION_CONTEXT_UNREVIEWED:${path}:${lineAt(sql, match.index)}:${relation}`,
      );
      continue;
    }
    const createdAt = createdRelations.get(relation);
    records.push({
      path,
      line: lineAt(sql, match.index),
      operation,
      relation,
      decision:
        createdAt !== undefined && createdAt < match.index
          ? "no-preexisting-data-in-new-relation"
          : "backup-required-before-production",
    });
  }
}

const SQL_CONTEXT_KEYWORDS = new Set([
  "CASCADE",
  "NO",
  "OF",
  "ON",
  "SET",
  "SKIP",
]);

function collectCreatedRelations(sql: string) {
  const relations = new Map<string, number>();
  for (const match of sql.matchAll(
    /\bCREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))*)/giu,
  )) {
    relations.set(normalizeIdentifier(match[1]), match.index);
  }
  return relations;
}

function maskNonMutationUpdateKeywords(source: string) {
  return source.replace(
    /\b(?:DO\s+UPDATE|FOR\s+(?:NO\s+KEY\s+)?UPDATE|ON\s+UPDATE|BEFORE\s+UPDATE|AFTER\s+UPDATE|OR\s+UPDATE)\b/giu,
    (value) => " ".repeat(value.length),
  );
}

function maskQuotedIdentifierContents(source: string) {
  return source.replace(/"(?:[^"]|"")*"/gu, (identifier) =>
    `"${"x".repeat(Math.max(0, identifier.length - 2))}"`,
  );
}

function maskStoredRoutineBodies(source: string) {
  let result = source;
  const routines = [...source.matchAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/giu)];
  for (const routine of routines.toReversed()) {
    const header = source.slice(routine.index);
    const bodyStart = /\bAS\s+(\$[A-Za-z_0-9]*\$)/iu.exec(header);
    if (!bodyStart) continue;
    const delimiter = bodyStart[1];
    const contentStart = routine.index + bodyStart.index + bodyStart[0].length;
    const contentEnd = source.indexOf(delimiter, contentStart);
    if (contentEnd < 0) continue;
    const content = result.slice(contentStart, contentEnd);
    result = `${result.slice(0, contentStart)}${content.replace(/[^\n]/gu, " ")}${result.slice(contentEnd)}`;
  }
  return result;
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

function lineAt(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

export const MIGRATION_BACKUP_REQUIREMENT_REVIEW_SCOPE =
  "Every executable migration UPDATE, DELETE and TRUNCATE outside stored-routine definitions receives an explicit source decision: existing-relation mutations require an approved restorable snapshot or point-in-time marker before production, while relations created earlier in the same migration have no pre-existing rows. The exact contract rename and disposable-table rewrite have separate bound decisions. This verifies backup-requirement review only; it does not assert a backup, provider policy, restore test, deployed data volume or production readiness.";

export const MIGRATION_BACKUP_REQUIREMENT_REVIEW_EVIDENCE = [
  "prisma/migrations",
  "security/migration-backward-compatibility-review-evidence.ts",
  "security/migration-table-rewrite-review-evidence.ts",
  "security/migration-backup-requirement-review-evidence.ts",
  "security/migration-backup-requirement-review-evidence.test.ts",
] as const;

export const MIGRATION_BACKUP_REQUIREMENT_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_BACKUP_REQUIREMENT_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: MIGRATION_BACKUP_REQUIREMENT_REVIEW_EVIDENCE,
  },
} as const;
