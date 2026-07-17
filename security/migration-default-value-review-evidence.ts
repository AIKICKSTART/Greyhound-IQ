import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const MIGRATION_DEFAULT_VALUE_REVIEW_REQUIREMENT_ID =
  "security.migration-review.defaults";

export const MIGRATION_DEFAULT_VALUE_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_DEFAULT_VALUE_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "prisma/migrations",
      "security/migration-default-value-review-evidence.ts",
      "security/migration-default-value-review-evidence.test.ts",
    ],
  },
};

export type ReviewedDefaultClassification =
  | "boolean-literal"
  | "numeric-literal"
  | "string-literal"
  | "transaction-timestamp";

export type MigrationDefaultReviewIssue = {
  code:
    | "missing-migration-directory"
    | "missing-migration-sql"
    | "no-reviewed-defaults"
    | "unterminated-block-comment"
    | "unterminated-dollar-quote"
    | "unterminated-quoted-identifier"
    | "unterminated-string"
    | "unreviewed-default-expression";
  path: string;
  line: number;
  detail: string;
};

export type ReviewedMigrationDefault = {
  path: string;
  line: number;
  expression: string;
  classification: ReviewedDefaultClassification;
  behavior: string;
};

export type MigrationDefaultValueReview = {
  migrationFiles: number;
  executableDefaultKeywords: number;
  skippedDefaultPrivilegeClauses: number;
  reviewedDefaults: ReviewedMigrationDefault[];
  issues: MigrationDefaultReviewIssue[];
};

type SqlToken = {
  kind: "number" | "quoted-identifier" | "string" | "symbol" | "word";
  value: string;
  line: number;
};

const COLUMN_CONSTRAINT_BOUNDARIES = new Set([
  "CHECK",
  "COLLATE",
  "CONSTRAINT",
  "GENERATED",
  "NOT",
  "PRIMARY",
  "REFERENCES",
  "UNIQUE",
]);

const CLASSIFICATION_BEHAVIOR: Record<
  ReviewedDefaultClassification,
  string
> = {
  "boolean-literal": "fixed boolean used when an insert omits the column",
  "numeric-literal": "fixed number used when an insert omits the column",
  "string-literal": "fixed string used when an insert omits the column",
  "transaction-timestamp":
    "PostgreSQL transaction-start timestamp used when an insert omits the column",
};

export function reviewMigrationDefaultValues(
  repositoryRoot: string,
): MigrationDefaultValueReview {
  const migrationsRoot = join(repositoryRoot, "prisma", "migrations");
  const report: MigrationDefaultValueReview = {
    migrationFiles: 0,
    executableDefaultKeywords: 0,
    skippedDefaultPrivilegeClauses: 0,
    reviewedDefaults: [],
    issues: [],
  };

  if (!existsSync(migrationsRoot) || !statSync(migrationsRoot).isDirectory()) {
    report.issues.push({
      code: "missing-migration-directory",
      path: "prisma/migrations",
      line: 1,
      detail: "the migration directory is required for default-value review",
    });
    return report;
  }

  const migrationDirectories = readdirSync(migrationsRoot, {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory());

  for (const directory of migrationDirectories) {
    const sqlPath = join(migrationsRoot, directory.name, "migration.sql");
    if (!existsSync(sqlPath) || !statSync(sqlPath).isFile()) {
      report.issues.push({
        code: "missing-migration-sql",
        path: toRepositoryPath(repositoryRoot, sqlPath),
        line: 1,
        detail: `migration ${directory.name} has no migration.sql`,
      });
      continue;
    }

    report.migrationFiles += 1;
    reviewSqlFile(
      readFileSync(sqlPath, "utf8"),
      toRepositoryPath(repositoryRoot, sqlPath),
      report,
    );
  }

  if (report.reviewedDefaults.length === 0) {
    report.issues.push({
      code: "no-reviewed-defaults",
      path: "prisma/migrations",
      line: 1,
      detail: "no executable column defaults were classified",
    });
  }

  return report;
}

function reviewSqlFile(
  source: string,
  path: string,
  report: MigrationDefaultValueReview,
) {
  const { tokens, issues } = tokenizeSql(source, path);
  report.issues.push(...issues);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== "word" || token.value.toUpperCase() !== "DEFAULT") {
      continue;
    }

    report.executableDefaultKeywords += 1;
    const firstExpressionToken = tokens[index + 1];
    if (
      firstExpressionToken?.kind === "word" &&
      firstExpressionToken.value.toUpperCase() === "PRIVILEGES"
    ) {
      report.skippedDefaultPrivilegeClauses += 1;
      continue;
    }

    const reviewed = classifyDefault(tokens, index + 1);
    if (!reviewed) {
      report.issues.push({
        code: "unreviewed-default-expression",
        path,
        line: token.line,
        detail: `DEFAULT expression is outside the closed review set: ${tokenPreview(tokens, index + 1)}`,
      });
      continue;
    }

    report.reviewedDefaults.push({
      path,
      line: token.line,
      expression: reviewed.expression,
      classification: reviewed.classification,
      behavior: CLASSIFICATION_BEHAVIOR[reviewed.classification],
    });
  }
}

function classifyDefault(
  tokens: SqlToken[],
  start: number,
):
  | {
      expression: string;
      classification: ReviewedDefaultClassification;
    }
  | undefined {
  const first = tokens[start];
  if (!first) {
    return undefined;
  }

  if (first.kind === "string" && isExpressionBoundary(tokens[start + 1])) {
    return { expression: first.value, classification: "string-literal" };
  }

  if (
    first.kind === "word" &&
    ["FALSE", "TRUE"].includes(first.value.toUpperCase()) &&
    isExpressionBoundary(tokens[start + 1])
  ) {
    return {
      expression: first.value.toLowerCase(),
      classification: "boolean-literal",
    };
  }

  if (
    first.kind === "word" &&
    first.value.toUpperCase() === "CURRENT_TIMESTAMP" &&
    isExpressionBoundary(tokens[start + 1])
  ) {
    return {
      expression: "CURRENT_TIMESTAMP",
      classification: "transaction-timestamp",
    };
  }

  let numberToken = first;
  let sign = "";
  let afterNumber = tokens[start + 1];
  if (
    first.kind === "symbol" &&
    ["+", "-"].includes(first.value) &&
    tokens[start + 1]?.kind === "number"
  ) {
    sign = first.value;
    numberToken = tokens[start + 1];
    afterNumber = tokens[start + 2];
  }
  if (numberToken.kind === "number" && isExpressionBoundary(afterNumber)) {
    return {
      expression: `${sign}${numberToken.value}`,
      classification: "numeric-literal",
    };
  }

  return undefined;
}

function isExpressionBoundary(token: SqlToken | undefined) {
  if (!token) {
    return true;
  }
  if (token.kind === "symbol" && [")", ",", ";"].includes(token.value)) {
    return true;
  }
  return (
    token.kind === "word" &&
    COLUMN_CONSTRAINT_BOUNDARIES.has(token.value.toUpperCase())
  );
}

function tokenPreview(tokens: SqlToken[], start: number) {
  const preview = tokens
    .slice(start, start + 6)
    .map((token) => token.value)
    .join(" ");
  return preview || "<missing>";
}

function tokenizeSql(source: string, path: string) {
  const tokens: SqlToken[] = [];
  const issues: MigrationDefaultReviewIssue[] = [];
  let index = 0;
  let line = 1;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (/\s/u.test(character)) {
      if (character === "\n") {
        line += 1;
      }
      index += 1;
      continue;
    }

    if (character === "-" && next === "-") {
      index += 2;
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (character === "/" && next === "*") {
      const startLine = line;
      let depth = 1;
      index += 2;
      while (index < source.length && depth > 0) {
        if (source[index] === "/" && source[index + 1] === "*") {
          depth += 1;
          index += 2;
        } else if (source[index] === "*" && source[index + 1] === "/") {
          depth -= 1;
          index += 2;
        } else {
          if (source[index] === "\n") {
            line += 1;
          }
          index += 1;
        }
      }
      if (depth > 0) {
        issues.push({
          code: "unterminated-block-comment",
          path,
          line: startLine,
          detail: "block comment does not close",
        });
      }
      continue;
    }

    const dollarDelimiter = readDollarDelimiter(source, index);
    if (dollarDelimiter) {
      const startLine = line;
      const end = source.indexOf(
        dollarDelimiter,
        index + dollarDelimiter.length,
      );
      if (end === -1) {
        issues.push({
          code: "unterminated-dollar-quote",
          path,
          line: startLine,
          detail: `dollar quote ${dollarDelimiter} does not close`,
        });
        break;
      }
      const finish = end + dollarDelimiter.length;
      const value = source.slice(index, finish);
      line += countNewlines(value);
      tokens.push({ kind: "string", value, line: startLine });
      index = finish;
      continue;
    }

    if (character === "'") {
      const quoted = readQuoted(source, index, "'");
      if (!quoted.closed) {
        issues.push({
          code: "unterminated-string",
          path,
          line,
          detail: "string literal does not close",
        });
        break;
      }
      const value = source.slice(index, quoted.end);
      tokens.push({ kind: "string", value, line });
      line += countNewlines(value);
      index = quoted.end;
      continue;
    }

    if (character === '"') {
      const quoted = readQuoted(source, index, '"');
      if (!quoted.closed) {
        issues.push({
          code: "unterminated-quoted-identifier",
          path,
          line,
          detail: "quoted identifier does not close",
        });
        break;
      }
      const value = source.slice(index, quoted.end);
      tokens.push({ kind: "quoted-identifier", value, line });
      line += countNewlines(value);
      index = quoted.end;
      continue;
    }

    const word = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_$]*/u)?.[0];
    if (word) {
      tokens.push({ kind: "word", value: word, line });
      index += word.length;
      continue;
    }

    const number = source
      .slice(index)
      .match(/^(?:\d+(?:\.\d+)?|\.\d+)/u)?.[0];
    if (number) {
      tokens.push({ kind: "number", value: number, line });
      index += number.length;
      continue;
    }

    tokens.push({ kind: "symbol", value: character, line });
    index += 1;
  }

  return { tokens, issues };
}

function readDollarDelimiter(source: string, start: number) {
  if (source[start] !== "$") {
    return undefined;
  }
  return source.slice(start).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u)?.[0];
}

function readQuoted(source: string, start: number, quote: "'" | '"') {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] !== quote) {
      index += 1;
      continue;
    }
    if (source[index + 1] === quote) {
      index += 2;
      continue;
    }
    return { closed: true, end: index + 1 };
  }
  return { closed: false, end: source.length };
}

function countNewlines(value: string) {
  return value.match(/\n/gu)?.length ?? 0;
}

function toRepositoryPath(repositoryRoot: string, path: string) {
  return relative(repositoryRoot, path).replaceAll("\\", "/");
}
