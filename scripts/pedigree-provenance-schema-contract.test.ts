import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260716154500_add_pedigree_provenance_foundation/migration.sql",
  "utf8",
);

function modelBlock(modelName: string) {
  const match = schema.match(
    new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`, "m"),
  );
  assert.ok(match, `${modelName} must exist in the Prisma schema`);
  return match[1];
}

function triggerBranch(start: string, end: string) {
  const startIndex = migration.indexOf(start);
  const endIndex = migration.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing trigger branch: ${start}`);
  assert.notEqual(endIndex, -1, `missing trigger branch terminator: ${end}`);
  return migration.slice(startIndex, endIndex);
}

function uniqueSignatures(model: string) {
  return [...model.matchAll(/@@unique\(\[([^\]]+)\]\)/g)].map(
    (match) => match[1],
  );
}

const importRun = modelBlock("PedigreeImportRun");
const sourceIdentity = modelBlock("DogSourceIdentity");
const assertion = modelBlock("PedigreeAssertion");
const mergeLedger = modelBlock("PedigreeMergeLedger");

// Evidence is occurrence-specific. Re-reading the same artifact in a later run,
// or observing a second assertion for the same relationship, must not be
// suppressed by semantic-content uniqueness.
assert.doesNotMatch(importRun, /@@unique\(\[sourceProvider, artifactSha256\]\)/);
assert.doesNotMatch(
  sourceIdentity,
  /@@unique\(\[sourceProvider, sourceId, artifactSha256\]\)/,
);
assert.doesNotMatch(
  sourceIdentity,
  /@@unique\(\[importRunId, artifactOffsetLine\]\)/,
);
assert.doesNotMatch(
  assertion,
  /@@unique\(\[subjectIdentityId, relationship\]\)/,
);
assert.doesNotMatch(
  assertion,
  /@@unique\(\[importRunId, artifactOffsetLine, relationship\]\)/,
);
assert.doesNotMatch(
  mergeLedger,
  /@@unique\(\[assertionId, dogId, decision\]\)/,
);
assert.deepEqual(uniqueSignatures(importRun), [
  "id, sourceProvider, artifactSha256",
]);
assert.deepEqual(uniqueSignatures(sourceIdentity), [
  "id, importRunId, sourceProvider, artifactSha256",
]);
assert.deepEqual(uniqueSignatures(assertion), [
  "id, importRunId, sourceProvider, artifactSha256",
]);
assert.deepEqual(uniqueSignatures(mergeLedger), []);

for (const block of [sourceIdentity, assertion]) {
  assert.match(block, /importRunId\s+String/);
  assert.match(block, /artifactSha256\s+String/);
  assert.match(block, /artifactOffsetLine\s+Int/);
  assert.match(block, /evidenceSha256\s+String/);
}
assert.match(
  sourceIdentity,
  /@@unique\(\[id, importRunId, sourceProvider, artifactSha256\]\)/,
);
assert.match(
  assertion,
  /@@unique\(\[id, importRunId, sourceProvider, artifactSha256\]\)/,
);

for (const indexName of [
  "PedigreeImportRun_sourceProvider_artifactSha256_idx",
  "DogSourceIdentity_sourceProvider_sourceId_artifactSha256_idx",
  "DogSourceIdentity_importRunId_artifactOffsetLine_idx",
  "PedigreeAssertion_subjectIdentityId_relationship_idx",
  "PedigreeAssertion_importRunId_artifactOffsetLine_relationship_idx",
  "PedigreeMergeLedger_assertionId_dogId_decision_createdAt_idx",
]) {
  assert.match(migration, new RegExp(`CREATE INDEX "${indexName}"`));
  assert.doesNotMatch(migration, new RegExp(`CREATE UNIQUE INDEX "${indexName}"`));
}
assert.deepEqual(
  [
    ...migration.matchAll(
      /CREATE UNIQUE INDEX "((?:Pedigree|DogSourceIdentity)[^"\n]+)"/g,
    ),
  ].map((match) => match[1]),
  [
    "PedigreeImportRun_id_sourceProvider_artifactSha256_key",
    "DogSourceIdentity_id_importRunId_sourceProvider_artifactSha256_key",
    "PedigreeAssertion_id_importRunId_sourceProvider_artifactSha256_key",
  ],
);

for (const block of [importRun, sourceIdentity, assertion, mergeLedger]) {
  assert.doesNotMatch(block, /onUpdate: Cascade/);
  assert.doesNotMatch(block, /onDelete: (?:Cascade|SetNull)/);
}
assert.match(
  sourceIdentity,
  /fields: \[dogId\][^\n]+onDelete: Restrict, onUpdate: Restrict/,
);
assert.match(
  assertion,
  /fields: \[parentIdentityId\][^\n]+onDelete: Restrict, onUpdate: Restrict/,
);
assert.match(
  migration,
  /"observedColour" IS NULL OR char_length\(btrim\("observedColour"\)\) BETWEEN 1 AND 100/,
  "real provider colour descriptions must not be truncated to a short code",
);

// Composite foreign keys bind observations to the exact run/provider/artifact
// tuple. All canonical and provenance bindings are RESTRICTed in both
// directions so reassignments cannot cascade or disappear silently.
for (const foreignKey of [
  "DogSourceIdentity_dogId_fkey",
  "DogSourceIdentity_importRun_evidence_fkey",
  "PedigreeAssertion_importRun_evidence_fkey",
  "PedigreeAssertion_subject_evidence_fkey",
  "PedigreeAssertion_parentIdentityId_fkey",
  "PedigreeMergeLedger_importRun_evidence_fkey",
  "PedigreeMergeLedger_assertion_evidence_fkey",
  "PedigreeMergeLedger_winningAssertionId_fkey",
  "PedigreeMergeLedger_dogId_fkey",
  "PedigreeMergeLedger_existingParentDogId_fkey",
  "PedigreeMergeLedger_proposedParentDogId_fkey",
]) {
  const match = migration.match(
    new RegExp(
      `ADD CONSTRAINT "${foreignKey}"([\\s\\S]*?ON DELETE RESTRICT ON UPDATE RESTRICT;)`,
    ),
  );
  assert.ok(match, `${foreignKey} must use ON DELETE/UPDATE RESTRICT`);
}
assert.match(
  migration,
  /FOREIGN KEY \("importRunId", "sourceProvider", "artifactSha256"\)[\s\S]*?REFERENCES "PedigreeImportRun"\("id", "sourceProvider", "artifactSha256"\)/,
);
assert.match(
  migration,
  /FOREIGN KEY \("subjectIdentityId", "importRunId", "sourceProvider", "artifactSha256"\)[\s\S]*?REFERENCES "DogSourceIdentity"\("id", "importRunId", "sourceProvider", "artifactSha256"\)/,
);

const identityGuard = triggerBranch(
  "ELSIF TG_TABLE_NAME = 'DogSourceIdentity' THEN",
  "ELSIF TG_TABLE_NAME = 'PedigreeAssertion' THEN",
);
const assertionGuard = triggerBranch(
  "ELSIF TG_TABLE_NAME = 'PedigreeAssertion' THEN",
  "ELSE\n    RAISE EXCEPTION 'pedigree merge ledger is append-only';",
);

assert.match(identityGuard, /NEW\."dogId" IS DISTINCT FROM OLD\."dogId"/);
assert.match(identityGuard, /dog source identity evidence is immutable/);
assert.match(
  assertionGuard,
  /NEW\."parentIdentityId" IS DISTINCT FROM OLD\."parentIdentityId"/,
);
assert.match(assertionGuard, /pedigree assertion evidence is immutable/);
for (const branch of [identityGuard, assertionGuard]) {
  assert.doesNotMatch(branch, /RETURN NEW/);
  assert.doesNotMatch(branch, /verificationStatus/);
}

// The database role can append evidence but cannot UPDATE or DELETE immutable
// identity/assertion observations. Status changes therefore require a new
// run-specific observation instead of an unaudited in-place rewrite.
assert.doesNotMatch(
  migration,
  /ON "(?:DogSourceIdentity|PedigreeAssertion)" FOR (?:ALL|UPDATE|DELETE)/,
);
assert.match(
  migration,
  /GRANT SELECT, INSERT ON "DogSourceIdentity", "PedigreeAssertion"/,
);
assert.doesNotMatch(
  migration,
  /GRANT [^;]*(?:UPDATE|DELETE)[^;]*"DogSourceIdentity"/,
);
assert.doesNotMatch(
  migration,
  /GRANT [^;]*(?:UPDATE|DELETE)[^;]*"PedigreeAssertion"/,
);

// Names remain candidate-search aids only: no name field is a unique identity
// or relational key in the provenance foundation.
for (const block of [sourceIdentity, assertion]) {
  assert.doesNotMatch(block, /@@unique\(\[[^\]]*(?:Name|normalizedName)[^\]]*\]\)/);
}
assert.doesNotMatch(
  migration,
  /(?:FOREIGN KEY|CREATE UNIQUE INDEX)[^;]*(?:sourceName|normalizedName|assertedParentName|assertedParentNormalizedName)/i,
);

console.log("pedigree provenance schema contract: PASS");
