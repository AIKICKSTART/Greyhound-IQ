import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [sql, entrypoint, dockerfile, cloudbuild, manifestText, localContract] =
  await Promise.all([
    read("scripts/pedigree-forward-merge/merge.sql"),
    read("scripts/pedigree-forward-merge/entrypoint.sh"),
    read("scripts/pedigree-forward-merge/Dockerfile"),
    read("cloudbuild-pedigree-forward-merge.yaml"),
    read("scripts/pedigree-forward-merge/input-manifest.json"),
    read("scripts/pedigree-forward-merge/AGENTS.md"),
  ]);

const manifest = JSON.parse(manifestText);
const sqlWithoutComments = sql
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");

test("immutable inputs bind all eight GALTD books and complete source totals", () => {
  assert.deepEqual(manifest.galtd.volumes, [66, 67, 68, 69, 70, 71, 72, 73]);
  assert.equal(manifest.galtd.observations.rows, 105_374);
  assert.equal(manifest.galtd.assertions.rows, 210_734);
  assert.equal(manifest.galtd.conflictGroups, 5);
  assert.equal(manifest.thedogs.pedigreeEdges.shards, 64);
  assert.equal(manifest.thedogs.pedigreeEdges.rows, 384_568);
  assert.match(manifest.thedogs.pedigreeEdges.datasetSha256, /^[0-9a-f]{64}$/);
});

test("SQL contains no DML against protected racing and replay relations", () => {
  assert.doesNotMatch(
    sqlWithoutComments,
    /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?"(?:Meeting|Race|RaceVideo|Runner)"/i,
  );
  assert.doesNotMatch(sqlWithoutComments, /\bDELETE\s+FROM\b/i);
  assert.match(sql, /protected racing, replay, runner, or dog source identity fields changed/);
});

test("Dog writes are restricted to parent IDs and updatedAt", () => {
  const updates = [
    ...sqlWithoutComments.matchAll(/UPDATE\s+public\."Dog"\s+dog[\s\S]*?;/gi),
  ].map((match) => match[0]);
  assert.equal(updates.length, 2);
  for (const statement of updates) {
    assert.doesNotMatch(statement, /"sourceProvider"|"sourceId"/);
    assert.match(statement, /SET\s+"(?:sireId|damId)"=/);
    assert.match(statement, /"updatedAt"=CURRENT_TIMESTAMP/);
  }
  assert.match(sql, /nameOnlyParentsLinked',0/);
});

test("forced-RLS pedigree writes use only transaction-local system context", () => {
  assert.match(sql, /SET LOCAL app\.system = 'true';/);
  assert.doesNotMatch(sql, /SET LOCAL app\.current_(?:role|tier)/);
  assert.doesNotMatch(entrypoint, /PGOPTIONS=.*app\.system/);
});

test("verification is rollback-only and apply is exactly confirmed", () => {
  assert.match(entrypoint, /PEDIGREE_MERGE_MODE:-verify/);
  assert.match(entrypoint, /APPLY-PEDIGREE-ONLY-STAGE11-R2-20260721/);
  assert.match(entrypoint, /local override is verification-only/);
  assert.match(sql, /\\if :apply_mode\s+COMMIT;\s+\\else\s+ROLLBACK;/);
  assert.match(localContract, /Verification is the default and must end with `ROLLBACK`/);
});

test("build uses only pinned pedigree artifacts and creates no schedule", () => {
  assert.match(cloudbuild, /forward-merge-20260721-r1\/galtd-observations\.jsonl\.gz/);
  assert.match(cloudbuild, /partition-\*\/pedigree_edges-\*\.jsonl/);
  assert.doesNotMatch(cloudbuild, /scheduler|run services update-traffic/i);
  assert.match(dockerfile, /USER postgres/);
  assert.match(dockerfile, /COPY \.pedigree-forward-merge-data\/ \/app\/data\//);
});
