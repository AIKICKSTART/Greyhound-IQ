import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateGcpArchitectureContract } from "./gcp-architecture-policy";

const contract = JSON.parse(
  readFileSync(join(process.cwd(), "config", "gcp-architecture.json"), "utf8"),
);

assert.deepEqual(validateGcpArchitectureContract(contract), []);
assert.equal(contract.schemaVersion, 2);
assert.equal(contract.status, "selected-target-unverified");
assert.equal(contract.accountBoundary.billingMode, "non-billable-free-trial-only");
assert.equal(
  contract.accountBoundary.creditSpendApproval,
  "required-before-credit-consuming-resource",
);
assert.equal(contract.currentDeployment.ingress, "all");
assert.equal(
  contract.selectedTarget.publicServiceIngress.ingress,
  "internal-and-cloud-load-balancing",
);
assert.equal(contract.selectedTarget.publicServiceIngress.defaultUrlPolicy, "disabled");
assert.equal(contract.selectedTarget.internalServiceIngress.ingress, "internal");
assert.equal(contract.selectedTarget.services.app.architecture, "modular-monolith");
assert.equal(contract.selectedTarget.services.worker.architecture, "separate-worker");
assert.equal(
  contract.selectedTarget.services.realtime.architecture,
  "regional-websocket-gateway",
);

const missingMelbourne = structuredClone(contract);
missingMelbourne.selectedTarget.regions = missingMelbourne.selectedTarget.regions.filter(
  (region: { id: string }) => region.id !== "australia-southeast2",
);
assert.ok(
  validateGcpArchitectureContract(missingMelbourne).includes(
    "selectedTarget.regions: missing australia-southeast2",
  ),
);

const publicOrigin = structuredClone(contract);
publicOrigin.selectedTarget.publicServiceIngress.ingress = "all";
assert.ok(
  validateGcpArchitectureContract(publicOrigin).includes(
    "selectedTarget.publicServiceIngress.ingress: must be internal-and-cloud-load-balancing",
  ),
);

const unboundedPool = structuredClone(contract);
unboundedPool.selectedTarget.services.worker.maxInstancesPerRegion = 20;
assert.ok(
  validateGcpArchitectureContract(unboundedPool).some((finding) =>
    finding.includes("regional maximum pool sum 70 exceeds application budget 40"),
  ),
);

const missingAlloyDb = structuredClone(contract);
delete missingAlloyDb.selectedTarget.capabilities.database;
assert.ok(
  validateGcpArchitectureContract(missingAlloyDb).some((finding) =>
    finding.includes("selectedTarget.capabilities.database"),
  ),
);

const providerRegression = structuredClone(contract);
providerRegression.selectedTarget.capabilities.externalProviders.payments =
  "replacement-unreviewed";
assert.ok(
  validateGcpArchitectureContract(providerRegression).includes(
    "selectedTarget.capabilities.externalProviders.payments: must preserve Stripe",
  ),
);

console.log("GCP architecture policy tests passed");
