import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";
import {
  findProductCrawlDesignLabParityIssues,
  type ProductCrawlDesignLabParityRecord,
  PRODUCT_CRAWL_DESIGN_LAB_PARITY_EVIDENCE_FILE,
  PRODUCT_CRAWL_DESIGN_LAB_PARITY_EXPECTED_GAIN,
  PRODUCT_CRAWL_DESIGN_LAB_PARITY_MASTER_EVIDENCE,
  PRODUCT_CRAWL_DESIGN_LAB_PARITY_REQUIREMENT_IDS,
  PRODUCT_CRAWL_DESIGN_LAB_PARITY_SCOPE,
  PRODUCT_CRAWL_DESIGN_LAB_PARITY_TEST_FILE,
} from "./product-crawl-design-lab-parity-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-CRAWL-DESIGN-LAB-PARITY-EVIDENCE

const EXPECTED_ID = "DISC.CRAWL.design-lab-parity" as const;
assert.deepEqual(PRODUCT_CRAWL_DESIGN_LAB_PARITY_REQUIREMENT_IDS, [
  EXPECTED_ID,
]);
assert.equal(PRODUCT_CRAWL_DESIGN_LAB_PARITY_EXPECTED_GAIN, 1);
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.find(({ id }) => id === EXPECTED_ID)?.requirement,
  "Record whether each production destination exists in the Design Lab.",
);

const evidence = PRODUCT_CRAWL_DESIGN_LAB_PARITY_MASTER_EVIDENCE[EXPECTED_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_CRAWL_DESIGN_LAB_PARITY_EVIDENCE_FILE,
  PRODUCT_CRAWL_DESIGN_LAB_PARITY_TEST_FILE,
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
    .map((ownerRoute): ProductCrawlDesignLabParityRecord => {
      assert.notEqual(link.matchedRoutePattern, null, link.id);
      const matchedRoutePattern = link.matchedRoutePattern as string;
      const screen = screensByRoute.get(matchedRoutePattern);
      const designLabExists = Boolean(screen?.designLabFixtureIds.length);

      return {
        id: `${ownerRoute}:${link.id}`,
        sourceRoute: ownerRoute,
        sourceFile: link.sourceFile,
        normalizedDestination: link.normalizedTarget,
        matchedRoutePattern,
        designLabExists,
        designLabFixtureIds: screen?.designLabFixtureIds ?? [],
        classification: designLabExists
          ? "design-lab-screen"
          : "non-screen-route-handler",
        absenceReason: designLabExists
          ? null
          : "The destination is a Route Handler rather than a rendered screen, so no Design Lab screen fixture applies.",
      };
    }),
);
const expectedObservationIds = records.map(({ id }) => id);

assert.equal(records.length, 2_292);
assert.equal(new Set(expectedObservationIds).size, records.length);
assert.deepEqual(
  findProductCrawlDesignLabParityIssues(records, expectedObservationIds),
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
  80,
);

const representedRecords = records.filter(({ designLabExists }) => designLabExists);
const absentRecords = records.filter(({ designLabExists }) => !designLabExists);
assert.equal(representedRecords.length, 2_244);
assert.equal(absentRecords.length, 48);
assert.equal(
  representedRecords.every(({ designLabFixtureIds }) => designLabFixtureIds.length > 0),
  true,
);
assert.deepEqual(
  [...new Set(absentRecords.map(({ matchedRoutePattern }) => matchedRoutePattern))].sort(),
  ["/api/media/[id]/blob", "/sign-in"],
);
assert.deepEqual(
  Object.fromEntries(
    ["/api/media/[id]/blob", "/sign-in"].map((route) => [
      route,
      absentRecords.filter(({ matchedRoutePattern }) => matchedRoutePattern === route)
        .length,
    ]),
  ),
  { "/api/media/[id]/blob": 7, "/sign-in": 41 },
);

const validScreenRecord = representedRecords[0];
assert.ok(validScreenRecord);
const validHandlerRecord = absentRecords[0];
assert.ok(validHandlerRecord);

const issueCodes = (
  fixtureRecords: readonly ProductCrawlDesignLabParityRecord[],
  fixtureExpectedIds: readonly string[] = fixtureRecords.map(({ id }) => id),
) =>
  findProductCrawlDesignLabParityIssues(fixtureRecords, fixtureExpectedIds).map(
    ({ code }) => code,
  );

assert.ok(
  issueCodes([validScreenRecord, validScreenRecord]).includes(
    "DUPLICATE_OBSERVATION",
  ),
);
assert.ok(
  issueCodes([{ ...validScreenRecord, sourceRoute: "fixture" }]).includes(
    "SOURCE_ROUTE_INVALID",
  ),
);
assert.ok(
  issueCodes([{ ...validScreenRecord, sourceFile: "scripts/fixture.ts" }]).includes(
    "SOURCE_FILE_INVALID",
  ),
);
assert.ok(
  issueCodes([{ ...validScreenRecord, normalizedDestination: "fixture" }]).includes(
    "DESTINATION_INVALID",
  ),
);
assert.ok(
  issueCodes([{ ...validScreenRecord, matchedRoutePattern: "" }]).includes(
    "MATCHED_ROUTE_INVALID",
  ),
);
assert.ok(
  issueCodes([{ ...validScreenRecord, designLabFixtureIds: [] }]).includes(
    "PARITY_METADATA_INCONSISTENT",
  ),
);
assert.ok(
  issueCodes([{ ...validHandlerRecord, absenceReason: null }]).includes(
    "PARITY_METADATA_INCONSISTENT",
  ),
);
assert.ok(
  issueCodes([{ ...validHandlerRecord, designLabFixtureIds: ["DL.FALSE"] }]).includes(
    "PARITY_METADATA_INCONSISTENT",
  ),
);
assert.ok(
  issueCodes([validScreenRecord], [validScreenRecord.id, "missing-record"]).includes(
    "EXPECTED_OBSERVATION_MISSING",
  ),
);
assert.ok(
  issueCodes([validScreenRecord], []).includes("UNEXPECTED_OBSERVATION"),
);

assert.match(PRODUCT_CRAWL_DESIGN_LAB_PARITY_SCOPE, /all 2,292/i);
assert.match(PRODUCT_CRAWL_DESIGN_LAB_PARITY_SCOPE, /2,244 page-destination/i);
assert.match(PRODUCT_CRAWL_DESIGN_LAB_PARITY_SCOPE, /41 \/sign-in/i);
assert.match(PRODUCT_CRAWL_DESIGN_LAB_PARITY_SCOPE, /seven \/api\/media/i);
assert.match(PRODUCT_CRAWL_DESIGN_LAB_PARITY_SCOPE, /recording only/i);
assert.match(PRODUCT_CRAWL_DESIGN_LAB_PARITY_SCOPE, /does not claim browser rendering/i);

console.log(
  `Product crawl Design Lab parity evidence passed: ${representedRecords.length} link observations map to registered screen fixtures and ${absentRecords.length} truthfully record non-screen Route Handler destinations across ${routesWithDiscoveries.size} production routes.`,
);
