import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";
import {
  findCrawlVisibleLabelIssues,
  type ProductCrawlVisibleLabelRecord,
  type ProductCrawlVisibleLabelSource,
  PRODUCT_CRAWL_VISIBLE_LABEL_EVIDENCE_FILE,
  PRODUCT_CRAWL_VISIBLE_LABEL_MASTER_EVIDENCE,
  PRODUCT_CRAWL_VISIBLE_LABEL_REQUIREMENT_ID,
  PRODUCT_CRAWL_VISIBLE_LABEL_SCOPE,
  PRODUCT_CRAWL_VISIBLE_LABEL_TEST_FILE,
} from "./product-crawl-visible-label-evidence";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-CRAWL-VISIBLE-LABEL-EVIDENCE

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === PRODUCT_CRAWL_VISIBLE_LABEL_REQUIREMENT_ID,
);
assert.equal(
  requirement?.requirement,
  "Record the visible label for every discovered production link or action.",
);
const evidence =
  PRODUCT_CRAWL_VISIBLE_LABEL_MASTER_EVIDENCE[
    PRODUCT_CRAWL_VISIBLE_LABEL_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_CRAWL_VISIBLE_LABEL_EVIDENCE_FILE,
  PRODUCT_CRAWL_VISIBLE_LABEL_TEST_FILE,
]);
for (const evidencePath of evidence.evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}

const registry = buildProductAutomatedSourceGateRegistry();
const productionRoutes = new Set(
  SCREEN_CONTRACTS.filter(({ productionEnabled }) => productionEnabled).map(
    ({ route }) => route,
  ),
);
assert.equal(productionRoutes.size, 90);

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

function sourceNodeAt(record: {
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
}) {
  const sourceFile = parsedSource(record.sourceFile);
  const position = sourceFile.getPositionOfLineAndCharacter(
    record.sourceLine - 1,
    record.sourceColumn - 1,
  );
  return { sourceFile, node: nodeAtPosition(sourceFile, position) };
}

function closest<T extends ts.Node>(
  node: ts.Node,
  predicate: (candidate: ts.Node) => candidate is T,
) {
  let current: ts.Node | undefined = node;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function openingElementFor(node: ts.Node) {
  return closest(
    node,
    (candidate): candidate is ts.JsxOpeningLikeElement =>
      ts.isJsxOpeningElement(candidate) ||
      ts.isJsxSelfClosingElement(candidate),
  );
}

function normalize(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function expressionSource(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  kind: ProductCrawlVisibleLabelSource["kind"] = "dynamic-expression",
): ProductCrawlVisibleLabelSource[] {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isNumericLiteral(expression)
  ) {
    const value = normalize(expression.text);
    return value ? [{ kind: "static-text", value }] : [];
  }
  const value = normalize(expression.getText(sourceFile));
  return value ? [{ kind, value }] : [];
}

function visibleAttributeSources(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const sources: ProductCrawlVisibleLabelSource[] = [];
  for (const attribute of opening.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue;
    const name = attribute.name.getText(sourceFile);
    if (!["children", "label", "placeholder", "title"].includes(name)) {
      continue;
    }
    const initializer = attribute.initializer;
    if (!initializer) continue;
    if (ts.isStringLiteral(initializer)) {
      const value = normalize(initializer.text);
      if (value) sources.push({ kind: "visible-attribute", value });
      continue;
    }
    if (ts.isJsxExpression(initializer) && initializer.expression) {
      sources.push(
        ...expressionSource(
          initializer.expression,
          sourceFile,
          "visible-attribute",
        ),
      );
    }
  }
  return sources;
}

function hiddenFromSightedUsers(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const className = opening.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(sourceFile) === "className",
  );
  const initializer = className?.initializer;
  if (!initializer || !ts.isStringLiteral(initializer)) return false;
  return /(?:^|\s)(?:sr-only|visually-hidden)(?:\s|$)/u.test(initializer.text);
}

function visibleChildSources(
  child: ts.JsxChild,
  sourceFile: ts.SourceFile,
): ProductCrawlVisibleLabelSource[] {
  if (ts.isJsxText(child)) {
    const value = normalize(child.text);
    return value ? [{ kind: "static-text", value }] : [];
  }
  if (ts.isJsxExpression(child)) {
    return child.expression
      ? expressionSource(child.expression, sourceFile)
      : [];
  }
  if (ts.isJsxElement(child)) {
    if (hiddenFromSightedUsers(child.openingElement, sourceFile)) return [];
    return [
      ...visibleAttributeSources(child.openingElement, sourceFile),
      ...child.children.flatMap((nested) =>
        visibleChildSources(nested, sourceFile),
      ),
    ];
  }
  if (ts.isJsxSelfClosingElement(child)) {
    if (hiddenFromSightedUsers(child, sourceFile)) return [];
    return visibleAttributeSources(child, sourceFile);
  }
  if (ts.isJsxFragment(child)) {
    return child.children.flatMap((nested) =>
      visibleChildSources(nested, sourceFile),
    );
  }
  return [];
}

function uniqueSources(sources: readonly ProductCrawlVisibleLabelSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.kind}:${source.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourcesForOpening(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const sources = [...visibleAttributeSources(opening, sourceFile)];
  if (
    ts.isJsxOpeningElement(opening) &&
    ts.isJsxElement(opening.parent)
  ) {
    sources.push(
      ...opening.parent.children.flatMap((child) =>
        visibleChildSources(child, sourceFile),
      ),
    );
  }
  return uniqueSources(sources);
}

function propertyLabelSources(
  property: ts.PropertyAssignment,
  sourceFile: ts.SourceFile,
) {
  if (!ts.isObjectLiteralExpression(property.parent)) return [];
  return uniqueSources(
    property.parent.properties.flatMap((sibling) => {
      if (!ts.isPropertyAssignment(sibling)) return [];
      const name = sibling.name.getText(sourceFile).replace(/["']/gu, "");
      if (!["label", "text", "title"].includes(name)) return [];
      return expressionSource(sibling.initializer, sourceFile, "label-property").map(
        (source) => ({ ...source, kind: "label-property" as const }),
      );
    }),
  );
}

function linkLabelMetadata(
  record: (typeof registry.internalLinks)[number],
) {
  const { sourceFile, node } = sourceNodeAt(record);

  if (record.kind === "href-property") {
    const property = closest(node, ts.isPropertyAssignment);
    assert.ok(property, `href property node missing: ${record.id}`);
    const visibleLabelSources = propertyLabelSources(property, sourceFile);
    return {
      visibleLabelSources,
      absenceReason:
        visibleLabelSources.length > 0
          ? null
          : "navigation object has no source-visible label property",
    };
  }

  const opening = openingElementFor(node);
  if (opening) {
    const visibleLabelSources = sourcesForOpening(opening, sourceFile);
    return {
      visibleLabelSources,
      absenceReason:
        visibleLabelSources.length > 0
          ? null
          : "navigation control has no source-visible label",
    };
  }

  assert.equal(record.kind, "navigation-call", record.id);
  return {
    visibleLabelSources: [],
    absenceReason: "programmatic navigation has no source-visible control",
  };
}

function actionLabelMetadata(
  record: (typeof registry.interactiveControls)[number],
) {
  const { sourceFile, node } = sourceNodeAt(record);
  const opening = openingElementFor(node);
  assert.ok(opening, `interactive opening node missing: ${record.id}`);
  const visibleLabelSources = sourcesForOpening(opening, sourceFile);
  return {
    visibleLabelSources,
    absenceReason:
      visibleLabelSources.length > 0
        ? null
        : "interactive control has no source-visible label",
  };
}

function observation(
  kind: ProductCrawlVisibleLabelRecord["kind"],
  sourceRoute: string,
  record: {
    id: string;
    sourceFile: string;
    sourceLine: number;
    sourceColumn: number;
  },
  metadata: Pick<
    ProductCrawlVisibleLabelRecord,
    "absenceReason" | "visibleLabelSources"
  >,
): ProductCrawlVisibleLabelRecord {
  return {
    id: `${kind}:${sourceRoute}:${record.id}`,
    kind,
    sourceRoute,
    sourceFile: record.sourceFile,
    sourceLine: record.sourceLine,
    sourceColumn: record.sourceColumn,
    ...metadata,
  };
}

const linkRows = registry.internalLinks.flatMap((record) => {
  const metadata = linkLabelMetadata(record);
  return record.ownerRoutes
    .filter((route) => productionRoutes.has(route))
    .map((route) => observation("link", route, record, metadata));
});
const actionRows = registry.interactiveControls.flatMap((record) => {
  const metadata = actionLabelMetadata(record);
  return record.ownerRoutes
    .filter((route) => productionRoutes.has(route))
    .map((route) => observation("action", route, record, metadata));
});
const rows = [...linkRows, ...actionRows];

assert.equal(linkRows.length, 2_345);
assert.equal(actionRows.length, 3_122);
assert.equal(rows.length, 5_467);
assert.equal(new Set(rows.map(({ id }) => id)).size, rows.length);
assert.deepEqual(findCrawlVisibleLabelIssues(rows), []);

const rowsWithSources = rows.filter(
  ({ visibleLabelSources }) => visibleLabelSources.length > 0,
);
const rowsWithRecordedAbsence = rows.filter(
  ({ visibleLabelSources }) => visibleLabelSources.length === 0,
);
assert.equal(rowsWithSources.length + rowsWithRecordedAbsence.length, 5_467);
assert.ok(rowsWithSources.length > 0);
assert.ok(rowsWithRecordedAbsence.length > 0);
assert.equal(
  rowsWithRecordedAbsence.every(({ absenceReason }) => Boolean(absenceReason)),
  true,
);

const routesWithRows = new Set(rows.map(({ sourceRoute }) => sourceRoute));
assert.equal(routesWithRows.size, 89);
assert.deepEqual(
  [...productionRoutes].filter((route) => !routesWithRows.has(route)),
  ["/statistics"],
);

const validRecord = {
  id: "action:/fixture:src/app/fixture/page.tsx:10:3:button",
  kind: "action",
  sourceRoute: "/fixture",
  sourceFile: "src/app/fixture/page.tsx",
  sourceLine: 10,
  sourceColumn: 3,
  visibleLabelSources: [{ kind: "static-text", value: "Save" }],
  absenceReason: null,
} as const satisfies ProductCrawlVisibleLabelRecord;
assert.deepEqual(findCrawlVisibleLabelIssues([validRecord]), []);

const negativeFixtures = [
  {
    name: "duplicate observation",
    records: [validRecord, validRecord],
    expectedCode: "DUPLICATE_OBSERVATION",
  },
  {
    name: "invalid discovery kind",
    records: [
      { ...validRecord, kind: "field" } as unknown as ProductCrawlVisibleLabelRecord,
    ],
    expectedCode: "INVALID_KIND",
  },
  {
    name: "invalid source route",
    records: [{ ...validRecord, sourceRoute: "fixture" }],
    expectedCode: "SOURCE_ROUTE_INVALID",
  },
  {
    name: "invalid source position",
    records: [{ ...validRecord, sourceLine: 0 }],
    expectedCode: "SOURCE_POSITION_INVALID",
  },
  {
    name: "unexplained absent label",
    records: [
      { ...validRecord, visibleLabelSources: [], absenceReason: null },
    ],
    expectedCode: "ABSENCE_REASON_MISSING",
  },
  {
    name: "absence conflicts with source",
    records: [{ ...validRecord, absenceReason: "not visible" }],
    expectedCode: "ABSENCE_REASON_CONFLICT",
  },
  {
    name: "blank label source",
    records: [
      {
        ...validRecord,
        visibleLabelSources: [{ kind: "static-text", value: " " }],
      },
    ],
    expectedCode: "LABEL_SOURCE_BLANK",
  },
  {
    name: "duplicate label source",
    records: [
      {
        ...validRecord,
        visibleLabelSources: [
          { kind: "static-text", value: "Save" },
          { kind: "static-text", value: "Save" },
        ],
      },
    ],
    expectedCode: "DUPLICATE_LABEL_SOURCE",
  },
  {
    name: "invalid label source kind",
    records: [
      {
        ...validRecord,
        visibleLabelSources: [{ kind: "aria-label", value: "Save" }],
      } as unknown as ProductCrawlVisibleLabelRecord,
    ],
    expectedCode: "INVALID_LABEL_SOURCE_KIND",
  },
] as const;

for (const fixture of negativeFixtures) {
  assert.equal(
    findCrawlVisibleLabelIssues(fixture.records).some(
      ({ code }) => code === fixture.expectedCode,
    ),
    true,
    fixture.name,
  );
}

assert.match(PRODUCT_CRAWL_VISIBLE_LABEL_SCOPE, /5,467 production-owned/iu);
assert.match(
  PRODUCT_CRAWL_VISIBLE_LABEL_SCOPE,
  /explicit source-visible absence reason/iu,
);
assert.match(PRODUCT_CRAWL_VISIBLE_LABEL_SCOPE, /Accessible-only names/iu);
assert.match(PRODUCT_CRAWL_VISIBLE_LABEL_SCOPE, /does not prove rendered text/iu);
const evidenceSource = readFileSync(
  PRODUCT_CRAWL_VISIBLE_LABEL_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/u);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/u);

const sourceKindCounts = rows
  .flatMap(({ visibleLabelSources }) => visibleLabelSources)
  .reduce<Record<string, number>>((counts, source) => {
    counts[source.kind] = (counts[source.kind] ?? 0) + 1;
    return counts;
  }, {});
const absenceReasonCounts = rowsWithRecordedAbsence.reduce<
  Record<string, number>
>((counts, row) => {
  const reason = row.absenceReason ?? "missing";
  counts[reason] = (counts[reason] ?? 0) + 1;
  return counts;
}, {});

assert.equal(rowsWithSources.length, 3_174);
assert.equal(rowsWithRecordedAbsence.length, 2_293);
assert.deepEqual(sourceKindCounts, {
  "static-text": 3_317,
  "label-property": 704,
  "dynamic-expression": 752,
  "visible-attribute": 1_763,
});
assert.deepEqual(absenceReasonCounts, {
  "programmatic navigation has no source-visible control": 1_325,
  "navigation control has no source-visible label": 21,
  "navigation object has no source-visible label property": 2,
  "interactive control has no source-visible label": 945,
});

console.log(
  `Product crawl visible-label evidence passed: ${rowsWithSources.length}/5,467 rows record source-visible label provenance and ${rowsWithRecordedAbsence.length}/5,467 record explicit absence; source kinds ${JSON.stringify(sourceKindCounts)}; absence reasons ${JSON.stringify(absenceReasonCounts)}.`,
);
