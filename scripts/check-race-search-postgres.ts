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

export const RACE_SEARCH_VERIFY_CONFIRMATION =
  "verify-race-search-on-disposable-loopback-55734";
export const RACE_SEARCH_EVIDENCE_PATH =
  "output/database-audit/race-search-read.json";
export const RACE_SEARCH_EVIDENCE_SCHEMA_VERSION = 1;

const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const EXPECTED_MAXIMUM_ROWS = 7_053;
const FIXTURE_DATE = "2026-07-01";
const FIXTURE_NOW = new Date("2026-07-01T02:00:00.000Z");
const TRACK_ID = "race-search-track-proof";
const MEETING_ID = "race-search-meeting-proof";
const RACE_ID = "race-search-race-proof";
const DOG_ID = "race-search-dog-proof";
const RUNNER_ID = "race-search-runner-proof";
const RESULT_ID = "race-search-result-proof";
const VIDEO_ID = "race-search-video-proof";
const SOURCE_CANARY = "race-search-private-canary";
const ALL_CAPTURE_ORIGINS = [
  "date-field",
  "default-date",
  "full-miss",
  "global-dog",
] as const satisfies readonly CapturedCase["name"][];
const REQUIRED_CONTROL_SQL = [
  "SELECT set_config('app.current_user_id', '', true), set_config('app.current_profile_id', '', true), set_config('app.current_actor_id', '', true), set_config('app.current_tier', 'free', true), set_config('app.current_role', 'member', true), set_config('app.system', 'false', true)",
  "SELECT set_config('statement_timeout', $1, true)",
] as const;
const SOURCE_FILES = [
  "prisma/schema.prisma",
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "scripts/check-race-search-postgres.ts",
  "scripts/check-race-search-postgres.test.ts",
  "security/mandatory-public-racing-database-operations.ts",
  "src/app/races/page.tsx",
  "src/lib/db-context.ts",
  "src/lib/db-stats.ts",
  "src/lib/db.ts",
  "src/lib/queries.ts",
  "src/lib/race-search.ts",
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

type CapturedCase = {
  name: "default-date" | "global-dog" | "date-field" | "full-miss";
  queries: DisposableReplayQueryEvent[];
};

type ObservedStatement = {
  variant: string;
  origins: CapturedCase["name"][];
  normalizedSql: string;
  parameters: unknown[];
  evidence: {
    statementType: "SELECT" | "WITH";
    normalizedSql: string;
    sha256: string;
    parameterCount: number;
    persistedParameterValues: false;
  };
};

export function assertRaceSearchVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, RACE_SEARCH_VERIFY_CONFIRMATION);
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

export function buildRaceSearchSourceBinding(
  root = process.cwd(),
): SourceBinding {
  const files = Object.fromEntries(
    SOURCE_FILES.map((path) => [path, sha256(readFileSync(resolve(root, path)))]),
  );
  return {
    files,
    combinedSha256: sha256(
      SOURCE_FILES.map((path) => `${path}:${files[path]}`).join("\n"),
    ),
  };
}

export function validateRaceSearchEvidence(
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
  assert.equal(evidence.schemaVersion, RACE_SEARCH_EVIDENCE_SCHEMA_VERSION);
  assert.equal(evidence.auditKind, "race-search-disposable-proof");
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(evidence.sourceBinding, buildRaceSearchSourceBinding(root));
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
    fixtureOwner: "race-search-dedicated-proof",
    broadCleanupUsed: false,
  });
  assert.deepEqual(evidence.cleanup, {
    videoRowsDeleted: 1,
    resultRowsDeleted: 1,
    runnerRowsDeleted: 1,
    dogRowsDeleted: 1,
    raceRowsDeleted: 1,
    meetingRowsDeleted: 1,
    trackRowsDeleted: 1,
    remainingRows: 0,
  });

  const proof = evidence.proof as Record<string, unknown>;
  assert.equal(proof.queryId, "DB.RACING.RACE.SEARCH.READ_BUNDLE");
  assert.equal(proof.sourceFile, "src/lib/queries.ts");
  assert.equal(proof.sourceSymbol, "getRaceExplorerData -> fetchRaceExplorerData");
  assert.equal(proof.expectedMaximumRows, EXPECTED_MAXIMUM_ROWS);
  assert.equal(proof.status, "verified");
  assert.deepEqual(proof.rowCounts, {
    before: 7,
    afterReads: 7,
    afterMiss: 7,
  });
  assert.deepEqual(proof.populated, {
    defaultMeetings: 1,
    defaultRaces: 1,
    defaultReplayRaces: 1,
    defaultStates: ["QLD"],
    defaultSummary: {
      meetings: 1,
      races: 1,
      runners: 1,
      results: 1,
      videos: 1,
      videosWithStream: 1,
    },
    globalDogMeetings: 1,
    dateFieldMeetings: 1,
    missingMeetings: 0,
  });
  assert.deepEqual(proof.cases, {
    defaultDate: "bounded-date-summary-and-eight-race-replay-projection",
    globalDog: "bounded-eighty-dog-and-ninety-six-runner-candidate-path",
    dateField: "bounded-field-ranked-search-path",
    fullMiss: "field-runner-exact-and-trigram-fallbacks-return-empty",
    stateBound: "sixteen-distinct-state-sql-limit",
    maximum:
      "conservative-7053-row-materialization-bound-includes-mutually-exclusive-ranking-fallbacks",
    notFound: "explicit-empty-meeting-and-replay-collections",
  });
  assert.deepEqual(proof.rls, {
    anonymousReplayStatements: proof.statementCount,
    anonymousReplayFailures: 0,
  });
  const statements = proof.statements as Array<Record<string, unknown>>;
  assert.equal(statements.length, proof.statementCount);
  assert.equal(statements.length, 31);
  assert.equal(
    new Set(statements.map((statement) => statement.variant)).size,
    statements.length,
  );
  for (const requiredSql of REQUIRED_CONTROL_SQL) {
    const control = statements.find(
      (statement) =>
        (statement.observedSql as Record<string, unknown>).normalizedSql ===
        requiredSql,
    );
    assert.ok(control);
    assert.deepEqual(control.origins, ALL_CAPTURE_ORIGINS);
  }
  for (const statement of statements) {
    const observedSql = statement.observedSql as Record<string, unknown>;
    assert.ok(
      observedSql.statementType === "SELECT" ||
        observedSql.statementType === "WITH",
    );
    assert.equal(observedSql.persistedParameterValues, false);
    assert.equal(observedSql.sha256, sha256(String(observedSql.normalizedSql)));
    assert.doesNotMatch(
      String(observedSql.normalizedSql),
      /sourceRawJson|profileSourceRawJson|candidateJson|parsedJson/,
    );
    const explain = statement.explain as Record<string, unknown>;
    assert.equal(explain.format, "postgresql-json-cost-plan");
    assert.equal(explain.analyze, false);
    assert.equal(explain.buffers, false);
    assert.equal(explain.sanitized, true);
    assert.equal(
      explain.statementTimeoutMilliseconds,
      EXPLAIN_STATEMENT_TIMEOUT_MS,
    );
    const replay = statement.anonymousReplay as Record<string, unknown>;
    assert.equal(replay.status, "allowed");
    assert.ok(typeof replay.rows === "number" && replay.rows >= 0);
  }
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, new RegExp(SOURCE_CANARY, "i"));
  return evidence;
}

export async function runRaceSearchVerifier() {
  const root = process.cwd();
  const runtimeUrl = assertRaceSearchVerifierTarget(
    requiredEnvironment("RACE_SEARCH_VERIFY_DATABASE_URL"),
    process.env.RACE_SEARCH_VERIFY_CONFIRM,
  );
  const applicationUrl = new URL(runtimeUrl);
  applicationUrl.searchParams.set("connection_limit", "8");
  process.env.DATABASE_URL = applicationUrl.toString();
  process.env.DIRECT_URL = applicationUrl.toString();
  process.env.DEMO_FIXTURE_QUERY_EVIDENCE_MODE = QUERY_EVIDENCE_MODE;
  const cleanupUrl = new URL(runtimeUrl);
  cleanupUrl.username = "postgres";

  const [
    { PrismaClient },
    { prisma, captureDisposableReplayQueries },
    { withDbAnonymousContext },
    { getRaceExplorerData },
  ] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/db"),
    import("../src/lib/db-context"),
    import("../src/lib/queries"),
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

    await setupFixtures(cleanupPrisma);
    cleanupRequired = true;
    const before = await countFixtureRows(cleanupPrisma);
    assert.equal(before, 7);

    const defaultCapture = await captureDisposableReplayQueries(() =>
      getRaceExplorerData({
        date: FIXTURE_DATE,
        state: "QLD",
        status: "all",
        sort: "time",
      }),
    );
    const defaultData = defaultCapture.result;
    assert.equal(defaultData.selectedDate, FIXTURE_DATE);
    assert.deepEqual(defaultData.states, ["QLD"]);
    assert.equal(defaultData.meetings.length, 1);
    assert.equal(defaultData.meetings[0].races.length, 1);
    assert.equal(defaultData.replayRaces.length, 1);
    assert.deepEqual(defaultData.dateSummary, {
      meetings: 1,
      races: 1,
      runners: 1,
      results: 1,
      videos: 1,
      videosWithStream: 1,
    });
    assertNoSourceCanary(defaultData);

    const globalDogCapture = await captureDisposableReplayQueries(() =>
      getRaceExplorerData({ q: "Proof Hound", sort: "relevance" }),
    );
    assert.equal(globalDogCapture.result.isGlobalSearch, true);
    assert.equal(globalDogCapture.result.meetings.length, 1);
    assertNoSourceCanary(globalDogCapture.result);

    const dateFieldCapture = await captureDisposableReplayQueries(() =>
      getRaceExplorerData({
        date: FIXTURE_DATE,
        q: "Albion Park",
        sort: "relevance",
      }),
    );
    assert.equal(dateFieldCapture.result.meetings.length, 1);
    assertNoSourceCanary(dateFieldCapture.result);

    const fullMissCapture = await captureDisposableReplayQueries(() =>
      getRaceExplorerData({
        date: FIXTURE_DATE,
        q: "Definitely Missing",
        sort: "relevance",
      }),
    );
    assert.equal(fullMissCapture.result.meetings.length, 0);
    assert.equal(fullMissCapture.result.replayRaces.length, 0);
    const afterReads = await countFixtureRows(cleanupPrisma);
    assert.equal(afterReads, 7);

    const capturedCases: CapturedCase[] = [
      { name: "default-date", queries: defaultCapture.queries },
      { name: "global-dog", queries: globalDogCapture.queries },
      { name: "date-field", queries: dateFieldCapture.queries },
      { name: "full-miss", queries: fullMissCapture.queries },
    ];
    const statements = collectObservedStatements(capturedCases);
    assert.equal(statements.length, 31);
    for (const requiredSql of REQUIRED_CONTROL_SQL) {
      const control = statements.find(
        (statement) => statement.normalizedSql === requiredSql,
      );
      assert.ok(control);
      assert.deepEqual(control.origins, ALL_CAPTURE_ORIGINS);
    }
    assert.ok(
      statements.some((statement) =>
        statement.normalizedSql.includes('FROM "public"."Track"'),
      ),
    );
    assert.ok(
      statements.some((statement) =>
        statement.normalizedSql.includes("WITH field_race AS"),
      ),
    );
    assert.ok(
      statements.some((statement) =>
        statement.normalizedSql.includes("WITH exact_race AS"),
      ),
    );
    assert.ok(
      statements.some((statement) =>
        statement.normalizedSql.includes("WITH race_search AS"),
      ),
    );

    const statementEvidence = [];
    for (const statement of statements) {
      const anonymousRows = await withDbAnonymousContext((tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          statement.normalizedSql,
          ...statement.parameters,
        ),
      );
      statementEvidence.push({
        variant: statement.variant,
        origins: statement.origins,
        observedSql: statement.evidence,
        explain: await explainObservedStatement(
          withDbAnonymousContext,
          statement,
        ),
        anonymousReplay: { status: "allowed", rows: anonymousRows.length },
      });
    }

    const afterMiss = await countFixtureRows(cleanupPrisma);
    assert.equal(afterMiss, 7);
    const removed = await cleanupFixtures(cleanupPrisma);
    cleanupRequired = false;
    assert.deepEqual(removed, {
      videoRowsDeleted: 1,
      resultRowsDeleted: 1,
      runnerRowsDeleted: 1,
      dogRowsDeleted: 1,
      raceRowsDeleted: 1,
      meetingRowsDeleted: 1,
      trackRowsDeleted: 1,
    });
    const remainingRows = await countFixtureRows(cleanupPrisma);
    assert.equal(remainingRows, 0);

    const report = {
      schemaVersion: RACE_SEARCH_EVIDENCE_SCHEMA_VERSION,
      auditKind: "race-search-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: runtimeUrl.hostname,
        port: Number(runtimeUrl.port),
        productionOrProviderSystemsContacted: false,
        fixtureOwner: "race-search-dedicated-proof",
        broadCleanupUsed: false,
      },
      runtimeIdentity: identities[0],
      sourceBinding: buildRaceSearchSourceBinding(root),
      proof: {
        queryId: "DB.RACING.RACE.SEARCH.READ_BUNDLE",
        sourceFile: "src/lib/queries.ts",
        sourceSymbol: "getRaceExplorerData -> fetchRaceExplorerData",
        expectedMaximumRows: EXPECTED_MAXIMUM_ROWS,
        maximumRowBreakdown: {
          metadata: 116,
          conservativeRankingFallbacks: 536,
          meetingRaceRunnerVideoBundle: 6_400,
          searchResultSummary: 1,
        },
        statementCount: statementEvidence.length,
        rowCounts: { before, afterReads, afterMiss },
        populated: {
          defaultMeetings: defaultData.meetings.length,
          defaultRaces: defaultData.meetings[0].races.length,
          defaultReplayRaces: defaultData.replayRaces.length,
          defaultStates: defaultData.states,
          defaultSummary: defaultData.dateSummary,
          globalDogMeetings: globalDogCapture.result.meetings.length,
          dateFieldMeetings: dateFieldCapture.result.meetings.length,
          missingMeetings: fullMissCapture.result.meetings.length,
        },
        cases: {
          defaultDate: "bounded-date-summary-and-eight-race-replay-projection",
          globalDog:
            "bounded-eighty-dog-and-ninety-six-runner-candidate-path",
          dateField: "bounded-field-ranked-search-path",
          fullMiss: "field-runner-exact-and-trigram-fallbacks-return-empty",
          stateBound: "sixteen-distinct-state-sql-limit",
          maximum:
            "conservative-7053-row-materialization-bound-includes-mutually-exclusive-ranking-fallbacks",
          notFound: "explicit-empty-meeting-and-replay-collections",
        },
        rls: {
          anonymousReplayStatements: statementEvidence.length,
          anonymousReplayFailures: 0,
        },
        statements: statementEvidence,
        status: "verified",
      },
      cleanup: { ...removed, remainingRows },
      verdict: "verified",
    } as const;
    validateRaceSearchEvidence(report, root);
    const outputPath = resolve(root, RACE_SEARCH_EVIDENCE_PATH);
    const temporaryPath = `${outputPath}.tmp`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    return { report, outputPath };
  } finally {
    if (cleanupRequired) await cleanupFixtures(cleanupPrisma);
    await Promise.all([prisma.$disconnect(), cleanupPrisma.$disconnect()]);
  }
}

async function setupFixtures(prisma: PrismaClient) {
  await cleanupFixtures(prisma);
  await prisma.track.create({
    data: {
      id: TRACK_ID,
      name: "Albion Park",
      state: "QLD",
      hasIsolynx: true,
    },
  });
  await prisma.meeting.create({
    data: {
      id: MEETING_ID,
      trackId: TRACK_ID,
      meetingDate: FIXTURE_NOW,
      sourceProvider: "proof",
      sourceId: "race-search-meeting",
      sourceRawJson: SOURCE_CANARY,
    },
  });
  await prisma.race.create({
    data: {
      id: RACE_ID,
      meetingId: MEETING_ID,
      raceNumber: 1,
      name: "Proof Sprint",
      raceTime: FIXTURE_NOW,
      distance: 520,
      grade: "5",
      resultStatus: "resulted",
      sourceProvider: "proof",
      sourceId: "race-search-race",
      sourceRawJson: SOURCE_CANARY,
    },
  });
  await prisma.dog.create({
    data: {
      id: DOG_ID,
      name: "Proof Hound",
      sourceProvider: "proof",
      sourceId: "race-search-dog",
      profileSourceRawJson: SOURCE_CANARY,
    },
  });
  await prisma.runner.create({
    data: {
      id: RUNNER_ID,
      raceId: RACE_ID,
      dogId: DOG_ID,
      boxNumber: 1,
      sourceProvider: "proof",
      sourceId: "race-search-runner",
      sourceRawJson: SOURCE_CANARY,
    },
  });
  await prisma.result.create({
    data: {
      id: RESULT_ID,
      runnerId: RUNNER_ID,
      raceId: RACE_ID,
      finishingPosition: 1,
      runningTime: 29.8,
      sourceProvider: "proof",
      sourceId: "race-search-result",
      sourceRawJson: SOURCE_CANARY,
    },
  });
  await prisma.raceVideo.create({
    data: {
      id: VIDEO_ID,
      raceId: RACE_ID,
      sourceProvider: "proof",
      sourceId: "race-search-video",
      pageUrl: "https://example.invalid/race-search-proof",
      streamUrl: "https://example.invalid/race-search-proof.m3u8",
      sourceStatus: 200,
      sourceRawJson: SOURCE_CANARY,
      fetchedAt: FIXTURE_NOW,
    },
  });
}

async function cleanupFixtures(prisma: PrismaClient) {
  const videoRowsDeleted = await prisma.raceVideo.deleteMany({
    where: { id: VIDEO_ID },
  });
  const resultRowsDeleted = await prisma.result.deleteMany({
    where: { id: RESULT_ID },
  });
  const runnerRowsDeleted = await prisma.runner.deleteMany({
    where: { id: RUNNER_ID },
  });
  const dogRowsDeleted = await prisma.dog.deleteMany({ where: { id: DOG_ID } });
  const raceRowsDeleted = await prisma.race.deleteMany({ where: { id: RACE_ID } });
  const meetingRowsDeleted = await prisma.meeting.deleteMany({
    where: { id: MEETING_ID },
  });
  const trackRowsDeleted = await prisma.track.deleteMany({
    where: { id: TRACK_ID },
  });
  return {
    videoRowsDeleted: videoRowsDeleted.count,
    resultRowsDeleted: resultRowsDeleted.count,
    runnerRowsDeleted: runnerRowsDeleted.count,
    dogRowsDeleted: dogRowsDeleted.count,
    raceRowsDeleted: raceRowsDeleted.count,
    meetingRowsDeleted: meetingRowsDeleted.count,
    trackRowsDeleted: trackRowsDeleted.count,
  };
}

async function countFixtureRows(prisma: PrismaClient) {
  const counts = await Promise.all([
    prisma.raceVideo.count({ where: { id: VIDEO_ID } }),
    prisma.result.count({ where: { id: RESULT_ID } }),
    prisma.runner.count({ where: { id: RUNNER_ID } }),
    prisma.dog.count({ where: { id: DOG_ID } }),
    prisma.race.count({ where: { id: RACE_ID } }),
    prisma.meeting.count({ where: { id: MEETING_ID } }),
    prisma.track.count({ where: { id: TRACK_ID } }),
  ]);
  return counts.reduce((total, count) => total + count, 0);
}

function assertNoSourceCanary(value: unknown) {
  assert.doesNotMatch(JSON.stringify(value), new RegExp(SOURCE_CANARY, "i"));
}

function collectObservedStatements(cases: CapturedCase[]) {
  const unique = new Map<
    string,
    { event: DisposableReplayQueryEvent; origins: Set<CapturedCase["name"]> }
  >();
  for (const capturedCase of cases) {
    for (const event of capturedCase.queries) {
      const normalizedSql = normalizeObservedSql(event.query);
      const statementType = statementTypeOf(normalizedSql);
      if (!statementType) continue;
      assert.doesNotMatch(normalizedSql, /;|--|\/\*/);
      const existing = unique.get(normalizedSql);
      if (existing) {
        existing.origins.add(capturedCase.name);
      } else {
        unique.set(normalizedSql, {
          event,
          origins: new Set([capturedCase.name]),
        });
      }
    }
  }
  return [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([normalizedSql, observed], index): ObservedStatement => {
      const parameters = parsePrismaParameters(observed.event.params);
      return {
        variant: `search-${String(index + 1).padStart(2, "0")}`,
        origins: [...observed.origins].sort(),
        normalizedSql,
        parameters,
        evidence: {
          statementType: statementTypeOf(normalizedSql)!,
          normalizedSql,
          sha256: sha256(normalizedSql),
          parameterCount: parameters.length,
          persistedParameterValues: false,
        },
      };
    });
}

function statementTypeOf(value: string): "SELECT" | "WITH" | null {
  if (value.startsWith("SELECT")) return "SELECT";
  if (value.startsWith("WITH")) return "WITH";
  return null;
}

function parsePrismaParameters(value: string) {
  const parsed = JSON.parse(value) as unknown;
  assert.ok(Array.isArray(parsed));
  return parsed.map(decodePrismaParameter);
}

function decodePrismaParameter(value: unknown): unknown {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)? UTC$/.test(value)
  ) {
    return new Date(value);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record.prisma__type === "date") {
    assert.equal(typeof record.prisma__value, "string");
    return new Date(record.prisma__value as string);
  }
  return value;
}

function normalizeObservedSql(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function explainObservedStatement(
  runner: TransactionRunner,
  observed: ObservedStatement,
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
  const { report, outputPath } = await runRaceSearchVerifier();
  console.log(
    JSON.stringify({
      verdict: report.verdict,
      queryId: report.proof.queryId,
      statements: report.proof.statementCount,
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
