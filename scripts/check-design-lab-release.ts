import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DESIGN_LAB_RELEASE_GATE } from "../src/components/design-lab-release-gate";
import { SCREEN_CONTRACTS } from "../src/components/demo-experience-registry";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  isDesignLabPreproductionRequirementComplete,
} from "../src/components/design-lab-preproduction-requirements";
import { DESIGN_LAB_DELIVERY_PROGRESS } from "../src/components/design-lab-delivery-progress";
import { isDesignLabDatabaseOperationComplete } from "../src/components/design-lab-database-contracts";
import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  collectDesignLabSyncIssues,
  findRepositoryFileIntegrityIssues,
} from "./check-design-lab-sync";
import { DESIGN_LAB_STORY_AUDIT_PATH } from "./audit-design-lab-user-stories";
import { DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH } from "./audit-design-lab-hydrated-stories";
import { DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH } from "./audit-design-lab-hydrated-wave2";
import { DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH } from "./audit-design-lab-responsive-workspace";
import {
  createReleaseEvidenceManifest,
  resolveReleaseEvidenceReferences,
} from "./design-lab-release-evidence";

const requireReady = process.argv.includes("--require-ready");
const repositoryRoot = resolve(__dirname, "..");
const syncIssues = collectDesignLabSyncIssues({
  repoRoot: repositoryRoot,
  requireReleaseReadyEvidence: requireReady,
});
if (syncIssues.length > 0) {
  console.error(
    `Production promotion denied: Design Lab sync audit failed (${syncIssues.length} issue${syncIssues.length === 1 ? "" : "s"}).`
  );
  syncIssues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

const routeAuditEvidence = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, "output/demo-route-audit/latest.json"),
    "utf8"
  )
);
const userStoryAuditEvidence = JSON.parse(
  readFileSync(resolve(repositoryRoot, DESIGN_LAB_STORY_AUDIT_PATH), "utf8")
);
const hydratedUserStoryAuditEvidence = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH),
    "utf8"
  )
);
const hydratedWave2AuditEvidence = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH),
    "utf8"
  )
);
const responsiveWorkspaceAuditEvidence = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH),
    "utf8"
  )
);
const releaseEvidencePaths = collectCompletedReleaseEvidencePaths(repositoryRoot);
if (requireReady) {
  const integrityIssues = findRepositoryFileIntegrityIssues(
    repositoryRoot,
    "Completed release evidence",
    releaseEvidencePaths
  );
  if (integrityIssues.length > 0) {
    console.error(
      `Production promotion denied: completed evidence integrity failed (${integrityIssues.length} issue${integrityIssues.length === 1 ? "" : "s"}).`
    );
    integrityIssues.forEach((issue) => console.error(`- ${issue}`));
    process.exit(1);
  }
}
const releaseEvidenceManifest = createReleaseEvidenceManifest(
  repositoryRoot,
  releaseEvidencePaths
);

const printEvidenceSha256 = process.argv.includes("--print-evidence-sha256");
const expectedEvidenceSha256 = process.argv
  .find((argument) => argument.startsWith("--expected-evidence-sha256="))
  ?.split("=", 2)[1]
  ?.toLowerCase();
const evidenceSha256 = createHash("sha256")
  .update(
    JSON.stringify({
      schemaVersion: 7,
      releaseGate: DESIGN_LAB_RELEASE_GATE,
      screens: SCREEN_CONTRACTS.map((screen) => ({
        id: screen.id,
        route: screen.route,
        coverage: screen.coverage,
      })),
      masterRequirements: MASTER_AUDIT_REQUIREMENTS,
      preproductionRequirements: DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
      databaseOperations: DATABASE_OPERATIONS,
      routeAuditEvidence,
      userStoryAuditEvidence,
      hydratedUserStoryAuditEvidence,
      hydratedWave2AuditEvidence,
      responsiveWorkspaceAuditEvidence,
      deliveryProgress: DESIGN_LAB_DELIVERY_PROGRESS,
      releaseEvidenceManifest,
    })
  )
  .digest("hex");

if (printEvidenceSha256) {
  console.log(evidenceSha256);
  if (!requireReady) process.exit(0);
}

console.log(
  `Design Lab release evidence: ${DESIGN_LAB_RELEASE_GATE.completedChecks}/${DESIGN_LAB_RELEASE_GATE.totalChecks} checks complete.`
);

if (DESIGN_LAB_RELEASE_GATE.status === "ready-for-approval") {
  if (
    expectedEvidenceSha256 &&
    expectedEvidenceSha256 !== evidenceSha256
  ) {
    console.error(
      "Production promotion denied: approved evidence digest does not match this commit."
    );
    process.exit(1);
  }
  console.log(
    "Design Lab evidence is complete. Production still requires an authorised GitHub environment approval for the exact tested commit."
  );
  process.exit(0);
}

for (const blocker of DESIGN_LAB_RELEASE_GATE.blockers) {
  console.log(
    `- ${blocker.area}: ${blocker.remaining} incomplete (${blocker.blocked} explicitly blocked)`
  );
}
for (const blocker of DESIGN_LAB_RELEASE_GATE.masterBlockers) {
  console.log(`- ${blocker.prompt} master prompt: ${blocker.remaining} incomplete`);
}
for (const blocker of DESIGN_LAB_RELEASE_GATE.preproductionBlockers) {
  console.log(
    `- ${blocker.system} pre-production lane: ${blocker.remaining} incomplete (${blocker.blocked} explicitly blocked)`
  );
}
if (DESIGN_LAB_RELEASE_GATE.databaseBlocker) {
  console.log(
    `- database query contracts: ${DESIGN_LAB_RELEASE_GATE.databaseBlocker.remaining}/${DESIGN_LAB_RELEASE_GATE.databaseBlocker.total} incomplete`
  );
}

if (requireReady) {
  console.error(
    "Production promotion denied: the Design Lab product contract is not complete."
  );
  process.exit(1);
}

console.log("Design Lab production promotion remains safely blocked.");

function collectCompletedReleaseEvidencePaths(repoRoot: string) {
  const completeMasterRequirements = MASTER_AUDIT_REQUIREMENTS.filter(
    isMasterRequirementComplete
  );
  const completeScreenCoverage = SCREEN_CONTRACTS.flatMap((screen) =>
    Object.values(screen.coverage).filter((coverage) =>
      ["verified", "tested", "excluded"].includes(coverage.status)
    )
  );
  const completePreproductionRequirements =
    DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
      isDesignLabPreproductionRequirementComplete
    );
  const completeDatabaseOperations = DATABASE_OPERATIONS.filter(
    isDesignLabDatabaseOperationComplete
  );
  const verifiedWorkstreams = DESIGN_LAB_DELIVERY_PROGRESS.filter(
    (item) => item.status === "verified"
  );

  assertCompletedAuthoritiesHaveEvidence("master requirement", completeMasterRequirements);
  assertCompletedAuthoritiesHaveEvidence("screen coverage", completeScreenCoverage);
  assertCompletedAuthoritiesHaveEvidence(
    "pre-production requirement",
    completePreproductionRequirements,
    (requirement) => [...requirement.evidence, ...requirement.tests]
  );
  assertCompletedAuthoritiesHaveEvidence(
    "database operation",
    completeDatabaseOperations,
    (operation) => operation.tests
  );
  assertCompletedAuthoritiesHaveEvidence("verified workstream", verifiedWorkstreams);

  const references = [
    "output/demo-route-audit/latest.json",
    DESIGN_LAB_STORY_AUDIT_PATH,
    DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH,
    DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH,
    "src/components/design-lab-delivery-progress.ts",
    ...completeMasterRequirements.flatMap((requirement) => requirement.evidence),
    ...completeScreenCoverage.flatMap((coverage) => coverage.evidence),
    ...completePreproductionRequirements.flatMap((requirement) => [
      ...requirement.evidence,
      ...requirement.tests,
    ]),
    ...completeDatabaseOperations.flatMap((operation) => operation.tests),
    ...verifiedWorkstreams.flatMap((item) => item.evidence),
  ];
  return resolveReleaseEvidenceReferences(repoRoot, references);
}

function assertCompletedAuthoritiesHaveEvidence<T extends { evidence?: readonly string[] }>(
  label: string,
  authorities: readonly T[],
  getEvidence: (authority: T) => readonly string[] = (authority) =>
    authority.evidence ?? []
) {
  if (authorities.some((authority) => getEvidence(authority).length === 0)) {
    throw new Error(`Every completed ${label} must reference durable evidence.`);
  }
}
