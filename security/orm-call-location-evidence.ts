import { createHash } from "node:crypto";

import ts from "typescript";

export const ORM_CALL_LOCATION_REQUIREMENT_ID =
  "security.actual-query-capture.locate";

export type OrmLocationSource = Readonly<{
  path: string;
  source: string;
}>;

export type OrmInvocationKind = "call" | "tagged-template";

export type OrmCallLocation = Readonly<{
  key: string;
  sourceFile: string;
  sourceSymbol: string;
  line: number;
  column: number;
  receiver: string;
  model: string | null;
  operation: string;
  invocation: OrmInvocationKind;
}>;

export type OrmCallLocationBaseline = Readonly<{
  callCount: number;
  digest: string;
}>;

export type OrmCallLocationAudit = Readonly<{
  locations: readonly OrmCallLocation[];
  digest: string;
  issues: readonly string[];
}>;

const SOURCE_PATH = /^src\/(?!.*(?:^|\/)__tests__(?:\/|$)).+\.tsx?$/u;
const TEST_SOURCE = /(?:^|\/)[^/]+\.(?:test|spec|stories)\.tsx?$/u;
const DELEGATE_METHODS = new Set([
  "aggregate",
  "count",
  "create",
  "createMany",
  "createManyAndReturn",
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
  "updateManyAndReturn",
  "upsert",
]);
const CLIENT_METHODS = new Set([
  "$executeRaw",
  "$executeRawUnsafe",
  "$queryRaw",
  "$queryRawUnsafe",
  "$transaction",
]);
const DEFAULT_DATABASE_ROOTS = new Set([
  "cleanupPrisma",
  "client",
  "db",
  "prisma",
  "tx",
]);

type DatabaseBindings = Readonly<{
  clientRoots: ReadonlySet<string>;
  delegateAliases: ReadonlyMap<string, string>;
}>;

export const PRODUCTION_ORM_LOCATION_BASELINE = {
  callCount: 944,
  digest: "2f9f5d4f437644439b8756cd3ec6748f6d7e013807399240b427fa2f0a966542",
} as const satisfies OrmCallLocationBaseline;

export const ORM_CALL_LOCATION_SCOPE =
  "Source-only exhaustive location of direct Prisma delegate operations, raw executions, and transaction calls in non-test production files under src. Each location binds the real source file, nearest source symbol, line, receiver/model, operation, and invocation form to a frozen inventory digest. This verifies repository/ORM call location only; it does not claim generated SQL capture for every call, runtime execution, authorization correctness, query performance, deployed-database parity, or production readiness.";

export const ORM_CALL_LOCATION_MASTER_EVIDENCE = {
  [ORM_CALL_LOCATION_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "src",
      "security/orm-call-location-evidence.ts",
      "security/orm-call-location-evidence.test.ts",
    ],
  },
};

export function auditOrmCallLocations(
  sources: readonly OrmLocationSource[],
  baseline: OrmCallLocationBaseline,
): OrmCallLocationAudit {
  const issues: string[] = [];
  const normalizedSources = sources.map(({ path, source }) => ({
    path: normalizePath(path),
    source,
  }));
  const paths = normalizedSources.map(({ path }) => path);

  if (sources.length === 0) issues.push("ORM_LOCATION_SOURCE_INVENTORY_VACUOUS");
  if (new Set(paths).size !== paths.length) {
    issues.push("ORM_LOCATION_SOURCE_PATH_DUPLICATE");
  }
  for (const path of paths) {
    if (!SOURCE_PATH.test(path) || TEST_SOURCE.test(path)) {
      issues.push(`ORM_LOCATION_SOURCE_PATH_INVALID:${path}`);
    }
  }

  const locations = normalizedSources
    .flatMap(({ path, source }) => discoverOrmCallLocations(path, source, issues))
    .sort((left, right) => left.key.localeCompare(right.key));
  if (locations.length === 0) issues.push("ORM_LOCATION_CALL_INVENTORY_VACUOUS");
  if (new Set(locations.map(({ key }) => key)).size !== locations.length) {
    issues.push("ORM_LOCATION_CALL_DUPLICATE");
  }
  for (const location of locations) {
    if (location.sourceSymbol === "<module>") {
      issues.push(`ORM_LOCATION_SOURCE_SYMBOL_MISSING:${location.key}`);
    }
  }

  const digest = digestLocations(locations);
  if (baseline.callCount !== locations.length) {
    issues.push(
      `ORM_LOCATION_CALL_COUNT_DRIFT:${baseline.callCount}:${locations.length}`,
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(baseline.digest) || baseline.digest !== digest) {
    issues.push(`ORM_LOCATION_DIGEST_DRIFT:${baseline.digest || "missing"}:${digest}`);
  }

  return { locations, digest, issues };
}

export function discoverOrmCallLocations(
  path: string,
  source: string,
  issues: string[] = [],
): OrmCallLocation[] {
  const scriptKind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const diagnostics = (
    sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
  ).parseDiagnostics;
  if (diagnostics?.length) {
    issues.push(`ORM_LOCATION_SOURCE_PARSE_ERROR:${path}:${diagnostics.length}`);
  }

  const databaseBindings = discoverDatabaseBindings(sourceFile);
  const locations: OrmCallLocation[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expression = unwrapExpression(node.expression);
      if (ts.isPropertyAccessExpression(expression)) {
        const located = locatePropertyInvocation(
          path,
          sourceFile,
          node,
          expression,
          "call",
          databaseBindings,
        );
        if (located) locations.push(located);
      }
    } else if (ts.isTaggedTemplateExpression(node)) {
      const tag = unwrapExpression(node.tag);
      if (ts.isPropertyAccessExpression(tag)) {
        const located = locatePropertyInvocation(
          path,
          sourceFile,
          node,
          tag,
          "tagged-template",
          databaseBindings,
        );
        if (located) locations.push(located);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return locations;
}

export function digestLocations(locations: readonly OrmCallLocation[]) {
  return createHash("sha256")
    .update(locations.map(({ key }) => key).join("\n"), "utf8")
    .digest("hex");
}

function locatePropertyInvocation(
  path: string,
  sourceFile: ts.SourceFile,
  node: ts.CallExpression | ts.TaggedTemplateExpression,
  expression: ts.PropertyAccessExpression,
  invocation: OrmInvocationKind,
  databaseBindings: DatabaseBindings,
): OrmCallLocation | null {
  const operation = expression.name.text;
  const receiver = compact(expression.expression.getText(sourceFile));
  const receiverRoot = rootIdentifier(expression.expression);
  const directDatabaseReceiver =
    receiverRoot !== null && databaseBindings.clientRoots.has(receiverRoot);
  const requestDatabaseReceiver = /(?:^|\.)db\.[A-Za-z_$][\w$]*$/u.test(
    receiver,
  );

  let model: string | null = null;
  if (DELEGATE_METHODS.has(operation)) {
    if (!directDatabaseReceiver && !requestDatabaseReceiver) return null;
    if (ts.isPropertyAccessExpression(expression.expression)) {
      model = expression.expression.name.text;
    } else if (ts.isIdentifier(expression.expression)) {
      model = databaseBindings.delegateAliases.get(expression.expression.text) ?? null;
      if (model === null) return null;
    } else {
      return null;
    }
  } else if (CLIENT_METHODS.has(operation)) {
    if (!directDatabaseReceiver || ts.isPropertyAccessExpression(expression.expression)) {
      return null;
    }
  } else {
    return null;
  }

  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const sourceSymbol = nearestSourceSymbol(node);
  const line = start.line + 1;
  const column = start.character + 1;
  const key = [
    path,
    line,
    column,
    sourceSymbol,
    receiver,
    model ?? "client",
    operation,
    invocation,
  ].join(":");
  return {
    key,
    sourceFile: path,
    sourceSymbol,
    line,
    column,
    receiver,
    model,
    operation,
    invocation,
  };
}

function discoverDatabaseBindings(sourceFile: ts.SourceFile): DatabaseBindings {
  const roots = new Set(DEFAULT_DATABASE_ROOTS);
  const delegateAliases = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const initializer = unwrapExpression(node.initializer);
      if (initializer && isPrismaClientConstruction(initializer)) {
        roots.add(node.name.text);
      } else if (initializer && isKnownDatabaseExpression(initializer, roots)) {
        roots.add(node.name.text);
        if (ts.isPropertyAccessExpression(initializer)) {
          delegateAliases.set(node.name.text, initializer.name.text);
        }
      }
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const typeText = node.type?.getText(sourceFile) ?? "";
      if (/(?:PrismaClient|TransactionClient|DbRequestClient|DatabaseClient)/u.test(typeText)) {
        roots.add(node.name.text);
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = compact(node.expression.getText(sourceFile));
      if (/(?:withDb[A-Za-z0-9_$]*|\.\$transaction)$/u.test(callee)) {
        for (const argument of node.arguments) {
          if (!ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument)) {
            continue;
          }
          for (const parameter of argument.parameters) {
            if (ts.isIdentifier(parameter.name)) roots.add(parameter.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { clientRoots: roots, delegateAliases };
}

function isPrismaClientConstruction(node: ts.Expression) {
  return (
    ts.isNewExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "PrismaClient"
  );
}

function isKnownDatabaseExpression(
  node: ts.Expression,
  roots: ReadonlySet<string>,
) {
  const root = rootIdentifier(node);
  return root !== null && roots.has(root);
}

function rootIdentifier(node: ts.Expression): string | null {
  let current = unwrapExpression(node);
  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current)
  ) {
    current = unwrapExpression(current.expression);
  }
  return ts.isIdentifier(current) ? current.text : null;
}

function nearestSourceSymbol(node: ts.Node) {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (ts.isMethodDeclaration(current) && current.name) return current.name.getText();
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const owner = functionExpressionOwner(current);
      if (owner) return owner;
    }
    current = current.parent;
  }
  return "<module>";
}

function functionExpressionOwner(
  expression: ts.ArrowFunction | ts.FunctionExpression,
) {
  let current: ts.Node = expression;
  while (
    ts.isCallExpression(current.parent) ||
    ts.isParenthesizedExpression(current.parent) ||
    ts.isAsExpression(current.parent) ||
    ts.isSatisfiesExpression(current.parent)
  ) {
    current = current.parent;
  }
  if (
    ts.isVariableDeclaration(current.parent) &&
    ts.isIdentifier(current.parent.name)
  ) {
    return current.parent.name.text;
  }
  if (ts.isPropertyAssignment(current.parent)) {
    return current.parent.name.getText();
  }
  return null;
}

function unwrapExpression(node: ts.Expression | undefined): ts.Expression {
  let current = node ?? ts.factory.createNull();
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function compact(value: string) {
  return value.replace(/\s+/gu, "").replaceAll("?.", ".");
}

function normalizePath(path: string) {
  return path.replaceAll("\\", "/");
}
