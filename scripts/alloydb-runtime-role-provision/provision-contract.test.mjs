import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const provision = readFileSync(
  new URL("./provision.sh", import.meta.url),
  "utf8",
);

assert.match(provision, /EXPECTED_DATABASE="giq_production_stage11_20260718_r2"/);
assert.match(provision, /GRANT CONNECT ON DATABASE giq_production_stage11_20260718_r2/);
assert.match(provision, /REVOKE DELETE ON TABLE public\."PedigreeImportRun"/);
for (const table of [
  "DogSourceIdentity",
  "PedigreeAssertion",
  "PedigreeMergeLedger",
  "DogProfileObservation",
  "DogProfileMergeLedger",
]) {
  assert.ok(provision.includes(`public."${table}"`));
}
assert.match(provision, /application_dml_count <> 108/);
assert.match(provision, /routine_count <> 45/);
assert.match(provision, /OR NOT provenance_grants_valid/);
assert.match(provision, /NOBYPASSRLS/);
assert.ok(provision.includes(`--command="SELECT current_user || ':' || session_user;"`));
assert.ok(provision.includes(`interval '30 days'`));

console.log("runtime role provision contract: ok");
