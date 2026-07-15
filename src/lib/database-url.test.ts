import assert from "node:assert/strict";

import {
  databaseUrlConfigurationError,
  runtimeDatabaseUrl,
} from "./database-url";

const managedDirect =
  "postgresql://postgres:secret@db.example-project.supabase.co:5432/postgres";
const managedPooler =
  "postgresql://postgres:secret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";
const selfHosted =
  "postgresql://greyhoundiq_app:secret@postgres.internal:5432/greyhoundiq";
const alloyDbManagedPooler =
  "postgresql://greyhoundiq_runtime:secret@10.20.0.3:6432/greyhoundiq";
const alloyDbDirect =
  "postgresql://greyhoundiq_migrator:secret@10.20.0.3:5432/greyhoundiq?sslmode=require";

assert.match(
  databaseUrlConfigurationError(managedDirect, {
    production: true,
    required: true,
  }) ?? "",
  /approved PostgreSQL database, such as AlloyDB/
);

assert.match(
  databaseUrlConfigurationError(managedPooler, {
    production: true,
    required: true,
  }) ?? "",
  /approved PostgreSQL database, such as AlloyDB/
);

assert.equal(
  databaseUrlConfigurationError(managedPooler, {
    production: true,
    required: true,
    allowManagedSupabase: true,
  }),
  null
);

assert.equal(
  databaseUrlConfigurationError(selfHosted, {
    production: true,
    required: true,
  }),
  null
);

assert.equal(
  databaseUrlConfigurationError(alloyDbManagedPooler, {
    production: true,
    required: true,
  }),
  null
);

assert.equal(databaseUrlConfigurationError("", { required: false }), null);
assert.equal(databaseUrlConfigurationError("", { required: true }), "must be set");

const normalizedPooler = runtimeDatabaseUrl(managedPooler);
assert.match(normalizedPooler, /pgbouncer=true/);
assert.match(normalizedPooler, /sslmode=require/);
assert.match(normalizedPooler, /connection_limit=1/);

const normalizedDevelopmentUrl = runtimeDatabaseUrl(selfHosted, {
  connectionLimit: "10",
});
assert.match(normalizedDevelopmentUrl, /connection_limit=10/);

const normalizedAlloyDbPooler = new URL(runtimeDatabaseUrl(alloyDbManagedPooler));
assert.equal(normalizedAlloyDbPooler.searchParams.get("pgbouncer"), "true");
assert.equal(normalizedAlloyDbPooler.searchParams.get("sslmode"), "require");
assert.equal(normalizedAlloyDbPooler.searchParams.get("connection_limit"), "1");

const normalizedAlloyDbDirect = new URL(runtimeDatabaseUrl(alloyDbDirect));
assert.equal(normalizedAlloyDbDirect.searchParams.get("pgbouncer"), null);
assert.equal(normalizedAlloyDbDirect.searchParams.get("sslmode"), "require");

console.log("database-url tests passed");
