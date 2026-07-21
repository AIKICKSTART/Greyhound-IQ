import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("./migrate.sh", import.meta.url),
  "utf8",
);

assert.match(
  migration,
  /EXPECTED_DATABASE="giq_production_stage11_20260718_r2"/,
);
assert.doesNotMatch(migration, /giq_rehearsal_restore_v8/);
assert.match(migration, /export DIRECT_URL="\$DATABASE_URL"/);
assert.match(migration, /npx prisma migrate deploy\s+npx prisma migrate status/);
assert.doesNotMatch(migration, /prisma migrate (?:dev|reset|resolve)/);

console.log("production migration target contract passed");
