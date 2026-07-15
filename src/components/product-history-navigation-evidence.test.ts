import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";

import {
  findHistoryNavigationIssues,
  type ProductHistoryNavigationContract,
  PRODUCT_HISTORY_NAVIGATION_CONTRACTS,
  PRODUCT_HISTORY_NAVIGATION_EVIDENCE_FILE,
  PRODUCT_HISTORY_NAVIGATION_MASTER_EVIDENCE,
  PRODUCT_HISTORY_NAVIGATION_REQUIREMENT_ID,
  PRODUCT_HISTORY_NAVIGATION_SCOPE,
  PRODUCT_HISTORY_NAVIGATION_TEST_FILE,
} from "./product-history-navigation-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-HISTORY-NAVIGATION-EVIDENCE

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === PRODUCT_HISTORY_NAVIGATION_REQUIREMENT_ID,
);
assert.equal(
  requirement?.requirement,
  "Make back and forward navigation work correctly.",
);
const evidence =
  PRODUCT_HISTORY_NAVIGATION_MASTER_EVIDENCE[
    PRODUCT_HISTORY_NAVIGATION_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_HISTORY_NAVIGATION_EVIDENCE_FILE,
  PRODUCT_HISTORY_NAVIGATION_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
for (const evidencePath of evidence.evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}

type DiscoveredHistoryCall = {
  sourceFile: string;
  sourceLine: number;
  method: ProductHistoryNavigationContract["method"];
  urlArgument: string;
};

const discoveredCalls = runtimeSourceFiles("src").flatMap((sourceFile) =>
  discoverHistoryCalls(sourceFile),
);
assert.equal(discoveredCalls.length, 8);
assert.equal(PRODUCT_HISTORY_NAVIGATION_CONTRACTS.length, 8);
assert.deepEqual(findHistoryNavigationIssues(PRODUCT_HISTORY_NAVIGATION_CONTRACTS), []);

const contractKeys = PRODUCT_HISTORY_NAVIGATION_CONTRACTS.map(callKey).toSorted();
const discoveredKeys = discoveredCalls.map(callKey).toSorted();
assert.deepEqual(
  discoveredKeys,
  contractKeys,
  "every runtime History API write must have one reviewed contract",
);
assert.equal(new Set(discoveredKeys).size, discoveredCalls.length);

for (const contract of PRODUCT_HISTORY_NAVIGATION_CONTRACTS) {
  const source = readFileSync(contract.sourceFile, "utf8");
  for (const marker of contract.proofMarkers) {
    assert.equal(
      source.includes(marker),
      true,
      `${contract.id}: missing ${marker}`,
    );
  }
  const discovered = discoveredCalls.find(
    (call) => callKey(call) === callKey(contract),
  );
  assert.ok(discovered, contract.id);
  assert.ok(discovered.sourceLine > 0, contract.id);
}

const strategyCounts = PRODUCT_HISTORY_NAVIGATION_CONTRACTS.reduce<
  Record<string, number>
>((counts, contract) => {
  counts[contract.strategy] = (counts[contract.strategy] ?? 0) + 1;
  return counts;
}, {});
assert.deepEqual(strategyCounts, {
  "replace-transient-current-entry": 5,
  "explicit-popstate-restoration": 1,
  "next-search-params-restoration": 2,
});
assert.equal(
  PRODUCT_HISTORY_NAVIGATION_CONTRACTS.filter(
    ({ method }) => method === "pushState",
  ).length,
  3,
);
assert.equal(
  PRODUCT_HISTORY_NAVIGATION_CONTRACTS.filter(
    ({ method }) => method === "replaceState",
  ).length,
  5,
);

const nextHistoryDocumentation = readFileSync(
  "node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md",
  "utf8",
);
assert.match(nextHistoryDocumentation, /### Native History API/u);
assert.match(
  nextHistoryDocumentation,
  /pushState` and `replaceState` calls integrate into the Next\.js Router/iu,
);
assert.match(nextHistoryDocumentation, /sync with[\s\S]*useSearchParams/iu);
assert.match(
  nextHistoryDocumentation,
  /pushState[\s\S]*user can navigate back to the previous state/iu,
);

const inspectorModel = readFileSync(
  "src/components/design-lab-contract-inspector-model.ts",
  "utf8",
);
assert.match(
  inspectorModel,
  /resolveDesignLabInspectorContract\(route\)[\s\S]*return `\$\{url\.pathname\}\$\{url\.search\}\$\{url\.hash\}`/u,
);
for (const builderFile of [
  "src/components/design-lab-scenario-state.ts",
  "src/components/design-lab-onboarding-preview.ts",
]) {
  const source = readFileSync(builderFile, "utf8");
  assert.match(source, /new URL\(currentHref, "http:\/\/design-lab\.invalid"\)/u);
  assert.match(
    source,
    /return `\$\{url\.pathname\}\$\{url\.search\}\$\{url\.hash\}`/u,
  );
}
const prototypeNavigation = readFileSync(
  "src/components/prototype-dock-navigation.ts",
  "utf8",
);
assert.match(prototypeNavigation, /if \(action === "home"\) return "\/";/u);
assert.match(prototypeNavigation, /if \(action === "chat"\) return "\/pulse";/u);
assert.match(prototypeNavigation, /return `\/feed\?\$\{params\.toString\(\)\}`;/u);
assert.doesNotMatch(prototypeNavigation, /https?:\/\//u);

const validContract = {
  id: "fixture.history",
  sourceFile: "src/components/fixture.tsx",
  method: "pushState",
  urlArgument: "buildFixtureUrl(window.location.href)",
  strategy: "next-search-params-restoration",
  targetPolicy: "relative-builder",
  proofMarkers: ["useSearchParams()"],
  rationale: "Create a reversible fixture selection.",
} as const satisfies ProductHistoryNavigationContract;
assert.deepEqual(findHistoryNavigationIssues([validContract]), []);

const negativeFixtures = [
  {
    name: "missing id",
    records: [{ ...validContract, id: " " }],
    expectedCode: "MISSING_ID",
  },
  {
    name: "duplicate contract",
    records: [validContract, validContract],
    expectedCode: "DUPLICATE_CONTRACT",
  },
  {
    name: "test source",
    records: [{ ...validContract, sourceFile: "src/components/fixture.test.tsx" }],
    expectedCode: "INVALID_FILE",
  },
  {
    name: "missing URL argument",
    records: [{ ...validContract, urlArgument: " " }],
    expectedCode: "MISSING_URL_ARGUMENT",
  },
  {
    name: "missing proof",
    records: [{ ...validContract, proofMarkers: [] }],
    expectedCode: "MISSING_PROOF",
  },
  {
    name: "duplicate proof",
    records: [
      {
        ...validContract,
        proofMarkers: ["useSearchParams()", "useSearchParams()"],
      },
    ],
    expectedCode: "MISSING_PROOF",
  },
  {
    name: "missing rationale",
    records: [{ ...validContract, rationale: " " }],
    expectedCode: "MISSING_RATIONALE",
  },
  {
    name: "push without restoration",
    records: [
      {
        ...validContract,
        strategy: "replace-transient-current-entry",
      } as ProductHistoryNavigationContract,
    ],
    expectedCode: "INVALID_METHOD_STRATEGY",
  },
  {
    name: "replace with popstate strategy",
    records: [
      {
        ...validContract,
        method: "replaceState",
        strategy: "explicit-popstate-restoration",
      } as ProductHistoryNavigationContract,
    ],
    expectedCode: "INVALID_METHOD_STRATEGY",
  },
  {
    name: "invalid target policy",
    records: [
      {
        ...validContract,
        targetPolicy: "external-url",
      } as unknown as ProductHistoryNavigationContract,
    ],
    expectedCode: "INVALID_TARGET_POLICY",
  },
] as const;

for (const fixture of negativeFixtures) {
  assert.equal(
    findHistoryNavigationIssues(fixture.records).some(
      ({ code }) => code === fixture.expectedCode,
    ),
    true,
    fixture.name,
  );
}

assert.match(PRODUCT_HISTORY_NAVIGATION_SCOPE, /all eight direct/iu);
assert.match(PRODUCT_HISTORY_NAVIGATION_SCOPE, /Three pushState calls/iu);
assert.match(PRODUCT_HISTORY_NAVIGATION_SCOPE, /Five replaceState calls/iu);
assert.match(PRODUCT_HISTORY_NAVIGATION_SCOPE, /same-origin URL/iu);
assert.match(
  PRODUCT_HISTORY_NAVIGATION_SCOPE,
  /does not prove browser rendering/iu,
);
const evidenceSource = readFileSync(
  PRODUCT_HISTORY_NAVIGATION_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/u);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/u);

console.log(
  `Product history-navigation evidence passed: ${discoveredCalls.length}/8 runtime History API writes are exactly registered; strategies ${JSON.stringify(strategyCounts)}.`,
);

function callKey(call: {
  sourceFile: string;
  method: ProductHistoryNavigationContract["method"];
  urlArgument: string;
}) {
  return `${call.sourceFile}:${call.method}:${call.urlArgument}`;
}

function discoverHistoryCalls(sourceFile: string): DiscoveredHistoryCall[] {
  const source = readFileSync(sourceFile, "utf8");
  const parsed = ts.createSourceFile(
    sourceFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourceFile.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const calls: DiscoveredHistoryCall[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      (node.expression.name.text === "pushState" ||
        node.expression.name.text === "replaceState") &&
      node.expression.expression.getText(parsed) === "window.history"
    ) {
      const url = node.arguments[2];
      assert.ok(url, `${sourceFile}: History call needs a URL argument`);
      const location = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
      calls.push({
        sourceFile,
        sourceLine: location.line + 1,
        method: node.expression.name.text,
        urlArgument: url.getText(parsed),
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return calls;
}

function runtimeSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unsupported symbolic link under runtime source: ${absolutePath}`);
      }
      if (entry.isDirectory()) return runtimeSourceFiles(absolutePath);
      if (!/\.[cm]?[jt]sx?$/u.test(entry.name)) return [];
      if (/\.test\.[cm]?[jt]sx?$|\.d\.ts$/u.test(entry.name)) return [];
      return [relative(process.cwd(), absolutePath).replaceAll("\\", "/")];
    })
    .toSorted();
}
