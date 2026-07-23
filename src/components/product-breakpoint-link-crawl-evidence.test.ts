import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";
import {
  findBreakpointLinkCrawlIssues,
  type ProductBreakpointLinkCrawlRecord,
  type ProductBreakpointLinkVisibilitySource,
  PRODUCT_BREAKPOINT_LINK_CRAWL_EVIDENCE_FILE,
  PRODUCT_BREAKPOINT_LINK_CRAWL_MASTER_EVIDENCE,
  PRODUCT_BREAKPOINT_LINK_CRAWL_REQUIREMENT_ID,
  PRODUCT_BREAKPOINT_LINK_CRAWL_SCOPE,
  PRODUCT_BREAKPOINT_LINK_CRAWL_TEST_FILE,
} from "./product-breakpoint-link-crawl-evidence";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-BREAKPOINT-LINK-CRAWL-EVIDENCE

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === PRODUCT_BREAKPOINT_LINK_CRAWL_REQUIREMENT_ID,
);
assert.equal(
  requirement?.requirement,
  "Include links visible only at particular responsive breakpoints.",
);
const evidence =
  PRODUCT_BREAKPOINT_LINK_CRAWL_MASTER_EVIDENCE[
    PRODUCT_BREAKPOINT_LINK_CRAWL_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_BREAKPOINT_LINK_CRAWL_EVIDENCE_FILE,
  PRODUCT_BREAKPOINT_LINK_CRAWL_TEST_FILE,
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

function openingElementFor(record: {
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
}) {
  const sourceFile = parsedSource(record.sourceFile);
  const position = sourceFile.getPositionOfLineAndCharacter(
    record.sourceLine - 1,
    record.sourceColumn - 1,
  );
  const node = nodeAtPosition(sourceFile, position);
  const opening = closest(
    node,
    (candidate): candidate is ts.JsxOpeningLikeElement =>
      ts.isJsxOpeningElement(candidate) ||
      ts.isJsxSelfClosingElement(candidate),
  );
  assert.ok(opening, `JSX link opening missing: ${record.sourceFile}:${record.sourceLine}`);
  return { opening, sourceFile };
}

function normalize(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

const RESPONSIVE_TOKEN_PATTERN =
  /^(?:max-)?(?:sm|md|lg|xl|2xl):(?:[a-z-]+:)*(?:hidden|invisible|visible|block|inline|inline-block|flex|inline-flex|grid|contents|table|table-row|table-cell)$/u;
const RESPONSIVE_HIDE_PATTERN = /:(?:hidden|invisible)$/u;
const RESPONSIVE_REVEAL_PATTERN =
  /:(?:visible|block|inline|inline-block|flex|inline-flex|grid|contents|table|table-row|table-cell)$/u;

function classTokens(source: string) {
  const candidates = source.match(/[A-Za-z0-9-]+(?::[A-Za-z0-9-]+)+/gu) ?? [];
  const responsive = candidates.filter((token) =>
    RESPONSIVE_TOKEN_PATTERN.test(token),
  );
  const base = ["hidden", "invisible"].filter((token) =>
    new RegExp(`(?:^|[^A-Za-z0-9-])${token}(?:$|[^A-Za-z0-9-])`, "u").test(
      source,
    ),
  );
  const responsiveHide = responsive.filter((token) =>
    RESPONSIVE_HIDE_PATTERN.test(token),
  );
  const responsiveReveal = responsive.filter((token) =>
    RESPONSIVE_REVEAL_PATTERN.test(token),
  );
  if (responsiveHide.length > 0) {
    return [...new Set([...base, ...responsive])];
  }
  if (base.length > 0 && responsiveReveal.length > 0) {
    return [...new Set([...base, ...responsiveReveal])];
  }
  return [];
}

function classVisibilitySource(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
  origin: ProductBreakpointLinkVisibilitySource["origin"],
) {
  const className = opening.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) &&
      property.name.getText(sourceFile) === "className",
  );
  if (!className?.initializer) return null;
  const classSource = normalize(className.initializer.getText(sourceFile));
  const tokens = classTokens(classSource);
  if (tokens.length === 0) return null;
  const location = sourceFile.getLineAndCharacterOfPosition(
    className.getStart(sourceFile),
  );
  return {
    origin,
    sourceLine: location.line + 1,
    classSource,
    classTokens: tokens,
  } satisfies ProductBreakpointLinkVisibilitySource;
}

function responsiveVisibilitySourcesForOpening(
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const candidates: ts.JsxOpeningLikeElement[] = [opening];
  let current: ts.Node | undefined = opening.parent;
  while (current) {
    if (
      ts.isJsxElement(current) &&
      current.openingElement !== opening
    ) {
      candidates.push(current.openingElement);
    } else if (ts.isJsxSelfClosingElement(current) && current !== opening) {
      candidates.push(current);
    }
    current = current.parent;
  }

  const seen = new Set<number>();
  return candidates.flatMap((candidate) => {
    const position = candidate.getStart(sourceFile);
    if (seen.has(position)) return [];
    seen.add(position);
    const source = classVisibilitySource(
      candidate,
      sourceFile,
      candidate === opening ? "link" : "ancestor",
    );
    return source ? [source] : [];
  });
}

const breakpointLinkRecords = registry.internalLinks.flatMap((record) => {
  if (record.kind !== "jsx-href") return [];
  const ownerRoutes = record.ownerRoutes.filter((route) =>
    productionRoutes.has(route),
  );
  if (ownerRoutes.length === 0) return [];
  const { opening, sourceFile } = openingElementFor(record);
  const responsiveVisibilitySources = responsiveVisibilitySourcesForOpening(
    opening,
    sourceFile,
  );
  if (responsiveVisibilitySources.length === 0) return [];
  return ownerRoutes.map(
    (sourceRoute) =>
      ({
        id: `${sourceRoute}:${record.id}`,
        sourceRoute,
        sourceFile: record.sourceFile,
        sourceLine: record.sourceLine,
        sourceColumn: record.sourceColumn,
        kind: "jsx-href",
        normalizedTarget: record.normalizedTarget,
        responsiveVisibilitySources,
      }) satisfies ProductBreakpointLinkCrawlRecord,
  );
});

assert.ok(breakpointLinkRecords.length > 0);
assert.equal(
  new Set(breakpointLinkRecords.map(({ id }) => id)).size,
  breakpointLinkRecords.length,
);
assert.deepEqual(findBreakpointLinkCrawlIssues(breakpointLinkRecords), []);
assert.equal(
  breakpointLinkRecords.every((record) =>
    registry.internalLinks.some(
      (link) =>
        link.id === record.id.slice(record.sourceRoute.length + 1) &&
        link.ownerRoutes.includes(record.sourceRoute),
    ),
  ),
  true,
);

const sourceLinkCount = new Set(
  breakpointLinkRecords.map(
    ({ sourceFile, sourceLine, sourceColumn }) =>
      `${sourceFile}:${sourceLine}:${sourceColumn}`,
  ),
).size;
const routeCount = new Set(
  breakpointLinkRecords.map(({ sourceRoute }) => sourceRoute),
).size;
const targetCount = new Set(
  breakpointLinkRecords.map(({ normalizedTarget }) => normalizedTarget),
).size;
const originCounts = breakpointLinkRecords
  .flatMap(({ responsiveVisibilitySources }) => responsiveVisibilitySources)
  .reduce<Record<string, number>>((counts, source) => {
    counts[source.origin] = (counts[source.origin] ?? 0) + 1;
    return counts;
  }, {});
const breakpointCounts = breakpointLinkRecords.reduce<Record<string, number>>(
  (counts, record) => {
    const breakpoints = new Set(
      record.responsiveVisibilitySources.flatMap(({ classTokens }) =>
        classTokens.flatMap((token) => {
          const match = /^(max-)?(sm|md|lg|xl|2xl):/u.exec(token);
          return match ? [`${match[1] ?? ""}${match[2]}`] : [];
        }),
      ),
    );
    for (const breakpoint of breakpoints) {
      counts[breakpoint] = (counts[breakpoint] ?? 0) + 1;
    }
    return counts;
  },
  {},
);

assert.equal(breakpointLinkRecords.length, 3);
assert.equal(sourceLinkCount, 3);
assert.equal(routeCount, 1);
assert.equal(targetCount, 3);
assert.deepEqual(
  [...new Set(breakpointLinkRecords.map(({ sourceRoute }) => sourceRoute))],
  ["/feed"],
);
assert.deepEqual(
  [...new Set(breakpointLinkRecords.map(({ normalizedTarget }) => normalizedTarget))].sort(),
  [
    "/discover",
    "/pulse",
    "/pulse/__GIQ_DYNAMIC_SEGMENT__",
  ],
);
assert.deepEqual(originCounts, { ancestor: 2, link: 1 });
assert.deepEqual(breakpointCounts, { lg: 3 });

const validRecord = {
  id: "/fixture:src/app/fixture/page.tsx:10:3:jsx-href:/pricing",
  sourceRoute: "/fixture",
  sourceFile: "src/app/fixture/page.tsx",
  sourceLine: 10,
  sourceColumn: 3,
  kind: "jsx-href",
  normalizedTarget: "/pricing",
  responsiveVisibilitySources: [
    {
      origin: "link",
      sourceLine: 9,
      classSource: '"hidden md:flex"',
      classTokens: ["hidden", "md:flex"],
    },
  ],
} as const satisfies ProductBreakpointLinkCrawlRecord;
assert.deepEqual(findBreakpointLinkCrawlIssues([validRecord]), []);

const negativeFixtures = [
  {
    name: "missing observation id",
    records: [{ ...validRecord, id: " " }],
    expectedCode: "OBSERVATION_ID_MISSING",
  },
  {
    name: "duplicate observation",
    records: [validRecord, validRecord],
    expectedCode: "DUPLICATE_OBSERVATION",
  },
  {
    name: "invalid link kind",
    records: [
      {
        ...validRecord,
        kind: "href-property",
      } as unknown as ProductBreakpointLinkCrawlRecord,
    ],
    expectedCode: "INVALID_KIND",
  },
  {
    name: "invalid route",
    records: [{ ...validRecord, sourceRoute: "fixture" }],
    expectedCode: "SOURCE_ROUTE_INVALID",
  },
  {
    name: "invalid file",
    records: [{ ...validRecord, sourceFile: "fixture/page.tsx" }],
    expectedCode: "SOURCE_FILE_INVALID",
  },
  {
    name: "invalid position",
    records: [{ ...validRecord, sourceLine: 0 }],
    expectedCode: "SOURCE_POSITION_INVALID",
  },
  {
    name: "external target",
    records: [{ ...validRecord, normalizedTarget: "https://example.com" }],
    expectedCode: "INVALID_TARGET",
  },
  {
    name: "missing visibility source",
    records: [{ ...validRecord, responsiveVisibilitySources: [] }],
    expectedCode: "VISIBILITY_SOURCE_MISSING",
  },
  {
    name: "blank class source",
    records: [
      {
        ...validRecord,
        responsiveVisibilitySources: [
          { ...validRecord.responsiveVisibilitySources[0], classSource: " " },
        ],
      },
    ],
    expectedCode: "CLASS_SOURCE_BLANK",
  },
  {
    name: "non-visibility responsive token",
    records: [
      {
        ...validRecord,
        responsiveVisibilitySources: [
          {
            ...validRecord.responsiveVisibilitySources[0],
            classTokens: ["md:px-4"],
          },
        ],
      },
    ],
    expectedCode: "INVALID_VISIBILITY_SOURCE",
  },
  {
    name: "reveal without base hidden token",
    records: [
      {
        ...validRecord,
        responsiveVisibilitySources: [
          {
            ...validRecord.responsiveVisibilitySources[0],
            classTokens: ["md:flex"],
          },
        ],
      },
    ],
    expectedCode: "INVALID_VISIBILITY_SOURCE",
  },
  {
    name: "duplicate class token",
    records: [
      {
        ...validRecord,
        responsiveVisibilitySources: [
          {
            ...validRecord.responsiveVisibilitySources[0],
            classTokens: ["hidden", "md:flex", "md:flex"],
          },
        ],
      },
    ],
    expectedCode: "INVALID_VISIBILITY_SOURCE",
  },
  {
    name: "duplicate visibility source",
    records: [
      {
        ...validRecord,
        responsiveVisibilitySources: [
          validRecord.responsiveVisibilitySources[0],
          validRecord.responsiveVisibilitySources[0],
        ],
      },
    ],
    expectedCode: "DUPLICATE_VISIBILITY_SOURCE",
  },
] as const;

for (const fixture of negativeFixtures) {
  assert.equal(
    findBreakpointLinkCrawlIssues(fixture.records).some(
      ({ code }) => code === fixture.expectedCode,
    ),
    true,
    fixture.name,
  );
}

assert.match(PRODUCT_BREAKPOINT_LINK_CRAWL_SCOPE, /all three discovered/iu);
assert.match(PRODUCT_BREAKPOINT_LINK_CRAWL_SCOPE, /ancestor class source/iu);
assert.match(PRODUCT_BREAKPOINT_LINK_CRAWL_SCOPE, /does not prove rendered CSS/iu);
const evidenceSource = readFileSync(
  PRODUCT_BREAKPOINT_LINK_CRAWL_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/u);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/u);

console.log(
  `Product breakpoint-link crawl evidence passed: ${breakpointLinkRecords.length} production route rows cover ${sourceLinkCount} responsive source links, ${routeCount} owner routes and ${targetCount} internal targets; origins ${JSON.stringify(originCounts)}; breakpoints ${JSON.stringify(breakpointCounts)}.`,
);
