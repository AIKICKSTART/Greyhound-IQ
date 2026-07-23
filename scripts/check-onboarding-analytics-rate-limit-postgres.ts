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

export const ONBOARDING_RATE_LIMIT_VERIFY_CONFIRMATION =
  "verify-onboarding-rate-limit-on-disposable-loopback-55734";
export const ONBOARDING_RATE_LIMIT_EVIDENCE_PATH =
  "output/database-audit/onboarding-analytics-rate-limit.json";
export const ONBOARDING_RATE_LIMIT_EVIDENCE_SCHEMA_VERSION = 1;

const QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const CONTENTION_START_COUNT = 5_996;
const CONTENTION_REQUESTS = 8;
const SOURCE_FILES = [
  "prisma/migrations/20260705120000_add_rate_limit_and_call_type/migration.sql",
  "prisma/migrations/20260708170000_force_row_level_security/migration.sql",
  "prisma/migrations/20260708192000_restrict_audit_ratelimit_rls/migration.sql",
  "prisma/schema.prisma",
  "scripts/check-onboarding-analytics-rate-limit-postgres.ts",
  "scripts/check-onboarding-analytics-rate-limit-postgres.test.ts",
  "security/database-operations.ts",
  "src/app/api/analytics/onboarding/handler.ts",
  "src/app/api/analytics/onboarding/route.ts",
  "src/app/api/analytics/onboarding/route.test.ts",
  "src/lib/db-context.ts",
  "src/lib/db.ts",
  "src/lib/rate-limit.ts",
] as const;

const REQUEST_USER: DbContextUser = {
  dbUserId: "onboarding-rate-limit-request-user-proof",
  profileId: "onboarding-rate-limit-request-profile-proof",
  profileRole: "member",
  tier: "free",
};

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

type ObservedUpsert = {
  normalizedSql: string;
  parameters: unknown[];
  evidence: {
    statementType: "INSERT_ON_CONFLICT_UPDATE";
    normalizedSql: string;
    sha256: string;
    parameterCount: number;
    namedBinds: Array<{ name: string; positions: number[] }>;
    persistedParameterValues: false;
  };
};

export function assertOnboardingRateLimitVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, ONBOARDING_RATE_LIMIT_VERIFY_CONFIRMATION);
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

export function buildOnboardingRateLimitSourceBinding(
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

export function validateOnboardingRateLimitEvidence(
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
    ONBOARDING_RATE_LIMIT_EVIDENCE_SCHEMA_VERSION,
  );
  assert.equal(
    evidence.auditKind,
    "onboarding-analytics-rate-limit-disposable-proof",
  );
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(
    evidence.sourceBinding,
    buildOnboardingRateLimitSourceBinding(root),
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
  assert.deepEqual(evidence.safety, {
    scope: "literal-loopback-disposable-replay-only",
    host: "127.0.0.1",
    port: 55734,
    productionOrProviderSystemsContacted: false,
    fixtureOwner: "onboarding-analytics-rate-limit-dedicated-proof",
    broadCleanupUsed: false,
  });
  assert.deepEqual(evidence.cleanup, {
    rateLimitRowsDeleted: 1,
    remainingRateLimitRows: 0,
  });

  const proof = plainObject(evidence.proof, "proof");
  assert.equal(proof.queryId, "DB.ONBOARDING.ANALYTICS.RATE_LIMIT");
  assert.equal(proof.sourceFile, "src/lib/rate-limit.ts");
  assert.equal(proof.sourceSymbol, "checkRateLimit");
  assert.equal(proof.limit, 6_000);
  assert.equal(proof.windowMilliseconds, 60_000);
  assert.equal(proof.maximumRowsReturnedPerCall, 1);
  assert.equal(proof.status, "verified");
  assert.deepEqual(proof.catalog, {
    table: "RateLimit",
    persistence: "unlogged",
    rowLevelSecurityEnabled: true,
    rowLevelSecurityForced: true,
    policyName: "giq_rate_limit_all",
    policyCommand: "ALL",
    policyUsing: "giq_is_system()",
    policyWithCheck: "giq_is_system()",
    primaryKey: "RateLimit_pkey",
    expiryIndex: "RateLimit_resetAt_idx",
  });
  assert.deepEqual(proof.cases, {
    firstInsert: "count-1-allowed-remaining-5999",
    contention:
      "eight-concurrent-upserts-from-5996-finish-at-6004-with-four-allowed-and-four-denied",
    expiredWindowReset: "expired-count-42-resets-to-count-1",
    requestContext: "exact-upsert-denied-by-system-only-rls",
    anonymousContext: "exact-upsert-denied-by-system-only-rls",
    routeAtLimit: "real-database-decision-returned-http-429-before-recording",
    transactionContext:
      "each-production-upsert-follows-system-set-config-inside-a-committed-transaction",
  });
  assert.deepEqual(proof.contention, {
    startingCount: CONTENTION_START_COUNT,
    requests: CONTENTION_REQUESTS,
    allowed: 4,
    denied: 4,
    finalCount: 6_004,
  });

  const statement = plainObject(proof.statement, "statement");
  const observedSql = plainObject(statement.observedSql, "observedSql");
  assert.equal(observedSql.statementType, "INSERT_ON_CONFLICT_UPDATE");
  assert.ok(
    typeof observedSql.normalizedSql === "string" &&
      /^INSERT INTO "RateLimit"/i.test(observedSql.normalizedSql),
  );
  assert.match(String(observedSql.normalizedSql), /ON CONFLICT \("key"\) DO UPDATE/i);
  assert.match(String(observedSql.normalizedSql), /RETURNING "count", "resetAt"/i);
  assert.doesNotMatch(String(observedSql.normalizedSql), /;|--|\/\*/);
  assert.equal(observedSql.sha256, sha256(String(observedSql.normalizedSql)));
  assert.equal(observedSql.parameterCount, 3);
  assert.deepEqual(observedSql.namedBinds, [
    { name: "constant analytics:onboarding:global key", positions: [1] },
    { name: "60-second window", positions: [2, 3] },
  ]);
  assert.equal(observedSql.persistedParameterValues, false);
  const explain = plainObject(statement.explain, "explain");
  assert.equal(explain.format, "postgresql-json-cost-plan");
  assert.equal(explain.analyze, false);
  assert.equal(explain.buffers, false);
  assert.equal(explain.statementTimeoutMilliseconds, EXPLAIN_STATEMENT_TIMEOUT_MS);
  assert.equal(explain.sanitized, true);
  assert.equal(explain.planSha256, sha256(JSON.stringify(explain.plan)));

  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, /onboarding-rate-limit-request-(?:user|profile)-proof/i);
  return evidence;
}

export async function runOnboardingRateLimitVerifier() {
  const root = process.cwd();
  const runtimeUrl = assertOnboardingRateLimitVerifierTarget(
    requiredEnvironment("ONBOARDING_RATE_LIMIT_VERIFY_DATABASE_URL"),
    process.env.ONBOARDING_RATE_LIMIT_VERIFY_CONFIRM,
  );
  const applicationUrl = new URL(runtimeUrl);
  applicationUrl.searchParams.set("connection_limit", "16");
  process.env.DATABASE_URL = applicationUrl.toString();
  process.env.DIRECT_URL = applicationUrl.toString();
  process.env.DEMO_FIXTURE_QUERY_EVIDENCE_MODE = QUERY_EVIDENCE_MODE;

  const cleanupUrl = new URL(runtimeUrl);
  cleanupUrl.username = "postgres";
  const [
    { PrismaClient },
    { prisma, captureDisposableReplayQueries },
    { withDbAnonymousContext, withDbRequestContext, withDbSystemContext },
    {
      ONBOARDING_ANALYTICS_RATE_LIMIT,
      ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
      ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS,
      handleOnboardingAnalyticsPost,
    },
    { ONBOARDING_ANALYTICS_CONSENT_HEADER },
    { checkRateLimit },
  ] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/db"),
    import("../src/lib/db-context"),
    import("../src/app/api/analytics/onboarding/handler"),
    import("../src/components/onboarding-analytics-client"),
    import("../src/lib/rate-limit"),
  ]);
  const cleanupPrisma = new PrismaClient({
    datasources: { db: { url: cleanupUrl.toString() } },
  });
  let cleanupRequired = false;

  try {
    assert.equal(ONBOARDING_ANALYTICS_RATE_LIMIT, 6_000);
    assert.equal(ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS, 60_000);
    assert.equal(
      ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
      "analytics:onboarding:global",
    );
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

    const catalog = await readRateLimitCatalog(cleanupPrisma);
    assert.deepEqual(catalog, {
      table: "RateLimit",
      persistence: "unlogged",
      rowLevelSecurityEnabled: true,
      rowLevelSecurityForced: true,
      policyName: "giq_rate_limit_all",
      policyCommand: "ALL",
      policyUsing: "giq_is_system()",
      policyWithCheck: "giq_is_system()",
      primaryKey: "RateLimit_pkey",
      expiryIndex: "RateLimit_resetAt_idx",
    });

    await cleanupFixture(cleanupPrisma, ONBOARDING_ANALYTICS_RATE_LIMIT_KEY);
    cleanupRequired = true;
    assert.equal(
      await countFixture(cleanupPrisma, ONBOARDING_ANALYTICS_RATE_LIMIT_KEY),
      0,
    );

    const firstCapture = await captureDisposableReplayQueries(() =>
      checkRateLimit(
        ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
        ONBOARDING_ANALYTICS_RATE_LIMIT,
        ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS,
        { failClosed: true },
      ),
    );
    assert.deepEqual(
      {
        allowed: firstCapture.result.allowed,
        remaining: firstCapture.result.remaining,
      },
      { allowed: true, remaining: 5_999 },
    );
    const firstRow = await exactFixtureRow(
      cleanupPrisma,
      ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
    );
    assert.equal(firstRow.count, 1);
    assert.equal(firstCapture.result.resetAt, firstRow.resetAt.getTime());
    const firstEvent = exactUpsertEvent(firstCapture.queries);
    assertSystemTransaction(firstCapture.queries, firstEvent);
    const observed = observedUpsertEvidence(
      firstEvent,
      ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
      ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS / 1_000,
    );
    const explain = await explainObservedUpsert(
      withDbSystemContext,
      observed,
    );

    const contentionResetAt = new Date(Date.now() + 5 * 60_000);
    await cleanupPrisma.rateLimit.update({
      where: { key: ONBOARDING_ANALYTICS_RATE_LIMIT_KEY },
      data: { count: CONTENTION_START_COUNT, resetAt: contentionResetAt },
    });
    const contentionCapture = await captureDisposableReplayQueries(() =>
      Promise.all(
        Array.from({ length: CONTENTION_REQUESTS }, () =>
          checkRateLimit(
            ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
            ONBOARDING_ANALYTICS_RATE_LIMIT,
            ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS,
            { failClosed: true },
          ),
        ),
      ),
    );
    const contentionAllowed = contentionCapture.result.filter(
      (result) => result.allowed,
    ).length;
    const contentionDenied = contentionCapture.result.length - contentionAllowed;
    assert.equal(contentionAllowed, 4);
    assert.equal(contentionDenied, 4);
    assert.ok(
      contentionCapture.result.every(
        (result) => result.resetAt === contentionResetAt.getTime(),
      ),
    );
    const contentionRow = await exactFixtureRow(
      cleanupPrisma,
      ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
    );
    assert.equal(contentionRow.count, 6_004);
    const contentionEvents = contentionCapture.queries.filter(isUpsertEvent);
    assert.equal(contentionEvents.length, CONTENTION_REQUESTS);
    assert.equal(
      contentionCapture.queries.filter((event) =>
        /^COMMIT\b/i.test(normalizeObservedSql(event.query)),
      ).length,
      CONTENTION_REQUESTS,
    );
    assert.equal(
      contentionCapture.queries.filter((event) =>
        normalizeObservedSql(event.query).includes("set_config('app.system', 'true'"),
      ).length,
      CONTENTION_REQUESTS,
    );
    for (const event of contentionEvents) {
      assert.equal(normalizeObservedSql(event.query), observed.normalizedSql);
    }

    const expiredResetAt = new Date(Date.now() - 60_000);
    await cleanupPrisma.rateLimit.update({
      where: { key: ONBOARDING_ANALYTICS_RATE_LIMIT_KEY },
      data: { count: 42, resetAt: expiredResetAt },
    });
    const resetResult = await checkRateLimit(
      ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
      ONBOARDING_ANALYTICS_RATE_LIMIT,
      ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    assert.equal(resetResult.allowed, true);
    assert.equal(resetResult.remaining, 5_999);
    const resetRow = await exactFixtureRow(
      cleanupPrisma,
      ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
    );
    assert.equal(resetRow.count, 1);
    assert.ok(resetRow.resetAt.getTime() > expiredResetAt.getTime());

    await assertContextUpsertDenied(
      () =>
        withDbRequestContext(REQUEST_USER, (tx) =>
          executeExactRateLimitUpsert(
            tx,
            ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
            ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS / 1_000,
          ),
        ),
      "request",
    );
    await assertContextUpsertDenied(
      () =>
        withDbAnonymousContext((tx) =>
          executeExactRateLimitUpsert(
            tx,
            ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
            ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS / 1_000,
          ),
        ),
      "anonymous",
    );
    assert.equal(
      (
        await exactFixtureRow(
          cleanupPrisma,
          ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
        )
      ).count,
      1,
    );

    await cleanupPrisma.rateLimit.update({
      where: { key: ONBOARDING_ANALYTICS_RATE_LIMIT_KEY },
      data: {
        count: ONBOARDING_ANALYTICS_RATE_LIMIT,
        resetAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    let recorded = false;
    const routeResponse = await handleOnboardingAnalyticsPost(
      onboardingRequest(ONBOARDING_ANALYTICS_CONSENT_HEADER),
      {
        checkLimit: checkRateLimit,
        record: async () => {
          recorded = true;
        },
      },
    );
    assert.equal(routeResponse.status, 429);
    assert.equal(recorded, false);
    assert.equal(
      (
        await exactFixtureRow(
          cleanupPrisma,
          ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
        )
      ).count,
      ONBOARDING_ANALYTICS_RATE_LIMIT + 1,
    );

    const removed = await cleanupFixture(
      cleanupPrisma,
      ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
    );
    cleanupRequired = false;
    assert.equal(removed, 1);
    const remaining = await countFixture(
      cleanupPrisma,
      ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
    );
    assert.equal(remaining, 0);

    const report = {
      schemaVersion: ONBOARDING_RATE_LIMIT_EVIDENCE_SCHEMA_VERSION,
      auditKind: "onboarding-analytics-rate-limit-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: runtimeUrl.hostname,
        port: Number(runtimeUrl.port),
        productionOrProviderSystemsContacted: false,
        fixtureOwner: "onboarding-analytics-rate-limit-dedicated-proof",
        broadCleanupUsed: false,
      },
      runtimeIdentity: identities[0],
      sourceBinding: buildOnboardingRateLimitSourceBinding(root),
      proof: {
        queryId: "DB.ONBOARDING.ANALYTICS.RATE_LIMIT",
        sourceFile: "src/lib/rate-limit.ts",
        sourceSymbol: "checkRateLimit",
        limit: ONBOARDING_ANALYTICS_RATE_LIMIT,
        windowMilliseconds: ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS,
        maximumRowsReturnedPerCall: 1,
        catalog,
        cases: {
          firstInsert: "count-1-allowed-remaining-5999",
          contention:
            "eight-concurrent-upserts-from-5996-finish-at-6004-with-four-allowed-and-four-denied",
          expiredWindowReset: "expired-count-42-resets-to-count-1",
          requestContext: "exact-upsert-denied-by-system-only-rls",
          anonymousContext: "exact-upsert-denied-by-system-only-rls",
          routeAtLimit:
            "real-database-decision-returned-http-429-before-recording",
          transactionContext:
            "each-production-upsert-follows-system-set-config-inside-a-committed-transaction",
        },
        contention: {
          startingCount: CONTENTION_START_COUNT,
          requests: CONTENTION_REQUESTS,
          allowed: contentionAllowed,
          denied: contentionDenied,
          finalCount: contentionRow.count,
        },
        statement: {
          variant: "onboarding-global-fixed-window-upsert",
          observedSql: observed.evidence,
          explain,
        },
        status: "verified",
      },
      cleanup: {
        rateLimitRowsDeleted: removed,
        remainingRateLimitRows: remaining,
      },
      verdict: "verified",
    } as const;
    validateOnboardingRateLimitEvidence(report, root);
    const outputPath = resolve(root, ONBOARDING_RATE_LIMIT_EVIDENCE_PATH);
    const temporaryPath = `${outputPath}.tmp`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    return { report, outputPath };
  } finally {
    if (cleanupRequired) {
      await cleanupFixture(cleanupPrisma, ONBOARDING_ANALYTICS_RATE_LIMIT_KEY);
    }
    await Promise.all([prisma.$disconnect(), cleanupPrisma.$disconnect()]);
  }
}

async function readRateLimitCatalog(prisma: PrismaClient) {
  const [table] = await prisma.$queryRawUnsafe<
    Array<{
      persistence: string;
      rowLevelSecurityEnabled: boolean;
      rowLevelSecurityForced: boolean;
    }>
  >(`
    SELECT
      c.relpersistence AS "persistence",
      c.relrowsecurity AS "rowLevelSecurityEnabled",
      c.relforcerowsecurity AS "rowLevelSecurityForced"
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'RateLimit'
  `);
  assert.ok(table);
  const [policy] = await prisma.$queryRawUnsafe<
    Array<{
      policyName: string;
      policyCommand: string;
      policyUsing: string;
      policyWithCheck: string;
    }>
  >(`
    SELECT
      policyname AS "policyName",
      cmd AS "policyCommand",
      qual AS "policyUsing",
      with_check AS "policyWithCheck"
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'RateLimit'
      AND policyname = 'giq_rate_limit_all'
  `);
  assert.ok(policy);
  const indexes = await prisma.$queryRawUnsafe<Array<{ indexName: string }>>(`
    SELECT indexname AS "indexName"
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'RateLimit'
    ORDER BY indexname
  `);
  assert.deepEqual(
    indexes.map((row) => row.indexName),
    ["RateLimit_pkey", "RateLimit_resetAt_idx"],
  );
  return {
    table: "RateLimit",
    persistence:
      table.persistence === "u" ? "unlogged" : table.persistence,
    rowLevelSecurityEnabled: table.rowLevelSecurityEnabled,
    rowLevelSecurityForced: table.rowLevelSecurityForced,
    policyName: policy.policyName,
    policyCommand: policy.policyCommand,
    policyUsing: normalizePolicyExpression(policy.policyUsing),
    policyWithCheck: normalizePolicyExpression(policy.policyWithCheck),
    primaryKey: "RateLimit_pkey",
    expiryIndex: "RateLimit_resetAt_idx",
  };
}

function normalizePolicyExpression(value: string) {
  return value.replace(/^\(([\s\S]*)\)$/, "$1").trim();
}

async function exactFixtureRow(prisma: PrismaClient, key: string) {
  const row = await prisma.rateLimit.findUnique({
    where: { key },
    select: { count: true, resetAt: true },
  });
  assert.ok(row);
  return row;
}

async function countFixture(prisma: PrismaClient, key: string) {
  return prisma.rateLimit.count({ where: { key } });
}

async function cleanupFixture(prisma: PrismaClient, key: string) {
  return (await prisma.rateLimit.deleteMany({ where: { key } })).count;
}

async function assertContextUpsertDenied(
  operation: () => Promise<unknown>,
  label: string,
) {
  let denied = false;
  try {
    await operation();
  } catch {
    denied = true;
  }
  assert.equal(denied, true, `${label} context must be denied by RateLimit RLS`);
}

function executeExactRateLimitUpsert(
  tx: DbContextClient,
  key: string,
  windowSeconds: number,
) {
  return tx.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimit" ("key","count","resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `;
}

function exactUpsertEvent(queries: readonly DisposableReplayQueryEvent[]) {
  const matches = queries.filter(isUpsertEvent);
  assert.equal(matches.length, 1, "Expected exactly one RateLimit upsert");
  return matches[0];
}

function isUpsertEvent(event: DisposableReplayQueryEvent) {
  const sql = normalizeObservedSql(event.query);
  return (
    /^INSERT INTO "RateLimit"/i.test(sql) &&
    /ON CONFLICT \("key"\) DO UPDATE/i.test(sql)
  );
}

function assertSystemTransaction(
  queries: readonly DisposableReplayQueryEvent[],
  statement: DisposableReplayQueryEvent,
) {
  const statementIndex = queries.indexOf(statement);
  assert.ok(statementIndex >= 0);
  const before = queries.slice(0, statementIndex).map((event) =>
    normalizeObservedSql(event.query),
  );
  assert.ok(before.some((sql) => /^BEGIN\b/i.test(sql)));
  assert.ok(
    before.some((sql) =>
      sql.includes("set_config('app.system', 'true', true)"),
    ),
  );
  const terminator = queries
    .slice(statementIndex + 1)
    .map((event) => normalizeObservedSql(event.query))
    .find((sql) => /^(?:COMMIT|ROLLBACK)\b/i.test(sql));
  assert.equal(terminator, "COMMIT");
}

function observedUpsertEvidence(
  event: DisposableReplayQueryEvent,
  expectedKey: string,
  expectedWindowSeconds: number,
): ObservedUpsert {
  const normalizedSql = normalizeObservedSql(event.query);
  assert.match(normalizedSql, /^INSERT INTO "RateLimit"/i);
  assert.match(normalizedSql, /ON CONFLICT \("key"\) DO UPDATE/i);
  assert.match(normalizedSql, /RETURNING "count", "resetAt"/i);
  assert.doesNotMatch(normalizedSql, /;|--|\/\*/);
  const parsed = JSON.parse(event.params) as unknown;
  assert.ok(Array.isArray(parsed));
  assert.deepEqual(parsed, [
    expectedKey,
    expectedWindowSeconds,
    expectedWindowSeconds,
  ]);
  assert.equal(normalizedSql.includes(expectedKey), false);
  assert.deepEqual(
    [
      ...new Set(
        [...normalizedSql.matchAll(/\$(\d+)\b/g)].map((match) =>
          Number(match[1]),
        ),
      ),
    ].sort((left, right) => left - right),
    [1, 2, 3],
  );
  return {
    normalizedSql,
    parameters: parsed,
    evidence: {
      statementType: "INSERT_ON_CONFLICT_UPDATE",
      normalizedSql,
      sha256: sha256(normalizedSql),
      parameterCount: parsed.length,
      namedBinds: [
        { name: "constant analytics:onboarding:global key", positions: [1] },
        { name: "60-second window", positions: [2, 3] },
      ],
      persistedParameterValues: false,
    },
  };
}

async function explainObservedUpsert(
  runner: <T>(
    fn: (tx: DbContextClient) => Promise<T>,
  ) => Promise<T>,
  observed: ObservedUpsert,
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
  const container = plainObject(queryPlan[0], "EXPLAIN plan container");
  return sanitizeExplainNode(container.Plan);
}

function sanitizeExplainNode(value: unknown): {
  nodeType: string;
  relationName: string | null;
  indexName: string | null;
  estimatedRows: number;
  totalCost: number;
  children: ReturnType<typeof sanitizeExplainNode>[];
} {
  const node = plainObject(value, "EXPLAIN plan node");
  const children = node.Plans ?? [];
  assert.ok(Array.isArray(children));
  return {
    nodeType: requiredString(node["Node Type"], "Node Type"),
    relationName: optionalString(node["Relation Name"], "Relation Name"),
    indexName: optionalString(node["Index Name"], "Index Name"),
    estimatedRows: requiredNumber(node["Plan Rows"], "Plan Rows"),
    totalCost: requiredNumber(node["Total Cost"], "Total Cost"),
    children: children.map(sanitizeExplainNode),
  };
}

function onboardingRequest(consentHeader: string) {
  const body = "{}";
  return new Request("https://greyhoundsiq.com.au/api/analytics/onboarding", {
    method: "POST",
    headers: {
      [consentHeader]: "accepted",
      "content-length": String(Buffer.byteLength(body)),
      "content-type": "application/json",
      origin: "https://greyhoundsiq.com.au",
      "sec-fetch-site": "same-origin",
    },
    body,
  });
}

function normalizeObservedSql(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function plainObject(value: unknown, label: string) {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string) {
  assert.ok(typeof value === "string" && value.length > 0, label);
  return value;
}

function optionalString(value: unknown, label: string) {
  return value === undefined ? null : requiredString(value, label);
}

function requiredNumber(value: unknown, label: string) {
  assert.ok(typeof value === "number" && Number.isFinite(value) && value >= 0, label);
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
  const { report, outputPath } = await runOnboardingRateLimitVerifier();
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
