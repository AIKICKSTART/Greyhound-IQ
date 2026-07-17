import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  findNonNavigationLinkIssues,
  type ProductNonNavigationLinkCategory,
  type ProductNonNavigationLinkRecord,
  PRODUCT_NON_NAVIGATION_LINK_CATEGORIES,
  PRODUCT_NON_NAVIGATION_LINK_EVIDENCE_FILE,
  PRODUCT_NON_NAVIGATION_LINK_EXPECTED_GAIN,
  PRODUCT_NON_NAVIGATION_LINK_MASTER_EVIDENCE,
  PRODUCT_NON_NAVIGATION_LINK_REQUIREMENT_IDS,
  PRODUCT_NON_NAVIGATION_LINK_SCOPE,
  PRODUCT_NON_NAVIGATION_LINK_TEST_FILE,
} from "./product-non-navigation-link-inclusion-evidence";
import { PRODUCT_SOURCE_INTERACTION_INVENTORY_SNAPSHOTS } from "./product-source-interaction-evidence";

// screen-evidence-test-id: PRODUCT-NON-NAVIGATION-LINK-INCLUSION-EVIDENCE

const EXPECTED_IDS = ["DISC.CRAWL.non-nav-links"] as const;

assert.deepEqual(PRODUCT_NON_NAVIGATION_LINK_REQUIREMENT_IDS, EXPECTED_IDS);
assert.equal(PRODUCT_NON_NAVIGATION_LINK_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_NON_NAVIGATION_LINK_MASTER_EVIDENCE),
  EXPECTED_IDS,
);

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === EXPECTED_IDS[0],
);
assert.equal(
  requirement?.requirement,
  "Include footer, legal, login-return, dynamic-record, email, and notification links rather than relying on sitemap or top navigation.",
);

const masterEvidence = PRODUCT_NON_NAVIGATION_LINK_MASTER_EVIDENCE[EXPECTED_IDS[0]];
assert.equal(masterEvidence.status, "tested");
assert.deepEqual(masterEvidence.evidence.slice(0, 2), [
  PRODUCT_NON_NAVIGATION_LINK_EVIDENCE_FILE,
  PRODUCT_NON_NAVIGATION_LINK_TEST_FILE,
]);
assert.equal(
  new Set(masterEvidence.evidence).size,
  masterEvidence.evidence.length,
);
for (const evidencePath of masterEvidence.evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}

assert.equal(
  PRODUCT_SOURCE_INTERACTION_INVENTORY_SNAPSHOTS[
    "DISC.SRC.footer-navigation"
  ].count,
  2,
);
assert.equal(
  PRODUCT_SOURCE_INTERACTION_INVENTORY_SNAPSHOTS["DISC.SRC.email-links"].count,
  1,
);
assert.equal(
  PRODUCT_SOURCE_INTERACTION_INVENTORY_SNAPSHOTS[
    "DISC.SRC.notification-links"
  ].count,
  6,
);

const parsedSourceFiles = new Map<string, ts.SourceFile>();
function parsedSource(sourcePath: string) {
  const cached = parsedSourceFiles.get(sourcePath);
  if (cached) return cached;
  assert.equal(existsSync(sourcePath), true, sourcePath);
  const parsed = ts.createSourceFile(
    sourcePath,
    readFileSync(sourcePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  parsedSourceFiles.set(sourcePath, parsed);
  return parsed;
}

function visitSource(sourceFile: ts.SourceFile, inspect: (node: ts.Node) => void) {
  function visit(node: ts.Node) {
    inspect(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function sourceComponent(node: ts.Node, sourceFile: ts.SourceFile) {
  let current: ts.Node | undefined = node;
  while (current) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isMethodDeclaration(current) ||
        ts.isClassDeclaration(current)) &&
      current.name
    ) {
      return current.name.getText(sourceFile);
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      return current.name.text;
    }
    current = current.parent;
  }
  return `module:${path.basename(sourceFile.fileName)}`;
}

function nodeAtPosition(sourceFile: ts.SourceFile, position: number) {
  let deepest: ts.Node = sourceFile;
  function visit(node: ts.Node) {
    if (node.getStart(sourceFile) > position || node.getEnd() < position) return;
    deepest = node;
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return deepest;
}

function recordFromNode(
  category: ProductNonNavigationLinkCategory,
  sourcePath: string,
  node: ts.Node,
  targetSignal: string,
): ProductNonNavigationLinkRecord {
  const sourceFile = parsedSource(sourcePath);
  const location = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  const sourceLine = location.line + 1;
  const sourceColumn = location.character + 1;
  return {
    id: `${category}:${sourcePath}:${sourceLine}:${sourceColumn}:${targetSignal}`,
    category,
    sourceFile: sourcePath,
    sourceLine,
    sourceColumn,
    sourceComponent: sourceComponent(node, sourceFile),
    targetSignal,
  };
}

function recordsFromRegistry(
  category: ProductNonNavigationLinkCategory,
  records: readonly {
    id: string;
    sourceFile: string;
    sourceLine: number;
    sourceColumn: number;
    rawTarget: string;
  }[],
) {
  return records.map((record) => {
    const sourceFile = parsedSource(record.sourceFile);
    const position = sourceFile.getPositionOfLineAndCharacter(
      record.sourceLine - 1,
      record.sourceColumn - 1,
    );
    return {
      id: `${category}:${record.id}`,
      category,
      sourceFile: record.sourceFile,
      sourceLine: record.sourceLine,
      sourceColumn: record.sourceColumn,
      sourceComponent: sourceComponent(
        nodeAtPosition(sourceFile, position),
        sourceFile,
      ),
      targetSignal: record.rawTarget,
    } satisfies ProductNonNavigationLinkRecord;
  });
}

const footerPath = "src/components/site-footer.tsx";
const footerSource = parsedSource(footerPath);
const footerRows: ProductNonNavigationLinkRecord[] = [];
visitSource(footerSource, (node) => {
  if (
    ts.isPropertyAssignment(node) &&
    node.name.getText(footerSource) === "href" &&
    ts.isStringLiteral(node.initializer)
  ) {
    footerRows.push(
      recordFromNode("footer", footerPath, node, node.initializer.text),
    );
  }
  if (
    ts.isJsxAttribute(node) &&
    node.name.getText(footerSource) === "href" &&
    node.initializer &&
    ts.isStringLiteral(node.initializer)
  ) {
    footerRows.push(
      recordFromNode("footer", footerPath, node, node.initializer.text),
    );
  }
});
assert.equal(footerRows.length, 18);

const legalTargets = new Set(["/privacy", "/responsible-use", "/terms"]);
const legalRows = footerRows
  .filter(({ targetSignal }) => legalTargets.has(targetSignal))
  .map((record) => ({
    ...record,
    id: record.id.replace(/^footer:/, "legal:"),
    category: "legal" as const,
  }));
assert.equal(legalRows.length, 6);
assert.deepEqual(
  new Set(legalRows.map(({ targetSignal }) => targetSignal)),
  legalTargets,
);

const registry = buildProductAutomatedSourceGateRegistry();
const loginReturnLinks = registry.internalLinks.filter(({ rawTarget }) =>
  rawTarget.startsWith("/sign-in?returnTo="),
);
const loginReturnRows = recordsFromRegistry(
  "login-return",
  loginReturnLinks,
);
assert.equal(loginReturnRows.length, 7);
assert.equal(
  loginReturnRows.every(({ targetSignal }) =>
    targetSignal.startsWith("/sign-in?returnTo="),
  ),
  true,
);

const dynamicRecordLinks = registry.internalLinks.filter((record) => {
  const pathname = record.rawTarget.split(/[?#]/, 1)[0] ?? "";
  return (
    pathname.includes("__GIQ_DYNAMIC_SEGMENT__") &&
    record.matchedRoutePattern?.includes("[")
  );
});
const dynamicRecordRows = recordsFromRegistry(
  "dynamic-record",
  dynamicRecordLinks,
);
assert.equal(dynamicRecordRows.length, 111);
assert.equal(
  new Set(dynamicRecordRows.map(({ sourceFile }) => sourceFile)).size,
  43,
);

function matchingHrefAttributes(
  sourcePath: string,
  matches: (value: string) => boolean,
) {
  const sourceFile = parsedSource(sourcePath);
  const records: { node: ts.JsxAttribute; value: string }[] = [];
  visitSource(sourceFile, (node) => {
    if (
      !ts.isJsxAttribute(node) ||
      node.name.getText(sourceFile) !== "href" ||
      !node.initializer
    ) {
      return;
    }
    const value = node.initializer.getText(sourceFile);
    if (matches(value)) records.push({ node, value });
  });
  return records;
}

const emailPath = "src/app/p/[handle]/page.tsx";
assert.equal(registry.auditedSourceFiles.includes(emailPath), true);
const emailRows = matchingHrefAttributes(emailPath, (value) =>
  value.includes("mailto:"),
).map(({ node, value }) => recordFromNode("email", emailPath, node, value));
assert.equal(emailRows.length, 1);

const notificationPath = "src/app/account/notifications/page.tsx";
assert.equal(registry.auditedSourceFiles.includes(notificationPath), true);
const notificationRows = matchingHrefAttributes(
  notificationPath,
  (value) => value === "{record.href}",
).map(({ node, value }) =>
  recordFromNode("notification", notificationPath, node, value),
);
assert.equal(notificationRows.length, 1);

const inclusionRows = [
  ...footerRows,
  ...legalRows,
  ...loginReturnRows,
  ...dynamicRecordRows,
  ...emailRows,
  ...notificationRows,
];
assert.equal(inclusionRows.length, 144);
assert.deepEqual(findNonNavigationLinkIssues(inclusionRows), []);
assert.deepEqual(
  new Set(inclusionRows.map(({ category }) => category)),
  new Set(PRODUCT_NON_NAVIGATION_LINK_CATEGORIES),
);
assert.equal(
  inclusionRows.some(({ sourceFile }) => /sitemap/i.test(sourceFile)),
  false,
);
assert.ok(
  new Set(inclusionRows.map(({ sourceFile }) => sourceFile)).size > 40,
);

const validCategoryRows = PRODUCT_NON_NAVIGATION_LINK_CATEGORIES.map(
  (category, index) =>
    ({
      id: `${category}:fixture`,
      category,
      sourceFile: `src/app/fixture-${index}/page.tsx`,
      sourceLine: index + 1,
      sourceColumn: 1,
      sourceComponent: "FixturePage",
      targetSignal: `/${category}`,
    }) satisfies ProductNonNavigationLinkRecord,
);
assert.deepEqual(findNonNavigationLinkIssues(validCategoryRows), []);

const invalidCategoryRecord = {
  ...validCategoryRows[0],
  id: "top-nav:fixture",
  category: "top-nav",
} as unknown as ProductNonNavigationLinkRecord;
const negativeFixtures = [
  {
    name: "required category omitted",
    records: validCategoryRows.slice(0, -1),
    expectedCode: "REQUIRED_CATEGORY_MISSING",
  },
  {
    name: "duplicate observation",
    records: [...validCategoryRows, validCategoryRows[0]],
    expectedCode: "DUPLICATE_OBSERVATION",
  },
  {
    name: "invalid category",
    records: [...validCategoryRows, invalidCategoryRecord],
    expectedCode: "INVALID_CATEGORY",
  },
  {
    name: "source outside application",
    records: [
      ...validCategoryRows.slice(1),
      { ...validCategoryRows[0], sourceFile: "scripts/fixture.ts" },
    ],
    expectedCode: "SOURCE_FILE_INVALID",
  },
  {
    name: "invalid source position",
    records: [
      ...validCategoryRows.slice(1),
      { ...validCategoryRows[0], sourceLine: 0 },
    ],
    expectedCode: "SOURCE_POSITION_INVALID",
  },
  {
    name: "missing source component",
    records: [
      ...validCategoryRows.slice(1),
      { ...validCategoryRows[0], sourceComponent: "" },
    ],
    expectedCode: "SOURCE_COMPONENT_MISSING",
  },
  {
    name: "missing target signal",
    records: [
      ...validCategoryRows.slice(1),
      { ...validCategoryRows[0], targetSignal: "" },
    ],
    expectedCode: "TARGET_SIGNAL_MISSING",
  },
] as const;

for (const fixture of negativeFixtures) {
  assert.equal(
    findNonNavigationLinkIssues(fixture.records).some(
      ({ code }) => code === fixture.expectedCode,
    ),
    true,
    fixture.name,
  );
}

assert.match(PRODUCT_NON_NAVIGATION_LINK_SCOPE, /all six non-navigation categories/i);
assert.match(PRODUCT_NON_NAVIGATION_LINK_SCOPE, /144 category-tagged exact source rows/i);
assert.match(PRODUCT_NON_NAVIGATION_LINK_SCOPE, /rather than a sitemap or top-navigation-only list/i);
assert.match(PRODUCT_NON_NAVIGATION_LINK_SCOPE, /does not claim browser visibility/i);
assert.match(PRODUCT_NON_NAVIGATION_LINK_SCOPE, /authentication-provider behavior/i);
const evidenceSource = readFileSync(
  PRODUCT_NON_NAVIGATION_LINK_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Product non-navigation link inclusion evidence passed: all six required categories have 144 exact source rows; exact +1 gate.",
);
