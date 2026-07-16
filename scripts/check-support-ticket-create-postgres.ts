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

import type {
  DbContextClient,
  DbContextUser,
} from "../src/lib/db-context";
import type { DisposableReplayQueryEvent } from "../src/lib/db";

export const SUPPORT_TICKET_VERIFY_CONFIRMATION =
  "verify-support-ticket-create-on-disposable-loopback-55734";
export const SUPPORT_TICKET_EVIDENCE_PATH =
  "output/database-audit/support-ticket-create.json";
export const SUPPORT_TICKET_EVIDENCE_SCHEMA_VERSION = 1;

const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const CUID_PATTERN = /^c[a-z0-9]{20,31}$/;
const FIXTURE_USER_IDS = [
  "support-ticket-owner-user-proof",
  "support-ticket-other-user-proof",
] as const;
const OWNER: DbContextUser = {
  dbUserId: FIXTURE_USER_IDS[0],
  profileId: "support-ticket-owner-profile-proof",
  profileRole: "member",
  tier: "free",
};
const OTHER_USER: DbContextUser = {
  dbUserId: FIXTURE_USER_IDS[1],
  profileId: "support-ticket-other-profile-proof",
  profileRole: "member",
  tier: "free",
};
const SOURCE_FILES = [
  "prisma/migrations/20260708190000_add_rls_remaining_tables/migration.sql",
  "prisma/migrations/20260715060000_harden_support_message_insert_rls/migration.sql",
  "scripts/check-support-ticket-create-postgres.ts",
  "scripts/check-support-ticket-create-postgres.test.ts",
  "security/mandatory-public-racing-database-operations.ts",
  "src/app/actions.ts",
  "src/lib/content.ts",
  "src/lib/db-context.ts",
  "src/lib/db.ts",
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
  expectedKinds?: Array<"cuid" | "date">;
};

type ObservedSqlEvidence = {
  normalizedSql: string;
  parameters: unknown[];
  evidence: {
    statementType: "INSERT";
    normalizedSql: string;
    sha256: string;
    parameterCount: number;
    namedBinds: Array<{ name: string; positions: number[] }>;
    persistedParameterValues: false;
  };
};

export function assertSupportTicketVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, SUPPORT_TICKET_VERIFY_CONFIRMATION);
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

export function buildSupportTicketSourceBinding(
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

export function validateSupportTicketEvidence(
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
  assert.equal(evidence.schemaVersion, SUPPORT_TICKET_EVIDENCE_SCHEMA_VERSION);
  assert.equal(evidence.auditKind, "support-ticket-create-disposable-proof");
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(evidence.sourceBinding, buildSupportTicketSourceBinding(root));
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
    fixtureOwner: "support-ticket-create-dedicated-proof",
    broadCleanupUsed: false,
  });
  assert.deepEqual(evidence.cleanup, {
    supportMessageRowsDeleted: 2,
    supportTicketRowsDeleted: 2,
    profileRowsDeleted: 2,
    userRowsDeleted: 2,
    remainingSupportMessageRows: 0,
    remainingSupportTicketRows: 0,
    remainingProfileRows: 0,
    remainingUserRows: 0,
  });

  const proof = evidence.proof as Record<string, unknown>;
  assert.equal(proof.queryId, "DB.SUPPORT.TICKET.CREATE.TRANSACTION");
  assert.equal(proof.sourceFile, "src/app/actions.ts");
  assert.equal(proof.sourceSymbol, "createSupportTicket");
  assert.equal(proof.expectedMaximumRows, 2);
  assert.equal(proof.status, "verified");
  assert.deepEqual(proof.rowCounts, {
    before: { tickets: 0, messages: 0 },
    afterFirstCommit: { tickets: 1, messages: 1 },
    afterRollback: { tickets: 1, messages: 1 },
    afterDeniedAttempts: { tickets: 1, messages: 1 },
    afterPermittedDuplicate: { tickets: 2, messages: 2 },
  });
  assert.deepEqual(proof.cases, {
    successfulTransaction: "one-ticket-and-one-initial-message-committed",
    transactionOrder: "ticket-insert-before-message-insert-before-commit",
    sanitization: "nul-and-angle-brackets-removed-before-persistence",
    rollback: "both-inserts-absent-after-forced-rollback",
    duplicateSubmit: "second-permitted-submit-created-one-distinct-pair",
    crossAccountTicketInsert: "denied-by-ticket-owner-policy",
    crossAccountMessageInsert:
      "denied-even-when-message-author-matches-caller-because-ticket-owner-differs",
    anonymousTicketInsert: "denied-by-ticket-owner-policy",
    supportMessagePolicy:
      "effective-policy-requires-message-author-and-ticket-owner",
    transactionIsolation: "read committed",
  });

  const statements = proof.statements as Array<Record<string, unknown>>;
  assert.deepEqual(
    statements.map((statement) => statement.variant),
    ["support-ticket-insert", "support-message-insert"],
  );
  for (const statement of statements) {
    const observedSql = statement.observedSql as Record<string, unknown>;
    assert.equal(observedSql.statementType, "INSERT");
    assert.equal(observedSql.persistedParameterValues, false);
    assert.equal(observedSql.sha256, sha256(String(observedSql.normalizedSql)));
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
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, /support-ticket-(?:owner|other)@/i);
  assert.doesNotMatch(serialized, /Urgent private support content/i);
  return evidence;
}

export async function runSupportTicketVerifier() {
  const root = process.cwd();
  const runtimeUrl = assertSupportTicketVerifierTarget(
    requiredEnvironment("SUPPORT_TICKET_VERIFY_DATABASE_URL"),
    process.env.SUPPORT_TICKET_VERIFY_CONFIRM,
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
    { withDbAnonymousContext, withDbRequestContext },
    { cleanText },
  ] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/db"),
    import("../src/lib/db-context"),
    import("../src/lib/content"),
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
    await setupSupportTicketFixtures(cleanupPrisma);
    cleanupRequired = true;

    const policyRows = await cleanupPrisma.$queryRawUnsafe<
      Array<{ policyName: string; command: string; withCheck: string }>
    >(`
      SELECT
        policyname AS "policyName",
        cmd AS "command",
        with_check AS "withCheck"
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'SupportMessage'
        AND policyname = 'giq_support_message_insert'
    `);
    assert.equal(policyRows.length, 1);
    assert.equal(policyRows[0].policyName, "giq_support_message_insert");
    assert.equal(policyRows[0].command, "INSERT");
    assert.match(policyRows[0].withCheck, /EXISTS/i);
    assert.match(policyRows[0].withCheck, /SupportTicket/i);
    assert.match(policyRows[0].withCheck, /giq_current_user_id/i);

    const rowCountsBefore = await countSupportFixtures(cleanupPrisma);
    assert.deepEqual(rowCountsBefore, { tickets: 0, messages: 0 });
    const isolationRows = await withDbRequestContext(OWNER, (tx) =>
      tx.$queryRawUnsafe<Array<{ transactionIsolation: string }>>(
        `SELECT current_setting('transaction_isolation') AS "transactionIsolation"`,
      ),
    );
    assert.deepEqual(isolationRows, [{ transactionIsolation: "read committed" }]);
    const rawBody =
      "  Urgent private support content with <markup> and a null\u0000 byte.  ";
    const cleanedBody = cleanText(rawBody);
    assert.equal(
      cleanedBody,
      "Urgent private support content with markup and a null byte.",
    );

    const firstCapture = await captureDisposableReplayQueries(() =>
      executeSupportTicketCreate(
        (fn) => withDbRequestContext(OWNER, fn),
        OWNER,
        "technical",
        cleanedBody,
      ),
    );
    const ticketEvent = exactObservedTableStatement(
      firstCapture.queries,
      "SupportTicket",
    );
    const messageEvent = exactObservedTableStatement(
      firstCapture.queries,
      "SupportMessage",
    );
    assert.ok(
      firstCapture.queries.indexOf(ticketEvent) <
        firstCapture.queries.indexOf(messageEvent),
    );
    assertStatementTransactionOutcome(
      firstCapture.queries,
      ticketEvent,
      "COMMIT",
    );
    assertStatementTransactionOutcome(
      firstCapture.queries,
      messageEvent,
      "COMMIT",
    );
    const ticketSql = observedInsertEvidence(ticketEvent, [
      { name: "generated SupportTicket.id", positions: [1], expectedKinds: ["cuid"] },
      { name: "current.dbUserId", positions: [2], expectedValues: [OWNER.dbUserId] },
      { name: "default open status", positions: [3], expectedValues: ["open"] },
      { name: "default normal priority", positions: [4], expectedValues: ["normal"] },
      { name: "parsed category", positions: [5], expectedValues: ["technical"] },
      { name: "Prisma createdAt and updatedAt", positions: [6, 7], expectedKinds: ["date", "date"] },
    ]);
    const messageSql = observedInsertEvidence(messageEvent, [
      { name: "generated SupportMessage.id", positions: [1], expectedKinds: ["cuid"] },
      { name: "created SupportTicket.id", positions: [2], expectedValues: [firstCapture.result.ticketId] },
      { name: "current.dbUserId", positions: [3], expectedValues: [OWNER.dbUserId] },
      { name: "cleanText(parsed.body)", positions: [4], expectedValues: [cleanedBody] },
      { name: "Prisma createdAt and updatedAt", positions: [5, 6], expectedKinds: ["date", "date"] },
    ]);
    const [ticketExplain, messageExplain] = await Promise.all([
      explainObservedStatement(
        (fn) => withDbRequestContext(OWNER, fn),
        ticketSql,
      ),
      explainObservedStatement(
        (fn) => withDbRequestContext(OWNER, fn),
        messageSql,
      ),
    ]);
    const rowCountsAfterFirstCommit = await countSupportFixtures(cleanupPrisma);
    assert.deepEqual(rowCountsAfterFirstCommit, { tickets: 1, messages: 1 });
    const persistedFirst = await cleanupPrisma.supportMessage.findUnique({
      where: { id: firstCapture.result.messageId },
      select: { body: true, ticketId: true, userId: true },
    });
    assert.deepEqual(persistedFirst, {
      body: cleanedBody,
      ticketId: firstCapture.result.ticketId,
      userId: OWNER.dbUserId,
    });

    let rollbackTicketId = "";
    let rollbackMessageId = "";
    const rollbackCapture = await captureDisposableReplayQueries(async () => {
      let rejected = false;
      try {
        await withDbRequestContext(OWNER, async (tx) => {
          const ticket = await tx.supportTicket.create({
            data: { userId: OWNER.dbUserId, category: "feedback" },
          });
          const message = await tx.supportMessage.create({
            data: {
              ticketId: ticket.id,
              userId: OWNER.dbUserId,
              body: "Rollback-only support message.",
            },
          });
          rollbackTicketId = ticket.id;
          rollbackMessageId = message.id;
          throw new Error("support_ticket.proof_forced_rollback");
        });
      } catch (error) {
        rejected =
          error instanceof Error &&
          error.message === "support_ticket.proof_forced_rollback";
      }
      return rejected;
    });
    assert.equal(rollbackCapture.result, true);
    assert.match(rollbackTicketId, CUID_PATTERN);
    assert.match(rollbackMessageId, CUID_PATTERN);
    assertStatementTransactionOutcome(
      rollbackCapture.queries,
      exactObservedTableStatement(rollbackCapture.queries, "SupportTicket"),
      "ROLLBACK",
    );
    assertStatementTransactionOutcome(
      rollbackCapture.queries,
      exactObservedTableStatement(rollbackCapture.queries, "SupportMessage"),
      "ROLLBACK",
    );
    assert.equal(
      await cleanupPrisma.supportTicket.count({ where: { id: rollbackTicketId } }),
      0,
    );
    assert.equal(
      await cleanupPrisma.supportMessage.count({ where: { id: rollbackMessageId } }),
      0,
    );
    const rowCountsAfterRollback = await countSupportFixtures(cleanupPrisma);
    assert.deepEqual(rowCountsAfterRollback, { tickets: 1, messages: 1 });

    const deniedTicketCapture = await captureDisposableReplayQueries(async () => {
      try {
        await withDbRequestContext(OTHER_USER, (tx) =>
          tx.supportTicket.create({
            data: { userId: OWNER.dbUserId, category: "technical" },
          }),
        );
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(deniedTicketCapture.result, true);
    const deniedTicketEvent = exactObservedTableStatement(
      deniedTicketCapture.queries,
      "SupportTicket",
    );
    assert.equal(normalizeObservedSql(deniedTicketEvent.query), ticketSql.normalizedSql);
    assertStatementTransactionOutcome(
      deniedTicketCapture.queries,
      deniedTicketEvent,
      "ROLLBACK",
    );

    const deniedMessageCapture = await captureDisposableReplayQueries(async () => {
      try {
        await withDbRequestContext(OTHER_USER, (tx) =>
          tx.supportMessage.create({
            data: {
              ticketId: firstCapture.result.ticketId,
              userId: OTHER_USER.dbUserId,
              body: "Cross-account support message must be denied.",
            },
          }),
        );
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(deniedMessageCapture.result, true);
    const deniedMessageEvent = exactObservedTableStatement(
      deniedMessageCapture.queries,
      "SupportMessage",
    );
    assert.equal(normalizeObservedSql(deniedMessageEvent.query), messageSql.normalizedSql);
    assertStatementTransactionOutcome(
      deniedMessageCapture.queries,
      deniedMessageEvent,
      "ROLLBACK",
    );

    const anonymousTicketCapture = await captureDisposableReplayQueries(async () => {
      try {
        await withDbAnonymousContext((tx) =>
          tx.supportTicket.create({
            data: { userId: OWNER.dbUserId, category: "technical" },
          }),
        );
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(anonymousTicketCapture.result, true);
    assertStatementTransactionOutcome(
      anonymousTicketCapture.queries,
      exactObservedTableStatement(
        anonymousTicketCapture.queries,
        "SupportTicket",
      ),
      "ROLLBACK",
    );
    const rowCountsAfterDeniedAttempts = await countSupportFixtures(cleanupPrisma);
    assert.deepEqual(rowCountsAfterDeniedAttempts, { tickets: 1, messages: 1 });

    const second = await executeSupportTicketCreate(
      (fn) => withDbRequestContext(OWNER, fn),
      OWNER,
      "technical",
      cleanedBody,
    );
    assert.notEqual(second.ticketId, firstCapture.result.ticketId);
    assert.notEqual(second.messageId, firstCapture.result.messageId);
    const rowCountsAfterPermittedDuplicate =
      await countSupportFixtures(cleanupPrisma);
    assert.deepEqual(rowCountsAfterPermittedDuplicate, { tickets: 2, messages: 2 });

    const removed = await cleanupSupportTicketFixtures(cleanupPrisma, true);
    cleanupRequired = false;
    const remaining = await countAllFixtureRows(cleanupPrisma);
    assert.deepEqual(remaining, {
      remainingSupportMessageRows: 0,
      remainingSupportTicketRows: 0,
      remainingProfileRows: 0,
      remainingUserRows: 0,
    });
    const report = {
      schemaVersion: SUPPORT_TICKET_EVIDENCE_SCHEMA_VERSION,
      auditKind: "support-ticket-create-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: runtimeUrl.hostname,
        port: Number(runtimeUrl.port),
        productionOrProviderSystemsContacted: false,
        fixtureOwner: "support-ticket-create-dedicated-proof",
        broadCleanupUsed: false,
      },
      runtimeIdentity: identities[0],
      sourceBinding: buildSupportTicketSourceBinding(root),
      proof: {
        queryId: "DB.SUPPORT.TICKET.CREATE.TRANSACTION",
        sourceFile: "src/app/actions.ts",
        sourceSymbol: "createSupportTicket",
        expectedMaximumRows: 2,
        rowCounts: {
          before: rowCountsBefore,
          afterFirstCommit: rowCountsAfterFirstCommit,
          afterRollback: rowCountsAfterRollback,
          afterDeniedAttempts: rowCountsAfterDeniedAttempts,
          afterPermittedDuplicate: rowCountsAfterPermittedDuplicate,
        },
        cases: {
          successfulTransaction: "one-ticket-and-one-initial-message-committed",
          transactionOrder: "ticket-insert-before-message-insert-before-commit",
          sanitization: "nul-and-angle-brackets-removed-before-persistence",
          rollback: "both-inserts-absent-after-forced-rollback",
          duplicateSubmit: "second-permitted-submit-created-one-distinct-pair",
          crossAccountTicketInsert: "denied-by-ticket-owner-policy",
          crossAccountMessageInsert:
            "denied-even-when-message-author-matches-caller-because-ticket-owner-differs",
          anonymousTicketInsert: "denied-by-ticket-owner-policy",
          supportMessagePolicy:
            "effective-policy-requires-message-author-and-ticket-owner",
          transactionIsolation: isolationRows[0].transactionIsolation,
        },
        statements: [
          {
            variant: "support-ticket-insert",
            observedSql: ticketSql.evidence,
            explain: ticketExplain,
          },
          {
            variant: "support-message-insert",
            observedSql: messageSql.evidence,
            explain: messageExplain,
          },
        ],
        status: "verified",
      },
      cleanup: {
        ...removed,
        ...remaining,
      },
      verdict: "verified",
    } as const;
    validateSupportTicketEvidence(report, root);
    const outputPath = resolve(root, SUPPORT_TICKET_EVIDENCE_PATH);
    const temporaryPath = `${outputPath}.tmp`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    return { report, outputPath };
  } finally {
    if (cleanupRequired) {
      await cleanupSupportTicketFixtures(cleanupPrisma, false);
    }
    await Promise.all([prisma.$disconnect(), cleanupPrisma.$disconnect()]);
  }
}

async function executeSupportTicketCreate(
  runner: TransactionRunner,
  current: DbContextUser,
  category: "general" | "billing" | "technical" | "feedback",
  body: string,
) {
  return runner(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        userId: current.dbUserId,
        category,
      },
    });
    const message = await tx.supportMessage.create({
      data: {
        ticketId: ticket.id,
        userId: current.dbUserId,
        body,
      },
    });
    return { ticketId: ticket.id, messageId: message.id };
  });
}

async function setupSupportTicketFixtures(prisma: PrismaClient) {
  await cleanupSupportTicketFixtures(prisma, false);
  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({
      data: [
        {
          id: OWNER.dbUserId,
          email: "support-ticket-owner@greyhoundiq.test",
          name: "Support Ticket Owner",
        },
        {
          id: OTHER_USER.dbUserId,
          email: "support-ticket-other@greyhoundiq.test",
          name: "Support Ticket Other",
        },
      ],
    });
    await tx.profile.createMany({
      data: [
        {
          id: OWNER.profileId,
          userId: OWNER.dbUserId,
          displayName: "Support Ticket Owner",
        },
        {
          id: OTHER_USER.profileId,
          userId: OTHER_USER.dbUserId,
          displayName: "Support Ticket Other",
        },
      ],
    });
  });
}

async function cleanupSupportTicketFixtures(
  prisma: PrismaClient,
  requireExact: boolean,
) {
  const result = await prisma.$transaction(async (tx) => {
    const messages = await tx.supportMessage.deleteMany({
      where: {
        OR: [
          { userId: { in: [...FIXTURE_USER_IDS] } },
          { ticket: { userId: { in: [...FIXTURE_USER_IDS] } } },
        ],
      },
    });
    const tickets = await tx.supportTicket.deleteMany({
      where: { userId: { in: [...FIXTURE_USER_IDS] } },
    });
    const profiles = await tx.profile.deleteMany({
      where: { id: { in: [OWNER.profileId, OTHER_USER.profileId] } },
    });
    const users = await tx.user.deleteMany({
      where: { id: { in: [...FIXTURE_USER_IDS] } },
    });
    return {
      supportMessageRowsDeleted: messages.count,
      supportTicketRowsDeleted: tickets.count,
      profileRowsDeleted: profiles.count,
      userRowsDeleted: users.count,
    };
  });
  if (requireExact) {
    assert.deepEqual(result, {
      supportMessageRowsDeleted: 2,
      supportTicketRowsDeleted: 2,
      profileRowsDeleted: 2,
      userRowsDeleted: 2,
    });
  }
  return result;
}

async function countSupportFixtures(prisma: PrismaClient) {
  const [tickets, messages] = await Promise.all([
    prisma.supportTicket.count({
      where: { userId: OWNER.dbUserId },
    }),
    prisma.supportMessage.count({
      where: {
        OR: [
          { userId: OWNER.dbUserId },
          { ticket: { userId: OWNER.dbUserId } },
        ],
      },
    }),
  ]);
  return { tickets, messages };
}

async function countAllFixtureRows(prisma: PrismaClient) {
  const [
    remainingSupportMessageRows,
    remainingSupportTicketRows,
    remainingProfileRows,
    remainingUserRows,
  ] = await Promise.all([
    prisma.supportMessage.count({
      where: { userId: { in: [...FIXTURE_USER_IDS] } },
    }),
    prisma.supportTicket.count({
      where: { userId: { in: [...FIXTURE_USER_IDS] } },
    }),
    prisma.profile.count({
      where: { id: { in: [OWNER.profileId, OTHER_USER.profileId] } },
    }),
    prisma.user.count({
      where: { id: { in: [...FIXTURE_USER_IDS] } },
    }),
  ]);
  return {
    remainingSupportMessageRows,
    remainingSupportTicketRows,
    remainingProfileRows,
    remainingUserRows,
  };
}

function exactObservedTableStatement(
  queries: readonly DisposableReplayQueryEvent[],
  table: "SupportTicket" | "SupportMessage",
) {
  const matches = queries.filter((event) => {
    const sql = normalizeObservedSql(event.query);
    return /^INSERT\b/i.test(sql) && sql.includes(`"public"."${table}"`);
  });
  assert.equal(matches.length, 1, `Expected exactly one ${table} INSERT`);
  return matches[0];
}

function assertStatementTransactionOutcome(
  queries: readonly DisposableReplayQueryEvent[],
  statement: DisposableReplayQueryEvent,
  expectedOutcome: "COMMIT" | "ROLLBACK",
) {
  const statementIndex = queries.indexOf(statement);
  assert.ok(statementIndex >= 0, "Observed INSERT must be in the capture");
  const beginIndex = queries.findLastIndex(
    (event, index) =>
      index < statementIndex && /^BEGIN\b/i.test(normalizeObservedSql(event.query)),
  );
  assert.ok(beginIndex >= 0, "Observed INSERT must follow BEGIN");
  const terminator = queries
    .slice(statementIndex + 1)
    .find((event) => /^(?:COMMIT|ROLLBACK)\b/i.test(normalizeObservedSql(event.query)));
  assert.ok(terminator, "Observed INSERT transaction must terminate");
  assert.equal(normalizeObservedSql(terminator.query), expectedOutcome);
}

function observedInsertEvidence(
  event: DisposableReplayQueryEvent,
  expectedBinds: readonly ExpectedPositionedBind[],
): ObservedSqlEvidence {
  const normalizedSql = normalizeObservedSql(event.query);
  assert.match(normalizedSql, /^INSERT\b/i);
  assert.doesNotMatch(normalizedSql, /;|--|\/\*/);
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
        if (typeof parameter === "string") {
          assert.ok(!normalizedSql.includes(parameter));
        }
      } else {
        explainParameters[position - 1] = observedTypedParameter(
          parameter,
          bind.expectedKinds?.[index],
        );
      }
    });
  }
  return {
    normalizedSql,
    parameters: explainParameters,
    evidence: {
      statementType: "INSERT",
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
  expected: "cuid" | "date" | undefined,
) {
  if (expected === "cuid") {
    assert.ok(typeof value === "string" && CUID_PATTERN.test(value));
    return value;
  }
  assert.equal(expected, "date");
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
  const { report, outputPath } = await runSupportTicketVerifier();
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
