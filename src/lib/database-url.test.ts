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

assert.match(
  databaseUrlConfigurationError(managedDirect, {
    production: true,
    required: true,
  }) ?? "",
  /self-hosted Supabase\/Postgres/
);

assert.match(
  databaseUrlConfigurationError(managedPooler, {
    production: true,
    required: true,
  }) ?? "",
  /self-hosted Supabase\/Postgres/
);

assert.equal(
  databaseUrlConfigurationError(selfHosted, {
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

console.log("database-url tests passed");
