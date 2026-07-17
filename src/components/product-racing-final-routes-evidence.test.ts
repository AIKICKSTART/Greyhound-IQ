import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  formatDogPrizeMoney,
  formatDogWinRate,
} from "../lib/dog-statistic-presentation";
import {
  buildMeetingRacePresentation,
  buildMeetingSummary,
} from "../lib/meeting-presentation";
import { SCREEN_CONTRACT_BY_ROUTE } from "./demo-experience-registry";
import {
  PRODUCT_RACING_FINAL_ROUTES_EVIDENCE_FILE,
  PRODUCT_RACING_FINAL_ROUTES_EXPECTED_GAIN,
  PRODUCT_RACING_FINAL_ROUTES_MASTER_EVIDENCE,
  PRODUCT_RACING_FINAL_ROUTES_REQUIREMENT_IDS,
  PRODUCT_RACING_FINAL_ROUTES_SCOPE,
  PRODUCT_RACING_FINAL_ROUTES_TEST_FILE,
} from "./product-racing-final-routes-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  RACING_PRESENTATION_ROUTES,
  RACING_ROUTE_PRESENTATION_SCHEMAS,
} from "./racing-presentation-schema";
import { RACING_STATISTIC_LINEAGE } from "./racing-statistic-lineage";
import { getRacingOnboardingRouteTour } from "./racing-onboarding-tour-registry";
import { PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_CONTRACTS } from "./screen-contracts/production-screen-public-racing-interactions";
import { PUBLIC_SCREEN_PERMISSION_CONTRACTS } from "./screen-contracts/screen-permission-evidence";
import { PRODUCTION_SCREEN_STATE_CONTRACTS } from "./screen-contracts/screen-state-evidence";

const completedIds = [...PRODUCT_RACING_FINAL_ROUTES_REQUIREMENT_IDS];
assert.deepEqual(completedIds, [
  "ROUTE.RACING.open-meeting",
  "ROUTE.RACING.no-invention",
]);
assert.equal(PRODUCT_RACING_FINAL_ROUTES_EXPECTED_GAIN, 2);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.deepEqual(
  Object.keys(PRODUCT_RACING_FINAL_ROUTES_MASTER_EVIDENCE),
  completedIds,
);

const requirementById = new Map(
  PRODUCT_MASTER_REQUIREMENTS.map((requirement) => [requirement.id, requirement]),
);
assert.equal(
  requirementById.get("ROUTE.RACING.open-meeting")?.requirement,
  "Support opening a meeting.",
);
assert.equal(
  requirementById.get("ROUTE.RACING.no-invention")?.requirement,
  "Do not invent racing statistics.",
);

for (const requirementId of completedIds) {
  const record = PRODUCT_RACING_FINAL_ROUTES_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_RACING_FINAL_ROUTES_EVIDENCE_FILE,
    PRODUCT_RACING_FINAL_ROUTES_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  assert.equal(record.evidence.some((path) => path.startsWith("output/")), false);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

const evidenceSource = readFileSync(
  PRODUCT_RACING_FINAL_ROUTES_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_RACING_FINAL_ROUTES_SCOPE, /bounded stored meeting/i);
assert.match(PRODUCT_RACING_FINAL_ROUTES_SCOPE, /all 24 numeric presentations/i);
assert.match(PRODUCT_RACING_FINAL_ROUTES_SCOPE, /all ten public racing routes/i);
assert.match(PRODUCT_RACING_FINAL_ROUTES_SCOPE, /zero-versus-missing/i);
assert.match(PRODUCT_RACING_FINAL_ROUTES_SCOPE, /does not execute a live database query/i);
assert.match(PRODUCT_RACING_FINAL_ROUTES_SCOPE, /does not.*prove browser rendering/i);
assert.match(PRODUCT_RACING_FINAL_ROUTES_SCOPE, /production readiness/i);

const meetingScreen = SCREEN_CONTRACT_BY_ROUTE.get("/meetings/[id]");
assert.ok(meetingScreen);
assert.equal(
  meetingScreen.concreteRoute,
  "/meetings/demo-provider-meeting",
);
assert.equal(meetingScreen.productionEnabled, true);
assert.equal(meetingScreen.authentication, "optional");
assert.equal(meetingScreen.coverage.permissions.status, "tested");
assert.equal(meetingScreen.coverage.states.status, "verified");
assert.equal(meetingScreen.coverage.actions.status, "verified");
assert.equal(meetingScreen.coverage.forms.status, "excluded");

const permission = PUBLIC_SCREEN_PERMISSION_CONTRACTS.find(
  ({ route }) => route === "/meetings/[id]",
);
assert.ok(permission);
assert.equal(permission.permissions[0]?.decision, "allow");

const meetingStates = PRODUCTION_SCREEN_STATE_CONTRACTS.find(
  ({ route }) => route === "/meetings/[id]",
);
assert.deepEqual(
  meetingStates?.states.map(({ id }) => id),
  [
    "PRODUCTION.STATE.MEETING-DETAIL.LOADING",
    "PRODUCTION.STATE.MEETING-DETAIL.MISSING",
    "PRODUCTION.STATE.MEETING-DETAIL.EMPTY-RACES",
    "PRODUCTION.STATE.MEETING-DETAIL.POPULATED",
  ],
);

const meetingInteractions =
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_CONTRACTS["/meetings/[id]"];
assert.deepEqual(
  meetingInteractions.actions.map(({ id }) => id),
  [
    "MEETING-DETAIL.ACTION.RACE-DAY.OPEN",
    "MEETING-DETAIL.ACTION.TRACK.OPEN",
    "MEETING-DETAIL.ACTION.RACE.OPEN",
    "MEETING-DETAIL.ACTION.WINNER.OPEN",
  ],
);
assert.deepEqual(meetingInteractions.forms, []);
assert.equal(
  getRacingOnboardingRouteTour(
    "/meetings/demo-provider-meeting",
  )?.route,
  "/meetings/[id]",
);

const meetingPage = readFileSync("src/app/meetings/[id]/page.tsx", "utf8");
for (const marker of [
  "const meeting = await getMeetingById(id);",
  "if (!meeting) notFound();",
  "buildMeetingSummary(",
  "<MeetingDetailRaceCard",
  "No race rows are available for this stored meeting.",
]) {
  assert.ok(meetingPage.includes(marker), `meeting page must preserve ${marker}`);
}

const queriesSource = readFileSync("src/lib/queries.ts", "utf8");
for (const marker of [
  "export const getMeetingById = cache(async (id: string) => {",
  "meeting.findUnique",
  "take: 24",
  "_count: { select: { runners: true } }",
  "videos: {",
  "take: 1",
]) {
  assert.ok(queriesSource.includes(marker), `meeting query must preserve ${marker}`);
}

const storedRace = buildMeetingRacePresentation(
  {
    resultStatus: "Final",
    raceTime: new Date("2026-07-15T02:00:00Z"),
    replayUrl: null,
    _count: { runners: 0 },
    videos: [],
    runners: [],
  },
  new Date("2026-07-15T03:00:00Z"),
);
assert.equal(storedRace.runnerCount, 0);
assert.equal(storedRace.resultCount, 0);
assert.equal(storedRace.hasReplay, false);
assert.deepEqual(buildMeetingSummary([storedRace]), {
  races: 1,
  runners: 0,
  racesWithResults: 0,
  replays: 0,
});

const numericTypes = new Set(["currency", "decimal", "integer", "percentage"]);
const numericPresentations = RACING_ROUTE_PRESENTATION_SCHEMAS.flatMap(
  ({ route, presentations }) =>
    presentations.flatMap((presentation) => {
      const metricKeys = presentation.columns
        .filter(({ type }) => numericTypes.has(type))
        .map(({ key }) => key);
      return metricKeys.length > 0
        ? [{ route, presentationId: presentation.id, metricKeys }]
        : [];
    }),
);
assert.equal(RACING_PRESENTATION_ROUTES.length, 10);
assert.equal(numericPresentations.length, 24);
assert.equal(RACING_STATISTIC_LINEAGE.length, numericPresentations.length);
for (const presentation of numericPresentations) {
  const lineage = RACING_STATISTIC_LINEAGE.find(
    (candidate) =>
      candidate.route === presentation.route &&
      candidate.presentationId === presentation.presentationId,
  );
  assert.ok(lineage, `${presentation.route}/${presentation.presentationId}`);
  assert.deepEqual(
    [...lineage.metricKeys].toSorted(),
    presentation.metricKeys.toSorted(),
  );
  assert.ok(lineage.missingRule.length >= 60);
}

assert.deepEqual(formatDogPrizeMoney(0), {
  state: "measured",
  text: "$0",
});
assert.deepEqual(formatDogPrizeMoney(null), {
  state: "missing",
  text: "Not available",
});
assert.deepEqual(formatDogWinRate({ wins: 0, starts: 0 }), {
  state: "missing",
  text: "Not available",
});
assert.deepEqual(formatDogWinRate({ wins: 1, starts: 4 }), {
  state: "measured",
  text: "25.0%",
});

for (const [path, forbidden] of [
  ["src/lib/queries.ts", 'counts.get("Dog") ?? 0'],
  ["src/lib/queries.ts", 'counts.get("Race") ?? 0'],
  ["src/lib/queries.ts", 'counts.get("Result") ?? 0'],
  ["src/app/tracks/[id]/page.tsx", "runningTime ?? 99"],
  ["src/app/statistics/page.tsx", "4,800+ meetings"],
] as const) {
  assert.equal(
    readFileSync(path, "utf8").includes(forbidden),
    false,
    `${path} must not contain fabricated fallback ${forbidden}`,
  );
}

console.log(
  "Product racing final-route evidence passed in isolation: meeting detail and exhaustive numeric lineage are ready for exact +2 central wiring; no live database, browser-audit or production claim.",
);
