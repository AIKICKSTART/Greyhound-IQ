import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

type Finding = {
  file: string;
  line: number;
  rule: string;
};

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

const statementRules = [
  {
    name: "drop-column",
    pattern: /\bALTER\s+TABLE\b[\s\S]*\bDROP\s+COLUMN\b/i,
  },
  {
    name: "drop-destructive-object",
    pattern:
      /\bDROP\s+(TABLE|DATABASE|SCHEMA|TYPE|FUNCTION|PROCEDURE|VIEW|MATERIALIZED\s+VIEW|CONSTRAINT)\b/i,
  },
  {
    name: "truncate",
    pattern: /\bTRUNCATE\b/i,
  },
  {
    name: "delete-from",
    pattern: /\bDELETE\s+FROM\b/i,
  },
];

const findings: Finding[] = [];

for (const migration of readdirSync(MIGRATIONS_DIR).sort()) {
  const migrationDir = join(MIGRATIONS_DIR, migration);
  if (!directoryExists(migrationDir)) continue;
  const file = join(migrationDir, "migration.sql");
  if (!statExists(file)) {
    findings.push({ file, line: 1, rule: "missing-migration-sql" });
    continue;
  }

  const sql = readFileSync(file, "utf8");
  const reviewSql = maskSqlComments(sql);
  for (const drop of findTriggerDrops(reviewSql)) {
    if (!hasLaterTriggerReplacement(reviewSql, drop)) {
      findings.push({
        file,
        line: lineForOffset(sql, drop.index),
        rule: "drop-destructive-object",
      });
    }
  }
  const statements = sql.split(";");
  let offset = 0;

  for (const statement of statements) {
    const uncommented = stripSqlComments(statement);
    for (const rule of statementRules) {
      if (rule.pattern.test(uncommented)) {
        findings.push({
          file,
          line: lineForOffset(sql, offset),
          rule: rule.name,
        });
      }
    }
    offset += statement.length + 1;
  }
}

if (findings.length > 0) {
  console.error("Migration safety gate failed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.rule}`);
  }
  process.exit(1);
}

console.log("Migration safety gate passed.");

function statExists(path: string) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function directoryExists(path: string) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function stripSqlComments(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

type TriggerDrop = {
  index: number;
  end: number;
  name: string;
  table: string;
};

function findTriggerDrops(sql: string): TriggerDrop[] {
  const identifier = String.raw`(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)`;
  const qualifiedIdentifier = `${identifier}(?:\\.${identifier})?`;
  const pattern = new RegExp(
    `\\bDROP\\s+TRIGGER(?:\\s+IF\\s+EXISTS)?\\s+(${identifier})\\s+ON\\s+(${qualifiedIdentifier})`,
    "giu"
  );
  return [...sql.matchAll(pattern)].map((match) => ({
    index: match.index,
    end: match.index + match[0].length,
    name: match[1],
    table: match[2],
  }));
}

function hasLaterTriggerReplacement(sql: string, drop: TriggerDrop) {
  const createPattern = new RegExp(
    `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?TRIGGER\\s+${escapeRegExp(drop.name)}(?=\\s)[\\s\\S]*?\\bON\\s+${escapeRegExp(drop.table)}(?=\\s)`,
    "iu"
  );
  return createPattern.test(sql.slice(drop.end));
}

function maskSqlComments(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, " "))
    .replace(/--[^\r\n]*/g, (comment) => " ".repeat(comment.length));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineForOffset(text: string, offset: number) {
  return text.slice(0, offset).split(/\r?\n/).length;
}
