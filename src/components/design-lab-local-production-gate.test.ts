import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const deployScript = readFileSync(
  "scripts/gcp-cloud-run-deploy.ps1",
  "utf8"
);

assert.match(deployScript, /if \(\$Environment -eq "prod"\)/);
assert.match(deployScript, /Local production deployment is disabled/);
assert.match(deployScript, /protected Cloud Run Deploy GitHub workflow/);

console.log("Local production deployment gate tests passed");
