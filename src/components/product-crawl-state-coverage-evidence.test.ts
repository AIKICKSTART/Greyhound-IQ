import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";
import {
  classifyProductCrawlStateIds,
  findProductCrawlStateCoverageIssues,
  type ProductCrawlStateCoverageRecord,
  PRODUCT_CRAWL_STATE_COVERAGE_EVIDENCE_FILE,
  PRODUCT_CRAWL_STATE_COVERAGE_EXPECTED_GAIN,
  PRODUCT_CRAWL_STATE_COVERAGE_MASTER_EVIDENCE,
  PRODUCT_CRAWL_STATE_COVERAGE_REQUIREMENT_IDS,
  PRODUCT_CRAWL_STATE_COVERAGE_SCOPE,
  PRODUCT_CRAWL_STATE_COVERAGE_TEST_FILE,
} from "./product-crawl-state-coverage-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-CRAWL-STATE-COVERAGE-EVIDENCE

const EXPECTED_ID = "DISC.CRAWL.state-coverage" as const;
assert.deepEqual(PRODUCT_CRAWL_STATE_COVERAGE_REQUIREMENT_IDS, [EXPECTED_ID]);
assert.equal(PRODUCT_CRAWL_STATE_COVERAGE_EXPECTED_GAIN, 1);
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.find(({ id }) => id === EXPECTED_ID)?.requirement,
  "Record whether each destination has complete loading, empty, and error states.",
);

const evidence = PRODUCT_CRAWL_STATE_COVERAGE_MASTER_EVIDENCE[EXPECTED_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_CRAWL_STATE_COVERAGE_EVIDENCE_FILE,
  PRODUCT_CRAWL_STATE_COVERAGE_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
for (const evidencePath of evidence.evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}

const productionRoutes = new Set(
  SCREEN_CONTRACTS.filter(({ productionEnabled }) => productionEnabled).map(
    ({ route }) => route,
  ),
);
const screensByRoute = new Map(
  SCREEN_CONTRACTS.map((screen) => [screen.route, screen] as const),
);
assert.equal(productionRoutes.size, 90);

const registry = buildProductAutomatedSourceGateRegistry();
assert.deepEqual(registry.internalLinkIssues, []);

const records = registry.internalLinks.flatMap((link) =>
  link.ownerRoutes
    .filter((ownerRoute) => productionRoutes.has(ownerRoute))
    .map((ownerRoute): ProductCrawlStateCoverageRecord => {
      assert.notEqual(link.matchedRoutePattern, null, link.id);
      const matchedRoutePattern = link.matchedRoutePattern as string;
      const screen = screensByRoute.get(matchedRoutePattern);
      const stateIds = screen?.stateRules.map(({ id }) => id) ?? [];
      const classification = classifyProductCrawlStateIds(stateIds);

      return {
        id: `${ownerRoute}:${link.id}`,
        sourceRoute: ownerRoute,
        sourceFile: link.sourceFile,
        normalizedDestination: link.normalizedTarget,
        matchedRoutePattern,
        destinationKind: screen ? "screen" : "route-handler",
        stateIds,
        ...classification,
      };
    }),
);
const expectedObservationIds = records.map(({ id }) => id);

assert.equal(records.length, 2_242);
assert.equal(new Set(expectedObservationIds).size, records.length);
assert.deepEqual(
  findProductCrawlStateCoverageIssues(records, expectedObservationIds),
  [],
);

const routesWithDiscoveries = new Set(records.map(({ sourceRoute }) => sourceRoute));
assert.equal(routesWithDiscoveries.size, 89);
assert.deepEqual(
  [...productionRoutes].filter((route) => !routesWithDiscoveries.has(route)),
  ["/statistics"],
);
assert.equal(
  new Set(records.map(({ matchedRoutePattern }) => matchedRoutePattern)).size,
  78,
);

const screenRecords = records.filter(({ destinationKind }) => destinationKind === "screen");
const routeHandlerRecords = records.filter(
  ({ destinationKind }) => destinationKind === "route-handler",
);
const completeRecords = records.filter(({ complete }) => complete);
const incompleteRecords = records.filter(({ complete }) => !complete);

assert.equal(screenRecords.length, 2_194);
assert.equal(routeHandlerRecords.length, 48);
assert.equal(completeRecords.length, 28);
assert.equal(incompleteRecords.length, 2_214);
assert.deepEqual(
  [...new Set(completeRecords.map(({ matchedRoutePattern }) => matchedRoutePattern))].sort(),
  ["/", "/races", "/races/[id]"],
);
assert.equal(
  completeRecords.every(
    ({ loadingStateIds, emptyStateIds, errorStateIds, missingStateFamilies }) =>
      loadingStateIds.length > 0 &&
      emptyStateIds.length > 0 &&
      errorStateIds.length > 0 &&
      missingStateFamilies.length === 0,
  ),
  true,
);
assert.equal(
  routeHandlerRecords.every(
    ({ stateIds, complete, missingStateFamilies }) =>
      stateIds.length === 0 &&
      !complete &&
      missingStateFamilies.join(",") === "loading,empty,error",
  ),
  true,
);

const validCompleteRecord = completeRecords[0];
assert.ok(validCompleteRecord);
const validIncompleteRecord = incompleteRecords.find(
  ({ destinationKind }) => destinationKind === "screen",
);
assert.ok(validIncompleteRecord);
const validRouteHandlerRecord = routeHandlerRecords[0];
assert.ok(validRouteHandlerRecord);

const issueCodes = (
  fixtureRecords: readonly ProductCrawlStateCoverageRecord[],
  fixtureExpectedIds: readonly string[] = fixtureRecords.map(({ id }) => id),
) =>
  findProductCrawlStateCoverageIssues(fixtureRecords, fixtureExpectedIds).map(
    ({ code }) => code,
  );

assert.ok(
  issueCodes([validCompleteRecord, validCompleteRecord]).includes(
    "DUPLICATE_OBSERVATION",
  ),
);
assert.ok(
  issueCodes([{ ...validCompleteRecord, sourceRoute: "fixture" }]).includes(
    "SOURCE_ROUTE_INVALID",
  ),
);
assert.ok(
  issueCodes([{ ...validCompleteRecord, sourceFile: "scripts/fixture.ts" }]).includes(
    "SOURCE_FILE_INVALID",
  ),
);
assert.ok(
  issueCodes([{ ...validCompleteRecord, normalizedDestination: "fixture" }]).includes(
    "DESTINATION_INVALID",
  ),
);
assert.ok(
  issueCodes([{ ...validCompleteRecord, matchedRoutePattern: "" }]).includes(
    "MATCHED_ROUTE_INVALID",
  ),
);
assert.ok(
  issueCodes([
    { ...validCompleteRecord, stateIds: [...validCompleteRecord.stateIds, ""] },
  ]).includes("STATE_IDS_INVALID"),
);
assert.ok(
  issueCodes([{ ...validCompleteRecord, destinationKind: "route-handler" }]).includes(
    "DESTINATION_KIND_INCONSISTENT",
  ),
);
assert.ok(
  issueCodes([{ ...validRouteHandlerRecord, destinationKind: "screen" }]).includes(
    "DESTINATION_KIND_INCONSISTENT",
  ),
);
assert.ok(
  issueCodes([{ ...validCompleteRecord, loadingStateIds: [] }]).includes(
    "STATE_CLASSIFICATION_INCONSISTENT",
  ),
);
assert.ok(
  issueCodes([{ ...validIncompleteRecord, complete: true }]).includes(
    "COMPLETENESS_INCONSISTENT",
  ),
);
assert.ok(
  issueCodes(
    [validCompleteRecord],
    [validCompleteRecord.id, "missing-record"],
  ).includes("EXPECTED_OBSERVATION_MISSING"),
);
assert.ok(
  issueCodes([validCompleteRecord], []).includes("UNEXPECTED_OBSERVATION"),
);

assert.match(PRODUCT_CRAWL_STATE_COVERAGE_SCOPE, /all 2,242/i);
assert.match(PRODUCT_CRAWL_STATE_COVERAGE_SCOPE, /Twenty-eight observations/i);
assert.match(PRODUCT_CRAWL_STATE_COVERAGE_SCOPE, /other 2,214/i);
assert.match(PRODUCT_CRAWL_STATE_COVERAGE_SCOPE, /48 non-screen Route Handler/i);
assert.match(PRODUCT_CRAWL_STATE_COVERAGE_SCOPE, /explicit canonical ID suffixes only/i);
assert.match(PRODUCT_CRAWL_STATE_COVERAGE_SCOPE, /does not claim that incomplete destinations are complete/i);

console.log(
  `Product crawl state coverage evidence passed: ${completeRecords.length}/${records.length} link observations have registered loading, empty and error states; ${incompleteRecords.length} truthfully record missing state families.`,
);
