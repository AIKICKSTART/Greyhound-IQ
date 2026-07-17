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

import type { CurrentUserProfile } from "../src/lib/auth-types";
import type { DbContextClient } from "../src/lib/db-context";

export const ACCOUNT_DELETION_PENDING_VERIFY_CONFIRMATION =
  "verify-account-deletion-pending-select-on-disposable-loopback-55734";
export const ACCOUNT_DELETION_PENDING_EVIDENCE_PATH =
  "output/database-audit/account-deletion-pending-select.json";
export const ACCOUNT_DELETION_PENDING_EVIDENCE_SCHEMA_VERSION = 1;

const SOURCE_FILES = [
  "prisma/schema.prisma",
  "prisma/migrations/20260715053000_add_account_deletion_pending_index/migration.sql",
  "scripts/check-account-deletion-pending-select-postgres.ts",
  "scripts/check-account-deletion-pending-select-postgres.test.ts",
  "scripts/check-demo-route-fixture-idempotency.ts",
  "security/database-operations.ts",
  "src/lib/account-service.ts",
  "src/lib/db-context.ts",
  "src/lib/db.ts",
] as const;

const OTHER_USER: CurrentUserProfile = {
  id: "account-deletion-pending-other-provider-proof",
  dbUserId: "account-deletion-pending-other-user-proof",
  profileId: "account-deletion-pending-other-profile-proof",
  email: "account-deletion-pending-other@greyhoundiq.test",
  firstName: "Pending",
  lastName: "Proof",
  name: "Pending Proof",
  displayName: "Pending Proof",
  role: "member",
  profileRole: "member",
  tier: "free",
  verified: false,
  isBanned: false,
  deletionRequestedAt: null,
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

export function assertAccountDeletionPendingVerifierTarget(
  value: string,
  confirmation: string | undefined,
) {
  assert.equal(confirmation, ACCOUNT_DELETION_PENDING_VERIFY_CONFIRMATION);
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

export function buildAccountDeletionPendingSourceBinding(
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

export function validateAccountDeletionPendingEvidence(
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
    ACCOUNT_DELETION_PENDING_EVIDENCE_SCHEMA_VERSION,
  );
  assert.equal(
    evidence.auditKind,
    "account-deletion-pending-select-disposable-proof",
  );
  assert.equal(evidence.verdict, "verified");
  assert.ok(
    typeof evidence.generatedAt === "string" &&
      Number.isFinite(new Date(evidence.generatedAt).getTime()),
  );
  assert.deepEqual(evidence.sourceBinding, buildAccountDeletionPendingSourceBinding(root));

  const identity = evidence.runtimeIdentity as RuntimeIdentity;
  assert.deepEqual(identity, {
    role: "greyhoundiq_runtime",
    sessionRole: "greyhoundiq_runtime",
    database: "greyhoundiq",
    schema: "public",
    canLogin: true,
    superuser: false,
    bypassRls: false,
  });
  const safety = evidence.safety as Record<string, unknown>;
  assert.deepEqual(safety, {
    scope: "literal-loopback-disposable-replay-only",
    host: "127.0.0.1",
    port: 55734,
    productionOrProviderSystemsContacted: false,
    fixtureOwner: "account-deletion-pending-selector-dedicated-proof",
    broadCleanupUsed: false,
  });
  assert.deepEqual(evidence.cleanup, {
    profileRowsDeleted: 1,
    userRowsDeleted: 1,
    remainingProfileRows: 0,
    remainingUserRows: 0,
  });

  const proof = evidence.proof as Record<string, unknown>;
  assert.equal(proof.queryId, "DB.ACCOUNT.DELETION.PENDING.SELECT");
  assert.equal(proof.sourceFile, "src/lib/account-service.ts");
  assert.equal(proof.sourceSymbol, "findPendingAccountDeletionUsers");
  assert.equal(proof.expectedMaximumRows, 25);
  assert.equal(proof.rowsBefore, 1);
  assert.equal(proof.rowsAfter, 1);
  assert.equal(proof.rowCountDelta, 0);
  assert.equal(proof.status, "verified");
  const cases = proof.cases as Record<string, unknown>;
  assert.equal(cases.systemContext, "returned-one-expired-banned-candidate");
  assert.equal(
    cases.anonymousRlsReplay,
    "user-zero-public-profile-id-one-given-user-id",
  );
  assert.equal(cases.index, "exact-three-column-index-present");
  assert.equal(cases.mutation, "none");

  const variants = proof.variants as Array<Record<string, unknown>>;
  assert.deepEqual(
    variants.map((variant) => variant.variant),
    ["users", "profiles"],
  );
  for (const variant of variants) {
    const observedSql = variant.observedSql as Record<string, unknown>;
    assert.equal(observedSql.statementType, "SELECT");
    assert.equal(observedSql.persistedParameterValues, false);
    assert.equal(
      observedSql.sha256,
      sha256(String(observedSql.normalizedSql)),
    );
    const explain = variant.explain as Record<string, unknown>;
    assert.equal(explain.analyze, false);
    assert.equal(explain.buffers, false);
    assert.equal(explain.sanitized, true);
    assert.equal(explain.statementTimeoutMilliseconds, 5_000);
  }
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(serialized, /account-deletion-pending-proof@/i);
  return evidence;
}

export async function runAccountDeletionPendingVerifier() {
  const root = process.cwd();
  const runtimeUrl = assertAccountDeletionPendingVerifierTarget(
    requiredEnvironment("ACCOUNT_DELETION_PENDING_VERIFY_DATABASE_URL"),
    process.env.ACCOUNT_DELETION_PENDING_VERIFY_CONFIRM,
  );
  const applicationUrl = new URL(runtimeUrl);
  applicationUrl.searchParams.set("connection_limit", "4");
  process.env.DATABASE_URL = applicationUrl.toString();
  process.env.DIRECT_URL = applicationUrl.toString();
  process.env.DEMO_FIXTURE_QUERY_EVIDENCE_MODE =
    "capture-sanitized-statements-on-disposable-loopback-55734";
  const cleanupUrl = new URL(runtimeUrl);
  cleanupUrl.username = "postgres";

  const [
    { PrismaClient },
    { prisma, captureDisposableReplayQueries },
    { withDbAnonymousContext, withDbRequestContext, withDbSystemContext },
    {
      cleanupAccountDeletionPendingProbe,
      proveAccountDeletionPendingSelect,
      setupAccountDeletionPendingProbe,
    },
    { findPendingAccountDeletionUsers },
  ] = await Promise.all([
    import("@prisma/client"),
    import("../src/lib/db"),
    import("../src/lib/db-context"),
    import("./check-demo-route-fixture-idempotency"),
    import("../src/lib/account-service"),
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
    await withDbSystemContext(setupAccountDeletionPendingProbe);
    cleanupRequired = true;
    const proof = await proveAccountDeletionPendingSelect(
      withDbSystemContext,
      withDbAnonymousContext,
      withDbRequestContext,
      captureDisposableReplayQueries,
      findPendingAccountDeletionUsers,
      OTHER_USER,
      identities[0],
    );
    const removed = await cleanupPrisma.$transaction((tx) =>
      cleanupAccountDeletionPendingProbe(tx as DbContextClient, true),
    );
    cleanupRequired = false;
    const [remainingProfileRows, remainingUserRows] = await Promise.all([
      cleanupPrisma.profile.count({
        where: { id: "demo-account-deletion-pending-profile-proof" },
      }),
      cleanupPrisma.user.count({
        where: { id: "demo-account-deletion-pending-operation-proof" },
      }),
    ]);
    assert.deepEqual(
      { remainingProfileRows, remainingUserRows },
      { remainingProfileRows: 0, remainingUserRows: 0 },
    );
    const report = {
      schemaVersion: ACCOUNT_DELETION_PENDING_EVIDENCE_SCHEMA_VERSION,
      auditKind: "account-deletion-pending-select-disposable-proof",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-replay-only",
        host: runtimeUrl.hostname,
        port: Number(runtimeUrl.port),
        productionOrProviderSystemsContacted: false,
        fixtureOwner: "account-deletion-pending-selector-dedicated-proof",
        broadCleanupUsed: false,
      },
      runtimeIdentity: identities[0],
      sourceBinding: buildAccountDeletionPendingSourceBinding(root),
      proof,
      cleanup: {
        profileRowsDeleted: removed.profileCount,
        userRowsDeleted: removed.userCount,
        remainingProfileRows,
        remainingUserRows,
      },
      verdict: "verified",
    } as const;
    validateAccountDeletionPendingEvidence(report, root);
    const outputPath = resolve(root, ACCOUNT_DELETION_PENDING_EVIDENCE_PATH);
    const temporaryPath = `${outputPath}.tmp`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, outputPath);
    return { report, outputPath };
  } finally {
    if (cleanupRequired) {
      await cleanupPrisma.$transaction((tx) =>
        cleanupAccountDeletionPendingProbe(tx as DbContextClient, false),
      );
    }
    await Promise.all([prisma.$disconnect(), cleanupPrisma.$disconnect()]);
  }
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
  const { report, outputPath } = await runAccountDeletionPendingVerifier();
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
