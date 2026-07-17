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

export const RACE_DETAIL_VERIFY_CONFIRMATION =
  "verify-race-detail-on-disposable-loopback-55734";
export const RACE_DETAIL_EVIDENCE_PATH =
  "output/database-audit/race-detail-read.json";
export const RACE_DETAIL_EVIDENCE_SCHEMA_VERSION = 1;

const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const EXPECTED_MAXIMUM_ROWS = 812;
const FIXTURE_NOW = new Date("2026-07-01T12:00:00.000Z");
const RAW_CANARY = "race-detail-private-raw-canary";
const TRACK_ID = "race-detail-track-proof";
const MEETING_ID = "race-detail-meeting-proof";
const TRAINER_ID = "race-detail-trainer-proof";
const CURRENT_RACE_ID = "race-detail-current-proof";
const PREVIOUS_RACE_ID = "race-detail-previous-proof";
const MISSING_RACE_ID = "race-detail-missing-proof";
const DOG_IDS = ["race-detail-dog-one-proof", "race-detail-dog-two-proof"] as const;
const RUNNER_IDS = [
  "race-detail-current-runner-one-proof",
  "race-detail-current-runner-two-proof",
  "race-detail-previous-runner-proof",
] as const;
const RESULT_IDS = [
  "race-detail-current-result-one-proof",
  "race-detail-current-result-two-proof",
  "race-detail-previous-result-proof",
] as const;
const FORM_ENTRY_IDS = [
  "race-detail-form-one-proof",
  "race-detail-form-two-proof",
] as const;
const PROFILE_FORM_IDS = [
  "race-detail-profile-form-one-proof",
  "race-detail-profile-form-two-proof",
] as const;
const VIDEO_IDS = [
  "race-detail-current-video-proof",
  "race-detail-previous-video-proof",
] as const;
const SOURCE_FILES = [
  "prisma/schema.prisma",
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "scripts/check-race-detail-postgres.ts",
  "scripts/check-race-detail-postgres.test.ts",
  "security/mandatory-public-racing-database-operations.ts",
  "src/app/races/[id]/page.tsx",
  "src/components/runner-row.tsx",
  "src/lib/db-context.ts",
  "src/lib/db.ts",
  "src/lib/queries.ts",
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

type ObservedStatement = {
  phase: "current-detail" | "previous-replays";
  variant: string;
  normalizedSql: string;
  parameters: unknown[];
  evidence: {
    statementType: "SELECT";
    normalizedSql: string;
    sha256: string;
    parameterCount: number;
    persistedParameterValues: false;
  };
};

export function assertRaceDetailVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, RACE_DETAIL_VERIFY_CONFIRMATION);
  const url = new URL(value);
  assert.ok(url.protocol === "postgresql:" || url.protocol === "postgres:");
  assert.ok(url.hostname === "127.0.0.1" || url.hostname === "::1");
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

export function buildRaceDetailSourceBinding(
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

export function validateRaceDetailEvidence(
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
  assert.equal(evidence.schemaVersion, RACE_DETAIL_EVIDENCE_SCHEMA_VERSION);
  assert.equal(evidence.auditKind, "race-detail-read-disposable-proof");
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(evidence.sourceBinding, buildRaceDetailSourceBinding(root));
  assert.deepEqual(evidence.runtimeIdentity, {
    role: "greyhoundiq_runtime",
    sessionRole: "greyhoundiq_runtime",
    database: "greyhoundiq",
    schema: "public",
    canLogin: true,
    superuser: false,
    bypassRls: false,
  });
  assert.deepEqual(evidence.safety, {
    scope: "literal-loopback-disposable-replay-only",
    host: "127.0.0.1",
    port: 55734,
    productionOrProviderSystemsContacted: false,
    fixtureOwner: "race-detail-dedicated-proof",
    broadCleanupUsed: false,
  });
  assert.deepEqual(evidence.cleanup, {
    raceVideoRowsDeleted: 2,
    profileFormRowsDeleted: 2,
    formEntryRowsDeleted: 2,
    resultRowsDeleted: 3,
    runnerRowsDeleted: 3,
    raceRowsDeleted: 2,
    dogRowsDeleted: 2,
    meetingRowsDeleted: 1,
    trackRowsDeleted: 1,
    trainerRowsDeleted: 1,
    remainingRows: 0,
  });

  const proof = evidence.proof as Record<string, unknown>;
  assert.equal(proof.queryId, "DB.RACING.RACE.OPEN.DETAIL_BUNDLE");
  assert.equal(proof.sourceFile, "src/lib/queries.ts");
  assert.equal(
    proof.sourceSymbol,
    "getRaceById + getPreviousRaceVideoRunners",
  );
  assert.equal(proof.expectedMaximumRows, EXPECTED_MAXIMUM_ROWS);
  assert.equal(proof.status, "verified");
  assert.deepEqual(proof.rowCounts, {
    before: 19,
    afterPopulatedRead: 19,
    afterEmptyRead: 19,
  });
  assert.deepEqual(proof.populated, {
    currentRace: "returned",
    meetingRaces: 2,
    currentRunners: 2,
    currentVideos: 1,
    runnerFormEntries: 2,
    runnerProfileForms: 2,
    previousReplayCandidates: 1,
    previousCandidateVideos: 1,
  });
  assert.deepEqual(proof.empty, {
    currentRace: null,
    previousReplayCandidates: 0,
    mutation: "none",
  });
  assert.deepEqual(proof.projection, {
    internalRawColumnsSelected: false,
    rawCanariesReturned: false,
    accountTablesQueried: false,
  });
  const statements = proof.statements as Array<Record<string, unknown>>;
  assert.equal(statements.length, proof.statementCount);
  assert.ok(statements.length >= 15, "expected the full relation bundle");
  assert.equal(
    new Set(statements.map((statement) => statement.variant)).size,
    statements.length,
  );
  assert.deepEqual(
    [...new Set(statements.map((statement) => statement.phase))].sort(),
    ["current-detail", "previous-replays"],
  );
  for (const statement of statements) {
    const observedSql = statement.observedSql as Record<string, unknown>;
    assert.equal(observedSql.statementType, "SELECT");
    assert.equal(observedSql.persistedParameterValues, false);
    assert.equal(observedSql.sha256, sha256(String(observedSql.normalizedSql)));
    const sql = String(observedSql.normalizedSql);
    assert.doesNotMatch(
      sql,
      /sourceRawJson|profileSourceRawJson|gpsData|sectionals|"public"\."User"|"public"\."Profile"/,
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
  assert.deepEqual(proof.rls, {
    anonymousReplayStatements: statements.length,
    anonymousReplayFailures: 0,
  });
  assert.deepEqual(proof.cases, {
    currentRunnerBound: "twelve-row-source-and-sql-limit",
    meetingRaceBound: "twenty-four-row-source-and-sql-limit",
    dogFormBound: "six-row-source-and-sql-limit",
    dogProfileFormBound: "eight-row-source-and-sql-limit",
    raceVideoBound: "sixteen-row-source-and-sql-limit",
    previousRunnerBound: "twenty-four-row-source-and-sql-limit",
    previousRaceFilter: "strictly-before-current-race-with-replay-capability",
    publicProjection: "exact-fields-no-provider-raw-account-or-contact-data",
    notFound: "both-services-returned-empty-contracts",
  });
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, /race-detail-(?:track|meeting|trainer|current|previous|dog|form|profile)/i);
  assert.doesNotMatch(serialized, new RegExp(RAW_CANARY, "i"));
  return evidence;
}

export async function runRaceDetailVerifier() {
  const root = process.cwd();
  const runtimeUrl = assertRaceDetailVerifierTarget(
    requiredEnvironment("RACE_DETAIL_VERIFY_DATABASE_URL"),
    process.env.RACE_DETAIL_VERIFY_CONFIRM,
  );
  const applicationUrl = new URL(runtimeUrl);
  applicationUrl.searchParams.set("connection_limit", "6");
  process.env.DATABASE_URL = applicationUrl.toString();
  process.env.DIRECT_URL = applicationUrl.toString();
  process.env.DEMO_FIXTURE_QUERY_EVIDENCE_MODE = QUERY_EVIDENCE_MODE;
  const cleanupUrl = new URL(runtimeUrl);
  cleanupUrl.username = "postgres";

  const [
    { PrismaClient },
    { prisma, captureDisposableReplayQueries },
    { withDbAnonymousContext },
    { getRaceById, getPreviousRaceVideoRunners },
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
    assert.equal(before, 19);

    const detailCapture = await captureDisposableReplayQueries(() =>
      getRaceById(CURRENT_RACE_ID),
    );
    const race = detailCapture.result;
    assert.ok(race);
    assert.equal(race.id, CURRENT_RACE_ID);
    assert.equal(race.meeting.races.length, 2);
    assert.equal(race.runners.length, 2);
    assert.equal(race.videos.length, 1);
    assert.equal(
      race.runners.reduce(
        (total, runner) => total + runner.dog.formEntries.length,
        0,
      ),
      2,
    );
    assert.equal(
      race.runners.reduce(
        (total, runner) => total + runner.dog.profileForms.length,
        0,
      ),
      2,
    );
    assertNoForbiddenProjection(race);

    const previousCapture = await captureDisposableReplayQueries(() =>
      getPreviousRaceVideoRunners(CURRENT_RACE_ID),
    );
    const previous = previousCapture.result;
    assert.equal(previous.length, 1);
    assert.equal(previous[0].race.id, PREVIOUS_RACE_ID);
    assert.equal(previous[0].race.videos.length, 1);
    assertNoForbiddenProjection(previous);
    const afterPopulatedRead = await countFixtureRows(cleanupPrisma);
    assert.equal(afterPopulatedRead, 19);

    const statements = [
      ...collectObservedStatements("current-detail", detailCapture.queries),
      ...collectObservedStatements(
        "previous-replays",
        previousCapture.queries,
      ),
    ];
    assert.ok(statements.length >= 15);
    assertObservedLimit(statements, "Runner", 12);
    assertObservedLimit(statements, "Race", 24);
    assertObservedLimit(statements, "FormEntry", 6);
    assertObservedLimit(statements, "DogProfileForm", 8);
    assertObservedLimit(statements, "RaceVideo", 16);
    assertObservedLimit(statements, "Runner", 24);
    for (const statement of statements) {
      assert.doesNotMatch(
        statement.normalizedSql,
        /sourceRawJson|profileSourceRawJson|gpsData|sectionals|"public"\."User"|"public"\."Profile"/,
      );
    }

    const statementEvidence = [];
    for (const statement of statements) {
      const anonymousRows = await withDbAnonymousContext((tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          statement.normalizedSql,
          ...statement.parameters,
        ),
      );
      statementEvidence.push({
        phase: statement.phase,
        variant: statement.variant,
        observedSql: statement.evidence,
        explain: await explainObservedStatement(
          withDbAnonymousContext,
          statement,
        ),
        anonymousReplay: { status: "allowed", rows: anonymousRows.length },
      });
    }

    const missingRace = await getRaceById(MISSING_RACE_ID);
    const missingPrevious = await getPreviousRaceVideoRunners(MISSING_RACE_ID);
    assert.equal(missingRace, null);
    assert.deepEqual(missingPrevious, []);
    const afterEmptyRead = await countFixtureRows(cleanupPrisma);
    assert.equal(afterEmptyRead, 19);

    const removed = await cleanupFixtures(cleanupPrisma, true);
    cleanupRequired = false;
    const remainingRows = await countFixtureRows(cleanupPrisma);
    assert.equal(remainingRows, 0);

    const report = {
      schemaVersion: RACE_DETAIL_EVIDENCE_SCHEMA_VERSION,
      auditKind: "race-detail-read-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: runtimeUrl.hostname,
        port: Number(runtimeUrl.port),
        productionOrProviderSystemsContacted: false,
        fixtureOwner: "race-detail-dedicated-proof",
        broadCleanupUsed: false,
      },
      runtimeIdentity: identities[0],
      sourceBinding: buildRaceDetailSourceBinding(root),
      proof: {
        queryId: "DB.RACING.RACE.OPEN.DETAIL_BUNDLE",
        sourceFile: "src/lib/queries.ts",
        sourceSymbol: "getRaceById + getPreviousRaceVideoRunners",
        expectedMaximumRows: EXPECTED_MAXIMUM_ROWS,
        statementCount: statementEvidence.length,
        rowCounts: { before, afterPopulatedRead, afterEmptyRead },
        populated: {
          currentRace: "returned",
          meetingRaces: race.meeting.races.length,
          currentRunners: race.runners.length,
          currentVideos: race.videos.length,
          runnerFormEntries: race.runners.reduce(
            (total, runner) => total + runner.dog.formEntries.length,
            0,
          ),
          runnerProfileForms: race.runners.reduce(
            (total, runner) => total + runner.dog.profileForms.length,
            0,
          ),
          previousReplayCandidates: previous.length,
          previousCandidateVideos: previous.reduce(
            (total, candidate) => total + candidate.race.videos.length,
            0,
          ),
        },
        empty: {
          currentRace: null,
          previousReplayCandidates: 0,
          mutation: "none",
        },
        projection: {
          internalRawColumnsSelected: false,
          rawCanariesReturned: false,
          accountTablesQueried: false,
        },
        rls: {
          anonymousReplayStatements: statementEvidence.length,
          anonymousReplayFailures: 0,
        },
        cases: {
          currentRunnerBound: "twelve-row-source-and-sql-limit",
          meetingRaceBound: "twenty-four-row-source-and-sql-limit",
          dogFormBound: "six-row-source-and-sql-limit",
          dogProfileFormBound: "eight-row-source-and-sql-limit",
          raceVideoBound: "sixteen-row-source-and-sql-limit",
          previousRunnerBound: "twenty-four-row-source-and-sql-limit",
          previousRaceFilter:
            "strictly-before-current-race-with-replay-capability",
          publicProjection:
            "exact-fields-no-provider-raw-account-or-contact-data",
          notFound: "both-services-returned-empty-contracts",
        },
        statements: statementEvidence,
        status: "verified",
      },
      cleanup: { ...removed, remainingRows },
      verdict: "verified",
    } as const;
    validateRaceDetailEvidence(report, root);
    const outputPath = resolve(root, RACE_DETAIL_EVIDENCE_PATH);
    const temporaryPath = `${outputPath}.tmp`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    return { report, outputPath };
  } finally {
    if (cleanupRequired) await cleanupFixtures(cleanupPrisma, false);
    await Promise.all([prisma.$disconnect(), cleanupPrisma.$disconnect()]);
  }
}

async function setupFixtures(prisma: PrismaClient) {
  await cleanupFixtures(prisma, false);
  const previousTime = new Date(FIXTURE_NOW.getTime() - 60 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.trainer.create({
      data: { id: TRAINER_ID, name: "Race detail proof trainer", state: "NSW" },
    });
    await tx.track.create({
      data: { id: TRACK_ID, name: "Race detail proof track", state: "NSW" },
    });
    await tx.meeting.create({
      data: {
        id: MEETING_ID,
        trackId: TRACK_ID,
        meetingDate: new Date("2026-07-01T00:00:00.000Z"),
        sourceProvider: "race-detail-proof",
        sourceId: "meeting",
        sourceRawJson: RAW_CANARY,
      },
    });
    await tx.dog.createMany({
      data: DOG_IDS.map((id, index) => ({
        id,
        name: `Race detail proof dog ${index + 1}`,
        colour: index === 0 ? "Black" : "Blue",
        sex: index === 0 ? "M" : "F",
        trainerId: TRAINER_ID,
        sourceProvider: "race-detail-proof",
        sourceId: `dog-${index + 1}`,
        profileSourceRawJson: RAW_CANARY,
      })),
    });
    await tx.race.createMany({
      data: [
        {
          id: PREVIOUS_RACE_ID,
          meetingId: MEETING_ID,
          raceNumber: 1,
          name: "Previous proof race",
          raceTime: previousTime,
          distance: 520,
          grade: "5",
          resultStatus: "complete",
          replayUrl: "https://example.invalid/race-detail-previous",
          sourceProvider: "race-detail-proof",
          sourceId: "previous",
          sourceRawJson: RAW_CANARY,
        },
        {
          id: CURRENT_RACE_ID,
          meetingId: MEETING_ID,
          raceNumber: 2,
          name: "Current proof race",
          raceTime: FIXTURE_NOW,
          distance: 520,
          grade: "5",
          prizeMoney: 12_000,
          resultStatus: "complete",
          replayUrl: "https://example.invalid/race-detail-current",
          sourceProvider: "race-detail-proof",
          sourceId: "current",
          sourceRawJson: RAW_CANARY,
        },
      ],
    });
    await tx.runner.createMany({
      data: [
        {
          id: RUNNER_IDS[0],
          raceId: CURRENT_RACE_ID,
          dogId: DOG_IDS[0],
          boxNumber: 1,
          weight: 31.2,
          trainerId: TRAINER_ID,
          sourceRawJson: RAW_CANARY,
        },
        {
          id: RUNNER_IDS[1],
          raceId: CURRENT_RACE_ID,
          dogId: DOG_IDS[1],
          boxNumber: 2,
          weight: 29.8,
          trainerId: TRAINER_ID,
          sourceRawJson: RAW_CANARY,
        },
        {
          id: RUNNER_IDS[2],
          raceId: PREVIOUS_RACE_ID,
          dogId: DOG_IDS[0],
          boxNumber: 1,
          weight: 31.0,
          trainerId: TRAINER_ID,
          sourceRawJson: RAW_CANARY,
        },
      ],
    });
    await tx.result.createMany({
      data: [
        {
          id: RESULT_IDS[0],
          runnerId: RUNNER_IDS[0],
          raceId: CURRENT_RACE_ID,
          finishingPosition: 1,
          runningTime: 29.8,
          prizeMoneyWon: 8_000,
          sourceRawJson: RAW_CANARY,
          gpsData: RAW_CANARY,
          sectionals: RAW_CANARY,
        },
        {
          id: RESULT_IDS[1],
          runnerId: RUNNER_IDS[1],
          raceId: CURRENT_RACE_ID,
          finishingPosition: 2,
          runningTime: 30.0,
          sourceRawJson: RAW_CANARY,
          gpsData: RAW_CANARY,
          sectionals: RAW_CANARY,
        },
        {
          id: RESULT_IDS[2],
          runnerId: RUNNER_IDS[2],
          raceId: PREVIOUS_RACE_ID,
          finishingPosition: 1,
          runningTime: 29.9,
          sourceRawJson: RAW_CANARY,
          gpsData: RAW_CANARY,
          sectionals: RAW_CANARY,
        },
      ],
    });
    await tx.formEntry.createMany({
      data: DOG_IDS.map((dogId, index) => ({
        id: FORM_ENTRY_IDS[index],
        dogId,
        raceId: PREVIOUS_RACE_ID,
        trackId: TRACK_ID,
        date: previousTime,
        finish: index + 1,
      })),
    });
    await tx.dogProfileForm.createMany({
      data: DOG_IDS.map((dogId, index) => ({
        id: PROFILE_FORM_IDS[index],
        dogId,
        sourceProvider: "race-detail-proof",
        sourceId: `profile-${index + 1}`,
        raceUrl: `https://example.invalid/race-detail-profile-${index + 1}`,
        date: previousTime,
        trackName: "Race detail proof track",
        raceName: "Previous proof race",
        finishText: String(index + 1),
        finishingPosition: index + 1,
        distance: 520,
        grade: "5",
        runningTime: 29.9 + index / 10,
        winnerTime: 29.9,
        hasVideo: true,
        sourceRawJson: RAW_CANARY,
      })),
    });
    await tx.raceVideo.createMany({
      data: [
        {
          id: VIDEO_IDS[0],
          raceId: CURRENT_RACE_ID,
          sourceProvider: "race-detail-proof-current",
          sourceId: "current-video",
          pageUrl: "https://example.invalid/race-detail-current-video",
          streamUrl: "https://example.invalid/race-detail-current.m3u8",
          sourceStatus: 200,
          fetchedAt: FIXTURE_NOW,
          sourceRawJson: RAW_CANARY,
        },
        {
          id: VIDEO_IDS[1],
          raceId: PREVIOUS_RACE_ID,
          sourceProvider: "race-detail-proof-previous",
          sourceId: "previous-video",
          pageUrl: "https://example.invalid/race-detail-previous-video",
          streamUrl: "https://example.invalid/race-detail-previous.m3u8",
          sourceStatus: 200,
          fetchedAt: previousTime,
          sourceRawJson: RAW_CANARY,
        },
      ],
    });
  });
}

async function cleanupFixtures(prisma: PrismaClient, requireExact: boolean) {
  const removed = await prisma.$transaction(async (tx) => {
    const raceVideos = await tx.raceVideo.deleteMany({
      where: { id: { in: [...VIDEO_IDS] } },
    });
    const profileForms = await tx.dogProfileForm.deleteMany({
      where: { id: { in: [...PROFILE_FORM_IDS] } },
    });
    const formEntries = await tx.formEntry.deleteMany({
      where: { id: { in: [...FORM_ENTRY_IDS] } },
    });
    const results = await tx.result.deleteMany({
      where: { id: { in: [...RESULT_IDS] } },
    });
    const runners = await tx.runner.deleteMany({
      where: { id: { in: [...RUNNER_IDS] } },
    });
    const races = await tx.race.deleteMany({
      where: { id: { in: [CURRENT_RACE_ID, PREVIOUS_RACE_ID] } },
    });
    const dogs = await tx.dog.deleteMany({
      where: { id: { in: [...DOG_IDS] } },
    });
    const meetings = await tx.meeting.deleteMany({ where: { id: MEETING_ID } });
    const tracks = await tx.track.deleteMany({ where: { id: TRACK_ID } });
    const trainers = await tx.trainer.deleteMany({ where: { id: TRAINER_ID } });
    return {
      raceVideoRowsDeleted: raceVideos.count,
      profileFormRowsDeleted: profileForms.count,
      formEntryRowsDeleted: formEntries.count,
      resultRowsDeleted: results.count,
      runnerRowsDeleted: runners.count,
      raceRowsDeleted: races.count,
      dogRowsDeleted: dogs.count,
      meetingRowsDeleted: meetings.count,
      trackRowsDeleted: tracks.count,
      trainerRowsDeleted: trainers.count,
    };
  });
  if (requireExact) {
    assert.deepEqual(removed, {
      raceVideoRowsDeleted: 2,
      profileFormRowsDeleted: 2,
      formEntryRowsDeleted: 2,
      resultRowsDeleted: 3,
      runnerRowsDeleted: 3,
      raceRowsDeleted: 2,
      dogRowsDeleted: 2,
      meetingRowsDeleted: 1,
      trackRowsDeleted: 1,
      trainerRowsDeleted: 1,
    });
  }
  return removed;
}

async function countFixtureRows(prisma: PrismaClient) {
  const counts = await Promise.all([
    prisma.raceVideo.count({ where: { id: { in: [...VIDEO_IDS] } } }),
    prisma.dogProfileForm.count({ where: { id: { in: [...PROFILE_FORM_IDS] } } }),
    prisma.formEntry.count({ where: { id: { in: [...FORM_ENTRY_IDS] } } }),
    prisma.result.count({ where: { id: { in: [...RESULT_IDS] } } }),
    prisma.runner.count({ where: { id: { in: [...RUNNER_IDS] } } }),
    prisma.race.count({ where: { id: { in: [CURRENT_RACE_ID, PREVIOUS_RACE_ID] } } }),
    prisma.dog.count({ where: { id: { in: [...DOG_IDS] } } }),
    prisma.meeting.count({ where: { id: MEETING_ID } }),
    prisma.track.count({ where: { id: TRACK_ID } }),
    prisma.trainer.count({ where: { id: TRAINER_ID } }),
  ]);
  return counts.reduce((total, count) => total + count, 0);
}

function assertNoForbiddenProjection(value: unknown) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, new RegExp(RAW_CANARY, "i"));
  assert.doesNotMatch(
    serialized,
    /sourceRawJson|profileSourceRawJson|gpsData|sectionals|subscriptionTier|stripeCustomerId/,
  );
}

function collectObservedStatements(
  phase: ObservedStatement["phase"],
  queries: DisposableReplayQueryEvent[],
) {
  const unique = new Map<string, DisposableReplayQueryEvent>();
  for (const event of queries) {
    const normalizedSql = normalizeObservedSql(event.query);
    if (!normalizedSql.startsWith("SELECT")) continue;
    assert.doesNotMatch(normalizedSql, /;|--|\/\*/);
    unique.set(normalizedSql, event);
  }
  return [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([normalizedSql, event], index): ObservedStatement => {
      const parameters = parsePrismaParameters(event.params);
      return {
        phase,
        variant: `${phase}-${String(index + 1).padStart(2, "0")}`,
        normalizedSql,
        parameters,
        evidence: {
          statementType: "SELECT",
          normalizedSql,
          sha256: sha256(normalizedSql),
          parameterCount: parameters.length,
          persistedParameterValues: false,
        },
      };
    });
}

function assertObservedLimit(
  statements: readonly ObservedStatement[],
  table: string,
  value: number,
) {
  const tableStatements = statements.filter((statement) =>
    statement.normalizedSql.includes(`"${table}"`),
  );
  assert.ok(
    tableStatements.some((statement) => {
      return statement.parameters.some(
        (parameter, index) =>
          parameter === value &&
          new RegExp(`\\bLIMIT \\$${index + 1}\\b`, "i").test(
            statement.normalizedSql,
          ),
      );
    }),
    `${table} must carry SQL LIMIT ${value}; observed ${JSON.stringify(
      tableStatements.map((statement) => ({
        sql: statement.normalizedSql,
        parameters: statement.parameters,
      })),
    )}`,
  );
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
  const { report, outputPath } = await runRaceDetailVerifier();
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
