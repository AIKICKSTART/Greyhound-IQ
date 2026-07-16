import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH,
  findDesignLabHydratedStoryAuditIssues,
} from "../../scripts/audit-design-lab-hydrated-stories";
import {
  DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH,
  findDesignLabHydratedWave2AuditIssues,
} from "../../scripts/audit-design-lab-hydrated-wave2";
import {
  DESIGN_LAB_STORY_AUDIT_PATH,
  findDesignLabStoryAuditIssues,
} from "../../scripts/audit-design-lab-user-stories";
import {
  fingerprintRepositoryFiles,
  getDesignLabSourceChangesBetween,
  getRepositoryHeadSha,
  isRepositoryCommitAncestor,
  parseDesignLabSourceFiles,
} from "../../scripts/design-lab-source-fingerprint";

import {
  PRODUCT_AUTOMATED_SOURCE_GATE_REQUIREMENT_IDS,
} from "./product-automated-source-gate-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import {
  DEMO_SCREEN_FAMILIES,
  DEMO_SCREEN_COUNT,
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACTS,
} from "./demo-experience-registry";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_VERIFICATION_GATE_EVIDENCE_FILE,
  PRODUCT_VERIFICATION_GATE_EVIDENCE_SCOPE,
  PRODUCT_VERIFICATION_GATE_EXPECTED_GAIN,
  PRODUCT_VERIFICATION_GATE_MASTER_EVIDENCE,
  PRODUCT_VERIFICATION_GATE_OPEN_GAPS,
  PRODUCT_VERIFICATION_GATE_OPEN_REQUIREMENT_IDS,
  PRODUCT_VERIFICATION_GATE_REQUIREMENT_IDS,
  PRODUCT_VERIFICATION_GATE_TEST_FILE,
} from "./product-verification-gate-evidence";
import { PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS } from "./screen-contracts/production-screen-admin-access-state-evidence";
import {
  PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
} from "./screen-contracts/production-screen-member-access-state-evidence";
import {
  PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS,
} from "./screen-contracts/production-screen-messaging-access-state-evidence";
import {
  DESIGN_LAB_ACCESS_SCENARIOS,
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS,
  PUBLIC_SCREEN_PERMISSION_CONTRACTS,
  SCREEN_PERMISSION_EVIDENCE_TEST,
} from "./screen-contracts/screen-permission-evidence";
import { resolveDesignLabAccessDecision } from "../lib/design-lab-access-policy";
import { isDemoReadMethod, isFullAccessDemo } from "../lib/demo-access";

const repositoryRoot = path.resolve(".");
const completedIds = [...PRODUCT_VERIFICATION_GATE_REQUIREMENT_IDS];
const intentionallyOpenIds = [
  ...PRODUCT_VERIFICATION_GATE_OPEN_REQUIREMENT_IDS,
];
const preExistingCompletedIds = [
  "VERIFY.GATE.lab-indexable",
  "VERIFY.GATE.overflow",
  "VERIFY.GATE.tour-target",
] as const;

assert.equal(completedIds.length, 11);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.equal(intentionallyOpenIds.length, 2);
assert.equal(PRODUCT_VERIFICATION_GATE_EXPECTED_GAIN, 11);
assert.deepEqual(
  Object.keys(PRODUCT_VERIFICATION_GATE_MASTER_EVIDENCE),
  completedIds,
);

const verificationRequirementIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  ({ id }) =>
    id.startsWith("VERIFY.GATE.") || id.startsWith("VERIFY.LEVEL."),
).map(({ id }) => id);
assert.equal(verificationRequirementIds.length, 18);
assert.deepEqual(
  [
    ...completedIds,
    ...PRODUCT_AUTOMATED_SOURCE_GATE_REQUIREMENT_IDS,
    ...intentionallyOpenIds,
    ...preExistingCompletedIds,
  ].toSorted(),
  verificationRequirementIds.toSorted(),
  "Every gate and test-level requirement must be newly tested, already tested, or preserved as an explicit gap",
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of completedIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  const evidence = PRODUCT_VERIFICATION_GATE_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(
    evidence.evidence.slice(0, 2),
    [
      PRODUCT_VERIFICATION_GATE_EVIDENCE_FILE,
      PRODUCT_VERIFICATION_GATE_TEST_FILE,
    ],
    requirementId,
  );
  assert.equal(
    new Set(evidence.evidence).size,
    evidence.evidence.length,
    `${requirementId} contains duplicate evidence paths`,
  );
  for (const evidencePath of evidence.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(
    PRODUCT_MASTER_EVIDENCE[requirementId],
    evidence,
    `${requirementId} must be wired into the product master evidence registry`,
  );
}

for (const requirementId of intentionallyOpenIds) {
  assert.equal(
    requirementId in PRODUCT_VERIFICATION_GATE_MASTER_EVIDENCE,
    false,
    `${requirementId} must remain open`,
  );
  assert.ok(
    PRODUCT_VERIFICATION_GATE_OPEN_GAPS[requirementId].length > 130,
    `${requirementId} needs a precise residual-gap explanation`,
  );
}
assert.match(PRODUCT_VERIFICATION_GATE_OPEN_GAPS["VERIFY.GATE.tour-keyboard"], /keyboard completion.*focus movement/i);

const evidenceSource = readFileSync(
  PRODUCT_VERIFICATION_GATE_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_VERIFICATION_GATE_EVIDENCE_SCOPE, /Deterministic source, focused-unit and source-fingerprint-bound loopback Chrome/i);
assert.match(PRODUCT_VERIFICATION_GATE_EVIDENCE_SCOPE, /representative HTTP plus hydrated Design Lab journeys/i);
assert.match(PRODUCT_VERIFICATION_GATE_EVIDENCE_SCOPE, /field-label gate rejects every reachable direct native field/i);
assert.match(PRODUCT_VERIFICATION_GATE_EVIDENCE_SCOPE, /does not prove the 22 exhaustive production journeys/i);
assert.match(PRODUCT_VERIFICATION_GATE_EVIDENCE_SCOPE, /deployed configuration or roles/i);
assert.match(PRODUCT_VERIFICATION_GATE_EVIDENCE_SCOPE, /production readiness/i);

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const unitRunnerSource = readFileSync("scripts/run-unit-tests.ts", "utf8");
const ciSource = readFileSync(".github/workflows/ci.yml", "utf8");
assert.equal(packageJson.scripts["test:unit"], "tsx scripts/run-unit-tests.ts");
assert.match(packageJson.scripts.ci, /npm run test:unit/);
assert.match(unitRunnerSource, /const SKIP_FILES: string\[\] = \[\]/);
assert.match(unitRunnerSource, /\["src", "scripts", "security"\]\.flatMap\(findTestFiles\)/);
assert.match(unitRunnerSource, /\/\\\.test\\\.tsx\?\$\/\.test\(entry\.name\)/);
assert.match(unitRunnerSource, /process\.argv\.includes\("--list"\)/);
assert.match(ciSource, /run: npm run test:unit/);

for (const testPath of PRODUCT_VERIFICATION_GATE_MASTER_EVIDENCE[
  "VERIFY.LEVEL.route"
].evidence.slice(2)) {
  assert.match(testPath, /src\/app\/.+\/route\.test\.ts$/);
  assert.match(readFileSync(testPath, "utf8"), /route\.ts|from ["'].+\/route["']/);
}

const storyBytes = readFileSync(DESIGN_LAB_STORY_AUDIT_PATH);
const storyAudit = JSON.parse(storyBytes.toString("utf8")) as unknown;
const storyBinding = sourceBinding(storyAudit);
assert.deepEqual(
  findDesignLabStoryAuditIssues(storyAudit, storyBinding),
  [],
  "HTTP user-story evidence must be exact, fresh and current-source-bound",
);
const companionHttpAuditSha256 = createHash("sha256")
  .update(storyBytes)
  .digest("hex");
const hydratedAudit = JSON.parse(
  readFileSync(DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH, "utf8"),
) as unknown;
const hydratedBinding = {
  ...sourceBinding(hydratedAudit),
  companionHttpAuditSha256,
};
assert.deepEqual(
  findDesignLabHydratedStoryAuditIssues(
    hydratedAudit,
    hydratedBinding,
  ),
  [],
  "Hydrated user-story evidence must be exact, fresh and current-source-bound",
);
const hydratedWave2Audit = JSON.parse(
  readFileSync(DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH, "utf8"),
) as unknown;
assert.deepEqual(
  findDesignLabHydratedWave2AuditIssues(
    hydratedWave2Audit,
    {
      ...sourceBinding(hydratedWave2Audit),
      companionHttpAuditSha256,
    },
  ),
  [],
  "Wave 2 hydrated evidence must be exact, fresh and current-source-bound",
);

function sourceBinding(audit: unknown) {
  assert.ok(audit && typeof audit === "object", "Audit must be a JSON object");
  const testedCommitSha = Reflect.get(audit, "testedCommitSha");
  assert.match(
    typeof testedCommitSha === "string" ? testedCommitSha : "",
    /^[a-f0-9]{40}$/,
    "Audit tested commit must be a Git SHA",
  );
  const sourceFiles = parseDesignLabSourceFiles(audit);
  assert.ok(sourceFiles, "Audit must declare a canonical source-file set");
  const currentHeadSha = getRepositoryHeadSha(repositoryRoot);
  assert.equal(
    isRepositoryCommitAncestor(repositoryRoot, testedCommitSha, currentHeadSha),
    true,
    "Audit tested commit must be an ancestor of the current HEAD",
  );
  assert.deepEqual(
    getDesignLabSourceChangesBetween(
      repositoryRoot,
      testedCommitSha,
      currentHeadSha,
      sourceFiles,
    ),
    [],
    "Audit source files must not change after the tested commit",
  );
  const fingerprint = fingerprintRepositoryFiles(repositoryRoot, sourceFiles);
  return {
    headSha: testedCommitSha,
    sourceSha256: fingerprint.sha256,
    sourceFileCount: fingerprint.fileCount,
  };
}
for (const testPath of PRODUCT_VERIFICATION_GATE_MASTER_EVIDENCE[
  "VERIFY.LEVEL.component"
].evidence.slice(2)) {
  assert.match(testPath, /src\/components\/.+\.test\.ts$/);
  assert.match(readFileSync(testPath, "utf8"), /assert\./);
}

const pageRoutes = findPageRoutes(path.join(repositoryRoot, "src/app"));
assert.equal(pageRoutes.length, DEMO_SCREEN_COUNT);
assert.deepEqual(
  SCREEN_CONTRACTS.map(({ route }) => route).toSorted(),
  pageRoutes.toSorted(),
  "Every local page route must have one canonical screen contract",
);
assert.equal(SCREEN_CONTRACT_BY_ROUTE.size, pageRoutes.length);

const screenMapSource = readFileSync(
  "src/components/demo-experience-screen-map.tsx",
  "utf8",
);
assert.match(screenMapSource, /DEMO_SCREEN_FAMILIES\.map\(\(family\)/);
assert.match(screenMapSource, /family\.screens\.map\(\(screen\)/);
assert.match(screenMapSource, /SCREEN_CONTRACT_BY_ROUTE\.get\(/);
assert.match(screenMapSource, /href=\{href\}/);

const fixtureIds = new Set<string>();
for (const screen of SCREEN_CONTRACTS) {
  assert.equal(SCREEN_CONTRACT_BY_ROUTE.get(screen.route), screen, screen.route);
  assert.deepEqual(
    screen.sourceFiles,
    [screen.route === "/" ? "src/app/page.tsx" : `src/app${screen.route}/page.tsx`],
    screen.route,
  );
  assert.equal(existsSync(screen.sourceFiles[0]), true, screen.sourceFiles[0]);
  assert.equal(screen.concreteRoute.startsWith("/"), true, screen.route);
  assert.equal(screen.concreteRoute.includes("["), false, screen.route);
  assert.equal(
    matchesRoutePattern(screen.route, screen.concreteRoute),
    true,
    `${screen.concreteRoute} must resolve the registered pattern ${screen.route}`,
  );
  assert.ok(screen.designLabFixtureIds.length > 0, screen.route);
  for (const fixtureId of screen.designLabFixtureIds) {
    assert.equal(fixtureIds.has(fixtureId), false, `${fixtureId} is duplicated`);
    fixtureIds.add(fixtureId);
  }
  if (!DEMO_SCREEN_FAMILIES.find(({ key }) => key === "design-lab")?.screens.some(
    ({ route }) => route === screen.route,
  )) {
    assert.deepEqual(screen.designLabFixtureIds, [`DL.DEFAULT:${screen.route}`]);
  }
}

const permissionContracts = [
  ...PUBLIC_SCREEN_PERMISSION_CONTRACTS,
  ...DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS,
  ...PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS,
  ...PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
  ...PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS,
];
const permissionContractByRoute = new Map(
  permissionContracts.map((contract) => [contract.route, contract] as const),
);
assert.equal(permissionContracts.length, DEMO_SCREEN_COUNT);
assert.equal(permissionContractByRoute.size, DEMO_SCREEN_COUNT);
assert.deepEqual(
  [...permissionContractByRoute.keys()].toSorted(),
  pageRoutes.toSorted(),
);

for (const screen of SCREEN_CONTRACTS) {
  assert.ok(["public", "optional", "required"].includes(screen.authentication), screen.route);
  assert.ok(screen.roles.length > 0, screen.route);
  assert.ok(screen.tiers.length > 0, screen.route);
  const contract = permissionContractByRoute.get(screen.route);
  assert.ok(contract, screen.route);
  assert.ok(contract.permissions.length > 0, screen.route);
  assert.deepEqual(screen.permissionRules, contract.permissions, screen.route);
  assert.equal(screen.coverage.permissions.status, "tested", screen.route);
}

const requiredScreens = SCREEN_CONTRACTS.filter(
  ({ authentication }) => authentication === "required",
);
for (const screen of requiredScreens) {
  assert.ok(
    screen.permissionRules.some(
      ({ actor, decision }) =>
        decision === "deny" && actor.toLowerCase().includes("signed-out"),
    ),
    `${screen.route} must deny a signed-out actor before protected data`,
  );
}

assert.equal(PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS.length, 6);
for (const contract of PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS) {
  assert.ok(
    contract.permissions.some(
      ({ actor, decision }) =>
        decision === "deny" && actor.toLowerCase().includes("signed-out"),
    ),
    contract.route,
  );
}
assert.equal(
  DESIGN_LAB_ACCESS_SCENARIOS.find(
    ({ id }) => id === "production-signed-out-flag-enabled",
  )?.finalDecision,
  "deny",
);

for (const test of [
  SCREEN_PERMISSION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST,
]) {
  const source = readFileSync(test.path, "utf8");
  assert.match(source, new RegExp(`screen-evidence-test-id: ${test.id}`));
}
const adminAccessTest =
  "src/components/screen-contracts/production-screen-admin-access-state-evidence.test.ts";
assert.match(
  readFileSync(adminAccessTest, "utf8"),
  /screen-evidence-test-id: PRODUCTION-SCREEN-ADMIN-ACCESS-STATE-EVIDENCE/,
);

assert.equal(
  isFullAccessDemo({ APP_ENV: "production", DEMO_AUTH_MODE: "full-access" }),
  false,
);
for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
  assert.equal(isDemoReadMethod(method), false, method);
}
for (const method of ["GET", "HEAD", "OPTIONS"]) {
  assert.equal(isDemoReadMethod(method), true, method);
}
assert.equal(
  resolveDesignLabAccessDecision({
    nodeEnv: "production",
    enabled: undefined,
    isolatedDemo: false,
  }),
  "deny",
);
assert.equal(
  resolveDesignLabAccessDecision({
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: true,
  }),
  "allow-isolated-demo",
);
assert.match(
  readFileSync("src/proxy.ts", "utf8"),
  /if \(demo && !isDemoReadMethod\(request\.method\)\) \{\s*return securedErrorResponse\(403, "demo\.read_only"/,
);

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_VERIFICATION_GATE_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly eight completed requirements",
);

console.log(
  "Product verification gate evidence passed: 11 deterministic/source-bound gates; 4 scoped gates remain open.",
);

function findPageRoutes(directory: string, segments: string[] = []): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "api") continue;
      routes.push(
        ...findPageRoutes(path.join(directory, entry.name), [
          ...segments,
          entry.name,
        ]),
      );
      continue;
    }
    if (entry.name === "page.tsx") {
      routes.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
    }
  }
  return routes;
}

function matchesRoutePattern(pattern: string, concreteRoute: string) {
  const patternSegments = pattern.split("/").filter(Boolean);
  const concreteSegments = concreteRoute.split("/").filter(Boolean);
  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    if (/^\[\[\.\.\.\w+\]\]$/.test(patternSegment)) return true;
    if (/^\[\.\.\.\w+\]$/.test(patternSegment)) {
      return concreteSegments.length > index;
    }
    const concreteSegment = concreteSegments[index];
    if (!concreteSegment) return false;
    if (/^\[\w+\]$/.test(patternSegment)) continue;
    if (patternSegment !== concreteSegment) return false;
  }
  return concreteSegments.length === patternSegments.length;
}
