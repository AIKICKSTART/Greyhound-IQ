import {
  DESIGN_LAB_APPLICATION_NAME,
  DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_CONNECTIONS,
  DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_WINDOW_MS,
  DESIGN_LAB_DATABASE_REFERENCE_PORT,
  DESIGN_LAB_DATABASE_TARGET_PORT,
  DESIGN_LAB_RUNTIME_ROLE,
  DESIGN_LAB_RUNTIME_ROUTINE_ALLOWLIST,
  DESIGN_LAB_RUNTIME_SEQUENCE_ALLOWLIST,
  type DesignLabDatabaseParityReport,
  type QueryClient,
  type RuntimeRoleProof,
} from "./design-lab-database-parity-contract";
import {
  assertPinnedAdminDatabaseUrl,
  assertPinnedApplicationBaseUrl,
  assertPinnedRuntimeDatabaseUrl,
  createClient,
  databaseEndpoint,
  isGreyhoundIqRequestId,
  readOnlyUrl,
  record,
  sqlLiteral,
  stringArray,
} from "./design-lab-database-parity-support";

/**
 * Enforces the fixed passwordless literal-loopback admin, runtime, replay, and readiness targets.
 * Any credential, alternate host, unexpected parameter, or endpoint overlap throws before I/O.
 */
export function assertParityInputs(
  adminUrl: string,
  runtimeUrl: string,
  referenceUrl: string,
  baseUrl: string,
) {
  const admin = assertPinnedAdminDatabaseUrl(adminUrl, [
    DESIGN_LAB_DATABASE_TARGET_PORT,
  ]);
  const runtime = assertPinnedRuntimeDatabaseUrl(runtimeUrl);
  assertPinnedAdminDatabaseUrl(referenceUrl, [
    DESIGN_LAB_DATABASE_REFERENCE_PORT,
  ]);
  if (databaseEndpoint(admin) !== databaseEndpoint(runtime)) {
    throw new Error("Admin and runtime URLs must address the same local database.");
  }
  assertPinnedApplicationBaseUrl(baseUrl);
}
/**
 * Proves the runtime role is login-capable but non-owner, non-bypass, FORCE-RLS constrained, and read-only.
 * The URL must be a validated runtime URL; malformed or unexpected privilege rows fail closed.
 */
export async function collectRuntimeRole(databaseUrl: string): Promise<RuntimeRoleProof> {
  assertPinnedRuntimeDatabaseUrl(databaseUrl);
  const client = await createClient(readOnlyUrl(databaseUrl));
  try {
    const allowedRoutineValues = DESIGN_LAB_RUNTIME_ROUTINE_ALLOWLIST
      .map((identity) => `(${sqlLiteral(identity)})`)
      .join(", ");
    const allowedSequenceValues = DESIGN_LAB_RUNTIME_SEQUENCE_ALLOWLIST
      .map((identity) => `(${sqlLiteral(identity)})`)
      .join(", ");
    const rows = await client.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT current_user::text AS "currentRole", session_user::text AS "sessionRole",
        r.rolcanlogin AS "canLogin", r.rolsuper AS "superuser",
        r.rolbypassrls AS "bypassRls", r.rolcreaterole AS "createRole",
        r.rolcreatedb AS "createDatabase", r.rolreplication AS "replication",
        r.rolinherit AS "inherit", r.rolconnlimit::int AS "connectionLimit",
        r.rolvaliduntil::text AS "validUntil",
        COALESCE(r.rolconfig, ARRAY[]::text[])::text[] AS "roleConfig",
        ARRAY(
          SELECT parent.rolname::text FROM pg_auth_members membership
          JOIN pg_roles parent ON parent.oid = membership.roleid
          WHERE membership.member = r.oid ORDER BY parent.rolname
        )::text[] AS "memberOfRoles",
        has_database_privilege(current_user, current_database(), 'CONNECT') AS "databaseConnect",
        has_database_privilege(current_user, current_database(), 'TEMPORARY') AS "databaseTemporary",
        has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
        has_schema_privilege(current_user, 'public', 'USAGE') AS "schemaUsage",
        has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
        (
          (SELECT COUNT(*) FROM pg_class owned JOIN pg_namespace ns ON ns.oid = owned.relnamespace WHERE owned.relowner = r.oid AND ns.nspname = 'public') +
          (SELECT COUNT(*) FROM pg_proc owned JOIN pg_namespace ns ON ns.oid = owned.pronamespace WHERE owned.proowner = r.oid AND ns.nspname = 'public') +
          (SELECT COUNT(*) FROM pg_type owned JOIN pg_namespace ns ON ns.oid = owned.typnamespace WHERE owned.typowner = r.oid AND ns.nspname = 'public')
        )::int AS "ownedObjectCount",
        (
          (SELECT COUNT(*) * 4 FROM pg_class required
            JOIN pg_namespace ns ON ns.oid = required.relnamespace
            WHERE ns.nspname = 'public' AND required.relkind IN ('r', 'p')
              AND required.relname <> '_prisma_migrations') +
          (SELECT COUNT(*) FROM pg_class required
            JOIN pg_namespace ns ON ns.oid = required.relnamespace
            WHERE ns.nspname = 'public' AND required.relkind IN ('v', 'm')) +
          2 +
          ${DESIGN_LAB_RUNTIME_SEQUENCE_ALLOWLIST.length} +
          ${DESIGN_LAB_RUNTIME_ROUTINE_ALLOWLIST.length}
        )::int AS "requiredPrivilegeCount",
        ARRAY(
          SELECT missing FROM (
            SELECT ('database:' || current_database() || ':CONNECT')::text AS missing
            WHERE NOT has_database_privilege(current_user, current_database(), 'CONNECT')
            UNION ALL
            SELECT 'schema:public:USAGE'::text
            WHERE NOT has_schema_privilege(current_user, 'public', 'USAGE')
            UNION ALL
            SELECT (
              'relation:' || namespace.nspname || '.' || relation.relname || ':' || candidate.privilege
            )::text AS missing
            FROM pg_class AS relation
            JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
            CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS candidate(privilege)
            WHERE namespace.nspname = 'public'
              AND relation.relkind IN ('r', 'p')
              AND relation.relname <> '_prisma_migrations'
              AND NOT has_table_privilege(current_user, relation.oid, candidate.privilege)
            UNION ALL
            SELECT ('view:' || namespace.nspname || '.' || relation.relname || ':SELECT')::text
            FROM pg_class AS relation
            JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
            WHERE namespace.nspname = 'public'
              AND relation.relkind IN ('v', 'm')
              AND NOT has_table_privilege(current_user, relation.oid, 'SELECT')
            UNION ALL
            SELECT ('sequence:public.' || expected.identity || ':USAGE')::text
            FROM (VALUES ${allowedSequenceValues}) AS expected(identity)
            LEFT JOIN pg_class AS sequence
              ON sequence.relname = expected.identity AND sequence.relkind = 'S'
            LEFT JOIN pg_namespace AS namespace
              ON namespace.oid = sequence.relnamespace AND namespace.nspname = 'public'
            WHERE sequence.oid IS NULL
              OR namespace.oid IS NULL
              OR NOT has_sequence_privilege(current_user, sequence.oid, 'USAGE')
            UNION ALL
            SELECT ('routine:public.' || expected.identity || ':EXECUTE')::text
            FROM (VALUES ${allowedRoutineValues}) AS expected(identity)
            LEFT JOIN pg_proc AS routine ON (
              routine.proname || '(' ||
              pg_get_function_identity_arguments(routine.oid) || ')'
            ) = expected.identity
            LEFT JOIN pg_namespace AS namespace
              ON namespace.oid = routine.pronamespace AND namespace.nspname = 'public'
            WHERE routine.oid IS NULL
              OR namespace.oid IS NULL
              OR NOT has_function_privilege(current_user, routine.oid, 'EXECUTE')
          ) missing_privileges ORDER BY missing
        )::text[] AS "missingPrivileges",
        ARRAY(
          SELECT violation FROM (
            SELECT ('database:' || current_database() || ':TEMPORARY')::text AS violation
            WHERE has_database_privilege(current_user, current_database(), 'TEMPORARY')
            UNION ALL
            SELECT ('database:' || current_database() || ':CREATE')::text
            WHERE has_database_privilege(current_user, current_database(), 'CREATE')
            UNION ALL
            SELECT (
              'relation:' || namespace.nspname || '.' || relation.relname || ':' || candidate.privilege
            )::text AS violation
            FROM pg_class AS relation
            JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
            CROSS JOIN (
              VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
            ) AS candidate(privilege)
            WHERE namespace.nspname = 'public'
              AND relation.relkind IN ('r', 'p', 'v', 'm')
              AND has_table_privilege(current_user, relation.oid, candidate.privilege)
              AND (
                relation.relname = '_prisma_migrations'
                OR (relation.relkind IN ('v', 'm') AND candidate.privilege <> 'SELECT')
                OR (
                  relation.relkind IN ('r', 'p')
                  AND relation.relname <> '_prisma_migrations'
                  AND candidate.privilege IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
                )
              )
            UNION ALL
            SELECT (
              'sequence:' || namespace.nspname || '.' || sequence.relname || ':' || candidate.privilege
            )::text
            FROM pg_class AS sequence
            JOIN pg_namespace AS namespace ON namespace.oid = sequence.relnamespace
            CROSS JOIN (VALUES ('SELECT'), ('UPDATE'), ('USAGE')) AS candidate(privilege)
            WHERE namespace.nspname = 'public'
              AND sequence.relkind = 'S'
              AND has_sequence_privilege(current_user, sequence.oid, candidate.privilege)
              AND (
                candidate.privilege IN ('SELECT', 'UPDATE')
                OR NOT EXISTS (
                  SELECT 1 FROM (VALUES ${allowedSequenceValues}) AS expected(identity)
                  WHERE expected.identity = sequence.relname
                )
              )
            UNION ALL
            SELECT (
              'routine:' || namespace.nspname || '.' || routine.proname || '(' ||
              pg_get_function_identity_arguments(routine.oid) || '):EXECUTE'
            )::text
            FROM pg_proc AS routine
            JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
            WHERE namespace.nspname = 'public'
              AND has_function_privilege(current_user, routine.oid, 'EXECUTE')
              AND NOT EXISTS (
                SELECT 1 FROM (VALUES ${allowedRoutineValues}) AS expected(identity)
                WHERE expected.identity = (
                  routine.proname || '(' ||
                  pg_get_function_identity_arguments(routine.oid) || ')'
                )
              )
              AND NOT EXISTS (
                SELECT 1
                FROM pg_depend dependency
                JOIN pg_extension extension ON extension.oid = dependency.refobjid
                WHERE dependency.classid = 'pg_proc'::regclass
                  AND dependency.objid = routine.oid
                  AND dependency.deptype = 'e'
                  AND extension.extname = 'pg_trgm'
              )
            UNION ALL
            SELECT (
              'column:' || columns.table_name || '.' || columns.column_name || ':' || columns.privilege_type
            )::text
            FROM information_schema.column_privileges AS columns
            JOIN pg_class AS relation ON relation.relname = columns.table_name
            JOIN pg_namespace AS namespace
              ON namespace.oid = relation.relnamespace AND namespace.nspname = columns.table_schema
            WHERE columns.table_schema = 'public'
              AND columns.grantee IN (current_user, 'PUBLIC')
              AND (
                columns.table_name = '_prisma_migrations'
                OR (
                  relation.relkind IN ('v', 'm')
                  AND columns.privilege_type <> 'SELECT'
                )
                OR columns.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
              )
            UNION ALL
            SELECT ('grant-option:table:' || table_name || ':' || privilege_type)::text
            FROM information_schema.table_privileges
            WHERE grantee = current_user AND table_schema = 'public'
              AND is_grantable = 'YES'
            UNION ALL
            SELECT (
              'grant-option:column:' || table_name || '.' || column_name || ':' || privilege_type
            )::text
            FROM information_schema.column_privileges
            WHERE grantee = current_user AND table_schema = 'public'
              AND is_grantable = 'YES'
            UNION ALL
            SELECT ('grant-option:routine:' || specific_name || ':' || privilege_type)::text
            FROM information_schema.routine_privileges
            WHERE grantee = current_user AND routine_schema = 'public'
              AND is_grantable = 'YES'
            UNION ALL
            SELECT ('grant-option:sequence:' || object_name || ':' || privilege_type)::text
            FROM information_schema.usage_privileges
            WHERE grantee = current_user AND object_schema = 'public'
              AND object_type = 'SEQUENCE' AND is_grantable = 'YES'
            UNION ALL
            SELECT (
              'grant-option:default:' || owner.rolname || ':' || defaults.defaclobjtype::text || ':' || acl.privilege_type
            )::text
            FROM pg_default_acl AS defaults
            CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS acl
            JOIN pg_roles AS owner ON owner.oid = defaults.defaclrole
            WHERE acl.grantee = r.oid AND acl.is_grantable
            UNION ALL
            SELECT (
              'unsafe-default:' || owner.rolname || ':' || defaults.defaclobjtype::text || ':' || acl.privilege_type
            )::text
            FROM pg_default_acl AS defaults
            CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS acl
            JOIN pg_roles AS owner ON owner.oid = defaults.defaclrole
            WHERE (
              defaults.defaclobjtype = 'r'
              AND acl.grantee = r.oid
              AND acl.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
            ) OR (
              defaults.defaclobjtype = 'f'
              AND acl.grantee = 0
              AND acl.privilege_type = 'EXECUTE'
            ) OR (
              defaults.defaclobjtype = 'S'
              AND acl.grantee IN (r.oid, 0)
            )
          ) violations ORDER BY violation
        )::text[] AS "unexpectedPrivileges",
        current_setting('transaction_read_only')::boolean AS "readOnlySession",
        COUNT(c.oid) FILTER (WHERE c.relname <> '_prisma_migrations')::int AS "applicationTableCount",
        COUNT(c.oid) FILTER (WHERE c.relname <> '_prisma_migrations' AND c.relrowsecurity)::int AS "rlsEnabledCount",
        COUNT(c.oid) FILTER (WHERE c.relname <> '_prisma_migrations' AND c.relforcerowsecurity)::int AS "forceRlsCount"
      FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE r.rolname = current_user AND n.nspname = 'public' AND c.relkind IN ('r', 'p')
      GROUP BY r.oid, r.rolcanlogin, r.rolsuper, r.rolbypassrls, r.rolcreaterole,
        r.rolcreatedb, r.rolreplication, r.rolinherit, r.rolconnlimit,
        r.rolvaliduntil, r.rolconfig
    `);
    const row = rows[0];
    if (!row) throw new Error("Runtime role proof returned no row.");
    return {
      currentRole: String(row.currentRole),
      sessionRole: String(row.sessionRole),
      canLogin: Boolean(row.canLogin),
      superuser: Boolean(row.superuser),
      bypassRls: Boolean(row.bypassRls),
      createRole: Boolean(row.createRole),
      createDatabase: Boolean(row.createDatabase),
      replication: Boolean(row.replication),
      inherit: Boolean(row.inherit),
      validUntil: row.validUntil === null ? null : String(row.validUntil),
      roleConfig: stringArray(row.roleConfig),
      connectionLimit: Number(row.connectionLimit),
      memberOfRoles: stringArray(row.memberOfRoles),
      databaseConnect: Boolean(row.databaseConnect),
      databaseTemporary: Boolean(row.databaseTemporary),
      databaseCreate: Boolean(row.databaseCreate),
      schemaUsage: Boolean(row.schemaUsage),
      schemaCreate: Boolean(row.schemaCreate),
      ownedObjectCount: Number(row.ownedObjectCount),
      requiredPrivilegeCount: Number(row.requiredPrivilegeCount),
      missingPrivileges: stringArray(row.missingPrivileges),
      unexpectedPrivileges: stringArray(row.unexpectedPrivileges),
      readOnlySession: Boolean(row.readOnlySession),
      applicationTableCount: Number(row.applicationTableCount),
      rlsEnabledCount: Number(row.rlsEnabledCount),
      forceRlsCount: Number(row.forceRlsCount),
    };
  } finally {
    await client.$disconnect();
  }
}

/** Reads the PostgreSQL system identifier through a bounded read-only connection; malformed IDs throw. */
export async function collectClusterIdentity(databaseUrl: string) {
  assertPinnedAdminDatabaseUrl(databaseUrl);
  const client = await createClient(readOnlyUrl(databaseUrl));
  try {
    const rows = await client.$queryRawUnsafe<Array<{ systemIdentifier: string }>>(
      'SELECT system_identifier::text AS "systemIdentifier" FROM pg_control_system()',
    );
    const systemIdentifier = rows[0]?.systemIdentifier;
    if (!systemIdentifier || !/^\d{10,30}$/u.test(systemIdentifier)) {
      throw new Error("PostgreSQL cluster did not return a valid system identifier.");
    }
    return systemIdentifier;
  } finally {
    await client.$disconnect();
  }
}

type ClusterIdentityPair = {
  target: string;
  reference: string;
};

/** Rejects target/reference aliasing, replay-cluster drift, and mid-capture cluster swaps. */
export function assertStableClusterIdentities(
  before: ClusterIdentityPair,
  after: ClusterIdentityPair,
  replayReferenceSystemIdentifier: string,
) {
  if (before.target === before.reference) {
    throw new Error("Target and reference endpoints resolve to the same PostgreSQL cluster.");
  }
  if (before.reference !== replayReferenceSystemIdentifier) {
    throw new Error(
      "Reference endpoint is not the PostgreSQL cluster proven by the fixed migration replay.",
    );
  }
  if (
    after.target !== before.target ||
    after.reference !== before.reference ||
    after.target === after.reference
  ) {
    throw new Error(
      "PostgreSQL cluster identity changed during database parity capture; discard the run.",
    );
  }
}

/**
 * Binds loopback readiness to fresh activity from the exact runtime role and application name.
 * HTTP, timing, database status, connection freshness, or connection-count violations abort capture.
 */
export async function collectApplicationBinding(
  adminUrl: string,
  baseUrl: string,
): Promise<DesignLabDatabaseParityReport["applicationBinding"]> {
  assertPinnedAdminDatabaseUrl(adminUrl, [DESIGN_LAB_DATABASE_TARGET_PORT]);
  assertPinnedApplicationBaseUrl(baseUrl);
  const client = await createClient(readOnlyUrl(adminUrl));
  try {
    const clockRows = await client.$queryRawUnsafe<Array<{ now: Date }>>(
      "SELECT clock_timestamp() AS now",
    );
    const proofWindowStartedAt = clockRows[0]?.now;
    if (!(proofWindowStartedAt instanceof Date)) {
      throw new Error("Target database did not return its proof-window clock.");
    }
    const before = await readApplicationActivity(client);
    const readyUrl = new URL("/api/health/ready", baseUrl);
    const response = await fetch(readyUrl, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json()) as unknown;
    const databaseStatus = record(record(body)?.checks)?.database;
    const requestId = response.headers.get("x-request-id");
    if (
      response.status !== 200 ||
      databaseStatus !== "ok" ||
      !isGreyhoundIqRequestId(requestId)
    ) {
      throw new Error(
        `Loopback readiness did not prove a request-identified ready database (HTTP ${response.status}).`,
      );
    }
    const readinessClockRows = await client.$queryRawUnsafe<Array<{ now: Date }>>(
      "SELECT clock_timestamp() AS now",
    );
    const readinessObservedAt = readinessClockRows[0]?.now;
    if (!(readinessObservedAt instanceof Date)) {
      throw new Error("Target database did not return its readiness-observation clock.");
    }
    const after = await readApplicationActivity(client);
    const endClockRows = await client.$queryRawUnsafe<Array<{ now: Date }>>(
      "SELECT clock_timestamp() AS now",
    );
    const proofWindowEndedAt = endClockRows[0]?.now;
    if (!(proofWindowEndedAt instanceof Date)) {
      throw new Error("Target database did not return its proof-window end clock.");
    }
    if (
      proofWindowEndedAt.getTime() - proofWindowStartedAt.getTime() >
      DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_WINDOW_MS
    ) {
      throw new Error("Readiness proof exceeded the maximum application proof window.");
    }
    const beforeByPid = new Map(before.map((row) => [row.pid, row]));
    const freshConnections: DesignLabDatabaseParityReport["applicationBinding"]["connections"] = [];
    for (const row of after) {
      const previous = beforeByPid.get(row.pid);
      const queryIsFresh =
        row.queryStart >= proofWindowStartedAt &&
        row.queryStart <= readinessObservedAt;
      if (!queryIsFresh) continue;
      if (
        !previous ||
        previous.backendStart.getTime() !== row.backendStart.getTime()
      ) {
        freshConnections.push({
          pid: row.pid,
          classification: "new",
          backendStartedAt: row.backendStart.toISOString(),
          beforeQueryStartedAt: null,
          beforeStateChangedAt: null,
          afterQueryStartedAt: row.queryStart.toISOString(),
          afterStateChangedAt: row.stateChange.toISOString(),
        });
        continue;
      }
      if (row.queryStart <= previous.queryStart) continue;
      freshConnections.push({
        pid: row.pid,
        classification: "advanced",
        backendStartedAt: row.backendStart.toISOString(),
        beforeQueryStartedAt: previous.queryStart.toISOString(),
        beforeStateChangedAt: previous.stateChange.toISOString(),
        afterQueryStartedAt: row.queryStart.toISOString(),
        afterStateChangedAt: row.stateChange.toISOString(),
      });
    }
    const observedConnectionCount = after.length;
    const observedFreshConnectionCount = freshConnections.length;
    if (observedConnectionCount < 1 || observedFreshConnectionCount < 1) {
      throw new Error(
        "Readiness returned ready, but no greyhoundiq_design_lab runtime connection became active on the target during the proof window.",
      );
    }
    if (observedFreshConnectionCount > DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_CONNECTIONS) {
      throw new Error(
        `Readiness proof observed more than ${DESIGN_LAB_DATABASE_MAX_APPLICATION_PROOF_CONNECTIONS} fresh application connections; reduce the local proof pool before capture.`,
      );
    }
    return {
      baseUrl: new URL(baseUrl).origin,
      readinessStatus: 200,
      databaseStatus: "ok",
      observedApplicationName: DESIGN_LAB_APPLICATION_NAME,
      observedRole: DESIGN_LAB_RUNTIME_ROLE,
      observedConnectionCount,
      observedFreshConnectionCount,
      requestId,
      proofWindowStartedAt: proofWindowStartedAt.toISOString(),
      readinessObservedAt: readinessObservedAt.toISOString(),
      proofWindowEndedAt: proofWindowEndedAt.toISOString(),
      connections: freshConnections,
    };
  } finally {
    await client.$disconnect();
  }
}

type ApplicationActivityRow = {
  pid: number;
  backendStart: Date;
  queryStart: Date;
  stateChange: Date;
};

async function readApplicationActivity(client: QueryClient) {
  return client.$queryRawUnsafe<ApplicationActivityRow[]>(`
      SELECT pid::int AS "pid", backend_start AS "backendStart",
        query_start AS "queryStart", state_change AS "stateChange"
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND usename = '${DESIGN_LAB_RUNTIME_ROLE}'
        AND application_name = '${DESIGN_LAB_APPLICATION_NAME}'
      ORDER BY pid
    `);
}
