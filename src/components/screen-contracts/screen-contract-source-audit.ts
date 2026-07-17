import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export function getLocalSourceClosure(
  entryPath: string,
  repoRoot = path.resolve("."),
  options?: Readonly<{ ignoredFiles?: ReadonlySet<string> }>,
) {
  const canonicalRoot = path.resolve(repoRoot);
  const pending = [path.resolve(canonicalRoot, entryPath)];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const absolutePath = pending.pop()!;
    const repoPath = normalizeRepoPath(path.relative(canonicalRoot, absolutePath));
    if (
      repoPath === ".." ||
      repoPath.startsWith("../") ||
      path.isAbsolute(repoPath)
    ) {
      throw new Error(`${entryPath}: local import escaped the repository`);
    }
    if (visited.has(repoPath)) continue;
    if (options?.ignoredFiles?.has(repoPath)) continue;
    visited.add(repoPath);

    const source = readFileSync(absolutePath, "utf8");
    const sourceFile = parseSource(absolutePath, source);
    for (const specifier of localImportSpecifiers(sourceFile)) {
      const resolved = resolveLocalImport(absolutePath, specifier, canonicalRoot);
      if (resolved) pending.push(resolved);
    }
  }

  return visited;
}

export function findFormSubmissionSignals(repoPath: string) {
  const sourceFile = parseSource(
    repoPath,
    readFileSync(path.resolve(repoPath), "utf8")
  );
  const signals: string[] = [];

  visitSource(sourceFile, (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (
        tagName.toLowerCase() === "form" ||
        tagName === "Form" ||
        tagName.endsWith(".Form")
      ) {
        signals.push(signal(repoPath, sourceFile, node, `<${tagName}>`));
      }
      if (tagName === "button" || tagName === "input") {
        const type = jsxAttribute(node, sourceFile, "type");
        if (
          type?.initializer &&
          ts.isStringLiteral(type.initializer) &&
          type.initializer.text === "submit"
        ) {
          signals.push(signal(repoPath, sourceFile, type, "type=submit"));
        }
      }
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (name === "onSubmit" || name === "formAction") {
        signals.push(signal(repoPath, sourceFile, node, name));
      }
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(sourceFile);
      if (
        expression === "useActionState" ||
        expression.endsWith(".requestSubmit")
      ) {
        signals.push(signal(repoPath, sourceFile, node, expression));
      }
    }
  });

  return signals;
}

export function findUserActionSignals(repoPath: string) {
  const sourceFile = parseSource(
    repoPath,
    readFileSync(path.resolve(repoPath), "utf8")
  );
  const signals: string[] = [];

  visitSource(sourceFile, (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (["a", "button", "form", "Link", "Form"].includes(tagName)) {
        signals.push(signal(repoPath, sourceFile, node, `<${tagName}>`));
      }
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (["onClick", "onSubmit", "formAction"].includes(name)) {
        signals.push(signal(repoPath, sourceFile, node, name));
      }
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(sourceFile);
      if (
        ["redirect", "permanentRedirect", "useActionState"].includes(
          expression
        ) ||
        /^(?:router|navigation)\.(?:push|replace|back|refresh)$/.test(
          expression
        ) ||
        expression.endsWith(".requestSubmit")
      ) {
        signals.push(signal(repoPath, sourceFile, node, expression));
      }
    }
  });

  return signals;
}

function parseSource(filePath: string, source: string) {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function visitSource(sourceFile: ts.SourceFile, inspect: (node: ts.Node) => void) {
  function visit(node: ts.Node) {
    inspect(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function localImportSpecifiers(sourceFile: ts.SourceFile) {
  const specifiers: string[] = [];
  visitSource(sourceFile, (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
  });
  return specifiers;
}

function resolveLocalImport(
  fromPath: string,
  specifier: string,
  repoRoot = path.resolve("."),
) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  const base = specifier.startsWith("@/")
    ? path.resolve(repoRoot, "src", specifier.slice(2))
    : path.resolve(path.dirname(fromPath), specifier);
  const candidates = path.extname(base)
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.jsx`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
        path.join(base, "index.js"),
        path.join(base, "index.jsx"),
      ];
  return (
    candidates.find(
      (candidate) => /\.[cm]?[jt]sx?$/.test(candidate) && existsSync(candidate)
    ) ?? null
  );
}

function jsxAttribute(
  node: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
  name: string
) {
  return node.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(sourceFile) === name
  );
}

function signal(
  repoPath: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  label: string
) {
  const line =
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return `${normalizeRepoPath(repoPath)}:${line}:${label}`;
}

function normalizeRepoPath(filePath: string) {
  return filePath.replaceAll("\\", "/");
}
