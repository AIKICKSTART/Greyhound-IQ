import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);
const SAFE_RAW_METHODS = new Set(["$executeRaw", "$queryRaw"]);
const UNSAFE_RAW_METHODS = new Set([
  "$executeRawUnsafe",
  "$queryRawUnsafe",
]);

export type ProductionSqlSafetyViolation = {
  file: string;
  line: number;
  column: number;
  code:
    | "DETACHED_RAW_METHOD"
    | "DYNAMIC_RAW_METHOD"
    | "PRISMA_RAW"
    | "UNPARAMETERIZED_RAW_CALL"
    | "UNSAFE_RAW_METHOD";
  message: string;
};

export type ProductionSqlSafetyAudit = {
  scannedFiles: number;
  safeRawOperationCount: number;
  violations: ProductionSqlSafetyViolation[];
};

type SourceInspection = Pick<
  ProductionSqlSafetyAudit,
  "safeRawOperationCount" | "violations"
>;

type PrismaBindings = {
  direct: Set<string>;
  modules: Set<string>;
};

export function auditProductionSqlSafety(
  repoRoot = process.cwd(),
): ProductionSqlSafetyAudit {
  const sourceRoot = resolve(repoRoot, "src");
  const sourceFiles = collectSourceFiles(sourceRoot);
  const violations: ProductionSqlSafetyViolation[] = [];
  let safeRawOperationCount = 0;

  for (const file of sourceFiles) {
    const repoPath = relative(repoRoot, file).replace(/\\/g, "/");
    if (isTestFile(repoPath)) continue;
    const inspection = inspectProductionSqlSource(
      repoPath,
      readFileSync(file, "utf8"),
    );
    safeRawOperationCount += inspection.safeRawOperationCount;
    violations.push(...inspection.violations);
  }

  return {
    scannedFiles: sourceFiles.filter(
      (file) => !isTestFile(relative(repoRoot, file).replace(/\\/g, "/")),
    ).length,
    safeRawOperationCount,
    violations: violations.sort(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        left.column - right.column,
    ),
  };
}

export function inspectProductionSqlSource(
  file: string,
  source: string,
): SourceInspection {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file),
  );
  const prismaBindings = findPrismaBindings(sourceFile);
  const violations: ProductionSqlSafetyViolation[] = [];
  const findingKeys = new Set<string>();
  let safeRawOperationCount = 0;

  visit(sourceFile, (node) => {
    if (ts.isBindingElement(node)) {
      const name = bindingPropertyName(node);
      if (name && (SAFE_RAW_METHODS.has(name) || UNSAFE_RAW_METHODS.has(name))) {
        addViolation(
          node,
          "DETACHED_RAW_METHOD",
          `${name} must not be detached or destructured from a database client`,
        );
      }
      if (name === "raw" && isPrismaDestructure(node, prismaBindings)) {
        addViolation(
          node,
          "PRISMA_RAW",
          "Prisma.raw must not be detached or used in production SQL",
        );
      }
      return;
    }

    if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
      return;
    }

    const name = staticPropertyName(node);
    if (!name) return;

    if (UNSAFE_RAW_METHODS.has(name)) {
      addViolation(
        node,
        "UNSAFE_RAW_METHOD",
        `${name} is forbidden in production source`,
      );
      return;
    }

    if (name === "raw" && isPrismaNamespace(node.expression, prismaBindings)) {
      addViolation(
        node,
        "PRISMA_RAW",
        "Prisma.raw is forbidden because it can interpolate untrusted SQL text",
      );
      return;
    }

    if (!SAFE_RAW_METHODS.has(name)) return;
    if (ts.isElementAccessExpression(node)) {
      addViolation(
        node,
        "DYNAMIC_RAW_METHOD",
        `${name} must use direct property access so the parameterization policy cannot be bypassed`,
      );
      return;
    }

    if (isSafeTaggedRawOperation(node) || isSafePrismaSqlCall(node, prismaBindings)) {
      safeRawOperationCount += 1;
      return;
    }

    if (isDirectCallTarget(node)) {
      addViolation(
        node,
        "UNPARAMETERIZED_RAW_CALL",
        `${name} must use tagged-template syntax or one direct Prisma.sql tagged template`,
      );
      return;
    }

    addViolation(
      node,
      "DETACHED_RAW_METHOD",
      `${name} must not be detached, aliased, reflected, bound, or invoked indirectly`,
    );
  });

  return { safeRawOperationCount, violations };

  function addViolation(
    node: ts.Node,
    code: ProductionSqlSafetyViolation["code"],
    message: string,
  ) {
    const position = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    const key = `${position.line}:${position.character}:${code}`;
    if (findingKeys.has(key)) return;
    findingKeys.add(key);
    violations.push({
      file,
      line: position.line + 1,
      column: position.character + 1,
      code,
      message,
    });
  }
}

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Unsupported symbolic link under src: ${fullPath}`);
    }
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    if (SOURCE_EXTENSIONS.has(extension)) files.push(fullPath);
  }
  return files;
}

function isTestFile(file: string) {
  return (
    /(^|\/)__tests__(\/|$)/.test(file) || /\.(test|spec)\.[^.]+$/.test(file)
  );
}

function scriptKindFor(file: string) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function findPrismaBindings(sourceFile: ts.SourceFile): PrismaBindings {
  const bindings: PrismaBindings = {
    direct: new Set(["Prisma"]),
    modules: new Set(),
  };

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@prisma/client" ||
      !statement.importClause
    ) {
      continue;
    }

    if (statement.importClause.name) {
      bindings.modules.add(statement.importClause.name.text);
    }
    const namedBindings = statement.importClause.namedBindings;
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      bindings.modules.add(namedBindings.name.text);
      continue;
    }
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;
    for (const element of namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName === "Prisma") bindings.direct.add(element.name.text);
    }
  }

  return bindings;
}

function isPrismaNamespace(
  expression: ts.Expression,
  bindings: PrismaBindings,
) {
  const target = unwrapExpression(expression);
  if (ts.isIdentifier(target)) return bindings.direct.has(target.text);
  if (!ts.isPropertyAccessExpression(target) || target.name.text !== "Prisma") {
    return false;
  }
  const moduleBinding = unwrapExpression(target.expression);
  return (
    ts.isIdentifier(moduleBinding) && bindings.modules.has(moduleBinding.text)
  );
}

function isPrismaDestructure(
  node: ts.BindingElement,
  bindings: PrismaBindings,
) {
  const pattern = node.parent;
  if (!ts.isObjectBindingPattern(pattern)) return false;
  const declaration = pattern.parent;
  return (
    ts.isVariableDeclaration(declaration) &&
    Boolean(
      declaration.initializer &&
        isPrismaNamespace(declaration.initializer, bindings),
    )
  );
}

function isSafeTaggedRawOperation(node: ts.PropertyAccessExpression) {
  return ts.isTaggedTemplateExpression(node.parent) && node.parent.tag === node;
}

function isSafePrismaSqlCall(
  node: ts.PropertyAccessExpression,
  bindings: PrismaBindings,
) {
  const parent = node.parent;
  return (
    ts.isCallExpression(parent) &&
    parent.expression === node &&
    parent.arguments.length === 1 &&
    isDirectPrismaSqlTemplate(parent.arguments[0], bindings)
  );
}

function isDirectPrismaSqlTemplate(
  expression: ts.Expression,
  bindings: PrismaBindings,
) {
  const target = unwrapExpression(expression);
  if (!ts.isTaggedTemplateExpression(target)) return false;
  const tag = unwrapExpression(target.tag);
  return (
    ts.isPropertyAccessExpression(tag) &&
    tag.name.text === "sql" &&
    isPrismaNamespace(tag.expression, bindings)
  );
}

function isDirectCallTarget(node: ts.Expression) {
  return ts.isCallExpression(node.parent) && node.parent.expression === node;
}

function bindingPropertyName(node: ts.BindingElement) {
  const name = node.propertyName ?? node.name;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return null;
}

function staticPropertyName(
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  const argument = node.argumentExpression;
  return argument && ts.isStringLiteralLike(argument) ? argument.text : null;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function visit(node: ts.Node, inspect: (node: ts.Node) => void) {
  inspect(node);
  node.forEachChild((child) => visit(child, inspect));
}

function isMainModule() {
  return Boolean(
    process.argv[1] &&
      pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
  );
}

if (isMainModule()) {
  const audit = auditProductionSqlSafety();
  if (audit.violations.length > 0) {
    for (const finding of audit.violations) {
      console.error(
        `${finding.file}:${finding.line}:${finding.column} ${finding.code} ${finding.message}`,
      );
    }
    process.exitCode = 1;
  } else {
    console.log(
      `Production SQL safety passed: ${audit.safeRawOperationCount} parameterized raw operations across ${audit.scannedFiles} production source files.`,
    );
  }
}
