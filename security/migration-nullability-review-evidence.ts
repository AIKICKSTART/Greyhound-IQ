import type { SecurityRequirementStatus } from "../src/components/security-master-requirements";

export const MIGRATION_NULLABILITY_REVIEW_EVIDENCE_FILE =
  "security/migration-nullability-review-evidence.ts" as const;
export const MIGRATION_NULLABILITY_REVIEW_TEST_FILE =
  "security/migration-nullability-review-evidence.test.ts" as const;

export const MIGRATION_NULLABILITY_REVIEW_REQUIREMENT_IDS = [
  "security.migration-review.nullability",
] as const;

export const MIGRATION_NULLABILITY_REVIEW_EXPECTED_GAIN =
  MIGRATION_NULLABILITY_REVIEW_REQUIREMENT_IDS.length;

export const MIGRATION_NULLABILITY_REVIEW_SCOPE =
  "Deterministic source review of every column definition in SQL CREATE TABLE statements and every ADD COLUMN occurrence in the ordered Prisma migration history. Each definition must parse to one table and column record with explicit nullable or non-null classification. A column added to a pre-existing table must remain nullable or declare a non-null default that can populate existing rows; a non-null addition without a usable default fails. Immediate non-null additions are accepted for tables created earlier in the same migration because those tables are empty by construction. The auto-discovered security test runs under the existing CI unit suite, and synthetic unparsed, missing-default, and DEFAULT NULL fixtures fail closed. This source contract does not assess default-expression volatility, lock duration, deployed row contents, migration execution, rollback safety, provider behavior, or production readiness.";

export type NullabilityMigrationSource = {
  path: string;
  sql: string;
};

export type MigrationAddedColumnRecord = {
  migrationPath: string;
  table: string;
  column: string;
  line: number;
  nullable: boolean;
  hasUsableDefault: boolean;
  strategy:
    | "new-table"
    | "existing-table-nullable"
    | "existing-table-non-null-defaulted";
};

export type MigrationCreatedColumnRecord = {
  migrationPath: string;
  table: string;
  column: string;
  line: number;
  nullable: boolean;
};

export type MigrationNullabilityIssue = {
  migrationPath: string;
  table: string | null;
  column: string | null;
  line: number;
  reason:
    | "unparsed-create-table-column"
    | "unparsed-add-column"
    | "existing-table-non-null-without-default";
};

export type MigrationNullabilityReviewResult = {
  addColumnOccurrences: number;
  createdTableColumns: readonly MigrationCreatedColumnRecord[];
  columns: readonly MigrationAddedColumnRecord[];
  issues: readonly MigrationNullabilityIssue[];
};

const IDENTIFIER = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const QUALIFIED_IDENTIFIER = `${IDENTIFIER}(?:\\s*\\.\\s*${IDENTIFIER})?`;

export function evaluateMigrationNullabilityReview(
  migrations: readonly NullabilityMigrationSource[],
): MigrationNullabilityReviewResult {
  const ordered = [...migrations].toSorted((left, right) =>
    left.path.localeCompare(right.path),
  );
  const columns: MigrationAddedColumnRecord[] = [];
  const createdTableColumns: MigrationCreatedColumnRecord[] = [];
  const issues: MigrationNullabilityIssue[] = [];
  let addColumnOccurrences = 0;

  for (const migration of ordered) {
    const sql = maskSqlComments(migration.sql);
    const occurrences = [...sql.matchAll(/\bADD\s+COLUMN\b/giu)];
    addColumnOccurrences += occurrences.length;
    const createdColumnResult = parseCreatedTableColumns(migration, sql);
    createdTableColumns.push(...createdColumnResult.columns);
    issues.push(...createdColumnResult.issues);
    const createdTables = [...sql.matchAll(createTablePattern())].map(
      (match) => ({ table: normalizeIdentifier(match[1]), offset: match.index }),
    );
    const parsedOffsets = new Set<number>();

    for (const statement of sql.matchAll(alterTablePattern())) {
      const table = normalizeIdentifier(statement[1]);
      const body = statement[2];
      const bodyOffset = statement.index + statement[0].indexOf(body);
      for (const addition of body.matchAll(addColumnPattern())) {
        const offset = bodyOffset + addition.index;
        parsedOffsets.add(offset + addition[0].search(/\bADD\s+COLUMN\b/i));
        const column = normalizeIdentifier(addition[1]);
        const definition = addition[2];
        const nullable = !/\bNOT\s+NULL\b/i.test(definition);
        const hasUsableDefault =
          /\bDEFAULT\b/i.test(definition) &&
          !/\bDEFAULT\s+NULL\b/i.test(definition);
        const tableCreatedEarlier = createdTables.some(
          (created) => created.table === table && created.offset < offset,
        );

        if (!tableCreatedEarlier && !nullable && !hasUsableDefault) {
          issues.push({
            migrationPath: migration.path,
            table,
            column,
            line: lineForOffset(migration.sql, offset),
            reason: "existing-table-non-null-without-default",
          });
          continue;
        }

        columns.push({
          migrationPath: migration.path,
          table,
          column,
          line: lineForOffset(migration.sql, offset),
          nullable,
          hasUsableDefault,
          strategy: tableCreatedEarlier
            ? "new-table"
            : nullable
              ? "existing-table-nullable"
              : "existing-table-non-null-defaulted",
        });
      }
    }

    for (const occurrence of occurrences) {
      if (!parsedOffsets.has(occurrence.index)) {
        issues.push({
          migrationPath: migration.path,
          table: null,
          column: null,
          line: lineForOffset(migration.sql, occurrence.index),
          reason: "unparsed-add-column",
        });
      }
    }
  }

  return { addColumnOccurrences, createdTableColumns, columns, issues };
}

function parseCreatedTableColumns(
  migration: NullabilityMigrationSource,
  sql: string,
) {
  const columns: MigrationCreatedColumnRecord[] = [];
  const issues: MigrationNullabilityIssue[] = [];
  for (const match of sql.matchAll(createTableBodyPattern())) {
    const table = normalizeIdentifier(match[1]);
    const body = match[2];
    const bodyOffset = match.index + match[0].indexOf(body);
    for (const definition of splitTopLevelDefinitions(body)) {
      const trimmed = definition.text.trim();
      if (!trimmed || isTableConstraintDefinition(trimmed)) continue;
      const columnMatch = trimmed.match(
        new RegExp(`^(${IDENTIFIER})\\s+([\\s\\S]+)$`, "iu"),
      );
      if (!columnMatch) {
        issues.push({
          migrationPath: migration.path,
          table,
          column: null,
          line: lineForOffset(migration.sql, bodyOffset + definition.offset),
          reason: "unparsed-create-table-column",
        });
        continue;
      }
      columns.push({
        migrationPath: migration.path,
        table,
        column: normalizeIdentifier(columnMatch[1]),
        line: lineForOffset(migration.sql, bodyOffset + definition.offset),
        nullable: !/\bNOT\s+NULL\b/i.test(columnMatch[2]),
      });
    }
  }
  return { columns, issues };
}

function createTablePattern() {
  return new RegExp(
    `\\bCREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(${QUALIFIED_IDENTIFIER})`,
    "giu",
  );
}

function createTableBodyPattern() {
  return new RegExp(
    `\\bCREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(${QUALIFIED_IDENTIFIER})\\s*\\(([\\s\\S]*?)\\)\\s*;`,
    "giu",
  );
}

function alterTablePattern() {
  return new RegExp(
    `\\bALTER\\s+TABLE(?:\\s+ONLY)?\\s+(${QUALIFIED_IDENTIFIER})\\s+([\\s\\S]*?);`,
    "giu",
  );
}

function addColumnPattern() {
  return new RegExp(
    `\\bADD\\s+COLUMN(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(${IDENTIFIER})\\s+([\\s\\S]*?)(?=,\\s*(?:ADD\\s+(?:COLUMN|CONSTRAINT)|ALTER\\s+COLUMN|DROP\\s+COLUMN)\\b|$)`,
    "giu",
  );
}

function normalizeIdentifier(identifier: string) {
  return identifier
    .split(".")
    .map((part) => part.trim().replace(/^"|"$/g, "").replace(/""/g, '"'))
    .join(".");
}

function splitTopLevelDefinitions(body: string) {
  const definitions: Array<{ text: string; offset: number }> = [];
  let start = 0;
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (quote) {
      if (character === quote && body[index + 1] === quote) {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      definitions.push({ text: body.slice(start, index), offset: start });
      start = index + 1;
    }
  }
  definitions.push({ text: body.slice(start), offset: start });
  return definitions;
}

function isTableConstraintDefinition(definition: string) {
  return /^(?:CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|EXCLUDE|LIKE)\b/i.test(
    definition,
  );
}

function maskSqlComments(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (comment) =>
      comment.replace(/[^\r\n]/g, " "),
    )
    .replace(/--[^\r\n]*/g, (comment) => " ".repeat(comment.length));
}

function lineForOffset(text: string, offset: number) {
  return text.slice(0, offset).split(/\r?\n/).length;
}

type MigrationNullabilityReviewEvidenceRecord = {
  status: SecurityRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  MIGRATION_NULLABILITY_REVIEW_EVIDENCE_FILE,
  MIGRATION_NULLABILITY_REVIEW_TEST_FILE,
  "prisma/migrations/migration_lock.toml",
  "scripts/run-unit-tests.ts",
  ".github/workflows/ci.yml",
  "package.json",
] as const;

export const MIGRATION_NULLABILITY_REVIEW_MASTER_EVIDENCE = {
  "security.migration-review.nullability": {
    status: "verified",
    evidence: COMMON_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    (typeof MIGRATION_NULLABILITY_REVIEW_REQUIREMENT_IDS)[number],
    MigrationNullabilityReviewEvidenceRecord
  >
>;
