import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertAuditExecution,
  assertAuditResult,
  assertCiSupplyChainPolicy,
  assertCycloneDxSbom,
  assertManifestLockPolicy,
  assertPackageScripts,
  assertSupplyChainReview,
  assertSupplyChainDependencyReview,
  assertWorkflowActionPins,
  collectLockComponentExpectations,
} from "./check-supply-chain-policy";

const integrity = (byte: number) =>
  `sha512-${Buffer.alloc(64, byte).toString("base64")}`;

const manifest = {
  name: "greyhoundiq",
  version: "0.1.0",
  scripts: {
    "check:supply-chain": "tsx scripts/check-supply-chain-policy.ts",
    ci: "npm run docs:check && npm run check:supply-chain && npm run build",
  },
  dependencies: { next: "16.2.10" },
  devDependencies: { typescript: "^5" },
};
const lockfile = {
  lockfileVersion: 3,
  packages: {
    "": {
      dependencies: { next: "16.2.10" },
      devDependencies: { typescript: "^5" },
    },
    "node_modules/next": {
      version: "16.2.10",
      resolved: "https://registry.npmjs.org/next/-/next-16.2.10.tgz",
      integrity: integrity(1),
    },
    "node_modules/typescript": {
      version: "5.9.3",
      resolved: "https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz",
      integrity: integrity(2),
    },
  },
};

assert.deepEqual(assertManifestLockPolicy(manifest, lockfile), {
  lockEntries: 2,
  directRuntimeDependencies: 1,
  directDevelopmentDependencies: 1,
  uniqueLockComponents: 2,
});
assert.doesNotThrow(() => assertPackageScripts(manifest));
assert.throws(
  () => assertPackageScripts({ ...manifest, scripts: { ci: "npm run build" } }),
  /canonical check:supply-chain/,
);

const repositoryManifest = JSON.parse(readFileSync("package.json", "utf8"));
const repositoryLockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
const dependencyReviewSnapshot = JSON.parse(
  readFileSync("security/supply-chain-review.snapshot.json", "utf8"),
);
assert.deepEqual(
  assertSupplyChainDependencyReview(
    repositoryManifest,
    repositoryLockfile,
    dependencyReviewSnapshot,
  ),
  {
    reviewedDirectDependencies: 41,
    reviewedLifecyclePackages: 8,
    duplicateLibraryFamilies: 76,
    deprecatedDevelopmentPackages: 3,
  },
);
assert.throws(
  () =>
    assertSupplyChainDependencyReview(
      { ...repositoryManifest, scarfSettings: { enabled: true } },
      repositoryLockfile,
      dependencyReviewSnapshot,
    ),
  /Scarf install analytics must be explicitly disabled/,
);
assert.throws(
  () =>
    assertSupplyChainDependencyReview(
      repositoryManifest,
      repositoryLockfile,
      { ...dependencyReviewSnapshot, lockReviewHash: "0".repeat(64) },
    ),
  /does not match package-lock/,
);
assert.throws(
  () =>
    assertPackageScripts({
      ...manifest,
      scripts: {
        "check:supply-chain": "tsx scripts/check-supply-chain-policy.ts",
        ci: "npm run build",
      },
    }),
  /ci must invoke/,
);

for (const specifier of [
  "git+https://example.test/a.git",
  "npm:other@1.0.0",
  "workspace:*",
]) {
  assert.throws(
    () =>
      assertManifestLockPolicy(
        { ...manifest, dependencies: { package: specifier } },
        {
          ...lockfile,
          packages: {
            ...lockfile.packages,
            "": {
              dependencies: { package: specifier },
              devDependencies: { typescript: "^5" },
            },
          },
        },
      ),
    /forbidden URL, Git, SSH, file, link, npm alias or workspace specifier/,
  );
}
assert.throws(
  () => assertManifestLockPolicy({ ...manifest, workspaces: ["packages/*"] }, lockfile),
  /workspaces are outside/,
);

const mutateLockEntry = (entry: Record<string, unknown>) => ({
  ...lockfile,
  packages: {
    ...lockfile.packages,
    "node_modules/next": entry,
  },
});
assert.throws(
  () =>
    assertManifestLockPolicy(
      manifest,
      mutateLockEntry({
        version: "16.2.10",
        resolved: "https://registry.npmjs.org.evil.test/next.tgz",
        integrity: integrity(1),
      }),
    ),
  /outside the approved npm registry/,
);
assert.throws(
  () =>
    assertManifestLockPolicy(
      manifest,
      mutateLockEntry({ version: "16.2.10", integrity: integrity(1) }),
    ),
  /no resolved package URL/,
);
assert.throws(
  () =>
    assertManifestLockPolicy(
      manifest,
      mutateLockEntry({
        version: "16.2.10",
        resolved: "https://registry.npmjs.org/next/-/next-16.2.10.tgz",
      }),
    ),
  /no SHA-512 integrity/,
);
assert.throws(
  () => assertManifestLockPolicy(manifest, mutateLockEntry({ link: true })),
  /local or workspace link/,
);

const digestA = "a".repeat(64);
const digestB = "b".repeat(64);
const digestC = "c".repeat(64);
const ciWorkflow = `jobs:
  docs:
    steps:
      - run: npm ci
      - run: npm run check:supply-chain
  gate:
    steps:
      - run: npm ci
      - name: Gitleaks
        run: >-
          docker run
          ghcr.io/gitleaks/gitleaks@sha256:${digestA}
      - name: Semgrep
        run: >-
          docker run
          semgrep/semgrep@sha256:${digestB}
      - name: Terraform
        run: >-
          docker run
          hashicorp/terraform@sha256:${digestC}
      - name: Supply chain
        run: npm run check:supply-chain
  build:
    steps:
      - run: npm run build`;
assert.doesNotThrow(() => assertCiSupplyChainPolicy(ciWorkflow));
assert.throws(
  () => assertCiSupplyChainPolicy(ciWorkflow.replace("        run: npm run check:supply-chain", "        # run: npm run check:supply-chain")),
  /exact check:supply-chain/,
);
assert.throws(
  () => assertCiSupplyChainPolicy(ciWorkflow.replace(digestA, "a")),
  /immutable tool image/,
);
assert.throws(
  () =>
    assertCiSupplyChainPolicy(
      ciWorkflow.replace(
        "      - run: npm ci\n      - name: Gitleaks",
        "      - run: npm install\n      - run: npm ci\n      - name: Gitleaks",
      ),
    ),
  /npm ci rather than npm install/,
);
const reversedCi = ciWorkflow.replace(
  "      - run: npm ci\n      - name: Gitleaks",
  "      - run: npm run check:supply-chain\n      - run: npm ci\n      - name: Gitleaks",
).replace(
  "      - name: Supply chain\n        run: npm run check:supply-chain",
  "      - name: Supply chain\n        run: npm run docs:check",
);
assert.throws(() => assertCiSupplyChainPolicy(reversedCi), /install before/);

const pinnedAction = "a".repeat(40);
assert.equal(
  assertWorkflowActionPins({
    "ci.yml": `steps:\n  - uses: actions/checkout@${pinnedAction} # v7\n  - "uses" : "actions/setup-node@${pinnedAction}" # v6\n  - uses: ./local-action`,
  }),
  2,
);
for (const mutableReference of [
  "actions/checkout@v7",
  "actions/checkout@main",
  "actions/checkout@abcdef0",
  "actions/checkout",
]) {
  assert.throws(
    () =>
      assertWorkflowActionPins({
        "ci.yml": `steps:\n  - uses: ${mutableReference}`,
      }),
    /full 40-hex commit SHA/,
  );
}
assert.throws(
  () =>
    assertWorkflowActionPins({
      "ci.yml": "steps:\n  - uses : actions/checkout@v7",
    }),
  /full 40-hex commit SHA/,
);
assert.throws(
  () =>
    assertWorkflowActionPins({
      "ci.yml": 'steps:\n  - "uses": actions/checkout@v7',
    }),
  /full 40-hex commit SHA/,
);
assert.throws(
  () =>
    assertWorkflowActionPins({
      "ci.yml": "steps:\n  - { uses: actions/checkout@v7 }",
    }),
  /unsupported inline action syntax/,
);
assert.throws(
  () =>
    assertWorkflowActionPins({
      "ci.yml": 'steps:\n  - "us\\u0065s": actions/checkout@v7',
    }),
  /full 40-hex commit SHA/,
);
assert.throws(
  () =>
    assertWorkflowActionPins({
      "ci.yml": "steps:\n  - ? uses\n    : actions/checkout@v7",
    }),
  /unsupported explicit action syntax/,
);
assert.throws(
  () =>
    assertWorkflowActionPins({
      "ci.yml": "steps:\n  - uses: >-\n      actions/checkout@v7",
    }),
  /one literal action reference/,
);
assert.doesNotThrow(() =>
  assertWorkflowActionPins({
    "ci.yml": "steps:\n  # - uses: actions/checkout@v7",
  }),
);

assert.doesNotThrow(() =>
  assertSupplyChainReview(
    [
      "A clean advisory scan is not proof that the application or supply chain is secure.",
      "Every third-party GitHub Action reference is pinned to an immutable full commit SHA.",
      "The container base image is selected by a mutable tag rather than an immutable digest.",
      "The policy runs after `npm ci`, so it cannot prevent lifecycle scripts from executing during that install.",
      "Required-status branch protection was not inspected, so workflow presence is not proof that the gate cannot be bypassed.",
      "The npm CLI version used for SBOM generation and advisory queries is not pinned by this policy.",
      "Every current lifecycle hook is allowlisted by package name, exact version and exact hook command.",
      "The dependency review snapshot is bound to the complete lockfile package inventory and expires after 31 days.",
      "GreyhoundIQ is one private npm package with no internal publishing path.",
      "Unused or build-only runtime dependencies remain removal debt; review completion does not claim they are necessary at runtime.",
    ].join("\n"),
  ),
);
assert.throws(() => assertSupplyChainReview("clean scan"), /missing required/);

const expectedComponents = collectLockComponentExpectations(lockfile);
const componentRecords = [...expectedComponents.entries()].map(
  ([bomRef, component]) => ({
    "bom-ref": bomRef,
    name: component.name,
    version: component.version,
    purl: component.purl,
    hashes: [{ alg: "SHA-512", content: component.integrityHex }],
    externalReferences: [
      { type: "distribution", url: component.resolved },
    ],
  }),
);
const dependencyRefs = [...expectedComponents.keys()];
const validSbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  metadata: {
    component: {
      name: manifest.name,
      version: manifest.version,
      "bom-ref": `${manifest.name}@${manifest.version}`,
      purl: `pkg:npm/${manifest.name}@${manifest.version}`,
    },
  },
  components: componentRecords,
  dependencies: [
    { ref: `${manifest.name}@${manifest.version}`, dependsOn: dependencyRefs },
    ...dependencyRefs.map((ref) => ({ ref, dependsOn: [] })),
  ],
};
assert.deepEqual(
  assertCycloneDxSbom(
    validSbom,
    { name: manifest.name, version: manifest.version },
    expectedComponents,
  ),
  { components: 2, dependencyNodes: 3 },
);
const missingComponentSbom = structuredClone(validSbom);
missingComponentSbom.components.pop();
assert.throws(
  () =>
    assertCycloneDxSbom(
      missingComponentSbom,
      { name: manifest.name, version: manifest.version },
      expectedComponents,
    ),
  /component count/,
);
const badGraphSbom = structuredClone(validSbom);
badGraphSbom.dependencies[0].dependsOn.push("unknown@1.0.0");
assert.throws(
  () =>
    assertCycloneDxSbom(
      badGraphSbom,
      { name: manifest.name, version: manifest.version },
      expectedComponents,
    ),
  /unknown target/,
);
const badHashSbom = structuredClone(validSbom);
badHashSbom.components[0].hashes[0].content = "0".repeat(128);
assert.throws(
  () =>
    assertCycloneDxSbom(
      badHashSbom,
      { name: manifest.name, version: manifest.version },
      expectedComponents,
    ),
  /matching SHA-512/,
);

const cleanAudit = {
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
      total: 0,
    },
  },
};
assert.deepEqual(assertAuditResult(cleanAudit), cleanAudit.metadata.vulnerabilities);
assert.deepEqual(
  assertAuditExecution(cleanAudit, 0),
  cleanAudit.metadata.vulnerabilities,
);
assert.throws(() => assertAuditExecution(cleanAudit, 1), /did not complete/);
assert.throws(
  () =>
    assertAuditResult({
      metadata: { vulnerabilities: { high: 0, critical: 0, total: 0 } },
    }),
  /missing or invalid/,
);
assert.throws(
  () =>
    assertAuditResult({
      metadata: {
        vulnerabilities: {
          info: 0,
          low: 0,
          moderate: 1,
          high: 0,
          critical: 0,
          total: 0,
        },
      },
    }),
  /total is inconsistent/,
);
assert.throws(
  () =>
    assertAuditResult({
      metadata: {
        vulnerabilities: {
          info: 0,
          low: 0,
          moderate: 0,
          high: 1,
          critical: 0,
          total: 1,
        },
      },
    }),
  /1 high or critical/,
);

console.log("supply-chain policy tests passed");
