import assert from "node:assert/strict";

import {
  DESIGN_LAB_ADMIN_PLANES,
  DESIGN_LAB_ADMIN_PLANE_IDS,
  DESIGN_LAB_BREAK_GLASS,
  DESIGN_LAB_ENVIRONMENTS,
  DESIGN_LAB_ENVIRONMENT_IDS,
  DESIGN_LAB_FORBIDDEN_CROSS_PRODUCT_SHARING,
  DESIGN_LAB_MOBILE_CONTRACT,
  DESIGN_LAB_OPERATING_CAPABILITIES,
  DESIGN_LAB_OPERATING_CAPABILITY_IDS,
  DESIGN_LAB_OPERATING_MODEL_GATE_IDS,
  DESIGN_LAB_PRODUCT_BOUNDARIES,
  DESIGN_LAB_PRODUCT_BOUNDARY_IDS,
  DESIGN_LAB_RELEASE_AUTHORITY,
  DESIGN_LAB_SHARED_CROSS_PRODUCT_ARTIFACTS,
  DESIGN_LAB_TRAINING_VIDEO_STUDIO,
  findDesignLabOperatingModelIssues,
} from "./design-lab-operating-model";

assert.deepEqual(
  DESIGN_LAB_OPERATING_CAPABILITIES.map((item) => item.id),
  DESIGN_LAB_OPERATING_CAPABILITY_IDS,
);
assert.deepEqual(DESIGN_LAB_OPERATING_CAPABILITY_IDS, [
  "experience-simulation",
  "feature-proving",
  "training-video-studio",
  "preproduction-digital-twin",
  "production-operations-desk",
  "release-authority",
]);

assert.deepEqual(
  DESIGN_LAB_ENVIRONMENTS.map((item) => item.id),
  DESIGN_LAB_ENVIRONMENT_IDS,
);
assert.deepEqual(DESIGN_LAB_ENVIRONMENT_IDS, [
  "local",
  "protected-gcp-staging",
  "production",
]);
const local = DESIGN_LAB_ENVIRONMENTS.find((item) => item.id === "local");
const staging = DESIGN_LAB_ENVIRONMENTS.find(
  (item) => item.id === "protected-gcp-staging",
);
const production = DESIGN_LAB_ENVIRONMENTS.find(
  (item) => item.id === "production",
);
assert.equal(local?.proofAuthority, "simulation-only");
assert.equal(local?.realManagedServiceProof, false);
assert.match(local?.services.database ?? "", /not AlloyDB proof/);
assert.match(local?.services.apiGateway ?? "", /not Cloud Endpoints ESPv2 proof/);
assert.match(local?.services.edgeAndCdn ?? "", /not Cloud CDN or Cloud Armor proof/);
assert.equal(staging?.proofAuthority, "managed-service-parity");
assert.equal(staging?.realManagedServiceProof, true);
assert.match(staging?.dataBoundary ?? "", /no production customer dataset/i);
assert.ok(staging?.allowedEvidence.includes("Empty-database bootstrap and provider rehydration evidence"));
assert.match(staging?.services.database ?? "", /Real AlloyDB/);
assert.match(staging?.services.apiGateway ?? "", /ESPv2/);
assert.match(staging?.services.edgeAndCdn ?? "", /Cloud Armor/);
assert.equal(production?.writePolicy, "read-only-default");
assert.equal(production?.proofAuthority, "operational-observation-only");
assert.equal(production?.realManagedServiceProof, false);

assert.deepEqual(
  DESIGN_LAB_ADMIN_PLANES.map((item) => item.id),
  DESIGN_LAB_ADMIN_PLANE_IDS,
);
assert.deepEqual(DESIGN_LAB_ADMIN_PLANE_IDS, [
  "standard-staff-admin",
  "founder-platform-owner",
]);
for (const plane of DESIGN_LAB_ADMIN_PLANES) {
  assert.equal(plane.productionDefault, "read-only");
  assert.equal(plane.canSelfPromote, false);
  assert.equal(plane.controls.mfa, "phishing-resistant");
  assert.equal(plane.controls.justInTime, true);
  assert.equal(plane.controls.reauthentication, true);
  assert.equal(plane.controls.reasonRequired, true);
  assert.equal(plane.controls.auditRequired, true);
  assert.deepEqual(plane.twoPersonApprovalFor, ["destructive", "high-spend"]);
}
assert.equal(DESIGN_LAB_ADMIN_PLANES[0].roleManagement, "denied");
assert.equal(DESIGN_LAB_ADMIN_PLANES[1].roleManagement, "two-person-jit-only");
assert.equal(DESIGN_LAB_BREAK_GLASS.enabledByDefault, false);
assert.equal(DESIGN_LAB_BREAK_GLASS.maximumDurationMinutes, 60);
assert.equal(DESIGN_LAB_RELEASE_AUTHORITY.designLabCanApprove, false);

assert.deepEqual(
  DESIGN_LAB_TRAINING_VIDEO_STUDIO.captureManifestRequiredFields,
  [
    "captureId",
    "sourceSha",
    "candidateImageDigest",
    "route",
    "role",
    "fixtureId",
    "state",
    "viewport",
    "locale",
    "scriptPath",
    "frameManifestPath",
    "redactionReview",
    "capturedAt",
    "evidenceDigest",
  ],
);
assert.equal(DESIGN_LAB_TRAINING_VIDEO_STUDIO.renderer, "Remotion");
assert.equal(DESIGN_LAB_TRAINING_VIDEO_STUDIO.narrationProvider, "ElevenLabs");

assert.deepEqual(
  DESIGN_LAB_PRODUCT_BOUNDARIES.map((item) => item.id),
  DESIGN_LAB_PRODUCT_BOUNDARY_IDS,
);
assert.deepEqual(DESIGN_LAB_PRODUCT_BOUNDARY_IDS, [
  "web",
  "ios-ipados",
  "android",
  "shared-backend",
]);
const nativeBoundaries = DESIGN_LAB_PRODUCT_BOUNDARIES.filter(
  (item) => item.clientKind === "native",
);
assert.equal(nativeBoundaries.length, 2);
assert.ok(
  nativeBoundaries.every(
    (item) =>
      !item.implementationAllowedInThisRepository &&
      item.sourceBoundary.includes("Separate native-client repository"),
  ),
);
assert.deepEqual(DESIGN_LAB_SHARED_CROSS_PRODUCT_ARTIFACTS, [
  "OpenAPI contract",
  "Generated request and response models",
  "Synthetic fixtures",
  "Authentication conventions",
  "Error contract",
  "Telemetry conventions",
  "Client and API compatibility matrix",
]);
assert.deepEqual(DESIGN_LAB_FORBIDDEN_CROSS_PRODUCT_SHARING, [
  "Web or native UI implementation",
  "Native application source",
  "Signing credentials",
  "Store release credentials",
]);

assert.deepEqual(DESIGN_LAB_MOBILE_CONTRACT.platforms, [
  "ios",
  "ipados",
  "android-phone",
  "android-tablet",
]);
assert.equal(DESIGN_LAB_MOBILE_CONTRACT.deliveryPhase, "post-mvp");
assert.equal(DESIGN_LAB_MOBILE_CONTRACT.webMvpReleaseBlocking, false);
assert.equal(DESIGN_LAB_MOBILE_CONTRACT.deferralDecisionDate, "2026-07-15");
assert.equal(
  DESIGN_LAB_MOBILE_CONTRACT.authentication.protocol,
  "OIDC authorization code with PKCE",
);
assert.equal(DESIGN_LAB_MOBILE_CONTRACT.authentication.userAgent, "system browser");
assert.deepEqual(DESIGN_LAB_MOBILE_CONTRACT.notifications.providers, ["APNs", "FCM"]);
assert.equal(
  DESIGN_LAB_MOBILE_CONTRACT.storePolicyVerification,
  "pending-official-documentation-review",
);
assert.equal(DESIGN_LAB_MOBILE_CONTRACT.architectureDecision.status, "undecided");
assert.equal(DESIGN_LAB_MOBILE_CONTRACT.externalMutationAllowed, false);

const declaredGateIds = Object.values(DESIGN_LAB_OPERATING_MODEL_GATE_IDS).toSorted();
const capabilityGateIds = [
  ...new Set(DESIGN_LAB_OPERATING_CAPABILITIES.flatMap((item) => item.gateIds)),
].toSorted();
assert.equal(declaredGateIds.length, 13);
assert.deepEqual(capabilityGateIds, declaredGateIds);
assert.deepEqual(findDesignLabOperatingModelIssues(), []);

console.log("Design Lab operating-model tests passed");
