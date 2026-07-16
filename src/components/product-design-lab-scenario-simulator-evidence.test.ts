import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH,
  findDesignLabHydratedStoryAuditIssues,
} from "../../scripts/audit-design-lab-hydrated-stories";
import { DESIGN_LAB_STORY_AUDIT_PATH } from "../../scripts/audit-design-lab-user-stories";
import {
  getDesignLabSourceChangesBetween,
  getDesignLabSourceFingerprint,
  getRepositoryHeadSha,
  isRepositoryCommitAncestor,
  parseDesignLabSourceFiles,
} from "../../scripts/design-lab-source-fingerprint";
import {
  DESIGN_LAB_SCENARIO_DIMENSIONS,
  DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES,
} from "./design-lab-scenario-contract";
import {
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_EVIDENCE_FILE,
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_MASTER_EVIDENCE,
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_REQUIREMENT_IDS,
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SAFETY_IDS,
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SCOPE,
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SELECTOR_IDS,
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_STATE_IDS,
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_TEST_FILE,
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_URL_IDS,
} from "./product-design-lab-scenario-simulator-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const repositoryRoot = path.resolve(".");
const allIds = [...PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_REQUIREMENT_IDS];
assert.equal(allIds.length, 63);
assert.equal(new Set(allIds).size, allIds.length);
assert.equal(PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SELECTOR_IDS.length, 17);
assert.equal(PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_URL_IDS.length, 12);
assert.equal(PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_STATE_IDS.length, 29);
assert.equal(PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SAFETY_IDS.length, 5);
assert.deepEqual(
  Object.keys(PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_MASTER_EVIDENCE),
  allIds,
);

const productIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map((requirement) => requirement.id),
);
for (const requirementId of allIds) {
  assert.ok(productIds.has(requirementId), requirementId);
  const evidence =
    PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.ok(
    evidence.evidence.includes(
      PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_EVIDENCE_FILE,
    ),
    requirementId,
  );
  assert.ok(
    evidence.evidence.includes(
      PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_TEST_FILE,
    ),
    requirementId,
  );
  for (const evidencePath of evidence.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

const declaredSimulatorStateValues =
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_STATE_IDS.map((requirementId) =>
    requirementId.replace("DL.STATE.", ""),
  );
assert.deepEqual(
  declaredSimulatorStateValues.toSorted(),
  DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES.filter((value) =>
    declaredSimulatorStateValues.includes(value),
  ).toSorted(),
);
assert.match(PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SCOPE, /client-only synthetic/i);
assert.match(PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SCOPE, /does not prove.*every production screen/i);

const dimensionByKey = new Map(
  DESIGN_LAB_SCENARIO_DIMENSIONS.map((dimension) => [
    dimension.key,
    dimension,
  ]),
);
assert.deepEqual(
  DESIGN_LAB_SCENARIO_DIMENSIONS.map((dimension) => dimension.queryParam),
  [
    "fixture",
    "tier",
    "auth",
    "permissions",
    "featureFlags",
    "orientation",
    "navigation",
    "theme",
    "sponsoredDemo",
    "state",
    "networkState",
    "errorState",
    "longContent",
    "missingImage",
    "tour",
    "tourStep",
    "reducedMotion",
    "highContrast",
  ],
);
assert.ok(
  dimensionByKey
    .get("networkState")!
    .options.some((option) => option.value === "slow"),
);

const fingerprint = getDesignLabSourceFingerprint(repositoryRoot);
const storyBytes = readFileSync(DESIGN_LAB_STORY_AUDIT_PATH);
const hydratedReport = JSON.parse(
  readFileSync(DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH, "utf8"),
) as unknown;
const headSha = getRepositoryHeadSha(repositoryRoot);
const testedCommitSha = readTestedCommitSha(hydratedReport);
const sourceFiles = parseDesignLabSourceFiles(hydratedReport);
assert.equal(
  isRepositoryCommitAncestor(repositoryRoot, testedCommitSha, headSha),
  true,
  "Hydrated story audit tested commit must be an ancestor of the current HEAD",
);
assert.ok(sourceFiles, "Hydrated story audit must carry a source-files manifest");
assert.deepEqual(
  getDesignLabSourceChangesBetween(
    repositoryRoot,
    testedCommitSha,
    headSha,
    sourceFiles,
  ),
  [],
  "Hydrated story audit fingerprinted source changed after its tested commit",
);
assert.deepEqual(
  findDesignLabHydratedStoryAuditIssues(hydratedReport, {
    headSha: testedCommitSha,
    sourceSha256: fingerprint.sha256,
    sourceFileCount: fingerprint.fileCount,
    companionHttpAuditSha256: createHash("sha256")
      .update(storyBytes)
      .digest("hex"),
  }),
  [],
  "Scenario simulator browser evidence is stale or invalid",
);

assert.ok(isRecord(hydratedReport));
const results = Array.isArray(hydratedReport.results)
  ? hydratedReport.results.filter(isRecord)
  : [];
const scenarioRows = results.filter(
  (result) =>
    result.id === "DL.INVENTORY.WORKSPACE.SCENARIO-CONTROLS.HYDRATED",
);
assert.equal(scenarioRows.length, 1);
assert.equal(scenarioRows[0].passed, true);
assert.deepEqual(scenarioRows[0].mutatingRequests, []);
assert.deepEqual(scenarioRows[0].failures, []);
assert.ok(isRecord(scenarioRows[0].observed));
assert.equal(scenarioRows[0].observed.controlCount, 18);
assert.deepEqual(
  scenarioRows[0].observed.dataStateCoverage,
  dimensionByKey.get("dataState")!.options.map((option) => option.value),
);
assert.deepEqual(
  scenarioRows[0].observed.errorStateCoverage,
  dimensionByKey.get("errorState")!.options.map((option) => option.value),
);
assert.deepEqual(scenarioRows[0].observed.networkStateCoverage, [
  "online",
  "offline",
  "slow",
]);

const componentSource = readFileSync(
  "src/components/design-lab-scenario-controls.tsx",
  "utf8",
);
assert.doesNotMatch(componentSource, /\bfetch\s*\(/);
assert.doesNotMatch(componentSource, /<form\b/i);
assert.match(componentSource, /Simulation complete\. No record, account or external system changed\./);
assert.match(componentSource, /never changes production identity/);

console.log(
  "Design Lab scenario simulator evidence passed: 63 gates across selectors, URL state, fixtures and safety.",
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTestedCommitSha(report: unknown) {
  assert.ok(isRecord(report));
  assert.match(
    typeof report.testedCommitSha === "string" ? report.testedCommitSha : "",
    /^[a-f0-9]{40}$/,
  );
  return report.testedCommitSha as string;
}
