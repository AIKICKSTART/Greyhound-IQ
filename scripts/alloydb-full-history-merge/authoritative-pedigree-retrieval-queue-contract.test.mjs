import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repo = resolve(root, "../..");
const builderPath = join(root, "build-authoritative-pedigree-retrieval-queue.mjs");
const builder = readFileSync(builderPath, "utf8");
const archiver = readFileSync(
  join(repo, "scripts/backfill-thedogs-dog-profile-raw.ts"),
  "utf8",
);

for (const token of [
  "giq-authoritative-pedigree-retrieval/v2",
  "giq-authoritative-pedigree-retrieval-outcome/v1",
  "thedogs-normalized-harvest/v1",
  "thedogs-normalized-harvest/v2",
  "parentQueueGeneration",
  "priorGenerationManifestSha256",
  "parentSourceLineage",
  "parentSourceLineageSha256",
  "r2-only-identity-retrieval-required",
  "unverified-exact-id-retrieval-path",
  "requested-path-source-id-and-returned-page-source-id",
  "successfulOutcomesAwaitingCorpusRefresh",
  "terminalUnavailableOrConflictOutcomesLedgered",
  "completeFullCorpusPass",
  "identityAuditedCorpus",
  "zeroNewExactIds",
  "saturated",
  "canonicalPromotionEligible: false",
  "networkRequests: 0",
  "databaseWrites: 0",
  "nameMatchingAllowed: false",
]) {
  assert.ok(builder.includes(token), `queue builder missing ${token}`);
}
assert.match(builder, /strictKeys\(row, EDGE_FIELDS/);
assert.match(builder, /duplicate provider-stub edge/);
assert.match(builder, /parent natural key does not match source id/);
assert.match(builder, /provider key does not match edge identity/);
assert.match(builder, /pedigree edge row conservation failed/);
assert.match(builder, /profile row conservation failed/);
assert.match(builder, /orphan row conservation failed/);
assert.doesNotMatch(builder, /\bfetch\s*\(/);
assert.doesNotMatch(builder, /\b(?:PrismaClient|DATABASE_URL|pg_dump|psql|gcloud)\b/i);

for (const token of [
  "candidateFile?: string",
  "authoritativeOutcomeLedger: string",
  'stringOption(values, "candidate-file")',
  'stringOption(values, "authoritative-outcome-ledger")',
  "readAuthoritativeCandidates",
  "LEGACY_AUTHORITATIVE_CANDIDATE_FIELDS",
  "AUTHORITATIVE_CANDIDATE_FIELDS",
  "mixes queue versions or normalized manifests",
  "mixes parent queue generations",
  "retrieval path must remain explicitly unverified",
  "classification/evidence conservation failed",
  "parent source lineage digest mismatch",
  "proveFetchedProfileIdentity",
  "returned profile page identity does not match TheDogs source id",
  "verifyTheDogsProfileArchiveIdentity",
  "verified-exact-provider-page-identity",
  "appendAuthoritativeOutcome",
  "classifyAuthoritativeFailure",
  "unverified-retrieval-path-not-found",
  "identity-conflict",
  "provider-contract-conflict",
  "transient-error",
  "canonicalPromotionEligible: false",
]) {
  assert.ok(archiver.includes(token), `raw profile archiver missing ${token}`);
}
assert.ok(
  archiver.includes("classifyAuthoritativeFailure(result.error, candidate)"),
  "authoritative failure classification must receive the candidate retrieval-path evidence",
);
assert.ok(
  archiver.indexOf('retrievalPathStatus === "unverified-exact-id-retrieval-path"') <
    archiver.indexOf('outcome: "unavailable"'),
  "an unverified retrieval-path 404/410 must be blocked before any unavailable outcome",
);
assert.doesNotMatch(
  archiver,
  /returned profile page lacks an exact path/,
  "a self profile link is diagnostic, not required identity proof",
);

const fetchPosition = archiver.indexOf(
  "const profileHtml = await provider.fetchProfile(candidate.profilePath)",
);
const proofPosition = archiver.indexOf(
  "const identityProof = proveFetchedProfileIdentity",
  fetchPosition,
);
const archiveAuditPosition = archiver.indexOf(
  "verifyTheDogsProfileArchiveIdentity",
  proofPosition,
);
const archiveWritePosition = archiver.indexOf("await writeFile(outputPath", archiveAuditPosition);
assert.ok(fetchPosition >= 0 && proofPosition > fetchPosition);
assert.ok(archiveAuditPosition > proofPosition && archiveWritePosition > archiveAuditPosition);
assert.doesNotMatch(
  archiver.slice(proofPosition, archiveWritePosition),
  /(?:prisma|database|upsert|createMany)/i,
);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const jsonl = (rows) => rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");

function profile(sourceId) {
  return {
    provider: "thedogs",
    sourceId,
    providerKey: `thedogs:dog:${sourceId}`,
    naturalKey: `thedogs:dog:${sourceId}`,
  };
}

function edge(childId, relationship, parentId, parentName, resolution = "provider-stub") {
  return {
    provider: "thedogs",
    providerKey: `thedogs:pedigree:${childId}:${relationship}:${parentId}`,
    naturalKey: `thedogs:dog:${childId}:pedigree:${relationship}`,
    childNaturalKey: `thedogs:dog:${childId}`,
    relation: relationship,
    parentSourceId: parentId,
    parentNaturalKey: `thedogs:dog:${parentId}`,
    parentName,
    resolution,
    sourceArchiveKey: `thedogs:dog-profile:${childId}`,
  };
}

function writeExport(exportRoot, { profiles, edges, orphans, transformVersion }) {
  const partition = join(exportRoot, "partition-0000-of-0001");
  mkdirSync(partition, { recursive: true });
  const datasets = { profiles, pedigree_edges: edges, orphans };
  const outputs = [];
  const datasetManifest = {};
  for (const [dataset, rows] of Object.entries(datasets)) {
    const file = `${dataset}-0001-of-0001.jsonl`;
    const body = jsonl(rows);
    writeFileSync(join(partition, file), body);
    outputs.push({ dataset, file, rowCount: rows.length });
    datasetManifest[dataset] = { shards: 1, rowCount: rows.length };
  }
  const manifest = {
    schemaVersion: 1,
    transformVersion,
    source: { provider: "thedogs", sourceCutoff: "2026-07-16T00:00:00.000Z" },
    scope: {
      profiles: true,
      races: true,
      from: null,
      to: null,
      limitProfiles: 0,
      limitRaceDays: 0,
      fullCorpus: true,
    },
    datasets: datasetManifest,
    partitions: [{ directory: "partition-0000-of-0001", outputs }],
  };
  const body = `${JSON.stringify(manifest)}\n`;
  writeFileSync(join(exportRoot, "manifest.json"), body);
  writeFileSync(join(exportRoot, "manifest.sha256"), `${sha256(body)}\n`);
  return sha256(body);
}

function runGeneration(temp, generation, exportRoot, options = {}) {
  const generationRoot = join(temp, `generation-${generation}`);
  const queue = join(generationRoot, "candidates.jsonl");
  const manifest = join(generationRoot, "manifest.json");
  const args = [
    builderPath,
    "--export-root",
    exportRoot,
    "--output",
    queue,
    "--manifest",
    manifest,
    "--parent-queue-generation",
    String(generation),
  ];
  if (options.priorManifest) args.push("--prior-generation-manifest", options.priorManifest);
  if (options.outcomeLedger) args.push("--outcome-ledger", options.outcomeLedger);
  if (options.additional) args.push("--additional-identity-candidates", options.additional);
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return {
    queue,
    manifest,
    rows: readFileSync(queue, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
    report: JSON.parse(readFileSync(manifest, "utf8")),
  };
}

function outcome(queueRow, outcomeName, details = {}) {
  const terminal = outcomeName !== "transient-error";
  return {
    schemaVersion: 1,
    ledgerVersion: "giq-authoritative-pedigree-retrieval-outcome/v1",
    provider: "thedogs",
    sourceId: queueRow.sourceId,
    providerKey: queueRow.providerKey,
    parentQueueGeneration: queueRow.parentQueueGeneration,
    normalizedManifestSha256: queueRow.normalizedManifestSha256,
    queueEvidenceSha256: queueRow.evidenceSha256,
    parentSourceLineageSha256: queueRow.parentSourceLineageSha256,
    outcome: outcomeName,
    terminal,
    attempts: 1,
    ...details,
    canonicalPromotionEligible: false,
    loggedAt: "2026-07-16T00:01:00.000Z",
  };
}

const temp = mkdtempSync(join(tmpdir(), "giq-pedigree-queue-contract-"));
try {
  const firstExport = join(temp, "export-v1");
  writeExport(firstExport, {
    profiles: [profile("1")],
    edges: [edge("1", "sire", "2", "Race Parent"), edge("1", "dam", "3", "Unavailable Parent")],
    orphans: [{ issueType: "runner-dog-profile-unresolved", missingProviderKey: "thedogs:dog:2" }],
    transformVersion: "thedogs-normalized-harvest/v1",
  });
  const additional = join(temp, "r2-only.jsonl");
  writeFileSync(
    additional,
    jsonl([
      {
        schemaVersion: 1,
        provider: "thedogs",
        sourceId: "4",
        providerKey: "thedogs:dog:4",
        preferredName: "Observed R2 Name",
        profilePath: "/dogs/4/4",
        provenanceClass: "r2-only-identity-retrieval-required",
        sourceName: "r2",
        sourceRecordId: "r2-dog-4",
        sourceArtifactKey: "r2_Dog:r2-dog-4",
        canonicalPromotionEligible: false,
      },
    ]),
  );

  const generation1 = runGeneration(temp, 1, firstExport, { additional });
  assert.deepEqual(generation1.rows.map((row) => row.sourceId), ["2", "3", "4"]);
  const r2 = generation1.rows.find((row) => row.sourceId === "4");
  assert.equal(r2.profilePath, "/dogs/4/4");
  assert.notEqual(r2.profilePath, "/dogs/4/observed-r2-name");
  assert.equal(r2.retrievalPathStatus, "unverified-exact-id-retrieval-path");
  assert.equal(r2.canonicalPromotionEligible, false);
  assert.equal(generation1.report.saturation.saturated, false);
  assert.equal(generation1.report.saturation.identityAuditedCorpus, false);

  const outcomeLedger = join(temp, "outcomes.jsonl");
  const source2 = generation1.rows.find((row) => row.sourceId === "2");
  const source3 = generation1.rows.find((row) => row.sourceId === "3");
  writeFileSync(
    outcomeLedger,
    jsonl([
      outcome(source2, "archived", {
        archivePath: ".backfill/thedogs-dog-profiles-raw/02/2.json",
        archiveSha256: "a".repeat(64),
      }),
      outcome(source3, "unavailable", {
        errorClass: "provider-profile-unavailable",
        errorSha256: "b".repeat(64),
      }),
    ]),
  );

  const generation2 = runGeneration(temp, 2, firstExport, {
    additional,
    outcomeLedger,
    priorManifest: generation1.manifest,
  });
  assert.deepEqual(generation2.rows.map((row) => row.sourceId), ["4"]);
  assert.equal(generation2.report.discovery.successfulOutcomesAwaitingCorpusRefresh, 1);
  assert.equal(generation2.report.saturation.corpusRefreshRequired, true);
  assert.equal(generation2.report.saturation.saturated, false);

  const refreshedExport = join(temp, "export-v2");
  writeExport(refreshedExport, {
    profiles: [profile("1"), profile("2"), profile("4")],
    edges: [
      edge("1", "sire", "2", "Race Parent", "profile-linked"),
      edge("1", "dam", "3", "Unavailable Parent"),
      edge("2", "sire", "5", "New Grandparent"),
    ],
    orphans: [],
    transformVersion: "thedogs-normalized-harvest/v2",
  });
  const generation3 = runGeneration(temp, 3, refreshedExport, {
    additional,
    outcomeLedger,
    priorManifest: generation2.manifest,
  });
  assert.deepEqual(generation3.rows.map((row) => row.sourceId), ["5"]);
  assert.equal(generation3.rows[0].parentQueueGeneration, 3);
  assert.equal(generation3.rows[0].parentSourceLineage[0].childProviderKey, "thedogs:dog:2");

  const source5 = generation3.rows[0];
  writeFileSync(
    outcomeLedger,
    `${readFileSync(outcomeLedger, "utf8")}${JSON.stringify(
      outcome(source5, "unavailable", {
        errorClass: "provider-profile-unavailable",
        errorSha256: "c".repeat(64),
      }),
    )}\n`,
  );
  const generation4 = runGeneration(temp, 4, refreshedExport, {
    additional,
    outcomeLedger,
    priorManifest: generation3.manifest,
  });
  assert.equal(generation4.rows.length, 0);
  assert.equal(generation4.report.saturation.zeroNewExactIds, true);
  assert.equal(generation4.report.saturation.identityAuditedCorpus, true);
  assert.equal(generation4.report.saturation.corpusRefreshRequired, false);
  assert.equal(generation4.report.saturation.terminalUnavailableOrConflictOutcomesLedgered, 2);
  assert.equal(generation4.report.saturation.saturated, true);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(
  "Authoritative pedigree retrieval contract passed: iterative full-corpus generations, exact provider IDs, r2-only unverified retrieval paths, complete lineage, append-only terminal outcomes, refresh-before-closure, and zero-new-ID saturation are enforced.",
);
