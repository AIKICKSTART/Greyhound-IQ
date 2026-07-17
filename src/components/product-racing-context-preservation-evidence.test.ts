import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  buildRaceDetailHref,
  buildRaceListReturnHref,
  normaliseRaceListContext,
  parseRaceListContext,
} from "../lib/race-navigation";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_RACING_CONTEXT_PRESERVATION_EVIDENCE_FILE,
  PRODUCT_RACING_CONTEXT_PRESERVATION_EXPECTED_GAIN,
  PRODUCT_RACING_CONTEXT_PRESERVATION_MASTER_EVIDENCE,
  PRODUCT_RACING_CONTEXT_PRESERVATION_REQUIREMENT_IDS,
  PRODUCT_RACING_CONTEXT_PRESERVATION_SCOPE,
  PRODUCT_RACING_CONTEXT_PRESERVATION_TEST_FILE,
} from "./product-racing-context-preservation-evidence";
import { PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS } from "./product-racing-meeting-search-evidence";

const completedIds = [...PRODUCT_RACING_CONTEXT_PRESERVATION_REQUIREMENT_IDS];

assert.deepEqual(completedIds, [
  "ROUTE.RACING.return-context",
  "ROUTE.RACING.preserve-context",
]);
assert.equal(PRODUCT_RACING_CONTEXT_PRESERVATION_EXPECTED_GAIN, 2);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.deepEqual(
  Object.keys(PRODUCT_RACING_CONTEXT_PRESERVATION_MASTER_EVIDENCE),
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
    PRODUCT_RACING_CONTEXT_PRESERVATION_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", requirementId);
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_RACING_CONTEXT_PRESERVATION_EVIDENCE_FILE,
    PRODUCT_RACING_CONTEXT_PRESERVATION_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  assert.equal(record.evidence.some((path) => path.startsWith("output/")), false);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], record);
}

const evidenceSource = readFileSync(
  PRODUCT_RACING_CONTEXT_PRESERVATION_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_RACING_CONTEXT_PRESERVATION_SCOPE, /every \/races detail destination/i);
assert.match(PRODUCT_RACING_CONTEXT_PRESERVATION_SCOPE, /meeting anchor/i);
assert.match(PRODUCT_RACING_CONTEXT_PRESERVATION_SCOPE, /No arbitrary return URL is accepted/i);
assert.match(PRODUCT_RACING_CONTEXT_PRESERVATION_SCOPE, /URL context construction and meeting-anchor restoration only/i);
assert.match(PRODUCT_RACING_CONTEXT_PRESERVATION_SCOPE, /pixel-identical scroll position/i);
assert.match(PRODUCT_RACING_CONTEXT_PRESERVATION_SCOPE, /production readiness/i);

const context = normaliseRaceListContext({
  date: "2026-07-15",
  state: "nsw",
  query: "  Wentworth   Park  ",
  status: "replay",
  sort: "relevance",
  meetingId: "meeting_42",
});
const detailHref = buildRaceDetailHref("race_7", context);
assert.equal(
  detailHref,
  "/races/race_7?fromDate=2026-07-15&fromState=NSW&fromQ=Wentworth+Park&fromStatus=replay&fromSort=relevance&fromMeeting=meeting_42",
);
assert.equal(
  buildRaceListReturnHref(context),
  "/races?date=2026-07-15&state=NSW&q=Wentworth+Park&status=replay&sort=relevance#meeting-meeting_42",
);
assert.deepEqual(
  parseRaceListContext(
    Object.fromEntries(new URL(detailHref, "https://greyhoundsiq.test").searchParams),
  ),
  context,
);
assert.equal(
  buildRaceListReturnHref({
    date: "https://evil.example",
    state: "../",
    meetingId: "bad/anchor",
  }),
  "/races",
);

const listSource = readFileSync("src/app/races/page.tsx", "utf8");
for (const sourceAssertion of [
  "const listContext = normaliseRaceListContext({",
  "date: data.isGlobalSearch ? null : data.selectedDate",
  "query: data.searchQuery",
  "status: data.selectedStatus",
  "sort: data.selectedSort",
  "id={`meeting-${meeting.id}`}",
  "detailHref={buildRaceDetailHref(race.id, {",
  "meetingId: meeting.id",
  "meetingId: race.meeting.id",
]) {
  assert.ok(
    listSource.includes(sourceAssertion),
    `race list must preserve ${sourceAssertion}`,
  );
}
assert.equal(
  listSource.match(/buildRaceDetailHref\(/g)?.length,
  5,
  "all five race-detail destination families must use the context builder",
);
assert.doesNotMatch(
  listSource,
  /href=\{`\/races\/\$\{/,
  "race detail links must not bypass context construction",
);

const detailSource = readFileSync("src/app/races/[id]/page.tsx", "utf8");
for (const sourceAssertion of [
  "parseRaceListContext(detailSearchParams)",
  "normaliseRaceListContext({",
  "meetingId: race.meeting.id",
  "href: buildRaceDetailHref(meetingRaceNavigation.previous.id, listContext)",
  "href: buildRaceDetailHref(meetingRaceNavigation.next.id, listContext)",
  "meetingHref={buildRaceListReturnHref(listContext)}",
]) {
  assert.ok(
    detailSource.includes(sourceAssertion),
    `race detail must preserve ${sourceAssertion}`,
  );
}

const navigationSource = readFileSync(
  "src/components/race-meeting-navigation.tsx",
  "utf8",
);
assert.match(navigationSource, /href=\{previous\.href\}/);
assert.match(navigationSource, /href=\{next\.href\}/);
assert.match(navigationSource, /href=\{meetingHref\}/);

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
  PRODUCT_RACING_CONTEXT_PRESERVATION_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly two completed requirements",
);

console.log(
  "Product racing context-preservation evidence passed: all race detail destinations retain bounded filters and return to a meeting anchor; 2 gates closed.",
);
