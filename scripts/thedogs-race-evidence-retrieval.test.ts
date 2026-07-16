import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  archiveRaceEvidence,
  RACE_EVIDENCE_ARCHIVE_VERSION,
} from "./archive-thedogs-race-evidence";
import {
  buildRaceEvidenceQueue,
  loadRaceEvidenceQueue,
  parseExactTheDogsRacePath,
  RACE_EVIDENCE_QUEUE_FILE,
} from "./build-thedogs-race-evidence-retrieval-queue";

const SOURCE_CUTOFF = "2026-07-01T00:00:00.000Z";
const INVENTORY_SHA = "1".repeat(64);
const RACE_ONE =
  "/racing/wentworth-park/2026-06-01/1/winter-stakes?trial=false";
const RACE_TWO =
  "/racing/richmond/2026-06-02/2/second-stakes?trial=false";

test("queue is deterministic, source-bound and conserves duplicate occurrences", async () => {
  const root = await temporaryRoot();
  try {
    const normalized = path.join(root, "normalized");
    await writeNormalizedFixture(normalized, [
      [orphan(100, RACE_ONE), orphan(101, RACE_ONE)],
      [orphan(102, RACE_TWO)],
    ], "thedogs-normalized-harvest/v2");
    const first = path.join(root, "queue-first");
    const second = path.join(root, "queue-second");
    const firstResult = await buildRaceEvidenceQueue({
      normalizedDir: normalized,
      outputDir: first,
      dryRun: false,
    });
    const secondResult = await buildRaceEvidenceQueue({
      normalizedDir: normalized,
      outputDir: second,
      dryRun: false,
    });
    assert.equal(firstResult.manifest.queue.rowCount, 2);
    assert.equal(firstResult.manifest.queue.occurrenceCount, 3);
    assert.equal(firstResult.manifest.queue.duplicateOccurrenceCount, 1);
    assert.equal(firstResult.manifest.canonicalPromotionEligible, false);
    assert.equal(firstResult.manifest.selection.profileFormFieldsUsedForRaceCreation, false);
    assert.equal(firstResult.manifestSha256, secondResult.manifestSha256);
    assert.equal(
      await readFile(path.join(first, RACE_EVIDENCE_QUEUE_FILE), "utf8"),
      await readFile(path.join(second, RACE_EVIDENCE_QUEUE_FILE), "utf8"),
    );
    const loaded = await loadRaceEvidenceQueue(first);
    const duplicated = loaded.rows.find((row) => row.racePath === RACE_ONE);
    assert.equal(duplicated?.occurrences.length, 2);
    assert.deepEqual(
      duplicated?.occurrences.map((row) => row.sourceDogId),
      ["100", "101"],
    );
    assert.ok(loaded.rows.every((row) => row.canonicalPromotionEligible === false));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("queue rejects malicious origins, traversal and tampered queue digests", async () => {
  const historicalIdentity = parseExactTheDogsRacePath(
    "/racing/otago/2014-02-18/0/greyhound_data-com?trial=false",
  );
  assert.equal(historicalIdentity.identity.raceNumber, 0);
  assert.equal(historicalIdentity.identity.raceSlug, "greyhound_data-com");
  assert.throws(
    () => parseExactTheDogsRacePath("https://attacker.example/racing/x/2026-01-01/1/x"),
    /exact TheDogs racing path/,
  );
  assert.throws(
    () => parseExactTheDogsRacePath("/racing/%2e%2e/2026-01-01/1/x"),
    /exact TheDogs racing path/,
  );
  const root = await temporaryRoot();
  try {
    const normalized = path.join(root, "normalized");
    await writeNormalizedFixture(normalized, [[orphan(100, RACE_ONE)]]);
    const queue = path.join(root, "queue");
    await buildRaceEvidenceQueue({
      normalizedDir: normalized,
      outputDir: queue,
      dryRun: false,
    });
    await writeFile(
      path.join(queue, RACE_EVIDENCE_QUEUE_FILE),
      "tampered\n",
      "utf8",
    );
    await assert.rejects(() => loadRaceEvidenceQueue(queue), /digest or byte count mismatch/);

    const malformedQueue = path.join(root, "queue-malformed");
    await buildRaceEvidenceQueue({
      normalizedDir: normalized,
      outputDir: malformedQueue,
      dryRun: false,
    });
    const queuePath = path.join(malformedQueue, RACE_EVIDENCE_QUEUE_FILE);
    const queueRow = JSON.parse((await readFile(queuePath, "utf8")).trim());
    queueRow.fabricatedCanonicalId = "must-not-be-accepted";
    const malformedBody = `${JSON.stringify(queueRow)}\n`;
    await writeFile(queuePath, malformedBody, "utf8");
    const manifestPath = path.join(malformedQueue, "queue.manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.queue.sha256 = digest(malformedBody);
    manifest.queue.bytes = Buffer.byteLength(malformedBody);
    const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(manifestPath, manifestBody, "utf8");
    await writeFile(
      path.join(malformedQueue, "queue.manifest.sha256"),
      `${digest(manifestBody)}\n`,
      "utf8",
    );
    await assert.rejects(
      () => loadRaceEvidenceQueue(malformedQueue),
      /unknown field fabricatedCanonicalId/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("archiver rejects cross-origin and cross-race redirects without an archive", async () => {
  for (const location of [
    "https://attacker.example/racing/wentworth-park/2026-06-01/1/winter-stakes",
    "https://www.thedogs.com.au/racing/wentworth-park/2026-06-01/2/other-race",
  ]) {
    const fixture = await preparedQueue();
    try {
      const outputDir = path.join(fixture.root, "archive");
      const ledger = path.join(outputDir, "outcomes.jsonl");
      const result = await archiveRaceEvidence({
        ...archiveOptions(fixture.queue, outputDir, ledger),
        fetchImpl: (async () =>
          new Response(null, {
            status: 302,
            headers: { location },
          })) as typeof fetch,
      });
      assert.equal(result.conflicts, 1);
      const outcome = JSON.parse((await readFile(ledger, "utf8")).trim());
      assert.equal(outcome.outcome, "identity-conflict");
      assert.equal(outcome.terminal, true);
      assert.equal(outcome.archiveRelativePath, null);
      assert.equal(outcome.canonicalPromotionEligible, false);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("archiver records invalid or empty results as terminal contract conflicts", async () => {
  for (const [body, errorClass] of [
    ["", "provider-result-empty"],
    ["<div>not a race result</div>", "provider-result-missing-runners"],
  ] as const) {
    const fixture = await preparedQueue();
    try {
      const outputDir = path.join(fixture.root, "archive");
      const ledger = path.join(outputDir, "outcomes.jsonl");
      const result = await archiveRaceEvidence({
        ...archiveOptions(fixture.queue, outputDir, ledger),
        fetchImpl: (async () =>
          new Response(body, {
            status: 200,
            headers: { "content-type": "text/html" },
          })) as typeof fetch,
      });
      assert.equal(result.conflicts, 1);
      const outcome = JSON.parse((await readFile(ledger, "utf8")).trim());
      assert.equal(outcome.outcome, "provider-contract-conflict");
      assert.equal(outcome.errorClass, errorClass);
      assert.equal(outcome.archiveSha256, null);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("archiver retries transient failures, archives verified raw evidence, then resumes", async () => {
  const fixture = await preparedQueue();
  try {
    const outputDir = path.join(fixture.root, "archive");
    const ledger = path.join(outputDir, "outcomes.jsonl");
    let requests = 0;
    const result = await archiveRaceEvidence({
      ...archiveOptions(fixture.queue, outputDir, ledger),
      fetchImpl: (async () => {
        requests += 1;
        if (requests === 1) {
          return new Response(null, { status: 503 });
        }
        return new Response(validResultHtml(RACE_ONE), {
          status: 200,
          headers: { "content-type": "text/javascript; charset=utf-8" },
        });
      }) as typeof fetch,
    });
    assert.equal(requests, 2);
    assert.equal(result.archived, 1);
    const outcome = JSON.parse((await readFile(ledger, "utf8")).trim());
    assert.equal(outcome.outcome, "archived-unverified");
    assert.equal(outcome.attempts, 2);
    assert.equal(outcome.requestCount, 2);
    assert.equal(outcome.canonicalPromotionEligible, false);
    const archivePath = path.join(outputDir, outcome.archiveRelativePath);
    const archive = JSON.parse(await readFile(archivePath, "utf8"));
    assert.equal(archive.archiveVersion, RACE_EVIDENCE_ARCHIVE_VERSION);
    assert.equal(archive.normalizationStatus, "unverified-authoritative-result-page");
    assert.equal(archive.canonicalPromotionEligible, false);
    assert.equal(
      archive.identityProof.verificationStatus,
      "verified-provider-result-page-promotion-ineligible",
    );
    assert.doesNotMatch(archive.response.sanitizedHtml, /starting-price/);

    const resumed = await archiveRaceEvidence({
      ...archiveOptions(fixture.queue, outputDir, ledger),
      fetchImpl: (async () => {
        throw new Error("resume must not fetch a terminal row");
      }) as typeof fetch,
    });
    assert.equal(resumed.alreadyTerminal, 1);
    assert.equal(resumed.selected, 0);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("archiver persists deterministic unavailable outcomes and contains no DB path", async () => {
  const fixture = await preparedQueue();
  try {
    const outputDir = path.join(fixture.root, "archive");
    const ledger = path.join(outputDir, "outcomes.jsonl");
    const result = await archiveRaceEvidence({
      ...archiveOptions(fixture.queue, outputDir, ledger),
      fetchImpl: (async () => new Response(null, { status: 404 })) as typeof fetch,
    });
    assert.equal(result.unavailable, 1);
    const outcome = JSON.parse((await readFile(ledger, "utf8")).trim());
    assert.equal(outcome.outcome, "unavailable");
    assert.equal(outcome.terminal, true);
    const source = await readFile(
      path.join(process.cwd(), "scripts", "archive-thedogs-race-evidence.ts"),
      "utf8",
    );
    assert.doesNotMatch(source, /@prisma|DATABASE_URL|\$executeRaw|\$queryRaw/);
    assert.match(source, /canonicalPromotionEligible: false/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

function archiveOptions(queueDir: string, outputDir: string, outcomeLedger: string) {
  return {
    queueDir,
    outputDir,
    outcomeLedger,
    concurrency: 1,
    requestIntervalMs: 0,
    timeoutMs: 1_000,
    maxBytes: 1024 * 1024,
    retryAttempts: 2,
    retryDelayMs: 0,
    limit: 0,
    dryRun: false,
    sleepImpl: async () => {},
    now: () => new Date("2026-07-16T00:00:00.000Z"),
  };
}

async function preparedQueue() {
  const root = await temporaryRoot();
  const normalized = path.join(root, "normalized");
  await writeNormalizedFixture(normalized, [[orphan(100, RACE_ONE)]]);
  const queue = path.join(root, "queue");
  await buildRaceEvidenceQueue({
    normalizedDir: normalized,
    outputDir: queue,
    dryRun: false,
  });
  return { root, queue };
}

function validResultHtml(racePath: string) {
  return `
    <link rel="canonical" href="https://www.thedogs.com.au${racePath}">
    <formatted-time data-timestamp="1780308000"></formatted-time>
    <div class="race-header__info__grade">Maiden 520m</div>
    <table>
      <tr class="race-runner">
        <td><sprite-svg name="rug_1"></sprite-svg></td>
        <td><a href="/dogs/9001/verified-dog"><div class="race-runners__name__dog">Verified Dog</div></a></td>
        <td class="race-runners__finish-position">1st</td>
        <td class="race-runners__time">29.50</td>
        <td class="starting-price">$2.50</td>
      </tr>
    </table>
  `;
}

function orphan(dogId: number, racePath: string) {
  return {
    issueType: "profile-form-race-unresolved",
    naturalKey: `thedogs:profile-form:${dogId}:${racePath}`,
    missingProviderKey: `thedogs:race:${racePath}`,
    sourceArchiveKey: `thedogs:dog-profile:${dogId}`,
  };
}

async function writeNormalizedFixture(
  root: string,
  partitionRows: Array<Array<Record<string, unknown>>>,
  transformVersion = "thedogs-normalized-harvest/v1",
) {
  await mkdir(root, { recursive: true });
  const partitions = [];
  const orphanFiles: Array<{
    file: string;
    sha256: string;
    bytes: number;
    rowCount: number;
  }> = [];
  for (let index = 0; index < partitionRows.length; index += 1) {
    const directory = `partition-${pad(index)}-of-${pad(partitionRows.length)}`;
    const partitionRoot = path.join(root, directory);
    await mkdir(partitionRoot, { recursive: true });
    const file = `orphans-${pad(index + 1)}-of-${pad(partitionRows.length)}.jsonl`;
    const body = partitionRows[index]!.map((row) => JSON.stringify(row)).join("\n") + "\n";
    const output = {
      dataset: "orphans",
      file,
      sha256: digest(body),
      bytes: Buffer.byteLength(body),
      rowCount: partitionRows[index]!.length,
      minDate: null,
      maxDate: null,
      sourceCutoff: SOURCE_CUTOFF,
      transformVersion,
    };
    await writeFile(path.join(partitionRoot, file), body, "utf8");
    const partitionManifest = {
      transformVersion,
      sourceInventorySha256: INVENTORY_SHA,
      sourceCutoff: SOURCE_CUTOFF,
      partition: index,
      partitionCount: partitionRows.length,
      inputCount: 1,
      inputSha256: String(index + 2).repeat(64).slice(0, 64),
      outputs: [output],
      issues: {
        duplicates: 0,
        orphans: partitionRows[index]!.length,
        quarantine: 0,
        targetIdAssignments: 0,
      },
    };
    const partitionBody = `${JSON.stringify(partitionManifest, null, 2)}\n`;
    const manifestSha256 = digest(partitionBody);
    await writeFile(
      path.join(partitionRoot, "partition-manifest.json"),
      partitionBody,
      "utf8",
    );
    await writeFile(
      path.join(partitionRoot, "partition-manifest.sha256"),
      `${manifestSha256}\n`,
      "utf8",
    );
    partitions.push({
      directory,
      manifestSha256,
      inputCount: partitionManifest.inputCount,
      inputSha256: partitionManifest.inputSha256,
      outputs: partitionManifest.outputs,
      issues: partitionManifest.issues,
    });
    orphanFiles.push(output);
  }
  const orphanAggregateSha256 = digest(
    orphanFiles.map((file) => `${file.file}:${file.sha256}`).join("\n"),
  );
  const manifest = {
    schemaVersion: 1,
    transformVersion,
    generatedAt: "2026-07-16T00:00:00.000Z",
    status: "operator_attention",
    source: {
      provider: "thedogs",
      inventorySha256: INVENTORY_SHA,
      sourceCutoff: SOURCE_CUTOFF,
      profileRoot: ".backfill/profiles",
      raceRoot: ".backfill/races",
    },
    scope: {
      profiles: true,
      races: true,
      from: null,
      to: null,
      limitProfiles: 0,
      limitRaceDays: 0,
      fullCorpus: true,
    },
    inventory: {
      profile: fullInventory(10),
      "race-day": fullInventory(10),
    },
    datasets: {
      orphans: {
        shards: orphanFiles.length,
        rowCount: orphanFiles.reduce((sum, file) => sum + file.rowCount, 0),
        bytes: orphanFiles.reduce((sum, file) => sum + file.bytes, 0),
        sha256: orphanAggregateSha256,
      },
    },
    partitions,
  };
  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(root, "manifest.json"), body, "utf8");
  await writeFile(path.join(root, "manifest.sha256"), `${digest(body)}\n`, "utf8");
}

function fullInventory(count: number) {
  return {
    discoveredFiles: count,
    validFiles: count,
    invalidFiles: 0,
    excludedByFilter: 0,
    uniqueNaturalKeys: count,
    duplicateSnapshots: 0,
    selectedFiles: count,
    excludedByLimit: 0,
    coverageProven: true,
  };
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function pad(value: number) {
  return String(value).padStart(4, "0");
}

async function temporaryRoot() {
  return mkdtemp(path.join(os.tmpdir(), "giq-race-evidence-"));
}
