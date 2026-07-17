import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import {
  PRODUCT_ACCESSIBILITY_LIVE_REGION_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_LIVE_REGION_MASTER_EVIDENCE,
  PRODUCT_ACCESSIBILITY_LIVE_REGION_REQUIREMENT_IDS,
  PRODUCT_ACCESSIBILITY_LIVE_REGION_SCOPE,
  PRODUCT_ACCESSIBILITY_LIVE_REGION_TEST_FILE,
} from "./product-accessibility-live-region-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-ACCESSIBILITY-LIVE-REGION-EVIDENCE

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const SOURCE_DIRECTORIES = ["src/app", "src/components"] as const;
const VALID_LIVE_VALUES = new Set(["off", "polite", "assertive"]);

assert.deepEqual(PRODUCT_ACCESSIBILITY_LIVE_REGION_REQUIREMENT_IDS, [
  "GLOBAL.A11Y.live-regions",
]);
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.some(
    ({ id }) => id === "GLOBAL.A11Y.live-regions",
  ),
  true,
);

const evidence =
  PRODUCT_ACCESSIBILITY_LIVE_REGION_MASTER_EVIDENCE["GLOBAL.A11Y.live-regions"];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence, [
  PRODUCT_ACCESSIBILITY_LIVE_REGION_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_LIVE_REGION_TEST_FILE,
]);
evidence.evidence.forEach((evidencePath) =>
  assert.equal(existsSync(resolveRepoPath(evidencePath)), true, evidencePath),
);

const evidenceSource = source(PRODUCT_ACCESSIBILITY_LIVE_REGION_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_ACCESSIBILITY_LIVE_REGION_SCOPE, /every non-test TSX file/i);
assert.match(PRODUCT_ACCESSIBILITY_LIVE_REGION_SCOPE, /current source announcement contract/i);
assert.match(PRODUCT_ACCESSIBILITY_LIVE_REGION_SCOPE, /does not prove hydration timing/i);

const sourceFiles = SOURCE_DIRECTORIES.flatMap((directory) =>
  walkFiles(resolveRepoPath(directory)),
)
  .filter(isProductionTsxFile)
  .toSorted((left, right) => left.localeCompare(right));
assert.ok(sourceFiles.length >= 200, "The reachable TSX audit surface shrank");

let liveRegionCount = 0;
let announcedErrorCount = 0;
const invalidLiveRegions: string[] = [];
const unannouncedErrors: string[] = [];

for (const sourceFile of sourceFiles) {
  const parsed = parseSource(sourceFile);
  visit(parsed.sourceFile, (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attributes = attributeValues(node, parsed.sourceFile);
      const live = attributes.get("aria-live");
      if (live !== undefined) {
        liveRegionCount += 1;
        if (!VALID_LIVE_VALUES.has(live)) {
          invalidLiveRegions.push(`${sourceLocation(parsed, node)}: ${live}`);
        }
      }
    }

    if (!ts.isJsxExpression(node) || !node.expression) return;
    const expression = node.expression;
    if (
      !ts.isBinaryExpression(expression) ||
      expression.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken ||
      !ts.isIdentifier(expression.left) ||
      !/error$/i.test(expression.left.text) ||
      !containsIdentifier(expression.right, expression.left.text)
    ) {
      return;
    }

    const opening = openingElement(expression.right);
    if (!opening || !hasAnnouncingAncestor(opening, parsed.sourceFile)) {
      unannouncedErrors.push(sourceLocation(parsed, node));
      return;
    }
    announcedErrorCount += 1;
  });
}

assert.ok(liveRegionCount >= 50, "Expected the live-region source surface");
assert.ok(announcedErrorCount >= 10, "Expected rendered error announcements");
assert.deepEqual(invalidLiveRegions, []);
assert.deepEqual(unannouncedErrors, []);

console.log(
  `Accessibility live-region evidence passed: ${liveRegionCount} explicit live regions and ${announcedErrorCount} rendered error expressions retain source announcement semantics.`,
);

function attributeValues(
  node: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const values = new Map<string, string>();
  for (const property of node.attributes.properties) {
    if (!ts.isJsxAttribute(property)) continue;
    if (property.initializer && ts.isStringLiteral(property.initializer)) {
      values.set(property.name.getText(sourceFile), property.initializer.text);
    }
  }
  return values;
}

function openingElement(expression: ts.Expression) {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
    return ts.isJsxElement(current) ? current.openingElement : current;
  }
  return null;
}

function containsIdentifier(node: ts.Node, expected: string) {
  let found = false;
  visit(node, (candidate) => {
    if (ts.isIdentifier(candidate) && candidate.text === expected) found = true;
  });
  return found;
}

function hasAnnouncingAncestor(
  node: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) {
      const attributes = attributeValues(current, sourceFile);
      const role = attributes.get("role");
      const live = attributes.get("aria-live");
      if (role === "alert" || role === "status") return true;
      if (live === "polite" || live === "assertive") return true;
    }
    current = current.parent;
  }
  return false;
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

function sourceLocation(parsed: ParsedSource, node: ts.Node) {
  const { line } = parsed.sourceFile.getLineAndCharacterOfPosition(
    node.getStart(parsed.sourceFile),
  );
  return `${repoPath(parsed.path)}:${line + 1}`;
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
