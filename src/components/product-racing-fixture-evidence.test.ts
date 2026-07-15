import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_RACING_FIXTURE_EVIDENCE_FILE,
  PRODUCT_RACING_FIXTURE_EVIDENCE_SCOPE,
  PRODUCT_RACING_FIXTURE_MASTER_EVIDENCE,
  PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS,
  PRODUCT_RACING_FIXTURE_TEST_FILE,
  RACING_PRODUCTION_FIXTURES,
  type RacingFixtureRequirementId,
} from "./product-racing-fixture-evidence";

const fixtureRequirementIds = PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS.filter(
  (requirementId): requirementId is RacingFixtureRequirementId =>
    requirementId !== "RACING.FIX.safe-errors",
);
const fixtureByRequirement = new Map(
  RACING_PRODUCTION_FIXTURES.map((fixture) => [fixture.requirementId, fixture]),
);

assert.equal(PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS.length, 16);
assert.equal(new Set(PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS).size, 16);
assert.equal(RACING_PRODUCTION_FIXTURES.length, 15);
assert.equal(new Set(RACING_PRODUCTION_FIXTURES.map(({ id }) => id)).size, 15);
assert.deepEqual(
  RACING_PRODUCTION_FIXTURES.map(({ requirementId }) => requirementId).toSorted(),
  fixtureRequirementIds.toSorted(),
);

const sectionRequirements = PRODUCT_MASTER_REQUIREMENTS.filter(
  ({ section }) => section === "racing.fixtures",
);
assert.equal(sectionRequirements.length, 16);
assert.deepEqual(
  sectionRequirements.map(({ id }) => id).toSorted(),
  [...PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS].toSorted(),
);
assert.deepEqual(
  Object.keys(PRODUCT_RACING_FIXTURE_MASTER_EVIDENCE),
  [...PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS],
);

for (const requirementId of PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS) {
  const evidence = PRODUCT_RACING_FIXTURE_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence, [
    PRODUCT_RACING_FIXTURE_EVIDENCE_FILE,
    PRODUCT_RACING_FIXTURE_TEST_FILE,
  ]);
  evidence.evidence.forEach((evidencePath) =>
    assert.equal(existsSync(evidencePath), true, evidencePath),
  );
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], evidence);
}

for (const fixture of RACING_PRODUCTION_FIXTURES) {
  assert.match(fixture.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(fixture.title.length >= 10, fixture.id);
  assert.match(fixture.source.provider, /^Fixture /);
  assert.equal(Number.isNaN(Date.parse(fixture.source.observedAt)), false);
  assert.equal(Number.isNaN(Date.parse(fixture.source.effectiveAt)), false);
  assert.ok(fixture.source.revision >= 1, fixture.id);
  assert.equal(JSON.stringify(fixture).includes("undefined"), false);
}

const complete = requiredFixture("RACING.FIX.complete");
assert.equal(complete.record.missingFields.length, 0);
assert.ok(complete.record.raceId);
assert.ok(complete.record.meetingId);
assert.ok(complete.record.track?.id);
assert.ok(complete.record.dog?.id);
assert.ok(complete.record.dog?.breeding.sire);
assert.ok(complete.record.dog?.breeding.dam);
assert.ok(complete.record.result);
assert.equal(complete.record.replay.state, "available");
assert.ok(complete.record.replay.url);

const partial = requiredFixture("RACING.FIX.partial");
assert.deepEqual(partial.record.missingFields, ["result.marginLengths"]);
assert.equal(partial.record.result?.marginLengths, null);
assert.ok(partial.record.raceId);

const missing = requiredFixture("RACING.FIX.missing");
assert.equal(missing.record.result, null);
assert.equal(missing.record.metrics.starts, null);
assert.ok(missing.record.missingFields.length >= 4);

const zero = requiredFixture("RACING.FIX.zero");
assert.deepEqual(zero.record.metrics, {
  starts: 0,
  wins: 0,
  prizeMoneyCents: 0,
});
assert.equal(zero.record.missingFields.length, 0);

const delayed = requiredFixture("RACING.FIX.delayed");
assert.equal(delayed.source.state, "delayed");
assert.ok(
  Date.parse(delayed.source.observedAt) < Date.parse(delayed.source.effectiveAt),
);
assert.match(delayed.presentation.warning ?? "", /delayed/i);

const corrected = requiredFixture("RACING.FIX.corrected");
assert.equal(corrected.source.state, "corrected");
assert.ok(corrected.source.revision > 1);
assert.notEqual(corrected.record.result?.timeSeconds, complete.record.result?.timeSeconds);

const noResults = requiredFixture("RACING.FIX.no-results");
assert.equal(noResults.record.result, null);
assert.match(noResults.presentation.emptyState ?? "", /no races match/i);

const conflict = requiredFixture("RACING.FIX.source-conflict");
assert.equal(conflict.source.state, "conflict");
assert.ok(conflict.source.candidates.length >= 2);
assert.equal(
  new Set(conflict.source.candidates.map(({ value }) => value)).size,
  conflict.source.candidates.length,
);

assert.equal(requiredFixture("RACING.FIX.suspended").record.status, "suspended");
assert.equal(requiredFixture("RACING.FIX.abandoned").record.status, "abandoned");

const replayUnavailable = requiredFixture("RACING.FIX.replay-unavailable");
assert.equal(replayUnavailable.record.replay.state, "unavailable");
assert.equal(replayUnavailable.record.replay.url, null);

const unknownDog = requiredFixture("RACING.FIX.unknown-dog");
assert.equal(unknownDog.record.dog, null);
assert.deepEqual(unknownDog.record.missingFields, ["dog.id", "dog.name"]);

const unknownTrack = requiredFixture("RACING.FIX.unknown-track");
assert.equal(unknownTrack.record.track, null);
assert.deepEqual(unknownTrack.record.missingFields, ["track.id", "track.name"]);

const missingBreeding = requiredFixture("RACING.FIX.missing-breeding");
assert.equal(missingBreeding.record.dog?.breeding.sire, null);
assert.equal(missingBreeding.record.dog?.breeding.dam, null);

const outage = requiredFixture("RACING.FIX.source-outage");
assert.equal(outage.source.state, "outage");
assert.match(outage.presentation.safeError ?? "", /try again later/i);

const unsafePresentationPattern =
  /(?:stack trace|prisma|postgres|database identifier|select\s+.+\s+from|password|access token|refresh token|api key|secret)/i;
for (const fixture of RACING_PRODUCTION_FIXTURES) {
  const presentationText = Object.values(fixture.presentation)
    .join(" ");
  assert.doesNotMatch(presentationText, unsafePresentationPattern, fixture.id);
  assert.doesNotMatch(presentationText, /fixture-(?:race|meeting|track|dog)-\d+/i);
}

const evidenceSource = readFileSync(PRODUCT_RACING_FIXTURE_EVIDENCE_FILE, "utf8");
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.match(PRODUCT_RACING_FIXTURE_EVIDENCE_SCOPE, /Typed, deterministic source fixtures/i);
assert.match(PRODUCT_RACING_FIXTURE_EVIDENCE_SCOPE, /does not prove/i);
assert.match(PRODUCT_RACING_FIXTURE_EVIDENCE_SCOPE, /production readiness/i);

const selectedIds = new Set<string>(PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIds.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS.length,
  "This isolated evidence batch must add exactly 16 completed requirements",
);

console.log(
  "Product racing fixtures passed: 15 typed states plus safe-error constraints close exactly 16 RACING.FIX requirements.",
);

function requiredFixture(requirementId: RacingFixtureRequirementId) {
  const fixture = fixtureByRequirement.get(requirementId);
  assert.ok(fixture, requirementId);
  return fixture;
}
