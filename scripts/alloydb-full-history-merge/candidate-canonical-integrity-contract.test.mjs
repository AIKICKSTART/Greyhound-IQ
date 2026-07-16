import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (relative) => readFileSync(join(root, relative), "utf8");

const audit = read("sql/audit-candidate-canonical-integrity.sql");
const schema = read("../../prisma/schema.prisma");

assert.match(audit, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;/);
assert.match(audit, /ROLLBACK;/);
assert.doesNotMatch(audit, /^\s*COMMIT\s*;/im);
assert.doesNotMatch(audit, /CREATE\s+(?:SERVER|EXTENSION|SCHEMA)\b/i);
assert.doesNotMatch(audit, /\b(?:postgres_fdw|dblink|10\.240\.|https?:\/\/)\b/i);

for (const match of audit.matchAll(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+([A-Za-z_][A-Za-z0-9_]*)/gi)) {
  assert.match(
    match[1],
    /^giq_audit_/,
    `audit DML must target pg_temp evidence only, observed ${match[1]}`,
  );
}
assert.doesNotMatch(
  audit,
  /CREATE\s+(?!TEMP\s+)TABLE\b/i,
  "all audit working tables must be temporary",
);
assert.equal(
  [...audit.matchAll(/^CREATE TEMP TABLE\b/gm)].length,
  [...audit.matchAll(/ON COMMIT DROP(?:\s+AS|;)/g)].length,
  "every temporary evidence table must be transaction-scoped",
);
const dollarTags = audit.match(/\$[a-z_]+\$/g) ?? [];
for (const tag of new Set(dollarTags)) {
  assert.equal(
    dollarTags.filter((candidate) => candidate === tag).length,
    2,
    `${tag} must delimit exactly one PL/pgSQL block`,
  );
}

assert.match(audit, /namespace\.nspname='public'/);
assert.match(audit, /relation\.relkind IN \('r','p'\)/);
assert.match(audit, /pg_index index_row/);
assert.match(audit, /index_row\.indisprimary/);
assert.match(audit, /key_column\.ordinality<=index_row\.indnkeyatts/);
assert.match(audit, /orderedPrimaryKey/);
assert.match(audit, /compositePrimaryKeys/);
assert.match(audit, /nonIdPrimaryKeys/);

const schemaHasCompositePk = /@@id\(\[[^\]]+,[^\]]+\]\)/.test(schema);
const schemaHasNonIdPk = /^\s+(?!id\s)\w+\s+\w+\s+@id\b/m.test(schema);
assert.equal(schemaHasCompositePk, true, "fixture schema must retain composite primary keys");
assert.equal(schemaHasNonIdPk, true, "fixture schema must retain non-id primary keys");
assert.doesNotMatch(audit, /ON CONFLICT\s*\(\s*id\s*\)/i);

assert.match(audit, /FROM pg_constraint constraint_row/);
assert.match(audit, /constraint_row\.contype='f'/);
assert.match(audit, /unnest\(constraint_row\.conkey,constraint_row\.confkey\) WITH ORDINALITY/);
assert.match(audit, /orphanRows/);
assert.match(audit, /unvalidatedForeignKeys/);

assert.match(audit, /JOIN pg_sequence sequence_catalog/);
assert.match(audit, /dependency\.deptype IN \('a','i'\)/);
assert.match(audit, /SELECT last_value::numeric,is_called/);
assert.match(audit, /next_value_safe/);
assert.match(audit, /owner_count<>1/);

for (const state of ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]) {
  assert.match(audit, new RegExp(`\\('${state}'\\)`), `${state} must be in the AU coverage contract`);
}
assert.match(audit, /all_state_race_history_coverage/);
assert.match(audit, /normalized_races/);
assert.match(audit, /unclassifiedTrackStates/);

const normalizedEntities = [
  ["Track", "normalized_track"],
  ["Trainer", "normalized_trainer"],
  ["Dog", "normalized_dog"],
  ["Meeting", "normalized_meeting"],
  ["Race", "normalized_race"],
  ["Runner", "normalized_runner"],
  ["Result", "normalized_result"],
  ["FormEntry", "normalized_form_entry"],
  ["DogProfileForm", "normalized_profile_form"],
  ["RaceVideo", "normalized_race_video"],
  ["DogProfileArchive", "normalized_dog_profile_archive"],
  ["RaceDayArchive", "normalized_race_day_archive"],
];
for (const [canonical, staged] of normalizedEntities) {
  assert.match(
    audit,
    new RegExp(`\\('${canonical}','${canonical}','${staged}'`),
    `${canonical} must participate in normalized target and reverse-history anti-joins`,
  );
}
assert.match(audit, /missingTargets/);
assert.match(audit, /identityMismatches/);
assert.match(audit, /unexpectedHistoryRows/);

for (const mediaProof of [
  "eligibleReplayMissingNormalized",
  "normalizedReplayMissingEligible",
  "eligiblePhotoMissingNormalized",
  "normalizedPhotoMissingEligible",
  "quarantinedMediaMissingEvidence",
  "orphanMediaQuarantineEvidence",
  "canonicalReplayProjectionGaps",
  "snapshotReplayProofGaps",
  "standaloneMembershipMissing",
  "standaloneMembershipUnexpected",
  "standaloneDispositionInvalid",
]) {
  assert.match(audit, new RegExp(mediaProof));
}
assert.match(audit, /replay_media_partition/);

for (const pedigreeProof of [
  "unresolvedAssertionSubjects",
  "unresolvedAssertionParents",
  "unresolvedAssertionVerification",
  "thedogsIdentityProjectionGaps",
  "thedogsAssertionProjectionGaps",
  "galtdIdentityProjectionGaps",
  "galtdAssertionProjectionGaps",
  "pendingAuthoritativeDecisions",
  "thedogsLedgerGaps",
  "galtdLedgerGaps",
  "canonicalPedigreeDecisionMismatches",
]) {
  assert.match(audit, new RegExp(pedigreeProof));
}
assert.match(audit, /DELETE FROM giq_audit_pedigree_edge edge/);
assert.match(audit, /parent_edge\.child_id=edge\.parent_id/);
assert.match(audit, /GET DIAGNOSTICS removed_count=ROW_COUNT/);
assert.doesNotMatch(audit, /WITH RECURSIVE[\s\S]*ancestry/i);
assert.match(audit, /remainingCycleBoundEdges/);

for (const check of [
  "workflow_markers",
  "public_table_primary_keys",
  "public_table_policy_coverage",
  "rls_catalog_flags",
  "foreign_key_integrity",
  "alternate_identity_uniqueness",
  "sequence_ownership_next_value",
  "all_state_race_history_coverage",
  "normalized_entity_reconciliation",
  "replay_media_partition",
  "pedigree_assertion_resolution",
  "pedigree_acyclicity",
  "zero_unclassified_entities",
]) {
  assert.match(audit, new RegExp(`'${check}'`), `${check} must feed the final manifest`);
}

assert.match(audit, /'schemaVersion','giq-candidate-canonical-integrity\/v1'/);
assert.match(audit, /'sourceOnly',true/);
assert.match(audit, /'persistentWrites',false/);
assert.match(audit, /candidate_canonical_integrity_manifest/);
assert.match(audit, /FROM giq_audit_check WHERE blocking AND status='fail'/);
assert.match(audit, /\\quit 3/);

assert.doesNotMatch(
  audit,
  /\b\d{4,}\b/,
  "candidate audit must derive reporting totals instead of pinning large row counts",
);

console.log("alloydb candidate canonical integrity contract: PASS");
