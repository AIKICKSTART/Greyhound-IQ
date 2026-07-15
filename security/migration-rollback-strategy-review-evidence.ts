import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const MIGRATION_ROLLBACK_STRATEGY_REVIEW_REQUIREMENT_ID =
  "security.migration-review.rollback";

export const MIGRATION_ROLLBACK_STRATEGY =
  "Applied database history is never reversed or edited in place. A schema correction is delivered as a newly reviewed forward-fix migration; application-image rollback and data restore are separate operational controls and are not proved by this source gate.";

export const MIGRATION_ROLLBACK_STRATEGY_REVIEW_SCOPE =
  "Deterministic source review of the binding forward-only migration policies and every current Prisma migration directory. It proves that the 97-directory history contains only canonical migration.sql artifacts and no executable ROLLBACK statement. It does not prove application-image rollback, database backup or restore, deployed mixed-version compatibility, provider behavior, or production readiness.";

export const MIGRATION_ROLLBACK_STRATEGY_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_ROLLBACK_STRATEGY_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "AGENTS.md",
      "prisma/AGENTS.md",
      "docs/planning/operations-deployment.md",
      "prisma/migrations",
      "security/migration-rollback-strategy-review-evidence.ts",
      "security/migration-rollback-strategy-review-evidence.test.ts",
    ],
  },
};

export type MigrationRollbackStrategyIssue = {
  code:
    | "executable-rollback-statement"
    | "malformed-migration-sql"
    | "missing-migration-directory"
    | "missing-migration-sql"
    | "missing-policy-clause"
    | "missing-policy-file"
    | "no-migrations"
    | "unexpected-migration-artifact";
  path: string;
  line: number;
  detail: string;
};

export type MigrationRollbackStrategyReview = {
  policyFilesReviewed: number;
  policyClausesReviewed: number;
  migrationDirectoriesReviewed: number;
  migrationSqlFilesReviewed: number;
  issues: MigrationRollbackStrategyIssue[];
};

type PolicyClause = {
  path: string;
  pattern: RegExp;
  detail: string;
};

const POLICY_CLAUSES: readonly PolicyClause[] = [
  {
    path: "AGENTS.md",
    pattern: /Any Prisma migration must be forward-only/iu,
    detail: "root policy must require forward-only Prisma migrations",
  },
  {
    path: "prisma/AGENTS.md",
    pattern: /migrations\/.*owns forward-only schema history/iu,
    detail: "Prisma ownership policy must define forward-only history",
  },
  {
    path: "prisma/AGENTS.md",
    pattern: /Add a new migration for schema changes/iu,
    detail: "Prisma policy must require a new corrective migration",
  },
  {
    path: "docs/planning/operations-deployment.md",
    pattern:
      /Database migrations are forward-only \(no rollbacks\); reverse migrations are forward-fix scripts/iu,
    detail: "operations policy must define forward-fix database recovery",
  },
];

export function reviewMigrationRollbackStrategy(
  repositoryRoot: string,
): MigrationRollbackStrategyReview {
  const report: MigrationRollbackStrategyReview = {
    policyFilesReviewed: 0,
    policyClausesReviewed: 0,
    migrationDirectoriesReviewed: 0,
    migrationSqlFilesReviewed: 0,
    issues: [],
  };

  const policySources = new Map<string, string>();
  for (const policyPath of new Set(POLICY_CLAUSES.map(({ path }) => path))) {
    const absolutePath = join(repositoryRoot, policyPath);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      report.issues.push({
        code: "missing-policy-file",
        path: policyPath,
        line: 1,
        detail: "required migration rollback policy file is missing",
      });
      continue;
    }
    policySources.set(policyPath, readFileSync(absolutePath, "utf8"));
    report.policyFilesReviewed += 1;
  }

  for (const clause of POLICY_CLAUSES) {
    const source = policySources.get(clause.path);
    if (!source) {
      continue;
    }
    if (!clause.pattern.test(source)) {
      report.issues.push({
        code: "missing-policy-clause",
        path: clause.path,
        line: 1,
        detail: clause.detail,
      });
      continue;
    }
    report.policyClausesReviewed += 1;
  }

  const migrationsRoot = join(repositoryRoot, "prisma", "migrations");
  if (!existsSync(migrationsRoot) || !statSync(migrationsRoot).isDirectory()) {
    report.issues.push({
      code: "missing-migration-directory",
      path: "prisma/migrations",
      line: 1,
      detail: "the canonical migration directory is missing",
    });
    return report;
  }

  const migrationDirectories = readdirSync(migrationsRoot, {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory());
  if (migrationDirectories.length === 0) {
    report.issues.push({
      code: "no-migrations",
      path: "prisma/migrations",
      line: 1,
      detail: "a vacuous migration history cannot prove rollback strategy",
    });
    return report;
  }

  for (const migrationDirectory of migrationDirectories) {
    report.migrationDirectoriesReviewed += 1;
    const directoryPath = join(migrationsRoot, migrationDirectory.name);
    const artifacts = readdirSync(directoryPath, { withFileTypes: true });
    for (const artifact of artifacts) {
      if (artifact.isFile() && artifact.name === "migration.sql") {
        continue;
      }
      report.issues.push({
        code: "unexpected-migration-artifact",
        path: toRepositoryPath(repositoryRoot, join(directoryPath, artifact.name)),
        line: 1,
        detail:
          "forward-only migration directories may contain only migration.sql",
      });
    }

    const migrationSqlPath = join(directoryPath, "migration.sql");
    if (
      !existsSync(migrationSqlPath) ||
      !statSync(migrationSqlPath).isFile()
    ) {
      report.issues.push({
        code: "missing-migration-sql",
        path: toRepositoryPath(repositoryRoot, migrationSqlPath),
        line: 1,
        detail: "migration directory has no canonical migration.sql",
      });
      continue;
    }

    report.migrationSqlFilesReviewed += 1;
    reviewMigrationSql(
      readFileSync(migrationSqlPath, "utf8"),
      toRepositoryPath(repositoryRoot, migrationSqlPath),
      report.issues,
    );
  }

  return report;
}

function reviewMigrationSql(
  source: string,
  path: string,
  issues: MigrationRollbackStrategyIssue[],
) {
  const lexicalReview = executableSqlWords(source);
  if (lexicalReview.malformedLine !== undefined) {
    issues.push({
      code: "malformed-migration-sql",
      path,
      line: lexicalReview.malformedLine,
      detail: "an SQL comment or quoted region does not terminate",
    });
    return;
  }

  for (const word of lexicalReview.words) {
    if (word.value.toUpperCase() !== "ROLLBACK") {
      continue;
    }
    issues.push({
      code: "executable-rollback-statement",
      path,
      line: word.line,
      detail:
        "migration history is forward-only; use a new reviewed forward-fix migration",
    });
  }
}

function executableSqlWords(source: string) {
  const words: Array<{ value: string; line: number }> = [];
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
        return { words, malformedLine: startLine };
      }
      continue;
    }

    const dollarDelimiter = source
      .slice(index)
      .match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u)?.[0];
    if (dollarDelimiter) {
      const startLine = line;
      const close = source.indexOf(
        dollarDelimiter,
        index + dollarDelimiter.length,
      );
      if (close === -1) {
        return { words, malformedLine: startLine };
      }
      const end = close + dollarDelimiter.length;
      line += countNewlines(source.slice(index, end));
      index = end;
      continue;
    }

    if (character === "'" || character === '"') {
      const startLine = line;
      const quote = character;
      const backslashEscaped =
        quote === "'" &&
        /[Ee]/u.test(source[index - 1] ?? "") &&
        !/[A-Za-z0-9_$]/u.test(source[index - 2] ?? "");
      index += 1;
      let closed = false;
      while (index < source.length) {
        if (source[index] === "\n") {
          line += 1;
        }
        if (backslashEscaped && source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] !== quote) {
          index += 1;
          continue;
        }
        if (source[index + 1] === quote) {
          index += 2;
          continue;
        }
        index += 1;
        closed = true;
        break;
      }
      if (!closed) {
        return { words, malformedLine: startLine };
      }
      continue;
    }

    const word = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_$]*/u)?.[0];
    if (word) {
      words.push({ value: word, line });
      index += word.length;
      continue;
    }

    index += 1;
  }

  return { words, malformedLine: undefined };
}

function countNewlines(value: string) {
  return value.match(/\n/gu)?.length ?? 0;
}

function toRepositoryPath(repositoryRoot: string, path: string) {
  return relative(repositoryRoot, path).replaceAll("\\", "/");
}
