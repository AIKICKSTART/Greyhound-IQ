import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  compareSnapshotRank,
  runNormalizedHarvest,
  TRANSFORM_VERSION,
  type NormalizedHarvestOptions,
} from "./export-thedogs-archive-datasets";

assert.ok(
  compareSnapshotRank(
    { snapshotTimeMs: 2, completeness: 1, sha256: "a", sourcePath: "a" },
    { snapshotTimeMs: 1, completeness: 100, sha256: "z", sourcePath: "z" },
  ) > 0,
  "newest snapshot must win before completeness",
);
assert.ok(
  compareSnapshotRank(
    { snapshotTimeMs: 2, completeness: 2, sha256: "a", sourcePath: "a" },
    { snapshotTimeMs: 2, completeness: 1, sha256: "z", sourcePath: "z" },
  ) > 0,
  "completeness must break equal-time ties",
);

async function main() {
  const fixtureParent = realpathSync(tmpdir());
  const fixtureRoot = mkdtempSync(join(fixtureParent, "greyhoundiq-normalized-harvest-"));
  const profileRoot = join(fixtureRoot, "profiles");
  const raceRoot = join(fixtureRoot, "races");
  const outputRoot = join(fixtureRoot, ".backfill", "exports");

  try {
    const raceSourceId = "/racing/test-park/2024-01-01/1/test-race?trial=false";
    const baseProfile = {
      source: "thedogs",
      sourceId: "1",
      fetchedAt: "2026-01-01T00:00:00.000Z",
      candidate: {
        sourceId: "1",
        name: "Less Complete",
        profilePath: "/dogs/1/less-complete",
      },
      profileHtml: '<a href="/dogs/1/less-complete">dog</a><blackbook-dog data-dog-id="1"></blackbook-dog>',
      parsed: {
        sourceProvider: "thedogs",
        sourceId: "1",
        profileUrl: "https://www.thedogs.com.au/dogs/1/less-complete",
        name: "Less Complete",
        formRows: [],
      },
    };
    writeJson(join(profileRoot, "a", "1.json"), baseProfile);
    writeJson(join(profileRoot, "b", "1.json"), {
      ...baseProfile,
      candidate: {
        sourceId: "1",
        name: "More Complete",
        profilePath: "/dogs/1/more-complete",
      },
      showMorePath: "/dogs/1/more-complete/full-form?page=1",
      profileHtml: '<a href="/dogs/1/more-complete">dog</a><blackbook-dog data-dog-id="1"></blackbook-dog>',
      fullFormHtml: "<table>synthetic form</table>",
      parsed: {
        sourceProvider: "thedogs",
        sourceId: "1",
        profileUrl: "https://www.thedogs.com.au/dogs/1/more-complete",
        name: "More Complete",
        trainerName: "Synthetic Trainer",
        ownerName: "Synthetic Owner",
        sire: { sourceId: "99", name: "Missing Parent" },
        careerStarts: 1,
        formRows: [
          {
            sourceId: raceSourceId,
            raceUrl: raceSourceId,
            date: "2024-01-01",
            trackName: "Test Park",
            finishingPosition: 1,
            boxNumber: 1,
            hasVideo: true,
          },
        ],
      },
    });
    writeText(join(profileRoot, "invalid", "2.json"), "{not-json");
    writeJson(join(profileRoot, "invalid-identity", "3.json"), {
      ...baseProfile,
      sourceId: "999",
    });

    const oldRaceDay = raceArchive("2026-01-01T00:00:00.000Z", raceSourceId, false);
    const selectedRaceDay = raceArchive("2026-01-02T00:00:00.000Z", raceSourceId, true);
    writeJson(join(raceRoot, "old", "2024", "01", "01.json"), oldRaceDay);
    writeJson(join(raceRoot, "new", "2024", "01", "01.json"), selectedRaceDay);

    const options: NormalizedHarvestOptions = {
      profileDir: profileRoot,
      rawDir: raceRoot,
      outDir: outputRoot,
      shards: 2,
      profiles: true,
      races: true,
      limitProfiles: 0,
      limitRaceDays: 0,
    };
    const first = await runNormalizedHarvest(options);
    assert.equal(first.reused, false);
    assert.equal(first.manifest.transformVersion, TRANSFORM_VERSION);
    assert.equal(first.manifest.status, "blocked");
    assert.deepEqual(first.manifest.inventory.profile, {
      discoveredFiles: 4,
      validFiles: 2,
      invalidFiles: 2,
      excludedByFilter: 0,
      uniqueNaturalKeys: 1,
      duplicateSnapshots: 1,
      selectedFiles: 1,
      excludedByLimit: 0,
      coverageProven: true,
    });
    assert.deepEqual(first.manifest.inventory["race-day"], {
      discoveredFiles: 2,
      validFiles: 2,
      invalidFiles: 0,
      excludedByFilter: 0,
      uniqueNaturalKeys: 1,
      duplicateSnapshots: 1,
      selectedFiles: 1,
      excludedByLimit: 0,
      coverageProven: true,
    });
    assert.deepEqual(
      Object.fromEntries(Object.entries(first.manifest.datasets).map(([name, value]) => [name, value.rowCount])),
      {
        profiles: 1,
        pedigree_edges: 1,
        profile_forms: 1,
        meetings: 1,
        races: 1,
        runners: 1,
        results: 1,
        archives: 2,
        race_media: 2,
        duplicates: 2,
        orphans: 1,
        quarantine: 2,
      },
    );
    assert.deepEqual(first.manifest.issues, {
      duplicates: 2,
      orphans: 1,
      quarantine: 2,
      targetIdAssignments: 0,
    });
    assert.equal(first.manifest.identityPolicy.targetIdsGenerated, false);
    assert.equal(first.manifest.identityPolicy.profileArchivesExactProviderIdentity, true);
    assert.equal(first.manifest.archivePolicy.payloadCopied, false);

    const profiles = readDataset(first.outputDir, first.manifest, "profiles");
    assert.equal(profiles[0]?.name, "More Complete");
    const archives = readDataset(first.outputDir, first.manifest, "archives");
    assert.ok(archives.every((row) => row.payloadCopied === false));
    assert.ok(archives.every((row) => !("profileHtml" in row) && !("rawJson" in row)));

    for (const dataset of [
      "profiles",
      "pedigree_edges",
      "profile_forms",
      "meetings",
      "races",
      "runners",
      "results",
      "race_media",
    ] as const) {
      for (const row of readDataset(first.outputDir, first.manifest, dataset)) {
        for (const forbidden of ["id", "dogId", "sireId", "damId", "meetingId", "raceId", "runnerId", "trainerId"]) {
          assert.equal(forbidden in row, false, `${dataset} must not assign ${forbidden}`);
        }
      }
    }

    const resumed = await runNormalizedHarvest(options);
    assert.equal(resumed.reused, true);
    assert.equal(resumed.outputDir, first.outputDir);
    assert.equal(resumed.manifestSha256, first.manifestSha256);

    const changedProfilePath = join(profileRoot, "b", "1.json");
    const changedProfile = JSON.parse(readFileSync(changedProfilePath, "utf8"));
    changedProfile.parsed.careerWins = 1;
    writeJson(changedProfilePath, changedProfile);
    const changed = await runNormalizedHarvest(options);
    assert.equal(changed.reused, false);
    assert.notEqual(changed.outputDir, first.outputDir);
    assert.notEqual(changed.manifest.source.inventorySha256, first.manifest.source.inventorySha256);
  } finally {
    const resolvedFixtureRoot = realpathSync(fixtureRoot);
    assert.equal(dirname(resolvedFixtureRoot), fixtureParent);
    assert.match(basename(resolvedFixtureRoot), /^greyhoundiq-normalized-harvest-/);
    rmSync(resolvedFixtureRoot, { recursive: true, force: true });
  }

  console.log("normalized The Dogs harvest exporter tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function raceArchive(fetchedAt: string, raceSourceId: string, withMedia: boolean) {
  return {
    source: "thedogs",
    date: "2024-01-01",
    fetchedAt,
    meetings: [
      {
        sourceId: "/racing/test-park/2024-01-01?trial=false",
        trackName: "Test Park",
        state: "NSW",
        meetingDate: "2024-01-01T00:00:00.000Z",
        meetingType: "The Dogs Live",
        races: [
          {
            sourceId: raceSourceId,
            raceNumber: 1,
            name: "Test Race",
            raceTime: "2024-01-01T01:00:00.000Z",
            distance: 520,
            grade: "5",
            resultStatus: "posted",
            replayUrl: withMedia ? "https://example.invalid/replay/1" : undefined,
            videoSourceId: withMedia ? "video-1" : undefined,
            photoFinishUrl: withMedia ? "https://example.invalid/photo/1.jpg" : undefined,
            runners: [
              {
                sourceId: "dog:1:box:1",
                boxNumber: 1,
                dog: { name: "Synthetic Dog", earBrand: "thedogs:1" },
                trainerName: "Synthetic Trainer",
                weight: 30,
                scratched: false,
                finishingPosition: 1,
                runningTime: 29.9,
                margin: 0,
                prizeMoneyWon: 100,
                sectionals: [5.1],
              },
            ],
          },
        ],
      },
    ],
  };
}

function readDataset(
  outputDir: string,
  manifest: Awaited<ReturnType<typeof runNormalizedHarvest>>["manifest"],
  dataset: keyof typeof manifest.datasets,
) {
  return manifest.partitions.flatMap((partition) => {
    const output = partition.outputs.find((item) => item.dataset === dataset);
    assert.ok(output, `missing ${dataset} shard metadata`);
    const text = readFileSync(join(outputDir, partition.directory, output.file), "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  });
}

function writeJson(filePath: string, value: unknown) {
  writeText(filePath, JSON.stringify(value));
}

function writeText(filePath: string, value: string) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}
