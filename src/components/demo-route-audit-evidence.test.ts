import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEMO_ROUTE_AUDIT_EVALUATION,
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS,
} from "./demo-experience-registry";
import { evaluateDemoRouteAuditEvidence } from "./demo-route-audit-evidence";

type AuditFixture = {
  schemaVersion: number;
  generatedAt: string;
  baseUrl: string;
  expected: number;
  passed: number;
  failed: number;
  results: Array<{
    family: string;
    route: string;
    samplePath: string;
    finalUrl: string;
    status: number | null;
    durationMs: number;
    demoHeader: string | null;
    hasMain: boolean;
    hasH1: boolean;
    hasReactStreamError: boolean;
    errorMarkers: string[];
    passed: boolean;
    error: string | null;
  }>;
};

const latest = JSON.parse(
  readFileSync(resolve("output/demo-route-audit/latest.json"), "utf8"),
) as AuditFixture;

assert.equal(DEMO_ROUTE_AUDIT_EVALUATION.valid, true);
assert.equal(DEMO_ROUTE_AUDIT_EVALUATION.passedRoutes.length, latest.passed);
assert.deepEqual(
  DEMO_ROUTE_AUDIT_EVALUATION.failedRoutes,
  latest.results.filter((row) => !row.passed).map((row) => row.route),
);

const explicitFailure = structuredClone(latest);
const forcedFailureRow = explicitFailure.results.find((row) => row.passed);
assert.ok(forcedFailureRow);
forcedFailureRow.status = 503;
forcedFailureRow.passed = false;
forcedFailureRow.error = "deterministic test failure";
explicitFailure.passed -= 1;
explicitFailure.failed += 1;
const explicitFailureResult = evaluateDemoRouteAuditEvidence(
  explicitFailure,
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS,
);
assert.equal(explicitFailureResult.valid, true);
assert.deepEqual(explicitFailureResult.failedRoutes, [forcedFailureRow.route]);

const contradictory = structuredClone(latest);
const passingRow = contradictory.results.find((row) => row.passed);
assert.ok(passingRow);
passingRow.hasH1 = false;
const contradictoryResult = evaluateDemoRouteAuditEvidence(
  contradictory,
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS,
);
assert.equal(contradictoryResult.valid, false);
assert.ok(
  contradictoryResult.structuralIssues.some((issue) =>
    issue.includes("passed flag contradicts"),
  ),
);
assert.equal(contradictoryResult.passedRoutes.length, 0);

const duplicate = structuredClone(latest);
duplicate.results.push(structuredClone(duplicate.results[0]));
duplicate.expected += 1;
duplicate.passed += duplicate.results[0].passed ? 1 : 0;
const duplicateResult = evaluateDemoRouteAuditEvidence(
  duplicate,
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS,
);
assert.equal(duplicateResult.valid, false);
assert.ok(
  duplicateResult.structuralIssues.some((issue) =>
    issue.includes("exactly one is required"),
  ),
);

const wrongOrigin = structuredClone(latest);
const originRow = wrongOrigin.results.find((row) => row.passed);
assert.ok(originRow);
originRow.finalUrl = `https://example.com${originRow.samplePath}`;
const wrongOriginResult = evaluateDemoRouteAuditEvidence(
  wrongOrigin,
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS,
);
assert.equal(wrongOriginResult.valid, false);
assert.equal(wrongOriginResult.passedRoutes.length, 0);

console.log("Demo route-audit evidence tests passed");
