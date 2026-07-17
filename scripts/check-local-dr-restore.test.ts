import assert from "node:assert/strict";

import {
  assertLocalDrEnvironment,
  evaluateLocalDrValidation,
  LOCAL_DR_CONTAINER,
  LOCAL_DR_PORT,
  LOCAL_DR_SCOPE,
  parseLocalDrContainerInspect,
  type LocalDrMetrics,
} from "./check-local-dr-restore";
import {
  DESIGN_LAB_DATABASE_IMAGE_ID,
  DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
} from "./design-lab-database";

assert.doesNotThrow(() => assertLocalDrEnvironment({}));
assert.doesNotThrow(() =>
  assertLocalDrEnvironment({ LOCAL_DR_PORT: String(LOCAL_DR_PORT) }),
);
assert.throws(() => assertLocalDrEnvironment({ LOCAL_DR_PORT: "55735" }));
assert.throws(() =>
  assertLocalDrEnvironment({ DOCKER_HOST: "tcp://example.test:2375" }),
);
assert.throws(() =>
  assertLocalDrEnvironment({ DOCKER_CONTEXT: "remote-production" }),
);
assert.equal(LOCAL_DR_SCOPE.managedCloudEligible, false);
assert.equal(LOCAL_DR_SCOPE.satisfiesManagedDisasterRecoveryGate, false);

const validInspect = {
  Id: "a".repeat(64),
  Image: DESIGN_LAB_DATABASE_IMAGE_ID,
  Name: `/${LOCAL_DR_CONTAINER}`,
  State: { Running: true },
  Config: {
    Image: DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
    Labels: { "com.greyhoundiq.owner": "local-dr-proof" },
  },
  HostConfig: {
    PortBindings: {
      "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: String(LOCAL_DR_PORT) }],
    },
  },
  NetworkSettings: {
    Ports: {
      "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: String(LOCAL_DR_PORT) }],
    },
  },
};

assert.deepEqual(parseLocalDrContainerInspect(JSON.stringify([validInspect])), {
  containerId: "a".repeat(64),
  imageId: DESIGN_LAB_DATABASE_IMAGE_ID,
  imageReference: DESIGN_LAB_DATABASE_IMAGE_REFERENCE,
  name: LOCAL_DR_CONTAINER,
  running: true,
  hostIp: "127.0.0.1",
  hostPort: LOCAL_DR_PORT,
});

for (const mutate of [
  (fixture: typeof validInspect) => {
    fixture.Id = "short";
  },
  (fixture: typeof validInspect) => {
    fixture.Name = "/somebody-elses-container";
  },
  (fixture: typeof validInspect) => {
    fixture.Config.Labels["com.greyhoundiq.owner"] = "somebody-else";
  },
  (fixture: typeof validInspect) => {
    fixture.HostConfig.PortBindings["5432/tcp"][0].HostIp = "0.0.0.0";
  },
  (fixture: typeof validInspect) => {
    fixture.NetworkSettings.Ports["5432/tcp"][0].HostPort = "55735";
  },
]) {
  const fixture = structuredClone(validInspect);
  mutate(fixture);
  assert.throws(() => parseLocalDrContainerInspect(JSON.stringify([fixture])));
}

const metrics: LocalDrMetrics = {
  completedMigrations: 92,
  publicTables: 120,
  publicIndexes: 180,
  publicConstraints: 220,
  publicFunctions: 30,
  rlsTables: 110,
  forcedRlsTables: 100,
  policies: 140,
  proofRows: 2,
  proofChildRows: 2,
  deletedFixtureRows: 0,
  proofChecksum: "abc123",
};
assert.deepEqual(
  evaluateLocalDrValidation({
    source: metrics,
    restored: structuredClone(metrics),
    sourceRestrictedRows: 1,
    restoredRestrictedRows: 1,
  }),
  [],
);

const mismatch = {
  ...metrics,
  publicIndexes: metrics.publicIndexes - 1,
  deletedFixtureRows: 1,
};
const findings = evaluateLocalDrValidation({
  source: metrics,
  restored: mismatch,
  sourceRestrictedRows: 1,
  restoredRestrictedRows: 2,
});
assert.ok(findings.some((finding) => finding.includes("do not exactly match")));
assert.ok(findings.some((finding) => finding.includes("revived")));
assert.ok(findings.some((finding) => finding.includes("restricted role")));

console.log("local DR restore contract tests passed");
