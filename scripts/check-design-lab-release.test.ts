import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("scripts/check-design-lab-release.ts", "utf8");
const productVerificationGateEvidence = readFileSync(
  "src/components/product-verification-gate-evidence.ts",
  "utf8",
);

assert.match(source, /schemaVersion: 7/);
assert.match(source, /DESIGN_LAB_STORY_AUDIT_PATH/);
assert.match(source, /DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH/);
assert.match(source, /DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH/);
assert.match(source, /DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH/);
assert.match(source, /routeAuditEvidence/);
assert.match(source, /userStoryAuditEvidence/);
assert.match(source, /hydratedUserStoryAuditEvidence/);
assert.match(source, /hydratedWave2AuditEvidence/);
assert.match(source, /responsiveWorkspaceAuditEvidence/);
assert.match(source, /deliveryProgress: DESIGN_LAB_DELIVERY_PROGRESS/);
assert.match(source, /releaseEvidenceManifest/);
assert.match(source, /verifiedWorkstreams\.flatMap\(\(item\) => item\.evidence\)/);
assert.match(source, /resolveReleaseEvidenceReferences/);
assert.match(source, /createReleaseEvidenceManifest/);
assert.match(source, /findRepositoryFileIntegrityIssues/);
assert.match(source, /requireReleaseReadyEvidence: requireReady/);
assert.match(
  productVerificationGateEvidence,
  /output\/demo-route-audit\/design-lab-hydrated-stories\.json/,
);
assert.match(
  productVerificationGateEvidence,
  /output\/demo-route-audit\/design-lab-hydrated-wave2\.json/,
);
assert.doesNotMatch(
  productVerificationGateEvidence,
  /output\/design-lab-hydrated-stories\/latest\.json/,
);
assert.doesNotMatch(
  productVerificationGateEvidence,
  /output\/design-lab-hydrated-wave2\/latest\.json/,
);

console.log("Design Lab release evidence contract tests passed");
