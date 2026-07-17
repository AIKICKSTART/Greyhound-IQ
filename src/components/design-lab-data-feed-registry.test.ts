import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  DESIGN_LAB_ALL_DATA_FEEDS,
  DESIGN_LAB_DATA_FEED_DISCOVERY_GAPS,
  DESIGN_LAB_DATA_FEED_GATES,
} from "./design-lab-data-feed-registry";
import type { DataFeedFailureReason } from "./design-lab-data-feed-contract";

const EXPECTED_FEED_IDS = [
  "DATA.FEED.ARCHIVE.THEDOGS_DOG_PROFILE",
  "DATA.FEED.ARCHIVE.THEDOGS_RACE_DAY",
  "DATA.FEED.PEDIGREE.GALTD",
  "DATA.FEED.PROFILE.THEDOGS_RUNTIME",
  "DATA.FEED.RACING.FASTTRACK_PROTOTYPE",
  "DATA.FEED.RACING.THEDOGS",
  "DATA.FEED.RACING.TOPAZ",
  "DATA.FEED.RACING.WATCHDOG",
  "DATA.FEED.REPLAY.GREYHOUNDS_WA",
  "DATA.FEED.REPLAY.RACING_QUEENSLAND",
  "DATA.FEED.REPLAY.SA_RACE_REPLAY",
  "DATA.FEED.REPLAY.TASRACING",
  "DATA.FEED.REPLAY.THEDOGS",
] as const;

const EXPECTED_GATE_IDS = [
  "DATA.FEED.GATE.ADMIN_OBSERVABILITY",
  "DATA.FEED.GATE.DESIGN_LAB_EVIDENCE",
  "DATA.FEED.GATE.FRESHNESS_ALERTS",
  "DATA.FEED.GATE.GOVERNANCE_OWNERSHIP",
  "DATA.FEED.GATE.LINEAGE_RECONCILIATION",
  "DATA.FEED.GATE.RUNTIME_INSTRUMENTATION",
] as const;

const ALLOWED_FAILURE_REASONS = new Set<DataFeedFailureReason>([
  "authentication_rejected",
  "rate_limited",
  "source_timeout",
  "source_unavailable",
  "schema_drift",
  "parse_failure",
  "partial_payload",
  "scheduler_missed",
  "destination_unavailable",
  "destination_saturated",
  "duplicate_or_identity_conflict",
  "reconciliation_mismatch",
  "licensing_hold",
  "unknown",
]);

const ids = DESIGN_LAB_ALL_DATA_FEEDS.map(({ id }) => id);
assert.equal(ids.length, 13, "The reviewed source inventory must keep thirteen distinct feeds.");
assert.equal(new Set(ids).size, ids.length, "Feed IDs must be unique.");
assert.deepEqual([...ids].toSorted(), [...EXPECTED_FEED_IDS]);

for (const item of DESIGN_LAB_ALL_DATA_FEEDS) {
  assert.match(item.id, /^DATA\.FEED\.[A-Z0-9_]+\.[A-Z0-9_]+(?:\.[A-Z0-9_]+)?$/);
  assert.equal(item.status, "not-verified", `${item.id} must remain fail-closed.`);
  assert.equal(item.owner.assignment, "proposed-not-confirmed");
  assert.ok(item.owner.accountableRole.trim(), `${item.id} needs an owner role.`);
  assert.ok(item.provider.trim() && item.source.trim() && item.transport.trim());
  assert.ok(item.jobPaths.length > 0, `${item.id} needs an implemented path.`);
  assert.ok(item.dataClasses.length > 0 && item.lineage.length >= 2);
  assert.ok(item.dependencies.length > 0 && item.downstreamJourneys.length > 0);
  assert.ok(item.verifiedCodeFacts.length > 0, `${item.id} needs source facts.`);
  assert.ok(item.unknownOperatorMetadata.length >= 4, `${item.id} must expose unknowns.`);

  assert.equal(item.schemaContract.validationState, "source-implemented-runtime-not-verified");
  assert.equal(item.cadence.refreshSlaMinutes, null, `${item.id} has no approved SLA yet.`);
  assert.equal(item.cadence.deploymentState, "unknown");
  assert.ok(item.cadence.sourceDeclaredTrigger.trim());
  assert.equal(item.freshness.degradedAfterMinutes, null);
  assert.equal(item.freshness.downAfterMinutes, null);
  assert.equal(item.freshness.thresholdState, "operator-unknown");

  assert.equal(item.runtime.source, "server-supplied-only");
  assert.equal(item.runtime.feedId, item.id);
  assert.equal(item.runtime.currentModel, "DataSourceHealth");
  assert.equal(item.runtime.snapshot, null, `${item.id} must not hard-code runtime health.`);
  assert.equal(item.operations.alert, "not-implemented");
  assert.equal(item.operations.runbook, "not-implemented");
  assert.deepEqual(item.operations.runtimeEvidence, []);
  assert.ok(item.operations.sourceEvidence.length > 0);

  for (const path of [...item.jobPaths, ...item.operations.sourceEvidence]) {
    assert.equal(existsSync(path), true, `${item.id} references missing source evidence: ${path}`);
  }
  for (const label of item.auth.secretReferenceLabels) {
    assert.match(label, /^[A-Z][A-Z0-9_]*$/, `${item.id} must store secret labels only.`);
  }
  for (const reason of item.failureReasons) {
    assert.equal(ALLOWED_FAILURE_REASONS.has(reason), true, `${item.id} has an invalid failure reason.`);
  }
  assert.ok(item.governance.pii.trim());
  assert.ok(item.governance.licensing.trim());
  assert.ok(item.governance.dataResidency.trim());
}

assert.deepEqual(
  cadenceFor("DATA.FEED.RACING.THEDOGS"),
  [5, 60],
  "Live provider cadence must stay source-declared, not inferred from runtime.",
);
assert.deepEqual(cadenceFor("DATA.FEED.PROFILE.THEDOGS_RUNTIME"), [2]);
assert.deepEqual(cadenceFor("DATA.FEED.REPLAY.TASRACING"), []);

const serializedRegistry = JSON.stringify(DESIGN_LAB_ALL_DATA_FEEDS);
assert.equal(/https?:\/\//i.test(serializedRegistry), false, "Registry must not expose provider endpoints.");
assert.equal(/(?:api[_-]?key|secret|token)\s*[:=]\s*[^\s,}]+/i.test(serializedRegistry), false);

assertSourceAnchor("DATA.FEED.RACING.THEDOGS", "src/lib/live/thedogs.ts", 'readonly name = "thedogs"');
assertSourceAnchor("DATA.FEED.RACING.TOPAZ", "src/lib/live/topaz.ts", 'readonly name = "topaz"');
assertSourceAnchor("DATA.FEED.RACING.WATCHDOG", "src/lib/live/watchdog.ts", 'readonly name = "watchdog"');
assertSourceAnchor(
  "DATA.FEED.RACING.FASTTRACK_PROTOTYPE",
  "src/lib/live/fasttrack.ts",
  'readonly name = "fasttrack-prototype"',
);
assertSourceAnchor(
  "DATA.FEED.PROFILE.THEDOGS_RUNTIME",
  "src/lib/live/dog-profile-sync.ts",
  "syncDogProfilesBatch",
);
assertSourceAnchor(
  "DATA.FEED.ARCHIVE.THEDOGS_RACE_DAY",
  "scripts/import-thedogs-race-day-archive.ts",
  "RaceDayArchive",
);
assertSourceAnchor(
  "DATA.FEED.ARCHIVE.THEDOGS_DOG_PROFILE",
  "scripts/import-thedogs-dog-profile-raw.ts",
  "DogProfileArchive",
);
for (const [id, provider] of [
  ["DATA.FEED.REPLAY.THEDOGS", '"thedogs"'],
  ["DATA.FEED.REPLAY.RACING_QUEENSLAND", '"racing-queensland"'],
  ["DATA.FEED.REPLAY.TASRACING", '"tasracing"'],
  ["DATA.FEED.REPLAY.GREYHOUNDS_WA", '"greyhoundswa"'],
  ["DATA.FEED.REPLAY.SA_RACE_REPLAY", '"sa-race-replay"'],
] as const) {
  assertSourceAnchor(id, "scripts/backfill-race-videos.ts", provider);
}
assertSourceAnchor("DATA.FEED.PEDIGREE.GALTD", "scripts/import-galtd-studbook.ts", 'SOURCE = "galtd"');

assert.equal(DESIGN_LAB_DATA_FEED_DISCOVERY_GAPS.length, 9);
assert.equal(
  DESIGN_LAB_DATA_FEED_DISCOVERY_GAPS.some((gap) => gap.includes("automatically record")),
  true,
);
assert.equal(
  DESIGN_LAB_DATA_FEED_DISCOVERY_GAPS.some((gap) => gap.includes("cannot be tracked independently")),
  true,
);

const gateIds = DESIGN_LAB_DATA_FEED_GATES.map(({ id }) => id);
assert.deepEqual([...gateIds].toSorted(), [...EXPECTED_GATE_IDS]);
assert.equal(new Set(gateIds).size, gateIds.length);
for (const gate of DESIGN_LAB_DATA_FEED_GATES) {
  assert.equal(gate.status, "not-verified");
  assert.equal(gate.releaseBlocking, true);
  assert.deepEqual(gate.evidence, []);
  assert.ok(gate.owner.trim());
  assert.equal(gate.acceptanceCriteria.length, 2);
  assert.equal(
    gate.acceptanceCriteria.every((criterion) => criterion.length >= 80 && criterion.endsWith(".")),
    true,
    `${gate.id} needs objective acceptance criteria.`,
  );
}

console.log(
  "Design Lab data-feed registry passed: 13 source pipelines, 9 explicit gaps and 6 fail-closed gates.",
);

function cadenceFor(id: (typeof EXPECTED_FEED_IDS)[number]) {
  const item = DESIGN_LAB_ALL_DATA_FEEDS.find((feed) => feed.id === id);
  assert.ok(item, `Missing feed ${id}`);
  return item.cadence.intervalMinutes;
}

function assertSourceAnchor(id: string, path: string, needle: string) {
  assert.equal(ids.includes(id as (typeof ids)[number]), true, `Missing feed ${id}`);
  assert.equal(
    readFileSync(path, "utf8").includes(needle),
    true,
    `${id} lost its reviewed source anchor in ${path}.`,
  );
}
