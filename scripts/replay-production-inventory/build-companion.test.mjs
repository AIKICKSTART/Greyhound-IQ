import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { buildCompanion } from "./build-companion.mjs";
import {
  CUTOFF,
  DATABASE_NAME,
  INVENTORY_SCHEMA,
} from "./lib.mjs";
import { verifyInventoryRun } from "./verify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATED_AT = "2026-02-15T00:00:00.000Z";

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function replayVideo(id, provider, classification) {
  const embedShape = classification === "structurally_resolvable_unverified";
  return {
    id: `video-${id}`,
    raceId: id,
    sourceProvider: provider,
    sourceId: `source-${id}`,
    kind: "replay",
    pageUrl: `https://provider.example/replay/${id}`,
    streamUrl: `https://player.example/video/${id}`,
    sourceStatus: 200,
    sourceCode: null,
    playbackStatus: "unverified",
    licensingStatus: "unverified",
    fieldCoherenceVerified: false,
    fetchedRank: 1,
    runtimeLoaded: true,
    runtimePrimary: true,
    sourceIdentityRaceCount: 1,
    pageUrlRaceCount: 1,
    streamUrlRaceCount: 1,
    streamResourceRaceCount: 1,
    directStreamShape: false,
    embedShape,
    providerResolvableShape: !embedShape,
    providerStateMismatch: false,
    possibleSignedExpiryQuery: false,
    thedogsLicenceGate: false,
    syntheticIngest: false,
    staleByAge: false,
    syntheticOrStale: false,
    sourceRawJsonBytes: 0,
    sourceRawJsonSha256: null,
  };
}

function row({
  id,
  raceTime,
  meetingDate = raceTime,
  state,
  provider,
  legacyUrl,
  classification,
  expectedRaceCount,
}) {
  const video = replayVideo(id, provider, classification);
  const runnerId = `runner-${id}`;
  return {
    inventory: {
      schema: INVENTORY_SCHEMA,
      version: 1,
      generatedAt: GENERATED_AT,
      snapshotId: "100:100:",
      database: DATABASE_NAME,
      cutoff: CUTOFF,
      expectedRaceCount,
      runtimeCandidateLimit: 16,
      staleAfterSeconds: 2_592_000,
      playbackVerified: false,
    },
    race: {
      id,
      meetingId: `meeting-${id}`,
      raceNumber: 1,
      name: "Fixture race",
      raceTime,
      distance: 500,
      grade: "5",
      replayUrl: legacyUrl,
      photoFinishUrl: null,
      sourceProvider: provider,
      sourceId: `race-source-${id}`,
      sourceRawJsonBytes: 0,
      sourceRawJsonSha256: null,
    },
    meeting: {
      id: `meeting-${id}`,
      trackId: `track-${id}`,
      meetingDate,
      sourceProvider: provider,
      sourceId: `meeting-source-${id}`,
    },
    track: { id: `track-${id}`, name: `Track ${id}`, state },
    runners: [{
      id: runnerId,
      raceId: id,
      dog: { id: `dog-${id}`, name: "Fixture Dog" },
      trainer: { id: `trainer-${id}`, name: "Fixture Trainer" },
      result: {
        id: `result-${id}`,
        runnerId,
        raceId: id,
        finishingPosition: 1,
        gpsDataBytes: 0,
        gpsDataSha256: null,
        sourceRawJsonBytes: 0,
        sourceRawJsonSha256: null,
      },
      sourceRawJsonBytes: 0,
      sourceRawJsonSha256: null,
    }],
    videos: [video],
    videoCandidateCount: 1,
    runtimeTruncationRisk: false,
    flags: {
      resultRaceMismatch: false,
      sourceIdentityCollision: false,
      pageUrlCollision: false,
      streamUrlCollision: false,
      streamResourceCollision: false,
      legacyTheDogsConflict: false,
      providerStateMismatch: false,
      possibleSignedExpiryQuery: false,
      thedogsLicenceGate: false,
      syntheticOrStale: false,
      identityConflict: false,
    },
    playbackStatus: "unverified",
    classification,
  };
}

function fixtureRows() {
  const rows = [
    row({
      id: "race-2006",
      raceTime: "2006-01-02T03:04:05",
      state: "VIC",
      provider: "WatchDog",
      legacyUrl: "https://Video.Example/replay/one",
      classification: "structurally_resolvable_unverified",
      expectedRaceCount: 3,
    }),
    row({
      id: "race-current",
      raceTime: "2026-02-14T23:30:00",
      state: "QLD",
      provider: "racing-queensland",
      legacyUrl: "/relative/replay/two",
      classification: "provider_resolvable_unverified",
      expectedRaceCount: 3,
    }),
    row({
      id: "race-future",
      raceTime: "2026-02-15T00:30:00",
      state: "WA",
      provider: "greyhoundswa",
      legacyUrl: "https://future.example/replay/three",
      classification: "provider_resolvable_unverified",
      expectedRaceCount: 3,
    }),
  ];
  return rows;
}

async function makeFixture() {
  const root = await mkdtemp(resolve(tmpdir(), "giq-replay-companion-"));
  const partial = resolve(root, "inventory.partial");
  await mkdir(partial);
  const rows = fixtureRows();
  const sqlSha256 = await sha256File(resolve(HERE, "inventory.sql"));
  const context = {
    schema: "greyhoundiq.replay-production-inventory.export-context",
    version: 1,
    database: DATABASE_NAME,
    cutoff: CUTOFF,
    container: {
      id: "fixture-container-id",
      name: "fixture-container",
      image: "postgres:16",
      networkMode: "none",
      publishedPorts: 0,
    },
    preflight: {
      database: DATABASE_NAME,
      readOnly: true,
      isolation: "repeatable read",
      unixSocket: true,
      sessionUser: "postgres",
      pgcrypto: true,
      raceCount: rows.length,
      runnerCount: rows.reduce((count, item) => count + item.runners.length, 0),
      videoCount: rows.reduce((count, item) => count + item.videos.length, 0),
    },
    querySha256: sqlSha256,
    rawLedgerContainsRestrictedUrls: true,
    playbackVerified: false,
  };
  await writeFile(resolve(partial, "export-context.json"), JSON.stringify(context));
  await writeFile(
    resolve(partial, "race-replay-inventory.restricted.jsonl.gz"),
    gzipSync(`${rows.map((item) => JSON.stringify(item)).join("\n")}\n`)
  );
  const verified = await verifyInventoryRun(partial, { finalize: true });
  const sourceDump = resolve(root, "source.dump");
  const recoveryEvidence = resolve(root, "source-verification.tsv");
  await writeFile(sourceDump, "fixture source dump\n");
  await writeFile(
    recoveryEvidence,
    "recovery_point_utc|2026-07-21T23:36:00Z\ncount|Race|841425\n"
  );
  return {
    root,
    inventory: verified.directory,
    options: {
      inventory: verified.directory,
      output: resolve(root, "companion"),
      sourceDump,
      sourceDumpSha256: await sha256File(sourceDump),
      recoveryEvidence,
    },
  };
}

test("companion streams a finalized ledger into zero-filled, URL-free coverage", async () => {
  const fixture = await makeFixture();
  try {
    const result = await buildCompanion(fixture.options);
    assert.equal(result.directory, fixture.options.output);
    await assert.doesNotReject(() => lstat(result.directory));
    await assert.rejects(() => lstat(`${result.directory}.partial`), /ENOENT/);

    const coverageText = await readFile(
      resolve(result.directory, "replay-month-coverage.json"),
      "utf8"
    );
    const coverage = JSON.parse(coverageText);
    assert.doesNotMatch(coverageText, /https?:\/\//i);
    assert.equal(coverage.months.length, 242);
    assert.equal(coverage.years.length, 21);
    assert.equal(coverage.overall.races, 2);
    assert.equal(coverage.scope.excludedFutureScheduledRows, 1);
    assert.equal(coverage.months.find((item) => item.month === "2006-02").races, 0);
    assert.equal(
      coverage.months.find((item) => item.month === "2006-02").storedEvidenceCoveragePercent,
      null
    );
    assert.ok(coverage.jurisdictions.every((item) => item.months.length === 242));
    assert.ok(coverage.tracks.every((item) => item.months.length === 242));
    assert.ok(coverage.raceVideoProviders.every((item) => item.months.length === 242));
    assert.ok(coverage.legacyReplayHosts.every((item) => item.months.length === 242));
    assert.equal(
      coverage.raceVideoProviders[0].months.find((item) => item.month === "2006-02")
        .candidateRaceSharePercent,
      null
    );
    assert.deepEqual(
      coverage.raceVideoProviders.map((item) => item.provider),
      ["racing-queensland", "watchdog"]
    );
    assert.deepEqual(
      coverage.legacyReplayHosts.map((item) => item.host),
      ["(invalid-or-relative)", "video.example"]
    );
    assert.equal(coverage.raceVideoProviders.some((item) => item.provider === "greyhoundswa"), false);

    const scope = JSON.parse(await readFile(resolve(result.directory, "scope-evidence.json"), "utf8"));
    assert.equal(scope.playbackVerified, false);
    assert.equal(scope.rawLedgerRestricted, true);
    assert.equal(scope.rowTotals.source.races, 3);
    assert.equal(scope.rowTotals.effectiveHistorical.races, 2);
    assert.equal(scope.rowTotals.excludedFutureScheduledRows, 1);
    assert.equal(scope.reconciliation.preflightRunnerCountMatchesEmbeddedRows, true);
    assert.equal(scope.recoveryEvidence.googlePitrRecoveryPointUtc, "2026-07-21T23:36:00Z");
    assert.match(
      scope.recoveryEvidence.googlePitrRecoveryPointAustraliaSydney,
      /^2026-07-22 09:36:00 AEST$/
    );
    assert.equal(scope.snapshot.effectiveUpperCutoff, GENERATED_AT);

    const sums = await readFile(resolve(result.directory, "SHA256SUMS"), "utf8");
    assert.equal(sums.trim().split("\n").length, 3);
    assert.match(sums, /companion-manifest\.json/);
    assert.match(sums, /replay-month-coverage\.json/);
    assert.match(sums, /scope-evidence\.json/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("companion rejects an upstream ledger hash mismatch", async () => {
  const fixture = await makeFixture();
  try {
    const manifestPath = resolve(fixture.inventory, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.files["race-replay-inventory.restricted.jsonl.gz"].sha256 = "0".repeat(64);
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(
      () => buildCompanion(fixture.options),
      /Streaming ledger header\/count\/hash reconciliation failed/
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("companion refuses an active partial inventory", async () => {
  const fixture = await makeFixture();
  try {
    await assert.rejects(
      () => buildCompanion({ ...fixture.options, inventory: `${fixture.inventory}.partial` }),
      /finalized inventory, never \.partial/
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
