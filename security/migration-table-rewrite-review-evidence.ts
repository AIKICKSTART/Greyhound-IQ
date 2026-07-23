export const MIGRATION_TABLE_REWRITE_REVIEW_REQUIREMENT_ID =
  "security.migration-review.rewrite";

export type MigrationRewriteSource = Readonly<{
  path: string;
  source: string;
}>;

export type TableRewriteRisk = Readonly<{
  path: string;
  line: number;
  table: string;
  kind:
    | "column-type-change"
    | "stored-generated-column"
    | "volatile-column-default"
    | "table-access-method"
    | "table-cluster"
    | "table-persistence"
    | "table-tablespace"
    | "vacuum-full";
  operation: string;
}>;

export type ReviewedTableRewrite = TableRewriteRisk &
  Readonly<{ disposition: string }>;

export const REVIEWED_TABLE_REWRITES = [
  {
    path: "prisma/migrations/20260705120000_add_rate_limit_and_call_type/migration.sql",
    line: 14,
    table: "RateLimit",
    kind: "table-persistence",
    operation: "SET UNLOGGED",
    disposition:
      "RateLimit stores disposable abuse-control counters, not durable product or audit data. The pre-production migration accepts one table rewrite to gain unlogged counter semantics; this exception is exact and any later persistence change requires a new review.",
  },
] as const satisfies readonly ReviewedTableRewrite[];

export function auditMigrationTableRewrites(
  sources: readonly MigrationRewriteSource[],
  reviews: readonly ReviewedTableRewrite[] = REVIEWED_TABLE_REWRITES,
) {
  const risks: TableRewriteRisk[] = [];
  const issues: string[] = [];
  const reviewKeys = reviews.map(rewriteKey);
  const reviewSet = new Set(reviewKeys);

  if (sources.length < 1) issues.push("TABLE_REWRITE_SOURCE_INVENTORY_VACUOUS");
  if (reviewSet.size !== reviewKeys.length) {
    issues.push("TABLE_REWRITE_REVIEW_DUPLICATE");
  }
  if (reviews.some(({ disposition }) => disposition.trim().length < 80)) {
    issues.push("TABLE_REWRITE_DISPOSITION_INCOMPLETE");
  }

  for (const { path, source } of sources.toSorted((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    const sql = maskComments(source);
    for (const match of sql.matchAll(/[^;]+;?/g)) {
      const statement = match[0].replace(/;\s*$/, "").trim();
      if (!statement) continue;
      const firstTokenOffset = match[0].search(/\S/);
      const line = sql
        .slice(0, match.index + Math.max(0, firstTokenOffset))
        .split("\n").length;
      risks.push(...detectRewriteRisks(path, line, statement));
    }
  }

  const riskSet = new Set(risks.map(rewriteKey));
  for (const risk of risks) {
    if (!reviewSet.has(rewriteKey(risk))) {
      issues.push(`TABLE_REWRITE_UNREVIEWED:${rewriteKey(risk)}`);
    }
  }
  for (const review of reviews) {
    if (!riskSet.has(rewriteKey(review))) {
      issues.push(`TABLE_REWRITE_REVIEW_STALE:${rewriteKey(review)}`);
    }
  }

  return {
    risks: risks.toSorted((left, right) => rewriteKey(left).localeCompare(rewriteKey(right))),
    issues: [...new Set(issues)].toSorted(),
  };
}

export const MIGRATION_TABLE_REWRITE_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_TABLE_REWRITE_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "prisma/migrations",
      "scripts/check-migrations.ts",
      "security/migration-table-rewrite-review-evidence.ts",
      "security/migration-table-rewrite-review-evidence.test.ts",
    ],
  },
};

export const MIGRATION_TABLE_REWRITE_REVIEW_SCOPE =
  "Complete PostgreSQL migration-source review for column type changes, stored generated columns, volatile ADD COLUMN defaults, table persistence/access-method/tablespace changes, CLUSTER and VACUUM FULL. The sole current RateLimit SET UNLOGGED rewrite has one exact disposition; every new or changed risk fails closed.";

function detectRewriteRisks(
  path: string,
  line: number,
  statement: string,
): TableRewriteRisk[] {
  const risks: TableRewriteRisk[] = [];
  const alteredTable = alterTableName(statement);

  for (const match of statement.matchAll(
    /\bALTER\s+COLUMN\s+("[^"]+"|[a-z_][a-z0-9_$]*)\s+(?:SET\s+DATA\s+)?TYPE\b/gi,
  )) {
    risks.push(risk(path, line, alteredTable, "column-type-change", `ALTER COLUMN ${unquote(match[1])} TYPE`));
  }
  for (const match of statement.matchAll(
    /\bADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+("[^"]+"|[a-z_][a-z0-9_$]*)[\s\S]*?\bGENERATED\s+ALWAYS\s+AS\b[\s\S]*?\bSTORED\b/gi,
  )) {
    risks.push(risk(path, line, alteredTable, "stored-generated-column", `ADD COLUMN ${unquote(match[1])} GENERATED STORED`));
  }
  for (const match of statement.matchAll(
    /\bADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+("[^"]+"|[a-z_][a-z0-9_$]*)[\s\S]*?\bDEFAULT\s+(random|gen_random_uuid|clock_timestamp|nextval)\s*\(/gi,
  )) {
    risks.push(risk(path, line, alteredTable, "volatile-column-default", `ADD COLUMN ${unquote(match[1])} DEFAULT ${match[2].toLowerCase()}()`));
  }
  for (const match of statement.matchAll(/\bSET\s+(LOGGED|UNLOGGED)\b/gi)) {
    risks.push(risk(path, line, alteredTable, "table-persistence", `SET ${match[1].toUpperCase()}`));
  }
  for (const match of statement.matchAll(/\bSET\s+ACCESS\s+METHOD\s+("[^"]+"|[a-z_][a-z0-9_$]*)/gi)) {
    risks.push(risk(path, line, alteredTable, "table-access-method", `SET ACCESS METHOD ${unquote(match[1])}`));
  }
  for (const match of statement.matchAll(/\bSET\s+TABLESPACE\s+("[^"]+"|[a-z_][a-z0-9_$]*)/gi)) {
    risks.push(risk(path, line, alteredTable, "table-tablespace", `SET TABLESPACE ${unquote(match[1])}`));
  }

  const cluster = /^CLUSTER(?:\s+VERBOSE)?\s+("[^"]+"|[a-z_][a-z0-9_$]*)/i.exec(statement);
  if (cluster) {
    risks.push(risk(path, line, unquote(cluster[1]), "table-cluster", "CLUSTER"));
  }
  if (/^VACUUM\b[\s\S]*\bFULL\b/i.test(statement)) {
    const table = /\bFULL\b(?:\s+FREEZE)?(?:\s+VERBOSE)?\s+("[^"]+"|[a-z_][a-z0-9_$]*)/i.exec(statement)?.[1];
    risks.push(risk(path, line, table ? unquote(table) : "<unspecified>", "vacuum-full", "VACUUM FULL"));
  }

  return risks;
}

function risk(
  path: string,
  line: number,
  table: string | null,
  kind: TableRewriteRisk["kind"],
  operation: string,
): TableRewriteRisk {
  return { path, line, table: table ?? "<unknown>", kind, operation };
}

function rewriteKey(value: TableRewriteRisk) {
  return `${value.path}:${value.line}:${value.table}:${value.kind}:${value.operation}`;
}

function alterTableName(statement: string) {
  const value = /\bALTER\s+TABLE(?:\s+IF\s+EXISTS)?(?:\s+ONLY)?\s+((?:"[^"]+"|[a-z_][a-z0-9_$]*)(?:\.(?:"[^"]+"|[a-z_][a-z0-9_$]*))?)/i.exec(statement)?.[1];
  return value ? unquote(value) : null;
}

function unquote(value: string) {
  return value.replaceAll('"', "");
}

function maskComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, " "))
    .replace(/--[^\r\n]*/g, (comment) => " ".repeat(comment.length));
}
