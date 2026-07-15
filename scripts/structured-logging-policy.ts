import { readdirSync, readFileSync } from "node:fs";
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
const LOGGER_PATH = "src/lib/logger.ts";
const LOGGER_SINK_METHODS = new Set(["error", "info", "warn"]);
const REACT_CLIENT_EFFECT_EXPORTS = new Set([
  "useEffect",
  "useInsertionEffect",
  "useLayoutEffect",
]);

export type StructuredLoggingBypass = {
  file: string;
  line: number;
  column: number;
  method: string;
};

export function findStructuredLoggingBypasses(
  repoRoot = process.cwd(),
): StructuredLoggingBypass[] {
  const sourceRoot = resolve(repoRoot, "src");
  const findings: StructuredLoggingBypass[] = [];
  const findingKeys = new Set<string>();

  for (const file of collectSourceFiles(sourceRoot)) {
    const repoPath = relative(repoRoot, file).replace(/\\/g, "/");
    if (isTestFile(repoPath)) continue;

    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      scriptKindFor(file),
    );
    const clientModule = hasUseClientDirective(sourceFile);
    const clientEffectBindings = clientModule
      ? findReactClientEffectBindings(sourceFile)
      : new Set<string>();
    const aliases = findConsoleAliases(sourceFile);

    visit(sourceFile, (node) => {
      if (!ts.isCallExpression(node)) return;
      const method =
        consoleMethod(node, aliases) ?? processStreamMethod(node.expression);
      if (
        clientModule &&
        isImportedReactClientEffectCall(node, clientEffectBindings)
      ) {
        return;
      }
      if (!method || isAllowedLoggerSink(repoPath, method, node)) return;

      const position = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      const findingKey = `${repoPath}:${position.line}:${position.character}:${method}`;
      if (findingKeys.has(findingKey)) return;
      findingKeys.add(findingKey);
      findings.push({
        file: repoPath,
        line: position.line + 1,
        column: position.character + 1,
        method,
      });
    });
  }

  return findings.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
  );
}

function processStreamMethod(expression: ts.LeftHandSideExpression) {
  const target = unwrapExpression(expression);
  if (
    !ts.isPropertyAccessExpression(target) ||
    target.name.text !== "write"
  ) {
    return null;
  }
  const stream = unwrapExpression(target.expression);
  if (
    ts.isPropertyAccessExpression(stream) &&
    ts.isIdentifier(stream.expression) &&
    stream.expression.text === "process" &&
    ["stderr", "stdout"].includes(stream.name.text)
  ) {
    return `${stream.name.text}.write`;
  }
  if (
    ts.isElementAccessExpression(stream) &&
    ts.isIdentifier(stream.expression) &&
    stream.expression.text === "process" &&
    stream.argumentExpression &&
    ts.isStringLiteralLike(stream.argumentExpression) &&
    ["stderr", "stdout"].includes(stream.argumentExpression.text)
  ) {
    return `${stream.argumentExpression.text}.write`;
  }
  return null;
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

function isTestFile(path: string) {
  return (
    /(^|\/)__tests__(\/|$)/.test(path) || /\.(test|spec)\.[^.]+$/.test(path)
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

function hasUseClientDirective(sourceFile: ts.SourceFile) {
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      return false;
    }
    if (statement.expression.text === "use client") return true;
  }
  return false;
}

function findReactClientEffectBindings(sourceFile: ts.SourceFile) {
  const bindings = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "react" ||
      !statement.importClause ||
      !statement.importClause.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }

    for (const element of statement.importClause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (REACT_CLIENT_EFFECT_EXPORTS.has(importedName)) {
        bindings.add(element.name.text);
      }
    }
  }
  return bindings;
}

function visit(node: ts.Node, inspect: (node: ts.Node) => void) {
  inspect(node);
  node.forEachChild((child) => visit(child, inspect));
}

type ConsoleAliases = {
  objects: Set<string>;
  methods: Map<string, string>;
};

function findConsoleAliases(sourceFile: ts.SourceFile): ConsoleAliases {
  const aliases: ConsoleAliases = {
    objects: new Set(["console"]),
    methods: new Map(),
  };

  let changed = true;
  while (changed) {
    changed = false;
    visit(sourceFile, (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        changed =
          registerBindingAlias(node.name, node.initializer, aliases) || changed;
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        changed =
          registerAssignmentAlias(node.left, node.right, aliases) || changed;
      }
    });
  }

  return aliases;
}

function registerAssignmentAlias(
  target: ts.Expression,
  initializer: ts.Expression,
  aliases: ConsoleAliases,
) {
  const binding = unwrapExpression(target);
  if (ts.isIdentifier(binding)) {
    return registerIdentifierAlias(binding, initializer, aliases);
  }
  if (
    !ts.isObjectLiteralExpression(binding) ||
    !isConsoleObject(initializer, aliases)
  ) {
    return false;
  }

  let changed = false;
  for (const property of binding.properties) {
    if (ts.isShorthandPropertyAssignment(property)) {
      changed =
        addMethodAlias(property.name.text, property.name.text, aliases) ||
        changed;
    } else if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.initializer)
    ) {
      changed =
        addMethodAlias(
          property.initializer.text,
          bindingPropertyName(property.name),
          aliases,
        ) || changed;
    } else if (
      ts.isSpreadAssignment(property) &&
      ts.isIdentifier(property.expression)
    ) {
      changed = addObjectAlias(property.expression.text, aliases) || changed;
    }
  }
  return changed;
}

function registerBindingAlias(
  binding: ts.BindingName,
  initializer: ts.Expression,
  aliases: ConsoleAliases,
) {
  if (ts.isIdentifier(binding)) {
    return registerIdentifierAlias(binding, initializer, aliases);
  }
  if (
    !ts.isObjectBindingPattern(binding) ||
    !isConsoleObject(initializer, aliases)
  ) {
    return false;
  }

  let changed = false;
  for (const element of binding.elements) {
    if (!ts.isIdentifier(element.name)) continue;
    if (element.dotDotDotToken) {
      changed = addObjectAlias(element.name.text, aliases) || changed;
      continue;
    }
    const method = bindingPropertyName(element.propertyName ?? element.name);
    changed = addMethodAlias(element.name.text, method, aliases) || changed;
  }
  return changed;
}

function registerIdentifierAlias(
  identifier: ts.Identifier,
  initializer: ts.Expression,
  aliases: ConsoleAliases,
) {
  if (isConsoleObject(initializer, aliases)) {
    return addObjectAlias(identifier.text, aliases);
  }
  const method = consoleMethodReference(initializer, aliases);
  return method ? addMethodAlias(identifier.text, method, aliases) : false;
}

function addObjectAlias(name: string, aliases: ConsoleAliases) {
  if (aliases.objects.has(name)) return false;
  aliases.objects.add(name);
  return true;
}

function addMethodAlias(name: string, method: string, aliases: ConsoleAliases) {
  const existing = aliases.methods.get(name);
  if (existing === method || existing === "[computed]") return false;
  if (existing) {
    aliases.methods.set(name, "[computed]");
    return true;
  }
  aliases.methods.set(name, method);
  return true;
}

function bindingPropertyName(name: ts.PropertyName) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return "[computed]";
}

function consoleMethod(
  call: ts.CallExpression,
  aliases: ConsoleAliases,
): string | null {
  const direct = consoleMethodReference(call.expression, aliases);
  if (direct) return direct;
  if (isReflectMethod(call.expression, "apply") && call.arguments[0]) {
    return consoleMethodReference(call.arguments[0], aliases);
  }
  return null;
}

function consoleMethodReference(
  expression: ts.Expression,
  aliases: ConsoleAliases,
): string | null {
  const target = unwrapExpression(expression);
  if (ts.isIdentifier(target)) return aliases.methods.get(target.text) ?? null;
  if (ts.isPropertyAccessExpression(target)) {
    if (isConsoleObject(target.expression, aliases)) return target.name.text;
    if (["apply", "bind", "call"].includes(target.name.text)) {
      return consoleMethodReference(target.expression, aliases);
    }
  }
  if (
    ts.isElementAccessExpression(target) &&
    isConsoleObject(target.expression, aliases)
  ) {
    const argument = target.argumentExpression;
    return argument && ts.isStringLiteralLike(argument)
      ? argument.text
      : "[computed]";
  }
  if (ts.isCallExpression(target)) {
    if (
      isReflectMethod(target.expression, "get") &&
      target.arguments[0] &&
      isConsoleObject(target.arguments[0], aliases)
    ) {
      const property = target.arguments[1];
      return property && ts.isStringLiteralLike(property)
        ? property.text
        : "[computed]";
    }
    const method = consoleMethodReference(target.expression, aliases);
    return method && isBindCall(target.expression) ? method : null;
  }
  return null;
}

function isReflectMethod(expression: ts.Expression, method: string) {
  const target = unwrapExpression(expression);
  if (ts.isPropertyAccessExpression(target)) {
    return (
      ts.isIdentifier(target.expression) &&
      target.expression.text === "Reflect" &&
      target.name.text === method
    );
  }
  return (
    ts.isElementAccessExpression(target) &&
    ts.isIdentifier(target.expression) &&
    target.expression.text === "Reflect" &&
    Boolean(
      target.argumentExpression &&
      ts.isStringLiteralLike(target.argumentExpression) &&
      target.argumentExpression.text === method,
    )
  );
}

function isBindCall(expression: ts.LeftHandSideExpression) {
  const target = unwrapExpression(expression);
  return ts.isPropertyAccessExpression(target) && target.name.text === "bind";
}

function isConsoleObject(expression: ts.Expression, aliases: ConsoleAliases) {
  const target = unwrapExpression(expression);
  if (ts.isIdentifier(target)) return aliases.objects.has(target.text);
  if (
    ts.isPropertyAccessExpression(target) &&
    ts.isIdentifier(target.expression) &&
    target.expression.text === "globalThis" &&
    target.name.text === "console"
  ) {
    return true;
  }
  return (
    ts.isElementAccessExpression(target) &&
    ts.isIdentifier(target.expression) &&
    target.expression.text === "globalThis" &&
    Boolean(
      target.argumentExpression &&
      ts.isStringLiteralLike(target.argumentExpression) &&
      target.argumentExpression.text === "console",
    )
  );
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  while (
    ts.isBinaryExpression(current) &&
    current.operatorToken.kind === ts.SyntaxKind.CommaToken
  ) {
    current = unwrapExpression(current.right);
  }
  return current;
}

function isImportedReactClientEffectCall(
  call: ts.CallExpression,
  clientEffectBindings: ReadonlySet<string>,
) {
  for (
    let parent: ts.Node | undefined = call.parent;
    parent;
    parent = parent.parent
  ) {
    if (
      isRuntimeFunctionLike(parent) &&
      ts.isCallExpression(parent.parent) &&
      parent.parent.arguments.includes(parent as ts.Expression) &&
      ts.isIdentifier(parent.parent.expression) &&
      clientEffectBindings.has(parent.parent.expression.text) &&
      !hasEnclosingRuntimeBinding(parent.parent, parent.parent.expression.text)
    ) {
      return true;
    }
  }
  return false;
}

function hasEnclosingRuntimeBinding(node: ts.Node, name: string) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      isRuntimeFunctionLike(parent) &&
      functionScopeDeclaresRuntimeBinding(parent, name)
    ) {
      return true;
    }
  }
  return false;
}

function functionScopeDeclaresRuntimeBinding(
  scope: ts.FunctionLikeDeclaration,
  name: string,
) {
  if (scope.name && ts.isIdentifier(scope.name) && scope.name.text === name) {
    return true;
  }
  if (
    scope.parameters.some((parameter) =>
      bindingNameContains(parameter.name, name),
    )
  ) {
    return true;
  }

  let declared = false;
  const body = scope.body;
  if (!body) return false;
  const inspect = (candidate: ts.Node) => {
    if (declared) return;
    if (candidate !== body && isRuntimeFunctionLike(candidate)) {
      if (
        ts.isFunctionDeclaration(candidate) &&
        candidate.name?.text === name
      ) {
        declared = true;
      }
      return;
    }
    if (
      (ts.isVariableDeclaration(candidate) &&
        bindingNameContains(candidate.name, name)) ||
      ((ts.isClassDeclaration(candidate) || ts.isEnumDeclaration(candidate)) &&
        candidate.name?.text === name) ||
      (ts.isCatchClause(candidate) &&
        candidate.variableDeclaration &&
        bindingNameContains(candidate.variableDeclaration.name, name))
    ) {
      declared = true;
      return;
    }
    candidate.forEachChild(inspect);
  };
  inspect(body);
  return declared;
}

function bindingNameContains(binding: ts.BindingName, name: string): boolean {
  if (ts.isIdentifier(binding)) return binding.text === name;
  return binding.elements.some(
    (element) =>
      !ts.isOmittedExpression(element) &&
      bindingNameContains(element.name, name),
  );
}

function isRuntimeFunctionLike(
  node: ts.Node,
): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
  );
}

function isAllowedLoggerSink(
  repoPath: string,
  method: string,
  call: ts.CallExpression,
) {
  if (repoPath !== LOGGER_PATH || !isInsideEmit(call)) return false;

  if (LOGGER_SINK_METHODS.has(method)) {
    return (
      isExactConsoleSink(call.expression, method) &&
      call.arguments.length === 1 &&
      ts.isIdentifier(call.arguments[0]) &&
      call.arguments[0].text === "line"
    );
  }

  return (
    method === "stderr.write" &&
    isExactStderrSink(call.expression) &&
    call.arguments.length === 1 &&
    isLineWithNewline(call.arguments[0])
  );
}

function isInsideEmit(call: ts.CallExpression) {
  for (let parent = call.parent; parent; parent = parent.parent) {
    if (ts.isFunctionLike(parent)) {
      return ts.isFunctionDeclaration(parent) && parent.name?.text === "emit";
    }
  }
  return false;
}

function isExactConsoleSink(
  expression: ts.LeftHandSideExpression,
  method: string,
) {
  const target = unwrapExpression(expression);
  return (
    ts.isPropertyAccessExpression(target) &&
    ts.isIdentifier(target.expression) &&
    target.expression.text === "console" &&
    target.name.text === method
  );
}

function isExactStderrSink(expression: ts.LeftHandSideExpression) {
  const target = unwrapExpression(expression);
  return (
    ts.isPropertyAccessExpression(target) &&
    target.name.text === "write" &&
    ts.isPropertyAccessExpression(target.expression) &&
    ts.isIdentifier(target.expression.expression) &&
    target.expression.expression.text === "process" &&
    target.expression.name.text === "stderr"
  );
}

function isLineWithNewline(argument: ts.Expression) {
  return (
    ts.isTemplateExpression(argument) &&
    argument.head.text === "" &&
    argument.templateSpans.length === 1 &&
    ts.isIdentifier(argument.templateSpans[0].expression) &&
    argument.templateSpans[0].expression.text === "line" &&
    argument.templateSpans[0].literal.text === "\n"
  );
}

function isMainModule() {
  return Boolean(
    process.argv[1] &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
  );
}

if (isMainModule()) {
  const findings = findStructuredLoggingBypasses();
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(
        `${finding.file}:${finding.line}:${finding.column} direct console.${finding.method} bypasses src/lib/logger.ts`,
      );
    }
    process.exitCode = 1;
  } else {
    console.log(
      "Structured logging policy passed: no runtime-server output bypasses.",
    );
  }
}
