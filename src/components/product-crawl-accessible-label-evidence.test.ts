import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";
import {
  findCrawlAccessibleLabelIssues,
  type ProductCrawlAccessibleLabelRecord,
  type ProductCrawlAccessibleLabelSource,
  PRODUCT_CRAWL_ACCESSIBLE_LABEL_EVIDENCE_FILE,
  PRODUCT_CRAWL_ACCESSIBLE_LABEL_MASTER_EVIDENCE,
  PRODUCT_CRAWL_ACCESSIBLE_LABEL_REQUIREMENT_ID,
  PRODUCT_CRAWL_ACCESSIBLE_LABEL_SCOPE,
  PRODUCT_CRAWL_ACCESSIBLE_LABEL_TEST_FILE,
} from "./product-crawl-accessible-label-evidence";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-CRAWL-ACCESSIBLE-LABEL-EVIDENCE

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === PRODUCT_CRAWL_ACCESSIBLE_LABEL_REQUIREMENT_ID,
);
assert.equal(
  requirement?.requirement,
  "Record the accessible label for every discovered production link or action.",
);
const evidence =
  PRODUCT_CRAWL_ACCESSIBLE_LABEL_MASTER_EVIDENCE[
    PRODUCT_CRAWL_ACCESSIBLE_LABEL_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_CRAWL_ACCESSIBLE_LABEL_EVIDENCE_FILE,
  PRODUCT_CRAWL_ACCESSIBLE_LABEL_TEST_FILE,
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

function attributeValue(
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
) {
  const initializer = attribute.initializer;
  if (!initializer) return attribute.name.getText(sourceFile);
  if (ts.isStringLiteral(initializer)) return normalize(initializer.text);
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    return normalize(initializer.expression.getText(sourceFile));
  }
  return "";
}

function attributesByName(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const attributes = new Map<string, ts.JsxAttribute>();
  for (const property of opening.attributes.properties) {
    if (ts.isJsxAttribute(property)) {
      attributes.set(property.name.getText(sourceFile), property);
    }
  }
  return attributes;
}

function explicitAttributeSources(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const sources: ProductCrawlAccessibleLabelSource[] = [];
  const attributes = attributesByName(opening, sourceFile);
  for (const [name, kind] of [
    ["aria-label", "aria-label"],
    ["aria-labelledby", "aria-labelledby"],
    ["alt", "html-naming-attribute"],
    ["title", "html-naming-attribute"],
  ] as const) {
    const attribute = attributes.get(name);
    if (!attribute) continue;
    const value = attributeValue(attribute, sourceFile);
    if (value) sources.push({ kind, value });
  }

  const tagName = opening.tagName.getText(sourceFile);
  const label = attributes.get("label");
  if (label && /^[A-Z]/u.test(tagName)) {
    const value = attributeValue(label, sourceFile);
    if (value) sources.push({ kind: "label-property", value });
  }
  const value = attributes.get("value");
  const type = attributes.get("type");
  if (
    tagName === "input" &&
    value &&
    type &&
    /^(?:button|reset|submit)$/u.test(attributeValue(type, sourceFile))
  ) {
    const sourceValue = attributeValue(value, sourceFile);
    if (sourceValue) {
      sources.push({ kind: "html-naming-attribute", value: sourceValue });
    }
  }
  return sources;
}

function hiddenFromAccessibilityTree(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const attribute = attributesByName(opening, sourceFile).get("aria-hidden");
  if (!attribute) return false;
  return attributeValue(attribute, sourceFile) === "true";
}

function contentSources(
  child: ts.JsxChild,
  sourceFile: ts.SourceFile,
): ProductCrawlAccessibleLabelSource[] {
  if (ts.isJsxText(child)) {
    const value = normalize(child.text);
    return value ? [{ kind: "content", value }] : [];
  }
  if (ts.isJsxExpression(child)) {
    const value = child.expression
      ? normalize(child.expression.getText(sourceFile))
      : "";
    return value ? [{ kind: "content", value }] : [];
  }
  if (ts.isJsxElement(child)) {
    if (hiddenFromAccessibilityTree(child.openingElement, sourceFile)) return [];
    return [
      ...explicitAttributeSources(child.openingElement, sourceFile),
      ...child.children.flatMap((nested) => contentSources(nested, sourceFile)),
    ];
  }
  if (ts.isJsxSelfClosingElement(child)) {
    if (hiddenFromAccessibilityTree(child, sourceFile)) return [];
    return explicitAttributeSources(child, sourceFile);
  }
  if (ts.isJsxFragment(child)) {
    return child.children.flatMap((nested) =>
      contentSources(nested, sourceFile),
    );
  }
  return [];
}

function uniqueSources(
  sources: readonly ProductCrawlAccessibleLabelSource[],
) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.kind}:${source.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function descendantSources(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  if (!ts.isJsxOpeningElement(opening) || !ts.isJsxElement(opening.parent)) {
    return [];
  }
  return opening.parent.children.flatMap((child) =>
    contentSources(child, sourceFile),
  );
}

function associatedLabelSources(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const sources: ProductCrawlAccessibleLabelSource[] = [];
  let parent: ts.Node | undefined = opening.parent;
  if (ts.isJsxElement(parent) && parent.openingElement === opening) {
    parent = parent.parent;
  }
  while (parent) {
    if (
      ts.isJsxElement(parent) &&
      parent.openingElement.tagName.getText(sourceFile) === "label"
    ) {
      sources.push(
        ...descendantSources(parent.openingElement, sourceFile).map((source) => ({
          kind: "associated-label" as const,
          value: source.value,
        })),
      );
      break;
    }
    parent = parent.parent;
  }

  const id = attributesByName(opening, sourceFile).get("id");
  if (!id) return uniqueSources(sources);
  const idValue = attributeValue(id, sourceFile);
  if (!idValue) return uniqueSources(sources);

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node)) {
      const labelOpening = node.openingElement;
      if (labelOpening.tagName.getText(sourceFile) === "label") {
        const htmlFor = attributesByName(labelOpening, sourceFile).get("htmlFor");
        if (htmlFor && attributeValue(htmlFor, sourceFile) === idValue) {
          sources.push(
            ...descendantSources(labelOpening, sourceFile).map((source) => ({
              kind: "associated-label" as const,
              value: source.value,
            })),
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return uniqueSources(sources);
}

function sourcesForOpening(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  return uniqueSources([
    ...explicitAttributeSources(opening, sourceFile),
    ...associatedLabelSources(opening, sourceFile),
    ...descendantSources(opening, sourceFile),
  ]);
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
      if (!["ariaLabel", "label", "text", "title"].includes(name)) return [];
      const value = normalize(sibling.initializer.getText(sourceFile));
      return value ? [{ kind: "label-property" as const, value }] : [];
    }),
  );
}

function linkLabelMetadata(record: (typeof registry.internalLinks)[number]) {
  const { sourceFile, node } = sourceNodeAt(record);

  if (record.kind === "href-property") {
    const property = closest(node, ts.isPropertyAssignment);
    assert.ok(property, `href property node missing: ${record.id}`);
    const accessibleLabelSources = propertyLabelSources(property, sourceFile);
    return {
      accessibleLabelSources,
      absenceReason:
        accessibleLabelSources.length > 0
          ? null
          : "navigation object has no source-level accessible label candidate",
    };
  }

  const opening = openingElementFor(node);
  if (opening) {
    const accessibleLabelSources = sourcesForOpening(opening, sourceFile);
    return {
      accessibleLabelSources,
      absenceReason:
        accessibleLabelSources.length > 0
          ? null
          : "navigation control has no source-level accessible label candidate",
    };
  }

  assert.equal(record.kind, "navigation-call", record.id);
  return {
    accessibleLabelSources: [],
    absenceReason: "programmatic navigation has no user-facing control to label",
  };
}

function actionLabelMetadata(
  record: (typeof registry.interactiveControls)[number],
) {
  const { sourceFile, node } = sourceNodeAt(record);
  const opening = openingElementFor(node);
  assert.ok(opening, `interactive opening node missing: ${record.id}`);
  const accessibleLabelSources = sourcesForOpening(opening, sourceFile);
  return {
    accessibleLabelSources,
    absenceReason:
      accessibleLabelSources.length > 0
        ? null
        : "interactive control has no source-level accessible label candidate",
  };
}

function observation(
  kind: ProductCrawlAccessibleLabelRecord["kind"],
  sourceRoute: string,
  record: {
    id: string;
    sourceFile: string;
    sourceLine: number;
    sourceColumn: number;
  },
  metadata: Pick<
    ProductCrawlAccessibleLabelRecord,
    "absenceReason" | "accessibleLabelSources"
  >,
): ProductCrawlAccessibleLabelRecord {
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
assert.deepEqual(findCrawlAccessibleLabelIssues(rows), []);

const rowsWithSources = rows.filter(
  ({ accessibleLabelSources }) => accessibleLabelSources.length > 0,
);
const rowsWithRecordedAbsence = rows.filter(
  ({ accessibleLabelSources }) => accessibleLabelSources.length === 0,
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
  accessibleLabelSources: [{ kind: "aria-label", value: "Save" }],
  absenceReason: null,
} as const satisfies ProductCrawlAccessibleLabelRecord;
assert.deepEqual(findCrawlAccessibleLabelIssues([validRecord]), []);

const negativeFixtures = [
  {
    name: "duplicate observation",
    records: [validRecord, validRecord],
    expectedCode: "DUPLICATE_OBSERVATION",
  },
  {
    name: "invalid discovery kind",
    records: [
      {
        ...validRecord,
        kind: "field",
      } as unknown as ProductCrawlAccessibleLabelRecord,
    ],
    expectedCode: "INVALID_KIND",
  },
  {
    name: "invalid source route",
    records: [{ ...validRecord, sourceRoute: "fixture" }],
    expectedCode: "SOURCE_ROUTE_INVALID",
  },
  {
    name: "invalid source file",
    records: [{ ...validRecord, sourceFile: "fixture/page.tsx" }],
    expectedCode: "SOURCE_FILE_INVALID",
  },
  {
    name: "invalid source position",
    records: [{ ...validRecord, sourceColumn: 0 }],
    expectedCode: "SOURCE_POSITION_INVALID",
  },
  {
    name: "unexplained absent label",
    records: [
      { ...validRecord, accessibleLabelSources: [], absenceReason: null },
    ],
    expectedCode: "ABSENCE_REASON_MISSING",
  },
  {
    name: "absence conflicts with source",
    records: [{ ...validRecord, absenceReason: "not named" }],
    expectedCode: "ABSENCE_REASON_CONFLICT",
  },
  {
    name: "blank label source",
    records: [
      {
        ...validRecord,
        accessibleLabelSources: [{ kind: "aria-label", value: " " }],
      },
    ],
    expectedCode: "LABEL_SOURCE_BLANK",
  },
  {
    name: "duplicate label source",
    records: [
      {
        ...validRecord,
        accessibleLabelSources: [
          { kind: "aria-label", value: "Save" },
          { kind: "aria-label", value: "Save" },
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
        accessibleLabelSources: [{ kind: "placeholder", value: "Save" }],
      } as unknown as ProductCrawlAccessibleLabelRecord,
    ],
    expectedCode: "INVALID_LABEL_SOURCE_KIND",
  },
] as const;

for (const fixture of negativeFixtures) {
  assert.equal(
    findCrawlAccessibleLabelIssues(fixture.records).some(
      ({ code }) => code === fixture.expectedCode,
    ),
    true,
    fixture.name,
  );
}

assert.match(PRODUCT_CRAWL_ACCESSIBLE_LABEL_SCOPE, /all 5,467 production-owned/iu);
assert.match(PRODUCT_CRAWL_ACCESSIBLE_LABEL_SCOPE, /explicit absence reason/iu);
assert.match(PRODUCT_CRAWL_ACCESSIBLE_LABEL_SCOPE, /static source crawl/iu);
assert.match(
  PRODUCT_CRAWL_ACCESSIBLE_LABEL_SCOPE,
  /does not prove the browser-computed accessible name/iu,
);
const evidenceSource = readFileSync(
  PRODUCT_CRAWL_ACCESSIBLE_LABEL_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/u);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/u);

const sourceKindCounts = rows
  .flatMap(({ accessibleLabelSources }) => accessibleLabelSources)
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

assert.equal(rowsWithSources.length, 3_570);
assert.equal(rowsWithRecordedAbsence.length, 1_897);
assert.deepEqual(sourceKindCounts, {
  content: 4_111,
  "label-property": 1_144,
  "aria-label": 2_145,
  "html-naming-attribute": 29,
  "associated-label": 484,
  "aria-labelledby": 21,
});
assert.deepEqual(absenceReasonCounts, {
  "programmatic navigation has no user-facing control to label": 1_325,
  "navigation object has no source-level accessible label candidate": 2,
  "navigation control has no source-level accessible label candidate": 1,
  "interactive control has no source-level accessible label candidate": 569,
});

console.log(
  `Product crawl accessible-label evidence passed: ${rowsWithSources.length}/5,467 rows record source-level accessible-label provenance and ${rowsWithRecordedAbsence.length}/5,467 record explicit absence; source kinds ${JSON.stringify(sourceKindCounts)}; absence reasons ${JSON.stringify(absenceReasonCounts)}.`,
);
