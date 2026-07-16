import {
  auditDatabaseConstraintInventory,
  type ConstraintInventoryRecord,
  type ConstraintSource,
} from "./database-constraint-inventory-evidence";

export const MIGRATION_CONSTRAINT_VALIDATION_REVIEW_REQUIREMENT_ID =
  "security.migration-review.constraint-validation";

export type ConstraintValidationStrategy =
  | "deferred-pending"
  | "deferred-validated"
  | "new-nullable-column-immediate"
  | "new-nullable-column-null-guarded-check"
  | "new-table-immediate"
  | "unreviewed-immediate";

export type ConstraintValidationRecord = ConstraintInventoryRecord &
  Readonly<{ strategy: ConstraintValidationStrategy }>;

export type ReviewedPendingConstraint = Readonly<{
  sourceFile: string;
  table: string;
  name: string;
  disposition: string;
}>;

export const REVIEWED_PENDING_CONSTRAINTS = [
  {
    sourceFile:
      "prisma/migrations/20260710134000_add_social_actor_media_foundation/migration.sql",
    table: "FeedPost",
    name: "giq_feed_post_visibility_check",
    disposition:
      "The constraint is intentionally NOT VALID: new and updated rows are constrained without scanning historical FeedPost rows. Historical validation remains explicit follow-up work and this record must be removed only when a later VALIDATE CONSTRAINT is present in source.",
  },
  {
    sourceFile:
      "prisma/migrations/20260710134000_add_social_actor_media_foundation/migration.sql",
    table: "FeedReaction",
    name: "giq_feed_reaction_target_xor_check",
    disposition:
      "The target XOR constraint is intentionally NOT VALID so historical FeedReaction rows are not scanned during this migration while every new or updated row is checked. A later source migration must validate it after data reconciliation.",
  },
  {
    sourceFile:
      "prisma/migrations/20260710134000_add_social_actor_media_foundation/migration.sql",
    table: "FeedReaction",
    name: "giq_feed_reaction_type_check",
    disposition:
      "The reaction-type allowlist is intentionally NOT VALID to avoid an immediate historical-table scan while enforcing the allowlist for new or updated rows. Historical rows require reconciliation followed by an explicit source VALIDATE CONSTRAINT.",
  },
] as const satisfies readonly ReviewedPendingConstraint[];

export function auditMigrationConstraintValidation(
  sources: readonly ConstraintSource[],
  reviews: readonly ReviewedPendingConstraint[] = REVIEWED_PENDING_CONSTRAINTS,
) {
  const inventory = auditDatabaseConstraintInventory(sources);
  const issues = inventory.issues.map(
    (issue) => `CONSTRAINT_VALIDATION_INVENTORY_INCOMPLETE:${issue}`,
  );
  const sourceByPath = new Map(sources.map((source) => [source.path, source.source]));
  const validationKeys = collectValidationKeys(sources);
  const records: ConstraintValidationRecord[] = [];
  const reviewKeys = reviews.map(pendingReviewKey);
  const reviewSet = new Set(reviewKeys);

  if (sources.length < 1) {
    issues.push("CONSTRAINT_VALIDATION_SOURCE_INVENTORY_VACUOUS");
  }
  if (reviewSet.size !== reviewKeys.length) {
    issues.push("CONSTRAINT_VALIDATION_REVIEW_DUPLICATE");
  }
  if (reviews.some(({ disposition }) => disposition.trim().length < 100)) {
    issues.push("CONSTRAINT_VALIDATION_DISPOSITION_INCOMPLETE");
  }

  for (const constraint of inventory.records) {
    const source = sourceByPath.get(constraint.sourceFile);
    if (!source) {
      issues.push(
        `CONSTRAINT_VALIDATION_SOURCE_MISSING:${constraint.sourceFile}:${constraint.table}.${constraint.name}`,
      );
      continue;
    }
    const occurrence = findConstraintOccurrence(source, constraint.name);
    if (!occurrence) {
      issues.push(
        `CONSTRAINT_VALIDATION_DEFINITION_MISSING:${constraint.sourceFile}:${constraint.table}.${constraint.name}`,
      );
      continue;
    }
    const key = constraintKey(constraint.sourceFile, constraint.table, constraint.name);
    const strategy = classifyStrategy(
      constraint,
      source,
      occurrence.offset,
      occurrence.definition,
      validationKeys.has(key),
    );
    records.push({ ...constraint, strategy });
    if (strategy === "deferred-pending" && !reviewSet.has(key)) {
      issues.push(`CONSTRAINT_VALIDATION_PENDING_UNREVIEWED:${key}`);
    }
    if (strategy === "unreviewed-immediate") {
      issues.push(`CONSTRAINT_VALIDATION_IMMEDIATE_UNREVIEWED:${key}`);
    }
  }

  const pendingSet = new Set(
    records
      .filter(({ strategy }) => strategy === "deferred-pending")
      .map(({ sourceFile, table, name }) => constraintKey(sourceFile, table, name)),
  );
  for (const review of reviews) {
    if (!pendingSet.has(pendingReviewKey(review))) {
      issues.push(`CONSTRAINT_VALIDATION_REVIEW_STALE:${pendingReviewKey(review)}`);
    }
  }

  return {
    records: records.toSorted(
      (left, right) =>
        left.sourceFile.localeCompare(right.sourceFile) ||
        left.table.localeCompare(right.table) ||
        left.name.localeCompare(right.name),
    ),
    issues: [...new Set(issues)].toSorted(),
  };
}

export const MIGRATION_CONSTRAINT_VALIDATION_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_CONSTRAINT_VALIDATION_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "prisma/migrations",
      "security/database-constraint-inventory-evidence.ts",
      "security/database-constraint-inventory-evidence.test.ts",
      "security/migration-constraint-validation-review-evidence.ts",
      "security/migration-constraint-validation-review-evidence.test.ts",
    ],
  },
};

export const MIGRATION_CONSTRAINT_VALIDATION_REVIEW_SCOPE =
  "Complete source review of all named migration constraints. Immediate validation is accepted for empty tables created in the same migration, foreign keys over newly added nullable columns, and null-guarded checks over newly added nullable columns. NOT VALID constraints must either have a later VALIDATE CONSTRAINT or one exact pending disposition. Every other immediate or deferred strategy fails closed. Three feed checks remain honestly reported as pending historical validation; this does not prove deployed data validity, lock duration or production readiness.";

function classifyStrategy(
  constraint: ConstraintInventoryRecord,
  source: string,
  offset: number,
  definition: string,
  validatedLater: boolean,
): ConstraintValidationStrategy {
  if (tableCreatedBefore(source, constraint.table, offset)) {
    return "new-table-immediate";
  }
  if (/\bNOT\s+VALID\b/i.test(definition)) {
    return validatedLater ? "deferred-validated" : "deferred-pending";
  }

  const addedNullableColumns = nullableColumnsAddedBefore(
    source,
    constraint.table,
    offset,
  );
  if (constraint.kind === "foreign-key") {
    const localColumns = foreignKeyColumns(definition);
    if (
      localColumns.length > 0 &&
      localColumns.every((column) => addedNullableColumns.has(column))
    ) {
      return "new-nullable-column-immediate";
    }
  }
  if (
    constraint.kind === "check" &&
    [...addedNullableColumns].some((column) =>
      new RegExp(
        `(?:"${escapeRegExp(column)}"|\\b${escapeRegExp(column)}\\b)\\s+IS\\s+NULL[\\s\\S]*\\bOR\\b`,
        "i",
      ).test(definition),
    )
  ) {
    return "new-nullable-column-null-guarded-check";
  }
  return "unreviewed-immediate";
}

function collectValidationKeys(sources: readonly ConstraintSource[]) {
  const keys = new Set<string>();
  const ordered = sources.toSorted((left, right) => left.path.localeCompare(right.path));
  for (const source of ordered) {
    const sql = maskSqlComments(source.source);
    for (const match of sql.matchAll(
      /\bALTER\s+TABLE(?:\s+IF\s+EXISTS)?(?:\s+ONLY)?\s+((?:"[^"]+"|[a-z_][a-z0-9_$]*)(?:\.(?:"[^"]+"|[a-z_][a-z0-9_$]*))?)\s+VALIDATE\s+CONSTRAINT\s+(?:"([^"]+)"|([a-z_][a-z0-9_$]*))(?=\s|;)/gi,
    )) {
      keys.add(
        constraintKey(
          source.path,
          normalizeIdentifier(match[1]),
          match[2] ?? match[3],
        ),
      );
    }
  }

  // Validation may occur in a later migration, so its source path differs from
  // the declaration. Match those validations back to the unique table/name.
  const declared = auditDatabaseConstraintInventory(sources).records;
  for (const record of declared) {
    if (
      ordered.some(({ source }) =>
        validationPattern(record.table, record.name).test(maskSqlComments(source)),
      )
    ) {
      keys.add(constraintKey(record.sourceFile, record.table, record.name));
    }
  }
  return keys;
}

function validationPattern(table: string, name: string) {
  return new RegExp(
    `\\bALTER\\s+TABLE(?:\\s+IF\\s+EXISTS)?(?:\\s+ONLY)?\\s+(?:"${escapeRegExp(table)}"|${escapeRegExp(table)})\\s+VALIDATE\\s+CONSTRAINT\\s+(?:"${escapeRegExp(name)}"|${escapeRegExp(name)})(?=\\s|;)`,
    "i",
  );
}

function findConstraintOccurrence(source: string, name: string) {
  const sql = maskSqlComments(source);
  const match = new RegExp(
    `\\bCONSTRAINT\\s+(?:"${escapeRegExp(name)}"|${escapeRegExp(name)})(?=\\s)`,
    "i",
  ).exec(sql);
  if (!match) return null;
  const nextConstraint = sql
    .slice(match.index + match[0].length)
    .search(/,\s*ADD\s+CONSTRAINT\b/i);
  const nextSemicolon = sql.indexOf(";", match.index);
  const end =
    nextConstraint >= 0
      ? match.index + match[0].length + nextConstraint
      : nextSemicolon >= 0
        ? nextSemicolon
        : sql.length;
  return { offset: match.index, definition: sql.slice(match.index, end) };
}

function tableCreatedBefore(source: string, table: string, offset: number) {
  return new RegExp(
    `\\bCREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:"${escapeRegExp(table)}"|${escapeRegExp(table)})(?=\\s|\\()`,
    "i",
  ).test(maskSqlComments(source).slice(0, offset));
}

function nullableColumnsAddedBefore(
  source: string,
  table: string,
  offset: number,
) {
  const columns = new Set<string>();
  const sql = maskSqlComments(source).slice(0, offset);
  for (const statement of sql.matchAll(
    /\bALTER\s+TABLE(?:\s+IF\s+EXISTS)?(?:\s+ONLY)?\s+((?:"[^"]+"|[a-z_][a-z0-9_$]*)(?:\.(?:"[^"]+"|[a-z_][a-z0-9_$]*))?)\s+([\s\S]*?);/gi,
  )) {
    if (normalizeIdentifier(statement[1]) !== table) continue;
    for (const addition of statement[2].matchAll(
      /\bADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:"([^"]+)"|([a-z_][a-z0-9_$]*))\s+([\s\S]*?)(?=,\s*(?:ADD|ALTER|DROP)\b|$)/gi,
    )) {
      if (!/\bNOT\s+NULL\b/i.test(addition[3])) {
        columns.add(addition[1] ?? addition[2]);
      }
    }
  }
  return columns;
}

function foreignKeyColumns(definition: string) {
  const value = /\bFOREIGN\s+KEY\s*\(([^)]+)\)/i.exec(definition)?.[1];
  return value
    ? value.split(",").map((column) => normalizeIdentifier(column.trim()))
    : [];
}

function pendingReviewKey(review: ReviewedPendingConstraint) {
  return constraintKey(review.sourceFile, review.table, review.name);
}

function constraintKey(sourceFile: string, table: string, name: string) {
  return `${sourceFile}:${table}.${name}`;
}

function normalizeIdentifier(identifier: string) {
  return identifier
    .split(".")
    .map((part) => part.trim().replace(/^"|"$/g, ""))
    .join(".");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskSqlComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, " "))
    .replace(/--[^\r\n]*/g, (comment) => " ".repeat(comment.length));
}
