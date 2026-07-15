import { evaluateMigrationNullabilityReview } from "./migration-nullability-review-evidence";

export const MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_REQUIREMENT_ID =
  "security.migration-review.backward";

export type MigrationBackwardCompatibilitySource = Readonly<{
  path: string;
  source: string;
}>;

export type BackwardCompatibilityRisk = Readonly<{
  path: string;
  line: number;
  subject: string;
  kind:
    | "column-drop"
    | "column-drop-default"
    | "column-rename"
    | "column-set-not-null"
    | "column-type-change"
    | "domain-drop"
    | "relation-drop"
    | "required-column-addition"
    | "routine-drop"
    | "table-rename"
    | "type-drop";
  operation: string;
}>;

export type ReviewedBackwardCompatibilityRisk = BackwardCompatibilityRisk &
  Readonly<{ disposition: string }>;

export const REVIEWED_BACKWARD_COMPATIBILITY_RISKS = [
  {
    path: "prisma/migrations/20260702090000_rename_supabase_uid_to_workos_user_id/migration.sql",
    line: 1,
    subject: "User.supabaseUid",
    kind: "column-rename",
    operation: "RENAME COLUMN supabaseUid TO workosUserId",
    disposition:
      "This historical identity-provider cutover intentionally breaks clients compiled against supabaseUid. The current Prisma schema and runtime use workosUserId, so the exact pre-production rename is accepted; any later contract rename requires a new compatibility review and rollout plan.",
  },
] as const satisfies readonly ReviewedBackwardCompatibilityRisk[];

export function auditMigrationBackwardCompatibility(
  sources: readonly MigrationBackwardCompatibilitySource[],
  reviews: readonly ReviewedBackwardCompatibilityRisk[] =
    REVIEWED_BACKWARD_COMPATIBILITY_RISKS,
) {
  const risks: BackwardCompatibilityRisk[] = [];
  const issues: string[] = [];
  const reviewKeys = reviews.map(riskKey);
  const reviewSet = new Set(reviewKeys);

  if (sources.length < 1) {
    issues.push("BACKWARD_COMPATIBILITY_SOURCE_INVENTORY_VACUOUS");
  }
  if (reviewSet.size !== reviewKeys.length) {
    issues.push("BACKWARD_COMPATIBILITY_REVIEW_DUPLICATE");
  }
  if (reviews.some(({ disposition }) => disposition.trim().length < 100)) {
    issues.push("BACKWARD_COMPATIBILITY_DISPOSITION_INCOMPLETE");
  }

  for (const source of sources.toSorted((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    const sql = maskSqlComments(source.source);
    risks.push(...detectTopLevelDrops(source, sql));
    risks.push(...detectAlterTableRisks(source, sql));
  }

  const nullability = evaluateMigrationNullabilityReview(
    sources.map(({ path, source }) => ({ path, sql: source })),
  );
  for (const issue of nullability.issues) {
    if (
      issue.reason === "existing-table-non-null-without-default" &&
      issue.table &&
      issue.column
    ) {
      risks.push({
        path: issue.migrationPath,
        line: issue.line,
        subject: `${issue.table}.${issue.column}`,
        kind: "required-column-addition",
        operation: `ADD COLUMN ${issue.column} NOT NULL WITHOUT DEFAULT`,
      });
    } else {
      issues.push(
        `BACKWARD_COMPATIBILITY_NULLABILITY_REVIEW_INCOMPLETE:${issue.migrationPath}:${issue.line}:${issue.reason}`,
      );
    }
  }

  const uniqueRisks = [...new Map(risks.map((risk) => [riskKey(risk), risk])).values()]
    .toSorted((left, right) => riskKey(left).localeCompare(riskKey(right)));
  const riskSet = new Set(uniqueRisks.map(riskKey));
  for (const risk of uniqueRisks) {
    if (!reviewSet.has(riskKey(risk))) {
      issues.push(`BACKWARD_COMPATIBILITY_UNREVIEWED:${riskKey(risk)}`);
    }
  }
  for (const review of reviews) {
    if (!riskSet.has(riskKey(review))) {
      issues.push(`BACKWARD_COMPATIBILITY_REVIEW_STALE:${riskKey(review)}`);
    }
  }

  return { risks: uniqueRisks, issues: [...new Set(issues)].toSorted() };
}

export const MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "prisma/schema.prisma",
      "prisma/migrations",
      "security/migration-nullability-review-evidence.ts",
      "security/migration-backward-compatibility-review-evidence.ts",
      "security/migration-backward-compatibility-review-evidence.test.ts",
    ],
  },
};

export const MIGRATION_BACKWARD_COMPATIBILITY_REVIEW_SCOPE =
  "Complete local schema-contract review of the ordered Prisma migration history. Table, column, relation, type, domain and routine drops; table or column renames; column type changes; newly required columns without defaults; SET NOT NULL; and DROP DEFAULT fail closed unless an exact risk and disposition remain current. The sole historical identity-column rename is explicitly accepted as a pre-production cutover. Index renames are not application data contracts. This source review does not prove zero-downtime deployment, old binaries against a live database, provider state or production readiness.";

const IDENTIFIER = String.raw`(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const QUALIFIED_IDENTIFIER = `${IDENTIFIER}(?:\\s*\\.\\s*${IDENTIFIER})?`;

function detectTopLevelDrops(
  source: MigrationBackwardCompatibilitySource,
  sql: string,
) {
  const risks: BackwardCompatibilityRisk[] = [];
  const patterns: ReadonlyArray<
    readonly [RegExp, BackwardCompatibilityRisk["kind"], string]
  > = [
    [
      new RegExp(
        `\\bDROP\\s+(?:MATERIALIZED\\s+)?(?:TABLE|VIEW)(?:\\s+IF\\s+EXISTS)?\\s+(${QUALIFIED_IDENTIFIER})`,
        "giu",
      ),
      "relation-drop",
      "DROP RELATION",
    ],
    [
      new RegExp(
        `\\bDROP\\s+TYPE(?:\\s+IF\\s+EXISTS)?\\s+(${QUALIFIED_IDENTIFIER})`,
        "giu",
      ),
      "type-drop",
      "DROP TYPE",
    ],
    [
      new RegExp(
        `\\bDROP\\s+DOMAIN(?:\\s+IF\\s+EXISTS)?\\s+(${QUALIFIED_IDENTIFIER})`,
        "giu",
      ),
      "domain-drop",
      "DROP DOMAIN",
    ],
    [
      new RegExp(
        `\\bDROP\\s+(?:FUNCTION|PROCEDURE)(?:\\s+IF\\s+EXISTS)?\\s+(${QUALIFIED_IDENTIFIER})`,
        "giu",
      ),
      "routine-drop",
      "DROP ROUTINE",
    ],
  ];
  for (const [pattern, kind, operation] of patterns) {
    for (const match of sql.matchAll(pattern)) {
      risks.push({
        path: source.path,
        line: lineForOffset(source.source, match.index),
        subject: normalizeIdentifier(match[1]),
        kind,
        operation,
      });
    }
  }
  return risks;
}

function detectAlterTableRisks(
  source: MigrationBackwardCompatibilitySource,
  sql: string,
) {
  const risks: BackwardCompatibilityRisk[] = [];
  for (const statement of sql.matchAll(alterTablePattern())) {
    const table = normalizeIdentifier(statement[1]);
    const body = statement[2];
    const bodyOffset = statement.index + statement[0].indexOf(body);
    const patterns: ReadonlyArray<
      readonly [RegExp, BackwardCompatibilityRisk["kind"], (match: RegExpMatchArray) => string]
    > = [
      [
        new RegExp(`\\bDROP\\s+COLUMN(?:\\s+IF\\s+EXISTS)?\\s+(${IDENTIFIER})`, "giu"),
        "column-drop",
        (match) => `DROP COLUMN ${normalizeIdentifier(match[1])}`,
      ],
      [
        new RegExp(`\\bRENAME\\s+COLUMN\\s+(${IDENTIFIER})\\s+TO\\s+(${IDENTIFIER})`, "giu"),
        "column-rename",
        (match) =>
          `RENAME COLUMN ${normalizeIdentifier(match[1])} TO ${normalizeIdentifier(match[2])}`,
      ],
      [
        new RegExp(`\\bRENAME\\s+TO\\s+(${IDENTIFIER})`, "giu"),
        "table-rename",
        (match) => `RENAME TABLE ${table} TO ${normalizeIdentifier(match[1])}`,
      ],
      [
        new RegExp(
          `\\bALTER\\s+COLUMN\\s+(${IDENTIFIER})\\s+(?:SET\\s+DATA\\s+)?TYPE\\b`,
          "giu",
        ),
        "column-type-change",
        (match) => `ALTER COLUMN ${normalizeIdentifier(match[1])} TYPE`,
      ],
      [
        new RegExp(`\\bALTER\\s+COLUMN\\s+(${IDENTIFIER})\\s+SET\\s+NOT\\s+NULL\\b`, "giu"),
        "column-set-not-null",
        (match) => `ALTER COLUMN ${normalizeIdentifier(match[1])} SET NOT NULL`,
      ],
      [
        new RegExp(`\\bALTER\\s+COLUMN\\s+(${IDENTIFIER})\\s+DROP\\s+DEFAULT\\b`, "giu"),
        "column-drop-default",
        (match) => `ALTER COLUMN ${normalizeIdentifier(match[1])} DROP DEFAULT`,
      ],
    ];
    for (const [pattern, kind, operation] of patterns) {
      for (const match of body.matchAll(pattern)) {
        const column = match[1] ? normalizeIdentifier(match[1]) : table;
        risks.push({
          path: source.path,
          line: lineForOffset(source.source, bodyOffset + match.index),
          subject: kind === "table-rename" ? table : `${table}.${column}`,
          kind,
          operation: operation(match),
        });
      }
    }
  }
  return risks;
}

function alterTablePattern() {
  return new RegExp(
    `\\bALTER\\s+TABLE(?:\\s+IF\\s+EXISTS)?(?:\\s+ONLY)?\\s+(${QUALIFIED_IDENTIFIER})\\s+([\\s\\S]*?);`,
    "giu",
  );
}

function riskKey(risk: BackwardCompatibilityRisk) {
  return `${risk.path}:${risk.line}:${risk.subject}:${risk.kind}:${risk.operation}`;
}

function normalizeIdentifier(identifier: string) {
  return identifier
    .split(".")
    .map((part) => part.trim().replace(/^"|"$/g, ""))
    .join(".");
}

function maskSqlComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, " "))
    .replace(/--[^\r\n]*/g, (comment) => " ".repeat(comment.length));
}

function lineForOffset(source: string, offset: number) {
  return source.slice(0, offset).split(/\r?\n/).length;
}
