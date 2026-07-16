import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildDuplicateQuarantineEvidenceQueue,
  DUPLICATE_QUARANTINE_EVIDENCE_FILE,
  DUPLICATE_QUARANTINE_MANIFEST_FILE,
  DUPLICATE_QUARANTINE_QUEUE_FILE,
} from "./build-thedogs-duplicate-quarantine-evidence-queue";

const SOURCE_CUTOFF = "2026-07-01T02:49:36.504Z";
const INVENTORY_SHA = "a".repeat(64);

test("reconstructs and conserves duplicate/quarantine evidence without release eligibility", async () => {
  const fixture = await createFixture("thedogs-normalized-harvest/v2");
  try {
    const first = await buildDuplicateQuarantineEvidenceQueue({
      normalizedDir: fixture.normalizedDir,
      rawRaceRoot: fixture.rawRaceRoot,
      dryRun: true,
    });
    const second = await buildDuplicateQuarantineEvidenceQueue({
      normalizedDir: fixture.normalizedDir,
      rawRaceRoot: fixture.rawRaceRoot,
      dryRun: true,
    });

    assert.equal(first.manifestSha256, second.manifestSha256);
    assert.deepEqual(first.evidenceRows, second.evidenceRows);
    assert.equal(first.manifest.source.diagnosticOnly, false);
    assert.equal(first.manifest.source.rebuildRequiredFromV2, false);
    assert.equal(first.manifest.evidence.duplicateRunnerObservations, 4);
    assert.equal(first.manifest.evidence.duplicateRunnerNaturalKeys, 4);
    assert.equal(first.manifest.evidence.quarantineObservations, 3);
    assert.equal(first.manifest.evidence.missingDogIdentityObservations, 1);
    assert.equal(first.manifest.evidence.missingRaceDistanceObservations, 2);
    assert.equal(first.manifest.retrievalQueue.issueOccurrenceCount, 5);
    assert.equal(first.manifest.retrievalQueue.unavailablePathOccurrenceCount, 2);
    assert.deepEqual(first.manifest.retrievalQueue.unavailablePathGaps, {
      malformed_exact_race_path: 1,
      track_identity_mismatch: 1,
    });
    assert.equal(first.evidenceRows.length, 7);
    assert.equal(
      first.queueRows.reduce((sum, row) => sum + row.issueOccurrenceCount, 0) +
        first.manifest.retrievalQueue.unavailablePathOccurrenceCount,
      first.evidenceRows.length,
    );

    const byRace = new Map(
      first.evidenceRows.map((row) => [raceNumber(row.naturalKey), row]),
    );
    assert.equal(
      byRace.get(1)?.classification,
      "potential-complementary-same-identity",
    );
    assert.equal(
      byRace.get(2)?.classification,
      "potential-exact-same-identity",
    );
    assert.equal(byRace.get(3)?.classification, "identity-conflict-or-unknown");
    assert.deepEqual(byRace.get(1)?.rawLocation, {
      meetingOrdinal: 0,
      raceOrdinal: 0,
      selectedRowOrdinal: 1,
      droppedRowOrdinal: 0,
      rowOrdinal: null,
    });
    assert.equal(byRace.get(1)?.selectedObservation?.dogIdentity.exactSourceId, "10");
    assert.equal(byRace.get(1)?.droppedObservation?.dogIdentity.exactSourceId, "10");
    assert.ok(
      byRace
        .get(1)
        ?.fieldComparison?.selectedOnly.some((field) => field.path === "/weight"),
    );
    assert.equal(byRace.get(6)?.racePathEvidence.status, "unavailable");
    assert.equal(byRace.get(7)?.racePathEvidence.status, "unavailable");
    for (const row of first.evidenceRows) {
      assert.equal(row.authoritativeDuplicateProofPresent, false);
      assert.equal(row.exhaustiveReferenceProofPresent, false);
      assert.equal(row.noDataLossProofPresent, false);
      assert.equal(row.canonicalPromotionEligible, false);
      assert.equal(row.duplicateRemovalEligible, false);
      assert.equal(row.rawArchive.sourceSha256, fixture.rawSha256);
      assert.equal(row.rawArchive.sourcePath, "2026/01/02.json");
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("v1 evidence is diagnostic-only and must be rebuilt from v2", async () => {
  const fixture = await createFixture("thedogs-normalized-harvest/v1");
  try {
    const result = await buildDuplicateQuarantineEvidenceQueue({
      normalizedDir: fixture.normalizedDir,
      rawRaceRoot: fixture.rawRaceRoot,
      dryRun: true,
    });
    assert.equal(result.manifest.source.diagnosticOnly, true);
    assert.equal(result.manifest.source.rebuildRequiredFromV2, true);
    assert.ok(result.evidenceRows.every((row) => row.rebuildRequiredFromV2));
    assert.equal(result.manifest.canonicalPromotionEligible, false);
    assert.equal(result.manifest.duplicateRemovalEligible, false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("writes immutable source-bound files and rejects raw archive tampering", async () => {
  const fixture = await createFixture("thedogs-normalized-harvest/v2");
  try {
    const outputDir = path.join(fixture.root, "output");
    const result = await buildDuplicateQuarantineEvidenceQueue({
      normalizedDir: fixture.normalizedDir,
      rawRaceRoot: fixture.rawRaceRoot,
      outputDir,
      dryRun: false,
    });
    assert.equal(result.outputDir, outputDir);
    await Promise.all([
      readFile(path.join(outputDir, DUPLICATE_QUARANTINE_EVIDENCE_FILE)),
      readFile(path.join(outputDir, DUPLICATE_QUARANTINE_QUEUE_FILE)),
      readFile(path.join(outputDir, DUPLICATE_QUARANTINE_MANIFEST_FILE)),
    ]);
    const manifest = JSON.parse(
      await readFile(path.join(outputDir, DUPLICATE_QUARANTINE_MANIFEST_FILE), "utf8"),
    ) as Record<string, unknown>;
    assert.equal("body" in (manifest.evidence as Record<string, unknown>), false);
    await assert.rejects(
      buildDuplicateQuarantineEvidenceQueue({
        normalizedDir: fixture.normalizedDir,
        rawRaceRoot: fixture.rawRaceRoot,
        outputDir,
        dryRun: false,
      }),
      /immutable evidence output already exists/,
    );

    await writeFile(fixture.rawFile, `${await readFile(fixture.rawFile, "utf8")} `);
    await assert.rejects(
      buildDuplicateQuarantineEvidenceQueue({
        normalizedDir: fixture.normalizedDir,
        rawRaceRoot: fixture.rawRaceRoot,
        dryRun: true,
      }),
      /changed after normalized export/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("implementation has no database or provider-network execution path", async () => {
  const source = await readFile(
    path.join(process.cwd(), "scripts", "build-thedogs-duplicate-quarantine-evidence-queue.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /DATABASE_URL|PrismaClient|\bfetch\s*\(|https?\.request\s*\(/);
  assert.doesNotMatch(source, /child_process|execFile|spawn\s*\(/);
});

async function createFixture(transformVersion: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), "giq-duplicate-quarantine-"));
  const normalizedDir = path.join(root, "normalized");
  const partitionDir = path.join(normalizedDir, "partition-0000-of-0001");
  const rawRaceRoot = path.join(root, "raw");
  const rawFile = path.join(rawRaceRoot, "2026", "01", "02.json");
  await mkdir(partitionDir, { recursive: true });
  await mkdir(path.dirname(rawFile), { recursive: true });

  const rawArchive = buildRawArchive();
  const rawBody = JSON.stringify(rawArchive);
  const rawSha256 = sha256(rawBody);
  await writeFile(rawFile, rawBody, "utf8");

  const archiveRow = {
    archiveType: "race-day",
    provider: "thedogs",
    sourceId: "2026-01-02",
    providerKey: "thedogs:race-day:2026-01-02",
    naturalKey: "thedogs:race-day:2026-01-02",
    date: "2026-01-02",
    sourcePath: "2026/01/02.json",
    sourceSha256: rawSha256,
    sourceBytes: Buffer.byteLength(rawBody),
    payloadCopied: false,
  };
  const duplicates = [
    duplicateIssue(1),
    duplicateIssue(2),
    duplicateIssue(3),
    duplicateIssue(6),
  ];
  const quarantine = [
    {
      issueType: "runner-row",
      naturalKey: `${raceKey(4)}:runner:box:1`,
      sourceArchiveKey: "thedogs:race-day:2026-01-02",
      reason: "missing_dog_provider_identity",
    },
    {
      issueType: "race-row",
      naturalKey: raceKey(5),
      sourceArchiveKey: "thedogs:race-day:2026-01-02",
      reason: "missing_race_distance",
    },
    {
      issueType: "race-row",
      naturalKey: raceKey(7),
      sourceArchiveKey: "thedogs:race-day:2026-01-02",
      reason: "missing_race_distance",
    },
  ];
  const datasetRows = {
    archives: [archiveRow],
    duplicates,
    quarantine,
  };
  const outputs = [] as Array<Record<string, unknown>>;
  const datasetSummary: Record<string, unknown> = {};
  for (const [dataset, rows] of Object.entries(datasetRows)) {
    const file = `${dataset}-0001-of-0001.jsonl`;
    const body = rows.map((row) => `${JSON.stringify(row)}\n`).join("");
    const output = {
      dataset,
      file,
      sha256: sha256(body),
      bytes: Buffer.byteLength(body),
      rowCount: rows.length,
      minDate: null,
      maxDate: null,
      sourceCutoff: SOURCE_CUTOFF,
      transformVersion,
    };
    outputs.push(output);
    datasetSummary[dataset] = {
      shards: 1,
      rowCount: rows.length,
      bytes: Buffer.byteLength(body),
      sha256: sha256(`${file}:${output.sha256}`),
    };
    await writeFile(path.join(partitionDir, file), body, "utf8");
  }

  const partitionManifest = {
    transformVersion,
    sourceInventorySha256: INVENTORY_SHA,
    sourceCutoff: SOURCE_CUTOFF,
    partition: 0,
    partitionCount: 1,
    inputCount: 1,
    inputSha256: "b".repeat(64),
    outputs,
    issues: {
      duplicates: duplicates.length,
      orphans: 0,
      quarantine: quarantine.length,
      targetIdAssignments: 0,
    },
  };
  const partitionBody = `${JSON.stringify(partitionManifest, null, 2)}\n`;
  const partitionSha256 = sha256(partitionBody);
  await writeFile(path.join(partitionDir, "partition-manifest.json"), partitionBody);
  await writeFile(
    path.join(partitionDir, "partition-manifest.sha256"),
    `${partitionSha256}\n`,
  );

  const inventoryRow = {
    discoveredFiles: 1,
    validFiles: 1,
    invalidFiles: 0,
    excludedByFilter: 0,
    uniqueNaturalKeys: 1,
    duplicateSnapshots: 0,
    selectedFiles: 1,
    excludedByLimit: 0,
    coverageProven: true,
  };
  const manifest = {
    schemaVersion: 1,
    transformVersion,
    generatedAt: "2026-07-16T06:24:02.623Z",
    status: "blocked",
    source: {
      provider: "thedogs",
      inventorySha256: INVENTORY_SHA,
      sourceCutoff: SOURCE_CUTOFF,
      profileRoot: ".backfill/thedogs-dog-profiles-raw",
      raceRoot: ".backfill/thedogs-raw",
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
    identityPolicy: {
      providerKeys: true,
      stableNaturalKeys: true,
      ...(transformVersion === "thedogs-normalized-harvest/v2"
        ? { profileArchivesExactProviderIdentity: true }
        : {}),
      targetIdsGenerated: false,
      targetIdAssignments: 0,
    },
    inventory: { profile: inventoryRow, "race-day": inventoryRow },
    datasets: datasetSummary,
    issues: {
      duplicates: duplicates.length,
      orphans: 0,
      quarantine: quarantine.length,
      targetIdAssignments: 0,
    },
    partitions: [
      {
        directory: "partition-0000-of-0001",
        manifestSha256: partitionSha256,
        inputCount: 1,
        inputSha256: "b".repeat(64),
        outputs,
        issues: partitionManifest.issues,
      },
    ],
  };
  const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(normalizedDir, "manifest.json"), manifestBody);
  await writeFile(path.join(normalizedDir, "manifest.sha256"), `${sha256(manifestBody)}\n`);
  return { root, normalizedDir, rawRaceRoot, rawFile, rawSha256 };
}

function buildRawArchive() {
  const sameDogBase = runner("10", "Alpha", 1);
  const exactDogBase = runner("11", "Bravo", 1);
  return {
    source: "thedogs",
    date: "2026-01-02",
    fetchedAt: SOURCE_CUTOFF,
    meetings: [
      {
        sourceId: "/racing/cranbourne/2026-01-02",
        trackName: "Cranbourne",
        state: "VIC",
        races: [
          race(1, [sameDogBase, { ...sameDogBase, weight: 30 }]),
          race(2, [exactDogBase, structuredClone(exactDogBase)]),
          race(3, [runner("20", "Charlie", 1), runner("21", "Delta", 1)]),
          race(4, [{ boxNumber: 1, dog: { name: "Unknown Runner" }, scratched: false }]),
          race(5, [], null),
          race(
            6,
            [runner("30", "Echo", 1), runner("30", "Echo", 1)],
            515,
            "/racing/cranbourne/2026-01-02/6/666%2fescape?trial=false",
          ),
          race(
            7,
            [],
            null,
            "/racing/sandown/2026-01-02/7/777?trial=false",
          ),
        ],
      },
    ],
  };
}

function race(
  raceNumberValue: number,
  runners: unknown[],
  distance: number | null = 515,
  sourceId = `/racing/cranbourne/2026-01-02/${raceNumberValue}/${100 + raceNumberValue}?trial=false`,
) {
  return {
    sourceId,
    sourceRawJson: JSON.stringify({ href: sourceId, resultPage: true }),
    raceNumber: raceNumberValue,
    name: `Race ${raceNumberValue}`,
    raceTime: `2026-01-02T0${raceNumberValue}:00:00.000Z`,
    distance,
    grade: "5",
    resultStatus: "posted",
    runners,
  };
}

function runner(id: string, name: string, box: number) {
  return {
    sourceId: `dog:${id}:box:${box}`,
    sourceRawJson: JSON.stringify({
      dogId: id,
      dogProfileUrl: `/dogs/${id}/${name.toLowerCase()}`,
      boxNumber: box,
    }),
    boxNumber: box,
    dog: { name, earBrand: `thedogs:${id}` },
    scratched: false,
  };
}

function duplicateIssue(number: number) {
  return {
    issueType: "runner-natural-key",
    naturalKey: `${raceKey(number)}:runner:box:1`,
    sourceArchiveKey: "thedogs:race-day:2026-01-02",
    selectedRowOrdinal: 1,
    droppedRowOrdinal: 0,
    selection: "completeness_then_latest_ordinal",
  };
}

function raceKey(number: number) {
  return `thedogs:meeting:2026-01-02:vic:cranbourne:race:number:${number}`;
}

function raceNumber(naturalKey: string) {
  return Number(naturalKey.match(/:race:number:(\d+)/)?.[1]);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
