import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";
import {
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_EVIDENCE_FILE,
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_MASTER_EVIDENCE,
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_REQUIREMENT_IDS,
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_SCOPE,
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_TEST_FILE,
} from "./product-production-crawl-local-parity-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-PRODUCTION-CRAWL-LOCAL-PARITY

type ProductionLinkAudit = {
  auditId: string;
  generatedAt: string;
  scope: {
    authenticatedExperiencesExercised: boolean;
    mode: string;
    mutationsAttempted: boolean;
    routePatternsObserved: number;
  };
  routePatterns: Array<{
    localRegistered: boolean;
    routePattern: string;
  }>;
};

const audit = JSON.parse(
  readFileSync("output/product-audit/production-link-audit.json", "utf8"),
) as ProductionLinkAudit;
const sourceRegistry = buildProductAutomatedSourceGateRegistry();

assert.deepEqual(PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_REQUIREMENT_IDS, [
  "DISC.CRAWL.local-parity",
]);
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.some(
    ({ id }) => id === "DISC.CRAWL.local-parity",
  ),
  true,
);

const evidence =
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_MASTER_EVIDENCE[
    "DISC.CRAWL.local-parity"
  ];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_EVIDENCE_FILE,
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_TEST_FILE,
]);

assert.equal(audit.auditId, "production-public-link-audit-2026-07-13");
assert.equal(audit.generatedAt, "2026-07-13T15:38:10.7985155+10:00");
assert.equal(audit.scope.mode, "read-only");
assert.equal(audit.scope.authenticatedExperiencesExercised, false);
assert.equal(audit.scope.mutationsAttempted, false);
assert.equal(audit.routePatterns.length, audit.scope.routePatternsObserved);
assert.equal(audit.routePatterns.length, 26);
assert.equal(new Set(audit.routePatterns.map(({ routePattern }) => routePattern)).size, 26);
assert.ok(audit.routePatterns.every(({ localRegistered }) => localRegistered));

const missingLocalRoutes = audit.routePatterns
  .map(({ routePattern }) => routePattern)
  .filter((routePattern) => !sourceRegistry.routePatterns.includes(routePattern));
assert.deepEqual(missingLocalRoutes, []);
assert.ok(sourceRegistry.routePatterns.includes("/sign-in"));

assert.match(
  PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_SCOPE,
  /26 public route patterns captured by the dated 2026-07-13/i,
);
assert.match(PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_SCOPE, /immutable anonymous snapshot/i);
assert.match(PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_SCOPE, /does not prove current production behavior/i);
assert.match(PRODUCT_PRODUCTION_CRAWL_LOCAL_PARITY_SCOPE, /Design Lab parity/i);

console.log(
  "Production-crawl local parity evidence passed: all 26 dated public route patterns remain registered locally; current production and authenticated crawl coverage remain open.",
);
