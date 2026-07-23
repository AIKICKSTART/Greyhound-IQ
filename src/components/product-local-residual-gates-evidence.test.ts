import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  collectConfiguredServerSecrets,
  findClientBundleSecretLeaks,
  findSecretBoundarySourceIssues,
} from "../../scripts/check-secret-boundaries";
import {
  SECURITY_CI_GATE_ENFORCEMENT,
  SECURITY_CI_MASTER_EVIDENCE,
} from "../../security/ci-gate-evidence";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import {
  PRODUCT_LOCAL_RESIDUAL_GATE_IDS,
  PRODUCT_LOCAL_RESIDUAL_GATES_EVIDENCE_FILE,
  PRODUCT_LOCAL_RESIDUAL_GATES_EXPECTED_GAIN,
  PRODUCT_LOCAL_RESIDUAL_GATES_MASTER_EVIDENCE,
  PRODUCT_LOCAL_RESIDUAL_GATES_SCOPE,
  PRODUCT_LOCAL_RESIDUAL_GATES_TEST_FILE,
} from "./product-local-residual-gates-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-LOCAL-RESIDUAL-GATES

const EXPECTED_REQUIREMENTS = {
  "GLOBAL.SEC.client-secrets": "Keep production secrets out of client bundles.",
  "SYSTEM.unsupported-browser":
    "Provide an unsupported-browser experience only where genuinely necessary.",
} as const;

assert.deepEqual(PRODUCT_LOCAL_RESIDUAL_GATE_IDS, [
  "GLOBAL.SEC.client-secrets",
  "SYSTEM.unsupported-browser",
]);
assert.equal(PRODUCT_LOCAL_RESIDUAL_GATES_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_LOCAL_RESIDUAL_GATES_MASTER_EVIDENCE),
  [...PRODUCT_LOCAL_RESIDUAL_GATE_IDS],
);

for (const [requirementId, requirementText] of Object.entries(
  EXPECTED_REQUIREMENTS,
)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    ({ id }) => id === requirementId,
  );
  assert.ok(requirement, requirementId);
  assert.equal(requirement.requirement, requirementText);

  const record =
    PRODUCT_LOCAL_RESIDUAL_GATES_MASTER_EVIDENCE[
      requirementId as keyof typeof PRODUCT_LOCAL_RESIDUAL_GATES_MASTER_EVIDENCE
    ];
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_LOCAL_RESIDUAL_GATES_EVIDENCE_FILE,
    PRODUCT_LOCAL_RESIDUAL_GATES_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  record.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}
assert.equal(
  PRODUCT_LOCAL_RESIDUAL_GATES_MASTER_EVIDENCE[
    "GLOBAL.SEC.client-secrets"
  ].status,
  "tested",
);
assert.equal(
  PRODUCT_LOCAL_RESIDUAL_GATES_MASTER_EVIDENCE[
    "SYSTEM.unsupported-browser"
  ].status,
  "excluded",
);

const evidenceSource = readFileSync(
  PRODUCT_LOCAL_RESIDUAL_GATES_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_LOCAL_RESIDUAL_GATES_SCOPE, /current local build only/i);
assert.match(PRODUCT_LOCAL_RESIDUAL_GATES_SCOPE, /fails closed/i);
assert.match(PRODUCT_LOCAL_RESIDUAL_GATES_SCOPE, /does not claim compatibility/i);

const secretGateId = "security.ci.22.client-bundle-server-secret" as const;
assert.equal(SECURITY_CI_MASTER_EVIDENCE[secretGateId].status, "verified");
assert.match(
  SECURITY_CI_GATE_ENFORCEMENT[secretGateId].control,
  /every configured server-secret value.*\.next\/static/i,
);
assert.match(
  SECURITY_CI_GATE_ENFORCEMENT[secretGateId].failureMode,
  /exits non-zero/i,
);

const sourceIssues = findSecretBoundarySourceIssues({
  ciWorkflow: readFileSync(".github/workflows/ci.yml", "utf8"),
  deployWorkflow: readFileSync(
    ".github/workflows/cloud-run-deploy.yml",
    "utf8",
  ),
  packageJson: readFileSync("package.json", "utf8"),
  exampleEnvironment: readFileSync(".env.example", "utf8"),
});
assert.deepEqual(sourceIssues, []);

const syntheticSecret = "local-proof-secret-value";
const configured = collectConfiguredServerSecrets({
  NEXTAUTH_SECRET: syntheticSecret,
  NEXT_PUBLIC_APP_URL: syntheticSecret,
  STRIPE_SECRET_KEY: "your_stripe_secret_key",
});
assert.deepEqual(configured, [
  { identifier: "NEXTAUTH_SECRET", value: syntheticSecret },
]);

const temporaryBundle = mkdtempSync(
  join(tmpdir(), "greyhoundiq-product-secret-gate-"),
);
try {
  mkdirSync(join(temporaryBundle, "chunks"));
  writeFileSync(join(temporaryBundle, "chunks", "safe.js"), "public content");
  assert.deepEqual(
    findClientBundleSecretLeaks(temporaryBundle, configured),
    [],
  );

  writeFileSync(
    join(temporaryBundle, "chunks", "leak.js"),
    `window.__leak = ${JSON.stringify(encodeURIComponent(syntheticSecret))}`,
  );
  assert.deepEqual(
    findClientBundleSecretLeaks(temporaryBundle, configured).map(
      ({ identifier }) => identifier,
    ),
    ["NEXTAUTH_SECRET"],
  );
} finally {
  rmSync(temporaryBundle, { recursive: true, force: true });
}

assert.equal(existsSync(".next/static"), true, "A current local build is required");
assert.deepEqual(
  findClientBundleSecretLeaks(
    ".next/static",
    collectConfiguredServerSecrets(process.env),
  ),
  [],
  "Configured server-secret values must be absent from the current local client build",
);

assert.equal(
  SCREEN_CONTRACTS.some(({ route }) => /unsupported[-_/]?browser/i.test(route)),
  false,
  "An unsupported-browser route requires a reviewed replacement for this exclusion",
);

const compatibilityGatePatterns = [
  /navigator\.userAgent/,
  /\buserAgent\s*\(/,
  /unsupported[- ]browser/i,
  /browser (?:is )?not supported/i,
];
const compatibilityGates = runtimeFiles(["src/app", "src/components"])
  .filter(isCompatibilitySurface)
  .flatMap((path) => {
    const source = readFileSync(path, "utf8");
    return compatibilityGatePatterns.flatMap((pattern) =>
      pattern.test(source) ? [`${path}:${pattern.source}`] : [],
    );
  });
assert.deepEqual(
  compatibilityGates,
  [],
  "A browser-compatibility denial was introduced; review necessity and supply a real recovery experience",
);

console.log(
  "Local residual product gates passed: client secret leakage fails closed and unsupported-browser remains an explicit source-proven exclusion (+2 ready).",
);

function runtimeFiles(directories: readonly string[]): string[] {
  return directories.flatMap(walkFiles).filter((path) =>
    /\.[cm]?[jt]sx?$/.test(path),
  );
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name).replaceAll("\\", "/");
    return entry.isDirectory() ? walkFiles(child) : [child];
  });
}

function isCompatibilitySurface(path: string) {
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) return false;
  if (/src\/components\/(?:design-lab|master-audit|product-|security-master)/.test(path)) {
    return false;
  }
  return true;
}
