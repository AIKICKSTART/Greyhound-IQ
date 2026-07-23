import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "@prisma/client";

import type { DisposableReplayQueryEvent } from "../src/lib/db";
import type { LiveMeeting } from "../src/lib/live/provider";

export const LIVE_PROVIDER_INGEST_VERIFY_CONFIRMATION =
  "verify-live-provider-ingest-on-disposable-loopback-55734";
export const LIVE_PROVIDER_INGEST_EVIDENCE_PATH =
  "output/database-audit/live-provider-ingest.json";
export const LIVE_PROVIDER_INGEST_EVIDENCE_SCHEMA_VERSION = 1;

const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const PROVIDER = "local-provider-ingest-proof";
const COMMIT_TRACK = "Provider Ingest Commit Proof";
const ROLLBACK_TRACK = "Provider Ingest Rollback Proof";
const COMMIT_DOG_EAR_BRAND = "PROOF-COMMIT-001";
const ROLLBACK_DOG_EAR_BRAND = "PROOF-ROLLBACK-001";
const COMMIT_TRAINER = "Provider Ingest Commit Trainer";
const ROLLBACK_TRAINER = "Provider Ingest Rollback Trainer";
const TABLES = [
  "Track",
  "Meeting",
  "Race",
  "RaceVideo",
  "Dog",
  "Trainer",
  "Runner",
  "Result",
  "FormEntry",
] as const;
const MUTATED_TABLES = TABLES.filter((table) => table !== "Trainer");
const SOURCE_FILES = [
  "prisma/migrations/20260708190000_add_rls_remaining_tables/migration.sql",
  "scripts/check-live-provider-ingest-postgres.ts",
  "scripts/check-live-provider-ingest-postgres.test.ts",
  "security/mandatory-public-racing-database-operations.ts",
  "src/lib/db-context.ts",
  "src/lib/db.ts",
  "src/lib/live/sync.ts",
] as const;

type TableName = (typeof TABLES)[number];
type RuntimeIdentity = {
  role: string;
  sessionRole: string;
  database: string;
  schema: string;
  canLogin: boolean;
  superuser: boolean;
  bypassRls: boolean;
};
type FixtureCounts = Record<TableName, number>;
type SourceBinding = {
  files: Record<string, string>;
  combinedSha256: string;
};

export function assertLiveProviderIngestVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, LIVE_PROVIDER_INGEST_VERIFY_CONFIRMATION);
  const url = new URL(value);
  assert.ok(url.protocol === "postgresql:" || url.protocol === "postgres:");
  assert.equal(url.hostname, "127.0.0.1");
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

export function buildLiveProviderIngestSourceBinding(
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

export function validateLiveProviderIngestEvidence(
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
    LIVE_PROVIDER_INGEST_EVIDENCE_SCHEMA_VERSION,
  );
  assert.equal(evidence.auditKind, "live-provider-ingest-disposable-proof");
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(
    evidence.sourceBinding,
    buildLiveProviderIngestSourceBinding(root),
  );
  assert.deepEqual(evidence.runtimeIdentity, expectedRuntimeIdentity());
  assert.deepEqual(evidence.safety, {
    scope: "literal-loopback-disposable-replay-only",
    host: "127.0.0.1",
    port: 55734,
    productionTopology: "Prisma plus AlloyDB for PostgreSQL",
    productionOrProviderSystemsContacted: false,
    providerNetworkAccess: false,
    fixtureOwner: "live-provider-ingest-dedicated-proof",
    broadCleanupUsed: false,
  });

  const proof = evidence.proof as Record<string, unknown>;
  assert.equal(proof.queryId, "DB.RACING.PROVIDER.INGEST.TRANSACTION");
  assert.equal(proof.sourceFile, "src/lib/live/sync.ts");
  assert.equal(proof.sourceSymbol, "syncLiveMeetings/upsertSystemMeetings");
  assert.equal(proof.status, "verified");
  assert.deepEqual(proof.successCounts, {
    meetings: 1,
    races: 1,
    runners: 1,
    results: 1,
  });
  assert.deepEqual(proof.systemContext, [
    { key: "app.system", value: "true" },
    { key: "app.current_tier", value: "system" },
    { key: "app.current_role", value: "system" },
  ]);
  assert.deepEqual(proof.rowCounts, {
    before: splitCounts(zeroCounts(), zeroCounts()),
    afterCommit: splitCounts(oneCounts(), zeroCounts()),
    afterForcedRollback: splitCounts(oneCounts(), zeroCounts()),
  });
  assert.deepEqual(proof.transactionOutcomes, {
    successfulBatch: "COMMIT",
    lateFailureBatch: "ROLLBACK",
    rollbackMutationsObservedBeforeFailure: ["Track", "Meeting", "Race"],
    rollbackRowsPersisted: 0,
  });

  const statements = proof.statements as Array<
    Record<string, unknown>
  >;
  assert.deepEqual(
    statements.map((statement) => statement.table),
    MUTATED_TABLES,
  );
  for (const statement of statements) {
    const observedSql = statement.observedSql as Record<string, unknown>;
    assert.equal(observedSql.statementType, "INSERT");
    assert.equal(observedSql.persistedParameterValues, false);
    assert.equal(
      observedSql.sha256,
      sha256(String(observedSql.normalizedSql)),
    );
    assert.ok(Number.isInteger(observedSql.parameterCount));
    assert.ok((observedSql.parameterCount as number) > 0);
  }
  assert.deepEqual(evidence.cleanup, {
    deleted: oneCounts(),
    remaining: splitCounts(zeroCounts(), zeroCounts()),
  });

  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, /PROOF-(?:COMMIT|ROLLBACK)-001/);
  assert.doesNotMatch(serialized, /Provider Ingest (?:Commit|Rollback)/);
  return evidence;
}

export async function runLiveProviderIngestVerifier(root = process.cwd()) {
  const runtimeUrl = assertLiveProviderIngestVerifierTarget(
    requiredEnvironment("LIVE_PROVIDER_INGEST_VERIFY_DATABASE_URL"),
    process.env.LIVE_PROVIDER_INGEST_VERIFY_CONFIRM,
  );
  configureSafeEnvironment(runtimeUrl);
  const cleanupUrl = new URL(runtimeUrl);
  cleanupUrl.username = "postgres";
  cleanupUrl.searchParams.set("connection_limit", "1");

  const [
    { PrismaClient },
    { prisma, captureDisposableReplayQueries },
    { syncLiveMeetings },
  ] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/db"),
    import("../src/lib/live/sync"),
  ]);
  const cleanupPrisma = new PrismaClient({
    datasources: { db: { url: cleanupUrl.toString() } },
  });
  let cleanupRequired = true;
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
    assert.deepEqual(identities, [expectedRuntimeIdentity()]);

    const stale = await cleanupFixtures(cleanupPrisma);
    assert.deepEqual(stale, zeroCounts(), "Verifier target must start clean");
    const before = await countFixtureRows(cleanupPrisma);
    assert.deepEqual(before, splitCounts(zeroCounts(), zeroCounts()));

    const committed = await captureDisposableReplayQueries(() =>
      syncLiveMeetings([commitMeeting()], PROVIDER),
    );
    assert.deepEqual(committed.result, {
      meetings: 1,
      races: 1,
      runners: 1,
      results: 1,
    });
    assertTransactionOutcome(committed.queries, "COMMIT");
    const systemContext = capturedSystemContext(committed.queries);
    const statements = MUTATED_TABLES.map((table) =>
      mutationEvidence(exactTableMutation(committed.queries, table), table),
    );
    const afterCommit = await countFixtureRows(cleanupPrisma);
    assert.deepEqual(afterCommit, splitCounts(oneCounts(), zeroCounts()));

    const rolledBack = await captureDisposableReplayQueries(async () => {
      let failed = false;
      try {
        await syncLiveMeetings([rollbackMeeting()], PROVIDER);
      } catch {
        failed = true;
      }
      return failed;
    });
    assert.equal(rolledBack.result, true, "Late synthetic failure must reject");
    assertTransactionOutcome(rolledBack.queries, "ROLLBACK");
    assert.deepEqual(capturedSystemContext(rolledBack.queries), systemContext);
    const rollbackMutationsObservedBeforeFailure = [
      "Track",
      "Meeting",
      "Race",
    ] as const;
    for (const table of rollbackMutationsObservedBeforeFailure) {
      exactTableMutation(rolledBack.queries, table);
    }
    const afterForcedRollback = await countFixtureRows(cleanupPrisma);
    assert.deepEqual(
      afterForcedRollback,
      splitCounts(oneCounts(), zeroCounts()),
    );

    const deleted = await cleanupFixtures(cleanupPrisma);
    cleanupRequired = false;
    assert.deepEqual(deleted, oneCounts());
    const remaining = await countFixtureRows(cleanupPrisma);
    assert.deepEqual(remaining, splitCounts(zeroCounts(), zeroCounts()));

    const report = {
      schemaVersion: LIVE_PROVIDER_INGEST_EVIDENCE_SCHEMA_VERSION,
      auditKind: "live-provider-ingest-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: runtimeUrl.hostname,
        port: Number(runtimeUrl.port),
        productionTopology: "Prisma plus AlloyDB for PostgreSQL",
        productionOrProviderSystemsContacted: false,
        providerNetworkAccess: false,
        fixtureOwner: "live-provider-ingest-dedicated-proof",
        broadCleanupUsed: false,
      },
      runtimeIdentity: identities[0],
      sourceBinding: buildLiveProviderIngestSourceBinding(root),
      proof: {
        queryId: "DB.RACING.PROVIDER.INGEST.TRANSACTION",
        sourceFile: "src/lib/live/sync.ts",
        sourceSymbol: "syncLiveMeetings/upsertSystemMeetings",
        successCounts: committed.result,
        systemContext,
        rowCounts: { before, afterCommit, afterForcedRollback },
        transactionOutcomes: {
          successfulBatch: "COMMIT",
          lateFailureBatch: "ROLLBACK",
          rollbackMutationsObservedBeforeFailure,
          rollbackRowsPersisted: 0,
        },
        statements,
        status: "verified",
      },
      cleanup: { deleted, remaining },
      verdict: "verified",
    } as const;
    validateLiveProviderIngestEvidence(report, root);
    const outputPath = resolve(root, LIVE_PROVIDER_INGEST_EVIDENCE_PATH);
    const temporaryPath = `${outputPath}.tmp`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    validateLiveProviderIngestEvidence(
      JSON.parse(readFileSync(outputPath, "utf8")) as unknown,
      root,
    );
    return { report, outputPath };
  } finally {
    if (cleanupRequired) await cleanupFixtures(cleanupPrisma);
    await Promise.all([prisma.$disconnect(), cleanupPrisma.$disconnect()]);
  }
}

function configureSafeEnvironment(runtimeUrl: URL) {
  const applicationUrl = new URL(runtimeUrl);
  applicationUrl.searchParams.set("connection_limit", "4");
  process.env.DATABASE_URL = applicationUrl.toString();
  process.env.DIRECT_URL = applicationUrl.toString();
  process.env.DEMO_FIXTURE_QUERY_EVIDENCE_MODE = QUERY_EVIDENCE_MODE;
  delete process.env.TOPAZ_API_KEY;
  process.env.THEDOGS_PROVIDER_ENABLED = "false";
  process.env.WATCHDOG_PROVIDER_ENABLED = "false";
  process.env.FASTTRACK_PROTOTYPE_ENABLED = "false";
}

function commitMeeting(): LiveMeeting {
  return {
    sourceProvider: PROVIDER,
    sourceId: "commit-meeting",
    trackName: COMMIT_TRACK,
    state: "NSW",
    meetingDate: "2026-07-15",
    meetingType: "Provincial",
    races: [
      {
        sourceProvider: PROVIDER,
        sourceId: "commit-race",
        raceNumber: 1,
        name: "Provider Ingest Commit Race",
        raceTime: "2026-07-15T10:00:00.000Z",
        distance: 520,
        grade: "5",
        resultStatus: "Final",
        replayUrl: "https://example.invalid/provider-ingest-proof",
        videoSourceId: "commit-video",
        videoSourceType: "provider-page",
        runners: [
          {
            sourceProvider: PROVIDER,
            sourceId: "commit-runner",
            boxNumber: 1,
            dog: {
              sourceProvider: "topaz",
              sourceId: "provider-ingest-commit-dog-proof",
              name: "Provider Ingest Commit Dog",
              earBrand: COMMIT_DOG_EAR_BRAND,
              sex: "M",
              colour: "Black",
            },
            trainerName: COMMIT_TRAINER,
            weight: 31.2,
            finishingPosition: 1,
            runningTime: 29.87,
          },
        ],
      },
    ],
  };
}

function rollbackMeeting(): LiveMeeting {
  return {
    sourceProvider: PROVIDER,
    sourceId: "rollback-meeting",
    trackName: ROLLBACK_TRACK,
    state: "VIC",
    meetingDate: "2026-07-16",
    races: [
      {
        sourceProvider: PROVIDER,
        sourceId: "rollback-race",
        raceNumber: 1,
        name: "Provider Ingest Rollback Race",
        raceTime: "2026-07-16T10:00:00.000Z",
        distance: 515,
        runners: [
          {
            sourceProvider: PROVIDER,
            sourceId: "rollback-runner",
            boxNumber: null,
            dog: {
              sourceProvider: "topaz",
              sourceId: "provider-ingest-rollback-dog-proof",
              name: "Provider Ingest Rollback Dog",
              earBrand: ROLLBACK_DOG_EAR_BRAND,
            },
            trainerName: ROLLBACK_TRAINER,
          },
        ],
      },
    ],
  } as unknown as LiveMeeting;
}

function expectedRuntimeIdentity(): RuntimeIdentity {
  return {
    role: "greyhoundiq_runtime",
    sessionRole: "greyhoundiq_runtime",
    database: "greyhoundiq",
    schema: "public",
    canLogin: true,
    superuser: false,
    bypassRls: false,
  };
}

function zeroCounts(): FixtureCounts {
  return Object.fromEntries(TABLES.map((table) => [table, 0])) as FixtureCounts;
}

function oneCounts(): FixtureCounts {
  return Object.fromEntries(
    TABLES.map((table) => [table, table === "Trainer" ? 0 : 1]),
  ) as FixtureCounts;
}

function splitCounts(commit: FixtureCounts, rollback: FixtureCounts) {
  return { commit, rollback };
}

async function countFixtureRows(prisma: PrismaClient) {
  const tracks = [COMMIT_TRACK, ROLLBACK_TRACK];
  const earBrands = [COMMIT_DOG_EAR_BRAND, ROLLBACK_DOG_EAR_BRAND];
  const trainers = [COMMIT_TRAINER, ROLLBACK_TRAINER];
  const count = async (kind: "commit" | "rollback") => {
    const sourcePrefix = kind === "commit" ? "commit-" : "rollback-";
    const trackName = kind === "commit" ? tracks[0] : tracks[1];
    const earBrand = kind === "commit" ? earBrands[0] : earBrands[1];
    const trainer = kind === "commit" ? trainers[0] : trainers[1];
    const [Track, Meeting, Race, RaceVideo, Dog, Trainer, Runner, Result, FormEntry] =
      await Promise.all([
        prisma.track.count({ where: { name: trackName } }),
        prisma.meeting.count({
          where: { sourceProvider: PROVIDER, sourceId: `${sourcePrefix}meeting` },
        }),
        prisma.race.count({
          where: { sourceProvider: PROVIDER, sourceId: `${sourcePrefix}race` },
        }),
        prisma.raceVideo.count({
          where: { sourceProvider: PROVIDER, sourceId: `${sourcePrefix}video` },
        }),
        prisma.dog.count({ where: { earBrand } }),
        prisma.trainer.count({ where: { name: trainer } }),
        prisma.runner.count({
          where: { sourceProvider: PROVIDER, sourceId: `${sourcePrefix}runner` },
        }),
        prisma.result.count({
          where: { sourceProvider: PROVIDER, sourceId: `${sourcePrefix}runner` },
        }),
        prisma.formEntry.count({ where: { dog: { earBrand } } }),
      ]);
    return { Track, Meeting, Race, RaceVideo, Dog, Trainer, Runner, Result, FormEntry };
  };
  return splitCounts(await count("commit"), await count("rollback"));
}

async function cleanupFixtures(prisma: PrismaClient): Promise<FixtureCounts> {
  return prisma.$transaction(async (tx) => {
    const sourceIds = {
      meetings: ["commit-meeting", "rollback-meeting"],
      races: ["commit-race", "rollback-race"],
      videos: ["commit-video", "rollback-video"],
      runners: ["commit-runner", "rollback-runner"],
    };
    const earBrands = [COMMIT_DOG_EAR_BRAND, ROLLBACK_DOG_EAR_BRAND];
    const FormEntry = await tx.formEntry.deleteMany({
      where: { dog: { earBrand: { in: earBrands } } },
    });
    const Result = await tx.result.deleteMany({
      where: { sourceProvider: PROVIDER, sourceId: { in: sourceIds.runners } },
    });
    const RaceVideo = await tx.raceVideo.deleteMany({
      where: { sourceProvider: PROVIDER, sourceId: { in: sourceIds.videos } },
    });
    const Runner = await tx.runner.deleteMany({
      where: { sourceProvider: PROVIDER, sourceId: { in: sourceIds.runners } },
    });
    const Race = await tx.race.deleteMany({
      where: { sourceProvider: PROVIDER, sourceId: { in: sourceIds.races } },
    });
    const Meeting = await tx.meeting.deleteMany({
      where: { sourceProvider: PROVIDER, sourceId: { in: sourceIds.meetings } },
    });
    const Trainer = await tx.trainer.deleteMany({
      where: { name: { in: [COMMIT_TRAINER, ROLLBACK_TRAINER] } },
    });
    const Dog = await tx.dog.deleteMany({ where: { earBrand: { in: earBrands } } });
    const Track = await tx.track.deleteMany({
      where: { name: { in: [COMMIT_TRACK, ROLLBACK_TRACK] } },
    });
    return {
      Track: Track.count,
      Meeting: Meeting.count,
      Race: Race.count,
      RaceVideo: RaceVideo.count,
      Dog: Dog.count,
      Trainer: Trainer.count,
      Runner: Runner.count,
      Result: Result.count,
      FormEntry: FormEntry.count,
    };
  });
}

function capturedSystemContext(queries: readonly DisposableReplayQueryEvent[]) {
  const captured = queries.flatMap((event) => {
    if (!/set_config\(\$1,\s*\$2,\s*true\)/i.test(normalizeSql(event.query))) {
      return [];
    }
    const parameters = parseParameters(event.params);
    assert.equal(parameters.length, 2);
    return [{ key: String(parameters[0]), value: String(parameters[1]) }];
  });
  assert.deepEqual(captured, [
    { key: "app.system", value: "true" },
    { key: "app.current_tier", value: "system" },
    { key: "app.current_role", value: "system" },
  ]);
  return captured;
}

function exactTableMutation(
  queries: readonly DisposableReplayQueryEvent[],
  table: TableName,
) {
  const matches = queries.filter((event) => {
    const sql = normalizeSql(event.query);
    return /^INSERT\b/i.test(sql) && sql.includes(`"${table}"`);
  });
  assert.equal(matches.length, 1, `Expected one ${table} INSERT`);
  return matches[0];
}

function mutationEvidence(event: DisposableReplayQueryEvent, table: TableName) {
  const normalizedSql = normalizeSql(event.query);
  return {
    table,
    observedSql: {
      statementType: "INSERT",
      normalizedSql,
      sha256: sha256(normalizedSql),
      parameterCount: parseParameters(event.params).length,
      persistedParameterValues: false,
    },
  } as const;
}

function assertTransactionOutcome(
  queries: readonly DisposableReplayQueryEvent[],
  expected: "COMMIT" | "ROLLBACK",
) {
  const normalized = queries.map((event) => normalizeSql(event.query));
  assert.ok(normalized.some((sql) => /^BEGIN\b/i.test(sql)));
  const terminators = normalized.filter((sql) => /^(?:COMMIT|ROLLBACK)\b/i.test(sql));
  assert.deepEqual(terminators, [expected]);
}

function normalizeSql(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseParameters(value: string) {
  const parsed = JSON.parse(value) as unknown;
  assert.ok(Array.isArray(parsed));
  return parsed;
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
  const { report, outputPath } = await runLiveProviderIngestVerifier();
  console.log(
    JSON.stringify({
      verdict: report.verdict,
      successfulTables: report.proof.statements.length,
      rollback: report.proof.transactionOutcomes.lateFailureBatch,
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
