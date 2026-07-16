import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  getRacePresentationStatus,
  isRaceEligibleForNextToGo,
  raceSchemaEventStatus,
} from "../lib/race-status";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS } from "./product-racing-meeting-search-evidence";
import {
  PRODUCT_RACING_STATUS_DISTINCTION_EVIDENCE_FILE,
  PRODUCT_RACING_STATUS_DISTINCTION_EXPECTED_GAIN,
  PRODUCT_RACING_STATUS_DISTINCTION_MASTER_EVIDENCE,
  PRODUCT_RACING_STATUS_DISTINCTION_REQUIREMENT_IDS,
  PRODUCT_RACING_STATUS_DISTINCTION_SCOPE,
  PRODUCT_RACING_STATUS_DISTINCTION_TEST_FILE,
} from "./product-racing-status-distinction-evidence";

const completedIds = [...PRODUCT_RACING_STATUS_DISTINCTION_REQUIREMENT_IDS];
assert.deepEqual(completedIds, ["ROUTE.RACING.status-distinction"]);
assert.equal(PRODUCT_RACING_STATUS_DISTINCTION_EXPECTED_GAIN, 1);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.deepEqual(
  Object.keys(PRODUCT_RACING_STATUS_DISTINCTION_MASTER_EVIDENCE),
  completedIds,
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of completedIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  assert.equal(
    (PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS as readonly string[]).includes(
      requirementId,
    ),
    false,
  );
  const record =
    PRODUCT_RACING_STATUS_DISTINCTION_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_RACING_STATUS_DISTINCTION_EVIDENCE_FILE,
    PRODUCT_RACING_STATUS_DISTINCTION_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  assert.equal(record.evidence.some((path) => path.startsWith("output/")), false);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], record);
}

const evidenceSource = readFileSync(
  PRODUCT_RACING_STATUS_DISTINCTION_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_RACING_STATUS_DISTINCTION_SCOPE, /stored provider resultStatus/i);
assert.match(PRODUCT_RACING_STATUS_DISTINCTION_SCOPE, /explicit abandoned and postponed/i);
assert.match(PRODUCT_RACING_STATUS_DISTINCTION_SCOPE, /Awaiting result/i);
assert.match(PRODUCT_RACING_STATUS_DISTINCTION_SCOPE, /stored-status presentation contract only/i);
assert.match(PRODUCT_RACING_STATUS_DISTINCTION_SCOPE, /does not prove that every live provider/i);
assert.match(PRODUCT_RACING_STATUS_DISTINCTION_SCOPE, /production readiness/i);

const now = new Date("2026-07-15T10:00:00.000Z");
for (const [resultStatus, expectedKey] of [
  ["ABANDONED", "abandoned"],
  ["race_postponed", "postponed"],
  ["posted", "completed"],
] as const) {
  assert.equal(
    getRacePresentationStatus({
      resultStatus,
      raceTime: new Date("2026-07-15T11:00:00.000Z"),
      now,
      hasResults: expectedKey === "completed",
      hasReplay: false,
    }).key,
    expectedKey,
  );
}
assert.equal(
  getRacePresentationStatus({
    resultStatus: "pending",
    raceTime: new Date("2026-07-15T09:00:00.000Z"),
    now,
    hasResults: false,
    hasReplay: false,
  }).key,
  "awaiting-result",
);
assert.equal(
  isRaceEligibleForNextToGo({
    resultStatus: "Postponed",
    raceTime: new Date("2026-07-15T11:00:00.000Z"),
    now,
  }),
  false,
);
assert.equal(
  raceSchemaEventStatus("Abandoned"),
  "https://schema.org/EventCancelled",
);
assert.equal(
  raceSchemaEventStatus("Postponed"),
  "https://schema.org/EventPostponed",
);

const queriesSource = readFileSync("src/lib/queries.ts", "utf8");
for (const sourceAssertion of [
  "resultStatus: string | null;",
  "resultStatus: true,",
  "resultStatus: race.resultStatus,",
]) {
  assert.ok(
    queriesSource.includes(sourceAssertion),
    `race explorer query must preserve ${sourceAssertion}`,
  );
}

const listSource = readFileSync("src/app/races/page.tsx", "utf8");
for (const sourceAssertion of [
  "const status = explorerRaceStatus(race, now);",
  "isRaceEligibleForNextToGo({",
  "resultStatus: race.resultStatus",
  "data-race-status={status.key}",
  "giq-race-row-state-${status.key}",
  'return { label: "Abandoned", tone: "abandoned" };',
  'return { label: "Postponed", tone: "postponed" };',
  'return { label: "Completed", tone: "completed" };',
  'return { label: "Awaiting result", tone: "awaiting-result" };',
]) {
  assert.ok(
    listSource.includes(sourceAssertion),
    `race explorer status UI must preserve ${sourceAssertion}`,
  );
}
assert.doesNotMatch(
  listSource,
  /replayReady \? "Replay" : statusLabel/,
  "the explorer must not bypass the explicit source-status resolver",
);

const detailSource = readFileSync("src/app/races/[id]/page.tsx", "utf8");
for (const sourceAssertion of [
  "normaliseRaceSourceStatus(race.resultStatus)",
  "getRacePresentationStatus({",
  "eventStatus: raceSchemaEventStatus(race.resultStatus)",
  "data-race-source-status={sourceRaceStatus}",
  "it is excluded",
  'label="Race status"',
]) {
  assert.ok(
    detailSource.includes(sourceAssertion),
    `race detail status UI must preserve ${sourceAssertion}`,
  );
}

const cssSource = readFileSync("src/app/globals.css", "utf8");
for (const className of [
  ".giq-meeting-state-abandoned",
  ".giq-meeting-state-postponed",
  ".giq-race-row-state-abandoned",
  ".giq-race-row-state-postponed",
  ".giq-race-status-notice-abandoned",
]) {
  assert.ok(cssSource.includes(className), `${className} must remain styled`);
}

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_RACING_STATUS_DISTINCTION_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly one completed requirement",
);

console.log(
  "Product racing status-distinction evidence passed: explicit source schedule states override time heuristics, terminal races stay out of next-to-go, and 1 gate closed.",
);
