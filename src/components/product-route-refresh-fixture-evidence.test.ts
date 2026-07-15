import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  getDesignLabSourceFingerprint,
  getRepositoryHeadSha,
} from "../../scripts/design-lab-source-fingerprint";
import {
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS,
  SCREEN_CONTRACTS,
} from "./demo-experience-registry";
import {
  PRODUCT_ROUTE_REFRESH_FIXTURE_EVIDENCE_FILE,
  PRODUCT_ROUTE_REFRESH_FIXTURE_MASTER_EVIDENCE,
  PRODUCT_ROUTE_REFRESH_FIXTURE_REQUIREMENT_IDS,
  PRODUCT_ROUTE_REFRESH_FIXTURE_SCOPE,
  PRODUCT_ROUTE_REFRESH_FIXTURE_TEST_FILE,
} from "./product-route-refresh-fixture-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-ROUTE-REFRESH-FIXTURE

const expectedRequirements = {
  "GLOBAL.FUNC.dynamic-fixture":
    "Provide a valid representative fixture for every dynamic route.",
  "GLOBAL.FUNC.deep-refresh": "Make hard refresh work on deep routes.",
} as const;

assert.deepEqual(
  PRODUCT_ROUTE_REFRESH_FIXTURE_REQUIREMENT_IDS,
  Object.keys(expectedRequirements),
);
assert.deepEqual(
  Object.keys(PRODUCT_ROUTE_REFRESH_FIXTURE_MASTER_EVIDENCE),
  Object.keys(expectedRequirements),
);
for (const [id, text] of Object.entries(expectedRequirements)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(requirement, id);
  assert.equal(requirement.requirement, text);
  const evidence =
    PRODUCT_ROUTE_REFRESH_FIXTURE_MASTER_EVIDENCE[
      id as keyof typeof PRODUCT_ROUTE_REFRESH_FIXTURE_MASTER_EVIDENCE
    ];
  assert.equal(evidence.status, "tested", id);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_ROUTE_REFRESH_FIXTURE_EVIDENCE_FILE,
    PRODUCT_ROUTE_REFRESH_FIXTURE_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length, id);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

assert.match(PRODUCT_ROUTE_REFRESH_FIXTURE_SCOPE, /Source-fingerprint-bound/i);
assert.match(PRODUCT_ROUTE_REFRESH_FIXTURE_SCOPE, /requested directly/i);
assert.match(PRODUCT_ROUTE_REFRESH_FIXTURE_SCOPE, /does not prove authenticated production data/i);

const screens = SCREEN_CONTRACTS;
const dynamicScreens = screens.filter((screen) => screen.route.includes("["));
assert.ok(dynamicScreens.length > 0);
for (const screen of dynamicScreens) {
  assert.ok(screen.concreteRoute.startsWith("/"), screen.route);
  assert.equal(screen.concreteRoute.includes("["), false, screen.route);
  assert.equal(screen.concreteRoute.includes("]"), false, screen.route);
  assert.notEqual(screen.concreteRoute, screen.route, screen.route);
}

const expectedByRoute = new Map(
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS.map((row) => [row.route, row]),
);
assert.equal(expectedByRoute.size, screens.length);
for (const screen of screens) {
  const row = expectedByRoute.get(screen.route);
  assert.ok(row, screen.route);
  assert.equal(row.samplePath, screen.concreteRoute, screen.route);
}

type AuditRow = {
  route: string;
  samplePath: string;
  finalUrl: string;
  status: number | null;
  hasMain: boolean;
  hasH1: boolean;
  hasReactStreamError: boolean;
  errorMarkers: string[];
  passed: boolean;
  error: string | null;
};
type Audit = {
  schemaVersion: number;
  baseUrl: string;
  testedCommitSha: string;
  sourceSha256: string;
  sourceFileCount: number;
  expected: number;
  passed: number;
  failed: number;
  results: AuditRow[];
};

const audit = JSON.parse(
  readFileSync("output/demo-route-audit/latest.json", "utf8"),
) as Audit;
const fingerprint = getDesignLabSourceFingerprint(process.cwd());
assert.equal(audit.schemaVersion, 2);
assert.equal(audit.testedCommitSha, getRepositoryHeadSha(process.cwd()));
assert.equal(audit.sourceSha256, fingerprint.sha256);
assert.equal(audit.sourceFileCount, fingerprint.fileCount);
assert.equal(audit.expected, screens.length);
assert.equal(audit.passed, screens.length);
assert.equal(audit.failed, 0);
assert.equal(audit.results.length, screens.length);

for (const row of audit.results) {
  const expected = expectedByRoute.get(row.route);
  assert.ok(expected, row.route);
  assert.equal(row.samplePath, expected.samplePath, row.route);
  assert.equal(row.status, 200, row.route);
  assert.equal(row.hasMain, true, row.route);
  assert.equal(row.hasH1, true, row.route);
  assert.equal(row.hasReactStreamError, false, row.route);
  assert.deepEqual(row.errorMarkers, [], row.route);
  assert.equal(row.error, null, row.route);
  assert.equal(row.passed, true, row.route);
  const finalUrl = new URL(row.finalUrl);
  const baseUrl = new URL(audit.baseUrl);
  assert.equal(finalUrl.origin, baseUrl.origin, row.route);
  assert.equal(`${finalUrl.pathname}${finalUrl.search}`, row.samplePath, row.route);
}

const evidenceSource = readFileSync(
  PRODUCT_ROUTE_REFRESH_FIXTURE_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  `Route refresh and fixture evidence passed: ${dynamicScreens.length} dynamic fixtures and ${audit.passed}/${audit.expected} direct deep-route responses are bound to the current source.`,
);
