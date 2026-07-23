import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_FIXTURE_EVIDENCE_FILE =
  "src/components/product-racing-fixture-evidence.ts" as const;
export const PRODUCT_RACING_FIXTURE_TEST_FILE =
  "src/components/product-racing-fixture-evidence.test.ts" as const;

export const PRODUCT_RACING_FIXTURE_EVIDENCE_SCOPE =
  "Typed, deterministic source fixtures for the 15 required racing data and dependency states, plus tests that constrain every user-facing fixture message to safe copy. This evidence does not prove rendered Design Lab coverage, browser behaviour, provider parity, live-feed correctness, or production readiness.";

export const PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS = [
  "RACING.FIX.complete",
  "RACING.FIX.partial",
  "RACING.FIX.missing",
  "RACING.FIX.zero",
  "RACING.FIX.delayed",
  "RACING.FIX.corrected",
  "RACING.FIX.no-results",
  "RACING.FIX.source-conflict",
  "RACING.FIX.suspended",
  "RACING.FIX.abandoned",
  "RACING.FIX.replay-unavailable",
  "RACING.FIX.unknown-dog",
  "RACING.FIX.unknown-track",
  "RACING.FIX.missing-breeding",
  "RACING.FIX.source-outage",
  "RACING.FIX.safe-errors",
] as const;

export type ProductRacingFixtureRequirementId =
  (typeof PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS)[number];
export type RacingFixtureRequirementId = Exclude<
  ProductRacingFixtureRequirementId,
  "RACING.FIX.safe-errors"
>;

type RacingSourceState =
  | "healthy"
  | "delayed"
  | "corrected"
  | "conflict"
  | "outage";
type RacingRecordStatus =
  | "upcoming"
  | "resulted"
  | "suspended"
  | "abandoned";

export type RacingProductionFixture = Readonly<{
  id: string;
  requirementId: RacingFixtureRequirementId;
  title: string;
  source: Readonly<{
    provider: string;
    state: RacingSourceState;
    observedAt: string;
    effectiveAt: string;
    revision: number;
    candidates: readonly Readonly<{
      provider: string;
      value: string;
    }>[];
  }>;
  record: Readonly<{
    raceId: string | null;
    meetingId: string | null;
    status: RacingRecordStatus;
    track: Readonly<{ id: string; name: string }> | null;
    dog: Readonly<{
      id: string;
      name: string;
      breeding: Readonly<{ sire: string | null; dam: string | null }>;
    }> | null;
    result: Readonly<{
      position: number;
      timeSeconds: number;
      marginLengths: number | null;
    }> | null;
    metrics: Readonly<{
      starts: number | null;
      wins: number | null;
      prizeMoneyCents: number | null;
    }>;
    replay: Readonly<{
      state: "available" | "unavailable" | "pending";
      url: string | null;
    }>;
    missingFields: readonly string[];
  }>;
  presentation: Readonly<{
    emptyState: string | null;
    warning: string | null;
    safeError: string | null;
  }>;
}>;

const HEALTHY_SOURCE = {
  provider: "Fixture Racing Feed",
  state: "healthy",
  observedAt: "2026-07-15T09:30:00.000Z",
  effectiveAt: "2026-07-15T09:30:00.000Z",
  revision: 1,
  candidates: [],
} as const;

const COMPLETE_RECORD = {
  raceId: "fixture-race-01",
  meetingId: "fixture-meeting-01",
  status: "resulted",
  track: { id: "fixture-track-01", name: "Wentworth Park" },
  dog: {
    id: "fixture-dog-01",
    name: "Fixture Flyer",
    breeding: { sire: "Fixture Sire", dam: "Fixture Dam" },
  },
  result: { position: 1, timeSeconds: 29.84, marginLengths: 1.25 },
  metrics: { starts: 28, wins: 9, prizeMoneyCents: 2485000 },
  replay: { state: "available", url: "/fixtures/replays/race-01.m3u8" },
  missingFields: [],
} as const;

export const RACING_PRODUCTION_FIXTURES = [
  {
    id: "complete-record",
    requirementId: "RACING.FIX.complete",
    title: "Complete racing record",
    source: HEALTHY_SOURCE,
    record: COMPLETE_RECORD,
    presentation: { emptyState: null, warning: null, safeError: null },
  },
  {
    id: "partial-record",
    requirementId: "RACING.FIX.partial",
    title: "Partial racing record",
    source: HEALTHY_SOURCE,
    record: {
      ...COMPLETE_RECORD,
      result: { ...COMPLETE_RECORD.result, marginLengths: null },
      missingFields: ["result.marginLengths"],
    },
    presentation: {
      emptyState: null,
      warning: "Some result details are not supplied by the current feed.",
      safeError: null,
    },
  },
  {
    id: "missing-values",
    requirementId: "RACING.FIX.missing",
    title: "Record with missing values",
    source: HEALTHY_SOURCE,
    record: {
      ...COMPLETE_RECORD,
      result: null,
      metrics: { starts: null, wins: null, prizeMoneyCents: null },
      missingFields: ["result", "metrics.starts", "metrics.wins", "metrics.prizeMoneyCents"],
    },
    presentation: {
      emptyState: "Result and career statistics are not available yet.",
      warning: null,
      safeError: null,
    },
  },
  {
    id: "zero-values",
    requirementId: "RACING.FIX.zero",
    title: "Valid zero-value record",
    source: HEALTHY_SOURCE,
    record: {
      ...COMPLETE_RECORD,
      status: "upcoming",
      result: null,
      metrics: { starts: 0, wins: 0, prizeMoneyCents: 0 },
      replay: { state: "pending", url: null },
      missingFields: [],
    },
    presentation: { emptyState: null, warning: null, safeError: null },
  },
  {
    id: "delayed-feed",
    requirementId: "RACING.FIX.delayed",
    title: "Delayed source feed",
    source: {
      ...HEALTHY_SOURCE,
      state: "delayed",
      observedAt: "2026-07-15T09:00:00.000Z",
    },
    record: COMPLETE_RECORD,
    presentation: {
      emptyState: null,
      warning: "Updates are delayed. Showing the latest confirmed racing data.",
      safeError: null,
    },
  },
  {
    id: "corrected-record",
    requirementId: "RACING.FIX.corrected",
    title: "Corrected racing record",
    source: {
      ...HEALTHY_SOURCE,
      state: "corrected",
      effectiveAt: "2026-07-15T09:35:00.000Z",
      revision: 2,
    },
    record: {
      ...COMPLETE_RECORD,
      result: { ...COMPLETE_RECORD.result, timeSeconds: 29.82 },
    },
    presentation: {
      emptyState: null,
      warning: "This result was corrected by the source and now shows revision 2.",
      safeError: null,
    },
  },
  {
    id: "no-results",
    requirementId: "RACING.FIX.no-results",
    title: "No matching results",
    source: HEALTHY_SOURCE,
    record: {
      ...COMPLETE_RECORD,
      status: "upcoming",
      result: null,
      missingFields: [],
    },
    presentation: {
      emptyState: "No races match the selected date and filters.",
      warning: null,
      safeError: null,
    },
  },
  {
    id: "source-conflict",
    requirementId: "RACING.FIX.source-conflict",
    title: "Conflicting source values",
    source: {
      ...HEALTHY_SOURCE,
      state: "conflict",
      candidates: [
        { provider: "Fixture State Feed", value: "29.82 seconds" },
        { provider: "Fixture National Feed", value: "29.84 seconds" },
      ],
    },
    record: COMPLETE_RECORD,
    presentation: {
      emptyState: null,
      warning: "Two sources disagree. Showing the last confirmed value while the result is reviewed.",
      safeError: null,
    },
  },
  {
    id: "suspended-race",
    requirementId: "RACING.FIX.suspended",
    title: "Suspended race",
    source: HEALTHY_SOURCE,
    record: { ...COMPLETE_RECORD, status: "suspended", result: null },
    presentation: {
      emptyState: null,
      warning: "This race is suspended. Timing and results are temporarily unavailable.",
      safeError: null,
    },
  },
  {
    id: "abandoned-race",
    requirementId: "RACING.FIX.abandoned",
    title: "Abandoned race",
    source: HEALTHY_SOURCE,
    record: {
      ...COMPLETE_RECORD,
      status: "abandoned",
      result: null,
      replay: { state: "unavailable", url: null },
    },
    presentation: {
      emptyState: "This race was abandoned and has no result.",
      warning: null,
      safeError: null,
    },
  },
  {
    id: "replay-unavailable",
    requirementId: "RACING.FIX.replay-unavailable",
    title: "Replay unavailable",
    source: HEALTHY_SOURCE,
    record: {
      ...COMPLETE_RECORD,
      replay: { state: "unavailable", url: null },
      missingFields: ["replay.url"],
    },
    presentation: {
      emptyState: "A replay is not available for this race.",
      warning: null,
      safeError: null,
    },
  },
  {
    id: "unknown-dog",
    requirementId: "RACING.FIX.unknown-dog",
    title: "Unknown greyhound",
    source: HEALTHY_SOURCE,
    record: {
      ...COMPLETE_RECORD,
      dog: null,
      missingFields: ["dog.id", "dog.name"],
    },
    presentation: {
      emptyState: "Greyhound details have not been matched to this runner.",
      warning: null,
      safeError: null,
    },
  },
  {
    id: "unknown-track",
    requirementId: "RACING.FIX.unknown-track",
    title: "Unknown track",
    source: HEALTHY_SOURCE,
    record: {
      ...COMPLETE_RECORD,
      track: null,
      missingFields: ["track.id", "track.name"],
    },
    presentation: {
      emptyState: "Track details have not been matched to this meeting.",
      warning: null,
      safeError: null,
    },
  },
  {
    id: "missing-breeding",
    requirementId: "RACING.FIX.missing-breeding",
    title: "Missing breeding data",
    source: HEALTHY_SOURCE,
    record: {
      ...COMPLETE_RECORD,
      dog: {
        ...COMPLETE_RECORD.dog,
        breeding: { sire: null, dam: null },
      },
      missingFields: ["dog.breeding.sire", "dog.breeding.dam"],
    },
    presentation: {
      emptyState: "Breeding information has not been supplied for this greyhound.",
      warning: null,
      safeError: null,
    },
  },
  {
    id: "source-outage",
    requirementId: "RACING.FIX.source-outage",
    title: "Racing source outage",
    source: {
      ...HEALTHY_SOURCE,
      state: "outage",
      observedAt: "2026-07-15T09:10:00.000Z",
    },
    record: COMPLETE_RECORD,
    presentation: {
      emptyState: null,
      warning: "Live updates are temporarily unavailable. Confirmed data may be out of date.",
      safeError: "We could not refresh racing data. Please try again later.",
    },
  },
] as const satisfies readonly RacingProductionFixture[];

type RacingFixtureEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const RACING_FIXTURE_EVIDENCE = [
  PRODUCT_RACING_FIXTURE_EVIDENCE_FILE,
  PRODUCT_RACING_FIXTURE_TEST_FILE,
] as const;

function tested(): RacingFixtureEvidenceRecord {
  return { status: "tested", evidence: RACING_FIXTURE_EVIDENCE };
}

export const PRODUCT_RACING_FIXTURE_MASTER_EVIDENCE = Object.fromEntries(
  PRODUCT_RACING_FIXTURE_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    tested(),
  ]),
) as Readonly<
  Record<ProductRacingFixtureRequirementId, RacingFixtureEvidenceRecord>
>;
