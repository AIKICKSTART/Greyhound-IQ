import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE,
  DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH,
  findDesignLabHydratedStoryAuditIssues,
} from "../../scripts/audit-design-lab-hydrated-stories";
import {
  DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH,
  DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE,
  findDesignLabHydratedWave2AuditIssues,
} from "../../scripts/audit-design-lab-hydrated-wave2";
import {
  DESIGN_LAB_STORY_AUDIT_PATH,
  findDesignLabStoryAuditIssues,
} from "../../scripts/audit-design-lab-user-stories";
import {
  getDesignLabSourceFingerprint,
  getRepositoryHeadSha,
} from "../../scripts/design-lab-source-fingerprint";
import { PRODUCTION_SCREEN_INTERACTION_CONTRACTS } from "./screen-contracts/production-screen-coverage";
import {
  PRODUCT_DESIGN_LAB_EXISTING_ROUTE_SELECTOR_REQUIREMENT_IDS,
  PRODUCT_DESIGN_LAB_DELEGATED_SELECTOR_URL_REQUIREMENT_IDS,
  PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_EVIDENCE_FILE,
  PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_MASTER_EVIDENCE,
  PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_PROOFS,
  PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_REQUIREMENT_IDS,
  PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_SCOPE,
  PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_TEST_FILE,
} from "./product-design-lab-scenario-selector-evidence";
import {
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SELECTOR_IDS,
  PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_URL_IDS,
} from "./product-design-lab-scenario-simulator-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const repositoryRoot = path.resolve(".");
const selectorUrlRequirementIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  (requirement) =>
    requirement.section === "design-lab.selectors" ||
    requirement.section === "design-lab.url-state",
).map((requirement) => requirement.id);

assert.deepEqual(
  [
    ...PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_REQUIREMENT_IDS,
    ...PRODUCT_DESIGN_LAB_EXISTING_ROUTE_SELECTOR_REQUIREMENT_IDS,
    ...PRODUCT_DESIGN_LAB_DELEGATED_SELECTOR_URL_REQUIREMENT_IDS,
  ].toSorted(),
  selectorUrlRequirementIds.toSorted(),
  "Every selector and URL requirement must have exactly one truthful disposition",
);
assert.equal(
  new Set([
    ...PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_REQUIREMENT_IDS,
    ...PRODUCT_DESIGN_LAB_EXISTING_ROUTE_SELECTOR_REQUIREMENT_IDS,
    ...PRODUCT_DESIGN_LAB_DELEGATED_SELECTOR_URL_REQUIREMENT_IDS,
  ]).size,
  selectorUrlRequirementIds.length,
  "Selector and URL dispositions must not overlap",
);
assert.deepEqual(
  Object.keys(PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_MASTER_EVIDENCE).toSorted(),
  [...PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_REQUIREMENT_IDS].toSorted(),
);

for (const requirementId of PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_REQUIREMENT_IDS) {
  const record = PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", requirementId);
  assert.ok(record.evidence.includes(PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_EVIDENCE_FILE));
  assert.ok(record.evidence.includes(PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_TEST_FILE));
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

assert.match(PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_SCOPE, /companion scenario-simulator evidence owns and verifies/i);
assert.match(PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_SCOPE, /no open selector or URL gap/i);
assert.deepEqual(
  [...PRODUCT_DESIGN_LAB_DELEGATED_SELECTOR_URL_REQUIREMENT_IDS].toSorted(),
  [
    ...PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_SELECTOR_IDS,
    ...PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_URL_IDS,
  ].toSorted(),
);

const fingerprint = getDesignLabSourceFingerprint(repositoryRoot);
const headSha = getRepositoryHeadSha(repositoryRoot);
const httpBytes = readFileSync(DESIGN_LAB_STORY_AUDIT_PATH);
const httpReport = JSON.parse(httpBytes.toString("utf8")) as unknown;
const hydratedStoryReport = readJson(DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH);
const wave2Report = readJson(DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH);
const currentBinding = {
  headSha,
  sourceSha256: fingerprint.sha256,
  sourceFileCount: fingerprint.fileCount,
};
const companionHttpAuditSha256 = sha256(httpBytes);

assert.deepEqual(
  findDesignLabStoryAuditIssues(httpReport, currentBinding),
  [],
  "Canonical Design Lab HTTP evidence is stale or invalid",
);
assert.deepEqual(
  findDesignLabHydratedStoryAuditIssues(hydratedStoryReport, {
    ...currentBinding,
    companionHttpAuditSha256,
  }),
  [],
  "Hydrated product-area evidence is stale or invalid",
);
assert.deepEqual(
  findDesignLabHydratedWave2AuditIssues(wave2Report, {
    ...currentBinding,
    companionHttpAuditSha256,
  }),
  [],
  "Hydrated selector and URL evidence is stale or invalid",
);

const coverageByAudit = {
  "hydrated-stories": DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE,
  "hydrated-wave2": DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE,
} as const;
for (const proof of PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_PROOFS) {
  for (const scenario of proof.scenarios) {
    const matches = coverageByAudit[proof.audit].filter(
      (coverage) => coverage.scenarioId === scenario.id,
    );
    assert.equal(matches.length, 1, `${proof.key}/${scenario.id}`);
    assert.deepEqual(
      [...matches[0].actionIds],
      [...scenario.actionIds],
      `${proof.key}/${scenario.id}: action coverage changed`,
    );
  }
}

const appearanceContract = PRODUCTION_SCREEN_INTERACTION_CONTRACTS["/account/appearance"];
assert.deepEqual(appearanceContract.queryParameters, [
  "app",
  "dock",
  "market",
  "sponsored",
]);
assert.deepEqual(
  appearanceContract.actions.map((action) => action.id),
  [
    "ACCOUNT-APPEARANCE.ACTION.PREVIEW",
    "ACCOUNT-APPEARANCE.ACTION.APP-PREVIEW.OPEN",
    "ACCOUNT-APPEARANCE.ACTION.DOCK-PREVIEW.OPEN",
    "ACCOUNT-APPEARANCE.ACTION.MARKETPLACE-PREVIEW.OPEN",
  ],
);
assert.deepEqual(
  appearanceContract.forms.map((form) => [form.id, form.submitsTo]),
  [["ACCOUNT-APPEARANCE.FORM.PREVIEW", "GET /account/appearance"]],
);
const appearancePage = readFileSync(
  "src/app/account/appearance/page.tsx",
  "utf8",
);
for (const field of ["app", "dock", "market", "sponsored"]) {
  assert.match(appearancePage, new RegExp(`name=["']${field}["']`));
}
assert.match(appearancePage, /<form method="get"/);
assert.doesNotMatch(appearancePage, /sponsoredDemo/);

console.log(
  `Design Lab selector/URL evidence passed: ${PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_REQUIREMENT_IDS.length} local gates and ${PRODUCT_DESIGN_LAB_DELEGATED_SELECTOR_URL_REQUIREMENT_IDS.length} companion-owned gates with no declared gap`,
);

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
