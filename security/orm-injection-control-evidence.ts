import ts from "typescript";

export const ORM_INJECTION_CONTROL_REQUIREMENT_ID =
  "security.injection-prevention.prevent-orm";

export type OrmInjectionSource = {
  readonly path: string;
  readonly source: string;
};

const ORM_METHODS = new Set([
  "aggregate",
  "count",
  "create",
  "createMany",
  "delete",
  "deleteMany",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "groupBy",
  "update",
  "updateMany",
  "upsert",
]);
const ORM_SHAPE_PROPERTIES = new Set([
  "data",
  "include",
  "orderBy",
  "select",
  "where",
]);
const UNTRUSTED_SHAPE_NAMES = new Set([
  "body",
  "formData",
  "input",
  "params",
  "parsed",
  "payload",
  "query",
  "req",
  "request",
  "searchParams",
]);

export function auditOrmInjectionSources(
  sources: readonly OrmInjectionSource[],
) {
  const issues: string[] = [];
  let ormCalls = 0;

  for (const item of sources) {
    const sourceFile = ts.createSourceFile(
      item.path,
      item.source,
      ts.ScriptTarget.Latest,
      true,
      item.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          (node.expression.name.text === "passthrough" ||
            node.expression.name.text === "catchall")
        ) {
          issues.push(`OPEN_OBJECT_SCHEMA:${item.path}`);
        }
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "z" &&
          node.expression.name.text === "record"
        ) {
          issues.push(`ARBITRARY_KEY_SCHEMA:${item.path}`);
        }

        if (isOrmCall(node)) {
          ormCalls += 1;
          for (const argument of node.arguments) {
            inspectOrmArgument(argument, sourceFile, item.path, issues);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  if (ormCalls === 0) issues.push("ORM_SCAN_VACUOUS");
  return [...new Set(issues)].toSorted();
}

function isOrmCall(node: ts.CallExpression) {
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    ORM_METHODS.has(node.expression.name.text)
  );
}

function inspectOrmArgument(
  argument: ts.Expression,
  sourceFile: ts.SourceFile,
  sourcePath: string,
  issues: string[],
) {
  const visit = (node: ts.Node) => {
    if (
      ts.isSpreadAssignment(node) &&
      ts.isObjectLiteralExpression(node.parent) &&
      containsUntrustedShapeName(node.expression) &&
      !isExplicitConditionalFieldSpread(node.expression)
    ) {
      issues.push(`ORM_UNTRUSTED_SPREAD:${sourcePath}`);
    }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      ORM_SHAPE_PROPERTIES.has(node.name.text) &&
      ts.isIdentifier(node.initializer) &&
      UNTRUSTED_SHAPE_NAMES.has(node.initializer.text)
    ) {
      issues.push(
        `ORM_UNTRUSTED_SHAPE:${sourcePath}:${node.name.text}:${node.initializer.text}`,
      );
    }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isComputedPropertyName(node.name) &&
      containsUntrustedShapeName(node.name.expression)
    ) {
      issues.push(`ORM_DYNAMIC_KEY:${sourcePath}:${node.name.getText(sourceFile)}`);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "json" &&
      ts.isIdentifier(node.expression.expression) &&
      (node.expression.expression.text === "request" ||
        node.expression.expression.text === "req")
    ) {
      issues.push(`ORM_DIRECT_REQUEST_BODY:${sourcePath}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(argument);
}

function containsUntrustedShapeName(node: ts.Node) {
  let found = false;
  const visit = (candidate: ts.Node) => {
    if (
      ts.isIdentifier(candidate) &&
      UNTRUSTED_SHAPE_NAMES.has(candidate.text)
    ) {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(candidate, visit);
  };
  visit(node);
  return found;
}

function isExplicitConditionalFieldSpread(node: ts.Expression): boolean {
  const value = ts.isParenthesizedExpression(node) ? node.expression : node;
  if (!ts.isConditionalExpression(value)) return false;
  return [value.whenTrue, value.whenFalse].every(
    (branch) =>
      ts.isObjectLiteralExpression(branch) &&
      branch.properties.every(
        (property) =>
          ts.isPropertyAssignment(property) &&
          !ts.isComputedPropertyName(property.name),
      ),
  );
}

const ORM_INJECTION_CONTROL_EVIDENCE = [
  "security/orm-injection-control-evidence.ts",
  "security/orm-injection-control-evidence.test.ts",
  "security/deserialization-control-evidence.ts",
  "security/deserialization-control-evidence.test.ts",
  "scripts/check-production-sql-safety.ts",
  "scripts/check-production-sql-safety.test.ts",
  "src/lib/listing-validation.ts",
  "src/lib/media-validation.ts",
] as const;

export const ORM_INJECTION_CONTROL_MASTER_EVIDENCE = {
  [ORM_INJECTION_CONTROL_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: ORM_INJECTION_CONTROL_EVIDENCE,
  },
};
