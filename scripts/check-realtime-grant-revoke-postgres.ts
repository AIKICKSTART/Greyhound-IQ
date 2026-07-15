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

import type {
  Prisma,
  PrismaClient,
  Prisma as PrismaTypes,
} from "@prisma/client";

export const REALTIME_GRANT_REVOKE_VERIFY_CONFIRMATION =
  "verify-realtime-grant-revoke-on-disposable-loopback-55734";
export const REALTIME_GRANT_REVOKE_EVIDENCE_PATH =
  "output/database-audit/realtime-grant-revoke.json";
export const REALTIME_GRANT_REVOKE_EVIDENCE_SCHEMA_VERSION = 1;

const PROOF_DATABASE = "greyhoundiq_realtime_proof";
const EXPLAIN_STATEMENT_TIMEOUT_MS = 5_000;
const MAXIMUM_DELETED_ROWS = 200;
const FIXTURE_PROFILES = [
  "realtime-grant-profile-a-proof",
  "realtime-grant-profile-b-proof",
  "realtime-grant-profile-c-proof",
] as const;
const TOPIC_ONE = `conversation:${"a".repeat(48)}`;
const TOPIC_TWO = `conversation:${"b".repeat(48)}`;
const SOURCE_FILES = [
  "scripts/sql/supabase-private-realtime-policies.sql",
  "scripts/check-realtime-grant-revoke-postgres.ts",
  "scripts/check-realtime-grant-revoke-postgres.test.ts",
  "security/database-operations.ts",
  "src/lib/realtime-service.ts",
  "src/lib/realtime-authorization.test.ts",
] as const;
const REQUIRED_ROLES = ["anon", "authenticated", "service_role"] as const;

type SourceBinding = {
  files: Record<string, string>;
  combinedSha256: string;
};

type QueryEvent = {
  query: string;
  params: string;
};

type QueryEventClient = PrismaClient & {
  $on(event: "query", callback: (event: QueryEvent) => void): void;
};

type PlanNode = {
  nodeType: string;
  relationName: string | null;
  indexName: string | null;
  joinType: string | null;
  scanDirection: string | null;
  estimatedRows: number;
  totalCost: number;
  children: PlanNode[];
};

export function assertRealtimeGrantRevokeVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, REALTIME_GRANT_REVOKE_VERIFY_CONFIRMATION);
  const url = new URL(value);
  assert.ok(url.protocol === "postgresql:" || url.protocol === "postgres:");
  assert.ok(url.hostname === "127.0.0.1" || url.hostname === "::1");
  assert.equal(url.port, "55734");
  assert.equal(url.pathname, "/postgres");
  assert.equal(decodeURIComponent(url.username), "postgres");
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

export function buildRealtimeGrantRevokeSourceBinding(
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

export function validateRealtimeGrantRevokeEvidence(
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
    "safety",
    "schemaVersion",
    "sourceBinding",
    "verdict",
  ]);
  assert.equal(
    evidence.schemaVersion,
    REALTIME_GRANT_REVOKE_EVIDENCE_SCHEMA_VERSION,
  );
  assert.equal(
    evidence.auditKind,
    "realtime-grant-revoke-isolated-database-proof",
  );
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(
    evidence.sourceBinding,
    buildRealtimeGrantRevokeSourceBinding(root),
  );
  assert.deepEqual(evidence.safety, {
    scope: "fixed-isolated-loopback-database-only",
    host: "127.0.0.1",
    port: 55734,
    adminDatabase: "postgres",
    proofDatabase: PROOF_DATABASE,
    productionOrProviderSystemsContacted: false,
    broadCleanupUsed: false,
  });
  const cleanup = evidence.cleanup as Record<string, unknown>;
  assert.equal(cleanup.proofDatabaseDropped, true);
  assert.equal(cleanup.remainingProofDatabases, 0);
  assert.deepEqual(cleanup.rolesDropped, cleanup.rolesCreatedForProof);
  assert.ok(Array.isArray(cleanup.rolesCreatedForProof));
  assert.ok(
    (cleanup.rolesCreatedForProof as unknown[]).every(
      (role) => typeof role === "string" && REQUIRED_ROLES.includes(role as never),
    ),
  );

  const proof = evidence.proof as Record<string, unknown>;
  assert.equal(proof.queryId, "DB.PULSE.REALTIME_GRANT.REVOKE");
  assert.equal(proof.sourceFile, "src/lib/realtime-service.ts");
  assert.equal(proof.sourceSymbol, "revokeRealtimeTopicGrants");
  assert.equal(proof.storedProcedure, "giq_revoke_realtime_topic_grants");
  assert.equal(proof.maximumDeletedRows, MAXIMUM_DELETED_ROWS);
  assert.equal(proof.status, "verified");
  assert.deepEqual(proof.runtimeIdentity, {
    currentUser: "service_role",
    sessionUser: "postgres",
    database: PROOF_DATABASE,
    schema: "public",
    superuser: false,
  });
  assert.deepEqual(proof.privileges, {
    serviceRoleExecute: true,
    anonymousExecute: false,
    authenticatedExecute: false,
    publicExecute: false,
    anonymousCallDenied: true,
    authenticatedCallDenied: true,
    directTableAccessForServiceRole: false,
  });
  assert.deepEqual(proof.functionSecurity, {
    securityDefiner: true,
    searchPath: "search_path=\"\"",
    profileLimit: 10,
    topicLimit: 10,
    topicPattern: "conversation-colon-48-lowercase-hex",
    deterministicProfileLockOrder: true,
  });
  assert.deepEqual(proof.rowCounts, {
    before: 6,
    afterAuthorizedRevoke: 2,
    afterIdempotentReplay: 2,
    afterDeniedCalls: 2,
    afterInvalidCalls: 2,
  });
  assert.deepEqual(proof.cases, {
    authorizedDelete:
      "service-role-deleted-both-extensions-for-two-profiles-and-one-topic",
    unrelatedRows: "other-profile-or-topic-rows-preserved",
    idempotency: "identical-second-revocation-left-row-count-unchanged",
    anonymousDenied: "function-execute-denied-before-security-definer-body",
    authenticatedDenied: "function-execute-denied-before-security-definer-body",
    invalidEmptyInput: "procedure-rejected-empty-profile-array",
    invalidOversizedInput: "procedure-rejected-eleven-profile-identifiers",
    invalidTopic: "procedure-rejected-non-conversation-topic",
  });
  const invocation = proof.invocation as Record<string, unknown>;
  assert.equal(invocation.statementType, "SELECT");
  assert.equal(invocation.persistedParameterValues, false);
  assert.equal(invocation.parameterCount, 3);
  assert.equal(invocation.sha256, sha256(String(invocation.normalizedSql)));
  assert.match(
    String(invocation.normalizedSql),
    /^SELECT public\.giq_revoke_realtime_topic_grants\(/,
  );
  const definition = proof.functionDefinition as Record<string, unknown>;
  assert.equal(definition.persistedSql, false);
  assert.equal(definition.sha256, definition.sourceSha256);
  const explain = proof.deletePlan as Record<string, unknown>;
  assert.equal(explain.format, "postgresql-json-cost-plan");
  assert.equal(explain.analyze, false);
  assert.equal(explain.buffers, false);
  assert.equal(explain.sanitized, true);
  assert.equal(
    explain.statementTimeoutMilliseconds,
    EXPLAIN_STATEMENT_TIMEOUT_MS,
  );
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, /realtime-grant-profile-[abc]-proof/i);
  assert.doesNotMatch(serialized, /conversation:[ab]{48}/i);
  return evidence;
}

export async function runRealtimeGrantRevokeVerifier() {
  const root = process.cwd();
  const adminUrl = assertRealtimeGrantRevokeVerifierTarget(
    requiredEnvironment("REALTIME_GRANT_REVOKE_VERIFY_ADMIN_DATABASE_URL"),
    process.env.REALTIME_GRANT_REVOKE_VERIFY_CONFIRM,
  );
  const adminApplicationUrl = new URL(adminUrl);
  adminApplicationUrl.searchParams.set("connection_limit", "1");
  const proofUrl = new URL(adminApplicationUrl);
  proofUrl.pathname = `/${PROOF_DATABASE}`;

  const { Prisma: PrismaRuntime, PrismaClient } = await import("@prisma/client");
  const admin = new PrismaClient({
    datasources: { db: { url: adminApplicationUrl.toString() } },
  });
  const rolesCreatedForProof: Array<(typeof REQUIRED_ROLES)[number]> = [];
  const rolesDropped: Array<(typeof REQUIRED_ROLES)[number]> = [];
  let proof: PrismaClient | null = null;
  let proofDatabaseCreated = false;
  let proofDatabaseDropped = false;
  let operationProof: Record<string, unknown> | null = null;

  try {
    await dropProofDatabase(admin);
    const existingRoles = await admin.$queryRaw<Array<{ role: string }>>`
      SELECT rolname AS role
      FROM pg_roles
      WHERE rolname IN ('anon', 'authenticated', 'service_role')
    `;
    const existingRoleNames = new Set(existingRoles.map((row) => row.role));
    for (const role of REQUIRED_ROLES) {
      if (existingRoleNames.has(role)) continue;
      await admin.$executeRawUnsafe(createRoleSql(role));
      rolesCreatedForProof.push(role);
    }
    await admin.$executeRawUnsafe(`CREATE DATABASE ${PROOF_DATABASE}`);
    proofDatabaseCreated = true;

    const queryEvents: QueryEvent[] = [];
    proof = new PrismaClient({
      datasources: { db: { url: proofUrl.toString() } },
      log: [{ emit: "event", level: "query" }],
    });
    (proof as QueryEventClient).$on("query", (event) => {
      queryEvents.push({ query: event.query, params: event.params });
    });

    const policySource = readFileSync(
      resolve(root, "scripts/sql/supabase-private-realtime-policies.sql"),
      "utf8",
    );
    const tableStatements = extractTableStatements(policySource);
    for (const statement of tableStatements) {
      await proof.$executeRawUnsafe(statement);
    }
    const functionSql = extractRequired(
      policySource,
      /create or replace function public\.giq_revoke_realtime_topic_grants\([\s\S]*?\n\$\$;/i,
      "revoke function",
    );
    const revokeSql = extractRequired(
      policySource,
      /revoke all on function public\.giq_revoke_realtime_topic_grants\(text\[\], text\[\]\)\s+from public, anon, authenticated;/i,
      "revoke function privileges",
    );
    const grantSql = extractRequired(
      policySource,
      /grant execute on function public\.giq_revoke_realtime_topic_grants\(text\[\], text\[\]\)\s+to service_role;/i,
      "service role function grant",
    );
    await proof.$executeRawUnsafe(functionSql);
    await proof.$executeRawUnsafe(revokeSql);
    await proof.$executeRawUnsafe(grantSql);

    const functionMetadata = await proof.$queryRaw<
      Array<{
        securityDefiner: boolean;
        configuration: string[] | null;
        owner: string;
        definition: string;
      }>
    >`
      SELECT
        p.prosecdef AS "securityDefiner",
        p.proconfig AS configuration,
        pg_get_userbyid(p.proowner) AS owner,
        pg_get_functiondef(p.oid) AS definition
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'giq_revoke_realtime_topic_grants'
        AND pg_get_function_identity_arguments(p.oid) = 'requested_profile_ids text[], requested_topics text[]'
    `;
    assert.equal(functionMetadata.length, 1);
    assert.equal(functionMetadata[0].securityDefiner, true);
    assert.deepEqual(functionMetadata[0].configuration, ['search_path=""']);
    assert.match(functionMetadata[0].definition, /pg_advisory_xact_lock/);
    assert.match(functionMetadata[0].definition, /order by requested_profile\.profile_id/);
    assert.match(functionMetadata[0].definition, /cardinality\(requested_profile_ids\) > 10/);
    assert.match(functionMetadata[0].definition, /cardinality\(requested_topics\) > 10/);

    const privilegeRows = await proof.$queryRaw<
      Array<{
        serviceRoleExecute: boolean;
        anonymousExecute: boolean;
        authenticatedExecute: boolean;
        publicExecute: boolean;
        directTableAccessForServiceRole: boolean;
      }>
    >`
      SELECT
        has_function_privilege('service_role', 'public.giq_revoke_realtime_topic_grants(text[], text[])', 'EXECUTE') AS "serviceRoleExecute",
        has_function_privilege('anon', 'public.giq_revoke_realtime_topic_grants(text[], text[])', 'EXECUTE') AS "anonymousExecute",
        has_function_privilege('authenticated', 'public.giq_revoke_realtime_topic_grants(text[], text[])', 'EXECUTE') AS "authenticatedExecute",
        has_function_privilege('public', 'public.giq_revoke_realtime_topic_grants(text[], text[])', 'EXECUTE') AS "publicExecute",
        has_table_privilege('service_role', 'public.giq_realtime_topic_grants', 'SELECT,INSERT,UPDATE,DELETE') AS "directTableAccessForServiceRole"
    `;
    assert.deepEqual(privilegeRows, [
      {
        serviceRoleExecute: true,
        anonymousExecute: false,
        authenticatedExecute: false,
        publicExecute: false,
        directTableAccessForServiceRole: false,
      },
    ]);

    await insertFixtures(proof, PrismaRuntime);
    const before = await countGrantRows(proof);
    assert.equal(before, 6);

    queryEvents.length = 0;
    const runtimeIdentity = await proof.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE service_role");
      const identities = await tx.$queryRaw<
        Array<{
          currentUser: string;
          sessionUser: string;
          database: string;
          schema: string;
          superuser: boolean;
        }>
      >`
        SELECT
          current_user AS "currentUser",
          session_user AS "sessionUser",
          current_database() AS database,
          current_schema() AS schema,
          rol.rolsuper AS superuser
        FROM pg_roles AS rol
        WHERE rol.rolname = current_user
      `;
      await callRevoke(
        tx,
        PrismaRuntime,
        [FIXTURE_PROFILES[0], FIXTURE_PROFILES[1]],
        [TOPIC_ONE],
      );
      return identities[0];
    });
    assert.deepEqual(runtimeIdentity, {
      currentUser: "service_role",
      sessionUser: "postgres",
      database: PROOF_DATABASE,
      schema: "public",
      superuser: false,
    });
    const invocationEvent = queryEvents.find((event) =>
      /^SELECT public\.giq_revoke_realtime_topic_grants\(/i.test(
        normalizeSql(event.query),
      ),
    );
    assert.ok(invocationEvent);
    const invocationParameters = JSON.parse(invocationEvent.params) as unknown;
    assert.ok(Array.isArray(invocationParameters));
    assert.equal(invocationParameters.length, 3);
    const invocationSql = normalizeSql(invocationEvent.query);

    const afterAuthorizedRevoke = await countGrantRows(proof);
    assert.equal(afterAuthorizedRevoke, 2);
    await asRole(proof, "service_role", (tx) =>
      callRevoke(
        tx,
        PrismaRuntime,
        [FIXTURE_PROFILES[0], FIXTURE_PROFILES[1]],
        [TOPIC_ONE],
      ),
    );
    const afterIdempotentReplay = await countGrantRows(proof);
    assert.equal(afterIdempotentReplay, 2);

    await assert.rejects(
      asRole(proof, "anon", (tx) =>
        callRevoke(tx, PrismaRuntime, [FIXTURE_PROFILES[2]], [TOPIC_ONE]),
      ),
      /permission denied for function giq_revoke_realtime_topic_grants/i,
    );
    await assert.rejects(
      asRole(proof, "authenticated", (tx) =>
        callRevoke(tx, PrismaRuntime, [FIXTURE_PROFILES[2]], [TOPIC_ONE]),
      ),
      /permission denied for function giq_revoke_realtime_topic_grants/i,
    );
    const afterDeniedCalls = await countGrantRows(proof);
    assert.equal(afterDeniedCalls, 2);

    await assert.rejects(
      asRole(proof, "service_role", (tx) =>
        callRevoke(tx, PrismaRuntime, [], [TOPIC_ONE]),
      ),
      /invalid realtime grant revocation/i,
    );
    await assert.rejects(
      asRole(proof, "service_role", (tx) =>
        callRevoke(
          tx,
          PrismaRuntime,
          Array.from({ length: 11 }, (_, index) => `profile-${index}`),
          [TOPIC_ONE],
        ),
      ),
      /invalid realtime grant revocation/i,
    );
    await assert.rejects(
      asRole(proof, "service_role", (tx) =>
        callRevoke(tx, PrismaRuntime, [FIXTURE_PROFILES[2]], ["profile:bad"]),
      ),
      /invalid realtime grant revocation/i,
    );
    const afterInvalidCalls = await countGrantRows(proof);
    assert.equal(afterInvalidCalls, 2);

    const explainRows = await proof.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL statement_timeout = ${EXPLAIN_STATEMENT_TIMEOUT_MS}`,
      );
      return tx.$queryRaw(PrismaRuntime.sql`
        EXPLAIN (FORMAT JSON, ANALYZE FALSE, VERBOSE FALSE, COSTS TRUE, BUFFERS FALSE)
        DELETE FROM public.giq_realtime_topic_grants
        WHERE profile_id = ANY(ARRAY[${PrismaRuntime.join([
          FIXTURE_PROFILES[0],
          FIXTURE_PROFILES[1],
        ])}]::text[])
          AND topic = ANY(ARRAY[${TOPIC_ONE}]::text[])
      `);
    });
    const plan = sanitizeExplainResult(explainRows);
    const sourceFunction = normalizeSql(functionSql);
    const installedFunction = normalizeSql(functionMetadata[0].definition);
    assert.ok(installedFunction.includes("giq_revoke_realtime_topic_grants"));
    assert.match(sourceFunction, /security definer set search_path = ''/i);

    operationProof = {
      queryId: "DB.PULSE.REALTIME_GRANT.REVOKE",
      sourceFile: "src/lib/realtime-service.ts",
      sourceSymbol: "revokeRealtimeTopicGrants",
      storedProcedure: "giq_revoke_realtime_topic_grants",
      maximumDeletedRows: MAXIMUM_DELETED_ROWS,
      runtimeIdentity,
      privileges: {
        ...privilegeRows[0],
        anonymousCallDenied: true,
        authenticatedCallDenied: true,
      },
      functionSecurity: {
        securityDefiner: true,
        searchPath: 'search_path=""',
        profileLimit: 10,
        topicLimit: 10,
        topicPattern: "conversation-colon-48-lowercase-hex",
        deterministicProfileLockOrder: true,
      },
      rowCounts: {
        before,
        afterAuthorizedRevoke,
        afterIdempotentReplay,
        afterDeniedCalls,
        afterInvalidCalls,
      },
      cases: {
        authorizedDelete:
          "service-role-deleted-both-extensions-for-two-profiles-and-one-topic",
        unrelatedRows: "other-profile-or-topic-rows-preserved",
        idempotency:
          "identical-second-revocation-left-row-count-unchanged",
        anonymousDenied:
          "function-execute-denied-before-security-definer-body",
        authenticatedDenied:
          "function-execute-denied-before-security-definer-body",
        invalidEmptyInput: "procedure-rejected-empty-profile-array",
        invalidOversizedInput:
          "procedure-rejected-eleven-profile-identifiers",
        invalidTopic: "procedure-rejected-non-conversation-topic",
      },
      invocation: {
        statementType: "SELECT",
        normalizedSql: invocationSql,
        sha256: sha256(invocationSql),
        parameterCount: invocationParameters.length,
        persistedParameterValues: false,
      },
      functionDefinition: {
        persistedSql: false,
        sha256: sha256(sourceFunction),
        sourceSha256: sha256(sourceFunction),
        installedDefinitionSha256: sha256(installedFunction),
      },
      deletePlan: {
        format: "postgresql-json-cost-plan",
        analyze: false,
        buffers: false,
        statementTimeoutMilliseconds: EXPLAIN_STATEMENT_TIMEOUT_MS,
        sanitized: true,
        plan,
        planSha256: sha256(JSON.stringify(plan)),
      },
      status: "verified",
    };

    await proof.$disconnect();
    proof = null;
    await dropProofDatabase(admin);
    proofDatabaseDropped = true;
    proofDatabaseCreated = false;
    for (const role of [...rolesCreatedForProof].reverse()) {
      await admin.$executeRawUnsafe(dropRoleSql(role));
      rolesDropped.unshift(role);
    }
    const remainingProofDatabases = await countProofDatabases(admin);
    assert.equal(remainingProofDatabases, 0);
    assert.ok(operationProof);

    const report = {
      schemaVersion: REALTIME_GRANT_REVOKE_EVIDENCE_SCHEMA_VERSION,
      auditKind: "realtime-grant-revoke-isolated-database-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "fixed-isolated-loopback-database-only",
        host: adminUrl.hostname,
        port: Number(adminUrl.port),
        adminDatabase: "postgres",
        proofDatabase: PROOF_DATABASE,
        productionOrProviderSystemsContacted: false,
        broadCleanupUsed: false,
      },
      sourceBinding: buildRealtimeGrantRevokeSourceBinding(root),
      proof: operationProof,
      cleanup: {
        proofDatabaseDropped,
        rolesCreatedForProof,
        rolesDropped,
        remainingProofDatabases,
      },
      verdict: "verified",
    } as const;
    validateRealtimeGrantRevokeEvidence(report, root);
    const outputPath = resolve(root, REALTIME_GRANT_REVOKE_EVIDENCE_PATH);
    const temporaryPath = `${outputPath}.tmp`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    return { report, outputPath };
  } finally {
    if (proof) await proof.$disconnect();
    if (proofDatabaseCreated) await dropProofDatabase(admin);
    for (const role of [...rolesCreatedForProof].reverse()) {
      if (rolesDropped.includes(role)) continue;
      await admin.$executeRawUnsafe(dropRoleSql(role));
    }
    await admin.$disconnect();
  }
}

function extractTableStatements(source: string) {
  return [
    extractRequired(
      source,
      /create table if not exists public\.giq_realtime_topic_grants \([\s\S]*?\n\);/i,
      "grant table",
    ),
    extractRequired(
      source,
      /create index if not exists giq_realtime_topic_grants_expiry_idx[\s\S]*?\);/i,
      "grant expiry index",
    ),
    extractRequired(
      source,
      /alter table public\.giq_realtime_topic_grants enable row level security;/i,
      "grant table RLS enable",
    ),
    extractRequired(
      source,
      /alter table public\.giq_realtime_topic_grants force row level security;/i,
      "grant table RLS force",
    ),
    extractRequired(
      source,
      /revoke all on public\.giq_realtime_topic_grants from public, anon, authenticated;/i,
      "grant table revoke",
    ),
  ];
}

function extractRequired(source: string, pattern: RegExp, label: string) {
  const match = source.match(pattern);
  assert.ok(match, `Missing ${label} in private Realtime policy source`);
  return match[0];
}

async function insertFixtures(
  client: PrismaClient,
  prismaRuntime: typeof PrismaTypes,
) {
  const expiresAt = new Date("2026-08-01T00:00:00.000Z");
  const rows = [
    [TOPIC_ONE, FIXTURE_PROFILES[0], "broadcast"],
    [TOPIC_ONE, FIXTURE_PROFILES[0], "presence"],
    [TOPIC_ONE, FIXTURE_PROFILES[1], "broadcast"],
    [TOPIC_ONE, FIXTURE_PROFILES[1], "presence"],
    [TOPIC_TWO, FIXTURE_PROFILES[0], "broadcast"],
    [TOPIC_ONE, FIXTURE_PROFILES[2], "broadcast"],
  ];
  await client.$executeRaw(prismaRuntime.sql`
    INSERT INTO public.giq_realtime_topic_grants (
      topic, profile_id, extension, expires_at
    ) VALUES ${prismaRuntime.join(
      rows.map(
        ([topic, profileId, extension]) =>
          prismaRuntime.sql`(${topic}, ${profileId}, ${extension}, ${expiresAt})`,
      ),
    )}
  `);
}

async function callRevoke(
  tx: Prisma.TransactionClient,
  prismaRuntime: typeof PrismaTypes,
  profileIds: string[],
  topics: string[],
) {
  const profileArray = postgresTextArray(prismaRuntime, profileIds);
  const topicArray = postgresTextArray(prismaRuntime, topics);
  await tx.$executeRaw(
    prismaRuntime.sql`SELECT public.giq_revoke_realtime_topic_grants(${profileArray}, ${topicArray})`,
  );
}

function postgresTextArray(
  prismaRuntime: typeof PrismaTypes,
  values: string[],
) {
  return values.length === 0
    ? prismaRuntime.sql`ARRAY[]::text[]`
    : prismaRuntime.sql`ARRAY[${prismaRuntime.join(values)}]::text[]`;
}

function asRole<T>(
  client: PrismaClient,
  role: (typeof REQUIRED_ROLES)[number],
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(setLocalRoleSql(role));
    return operation(tx);
  });
}

async function countGrantRows(client: PrismaClient) {
  const rows = await client.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count
    FROM public.giq_realtime_topic_grants
  `;
  return Number(rows[0].count);
}

async function dropProofDatabase(admin: PrismaClient) {
  await admin.$executeRawUnsafe(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PROOF_DATABASE}' AND pid <> pg_backend_pid()`,
  );
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${PROOF_DATABASE}`);
}

async function countProofDatabases(admin: PrismaClient) {
  const rows = await admin.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count
    FROM pg_database
    WHERE datname = ${PROOF_DATABASE}
  `;
  return Number(rows[0].count);
}

function createRoleSql(role: (typeof REQUIRED_ROLES)[number]) {
  const statements = {
    anon: "CREATE ROLE anon NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS",
    authenticated:
      "CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS",
    service_role:
      "CREATE ROLE service_role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS",
  } as const;
  return statements[role];
}

function dropRoleSql(role: (typeof REQUIRED_ROLES)[number]) {
  const statements = {
    anon: "DROP ROLE anon",
    authenticated: "DROP ROLE authenticated",
    service_role: "DROP ROLE service_role",
  } as const;
  return statements[role];
}

function setLocalRoleSql(role: (typeof REQUIRED_ROLES)[number]) {
  const statements = {
    anon: "SET LOCAL ROLE anon",
    authenticated: "SET LOCAL ROLE authenticated",
    service_role: "SET LOCAL ROLE service_role",
  } as const;
  return statements[role];
}

function normalizeSql(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeExplainResult(value: unknown): PlanNode {
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

function sanitizeExplainNode(value: unknown): PlanNode {
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
  const { report, outputPath } = await runRealtimeGrantRevokeVerifier();
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
