import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";
import {
  findSourceCrawlProvenanceIssues,
  type ProductSourceCrawlProvenanceRecord,
  PRODUCT_SOURCE_CRAWL_PROVENANCE_EVIDENCE_FILE,
  PRODUCT_SOURCE_CRAWL_PROVENANCE_EXPECTED_GAIN,
  PRODUCT_SOURCE_CRAWL_PROVENANCE_MASTER_EVIDENCE,
  PRODUCT_SOURCE_CRAWL_PROVENANCE_REQUIREMENT_IDS,
  PRODUCT_SOURCE_CRAWL_PROVENANCE_SCOPE,
  PRODUCT_SOURCE_CRAWL_PROVENANCE_TEST_FILE,
} from "./product-source-crawl-provenance-evidence";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-SOURCE-CRAWL-PROVENANCE-EVIDENCE

const EXPECTED_IDS = [
  "DISC.CRAWL.source-route",
  "DISC.CRAWL.source-component",
] as const;

assert.deepEqual(PRODUCT_SOURCE_CRAWL_PROVENANCE_REQUIREMENT_IDS, EXPECTED_IDS);
assert.equal(PRODUCT_SOURCE_CRAWL_PROVENANCE_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_SOURCE_CRAWL_PROVENANCE_MASTER_EVIDENCE),
  EXPECTED_IDS,
);

const expectedRequirementText = new Map([
  [
    EXPECTED_IDS[0],
    "Record the source route for every discovered production link or action.",
  ],
  [
    EXPECTED_IDS[1],
    "Record the source component for every discovered production link or action.",
  ],
]);
for (const requirementId of EXPECTED_IDS) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    ({ id }) => id === requirementId,
  );
  assert.equal(
    requirement?.requirement,
    expectedRequirementText.get(requirementId),
    requirementId,
  );

  const record = PRODUCT_SOURCE_CRAWL_PROVENANCE_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_SOURCE_CRAWL_PROVENANCE_EVIDENCE_FILE,
    PRODUCT_SOURCE_CRAWL_PROVENANCE_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

const registry = buildProductAutomatedSourceGateRegistry();
const productionRoutes = new Set(
  SCREEN_CONTRACTS.filter(({ productionEnabled }) => productionEnabled).map(
    ({ route }) => route,
  ),
);
assert.equal(productionRoutes.size, 90);

const parsedSourceFiles = new Map<string, ts.SourceFile>();
function parsedSource(sourceFile: string) {
  const cached = parsedSourceFiles.get(sourceFile);
  if (cached) return cached;
  assert.equal(existsSync(sourceFile), true, sourceFile);
  const parsed = ts.createSourceFile(
    sourceFile,
    readFileSync(sourceFile, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    sourceFile.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  parsedSourceFiles.set(sourceFile, parsed);
  return parsed;
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

function sourceComponentAt(
  sourcePath: string,
  sourceLine: number,
  sourceColumn: number,
) {
  const sourceFile = parsedSource(sourcePath);
  const position = sourceFile.getPositionOfLineAndCharacter(
    sourceLine - 1,
    sourceColumn - 1,
  );
  let current: ts.Node | undefined = nodeAtPosition(sourceFile, position);

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

  return `module:${path.basename(sourcePath)}`;
}

function provenanceRecord(
  kind: ProductSourceCrawlProvenanceRecord["kind"],
  sourceRoute: string,
  record: {
    id: string;
    sourceFile: string;
    sourceLine: number;
    sourceColumn: number;
  },
): ProductSourceCrawlProvenanceRecord {
  return {
    id: `${kind}:${sourceRoute}:${record.id}`,
    kind,
    sourceRoute,
    sourceFile: record.sourceFile,
    sourceLine: record.sourceLine,
    sourceColumn: record.sourceColumn,
    sourceComponent: sourceComponentAt(
      record.sourceFile,
      record.sourceLine,
      record.sourceColumn,
    ),
  };
}

const linkRows = registry.internalLinks.flatMap((record) =>
  record.ownerRoutes
    .filter((route) => productionRoutes.has(route))
    .map((route) => provenanceRecord("link", route, record)),
);
const actionRows = registry.interactiveControls.flatMap((record) =>
  record.ownerRoutes
    .filter((route) => productionRoutes.has(route))
    .map((route) => provenanceRecord("action", route, record)),
);
const provenanceRows = [...linkRows, ...actionRows];

assert.equal(linkRows.length, 2_292);
assert.equal(actionRows.length, 3_116);
assert.equal(provenanceRows.length, 5_408);
assert.equal(new Set(provenanceRows.map(({ id }) => id)).size, 5_408);
assert.deepEqual(findSourceCrawlProvenanceIssues(provenanceRows), []);

const routesWithDiscoveries = new Set(
  provenanceRows.map(({ sourceRoute }) => sourceRoute),
);
assert.equal(routesWithDiscoveries.size, 89);
assert.deepEqual(
  [...productionRoutes].filter((route) => !routesWithDiscoveries.has(route)),
  ["/statistics"],
);
assert.ok(parsedSourceFiles.size > 0);
assert.equal(
  provenanceRows.every(({ sourceComponent }) => sourceComponent.trim().length > 0),
  true,
);

const validRecord = {
  id: "link:/fixture:src/app/fixture/page.tsx:10:3:jsx-href:/target",
  kind: "link",
  sourceRoute: "/fixture",
  sourceFile: "src/app/fixture/page.tsx",
  sourceLine: 10,
  sourceColumn: 3,
  sourceComponent: "FixturePage",
} as const satisfies ProductSourceCrawlProvenanceRecord;
assert.deepEqual(findSourceCrawlProvenanceIssues([validRecord]), []);

const negativeFixtures = [
  {
    name: "duplicate observation",
    records: [validRecord, validRecord],
    expectedCode: "DUPLICATE_OBSERVATION",
  },
  {
    name: "missing source route",
    records: [{ ...validRecord, sourceRoute: "" }],
    expectedCode: "SOURCE_ROUTE_INVALID",
  },
  {
    name: "source outside application",
    records: [{ ...validRecord, sourceFile: "scripts/fixture.ts" }],
    expectedCode: "SOURCE_FILE_INVALID",
  },
  {
    name: "invalid source position",
    records: [{ ...validRecord, sourceLine: 0 }],
    expectedCode: "SOURCE_POSITION_INVALID",
  },
  {
    name: "missing source component",
    records: [{ ...validRecord, sourceComponent: "" }],
    expectedCode: "SOURCE_COMPONENT_MISSING",
  },
  {
    name: "invalid discovery kind",
    records: [
      { ...validRecord, kind: "field" } as unknown as ProductSourceCrawlProvenanceRecord,
    ],
    expectedCode: "INVALID_KIND",
  },
] as const;

for (const fixture of negativeFixtures) {
  assert.equal(
    findSourceCrawlProvenanceIssues(fixture.records).some(
      ({ code }) => code === fixture.expectedCode,
    ),
    true,
    fixture.name,
  );
}

assert.match(PRODUCT_SOURCE_CRAWL_PROVENANCE_SCOPE, /5,408 production-owned discovery rows/i);
assert.match(PRODUCT_SOURCE_CRAWL_PROVENANCE_SCOPE, /89 production routes/i);
assert.match(PRODUCT_SOURCE_CRAWL_PROVENANCE_SCOPE, /\/statistics route contains no discovered/i);
assert.match(PRODUCT_SOURCE_CRAWL_PROVENANCE_SCOPE, /nearest enclosing named source symbol/i);
assert.match(PRODUCT_SOURCE_CRAWL_PROVENANCE_SCOPE, /does not claim visible or accessible labels/i);
assert.match(PRODUCT_SOURCE_CRAWL_PROVENANCE_SCOPE, /browser rendering, deployed crawling/i);
const evidenceSource = readFileSync(
  PRODUCT_SOURCE_CRAWL_PROVENANCE_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Product source-crawl provenance evidence passed: 5,408 production-owned link/action rows record source route and nearest source symbol; exact +2 gates.",
);
