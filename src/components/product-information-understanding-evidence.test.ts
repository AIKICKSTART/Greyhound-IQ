import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACTS,
} from "./demo-experience-registry";
import {
  findInformationUnderstandingIssues,
  type ProductInformationUnderstandingContract,
  PRODUCT_INFORMATION_UNDERSTANDING_EVIDENCE_FILE,
  PRODUCT_INFORMATION_UNDERSTANDING_EXPECTED_GAIN,
  PRODUCT_INFORMATION_UNDERSTANDING_MASTER_EVIDENCE,
  PRODUCT_INFORMATION_UNDERSTANDING_REQUIREMENT_IDS,
  PRODUCT_INFORMATION_UNDERSTANDING_SCOPE,
  PRODUCT_INFORMATION_UNDERSTANDING_TEST_FILE,
} from "./product-information-understanding-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { getLocalSourceClosure } from "./screen-contracts/screen-contract-source-audit";

// screen-evidence-test-id: PRODUCT-INFORMATION-UNDERSTANDING-EVIDENCE

const EXPECTED_IDS = ["COMPLETE.UNDERSTAND.information"] as const;

assert.deepEqual(PRODUCT_INFORMATION_UNDERSTANDING_REQUIREMENT_IDS, EXPECTED_IDS);
assert.equal(PRODUCT_INFORMATION_UNDERSTANDING_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_INFORMATION_UNDERSTANDING_MASTER_EVIDENCE),
  EXPECTED_IDS,
);

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === EXPECTED_IDS[0],
);
assert.equal(
  requirement?.requirement,
  "Ensure every user can understand the information they are viewing.",
);

const record =
  PRODUCT_INFORMATION_UNDERSTANDING_MASTER_EVIDENCE[EXPECTED_IDS[0]];
assert.equal(record.status, "tested");
assert.deepEqual(record.evidence.slice(0, 2), [
  PRODUCT_INFORMATION_UNDERSTANDING_EVIDENCE_FILE,
  PRODUCT_INFORMATION_UNDERSTANDING_TEST_FILE,
]);
assert.equal(new Set(record.evidence).size, record.evidence.length);
for (const evidencePath of record.evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}

const storyByRoute = new Map(
  DEMO_SCREEN_FAMILIES.flatMap((family) =>
    family.screens.map((screen) => [screen.route, screen.userStory] as const),
  ),
);
const productionScreens = SCREEN_CONTRACTS.filter(
  ({ productionEnabled }) => productionEnabled,
);
assert.equal(SCREEN_CONTRACTS.length, 103);
assert.equal(productionScreens.length, 96);

const contracts = productionScreens.map((screen) => {
  const story = storyByRoute.get(screen.route);
  assert.ok(story, `${screen.route}: canonical user story`);
  const sourceClosure = [...getLocalSourceClosure(screen.sourceFiles[0])];
  const source = sourceClosure
    .map((sourcePath) => readFileSync(sourcePath, "utf8"))
    .join("\n");
  const renderAssertions = [...story.evidence.source.renderAssertions];
  return {
    route: screen.route,
    title: screen.title,
    description: screen.description,
    actor: story.actor,
    trigger: story.trigger,
    outcome: story.outcome,
    acceptance: { ...story.acceptance },
    renderAssertions,
    sourcePath: story.evidence.source.path,
    canonicalSourcePath: screen.sourceFiles[0],
    storyCoverageStatus: story.coverage.status,
    missingRenderAssertions: renderAssertions.filter(
      (assertion) => !source.includes(assertion),
    ),
  } satisfies ProductInformationUnderstandingContract;
});

assert.deepEqual(findInformationUnderstandingIssues(contracts), []);
assert.equal(new Set(contracts.map(({ route }) => route)).size, 90);
assert.equal(
  contracts.reduce(
    (total, contract) => total + contract.renderAssertions.length,
    0,
  ),
  338,
);
assert.equal(
  new Set(contracts.map(({ canonicalSourcePath }) => canonicalSourcePath)).size,
  90,
);

const validContract = {
  route: "/fixture",
  title: "Fixture",
  description: "Explain the fixture information shown on this route.",
  actor: "Member",
  trigger: "Open /fixture",
  outcome: "Understand the fixture information.",
  acceptance: {
    given: "The fixture exists.",
    when: "The member opens it.",
    then: "The page explains the fixture.",
  },
  renderAssertions: ["Fixture information"],
  sourcePath: "src/app/fixture/page.tsx",
  canonicalSourcePath: "src/app/fixture/page.tsx",
  storyCoverageStatus: "tested",
  missingRenderAssertions: [],
} as const satisfies ProductInformationUnderstandingContract;
assert.deepEqual(findInformationUnderstandingIssues([validContract]), []);

const negativeFixtures = [
  {
    name: "missing outcome",
    records: [{ ...validContract, outcome: "" }],
    expected: /outcome is empty/,
  },
  {
    name: "missing acceptance",
    records: [
      {
        ...validContract,
        acceptance: { ...validContract.acceptance, then: "" },
      },
    ],
    expected: /acceptance\.then is empty/,
  },
  {
    name: "missing render contract",
    records: [{ ...validContract, renderAssertions: [] }],
    expected: /no information render assertions/,
  },
  {
    name: "source mismatch",
    records: [{ ...validContract, sourcePath: "src/app/wrong/page.tsx" }],
    expected: /story source does not match/,
  },
  {
    name: "untested story",
    records: [{ ...validContract, storyCoverageStatus: "verified" }],
    expected: /user-story coverage is not tested/,
  },
  {
    name: "missing source assertion",
    records: [
      { ...validContract, missingRenderAssertions: ["Fixture information"] },
    ],
    expected: /render assertion missing from source/,
  },
  {
    name: "duplicate screen",
    records: [validContract, validContract],
    expected: /duplicate screen/,
  },
] as const;

for (const fixture of negativeFixtures) {
  assert.match(
    findInformationUnderstandingIssues(fixture.records).join("\n"),
    fixture.expected,
    fixture.name,
  );
}

assert.match(PRODUCT_INFORMATION_UNDERSTANDING_SCOPE, /all 90 production-enabled screens/i);
assert.match(PRODUCT_INFORMATION_UNDERSTANDING_SCOPE, /given\/when\/then acceptance/i);
assert.match(PRODUCT_INFORMATION_UNDERSTANDING_SCOPE, /exact recursive local source closure/i);
assert.match(PRODUCT_INFORMATION_UNDERSTANDING_SCOPE, /excludes the six Design Lab-only screens/i);
assert.match(PRODUCT_INFORMATION_UNDERSTANDING_SCOPE, /does not claim browser rendering/i);
const evidenceSource = readFileSync(
  PRODUCT_INFORMATION_UNDERSTANDING_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Product information-understanding evidence passed: 90 production screens, 90 tested user stories and 338 exact source render assertions; exact +1 gate.",
);
