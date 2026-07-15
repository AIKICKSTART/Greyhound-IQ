import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  findScreenLocationContractFailures,
  PRODUCT_SCREEN_LOCATION_EVIDENCE_FILE,
  PRODUCT_SCREEN_LOCATION_EXPECTED_GAIN,
  PRODUCT_SCREEN_LOCATION_MASTER_EVIDENCE,
  PRODUCT_SCREEN_LOCATION_REQUIREMENT_IDS,
  PRODUCT_SCREEN_LOCATION_SCOPE,
  PRODUCT_SCREEN_LOCATION_TEST_FILE,
  type ScreenLocationContract,
} from "./product-screen-location-evidence";
import { getLocalSourceClosure } from "./screen-contracts/screen-contract-source-audit";

// screen-evidence-test-id: PRODUCT-SCREEN-LOCATION-EVIDENCE

assert.deepEqual(PRODUCT_SCREEN_LOCATION_REQUIREMENT_IDS, [
  "COMPLETE.UNDERSTAND.location",
]);
assert.equal(PRODUCT_SCREEN_LOCATION_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_SCREEN_LOCATION_MASTER_EVIDENCE), [
  "COMPLETE.UNDERSTAND.location",
]);
assert.deepEqual(
  PRODUCT_SCREEN_LOCATION_MASTER_EVIDENCE["COMPLETE.UNDERSTAND.location"],
  {
    status: "tested",
    evidence: [
      PRODUCT_SCREEN_LOCATION_EVIDENCE_FILE,
      PRODUCT_SCREEN_LOCATION_TEST_FILE,
      "src/components/demo-experience-registry.ts",
      "src/components/screen-contracts/screen-contract-source-audit.ts",
    ],
  },
);
for (const evidencePath of PRODUCT_SCREEN_LOCATION_MASTER_EVIDENCE[
  "COMPLETE.UNDERSTAND.location"
].evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}
assert.match(PRODUCT_SCREEN_LOCATION_SCOPE, /all 97 registered screen contracts/i);
assert.match(PRODUCT_SCREEN_LOCATION_SCOPE, /recursive local source closure/i);
assert.match(PRODUCT_SCREEN_LOCATION_SCOPE, /does not prove conditional browser rendering/i);
assert.match(PRODUCT_SCREEN_LOCATION_SCOPE, /measured user comprehension/i);
assert.match(PRODUCT_SCREEN_LOCATION_SCOPE, /production readiness/i);

assert.equal(SCREEN_CONTRACTS.length, 97);
const contracts = SCREEN_CONTRACTS.map((screen): ScreenLocationContract => {
  const sourcePaths = [...getLocalSourceClosure(screen.sourceFiles[0])];
  assert.ok(sourcePaths.length > 0, screen.route);
  const source = sourcePaths
    .map((sourcePath) => readFileSync(sourcePath, "utf8"))
    .join("\n");
  return {
    route: screen.route,
    concreteRoute: screen.concreteRoute,
    title: screen.title,
    pageHeadingCount: countNonEmptyPageHeadings(source),
  };
});

assert.deepEqual(findScreenLocationContractFailures(contracts), []);

const validFixture: ScreenLocationContract = {
  route: "/example",
  concreteRoute: "/example",
  title: "Example",
  pageHeadingCount: 1,
};
assert.deepEqual(findScreenLocationContractFailures([validFixture]), []);
assert.deepEqual(
  findScreenLocationContractFailures([
    validFixture,
    {
      route: "invalid",
      concreteRoute: "invalid",
      title: " ",
      pageHeadingCount: 0,
    },
  ]),
  [
    "invalid: invalid route",
    "invalid: invalid concrete route",
    "invalid: missing screen title",
    "invalid: missing non-empty page-level h1",
  ],
);
assert.deepEqual(
  findScreenLocationContractFailures([
    validFixture,
    { ...validFixture, route: "/example" },
  ]),
  [
    "/example: duplicate route",
    "/example: duplicate concrete route",
    "/example: duplicate screen title",
  ],
);

const requirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
assert.equal(requirementIds.has("COMPLETE.UNDERSTAND.location"), true);

console.log(
  `Screen location evidence passed: ${contracts.length} registered screens have unique route/title identity and a non-empty page-level h1 in their local source closure.`,
);

function countNonEmptyPageHeadings(source: string) {
  return [...source.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].filter(
    (match) => stripJsxNoise(match[1]).length > 0,
  ).length;
}

function stripJsxNoise(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/[{}()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
