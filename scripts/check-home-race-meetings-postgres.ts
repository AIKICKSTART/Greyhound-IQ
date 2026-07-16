import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "@prisma/client";

import type { DbContextClient } from "../src/lib/db-context";
import type { DisposableReplayQueryEvent } from "../src/lib/db";

export const HOME_RACE_MEETINGS_VERIFY_CONFIRMATION =
  "verify-home-race-meetings-on-disposable-loopback-55734";
export const HOME_RACE_MEETINGS_EVIDENCE_PATH =
  "output/database-audit/home-race-meetings-read.json";
export const HOME_RACE_MEETINGS_EVIDENCE_SCHEMA_VERSION = 1;

const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const MEETING_LIMIT = 128;
const RELATED_ROW_LIMIT = 2_048;
const TRACK_ID = "home-read-track-proof";
const MEETING_ID = "home-read-meeting-proof";
const RACE_IDS = ["home-read-race-one-proof", "home-read-race-two-proof"] as const;
const DOG_IDS = ["home-read-dog-one-proof", "home-read-dog-two-proof"] as const;
const RUNNER_IDS = [
  "home-read-runner-one-proof",
  "home-read-runner-two-proof",
] as const;
const VIDEO_IDS = ["home-read-video-one-proof", "home-read-video-two-proof"] as const;
const SOURCE_FILES = [
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "scripts/check-home-race-meetings-postgres.ts",
  "scripts/check-home-race-meetings-postgres.test.ts",
  "security/mandatory-public-racing-database-operations.ts",
  "src/lib/db.ts",
  "src/lib/queries.ts",
  "src/lib/race-time.ts",
] as const;

type RuntimeIdentity = {
  role: string;
  sessionRole: string;
  database: string;
  schema: string;
  canLogin: boolean;
  superuser: boolean;
  bypassRls: boolean;
};

type SourceBinding = {
  files: Record<string, string>;
  combinedSha256: string;
};

type TransactionRunner = <T>(
  fn: (tx: DbContextClient) => Promise<T>,
) => Promise<T>;

type ExpectedPositionedBind = {
  name: string;
  positions: number[];
  expectedValues?: unknown[];
  expectedKinds?: Array<"date">;
};

type ObservedSqlEvidence = {
  normalizedSql: string;
  parameters: unknown[];
  evidence: {
    statementType: "SELECT";
    normalizedSql: string;
    sha256: string;
    parameterCount: number;
    namedBinds: Array<{ name: string; positions: number[] }>;
    persistedParameterValues: false;
  };
};

export function assertHomeRaceMeetingsVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, HOME_RACE_MEETINGS_VERIFY_CONFIRMATION);
  const url = new URL(value);
  assert.ok(url.protocol === "postgresql:" || url.protocol === "postgres:");
  assert.ok(
    url.hostname === "127.0.0.1" ||
      url.hostname === "::1" ||
      url.hostname === "[::1]",
  );
  assert.equal(url.port, "55734");
  assert.equal(url.pathname, "/greyhoundiq");
  assert.equal(decodeURIComponent(url.username), "greyhoundiq_runtime");
  assert.equal(url.password, "");
  for (const parameter of [
    "database",
    "dbname",
    "host",
    "hostaddr",
    "port",
    "service",
    "socket",
  ]) {
    assert.equal(url.searchParams.has(parameter), false);
  }
  return url;
}

export function buildHomeRaceMeetingsSourceBinding(
  root = process.cwd(),
): SourceBinding {
  const files = Object.fromEntries(
    SOURCE_FILES.map((path) => [
      path,
      sha256(readFileSync(resolve(root, path))),
    ]),
  );
  return {
    files,
    combinedSha256: sha256(
      SOURCE_FILES.map((path) => `${path}:${files[path]}`).join("\n"),
    ),
  };
}

export function validateHomeRaceMeetingsEvidence(
  value: unknown,
  root = process.cwd(),
) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const evidence = value as Record<string, unknown>;
  assert.deepEqual(Object.keys(evidence).sort(), [
    "auditKind",
    "cleanup",
    "generatedAt",
    "proof",
    "runtimeIdentity",
    "safety",
    "schemaVersion",
    "sourceBinding",
    "verdict",
  ]);
  assert.equal(
    evidence.schemaVersion,
    HOME_RACE_MEETINGS_EVIDENCE_SCHEMA_VERSION,
  );
  assert.equal(evidence.auditKind, "home-race-meetings-read-disposable-proof");
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(
    evidence.sourceBinding,
    buildHomeRaceMeetingsSourceBinding(root),
  );
  assert.deepEqual(evidence.runtimeIdentity, {
    role: "greyhoundiq_runtime",
    sessionRole: "greyhoundiq_runtime",
    database: "greyhoundiq",
    schema: "public",
    canLogin: true,
    superuser: false,
    bypassRls: false,
  });
  assert.ok(evidence.safety && typeof evidence.safety === "object");
  const safety = evidence.safety as Record<string, unknown>;
  assert.ok(
    typeof safety.host === "string" &&
      ["127.0.0.1", "::1", "[::1]"].includes(safety.host),
  );
  assert.deepEqual({ ...safety, host: "127.0.0.1" }, {
    scope: "literal-loopback-disposable-replay-only",
    host: "127.0.0.1",
    port: 55734,
    productionOrProviderSystemsContacted: false,
    fixtureOwner: "home-race-meetings-dedicated-proof",
    broadCleanupUsed: false,
  });
  assert.deepEqual(evidence.cleanup, {
    raceVideoRowsDeleted: 2,
    runnerRowsDeleted: 2,
    raceRowsDeleted: 2,
    meetingRowsDeleted: 1,
    trackRowsDeleted: 1,
    dogRowsDeleted: 2,
    remainingRows: 0,
  });

  const proof = evidence.proof as Record<string, unknown>;
  assert.equal(proof.queryId, "DB.PUBLIC.HOME.RACE_MEETINGS.READ_BUNDLE");
  assert.equal(proof.sourceFile, "src/lib/queries.ts");
  assert.equal(
    proof.sourceSymbol,
    "getTodaysMeetings -> getRaceExplorerMeetings",
  );
  assert.deepEqual(proof.maximumRows, {
    meetings: MEETING_LIMIT,
    tracks: MEETING_LIMIT,
    races: RELATED_ROW_LIMIT,
    runnerGroups: RELATED_ROW_LIMIT,
    latestVideos: RELATED_ROW_LIMIT,
    totalAcrossStatements: MEETING_LIMIT * 2 + RELATED_ROW_LIMIT * 3,
  });
  assert.equal(proof.status, "verified");
  assert.deepEqual(proof.fixtureRows, {
    meetings: 1,
    tracks: 1,
    races: 2,
    runnerGroups: 2,
    latestVideos: 2,
  });
  assert.deepEqual(proof.cases, {
    populatedBundle:
      "one-current-day-meeting-with-two-races-runner-counts-and-latest-videos",
    anonymousRlsReplay: "all-five-exact-selects-returned-public-fixture-rows",
    boundedQueries:
      "four-bulk-selects-carry-limit-binds-and-track-read-is-pk-bound-by-meeting-limit",
    latestVideoProjection: "at-most-one-video-returned-per-selected-race",
    emptyStateAfterCleanup: "returned-empty-meeting-array",
    mutation: "none",
  });
  const statements = proof.statements as Array<Record<string, unknown>>;
  assert.deepEqual(
    statements.map((statement) => statement.variant),
    ["meetings", "tracks", "races", "runner-groups", "latest-videos"],
  );
  assert.deepEqual(
    statements.map((statement) => statement.returnedRows),
    [1, 1, 2, 2, 2],
  );
  for (const statement of statements) {
    const observedSql = statement.observedSql as Record<string, unknown>;
    assert.equal(observedSql.statementType, "SELECT");
    assert.equal(observedSql.persistedParameterValues, false);
    assert.equal(observedSql.sha256, sha256(String(observedSql.normalizedSql)));
    if (statement.variant === "tracks") {
      assert.match(
        String(observedSql.normalizedSql),
        /WHERE "public"\."Track"\."id" IN \(\$1\)/,
      );
    } else {
      assert.match(String(observedSql.normalizedSql), /\bLIMIT \$\d+\b/i);
    }
    const explain = statement.explain as Record<string, unknown>;
    assert.equal(explain.format, "postgresql-json-cost-plan");
    assert.equal(explain.analyze, false);
    assert.equal(explain.buffers, false);
    assert.equal(explain.sanitized, true);
    assert.equal(
      explain.statementTimeoutMilliseconds,
      EXPLAIN_STATEMENT_TIMEOUT_MS,
    );
  }
  const querySource = readFileSync(resolve(root, "src/lib/queries.ts"), "utf8");
  assert.match(querySource, /const RACE_EXPLORER_MEETING_LIMIT = 128;/);
  assert.match(querySource, /const RACE_EXPLORER_RACE_LIMIT = 2_048;/);
  assert.match(querySource, /take: RACE_EXPLORER_MEETING_LIMIT/);
  assert.equal(
    querySource.match(/take: RACE_EXPLORER_RACE_LIMIT/g)?.length,
    3,
  );
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, /home-read-(?:track|meeting|race|dog|runner|video)/i);
  return evidence;
}

export async function runHomeRaceMeetingsVerifier() {
  const root = process.cwd();
  const runtimeUrl = assertHomeRaceMeetingsVerifierTarget(
    requiredEnvironment("HOME_RACE_MEETINGS_VERIFY_DATABASE_URL"),
    process.env.HOME_RACE_MEETINGS_VERIFY_CONFIRM,
  );
  const applicationUrl = new URL(runtimeUrl);
  applicationUrl.searchParams.set("connection_limit", "4");
  process.env.DATABASE_URL = applicationUrl.toString();
  process.env.DIRECT_URL = applicationUrl.toString();
  process.env.DEMO_FIXTURE_QUERY_EVIDENCE_MODE = QUERY_EVIDENCE_MODE;
  const cleanupUrl = new URL(runtimeUrl);
  cleanupUrl.username = "postgres";

  const [
    { PrismaClient },
    { prisma, captureDisposableReplayQueries },
    { withDbAnonymousContext },
    { getTodaysMeetings },
    { formatRaceDateInput, raceDateWindow },
  ] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/db"),
    import("../src/lib/db-context"),
    import("../src/lib/queries"),
    import("../src/lib/race-time"),
  ]);
  const cleanupPrisma = new PrismaClient({
    datasources: { db: { url: cleanupUrl.toString() } },
  });
  let cleanupRequired = false;
  try {
    const identities = await prisma.$queryRaw<RuntimeIdentity[]>`
      SELECT
        current_user AS "role",
        session_user AS "sessionRole",
        current_database() AS "database",
        current_schema() AS "schema",
        rol.rolcanlogin AS "canLogin",
        rol.rolsuper AS "superuser",
        rol.rolbypassrls AS "bypassRls"
      FROM pg_roles AS rol
      WHERE rol.rolname = current_user
    `;
    assert.deepEqual(identities, [
      {
        role: "greyhoundiq_runtime",
        sessionRole: "greyhoundiq_runtime",
        database: "greyhoundiq",
        schema: "public",
        canLogin: true,
        superuser: false,
        bypassRls: false,
      },
    ]);
    const raceWindow = raceDateWindow(formatRaceDateInput(new Date()));
    const [existingMeetings, existingRaces] = await Promise.all([
      cleanupPrisma.meeting.count({
        where: { races: { some: { raceTime: { gte: raceWindow.gte, lt: raceWindow.lt } } } },
      }),
      cleanupPrisma.race.count({
        where: { raceTime: { gte: raceWindow.gte, lt: raceWindow.lt } },
      }),
    ]);
    assert.deepEqual(
      { existingMeetings, existingRaces },
      { existingMeetings: 0, existingRaces: 0 },
      "Disposable replay must start without unrelated current-day racing rows",
    );
    await setupHomeRaceMeetingsFixtures(cleanupPrisma, raceWindow.gte);
    cleanupRequired = true;

    const policies = await cleanupPrisma.$queryRawUnsafe<
      Array<{ tableName: string; policyName: string; usingExpression: string }>
    >(`
      SELECT
        tablename AS "tableName",
        policyname AS "policyName",
        qual AS "usingExpression"
      FROM pg_policies
      WHERE schemaname = 'public'
        AND policyname IN (
          'giq_track_read',
          'giq_meeting_read',
          'giq_race_read',
          'giq_runner_read',
          'giq_race_video_read'
        )
      ORDER BY policyname
    `);
    assert.deepEqual(
      policies.map((policy) => policy.policyName),
      [
        "giq_meeting_read",
        "giq_race_read",
        "giq_race_video_read",
        "giq_runner_read",
        "giq_track_read",
      ],
    );
    assert.ok(policies.every((policy) => policy.usingExpression === "true"));

    const capture = await captureDisposableReplayQueries(getTodaysMeetings);
    assert.equal(capture.result.length, 1);
    assert.equal(capture.result[0].id, MEETING_ID);
    assert.equal(capture.result[0].races.length, 2);
    assert.deepEqual(
      capture.result[0].races.map((race) => ({
        runners: race._count.runners,
        videos: race.videos.length,
      })),
      [
        { runners: 1, videos: 1 },
        { runners: 1, videos: 1 },
      ],
    );

    const meetingEvent = exactObservedSelect(capture.queries, "Meeting");
    const trackEvent = exactObservedSelect(capture.queries, "Track");
    const raceEvent = exactObservedSelect(capture.queries, "Race");
    const runnerEvent = exactObservedSelect(capture.queries, "Runner");
    const videoEvent = exactObservedSelect(capture.queries, "RaceVideo");
    const meetingSql = observedSelectEvidence(meetingEvent, [
      { name: "current Australia/Sydney race-day gte", positions: [1], expectedKinds: ["date"] },
      { name: "current Australia/Sydney race-day lt", positions: [2], expectedKinds: ["date"] },
      { name: "meeting take", positions: [3], expectedValues: [MEETING_LIMIT] },
      { name: "meeting offset", positions: [4], expectedValues: [0] },
    ]);
    const trackSql = observedSelectEvidence(
      trackEvent,
      [
        { name: "selected track id", positions: [1], expectedValues: [TRACK_ID] },
        { name: "track offset", positions: [2], expectedValues: [0] },
      ],
      false,
    );
    const raceSql = observedSelectEvidence(raceEvent, [
      { name: "current Australia/Sydney race-day gte", positions: [1], expectedKinds: ["date"] },
      { name: "current Australia/Sydney race-day lt", positions: [2], expectedKinds: ["date"] },
      { name: "selected meeting id", positions: [3], expectedValues: [MEETING_ID] },
      { name: "race take", positions: [4], expectedValues: [RELATED_ROW_LIMIT] },
      { name: "race offset", positions: [5], expectedValues: [0] },
    ]);
    const runnerSql = observedSelectEvidence(runnerEvent, [
      { name: "selected race ids", positions: [1, 2], expectedValues: [...RACE_IDS] },
      { name: "runner-group take", positions: [3], expectedValues: [RELATED_ROW_LIMIT] },
      { name: "runner-group offset", positions: [4], expectedValues: [0] },
    ]);
    const videoSql = observedSelectEvidence(videoEvent, [
      { name: "selected race ids", positions: [1, 2], expectedValues: [...RACE_IDS] },
      { name: "latest-video take", positions: [3], expectedValues: [RELATED_ROW_LIMIT] },
      { name: "latest-video offset", positions: [4], expectedValues: [0] },
    ]);

    const statements = [
      { variant: "meetings", observed: meetingSql, expectedRows: 1 },
      { variant: "tracks", observed: trackSql, expectedRows: 1 },
      { variant: "races", observed: raceSql, expectedRows: 2 },
      { variant: "runner-groups", observed: runnerSql, expectedRows: 2 },
      { variant: "latest-videos", observed: videoSql, expectedRows: 2 },
    ] as const;
    const persistedStatements: Array<{
      variant: string;
      observedSql: ObservedSqlEvidence["evidence"];
      returnedRows: number;
      explain: Awaited<ReturnType<typeof explainObservedStatement>>;
    }> = [];
    for (const statement of statements) {
      const returnedRows = await replayObservedSelect(
        withDbAnonymousContext,
        statement.observed,
      );
      assert.equal(returnedRows, statement.expectedRows);
      const explain = await explainObservedStatement(
        withDbAnonymousContext,
        statement.observed,
      );
      persistedStatements.push({
        variant: statement.variant,
        observedSql: statement.observed.evidence,
        returnedRows,
        explain,
      });
    }

    const removed = await cleanupHomeRaceMeetingsFixtures(cleanupPrisma, true);
    cleanupRequired = false;
    const remainingRows = await countHomeRaceMeetingFixtureRows(cleanupPrisma);
    assert.equal(remainingRows, 0);
    const emptyState = await getTodaysMeetings();
    assert.deepEqual(emptyState, []);

    const report = {
      schemaVersion: HOME_RACE_MEETINGS_EVIDENCE_SCHEMA_VERSION,
      auditKind: "home-race-meetings-read-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: runtimeUrl.hostname,
        port: Number(runtimeUrl.port),
        productionOrProviderSystemsContacted: false,
        fixtureOwner: "home-race-meetings-dedicated-proof",
        broadCleanupUsed: false,
      },
      runtimeIdentity: identities[0],
      sourceBinding: buildHomeRaceMeetingsSourceBinding(root),
      proof: {
        queryId: "DB.PUBLIC.HOME.RACE_MEETINGS.READ_BUNDLE",
        sourceFile: "src/lib/queries.ts",
        sourceSymbol: "getTodaysMeetings -> getRaceExplorerMeetings",
        maximumRows: {
          meetings: MEETING_LIMIT,
          tracks: MEETING_LIMIT,
          races: RELATED_ROW_LIMIT,
          runnerGroups: RELATED_ROW_LIMIT,
          latestVideos: RELATED_ROW_LIMIT,
          totalAcrossStatements: MEETING_LIMIT * 2 + RELATED_ROW_LIMIT * 3,
        },
        fixtureRows: {
          meetings: 1,
          tracks: 1,
          races: 2,
          runnerGroups: 2,
          latestVideos: 2,
        },
        cases: {
          populatedBundle:
            "one-current-day-meeting-with-two-races-runner-counts-and-latest-videos",
          anonymousRlsReplay:
            "all-five-exact-selects-returned-public-fixture-rows",
          boundedQueries:
            "four-bulk-selects-carry-limit-binds-and-track-read-is-pk-bound-by-meeting-limit",
          latestVideoProjection: "at-most-one-video-returned-per-selected-race",
          emptyStateAfterCleanup: "returned-empty-meeting-array",
          mutation: "none",
        },
        statements: persistedStatements,
        status: "verified",
      },
      cleanup: { ...removed, remainingRows },
      verdict: "verified",
    } as const;
    validateHomeRaceMeetingsEvidence(report, root);
    const outputPath = resolve(root, HOME_RACE_MEETINGS_EVIDENCE_PATH);
    const temporaryPath = `${outputPath}.tmp`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    return { report, outputPath };
  } finally {
    if (cleanupRequired) {
      await cleanupHomeRaceMeetingsFixtures(cleanupPrisma, false);
    }
    await Promise.all([prisma.$disconnect(), cleanupPrisma.$disconnect()]);
  }
}

async function setupHomeRaceMeetingsFixtures(
  prisma: PrismaClient,
  raceDayStart: Date,
) {
  await cleanupHomeRaceMeetingsFixtures(prisma, false);
  const meetingDate = new Date(raceDayStart.getTime() + 60 * 60 * 1000);
  const raceTimes = [
    new Date(raceDayStart.getTime() + 2 * 60 * 60 * 1000),
    new Date(raceDayStart.getTime() + 3 * 60 * 60 * 1000),
  ];
  await prisma.$transaction(async (tx) => {
    await tx.track.create({
      data: { id: TRACK_ID, name: "Home Read Proof Track", state: "NSW" },
    });
    await tx.meeting.create({
      data: {
        id: MEETING_ID,
        trackId: TRACK_ID,
        meetingDate,
        sourceProvider: "home-read-proof",
      },
    });
    await tx.dog.createMany({
      data: [
        { id: DOG_IDS[0], name: "Home Read Proof One" },
        { id: DOG_IDS[1], name: "Home Read Proof Two" },
      ],
    });
    await tx.race.createMany({
      data: [
        {
          id: RACE_IDS[0],
          meetingId: MEETING_ID,
          raceNumber: 1,
          raceTime: raceTimes[0],
          distance: 520,
          resultStatus: "scheduled",
        },
        {
          id: RACE_IDS[1],
          meetingId: MEETING_ID,
          raceNumber: 2,
          raceTime: raceTimes[1],
          distance: 520,
          resultStatus: "scheduled",
        },
      ],
    });
    await tx.runner.createMany({
      data: [
        {
          id: RUNNER_IDS[0],
          raceId: RACE_IDS[0],
          dogId: DOG_IDS[0],
          boxNumber: 1,
        },
        {
          id: RUNNER_IDS[1],
          raceId: RACE_IDS[1],
          dogId: DOG_IDS[1],
          boxNumber: 1,
        },
      ],
    });
    await tx.raceVideo.createMany({
      data: [
        {
          id: VIDEO_IDS[0],
          raceId: RACE_IDS[0],
          sourceProvider: "home-read-proof",
          sourceId: "one",
          pageUrl: "https://example.invalid/home-read-one",
          streamUrl: "https://example.invalid/home-read-one.m3u8",
          sourceStatus: 200,
          fetchedAt: new Date(raceTimes[0].getTime() + 30_000),
        },
        {
          id: VIDEO_IDS[1],
          raceId: RACE_IDS[1],
          sourceProvider: "home-read-proof",
          sourceId: "two",
          pageUrl: "https://example.invalid/home-read-two",
          streamUrl: "https://example.invalid/home-read-two.m3u8",
          sourceStatus: 200,
          fetchedAt: new Date(raceTimes[1].getTime() + 30_000),
        },
      ],
    });
  });
}

async function cleanupHomeRaceMeetingsFixtures(
  prisma: PrismaClient,
  requireExact: boolean,
) {
  const result = await prisma.$transaction(async (tx) => {
    const videos = await tx.raceVideo.deleteMany({
      where: { id: { in: [...VIDEO_IDS] } },
    });
    const runners = await tx.runner.deleteMany({
      where: { id: { in: [...RUNNER_IDS] } },
    });
    const races = await tx.race.deleteMany({
      where: { id: { in: [...RACE_IDS] } },
    });
    const meetings = await tx.meeting.deleteMany({ where: { id: MEETING_ID } });
    const tracks = await tx.track.deleteMany({ where: { id: TRACK_ID } });
    const dogs = await tx.dog.deleteMany({ where: { id: { in: [...DOG_IDS] } } });
    return {
      raceVideoRowsDeleted: videos.count,
      runnerRowsDeleted: runners.count,
      raceRowsDeleted: races.count,
      meetingRowsDeleted: meetings.count,
      trackRowsDeleted: tracks.count,
      dogRowsDeleted: dogs.count,
    };
  });
  if (requireExact) {
    assert.deepEqual(result, {
      raceVideoRowsDeleted: 2,
      runnerRowsDeleted: 2,
      raceRowsDeleted: 2,
      meetingRowsDeleted: 1,
      trackRowsDeleted: 1,
      dogRowsDeleted: 2,
    });
  }
  return result;
}

async function countHomeRaceMeetingFixtureRows(prisma: PrismaClient) {
  const counts = await Promise.all([
    prisma.raceVideo.count({ where: { id: { in: [...VIDEO_IDS] } } }),
    prisma.runner.count({ where: { id: { in: [...RUNNER_IDS] } } }),
    prisma.race.count({ where: { id: { in: [...RACE_IDS] } } }),
    prisma.meeting.count({ where: { id: MEETING_ID } }),
    prisma.track.count({ where: { id: TRACK_ID } }),
    prisma.dog.count({ where: { id: { in: [...DOG_IDS] } } }),
  ]);
  return counts.reduce((total, count) => total + count, 0);
}

function exactObservedSelect(
  queries: readonly DisposableReplayQueryEvent[],
  table: "Meeting" | "Track" | "Race" | "Runner" | "RaceVideo",
) {
  const matches = queries.filter((event) => {
    const sql = normalizeObservedSql(event.query);
    if (!/^SELECT\b/i.test(sql)) return false;
    if (table === "Runner") {
      return /^SELECT COUNT\(\*\).*?"public"\."Runner"\."raceId"/i.test(sql);
    }
    return new RegExp(
      `^SELECT(?: DISTINCT ON \\([^)]*\\))? "public"\\."${table}"\\."id"`,
      "i",
    ).test(sql);
  });
  assert.equal(matches.length, 1, `Expected exactly one ${table} SELECT`);
  return matches[0];
}

function observedSelectEvidence(
  event: DisposableReplayQueryEvent,
  expectedBinds: readonly ExpectedPositionedBind[],
  requireLimit = true,
): ObservedSqlEvidence {
  const normalizedSql = normalizeObservedSql(event.query);
  assert.match(normalizedSql, /^SELECT\b/i);
  assert.doesNotMatch(normalizedSql, /;|--|\/\*/);
  if (requireLimit) assert.match(normalizedSql, /\bLIMIT \$\d+\b/i);
  const parsed = JSON.parse(event.params) as unknown;
  assert.ok(Array.isArray(parsed), "Observed Prisma parameters must be an array");
  const parameters = parsed as unknown[];
  const explainParameters = [...parameters];
  const positions = expectedBinds.flatMap((bind) => bind.positions);
  assert.deepEqual(
    [...positions].sort((left, right) => left - right),
    Array.from({ length: parameters.length }, (_, index) => index + 1),
  );
  assert.deepEqual(
    [
      ...new Set(
        [...normalizedSql.matchAll(/\$(\d+)\b/g)].map((match) => Number(match[1])),
      ),
    ].sort((left, right) => left - right),
    Array.from({ length: parameters.length }, (_, index) => index + 1),
  );
  for (const bind of expectedBinds) {
    assert.equal(
      bind.expectedValues?.length ?? bind.expectedKinds?.length,
      bind.positions.length,
    );
    bind.positions.forEach((position, index) => {
      const parameter = parameters[position - 1];
      if (bind.expectedValues) {
        assert.deepEqual(parameter, bind.expectedValues[index]);
        if (typeof parameter === "string") assert.ok(!normalizedSql.includes(parameter));
      } else {
        explainParameters[position - 1] = observedDateParameter(parameter);
      }
    });
  }
  return {
    normalizedSql,
    parameters: explainParameters,
    evidence: {
      statementType: "SELECT",
      normalizedSql,
      sha256: sha256(normalizedSql),
      parameterCount: parameters.length,
      namedBinds: expectedBinds.map((bind) => ({
        name: bind.name,
        positions: [...bind.positions],
      })),
      persistedParameterValues: false,
    },
  };
}

function observedDateParameter(value: unknown) {
  const dateValue =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? (value as Record<string, unknown>).prisma__value
        : null;
  assert.ok(
    typeof dateValue === "string" &&
      Number.isFinite(new Date(dateValue).getTime()),
  );
  return new Date(dateValue);
}

function normalizeObservedSql(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function replayObservedSelect(
  runner: TransactionRunner,
  observed: ObservedSqlEvidence,
) {
  const rows = await runner((tx) =>
    tx.$queryRawUnsafe<unknown[]>(
      observed.normalizedSql,
      ...observed.parameters,
    ),
  );
  assert.ok(Array.isArray(rows));
  return rows.length;
}

async function explainObservedStatement(
  runner: TransactionRunner,
  observed: ObservedSqlEvidence,
) {
  const rows = await runner(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL statement_timeout = ${EXPLAIN_STATEMENT_TIMEOUT_MS}`,
    );
    return tx.$queryRawUnsafe<unknown[]>(
      `EXPLAIN (FORMAT JSON, ANALYZE FALSE, VERBOSE FALSE, COSTS TRUE, BUFFERS FALSE) ${observed.normalizedSql}`,
      ...observed.parameters,
    );
  });
  const plan = sanitizeExplainResult(rows);
  return {
    format: "postgresql-json-cost-plan",
    analyze: false,
    buffers: false,
    statementTimeoutMilliseconds: EXPLAIN_STATEMENT_TIMEOUT_MS,
    sanitized: true,
    plan,
    planSha256: sha256(JSON.stringify(plan)),
  } as const;
}

function sanitizeExplainResult(value: unknown) {
  assert.ok(Array.isArray(value) && value.length === 1);
  const row = plainObject(value[0], "EXPLAIN row");
  const rawQueryPlan = row["QUERY PLAN"];
  const queryPlan =
    typeof rawQueryPlan === "string"
      ? (JSON.parse(rawQueryPlan) as unknown)
      : rawQueryPlan;
  assert.ok(Array.isArray(queryPlan) && queryPlan.length === 1);
  const planContainer = plainObject(queryPlan[0], "EXPLAIN plan container");
  return sanitizeExplainNode(planContainer.Plan);
}

function sanitizeExplainNode(value: unknown): {
  nodeType: string;
  relationName: string | null;
  indexName: string | null;
  joinType: string | null;
  scanDirection: string | null;
  estimatedRows: number;
  totalCost: number;
  children: ReturnType<typeof sanitizeExplainNode>[];
} {
  const node = plainObject(value, "EXPLAIN plan node");
  const children = node.Plans ?? [];
  assert.ok(Array.isArray(children));
  return {
    nodeType: requiredPlanString(node["Node Type"], "Node Type"),
    relationName: optionalPlanString(node["Relation Name"], "Relation Name"),
    indexName: optionalPlanString(node["Index Name"], "Index Name"),
    joinType: optionalPlanString(node["Join Type"], "Join Type"),
    scanDirection: optionalPlanString(node["Scan Direction"], "Scan Direction"),
    estimatedRows: requiredPlanNumber(node["Plan Rows"], "Plan Rows"),
    totalCost: requiredPlanNumber(node["Total Cost"], "Total Cost"),
    children: children.map(sanitizeExplainNode),
  };
}

function plainObject(value: unknown, label: string) {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  return value as Record<string, unknown>;
}

function requiredPlanString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`EXPLAIN ${label} must be a non-empty string`);
  }
  return value;
}

function optionalPlanString(value: unknown, label: string): string | null {
  if (value === undefined) return null;
  return requiredPlanString(value, label);
}

function requiredPlanNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`EXPLAIN ${label} must be a non-negative finite number`);
  }
  return value;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const { report, outputPath } = await runHomeRaceMeetingsVerifier();
  console.log(
    JSON.stringify({
      verdict: report.verdict,
      queryId: report.proof.queryId,
      evidence: outputPath,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
