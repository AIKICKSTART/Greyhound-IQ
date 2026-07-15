export const RACING_PRESENTATION_SCHEMA_VERSION = 1 as const;

export const RACING_PRESENTATION_ROUTES = [
  "/races",
  "/meetings/[id]",
  "/races/[id]",
  "/dogs",
  "/dogs/[id]",
  "/results",
  "/statistics",
  "/tracks",
  "/tracks/[id]",
  "/breeding",
] as const;

export type RacingPresentationRoute =
  (typeof RACING_PRESENTATION_ROUTES)[number];

type RacingPresentationColumn = Readonly<{
  key: string;
  label: string;
  type:
    | "boolean"
    | "currency"
    | "date"
    | "decimal"
    | "identifier"
    | "integer"
    | "percentage"
    | "status"
    | "text"
    | "time"
    | "url";
  nullable: boolean;
}>;

type RacingPresentation = Readonly<{
  id: string;
  title: string;
  sourceFile: string;
  sourceMarkers: readonly string[];
  columns: readonly RacingPresentationColumn[];
  missingBehavior: string;
}>;

export type RacingRoutePresentationSchema = Readonly<{
  route: RacingPresentationRoute;
  presentations: readonly RacingPresentation[];
}>;

function column(
  key: string,
  label: string,
  type: RacingPresentationColumn["type"],
  nullable = false,
): RacingPresentationColumn {
  return { key, label, type, nullable };
}

export const RACING_SHARED_PRESENTATION_SCHEMA = {
  id: "data-provenance",
  title: "Racing data provenance and freshness",
  appliesTo: RACING_PRESENTATION_ROUTES,
  sourceFile: "src/components/racing-data-disclosure.tsx",
  sourceMarkers: ["Loaded sources", "Latest accepted result", "Status checked"],
  columns: [
    column("providers", "Loaded sources", "text", true),
    column("latestResultAt", "Latest accepted result", "date", true),
    column("checkedAt", "Status checked", "date"),
    column("freshnessState", "Freshness state", "status"),
  ],
  missingBehavior:
    "Show explicit unavailable attribution or freshness text; never substitute a provider or timestamp.",
} as const;

export const RACING_ROUTE_PRESENTATION_SCHEMAS = [
  {
    route: "/races",
    presentations: [
      {
        id: "schedule-metrics",
        title: "Race schedule metrics",
        sourceFile: "src/app/races/page.tsx",
        sourceMarkers: ['label="Runners"', 'label="Results"', 'label="Playable"'],
        columns: [
          column("meetingCount", "Meetings", "integer", true),
          column("raceCount", "Races", "integer", true),
          column("runnerCount", "Runners", "integer", true),
          column("resultCount", "Results", "integer", true),
          column("videoCount", "Videos", "integer", true),
          column("playableVideoCount", "Playable", "integer", true),
        ],
        missingBehavior:
          "Show Not available and an unavailable schedule summary; preserve a measured zero.",
      },
      {
        id: "meeting-racecards",
        title: "Meeting-grouped racecards",
        sourceFile: "src/app/races/page.tsx",
        sourceMarkers: ["function RaceMeetingPanel", "function RaceRowLink"],
        columns: [
          column("meeting.id", "Meeting ID", "identifier"),
          column("meeting.track.name", "Track", "text"),
          column("meeting.track.state", "State", "text"),
          column("race.id", "Race ID", "identifier"),
          column("race.raceNumber", "Race", "integer"),
          column("race.raceTime", "Start time", "time"),
          column("race.distance", "Distance", "integer"),
          column("race.runnerCount", "Runners", "integer"),
          column("race.status", "Status", "status"),
        ],
        missingBehavior:
          "Omit no meeting silently: show the no-racecards state; label changed or unresolved race status explicitly.",
      },
      {
        id: "replay-library",
        title: "Playable replay cards",
        sourceFile: "src/app/races/page.tsx",
        sourceMarkers: ["Replay library", "Playable replays on this date"],
        columns: [
          column("race.id", "Race ID", "identifier"),
          column("race.raceNumber", "Race", "integer"),
          column("race.meeting.track.name", "Track", "text"),
          column("race.distance", "Distance", "integer"),
          column("race.raceTime", "Start time", "time"),
          column("race.replay", "Replay", "url"),
        ],
        missingBehavior:
          "Render the library only for playable replay rows; the race detail owns the unavailable replay explanation.",
      },
    ],
  },
  {
    route: "/meetings/[id]",
    presentations: [
      {
        id: "meeting-summary",
        title: "Meeting identity and measured summary",
        sourceFile: "src/app/meetings/[id]/page.tsx",
        sourceMarkers: ["Stored meeting record", "Races with results", "buildMeetingSummary"],
        columns: [
          column("meeting.id", "Meeting ID", "identifier"),
          column("meeting.track.name", "Track", "text"),
          column("meeting.track.state", "State", "text"),
          column("meeting.meetingDate", "Meeting date", "date"),
          column("meeting.meetingType", "Meeting type", "text", true),
          column("summary.races", "Races", "integer"),
          column("summary.runners", "Runners", "integer"),
          column("summary.racesWithResults", "Races with results", "integer"),
          column("summary.replays", "Replays", "integer"),
        ],
        missingBehavior:
          "Return not found for an unknown meeting; preserve measured zero counts and label an absent meeting type Race meeting.",
      },
      {
        id: "meeting-racecard",
        title: "Meeting racecard rows",
        sourceFile: "src/components/meeting-detail-race-card.tsx",
        sourceMarkers: ["Open race", "presentation.runnerCount", "presentation.resultCount"],
        columns: [
          column("race.id", "Race ID", "identifier"),
          column("race.raceNumber", "Race", "integer"),
          column("race.name", "Race name", "text", true),
          column("race.raceTime", "Start time", "time"),
          column("race.distance", "Distance", "integer"),
          column("race.grade", "Grade", "text", true),
          column("race.prizeMoney", "Prize money", "currency", true),
          column("race.runnerCount", "Runners", "integer"),
          column("race.resultCount", "Results", "integer"),
          column("race.replay", "Replay", "url", true),
          column("race.status", "Status", "status"),
          column("race.winner", "Winner", "text", true),
        ],
        missingBehavior:
          "Show stored zero counts, Not available replay or grade states, and no winner until a stored first-place result exists.",
      },
    ],
  },
  {
    route: "/races/[id]",
    presentations: [
      {
        id: "race-summary",
        title: "Race identity and summary",
        sourceFile: "src/app/races/[id]/page.tsx",
        sourceMarkers: ["Race summary", 'label="Race status"', 'label="Results"'],
        columns: [
          column("race.id", "Race ID", "identifier"),
          column("race.meeting.track.name", "Track", "text"),
          column("race.raceNumber", "Race", "integer"),
          column("race.raceTime", "Start time", "time"),
          column("race.distance", "Distance", "integer"),
          column("race.grade", "Grade", "text", true),
          column("race.status", "Race status", "status"),
          column("race.resultCount", "Results", "integer"),
          column("race.replay", "Replay", "url", true),
        ],
        missingBehavior:
          "Return not found for an unknown race; show awaiting, changed, abandoned or replay-unavailable states explicitly.",
      },
      {
        id: "runner-table",
        title: "Race runner table",
        sourceFile: "src/app/races/[id]/page.tsx",
        sourceMarkers: ["Runner", "Trainer", "Wgt", "Form"],
        columns: [
          column("runner.boxNumber", "Box", "integer"),
          column("runner.dog.name", "Runner", "text"),
          column("runner.dog.trainer.name", "Trainer", "text", true),
          column("runner.weight", "Wgt", "decimal", true),
          column("runner.form", "Form", "text", true),
          column("runner.result.finishingPosition", "Result", "integer", true),
        ],
        missingBehavior:
          "Use explicit placeholders for optional trainer, weight, form and result values; do not manufacture a placing.",
      },
      {
        id: "winner-result",
        title: "Winner result presentation",
        sourceFile: "src/app/races/[id]/page.tsx",
        sourceMarkers: ['label="Winner"', 'label="Winning time"'],
        columns: [
          column("winner.dog.name", "Winner", "text"),
          column("winner.boxNumber", "Box", "integer"),
          column("winner.result.runningTime", "Winning time", "decimal", true),
          column("winner.result.margin", "Margin", "decimal", true),
        ],
        missingBehavior:
          "Do not render a winner until a stored finishing-position-one result exists; retain unavailable timing or margin.",
      },
    ],
  },
  {
    route: "/dogs",
    presentations: [
      {
        id: "dog-search-results",
        title: "Greyhound search result cards",
        sourceFile: "src/components/dog-search.tsx",
        sourceMarkers: ["Greyhound search results", "careerStarts", "careerWins"],
        columns: [
          column("dog.id", "Dog ID", "identifier"),
          column("dog.name", "Greyhound", "text"),
          column("dog.sex", "Sex", "text", true),
          column("dog.careerStarts", "Starts", "integer", true),
          column("dog.careerWins", "Wins", "integer", true),
          column("dog.prizeMoney", "Prize money", "currency", true),
          column("dog.sire.name", "Sire", "text", true),
          column("dog.dam.name", "Dam", "text", true),
        ],
        missingBehavior:
          "Show the explicit no-match or request-error state; omit only optional profile facts without substituting values.",
      },
      {
        id: "dataset-tallies",
        title: "Dog-search dataset tallies",
        sourceFile: "src/app/dogs/page.tsx",
        sourceMarkers: ['label: "Greyhounds"', 'label: "Races"', 'label: "Results"'],
        columns: [
          column("tallies.dogs", "Greyhounds", "integer"),
          column("tallies.races", "Races", "integer"),
          column("tallies.results", "Results", "integer"),
        ],
        missingBehavior:
          "Present stored query totals only; the route does not invent per-search result counts.",
      },
    ],
  },
  {
    route: "/dogs/[id]",
    presentations: [
      {
        id: "dog-profile-summary",
        title: "Greyhound profile and career summary",
        sourceFile: "src/app/dogs/[id]/page.tsx",
        sourceMarkers: ['label: "Starts"', 'label: "Prize Money"', "dog.whelpDate"],
        columns: [
          column("dog.id", "Dog ID", "identifier"),
          column("dog.name", "Greyhound", "text"),
          column("dog.sex", "Sex", "text", true),
          column("dog.colour", "Colour", "text", true),
          column("dog.trainer.name", "Trainer", "text", true),
          column("dog.whelpDate", "Whelped", "date", true),
          column("dog.earBrand", "Ear brand", "text", true),
          column("career.starts", "Starts", "integer"),
          column("career.wins", "Wins", "integer"),
          column("career.placings", "Placings", "integer"),
          column("dog.prizeMoney", "Prize money", "currency", true),
        ],
        missingBehavior:
          "Return not found for an unknown dog; show a dash for missing prize money and suppress internal source identifiers.",
      },
      {
        id: "pedigree",
        title: "Greyhound pedigree",
        sourceFile: "src/app/dogs/[id]/page.tsx",
        sourceMarkers: ["Pedigree", "Sire", "Dam"],
        columns: [
          column("dog.sire.name", "Sire", "text", true),
          column("dog.dam.name", "Dam", "text", true),
        ],
        missingBehavior:
          "Show Unknown for an absent immediate parent and omit the pedigree panel only when both parents are absent.",
      },
      {
        id: "recent-form",
        title: "Greyhound recent-form table",
        sourceFile: "src/app/dogs/[id]/page.tsx",
        sourceMarkers: ["Recent Form", '"Winner / 2nd"', '"1st Sec"'],
        columns: [
          column("form.date", "Date", "date"),
          column("form.trackName", "Track", "text"),
          column("form.distance", "Dist", "integer", true),
          column("form.boxNumber", "Box", "integer", true),
          column("form.finish", "Finish", "integer", true),
          column("form.time", "Time", "decimal", true),
          column("form.grade", "Grade", "text", true),
          column("form.weight", "Wgt", "decimal", true),
          column("form.firstSectional", "1st Sec", "decimal", true),
          column("form.margin", "Mgn", "decimal", true),
          column("form.winnerDogName", "Winner / 2nd", "text", true),
          column("form.replayHref", "Video", "url", true),
        ],
        missingBehavior:
          "Keep nullable cells visibly unavailable and expose replay unavailable rather than creating a link.",
      },
    ],
  },
  {
    route: "/results",
    presentations: [
      {
        id: "result-race-summary",
        title: "Settled race result summary",
        sourceFile: "src/app/results/page.tsx",
        sourceMarkers: ["function ResultRaceCard", "formatRaceDateTime"],
        columns: [
          column("race.id", "Race ID", "identifier"),
          column("race.raceNumber", "Race", "integer"),
          column("race.title", "Race title", "text"),
          column("race.grade", "Grade", "text", true),
          column("race.meeting.track.name", "Track", "text"),
          column("race.meeting.track.state", "State", "text"),
          column("race.distance", "Distance", "integer"),
          column("race.raceTime", "Start time", "time"),
          column("winner.dog.name", "Winner", "text", true),
        ],
        missingBehavior:
          "Show the no-settled-results state for an empty collection and do not nominate a winner without a stored result.",
      },
      {
        id: "result-runner-table",
        title: "Settled result runner table",
        sourceFile: "src/app/results/page.tsx",
        sourceMarkers: [">Box</th>", ">Dog</th>", ">Result</th>"],
        columns: [
          column("runner.boxNumber", "Box", "integer"),
          column("runner.dog.name", "Dog", "text"),
          column("runner.dog.trainer.name", "Trainer", "text", true),
          column("runner.weight", "Wgt", "decimal", true),
          column("runner.form", "Form", "text", true),
          column("runner.result.finishingPosition", "Result", "integer", true),
        ],
        missingBehavior:
          "Keep optional runner cells unavailable; a race is excluded from this route when it has no settled runner result.",
      },
    ],
  },
  {
    route: "/statistics",
    presentations: [
      {
        id: "box-bias",
        title: "Box win-rate chart",
        sourceFile: "src/app/statistics/page.tsx",
        sourceMarkers: ["Box Win Rate — All Tracks", "formatBoxBiasRate(b)"],
        columns: [
          column("boxBias.box", "Box", "integer"),
          column("boxBias.starts", "Starts", "integer", true),
          column("boxBias.wins", "Wins", "integer", true),
          column("boxBias.winRate", "Win rate", "percentage", true),
        ],
        missingBehavior:
          "Always render boxes one through eight; label an undefined rate Not available and show the aggregate empty state.",
      },
      {
        id: "trainer-leaderboard",
        title: "Trainer leaderboard table",
        sourceFile: "src/app/statistics/page.tsx",
        sourceMarkers: ["Trainer Leaderboard", ">Prize money</th>"],
        columns: [
          column("rank", "Rank", "integer"),
          column("trainer.name", "Trainer", "text"),
          column("trainer.wins", "Wins", "integer"),
          column("trainer.starts", "Starts", "integer"),
          column("trainer.places", "Places", "integer"),
          column("trainer.winRate", "Win rate", "percentage"),
          column("trainer.prizeMoney", "Prize money", "currency"),
        ],
        missingBehavior:
          "Show the trainer-statistics unavailable panel for an empty aggregate; do not fabricate ranks.",
      },
      {
        id: "track-records",
        title: "Current track-record cards",
        sourceFile: "src/app/statistics/page.tsx",
        sourceMarkers: ["Current Track Records", "TRACK_RECORDS.map"],
        columns: [
          column("record.track", "Track", "text"),
          column("record.distance", "Distance", "integer"),
          column("record.time", "Time", "decimal"),
          column("record.dog", "Dog", "text"),
          column("record.year", "Year", "integer"),
        ],
        missingBehavior:
          "Show the track-record unavailable panel for an empty aggregate; never substitute example records.",
      },
    ],
  },
  {
    route: "/tracks",
    presentations: [
      {
        id: "featured-track",
        title: "Featured track summary",
        sourceFile: "src/app/tracks/page.tsx",
        sourceMarkers: ['label="Latest meeting"', 'label="Next race"'],
        columns: [
          column("track.id", "Track ID", "identifier"),
          column("track.name", "Track", "text"),
          column("track.state", "State", "text"),
          column("track.surface", "Surface", "text", true),
          column("track.latestMeetingDate", "Latest meeting", "date", true),
          column("track.raceCount", "Races", "integer"),
          column("track.replayCount", "Replays", "integer"),
          column("track.nextRace", "Next race", "time", true),
        ],
        missingBehavior:
          "Use No meeting or Complete for absent schedule facts; omit the featured block when no track exists.",
      },
      {
        id: "venue-cards",
        title: "Track venue cards",
        sourceFile: "src/app/tracks/page.tsx",
        sourceMarkers: ["function TrackVenueCard", "meetingCount", "replayCount"],
        columns: [
          column("track.id", "Track ID", "identifier"),
          column("track.name", "Track", "text"),
          column("track.state", "State", "text"),
          column("track.hasGps", "GPS", "boolean"),
          column("track.meetingCount", "Meetings", "integer"),
          column("track.replayCount", "Replays", "integer"),
          column("track.races", "Races", "text"),
        ],
        missingBehavior:
          "Show the no-matching-tracks state for an empty filter and omit only optional media or replay badges.",
      },
    ],
  },
  {
    route: "/tracks/[id]",
    presentations: [
      {
        id: "track-summary",
        title: "Track identity and metrics",
        sourceFile: "src/app/tracks/[id]/page.tsx",
        sourceMarkers: ['label="Meetings"', 'label="Boxes"', 'label="GPS"'],
        columns: [
          column("track.id", "Track ID", "identifier"),
          column("track.name", "Track", "text"),
          column("track.state", "State", "text"),
          column("track.meetingCount", "Meetings", "integer"),
          column("track.raceCount", "Races", "integer"),
          column("track.boxCount", "Boxes", "integer"),
          column("track.hasIsolynx", "GPS", "boolean"),
        ],
        missingBehavior:
          "Return not found for an unknown track and preserve measured zero meeting or race counts.",
      },
      {
        id: "recent-meetings",
        title: "Recent meeting and race links",
        sourceFile: "src/app/tracks/[id]/page.tsx",
        sourceMarkers: ["Recent meetings", "meeting.races.slice"],
        columns: [
          column("meeting.id", "Meeting ID", "identifier"),
          column("meeting.meetingDate", "Meeting date", "date"),
          column("meeting.meetingType", "Meeting type", "text", true),
          column("meeting.raceCount", "Races", "integer"),
          column("race.raceNumber", "Race", "integer"),
          column("race.raceTime", "Start time", "time"),
          column("race.distance", "Distance", "integer"),
        ],
        missingBehavior:
          "Retain the route with a zero meeting count; use Race meeting when the optional meeting type is absent.",
      },
      {
        id: "track-profile",
        title: "Track profile facts",
        sourceFile: "src/app/tracks/[id]/page.tsx",
        sourceMarkers: ["Track profile", 'label="Circumference"', 'label="Straight"'],
        columns: [
          column("track.state", "State", "text"),
          column("track.surface", "Surface", "text", true),
          column("track.circumference", "Circumference", "decimal", true),
          column("track.straightLength", "Straight", "decimal", true),
        ],
        missingBehavior:
          "Show Unknown or a dash for missing optional physical properties; do not infer dimensions.",
      },
      {
        id: "observed-record-and-box-wins",
        title: "Observed record and box-win chart",
        sourceFile: "src/app/tracks/[id]/page.tsx",
        sourceMarkers: ["Seeded record", "Box wins", "boxWins.map"],
        columns: [
          column("bestRun.runningTime", "Time", "decimal", true),
          column("bestRun.dog.name", "Dog", "text", true),
          column("bestRun.race.raceNumber", "Race", "integer", true),
          column("bestRun.race.distance", "Distance", "integer", true),
          column("boxWins.box", "Box", "integer"),
          column("boxWins.wins", "Wins", "integer"),
        ],
        missingBehavior:
          "Show no completed races when the observed record is absent; preserve zero wins for each configured box.",
      },
    ],
  },
  {
    route: "/breeding",
    presentations: [
      {
        id: "sire-leaderboard",
        title: "Active sire leaderboard",
        sourceFile: "src/app/breeding/page.tsx",
        sourceMarkers: ["Top Active Sires", ">Progeny</th>", ">Earnings</th>"],
        columns: [
          column("sire.name", "Sire", "text"),
          column("sire.progeny", "Progeny", "integer"),
          column("sire.winners", "Winners", "integer"),
          column("sire.strike", "Strike %", "percentage", true),
          column("sire.earnings", "Earnings", "currency"),
        ],
        missingBehavior:
          "Show the sire-statistics unavailable panel for an empty aggregate and Not available for an undefined strike rate.",
      },
    ],
  },
] as const satisfies readonly RacingRoutePresentationSchema[];

export function getRacingPresentationSchema(route: RacingPresentationRoute) {
  return RACING_ROUTE_PRESENTATION_SCHEMAS.find(
    (schema) => schema.route === route,
  );
}
