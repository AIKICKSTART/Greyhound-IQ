import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { resolveMeetingRaceNavigation } from "../lib/race-navigation";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_RACING_DETAIL_NAVIGATION_EVIDENCE_FILE,
  PRODUCT_RACING_DETAIL_NAVIGATION_EXPECTED_GAIN,
  PRODUCT_RACING_DETAIL_NAVIGATION_MASTER_EVIDENCE,
  PRODUCT_RACING_DETAIL_NAVIGATION_REQUIREMENT_IDS,
  PRODUCT_RACING_DETAIL_NAVIGATION_SCOPE,
  PRODUCT_RACING_DETAIL_NAVIGATION_TEST_FILE,
} from "./product-racing-detail-navigation-evidence";
import { PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS } from "./product-racing-meeting-search-evidence";
import { PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_CONTRACTS } from "./screen-contracts/production-screen-public-racing-interactions";

const completedIds = [...PRODUCT_RACING_DETAIL_NAVIGATION_REQUIREMENT_IDS];

assert.deepEqual(completedIds, ["ROUTE.RACING.previous-next"]);
assert.equal(PRODUCT_RACING_DETAIL_NAVIGATION_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_RACING_DETAIL_NAVIGATION_MASTER_EVIDENCE),
  completedIds,
);
assert.equal(
  PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS.includes(
    "ROUTE.RACING.previous-next" as never,
  ),
  false,
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
const record =
  PRODUCT_RACING_DETAIL_NAVIGATION_MASTER_EVIDENCE[
    "ROUTE.RACING.previous-next"
  ];
assert.equal(productRequirementIds.has("ROUTE.RACING.previous-next"), true);
assert.equal(record.status, "tested");
assert.deepEqual(record.evidence.slice(0, 2), [
  PRODUCT_RACING_DETAIL_NAVIGATION_EVIDENCE_FILE,
  PRODUCT_RACING_DETAIL_NAVIGATION_TEST_FILE,
]);
assert.equal(new Set(record.evidence).size, record.evidence.length);
assert.equal(record.evidence.some((path) => path.startsWith("output/")), false);
for (const evidencePath of record.evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}
assert.deepEqual(
  PRODUCT_MASTER_EVIDENCE["ROUTE.RACING.previous-next"],
  record,
);

const evidenceSource = readFileSync(
  PRODUCT_RACING_DETAIL_NAVIGATION_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_RACING_DETAIL_NAVIGATION_SCOPE, /bounded 24-race projection/i);
assert.match(PRODUCT_RACING_DETAIL_NAVIGATION_SCOPE, /first\/last boundaries/i);
assert.match(PRODUCT_RACING_DETAIL_NAVIGATION_SCOPE, /current-meeting navigation only/i);
assert.match(PRODUCT_RACING_DETAIL_NAVIGATION_SCOPE, /does not execute a live database query/i);
assert.match(PRODUCT_RACING_DETAIL_NAVIGATION_SCOPE, /originating search\/filter\/scroll context/i);
assert.match(PRODUCT_RACING_DETAIL_NAVIGATION_SCOPE, /production readiness/i);

const r1 = {
  id: "r1",
  raceNumber: 1,
  raceTime: new Date("2026-07-15T10:00:00Z"),
  distance: 520,
};
const r2 = {
  id: "r2",
  raceNumber: 2,
  raceTime: new Date("2026-07-15T10:15:00Z"),
  distance: 520,
};
const r3 = {
  id: "r3",
  raceNumber: 3,
  raceTime: new Date("2026-07-15T10:30:00Z"),
  distance: 720,
};
assert.deepEqual(resolveMeetingRaceNavigation([r3, r1, r2], "r2"), {
  previous: r1,
  next: r3,
  position: 2,
  total: 3,
});
assert.equal(resolveMeetingRaceNavigation([r3, r1, r2], "r1").previous, null);
assert.equal(resolveMeetingRaceNavigation([r3, r1, r2], "r3").next, null);
assert.equal(
  resolveMeetingRaceNavigation([r3, r1, r2], "missing").position,
  null,
);

const queriesSource = readFileSync("src/lib/queries.ts", "utf8");
for (const sourceAssertion of [
  'orderBy: [{ raceNumber: "asc" }, { raceTime: "asc" }]',
  "take: 24",
  "raceNumber: true",
  "raceTime: true",
  "distance: true",
]) {
  assert.ok(
    queriesSource.includes(sourceAssertion),
    `bounded meeting projection must preserve ${sourceAssertion}`,
  );
}

const pageSource = readFileSync("src/app/races/[id]/page.tsx", "utf8");
for (const sourceAssertion of [
  "resolveMeetingRaceNavigation(",
  "race.meeting.races",
  "date: formatRaceDateInput(race.meeting.meetingDate)",
  "state: track.state",
  "<RaceMeetingNavigation",
  "previous={previousRaceTarget}",
  "next={nextRaceTarget}",
  "meetingHref={buildRaceListReturnHref(listContext)}",
]) {
  assert.ok(
    pageSource.includes(sourceAssertion),
    `race detail must preserve ${sourceAssertion}`,
  );
}

const componentSource = readFileSync(
  "src/components/race-meeting-navigation.tsx",
  "utf8",
);
for (const sourceAssertion of [
  'aria-label="Meeting race navigation"',
  "href={previous.href}",
  "href={next.href}",
  'aria-label={`Previous race, Race ${previous.raceNumber}`}',
  'aria-label={`Next race, Race ${next.raceNumber}`}',
  'aria-disabled="true"',
  "First race in meeting",
  "Last race in meeting",
]) {
  assert.ok(
    componentSource.includes(sourceAssertion),
    `race navigation component must preserve ${sourceAssertion}`,
  );
}

assert.deepEqual(
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_CONTRACTS["/races/[id]"]
    .actions.map(({ id }) => id),
  [
    "RACE-DETAIL.ACTION.REPLAY.PLAY",
    "RACE-DETAIL.ACTION.DOG.OPEN",
    "RACE-DETAIL.ACTION.PREVIOUS.OPEN",
    "RACE-DETAIL.ACTION.MEETING.OPEN",
    "RACE-DETAIL.ACTION.NEXT.OPEN",
  ],
);

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
  PRODUCT_RACING_DETAIL_NAVIGATION_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly one completed requirement",
);

console.log(
  "Product racing detail-navigation evidence passed: bounded meeting projection, deterministic previous/next links and explicit boundaries; 1 gate closed.",
);
