import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_RACING_STRUCTURE_EVIDENCE_FILE,
  PRODUCT_RACING_STRUCTURE_EXPECTED_GAIN,
  PRODUCT_RACING_STRUCTURE_FOCUSED_CONTRACT_FILES,
  PRODUCT_RACING_STRUCTURE_MASTER_EVIDENCE,
  PRODUCT_RACING_STRUCTURE_OPEN_GAPS,
  PRODUCT_RACING_STRUCTURE_OPEN_REQUIREMENT_IDS,
  PRODUCT_RACING_STRUCTURE_REQUIREMENT_IDS,
  PRODUCT_RACING_STRUCTURE_TEST_FILE,
} from "./product-racing-structure-evidence";

// screen-evidence-test-id: PRODUCT-RACING-STRUCTURE-EVIDENCE

const EXPECTED_CLOSED_IDS = [
  "RACING.STRUCT.hero",
  "RACING.STRUCT.todays-races",
  "RACING.STRUCT.meeting-cards",
  "RACING.STRUCT.race-cards",
  "RACING.STRUCT.live",
  "RACING.STRUCT.upcoming",
  "RACING.STRUCT.resulted",
  "RACING.STRUCT.replay",
  "RACING.STRUCT.date-navigation",
  "RACING.STRUCT.state-filters",
  "RACING.STRUCT.status-filters",
  "RACING.STRUCT.sort",
  "RACING.STRUCT.search",
  "RACING.STRUCT.track-groupings",
  "RACING.STRUCT.runner-counts",
  "RACING.STRUCT.result-counts",
  "RACING.STRUCT.video-counts",
  "RACING.STRUCT.dog-profiles",
  "RACING.STRUCT.track-profiles",
  "RACING.STRUCT.race-details",
  "RACING.STRUCT.results",
  "RACING.STRUCT.breeding",
  "RACING.STRUCT.statistics",
  "RACING.STRUCT.box-win-rate",
  "RACING.STRUCT.trainer-leaderboards",
  "RACING.STRUCT.track-records",
  "RACING.STRUCT.responsible-use",
  "RACING.STRUCT.layout",
] as const;

const EXPECTED_OPEN_IDS = [] as const;

const FOCUSED_EVIDENCE_IDS = [
  "RACING.STRUCT.source-disclosure",
  "RACING.STRUCT.update-disclosure",
  "RACING.STRUCT.missing-data",
  "RACING.STRUCT.typed-snapshot",
  "RACING.STRUCT.schema",
] as const;

const EXPECTED_FOCUSED_CONTRACTS = [
  "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
  "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
  "src/components/screen-contracts/screen-state-evidence.test.ts",
  "src/app/responsible-use/responsible-use-contract.test.ts",
  "src/components/json-ld.test.ts",
  "src/components/meeting-card.test.ts",
  "src/app/races/races-side-rail-contract.test.ts",
] as const;

const STALE_ROUTE_AUDIT_TESTS = new Set([
  "src/components/screen-contracts/public-racing-user-stories.test.ts",
  "src/components/screen-contracts/production-screen-coverage.test.ts",
]);

assert.deepEqual(PRODUCT_RACING_STRUCTURE_REQUIREMENT_IDS, EXPECTED_CLOSED_IDS);
assert.deepEqual(
  PRODUCT_RACING_STRUCTURE_OPEN_REQUIREMENT_IDS,
  EXPECTED_OPEN_IDS,
);
assert.deepEqual(
  PRODUCT_RACING_STRUCTURE_FOCUSED_CONTRACT_FILES,
  EXPECTED_FOCUSED_CONTRACTS,
);
assert.equal(PRODUCT_RACING_STRUCTURE_EXPECTED_GAIN, 28);

const promptRacingIds = PRODUCT_MASTER_REQUIREMENTS.filter((requirement) =>
  requirement.id.startsWith("RACING.STRUCT."),
).map((requirement) => requirement.id);
assert.equal(promptRacingIds.length, 33);
assert.deepEqual(
  [
    ...PRODUCT_RACING_STRUCTURE_REQUIREMENT_IDS,
    ...EXPECTED_OPEN_IDS,
    ...FOCUSED_EVIDENCE_IDS,
  ].toSorted(),
  promptRacingIds.toSorted(),
  "the structure batch, focused evidence and open gaps must partition every racing-structure requirement exactly once",
);

assert.deepEqual(
  Object.keys(PRODUCT_RACING_STRUCTURE_MASTER_EVIDENCE),
  EXPECTED_CLOSED_IDS,
);
assert.deepEqual(Object.keys(PRODUCT_RACING_STRUCTURE_OPEN_GAPS), EXPECTED_OPEN_IDS);

const allowedTestEvidence = new Set<string>([
  PRODUCT_RACING_STRUCTURE_TEST_FILE,
  ...EXPECTED_FOCUSED_CONTRACTS,
]);
for (const [requirementId, record] of Object.entries(
  PRODUCT_RACING_STRUCTURE_MASTER_EVIDENCE,
)) {
  assert.equal(record.status, "tested", `${requirementId}: unexpected status`);
  assert.equal(record.evidence[0], PRODUCT_RACING_STRUCTURE_EVIDENCE_FILE);
  assert.equal(record.evidence[1], PRODUCT_RACING_STRUCTURE_TEST_FILE);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  for (const evidencePath of record.evidence) {
    assert.equal(
      existsSync(evidencePath),
      true,
      `${requirementId}: missing evidence path ${evidencePath}`,
    );
    assert.equal(
      STALE_ROUTE_AUDIT_TESTS.has(evidencePath),
      false,
      `${requirementId}: stale route-audit test cannot be cited as passing`,
    );
    if (evidencePath.endsWith(".test.ts")) {
      assert.equal(
        allowedTestEvidence.has(evidencePath),
        true,
        `${requirementId}: unreviewed test evidence ${evidencePath}`,
      );
    }
  }
}

assert.equal(Object.keys(PRODUCT_RACING_STRUCTURE_OPEN_GAPS).length, 0);

const evidenceModuleSource = readFileSync(
  PRODUCT_RACING_STRUCTURE_EVIDENCE_FILE,
  "utf8",
);
for (const serverOnlySignal of [
  'from "node:',
  "from 'node:",
  "readFileSync",
  "process.cwd",
]) {
  assert.equal(
    evidenceModuleSource.includes(serverOnlySignal),
    false,
    `client-safe evidence module contains ${serverOnlySignal}`,
  );
}

const SOURCE_ASSERTIONS = {
  "src/components/page-hero.tsx": [
    "children?: ReactNode;",
    "{children}",
  ],
  "src/components/home-hero.tsx": [
    "<PageHero",
    "View Today&apos;s Races",
    'href="/pricing"',
  ],
  "src/app/page.tsx": [
    "const meetings = await getTodaysMeetings();",
    "<MeetingCard key={m.id} meeting={m} />",
    "No meetings are available for this race day yet.",
  ],
  "src/components/meeting-card.tsx": [
    "export function MeetingCard",
    "meeting.races.map((race)",
    "now.getTime() - race.raceTime.getTime() < 20 * 60 * 1000",
  ],
  "src/app/races/page.tsx": [
    "type RaceExplorerData = Awaited<ReturnType<typeof getRaceExplorerData>>;",
    'type="search"',
    '<FilterGroup label="State">',
    '<FilterGroup label="Status">',
    '<AutoSubmitSelect name="sort"',
    "<RaceMeetingPanel",
    "key={meeting.id}",
    "<RaceRowLink",
    "{race._count.runners} runners",
    'label="Results"',
    'label="Videos"',
    'label="Playable"',
    'return { label: "Live", tone: "live" };',
    'return { label: "Upcoming", tone: "upcoming" };',
    'return { label: "Abandoned", tone: "abandoned" };',
    'return { label: "Postponed", tone: "postponed" };',
    'return { label: "Replay ready", tone: "replay" };',
    'return { label: "Completed", tone: "completed" };',
    'return { label: "Awaiting result", tone: "awaiting-result" };',
  ],
  "src/lib/queries.ts": [
    "export async function getRaceExplorerData",
    'value === "upcoming"',
    'value === "live"',
    'value === "resulted"',
    'value === "replay"',
    "return { runners: { some: { result: { isNot: null } } } };",
    "export interface BoxBiasRow",
    "((r.wins / r.starts) * 100).toFixed(1)",
    "export async function getTrainerLeaderboard",
    "FROM giq_trainer_performance",
    "export async function getTrackRecords",
    "FROM giq_track_records",
  ],
  "src/app/dogs/page.tsx": [
    'badge="DOG SEARCH"',
    "<DogSearch initialQuery={initialQuery}",
  ],
  "src/app/dogs/[id]/page.tsx": [
    "if (!dog) notFound();",
    "Pedigree",
    "Recent Form",
  ],
  "src/app/tracks/page.tsx": [
    'name="state"',
    "<TrackVenueCard key={track.id} track={track} />",
    "No tracks match this state filter.",
  ],
  "src/app/tracks/[id]/page.tsx": [
    "if (!track) notFound();",
    "Recent meetings",
    "Track profile",
    "Box wins",
  ],
  "src/app/races/[id]/page.tsx": [
    "if (!race) notFound();",
    "Runners and results",
    "Race summary",
    "<RaceReplayPlayer",
  ],
  "src/app/results/page.tsx": [
    "const results = await getRecentResults",
    "<ResultRaceCard key={race.id} race={race} />",
    "No settled race results are available yet.",
  ],
  "src/app/breeding/page.tsx": [
    "const SIRE_LEADERS = (await getSireLeaderboard(8))",
    "Top Active Sires",
    'href="/dogs"',
    'href="/races"',
  ],
  "src/app/statistics/page.tsx": [
    "getBoxBias(),",
    "getTrainerLeaderboard(8),",
    "getTrackRecords(12),",
    "Box Win Rate — All Tracks",
    "Trainer Leaderboard",
    "Current Track Records",
    "formatBoxBiasRate(b)",
    "{t.winRate}%",
  ],
  "src/app/responsible-use/page.tsx": [
    "Information, not betting advice",
    "does not place or accept wagers",
    "Gambling Help Online",
  ],
  "src/components/site-footer.tsx": ['href: "/responsible-use"'],
  "src/components/demo-experience-registry.ts": [
    'route: "/breeding"',
    'route: "/dogs"',
    'route: "/dogs/[id]"',
    'route: "/races"',
    'route: "/races/[id]"',
    'route: "/results"',
    'route: "/statistics"',
    'route: "/tracks"',
    'route: "/tracks/[id]"',
  ],
  "prisma/migrations/20260710123000_add_statistics_matviews/migration.sql": [
    "CREATE MATERIALIZED VIEW IF NOT EXISTS giq_box_bias",
    'COUNT(*) FILTER (WHERE res."finishingPosition" = 1)::int AS wins',
    "CREATE MATERIALIZED VIEW IF NOT EXISTS giq_track_records",
    'ORDER BY tr.name, ra.distance, res."runningTime" ASC',
  ],
  "prisma/migrations/20260710132000_add_trainer_performance_matview/migration.sql": [
    "CREATE MATERIALIZED VIEW IF NOT EXISTS giq_trainer_performance",
    "100.0 * COUNT(*) FILTER",
    "AS win_rate",
    'COALESCE(SUM(res."prizeMoneyWon"), 0)::float AS prize_money',
  ],
} as const;

for (const [sourcePath, assertions] of Object.entries(SOURCE_ASSERTIONS)) {
  const source = readFileSync(sourcePath, "utf8");
  for (const assertion of assertions) {
    assert.equal(
      source.includes(assertion),
      true,
      `${sourcePath}: missing direct source contract ${assertion}`,
    );
  }
}

console.log(
  "Racing structure evidence passed: 28 source-static closures, 0 explicit open gaps, 7 focused contract references, stale route-audit tests excluded",
);
