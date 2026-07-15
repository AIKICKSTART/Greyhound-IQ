import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { resolveRaceSearchDate } from "../lib/race-search";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_RACING_MEETING_SEARCH_EVIDENCE_FILE,
  PRODUCT_RACING_MEETING_SEARCH_EXPECTED_GAIN,
  PRODUCT_RACING_MEETING_SEARCH_MASTER_EVIDENCE,
  PRODUCT_RACING_MEETING_SEARCH_OPEN_GAPS,
  PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS,
  PRODUCT_RACING_MEETING_SEARCH_REQUIREMENT_IDS,
  PRODUCT_RACING_MEETING_SEARCH_SCOPE,
  PRODUCT_RACING_MEETING_SEARCH_TEST_FILE,
} from "./product-racing-meeting-search-evidence";
import { PRODUCT_RACING_STRUCTURE_MASTER_EVIDENCE } from "./product-racing-structure-evidence";

const completedIds = [...PRODUCT_RACING_MEETING_SEARCH_REQUIREMENT_IDS];
const intentionallyOpenIds = [
  ...PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS,
];

assert.deepEqual(completedIds, ["ROUTE.RACING.search-meeting"]);
assert.equal(PRODUCT_RACING_MEETING_SEARCH_EXPECTED_GAIN, 1);
assert.equal(intentionallyOpenIds.length, 0);
assert.equal(new Set(intentionallyOpenIds).size, intentionallyOpenIds.length);
assert.deepEqual(
  Object.keys(PRODUCT_RACING_MEETING_SEARCH_MASTER_EVIDENCE),
  completedIds,
);

const routeRacingBehaviourIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  ({ id, section }) =>
    section === "routes.racing" &&
    (completedIds.includes(id as (typeof completedIds)[number]) ||
      intentionallyOpenIds.includes(
        id as (typeof intentionallyOpenIds)[number],
      )),
).map(({ id }) => id);
assert.deepEqual(
  [...completedIds, ...intentionallyOpenIds].toSorted(),
  routeRacingBehaviourIds.toSorted(),
  "The meeting-search proof and explicit residuals must partition the reviewed racing behavior gates",
);

const record =
  PRODUCT_RACING_MEETING_SEARCH_MASTER_EVIDENCE[
    "ROUTE.RACING.search-meeting"
  ];
assert.equal(record.status, "tested");
assert.deepEqual(record.evidence.slice(0, 2), [
  PRODUCT_RACING_MEETING_SEARCH_EVIDENCE_FILE,
  PRODUCT_RACING_MEETING_SEARCH_TEST_FILE,
]);
assert.equal(new Set(record.evidence).size, record.evidence.length);
assert.equal(
  record.evidence.some((path) => path.startsWith("output/")),
  false,
);
for (const evidencePath of record.evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}
assert.deepEqual(
  PRODUCT_MASTER_EVIDENCE["ROUTE.RACING.search-meeting"],
  record,
);
assert.equal(
  PRODUCT_RACING_STRUCTURE_MASTER_EVIDENCE["RACING.STRUCT.search"].status,
  "tested",
);

assert.deepEqual(PRODUCT_RACING_MEETING_SEARCH_OPEN_GAPS, {});

const evidenceSource = readFileSync(
  PRODUCT_RACING_MEETING_SEARCH_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_RACING_MEETING_SEARCH_SCOPE, /bounded q parameter/i);
assert.match(PRODUCT_RACING_MEETING_SEARCH_SCOPE, /meeting relationship/i);
assert.match(PRODUCT_RACING_MEETING_SEARCH_SCOPE, /implemented meeting-search contract only/i);
assert.match(PRODUCT_RACING_MEETING_SEARCH_SCOPE, /does not execute a live database search/i);
assert.match(PRODUCT_RACING_MEETING_SEARCH_SCOPE, /production readiness/i);

assert.deepEqual(resolveRaceSearchDate(null, "Wentworth Park", "2026-07-15"), {
  selectedDate: "2026-07-15",
  dateInputValue: "",
  isGlobalSearch: true,
});
assert.deepEqual(
  resolveRaceSearchDate("2026-07-14", "Wentworth Park", "2026-07-15"),
  {
    selectedDate: "2026-07-14",
    dateInputValue: "2026-07-14",
    isGlobalSearch: false,
  },
);
assert.deepEqual(resolveRaceSearchDate(null, null, "2026-07-15"), {
  selectedDate: "2026-07-15",
  dateInputValue: "",
  isGlobalSearch: false,
});

const pageSource = readFileSync("src/app/races/page.tsx", "utf8");
for (const sourceAssertion of [
  'q: firstParam(params.q)',
  '<form action="/races" className="giq-race-search-form">',
  'type="search"',
  'name="q"',
  'defaultValue={data.searchQuery ?? ""}',
  'placeholder="Search track, runner, R4, 520m"',
  'name="q" value={data.searchQuery}',
  'if (q) params.set("q", q);',
  '"Search results by track"',
  'data.meetings.map((meeting)',
  'No races match these filters.',
]) {
  assert.ok(
    pageSource.includes(sourceAssertion),
    `Race search UI must preserve ${sourceAssertion}`,
  );
}
assert.ok(
  pageSource.indexOf('q: firstParam(params.q)') <
    pageSource.indexOf("const hasMeetings = data.meetings.length > 0"),
  "The bounded query must be resolved before meeting-result rendering",
);

const queriesSource = readFileSync("src/lib/queries.ts", "utf8");
for (const sourceAssertion of [
  'value?.trim().replace(/\\s+/g, " ").slice(0, 80)',
  "const searchQuery = normaliseRaceSearchParam(filters.q);",
  "await findRankedRaceSearchIds({",
  "JOIN \"Meeting\" m ON m.id = r.\"meetingId\"",
  "JOIN \"Track\" t ON t.id = m.\"trackId\"",
  "CASE WHEN t.name ILIKE",
  "track_match DESC",
  "meeting: { track: { name: { contains: parsed.text, mode: insensitive } } }",
  "meeting: { track: { state: { contains: parsed.text, mode: insensitive } } }",
  "const meetings = orderRaceExplorerMeetings(",
]) {
  assert.ok(
    queriesSource.includes(sourceAssertion),
    `Race meeting search must preserve ${sourceAssertion}`,
  );
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
  PRODUCT_RACING_MEETING_SEARCH_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly one completed requirement",
);

console.log(
  "Product racing meeting-search evidence passed: bounded q, track/meeting search, filter preservation and grouped results; former meeting-detail and no-invention residuals moved to the focused final-route evidence.",
);
