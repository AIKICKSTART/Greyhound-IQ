import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import {
  PRODUCT_ACCESSIBILITY_SEMANTICS_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_SEMANTICS_MASTER_EVIDENCE,
  PRODUCT_ACCESSIBILITY_SEMANTICS_OPEN_REQUIREMENT_IDS,
  PRODUCT_ACCESSIBILITY_SEMANTICS_REQUIREMENT_IDS,
  PRODUCT_ACCESSIBILITY_SEMANTICS_SCOPE,
  PRODUCT_ACCESSIBILITY_SEMANTICS_TEST_FILE,
} from "./product-accessibility-semantics-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-ACCESSIBILITY-SEMANTICS-EVIDENCE

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const SOURCE_DIRECTORIES = ["src/app", "src/components"] as const;
const EXPECTED_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.tables",
  "GLOBAL.A11Y.dialogs",
] as const;
const EXPECTED_OPEN_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.headings",
  "GLOBAL.A11Y.names",
  "GLOBAL.A11Y.labels",
  "GLOBAL.A11Y.errors",
  "GLOBAL.A11Y.live-regions",
] as const;

assert.deepEqual(
  PRODUCT_ACCESSIBILITY_SEMANTICS_REQUIREMENT_IDS,
  EXPECTED_REQUIREMENT_IDS,
);
assert.deepEqual(
  PRODUCT_ACCESSIBILITY_SEMANTICS_OPEN_REQUIREMENT_IDS,
  EXPECTED_OPEN_REQUIREMENT_IDS,
);
assert.deepEqual(
  Object.keys(PRODUCT_ACCESSIBILITY_SEMANTICS_MASTER_EVIDENCE),
  EXPECTED_REQUIREMENT_IDS,
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of EXPECTED_REQUIREMENT_IDS) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  const evidence =
    PRODUCT_ACCESSIBILITY_SEMANTICS_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_ACCESSIBILITY_SEMANTICS_EVIDENCE_FILE,
    PRODUCT_ACCESSIBILITY_SEMANTICS_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((evidencePath) =>
    assert.equal(existsSync(resolveRepoPath(evidencePath)), true, evidencePath),
  );
}

for (const requirementId of EXPECTED_OPEN_REQUIREMENT_IDS) {
  assert.equal(
    (PRODUCT_ACCESSIBILITY_SEMANTICS_MASTER_EVIDENCE as Readonly<
      Record<string, unknown>
    >)[requirementId],
    undefined,
    `${requirementId} requires separate evidence`,
  );
}

const evidenceSource = source(PRODUCT_ACCESSIBILITY_SEMANTICS_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_ACCESSIBILITY_SEMANTICS_SCOPE, /source-static/i);
assert.match(PRODUCT_ACCESSIBILITY_SEMANTICS_SCOPE, /table structure/i);
assert.match(PRODUCT_ACCESSIBILITY_SEMANTICS_SCOPE, /dialog-primitive source boundary/i);
assert.match(PRODUCT_ACCESSIBILITY_SEMANTICS_SCOPE, /does not prove rendered browser focus movement/i);
assert.match(PRODUCT_ACCESSIBILITY_SEMANTICS_SCOPE, /assistive-technology announcements/i);

const sourceFiles = SOURCE_DIRECTORIES.flatMap((directory) =>
  walkFiles(resolveRepoPath(directory)),
)
  .filter(isProductionTsxFile)
  .toSorted((left, right) => left.localeCompare(right));
assert.ok(sourceFiles.length > 0);

const tableAudit = auditNativeTables(sourceFiles);
assert.ok(tableAudit.directTableCount > 0, "No native tables were audited");
assert.deepEqual(tableAudit.invalidTables, []);
assert.deepEqual(tableAudit.forwardingTableComponents, ["ResponsiveTable"]);
assert.equal(tableAudit.forwardingTableCallCount, 4);

const dialogAudit = auditDialogBoundary(sourceFiles);
assert.ok(dialogAudit.sheetConsumerFiles.length > 0);
assert.ok(dialogAudit.sheetContentCount > 0);
assert.deepEqual(dialogAudit.unnamedSheetContents, []);

console.log(
  `Accessibility semantic evidence passed: ${tableAudit.directTableCount} native tables and ${tableAudit.forwardingTableCallCount} ResponsiveTable callers retain native headers; ${dialogAudit.sheetContentCount} SheetContent surfaces use the shared titled Base UI dialog boundary.`,
);

type TableAudit = {
  directTableCount: number;
  forwardingTableComponents: string[];
  forwardingTableCallCount: number;
  invalidTables: string[];
};

function auditNativeTables(sourceFiles: readonly string[]): TableAudit {
  let directTableCount = 0;
  const forwardingTableComponents = new Set<string>();
  const invalidTables: string[] = [];
  const parsedSources = sourceFiles.map(parseSource);

  for (const parsed of parsedSources) {
    visit(parsed.sourceFile, (node) => {
      if (!ts.isJsxElement(node) || jsxTagName(node.openingElement, parsed.sourceFile) !== "table") {
        return;
      }
      directTableCount += 1;
      const location = sourceLocation(parsed, node);
      if (forwardsChildren(node)) {
        const componentName = enclosingComponentName(node);
        if (!componentName) {
          invalidTables.push(`${location}: table forwards children outside a component`);
          return;
        }
        forwardingTableComponents.add(componentName);
        return;
      }
      verifyTableStructure(node, parsed.sourceFile, location, invalidTables);
    });
  }

  let forwardingTableCallCount = 0;
  for (const parsed of parsedSources) {
    visit(parsed.sourceFile, (node) => {
      if (!ts.isJsxElement(node)) return;
      const tagName = jsxTagName(node.openingElement, parsed.sourceFile);
      if (!forwardingTableComponents.has(tagName)) return;
      forwardingTableCallCount += 1;
      verifyTableStructure(
        node,
        parsed.sourceFile,
        sourceLocation(parsed, node),
        invalidTables,
      );
    });
  }

  return {
    directTableCount,
    forwardingTableComponents: [...forwardingTableComponents].toSorted(),
    forwardingTableCallCount,
    invalidTables: invalidTables.toSorted(),
  };
}

function verifyTableStructure(
  node: ts.JsxElement,
  sourceFile: ts.SourceFile,
  location: string,
  invalidTables: string[],
) {
  const opening = node.openingElement;
  const hasThead = containsDescendantTag(node, sourceFile, "thead");
  const hasHeaderCell = containsDescendantTag(node, sourceFile, "th");
  const semanticRoleIsOverridden = [opening, ...descendantOpeningElements(node)]
    .some((element) => isPresentational(element, sourceFile));

  if (!hasThead) invalidTables.push(`${location}: missing <thead>`);
  if (!hasHeaderCell) invalidTables.push(`${location}: missing <th>`);
  if (semanticRoleIsOverridden) {
    invalidTables.push(`${location}: native table semantics overridden`);
  }
}

type DialogAudit = {
  sheetConsumerFiles: string[];
  sheetContentCount: number;
  unnamedSheetContents: string[];
};

function auditDialogBoundary(sourceFiles: readonly string[]): DialogAudit {
  const sheetSource = source("src/components/ui/sheet.tsx");
  assert.match(sheetSource, /from ["']@base-ui\/react\/dialog["']/);
  for (const primitive of [
    "Root",
    "Trigger",
    "Close",
    "Portal",
    "Backdrop",
    "Popup",
    "Title",
    "Description",
  ]) {
    assert.match(
      sheetSource,
      new RegExp(`<SheetPrimitive\\.${primitive}\\b`),
      `Sheet boundary must retain ${primitive}`,
    );
  }

  const sheetConsumerFiles = sourceFiles.filter((sourceFile) =>
    source(sourceFile).includes("@/components/ui/sheet"),
  );
  let sheetContentCount = 0;
  const unnamedSheetContents: string[] = [];

  for (const sourceFile of sheetConsumerFiles) {
    const parsed = parseSource(sourceFile);
    visit(parsed.sourceFile, (node) => {
      if (!ts.isJsxElement(node)) return;
      if (jsxTagName(node.openingElement, parsed.sourceFile) !== "SheetContent") {
        return;
      }
      sheetContentCount += 1;
      if (containsDescendantTag(node, parsed.sourceFile, "SheetTitle")) return;
      unnamedSheetContents.push(sourceLocation(parsed, node));
    });
  }

  return {
    sheetConsumerFiles: sheetConsumerFiles.map(repoPath).toSorted(),
    sheetContentCount,
    unnamedSheetContents: unnamedSheetContents.toSorted(),
  };
}

function forwardsChildren(node: ts.JsxElement) {
  return node.children.some(
    (child) =>
      ts.isJsxExpression(child) &&
      child.expression !== undefined &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === "children",
  );
}

function containsDescendantTag(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  expectedTagName: string,
) {
  return descendantOpeningElements(node).some(
    (element) => jsxTagName(element, sourceFile) === expectedTagName,
  );
}

function descendantOpeningElements(node: ts.Node) {
  const elements: ts.JsxOpeningLikeElement[] = [];
  visit(node, (candidate) => {
    if (ts.isJsxOpeningElement(candidate) || ts.isJsxSelfClosingElement(candidate)) {
      elements.push(candidate);
    }
  });
  return elements;
}

function isPresentational(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const role = opening.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(sourceFile) === "role",
  );
  if (!role?.initializer || !ts.isStringLiteral(role.initializer)) return false;
  return ["none", "presentation"].includes(role.initializer.text);
}

function enclosingComponentName(node: ts.Node) {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    current = current.parent;
  }
  return null;
}

function jsxTagName(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  return opening.tagName.getText(sourceFile);
}

function sourceLocation(parsed: ParsedSource, node: ts.Node) {
  const { line } = parsed.sourceFile.getLineAndCharacterOfPosition(
    node.getStart(parsed.sourceFile),
  );
  return `${repoPath(parsed.path)}:${line + 1}`;
}

type ParsedSource = {
  path: string;
  sourceFile: ts.SourceFile;
};

function parseSource(sourcePath: string): ParsedSource {
  const absolutePath = resolveRepoPath(sourcePath);
  return {
    path: absolutePath,
    sourceFile: ts.createSourceFile(
      absolutePath,
      readFileSync(absolutePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
  };
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath);
    return [entryPath];
  });
}

function isProductionTsxFile(sourcePath: string) {
  return sourcePath.endsWith(".tsx") && !sourcePath.includes(".test.");
}

function visit(node: ts.Node, inspect: (candidate: ts.Node) => void) {
  inspect(node);
  ts.forEachChild(node, (child) => visit(child, inspect));
}

function source(sourcePath: string) {
  return readFileSync(resolveRepoPath(sourcePath), "utf8");
}

function resolveRepoPath(sourcePath: string) {
  return path.resolve(REPOSITORY_ROOT, sourcePath);
}

function repoPath(absolutePath: string) {
  return path.relative(REPOSITORY_ROOT, absolutePath).replaceAll("\\", "/");
}
