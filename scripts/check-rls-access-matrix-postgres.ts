import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { collectDatabaseCompatibilityInventory } from "./check-database-compatibility-inventory";

export const RLS_ACCESS_MATRIX_CONFIRMATION =
  "verify-rls-matrix-on-disposable-loopback-55734";
export const RLS_ACCESS_MATRIX_OUTPUT =
  "security/row-level-security-runtime-evidence.json";

type ContextCounts = {
  membershipA: number;
  membershipB: number;
  organizationA: number;
  organizationB: number;
  signupOutbox: number;
};

type InvoiceOwnershipCounts = {
  invoiceA: number;
  invoiceB: number;
};

const inputUrl = process.env.RLS_ACCESS_MATRIX_DATABASE_URL?.trim();
assert.ok(inputUrl, "RLS_ACCESS_MATRIX_DATABASE_URL is required");
assert.equal(
  process.env.RLS_ACCESS_MATRIX_CONFIRM,
  RLS_ACCESS_MATRIX_CONFIRMATION,
  `RLS_ACCESS_MATRIX_CONFIRM must equal ${RLS_ACCESS_MATRIX_CONFIRMATION}`,
);

const databaseUrl = new URL(inputUrl);
assert.ok(
  databaseUrl.protocol === "postgresql:" || databaseUrl.protocol === "postgres:",
  "RLS matrix target must be PostgreSQL",
);
assert.equal(databaseUrl.hostname, "127.0.0.1");
assert.equal(databaseUrl.port, "55734");
assert.equal(databaseUrl.pathname, "/greyhoundiq");
assert.equal(decodeURIComponent(databaseUrl.username), "greyhoundiq_runtime");
assert.equal(databaseUrl.password, "");
assert.equal(databaseUrl.search, "");
databaseUrl.searchParams.set("connection_limit", "1");
databaseUrl.searchParams.set("application_name", "greyhoundiq_rls_matrix_verifier");
process.env.DATABASE_URL = databaseUrl.toString();

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { setDbRequestContext, setDbSystemContext, withDbSystemContext } =
    await import("../src/lib/db-context");
  const compatibility = collectDatabaseCompatibilityInventory();
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const modelNames = [...schema.matchAll(/^model\s+(\w+)\s*\{/gmu)].map(
    (match) => match[1],
  );
  const marker = `rls-matrix-${randomUUID()}`;
  const ids = {
    userA: `${marker}-user-a`,
    userB: `${marker}-user-b`,
    profileA: `${marker}-profile-a`,
    profileB: `${marker}-profile-b`,
    organizationA: `${marker}-organization-a`,
    organizationB: `${marker}-organization-b`,
    membershipA: `${marker}-membership-a`,
    membershipB: `${marker}-membership-b`,
    outbox: `${marker}-outbox`,
    invoiceA: `${marker}-invoice-a`,
    invoiceB: `${marker}-invoice-b`,
  } as const;
  const rollbackMarker = "rls-access-matrix.rollback";
  const denialName = `giq_role_matrix_${randomUUID().replaceAll("-", "")}`;
  let cases:
    | {
        anonymous: ContextCounts;
        ownerA: ContextCounts;
        ownerB: ContextCounts;
        privilegedModerator: ContextCounts;
        systemWorker: ContextCounts;
      }
    | undefined;
  let invoiceOwnershipCases:
    | {
        anonymous: InvoiceOwnershipCounts;
        ownerA: InvoiceOwnershipCounts;
        ownerB: InvoiceOwnershipCounts;
        privilegedModerator: InvoiceOwnershipCounts;
        systemWorker: InvoiceOwnershipCounts;
      }
    | undefined;

  try {
    const [identity] = await prisma.$queryRaw<
      Array<{
        bypassRls: boolean;
        canLogin: boolean;
        connectionLimit: number;
        createDatabase: boolean;
        createRole: boolean;
        currentRole: string;
        inherit: boolean;
        replication: boolean;
        sessionRole: string;
        superuser: boolean;
      }>
    >`
      SELECT
        current_user AS "currentRole",
        session_user AS "sessionRole",
        role.rolsuper AS "superuser",
        role.rolbypassrls AS "bypassRls",
        role.rolcreaterole AS "createRole",
        role.rolcreatedb AS "createDatabase",
        role.rolreplication AS "replication",
        role.rolinherit AS "inherit",
        role.rolcanlogin AS "canLogin",
        role.rolconnlimit AS "connectionLimit"
      FROM pg_roles AS role
      WHERE role.rolname = current_user
    `;
    assert.deepEqual(identity, {
      bypassRls: false,
      canLogin: true,
      connectionLimit: 40,
      createDatabase: false,
      createRole: false,
      currentRole: "greyhoundiq_runtime",
      inherit: true,
      replication: false,
      sessionRole: "greyhoundiq_runtime",
      superuser: false,
    });

    const sourceRoles = await prisma.$queryRaw<Array<{ roleName: string }>>`
      SELECT rolname AS "roleName"
      FROM pg_roles
      WHERE rolname LIKE 'greyhoundiq\_%' ESCAPE '\\'
      ORDER BY rolname
    `;
    assert.deepEqual(sourceRoles.map((role) => role.roleName), [
      "greyhoundiq_runtime",
    ]);

    const [effectivePrivileges] = await prisma.$queryRaw<
      Array<{
        databaseConnect: boolean;
        databaseCreate: boolean;
        databaseTemporary: boolean;
        publicSchemaCreate: boolean;
        publicSchemaUsage: boolean;
        schemaCreateCount: number;
      }>
    >`
      SELECT
        has_database_privilege(current_user, current_database(), 'CONNECT') AS "databaseConnect",
        has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
        has_database_privilege(current_user, current_database(), 'TEMPORARY') AS "databaseTemporary",
        has_schema_privilege(current_user, 'public', 'USAGE') AS "publicSchemaUsage",
        has_schema_privilege(current_user, 'public', 'CREATE') AS "publicSchemaCreate",
        (
          SELECT COUNT(*)::integer
          FROM pg_namespace AS namespace
          WHERE has_schema_privilege(current_user, namespace.oid, 'CREATE')
        ) AS "schemaCreateCount"
    `;
    assert.deepEqual(effectivePrivileges, {
      databaseConnect: true,
      databaseCreate: false,
      databaseTemporary: false,
      publicSchemaCreate: false,
      publicSchemaUsage: true,
      schemaCreateCount: 0,
    });

    const [ownership] = await prisma.$queryRaw<
      Array<{
        databaseCount: number;
        relationCount: number;
        routineCount: number;
        schemaCount: number;
      }>
    >`
      SELECT
        (SELECT COUNT(*)::integer FROM pg_database WHERE datdba = role.oid) AS "databaseCount",
        (SELECT COUNT(*)::integer FROM pg_class WHERE relowner = role.oid) AS "relationCount",
        (SELECT COUNT(*)::integer FROM pg_proc WHERE proowner = role.oid) AS "routineCount",
        (SELECT COUNT(*)::integer FROM pg_namespace WHERE nspowner = role.oid) AS "schemaCount"
      FROM pg_roles AS role
      WHERE role.rolname = current_user
    `;
    assert.deepEqual(ownership, {
      databaseCount: 0,
      relationCount: 0,
      routineCount: 0,
      schemaCount: 0,
    });

    const [memberships] = await prisma.$queryRaw<
      Array<{ adminOptionCount: number; membershipCount: number }>
    >`
      SELECT
        COUNT(*)::integer AS "membershipCount",
        COUNT(*) FILTER (WHERE membership.admin_option)::integer AS "adminOptionCount"
      FROM pg_auth_members AS membership
      WHERE membership.member = (
        SELECT oid FROM pg_roles WHERE rolname = current_user
      )
    `;
    assert.deepEqual(memberships, { adminOptionCount: 0, membershipCount: 0 });

    const catalogRows = await prisma.$queryRaw<
      Array<{
        forceRls: boolean;
        kind: "S" | "m" | "r" | "v";
        name: string;
        rlsEnabled: boolean;
      }>
    >`
      SELECT
        relation.relname AS "name",
        relation.relkind AS "kind",
        relation.relrowsecurity AS "rlsEnabled",
        relation.relforcerowsecurity AS "forceRls"
      FROM pg_class AS relation
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'v', 'm', 'S')
      ORDER BY relation.relname
    `;
    const applicationRows = catalogRows.filter((row) =>
      row.kind === "r" && modelNames.includes(row.name),
    );
    assert.equal(applicationRows.length, modelNames.length);
    assert.equal(applicationRows.filter((row) => row.rlsEnabled).length, modelNames.length);
    assert.equal(applicationRows.filter((row) => row.forceRls).length, modelNames.length);

    const relationGrants = await prisma.$queryRaw<
      Array<{
        grantable: boolean;
        kind: "S" | "m" | "r" | "v";
        name: string;
        privilege: string;
        schema: string;
      }>
    >`
      SELECT
        namespace.nspname AS "schema",
        relation.relname AS "name",
        relation.relkind AS "kind",
        acl.privilege_type AS "privilege",
        acl.is_grantable AS "grantable"
      FROM pg_class AS relation
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      CROSS JOIN LATERAL aclexplode(relation.relacl) AS acl
      WHERE acl.grantee = (
        SELECT oid FROM pg_roles WHERE rolname = current_user
      )
      ORDER BY namespace.nspname, relation.relname, acl.privilege_type
    `;
    assert.ok(relationGrants.every((grant) => grant.schema === "public"));
    assert.ok(relationGrants.every((grant) => !grant.grantable));
    const baseTableGrants = relationGrants.filter((grant) => grant.kind === "r");
    assert.deepEqual(
      uniqueSorted(baseTableGrants.map((grant) => grant.name)),
      uniqueSorted(modelNames),
    );
    for (const name of modelNames) {
      assert.deepEqual(
        uniqueSorted(
          baseTableGrants
            .filter((grant) => grant.name === name)
            .map((grant) => grant.privilege),
        ),
        ["DELETE", "INSERT", "SELECT", "UPDATE"],
        `${name}: ordinary runtime DML grant drift`,
      );
    }
    const projectionGrants = relationGrants.filter(
      (grant) => grant.kind === "m" || grant.kind === "v",
    );
    assert.deepEqual(
      uniqueSorted(projectionGrants.map((grant) => grant.name)),
      uniqueSorted(
        catalogRows
          .filter((row) => row.kind === "m" || row.kind === "v")
          .map((row) => row.name),
      ),
    );
    assert.ok(projectionGrants.every((grant) => grant.privilege === "SELECT"));
    const sequenceGrants = relationGrants.filter((grant) => grant.kind === "S");
    assert.deepEqual(
      sequenceGrants.map((grant) => ({
        name: grant.name,
        privilege: grant.privilege,
      })),
      [{ name: "AuditLog_id_seq", privilege: "USAGE" }],
    );

    const routineGrants = await prisma.$queryRaw<
      Array<{
        grantable: boolean;
        name: string;
        privilege: string;
        schema: string;
        securityDefiner: boolean;
      }>
    >`
      SELECT
        namespace.nspname AS "schema",
        function.proname AS "name",
        acl.privilege_type AS "privilege",
        acl.is_grantable AS "grantable",
        function.prosecdef AS "securityDefiner"
      FROM pg_proc AS function
      JOIN pg_namespace AS namespace ON namespace.oid = function.pronamespace
      CROSS JOIN LATERAL aclexplode(function.proacl) AS acl
      WHERE acl.grantee = (
        SELECT oid FROM pg_roles WHERE rolname = current_user
      )
      ORDER BY namespace.nspname, function.proname,
        pg_get_function_identity_arguments(function.oid)
    `;
    assert.ok(routineGrants.length > 0);
    assert.ok(routineGrants.every((grant) => grant.schema === "public"));
    assert.ok(routineGrants.every((grant) => grant.name.startsWith("giq_")));
    assert.ok(routineGrants.every((grant) => grant.privilege === "EXECUTE"));
    assert.ok(routineGrants.every((grant) => !grant.grantable));

    const [systemCatalog] = await prisma.$queryRaw<
      Array<{
        directGrantCount: number;
        sensitiveAuthCatalogSelect: boolean;
      }>
    >`
      SELECT
        (
          SELECT COUNT(*)::integer
          FROM pg_class AS relation
          JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          CROSS JOIN LATERAL aclexplode(relation.relacl) AS acl
          WHERE namespace.nspname IN ('pg_catalog', 'information_schema')
            AND acl.grantee = (
              SELECT oid FROM pg_roles WHERE rolname = current_user
            )
        ) AS "directGrantCount",
        has_table_privilege(current_user, 'pg_catalog.pg_authid', 'SELECT') AS "sensitiveAuthCatalogSelect"
    `;
    assert.deepEqual(systemCatalog, {
      directGrantCount: 0,
      sensitiveAuthCatalogSelect: false,
    });

    const negativeControls = {
      functionCreateDenied: await expectInsufficientPrivilege(
        "create arbitrary function",
        `CREATE FUNCTION public."${denialName}"() RETURNS integer LANGUAGE sql AS 'SELECT 1'`,
      ),
      policyDisableDenied: await expectInsufficientPrivilege(
        "disable row-level security",
        'ALTER TABLE public."Organization" DISABLE ROW LEVEL SECURITY',
      ),
      roleAlterDenied: await expectInsufficientPrivilege(
        "alter database user",
        "ALTER ROLE postgres CONNECTION LIMIT 1",
      ),
      roleCreateDenied: await expectInsufficientPrivilege(
        "create database user",
        `CREATE ROLE "${denialName}" NOLOGIN`,
      ),
      schemaCreateDenied: await expectInsufficientPrivilege(
        "create schema",
        `CREATE SCHEMA "${denialName}"`,
      ),
      sensitiveAuthCatalogReadDenied: await expectInsufficientPrivilege(
        "read sensitive authentication catalog",
        "SELECT rolname FROM pg_catalog.pg_authid LIMIT 1",
        "query",
      ),
    } as const;

    const invoicePolicies = await prisma.$queryRaw<
      Array<{ command: string; policyName: string }>
    >`
      SELECT policyname AS "policyName", cmd AS "command"
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'InvoiceRecord'
        AND policyname = 'giq_invoice_read'
    `;
    assert.deepEqual(invoicePolicies, [
      { command: "SELECT", policyName: "giq_invoice_read" },
    ]);

    try {
      await prisma.$transaction(
        async (tx) => {
          await setDbSystemContext(tx);
          await tx.user.createMany({
            data: [
              {
                email: `${ids.userA}@example.invalid`,
                id: ids.userA,
                workosUserId: ids.userA,
              },
              {
                email: `${ids.userB}@example.invalid`,
                id: ids.userB,
                workosUserId: ids.userB,
              },
            ],
          });
          await tx.profile.createMany({
            data: [
              { displayName: "RLS matrix A", id: ids.profileA, userId: ids.userA },
              { displayName: "RLS matrix B", id: ids.profileB, userId: ids.userB },
            ],
          });
          await tx.organization.createMany({
            data: [
              {
                id: ids.organizationA,
                name: "RLS matrix A",
                ownerId: ids.userA,
                workosOrganizationId: ids.organizationA,
              },
              {
                id: ids.organizationB,
                name: "RLS matrix B",
                ownerId: ids.userB,
                workosOrganizationId: ids.organizationB,
              },
            ],
          });
          await tx.membership.createMany({
            data: [
              {
                id: ids.membershipA,
                organizationId: ids.organizationA,
                status: "active",
                userId: ids.userA,
              },
              {
                id: ids.membershipB,
                organizationId: ids.organizationB,
                status: "active",
                userId: ids.userB,
              },
            ],
          });
          await tx.signupOutbox.create({
            data: {
              id: ids.outbox,
              idempotencyKey: ids.outbox,
              userId: ids.userA,
            },
          });
          await tx.invoiceRecord.createMany({
            data: [
              {
                id: ids.invoiceA,
                lagoInvoiceId: `${ids.invoiceA}-provider`,
                status: "finalized",
                userId: ids.userA,
              },
              {
                id: ids.invoiceB,
                lagoInvoiceId: `${ids.invoiceB}-provider`,
                status: "finalized",
                userId: ids.userB,
              },
            ],
          });

          await tx.$executeRaw`SELECT
            set_config('app.current_user_id', '', true),
            set_config('app.current_profile_id', '', true),
            set_config('app.current_actor_id', '', true),
            set_config('app.current_tier', 'free', true),
            set_config('app.current_role', 'member', true),
            set_config('app.system', 'false', true)`;
          const anonymous = await readCounts(tx, ids);
          const anonymousInvoices = await readInvoiceCounts(tx, ids);

          await setDbRequestContext(tx, {
            dbUserId: ids.userA,
            profileId: ids.profileA,
            profileRole: "member",
            tier: "free",
          });
          const ownerA = await readCounts(tx, ids);
          const ownerAInvoices = await readInvoiceCounts(tx, ids);

          await setDbRequestContext(tx, {
            dbUserId: ids.userB,
            profileId: ids.profileB,
            profileRole: "member",
            tier: "free",
          });
          const ownerB = await readCounts(tx, ids);
          const ownerBInvoices = await readInvoiceCounts(tx, ids);

          await setDbRequestContext(tx, {
            dbUserId: ids.userA,
            profileId: ids.profileA,
            profileRole: "moderator",
            tier: "pro",
          });
          const privilegedModerator = await readCounts(tx, ids);
          const privilegedModeratorInvoices = await readInvoiceCounts(tx, ids);

          await setDbSystemContext(tx);
          const systemWorker = await readCounts(tx, ids);
          const systemWorkerInvoices = await readInvoiceCounts(tx, ids);
          cases = {
            anonymous,
            ownerA,
            ownerB,
            privilegedModerator,
            systemWorker,
          };
          invoiceOwnershipCases = {
            anonymous: anonymousInvoices,
            ownerA: ownerAInvoices,
            ownerB: ownerBInvoices,
            privilegedModerator: privilegedModeratorInvoices,
            systemWorker: systemWorkerInvoices,
          };

          throw new Error(rollbackMarker);
        },
        { maxWait: 5_000, timeout: 30_000 },
      );
      assert.fail("RLS access matrix transaction committed unexpectedly");
    } catch (error: unknown) {
      assert.equal(error instanceof Error ? error.message : String(error), rollbackMarker);
    }

    assert.ok(cases);
    assert.deepEqual(cases.anonymous, {
      membershipA: 0,
      membershipB: 0,
      organizationA: 0,
      organizationB: 0,
      signupOutbox: 0,
    });
    assert.deepEqual(cases.ownerA, {
      membershipA: 1,
      membershipB: 0,
      organizationA: 1,
      organizationB: 0,
      signupOutbox: 0,
    });
    assert.deepEqual(cases.ownerB, {
      membershipA: 0,
      membershipB: 1,
      organizationA: 0,
      organizationB: 1,
      signupOutbox: 0,
    });
    assert.deepEqual(cases.privilegedModerator, {
      membershipA: 1,
      membershipB: 1,
      organizationA: 1,
      organizationB: 1,
      signupOutbox: 0,
    });
    assert.deepEqual(cases.systemWorker, {
      membershipA: 1,
      membershipB: 1,
      organizationA: 1,
      organizationB: 1,
      signupOutbox: 1,
    });
    assert.ok(invoiceOwnershipCases);
    assert.deepEqual(invoiceOwnershipCases, {
      anonymous: { invoiceA: 0, invoiceB: 0 },
      ownerA: { invoiceA: 1, invoiceB: 0 },
      ownerB: { invoiceA: 0, invoiceB: 1 },
      privilegedModerator: { invoiceA: 1, invoiceB: 1 },
      systemWorker: { invoiceA: 1, invoiceB: 1 },
    });

    const rollbackCounts = await withDbSystemContext((tx) => readCounts(tx, ids));
    assert.deepEqual(rollbackCounts, {
      membershipA: 0,
      membershipB: 0,
      organizationA: 0,
      organizationB: 0,
      signupOutbox: 0,
    });
    const invoiceRollbackCounts = await withDbSystemContext((tx) =>
      readInvoiceCounts(tx, ids),
    );
    assert.deepEqual(invoiceRollbackCounts, { invoiceA: 0, invoiceB: 0 });
    const [freshContext] = await prisma.$queryRaw<
      Array<{ profileId: string | null; system: string | null; userId: string | null }>
    >`SELECT
      NULLIF(current_setting('app.current_user_id', true), '') AS "userId",
      NULLIF(current_setting('app.current_profile_id', true), '') AS "profileId",
      NULLIF(current_setting('app.system', true), '') AS "system"`;
    assert.deepEqual(freshContext, { profileId: null, system: null, userId: null });

    const report = {
      schemaVersion: 1,
      auditKind: "rls-access-matrix",
      generatedAt: new Date().toISOString(),
      safety: {
        scope: "literal-loopback-disposable-database",
        target: { database: "greyhoundiq", host: "127.0.0.1", port: 55734 },
        productionContacted: false,
        mutation:
          "negative privilege probes and synthetic rows inside forced-rollback transactions",
        persistedSensitiveValues: false,
      },
      sourceBinding: {
        dbContextSha256: sha256(readFileSync("src/lib/db-context.ts")),
        billingPageSha256: sha256(
          readFileSync("src/app/account/billing/page.tsx"),
        ),
        invoicePolicyMigrationSha256: sha256(
          readFileSync(
            "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
          ),
        ),
        migrationsSha256: compatibility.migrationsSha256,
        prismaSchemaSha256: compatibility.schemaSha256,
        verifierSha256: sha256(readFileSync("scripts/check-rls-access-matrix-postgres.ts")),
      },
      runtimeIdentity: identity,
      sourceDefinedApplicationRoles: sourceRoles.map((role) => role.roleName),
      roleSeparation: {
        effectivePrivileges,
        ownership,
        memberships,
        directGrants: {
          applicationDmlTableCount: uniqueSorted(
            baseTableGrants.map((grant) => grant.name),
          ).length,
          projectionReadCount: projectionGrants.length,
          sequenceUsageCount: sequenceGrants.length,
          routineCount: routineGrants.length,
          securityDefinerRoutineCount: routineGrants.filter(
            (grant) => grant.securityDefiner,
          ).length,
          grantableCount:
            relationGrants.filter((grant) => grant.grantable).length +
            routineGrants.filter((grant) => grant.grantable).length,
        },
        systemCatalog,
        negativeControls,
      },
      catalog: {
        applicationModelCount: modelNames.length,
        forceRlsCount: applicationRows.filter((row) => row.forceRls).length,
        rlsEnabledCount: applicationRows.filter((row) => row.rlsEnabled).length,
      },
      invoiceOwnership: {
        policy: invoicePolicies[0],
        cases: invoiceOwnershipCases,
        rollback: { ...invoiceRollbackCounts, verified: true },
      },
      cases,
      rollback: { ...rollbackCounts, verified: true },
      poolContextReset: true,
      verdict: "verified",
    } as const;

    writeReportAtomically(RLS_ACCESS_MATRIX_OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `RLS access matrix passed: ${modelNames.length}/${modelNames.length} application models forced, owner/tenant/moderator/system/anonymous contexts verified`,
    );

    async function expectInsufficientPrivilege(
      label: string,
      sql: string,
      kind: "execute" | "query" = "execute",
    ) {
      const unexpectedlyAllowed = `role-separation.${label}.unexpectedly-allowed`;
      try {
        await prisma.$transaction(async (tx) => {
          if (kind === "query") {
            await tx.$queryRawUnsafe(sql);
          } else {
            await tx.$executeRawUnsafe(sql);
          }
          throw new Error(unexpectedlyAllowed);
        });
      } catch (error: unknown) {
        assert.notEqual(
          error instanceof Error ? error.message : String(error),
          unexpectedlyAllowed,
          `${label}: greyhoundiq_runtime unexpectedly received permission`,
        );
        assert.equal(
          postgresErrorCode(error),
          "42501",
          `${label}: expected PostgreSQL insufficient_privilege`,
        );
        return true;
      }
      assert.fail(`${label}: denial transaction unexpectedly committed`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function readCounts(
  tx: import("../src/lib/db-context").DbContextClient,
  ids: {
    membershipA: string;
    membershipB: string;
    organizationA: string;
    organizationB: string;
    outbox: string;
  },
): Promise<ContextCounts> {
  const [organizationA, organizationB, membershipA, membershipB, signupOutbox] =
    await Promise.all([
    tx.organization.count({ where: { id: ids.organizationA } }),
    tx.organization.count({ where: { id: ids.organizationB } }),
    tx.membership.count({ where: { id: ids.membershipA } }),
    tx.membership.count({ where: { id: ids.membershipB } }),
    tx.signupOutbox.count({ where: { id: ids.outbox } }),
  ]);
  return {
    membershipA,
    membershipB,
    organizationA,
    organizationB,
    signupOutbox,
  };
}

async function readInvoiceCounts(
  tx: import("../src/lib/db-context").DbContextClient,
  ids: { invoiceA: string; invoiceB: string },
): Promise<InvoiceOwnershipCounts> {
  const [invoiceA, invoiceB] = await Promise.all([
    tx.invoiceRecord.count({ where: { id: ids.invoiceA } }),
    tx.invoiceRecord.count({ where: { id: ids.invoiceB } }),
  ]);
  return { invoiceA, invoiceB };
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function postgresErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    cause?: unknown;
    code?: unknown;
    meta?: { code?: unknown };
  };
  if (typeof candidate.code === "string" && /^\d{5}$/u.test(candidate.code)) {
    return candidate.code;
  }
  if (typeof candidate.meta?.code === "string") return candidate.meta.code;
  return postgresErrorCode(candidate.cause);
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function writeReportAtomically(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  writeFileSync(temporary, contents, "utf8");
  renameSync(temporary, path);
}
