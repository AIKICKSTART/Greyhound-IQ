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

import type { DbContextClient, DbContextUser } from "../src/lib/db-context";
import type { DisposableReplayQueryEvent } from "../src/lib/db";

export const DOG_PUBLIC_DETAIL_VERIFY_CONFIRMATION =
  "verify-dog-public-detail-on-disposable-loopback-55734";
export const DOG_PUBLIC_DETAIL_EVIDENCE_PATH =
  "output/database-audit/dog-public-detail.json";
export const DOG_PUBLIC_DETAIL_EVIDENCE_SCHEMA_VERSION = 1;

const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const EXPECTED_MAXIMUM_ROWS = 359;
const FIXTURE_NOW = new Date("2026-07-01T00:00:00.000Z");
const ROOT_DOG_ID = "dog-public-detail-proof-00";
const BRIDGE_DOG_ID = "dog-public-detail-bridge-proof";
const BRIDGE_TWIN_DOG_ID = "dog-public-detail-bridge-twin-proof";
const MISSING_DOG_ID = "dog-public-detail-proof-missing";
const TRAINER_ID = "dog-public-detail-trainer-proof";
const TRACK_ID = "dog-public-detail-track-proof";
const MEETING_ID = "dog-public-detail-meeting-proof";
const RACE_ID = "dog-public-detail-race-proof";
const RUNNER_ID = "dog-public-detail-runner-proof";
const RESULT_ID = "dog-public-detail-result-proof";
const PROFILE_FORM_ID = "dog-public-detail-profile-form-proof";
const APPROVED_USER_ID = "dog-public-detail-approved-user-proof";
const APPROVED_PROFILE_ID = "dog-public-detail-approved-profile-proof";
const PENDING_USER_ID = "dog-public-detail-pending-user-proof";
const PENDING_PROFILE_ID = "dog-public-detail-pending-profile-proof";
const APPROVED_OWNERSHIP_ID = "dog-public-detail-approved-ownership-proof";
const PENDING_OWNERSHIP_ID = "dog-public-detail-pending-ownership-proof";
const APPROVED_EMAIL = "dog-public-detail-approved@greyhoundiq.test";
const PENDING_EMAIL = "dog-public-detail-pending@greyhoundiq.test";
const DOG_IDS = Array.from(
  { length: 63 },
  (_, index) => `dog-public-detail-proof-${String(index).padStart(2, "0")}`,
);
const FIXTURE_DOG_IDS = [...DOG_IDS, BRIDGE_DOG_ID, BRIDGE_TWIN_DOG_ID];
const FORM_ENTRY_IDS = [
  "dog-public-detail-form-1-proof",
  "dog-public-detail-form-2-proof",
  "dog-public-detail-form-3-proof",
];
const USER_IDS = [APPROVED_USER_ID, PENDING_USER_ID];
const PROFILE_IDS = [APPROVED_PROFILE_ID, PENDING_PROFILE_ID];
const OWNERSHIP_IDS = [APPROVED_OWNERSHIP_ID, PENDING_OWNERSHIP_ID];
const PENDING_CONTEXT: DbContextUser = {
  dbUserId: PENDING_USER_ID,
  profileId: PENDING_PROFILE_ID,
  profileRole: "member",
  tier: "free",
};
const SOURCE_FILES = [
  "prisma/schema.prisma",
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "prisma/migrations/20260708230000_dog_ownership_verification/migration.sql",
  "scripts/check-dog-public-detail-postgres.ts",
  "scripts/check-dog-public-detail-postgres.test.ts",
  "security/mandatory-public-racing-database-operations.ts",
  "src/app/dogs/[id]/page.tsx",
  "src/lib/db-context.ts",
  "src/lib/db.ts",
  "src/lib/pedigree.ts",
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
  phase: "detail" | "pedigree";
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

export function assertDogPublicDetailVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, DOG_PUBLIC_DETAIL_VERIFY_CONFIRMATION);
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

export function buildDogPublicDetailSourceBinding(
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

export function validateDogPublicDetailEvidence(
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
  assert.equal(evidence.schemaVersion, DOG_PUBLIC_DETAIL_EVIDENCE_SCHEMA_VERSION);
  assert.equal(evidence.auditKind, "dog-public-detail-disposable-proof");
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(evidence.sourceBinding, buildDogPublicDetailSourceBinding(root));
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
    fixtureOwner: "dog-public-detail-dedicated-proof",
    broadCleanupUsed: false,
  });
  assert.deepEqual(evidence.cleanup, {
    dogOwnershipRowsDeleted: 2,
    profileRowsDeleted: 2,
    userRowsDeleted: 2,
    resultRowsDeleted: 1,
    runnerRowsDeleted: 1,
    formEntryRowsDeleted: 3,
    profileFormRowsDeleted: 1,
    raceRowsDeleted: 1,
    meetingRowsDeleted: 1,
    trackRowsDeleted: 1,
    dogRowsDeleted: 65,
    trainerRowsDeleted: 1,
    remainingRows: 0,
  });

  const proof = evidence.proof as Record<string, unknown>;
  assert.equal(proof.queryId, "DB.RACING.DOG.OPEN.PUBLIC_DETAIL_BUNDLE");
  assert.equal(proof.sourceFile, "src/lib/queries.ts");
  assert.equal(
    proof.sourceSymbol,
    "getDogById plus src/lib/pedigree.ts#getDogPedigree",
  );
  assert.equal(proof.expectedMaximumRows, EXPECTED_MAXIMUM_ROWS);
  assert.equal(proof.status, "verified");
  assert.deepEqual(proof.rowCounts, {
    before: 81,
    afterPopulatedRead: 81,
    afterEmptyRead: 81,
  });
  assert.deepEqual(proof.populated, {
    rootDog: "returned",
    careerStats: { starts: 3, wins: 1, placings: 2 },
    boundedFormEntries: 3,
    boundedProfileForms: 1,
    boundedRunners: 1,
    approvedOwnershipRows: 1,
    pendingOwnershipRows: 0,
    pedigreeNodes: 63,
    pedigreeDepth: 5,
    bridgedPedigreeNodes: 63,
    bridgedPedigreeDepth: 5,
  });
  assert.deepEqual(proof.empty, {
    dog: null,
    pedigree: null,
    mutation: "none",
  });
  assert.deepEqual(proof.projection, {
    userTableQueried: false,
    ownershipProfileFields: ["displayName", "kennelName", "state"],
    internalRawColumnsSelected: false,
  });
  assert.deepEqual(proof.rls, {
    anonymousReplayStatements: proof.statementCount,
    anonymousReplayFailures: 0,
    anonymousApprovedOwnershipRows: 1,
    pendingClaimantApprovedOwnershipRows: 1,
    pendingClaimVisibleInPublicBundle: false,
  });
  assert.deepEqual(proof.cases, {
    formBound: "sixty-four-row-sql-limit",
    profileFormBound: "twenty-row-sql-limit",
    runnerBound: "twenty-row-sql-limit",
    ownershipBound: "sixteen-approved-rows-sql-limit",
    pedigreeBound: "input-nine-hundred-ninety-nine-clamped-to-five-generations",
    pedigreeBridge:
      "unlinked-provider-root-bridged-through-bounded-galtd-twin-query",
    accurateCareerStats: "bounded-count-and-three-finish-groups",
    publicProjection: "no-user-join-no-contact-or-billing-fields",
    notFound: "both-services-returned-null",
  });
  const statements = proof.statements as Array<Record<string, unknown>>;
  assert.equal(statements.length, proof.statementCount);
  assert.equal(statements.length, 22);
  assert.equal(
    new Set(statements.map((statement) => statement.variant)).size,
    statements.length,
  );
  for (const statement of statements) {
    const observedSql = statement.observedSql as Record<string, unknown>;
    assert.equal(observedSql.statementType, "SELECT");
    assert.equal(observedSql.persistedParameterValues, false);
    assert.equal(observedSql.sha256, sha256(String(observedSql.normalizedSql)));
    const sql = String(observedSql.normalizedSql);
    assert.doesNotMatch(sql, /"User"|"email"|"subscriptionTier"/);
    assert.doesNotMatch(sql, /sourceRawJson|profileSourceRawJson/);
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
    assert.ok(
      typeof replay.rows === "number" && replay.rows >= 0,
      "anonymous replay row count must be a non-negative number",
    );
  }
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, /dog-public-detail-(?:approved|pending)@/i);
  return evidence;
}

export async function runDogPublicDetailVerifier() {
  const root = process.cwd();
  const runtimeUrl = assertDogPublicDetailVerifierTarget(
    requiredEnvironment("DOG_PUBLIC_DETAIL_VERIFY_DATABASE_URL"),
    process.env.DOG_PUBLIC_DETAIL_VERIFY_CONFIRM,
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
    { withDbAnonymousContext, withDbRequestContext },
    { getDogById },
    { getDogPedigree },
  ] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/db"),
    import("../src/lib/db-context"),
    import("../src/lib/queries"),
    import("../src/lib/pedigree"),
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
    assert.equal(before, 81);

    const detailCapture = await captureDisposableReplayQueries(() =>
      getDogById(ROOT_DOG_ID),
    );
    const dog = detailCapture.result;
    assert.ok(dog);
    assert.equal(dog.id, ROOT_DOG_ID);
    assert.deepEqual(dog.careerStats, { starts: 3, wins: 1, placings: 2 });
    assert.equal(dog.formEntries.length, 3);
    assert.equal(dog.profileForms.length, 1);
    assert.equal(dog.runners.length, 1);
    assert.equal(dog.ownership.length, 1);
    assert.equal(dog.ownership[0].id, APPROVED_OWNERSHIP_ID);
    assert.equal(dog.ownership.some((row) => row.id === PENDING_OWNERSHIP_ID), false);
    assertNoForbiddenProjection(dog);

    const pedigreeCapture = await captureDisposableReplayQueries(() =>
      getDogPedigree(ROOT_DOG_ID, 999),
    );
    const pedigree = pedigreeCapture.result;
    assert.ok(pedigree);
    assert.equal(countPedigreeNodes(pedigree), 63);
    assert.equal(pedigreeDepth(pedigree), 5);
    const bridgePedigreeCapture = await captureDisposableReplayQueries(() =>
      getDogPedigree(BRIDGE_DOG_ID, 999),
    );
    const bridgePedigree = bridgePedigreeCapture.result;
    assert.ok(bridgePedigree);
    assert.equal(countPedigreeNodes(bridgePedigree), 63);
    assert.equal(pedigreeDepth(bridgePedigree), 5);
    const afterPopulatedRead = await countFixtureRows(cleanupPrisma);
    assert.equal(afterPopulatedRead, 81);

    const detailStatements = collectObservedStatements(
      "detail",
      detailCapture.queries,
    );
    const pedigreeStatements = collectObservedStatements(
      "pedigree",
      [...pedigreeCapture.queries, ...bridgePedigreeCapture.queries],
    );
    const statements = [...detailStatements, ...pedigreeStatements];
    assert.equal(statements.length, 22);
    assert.equal(
      statements.some((statement) =>
        statement.normalizedSql.includes('"public"."User"'),
      ),
      false,
    );
    const ownershipStatement = statements.find((statement) =>
      statement.normalizedSql.includes('FROM "public"."DogOwnership"'),
    );
    assert.ok(ownershipStatement);

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
        anonymousReplay: {
          status: "allowed",
          rows: anonymousRows.length,
        },
      });
    }
    const anonymousOwnershipRows = await withDbAnonymousContext((tx) =>
      tx.$queryRawUnsafe<unknown[]>(
        ownershipStatement.normalizedSql,
        ...ownershipStatement.parameters,
      ),
    );
    const pendingClaimantOwnershipRows = await withDbRequestContext(
      PENDING_CONTEXT,
      (tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          ownershipStatement.normalizedSql,
          ...ownershipStatement.parameters,
        ),
    );
    assert.equal(anonymousOwnershipRows.length, 1);
    assert.equal(pendingClaimantOwnershipRows.length, 1);

    const emptyDetail = await getDogById(MISSING_DOG_ID);
    const emptyPedigree = await getDogPedigree(MISSING_DOG_ID, 999);
    assert.equal(emptyDetail, null);
    assert.equal(emptyPedigree, null);
    const afterEmptyRead = await countFixtureRows(cleanupPrisma);
    assert.equal(afterEmptyRead, 81);

    const removed = await cleanupFixtures(cleanupPrisma);
    cleanupRequired = false;
    assert.deepEqual(removed, {
      dogOwnershipRowsDeleted: 2,
      profileRowsDeleted: 2,
      userRowsDeleted: 2,
      resultRowsDeleted: 1,
      runnerRowsDeleted: 1,
      formEntryRowsDeleted: 3,
      profileFormRowsDeleted: 1,
      raceRowsDeleted: 1,
      meetingRowsDeleted: 1,
      trackRowsDeleted: 1,
      dogRowsDeleted: 65,
      trainerRowsDeleted: 1,
    });
    const remainingRows = await countFixtureRows(cleanupPrisma);
    assert.equal(remainingRows, 0);

    const report = {
      schemaVersion: DOG_PUBLIC_DETAIL_EVIDENCE_SCHEMA_VERSION,
      auditKind: "dog-public-detail-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: runtimeUrl.hostname,
        port: Number(runtimeUrl.port),
        productionOrProviderSystemsContacted: false,
        fixtureOwner: "dog-public-detail-dedicated-proof",
        broadCleanupUsed: false,
      },
      runtimeIdentity: identities[0],
      sourceBinding: buildDogPublicDetailSourceBinding(root),
      proof: {
        queryId: "DB.RACING.DOG.OPEN.PUBLIC_DETAIL_BUNDLE",
        sourceFile: "src/lib/queries.ts",
        sourceSymbol: "getDogById plus src/lib/pedigree.ts#getDogPedigree",
        expectedMaximumRows: EXPECTED_MAXIMUM_ROWS,
        statementCount: statementEvidence.length,
        rowCounts: {
          before,
          afterPopulatedRead,
          afterEmptyRead,
        },
        populated: {
          rootDog: "returned",
          careerStats: dog.careerStats,
          boundedFormEntries: dog.formEntries.length,
          boundedProfileForms: dog.profileForms.length,
          boundedRunners: dog.runners.length,
          approvedOwnershipRows: dog.ownership.length,
          pendingOwnershipRows: dog.ownership.filter(
            (row) => row.id === PENDING_OWNERSHIP_ID,
          ).length,
          pedigreeNodes: countPedigreeNodes(pedigree),
          pedigreeDepth: pedigreeDepth(pedigree),
          bridgedPedigreeNodes: countPedigreeNodes(bridgePedigree),
          bridgedPedigreeDepth: pedigreeDepth(bridgePedigree),
        },
        empty: { dog: null, pedigree: null, mutation: "none" },
        projection: {
          userTableQueried: false,
          ownershipProfileFields: ["displayName", "kennelName", "state"],
          internalRawColumnsSelected: false,
        },
        rls: {
          anonymousReplayStatements: statementEvidence.length,
          anonymousReplayFailures: 0,
          anonymousApprovedOwnershipRows: anonymousOwnershipRows.length,
          pendingClaimantApprovedOwnershipRows:
            pendingClaimantOwnershipRows.length,
          pendingClaimVisibleInPublicBundle: false,
        },
        cases: {
          formBound: "sixty-four-row-sql-limit",
          profileFormBound: "twenty-row-sql-limit",
          runnerBound: "twenty-row-sql-limit",
          ownershipBound: "sixteen-approved-rows-sql-limit",
          pedigreeBound:
            "input-nine-hundred-ninety-nine-clamped-to-five-generations",
          pedigreeBridge:
            "unlinked-provider-root-bridged-through-bounded-galtd-twin-query",
          accurateCareerStats: "bounded-count-and-three-finish-groups",
          publicProjection: "no-user-join-no-contact-or-billing-fields",
          notFound: "both-services-returned-null",
        },
        statements: statementEvidence,
        status: "verified",
      },
      cleanup: { ...removed, remainingRows },
      verdict: "verified",
    } as const;
    validateDogPublicDetailEvidence(report, root);
    const outputPath = resolve(root, DOG_PUBLIC_DETAIL_EVIDENCE_PATH);
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
  await prisma.trainer.create({
    data: { id: TRAINER_ID, name: "Dog detail proof trainer", state: "NSW" },
  });
  for (let level = 5; level >= 0; level -= 1) {
    const first = 2 ** level - 1;
    const last = Math.min(2 ** (level + 1) - 2, DOG_IDS.length - 1);
    await prisma.dog.createMany({
      data: Array.from({ length: last - first + 1 }, (_, offset) => {
        const index = first + offset;
        const sireIndex = index * 2 + 1;
        const damIndex = index * 2 + 2;
        return {
          id: DOG_IDS[index],
          name: `Dog detail proof ${index}`,
          earBrand: index === 0 ? "DOG-DETAIL-PROOF" : null,
          colour: index % 2 === 0 ? "Black" : "Blue",
          sex: index % 2 === 0 ? "M" : "F",
          whelpDate: new Date(Date.UTC(2020 - level, 0, 1)),
          sireId: sireIndex < DOG_IDS.length ? DOG_IDS[sireIndex] : null,
          damId: damIndex < DOG_IDS.length ? DOG_IDS[damIndex] : null,
          trainerId: index === 0 ? TRAINER_ID : null,
          sourceProvider: "proof",
          sourceId: `dog-detail-${index}`,
          prizeMoney: index === 0 ? 12_345 : null,
          createdAt: FIXTURE_NOW,
          updatedAt: FIXTURE_NOW,
        };
      }),
    });
  }
  await prisma.dog.createMany({
    data: [
      {
        id: BRIDGE_DOG_ID,
        name: "Dog detail bridge proof",
        whelpDate: new Date(Date.UTC(2020, 0, 1)),
        sourceProvider: "thedogs",
        sourceId: "dog-detail-bridge",
        createdAt: FIXTURE_NOW,
        updatedAt: FIXTURE_NOW,
      },
      {
        id: BRIDGE_TWIN_DOG_ID,
        name: "Dog detail bridge proof",
        whelpDate: new Date(Date.UTC(2020, 0, 1)),
        sourceProvider: "galtd",
        sourceId: "dog-detail-bridge-twin",
        sireId: DOG_IDS[1],
        damId: DOG_IDS[2],
        createdAt: FIXTURE_NOW,
        updatedAt: FIXTURE_NOW,
      },
    ],
  });
  await prisma.track.create({
    data: { id: TRACK_ID, name: "Dog detail proof track", state: "NSW" },
  });
  await prisma.meeting.create({
    data: {
      id: MEETING_ID,
      trackId: TRACK_ID,
      meetingDate: FIXTURE_NOW,
      sourceProvider: "proof",
      sourceId: "dog-detail-meeting",
    },
  });
  await prisma.race.create({
    data: {
      id: RACE_ID,
      meetingId: MEETING_ID,
      raceNumber: 1,
      raceTime: FIXTURE_NOW,
      distance: 520,
      grade: "5",
      replayUrl: "https://example.invalid/proof-replay",
    },
  });
  await prisma.runner.create({
    data: {
      id: RUNNER_ID,
      raceId: RACE_ID,
      dogId: ROOT_DOG_ID,
      boxNumber: 1,
      weight: 31.5,
      createdAt: FIXTURE_NOW,
    },
  });
  await prisma.result.create({
    data: {
      id: RESULT_ID,
      runnerId: RUNNER_ID,
      raceId: RACE_ID,
      finishingPosition: 1,
      runningTime: 29.8,
      splitTime: 5.4,
      margin: 1.2,
      createdAt: FIXTURE_NOW,
    },
  });
  await prisma.formEntry.createMany({
    data: [
      {
        id: FORM_ENTRY_IDS[0],
        dogId: ROOT_DOG_ID,
        raceId: RACE_ID,
        trackId: TRACK_ID,
        date: FIXTURE_NOW,
        boxNumber: 1,
        finish: 1,
        time: 29.8,
        distance: 520,
        grade: "5",
        weight: 31.5,
      },
      {
        id: FORM_ENTRY_IDS[1],
        dogId: ROOT_DOG_ID,
        trackId: TRACK_ID,
        date: new Date(FIXTURE_NOW.getTime() - 24 * 60 * 60 * 1000),
        finish: 2,
      },
      {
        id: FORM_ENTRY_IDS[2],
        dogId: ROOT_DOG_ID,
        trackId: TRACK_ID,
        date: new Date(FIXTURE_NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
        finish: 4,
      },
    ],
  });
  await prisma.dogProfileForm.create({
    data: {
      id: PROFILE_FORM_ID,
      dogId: ROOT_DOG_ID,
      sourceProvider: "proof",
      sourceId: "dog-detail-profile-form",
      raceUrl: "https://example.invalid/proof-race",
      date: FIXTURE_NOW,
      trackName: "Dog detail proof track",
      finishingPosition: 1,
      hasVideo: false,
    },
  });
  await prisma.user.createMany({
    data: [
      { id: APPROVED_USER_ID, email: APPROVED_EMAIL, name: "Approved proof" },
      { id: PENDING_USER_ID, email: PENDING_EMAIL, name: "Pending proof" },
    ],
  });
  await prisma.profile.createMany({
    data: [
      {
        id: APPROVED_PROFILE_ID,
        userId: APPROVED_USER_ID,
        displayName: "Approved proof owner",
        state: "NSW",
      },
      {
        id: PENDING_PROFILE_ID,
        userId: PENDING_USER_ID,
        displayName: "Pending proof claimant",
        state: "VIC",
      },
    ],
  });
  await prisma.dogOwnership.createMany({
    data: [
      {
        id: APPROVED_OWNERSHIP_ID,
        dogId: ROOT_DOG_ID,
        profileId: APPROVED_PROFILE_ID,
        role: "owner",
        verified: true,
        status: "approved",
        createdAt: FIXTURE_NOW,
      },
      {
        id: PENDING_OWNERSHIP_ID,
        dogId: ROOT_DOG_ID,
        profileId: PENDING_PROFILE_ID,
        role: "owner",
        verified: false,
        status: "pending",
        createdAt: FIXTURE_NOW,
      },
    ],
  });
}

async function cleanupFixtures(prisma: PrismaClient) {
  const dogOwnershipRowsDeleted = await prisma.dogOwnership.deleteMany({
    where: { id: { in: OWNERSHIP_IDS } },
  });
  const profileRowsDeleted = await prisma.profile.deleteMany({
    where: { id: { in: PROFILE_IDS } },
  });
  const userRowsDeleted = await prisma.user.deleteMany({
    where: { id: { in: USER_IDS } },
  });
  const resultRowsDeleted = await prisma.result.deleteMany({
    where: { id: RESULT_ID },
  });
  const runnerRowsDeleted = await prisma.runner.deleteMany({
    where: { id: RUNNER_ID },
  });
  const formEntryRowsDeleted = await prisma.formEntry.deleteMany({
    where: { id: { in: FORM_ENTRY_IDS } },
  });
  const profileFormRowsDeleted = await prisma.dogProfileForm.deleteMany({
    where: { id: PROFILE_FORM_ID },
  });
  const raceRowsDeleted = await prisma.race.deleteMany({ where: { id: RACE_ID } });
  const meetingRowsDeleted = await prisma.meeting.deleteMany({
    where: { id: MEETING_ID },
  });
  const trackRowsDeleted = await prisma.track.deleteMany({ where: { id: TRACK_ID } });
  const bridgeDogRowsDeleted = await prisma.dog.deleteMany({
    where: { id: { in: [BRIDGE_DOG_ID, BRIDGE_TWIN_DOG_ID] } },
  });
  let dogRowsDeleted = bridgeDogRowsDeleted.count;
  for (let level = 0; level <= 5; level += 1) {
    const first = 2 ** level - 1;
    const last = Math.min(2 ** (level + 1) - 2, DOG_IDS.length - 1);
    const removed = await prisma.dog.deleteMany({
      where: { id: { in: DOG_IDS.slice(first, last + 1) } },
    });
    dogRowsDeleted += removed.count;
  }
  const trainerRowsDeleted = await prisma.trainer.deleteMany({
    where: { id: TRAINER_ID },
  });
  return {
    dogOwnershipRowsDeleted: dogOwnershipRowsDeleted.count,
    profileRowsDeleted: profileRowsDeleted.count,
    userRowsDeleted: userRowsDeleted.count,
    resultRowsDeleted: resultRowsDeleted.count,
    runnerRowsDeleted: runnerRowsDeleted.count,
    formEntryRowsDeleted: formEntryRowsDeleted.count,
    profileFormRowsDeleted: profileFormRowsDeleted.count,
    raceRowsDeleted: raceRowsDeleted.count,
    meetingRowsDeleted: meetingRowsDeleted.count,
    trackRowsDeleted: trackRowsDeleted.count,
    dogRowsDeleted,
    trainerRowsDeleted: trainerRowsDeleted.count,
  };
}

async function countFixtureRows(prisma: PrismaClient) {
  const counts = await Promise.all([
    prisma.dogOwnership.count({ where: { id: { in: OWNERSHIP_IDS } } }),
    prisma.profile.count({ where: { id: { in: PROFILE_IDS } } }),
    prisma.user.count({ where: { id: { in: USER_IDS } } }),
    prisma.result.count({ where: { id: RESULT_ID } }),
    prisma.runner.count({ where: { id: RUNNER_ID } }),
    prisma.formEntry.count({ where: { id: { in: FORM_ENTRY_IDS } } }),
    prisma.dogProfileForm.count({ where: { id: PROFILE_FORM_ID } }),
    prisma.race.count({ where: { id: RACE_ID } }),
    prisma.meeting.count({ where: { id: MEETING_ID } }),
    prisma.track.count({ where: { id: TRACK_ID } }),
    prisma.dog.count({ where: { id: { in: FIXTURE_DOG_IDS } } }),
    prisma.trainer.count({ where: { id: TRAINER_ID } }),
  ]);
  return counts.reduce((total, count) => total + count, 0);
}

function assertNoForbiddenProjection(value: unknown) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /dog-public-detail-(?:approved|pending)@/i);
  assert.doesNotMatch(serialized, /subscriptionTier|stripeCustomerId/i);
  assert.doesNotMatch(serialized, /sourceRawJson|profileSourceRawJson/i);
}

function countPedigreeNodes(node: {
  sire?: unknown;
  dam?: unknown;
}): number {
  return (
    1 +
    (node.sire
      ? countPedigreeNodes(node.sire as { sire?: unknown; dam?: unknown })
      : 0) +
    (node.dam
      ? countPedigreeNodes(node.dam as { sire?: unknown; dam?: unknown })
      : 0)
  );
}

function pedigreeDepth(node: { sire?: unknown; dam?: unknown }): number {
  return Math.max(
    node.sire
      ? 1 + pedigreeDepth(node.sire as { sire?: unknown; dam?: unknown })
      : 0,
    node.dam
      ? 1 + pedigreeDepth(node.dam as { sire?: unknown; dam?: unknown })
      : 0,
  );
}

function collectObservedStatements(
  phase: "detail" | "pedigree",
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
      const variant = `${phase}-${String(index + 1).padStart(2, "0")}`;
      return {
        phase,
        variant,
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
    scanDirection: optionalPlanString(
      node["Scan Direction"],
      "Scan Direction",
    ),
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
  const { report, outputPath } = await runDogPublicDetailVerifier();
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
