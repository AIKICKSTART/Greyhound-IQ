export const DATABASE_CONSTRAINT_INVENTORY_REQUIREMENT_ID =
  "security.database-inventory.constraint";

export type ConstraintSource = Readonly<{
  path: string;
  source: string;
}>;

export type ConstraintInventoryRecord = Readonly<{
  name: string;
  table: string;
  kind: "check" | "foreign-key" | "primary-key" | "unique" | "exclude";
  sourceFile: string;
  line: number;
}>;

export function auditDatabaseConstraintInventory(
  sources: readonly ConstraintSource[],
) {
  const records: ConstraintInventoryRecord[] = [];
  const issues: string[] = [];
  const keys = new Set<string>();

  for (const source of sources.toSorted((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    const sql = stripComments(source.source);
    for (const match of sql.matchAll(/[^;]+;?/g)) {
      const statement = match[0];
      const constraintCount = [...statement.matchAll(/\bCONSTRAINT\b/gi)].length;
      const line = 1 + sql.slice(0, match.index).split("\n").length - 1;
      const table = tableName(statement);
      const kindCount = [...statement.matchAll(
        /\b(?:PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|EXCLUDE)\b/gi,
      )].length;
      const referenceCount = [...statement.matchAll(/\bREFERENCES\b/gi)].length;
      if (constraintCount === 0) {
        if (table && (kindCount > 0 || referenceCount > 0)) {
          issues.push(`CONSTRAINT_DECLARATION_UNPARSED:${source.path}:${line}`);
        }
        continue;
      }
      if (!table) {
        issues.push(`CONSTRAINT_TABLE_MISSING:${source.path}:${line}`);
        continue;
      }

      const declarations = [...statement.matchAll(
        /\b(?:ADD\s+)?CONSTRAINT\s+(?:"([^"]+)"|([a-z_][a-z0-9_]*))\s+(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|EXCLUDE)\b/gi,
      )];
      const validations = [...statement.matchAll(
        /\bVALIDATE\s+CONSTRAINT\s+(?:"([^"]+)"|([a-z_][a-z0-9_]*))/gi,
      )];
      const foreignKeyCount = declarations.filter((declaration) =>
        /^FOREIGN\s+KEY$/i.test(declaration[3]),
      ).length;

      if (
        declarations.length + validations.length !== constraintCount ||
        declarations.length !== kindCount ||
        referenceCount !== foreignKeyCount
      ) {
        issues.push(`CONSTRAINT_DECLARATION_UNPARSED:${source.path}:${line}`);
        continue;
      }

      for (const validation of validations) {
        const key = `${table}.${validation[1] ?? validation[2]}`;
        if (!keys.has(key)) {
          issues.push(`CONSTRAINT_VALIDATE_UNKNOWN:${key}:${source.path}:${line}`);
        }
      }

      for (const declaration of declarations) {
        const name = declaration[1] ?? declaration[2];
        const key = `${table}.${name}`;
        if (keys.has(key)) {
          issues.push(`CONSTRAINT_DUPLICATE:${key}:${source.path}:${line}`);
          continue;
        }
        keys.add(key);
        records.push({
          name,
          table,
          kind: constraintKind(declaration[3]),
          sourceFile: source.path,
          line,
        });
      }
    }
  }

  if (records.length === 0) issues.push("CONSTRAINT_INVENTORY_VACUOUS");

  return {
    records: records.toSorted((left, right) =>
      left.table.localeCompare(right.table) || left.name.localeCompare(right.name),
    ),
    issues: [...new Set(issues)].toSorted(),
  };
}

export const DATABASE_CONSTRAINT_INVENTORY_MASTER_EVIDENCE = {
  [DATABASE_CONSTRAINT_INVENTORY_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "prisma/migrations",
      "security/database-constraint-inventory-evidence.ts",
      "security/database-constraint-inventory-evidence.test.ts",
    ],
  },
};

function tableName(statement: string) {
  const match = /\b(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE(?:\s+IF\s+EXISTS)?(?:\s+ONLY)?)\s+((?:"[^"]+"|[a-z_][a-z0-9_]*)(?:\.(?:"[^"]+"|[a-z_][a-z0-9_]*))?)/i.exec(
    statement,
  );
  return match?.[1].replaceAll('"', "");
}

function constraintKind(value: string): ConstraintInventoryRecord["kind"] {
  return value.toLowerCase().replaceAll(/\s+/g, "-") as ConstraintInventoryRecord["kind"];
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
}
