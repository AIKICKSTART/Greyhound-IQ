import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DESIGN_LAB_OPERATING_MODEL_GATE_IDS } from "./design-lab-operating-model";
import { DESIGN_LAB_PREPRODUCTION_REQUIREMENTS } from "./design-lab-preproduction-requirements";

type Digest = { path: string; sha256: string; bytes: number };

type MobileFoundationEvidence = {
  schemaVersion: number;
  generatedAt: string;
  product: string;
  repository: string;
  sourceEvidence: { path: string; sha256: string };
  revision: string;
  branch: string;
  dirty: boolean;
  repositoryRemoteConfigured: boolean;
  evidenceStatus: {
    status: string;
    gateVerified: boolean;
    conditions: string[];
    claim: string;
  };
  ciAttestation: { status: string; provider: string; revision: string | null };
  sourceSha256: string;
  sourceFileCount: number;
  sourceManifest: { algorithm: string; entries?: unknown };
  lockfile: Digest & { normalization: string };
  clientTargets: string[];
  bundleTargetsVerified: string[];
  buildArtifacts: {
    algorithm: string;
    exportSha256: string;
    exportFileCount: number;
    exportBytes: number;
    platforms: Record<"ios" | "android" | "web", Digest>;
  };
  verification: {
    boundary: { status: string; checks: number };
    typecheck: string;
    lint: string;
    unitTests: { status: string; commands: string[] };
    expoDoctor: { status: string };
    bundles: { status: string; artifactsBoundByDigest: boolean };
    dependencyAudit: { status: string };
  };
  boundary: {
    mobileRepositorySourcePolicy: string;
    signingSeparationPolicy: string;
    deploymentSeparationPolicy: string;
    webRepositoryIsolation: string;
    sharedBackendConsumption: string;
    credentiallessCiWorkflow: string;
    forbiddenArtifactCheck: string;
    releaseBoundaryPolicy: string;
    architectureDecision: string;
  };
  promotionEvidencePending: string[];
  externalEvidencePending: string[];
};

const evidence = JSON.parse(
  readFileSync(resolve("config/mobile-foundation-evidence.json"), "utf8"),
) as MobileFoundationEvidence;
const expectedConditions = [
  "independent-web-repository-boundary-attestation-missing",
  "protected-mobile-release-environment-attestation-missing",
  "worktree-is-dirty",
  "remote-ci-attestation-missing",
];
const expectedPromotionEvidence = [
  "clean committed and pushed mobile source candidate",
  "remote GitHub Actions run for the exact revision and source digest",
  "independent web repository source and deployment boundary attestation",
  "protected mobile release environment and signing-isolation attestation",
];
const expectedExternalEvidence = [
  "protected-staging mobile auth and notification providers",
  "TestFlight and Google Play internal tracks",
  "real iPhone, iPad, Android phone and Android tablet evidence",
];

assert.equal(evidence.schemaVersion, 2);
assert.match(evidence.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(evidence.product, "GreyhoundIQ Mobile");
assert.equal(evidence.repository, "greyhoundiq-mobile");
assert.equal(
  evidence.sourceEvidence.path,
  "docs/evidence/mobile-foundation-latest.json",
);
assert.match(evidence.sourceEvidence.sha256, /^[0-9a-f]{64}$/);
assert.match(evidence.revision, /^[0-9a-f]{40}$/);
assert.ok(evidence.branch.length > 0);
assert.equal(evidence.dirty, true);
assert.equal(evidence.repositoryRemoteConfigured, false);
assert.equal(evidence.evidenceStatus.status, "conditional");
assert.equal(evidence.evidenceStatus.gateVerified, false);
assert.deepEqual(evidence.evidenceStatus.conditions, expectedConditions);
assert.match(evidence.evidenceStatus.claim, /does not|requires|only/i);
assert.equal(evidence.ciAttestation.status, "missing");
assert.equal(evidence.ciAttestation.provider, "github-actions");
assert.equal(evidence.ciAttestation.revision, null);
assert.match(evidence.sourceSha256, /^[0-9a-f]{64}$/);
assert.ok(evidence.sourceFileCount > 0);
assert.equal(evidence.sourceManifest.algorithm, "sha256-portable-manifest-v2");
assert.equal(evidence.sourceManifest.entries, undefined);
assert.equal(evidence.lockfile.path, "package-lock.json");
assert.match(evidence.lockfile.sha256, /^[0-9a-f]{64}$/);
assert.ok(evidence.lockfile.bytes > 0);
assert.equal(evidence.lockfile.normalization, "utf8-lf");
assert.deepEqual(evidence.clientTargets, [
  "ios",
  "ipados",
  "android-phone",
  "android-tablet",
]);
assert.deepEqual(evidence.bundleTargetsVerified, ["ios", "android", "web"]);
assert.equal(
  evidence.buildArtifacts.algorithm,
  "sha256-raw-artifact-manifest-v1",
);
assert.match(evidence.buildArtifacts.exportSha256, /^[0-9a-f]{64}$/);
assert.ok(evidence.buildArtifacts.exportFileCount > 0);
assert.ok(evidence.buildArtifacts.exportBytes > 0);
for (const platform of ["ios", "android", "web"] as const) {
  const artifact = evidence.buildArtifacts.platforms[platform];
  assert.match(artifact.path, new RegExp(`/js/${platform}/`));
  assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
  assert.ok(artifact.bytes > 0);
}
assert.equal(evidence.verification.boundary.status, "passed-source-policy");
assert.ok(evidence.verification.boundary.checks > 0);
assert.equal(evidence.verification.typecheck, "passed");
assert.equal(evidence.verification.lint, "passed");
assert.equal(evidence.verification.unitTests.status, "passed");
assert.deepEqual(evidence.verification.unitTests.commands, [
  "npm test",
  "npm run test:contracts",
]);
assert.equal(evidence.verification.expoDoctor.status, "passed");
assert.equal(evidence.verification.bundles.status, "passed");
assert.equal(evidence.verification.bundles.artifactsBoundByDigest, true);
assert.equal(
  evidence.verification.dependencyAudit.status,
  "passed-at-high-threshold",
);
assert.equal(
  evidence.boundary.mobileRepositorySourcePolicy,
  "passed-source-policy",
);
assert.equal(evidence.boundary.signingSeparationPolicy, "passed-source-policy");
assert.equal(
  evidence.boundary.deploymentSeparationPolicy,
  "passed-source-policy",
);
assert.equal(
  evidence.boundary.webRepositoryIsolation,
  "not-attested-by-mobile-repository",
);
assert.equal(
  evidence.boundary.sharedBackendConsumption,
  "published-api-contracts-only",
);
assert.equal(evidence.boundary.credentiallessCiWorkflow, ".github/workflows/ci.yml");
assert.equal(
  evidence.boundary.forbiddenArtifactCheck,
  "scripts/check-mobile-boundary.mjs",
);
assert.equal(
  evidence.boundary.releaseBoundaryPolicy,
  "docs/architecture/mobile-release-boundary-policy.json",
);
assert.equal(
  evidence.boundary.architectureDecision,
  "docs/architecture/mobile-adr.md",
);
assert.deepEqual(evidence.promotionEvidencePending, expectedPromotionEvidence);
assert.deepEqual(evidence.externalEvidencePending, expectedExternalEvidence);

const gate = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.find(
  (requirement) =>
    requirement.id === DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileBoundary,
);
assert.ok(gate);
assert.equal(gate.status, "partially-verified");
assert.equal(gate.releaseBlocking, false);
assert.deepEqual(gate.evidence, [
  "config/mobile-foundation-evidence.json",
  "src/components/design-lab-web-mobile-boundary.test.ts",
]);
assert.deepEqual(gate.tests, [
  "src/components/design-lab-mobile-foundation-evidence.test.ts",
  "src/components/design-lab-web-mobile-boundary.test.ts",
]);
assert.deepEqual(gate.operatorCommands, [
  "npm run check:mobile-foundation-evidence",
]);
assert.match(gate.remainingEvidence, /clean.*commit/i);
assert.match(gate.remainingEvidence, /remote.*CI/i);
assert.match(gate.remainingEvidence, /signing/i);

console.log("Design Lab conditional mobile foundation evidence passed");
