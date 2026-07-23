import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_PRODUCTION_CRAWL_OBSERVATION_EVIDENCE_FILE,
  PRODUCT_PRODUCTION_CRAWL_OBSERVATION_EXPECTED_GAIN,
  PRODUCT_PRODUCTION_CRAWL_OBSERVATION_MASTER_EVIDENCE,
  PRODUCT_PRODUCTION_CRAWL_OBSERVATION_REQUIREMENT_IDS,
  PRODUCT_PRODUCTION_CRAWL_OBSERVATION_SCOPE,
  PRODUCT_PRODUCTION_CRAWL_OBSERVATION_TEST_FILE,
} from "./product-production-crawl-observation-evidence";

// screen-evidence-test-id: PRODUCT-PRODUCTION-CRAWL-OBSERVATION-EVIDENCE

type ProductionLinkAudit = {
  auditId: string;
  generatedAt: string;
  scope: {
    authenticatedExperiencesExercised: boolean;
    mode: string;
    mutationsAttempted: boolean;
    routePatternsObserved: number;
  };
  summary: {
    allObservedInternalLinkTargets: string;
    internalEdges: number;
    uniqueInternalDestinations: number;
  };
  routePatterns: Array<{
    authentication: string;
    dynamicParameters: string[];
    queryParameters: string[];
    routePattern: string;
    status: number | string;
  }>;
};

const audit = JSON.parse(
  readFileSync("output/product-audit/production-link-audit.json", "utf8"),
) as ProductionLinkAudit;
const requirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);

assert.equal(PRODUCT_PRODUCTION_CRAWL_OBSERVATION_EXPECTED_GAIN, 5);
assert.equal(
  new Set(PRODUCT_PRODUCTION_CRAWL_OBSERVATION_REQUIREMENT_IDS).size,
  PRODUCT_PRODUCTION_CRAWL_OBSERVATION_REQUIREMENT_IDS.length,
);
assert.deepEqual(
  Object.keys(PRODUCT_PRODUCTION_CRAWL_OBSERVATION_MASTER_EVIDENCE),
  [...PRODUCT_PRODUCTION_CRAWL_OBSERVATION_REQUIREMENT_IDS],
);

for (const requirementId of PRODUCT_PRODUCTION_CRAWL_OBSERVATION_REQUIREMENT_IDS) {
  assert.ok(requirementIds.has(requirementId), requirementId);
  const evidence =
    PRODUCT_PRODUCTION_CRAWL_OBSERVATION_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_PRODUCTION_CRAWL_OBSERVATION_EVIDENCE_FILE,
    PRODUCT_PRODUCTION_CRAWL_OBSERVATION_TEST_FILE,
  ]);
  evidence.evidence.forEach((evidencePath) =>
    assert.equal(existsSync(evidencePath), true, evidencePath),
  );
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], evidence);
}

assert.equal(audit.auditId, "production-public-link-audit-2026-07-13");
assert.equal(audit.generatedAt, "2026-07-13T15:38:10.7985155+10:00");
assert.equal(audit.scope.mode, "read-only");
assert.equal(audit.scope.authenticatedExperiencesExercised, false);
assert.equal(audit.scope.mutationsAttempted, false);
assert.equal(audit.routePatterns.length, audit.scope.routePatternsObserved);
assert.equal(audit.routePatterns.length, 26);
assert.equal(
  new Set(audit.routePatterns.map(({ routePattern }) => routePattern)).size,
  audit.routePatterns.length,
);

for (const route of audit.routePatterns) {
  assert.ok(route.routePattern.startsWith("/"), route.routePattern);
  assert.ok(
    (typeof route.status === "number" && route.status >= 100) ||
      route.status === "redirect",
    `${route.routePattern}.status`,
  );
  assert.ok(route.authentication.trim(), `${route.routePattern}.authentication`);
  assertUniqueTrimmed(route.dynamicParameters, `${route.routePattern}.dynamic`);
  assertUniqueTrimmed(route.queryParameters, `${route.routePattern}.query`);

  const routeParameters = [
    ...route.routePattern.matchAll(/\[([^\]]+)\]/g),
  ].map((match) => match[1]);
  assert.deepEqual(
    route.dynamicParameters,
    routeParameters,
    `${route.routePattern}.dynamicParameters`,
  );
}

assert.equal(audit.summary.internalEdges, 2448);
assert.equal(audit.summary.uniqueInternalDestinations, 1026);
assert.equal(audit.summary.allObservedInternalLinkTargets, "_self");

assert.match(PRODUCT_PRODUCTION_CRAWL_OBSERVATION_SCOPE, /immutable 2026-07-13 anonymous production crawl/i);
assert.match(PRODUCT_PRODUCTION_CRAWL_OBSERVATION_SCOPE, /2,448 observed internal edges/i);
assert.match(PRODUCT_PRODUCTION_CRAWL_OBSERVATION_SCOPE, /does not prove current production behavior/i);
assert.match(PRODUCT_PRODUCTION_CRAWL_OBSERVATION_SCOPE, /authorization enforcement/i);
assert.match(PRODUCT_PRODUCTION_CRAWL_OBSERVATION_SCOPE, /production readiness/i);

console.log(
  "Production-crawl observation evidence passed: 26 dated route patterns and 2,448 current-tab edges support 5 bounded closures.",
);

function assertUniqueTrimmed(values: readonly string[], label: string) {
  assert.equal(new Set(values).size, values.length, label);
  for (const value of values) {
    assert.equal(value, value.trim(), label);
    assert.ok(value.length > 0, label);
  }
}
