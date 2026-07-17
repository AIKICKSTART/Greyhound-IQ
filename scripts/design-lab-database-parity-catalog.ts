import assert from "node:assert/strict";

import {
  DATABASE_CATALOG_COMPONENTS,
  DESIGN_LAB_RUNTIME_ROLE,
  type CatalogComponent,
  type CatalogComponentName,
} from "./design-lab-database-parity-contract";
import {
  assertPinnedAdminDatabaseUrl,
  canonical,
  createClient,
  normalizeRows,
  readOnlyUrl,
  sha256,
} from "./design-lab-database-parity-support";

const CATALOG_QUERIES: Readonly<Record<CatalogComponentName, string>> = {
  server: `
    SELECT current_setting('server_version_num')::int AS "versionNum",
      current_setting('server_encoding')::text AS "encoding",
      current_setting('TimeZone')::text AS "timezone",
      d.datcollate::text AS "collation", d.datctype::text AS "ctype",
      owner.rolname::text AS "databaseOwner",
      d.datallowconn AS "allowConnections", d.datconnlimit::int AS "connectionLimit",
      d.datistemplate AS "template"
    FROM pg_database d JOIN pg_roles owner ON owner.oid = d.datdba
    WHERE d.datname = current_database()
  `,
  extensions: `
    SELECT e.extname::text AS "name", e.extversion::text AS "version",
      n.nspname::text AS "schema"
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  `,
  roles: `
    SELECT rolname::text AS "name", rolsuper AS "superuser",
      rolinherit AS "inherit", rolcreaterole AS "createRole",
      rolcreatedb AS "createDatabase", rolreplication AS "replication",
      rolbypassrls AS "bypassRls",
      CASE WHEN rolname = '${DESIGN_LAB_RUNTIME_ROLE}' THEN NULL ELSE rolcanlogin END AS "canLogin",
      CASE WHEN rolname = '${DESIGN_LAB_RUNTIME_ROLE}' THEN NULL ELSE rolconnlimit END AS "connectionLimit",
      CASE WHEN rolname = '${DESIGN_LAB_RUNTIME_ROLE}' THEN NULL ELSE rolvaliduntil::text END AS "validUntil",
      CASE WHEN rolname = '${DESIGN_LAB_RUNTIME_ROLE}' THEN NULL ELSE rolconfig::text[] END AS "roleConfig",
      (rolname = '${DESIGN_LAB_RUNTIME_ROLE}') AS "runtimeDeploymentAttributesProvedSeparately"
    FROM pg_roles
  `,
  memberships: `
    SELECT parent.rolname::text AS "role", member.rolname::text AS "member",
      grantor.rolname::text AS "grantor", membership.admin_option AS "adminOption"
    FROM pg_auth_members membership
    JOIN pg_roles parent ON parent.oid = membership.roleid
    JOIN pg_roles member ON member.oid = membership.member
    JOIN pg_roles grantor ON grantor.oid = membership.grantor
  `,
  relations: `
    SELECT n.nspname::text AS "schema", c.relname::text AS "name",
      c.relkind::text AS "kind", c.relpersistence::text AS "persistence",
      c.relrowsecurity AS "rls", c.relforcerowsecurity AS "forceRls",
      c.relreplident::text AS "replicaIdentity",
      c.relispartition AS "partition",
      pg_get_expr(c.relpartbound, c.oid, true)::text AS "partitionBound",
      c.reloptions::text[] AS "options",
      owner.rolname::text AS "owner"
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles owner ON owner.oid = c.relowner
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
  `,
  columns: `
    SELECT table_schema::text AS "schema", table_name::text AS "table",
      ordinal_position::int AS "position", column_name::text AS "column",
      data_type::text AS "dataType", udt_name::text AS "udtName",
      is_nullable::text AS "nullable", column_default::text AS "default",
      character_maximum_length::text AS "characterMaximumLength",
      numeric_precision::text AS "numericPrecision",
      numeric_scale::text AS "numericScale",
      datetime_precision::text AS "datetimePrecision",
      collation_name::text AS "collation",
      is_identity::text AS "identity", identity_generation::text AS "identityGeneration",
      is_generated::text AS "generated", generation_expression::text AS "generationExpression"
    FROM information_schema.columns WHERE table_schema = 'public'
  `,
  constraints: `
    SELECT n.nspname::text AS "schema", c.relname::text AS "table",
      con.conname::text AS "name", con.contype::text AS "type",
      pg_get_constraintdef(con.oid, true)::text AS "definition",
      con.condeferrable AS "deferrable", con.condeferred AS "deferred",
      con.convalidated AS "validated"
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  `,
  indexes: `
    SELECT namespace.nspname::text AS "schema", relation.relname::text AS "table",
      index_relation.relname::text AS "name",
      pg_get_indexdef(index_relation.oid)::text AS "definition",
      owner.rolname::text AS "owner", index_relation.reloptions::text[] AS "options",
      idx.indisunique AS "unique", idx.indisprimary AS "primary",
      idx.indisexclusion AS "exclusion", idx.indimmediate AS "immediate",
      idx.indisclustered AS "clustered", idx.indisvalid AS "valid",
      idx.indisready AS "ready", idx.indislive AS "live",
      idx.indisreplident AS "replicaIdentity",
      pg_get_expr(idx.indpred, idx.indrelid, true)::text AS "predicate",
      pg_get_expr(idx.indexprs, idx.indrelid, true)::text AS "expressions"
    FROM pg_index idx
    JOIN pg_class index_relation ON index_relation.oid = idx.indexrelid
    JOIN pg_class relation ON relation.oid = idx.indrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_roles owner ON owner.oid = index_relation.relowner
    WHERE namespace.nspname = 'public'
  `,
  views: `
    SELECT 'view'::text AS "kind", schemaname::text AS "schema",
      viewname::text AS "name", viewowner::text AS "owner",
      definition::text AS "definition", info.check_option::text AS "checkOption",
      info.is_updatable::text AS "updatable",
      info.is_insertable_into::text AS "insertable",
      info.is_trigger_updatable::text AS "triggerUpdatable",
      info.is_trigger_deletable::text AS "triggerDeletable",
      info.is_trigger_insertable_into::text AS "triggerInsertable"
    FROM pg_views views
    JOIN information_schema.views info
      ON info.table_schema = views.schemaname AND info.table_name = views.viewname
    WHERE schemaname = 'public'
    UNION ALL
    SELECT 'materialized-view'::text, schemaname::text, matviewname::text,
      matviewowner::text, definition::text,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text
    FROM pg_matviews WHERE schemaname = 'public'
  `,
  functions: `
    SELECT n.nspname::text AS "schema", p.proname::text AS "name",
      p.prokind::text AS "kind",
      pg_get_function_identity_arguments(p.oid)::text AS "arguments",
      pg_get_function_result(p.oid)::text AS "result",
      l.lanname::text AS "language", p.provolatile::text AS "volatility",
      p.proparallel::text AS "parallel", p.prosecdef AS "securityDefiner",
      p.proisstrict AS "strict", owner.rolname::text AS "owner",
      pg_get_functiondef(p.oid)::text AS "definition"
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    JOIN pg_roles owner ON owner.oid = p.proowner
    WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
  `,
  triggers: `
    SELECT n.nspname::text AS "schema", c.relname::text AS "table",
      t.tgname::text AS "name", t.tgenabled::text AS "enabled",
      pg_get_triggerdef(t.oid, true)::text AS "definition"
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
  `,
  policies: `
    SELECT schemaname::text AS "schema", tablename::text AS "table",
      policyname::text AS "name", permissive::text AS "permissive",
      roles::text[] AS "roles", cmd::text AS "command",
      qual::text AS "using", with_check::text AS "check"
    FROM pg_policies WHERE schemaname = 'public'
  `,
  sequences: `
    SELECT schemaname::text AS "schema", sequencename::text AS "name",
      data_type::text AS "dataType", start_value::text AS "start",
      min_value::text AS "min", max_value::text AS "max",
      increment_by::text AS "increment", cycle AS "cycle",
      cache_size::text AS "cache"
    FROM pg_sequences WHERE schemaname = 'public'
  `,
  enums: `
    SELECT n.nspname::text AS "schema", t.typname::text AS "type",
      owner.rolname::text AS "owner", e.enumsortorder::float8 AS "position",
      e.enumlabel::text AS "value"
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_roles owner ON owner.oid = t.typowner
    WHERE n.nspname = 'public'
  `,
  grants: `
    SELECT 'table'::text AS "kind", grantee::text AS "grantee",
      table_schema::text AS "schema", table_name::text AS "object",
      privilege_type::text AS "privilege", (is_grantable = 'YES') AS "grantable"
    FROM information_schema.table_privileges WHERE table_schema = 'public'
    UNION ALL
    SELECT 'column'::text, grantee::text, table_schema::text,
      (table_name || '.' || column_name)::text, privilege_type::text,
      (is_grantable = 'YES')
    FROM information_schema.column_privileges WHERE table_schema = 'public'
    UNION ALL
    SELECT 'routine'::text, COALESCE(grantee.rolname, 'PUBLIC')::text,
      namespace.nspname::text,
      (routine.proname || '(' || pg_get_function_identity_arguments(routine.oid) || ')')::text,
      acl.privilege_type::text, acl.is_grantable
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    CROSS JOIN LATERAL aclexplode(
      COALESCE(routine.proacl, acldefault('f', routine.proowner))
    ) acl
    LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE namespace.nspname = 'public'
    UNION ALL
    SELECT 'sequence'::text, grantee::text, object_schema::text,
      object_name::text, privilege_type::text, (is_grantable = 'YES')
    FROM information_schema.usage_privileges
    WHERE object_schema = 'public' AND object_type = 'SEQUENCE'
    UNION ALL
    SELECT 'database'::text, COALESCE(grantee.rolname, 'PUBLIC')::text,
      ''::text, current_database()::text, acl.privilege_type::text,
      acl.is_grantable
    FROM pg_database d
    CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) acl
    LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE d.datname = current_database()
    UNION ALL
    SELECT 'schema'::text, COALESCE(grantee.rolname, 'PUBLIC')::text,
      n.nspname::text, n.nspname::text, acl.privilege_type::text,
      acl.is_grantable
    FROM pg_namespace n
    CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
    LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE n.nspname = 'public'
    UNION ALL
    SELECT 'default-acl'::text, COALESCE(grantee.rolname, 'PUBLIC')::text,
      COALESCE(n.nspname, '*')::text,
      (owner.rolname || ':' || d.defaclobjtype::text)::text,
      acl.privilege_type::text, acl.is_grantable
    FROM pg_default_acl d
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    JOIN pg_roles owner ON owner.oid = d.defaclrole
    LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
    LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  `,
  migrations: `
    SELECT migration_name::text AS "name", checksum::text AS "checksum",
      (finished_at IS NOT NULL) AS "finished", (rolled_back_at IS NOT NULL) AS "rolledBack",
      applied_steps_count::int AS "steps"
    FROM public."_prisma_migrations"
  `,
};

/**
 * Compares every approved catalog component in canonical registry order.
 * Missing components throw so an incomplete snapshot can never look equal.
 */
export function compareCatalogComponents(
  target: readonly CatalogComponent[],
  reference: readonly CatalogComponent[],
) {
  const targetMap = new Map(target.map((component) => [component.name, component]));
  const referenceMap = new Map(
    reference.map((component) => [component.name, component]),
  );
  return DATABASE_CATALOG_COMPONENTS.map((name) => {
    const targetComponent = targetMap.get(name);
    const referenceComponent = referenceMap.get(name);
    assert(targetComponent, `Target catalog is missing ${name}.`);
    assert(referenceComponent, `Reference catalog is missing ${name}.`);
    return {
      name,
      targetRows: targetComponent.rowCount,
      referenceRows: referenceComponent.rowCount,
      targetSha256: targetComponent.sha256,
      referenceSha256: referenceComponent.sha256,
      matched:
        targetComponent.rowCount === referenceComponent.rowCount &&
        targetComponent.sha256 === referenceComponent.sha256,
    };
  });
}

/**
 * Collects the approved PostgreSQL catalog surface in one read-only REPEATABLE READ snapshot.
 * The URL must already satisfy the literal-loopback contract; any isolation or query failure aborts.
 */
export async function collectCatalog(databaseUrl: string) {
  assertPinnedAdminDatabaseUrl(databaseUrl);
  const client = await createClient(readOnlyUrl(databaseUrl));
  try {
    return client.$transaction(async (snapshot) => {
      const transaction = await snapshot.$queryRawUnsafe<
        Array<{ isolation: string; readOnly: boolean }>
      >(`
        SELECT current_setting('transaction_isolation')::text AS "isolation",
          current_setting('transaction_read_only')::boolean AS "readOnly"
      `);
      if (
        transaction[0]?.isolation !== "repeatable read" ||
        transaction[0]?.readOnly !== true
      ) {
        throw new Error(
          "Catalog collection did not enter a read-only REPEATABLE READ snapshot.",
        );
      }
      const components: CatalogComponent[] = [];
      for (const name of DATABASE_CATALOG_COMPONENTS) {
        const rows = await snapshot.$queryRawUnsafe<unknown[]>(CATALOG_QUERIES[name]);
        const normalized = normalizeRows(rows);
        components.push({
          name,
          rowCount: normalized.length,
          sha256: sha256(canonical(normalized)),
        });
      }
      return components;
    }, {
      isolationLevel: "RepeatableRead",
      maxWait: 5_000,
      timeout: 30_000,
    });
  } finally {
    await client.$disconnect();
  }
}

/** Hashes the ordered component names, row counts, and individual digests into one catalog identity. */
export function compositeCatalogDigest(components: readonly CatalogComponent[]) {
  return sha256(
    canonical(
      components.map((component) => ({
        name: component.name,
        rowCount: component.rowCount,
        sha256: component.sha256,
      })),
    ),
  );
}
