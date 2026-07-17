import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "./migrations/20260717010000_add_live_profile_provenance_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const syncSource = readFileSync(
  new URL("../src/lib/live/dog-profile-sync.ts", import.meta.url),
  "utf8",
);

const observationModel = modelBlock(schema, "DogProfileObservation");
const ledgerModel = modelBlock(schema, "DogProfileMergeLedger");

assert.match(observationModel, /observedAt\s+DateTime/);
assert.match(observationModel, /requestSha256\s+String/);
assert.match(observationModel, /evidenceSha256\s+String/);
assert.match(observationModel, /verificationStatus\s+String/);
assert.match(
  observationModel,
  /@@unique\(\[id, dogId, sourceProvider, sourceId, requestSha256, evidenceSha256\]\)/,
);
assert.doesNotMatch(
  observationModel,
  /@@unique\(\[(?!id,)[^\]]*(?:sourceProvider|evidenceSha256)[^\]]*\]\)/,
  "payload semantics must not suppress legitimate repeat occurrences",
);

assert.match(ledgerModel, /observationId\s+String\s+@unique/);
assert.match(ledgerModel, /fieldDecisionsJson\s+String/);
assert.match(ledgerModel, /onDelete: Restrict, onUpdate: Restrict/);

assert.match(migration, /BEGIN;/);
assert.match(migration, /COMMIT;/);
assert.match(migration, /SET LOCAL lock_timeout = '5s'/);
assert.match(migration, /SET LOCAL statement_timeout = '60s'/);
assert.match(migration, /ON DELETE RESTRICT ON UPDATE RESTRICT/g);
assert.doesNotMatch(migration, /ON DELETE CASCADE/);
assert.match(migration, /octet_length\("evidenceJson"\).*5242880/s);
assert.match(migration, /jsonb_typeof\("evidenceJson"::jsonb\) = 'object'/);
assert.match(migration, /octet_length\("fieldDecisionsJson"\).*5242880/s);
assert.match(
  migration,
  /jsonb_typeof\("fieldDecisionsJson"::jsonb\) = 'array'/,
);
const occurrenceUniqueIndexes = [
  ...migration.matchAll(
    /CREATE UNIQUE INDEX "DogProfileObservation[^;]+;/gs,
  ),
];
assert(occurrenceUniqueIndexes.length > 0);
assert(
  occurrenceUniqueIndexes.every((match) => match[0].includes('"id"')),
  "every occurrence uniqueness constraint must include the fresh occurrence id",
);
assert.match(
  migration,
  /BEFORE UPDATE OR DELETE ON "DogProfileObservation"/,
);
assert.match(
  migration,
  /BEFORE UPDATE OR DELETE ON "DogProfileMergeLedger"/,
);
for (const table of ["DogProfileObservation", "DogProfileMergeLedger"]) {
  assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
  assert.match(migration, new RegExp(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`));
}
assert.match(
  migration,
  /ON "DogProfileObservation" FOR SELECT\s+USING \(public\.giq_is_admin\(\)\)/,
);
assert.match(
  migration,
  /ON "DogProfileObservation" FOR INSERT\s+WITH CHECK \(public\.giq_is_system\(\)\)/,
);
assert.match(
  migration,
  /ON "DogProfileMergeLedger" FOR SELECT\s+USING \(public\.giq_is_admin\(\)\)/,
);
assert.match(
  migration,
  /ON "DogProfileMergeLedger" FOR INSERT\s+WITH CHECK \(public\.giq_is_system\(\)\)/,
);
assert.doesNotMatch(
  migration,
  /GRANT [^;]*(?:UPDATE|DELETE)[^;]*"DogProfile(?:Observation|MergeLedger)"/s,
);

assert.match(syncSource, /const LIVE_PROFILE_CANONICAL_WRITES_ENABLED = false/);
const observationWrite = syncSource.indexOf("tx.dogProfileObservation.create");
const canonicalWrite = syncSource.indexOf("tx.dog.update", observationWrite);
const formWrite = syncSource.indexOf("mergeProfileForm(", observationWrite);
const ledgerWrite = syncSource.indexOf("tx.dogProfileMergeLedger.create", observationWrite);
assert(observationWrite >= 0);
assert(canonicalWrite > observationWrite);
assert(formWrite > observationWrite);
assert(ledgerWrite > canonicalWrite && ledgerWrite > formWrite);
assert.match(syncSource, /Dog profile occurrence payload drift detected/);
assert.match(syncSource, /trainer_identity_unresolved/);
assert.match(syncSource, /current\.sireId === resolvedParents\.sireId/);
assert.match(syncSource, /current\.damId === resolvedParents\.damId/);
assert.doesNotMatch(syncSource, /tx\.trainer\.(?:create|upsert|update)/);
assert.doesNotMatch(syncSource, /dogUpdate\.(?:sireId|damId|trainerId)\s*=/);

console.log("Live profile provenance schema contract passed");

function modelBlock(source, modelName) {
  const match = source.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
  assert(match, `missing ${modelName}`);
  return match[0];
}
