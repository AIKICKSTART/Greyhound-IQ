import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { MASTER_AUDIT_REQUIREMENTS } from "../src/components/master-audit-requirements";
import {
  ENDPOINTS,
  discoverRouteHandlers,
} from "./endpoints";
import {
  SECURITY_CI_GATE_ENFORCEMENT,
  SECURITY_CI_MASTER_EVIDENCE,
  VERIFIED_SECURITY_CI_GATE_IDS,
  findExpiredRiskAcceptanceIds,
  findMissingInventoryOperations,
  findRouteFilesWithoutOperation,
  findSecurityCiWiringIssues,
} from "./ci-gate-evidence";
import {
  loadSecurityFindings,
  validateSecurityFindings,
} from "./security-findings";

const repositoryRoot = process.cwd();
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const unitRunner = readFileSync("scripts/run-unit-tests.ts", "utf8");

assert.deepEqual(
  Object.keys(SECURITY_CI_GATE_ENFORCEMENT).toSorted(),
  [...VERIFIED_SECURITY_CI_GATE_IDS].toSorted(),
);
assert.deepEqual(
  Object.keys(SECURITY_CI_MASTER_EVIDENCE).toSorted(),
  [...VERIFIED_SECURITY_CI_GATE_IDS].toSorted(),
);
for (const id of VERIFIED_SECURITY_CI_GATE_IDS) {
  assert.equal(SECURITY_CI_MASTER_EVIDENCE[id].status, "verified");
  assert.ok(SECURITY_CI_MASTER_EVIDENCE[id].evidence.length > 0);
  for (const evidencePath of SECURITY_CI_MASTER_EVIDENCE[id].evidence) {
    assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
  }
}

const wiring = { workflow, packageJson, unitRunner };
assert.deepEqual(findSecurityCiWiringIssues(wiring), []);
assert.ok(
  findSecurityCiWiringIssues({
    ...wiring,
    workflow: workflow.replace(
      "git . --redact --no-banner",
      "detect . --redact --no-banner",
    ),
  }).includes("GITLEAKS_HISTORY_SCAN_MISSING"),
  "the evidence guard must reject removal of the Git-history secret scan",
);
assert.ok(
  findSecurityCiWiringIssues({
    ...wiring,
    workflow: workflow.replace(
      "npm run check:production-sql-safety",
      "npm run lint",
    ),
  }).includes("PRODUCTION_SQL_SAFETY_GATE_MISSING"),
  "the evidence guard must reject removal of the production SQL safety gate",
);
assert.ok(
  findSecurityCiWiringIssues({
    ...wiring,
    packageJson: packageJson.replace(
      '"check:production-sql-safety": "tsx scripts/check-production-sql-safety.ts"',
      '"check:production-sql-safety": "tsx scripts/no-op.ts"',
    ),
  }).includes("PRODUCTION_SQL_SAFETY_GATE_MISSING"),
  "the evidence guard must reject replacement of the production SQL policy",
);
assert.ok(
  findSecurityCiWiringIssues({
    ...wiring,
    workflow: workflow.replace(
      "npm run check:secret-boundaries -- --built",
      "npm run lint",
    ),
  }).includes("CLIENT_SECRET_BUNDLE_GATE_MISSING"),
  "the evidence guard must reject removal of the post-build client secret scan",
);
assert.ok(
  findSecurityCiWiringIssues({
    ...wiring,
    workflow: workflow.replace(
      "- run: npm run check:security-trace-registry",
      "- run: npm run lint",
    ),
  }).includes("SECURITY_ENDPOINT_DOCUMENTATION_GATE_MISSING"),
  "the evidence guard must reject removal of generated endpoint documentation validation",
);
assert.ok(
  findSecurityCiWiringIssues({
    ...wiring,
    packageJson: packageJson.replace(
      " && node infra/terraform/private-datastore-policy.test.mjs",
      "",
    ),
  }).includes("PRIVATE_DATASTORE_EXPOSURE_GATE_MISSING"),
  "the evidence guard must reject removal of the private datastore policy",
);
assert.ok(
  findSecurityCiWiringIssues({
    ...wiring,
    workflow: workflow.replace("- run: npm run test:unit", "- run: npm run lint"),
  }).includes("WORKFLOW_UNIT_GATE_MISSING"),
  "the evidence guard must reject removal of the unit-test gate",
);
assert.ok(
  findSecurityCiWiringIssues({
    ...wiring,
    unitRunner: unitRunner.replace(
      "const SKIP_FILES: string[] = [];",
      'const SKIP_FILES: string[] = ["security/registry.test.ts"];',
    ),
  }).includes("CRITICAL_TEST_SKIPPED"),
  "the evidence guard must reject a populated critical-test skip list",
);

const discoveredRoutes = discoverRouteHandlers(repositoryRoot);
const discoveredOperations = discoveredRoutes.map(
  (route) => `${route.method} ${route.route}`,
);
const inventoriedOperations = ENDPOINTS.filter(
  (endpoint) => endpoint.protocol === "http",
).map((endpoint) => `${endpoint.method} ${endpoint.routeOrProcedure}`);
assert.deepEqual(
  findMissingInventoryOperations(discoveredOperations, inventoriedOperations),
  [],
  "every discovered HTTP operation must be inventoried",
);
assert.ok(discoveredOperations.length > 0);
assert.deepEqual(
  findMissingInventoryOperations(
    discoveredOperations,
    inventoriedOperations.filter(
      (operation) => operation !== discoveredOperations[0],
    ),
  ),
  [discoveredOperations[0]],
  "the inventory check must fail closed when one operation is removed",
);

const routeFiles = walkFiles(path.join(repositoryRoot, "src", "app"))
  .filter((file) => path.basename(file) === "route.ts")
  .map((file) => repoPath(file));
const discoveredSourceFiles = discoveredRoutes.map((route) => route.sourceFile);
assert.deepEqual(
  findRouteFilesWithoutOperation(routeFiles, discoveredSourceFiles),
  [],
  "every route.ts file must expose a discovered HTTP operation",
);
assert.ok(discoveredSourceFiles.length > 0);
const removedSource = discoveredSourceFiles[0];
assert.deepEqual(
  findRouteFilesWithoutOperation(
    routeFiles,
    discoveredSourceFiles.filter((file) => file !== removedSource),
  ),
  [removedSource],
  "the route coverage check must fail closed when a route file loses discovery",
);

const findings = loadSecurityFindings(repositoryRoot);
assert.ok(findings.length > 0, "the high-finding registry must be non-vacuous");
assert.deepEqual(validateSecurityFindings(findings), []);
const ownerlessFindings = findings.map((finding, index) =>
  index === 0 ? { ...finding, owner: "" } : finding,
);
assert.ok(
  validateSecurityFindings(ownerlessFindings).includes(
    `${findings[0].findingId.replaceAll("`", "")}:owner`,
  ),
  "the finding validator must reject a high finding without an owner",
);

assert.deepEqual(
  findExpiredRiskAcceptanceIds(MASTER_AUDIT_REQUIREMENTS),
  [],
  "the merged security evidence must not contain an expired risk acceptance",
);
const expiredFixture = {
  id: "security.ci.test.expired-risk",
  status: "risk-accepted-temporarily",
  riskAcceptance: { expiresOn: "2000-01-01" },
};
assert.deepEqual(
  findExpiredRiskAcceptanceIds([expiredFixture], Date.parse("2026-01-01")),
  [expiredFixture.id],
  "the risk-acceptance check must fail closed on expiry",
);

console.log(
  `security CI gate evidence passed: ${VERIFIED_SECURITY_CI_GATE_IDS.length} exact gates`,
);

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(target) : [target];
  });
}

function repoPath(file: string) {
  return path.relative(repositoryRoot, file).replace(/\\/g, "/");
}
