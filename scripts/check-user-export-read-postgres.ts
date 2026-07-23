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

import type { CurrentUserProfile } from "../src/lib/auth-types";
import type { DbContextClient } from "../src/lib/db-context";
import type { DisposableReplayQueryEvent } from "../src/lib/db";

export const USER_EXPORT_READ_VERIFY_CONFIRMATION =
  "verify-user-export-read-on-disposable-loopback-55734";
export const USER_EXPORT_READ_EVIDENCE_PATH =
  "output/database-audit/user-export-read.json";
export const USER_EXPORT_READ_EVIDENCE_SCHEMA_VERSION = 1;

const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const COLLECTION_TAKE = 501;
const NESTED_COLLECTION_TAKE = 21;
const EXPECTED_MAXIMUM_ROWS = 41_502;
const OWNER_USER_ID = "user-export-read-owner-user-proof";
const OWNER_PROFILE_ID = "user-export-read-owner-profile-proof";
const OTHER_USER_ID = "user-export-read-other-user-proof";
const OTHER_PROFILE_ID = "user-export-read-other-profile-proof";
const OWNER_ACTOR_ID = "user-export-read-owner-actor-proof";
const OTHER_ACTOR_ID = "user-export-read-other-actor-proof";
const CATEGORY_ID = "user-export-read-category-proof";
const THREAD_ID = "user-export-read-thread-proof";
const POST_ID = "user-export-read-post-proof";
const LISTING_ID = "user-export-read-listing-proof";
const CONVERSATION_ID = "user-export-read-conversation-proof";
const SENT_MESSAGE_ID = "user-export-read-sent-message-proof";
const RECEIVED_MESSAGE_ID = "user-export-read-received-message-proof";
const MEMORY_ID = "user-export-read-memory-proof";
const AGENT_RUN_ID = "user-export-read-agent-run-proof";
const INITIAL_MEDIA_IDS = [
  "user-export-read-listing-media-proof",
  "user-export-read-sent-media-proof",
  "user-export-read-received-media-proof",
] as const;
const OVERFLOW_MEDIA_IDS = Array.from(
  { length: 20 },
  (_, index) => `user-export-read-overflow-media-${String(index + 1).padStart(2, "0")}-proof`,
);
const OVERFLOW_AGENT_RUN_IDS = Array.from(
  { length: 500 },
  (_, index) => `user-export-read-overflow-agent-${String(index + 1).padStart(3, "0")}-proof`,
);
const ALL_MEDIA_IDS = [...INITIAL_MEDIA_IDS, ...OVERFLOW_MEDIA_IDS];
const ALL_AGENT_RUN_IDS = [AGENT_RUN_ID, ...OVERFLOW_AGENT_RUN_IDS];
const OWNER_CONTEXT: CurrentUserProfile = {
  id: "user-export-read-owner-provider-proof",
  dbUserId: OWNER_USER_ID,
  profileId: OWNER_PROFILE_ID,
  email: "owner@example.invalid",
  firstName: "Owner",
  lastName: "Proof",
  name: "Owner proof",
  role: "member",
  tier: "pro",
  isBanned: false,
  deletionRequestedAt: null,
  displayName: "Owner proof",
  profileRole: "member",
  verified: false,
};
const OTHER_CONTEXT: CurrentUserProfile = {
  id: "user-export-read-other-provider-proof",
  dbUserId: OTHER_USER_ID,
  profileId: OTHER_PROFILE_ID,
  email: "other@example.invalid",
  firstName: "Other",
  lastName: "Proof",
  name: "Other proof",
  role: "member",
  tier: "free",
  isBanned: false,
  deletionRequestedAt: null,
  displayName: "Other proof",
  profileRole: "member",
  verified: false,
};
const SOURCE_FILES = [
  "prisma/schema.prisma",
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "prisma/migrations/20260708190000_add_rls_remaining_tables/migration.sql",
  "prisma/migrations/20260708210000_memory_owner_writes/migration.sql",
  "scripts/check-user-export-read-postgres.ts",
  "scripts/check-user-export-read-postgres.test.ts",
  "security/database-operations.ts",
  "src/app/api/users/me/export/route.ts",
  "src/app/api/users/me/export/route.test.ts",
  "src/lib/db-context.ts",
  "src/lib/db.ts",
  "src/lib/user-export-policy.ts",
  "src/lib/user-export-policy.test.ts",
  "src/lib/user-export-service.ts",
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

type ContextRunner = <T>(
  fn: (tx: DbContextClient) => Promise<T>,
) => Promise<T>;

type ObservedStatement = {
  variant: string;
  normalizedSql: string;
  parameters: unknown[];
  evidence: {
    normalizedSql: string;
    sha256: string;
    parameterCount: number;
    persistedParameterValues: false;
  };
};

export function assertUserExportReadVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, USER_EXPORT_READ_VERIFY_CONFIRMATION);
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
  ]) {
    assert.equal(url.searchParams.has(parameter), false);
  }
  return url;
}

export function validateUserExportReadEvidence(value: unknown, root = process.cwd()) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const report = value as Record<string, unknown>;
  assert.equal(report.schemaVersion, USER_EXPORT_READ_EVIDENCE_SCHEMA_VERSION);
  assert.equal(report.auditKind, "user-export-read-disposable-proof");
  assert.equal(report.verdict, "verified");
  const sourceBinding = report.sourceBinding as SourceBinding;
  assert.deepEqual(sourceBinding, buildSourceBinding(root));
  const proof = report.proof as Record<string, unknown>;
  assert.equal(proof.queryId, "DB.ACCOUNT.DATA_EXPORT.READ");
  assert.equal(proof.sourceFile, "src/lib/user-export-service.ts");
  assert.equal(proof.sourceSymbol, "readUserExportData");
  assert.equal(proof.collectionTake, COLLECTION_TAKE);
  assert.equal(proof.nestedCollectionTake, NESTED_COLLECTION_TAKE);
  assert.equal(proof.expectedMaximumRows, EXPECTED_MAXIMUM_ROWS);
  assert.deepEqual(proof.maximumRowDerivation, {
    identityRows: 2,
    acceptedTopLevelRows: 5_000,
    conservativeRelatedProjectionRows: 5_000,
    perParentNestedSentinelRows: 31_500,
    total: EXPECTED_MAXIMUM_ROWS,
  });
  assert.equal(proof.status, "verified");
  const statements = proof.statements as unknown[];
  assert.ok(Array.isArray(statements) && statements.length >= 15);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(
    serialized,
    /user-export-read-(?:owner|other|category|thread|post|listing|conversation|sent|received|memory|agent|overflow)(?:-|@)/i,
  );
  assert.doesNotMatch(serialized, /provider-secret|storage-secret|agent-secret|memory-secret/i);
  return report;
}

function buildSourceBinding(root: string): SourceBinding {
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

export async function runUserExportReadVerifier() {
  const root = process.cwd();
  const runtimeUrl = assertUserExportReadVerifierTarget(
    requiredEnvironment("USER_EXPORT_READ_VERIFY_DATABASE_URL"),
    process.env.USER_EXPORT_READ_VERIFY_CONFIRM,
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
    { withDbRequestContext, withDbAnonymousContext },
    { readUserExportData },
    { assertUserExportDto },
  ] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/db"),
    import("../src/lib/db-context"),
    import("../src/lib/user-export-service"),
    import("../src/lib/user-export-policy"),
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

    await setupFixture(cleanupPrisma);
    cleanupRequired = true;

    const normalCapture = await captureDisposableReplayQueries(() =>
      readUserExportData(OWNER_CONTEXT),
    );
    const normal = normalCapture.result;
    assert.equal(normal.user?.email, "owner@example.invalid");
    assert.equal(normal.profile?.phone, "0400000000");
    assert.equal(normal.threads.length, 1);
    assert.equal(normal.posts.length, 1);
    assert.equal(normal.listings.length, 1);
    assert.equal(normal.listings[0]?.media.length, 1);
    assert.equal(normal.conversations.length, 1);
    assert.equal(normal.messagesSent.length, 1);
    assert.equal(normal.messagesSent[0]?.media.length, 1);
    assert.equal(normal.messagesReceived.length, 1);
    assert.equal(normal.messagesReceived[0]?.media.length, 1);
    assert.equal(normal.mediaAssets.length, 3);
    assert.equal(normal.memoryEntries.length, 1);
    assert.equal(normal.agentRuns.length, 1);
    assert.doesNotThrow(() => assertUserExportDto(normal));
    const normalSerialized = JSON.stringify(normal);
    for (const forbidden of [
      "stripe-owner-provider-secret",
      "workos-owner-provider-secret",
      "storage-secret-owner",
      "agent-secret-input",
      "agent-secret-output",
      "memory-secret-reference",
    ]) {
      assert.equal(normalSerialized.includes(forbidden), false, forbidden);
    }

    const other = await readUserExportData(OTHER_CONTEXT);
    assert.equal(other.user?.email, "other@example.invalid");
    assert.equal(other.profile?.displayName, "Other proof");
    assert.equal(other.threads.length, 0);
    assert.equal(other.posts.length, 0);
    assert.equal(other.listings.length, 0);
    assert.equal(other.mediaAssets.length, 0);
    assert.equal(other.memoryEntries.length, 0);
    assert.equal(other.agentRuns.length, 0);
    assert.equal(other.messagesSent.length, 1);
    assert.equal(other.messagesReceived.length, 1);

    const statements = collectObservedStatements(normalCapture.queries);
    assert.ok(statements.length >= 15);
    assertRootLimit(statements, "DogOwnership", '"profileId"', COLLECTION_TAKE);
    assertRootLimit(statements, "Thread", '"authorId"', COLLECTION_TAKE);
    assertRootLimit(statements, "Post", '"authorId"', COLLECTION_TAKE);
    assertRootLimit(statements, "Listing", '"profileId"', COLLECTION_TAKE);
    assertRootLimit(statements, "Conversation", '"participantAId"', COLLECTION_TAKE);
    assertRootLimit(statements, "Message", '"senderId"', COLLECTION_TAKE);
    assertRootLimit(statements, "Message", '"recipientId"', COLLECTION_TAKE);
    assertRootLimit(statements, "MediaAsset", '"uploaderId"', COLLECTION_TAKE);
    assertRootLimit(statements, "MemoryEntry", '"userId"', COLLECTION_TAKE);
    assertRootLimit(statements, "AgentRun", '"userId"', COLLECTION_TAKE);
    assertNestedLimit(statements, "ListingMedia");
    assertNestedLimit(statements, "MessageMedia");

    const ownerRunner: ContextRunner = (fn) =>
      withDbRequestContext(OWNER_CONTEXT, fn);
    const otherRunner: ContextRunner = (fn) =>
      withDbRequestContext(OTHER_CONTEXT, fn);
    const anonymousRunner: ContextRunner = withDbAnonymousContext;
    const statementEvidence = [];
    for (const statement of statements) {
      const [ownerRows, otherRows, anonymousRows, explain] = await Promise.all([
        replayRowCount(ownerRunner, statement),
        replayRowCount(otherRunner, statement),
        replayRowCount(anonymousRunner, statement),
        explainObservedStatement(ownerRunner, statement),
      ]);
      statementEvidence.push({
        variant: statement.variant,
        observedSql: statement.evidence,
        replay: { ownerRows, otherRows, anonymousRows },
        explain,
      });
    }
    assertSensitiveRls(statementEvidence);

    await addTopLevelOverflowFixture(cleanupPrisma);
    await assert.rejects(() => readUserExportData(OWNER_CONTEXT), /export\.too_large/);
    const removedOverflowRuns = await cleanupPrisma.agentRun.deleteMany({
      where: { id: { in: OVERFLOW_AGENT_RUN_IDS } },
    });
    assert.equal(removedOverflowRuns.count, 500);

    await addNestedOverflowFixture(cleanupPrisma);
    const nestedOverflow = await captureDisposableReplayQueries(async () => {
      try {
        await readUserExportData(OWNER_CONTEXT);
        return "unexpected-success";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    assert.equal(nestedOverflow.result, "export.too_large");
    const listingMediaStatement = statements.find((statement) =>
      statement.normalizedSql.includes('FROM "ListingMedia" AS lm'),
    );
    assert.ok(listingMediaStatement);
    assert.equal(
      await replayRowCount(ownerRunner, listingMediaStatement),
      NESTED_COLLECTION_TAKE,
    );

    const removed = await cleanupFixture(cleanupPrisma, true);
    cleanupRequired = false;
    assert.equal(await countFixtureRows(cleanupPrisma), 0);

    const report = {
      schemaVersion: USER_EXPORT_READ_EVIDENCE_SCHEMA_VERSION,
      auditKind: "user-export-read-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        providerContact: false,
        runtimeRole: "login-nonsuperuser-nobypassrls",
        cleanup: "exact-proof-identifiers-only",
      },
      sourceBinding: buildSourceBinding(root),
      proof: {
        queryId: "DB.ACCOUNT.DATA_EXPORT.READ",
        sourceFile: "src/lib/user-export-service.ts",
        sourceSymbol: "readUserExportData",
        collectionTake: COLLECTION_TAKE,
        nestedCollectionTake: NESTED_COLLECTION_TAKE,
        expectedMaximumRows: EXPECTED_MAXIMUM_ROWS,
        maximumRowDerivation: {
          identityRows: 2,
          acceptedTopLevelRows: 10 * 500,
          conservativeRelatedProjectionRows: 5_000,
          perParentNestedSentinelRows: 3 * 500 * NESTED_COLLECTION_TAKE,
          total: EXPECTED_MAXIMUM_ROWS,
        },
        normal: {
          ownerRecord: 1,
          profileRecord: 1,
          threads: normal.threads.length,
          posts: normal.posts.length,
          listings: normal.listings.length,
          conversations: normal.conversations.length,
          messagesSent: normal.messagesSent.length,
          messagesReceived: normal.messagesReceived.length,
          mediaAssets: normal.mediaAssets.length,
          memoryEntries: normal.memoryEntries.length,
          agentRuns: normal.agentRuns.length,
        },
        isolation: {
          otherOwnedThreads: other.threads.length,
          otherOwnedListings: other.listings.length,
          otherOwnedMedia: other.mediaAssets.length,
          otherOwnedMemories: other.memoryEntries.length,
          otherOwnedAgentRuns: other.agentRuns.length,
          exactStatementReplay: "owner-other-anonymous-counts-recorded-per-variant",
        },
        overflow: {
          topLevelSentinelRows: COLLECTION_TAKE,
          nestedSentinelRows: NESTED_COLLECTION_TAKE,
          result: "both-rejected-before-export-completion",
        },
        exclusions: {
          providerReferences: true,
          storageCoordinatesAndHashes: true,
          rawAgentInputsAndOutputs: true,
          memorySourceReferences: true,
          dtoForbiddenFieldScan: true,
        },
        statementCount: statementEvidence.length,
        statements: statementEvidence,
        cleanup: removed,
        cases: {
          memberRead: "explicit-projections-and-owner-predicates",
          sensitiveRls: "owner-visible-other-and-anonymous-denied",
          publicRows: "owner-predicate-remains-server-derived",
          topLevelBound: "sentinel-row-rejected",
          nestedBound: "lateral-database-limit-sentinel-rejected",
          cacheAndResponseBound: "route-and-policy-source-bound",
        },
        status: "verified",
      },
      verdict: "verified",
    };
    validateUserExportReadEvidence(report, root);
    const outputPath = resolve(root, USER_EXPORT_READ_EVIDENCE_PATH);
    mkdirSync(dirname(outputPath), { recursive: true });
    const temporaryPath = `${outputPath}.tmp-${process.pid}`;
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    return { report, outputPath };
  } finally {
    if (cleanupRequired) await cleanupFixture(cleanupPrisma, false);
    await Promise.all([prisma.$disconnect(), cleanupPrisma.$disconnect()]);
  }
}

async function setupFixture(prisma: PrismaClient) {
  await cleanupFixture(prisma, false);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.system', 'true', true)`;
    await tx.user.createMany({
      data: [
        {
          id: OWNER_USER_ID,
          email: "owner@example.invalid",
          name: "Owner proof",
          subscriptionTier: "pro",
          stripeCustomerId: "stripe-owner-provider-secret",
          workosUserId: "workos-owner-provider-secret",
        },
        {
          id: OTHER_USER_ID,
          email: "other@example.invalid",
          name: "Other proof",
        },
      ],
    });
    await tx.profile.createMany({
      data: [
        {
          id: OWNER_PROFILE_ID,
          userId: OWNER_USER_ID,
          displayName: "Owner proof",
          bio: "Owner private biography",
          phone: "0400000000",
        },
        {
          id: OTHER_PROFILE_ID,
          userId: OTHER_USER_ID,
          displayName: "Other proof",
        },
      ],
    });
    await tx.socialActor.createMany({
      data: [
        {
          id: OWNER_ACTOR_ID,
          kind: "personal",
          profileId: OWNER_PROFILE_ID,
          ownerProfileId: OWNER_PROFILE_ID,
          handle: "user-export-read-owner-proof",
          displayName: "Owner proof",
        },
        {
          id: OTHER_ACTOR_ID,
          kind: "personal",
          profileId: OTHER_PROFILE_ID,
          ownerProfileId: OTHER_PROFILE_ID,
          handle: "user-export-read-other-proof",
          displayName: "Other proof",
        },
      ],
    });
    await tx.forumCategory.create({
      data: { id: CATEGORY_ID, name: "Proof", slug: "user-export-read-proof" },
    });
    await tx.thread.create({
      data: {
        id: THREAD_ID,
        categoryId: CATEGORY_ID,
        authorId: OWNER_PROFILE_ID,
        title: "Owner export thread",
      },
    });
    await tx.post.create({
      data: {
        id: POST_ID,
        threadId: THREAD_ID,
        authorId: OWNER_PROFILE_ID,
        body: "Owner export post",
      },
    });
    await tx.listing.create({
      data: {
        id: LISTING_ID,
        profileId: OWNER_PROFILE_ID,
        type: "dog_for_sale",
        title: "Owner export listing",
        description: "Owner export listing description",
        status: "active",
        moderationStatus: "pending_review",
      },
    });
    await tx.conversation.create({
      data: {
        id: CONVERSATION_ID,
        participantAId: OWNER_PROFILE_ID,
        participantBId: OTHER_PROFILE_ID,
      },
    });
    await tx.message.createMany({
      data: [
        {
          id: SENT_MESSAGE_ID,
          conversationId: CONVERSATION_ID,
          senderId: OWNER_PROFILE_ID,
          recipientId: OTHER_PROFILE_ID,
          body: "Owner sent private message",
        },
        {
          id: RECEIVED_MESSAGE_ID,
          conversationId: CONVERSATION_ID,
          senderId: OTHER_PROFILE_ID,
          recipientId: OWNER_PROFILE_ID,
          body: "Owner received private message",
        },
      ],
    });
    await tx.mediaAsset.createMany({
      data: INITIAL_MEDIA_IDS.map((id, index) => ({
        id,
        uploaderId: OWNER_USER_ID,
        storageBucket: "private-user-media",
        storagePath: `users/${OWNER_USER_ID}/storage-secret-owner-${index}.jpg`,
        publicUrl: `https://example.invalid/storage-secret-owner-${index}`,
        originalName: `owner-${index}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 100 + index,
        sha256: String(index).repeat(64),
        scanStatus: "clean",
        processingStatus: "ready",
      })),
    });
    await tx.listingMedia.create({
      data: { listingId: LISTING_ID, mediaId: INITIAL_MEDIA_IDS[0], position: 0 },
    });
    await tx.messageMedia.createMany({
      data: [
        { messageId: SENT_MESSAGE_ID, mediaId: INITIAL_MEDIA_IDS[1], position: 0 },
        { messageId: RECEIVED_MESSAGE_ID, mediaId: INITIAL_MEDIA_IDS[2], position: 0 },
      ],
    });
    await tx.memoryEntry.create({
      data: {
        id: MEMORY_ID,
        userId: OWNER_USER_ID,
        kind: "preference",
        content: "Owner export memory",
        source: "explicit_user_input",
        sourceRef: "memory-secret-reference",
      },
    });
    await tx.agentRun.create({
      data: {
        id: AGENT_RUN_ID,
        userId: OWNER_USER_ID,
        agentType: "race_analyst",
        status: "completed",
        inputJson: '{"agent-secret-input":true}',
        outputJson: '{"agent-secret-output":true}',
        toolInvocations: '["agent-secret-tool"]',
      },
    });
  });
}

async function addTopLevelOverflowFixture(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.system', 'true', true)`;
    await tx.agentRun.createMany({
      data: OVERFLOW_AGENT_RUN_IDS.map((id) => ({
        id,
        userId: OWNER_USER_ID,
        agentType: "race_analyst",
        inputJson: "{}",
      })),
    });
  });
}

async function addNestedOverflowFixture(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.system', 'true', true)`;
    await tx.mediaAsset.createMany({
      data: OVERFLOW_MEDIA_IDS.map((id, index) => ({
        id,
        uploaderId: OWNER_USER_ID,
        storageBucket: "private-user-media",
        storagePath: `users/${OWNER_USER_ID}/overflow-${index + 1}.jpg`,
        originalName: `overflow-${index + 1}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 200 + index,
        scanStatus: "clean",
        processingStatus: "ready",
      })),
    });
    await tx.listingMedia.createMany({
      data: OVERFLOW_MEDIA_IDS.map((mediaId, index) => ({
        listingId: LISTING_ID,
        mediaId,
        position: index + 1,
      })),
    });
  });
}

function collectObservedStatements(queries: DisposableReplayQueryEvent[]) {
  const unique = new Map<string, DisposableReplayQueryEvent>();
  for (const event of queries) {
    const normalizedSql = normalizeSql(event.query);
    if (!/^SELECT\b/i.test(normalizedSql)) continue;
    if (normalizedSql.includes("set_config(")) continue;
    if (!isExportStatement(normalizedSql)) continue;
    assert.doesNotMatch(normalizedSql, /;|--|\/\*/);
    unique.set(normalizedSql, event);
  }
  return [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([normalizedSql, event], index): ObservedStatement => ({
      variant: `export-read-${String(index + 1).padStart(2, "0")}`,
      normalizedSql,
      parameters: parsePrismaParameters(event.params),
      evidence: {
        normalizedSql,
        sha256: sha256(normalizedSql),
        parameterCount: parsePrismaParameters(event.params).length,
        persistedParameterValues: false,
      },
    }));
}

function isExportStatement(sql: string) {
  return [
    "User",
    "Profile",
    "DogOwnership",
    "Dog",
    "Thread",
    "ForumCategory",
    "Post",
    "Listing",
    "ListingMedia",
    "Conversation",
    "Message",
    "MessageMedia",
    "MediaAsset",
    "MemoryEntry",
    "AgentRun",
  ].some((table) => sql.includes(`"${table}"`));
}

function assertRootLimit(
  statements: ObservedStatement[],
  table: string,
  predicate: string,
  limit: number,
) {
  assert.ok(
    statements.some(
      (statement) =>
        statement.normalizedSql.includes(`FROM "public"."${table}"`) &&
        statement.normalizedSql.includes(predicate) &&
        /\bLIMIT \$\d+/i.test(statement.normalizedSql) &&
        statement.parameters.includes(limit),
    ),
    `${table} ${predicate} must carry database limit ${limit}`,
  );
}

function assertNestedLimit(statements: ObservedStatement[], table: string) {
  assert.ok(
    statements.some(
      (statement) =>
        statement.normalizedSql.includes(`FROM "${table}"`) &&
        /CROSS JOIN LATERAL/i.test(statement.normalizedSql) &&
        /\bLIMIT \$\d+/i.test(statement.normalizedSql) &&
        statement.parameters.includes(NESTED_COLLECTION_TAKE),
    ),
    `${table} must carry the per-parent database limit`,
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

async function replayRowCount(runner: ContextRunner, statement: ObservedStatement) {
  const rows = await runner((tx) =>
    tx.$queryRawUnsafe<unknown[]>(
      statement.normalizedSql,
      ...statement.parameters,
    ),
  );
  assert.ok(Array.isArray(rows));
  return rows.length;
}

async function explainObservedStatement(
  runner: ContextRunner,
  statement: ObservedStatement,
) {
  const rows = await runner(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL statement_timeout = ${EXPLAIN_STATEMENT_TIMEOUT_MS}`,
    );
    return tx.$queryRawUnsafe<unknown[]>(
      `EXPLAIN (FORMAT JSON, ANALYZE FALSE, VERBOSE FALSE, COSTS TRUE, BUFFERS FALSE) ${statement.normalizedSql}`,
      ...statement.parameters,
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
  return sanitizeExplainNode(
    plainObject(queryPlan[0], "EXPLAIN plan container").Plan,
  );
}

function sanitizeExplainNode(value: unknown): {
  nodeType: string;
  relationName: string | null;
  indexName: string | null;
  joinType: string | null;
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
    estimatedRows: requiredPlanNumber(node["Plan Rows"], "Plan Rows"),
    totalCost: requiredPlanNumber(node["Total Cost"], "Total Cost"),
    children: children.map(sanitizeExplainNode),
  };
}

function assertSensitiveRls(
  evidence: Array<{
    observedSql: { normalizedSql: string };
    replay: { ownerRows: number; otherRows: number; anonymousRows: number };
  }>,
) {
  for (const table of ["User", "MemoryEntry", "AgentRun", "MediaAsset"]) {
    const rows = evidence.filter((entry) =>
      entry.observedSql.normalizedSql.includes(`FROM "public"."${table}"`),
    );
    assert.ok(rows.length > 0, `${table} evidence missing`);
    assert.ok(rows.some((entry) => entry.replay.ownerRows > 0));
    assert.ok(rows.every((entry) => entry.replay.otherRows === 0));
    assert.ok(rows.every((entry) => entry.replay.anonymousRows === 0));
  }
  const privateCommunication = evidence.filter(
    (entry) =>
      entry.observedSql.normalizedSql.includes('FROM "public"."Conversation"') ||
      entry.observedSql.normalizedSql.includes('FROM "public"."Message"') ||
      entry.observedSql.normalizedSql.includes('FROM "MessageMedia"'),
  );
  assert.ok(privateCommunication.length > 0);
  assert.ok(privateCommunication.every((entry) => entry.replay.anonymousRows === 0));
}

async function cleanupFixture(prisma: PrismaClient, requireExact: boolean) {
  const removed = await prisma.$transaction(async (tx) => {
    const messageMedia = await tx.messageMedia.deleteMany({
      where: { messageId: { in: [SENT_MESSAGE_ID, RECEIVED_MESSAGE_ID] } },
    });
    const listingMedia = await tx.listingMedia.deleteMany({
      where: { listingId: LISTING_ID },
    });
    const media = await tx.mediaAsset.deleteMany({
      where: { id: { in: ALL_MEDIA_IDS } },
    });
    const messages = await tx.message.deleteMany({
      where: { id: { in: [SENT_MESSAGE_ID, RECEIVED_MESSAGE_ID] } },
    });
    const conversations = await tx.conversation.deleteMany({
      where: { id: CONVERSATION_ID },
    });
    const listings = await tx.listing.deleteMany({ where: { id: LISTING_ID } });
    const posts = await tx.post.deleteMany({ where: { id: POST_ID } });
    const threads = await tx.thread.deleteMany({ where: { id: THREAD_ID } });
    const categories = await tx.forumCategory.deleteMany({ where: { id: CATEGORY_ID } });
    const memories = await tx.memoryEntry.deleteMany({ where: { id: MEMORY_ID } });
    const agentRuns = await tx.agentRun.deleteMany({
      where: { id: { in: ALL_AGENT_RUN_IDS } },
    });
    const socialActors = await tx.socialActor.deleteMany({
      where: { id: { in: [OWNER_ACTOR_ID, OTHER_ACTOR_ID] } },
    });
    const profiles = await tx.profile.deleteMany({
      where: { id: { in: [OWNER_PROFILE_ID, OTHER_PROFILE_ID] } },
    });
    const users = await tx.user.deleteMany({
      where: { id: { in: [OWNER_USER_ID, OTHER_USER_ID] } },
    });
    return {
      messageMediaRowsDeleted: messageMedia.count,
      listingMediaRowsDeleted: listingMedia.count,
      mediaRowsDeleted: media.count,
      messageRowsDeleted: messages.count,
      conversationRowsDeleted: conversations.count,
      listingRowsDeleted: listings.count,
      postRowsDeleted: posts.count,
      threadRowsDeleted: threads.count,
      categoryRowsDeleted: categories.count,
      memoryRowsDeleted: memories.count,
      agentRunRowsDeleted: agentRuns.count,
      socialActorRowsDeleted: socialActors.count,
      profileRowsDeleted: profiles.count,
      userRowsDeleted: users.count,
    };
  });
  if (requireExact) {
    assert.deepEqual(removed, {
      messageMediaRowsDeleted: 2,
      listingMediaRowsDeleted: 21,
      mediaRowsDeleted: 23,
      messageRowsDeleted: 2,
      conversationRowsDeleted: 1,
      listingRowsDeleted: 1,
      postRowsDeleted: 1,
      threadRowsDeleted: 1,
      categoryRowsDeleted: 1,
      memoryRowsDeleted: 1,
      agentRunRowsDeleted: 1,
      socialActorRowsDeleted: 2,
      profileRowsDeleted: 2,
      userRowsDeleted: 2,
    });
  }
  return removed;
}

async function countFixtureRows(prisma: PrismaClient) {
  const counts = await Promise.all([
    prisma.messageMedia.count({
      where: { messageId: { in: [SENT_MESSAGE_ID, RECEIVED_MESSAGE_ID] } },
    }),
    prisma.listingMedia.count({ where: { listingId: LISTING_ID } }),
    prisma.mediaAsset.count({ where: { id: { in: ALL_MEDIA_IDS } } }),
    prisma.message.count({
      where: { id: { in: [SENT_MESSAGE_ID, RECEIVED_MESSAGE_ID] } },
    }),
    prisma.conversation.count({ where: { id: CONVERSATION_ID } }),
    prisma.listing.count({ where: { id: LISTING_ID } }),
    prisma.post.count({ where: { id: POST_ID } }),
    prisma.thread.count({ where: { id: THREAD_ID } }),
    prisma.forumCategory.count({ where: { id: CATEGORY_ID } }),
    prisma.memoryEntry.count({ where: { id: MEMORY_ID } }),
    prisma.agentRun.count({ where: { id: { in: ALL_AGENT_RUN_IDS } } }),
    prisma.socialActor.count({
      where: { id: { in: [OWNER_ACTOR_ID, OTHER_ACTOR_ID] } },
    }),
    prisma.profile.count({
      where: { id: { in: [OWNER_PROFILE_ID, OTHER_PROFILE_ID] } },
    }),
    prisma.user.count({ where: { id: { in: [OWNER_USER_ID, OTHER_USER_ID] } } }),
  ]);
  return counts.reduce((total, count) => total + count, 0);
}

function normalizeSql(value: string) {
  return value.replace(/\s+/g, " ").trim();
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
  const { report, outputPath } = await runUserExportReadVerifier();
  const proof = report.proof;
  console.log(
    JSON.stringify({
      verdict: report.verdict,
      queryId: proof.queryId,
      statements: proof.statementCount,
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
