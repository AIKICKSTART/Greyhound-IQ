import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const audit = readFileSync(new URL("./audit.sh", import.meta.url), "utf8");

assert.match(audit, /EXPECTED_DATABASE="giq_production_stage11_20260718_r2"/);
assert.match(audit, /default_transaction_read_only=on/);
assert.match(audit, /canonical_jurisdictions AS/);
assert.match(audit, /relationship_quality AS/);
assert.match(audit, /replay_provider_inventory AS/);
assert.match(audit, /replay_year_inventory AS/);
assert.match(audit, /runnerSourceIdentityWithinRace/);
assert.match(audit, /runnerDogIdentityWithinRace/);
assert.match(audit, /resultSourceIdentityWithinRace/);
assert.match(audit, /identity-diagnostics/);
assert.match(audit, /alloydb-production-identity-diagnostics/);
assert.match(audit, /matchingRaceBox/);
assert.doesNotMatch(audit, /jsonb_pretty/);
for (const state of ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]) {
  assert.ok(audit.includes(`('${state}')`));
}
assert.match(audit, /PRODUCTION_DB_READ_ONLY_AUDIT_COMPLETE/);

console.log("production database audit contract: ok");
