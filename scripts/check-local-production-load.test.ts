import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  fingerprintBuildOutput,
  LOCAL_PRODUCTION_LOAD_PROFILE_NAMES,
  LOCAL_PRODUCTION_LOAD_SCOPE,
  localProductionLoadFindings,
  resolveLocalProductionLoadPort,
  resolveLocalProductionLoadProfiles,
} from "./check-local-production-load";
import { resolveStagingLoadProfile } from "./staging-load-evidence";

assert.equal(resolveLocalProductionLoadPort(undefined), 3_107);
assert.equal(resolveLocalProductionLoadPort("3107"), 3_107);
assert.throws(() => resolveLocalProductionLoadPort("3000"));
assert.throws(() => resolveLocalProductionLoadPort("3108"));

assert.deepEqual(
  resolveLocalProductionLoadProfiles(),
  LOCAL_PRODUCTION_LOAD_PROFILE_NAMES,
);
assert.throws(() =>
  resolveLocalProductionLoadProfiles([
    "baseline",
    "ramp",
    "spike-3x",
    "spike-10x",
  ]),
);
assert.throws(() =>
  resolveLocalProductionLoadProfiles([
    "baseline",
    "ramp",
    "spike-3x",
    "spike-10x",
    "spike-10x",
  ]),
);
assert.equal(LOCAL_PRODUCTION_LOAD_SCOPE.managedCloudEligible, false);
assert.equal(LOCAL_PRODUCTION_LOAD_SCOPE.satisfiesManagedStagingGate, false);

const baseline = resolveStagingLoadProfile("baseline");
assert.deepEqual(
  localProductionLoadFindings(baseline, [
    { label: "ready", status: 200, ms: 10, ok: true },
    { label: "marketplace", status: 200, ms: 20, ok: true },
  ]),
  [],
);
assert.ok(
  localProductionLoadFindings(baseline, [
    { label: "ready", status: 503, ms: 6_000, ok: false },
  ]).length >= 2,
);

const fixture = mkdtempSync(join(tmpdir(), "greyhoundiq-build-fingerprint-test-"));
try {
  mkdirSync(join(fixture, "server"), { recursive: true });
  mkdirSync(join(fixture, "cache"), { recursive: true });
  writeFileSync(join(fixture, "BUILD_ID"), "candidate-a\n", "utf8");
  writeFileSync(join(fixture, "server", "app.js"), "export default 1;\n", "utf8");
  writeFileSync(join(fixture, "cache", "mutable.bin"), "one", "utf8");
  const first = fingerprintBuildOutput(fixture);
  writeFileSync(join(fixture, "cache", "mutable.bin"), "two", "utf8");
  const cacheChanged = fingerprintBuildOutput(fixture);
  assert.deepEqual(cacheChanged, first);
  writeFileSync(join(fixture, "server", "app.js"), "export default 2;\n", "utf8");
  const buildChanged = fingerprintBuildOutput(fixture);
  assert.notEqual(buildChanged.sha256, first.sha256);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

console.log("local production load contract tests passed");
