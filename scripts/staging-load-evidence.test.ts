import assert from "node:assert/strict";

import {
  missingRequiredLanes,
  resolveStagingLoadProfile,
  stableJson,
  stagingLoadConfigDigest,
  stagingLoadPreflightFindings,
  stagingLoadThresholdFindings,
  summarizeStagingLoad,
} from "./staging-load-evidence";

const smoke = resolveStagingLoadProfile(undefined, {
  iterations: 7,
  concurrency: 3,
});
assert.equal(smoke.name, "smoke");
assert.deepEqual(smoke.stages, [
  { name: "smoke", iterations: 7, concurrency: 3 },
]);
assert.throws(() => resolveStagingLoadProfile("production"));

for (const name of ["baseline", "ramp", "spike-3x", "spike-10x", "soak"]) {
  assert.equal(resolveStagingLoadProfile(name).name, name);
}

const baseline = resolveStagingLoadProfile("baseline");
assert.deepEqual(
  missingRequiredLanes(baseline.requiredLanes, ["public"]),
  ["authenticated"],
);
assert.deepEqual(
  stagingLoadPreflightFindings({
    profile: baseline,
    targetOrigin: "https://staging.greyhoundsiq.com.au",
    environment: "staging",
    sourceSha: "a".repeat(40),
    imageDigest: `sha256:${"b".repeat(64)}`,
    configuredLanes: ["public", "authenticated"],
  }),
  [],
);
assert.deepEqual(
  stagingLoadPreflightFindings({
    profile: baseline,
    targetOrigin: "http://localhost:3000",
    environment: "local",
    sourceSha: "working-tree",
    imageDigest: "not-applicable",
    configuredLanes: ["public"],
  }),
  [
    "required lane is not configured: authenticated",
    "non-smoke profiles require LOAD_ENVIRONMENT=staging",
    "non-smoke profiles cannot target loopback",
    "non-smoke profiles require a 40-character LOAD_SOURCE_SHA",
    "non-smoke profiles require LOAD_IMAGE_DIGEST=sha256:<64 hex>",
  ],
);

const summary = summarizeStagingLoad([
  { label: "ready", status: 200, ms: 10, ok: true },
  { label: "ready", status: 200, ms: 20, ok: true },
  { label: "ready", status: 503, ms: 30, ok: false },
  { label: "feed", status: 200, ms: 40, ok: true },
]);
assert.deepEqual(summary.overall, {
  count: 4,
  failures: 1,
  errorRate: 0.25,
  p50Milliseconds: 20,
  p95Milliseconds: 40,
  p99Milliseconds: 40,
  maximumMilliseconds: 40,
  statuses: { "200": 3, "503": 1 },
});
assert.equal(summary.byLabel.ready.p50Milliseconds, 20);
assert.ok(stagingLoadThresholdFindings(smoke, summary.overall).length > 0);

const config = { profile: smoke, targetOrigin: "http://localhost:3000" };
assert.equal(stagingLoadConfigDigest(config), stagingLoadConfigDigest(config));
assert.equal(stableJson({ b: 1, a: { d: 2, c: 3 } }), '{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}\n');

console.log("staging load evidence tests passed");
