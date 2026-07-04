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
      /\bDROP\s+(TABLE|DATABASE|SCHEMA|TYPE|FUNCTION|PROCEDURE|VIEW|MATERIALIZED\s+VIEW|TRIGGER|CONSTRAINT)\b/i,
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
  const file = join(MIGRATIONS_DIR, migration, "migration.sql");
  if (!statExists(file)) continue;

  const sql = readFileSync(file, "utf8");
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

function stripSqlComments(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

function lineForOffset(text: string, offset: number) {
  return text.slice(0, offset).split(/\r?\n/).length;
}
