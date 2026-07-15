import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateGcpArchitectureContract } from "./gcp-architecture-policy";

const contract = JSON.parse(
  readFileSync(join(process.cwd(), "config", "gcp-architecture.json"), "utf8"),
);

assert.deepEqual(validateGcpArchitectureContract(contract), []);
assert.equal(contract.status, "selected-target-unverified");
assert.equal(contract.currentDeployment.ingress, "all");
assert.equal(contract.selectedTarget.ingress, "internal-and-cloud-load-balancing");
assert.equal(contract.selectedTarget.defaultUrlPolicy, "disabled");
assert.equal(contract.selectedTarget.services.app.architecture, "modular-monolith");
assert.equal(contract.selectedTarget.services.worker.architecture, "separate-worker");

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
publicOrigin.selectedTarget.ingress = "all";
assert.ok(
  validateGcpArchitectureContract(publicOrigin).includes(
    "selectedTarget.ingress: must not be all",
  ),
);

const unboundedPool = structuredClone(contract);
unboundedPool.selectedTarget.services.worker.maxInstancesPerRegion = 20;
assert.ok(
  validateGcpArchitectureContract(unboundedPool).some((finding) =>
    finding.includes("regional maximum pool sum 60 exceeds application budget 40"),
  ),
);

console.log("GCP architecture policy tests passed");
