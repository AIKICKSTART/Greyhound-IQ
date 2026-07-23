import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const sql = readFileSync(join(here, 'sql', 'stage-duplicate-quarantine-source-evidence.sql'), 'utf8');
const mergeShell = readFileSync(join(here, 'merge.sh'), 'utf8');
const artifactRoot = join(root, '.backfill', 'evidence', 'thedogs-duplicate-quarantine-evidence-20260718T190916AEST');
const manifestBytes = readFileSync(join(artifactRoot, 'queue.manifest.json'));
const manifest = JSON.parse(manifestBytes);
const evidenceBytes = readFileSync(join(artifactRoot, manifest.evidence.file));
const queueBytes = readFileSync(join(artifactRoot, manifest.retrievalQueue.file));
const rows = evidenceBytes.toString('utf8').trim().split(/\r?\n/u).map(JSON.parse);
const queue = queueBytes.toString('utf8').trim().split(/\r?\n/u);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

assert.equal(sha256(manifestBytes), '3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c');
assert.equal(sha256(evidenceBytes), manifest.evidence.sha256);
assert.equal(sha256(queueBytes), manifest.retrievalQueue.sha256);
assert.ok(evidenceBytes.toString('utf8').includes('\\"dogId\\"'), 'fixture must retain nested escaped JSON');
assert.equal(rows.length, 2022);
assert.equal(queue.length, 1403);
assert.deepEqual(
  Object.fromEntries(['potential-exact-same-identity','potential-complementary-same-identity','identity-conflict-or-unknown'].map((key) => [key, rows.filter((row) => row.classification === key).length])),
  {'potential-exact-same-identity': 30,'potential-complementary-same-identity': 97,'identity-conflict-or-unknown': 1895},
);
assert.equal(manifest.source.profileQuarantineRows, 115);

assert.match(sql, /3f3953a847a9e5adef5c31fdf177b1a13d309b213acda227613c65b2e4c3941c/u);
for (const count of ['2022','1940','82','30','97','1895','115']) assert.match(sql, new RegExp(`\\b${count}\\b`, 'u'));
for (const table of ['duplicate_quarantine_source_evidence_manifest','duplicate_quarantine_source_evidence','duplicate_quarantine_retrieval_queue']) {
  assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS [\\s\\S]*${table}`, 'u'));
  assert.match(sql, new RegExp(`REVOKE ALL ON [\\s\\S]*${table} FROM PUBLIC`, 'u'));
}
assert.match(sql, /CREATE TEMP TABLE duplicate_quarantine_source_evidence_import/u);
for (const variable of ['manifest_file','manifest_sha_file','source_evidence_file','retrieval_queue_file']) assert.match(sql, new RegExp(`\\\\if :\\{\\?${variable}\\}`, 'u'));
assert.match(sql, /GENERATED ALWAYS AS IDENTITY/u);
assert.match(sql, /\\set copy_duplicate_quarantine_manifest '\\\\copy/u);
assert.match(sql, /FORMAT csv, DELIMITER E''\\x1f'', QUOTE E''\\x02'', ESCAPE E''\\x02''/u);
for (const command of [
  'copy_duplicate_quarantine_manifest',
  'copy_duplicate_quarantine_manifest_sha',
  'copy_duplicate_quarantine_source_evidence',
  'copy_duplicate_quarantine_retrieval_queue',
]) assert.match(sql, new RegExp(`^:${command}$`, 'mu'));
assert.doesNotMatch(sql, /\\copy [^\n]+ FROM :'(?:manifest|source_evidence|retrieval_queue)/u);
assert.match(sql, /string_agg\(raw_line,E'\\n' ORDER BY input_ordinal\) \|\| E'\\n'/u);
assert.match(sql, /raw_manifest_body text NOT NULL/u);
assert.match(sql, /raw_manifest_sidecar text NOT NULL/u);
assert.match(sql, /sidecar=encode\(digest\(raw_body,'sha256'\),'hex'\) \|\| E'\\n'/u);
assert.doesNotMatch(sql, /btrim\(sidecar\)/u);
assert.match(sql, /1b8eff0ca0e4c690b32eb858fec05921602cb591b1fbee43e2bc114e52d7fd48/u);
assert.match(sql, /issue_id text NOT NULL REFERENCES _giq_history_stage\.duplicate_quarantine_issue\(issue_id\)/u);
assert.match(sql, /issue\.source_file=\(payload#>>'\{normalizedIssueSource,partitionDirectory\}'\) \|\| '\/' \|\| \(payload#>>'\{normalizedIssueSource,shardFile\}'\)/u);
assert.doesNotMatch(sql, /issue\.source_file=payload#>>'\{normalizedIssueSource,shardFile\}'/u);
assert.doesNotMatch(sql, /source_payload_sha256=payload#>>'\{normalizedIssueSource,rowSha256\}'/u);
assert.match(sql, /issue\.source_payload=CASE/u);
assert.match(sql, /'source-artifact:' \|\| \(q\.payload->>'sourceSha256'\)/u);
assert.doesNotMatch(sql, /'source-artifact:' \|\| q\.payload->>'sourceSha256'/u);
assert.match(sql, /'selectedRowOrdinal'/u);
assert.match(sql, /'droppedRowOrdinal'/u);
assert.match(sql, /'completeness_then_latest_ordinal'/u);
assert.match(sql, /raw_manifest_body=\(SELECT string_agg/u);
assert.match(sql, /EXCEPT SELECT raw_line FROM duplicate_quarantine_source_evidence_import/u);
assert.match(sql, /payload->>'naturalKey' LIKE '%:unknown:%'/u);
assert.match(sql, /canonical_payload_json_sha256/u);
assert.match(sql, /selectedObservation,rowSha256/u);
assert.match(sql, /droppedObservation,rowSha256/u);
assert.match(sql, /quarantinedObservation,rowSha256/u);
assert.match(sql, /CREATE TEMP TABLE duplicate_quarantine_retrieval_queue_import/u);
assert.match(sql, /ON CONFLICT\(evidence_id\) DO NOTHING/u);
assert.match(sql, /partial or changed/u);
assert.match(sql, /partition_dir/u);
assert.match(sql, /UNIQUE\(source_dataset,partition_dir,shard_file,source_line\)/u);
assert.match(sql, /raw_line text NOT NULL/u);
assert.match(sql, /payload jsonb NOT NULL/u);
assert.match(sql, /commercial_production_use_authorized boolean NOT NULL CHECK\(NOT commercial_production_use_authorized\)/u);
for (const flag of ['canonical_promotion_eligible','duplicate_removal_eligible','quarantine_release_eligible']) assert.match(sql, new RegExp(`${flag} boolean NOT NULL CHECK\\(NOT ${flag}\\)`, 'u'));
assert.equal((sql.match(/BEFORE UPDATE OR DELETE/g) ?? []).length, 1);
assert.doesNotMatch(sql, /duplicate_quarantine_resolution_audit|duplicate_quarantine_reference_proof/u);
const shellStage = mergeShell.match(/^stage_duplicate_quarantine_source_evidence\(\) \{[\s\S]*?^\}/m)?.[0] ?? '';
assert.match(mergeShell, /stage-duplicate-quarantine-source-evidence\) stage_duplicate_quarantine_source_evidence/u);
assert.match(mergeShell, /DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT="\.backfill\/evidence\/thedogs-duplicate-quarantine-evidence-20260718T190916AEST"/u);
for (const [variable, file] of [
  ['manifest_file','queue.manifest.json'],
  ['manifest_sha_file','queue.manifest.sha256'],
  ['source_evidence_file','duplicate-quarantine-evidence.jsonl'],
  ['retrieval_queue_file','duplicate-quarantine-race-retrieval-queue.jsonl'],
]) {
  assert.ok(shellStage.includes(`--set=${variable}="$DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT/${file}"`));
}
assert.match(shellStage, /assert_normalized_saturation_phase/u);
assert.match(shellStage, /duplicate_quarantine_source_evidence_relation_count/u);
assert.doesNotMatch(shellStage, /\b(?:curl|wget|gcloud|gsutil|fetch|provider)\b/iu);
assert.doesNotMatch(shellStage, /stage_duplicate_quarantine_proof_resolution|UPDATE\s+_giq_history_merge\.run/iu);
assert.match(mergeShell, /duplicate\/quarantine proof staging requires the complete immutable source-evidence stage first/u);
console.log('Duplicate/quarantine source evidence contract passed: pinned immutable import remains blocked.');
