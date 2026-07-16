import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { CurrentUserProfile } from "../src/lib/auth-types";
import type { DbContextClient } from "../src/lib/db-context";
import type { DisposableReplayQueryEvent } from "../src/lib/db";
import {
  DEMO_FIXTURE_MANIFEST,
  DEMO_FIXTURE_TIMESTAMP,
  DEMO_PRIVATE_FIXTURE_ROW_COUNT,
} from "./demo-route-fixture-contract";
import {
  buildDemoFixtureSourceBinding,
  DEMO_FIXTURE_EVIDENCE_SCHEMA_VERSION,
  DEMO_FIXTURE_EXPECTED_DATABASE_OPERATION_PROOFS,
  DEMO_FIXTURE_EXPECTED_MODEL_COUNTS,
  DEMO_FIXTURE_EXPECTED_RUNTIME_IDENTITY,
  DEMO_FIXTURE_MEDIA_STATUS_FIELDS,
  validateDemoFixtureEvidence,
} from "./demo-route-fixture-evidence";
import { assertLocalDatabaseUrl } from "./local-database-policy";

export const DEMO_FIXTURE_IDEMPOTENCY_EVIDENCE_PATH =
  "output/database-audit/demo-fixture-idempotency.json";
export const DEMO_FIXTURE_VERIFY_CONFIRMATION =
  "verify-synthetic-private-fixtures-on-disposable-loopback-55734";

const REPLAY_PORT = "55734";
const REPLAY_DATABASE = "/greyhoundiq";
const RUNTIME_ROLE = "greyhoundiq_runtime";
const LITERAL_LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1"]);
const ENDPOINT_OVERRIDE_PARAMETERS = new Set([
  "database",
  "dbname",
  "host",
  "hostaddr",
  "port",
  "socket",
]);
const PROVIDER = "fixture-provider-sentinel";
const PROVIDER_MEETING_ID = DEMO_FIXTURE_MANIFEST.providerSamples.meetingId;
const PROVIDER_MEETING_DATE = new Date("2026-07-12T09:00:00.000Z");
const PROVIDER_RACE_TIME = new Date("2026-07-12T10:00:00.000Z");
const PUBLIC_RACING_DETAIL_PROBE = {
  trainerId: "fixture-provider-trainer-route-audit",
  currentRunnerId: "fixture-provider-runner-current-route-audit",
  previousRunnerId: "fixture-provider-runner-previous-route-audit",
  currentResultId: "fixture-provider-result-current-route-audit",
  previousResultId: "fixture-provider-result-previous-route-audit",
  currentVideoId: "fixture-provider-video-current-route-audit",
  previousVideoId: "fixture-provider-video-previous-route-audit",
  previousRaceId: "4f3402c2-aed9-4d20-a0ce-925ca6c97578",
  formEntryId: "fixture-provider-form-route-audit",
  profileFormId: "fixture-provider-profile-form-route-audit",
  previousRaceTime: new Date("2026-07-12T09:30:00.000Z"),
} as const;
const PROVIDER_RUNNER_ID = PUBLIC_RACING_DETAIL_PROBE.currentRunnerId;
const USER_COLLISION_PROBE_ID = "demo-probe-user-collision";
const SIGNUP_OUTBOX_CLAIM_PROBE_ID = "demo-signup-outbox-claim-operation-proof";
const SIGNUP_OUTBOX_CLAIM_IDEMPOTENCY_KEY =
  "demo-signup-outbox-claim-operation-proof-v1";
const SIGNUP_OUTBOX_EXPIRED_PROBE_ID =
  "demo-signup-outbox-expired-operation-proof";
const SIGNUP_OUTBOX_EXPIRED_IDEMPOTENCY_KEY =
  "demo-signup-outbox-expired-operation-proof-v1";
const SIGNUP_OUTBOX_CLAIM_NOW = new Date("2026-07-12T10:30:00.000Z");
const SIGNUP_OUTBOX_CLAIM_LEASE_MS = 60_000;
const SIGNUP_OUTBOX_CLAIM_MAX_ATTEMPTS = 3;
const SIGNUP_OUTBOX_SETTLE_COMPLETE_AT = new Date("2026-07-12T10:32:00.000Z");
const SIGNUP_OUTBOX_SETTLE_RETRY_FAILED_AT = new Date(
  "2026-07-12T10:33:00.000Z",
);
const SIGNUP_OUTBOX_SETTLE_RETRY_AT = new Date("2026-07-12T10:34:00.000Z");
const SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_AT = new Date(
  "2026-07-12T10:35:00.000Z",
);
const SIGNUP_OUTBOX_SETTLE_RETRY_TOKEN =
  "11111111-1111-4111-8111-111111111111";
const SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_TOKEN =
  "22222222-2222-4222-8222-222222222222";
const MEDIA_DELETE_ROLLBACK_AT = new Date("2026-07-12T10:36:00.000Z");
const ACCOUNT_DELETION_ROLLBACK_AT = new Date("2026-07-12T10:37:00.000Z");
const ACCOUNT_DELETION_PENDING_PROBE_USER_ID =
  "demo-account-deletion-pending-operation-proof";
const ACCOUNT_DELETION_PENDING_PROBE_PROFILE_ID =
  "demo-account-deletion-pending-profile-proof";
const ACCOUNT_DELETION_PENDING_REQUESTED_AT = new Date(
  "2026-05-01T00:00:00.000Z",
);
const ACCOUNT_DELETION_PENDING_CUTOFF = new Date(
  "2026-06-01T00:00:00.000Z",
);
const ACCOUNT_DELETION_PENDING_EMPTY_CUTOFF = new Date(
  "2026-04-01T00:00:00.000Z",
);
const ACCOUNT_DELETION_REQUEST_EMAIL =
  "deletion-requested-demo-user-pro@deleted.greyhoundiq.local";
const AUTH_ACCEPTANCE_PROVIDER_ID =
  "demo-auth-acceptance-provider-subject";
const AUTH_ACCEPTANCE_EMAIL = "demo-auth-acceptance@greyhoundiq.test";
const AUTH_ACCEPTANCE_DISPLAY_NAME = "Auth Acceptance Probe";
const AUTH_ACCEPTANCE_ROLLBACK_PROVIDER_ID =
  "demo-auth-acceptance-rollback-subject";
const AUTH_ACCEPTANCE_ROLLBACK_EMAIL =
  "demo-auth-acceptance-rollback@greyhoundiq.test";
const AUTH_ACCEPTANCE_ROLLBACK_DISPLAY_NAME =
  "Auth Acceptance Rollback";
const AUTH_ACCEPTANCE_UNVERIFIED_PROVIDER_ID =
  "demo-auth-acceptance-unverified-subject";
const AUTH_ACCEPTANCE_RESTORE_AT = new Date("2026-07-12T10:38:00.000Z");
const DOG_OWNERSHIP_OPERATION_PROBE_ID =
  "demo-dog-ownership-operation-proof";
const DOG_OWNERSHIP_OPERATION_REJECTION_REASON =
  "Synthetic rejected claim visible only to its claimant";
const STRIPE_WEBHOOK_OPERATION_EVENT_ID =
  "evt_demo_webhook_database_operation_proof";
const STRIPE_WEBHOOK_OPERATION_TYPE = "greyhoundiq.database.proof";
const STRIPE_WEBHOOK_OPERATION_OBJECT_ID =
  "obj_demo_webhook_database_operation_proof";
const STRIPE_WEBHOOK_CONFLICT_TYPE = "greyhoundiq.database.proof.conflict";
const STRIPE_WEBHOOK_ROLLBACK_EVENT_ID =
  "evt_demo_webhook_database_operation_rollback";
const STRIPE_WEBHOOK_ROLLBACK_ROW_ID =
  "demo-stripe-webhook-operation-rollback";
const STRIPE_WEBHOOK_SECRET = "whsec_demo_fixture_operation_proof";
const STRIPE_WEBHOOK_VERSION = "2026-06-24.dahlia";
const STRIPE_WEBHOOK_CREATED = 1_752_000_000;
const USER_EXPORT_OPERATION_AT = new Date("2026-07-12T10:39:00.000Z");
const USER_EXPORT_ROLLBACK_AT = new Date("2026-07-12T10:40:00.000Z");
const USER_EXPORT_OPERATION_SIZE_BYTES = 2_048;
const USER_EXPORT_OPERATION_USER_AGENT =
  "GreyhoundIQ disposable user-export operation proof";
const USER_EXPORT_ARTIFACT_REPLAY_ID =
  "cuserexportartifactrollback01";
const USER_EXPORT_OPERATION_COUNTS = {
  threads: 0,
  posts: 0,
  listings: 0,
  conversations: 0,
  messagesSent: 0,
  messagesReceived: 0,
  mediaAssets: 0,
  memoryEntries: 0,
  agentRuns: 0,
} as const;
const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_PATTERN = /^c[a-z0-9]{20,31}$/;

type FixtureSnapshot = Awaited<ReturnType<typeof collectFixtureSnapshot>>;
type TransactionRunner = <T>(
  fn: (tx: DbContextClient) => Promise<T>,
) => Promise<T>;

export function assertDemoFixtureVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(
    confirmation,
    DEMO_FIXTURE_VERIFY_CONFIRMATION,
    `DEMO_FIXTURE_VERIFY_CONFIRM must equal ${DEMO_FIXTURE_VERIFY_CONFIRMATION}`,
  );
  assertLocalDatabaseUrl(value);
  const url = new URL(value);
  assert.ok(
    LITERAL_LOOPBACK_HOSTS.has(url.hostname),
    "Fixture verification requires literal 127.0.0.1 or ::1 loopback",
  );
  assert.equal(
    url.port,
    REPLAY_PORT,
    "Fixture verification is restricted to disposable replay port 55734",
  );
  assert.equal(
    url.pathname,
    REPLAY_DATABASE,
    "Fixture verification is restricted to the disposable greyhoundiq replay database",
  );
  for (const parameter of url.searchParams.keys()) {
    assert.ok(
      !ENDPOINT_OVERRIDE_PARAMETERS.has(parameter.toLowerCase()),
      `Fixture verification URL must not override its endpoint via ${parameter}`,
    );
  }
  assert.equal(
    decodeURIComponent(url.username),
    RUNTIME_ROLE,
    `Fixture verification must authenticate directly as ${RUNTIME_ROLE}`,
  );
  assert.equal(
    url.password,
    "",
    "The trust-authenticated disposable runtime target must not embed a password",
  );
  return url;
}

export function deriveDemoFixtureCleanupUrl(
  runtimeValue: string,
  confirmation: string | undefined,
) {
  const runtime = assertDemoFixtureVerifierTarget(runtimeValue, confirmation);
  const cleanup = new URL(runtime);
  cleanup.username = "postgres";
  cleanup.password = "";
  cleanup.search = "";
  cleanup.searchParams.set("connection_limit", "1");
  cleanup.searchParams.set(
    "application_name",
    "greyhoundiq_fixture_verifier_cleanup",
  );
  assert.equal(cleanup.hostname, runtime.hostname);
  assert.equal(cleanup.port, runtime.port);
  assert.equal(cleanup.pathname, runtime.pathname);
  return cleanup;
}

export async function runDemoFixtureIdempotencyVerifier(
  root = process.cwd(),
) {
  const inputUrl = requiredEnvironment("DEMO_FIXTURE_VERIFY_DATABASE_URL");
  const target = assertDemoFixtureVerifierTarget(
    inputUrl,
    process.env.DEMO_FIXTURE_VERIFY_CONFIRM,
  );
  const cleanupTarget = deriveDemoFixtureCleanupUrl(
    inputUrl,
    process.env.DEMO_FIXTURE_VERIFY_CONFIRM,
  );
  configureSafeDemoEnvironment(target);

  const [
    { prisma, captureDisposableReplayQueries },
    { withDbAnonymousContext, withDbRequestContext, withDbSystemContext },
    { seedDemoRouteFixtures },
    { getConversationForProfile, setConversationBlock },
    { requestAccountDeletion, recordUserExportCompletion },
    { syncAuthUser },
    { deleteMediaForCurrentUser, getMediaStatusForCurrentUser },
    { personalActorHandle },
    { signupAcceptanceWorkerStore },
    { getMyDogOwnership, getTrackById },
    { ingestStripeWebhook },
    { default: Stripe },
    { PrismaClient },
  ] = await Promise.all([
      import("../src/lib/db"),
      import("../src/lib/db-context"),
      import("./seed-demo-route-fixtures"),
      import("../src/lib/conversation-service"),
      import("../src/lib/account-service"),
      import("../src/lib/auth-sync"),
      import("../src/lib/media-service"),
      import("../src/lib/social-actor-service"),
      import("../src/lib/signup-acceptance-worker-store"),
      import("../src/lib/queries"),
      import("../src/lib/billing/stripe-webhooks"),
      import("stripe"),
      import("@prisma/client"),
    ]);
  const cleanupPrisma = new PrismaClient({
    datasources: { db: { url: cleanupTarget.toString() } },
  });
  const withCleanupTransaction: TransactionRunner = (fn) =>
    cleanupPrisma.$transaction(fn, { maxWait: 5_000, timeout: 30_000 });

  let cleanupRequired = false;
  try {
    const identity = await prisma.$queryRaw<
      Array<{
        role: string;
        sessionRole: string;
        database: string;
        schema: string;
        canLogin: boolean;
        superuser: boolean;
        bypassRls: boolean;
      }>
    >`
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
    assert.deepEqual(identity, [DEMO_FIXTURE_EXPECTED_RUNTIME_IDENTITY]);

    const initialFixture = await withDbSystemContext(collectFixtureSnapshot);
    assert.equal(
      initialFixture.privateRowCount,
      0,
      "The disposable verifier database must not contain prior approved fixture rows",
    );
    assert.equal(
      initialFixture.referenceRowCount,
      1,
      "The migrated general forum reference category must exist before private fixtures",
    );

    const providerInitial = await withDbSystemContext(collectProviderSnapshot);
    assert.deepEqual(
      providerInitial.counts,
      { Dog: 0, Track: 0, Meeting: 0, Race: 0 },
      "The disposable target must contain zero provider rows before sentinel setup",
    );

    await withDbSystemContext(setupProviderSamples);
    cleanupRequired = true;
    const providerBefore = await withDbSystemContext(collectProviderSnapshot);
    assert.deepEqual(providerBefore.counts, {
      Dog: 1,
      Track: 1,
      Meeting: 1,
      Race: 1,
    });

    await runUserCollisionRollbackProbe(
      withDbSystemContext,
      seedDemoRouteFixtures,
    );

    const firstSummary = await seedDemoRouteFixtures();
    const first = await withDbSystemContext(collectFixtureSnapshot);
    assertCompleteFixture(first);

    const adminAccount = DEMO_FIXTURE_MANIFEST.accounts[0];
    const withDemoAdminContext: TransactionRunner = (fn) =>
      withDbRequestContext(
        {
          dbUserId: adminAccount.userId,
          profileId: adminAccount.profileId,
          profileRole: "admin",
          tier: "pro_plus",
        },
        fn,
      );
    await runThreadCollisionRollbackProbe(
      withDemoAdminContext,
      seedDemoRouteFixtures,
    );

    const secondSummary = await seedDemoRouteFixtures();
    const second = await withDbSystemContext(collectFixtureSnapshot);
    assertCompleteFixture(second);
    assert.equal(
      second.fixtureSha256,
      first.fixtureSha256,
      "Two fixture runs must produce the same full controlled payload hash",
    );
    assert.deepEqual(second.modelCounts, first.modelCounts);
    assert.deepEqual(secondSummary.routes, firstSummary.routes);

    const databaseOperationProofs = await verifyDatabaseOperations(
      withDbSystemContext,
      withDbAnonymousContext,
      withDbRequestContext,
      captureDisposableReplayQueries,
      getConversationForProfile,
      requestAccountDeletion,
      syncAuthUser,
      deleteMediaForCurrentUser,
      getMediaStatusForCurrentUser,
      personalActorHandle,
      setConversationBlock,
      signupAcceptanceWorkerStore,
      getMyDogOwnership,
      getTrackById,
      ingestStripeWebhook,
      recordUserExportCompletion,
      Stripe,
      identity[0],
    );
    assert.equal(
      databaseOperationProofs.length,
      DEMO_FIXTURE_EXPECTED_DATABASE_OPERATION_PROOFS.length,
    );

    const providerAfter = await withDbSystemContext(collectProviderSnapshot);
    assert.deepEqual(providerAfter.counts, providerBefore.counts);
    assert.equal(
      providerAfter.rowsSha256,
      providerBefore.rowsSha256,
      "Private fixture seeding must leave every provider sample row unchanged",
    );

    const sourceBinding = buildDemoFixtureSourceBinding(root);
    const cleanup = await withCleanupTransaction((tx) =>
      cleanupVerifierRows(tx, true),
    );
    cleanupRequired = false;
    const finalFixture = await withDbSystemContext(collectFixtureSnapshot);
    const finalProvider = await withDbSystemContext(collectProviderSnapshot);
    assert.equal(finalFixture.privateRowCount, 0);
    assert.equal(finalFixture.referenceRowCount, 1);
    assert.deepEqual(finalProvider.counts, {
      Dog: 0,
      Track: 0,
      Meeting: 0,
      Race: 0,
    });
    const report = {
      schemaVersion: DEMO_FIXTURE_EVIDENCE_SCHEMA_VERSION,
      auditKind: "synthetic-private-fixture-idempotency",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: target.hostname,
        port: Number(target.port),
        database: target.pathname.slice(1),
        runtimeRole: RUNTIME_ROLE,
        runtimeSessionRole: RUNTIME_ROLE,
        productionOrProviderSystemsContacted: false,
        cleanup:
          "A separately guarded postgres session removed only exact verifier-owned identifiers, including the auth-acceptance, signed Stripe receipt, user-export audit/artifact and rejected DogOwnership probe graphs, and the exact synthetic conversation-block, media-delete and account-deletion audit scopes after runtime verification completed.",
        elevatedAdminUsedForVerification: false,
        elevatedAdminUsedForCleanupOnly: true,
        externalRealtimeAndNetworkEffects:
          "Realtime broadcast was disabled; Stripe signature generation and verification used a synthetic local secret without provider delivery or network access; Storage cleanup was directed only to a loopback-unreachable endpoint with a rejected placeholder service role, so the real best-effort error path ran without any provider or external network access.",
      },
      runtimeIdentity: identity[0],
      sourceBinding,
      collisionRollbackProbes: [
        {
          probe: "duplicate .test identity with foreign reserved owner",
          expectedError: "demo_fixtures.user_collision",
          transactionRowsAfterFailure: 0,
          status: "verified",
        },
        {
          probe: "reserved thread identifier owned by a foreign synthetic profile",
          expectedError: "demo_fixtures.thread_collision",
          transactionRowsAfterFailure: DEMO_PRIVATE_FIXTURE_ROW_COUNT,
          status: "verified",
        },
      ],
      databaseOperationProofs,
      firstRun: evidenceSnapshot(first),
      secondRun: evidenceSnapshot(second),
      providerInitial,
      providerBefore,
      providerAfter,
      cleanup,
      verdict: "verified",
    } as const;

    validateDemoFixtureEvidence(report, {
      root,
      now: new Date(report.generatedAt),
    });
    const outputPath = writeEvidence(root, report);
    validateDemoFixtureEvidence(
      JSON.parse(readFileSync(outputPath, "utf8")) as unknown,
      { root, now: new Date(report.generatedAt) },
    );
    return { report, outputPath };
  } finally {
    try {
      if (cleanupRequired) {
        await withCleanupTransaction((tx) => cleanupVerifierRows(tx, false));
      }
    } finally {
      await cleanupPrisma.$disconnect();
    }
  }
}

function configureSafeDemoEnvironment(input: URL) {
  const databaseUrl = new URL(input);
  databaseUrl.searchParams.set("connection_limit", "4");
  process.env.DATABASE_URL = databaseUrl.toString();
  process.env.DIRECT_URL = databaseUrl.toString();
  process.env.DEMO_FIXTURE_QUERY_EVIDENCE_MODE = QUERY_EVIDENCE_MODE;
  process.env.REALTIME_BROADCAST_DISABLED = "true";
  process.env.REALTIME_CHANNEL_SECRET = "your_realtime_channel_secret";
  process.env.SUPABASE_URL = "http://127.0.0.1:1";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:1";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key";
  process.env.APP_ENV = "demo";
  process.env.DEMO_AUTH_MODE = "full-access";
  process.env.EXPORT_DISABLED = "false";
  process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
  process.env.NEXTAUTH_URL = "http://127.0.0.1:3000";
  process.env.WORKOS_REDIRECT_URI = "http://127.0.0.1:3000/callback";
  process.env.STRIPE_RESTRICTED_KEY = "rk_test_123456789"; // gitleaks:allow - disposable test sentinel
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
}

async function setupProviderSamples(tx: DbContextClient) {
  const { dogId, raceId, trackId } = DEMO_FIXTURE_MANIFEST.providerSamples;
  const dogCollisions = await tx.dog.findMany({
    where: {
      OR: [
        { id: dogId },
        { sourceProvider: PROVIDER, sourceId: "route-audit-dog" },
      ],
    },
  });
  assertOwnedCollision(dogCollisions, dogId, "provider dog");
  await tx.dog.upsert({
    where: { id: dogId },
    update: providerDogData(),
    create: { id: dogId, ...providerDogData() },
  });

  const track = await tx.track.findUnique({ where: { id: trackId } });
  assert.ok(
    !track,
    "provider track identifier collision",
  );
  await tx.track.upsert({
    where: { id: trackId },
    update: providerTrackData(),
    create: { id: trackId, ...providerTrackData() },
  });

  const meetingCollisions = await tx.meeting.findMany({
    where: {
      OR: [
        { id: PROVIDER_MEETING_ID },
        { trackId, meetingDate: PROVIDER_MEETING_DATE },
      ],
    },
  });
  assertOwnedCollision(
    meetingCollisions,
    PROVIDER_MEETING_ID,
    "provider meeting",
  );
  await tx.meeting.upsert({
    where: { id: PROVIDER_MEETING_ID },
    update: providerMeetingData(trackId),
    create: {
      id: PROVIDER_MEETING_ID,
      ...providerMeetingData(trackId),
    },
  });

  const raceCollisions = await tx.race.findMany({
    where: {
      OR: [
        { id: raceId },
        { meetingId: PROVIDER_MEETING_ID, raceNumber: 1 },
        { sourceProvider: PROVIDER, sourceId: "route-audit-race" },
      ],
    },
  });
  assertOwnedCollision(raceCollisions, raceId, "provider race");
  await tx.race.upsert({
    where: { id: raceId },
    update: providerRaceData(),
    create: { id: raceId, ...providerRaceData() },
  });

  const providerRunner = {
    raceId,
    dogId,
    boxNumber: 1,
    weight: 31.2,
    trainerId: null,
    startingPrice: null,
    sourceProvider: PROVIDER,
    sourceId: "route-audit-runner",
    sourceRawJson: null,
    createdAt: PROVIDER_MEETING_DATE,
  };
  const runnerCollisions = await tx.runner.findMany({
    where: {
      OR: [
        { id: PROVIDER_RUNNER_ID },
        { raceId, boxNumber: providerRunner.boxNumber },
        { sourceProvider: PROVIDER, sourceId: providerRunner.sourceId },
      ],
    },
    select: { id: true },
  });
  assertOwnedCollision(runnerCollisions, PROVIDER_RUNNER_ID, "provider runner");
  await tx.runner.upsert({
    where: { id: PROVIDER_RUNNER_ID },
    update: providerRunner,
    create: { id: PROVIDER_RUNNER_ID, ...providerRunner },
  });
}

async function setupDogOwnershipOperationProbe(
  tx: DbContextClient,
  dogId: string,
  profileId: string,
) {
  const collisions = await tx.dogOwnership.findMany({
    where: {
      OR: [
        { id: DOG_OWNERSHIP_OPERATION_PROBE_ID },
        { dogId, profileId },
      ],
    },
    select: { id: true },
  });
  assert.deepEqual(
    collisions,
    [],
    "dog ownership operation probe identifier collision",
  );
  await tx.dogOwnership.create({
    data: {
      id: DOG_OWNERSHIP_OPERATION_PROBE_ID,
      dogId,
      profileId,
      role: "owner",
      verified: false,
      status: "rejected",
      rejectionReason: DOG_OWNERSHIP_OPERATION_REJECTION_REASON,
    },
  });
}

function providerDogData() {
  return {
    name: "Fixture Provider Hound",
    earBrand: null,
    colour: "Black",
    sex: "D",
    whelpDate: null,
    sireId: null,
    damId: null,
    trainerId: null,
    sourceProvider: PROVIDER,
    sourceId: "route-audit-dog",
    profileUrl: null,
    ownerName: null,
    careerStarts: null,
    careerWins: null,
    careerSeconds: null,
    careerThirds: null,
    prizeMoney: null,
    winPercentage: null,
    placePercentage: null,
    profileStatsJson: null,
    bestTimesJson: null,
    boxHistoryJson: null,
    distanceHistoryJson: null,
    profileSourceRawJson: null,
    lastProfileSyncedAt: PROVIDER_RACE_TIME,
    retiredAt: null,
    createdAt: PROVIDER_MEETING_DATE,
  } as const;
}

function providerTrackData() {
  return {
    name: "Fixture Provider Track",
    state: "NSW",
    surface: "Sand",
    circumference: 400,
    straightLength: 100,
    boxCount: 8,
    hasIsolynx: false,
    createdAt: PROVIDER_MEETING_DATE,
  } as const;
}

function providerMeetingData(trackId: string) {
  return {
    trackId,
    meetingDate: PROVIDER_MEETING_DATE,
    meetingType: "Night",
    sourceProvider: PROVIDER,
    sourceId: "route-audit-meeting",
    sourceRawJson: null,
    lastSyncedAt: PROVIDER_RACE_TIME,
    createdAt: PROVIDER_MEETING_DATE,
  } as const;
}

function providerRaceData() {
  return {
    meetingId: PROVIDER_MEETING_ID,
    raceNumber: 1,
    name: "Fixture Provider Route Audit",
    raceTime: PROVIDER_RACE_TIME,
    distance: 520,
    grade: "Mixed",
    prizeMoney: null,
    resultStatus: "Scheduled",
    replayUrl: null,
    photoFinishUrl: null,
    sourceProvider: PROVIDER,
    sourceId: "route-audit-race",
    sourceRawJson: null,
    lastSyncedAt: PROVIDER_RACE_TIME,
    createdAt: PROVIDER_MEETING_DATE,
  } as const;
}

async function setupPublicRacingDetailOperationProbe(tx: DbContextClient) {
  const { dogId, raceId, trackId } = DEMO_FIXTURE_MANIFEST.providerSamples;
  const probe = PUBLIC_RACING_DETAIL_PROBE;
  const [trainers, races, runners, results, videos, formEntries, profileForms] =
    await Promise.all([
      tx.trainer.count({ where: { id: probe.trainerId } }),
      tx.race.count({ where: { id: probe.previousRaceId } }),
      tx.runner.count({
        where: { id: { in: [probe.currentRunnerId, probe.previousRunnerId] } },
      }),
      tx.result.count({
        where: { id: { in: [probe.currentResultId, probe.previousResultId] } },
      }),
      tx.raceVideo.count({
        where: { id: { in: [probe.currentVideoId, probe.previousVideoId] } },
      }),
      tx.formEntry.count({ where: { id: probe.formEntryId } }),
      tx.dogProfileForm.count({ where: { id: probe.profileFormId } }),
    ]);
  assert.deepEqual(
    { trainers, races, runners, results, videos, formEntries, profileForms },
    {
      trainers: 0,
      races: 0,
      runners: 1,
      results: 0,
      videos: 0,
      formEntries: 0,
      profileForms: 0,
    },
    "public racing detail operation probe identifiers must be unused",
  );

  await tx.trainer.create({
    data: {
      id: probe.trainerId,
      name: "Fixture Provider Trainer",
      state: "NSW",
      licenseNumber: null,
      createdAt: PROVIDER_MEETING_DATE,
    },
  });
  await tx.dog.update({
    where: { id: dogId },
    data: { trainerId: probe.trainerId },
  });
  await tx.race.create({
    data: {
      id: probe.previousRaceId,
      meetingId: PROVIDER_MEETING_ID,
      raceNumber: 2,
      name: "Fixture Provider Previous Replay",
      raceTime: probe.previousRaceTime,
      distance: 520,
      grade: "Mixed",
      resultStatus: "Final",
      replayUrl: "https://fixture.invalid/replay/previous",
      sourceProvider: PROVIDER,
      sourceId: "route-audit-race-previous",
      lastSyncedAt: PROVIDER_RACE_TIME,
      createdAt: PROVIDER_MEETING_DATE,
    },
  });
  await tx.formEntry.create({
    data: {
      id: probe.formEntryId,
      dogId,
      raceId: null,
      trackId,
      date: probe.previousRaceTime,
      boxNumber: 1,
      finish: 1,
      time: 29.9,
      distance: 520,
      grade: "Mixed",
      weight: 31.2,
      createdAt: PROVIDER_MEETING_DATE,
    },
  });
  await tx.dogProfileForm.create({
    data: {
      id: probe.profileFormId,
      dogId,
      sourceProvider: PROVIDER,
      sourceId: "route-audit-dog-profile-form",
      raceUrl: "https://fixture.invalid/race/profile-form",
      date: probe.previousRaceTime,
      trackCode: "FIX",
      trackName: "Fixture Provider Track",
      raceName: "Fixture Provider Previous Replay",
      finishText: "1st",
      finishingPosition: 1,
      boxNumber: 1,
      weight: 31.2,
      distance: 520,
      grade: "Mixed",
      runningTime: 29.9,
      winnerTime: 29.9,
      firstSectional: 5.1,
      margin: 0,
      winnerDogName: "Fixture Provider Hound",
      hasVideo: true,
      createdAt: PROVIDER_MEETING_DATE,
      updatedAt: PROVIDER_MEETING_DATE,
    },
  });
  await tx.runner.update({
    where: { id: probe.currentRunnerId },
    data: {
      trainerId: probe.trainerId,
      startingPrice: 2.5,
      sourceId: "route-audit-runner-current",
    },
  });
  await tx.runner.create({
    data: {
      id: probe.previousRunnerId,
      raceId: probe.previousRaceId,
      dogId,
      boxNumber: 1,
      weight: 31.2,
      trainerId: probe.trainerId,
      startingPrice: 2.2,
      sourceProvider: PROVIDER,
      sourceId: "route-audit-runner-previous",
      createdAt: PROVIDER_MEETING_DATE,
    },
  });
  await tx.result.createMany({
    data: [
      {
        id: probe.currentResultId,
        runnerId: probe.currentRunnerId,
        raceId,
        finishingPosition: 1,
        runningTime: 29.8,
        margin: 0,
        sourceProvider: PROVIDER,
        sourceId: "route-audit-result-current",
        lastSyncedAt: PROVIDER_RACE_TIME,
        createdAt: PROVIDER_MEETING_DATE,
      },
      {
        id: probe.previousResultId,
        runnerId: probe.previousRunnerId,
        raceId: probe.previousRaceId,
        finishingPosition: 1,
        runningTime: 29.9,
        margin: 0,
        sourceProvider: PROVIDER,
        sourceId: "route-audit-result-previous",
        lastSyncedAt: PROVIDER_RACE_TIME,
        createdAt: PROVIDER_MEETING_DATE,
      },
    ],
  });
  await tx.raceVideo.createMany({
    data: [
      {
        id: probe.currentVideoId,
        raceId,
        sourceProvider: PROVIDER,
        sourceId: "route-audit-video-current",
        kind: "replay",
        pageUrl: "https://fixture.invalid/replay/current",
        sourceStatus: 200,
        title: "Fixture current replay",
        fetchedAt: PROVIDER_RACE_TIME,
        lastSyncedAt: PROVIDER_RACE_TIME,
        createdAt: PROVIDER_MEETING_DATE,
        updatedAt: PROVIDER_MEETING_DATE,
      },
      {
        id: probe.previousVideoId,
        raceId: probe.previousRaceId,
        sourceProvider: PROVIDER,
        sourceId: "route-audit-video-previous",
        kind: "replay",
        pageUrl: "https://fixture.invalid/replay/previous",
        sourceStatus: 200,
        title: "Fixture previous replay",
        fetchedAt: probe.previousRaceTime,
        lastSyncedAt: PROVIDER_RACE_TIME,
        createdAt: PROVIDER_MEETING_DATE,
        updatedAt: PROVIDER_MEETING_DATE,
      },
    ],
  });
}

async function cleanupPublicRacingDetailOperationProbe(
  tx: DbContextClient,
  requireComplete: boolean,
) {
  const { dogId } = DEMO_FIXTURE_MANIFEST.providerSamples;
  const probe = PUBLIC_RACING_DETAIL_PROBE;
  const deleted = {
    RaceVideo: (
      await tx.raceVideo.deleteMany({
        where: { id: { in: [probe.currentVideoId, probe.previousVideoId] } },
      })
    ).count,
    Result: (
      await tx.result.deleteMany({
        where: { id: { in: [probe.currentResultId, probe.previousResultId] } },
      })
    ).count,
    Runner: (
      await tx.runner.deleteMany({
        where: { id: { in: [probe.currentRunnerId, probe.previousRunnerId] } },
      })
    ).count,
    FormEntry: (
      await tx.formEntry.deleteMany({ where: { id: probe.formEntryId } })
    ).count,
    DogProfileForm: (
      await tx.dogProfileForm.deleteMany({ where: { id: probe.profileFormId } })
    ).count,
    Race: (
      await tx.race.deleteMany({
        where: {
          id: probe.previousRaceId,
          sourceProvider: PROVIDER,
          sourceId: "route-audit-race-previous",
        },
      })
    ).count,
  };
  await tx.dog.updateMany({
    where: { id: dogId, trainerId: probe.trainerId },
    data: { trainerId: null },
  });
  const trainerCount = (
    await tx.trainer.deleteMany({ where: { id: probe.trainerId } })
  ).count;
  if (requireComplete) {
    assert.deepEqual(deleted, {
      RaceVideo: 2,
      Result: 2,
      Runner: 2,
      FormEntry: 1,
      DogProfileForm: 1,
      Race: 1,
    });
    assert.equal(trainerCount, 1);
  }
  return { ...deleted, Trainer: trainerCount };
}

function assertOwnedCollision(
  rows: Array<{ id: string }>,
  expectedId: string,
  label: string,
) {
  assert.ok(
    rows.length <= 1 && rows.every((row) => row.id === expectedId),
    `${label} identifier or composite-key collision`,
  );
}

async function runUserCollisionRollbackProbe(
  withDbSystemContext: TransactionRunner,
  seed: () => Promise<unknown>,
) {
  const account = DEMO_FIXTURE_MANIFEST.accounts[0];
  const email = account.email;
  await withDbSystemContext((tx) =>
    tx.user.create({
      data: { id: USER_COLLISION_PROBE_ID, email, name: "Collision Probe" },
    }),
  );
  await expectSeedFailure(seed, /demo_fixtures\.user_collision/);
  const snapshot = await withDbSystemContext(collectFixtureSnapshot);
  assert.equal(snapshot.privateRowCount, 0);
  assert.equal(snapshot.referenceRowCount, 1);
  const probe = await withDbSystemContext((tx) =>
    tx.user.findUnique({ where: { id: USER_COLLISION_PROBE_ID } }),
  );
  assert.equal(probe?.email, email);
  await withDbSystemContext((tx) =>
    tx.user.update({
      where: { id: USER_COLLISION_PROBE_ID },
      data: {
        id: account.userId,
        email: account.email,
        name: account.displayName,
        subscriptionTier: account.tier,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isBanned: false,
        deletionRequestedAt: null,
        workosUserId: null,
        createdAt: new Date(DEMO_FIXTURE_TIMESTAMP),
      },
    }),
  );
}

async function runThreadCollisionRollbackProbe(
  withDbSystemContext: TransactionRunner,
  seed: () => Promise<unknown>,
) {
  const [admin, peer] = DEMO_FIXTURE_MANIFEST.accounts;
  await withDbSystemContext((tx) =>
    tx.thread.update({
      where: { id: DEMO_FIXTURE_MANIFEST.community.threadId },
      data: {
        authorId: peer.profileId,
        title: "Collision Probe",
      },
    }),
  );
  try {
    const before = await withDbSystemContext(collectFixtureSnapshot);
    assertCompleteFixture(before);
    await expectSeedFailure(seed, /demo_fixtures\.thread_collision/);
    const after = await withDbSystemContext(collectFixtureSnapshot);
    assert.deepEqual(after, before, "failed fixture transaction must roll back exactly");
  } finally {
    await withDbSystemContext((tx) =>
      tx.thread.update({
        where: { id: DEMO_FIXTURE_MANIFEST.community.threadId },
        data: {
          categoryId: DEMO_FIXTURE_MANIFEST.community.categoryId,
          title: "GreyhoundIQ demo race-night discussion",
          authorId: admin.profileId,
          pinned: true,
          locked: false,
          views: 42,
          createdAt: new Date(DEMO_FIXTURE_TIMESTAMP),
        },
      }),
    );
  }
}

async function expectSeedFailure(
  seed: () => Promise<unknown>,
  expected: RegExp,
) {
  let failure: unknown;
  try {
    await seed();
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof Error, "collision probe must fail closed");
  assert.match(failure.message, expected);
}

async function verifyDatabaseOperations(
  withDbSystemContext: TransactionRunner,
  withDbAnonymousContext: typeof import("../src/lib/db-context").withDbAnonymousContext,
  withDbRequestContext: typeof import("../src/lib/db-context").withDbRequestContext,
  captureDisposableReplayQueries: typeof import("../src/lib/db").captureDisposableReplayQueries,
  getConversationForProfile: typeof import("../src/lib/conversation-service").getConversationForProfile,
  requestAccountDeletion: typeof import("../src/lib/account-service").requestAccountDeletion,
  syncAuthUser: typeof import("../src/lib/auth-sync").syncAuthUser,
  deleteMediaForCurrentUser: typeof import("../src/lib/media-service").deleteMediaForCurrentUser,
  getMediaStatusForCurrentUser: typeof import("../src/lib/media-service").getMediaStatusForCurrentUser,
  personalActorHandle: typeof import("../src/lib/social-actor-service").personalActorHandle,
  setConversationBlock: typeof import("../src/lib/conversation-service").setConversationBlock,
  signupAcceptanceWorkerStore: typeof import("../src/lib/signup-acceptance-worker-store").signupAcceptanceWorkerStore,
  getMyDogOwnership: typeof import("../src/lib/queries").getMyDogOwnership,
  getTrackById: typeof import("../src/lib/queries").getTrackById,
  ingestStripeWebhook: typeof import("../src/lib/billing/stripe-webhooks").ingestStripeWebhook,
  recordUserExportCompletion: typeof import("../src/lib/account-service").recordUserExportCompletion,
  Stripe: typeof import("stripe").default,
  runtimeIdentity: {
    role: string;
    sessionRole: string;
    database: string;
    schema: string;
    canLogin: boolean;
    superuser: boolean;
    bypassRls: boolean;
  },
) {
  const [adminAccount, proAccount, freeAccount] =
    DEMO_FIXTURE_MANIFEST.accounts;
  const admin = demoCurrentUser(adminAccount);
  const pro = demoCurrentUser(proAccount);
  const free = demoCurrentUser(freeAccount);
  const conversationId = DEMO_FIXTURE_MANIFEST.conversation.id;
  const mediaId = DEMO_FIXTURE_MANIFEST.pageMedia[0].id;
  const dogId = DEMO_FIXTURE_MANIFEST.providerSamples.dogId;
  const blockedProfileId = pro.profileId;

  await withDbSystemContext(setupPublicRacingDetailOperationProbe);
  const trackDetailProof = await provePublicTrackDetail(
    withDbAnonymousContext,
    captureDisposableReplayQueries,
    getTrackById,
    runtimeIdentity,
  );
  await withDbSystemContext((tx) =>
    cleanupPublicRacingDetailOperationProbe(tx, true),
  );

  await withDbSystemContext((tx) =>
    setupSignupOutboxProbes(tx, admin.dbUserId, pro.dbUserId),
  );
  await withDbSystemContext((tx) =>
    setupDogOwnershipOperationProbe(tx, dogId, free.profileId),
  );

  const before = await withDbSystemContext(collectDatabaseOperationRowCounts);
  assert.deepEqual(before, {
    User: 4,
    Conversation: 1,
    MediaAsset: 6,
    MediaDeleteAuditLog: 0,
    AccountDeletionAuditLog: 0,
    UserBlock: 0,
    ConversationBlockAuditLog: 0,
    SignupOutbox: 2,
  });

  const authAcceptanceProof = await proveAuthCallbackAcceptance(
    withDbSystemContext,
    withDbRequestContext,
    captureDisposableReplayQueries,
    syncAuthUser,
    personalActorHandle,
    free,
    runtimeIdentity,
  );

  const dogOwnershipProof = await proveDogOwnershipSelect(
    withDbSystemContext,
    withDbAnonymousContext,
    withDbRequestContext,
    captureDisposableReplayQueries,
    getMyDogOwnership,
    free,
    pro,
    dogId,
    runtimeIdentity,
  );
  const stripeWebhookProof = await proveStripeWebhookInsert(
    withDbSystemContext,
    withDbAnonymousContext,
    withDbRequestContext,
    captureDisposableReplayQueries,
    ingestStripeWebhook,
    Stripe,
    admin,
    free,
    runtimeIdentity,
  );
  const userExportProofs = await proveUserExportWrites(
    withDbSystemContext,
    withDbAnonymousContext,
    withDbRequestContext,
    captureDisposableReplayQueries,
    recordUserExportCompletion,
    pro,
    free,
    runtimeIdentity,
  );

  const conversationCapture = await captureDisposableReplayQueries(() =>
    getConversationForProfile(admin, conversationId),
  );
  const conversation = conversationCapture.result;
  assert.equal(conversation.id, conversationId);
  assert.ok(!Array.isArray(conversation), "conversation access must return one object");
  const conversationSql = observedSelectEvidence(
    exactObservedTableSelect(conversationCapture.queries, "Conversation"),
    [
      { name: "conversationId", value: conversationId, occurrences: 1 },
      { name: "current.profileId", value: admin.profileId, occurrences: 2 },
      { name: "prisma.take", value: 1, occurrences: 1 },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  const conversationExplain = await explainObservedStatement(
    withDbRequestContext,
    admin,
    conversationSql,
  );
  await expectExactOperationError(
    () => getConversationForProfile(free, conversationId),
    "conversation.not_found",
  );
  await expectExactOperationError(
    () =>
      getConversationForProfile(
        admin,
        "demo-conversation-missing-operation-proof",
      ),
    "conversation.not_found",
  );

  const mediaCapture = await captureDisposableReplayQueries(() =>
    getMediaStatusForCurrentUser(admin, mediaId),
  );
  const media = mediaCapture.result;
  assert.equal(media.id, mediaId);
  assert.deepEqual(
    Object.keys(media).sort(),
    [...DEMO_FIXTURE_MEDIA_STATUS_FIELDS],
    "media status must return only the reviewed seven-field projection",
  );
  assert.equal(media.scanStatus, "clean");
  assert.equal(media.processingStatus, "ready");
  assert.equal(media.processingError, null);
  const mediaSql = observedSelectEvidence(
    exactObservedTableSelect(mediaCapture.queries, "MediaAsset"),
    [
      { name: "mediaId", value: mediaId, occurrences: 1 },
      { name: "current.dbUserId", value: admin.dbUserId, occurrences: 1 },
      { name: "prisma.take", value: 1, occurrences: 1 },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  const mediaExplain = await explainObservedStatement(
    withDbRequestContext,
    admin,
    mediaSql,
  );
  await expectExactOperationError(
    () => getMediaStatusForCurrentUser(pro, mediaId),
    "media.not_found",
  );
  await expectExactOperationError(
    () =>
      getMediaStatusForCurrentUser(
        admin,
        "demo-page-media-missing-operation-proof",
      ),
    "media.not_found",
  );

  const afterReads = await withDbSystemContext(collectDatabaseOperationRowCounts);
  assert.deepEqual(
    afterReads,
    before,
    "runtime read proofs must not change fixture rows",
  );

  await expectExactOperationError(
    () =>
      withDbRequestContext(admin, async (tx) => {
        await tx.conversation.update({
          where: { id: conversationId },
          data: { blockedById: admin.profileId, blockedAt: new Date() },
        });
        await tx.userBlock.upsert({
          where: {
            blockerProfileId_blockedProfileId: {
              blockerProfileId: admin.profileId,
              blockedProfileId,
            },
          },
          update: {},
          create: {
            blockerProfileId: admin.profileId,
            blockedProfileId,
          },
        });
        throw new Error("demo_fixture.block_transaction_rollback");
      }),
    "demo_fixture.block_transaction_rollback",
  );
  const afterRollback = await withDbSystemContext(collectConversationBlockState);
  assert.equal(afterRollback.conversation.blockedById, null);
  assert.equal(afterRollback.conversation.blockedAt, null);
  assert.deepEqual(afterRollback.userBlocks, []);
  assert.equal(afterRollback.auditCount, 0);

  await expectExactOperationError(
    () => setConversationBlock(free, conversationId, true),
    "conversation.not_found",
  );

  const blockCapture = await captureDisposableReplayQueries(() =>
    setConversationBlock(admin, conversationId, true),
  );
  const blockedConversation = blockCapture.result;
  assert.equal(blockedConversation.blockedById, admin.profileId);
  assert.ok(blockedConversation.blockedAt instanceof Date);
  const blockedState = await withDbSystemContext(collectConversationBlockState);
  assert.equal(blockedState.conversation.blockedById, admin.profileId);
  assert.ok(blockedState.conversation.blockedAt instanceof Date);
  assert.equal(blockedState.userBlocks.length, 1);
  assert.equal(blockedState.auditCount, 1);
  const userBlock = blockedState.userBlocks[0];
  assert.equal(userBlock.blockerProfileId, admin.profileId);
  assert.equal(userBlock.blockedProfileId, blockedProfileId);

  const blockUpdateEvent = exactObservedTableStatement(
    blockCapture.queries,
    "UPDATE",
    "Conversation",
  );
  const userBlockUpsertEvent = exactObservedTableStatement(
    blockCapture.queries,
    "INSERT",
    "UserBlock",
  );
  assertMutationTransaction(
    blockCapture.queries,
    blockUpdateEvent,
    userBlockUpsertEvent,
  );
  const blockUpdateSql = observedStatementEvidence(
    blockUpdateEvent,
    "UPDATE",
    [
      { name: "next.blockedById", positions: [1], expectedValues: [admin.profileId] },
      { name: "next.blockedAt", positions: [2], expectedKinds: ["date"] },
      { name: "prisma.updatedAt", positions: [3], expectedKinds: ["date"] },
      { name: "conversation.id", positions: [4], expectedValues: [conversationId] },
    ],
  );
  const userBlockUpsertSql = observedStatementEvidence(
    userBlockUpsertEvent,
    "INSERT",
    [
      { name: "userBlock.id", positions: [1], expectedValues: [userBlock.id] },
      { name: "current.profileId", positions: [2], expectedValues: [admin.profileId] },
      { name: "blockedProfileId", positions: [3], expectedValues: [blockedProfileId] },
      { name: "prisma.createdAt", positions: [4], expectedKinds: ["date"] },
    ],
  );
  const blockUpdateExplain = await explainObservedStatement(
    withDbRequestContext,
    admin,
    blockUpdateSql,
  );
  const userBlockUpsertExplain = await explainObservedStatement(
    withDbRequestContext,
    admin,
    userBlockUpsertSql,
  );

  await expectExactOperationError(
    () => setConversationBlock(pro, conversationId, false),
    "auth.forbidden",
  );

  const duplicateCapture = await captureDisposableReplayQueries(() =>
    setConversationBlock(admin, conversationId, true),
  );
  assert.equal(duplicateCapture.result.blockedById, admin.profileId);
  const duplicateState = await withDbSystemContext(collectConversationBlockState);
  assert.equal(duplicateState.userBlocks.length, 1);
  assert.equal(duplicateState.userBlocks[0].id, userBlock.id);
  assert.equal(
    duplicateState.userBlocks[0].createdAt.toISOString(),
    userBlock.createdAt.toISOString(),
  );
  assert.equal(duplicateState.auditCount, 2);
  const duplicateUserBlockLookup = observedSelectEvidence(
    exactObservedUserBlockUniqueLookup(duplicateCapture.queries),
    [
      { name: "current.profileId", value: admin.profileId, occurrences: 1 },
      { name: "blockedProfileId", value: blockedProfileId, occurrences: 1 },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  assert.equal(duplicateUserBlockLookup.evidence.statementType, "SELECT");
  assert.equal(
    duplicateCapture.queries.filter((event) =>
      /^(?:INSERT INTO|UPDATE|DELETE FROM) "public"\."UserBlock"/i.test(
        normalizeObservedSql(event.query),
      ),
    ).length,
    0,
    "A duplicate Prisma-emulated upsert must retain the existing UserBlock without a second mutation",
  );
  assert.equal(
    normalizeObservedSql(
      exactObservedTableStatement(
        duplicateCapture.queries,
        "UPDATE",
        "Conversation",
      ).query,
    ),
    blockUpdateSql.normalizedSql,
  );

  const unblockCapture = await captureDisposableReplayQueries(() =>
    setConversationBlock(admin, conversationId, false),
  );
  assert.equal(unblockCapture.result.blockedById, null);
  assert.equal(unblockCapture.result.blockedAt, null);
  assert.equal(
    normalizeObservedSql(
      exactObservedTableStatement(
        unblockCapture.queries,
        "UPDATE",
        "Conversation",
      ).query,
    ),
    blockUpdateSql.normalizedSql,
    "Block and unblock must retain one parameterized Conversation UPDATE shape",
  );

  const claimInput = {
    now: SIGNUP_OUTBOX_CLAIM_NOW,
    limit: 1,
    leaseMs: SIGNUP_OUTBOX_CLAIM_LEASE_MS,
    maxAttempts: SIGNUP_OUTBOX_CLAIM_MAX_ATTEMPTS,
  } as const;
  const lockedClaimCapture = await withLockedSignupOutboxClaimProbe(
    withDbSystemContext,
    () =>
      captureDisposableReplayQueries(() =>
        signupAcceptanceWorkerStore.claimBatch(claimInput),
      ),
  );
  assert.deepEqual(lockedClaimCapture.result.claims, []);
  assert.equal(lockedClaimCapture.result.expiredDeadLettered, 1);
  const expiredDeadLetterSql = observedStatementEvidence(
    exactObservedSignupOutboxExpiredDeadLetter(
      lockedClaimCapture.queries,
    ),
    "WITH",
    [
      {
        name: "maxAttempts",
        positions: [1],
        expectedValues: [SIGNUP_OUTBOX_CLAIM_MAX_ATTEMPTS],
      },
      {
        name: "worker.now",
        positions: [2, 3, 5, 6],
        expectedKinds: ["date", "date", "date", "date"],
      },
      { name: "limit", positions: [4], expectedValues: [1] },
    ],
  );
  const expiredDeadLetterExplain = await explainObservedSystemStatement(
    withDbSystemContext,
    expiredDeadLetterSql,
  );
  assertDeadLetteredSignupOutboxExpiredProbe(
    await withDbSystemContext(collectSignupOutboxExpiredProbe),
  );
  await withDbSystemContext(resetSignupOutboxExpiredProbe);
  assert.equal(
    await withDbRequestContext(admin, (tx) =>
      tx.$executeRawUnsafe(
        expiredDeadLetterSql.normalizedSql,
        ...expiredDeadLetterSql.parameters,
      ),
    ),
    0,
  );
  assertPendingSignupOutboxExpiredProbe(
    await withDbSystemContext(collectSignupOutboxExpiredProbe),
  );
  await expectExactOperationError(
    () =>
      withDbSystemContext(async (tx) => {
        assert.equal(
          await tx.$executeRawUnsafe(
            expiredDeadLetterSql.normalizedSql,
            ...expiredDeadLetterSql.parameters,
          ),
          1,
        );
        throw new Error("demo_fixture.signup_outbox_expired_rollback");
      }),
    "demo_fixture.signup_outbox_expired_rollback",
  );
  assertPendingSignupOutboxExpiredProbe(
    await withDbSystemContext(collectSignupOutboxExpiredProbe),
  );
  assertPendingSignupOutboxProbe(
    await withDbSystemContext(collectSignupOutboxClaimProbe),
  );
  const claimSql = observedStatementEvidence(
    exactObservedSignupOutboxClaim(lockedClaimCapture.queries),
    "WITH",
    [
      {
        name: "maxAttempts",
        positions: [1],
        expectedValues: [SIGNUP_OUTBOX_CLAIM_MAX_ATTEMPTS],
      },
      {
        name: "worker.now",
        positions: [2, 3, 5, 8],
        expectedKinds: ["date", "date", "date", "date"],
      },
      { name: "limit", positions: [4], expectedValues: [1] },
      { name: "leaseExpiresAt", positions: [6], expectedKinds: ["date"] },
      { name: "leaseToken", positions: [7], expectedKinds: ["uuid"] },
    ],
  );
  for (const position of [2, 3, 5, 8]) {
    assert.equal(
      (claimSql.parameters[position - 1] as Date).toISOString(),
      SIGNUP_OUTBOX_CLAIM_NOW.toISOString(),
    );
  }
  assert.equal(
    (claimSql.parameters[5] as Date).toISOString(),
    new Date(
      SIGNUP_OUTBOX_CLAIM_NOW.getTime() + SIGNUP_OUTBOX_CLAIM_LEASE_MS,
    ).toISOString(),
  );
  const claimExplain = await explainObservedSystemStatement(
    withDbSystemContext,
    claimSql,
  );

  const requestContextClaims = await withDbRequestContext(admin, (tx) =>
    tx.$queryRawUnsafe<unknown[]>(
      claimSql.normalizedSql,
      ...claimSql.parameters,
    ),
  );
  assert.deepEqual(requestContextClaims, []);
  assertPendingSignupOutboxProbe(
    await withDbSystemContext(collectSignupOutboxClaimProbe),
  );

  await expectExactOperationError(
    () =>
      withDbSystemContext(async (tx) => {
        const claims = await tx.$queryRawUnsafe<unknown[]>(
          claimSql.normalizedSql,
          ...claimSql.parameters,
        );
        assert.equal(claims.length, 1);
        throw new Error("demo_fixture.signup_outbox_claim_rollback");
      }),
    "demo_fixture.signup_outbox_claim_rollback",
  );
  assertPendingSignupOutboxProbe(
    await withDbSystemContext(collectSignupOutboxClaimProbe),
  );

  const actualClaimCapture = await captureDisposableReplayQueries(() =>
    signupAcceptanceWorkerStore.claimBatch(claimInput),
  );
  assert.equal(actualClaimCapture.result.expiredDeadLettered, 1);
  assert.equal(actualClaimCapture.result.claims.length, 1);
  const actualClaim = actualClaimCapture.result.claims[0];
  assert.equal(actualClaim.id, SIGNUP_OUTBOX_CLAIM_PROBE_ID);
  assert.equal(actualClaim.userId, admin.dbUserId);
  assert.equal(actualClaim.attempt, 1);
  assert.match(actualClaim.leaseToken, UUID_PATTERN);
  assert.equal(
    normalizeObservedSql(
      exactObservedSignupOutboxClaim(actualClaimCapture.queries).query,
    ),
    claimSql.normalizedSql,
  );
  assert.equal(
    normalizeObservedSql(
      exactObservedSignupOutboxExpiredDeadLetter(
        actualClaimCapture.queries,
      ).query,
    ),
    expiredDeadLetterSql.normalizedSql,
  );
  assertDeadLetteredSignupOutboxExpiredProbe(
    await withDbSystemContext(collectSignupOutboxExpiredProbe),
  );
  const claimedProbe = await withDbSystemContext(collectSignupOutboxClaimProbe);
  assert.equal(claimedProbe.status, "processing");
  assert.equal(claimedProbe.retryCount, 1);
  assert.equal(claimedProbe.leaseToken, actualClaim.leaseToken);
  assert.equal(
    claimedProbe.leaseExpiresAt?.toISOString(),
    actualClaim.leaseExpiresAt.toISOString(),
  );

  const duplicateClaim = await signupAcceptanceWorkerStore.claimBatch(claimInput);
  assert.deepEqual(duplicateClaim.claims, []);
  assert.equal(duplicateClaim.expiredDeadLettered, 0);
  const afterDuplicateClaim = await withDbSystemContext(
    collectSignupOutboxClaimProbe,
  );
  assert.equal(afterDuplicateClaim.status, "processing");
  assert.equal(afterDuplicateClaim.retryCount, 1);
  assert.equal(afterDuplicateClaim.leaseToken, actualClaim.leaseToken);

  assert.notEqual(actualClaim.leaseToken, SIGNUP_OUTBOX_SETTLE_RETRY_TOKEN);
  assert.equal(
    await signupAcceptanceWorkerStore.complete(
      { ...actualClaim, leaseToken: SIGNUP_OUTBOX_SETTLE_RETRY_TOKEN },
      SIGNUP_OUTBOX_SETTLE_COMPLETE_AT,
    ),
    false,
  );
  assertProcessingSignupOutboxProbe(
    await withDbSystemContext(collectSignupOutboxClaimProbe),
    actualClaim.leaseToken,
  );

  const completeCapture = await captureDisposableReplayQueries(() =>
    signupAcceptanceWorkerStore.complete(
      actualClaim,
      SIGNUP_OUTBOX_SETTLE_COMPLETE_AT,
    ),
  );
  assert.equal(completeCapture.result, true);
  const completeSql = observedStatementEvidence(
    exactObservedSignupOutboxSettlement(completeCapture.queries, "sent"),
    "UPDATE",
    [
      { name: "completedAt", positions: [1, 2], expectedKinds: ["date", "date"] },
      {
        name: "claim.id",
        positions: [3],
        expectedValues: [SIGNUP_OUTBOX_CLAIM_PROBE_ID],
      },
      {
        name: "claim.leaseToken",
        positions: [4],
        expectedValues: [actualClaim.leaseToken],
      },
    ],
  );
  const completeExplain = await explainObservedSystemStatement(
    withDbSystemContext,
    completeSql,
  );
  const completedProbe = await withDbSystemContext(collectSignupOutboxClaimProbe);
  assert.equal(completedProbe.status, "sent");
  assert.equal(completedProbe.leaseToken, null);
  assert.equal(completedProbe.leaseExpiresAt, null);
  assert.equal(
    completedProbe.sentAt?.toISOString(),
    SIGNUP_OUTBOX_SETTLE_COMPLETE_AT.toISOString(),
  );
  assert.equal(
    await signupAcceptanceWorkerStore.complete(
      actualClaim,
      SIGNUP_OUTBOX_SETTLE_COMPLETE_AT,
    ),
    false,
  );
  await withDbSystemContext((tx) =>
    resetSignupOutboxForSettlement(tx, actualClaim.leaseToken),
  );
  await proveSignupOutboxSettlementGuards(
    withDbSystemContext,
    withDbRequestContext,
    admin,
    completeSql,
    actualClaim.leaseToken,
    "demo_fixture.signup_outbox_complete_rollback",
  );
  assert.equal(
    await signupAcceptanceWorkerStore.complete(
      actualClaim,
      SIGNUP_OUTBOX_SETTLE_COMPLETE_AT,
    ),
    true,
  );
  assert.equal(
    await signupAcceptanceWorkerStore.complete(
      actualClaim,
      SIGNUP_OUTBOX_SETTLE_COMPLETE_AT,
    ),
    false,
  );

  const retryClaim = await withDbSystemContext((tx) =>
    resetSignupOutboxForSettlement(tx, SIGNUP_OUTBOX_SETTLE_RETRY_TOKEN),
  );
  const retryErrorCode = "signup.retryable_test";
  const retryCapture = await captureDisposableReplayQueries(() =>
    signupAcceptanceWorkerStore.fail({
      claim: retryClaim,
      failedAt: SIGNUP_OUTBOX_SETTLE_RETRY_FAILED_AT,
      errorCode: retryErrorCode,
      retryAt: SIGNUP_OUTBOX_SETTLE_RETRY_AT,
    }),
  );
  assert.equal(retryCapture.result, "retry");
  const retrySql = observedStatementEvidence(
    exactObservedSignupOutboxSettlement(retryCapture.queries, "pending"),
    "UPDATE",
    [
      { name: "retryAt", positions: [1], expectedKinds: ["date"] },
      { name: "errorCode", positions: [2], expectedValues: [retryErrorCode] },
      { name: "failedAt", positions: [3], expectedKinds: ["date"] },
      {
        name: "claim.id",
        positions: [4],
        expectedValues: [SIGNUP_OUTBOX_CLAIM_PROBE_ID],
      },
      {
        name: "claim.leaseToken",
        positions: [5],
        expectedValues: [SIGNUP_OUTBOX_SETTLE_RETRY_TOKEN],
      },
    ],
  );
  const retryExplain = await explainObservedSystemStatement(
    withDbSystemContext,
    retrySql,
  );
  const retryProbe = await withDbSystemContext(collectSignupOutboxClaimProbe);
  assert.equal(retryProbe.status, "pending");
  assert.equal(retryProbe.leaseToken, null);
  assert.equal(retryProbe.leaseExpiresAt, null);
  assert.equal(retryProbe.lastErrorCode, retryErrorCode);
  assert.equal(
    retryProbe.nextRetryAt.toISOString(),
    SIGNUP_OUTBOX_SETTLE_RETRY_AT.toISOString(),
  );
  assert.equal(
    await signupAcceptanceWorkerStore.fail({
      claim: retryClaim,
      failedAt: SIGNUP_OUTBOX_SETTLE_RETRY_FAILED_AT,
      errorCode: retryErrorCode,
      retryAt: SIGNUP_OUTBOX_SETTLE_RETRY_AT,
    }),
    "lease-lost",
  );
  await withDbSystemContext((tx) =>
    resetSignupOutboxForSettlement(tx, SIGNUP_OUTBOX_SETTLE_RETRY_TOKEN),
  );
  await proveSignupOutboxSettlementGuards(
    withDbSystemContext,
    withDbRequestContext,
    admin,
    retrySql,
    SIGNUP_OUTBOX_SETTLE_RETRY_TOKEN,
    "demo_fixture.signup_outbox_retry_rollback",
  );
  assert.equal(
    await signupAcceptanceWorkerStore.fail({
      claim: retryClaim,
      failedAt: SIGNUP_OUTBOX_SETTLE_RETRY_FAILED_AT,
      errorCode: retryErrorCode,
      retryAt: SIGNUP_OUTBOX_SETTLE_RETRY_AT,
    }),
    "retry",
  );
  assert.equal(
    await signupAcceptanceWorkerStore.fail({
      claim: retryClaim,
      failedAt: SIGNUP_OUTBOX_SETTLE_RETRY_FAILED_AT,
      errorCode: retryErrorCode,
      retryAt: SIGNUP_OUTBOX_SETTLE_RETRY_AT,
    }),
    "lease-lost",
  );

  const deadLetterClaim = await withDbSystemContext((tx) =>
    resetSignupOutboxForSettlement(
      tx,
      SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_TOKEN,
    ),
  );
  const deadLetterErrorCode = "signup.permanent_test";
  const deadLetterCapture = await captureDisposableReplayQueries(() =>
    signupAcceptanceWorkerStore.fail({
      claim: deadLetterClaim,
      failedAt: SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_AT,
      errorCode: deadLetterErrorCode,
      retryAt: null,
    }),
  );
  assert.equal(deadLetterCapture.result, "dead-letter");
  const deadLetterSql = observedStatementEvidence(
    exactObservedSignupOutboxSettlement(
      deadLetterCapture.queries,
      "dead_letter",
    ),
    "UPDATE",
    [
      { name: "failedAt", positions: [1, 3], expectedKinds: ["date", "date"] },
      {
        name: "errorCode",
        positions: [2],
        expectedValues: [deadLetterErrorCode],
      },
      {
        name: "claim.id",
        positions: [4],
        expectedValues: [SIGNUP_OUTBOX_CLAIM_PROBE_ID],
      },
      {
        name: "claim.leaseToken",
        positions: [5],
        expectedValues: [SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_TOKEN],
      },
    ],
  );
  const deadLetterExplain = await explainObservedSystemStatement(
    withDbSystemContext,
    deadLetterSql,
  );
  const deadLetterProbe = await withDbSystemContext(
    collectSignupOutboxClaimProbe,
  );
  assert.equal(deadLetterProbe.status, "dead_letter");
  assert.equal(deadLetterProbe.leaseToken, null);
  assert.equal(deadLetterProbe.leaseExpiresAt, null);
  assert.equal(deadLetterProbe.lastErrorCode, deadLetterErrorCode);
  assert.equal(
    deadLetterProbe.deadLetteredAt?.toISOString(),
    SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_AT.toISOString(),
  );
  assert.equal(
    await signupAcceptanceWorkerStore.fail({
      claim: deadLetterClaim,
      failedAt: SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_AT,
      errorCode: deadLetterErrorCode,
      retryAt: null,
    }),
    "lease-lost",
  );
  await withDbSystemContext((tx) =>
    resetSignupOutboxForSettlement(
      tx,
      SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_TOKEN,
    ),
  );
  await proveSignupOutboxSettlementGuards(
    withDbSystemContext,
    withDbRequestContext,
    admin,
    deadLetterSql,
    SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_TOKEN,
    "demo_fixture.signup_outbox_dead_letter_rollback",
  );
  assert.equal(
    await signupAcceptanceWorkerStore.fail({
      claim: deadLetterClaim,
      failedAt: SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_AT,
      errorCode: deadLetterErrorCode,
      retryAt: null,
    }),
    "dead-letter",
  );
  assert.equal(
    await signupAcceptanceWorkerStore.fail({
      claim: deadLetterClaim,
      failedAt: SIGNUP_OUTBOX_SETTLE_DEAD_LETTER_AT,
      errorCode: deadLetterErrorCode,
      retryAt: null,
    }),
    "lease-lost",
  );
  assert.notEqual(completeSql.normalizedSql, retrySql.normalizedSql);
  assert.notEqual(completeSql.normalizedSql, deadLetterSql.normalizedSql);
  assert.notEqual(retrySql.normalizedSql, deadLetterSql.normalizedSql);

  const mediaDeleteBefore = await withDbSystemContext((tx) =>
    collectMediaDeleteState(tx, mediaId),
  );
  assert.equal(mediaDeleteBefore.media.uploaderId, admin.dbUserId);
  assert.equal(mediaDeleteBefore.media.deletedAt, null);
  assert.equal(mediaDeleteBefore.activeCount, 1);
  assert.equal(mediaDeleteBefore.tombstoneCount, 0);
  assert.equal(mediaDeleteBefore.auditCount, 0);
  assert.equal(
    mediaDeleteBefore.feedPostMediaCount,
    0,
    "The selected fixture intentionally leaves FeedPost transitions as residual evidence",
  );
  await expectExactOperationError(
    () => deleteMediaForCurrentUser(pro, mediaId),
    "media.not_found",
  );
  await expectExactOperationError(
    () =>
      deleteMediaForCurrentUser(
        admin,
        "demo-page-media-missing-delete-operation-proof",
      ),
    "media.not_found",
  );
  assert.deepEqual(
    await withDbSystemContext((tx) => collectMediaDeleteState(tx, mediaId)),
    mediaDeleteBefore,
    "Other-owner and missing delete attempts must not mutate media or audit state",
  );

  const mediaDeleteRollbackCapture = await captureDisposableReplayQueries(() =>
    expectExactOperationError(
      () =>
        withDbRequestContext(admin, async (tx) => {
          const tombstoned = await tx.mediaAsset.updateMany({
            where: { id: mediaId, deletedAt: null },
            data: { deletedAt: MEDIA_DELETE_ROLLBACK_AT },
          });
          assert.equal(tombstoned.count, 1);
          throw new Error("demo_fixture.media_delete_rollback");
        }),
      "demo_fixture.media_delete_rollback",
    ),
  );
  const mediaDeleteRollbackEvent = exactObservedTableStatement(
    mediaDeleteRollbackCapture.queries,
    "UPDATE",
    "MediaAsset",
  );
  const mediaDeleteRollbackSql = observedStatementEvidence(
    mediaDeleteRollbackEvent,
    "UPDATE",
    [
      { name: "deletedAt", positions: [1], expectedKinds: ["date"] },
      { name: "prisma.updatedAt", positions: [2], expectedKinds: ["date"] },
      { name: "media.id", positions: [3], expectedValues: [mediaId] },
    ],
  );
  assertStatementTransactionOutcome(
    mediaDeleteRollbackCapture.queries,
    mediaDeleteRollbackEvent,
    "ROLLBACK",
  );
  assert.deepEqual(
    await withDbSystemContext((tx) => collectMediaDeleteState(tx, mediaId)),
    mediaDeleteBefore,
    "Forced rollback must leave deletedAt and the audit scope unchanged",
  );

  const otherOwnerUpdated = await withDbRequestContext(pro, (tx) =>
    tx.$executeRawUnsafe(
      mediaDeleteRollbackSql.normalizedSql,
      ...mediaDeleteRollbackSql.parameters,
    ),
  );
  assert.equal(otherOwnerUpdated, 0, "RLS must deny the exact update to another user");
  assert.deepEqual(
    await withDbSystemContext((tx) => collectMediaDeleteState(tx, mediaId)),
    mediaDeleteBefore,
    "RLS-denied exact SQL replay must not mutate media or audit state",
  );
  const mediaDeleteExplain = await explainObservedStatement(
    withDbRequestContext,
    admin,
    mediaDeleteRollbackSql,
  );

  const mediaDeleteCapture = await captureDisposableReplayQueries(() =>
    deleteMediaForCurrentUser(admin, mediaId),
  );
  const deletedMedia = mediaDeleteCapture.result;
  assert.equal(deletedMedia.id, mediaId);
  assert.equal(deletedMedia.uploaderId, admin.dbUserId);
  assert.ok(deletedMedia.deletedAt instanceof Date);
  const mediaDeleteEvent = exactObservedTableStatement(
    mediaDeleteCapture.queries,
    "UPDATE",
    "MediaAsset",
  );
  const mediaDeleteSql = observedStatementEvidence(
    mediaDeleteEvent,
    "UPDATE",
    [
      { name: "deletedAt", positions: [1], expectedKinds: ["date"] },
      { name: "prisma.updatedAt", positions: [2], expectedKinds: ["date"] },
      { name: "media.id", positions: [3], expectedValues: [mediaId] },
    ],
  );
  assert.equal(
    mediaDeleteSql.normalizedSql,
    mediaDeleteRollbackSql.normalizedSql,
    "Rollback and service execution must use the same bounded tombstone SQL",
  );
  assertStatementTransactionOutcome(
    mediaDeleteCapture.queries,
    mediaDeleteEvent,
    "COMMIT",
  );
  const mediaDeleteAfter = await withDbSystemContext((tx) =>
    collectMediaDeleteState(tx, mediaId),
  );
  assert.equal(mediaDeleteAfter.activeCount, 0);
  assert.equal(mediaDeleteAfter.tombstoneCount, 1);
  assert.equal(mediaDeleteAfter.auditCount, 1);
  assert.equal(mediaDeleteAfter.feedPostMediaCount, 0);
  assert.equal(
    mediaDeleteAfter.media.deletedAt?.toISOString(),
    deletedMedia.deletedAt.toISOString(),
  );
  await expectExactOperationError(
    () => deleteMediaForCurrentUser(admin, mediaId),
    "media.not_found",
  );
  assert.deepEqual(
    await withDbSystemContext((tx) => collectMediaDeleteState(tx, mediaId)),
    mediaDeleteAfter,
    "Duplicate delete must retain one tombstone and one audit row",
  );

  const accountDeletionBefore = await withDbSystemContext((tx) =>
    collectAccountDeletionState(tx, pro.dbUserId),
  );
  const adminDeletionBefore = await withDbSystemContext((tx) =>
    collectAccountDeletionState(tx, admin.dbUserId),
  );
  assert.equal(accountDeletionBefore.user.email, pro.email);
  assert.equal(accountDeletionBefore.user.isBanned, false);
  assert.equal(accountDeletionBefore.user.deletionRequestedAt, null);
  assert.deepEqual(accountDeletionBefore.auditLogs, []);
  await expectExactOperationError(
    () => requestAccountDeletion(admin),
    "admin.last_admin_forbidden",
  );
  assert.deepEqual(
    await withDbSystemContext((tx) =>
      collectAccountDeletionState(tx, admin.dbUserId),
    ),
    adminDeletionBefore,
    "Last-admin denial must not mutate the account or audit scope",
  );
  const missingAccount = {
    ...free,
    dbUserId: "demo-user-missing-account-deletion-proof",
    profileId: "demo-profile-missing-account-deletion-proof",
  };
  await expectOperationFailure(
    () => requestAccountDeletion(missingAccount),
    "Missing current user account deletion",
  );
  assert.equal(
    await withDbSystemContext((tx) =>
      tx.auditLog.count({ where: accountDeletionAuditWhere(missingAccount.dbUserId) }),
    ),
    0,
  );

  const accountDeletionRollbackCapture = await captureDisposableReplayQueries(() =>
    expectExactOperationError(
      () =>
        withDbRequestContext(pro, async (tx) => {
          await tx.user.update({
            where: { id: pro.dbUserId },
            data: {
              email: ACCOUNT_DELETION_REQUEST_EMAIL,
              isBanned: true,
              deletionRequestedAt: ACCOUNT_DELETION_ROLLBACK_AT,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: pro.dbUserId,
              actorType: "user",
              action: "user.delete",
              targetType: "user",
              targetId: pro.dbUserId,
              ip: null,
              userAgent: null,
              metadata: accountDeletionAuditMetadata(
                ACCOUNT_DELETION_ROLLBACK_AT,
              ),
            },
          });
          throw new Error("demo_fixture.account_deletion_rollback");
        }),
      "demo_fixture.account_deletion_rollback",
    ),
  );
  const accountDeletionRollbackUpdateEvent = exactObservedTableStatement(
    accountDeletionRollbackCapture.queries,
    "UPDATE",
    "User",
  );
  const accountDeletionRollbackAuditEvent = exactObservedTableStatement(
    accountDeletionRollbackCapture.queries,
    "INSERT",
    "AuditLog",
  );
  const accountDeletionRollbackUpdateSql = observedStatementEvidence(
    accountDeletionRollbackUpdateEvent,
    "UPDATE",
    [
      {
        name: "deletionRequestEmail",
        positions: [1],
        expectedValues: [ACCOUNT_DELETION_REQUEST_EMAIL],
      },
      { name: "isBanned", positions: [2], expectedValues: [true] },
      {
        name: "deletionRequestedAt",
        positions: [3],
        expectedKinds: ["date"],
      },
      { name: "prisma.updatedAt", positions: [4], expectedKinds: ["date"] },
      { name: "current.dbUserId", positions: [5], expectedValues: [pro.dbUserId] },
    ],
  );
  const accountDeletionRollbackAuditSql = observedStatementEvidence(
    accountDeletionRollbackAuditEvent,
    "INSERT",
    accountDeletionAuditExpectedBinds(pro.dbUserId, ACCOUNT_DELETION_ROLLBACK_AT),
    accountDeletionAuditParameters(
      accountDeletionRollbackAuditEvent,
      pro.dbUserId,
      ACCOUNT_DELETION_ROLLBACK_AT,
    ),
  );
  assertStatementTransactionOutcome(
    accountDeletionRollbackCapture.queries,
    accountDeletionRollbackUpdateEvent,
    "ROLLBACK",
  );
  assertStatementTransactionOutcome(
    accountDeletionRollbackCapture.queries,
    accountDeletionRollbackAuditEvent,
    "ROLLBACK",
  );
  assert.deepEqual(
    await withDbSystemContext((tx) =>
      collectAccountDeletionState(tx, pro.dbUserId),
    ),
    accountDeletionBefore,
    "Forced rollback must preserve the active account and empty audit scope",
  );

  const otherUserUpdateRows = await withDbRequestContext(free, (tx) =>
    tx.$queryRawUnsafe<unknown[]>(
      accountDeletionRollbackUpdateSql.normalizedSql,
      ...accountDeletionRollbackUpdateSql.parameters,
    ),
  );
  assert.deepEqual(
    otherUserUpdateRows,
    [],
    "User RLS must hide an exact other-user account-deletion update",
  );
  const auditRlsFailure = await expectOperationFailure(
    () =>
      withDbRequestContext(free, (tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          accountDeletionRollbackAuditSql.normalizedSql,
          ...accountDeletionRollbackAuditSql.parameters,
        ),
      ),
    "Other-user exact AuditLog INSERT RETURNING",
  );
  assert.match(auditRlsFailure.message, /row-level security/i);
  assert.deepEqual(
    await withDbSystemContext((tx) =>
      collectAccountDeletionState(tx, pro.dbUserId),
    ),
    accountDeletionBefore,
    "RLS probes must roll back without changing account or audit state",
  );
  const accountDeletionUpdateExplain = await explainObservedStatement(
    withDbRequestContext,
    pro,
    accountDeletionRollbackUpdateSql,
  );
  const accountDeletionAuditExplain = await explainObservedStatement(
    withDbRequestContext,
    pro,
    accountDeletionRollbackAuditSql,
  );

  const accountDeletionCapture = await captureDisposableReplayQueries(() =>
    requestAccountDeletion(pro),
  );
  const accountDeletionRequestedAt = accountDeletionCapture.result;
  assert.ok(accountDeletionRequestedAt instanceof Date);
  const accountDeletionUpdateEvent = exactObservedTableStatement(
    accountDeletionCapture.queries,
    "UPDATE",
    "User",
  );
  const accountDeletionAuditEvent = exactObservedTableStatement(
    accountDeletionCapture.queries,
    "INSERT",
    "AuditLog",
  );
  const accountDeletionUpdateSql = observedStatementEvidence(
    accountDeletionUpdateEvent,
    "UPDATE",
    [
      {
        name: "deletionRequestEmail",
        positions: [1],
        expectedValues: [ACCOUNT_DELETION_REQUEST_EMAIL],
      },
      { name: "isBanned", positions: [2], expectedValues: [true] },
      {
        name: "deletionRequestedAt",
        positions: [3],
        expectedKinds: ["date"],
      },
      { name: "prisma.updatedAt", positions: [4], expectedKinds: ["date"] },
      { name: "current.dbUserId", positions: [5], expectedValues: [pro.dbUserId] },
    ],
  );
  const accountDeletionAuditSql = observedStatementEvidence(
    accountDeletionAuditEvent,
    "INSERT",
    accountDeletionAuditExpectedBinds(
      pro.dbUserId,
      accountDeletionRequestedAt,
    ),
    accountDeletionAuditParameters(
      accountDeletionAuditEvent,
      pro.dbUserId,
      accountDeletionRequestedAt,
    ),
  );
  assert.equal(
    accountDeletionUpdateSql.normalizedSql,
    accountDeletionRollbackUpdateSql.normalizedSql,
  );
  assert.equal(
    accountDeletionAuditSql.normalizedSql,
    accountDeletionRollbackAuditSql.normalizedSql,
  );
  assertMutationTransaction(
    accountDeletionCapture.queries,
    accountDeletionUpdateEvent,
    accountDeletionAuditEvent,
  );
  assertAdminAccessLockCaptured(accountDeletionCapture.queries);
  const accountDeletionAfter = await withDbSystemContext((tx) =>
    collectAccountDeletionState(tx, pro.dbUserId),
  );
  assert.equal(accountDeletionAfter.user.email, ACCOUNT_DELETION_REQUEST_EMAIL);
  assert.equal(accountDeletionAfter.user.isBanned, true);
  assert.equal(
    accountDeletionAfter.user.deletionRequestedAt?.toISOString(),
    accountDeletionRequestedAt.toISOString(),
  );
  assert.equal(accountDeletionAfter.auditLogs.length, 1);
  assert.equal(
    accountDeletionAfter.auditLogs[0].metadata,
    accountDeletionAuditMetadata(accountDeletionRequestedAt),
  );
  const repeatedDeletionRequestedAt = await requestAccountDeletion(pro);
  assert.ok(
    repeatedDeletionRequestedAt.getTime() >= accountDeletionRequestedAt.getTime(),
  );
  const accountDeletionRepeated = await withDbSystemContext((tx) =>
    collectAccountDeletionState(tx, pro.dbUserId),
  );
  assert.equal(accountDeletionRepeated.user.email, ACCOUNT_DELETION_REQUEST_EMAIL);
  assert.equal(accountDeletionRepeated.user.isBanned, true);
  assert.equal(accountDeletionRepeated.auditLogs.length, 2);
  assert.equal(
    accountDeletionRepeated.user.deletionRequestedAt?.toISOString(),
    repeatedDeletionRequestedAt.toISOString(),
  );

  const afterMutations = await withDbSystemContext(
    collectDatabaseOperationRowCounts,
  );
  assert.deepEqual(afterMutations, {
    User: 4,
    Conversation: 1,
    MediaAsset: 6,
    MediaDeleteAuditLog: 1,
    AccountDeletionAuditLog: 2,
    UserBlock: 0,
    ConversationBlockAuditLog: 3,
    SignupOutbox: 2,
  });

  return [
    authAcceptanceProof,
    {
      queryId: "DB.PULSE.CONVERSATION.ACCESS.SELECT",
      sourceFile: "src/lib/conversation-service.ts",
      sourceSymbol: "getConversationForProfile",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.Conversation,
      rowsAfter: afterReads.Conversation,
      rowCountDelta: afterReads.Conversation - before.Conversation,
      cases: {
        participant: "returned-one",
        nonParticipant: "conversation.not_found",
        missing: "conversation.not_found",
      },
      observedSql: conversationSql.evidence,
      explain: conversationExplain,
      variants: [],
      status: "verified",
    },
    {
      queryId: "DB.MEDIA.ASSET.STATUS.SELECT",
      sourceFile: "src/lib/media-service.ts",
      sourceSymbol: "getMediaStatusForCurrentUser",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.MediaAsset,
      rowsAfter: afterReads.MediaAsset,
      rowCountDelta: afterReads.MediaAsset - before.MediaAsset,
      cases: {
        owner: "returned-seven-field-projection",
        otherOwner: "media.not_found",
        missing: "media.not_found",
      },
      observedSql: mediaSql.evidence,
      explain: mediaExplain,
      variants: [],
      status: "verified",
    },
    {
      queryId: "DB.PULSE.CONVERSATION.BLOCK.UPDATE",
      sourceFile: "src/lib/conversation-service.ts",
      sourceSymbol: "setConversationBlock",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.Conversation,
      rowsAfter: afterMutations.Conversation,
      rowCountDelta: afterMutations.Conversation - before.Conversation,
      cases: {
        rollback: "conversation-and-user-block-rolled-back",
        stranger: "conversation.not_found",
        block: "blocked-by-participant",
        counterpartyUnblock: "auth.forbidden",
        duplicate: "conversation-updated-user-block-row-stable",
        unblock: "conversation-cleared-user-block-removed",
        blockAndUnblockSqlShape: "identical",
      },
      observedSql: blockUpdateSql.evidence,
      explain: blockUpdateExplain,
      variants: [],
      status: "verified",
    },
    {
      queryId: "DB.PULSE.USER_BLOCK.UPSERT",
      sourceFile: "src/lib/conversation-service.ts",
      sourceSymbol: "setConversationBlock",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.UserBlock,
      rowsAfter: afterMutations.UserBlock,
      rowCountDelta: afterMutations.UserBlock - before.UserBlock,
      cases: {
        rollback: "user-block-insert-rolled-back",
        firstBlock: "created-one",
        duplicateBlock: "same-row-retained",
        duplicateSqlPath: "unique-pair-read-no-second-mutation",
        counterpartyUnblock: "auth.forbidden",
        unblock: "deleted-to-zero",
      },
      observedSql: userBlockUpsertSql.evidence,
      explain: userBlockUpsertExplain,
      variants: [],
      status: "verified",
    },
    {
      queryId: "DB.AUTH.SIGNUP_OUTBOX.CLAIM",
      sourceFile: "src/lib/signup-acceptance-worker-store.ts",
      sourceSymbol: "signupAcceptanceWorkerStore.claimBatch",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.SignupOutbox,
      rowsAfter: afterMutations.SignupOutbox,
      rowCountDelta: afterMutations.SignupOutbox - before.SignupOutbox,
      cases: {
        locked: "skipped-locked-row",
        requestContext: "returned-zero-and-left-row-pending",
        rollback: "claim-rolled-back",
        eligible: "claimed-one",
        duplicate: "unexpired-processing-row-not-reclaimed",
      },
      observedSql: claimSql.evidence,
      explain: claimExplain,
      variants: [],
      status: "verified",
    },
    {
      queryId: "DB.AUTH.SIGNUP_OUTBOX.SETTLE",
      sourceFile: "src/lib/signup-acceptance-worker-store.ts",
      sourceSymbol: "signupAcceptanceWorkerStore.complete/fail",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.SignupOutbox,
      rowsAfter: afterMutations.SignupOutbox,
      rowCountDelta: afterMutations.SignupOutbox - before.SignupOutbox,
      cases: {
        staleLease: "returned-false-and-left-processing",
        requestContext: "all-variants-returned-zero",
        rollback: "all-variants-rolled-back",
        complete: "sent-once-then-false",
        retry: "retried-once-then-lease-lost",
        deadLetter: "dead-lettered-once-then-lease-lost",
        sqlVariants: "three-distinct-parameterized-statements",
      },
      observedSql: completeSql.evidence,
      explain: completeExplain,
      variants: [
        {
          variant: "complete",
          observedSql: completeSql.evidence,
          explain: completeExplain,
        },
        {
          variant: "retry",
          observedSql: retrySql.evidence,
          explain: retryExplain,
        },
        {
          variant: "dead-letter",
          observedSql: deadLetterSql.evidence,
          explain: deadLetterExplain,
        },
      ],
      status: "verified",
    },
    {
      queryId: "DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER",
      sourceFile: "src/lib/signup-acceptance-worker-store.ts",
      sourceSymbol: "signupAcceptanceWorkerStore.claimBatch",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.SignupOutbox,
      rowsAfter: afterMutations.SignupOutbox,
      rowCountDelta:
        afterMutations.SignupOutbox - before.SignupOutbox,
      cases: {
        bounded: "dead-lettered-one-with-limit-one",
        claimLock: "expired-row-progressed-while-claim-row-locked",
        requestContext: "returned-zero-and-left-row-pending",
        rollback: "dead-letter-rolled-back",
        duplicate: "already-dead-lettered-row-not-reprocessed",
      },
      observedSql: expiredDeadLetterSql.evidence,
      explain: expiredDeadLetterExplain,
      variants: [],
      status: "verified",
    },
    {
      queryId: "DB.MEDIA.ASSET.DELETE.TOMBSTONE",
      sourceFile: "src/lib/media-service.ts",
      sourceSymbol: "deleteMediaForCurrentUser",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.MediaAsset,
      rowsAfter: afterMutations.MediaAsset,
      rowCountDelta: afterMutations.MediaAsset - before.MediaAsset,
      cases: {
        owner: "tombstoned-one-and-audited-once",
        otherOwner: "media.not_found",
        missing: "media.not_found",
        rlsReplay: "exact-update-returned-zero",
        rollback: "tombstone-and-audit-unchanged",
        duplicate: "one-tombstone-one-audit-retained",
        feedPostResidual: "fixture-unlinked-not-proven",
        realtimeResidual: "disabled-no-event-path-proven",
        storageResidual: "loopback-best-effort-error-path-only",
      },
      observedSql: mediaDeleteSql.evidence,
      explain: mediaDeleteExplain,
      variants: [],
      status: "verified",
    },
    {
      queryId: "DB.ACCOUNT.DELETION.REQUEST.TRANSACTION",
      sourceFile: "src/lib/account-service.ts",
      sourceSymbol: "requestAccountDeletion",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.User,
      rowsAfter: afterMutations.User,
      rowCountDelta: afterMutations.User - before.User,
      cases: {
        owner: "updated-one-and-audited-once",
        lastAdmin: "admin.last_admin_forbidden",
        missing: "transaction-rejected-no-audit",
        otherUserRls: "exact-update-returned-zero",
        rollback: "user-and-audit-rolled-back",
        repeat: "second-request-updated-and-audited-once",
        advisoryLock: "captured-on-service-transaction",
        auditRls: "exact-insert-returning-rejected",
        auditPolicyResidual: "insert-with-check-true-remains",
      },
      observedSql: accountDeletionUpdateSql.evidence,
      explain: accountDeletionUpdateExplain,
      variants: [
        {
          variant: "user-update",
          observedSql: accountDeletionUpdateSql.evidence,
          explain: accountDeletionUpdateExplain,
        },
        {
          variant: "audit-insert",
          observedSql: accountDeletionAuditSql.evidence,
          explain: accountDeletionAuditExplain,
        },
      ],
      status: "verified",
    },
    dogOwnershipProof,
    stripeWebhookProof,
    trackDetailProof,
    ...userExportProofs,
  ] as const;
}

export async function setupAccountDeletionPendingProbe(tx: DbContextClient) {
  const [users, profiles] = await Promise.all([
    tx.user.count({ where: { id: ACCOUNT_DELETION_PENDING_PROBE_USER_ID } }),
    tx.profile.count({
      where: { id: ACCOUNT_DELETION_PENDING_PROBE_PROFILE_ID },
    }),
  ]);
  assert.deepEqual(
    { users, profiles },
    { users: 0, profiles: 0 },
    "account-deletion pending probe identifiers must be unused",
  );
  await tx.user.create({
    data: {
      id: ACCOUNT_DELETION_PENDING_PROBE_USER_ID,
      email: "account-deletion-pending-proof@greyhoundiq.test",
      name: "Account Deletion Pending Proof",
      subscriptionTier: "free",
      isBanned: true,
      deletionRequestedAt: ACCOUNT_DELETION_PENDING_REQUESTED_AT,
      createdAt: ACCOUNT_DELETION_PENDING_REQUESTED_AT,
      updatedAt: ACCOUNT_DELETION_PENDING_REQUESTED_AT,
      profile: {
        create: {
          id: ACCOUNT_DELETION_PENDING_PROBE_PROFILE_ID,
          displayName: "Account Deletion Pending Proof",
          role: "member",
          createdAt: ACCOUNT_DELETION_PENDING_REQUESTED_AT,
          updatedAt: ACCOUNT_DELETION_PENDING_REQUESTED_AT,
        },
      },
    },
  });
}

export async function cleanupAccountDeletionPendingProbe(
  tx: DbContextClient,
  requireComplete: boolean,
) {
  const profileCount = (
    await tx.profile.deleteMany({
      where: {
        id: ACCOUNT_DELETION_PENDING_PROBE_PROFILE_ID,
        userId: ACCOUNT_DELETION_PENDING_PROBE_USER_ID,
      },
    })
  ).count;
  const userCount = (
    await tx.user.deleteMany({
      where: {
        id: ACCOUNT_DELETION_PENDING_PROBE_USER_ID,
        email: "account-deletion-pending-proof@greyhoundiq.test",
      },
    })
  ).count;
  if (requireComplete) {
    assert.deepEqual({ profileCount, userCount }, { profileCount: 1, userCount: 1 });
  }
  return { profileCount, userCount };
}

export async function proveAccountDeletionPendingSelect(
  withDbSystemContext: TransactionRunner,
  withDbAnonymousContext: typeof import("../src/lib/db-context").withDbAnonymousContext,
  withDbRequestContext: typeof import("../src/lib/db-context").withDbRequestContext,
  captureDisposableReplayQueries: typeof import("../src/lib/db").captureDisposableReplayQueries,
  findPendingAccountDeletionUsers: typeof import("../src/lib/account-service").findPendingAccountDeletionUsers,
  otherUser: CurrentUserProfile,
  runtimeIdentity: {
    role: string;
    sessionRole: string;
    database: string;
    schema: string;
    canLogin: boolean;
    superuser: boolean;
    bypassRls: boolean;
  },
) {
  const before = await withDbSystemContext((tx) =>
    tx.user.count({ where: { id: ACCOUNT_DELETION_PENDING_PROBE_USER_ID } }),
  );
  assert.equal(before, 1);
  const indexRows = await withDbSystemContext((tx) =>
    tx.$queryRaw<Array<{ indexName: string; indexDefinition: string }>>`
      SELECT indexname AS "indexName", indexdef AS "indexDefinition"
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'User'
        AND indexname = 'User_isBanned_deletionRequestedAt_id_idx'
    `,
  );
  assert.equal(indexRows.length, 1);
  assert.match(
    indexRows[0]?.indexDefinition ?? "",
    /\("isBanned", "deletionRequestedAt", id\)/,
  );

  const capture = await captureDisposableReplayQueries(() =>
    findPendingAccountDeletionUsers(ACCOUNT_DELETION_PENDING_CUTOFF),
  );
  assert.equal(capture.result.length, 1);
  assert.deepEqual(capture.result[0], {
    id: ACCOUNT_DELETION_PENDING_PROBE_USER_ID,
    email: "account-deletion-pending-proof@greyhoundiq.test",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    workosUserId: null,
    deletionRequestedAt: ACCOUNT_DELETION_PENDING_REQUESTED_AT,
    profile: { id: ACCOUNT_DELETION_PENDING_PROBE_PROFILE_ID },
  });
  assertSystemContextCaptured(capture.queries);
  assert.equal(
    capture.queries.filter((event) =>
      /^SELECT\b/i.test(normalizeObservedSql(event.query)) &&
      normalizeObservedSql(event.query).includes('FROM "public".'),
    ).length,
    2,
  );
  const userSql = observedStatementEvidence(
    exactObservedTableSelect(capture.queries, "User"),
    "SELECT",
    [
      { name: "candidate.isBanned", positions: [1], expectedValues: [true] },
      { name: "candidate.cutoff", positions: [2], expectedKinds: ["date"] },
      { name: "candidate.limit", positions: [3], expectedValues: [25] },
      { name: "prisma.skip", positions: [4], expectedValues: [0] },
    ],
  );
  assert.equal(
    (userSql.parameters[1] as Date).toISOString(),
    ACCOUNT_DELETION_PENDING_CUTOFF.toISOString(),
  );
  const profileSql = observedStatementEvidence(
    exactObservedTableSelect(capture.queries, "Profile"),
    "SELECT",
    [
      {
        name: "candidate.userId",
        positions: [1],
        expectedValues: [ACCOUNT_DELETION_PENDING_PROBE_USER_ID],
      },
      { name: "prisma.skip", positions: [2], expectedValues: [0] },
    ],
  );
  const [userExplain, profileExplain] = await Promise.all([
    explainObservedSystemStatement(withDbSystemContext, userSql),
    explainObservedSystemStatement(withDbSystemContext, profileSql),
  ]);
  const statements = [userSql, profileSql];
  const systemRows = await Promise.all(
    statements.map((statement) =>
      withDbSystemContext((tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          statement.normalizedSql,
          ...statement.parameters,
        ),
      ),
    ),
  );
  assert.deepEqual(systemRows.map((rows) => rows.length), [1, 1]);
  const anonymousRows = await Promise.all(
    statements.map((statement) =>
      withDbAnonymousContext((tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          statement.normalizedSql,
          ...statement.parameters,
        ),
      ),
    ),
  );
  assert.deepEqual(anonymousRows.map((rows) => rows.length), [0, 1]);
  const otherUserRows = await Promise.all(
    statements.map((statement) =>
      withDbRequestContext(otherUser, (tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          statement.normalizedSql,
          ...statement.parameters,
        ),
      ),
    ),
  );
  assert.deepEqual(otherUserRows.map((rows) => rows.length), [0, 1]);

  const emptyCapture = await captureDisposableReplayQueries(() =>
    findPendingAccountDeletionUsers(ACCOUNT_DELETION_PENDING_EMPTY_CUTOFF),
  );
  assert.deepEqual(emptyCapture.result, []);
  assertSystemContextCaptured(emptyCapture.queries);
  assert.equal(
    emptyCapture.queries.filter((event) =>
      /^SELECT\b/i.test(normalizeObservedSql(event.query)) &&
      normalizeObservedSql(event.query).includes('FROM "public".'),
    ).length,
    1,
  );
  const emptySql = observedStatementEvidence(
    exactObservedTableSelect(emptyCapture.queries, "User"),
    "SELECT",
    [
      { name: "candidate.isBanned", positions: [1], expectedValues: [true] },
      { name: "candidate.cutoff", positions: [2], expectedKinds: ["date"] },
      { name: "candidate.limit", positions: [3], expectedValues: [25] },
      { name: "prisma.skip", positions: [4], expectedValues: [0] },
    ],
  );
  assert.equal(emptySql.normalizedSql, userSql.normalizedSql);
  assert.equal(
    (emptySql.parameters[1] as Date).toISOString(),
    ACCOUNT_DELETION_PENDING_EMPTY_CUTOFF.toISOString(),
  );
  const after = await withDbSystemContext((tx) =>
    tx.user.count({ where: { id: ACCOUNT_DELETION_PENDING_PROBE_USER_ID } }),
  );
  assert.equal(after, 1);

  return {
    queryId: "DB.ACCOUNT.DELETION.PENDING.SELECT",
    sourceFile: "src/lib/account-service.ts",
    sourceSymbol: "findPendingAccountDeletionUsers",
    runtimeIdentity: { ...runtimeIdentity },
    expectedMaximumRows: 25,
    rowsBefore: before,
    rowsAfter: after,
    rowCountDelta: 0,
    cases: {
      systemContext: "returned-one-expired-banned-candidate",
      projection: "explicit-user-provider-references-and-profile-id-only",
      anonymousRlsReplay: "user-zero-public-profile-id-one-given-user-id",
      otherUserRlsReplay: "user-zero-public-profile-id-one-given-user-id",
      systemRlsReplay: "both-exact-selects-returned-one",
      empty: "returned-zero-after-one-bounded-user-select",
      index: "exact-three-column-index-present",
      maximum: "twenty-five-candidates",
      mutation: "none",
      concurrencyResidual: "candidate-lease-remains-finalization-gate",
      deployedParityResidual: "local-disposable-runtime-only",
    },
    observedSql: userSql.evidence,
    explain: userExplain,
    variants: [
      { variant: "users", observedSql: userSql.evidence, explain: userExplain },
      {
        variant: "profiles",
        observedSql: profileSql.evidence,
        explain: profileExplain,
      },
    ],
    status: "verified",
  } as const;
}

async function provePublicTrackDetail(
  withDbAnonymousContext: typeof import("../src/lib/db-context").withDbAnonymousContext,
  captureDisposableReplayQueries: typeof import("../src/lib/db").captureDisposableReplayQueries,
  getTrackById: typeof import("../src/lib/queries").getTrackById,
  runtimeIdentity: {
    role: string;
    sessionRole: string;
    database: string;
    schema: string;
    canLogin: boolean;
    superuser: boolean;
    bypassRls: boolean;
  },
) {
  const { dogId, raceId, trackId } = DEMO_FIXTURE_MANIFEST.providerSamples;
  const probe = PUBLIC_RACING_DETAIL_PROBE;
  const capture = await captureDisposableReplayQueries(() => getTrackById(trackId));
  const track = capture.result;
  assert.ok(track, "public track detail proof must return its exact fixture track");
  assert.equal(track.id, trackId);
  assert.equal(track.meetings.length, 1);
  assert.equal(track.meetings[0]?.id, PROVIDER_MEETING_ID);
  assert.deepEqual(
    track.meetings[0]?.races.map((race) => race.id),
    [raceId, probe.previousRaceId],
  );
  assert.deepEqual(
    track.meetings[0]?.races.map((race) => race.runners.length),
    [1, 1],
  );
  assert.ok(
    track.meetings[0]?.races.every(
      (race) => race.runners[0]?.dog.id === dogId && race.runners[0]?.result,
    ),
  );
  assert.equal(capture.queries.length, 6);

  const trackSql = observedSelectEvidence(
    exactObservedTableSelect(capture.queries, "Track"),
    [
      { name: "route.trackId", value: trackId, occurrences: 1 },
      { name: "prisma.take", value: 1, occurrences: 1 },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  const meetingSql = observedSelectEvidence(
    exactObservedTableSelect(capture.queries, "Meeting"),
    [
      { name: "route.trackId", value: trackId, occurrences: 1 },
      { name: "meeting.limit", value: 8, occurrences: 1 },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  const raceSql = observedSelectEvidence(
    exactObservedTableSelect(capture.queries, "Race"),
    [
      { name: "meeting.id", value: PROVIDER_MEETING_ID, occurrences: 1 },
      { name: "race.queryLimit", value: 128, occurrences: 1 },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  const runnerSql = observedSelectEvidence(
    exactObservedTableSelect(capture.queries, "Runner"),
    [
      { name: "loaded.raceIds", value: raceId, occurrences: 2 },
      {
        name: "loaded.raceIds",
        value: probe.previousRaceId,
        occurrences: 2,
      },
      { name: "runner.queryLimit", value: 1_536, occurrences: 1 },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  const dogSql = observedSelectEvidence(
    exactObservedTableSelect(capture.queries, "Dog"),
    [
      { name: "loaded.dogIds", value: dogId, occurrences: 1 },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  const resultSql = observedSelectEvidence(
    exactObservedTableSelect(capture.queries, "Result"),
    [
      {
        name: "loaded.runnerIds",
        value: probe.previousRunnerId,
        occurrences: 2,
      },
      {
        name: "loaded.runnerIds",
        value: probe.currentRunnerId,
        occurrences: 2,
      },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  const statements = [trackSql, meetingSql, raceSql, runnerSql, dogSql, resultSql];
  const [
    trackExplain,
    meetingExplain,
    raceExplain,
    runnerExplain,
    dogExplain,
    resultExplain,
  ] = await Promise.all(
    statements.map((statement) =>
      explainObservedWithRunner(withDbAnonymousContext, statement),
    ),
  );
  const anonymousRows = await Promise.all(
    statements.map((statement) =>
      withDbAnonymousContext((tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          statement.normalizedSql,
          ...statement.parameters,
        ),
      ),
    ),
  );
  assert.deepEqual(
    anonymousRows.map((rows) => rows.length),
    [1, 1, 2, 2, 1, 2],
    "anonymous exact SQL replay must expose only the bounded public racing graph",
  );

  const missingCapture = await captureDisposableReplayQueries(() =>
    getTrackById("fixture-provider-track-missing-route-audit"),
  );
  assert.equal(missingCapture.result, null);
  assert.equal(missingCapture.queries.length, 1);
  assert.equal(
    normalizeObservedSql(missingCapture.queries[0]?.query ?? ""),
    trackSql.normalizedSql,
  );

  return {
    queryId: "DB.RACING.TRACK.OPEN.DETAIL_BUNDLE",
    sourceFile: "src/lib/queries.ts",
    sourceSymbol: "getTrackById",
    runtimeIdentity: { ...runtimeIdentity },
    expectedMaximumRows: 1_536,
    rowsBefore: 1,
    rowsAfter: 1,
    rowCountDelta: 0,
    cases: {
      public: "returned-complete-track-meeting-race-runner-dog-result-graph",
      anonymousRlsReplay: "all-six-exact-selects-returned-reviewed-public-rows",
      missing: "returned-null-after-one-bounded-track-select",
      topLevel: "one-track",
      meetings: "maximum-eight",
      raceQuery: "maximum-128-with-sixteen-returned-per-meeting",
      runnerQuery: "maximum-1536-with-twelve-returned-per-race",
      populatedBranches: "dog-and-result-relations-observed",
      mutation: "none",
      deployedParityResidual: "local-disposable-runtime-only",
    },
    observedSql: trackSql.evidence,
    explain: trackExplain,
    variants: [
      { variant: "track", observedSql: trackSql.evidence, explain: trackExplain },
      {
        variant: "meetings",
        observedSql: meetingSql.evidence,
        explain: meetingExplain,
      },
      { variant: "races", observedSql: raceSql.evidence, explain: raceExplain },
      {
        variant: "runners",
        observedSql: runnerSql.evidence,
        explain: runnerExplain,
      },
      { variant: "dogs", observedSql: dogSql.evidence, explain: dogExplain },
      {
        variant: "results",
        observedSql: resultSql.evidence,
        explain: resultExplain,
      },
    ],
    status: "verified",
  } as const;
}

async function proveUserExportWrites(
  withDbSystemContext: TransactionRunner,
  withDbAnonymousContext: typeof import("../src/lib/db-context").withDbAnonymousContext,
  withDbRequestContext: typeof import("../src/lib/db-context").withDbRequestContext,
  captureDisposableReplayQueries: typeof import("../src/lib/db").captureDisposableReplayQueries,
  recordUserExportCompletion: typeof import("../src/lib/account-service").recordUserExportCompletion,
  owner: CurrentUserProfile,
  otherUser: CurrentUserProfile,
  runtimeIdentity: {
    role: string;
    sessionRole: string;
    database: string;
    schema: string;
    canLogin: boolean;
    superuser: boolean;
    bypassRls: boolean;
  },
) {
  const before = await withDbSystemContext((tx) =>
    collectUserExportWriteState(tx, owner.dbUserId, false),
  );
  assert.deepEqual(before, { auditLogs: [], artifacts: [], rateLimit: null });
  const completionInput = {
    exportedAt: USER_EXPORT_OPERATION_AT,
    sizeBytes: USER_EXPORT_OPERATION_SIZE_BYTES,
    schemaVersion: "greyhoundiq-user-export/v2" as const,
    ip: null,
    userAgent: USER_EXPORT_OPERATION_USER_AGENT,
    counts: USER_EXPORT_OPERATION_COUNTS,
  };
  const createCapture = await captureDisposableReplayQueries(() =>
    recordUserExportCompletion(owner, completionInput),
  );
  assert.equal(createCapture.result.targetUserId, owner.dbUserId);
  assert.equal(createCapture.result.requestedByUserId, owner.dbUserId);
  const auditEvent = exactObservedTableStatement(
    createCapture.queries,
    "INSERT",
    "AuditLog",
  );
  const artifactEvent = exactObservedTableStatement(
    createCapture.queries,
    "INSERT",
    "ExportArtifact",
  );
  assertStatementsShareTransaction(
    createCapture.queries,
    [auditEvent, artifactEvent],
    "COMMIT",
  );
  const metadata = JSON.stringify(
    userExportAuditMetadata(
      USER_EXPORT_OPERATION_SIZE_BYTES,
      USER_EXPORT_OPERATION_COUNTS,
    ),
  );
  const auditSql = observedStatementEvidence(
    auditEvent,
    "INSERT",
    userExportAuditExpectedBinds(owner.dbUserId, metadata),
    userExportAuditParameters(auditEvent, owner.dbUserId, metadata),
  );
  const artifactSql = observedStatementEvidence(
    artifactEvent,
    "INSERT",
    userExportArtifactExpectedBinds(owner.dbUserId),
  );
  const auditExplain = await explainObservedStatement(
    withDbRequestContext,
    owner,
    auditSql,
  );
  const artifactExplain = await explainObservedStatement(
    withDbRequestContext,
    owner,
    artifactSql,
  );

  const first = await withDbSystemContext((tx) =>
    collectUserExportWriteState(tx, owner.dbUserId, false),
  );
  assert.equal(first.auditLogs.length, 1);
  assert.equal(first.artifacts.length, 1);
  assert.deepEqual(
    JSON.parse(first.auditLogs[0]?.metadata ?? "null"),
    userExportAuditMetadata(
      USER_EXPORT_OPERATION_SIZE_BYTES,
      USER_EXPORT_OPERATION_COUNTS,
    ),
  );
  assert.equal(first.auditLogs[0]?.userAgent, USER_EXPORT_OPERATION_USER_AGENT);
  assertUserExportArtifact(
    first.artifacts[0],
    owner.dbUserId,
    USER_EXPORT_OPERATION_SIZE_BYTES,
    USER_EXPORT_OPERATION_AT,
  );

  const auditOtherUserFailure = await expectOperationFailure(
    () =>
      withDbRequestContext(otherUser, (tx) =>
        tx.$executeRawUnsafe(auditSql.normalizedSql, ...auditSql.parameters),
      ),
    "Other-user exact user-export AuditLog INSERT",
  );
  assert.match(auditOtherUserFailure.message, /row-level security/i);
  const auditAnonymousFailure = await expectOperationFailure(
    () =>
      withDbAnonymousContext((tx) =>
        tx.$executeRawUnsafe(auditSql.normalizedSql, ...auditSql.parameters),
      ),
    "Anonymous exact user-export AuditLog INSERT",
  );
  assert.match(auditAnonymousFailure.message, /row-level security/i);
  await expectExactOperationError(
    () =>
      withDbRequestContext(owner, async (tx) => {
        assert.equal(
          await tx.$executeRawUnsafe(
            auditSql.normalizedSql,
            ...auditSql.parameters,
          ),
          1,
        );
        throw new Error("demo_fixture.user_export_audit_replay_rollback");
      }),
    "demo_fixture.user_export_audit_replay_rollback",
  );

  const artifactReplayParameters = [...artifactSql.parameters];
  artifactReplayParameters[0] = USER_EXPORT_ARTIFACT_REPLAY_ID;
  const artifactOtherUserFailure = await expectOperationFailure(
    () =>
      withDbRequestContext(otherUser, (tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          artifactSql.normalizedSql,
          ...artifactReplayParameters,
        ),
      ),
    "Other-user exact user-export artifact INSERT",
  );
  assert.match(artifactOtherUserFailure.message, /row-level security/i);
  const artifactAnonymousFailure = await expectOperationFailure(
    () =>
      withDbAnonymousContext((tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          artifactSql.normalizedSql,
          ...artifactReplayParameters,
        ),
      ),
    "Anonymous exact user-export artifact INSERT",
  );
  assert.match(artifactAnonymousFailure.message, /row-level security/i);
  await expectExactOperationError(
    () =>
      withDbRequestContext(owner, async (tx) => {
        const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          artifactSql.normalizedSql,
          ...artifactReplayParameters,
        );
        assert.equal(rows.length, 1);
        assert.equal(rows[0]?.id, USER_EXPORT_ARTIFACT_REPLAY_ID);
        throw new Error("demo_fixture.user_export_artifact_replay_rollback");
      }),
    "demo_fixture.user_export_artifact_replay_rollback",
  );

  const malformedArtifactFailure = await expectOperationFailure(
    () =>
      withDbRequestContext(owner, (tx) =>
        tx.exportArtifact.create({
          data: {
            exportType: "user_data",
            status: "completed",
            targetUserId: owner.dbUserId,
            requestedByUserId: owner.dbUserId,
            storageBucket: "private-user-media",
            storagePath: `users/${owner.dbUserId}/forbidden-export.json`,
            sizeBytes: USER_EXPORT_OPERATION_SIZE_BYTES,
            completedAt: USER_EXPORT_OPERATION_AT,
            expiresAt: new Date(
              USER_EXPORT_OPERATION_AT.getTime() + 7 * 24 * 60 * 60 * 1000,
            ),
          },
        }),
      ),
    "Owner artifact with storage fields",
  );
  assert.match(malformedArtifactFailure.message, /row-level security/i);
  assert.equal(
    (
      await withDbRequestContext(owner, (tx) =>
        tx.exportArtifact.updateMany({
          where: { id: createCapture.result.id },
          data: { status: "expired" },
        }),
      )
    ).count,
    0,
  );
  assert.equal(
    (
      await withDbRequestContext(owner, (tx) =>
        tx.exportArtifact.deleteMany({
          where: { id: createCapture.result.id },
        }),
      )
    ).count,
    0,
  );

  const rollbackCapture = await captureDisposableReplayQueries(() =>
    expectOperationFailure(
      () =>
        recordUserExportCompletion(owner, {
          ...completionInput,
          exportedAt: USER_EXPORT_ROLLBACK_AT,
          sizeBytes: -1,
        }),
      "Invalid user-export completion",
    ),
  );
  assert.match(rollbackCapture.result.message, /row-level security/i);
  const rollbackAuditEvent = exactObservedTableStatement(
    rollbackCapture.queries,
    "INSERT",
    "AuditLog",
  );
  const rollbackArtifactEvent = exactObservedTableStatement(
    rollbackCapture.queries,
    "INSERT",
    "ExportArtifact",
  );
  assertStatementsShareTransaction(
    rollbackCapture.queries,
    [rollbackAuditEvent, rollbackArtifactEvent],
    "ROLLBACK",
  );
  assert.deepEqual(
    await withDbSystemContext((tx) =>
      collectUserExportWriteState(tx, owner.dbUserId, false),
    ),
    first,
    "A rejected artifact must roll back its paired audit row",
  );

  const repeatCapture = await captureDisposableReplayQueries(() =>
    recordUserExportCompletion(owner, completionInput),
  );
  const repeatAuditEvent = exactObservedTableStatement(
    repeatCapture.queries,
    "INSERT",
    "AuditLog",
  );
  const repeatArtifactEvent = exactObservedTableStatement(
    repeatCapture.queries,
    "INSERT",
    "ExportArtifact",
  );
  assertStatementsShareTransaction(
    repeatCapture.queries,
    [repeatAuditEvent, repeatArtifactEvent],
    "COMMIT",
  );
  assert.equal(normalizeObservedSql(repeatAuditEvent.query), auditSql.normalizedSql);
  assert.equal(
    normalizeObservedSql(repeatArtifactEvent.query),
    artifactSql.normalizedSql,
  );
  const after = await withDbSystemContext((tx) =>
    collectUserExportWriteState(tx, owner.dbUserId, false),
  );
  assert.equal(after.auditLogs.length, 2);
  assert.equal(after.artifacts.length, 2);
  assert.equal(
    await withDbRequestContext(otherUser, (tx) =>
      tx.auditLog.count({ where: userExportAuditWhere(owner.dbUserId) }),
    ),
    0,
  );
  assert.equal(
    await withDbRequestContext(otherUser, (tx) =>
      tx.exportArtifact.count({
        where: userExportArtifactWhere(owner.dbUserId),
      }),
    ),
    0,
  );
  assert.equal(
    await withDbAnonymousContext((tx) =>
      tx.exportArtifact.count({
        where: userExportArtifactWhere(owner.dbUserId),
      }),
    ),
    0,
  );

  const commonCases = {
    routeBinding: "source-bound-post-delegates-to-atomic-service",
    owner: "created-one-under-member-request-context",
    otherUserRlsReplay: "exact-insert-rejected",
    anonymousRlsReplay: "exact-insert-rejected",
    ownerRlsReplay: "exact-insert-allowed-then-rolled-back",
    atomicRollback: "artifact-rejection-rolled-back-audit",
    repeat: "second-pair-created-with-same-bounded-sql-shape",
    deployedParityResidual: "local-disposable-runtime-only",
  } as const;
  return [
    {
      queryId: "DB.ACCOUNT.DATA_EXPORT.AUDIT.INSERT",
      sourceFile: "src/lib/account-service.ts",
      sourceSymbol: "recordUserExportCompletion",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.auditLogs.length,
      rowsAfter: after.auditLogs.length,
      rowCountDelta: after.auditLogs.length - before.auditLogs.length,
      cases: {
        ...commonCases,
        metadata: "size-schema-counts-only-no-export-body",
        visibility: "actor-only-for-members",
      },
      observedSql: auditSql.evidence,
      explain: auditExplain,
      variants: [],
      status: "verified",
    },
    {
      queryId: "DB.ACCOUNT.DATA_EXPORT.ARTIFACT.INSERT",
      sourceFile: "src/lib/account-service.ts",
      sourceSymbol: "recordUserExportCompletion",
      runtimeIdentity: { ...runtimeIdentity },
      expectedMaximumRows: 1,
      rowsBefore: before.artifacts.length,
      rowsAfter: after.artifacts.length,
      rowCountDelta: after.artifacts.length - before.artifacts.length,
      cases: {
        ...commonCases,
        shapePolicy: "storage-and-organization-fields-rejected",
        ownerMutation: "update-and-delete-returned-zero",
        expiry: "exactly-seven-days-after-completion",
        visibility: "target-or-requester-only-for-members",
      },
      observedSql: artifactSql.evidence,
      explain: artifactExplain,
      variants: [],
      status: "verified",
    },
  ] as const;
}

type UserExportArtifactProbe = {
  id: string;
  exportType: string;
  status: string;
  targetUserId: string | null;
  organizationId: string | null;
  requestedByUserId: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  sha256: string | null;
  sizeBytes: number | null;
  completedAt: Date | null;
  expiresAt: Date | null;
};

function userExportAuditMetadata(
  sizeBytes: number,
  counts: typeof USER_EXPORT_OPERATION_COUNTS,
) {
  return {
    format: "json",
    schemaVersion: "greyhoundiq-user-export/v2",
    sizeBytes,
    counts,
  };
}

function userExportAuditExpectedBinds(
  userId: string,
  metadata: string,
): ExpectedPositionedBind[] {
  return [
    { name: "current.dbUserId.actor", positions: [1], expectedValues: [userId] },
    {
      name: "actorType",
      positions: [2],
      expectedValues: ["user"],
      allowSqlTextMatch: true,
    },
    { name: "action", positions: [3], expectedValues: ["user.export"] },
    {
      name: "targetType",
      positions: [4],
      expectedValues: ["user"],
      allowSqlTextMatch: true,
    },
    { name: "current.dbUserId.target", positions: [5], expectedValues: [userId] },
    { name: "request.ip", positions: [6], expectedValues: [null] },
    {
      name: "request.userAgent",
      positions: [7],
      expectedValues: [USER_EXPORT_OPERATION_USER_AGENT],
    },
    { name: "audit.metadata", positions: [8], expectedValues: [metadata] },
    { name: "prisma.createdAt", positions: [9], expectedKinds: ["date"] },
  ];
}

function userExportAuditParameters(
  event: DisposableReplayQueryEvent,
  userId: string,
  metadata: string,
) {
  const firstSeven = [
    userId,
    "user",
    "user.export",
    "user",
    userId,
    null,
    USER_EXPORT_OPERATION_USER_AGENT,
  ];
  const prefix = `${JSON.stringify(firstSeven).slice(0, -1)},"${metadata}",`;
  assert.ok(
    event.params.startsWith(prefix) && event.params.endsWith("]"),
    "Observed user-export AuditLog parameters must match the reviewed synthetic prefix",
  );
  const createdAt = JSON.parse(event.params.slice(prefix.length, -1)) as unknown;
  assert.ok(
    typeof createdAt === "string" && Number.isFinite(new Date(createdAt).getTime()),
    "Observed user-export AuditLog createdAt must be a date string",
  );
  return [...firstSeven, metadata, createdAt];
}

function userExportArtifactExpectedBinds(
  userId: string,
): ExpectedPositionedBind[] {
  return [
    { name: "exportArtifact.id", positions: [1], expectedKinds: ["cuid"] },
    { name: "exportType", positions: [2], expectedValues: ["user_data"] },
    {
      name: "status",
      positions: [3],
      expectedValues: ["completed"],
      allowSqlTextMatch: true,
    },
    { name: "current.dbUserId.target", positions: [4], expectedValues: [userId] },
    {
      name: "current.dbUserId.requester",
      positions: [5],
      expectedValues: [userId],
    },
    {
      name: "sizeBytes",
      positions: [6],
      expectedValues: [USER_EXPORT_OPERATION_SIZE_BYTES],
    },
    { name: "exportedAt", positions: [7], expectedKinds: ["date"] },
    { name: "expiresAt", positions: [8], expectedKinds: ["date"] },
    {
      name: "prisma.timestamps",
      positions: [9, 10],
      expectedKinds: ["date", "date"],
    },
  ];
}

function userExportAuditWhere(userId: string) {
  return {
    actorId: userId,
    actorType: "user",
    action: "user.export",
    targetType: "user",
    targetId: userId,
  };
}

function userExportArtifactWhere(userId: string) {
  return {
    exportType: "user_data",
    targetUserId: userId,
    requestedByUserId: userId,
  };
}

async function collectUserExportWriteState(
  tx: DbContextClient,
  userId: string,
  includeRateLimit: boolean,
) {
  const [auditLogs, artifacts, rateLimit] = await Promise.all([
    tx.auditLog.findMany({
      where: userExportAuditWhere(userId),
      orderBy: { id: "asc" },
      select: {
        ip: true,
        userAgent: true,
        metadata: true,
      },
    }),
    tx.exportArtifact.findMany({
      where: userExportArtifactWhere(userId),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        exportType: true,
        status: true,
        targetUserId: true,
        organizationId: true,
        requestedByUserId: true,
        storageBucket: true,
        storagePath: true,
        sha256: true,
        sizeBytes: true,
        completedAt: true,
        expiresAt: true,
      },
    }),
    includeRateLimit
      ? tx.rateLimit.findUnique({
          where: { key: `user-export:${userId}` },
          select: { count: true },
        })
      : Promise.resolve(null),
  ]);
  return { auditLogs, artifacts, rateLimit };
}

function assertUserExportArtifact(
  artifact: UserExportArtifactProbe | undefined,
  userId: string,
  sizeBytes: number,
  exportedAt: Date,
) {
  assert.ok(artifact, "Expected one user-export artifact");
  assert.equal(artifact.exportType, "user_data");
  assert.equal(artifact.status, "completed");
  assert.equal(artifact.targetUserId, userId);
  assert.equal(artifact.requestedByUserId, userId);
  assert.equal(artifact.organizationId, null);
  assert.equal(artifact.storageBucket, null);
  assert.equal(artifact.storagePath, null);
  assert.equal(artifact.sha256, null);
  assert.equal(artifact.sizeBytes, sizeBytes);
  assert.equal(artifact.completedAt?.toISOString(), exportedAt.toISOString());
  assert.equal(
    artifact.expiresAt?.getTime(),
    exportedAt.getTime() + 7 * 24 * 60 * 60 * 1000,
  );
}

function assertStatementsShareTransaction(
  queries: readonly DisposableReplayQueryEvent[],
  statements: readonly DisposableReplayQueryEvent[],
  expectedOutcome: "COMMIT" | "ROLLBACK",
) {
  const statementIndexes = statements.map((statement) => queries.indexOf(statement));
  assert.ok(statementIndexes.every((index) => index >= 0));
  const firstStatementIndex = Math.min(...statementIndexes);
  const lastStatementIndex = Math.max(...statementIndexes);
  const beginIndex = queries.findLastIndex(
    (event, index) =>
      index < firstStatementIndex && /^BEGIN\b/i.test(normalizeObservedSql(event.query)),
  );
  assert.ok(beginIndex >= 0, "Observed export writes must follow BEGIN");
  const interveningTerminator = queries
    .slice(beginIndex + 1, lastStatementIndex)
    .find((event) => /^(?:COMMIT|ROLLBACK)\b/i.test(normalizeObservedSql(event.query)));
  assert.equal(
    interveningTerminator,
    undefined,
    "Observed export writes must share one transaction",
  );
  const terminator = queries
    .slice(lastStatementIndex + 1)
    .find((event) => /^(?:COMMIT|ROLLBACK)\b/i.test(normalizeObservedSql(event.query)));
  assert.ok(terminator, "Observed export transaction must terminate");
  assert.equal(normalizeObservedSql(terminator.query), expectedOutcome);
}

async function proveDogOwnershipSelect(
  withDbSystemContext: TransactionRunner,
  withDbAnonymousContext: typeof import("../src/lib/db-context").withDbAnonymousContext,
  withDbRequestContext: typeof import("../src/lib/db-context").withDbRequestContext,
  captureDisposableReplayQueries: typeof import("../src/lib/db").captureDisposableReplayQueries,
  getMyDogOwnership: typeof import("../src/lib/queries").getMyDogOwnership,
  claimant: CurrentUserProfile,
  otherProfile: CurrentUserProfile,
  dogId: string,
  runtimeIdentity: {
    role: string;
    sessionRole: string;
    database: string;
    schema: string;
    canLogin: boolean;
    superuser: boolean;
    bypassRls: boolean;
  },
) {
  const rowsBefore = await withDbSystemContext((tx) =>
    tx.dogOwnership.count({
      where: { id: DOG_OWNERSHIP_OPERATION_PROBE_ID },
    }),
  );
  assert.equal(rowsBefore, 1);

  const claimantCapture = await captureDisposableReplayQueries(() =>
    getMyDogOwnership(claimant, dogId),
  );
  assert.deepEqual(claimantCapture.result, {
    id: DOG_OWNERSHIP_OPERATION_PROBE_ID,
    role: "owner",
    status: "rejected",
    rejectionReason: DOG_OWNERSHIP_OPERATION_REJECTION_REASON,
  });
  const ownershipSql = observedSelectEvidence(
    exactObservedTableSelect(claimantCapture.queries, "DogOwnership"),
    [
      { name: "route.dogId", value: dogId, occurrences: 1 },
      {
        name: "current.profileId",
        value: claimant.profileId,
        occurrences: 1,
      },
      { name: "prisma.take", value: 1, occurrences: 1 },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  const ownershipExplain = await explainObservedStatement(
    withDbRequestContext,
    claimant,
    ownershipSql,
  );

  const repeatCapture = await captureDisposableReplayQueries(() =>
    getMyDogOwnership(claimant, dogId),
  );
  assert.deepEqual(repeatCapture.result, claimantCapture.result);
  assert.equal(
    normalizeObservedSql(
      exactObservedTableSelect(repeatCapture.queries, "DogOwnership").query,
    ),
    ownershipSql.normalizedSql,
    "Repeated claimant ownership reads must retain one parameterized SQL shape",
  );
  assert.equal(await getMyDogOwnership(otherProfile, dogId), null);
  assert.equal(
    await getMyDogOwnership(
      claimant,
      "demo-dog-ownership-missing-operation-proof",
    ),
    null,
  );

  const crossProfileRows = await withDbRequestContext(
    otherProfile,
    (tx) =>
      tx.$queryRawUnsafe<unknown[]>(
        ownershipSql.normalizedSql,
        ...ownershipSql.parameters,
      ),
  );
  assert.deepEqual(
    crossProfileRows,
    [],
    "Cross-profile exact SQL replay must not reveal a rejected claim",
  );
  const anonymousRows = await withDbAnonymousContext((tx) =>
    tx.$queryRawUnsafe<unknown[]>(
      ownershipSql.normalizedSql,
      ...ownershipSql.parameters,
    ),
  );
  assert.deepEqual(
    anonymousRows,
    [],
    "Anonymous exact SQL replay must not reveal a rejected claim",
  );
  const systemRows = await withDbSystemContext((tx) =>
    tx.$queryRawUnsafe<Array<{ id: string }>>(
      ownershipSql.normalizedSql,
      ...ownershipSql.parameters,
    ),
  );
  assert.equal(systemRows.length, 1);
  assert.equal(systemRows[0]?.id, DOG_OWNERSHIP_OPERATION_PROBE_ID);

  const rowsAfter = await withDbSystemContext((tx) =>
    tx.dogOwnership.count({
      where: { id: DOG_OWNERSHIP_OPERATION_PROBE_ID },
    }),
  );
  assert.equal(rowsAfter, rowsBefore, "Ownership reads must not mutate rows");

  return {
    queryId: "DB.RACING.DOG.OPEN.OWNERSHIP.SELECT",
    sourceFile: "src/lib/queries.ts",
    sourceSymbol: "getMyDogOwnership",
    runtimeIdentity: { ...runtimeIdentity },
    expectedMaximumRows: 1,
    rowsBefore,
    rowsAfter,
    rowCountDelta: rowsAfter - rowsBefore,
    cases: {
      claimant: "returned-four-field-rejected-projection",
      crossProfileService: "returned-null",
      crossProfileRlsReplay: "exact-select-returned-zero",
      anonymousRlsReplay: "exact-select-returned-zero",
      systemReplay: "exact-select-returned-one",
      missing: "returned-null",
      repeat: "same-row-and-sql-shape",
      readOnly: "row-count-unchanged",
      deployedParityResidual: "local-disposable-runtime-only",
    },
    observedSql: ownershipSql.evidence,
    explain: ownershipExplain,
    variants: [],
    status: "verified",
  } as const;
}

async function proveStripeWebhookInsert(
  withDbSystemContext: TransactionRunner,
  withDbAnonymousContext: typeof import("../src/lib/db-context").withDbAnonymousContext,
  withDbRequestContext: typeof import("../src/lib/db-context").withDbRequestContext,
  captureDisposableReplayQueries: typeof import("../src/lib/db").captureDisposableReplayQueries,
  ingestStripeWebhook: typeof import("../src/lib/billing/stripe-webhooks").ingestStripeWebhook,
  Stripe: typeof import("stripe").default,
  moderator: CurrentUserProfile,
  member: CurrentUserProfile,
  runtimeIdentity: {
    role: string;
    sessionRole: string;
    database: string;
    schema: string;
    canLogin: boolean;
    superuser: boolean;
    bypassRls: boolean;
  },
) {
  const rawBody = stripeWebhookOperationPayload(
    STRIPE_WEBHOOK_OPERATION_TYPE,
    STRIPE_WEBHOOK_OPERATION_OBJECT_ID,
  );
  const headers = signedStripeWebhookHeaders(Stripe, rawBody);
  const rowsBefore = await withDbSystemContext((tx) =>
    collectStripeWebhookOperationState(tx),
  );
  assert.deepEqual(rowsBefore, []);

  await expectExactOperationError(
    () =>
      ingestStripeWebhook({
        headers: new Headers({
          "content-type": "application/json",
          "stripe-signature": "invalid-local-signature",
          "stripe-version": STRIPE_WEBHOOK_VERSION,
        }),
        rawBody,
      }),
    "stripe.webhook_invalid_signature",
  );
  assert.deepEqual(
    await withDbSystemContext((tx) => collectStripeWebhookOperationState(tx)),
    [],
    "Invalid signatures must be rejected before a receipt is written",
  );

  const createCapture = await captureDisposableReplayQueries(() =>
    ingestStripeWebhook({ headers, rawBody }),
  );
  assert.equal(createCapture.result.duplicate, false);
  assert.equal(
    createCapture.result.event.lagoEventId,
    STRIPE_WEBHOOK_OPERATION_EVENT_ID,
  );
  assert.equal(createCapture.result.event.eventType, STRIPE_WEBHOOK_OPERATION_TYPE);
  assert.equal(createCapture.result.event.retryCount, 0);
  assert.equal(createCapture.result.event.status, "received");

  const payloadHash = sha256(rawBody);
  const auditPayload = stripeWebhookAuditPayload(
    STRIPE_WEBHOOK_OPERATION_EVENT_ID,
    STRIPE_WEBHOOK_OPERATION_TYPE,
  );
  const safeHeaders = JSON.stringify({
    "content-type": "application/json",
    "stripe-version": STRIPE_WEBHOOK_VERSION,
  });
  const insertEvent = exactObservedTableStatement(
    createCapture.queries,
    "INSERT",
    "WebhookEvent",
  );
  const insertSql = observedStatementEvidence({
    ...insertEvent,
    params: escapeObservedJsonStringParameters(insertEvent.params, [
      auditPayload,
      safeHeaders,
    ]),
  }, "INSERT", [
    { name: "webhookEvent.id", positions: [1], expectedKinds: ["cuid"] },
    { name: "provider", positions: [2], expectedValues: ["stripe"] },
    {
      name: "stripeEvent.id",
      positions: [3],
      expectedValues: [STRIPE_WEBHOOK_OPERATION_EVENT_ID],
    },
    {
      name: "stripeEvent.type",
      positions: [4],
      expectedValues: [STRIPE_WEBHOOK_OPERATION_TYPE],
    },
    {
      name: "status",
      positions: [5],
      expectedValues: ["received"],
      allowSqlTextMatch: true,
    },
    { name: "payloadHash", positions: [6], expectedValues: [payloadHash] },
    { name: "auditPayload", positions: [7], expectedValues: [auditPayload] },
    { name: "safeHeaders", positions: [8], expectedValues: [safeHeaders] },
    { name: "retryCount", positions: [9], expectedValues: [0] },
    {
      name: "prisma.timestamps",
      positions: [10, 11, 12],
      expectedKinds: ["date", "date", "date"],
    },
  ]);
  assertStatementTransactionOutcome(createCapture.queries, insertEvent, "COMMIT");
  assertSystemContextCaptured(createCapture.queries);
  const insertExplain = await explainObservedSystemStatement(
    withDbSystemContext,
    insertSql,
  );

  const firstState = await withDbSystemContext((tx) =>
    collectStripeWebhookOperationState(tx),
  );
  assert.equal(firstState.length, 1);
  assert.deepEqual(firstState[0], {
    id: createCapture.result.event.id,
    provider: "stripe",
    lagoEventId: STRIPE_WEBHOOK_OPERATION_EVENT_ID,
    eventType: STRIPE_WEBHOOK_OPERATION_TYPE,
    status: "ignored",
    payloadHash,
    payloadJson: auditPayload,
    headersJson: safeHeaders,
    retryCount: 0,
    processed: true,
    error: null,
  });
  assert.ok(!firstState[0]?.headersJson.includes("stripe-signature"));
  assert.ok(!firstState[0]?.payloadJson.includes(STRIPE_WEBHOOK_OPERATION_OBJECT_ID));

  const replayParameters = stripeWebhookReplayParameters(insertSql.parameters);
  const memberRlsFailure = await expectOperationFailure(
    () =>
      withDbRequestContext(member, (tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          insertSql.normalizedSql,
          ...replayParameters,
        ),
      ),
    "Member exact Stripe webhook receipt INSERT",
  );
  assert.match(memberRlsFailure.message, /row-level security/i);
  const anonymousRlsFailure = await expectOperationFailure(
    () =>
      withDbAnonymousContext((tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          insertSql.normalizedSql,
          ...replayParameters,
        ),
      ),
    "Anonymous exact Stripe webhook receipt INSERT",
  );
  assert.match(anonymousRlsFailure.message, /row-level security/i);
  await expectExactOperationError(
    () =>
      withDbRequestContext(moderator, async (tx) => {
        const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          insertSql.normalizedSql,
          ...replayParameters,
        );
        assert.equal(rows.length, 1);
        assert.equal(rows[0]?.id, STRIPE_WEBHOOK_ROLLBACK_ROW_ID);
        throw new Error("demo_fixture.stripe_webhook_insert_rollback");
      }),
    "demo_fixture.stripe_webhook_insert_rollback",
  );
  assert.equal(
    await withDbSystemContext((tx) =>
      tx.webhookEvent.count({
        where: { lagoEventId: STRIPE_WEBHOOK_ROLLBACK_EVENT_ID },
      }),
    ),
    0,
    "The exact moderator-policy replay must roll back its receipt",
  );

  const duplicateCapture = await captureDisposableReplayQueries(() =>
    ingestStripeWebhook({ headers, rawBody }),
  );
  assert.equal(duplicateCapture.result.duplicate, true);
  assert.equal(duplicateCapture.result.event.id, firstState[0]?.id);
  assert.equal(duplicateCapture.result.event.retryCount, 1);
  assert.equal(duplicateCapture.result.event.status, "ignored");
  assert.equal(
    normalizeObservedSql(
      exactObservedTableStatement(
        duplicateCapture.queries,
        "INSERT",
        "WebhookEvent",
      ).query,
    ),
    insertSql.normalizedSql,
    "Duplicate delivery must attempt the same parameterized receipt INSERT shape",
  );

  const conflictBody = stripeWebhookOperationPayload(
    STRIPE_WEBHOOK_CONFLICT_TYPE,
    `${STRIPE_WEBHOOK_OPERATION_OBJECT_ID}-conflict`,
  );
  await expectExactOperationError(
    () =>
      ingestStripeWebhook({
        headers: signedStripeWebhookHeaders(Stripe, conflictBody),
        rawBody: conflictBody,
      }),
    "stripe.webhook_receipt_conflict",
  );
  const rowsAfter = await withDbSystemContext((tx) =>
    collectStripeWebhookOperationState(tx),
  );
  assert.equal(rowsAfter.length, 1);
  assert.deepEqual(rowsAfter[0], {
    ...firstState[0],
    retryCount: 1,
  });

  return {
    queryId: "DB.BILLING.STRIPE_WEBHOOK_EVENT.INSERT",
    sourceFile: "src/lib/billing/stripe-webhooks.ts",
    sourceSymbol: "ingestStripeWebhook",
    runtimeIdentity: { ...runtimeIdentity },
    expectedMaximumRows: 1,
    rowsBefore: rowsBefore.length,
    rowsAfter: rowsAfter.length,
    rowCountDelta: rowsAfter.length - rowsBefore.length,
    cases: {
      invalidSignature: "rejected-before-database-write",
      verifiedSignature: "created-one-sanitized-receipt",
      systemContext: "committed-under-nobypassrls-runtime-role",
      memberRlsReplay: "exact-insert-rejected",
      anonymousRlsReplay: "exact-insert-rejected",
      moderatorPolicy: "exact-insert-allowed-then-rolled-back",
      duplicate: "one-row-retained-retry-count-incremented",
      conflict: "same-event-different-payload-rejected-without-overwrite",
      redaction: "signature-and-data-object-not-persisted",
      providerResidual: "stripe-network-and-delivery-not-contacted",
      deployedParityResidual: "local-disposable-runtime-only",
    },
    observedSql: insertSql.evidence,
    explain: insertExplain,
    variants: [],
    status: "verified",
  } as const;
}

function stripeWebhookOperationPayload(eventType: string, objectId: string) {
  return Buffer.from(
    JSON.stringify({
      id: STRIPE_WEBHOOK_OPERATION_EVENT_ID,
      object: "event",
      created: STRIPE_WEBHOOK_CREATED,
      livemode: false,
      type: eventType,
      data: {
        object: {
          id: objectId,
          object: "greyhoundiq.database.proof",
        },
      },
    }),
  );
}

function signedStripeWebhookHeaders(
  Stripe: typeof import("stripe").default,
  rawBody: Buffer,
) {
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: rawBody.toString("utf8"),
    secret: STRIPE_WEBHOOK_SECRET,
  });
  return new Headers({
    "content-type": "application/json",
    "stripe-signature": signature,
    "stripe-version": STRIPE_WEBHOOK_VERSION,
  });
}

function stripeWebhookAuditPayload(eventId: string, eventType: string) {
  return JSON.stringify({
    created: STRIPE_WEBHOOK_CREATED,
    id: eventId,
    livemode: false,
    type: eventType,
  });
}

function stripeWebhookReplayParameters(parameters: readonly unknown[]) {
  assert.equal(parameters.length, 12);
  const replay = [...parameters];
  replay[0] = STRIPE_WEBHOOK_ROLLBACK_ROW_ID;
  replay[2] = STRIPE_WEBHOOK_ROLLBACK_EVENT_ID;
  replay[5] = sha256(STRIPE_WEBHOOK_ROLLBACK_EVENT_ID);
  replay[6] = stripeWebhookAuditPayload(
    STRIPE_WEBHOOK_ROLLBACK_EVENT_ID,
    STRIPE_WEBHOOK_OPERATION_TYPE,
  );
  return replay;
}

function escapeObservedJsonStringParameters(
  serializedParameters: string,
  values: readonly string[],
) {
  let repaired = serializedParameters;
  for (const value of values) {
    const raw = `"${value}"`;
    assert.equal(
      repaired.split(raw).length - 1,
      1,
      "Observed JSON string parameter must occur exactly once",
    );
    repaired = repaired.replace(raw, JSON.stringify(value));
  }
  return repaired;
}

async function collectStripeWebhookOperationState(tx: DbContextClient) {
  const rows = await tx.webhookEvent.findMany({
    where: {
      provider: "stripe",
      lagoEventId: {
        in: [
          STRIPE_WEBHOOK_OPERATION_EVENT_ID,
          STRIPE_WEBHOOK_ROLLBACK_EVENT_ID,
        ],
      },
    },
    select: {
      id: true,
      provider: true,
      lagoEventId: true,
      eventType: true,
      status: true,
      payloadHash: true,
      payloadJson: true,
      headersJson: true,
      retryCount: true,
      processedAt: true,
      error: true,
    },
    orderBy: { id: "asc" },
  });
  return rows.map(({ processedAt, ...row }) => ({
    ...row,
    processed: processedAt instanceof Date,
  }));
}

async function proveAuthCallbackAcceptance(
  withDbSystemContext: TransactionRunner,
  withDbRequestContext: typeof import("../src/lib/db-context").withDbRequestContext,
  captureDisposableReplayQueries: typeof import("../src/lib/db").captureDisposableReplayQueries,
  syncAuthUser: typeof import("../src/lib/auth-sync").syncAuthUser,
  personalActorHandle: typeof import("../src/lib/social-actor-service").personalActorHandle,
  requestUser: CurrentUserProfile,
  runtimeIdentity: {
    role: string;
    sessionRole: string;
    database: string;
    schema: string;
    canLogin: boolean;
    superuser: boolean;
    bypassRls: boolean;
  },
) {
  const identity = {
    id: AUTH_ACCEPTANCE_PROVIDER_ID,
    email: AUTH_ACCEPTANCE_EMAIL,
    firstName: "Auth",
    lastName: "Acceptance Probe",
    emailVerified: true,
  } as const;
  const before = await withDbSystemContext((tx) =>
    collectAuthAcceptanceState(
      tx,
      AUTH_ACCEPTANCE_PROVIDER_ID,
      AUTH_ACCEPTANCE_EMAIL,
    ),
  );
  assertAuthAcceptanceCounts(before, 0);

  const unverifiedBefore = await withDbSystemContext((tx) =>
    collectUnverifiedAuthLinkState(tx, requestUser.email),
  );
  const unverifiedCapture = await captureDisposableReplayQueries(() =>
    expectOperationFailure(
      () =>
        syncAuthUser({
          id: AUTH_ACCEPTANCE_UNVERIFIED_PROVIDER_ID,
          email: requestUser.email,
          firstName: "Unverified",
          lastName: "Collision",
          emailVerified: false,
        }),
      "Unverified email auth-link collision",
    ),
  );
  assert.match(unverifiedCapture.result.message, /unique constraint failed/i);
  const unverifiedLookupEvent = exactObservedAuthLookup(
    unverifiedCapture.queries,
    false,
  );
  const unverifiedLookupSql = observedSelectEvidence(
    unverifiedLookupEvent,
    [
      {
        name: "provider.subject",
        value: AUTH_ACCEPTANCE_UNVERIFIED_PROVIDER_ID,
        occurrences: 1,
      },
      { name: "prisma.take", value: 1, occurrences: 1 },
      { name: "prisma.skip", value: 0, occurrences: 1 },
    ],
  );
  const unverifiedInsertEvent = exactObservedTableStatement(
    unverifiedCapture.queries,
    "INSERT",
    "User",
  );
  assertStatementTransactionOutcome(
    unverifiedCapture.queries,
    unverifiedInsertEvent,
    "ROLLBACK",
  );
  assertSystemContextCaptured(unverifiedCapture.queries);
  assert.deepEqual(
    await withDbSystemContext((tx) =>
      collectUnverifiedAuthLinkState(tx, requestUser.email),
    ),
    unverifiedBefore,
    "Unverified email must not link to or mutate an existing local account",
  );

  let rollbackUserId = "";
  let rollbackProfileId = "";
  const rollbackCapture = await captureDisposableReplayQueries(() =>
    expectExactOperationError(
      () =>
        withDbSystemContext(async (tx) => {
          const created = await tx.user.create({
            data: {
              email: AUTH_ACCEPTANCE_ROLLBACK_EMAIL,
              name: AUTH_ACCEPTANCE_ROLLBACK_DISPLAY_NAME,
              workosUserId: AUTH_ACCEPTANCE_ROLLBACK_PROVIDER_ID,
              subscriptionTier: "free",
            },
            include: { profile: true },
          });
          rollbackUserId = created.id;
          const profile = await tx.profile.create({
            data: {
              userId: created.id,
              displayName: AUTH_ACCEPTANCE_ROLLBACK_DISPLAY_NAME,
              role: "member",
            },
          });
          rollbackProfileId = profile.id;
          await tx.socialActor.upsert({
            where: { profileId: profile.id },
            create: {
              kind: "personal",
              profileId: profile.id,
              ownerProfileId: profile.id,
              handle: personalActorHandle(profile.id),
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              profileVisibility: "members",
              contactVisibility: "only_me",
              published: true,
            },
            update: {
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              published: true,
            },
          });
          await tx.signupOutbox.upsert({
            where: { userId: created.id },
            create: {
              userId: created.id,
              idempotencyKey: `signup.accepted:${created.id}`,
            },
            update: {},
            select: { id: true, idempotencyKey: true, status: true },
          });
          throw new Error("demo_fixture.auth_acceptance_rollback");
        }),
      "demo_fixture.auth_acceptance_rollback",
    ),
  );
  assert.match(rollbackUserId, CUID_PATTERN);
  assert.match(rollbackProfileId, CUID_PATTERN);
  const rollbackUserEvent = exactObservedTableStatement(
    rollbackCapture.queries,
    "INSERT",
    "User",
  );
  const rollbackProfileEvent = exactObservedTableStatement(
    rollbackCapture.queries,
    "INSERT",
    "Profile",
  );
  const rollbackActorEvent = exactObservedTableStatement(
    rollbackCapture.queries,
    "INSERT",
    "SocialActor",
  );
  const rollbackOutboxEvent = exactObservedTableStatement(
    rollbackCapture.queries,
    "INSERT",
    "SignupOutbox",
  );
  const rollbackUserSql = observedStatementEvidence(
    rollbackUserEvent,
    "INSERT",
    authAcceptanceUserInsertBinds(
      rollbackUserId,
      AUTH_ACCEPTANCE_ROLLBACK_EMAIL,
      AUTH_ACCEPTANCE_ROLLBACK_DISPLAY_NAME,
      AUTH_ACCEPTANCE_ROLLBACK_PROVIDER_ID,
    ),
  );
  const rollbackProfileSql = observedStatementEvidence(
    rollbackProfileEvent,
    "INSERT",
    authAcceptanceProfileInsertBinds(
      rollbackProfileId,
      rollbackUserId,
      AUTH_ACCEPTANCE_ROLLBACK_DISPLAY_NAME,
    ),
  );
  const rollbackActorSql = observedStatementEvidence(
    rollbackActorEvent,
    "INSERT",
    authAcceptanceActorUpsertBinds(
      rollbackProfileId,
      AUTH_ACCEPTANCE_ROLLBACK_DISPLAY_NAME,
      personalActorHandle(rollbackProfileId),
    ),
  );
  const rollbackOutboxSql = observedStatementEvidence(
    rollbackOutboxEvent,
    "INSERT",
    authAcceptanceOutboxInsertBinds(rollbackUserId),
  );
  for (const event of [
    rollbackUserEvent,
    rollbackProfileEvent,
    rollbackActorEvent,
    rollbackOutboxEvent,
  ]) {
    assertStatementTransactionOutcome(rollbackCapture.queries, event, "ROLLBACK");
  }
  assertSystemContextCaptured(rollbackCapture.queries);
  assertAuthAcceptanceCounts(
    await withDbSystemContext((tx) =>
      collectAuthAcceptanceState(
        tx,
        AUTH_ACCEPTANCE_ROLLBACK_PROVIDER_ID,
        AUTH_ACCEPTANCE_ROLLBACK_EMAIL,
      ),
    ),
    0,
  );

  const requestRlsFailure = await expectOperationFailure(
    () =>
      withDbRequestContext(requestUser, (tx) =>
        tx.$queryRawUnsafe<unknown[]>(
          rollbackUserSql.normalizedSql,
          ...rollbackUserSql.parameters,
        ),
      ),
    "Request-context exact auth User INSERT",
  );
  assert.match(requestRlsFailure.message, /row-level security/i);
  assertAuthAcceptanceCounts(
    await withDbSystemContext((tx) =>
      collectAuthAcceptanceState(
        tx,
        AUTH_ACCEPTANCE_ROLLBACK_PROVIDER_ID,
        AUTH_ACCEPTANCE_ROLLBACK_EMAIL,
      ),
    ),
    0,
  );

  const createCapture = await captureDisposableReplayQueries(() =>
    syncAuthUser(identity),
  );
  const created = createCapture.result;
  assert.equal(created.email, AUTH_ACCEPTANCE_EMAIL);
  assert.equal(created.name, AUTH_ACCEPTANCE_DISPLAY_NAME);
  assert.equal(created.workosUserId, AUTH_ACCEPTANCE_PROVIDER_ID);
  assert.ok(created.profile);
  assert.equal(created.profile.displayName, AUTH_ACCEPTANCE_DISPLAY_NAME);
  const verifiedLookupEvent = exactObservedAuthLookup(createCapture.queries, true);
  const createUserEvent = exactObservedTableStatement(
    createCapture.queries,
    "INSERT",
    "User",
  );
  const createProfileEvent = exactObservedTableStatement(
    createCapture.queries,
    "INSERT",
    "Profile",
  );
  const createActorEvent = exactObservedTableStatement(
    createCapture.queries,
    "INSERT",
    "SocialActor",
  );
  const createOutboxEvent = exactObservedTableStatement(
    createCapture.queries,
    "INSERT",
    "SignupOutbox",
  );
  const verifiedLookupSql = observedSelectEvidence(verifiedLookupEvent, [
    {
      name: "provider.subject",
      value: AUTH_ACCEPTANCE_PROVIDER_ID,
      occurrences: 1,
    },
    {
      name: "provider.verifiedEmail",
      value: AUTH_ACCEPTANCE_EMAIL,
      occurrences: 1,
    },
    { name: "prisma.take", value: 1, occurrences: 1 },
    { name: "prisma.skip", value: 0, occurrences: 1 },
  ]);
  const createUserSql = observedStatementEvidence(
    createUserEvent,
    "INSERT",
    authAcceptanceUserInsertBinds(
      created.id,
      AUTH_ACCEPTANCE_EMAIL,
      AUTH_ACCEPTANCE_DISPLAY_NAME,
      AUTH_ACCEPTANCE_PROVIDER_ID,
    ),
  );
  const createProfileSql = observedStatementEvidence(
    createProfileEvent,
    "INSERT",
    authAcceptanceProfileInsertBinds(
      created.profile.id,
      created.id,
      AUTH_ACCEPTANCE_DISPLAY_NAME,
    ),
  );
  const createActorSql = observedStatementEvidence(
    createActorEvent,
    "INSERT",
    authAcceptanceActorUpsertBinds(
      created.profile.id,
      AUTH_ACCEPTANCE_DISPLAY_NAME,
      personalActorHandle(created.profile.id),
    ),
  );
  const createOutboxSql = observedStatementEvidence(
    createOutboxEvent,
    "INSERT",
    authAcceptanceOutboxInsertBinds(created.id),
  );
  assert.equal(createUserSql.normalizedSql, rollbackUserSql.normalizedSql);
  assert.equal(createProfileSql.normalizedSql, rollbackProfileSql.normalizedSql);
  assert.equal(createActorSql.normalizedSql, rollbackActorSql.normalizedSql);
  assert.equal(createOutboxSql.normalizedSql, rollbackOutboxSql.normalizedSql);
  for (const event of [
    createUserEvent,
    createProfileEvent,
    createActorEvent,
    createOutboxEvent,
  ]) {
    assertStatementTransactionOutcome(createCapture.queries, event, "COMMIT");
  }
  assertSystemContextCaptured(createCapture.queries);
  const createdState = await withDbSystemContext((tx) =>
    collectAuthAcceptanceState(
      tx,
      AUTH_ACCEPTANCE_PROVIDER_ID,
      AUTH_ACCEPTANCE_EMAIL,
    ),
  );
  assertAuthAcceptanceCounts(createdState, 1);
  assert.equal(createdState.user?.id, created.id);
  assert.equal(createdState.profile?.id, created.profile.id);
  assert.equal(
    createdState.actor?.handle,
    personalActorHandle(created.profile.id),
  );
  assert.equal(
    createdState.outbox?.idempotencyKey,
    `signup.accepted:${created.id}`,
  );

  const repeatCapture = await captureDisposableReplayQueries(() =>
    syncAuthUser(identity),
  );
  assert.equal(repeatCapture.result.id, created.id);
  assert.equal(repeatCapture.result.profile?.id, created.profile.id);
  const repeatUserEvent = exactObservedTableStatement(
    repeatCapture.queries,
    "UPDATE",
    "User",
  );
  const repeatActorEvent = exactObservedTableStatement(
    repeatCapture.queries,
    "INSERT",
    "SocialActor",
  );
  const repeatUserSql = observedStatementEvidence(
    repeatUserEvent,
    "UPDATE",
    authAcceptanceUserUpdateBinds(created.id),
  );
  const repeatActorSql = observedStatementEvidence(
    repeatActorEvent,
    "INSERT",
    authAcceptanceActorUpsertBinds(
      created.profile.id,
      AUTH_ACCEPTANCE_DISPLAY_NAME,
      personalActorHandle(created.profile.id),
    ),
  );
  assert.equal(repeatActorSql.normalizedSql, createActorSql.normalizedSql);
  assert.equal(
    repeatCapture.queries.filter((event) => {
      const sql = normalizeObservedSql(event.query);
      return (
        sql.startsWith('INSERT INTO "public"."User"') ||
        sql.startsWith('INSERT INTO "public"."Profile"') ||
        sql.startsWith('INSERT INTO "public"."SignupOutbox"')
      );
    }).length,
    0,
    "Repeated auth sync must not create a second user, profile or outbox row",
  );
  assertMutationTransaction(
    repeatCapture.queries,
    repeatUserEvent,
    repeatActorEvent,
  );
  assertSystemContextCaptured(repeatCapture.queries);
  const repeatedState = await withDbSystemContext((tx) =>
    collectAuthAcceptanceState(
      tx,
      AUTH_ACCEPTANCE_PROVIDER_ID,
      AUTH_ACCEPTANCE_EMAIL,
    ),
  );
  assertAuthAcceptanceCounts(repeatedState, 1);
  assert.deepEqual(repeatedState, createdState);

  await withDbSystemContext((tx) =>
    tx.user.update({
      where: { id: created.id },
      data: {
        isBanned: true,
        deletionRequestedAt: AUTH_ACCEPTANCE_RESTORE_AT,
      },
    }),
  );
  assert.equal(
    await withDbSystemContext((tx) =>
      tx.auditLog.count({ where: authAcceptanceRestoreAuditWhere(created.id) }),
    ),
    0,
  );
  const restoreCapture = await captureDisposableReplayQueries(() =>
    syncAuthUser(identity),
  );
  assert.equal(restoreCapture.result.id, created.id);
  assert.equal(restoreCapture.result.isBanned, false);
  assert.equal(restoreCapture.result.deletionRequestedAt, null);
  const restoreUserEvent = exactObservedTableStatement(
    restoreCapture.queries,
    "UPDATE",
    "User",
  );
  const restoreAuditEvent = exactObservedTableStatement(
    restoreCapture.queries,
    "INSERT",
    "AuditLog",
  );
  const restoreActorEvent = exactObservedTableStatement(
    restoreCapture.queries,
    "INSERT",
    "SocialActor",
  );
  const restoreUserSql = observedStatementEvidence(
    restoreUserEvent,
    "UPDATE",
    authAcceptanceUserUpdateBinds(created.id),
  );
  const restoreAuditParameters = authAcceptanceRestoreAuditParameters(
    restoreAuditEvent,
    created.id,
  );
  const restoreAuditSql = observedStatementEvidence(
    restoreAuditEvent,
    "INSERT",
    authAcceptanceRestoreAuditBinds(
      created.id,
      restoreAuditParameters[5],
    ),
    restoreAuditParameters,
  );
  const restoreActorSql = observedStatementEvidence(
    restoreActorEvent,
    "INSERT",
    authAcceptanceActorUpsertBinds(
      created.profile.id,
      AUTH_ACCEPTANCE_DISPLAY_NAME,
      personalActorHandle(created.profile.id),
    ),
  );
  assert.equal(restoreUserSql.normalizedSql, repeatUserSql.normalizedSql);
  assert.equal(restoreActorSql.normalizedSql, createActorSql.normalizedSql);
  for (const event of [restoreUserEvent, restoreAuditEvent, restoreActorEvent]) {
    assertStatementTransactionOutcome(restoreCapture.queries, event, "COMMIT");
  }
  assertSystemContextCaptured(restoreCapture.queries);
  const restoredState = await withDbSystemContext((tx) =>
    collectAuthAcceptanceState(
      tx,
      AUTH_ACCEPTANCE_PROVIDER_ID,
      AUTH_ACCEPTANCE_EMAIL,
    ),
  );
  assertAuthAcceptanceCounts(restoredState, 1);
  assert.equal(restoredState.user?.isBanned, false);
  assert.equal(restoredState.user?.deletionRequestedAt, null);
  const restoredAudits = await withDbSystemContext((tx) =>
    tx.auditLog.findMany({
      where: authAcceptanceRestoreAuditWhere(created.id),
      select: { metadata: true },
    }),
  );
  assert.deepEqual(restoredAudits, [{ metadata: restoreAuditParameters[5] }]);

  await withDbSystemContext((tx) =>
    tx.user.update({
      where: { id: created.id },
      data: { isBanned: true, deletionRequestedAt: null },
    }),
  );
  const bannedCapture = await captureDisposableReplayQueries(() =>
    syncAuthUser(identity),
  );
  assert.equal(bannedCapture.result.id, created.id);
  assert.equal(bannedCapture.result.isBanned, true);
  assert.equal(bannedCapture.result.deletionRequestedAt, null);
  assert.equal(
    bannedCapture.queries.filter((event) =>
      /^(?:INSERT|UPDATE|DELETE)\b/i.test(normalizeObservedSql(event.query)),
    ).length,
    0,
    "A permanently banned identity must return without database mutation",
  );
  assertSystemContextCaptured(bannedCapture.queries);
  const after = await withDbSystemContext((tx) =>
    collectAuthAcceptanceState(
      tx,
      AUTH_ACCEPTANCE_PROVIDER_ID,
      AUTH_ACCEPTANCE_EMAIL,
    ),
  );
  assertAuthAcceptanceCounts(after, 1);
  assert.equal(after.user?.isBanned, true);
  assert.equal(after.user?.deletionRequestedAt, null);
  assert.equal(
    await withDbSystemContext((tx) =>
      tx.auditLog.count({ where: authAcceptanceRestoreAuditWhere(created.id) }),
    ),
    1,
  );

  const [
    verifiedLookupExplain,
    unverifiedLookupExplain,
    createUserExplain,
    createProfileExplain,
    createActorExplain,
    createOutboxExplain,
    repeatUserExplain,
    restoreAuditExplain,
  ] = await Promise.all([
    explainObservedSystemStatement(withDbSystemContext, verifiedLookupSql),
    explainObservedSystemStatement(withDbSystemContext, unverifiedLookupSql),
    explainObservedSystemStatement(withDbSystemContext, createUserSql),
    explainObservedSystemStatement(withDbSystemContext, createProfileSql),
    explainObservedSystemStatement(withDbSystemContext, createActorSql),
    explainObservedSystemStatement(withDbSystemContext, createOutboxSql),
    explainObservedSystemStatement(withDbSystemContext, repeatUserSql),
    explainObservedSystemStatement(withDbSystemContext, restoreAuditSql),
  ]);

  return {
    queryId: "DB.AUTH.CALLBACK.ACCEPTANCE.TRANSACTION",
    sourceFile: "src/lib/auth-sync.ts",
    sourceSymbol: "syncAuthUser",
    runtimeIdentity: { ...runtimeIdentity },
    expectedMaximumRows: 4,
    rowsBefore: before.userCount,
    rowsAfter: after.userCount,
    rowCountDelta: after.userCount - before.userCount,
    cases: {
      newIdentity: "created-one-user-profile-actor-outbox",
      repeat: "same-four-rows-bounded-update-and-actor-upsert",
      pendingDeletion: "restored-user-and-inserted-one-audit",
      permanentBan: "returned-without-mutation",
      unverifiedEmail: "duplicate-email-rejected-without-linking",
      requestContext: "exact-user-insert-rejected-by-rls",
      rollback: "four-write-transaction-rolled-back",
      systemContext: "captured-under-nobypassrls-runtime-role",
      providerResidual: "identity-provider-validation-out-of-scope",
      concurrencyResidual: "concurrent-first-login-not-proven",
    },
    observedSql: verifiedLookupSql.evidence,
    explain: verifiedLookupExplain,
    variants: [
      {
        variant: "verified-identity-lookup",
        observedSql: verifiedLookupSql.evidence,
        explain: verifiedLookupExplain,
      },
      {
        variant: "unverified-identity-lookup",
        observedSql: unverifiedLookupSql.evidence,
        explain: unverifiedLookupExplain,
      },
      {
        variant: "user-insert",
        observedSql: createUserSql.evidence,
        explain: createUserExplain,
      },
      {
        variant: "profile-insert",
        observedSql: createProfileSql.evidence,
        explain: createProfileExplain,
      },
      {
        variant: "social-actor-upsert",
        observedSql: createActorSql.evidence,
        explain: createActorExplain,
      },
      {
        variant: "signup-outbox-insert",
        observedSql: createOutboxSql.evidence,
        explain: createOutboxExplain,
      },
      {
        variant: "repeat-user-update",
        observedSql: repeatUserSql.evidence,
        explain: repeatUserExplain,
      },
      {
        variant: "restore-audit-insert",
        observedSql: restoreAuditSql.evidence,
        explain: restoreAuditExplain,
      },
    ],
    status: "verified",
  } as const;
}

type ExpectedObservedBind = {
  name: string;
  value: string | number;
  occurrences: number;
};

type ObservedSqlEvidence = {
  normalizedSql: string;
  parameters: unknown[];
  evidence: {
    statementType: "SELECT" | "UPDATE" | "INSERT" | "WITH";
    normalizedSql: string;
    sha256: string;
    parameterCount: number;
    namedBinds: Array<{ name: string; positions: number[] }>;
    persistedParameterValues: false;
  };
};

function exactObservedTableSelect(
  queries: readonly DisposableReplayQueryEvent[],
  table:
    | "Conversation"
    | "Dog"
    | "DogOwnership"
    | "MediaAsset"
    | "Meeting"
    | "Profile"
    | "Race"
    | "Result"
    | "Runner"
    | "Track"
    | "User",
) {
  const marker = `FROM "public"."${table}"`;
  const candidates = queries.filter((event) => {
    const sql = normalizeObservedSql(event.query);
    return /^SELECT\b/i.test(sql) && sql.includes(marker);
  });
  assert.equal(
    candidates.length,
    1,
    `Expected exactly one observed ${table} SELECT, received ${candidates.length}`,
  );
  return candidates[0];
}

function exactObservedAuthLookup(
  queries: readonly DisposableReplayQueryEvent[],
  includesVerifiedEmail: boolean,
) {
  const candidates = queries.filter((event) => {
    const sql = normalizeObservedSql(event.query);
    const isUserLookup =
      /^SELECT\b/i.test(sql) &&
      sql.includes('FROM "public"."User"') &&
      sql.includes('"public"."User"."workosUserId" = $1') &&
      sql.includes('ORDER BY "public"."User"."createdAt" ASC');
    const hasEmailFallback = sql.includes('"public"."User"."email" = $2');
    return isUserLookup && hasEmailFallback === includesVerifiedEmail;
  });
  assert.equal(
    candidates.length,
    1,
    `Expected one observed ${includesVerifiedEmail ? "verified" : "unverified"} auth lookup, received ${candidates.length}`,
  );
  return candidates[0];
}

function observedSelectEvidence(
  event: DisposableReplayQueryEvent,
  expectedBinds: readonly ExpectedObservedBind[],
): ObservedSqlEvidence {
  const normalizedSql = normalizeObservedSql(event.query);
  assert.match(normalizedSql, /^SELECT\b/i, "Observed statement must be SELECT");
  assert.doesNotMatch(
    normalizedSql,
    /;|--|\/\*/,
    "Observed SELECT must contain one uncommented statement",
  );

  const parsed = JSON.parse(event.params) as unknown;
  assert.ok(Array.isArray(parsed), "Observed Prisma parameters must be an array");
  const parameters = parsed as unknown[];
  const placeholderPositions = [
    ...normalizedSql.matchAll(/\$(\d+)\b/g),
  ].map((match) => Number(match[1]));
  const uniquePositions = [...new Set(placeholderPositions)].sort(
    (left, right) => left - right,
  );
  assert.deepEqual(
    uniquePositions,
    Array.from({ length: parameters.length }, (_, index) => index + 1),
    "Observed Prisma placeholders must cover every parameter exactly by position",
  );

  const occurrenceNames = parameters.map((value, index) => {
    const matches = expectedBinds.filter((bind) => Object.is(bind.value, value));
    assert.equal(
      matches.length,
      1,
      `Observed parameter ${index + 1} must map to one reviewed semantic bind`,
    );
    return matches[0].name;
  });
  for (const bind of expectedBinds) {
    assert.equal(
      occurrenceNames.filter((name) => name === bind.name).length,
      bind.occurrences,
      `Observed bind occurrence mismatch for ${bind.name}`,
    );
    if (typeof bind.value === "string") {
      assert.ok(
        !normalizedSql.includes(bind.value),
        `Observed SQL must not inline ${bind.name}`,
      );
    }
  }

  const namedBinds: Array<{ name: string; positions: number[] }> = [];
  occurrenceNames.forEach((name, index) => {
    const existing = namedBinds.find((bind) => bind.name === name);
    if (existing) existing.positions.push(index + 1);
    else namedBinds.push({ name, positions: [index + 1] });
  });

  return {
    normalizedSql,
    parameters,
    evidence: {
      statementType: "SELECT",
      normalizedSql,
      sha256: sha256(normalizedSql),
      parameterCount: parameters.length,
      namedBinds,
      persistedParameterValues: false,
    },
  };
}

type ExpectedPositionedBind = {
  name: string;
  positions: number[];
  expectedValues?: unknown[];
  expectedKinds?: Array<"cuid" | "date" | "uuid">;
  allowSqlTextMatch?: boolean;
};

function authAcceptanceUserInsertBinds(
  userId: string,
  email: string,
  displayName: string,
  providerId: string,
): ExpectedPositionedBind[] {
  return [
    { name: "user.id", positions: [1], expectedValues: [userId] },
    { name: "provider.email", positions: [2], expectedValues: [email] },
    { name: "displayName", positions: [3], expectedValues: [displayName] },
    { name: "subscriptionTier", positions: [4], expectedValues: ["free"] },
    { name: "isBanned", positions: [5], expectedValues: [false] },
    {
      name: "prisma.userTimestamps",
      positions: [6, 7],
      expectedKinds: ["date", "date"],
    },
    {
      name: "provider.subject",
      positions: [8],
      expectedValues: [providerId],
    },
  ];
}

function authAcceptanceProfileInsertBinds(
  profileId: string,
  userId: string,
  displayName: string,
): ExpectedPositionedBind[] {
  return [
    { name: "profile.id", positions: [1], expectedValues: [profileId] },
    { name: "user.id", positions: [2], expectedValues: [userId] },
    { name: "displayName", positions: [3], expectedValues: [displayName] },
    { name: "profile.role", positions: [4], expectedValues: ["member"] },
    {
      name: "profile.flags",
      positions: [5, 6],
      expectedValues: [false, false],
    },
    {
      name: "prisma.profileTimestamps",
      positions: [7, 8],
      expectedKinds: ["date", "date"],
    },
  ];
}

function authAcceptanceActorUpsertBinds(
  profileId: string,
  displayName: string,
  handle: string,
): ExpectedPositionedBind[] {
  return [
    { name: "actor.id", positions: [1], expectedKinds: ["cuid"] },
    { name: "actor.kind", positions: [2], expectedValues: ["personal"] },
    {
      name: "profile.id",
      positions: [3, 4, 25],
      expectedValues: [profileId, profileId, profileId],
    },
    { name: "actor.handle", positions: [5], expectedValues: [handle] },
    {
      name: "displayName",
      positions: [6, 21],
      expectedValues: [displayName, displayName],
    },
    {
      name: "avatarUrl",
      positions: [7, 22],
      expectedValues: [null, null],
    },
    {
      name: "actor.focalDefaults",
      positions: [8, 9, 12, 13],
      expectedValues: [0.5, 0.5, 0.5, 0.5],
    },
    {
      name: "actor.zoomDefaults",
      positions: [10, 14],
      expectedValues: [1, 1],
    },
    {
      name: "actor.rotationDefaults",
      positions: [11, 15],
      expectedValues: [0, 0],
    },
    {
      name: "profileVisibility",
      positions: [16],
      expectedValues: ["members"],
    },
    {
      name: "contactVisibility",
      positions: [17],
      expectedValues: ["only_me"],
    },
    {
      name: "published",
      positions: [18, 23],
      expectedValues: [true, true],
    },
    {
      name: "prisma.actorTimestamps",
      positions: [19, 20, 24],
      expectedKinds: ["date", "date", "date"],
    },
  ];
}

function authAcceptanceOutboxInsertBinds(
  userId: string,
): ExpectedPositionedBind[] {
  return [
    { name: "outbox.id", positions: [1], expectedKinds: ["cuid"] },
    { name: "user.id", positions: [2], expectedValues: [userId] },
    {
      name: "idempotencyKey",
      positions: [3],
      expectedValues: [`signup.accepted:${userId}`],
    },
    { name: "outbox.status", positions: [4], expectedValues: ["pending"] },
    { name: "retryCount", positions: [5], expectedValues: [0] },
    {
      name: "prisma.outboxTimestamps",
      positions: [6, 7, 8],
      expectedKinds: ["date", "date", "date"],
    },
  ];
}

function authAcceptanceUserUpdateBinds(
  userId: string,
): ExpectedPositionedBind[] {
  return [
    {
      name: "provider.email",
      positions: [1],
      expectedValues: [AUTH_ACCEPTANCE_EMAIL],
    },
    {
      name: "displayName",
      positions: [2],
      expectedValues: [AUTH_ACCEPTANCE_DISPLAY_NAME],
    },
    {
      name: "provider.subject",
      positions: [3],
      expectedValues: [AUTH_ACCEPTANCE_PROVIDER_ID],
    },
    { name: "isBanned", positions: [4], expectedValues: [false] },
    {
      name: "deletionRequestedAt",
      positions: [5],
      expectedValues: [null],
    },
    { name: "prisma.updatedAt", positions: [6], expectedKinds: ["date"] },
    { name: "user.id", positions: [7], expectedValues: [userId] },
  ];
}

function authAcceptanceRestoreAuditBinds(
  userId: string,
  metadata: unknown,
): ExpectedPositionedBind[] {
  return [
    { name: "user.id.actor", positions: [1], expectedValues: [userId] },
    {
      name: "actorType",
      positions: [2],
      expectedValues: ["user"],
      allowSqlTextMatch: true,
    },
    {
      name: "action",
      positions: [3],
      expectedValues: ["user.delete.restore"],
    },
    {
      name: "targetType",
      positions: [4],
      expectedValues: ["user"],
      allowSqlTextMatch: true,
    },
    { name: "user.id.target", positions: [5], expectedValues: [userId] },
    { name: "audit.metadata", positions: [6], expectedValues: [metadata] },
    { name: "prisma.createdAt", positions: [7], expectedKinds: ["date"] },
  ];
}

function authAcceptanceRestoreAuditParameters(
  event: DisposableReplayQueryEvent,
  userId: string,
) {
  const firstFive = [
    userId,
    "user",
    "user.delete.restore",
    "user",
    userId,
  ];
  const prefix = `${JSON.stringify(firstFive).slice(0, -1)},"{"restoredAt":"`;
  assert.ok(
    event.params.startsWith(prefix) && event.params.endsWith('"]'),
    "Observed restoration AuditLog parameters must match the reviewed prefix",
  );
  const tail = event.params.slice(prefix.length);
  const separator = '"}","';
  const separatorIndex = tail.lastIndexOf(separator);
  assert.ok(
    separatorIndex > 0,
    "Observed restoration AuditLog parameters must separate metadata and createdAt",
  );
  const restoredAt = tail.slice(0, separatorIndex);
  const createdAt = tail.slice(separatorIndex + separator.length, -2);
  assert.ok(
    Number.isFinite(new Date(restoredAt).getTime()),
    "Observed restoration metadata timestamp must be a date",
  );
  assert.ok(
    Number.isFinite(new Date(createdAt).getTime()),
    "Observed restoration AuditLog createdAt must be a date",
  );
  return [
    ...firstFive,
    JSON.stringify({ restoredAt }),
    createdAt,
  ];
}

function accountDeletionAuditExpectedBinds(
  userId: string,
  requestedAt: Date,
): ExpectedPositionedBind[] {
  return [
    { name: "current.dbUserId.actor", positions: [1], expectedValues: [userId] },
    {
      name: "actorType",
      positions: [2],
      expectedValues: ["user"],
      allowSqlTextMatch: true,
    },
    { name: "action", positions: [3], expectedValues: ["user.delete"] },
    {
      name: "targetType",
      positions: [4],
      expectedValues: ["user"],
      allowSqlTextMatch: true,
    },
    { name: "current.dbUserId.target", positions: [5], expectedValues: [userId] },
    { name: "request.ip", positions: [6], expectedValues: [null] },
    { name: "request.userAgent", positions: [7], expectedValues: [null] },
    {
      name: "audit.metadata",
      positions: [8],
      expectedValues: [accountDeletionAuditMetadata(requestedAt)],
    },
    { name: "prisma.createdAt", positions: [9], expectedKinds: ["date"] },
  ];
}

function accountDeletionAuditParameters(
  event: DisposableReplayQueryEvent,
  userId: string,
  requestedAt: Date,
) {
  const metadata = accountDeletionAuditMetadata(requestedAt);
  const firstSeven = [
    userId,
    "user",
    "user.delete",
    "user",
    userId,
    null,
    null,
  ];
  const prefix = `${JSON.stringify(firstSeven).slice(0, -1)},"${metadata}",`;
  assert.ok(
    event.params.startsWith(prefix) && event.params.endsWith("]"),
    "Observed AuditLog parameters must match the reviewed synthetic prefix",
  );
  const createdAt = JSON.parse(event.params.slice(prefix.length, -1)) as unknown;
  assert.ok(
    typeof createdAt === "string" && Number.isFinite(new Date(createdAt).getTime()),
    "Observed AuditLog createdAt must be a date string",
  );
  return [...firstSeven, metadata, createdAt];
}

function exactObservedTableStatement(
  queries: readonly DisposableReplayQueryEvent[],
  statementType: "UPDATE" | "INSERT",
  table:
    | "AuditLog"
    | "Conversation"
    | "ExportArtifact"
    | "MediaAsset"
    | "Profile"
    | "SignupOutbox"
    | "SocialActor"
    | "User"
    | "UserBlock"
    | "WebhookEvent",
) {
  const marker = statementType === "UPDATE"
    ? `UPDATE "public"."${table}"`
    : `INSERT INTO "public"."${table}"`;
  const candidates = queries.filter((event) => {
    const sql = normalizeObservedSql(event.query);
    return sql.startsWith(marker);
  });
  assert.equal(
    candidates.length,
    1,
    `Expected exactly one observed ${statementType} ${table} statement, received ${candidates.length}`,
  );
  return candidates[0];
}

function exactObservedUserBlockUniqueLookup(
  queries: readonly DisposableReplayQueryEvent[],
) {
  const candidates = queries.filter((event) => {
    const sql = normalizeObservedSql(event.query);
    return (
      sql.startsWith(
        'SELECT "public"."UserBlock"."id" FROM "public"."UserBlock" ',
      ) &&
      sql.includes('"public"."UserBlock"."blockerProfileId" = $1') &&
      sql.includes('"public"."UserBlock"."blockedProfileId" = $2')
    );
  });
  assert.equal(
    candidates.length,
    1,
    `Expected exactly one observed UserBlock unique-pair lookup, received ${candidates.length}`,
  );
  return candidates[0];
}

function exactObservedSignupOutboxClaim(
  queries: readonly DisposableReplayQueryEvent[],
) {
  const candidates = queries.filter((event) => {
    const sql = normalizeObservedSql(event.query);
    return (
      /^WITH candidates AS\b/i.test(sql) &&
      sql.includes('UPDATE "SignupOutbox" AS outbox') &&
      sql.includes("FOR UPDATE SKIP LOCKED") &&
      sql.includes('"retryCount" = outbox."retryCount" + 1')
    );
  });
  assert.equal(
    candidates.length,
    1,
    `Expected exactly one observed SignupOutbox claim statement, received ${candidates.length}`,
  );
  return candidates[0];
}

function exactObservedSignupOutboxExpiredDeadLetter(
  queries: readonly DisposableReplayQueryEvent[],
) {
  const candidates = queries.filter((event) => {
    const sql = normalizeObservedSql(event.query);
    return (
      /^WITH candidates AS\b/i.test(sql) &&
      sql.includes('UPDATE "SignupOutbox" AS outbox') &&
      sql.includes("FOR UPDATE SKIP LOCKED") &&
      sql.includes('"status" = \'dead_letter\'') &&
      sql.includes("signup.attempts_exhausted")
    );
  });
  assert.equal(
    candidates.length,
    1,
    `Expected exactly one bounded expired SignupOutbox dead-letter statement, received ${candidates.length}`,
  );
  return candidates[0];
}

function exactObservedSignupOutboxSettlement(
  queries: readonly DisposableReplayQueryEvent[],
  status: "sent" | "pending" | "dead_letter",
) {
  const marker = `"status" = '${status}'`;
  const candidates = queries.filter((event) => {
    const sql = normalizeObservedSql(event.query);
    return (
      sql.startsWith('UPDATE "SignupOutbox" SET ') &&
      sql.includes(marker) &&
      sql.includes('AND "status" = \'processing\'') &&
      sql.includes('AND "leaseToken" = $')
    );
  });
  assert.equal(
    candidates.length,
    1,
    `Expected exactly one observed SignupOutbox ${status} settlement, received ${candidates.length}`,
  );
  return candidates[0];
}

async function withLockedSignupOutboxClaimProbe<T>(
  withDbSystemContext: TransactionRunner,
  operation: () => Promise<T>,
) {
  let markLocked!: () => void;
  let rejectLock!: (error: unknown) => void;
  const locked = new Promise<void>((resolve, reject) => {
    markLocked = resolve;
    rejectLock = reject;
  });
  let releaseLock!: () => void;
  const released = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const lockTransaction = withDbSystemContext(async (tx) => {
    try {
      const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "SignupOutbox" WHERE "id" = $1 FOR UPDATE',
        SIGNUP_OUTBOX_CLAIM_PROBE_ID,
      );
      assert.deepEqual(rows, [{ id: SIGNUP_OUTBOX_CLAIM_PROBE_ID }]);
      markLocked();
      await released;
    } catch (error) {
      rejectLock(error);
      throw error;
    }
  });
  await locked;
  try {
    return await operation();
  } finally {
    releaseLock();
    await lockTransaction;
  }
}

function assertPendingSignupOutboxProbe(
  probe: Awaited<ReturnType<typeof collectSignupOutboxClaimProbe>>,
) {
  assert.equal(probe.id, SIGNUP_OUTBOX_CLAIM_PROBE_ID);
  assert.equal(probe.status, "pending");
  assert.equal(probe.retryCount, 0);
  assert.equal(probe.lastAttemptAt, null);
  assert.equal(probe.leaseExpiresAt, null);
  assert.equal(probe.leaseToken, null);
  assert.equal(probe.deadLetteredAt, null);
  assert.equal(probe.lastErrorCode, null);
}

function assertProcessingSignupOutboxProbe(
  probe: Awaited<ReturnType<typeof collectSignupOutboxClaimProbe>>,
  leaseToken: string,
) {
  assert.equal(probe.id, SIGNUP_OUTBOX_CLAIM_PROBE_ID);
  assert.equal(probe.status, "processing");
  assert.equal(probe.retryCount, 1);
  assert.equal(probe.leaseToken, leaseToken);
  assert.ok(probe.leaseExpiresAt instanceof Date);
  assert.equal(probe.sentAt, null);
  assert.equal(probe.deadLetteredAt, null);
  assert.equal(probe.lastErrorCode, null);
}

function assertPendingSignupOutboxExpiredProbe(
  probe: Awaited<ReturnType<typeof collectSignupOutboxExpiredProbe>>,
) {
  assert.equal(probe.status, "pending");
  assert.equal(probe.retryCount, SIGNUP_OUTBOX_CLAIM_MAX_ATTEMPTS);
  assert.equal(probe.leaseToken, null);
  assert.equal(probe.leaseExpiresAt, null);
  assert.equal(probe.deadLetteredAt, null);
  assert.equal(probe.lastErrorCode, null);
}

function assertDeadLetteredSignupOutboxExpiredProbe(
  probe: Awaited<ReturnType<typeof collectSignupOutboxExpiredProbe>>,
) {
  assert.equal(probe.status, "dead_letter");
  assert.equal(probe.retryCount, SIGNUP_OUTBOX_CLAIM_MAX_ATTEMPTS);
  assert.equal(probe.leaseToken, null);
  assert.equal(probe.leaseExpiresAt, null);
  assert.equal(
    probe.deadLetteredAt?.toISOString(),
    SIGNUP_OUTBOX_CLAIM_NOW.toISOString(),
  );
  assert.equal(probe.lastErrorCode, "signup.attempts_exhausted");
}

async function proveSignupOutboxSettlementGuards(
  withDbSystemContext: TransactionRunner,
  withDbRequestContext: typeof import("../src/lib/db-context").withDbRequestContext,
  current: CurrentUserProfile,
  observed: ObservedSqlEvidence,
  leaseToken: string,
  rollbackMarker: string,
) {
  const denied = await withDbRequestContext(current, (tx) =>
    tx.$executeRawUnsafe(observed.normalizedSql, ...observed.parameters),
  );
  assert.equal(denied, 0);
  assertProcessingSignupOutboxProbe(
    await withDbSystemContext(collectSignupOutboxClaimProbe),
    leaseToken,
  );
  await expectExactOperationError(
    () =>
      withDbSystemContext(async (tx) => {
        const updated = await tx.$executeRawUnsafe(
          observed.normalizedSql,
          ...observed.parameters,
        );
        assert.equal(updated, 1);
        throw new Error(rollbackMarker);
      }),
    rollbackMarker,
  );
  assertProcessingSignupOutboxProbe(
    await withDbSystemContext(collectSignupOutboxClaimProbe),
    leaseToken,
  );
}

function assertMutationTransaction(
  queries: readonly DisposableReplayQueryEvent[],
  first: DisposableReplayQueryEvent,
  second: DisposableReplayQueryEvent,
) {
  const firstIndex = queries.indexOf(first);
  const secondIndex = queries.indexOf(second);
  assert.ok(firstIndex >= 0 && secondIndex > firstIndex, "Mutation query order");
  const beginIndex = queries.findLastIndex(
    (event, index) =>
      index < firstIndex && /^BEGIN\b/i.test(normalizeObservedSql(event.query)),
  );
  const commitOffset = queries
    .slice(secondIndex + 1)
    .findIndex((event) => /^COMMIT\b/i.test(normalizeObservedSql(event.query)));
  assert.ok(beginIndex >= 0, "Mutation pair must follow BEGIN");
  assert.ok(commitOffset >= 0, "Mutation pair must precede COMMIT");
  const commitIndex = secondIndex + 1 + commitOffset;
  assert.ok(
    queries
      .slice(beginIndex + 1, commitIndex)
      .every((event) => !/^(?:COMMIT|ROLLBACK)\b/i.test(normalizeObservedSql(event.query))),
    "Mutation pair must remain inside one transaction",
  );
}

function assertAdminAccessLockCaptured(
  queries: readonly DisposableReplayQueryEvent[],
) {
  const lockStatements = queries.filter((event) =>
    normalizeObservedSql(event.query).includes(
      "pg_advisory_xact_lock(hashtext('greyhoundiq:admin-access-update'))",
    ),
  );
  assert.equal(
    lockStatements.length,
    1,
    "Account deletion must retain the admin-access advisory lock",
  );
}

function assertSystemContextCaptured(
  queries: readonly DisposableReplayQueryEvent[],
) {
  const contextStatements = queries.filter((event) => {
    const sql = normalizeObservedSql(event.query);
    return (
      sql.includes("set_config('app.system', 'true', true)") &&
      sql.includes("set_config('app.current_tier', 'system', true)") &&
      sql.includes("set_config('app.current_role', 'system', true)")
    );
  });
  assert.equal(
    contextStatements.length,
    1,
    "Auth acceptance transaction must set exactly one local system context",
  );
}

function assertStatementTransactionOutcome(
  queries: readonly DisposableReplayQueryEvent[],
  statement: DisposableReplayQueryEvent,
  expectedOutcome: "COMMIT" | "ROLLBACK",
) {
  const statementIndex = queries.indexOf(statement);
  assert.ok(statementIndex >= 0, "Observed mutation must be in the capture");
  const beginIndex = queries.findLastIndex(
    (event, index) =>
      index < statementIndex && /^BEGIN\b/i.test(normalizeObservedSql(event.query)),
  );
  assert.ok(beginIndex >= 0, "Observed mutation must follow BEGIN");
  const terminator = queries
    .slice(statementIndex + 1)
    .find((event) => /^(?:COMMIT|ROLLBACK)\b/i.test(normalizeObservedSql(event.query)));
  assert.ok(terminator, "Observed mutation transaction must terminate");
  assert.equal(normalizeObservedSql(terminator.query), expectedOutcome);
}

function observedStatementEvidence(
  event: DisposableReplayQueryEvent,
  statementType: "SELECT" | "UPDATE" | "INSERT" | "WITH",
  expectedBinds: readonly ExpectedPositionedBind[],
  knownParameters?: readonly unknown[],
): ObservedSqlEvidence {
  const normalizedSql = normalizeObservedSql(event.query);
  assert.match(
    normalizedSql,
    new RegExp(`^${statementType}\\b`, "i"),
    `Observed statement must be ${statementType}`,
  );
  assert.doesNotMatch(
    normalizedSql,
    /;|--|\/\*/,
    `Observed ${statementType} must contain one uncommented statement`,
  );
  const parsed = knownParameters
    ? [...knownParameters]
    : JSON.parse(event.params) as unknown;
  assert.ok(Array.isArray(parsed), "Observed Prisma parameters must be an array");
  const parameters = parsed as unknown[];
  const explainParameters = [...parameters];
  const positions = expectedBinds.flatMap((bind) => bind.positions);
  assert.deepEqual(
    [...positions].sort((left, right) => left - right),
    Array.from({ length: parameters.length }, (_, index) => index + 1),
    "Reviewed named binds must cover every observed parameter position",
  );
  assert.deepEqual(
    [...new Set([...normalizedSql.matchAll(/\$(\d+)\b/g)].map((match) => Number(match[1])))]
      .sort((left, right) => left - right),
    Array.from({ length: parameters.length }, (_, index) => index + 1),
    "Observed mutation placeholders must cover every parameter position",
  );
  for (const bind of expectedBinds) {
    assert.equal(
      bind.expectedValues?.length ?? bind.expectedKinds?.length,
      bind.positions.length,
      `Reviewed expectation count for ${bind.name}`,
    );
    bind.positions.forEach((position, index) => {
      const parameter = parameters[position - 1];
      if (bind.expectedValues) {
        assert.deepEqual(
          parameter,
          bind.expectedValues[index],
          `Observed value mismatch for ${bind.name} at $${position}`,
        );
        if (typeof parameter === "string" && !bind.allowSqlTextMatch) {
          assert.ok(
            !normalizedSql.includes(parameter),
            `Observed SQL must not inline ${bind.name}`,
          );
        }
      } else {
        explainParameters[position - 1] = observedTypedParameter(
          parameter,
          bind.expectedKinds?.[index],
          `${bind.name} at $${position}`,
        );
      }
    });
  }
  return {
    normalizedSql,
    parameters: explainParameters,
    evidence: {
      statementType,
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

function observedTypedParameter(
  value: unknown,
  expected: "cuid" | "date" | "uuid" | undefined,
  label: string,
) {
  if (expected === "date") return observedDateParameter(value, expected, label);
  if (expected === "cuid") {
    assert.ok(
      typeof value === "string" && CUID_PATTERN.test(value),
      `Observed ${label} must be a CUID parameter`,
    );
    return value;
  }
  assert.equal(expected, "uuid", `Unsupported observed parameter kind for ${label}`);
  assert.ok(
    typeof value === "string" && UUID_PATTERN.test(value),
    `Observed ${label} must be a UUID parameter`,
  );
  return value;
}

function observedDateParameter(
  value: unknown,
  expected: "date" | undefined,
  label: string,
) {
  assert.equal(expected, "date", `Unsupported observed parameter kind for ${label}`);
  const dateValue =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? (value as Record<string, unknown>).prisma__value
        : null;
  assert.ok(
    typeof dateValue === "string" &&
      Number.isFinite(new Date(dateValue).getTime()),
    `Observed ${label} must be a date parameter`,
  );
  return new Date(dateValue);
}

function normalizeObservedSql(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function explainObservedStatement(
  withDbRequestContext: typeof import("../src/lib/db-context").withDbRequestContext,
  current: CurrentUserProfile,
  observed: ObservedSqlEvidence,
) {
  return explainObservedWithRunner(
    (fn) => withDbRequestContext(current, fn),
    observed,
  );
}

async function explainObservedSystemStatement(
  withDbSystemContext: TransactionRunner,
  observed: ObservedSqlEvidence,
) {
  return explainObservedWithRunner(withDbSystemContext, observed);
}

async function explainObservedWithRunner(
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
  assert.ok(Array.isArray(value) && value.length === 1, "EXPLAIN must return one row");
  const row = plainObject(value[0], "EXPLAIN row");
  const rawQueryPlan = row["QUERY PLAN"];
  const queryPlan = typeof rawQueryPlan === "string"
    ? JSON.parse(rawQueryPlan) as unknown
    : rawQueryPlan;
  assert.ok(
    Array.isArray(queryPlan) && queryPlan.length === 1,
    "EXPLAIN JSON must contain one plan",
  );
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
  assert.ok(Array.isArray(children), "EXPLAIN plan children must be an array");
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

function demoCurrentUser(
  account: (typeof DEMO_FIXTURE_MANIFEST.accounts)[number],
): CurrentUserProfile {
  return {
    id: account.userId,
    dbUserId: account.userId,
    profileId: account.profileId,
    email: account.email,
    firstName: null,
    lastName: null,
    name: account.displayName,
    displayName: account.displayName,
    tier: account.tier,
    role: account.role,
    profileRole: account.role,
    verified: account.verified,
    isBanned: false,
    deletionRequestedAt: null,
  };
}

async function expectExactOperationError(
  operation: () => Promise<unknown>,
  expectedMessage: string,
) {
  let failure: unknown;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof Error, `${expectedMessage} must reject`);
  assert.equal(failure.message, expectedMessage);
}

async function expectOperationFailure(
  operation: () => Promise<unknown>,
  label: string,
) {
  let failure: unknown;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof Error, `${label} must reject`);
  return failure;
}

async function collectDatabaseOperationRowCounts(tx: DbContextClient) {
  const adminProfileId = DEMO_FIXTURE_MANIFEST.accounts[0].profileId;
  const blockedProfileId = DEMO_FIXTURE_MANIFEST.accounts[1].profileId;
  const [
    User,
    Conversation,
    MediaAsset,
    MediaDeleteAuditLog,
    AccountDeletionAuditLog,
    UserBlock,
    ConversationBlockAuditLog,
    SignupOutbox,
  ] = await Promise.all([
    tx.user.count({
      where: {
        id: { in: DEMO_FIXTURE_MANIFEST.accounts.map((account) => account.userId) },
      },
    }),
    tx.conversation.count({
      where: { id: DEMO_FIXTURE_MANIFEST.conversation.id },
    }),
    tx.mediaAsset.count({
      where: {
        id: {
          in: DEMO_FIXTURE_MANIFEST.pageMedia.map((asset) => asset.id),
        },
      },
    }),
    tx.auditLog.count({ where: mediaDeleteAuditWhere() }),
    tx.auditLog.count({
      where: accountDeletionAuditWhere(DEMO_FIXTURE_MANIFEST.accounts[1].userId),
    }),
    tx.userBlock.count({
      where: {
        blockerProfileId: adminProfileId,
        blockedProfileId,
      },
    }),
    tx.auditLog.count({ where: conversationBlockAuditWhere() }),
    tx.signupOutbox.count({
      where: {
        id: {
          in: [
            SIGNUP_OUTBOX_CLAIM_PROBE_ID,
            SIGNUP_OUTBOX_EXPIRED_PROBE_ID,
          ],
        },
      },
    }),
  ]);
  return {
    User,
    Conversation,
    MediaAsset,
    MediaDeleteAuditLog,
    AccountDeletionAuditLog,
    UserBlock,
    ConversationBlockAuditLog,
    SignupOutbox,
  };
}

async function setupSignupOutboxProbes(
  tx: DbContextClient,
  claimUserId: string,
  expiredUserId: string,
) {
  const collisionCount = await tx.signupOutbox.count({
    where: {
      OR: [
        {
          id: {
            in: [
              SIGNUP_OUTBOX_CLAIM_PROBE_ID,
              SIGNUP_OUTBOX_EXPIRED_PROBE_ID,
            ],
          },
        },
        {
          idempotencyKey: {
            in: [
              SIGNUP_OUTBOX_CLAIM_IDEMPOTENCY_KEY,
              SIGNUP_OUTBOX_EXPIRED_IDEMPOTENCY_KEY,
            ],
          },
        },
        { userId: { in: [claimUserId, expiredUserId] } },
      ],
    },
  });
  assert.equal(
    collisionCount,
    0,
    "The disposable verifier must not contain a colliding SignupOutbox claim probe",
  );
  await tx.signupOutbox.createMany({
    data: [
      {
        id: SIGNUP_OUTBOX_CLAIM_PROBE_ID,
        userId: claimUserId,
        idempotencyKey: SIGNUP_OUTBOX_CLAIM_IDEMPOTENCY_KEY,
        correlationId: "demo-signup-outbox-claim-correlation",
        status: "pending",
        retryCount: 0,
        nextRetryAt: SIGNUP_OUTBOX_CLAIM_NOW,
        createdAt: SIGNUP_OUTBOX_CLAIM_NOW,
        updatedAt: SIGNUP_OUTBOX_CLAIM_NOW,
      },
      {
        id: SIGNUP_OUTBOX_EXPIRED_PROBE_ID,
        userId: expiredUserId,
        idempotencyKey: SIGNUP_OUTBOX_EXPIRED_IDEMPOTENCY_KEY,
        correlationId: "demo-signup-outbox-expired-correlation",
        status: "pending",
        retryCount: SIGNUP_OUTBOX_CLAIM_MAX_ATTEMPTS,
        nextRetryAt: SIGNUP_OUTBOX_CLAIM_NOW,
        createdAt: SIGNUP_OUTBOX_CLAIM_NOW,
        updatedAt: SIGNUP_OUTBOX_CLAIM_NOW,
      },
    ],
  });
}

async function collectSignupOutboxClaimProbe(tx: DbContextClient) {
  return tx.signupOutbox.findUniqueOrThrow({
    where: { id: SIGNUP_OUTBOX_CLAIM_PROBE_ID },
    select: {
      id: true,
      userId: true,
      idempotencyKey: true,
      correlationId: true,
      status: true,
      retryCount: true,
      lastAttemptAt: true,
      nextRetryAt: true,
      leaseExpiresAt: true,
      leaseToken: true,
      sentAt: true,
      deadLetteredAt: true,
      lastErrorCode: true,
    },
  });
}

async function collectSignupOutboxExpiredProbe(tx: DbContextClient) {
  return tx.signupOutbox.findUniqueOrThrow({
    where: { id: SIGNUP_OUTBOX_EXPIRED_PROBE_ID },
    select: {
      status: true,
      retryCount: true,
      leaseToken: true,
      leaseExpiresAt: true,
      deadLetteredAt: true,
      lastErrorCode: true,
    },
  });
}

function resetSignupOutboxExpiredProbe(tx: DbContextClient) {
  return tx.signupOutbox.update({
    where: { id: SIGNUP_OUTBOX_EXPIRED_PROBE_ID },
    data: {
      status: "pending",
      leaseToken: null,
      leaseExpiresAt: null,
      deadLetteredAt: null,
      lastErrorCode: null,
    },
  });
}

async function resetSignupOutboxForSettlement(
  tx: DbContextClient,
  leaseToken: string,
) {
  assert.match(leaseToken, UUID_PATTERN);
  const leaseExpiresAt = new Date(
    SIGNUP_OUTBOX_CLAIM_NOW.getTime() + SIGNUP_OUTBOX_CLAIM_LEASE_MS,
  );
  await tx.signupOutbox.update({
    where: { id: SIGNUP_OUTBOX_CLAIM_PROBE_ID },
    data: {
      status: "processing",
      retryCount: 1,
      lastAttemptAt: SIGNUP_OUTBOX_CLAIM_NOW,
      nextRetryAt: SIGNUP_OUTBOX_CLAIM_NOW,
      leaseExpiresAt,
      leaseToken,
      sentAt: null,
      deadLetteredAt: null,
      lastErrorCode: null,
      updatedAt: SIGNUP_OUTBOX_CLAIM_NOW,
    },
  });
  return signupOutboxSettlementClaim(leaseToken, leaseExpiresAt);
}

function signupOutboxSettlementClaim(
  leaseToken: string,
  leaseExpiresAt: Date,
) {
  return {
    id: SIGNUP_OUTBOX_CLAIM_PROBE_ID,
    userId: DEMO_FIXTURE_MANIFEST.accounts[0].userId,
    idempotencyKey: SIGNUP_OUTBOX_CLAIM_IDEMPOTENCY_KEY,
    correlationId: "demo-signup-outbox-claim-correlation",
    attempt: 1,
    leaseToken,
    leaseExpiresAt,
  } as const;
}

async function collectConversationBlockState(tx: DbContextClient) {
  const adminProfileId = DEMO_FIXTURE_MANIFEST.accounts[0].profileId;
  const blockedProfileId = DEMO_FIXTURE_MANIFEST.accounts[1].profileId;
  const [conversation, userBlocks, auditCount] = await Promise.all([
    tx.conversation.findUniqueOrThrow({
      where: { id: DEMO_FIXTURE_MANIFEST.conversation.id },
      select: { blockedById: true, blockedAt: true },
    }),
    tx.userBlock.findMany({
      where: { blockerProfileId: adminProfileId, blockedProfileId },
      select: {
        id: true,
        blockerProfileId: true,
        blockedProfileId: true,
        createdAt: true,
      },
    }),
    tx.auditLog.count({ where: conversationBlockAuditWhere() }),
  ]);
  return { conversation, userBlocks, auditCount };
}

async function collectMediaDeleteState(tx: DbContextClient, mediaId: string) {
  const [media, activeCount, tombstoneCount, auditCount, feedPostMediaCount] =
    await Promise.all([
      tx.mediaAsset.findUniqueOrThrow({
        where: { id: mediaId },
        select: { id: true, uploaderId: true, deletedAt: true },
      }),
      tx.mediaAsset.count({ where: { id: mediaId, deletedAt: null } }),
      tx.mediaAsset.count({ where: { id: mediaId, deletedAt: { not: null } } }),
      tx.auditLog.count({ where: mediaDeleteAuditWhere() }),
      tx.feedPostMedia.count({ where: { mediaId } }),
    ]);
  return { media, activeCount, tombstoneCount, auditCount, feedPostMediaCount };
}

async function collectAccountDeletionState(
  tx: DbContextClient,
  userId: string,
) {
  const [user, auditLogs] = await Promise.all([
    tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isBanned: true,
        deletionRequestedAt: true,
      },
    }),
    tx.auditLog.findMany({
      where: accountDeletionAuditWhere(userId),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        actorId: true,
        actorType: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
      },
    }),
  ]);
  return { user, auditLogs };
}

async function collectAuthAcceptanceState(
  tx: DbContextClient,
  providerId: string,
  email: string,
) {
  const users = await tx.user.findMany({
    where: { OR: [{ workosUserId: providerId }, { email }] },
    orderBy: { id: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      subscriptionTier: true,
      isBanned: true,
      deletionRequestedAt: true,
      workosUserId: true,
    },
  });
  const userIds = users.map((user) => user.id);
  const profiles = userIds.length === 0
    ? []
    : await tx.profile.findMany({
        where: { userId: { in: userIds } },
        orderBy: { id: "asc" },
        select: {
          id: true,
          userId: true,
          displayName: true,
          role: true,
        },
      });
  const profileIds = profiles.map((profile) => profile.id);
  const actors = profileIds.length === 0
    ? []
    : await tx.socialActor.findMany({
        where: { profileId: { in: profileIds } },
        orderBy: { id: "asc" },
        select: {
          id: true,
          profileId: true,
          ownerProfileId: true,
          handle: true,
          displayName: true,
          published: true,
        },
      });
  const outboxes = userIds.length === 0
    ? []
    : await tx.signupOutbox.findMany({
        where: { userId: { in: userIds } },
        orderBy: { id: "asc" },
        select: {
          id: true,
          userId: true,
          idempotencyKey: true,
          status: true,
        },
      });
  return {
    userCount: users.length,
    profileCount: profiles.length,
    actorCount: actors.length,
    outboxCount: outboxes.length,
    user: users[0] ?? null,
    profile: profiles[0] ?? null,
    actor: actors[0] ?? null,
    outbox: outboxes[0] ?? null,
  };
}

function assertAuthAcceptanceCounts(
  state: Awaited<ReturnType<typeof collectAuthAcceptanceState>>,
  expected: 0 | 1,
) {
  assert.deepEqual(
    {
      user: state.userCount,
      profile: state.profileCount,
      actor: state.actorCount,
      outbox: state.outboxCount,
    },
    { user: expected, profile: expected, actor: expected, outbox: expected },
  );
}

async function collectUnverifiedAuthLinkState(
  tx: DbContextClient,
  email: string,
) {
  const [existingUser, providerSubjectCount] = await Promise.all([
    tx.user.findUniqueOrThrow({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        workosUserId: true,
        isBanned: true,
        deletionRequestedAt: true,
      },
    }),
    tx.user.count({
      where: { workosUserId: AUTH_ACCEPTANCE_UNVERIFIED_PROVIDER_ID },
    }),
  ]);
  return { existingUser, providerSubjectCount };
}

function accountDeletionAuditMetadata(requestedAt: Date) {
  return JSON.stringify({
    status: "requested",
    graceDays: 30,
    requestedAt: requestedAt.toISOString(),
  });
}

function conversationBlockAuditWhere() {
  return {
    actorId: DEMO_FIXTURE_MANIFEST.accounts[0].userId,
    action: { in: ["conversation.block", "conversation.unblock"] },
    targetType: "conversation",
    targetId: DEMO_FIXTURE_MANIFEST.conversation.id,
  };
}

function mediaDeleteAuditWhere() {
  return {
    actorId: DEMO_FIXTURE_MANIFEST.accounts[0].userId,
    action: "media.delete",
    targetType: "media",
    targetId: DEMO_FIXTURE_MANIFEST.pageMedia[0].id,
  };
}

function accountDeletionAuditWhere(userId: string) {
  return {
    actorId: userId,
    action: "user.delete",
    targetType: "user",
    targetId: userId,
  };
}

function authAcceptanceRestoreAuditWhere(userId: string) {
  return {
    actorId: userId,
    action: "user.delete.restore",
    targetType: "user",
    targetId: userId,
  };
}

async function collectFixtureSnapshot(tx: DbContextClient) {
  const accounts = DEMO_FIXTURE_MANIFEST.accounts;
  const userIds = accounts.map((account) => account.userId);
  const profileIds = accounts.map((account) => account.profileId);
  const actorIds = [
    ...accounts.map((account) => account.actorId),
    DEMO_FIXTURE_MANIFEST.page.actorId,
  ];
  const mediaIds = DEMO_FIXTURE_MANIFEST.pageMedia.map((asset) => asset.id);
  const [
    User,
    Profile,
    SocialActor,
    Friendship,
    CustomPage,
    MediaAsset,
    ActorGalleryMedia,
    Thread,
    Post,
    Conversation,
    ConversationParticipant,
    Message,
    Listing,
    ListingLocation,
    ListingSearchIndex,
    ListingStatusHistory,
    ForumCategory,
  ] = await Promise.all([
    tx.user.findMany({ where: { id: { in: userIds } } }),
    tx.profile.findMany({ where: { id: { in: profileIds } } }),
    tx.socialActor.findMany({ where: { id: { in: actorIds } } }),
    tx.friendship.findMany({
      where: { id: DEMO_FIXTURE_MANIFEST.friendship.id },
    }),
    tx.customPage.findMany({ where: { id: DEMO_FIXTURE_MANIFEST.page.id } }),
    tx.mediaAsset.findMany({ where: { id: { in: mediaIds } } }),
    tx.actorGalleryMedia.findMany({
      where: { actorId: DEMO_FIXTURE_MANIFEST.page.actorId },
    }),
    tx.thread.findMany({
      where: { id: DEMO_FIXTURE_MANIFEST.community.threadId },
    }),
    tx.post.findMany({
      where: { id: DEMO_FIXTURE_MANIFEST.community.postId },
    }),
    tx.conversation.findMany({
      where: { id: DEMO_FIXTURE_MANIFEST.conversation.id },
    }),
    tx.conversationParticipant.findMany({
      where: {
        id: { in: [...DEMO_FIXTURE_MANIFEST.conversation.participantIds] },
      },
    }),
    tx.message.findMany({
      where: { id: DEMO_FIXTURE_MANIFEST.conversation.messageId },
    }),
    tx.listing.findMany({ where: { id: DEMO_FIXTURE_MANIFEST.listing.id } }),
    tx.listingLocation.findMany({
      where: { id: DEMO_FIXTURE_MANIFEST.listing.locationId },
    }),
    tx.listingSearchIndex.findMany({
      where: { listingId: DEMO_FIXTURE_MANIFEST.listing.id },
    }),
    tx.listingStatusHistory.findMany({
      where: { id: DEMO_FIXTURE_MANIFEST.listing.historyId },
    }),
    tx.forumCategory.findMany({
      where: { id: DEMO_FIXTURE_MANIFEST.community.categoryId },
    }),
  ]);
  const privateRows = {
    User,
    Profile,
    SocialActor,
    Friendship,
    CustomPage,
    MediaAsset,
    ActorGalleryMedia,
    Thread,
    Post,
    Conversation,
    ConversationParticipant,
    Message,
    Listing,
    ListingLocation,
    ListingSearchIndex,
    ListingStatusHistory,
  };
  const modelCounts = Object.fromEntries(
    Object.entries(privateRows).map(([model, rows]) => [model, rows.length]),
  );
  const privateRowCount = Object.values(modelCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const fixturePayload = canonicalize(
    { privateRows, referenceRows: { ForumCategory } },
    new Set(["updatedAt"]),
  );
  return {
    modelCounts,
    privateRowCount,
    referenceRowCount: ForumCategory.length,
    fixtureSha256: sha256(JSON.stringify(fixturePayload)),
  };
}

async function collectProviderSnapshot(tx: DbContextClient) {
  const [Dog, Track, Meeting, Race] = await Promise.all([
    tx.dog.findMany(),
    tx.track.findMany(),
    tx.meeting.findMany(),
    tx.race.findMany(),
  ]);
  const rows = canonicalize(
    { Dog, Track, Meeting, Race },
    new Set(["updatedAt"]),
  );
  return {
    counts: {
      Dog: Dog.length,
      Track: Track.length,
      Meeting: Meeting.length,
      Race: Race.length,
    },
    rowsSha256: sha256(JSON.stringify(rows)),
  };
}

function assertCompleteFixture(snapshot: FixtureSnapshot) {
  assert.equal(snapshot.privateRowCount, DEMO_PRIVATE_FIXTURE_ROW_COUNT);
  assert.equal(snapshot.referenceRowCount, 1);
  assert.deepEqual(snapshot.modelCounts, DEMO_FIXTURE_EXPECTED_MODEL_COUNTS);
}

function evidenceSnapshot(snapshot: FixtureSnapshot) {
  return {
    privateRowCount: snapshot.privateRowCount,
    referenceRowCount: snapshot.referenceRowCount,
    modelCounts: snapshot.modelCounts,
    fixtureSha256: snapshot.fixtureSha256,
  };
}

async function cleanupVerifierRows(
  tx: DbContextClient,
  requireCompleteGraph: boolean,
) {
  const accounts = DEMO_FIXTURE_MANIFEST.accounts;
  const profileIds = accounts.map((account) => account.profileId);
  const userIds = accounts.map((account) => account.userId);
  const actorIds = [
    ...accounts.map((account) => account.actorId),
    DEMO_FIXTURE_MANIFEST.page.actorId,
  ];
  const mediaIds = DEMO_FIXTURE_MANIFEST.pageMedia.map((asset) => asset.id);
  const deleted: Record<string, number> = {};
  const authAcceptanceUsers = await tx.user.findMany({
    where: {
      OR: [
        {
          workosUserId: {
            in: [
              AUTH_ACCEPTANCE_PROVIDER_ID,
              AUTH_ACCEPTANCE_ROLLBACK_PROVIDER_ID,
              AUTH_ACCEPTANCE_UNVERIFIED_PROVIDER_ID,
            ],
          },
        },
        {
          email: {
            in: [AUTH_ACCEPTANCE_EMAIL, AUTH_ACCEPTANCE_ROLLBACK_EMAIL],
          },
        },
      ],
    },
    select: { id: true },
  });
  const authAcceptanceUserIds = authAcceptanceUsers.map((user) => user.id);
  const authAcceptanceProfiles = authAcceptanceUserIds.length === 0
    ? []
    : await tx.profile.findMany({
        where: { userId: { in: authAcceptanceUserIds } },
        select: { id: true },
      });
  const authAcceptanceProfileIds = authAcceptanceProfiles.map(
    (profile) => profile.id,
  );
  deleted.AuthAcceptanceRestoreAuditLog = authAcceptanceUserIds.length === 0
    ? 0
    : (await tx.auditLog.deleteMany({
        where: {
          actorId: { in: authAcceptanceUserIds },
          action: "user.delete.restore",
          targetType: "user",
          targetId: { in: authAcceptanceUserIds },
        },
      })).count;
  deleted.AuthAcceptanceSignupOutbox = authAcceptanceUserIds.length === 0
    ? 0
    : (await tx.signupOutbox.deleteMany({
        where: { userId: { in: authAcceptanceUserIds } },
      })).count;
  deleted.AuthAcceptanceSocialActor = authAcceptanceProfileIds.length === 0
    ? 0
    : (await tx.socialActor.deleteMany({
        where: { profileId: { in: authAcceptanceProfileIds } },
      })).count;
  deleted.AuthAcceptanceProfile = authAcceptanceUserIds.length === 0
    ? 0
    : (await tx.profile.deleteMany({
        where: { userId: { in: authAcceptanceUserIds } },
      })).count;
  deleted.AuthAcceptanceUser = authAcceptanceUserIds.length === 0
    ? 0
    : (await tx.user.deleteMany({
        where: { id: { in: authAcceptanceUserIds } },
      })).count;
  deleted.StripeWebhookOperationProbe = (await tx.webhookEvent.deleteMany({
    where: {
      provider: "stripe",
      lagoEventId: {
        in: [
          STRIPE_WEBHOOK_OPERATION_EVENT_ID,
          STRIPE_WEBHOOK_ROLLBACK_EVENT_ID,
        ],
      },
    },
  })).count;
  const userExportAccountIds = [accounts[1].userId];
  deleted.UserExportArtifact = (await tx.exportArtifact.deleteMany({
    where: {
      exportType: "user_data",
      status: "completed",
      targetUserId: { in: userExportAccountIds },
      requestedByUserId: { in: userExportAccountIds },
      organizationId: null,
      storageBucket: null,
      storagePath: null,
      sha256: null,
    },
  })).count;
  deleted.UserExportAuditLog = (await tx.auditLog.deleteMany({
    where: {
      OR: userExportAccountIds.map((userId) => userExportAuditWhere(userId)),
    },
  })).count;
  deleted.SignupOutbox = (await tx.signupOutbox.deleteMany({
    where: {
      OR: [
        {
          id: SIGNUP_OUTBOX_CLAIM_PROBE_ID,
          idempotencyKey: SIGNUP_OUTBOX_CLAIM_IDEMPOTENCY_KEY,
        },
        {
          id: SIGNUP_OUTBOX_EXPIRED_PROBE_ID,
          idempotencyKey: SIGNUP_OUTBOX_EXPIRED_IDEMPOTENCY_KEY,
        },
      ],
    },
  })).count;
  deleted.AccountDeletionAuditLog = (await tx.auditLog.deleteMany({
    where: accountDeletionAuditWhere(accounts[1].userId),
  })).count;
  deleted.MediaDeleteAuditLog = (await tx.auditLog.deleteMany({
    where: mediaDeleteAuditWhere(),
  })).count;
  deleted.ConversationBlockAuditLog = (await tx.auditLog.deleteMany({
    where: conversationBlockAuditWhere(),
  })).count;
  deleted.ListingStatusHistory = (await tx.listingStatusHistory.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.listing.historyId },
  })).count;
  deleted.ListingSearchIndex = (await tx.listingSearchIndex.deleteMany({
    where: { listingId: DEMO_FIXTURE_MANIFEST.listing.id },
  })).count;
  deleted.ListingLocation = (await tx.listingLocation.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.listing.locationId },
  })).count;
  deleted.Listing = (await tx.listing.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.listing.id },
  })).count;
  deleted.Message = (await tx.message.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.conversation.messageId },
  })).count;
  deleted.UserBlock = (await tx.userBlock.deleteMany({
    where: {
      blockerProfileId: accounts[0].profileId,
      blockedProfileId: accounts[1].profileId,
    },
  })).count;
  deleted.ConversationParticipant = (await tx.conversationParticipant.deleteMany({
    where: {
      id: { in: [...DEMO_FIXTURE_MANIFEST.conversation.participantIds] },
    },
  })).count;
  deleted.Conversation = (await tx.conversation.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.conversation.id },
  })).count;
  deleted.ActorGalleryMedia = (await tx.actorGalleryMedia.deleteMany({
    where: {
      actorId: DEMO_FIXTURE_MANIFEST.page.actorId,
      mediaId: { in: mediaIds },
    },
  })).count;
  deleted.MediaAsset = (await tx.mediaAsset.deleteMany({
    where: { id: { in: mediaIds } },
  })).count;
  deleted.SocialActor = (await tx.socialActor.deleteMany({
    where: { id: { in: actorIds } },
  })).count;
  deleted.CustomPage = (await tx.customPage.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.page.id },
  })).count;
  deleted.Post = (await tx.post.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.community.postId },
  })).count;
  deleted.Thread = (await tx.thread.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.community.threadId },
  })).count;
  deleted.Friendship = (await tx.friendship.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.friendship.id },
  })).count;
  deleted.DogOwnershipOperationProbe = (await tx.dogOwnership.deleteMany({
    where: {
      id: DOG_OWNERSHIP_OPERATION_PROBE_ID,
      dogId: DEMO_FIXTURE_MANIFEST.providerSamples.dogId,
      profileId: accounts[2].profileId,
    },
  })).count;
  deleted.Profile = (await tx.profile.deleteMany({
    where: { id: { in: profileIds } },
  })).count;
  deleted.User = (await tx.user.deleteMany({
    where: { id: { in: userIds } },
  })).count;
  deleted.UserCollisionProbe = (await tx.user.deleteMany({
    where: {
      id: USER_COLLISION_PROBE_ID,
      email: DEMO_FIXTURE_MANIFEST.accounts[0].email,
    },
  })).count;
  await cleanupPublicRacingDetailOperationProbe(tx, false);
  deleted.Race = (await tx.race.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.providerSamples.raceId, sourceProvider: PROVIDER },
  })).count;
  deleted.Meeting = (await tx.meeting.deleteMany({
    where: { id: PROVIDER_MEETING_ID, sourceProvider: PROVIDER },
  })).count;
  deleted.Track = (await tx.track.deleteMany({
    where: {
      id: DEMO_FIXTURE_MANIFEST.providerSamples.trackId,
      name: "Fixture Provider Track",
      state: "NSW",
    },
  })).count;
  deleted.Dog = (await tx.dog.deleteMany({
    where: { id: DEMO_FIXTURE_MANIFEST.providerSamples.dogId, sourceProvider: PROVIDER },
  })).count;

  if (requireCompleteGraph) {
    for (const [model, expected] of Object.entries(
      DEMO_FIXTURE_EXPECTED_MODEL_COUNTS,
    )) {
      assert.equal(deleted[model], expected, `cleanup count mismatch for ${model}`);
    }
    assert.equal(deleted.UserCollisionProbe, 0);
    assert.equal(deleted.AuthAcceptanceRestoreAuditLog, 1);
    assert.equal(deleted.AuthAcceptanceSignupOutbox, 1);
    assert.equal(deleted.AuthAcceptanceSocialActor, 1);
    assert.equal(deleted.AuthAcceptanceProfile, 1);
    assert.equal(deleted.AuthAcceptanceUser, 1);
    assert.equal(deleted.StripeWebhookOperationProbe, 1);
    assert.equal(deleted.UserExportAuditLog, 2);
    assert.equal(deleted.UserExportArtifact, 2);
    assert.equal(deleted.SignupOutbox, 2);
    assert.equal(deleted.AccountDeletionAuditLog, 2);
    assert.equal(deleted.MediaDeleteAuditLog, 1);
    assert.equal(deleted.UserBlock, 0);
    assert.equal(deleted.ConversationBlockAuditLog, 3);
    assert.equal(deleted.DogOwnershipOperationProbe, 1);
    for (const model of ["Dog", "Track", "Meeting", "Race"]) {
      assert.equal(deleted[model], 1, `cleanup count mismatch for ${model}`);
    }
  }

  const finalFixture = await collectFixtureSnapshot(tx);
  const finalProvider = await collectProviderSnapshot(tx);
  const remainingProbe = await tx.user.count({
    where: { id: USER_COLLISION_PROBE_ID },
  });
  const remainingBlockRows = await tx.userBlock.count({
    where: {
      blockerProfileId: accounts[0].profileId,
      blockedProfileId: accounts[1].profileId,
    },
  });
  const remainingBlockAudits = await tx.auditLog.count({
    where: conversationBlockAuditWhere(),
  });
  const remainingMediaDeleteAudits = await tx.auditLog.count({
    where: mediaDeleteAuditWhere(),
  });
  const remainingAccountDeletionAudits = await tx.auditLog.count({
    where: accountDeletionAuditWhere(accounts[1].userId),
  });
  const remainingSignupOutboxProbe = await tx.signupOutbox.count({
    where: {
      OR: [
        { id: SIGNUP_OUTBOX_CLAIM_PROBE_ID },
        { id: SIGNUP_OUTBOX_EXPIRED_PROBE_ID },
        { idempotencyKey: SIGNUP_OUTBOX_CLAIM_IDEMPOTENCY_KEY },
        { idempotencyKey: SIGNUP_OUTBOX_EXPIRED_IDEMPOTENCY_KEY },
      ],
    },
  });
  const remainingAuthAcceptanceProbe = await tx.user.count({
    where: {
      OR: [
        {
          workosUserId: {
            in: [
              AUTH_ACCEPTANCE_PROVIDER_ID,
              AUTH_ACCEPTANCE_ROLLBACK_PROVIDER_ID,
              AUTH_ACCEPTANCE_UNVERIFIED_PROVIDER_ID,
            ],
          },
        },
        {
          email: {
            in: [AUTH_ACCEPTANCE_EMAIL, AUTH_ACCEPTANCE_ROLLBACK_EMAIL],
          },
        },
      ],
    },
  });
  const remainingAuthAcceptanceRestoreAudit = authAcceptanceUserIds.length === 0
    ? 0
    : await tx.auditLog.count({
        where: {
          actorId: { in: authAcceptanceUserIds },
          action: "user.delete.restore",
          targetType: "user",
          targetId: { in: authAcceptanceUserIds },
        },
      });
  const remainingStripeWebhookOperationProbe = await tx.webhookEvent.count({
    where: {
      provider: "stripe",
      lagoEventId: {
        in: [
          STRIPE_WEBHOOK_OPERATION_EVENT_ID,
          STRIPE_WEBHOOK_ROLLBACK_EVENT_ID,
        ],
      },
    },
  });
  const remainingUserExportAuditLog = await tx.auditLog.count({
    where: {
      OR: userExportAccountIds.map((userId) => userExportAuditWhere(userId)),
    },
  });
  const remainingUserExportArtifact = await tx.exportArtifact.count({
    where: {
      exportType: "user_data",
      targetUserId: { in: userExportAccountIds },
      requestedByUserId: { in: userExportAccountIds },
    },
  });
  const remainingDogOwnershipOperationProbe = await tx.dogOwnership.count({
    where: {
      OR: [
        { id: DOG_OWNERSHIP_OPERATION_PROBE_ID },
        {
          dogId: DEMO_FIXTURE_MANIFEST.providerSamples.dogId,
          profileId: accounts[2].profileId,
        },
      ],
    },
  });
  assert.equal(finalFixture.privateRowCount, 0);
  assert.equal(finalFixture.referenceRowCount, 1);
  assert.deepEqual(finalProvider.counts, {
    Dog: 0,
    Track: 0,
    Meeting: 0,
    Race: 0,
  });
  assert.equal(remainingProbe, 0);
  assert.equal(remainingBlockRows, 0);
  assert.equal(remainingBlockAudits, 0);
  assert.equal(remainingMediaDeleteAudits, 0);
  assert.equal(remainingAccountDeletionAudits, 0);
  assert.equal(remainingSignupOutboxProbe, 0);
  assert.equal(remainingAuthAcceptanceProbe, 0);
  assert.equal(remainingAuthAcceptanceRestoreAudit, 0);
  assert.equal(remainingStripeWebhookOperationProbe, 0);
  assert.equal(remainingUserExportAuditLog, 0);
  assert.equal(remainingUserExportArtifact, 0);
  assert.equal(remainingDogOwnershipOperationProbe, 0);
  return {
    role: "postgres",
    purpose: "cleanup-only",
    deleted,
    finalPrivateRows: finalFixture.privateRowCount,
    finalProviderRows: finalProvider.counts,
  };
}

function canonicalize(
  value: unknown,
  ignoredKeys: ReadonlySet<string> = new Set(),
): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((entry) => canonicalize(entry, ignoredKeys))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !ignoredKeys.has(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry, ignoredKeys)]),
    );
  }
  return value;
}

function writeEvidence(root: string, report: object) {
  const outputPath = resolve(root, DEMO_FIXTURE_IDEMPOTENCY_EVIDENCE_PATH);
  const temporaryPath = `${outputPath}.tmp`;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, outputPath);
  return outputPath;
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
  const { report, outputPath } = await runDemoFixtureIdempotencyVerifier();
  console.log(
    JSON.stringify({
      verdict: report.verdict,
      privateRows: report.secondRun.privateRowCount,
      providerCounts: report.providerAfter.counts,
      evidence: outputPath,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      if (process.env.DATABASE_URL) {
        const { prisma } = await import("../src/lib/db");
        await prisma.$disconnect();
      }
    });
}
