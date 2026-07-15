import type { RacingPresentationRoute } from "./racing-presentation-schema";

export type RacingStatisticLineageRecord = Readonly<{
  route: RacingPresentationRoute;
  presentationId: string;
  metricKeys: readonly string[];
  derivation:
    | "planner-estimate"
    | "stored-count"
    | "stored-field"
    | "stored-minimum"
    | "stored-ratio"
    | "stored-sum"
    | "time-difference";
  sourceFiles: readonly Readonly<{
    file: string;
    markers: readonly string[];
  }>[];
  missingRule: string;
}>;

export const RACING_STATISTIC_LINEAGE = [
  {
    route: "/races",
    presentationId: "schedule-metrics",
    metricKeys: [
      "meetingCount",
      "raceCount",
      "runnerCount",
      "resultCount",
      "videoCount",
      "playableVideoCount",
    ],
    derivation: "stored-count",
    sourceFiles: [
      {
        file: "src/lib/queries.ts",
        markers: ["getRaceDateSummary", "summary.runners += race._count.runners"],
      },
      {
        file: "src/lib/race-metric.ts",
        markers: ["formatRaceMetric", "Meeting and race totals are not available"],
      },
    ],
    missingRule: "Query failure remains null and is displayed as Not available; a stored zero remains zero.",
  },
  {
    route: "/races",
    presentationId: "meeting-racecards",
    metricKeys: ["race.raceNumber", "race.distance", "race.runnerCount"],
    derivation: "stored-field",
    sourceFiles: [
      {
        file: "src/lib/queries.ts",
        markers: ["getRaceExplorerMeetings", "runnersByRace.get(race.id)"],
      },
    ],
    missingRule: "Only stored race rows and grouped runner counts are rendered; an empty query has an explicit state.",
  },
  {
    route: "/races",
    presentationId: "replay-library",
    metricKeys: ["race.raceNumber", "race.distance"],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["replayRaces", "videos: { some: { streamUrl"] },
    ],
    missingRule: "A replay card requires a stored playable stream; no example card is substituted.",
  },
  {
    route: "/meetings/[id]",
    presentationId: "meeting-summary",
    metricKeys: [
      "summary.races",
      "summary.runners",
      "summary.racesWithResults",
      "summary.replays",
    ],
    derivation: "stored-count",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["getMeetingById", "_count: { select: { runners: true } }"] },
      { file: "src/lib/meeting-presentation.ts", markers: ["buildMeetingSummary", "race.runnerCount"] },
    ],
    missingRule: "Counts reduce the selected stored rows and preserve valid zero; an unknown meeting returns not found.",
  },
  {
    route: "/meetings/[id]",
    presentationId: "meeting-racecard",
    metricKeys: [
      "race.raceNumber",
      "race.distance",
      "race.prizeMoney",
      "race.runnerCount",
      "race.resultCount",
    ],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["getMeetingById", "prizeMoney: true", "finishingPosition: true"] },
      { file: "src/lib/meeting-presentation.ts", markers: ["buildMeetingRacePresentation", "settledRunners.length"] },
    ],
    missingRule: "The card uses selected race, runner and result fields; absent prize or result values stay unavailable.",
  },
  {
    route: "/races/[id]",
    presentationId: "race-summary",
    metricKeys: ["race.raceNumber", "race.distance", "race.resultCount"],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["getRaceById", "runners:", "result: true"] },
      { file: "src/app/races/[id]/page.tsx", markers: ["const resultCount", "race.runners.filter"] },
    ],
    missingRule: "The route derives the result count from selected runner-result relations and returns not found for no race.",
  },
  {
    route: "/races/[id]",
    presentationId: "runner-table",
    metricKeys: ["runner.boxNumber", "runner.weight", "runner.result.finishingPosition"],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["boxNumber: true", "weight: true", "result: true"] },
    ],
    missingRule: "Optional weight and result cells display their explicit unavailable presentation.",
  },
  {
    route: "/races/[id]",
    presentationId: "winner-result",
    metricKeys: ["winner.boxNumber", "winner.result.runningTime", "winner.result.margin"],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/app/races/[id]/page.tsx", markers: ["finishingPosition === 1", 'label="Winning time"'] },
    ],
    missingRule: "Winner output requires a stored first-place result; timing and margin remain unavailable when absent.",
  },
  {
    route: "/dogs",
    presentationId: "dog-search-results",
    metricKeys: ["dog.careerStarts", "dog.careerWins", "dog.prizeMoney"],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/components/dog-search.tsx", markers: ["careerStarts", "careerWins", "formatDogPrizeMoney"] },
      { file: "src/lib/dog-statistic-presentation.ts", markers: ["value == null", "currencyFormatter.format(value)"] },
    ],
    missingRule: "Nullable career values remain optional, while measured prize money including zero is formatted from the stored value.",
  },
  {
    route: "/dogs",
    presentationId: "dataset-tallies",
    metricKeys: ["tallies.dogs", "tallies.races", "tallies.results"],
    derivation: "planner-estimate",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["getDogSearchTallies", 'counts.get("Dog") ?? null'] },
      { file: "src/app/dogs/page.tsx", markers: ["formatRaceMetric(tallies.dogs)", "never replaced"] },
    ],
    missingRule: "Missing planner estimates remain null and display Not available; zero is never used as an error fallback.",
  },
  {
    route: "/dogs/[id]",
    presentationId: "dog-profile-summary",
    metricKeys: ["career.starts", "career.wins", "career.placings", "dog.prizeMoney"],
    derivation: "stored-count",
    sourceFiles: [
      {
        file: "src/app/dogs/[id]/page.tsx",
        markers: [
          "dog.careerStats.wins",
          "dog.careerStats.starts",
          "formatDogWinRate",
          "formatDogPrizeMoney",
        ],
      },
    ],
    missingRule: "Career counts derive from stored form rows; no-start win rate is unavailable and measured prize zero stays visible.",
  },
  {
    route: "/dogs/[id]",
    presentationId: "recent-form",
    metricKeys: [
      "form.distance",
      "form.boxNumber",
      "form.finish",
      "form.time",
      "form.weight",
      "form.firstSectional",
      "form.margin",
    ],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/app/dogs/[id]/page.tsx", markers: ["buildRecentForm", "formatDistance", "formatNumber"] },
    ],
    missingRule: "Each nullable form cell uses the format helper's unavailable marker; no timing or placing is inferred.",
  },
  {
    route: "/results",
    presentationId: "result-race-summary",
    metricKeys: ["race.raceNumber", "race.distance"],
    derivation: "stored-field",
    sourceFiles: [
      {
        file: "src/lib/queries.ts",
        markers: [
          "getRecentResults",
          "runners: { some: { result: { isNot: null } } }",
        ],
      },
    ],
    missingRule: "Only races with selected stored results enter this screen; no winner is synthesized.",
  },
  {
    route: "/results",
    presentationId: "result-runner-table",
    metricKeys: ["runner.boxNumber", "runner.weight", "runner.result.finishingPosition"],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/app/results/page.tsx", markers: ["race.runners.map", "showResults"] },
    ],
    missingRule: "Runner result cells bind the selected runner rows and preserve optional weight or placing.",
  },
  {
    route: "/statistics",
    presentationId: "box-bias",
    metricKeys: ["boxBias.box", "boxBias.starts", "boxBias.wins", "boxBias.winRate"],
    derivation: "stored-ratio",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["FROM giq_box_bias", "r.starts > 0"] },
      { file: "src/lib/racing-statistics-presentation.ts", markers: ["buildBoxBiasPresentation", "hasMeasuredRate"] },
    ],
    missingRule: "All eight boxes remain visible; a rate requires positive stored starts and otherwise displays Not available.",
  },
  {
    route: "/statistics",
    presentationId: "trainer-leaderboard",
    metricKeys: [
      "rank",
      "trainer.wins",
      "trainer.starts",
      "trainer.places",
      "trainer.winRate",
      "trainer.prizeMoney",
    ],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["FROM giq_trainer_performance", 'win_rate AS "winRate"'] },
    ],
    missingRule: "Rank is array position after the stored aggregate ordering; no rows produces the unavailable panel.",
  },
  {
    route: "/statistics",
    presentationId: "track-records",
    metricKeys: ["record.distance", "record.time", "record.year"],
    derivation: "stored-minimum",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["FROM giq_track_records", "ORDER BY track ASC"] },
    ],
    missingRule: "Only materialized record rows render; an empty view shows unavailable instead of example values.",
  },
  {
    route: "/tracks",
    presentationId: "featured-track",
    metricKeys: ["track.raceCount", "track.replayCount"],
    derivation: "stored-count",
    sourceFiles: [
      { file: "src/app/tracks/page.tsx", markers: ["featuredTrack.races.length", "featuredTrack.replayCount"] },
    ],
    missingRule: "Counts derive from the selected track projection; the featured block is absent when no stored track exists.",
  },
  {
    route: "/tracks",
    presentationId: "venue-cards",
    metricKeys: ["track.meetingCount", "track.replayCount"],
    derivation: "stored-count",
    sourceFiles: [
      { file: "src/app/tracks/page.tsx", markers: ["track.meetingCount", "track.replayCount"] },
    ],
    missingRule: "Venue badges use the queried meeting and replay counts and preserve stored zero.",
  },
  {
    route: "/tracks/[id]",
    presentationId: "track-summary",
    metricKeys: ["track.meetingCount", "track.raceCount", "track.boxCount"],
    derivation: "stored-count",
    sourceFiles: [
      { file: "src/app/tracks/[id]/page.tsx", markers: ["track.meetings.length", "races.length", "track.boxCount"] },
    ],
    missingRule: "Meeting and race counts reduce selected stored rows; box count is the stored track field.",
  },
  {
    route: "/tracks/[id]",
    presentationId: "recent-meetings",
    metricKeys: ["meeting.raceCount", "race.raceNumber", "race.distance"],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["getTrackById", "racesByMeeting", "raceNumber"] },
    ],
    missingRule: "Recent meeting cards bind selected meeting and race rows; zero races remains a measured count.",
  },
  {
    route: "/tracks/[id]",
    presentationId: "track-profile",
    metricKeys: ["track.circumference", "track.straightLength"],
    derivation: "stored-field",
    sourceFiles: [
      { file: "src/app/tracks/[id]/page.tsx", markers: ["track.circumference", "track.straightLength"] },
    ],
    missingRule: "Optional stored dimensions show a dash and are never inferred from other tracks.",
  },
  {
    route: "/tracks/[id]",
    presentationId: "observed-record-and-box-wins",
    metricKeys: [
      "bestRun.runningTime",
      "bestRun.race.raceNumber",
      "bestRun.race.distance",
      "boxWins.box",
      "boxWins.wins",
    ],
    derivation: "stored-minimum",
    sourceFiles: [
      { file: "src/app/tracks/[id]/page.tsx", markers: ["runningTime != null", "finishingPosition === 1", "boxWins"] },
    ],
    missingRule: "The minimum uses only non-null stored times; box wins count stored first-place results and preserve zero.",
  },
  {
    route: "/breeding",
    presentationId: "sire-leaderboard",
    metricKeys: ["sire.progeny", "sire.winners", "sire.strike", "sire.earnings"],
    derivation: "stored-ratio",
    sourceFiles: [
      { file: "src/lib/queries.ts", markers: ["FROM giq_sire_leaderboard", "r.progeny > 0"] },
    ],
    missingRule: "Leaderboard fields come from the materialized view; strike requires positive progeny and otherwise stays unavailable.",
  },
] as const satisfies readonly RacingStatisticLineageRecord[];
