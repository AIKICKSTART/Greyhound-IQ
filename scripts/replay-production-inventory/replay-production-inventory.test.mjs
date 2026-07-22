import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import {
  CUTOFF,
  DATABASE_NAME,
  INVENTORY_SCHEMA,
  assertSafeContainerInspect,
  calculateDiskProjection,
} from "./lib.mjs";
import { verifyInventoryRun } from "./verify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function row({ id, expectedRaceCount = 2, withVideo = false }) {
  const generatedAt = "2026-07-22T00:00:00.000Z";
  const video = {
    id: `video-${id}`,
    raceId: id,
    sourceProvider: "thedogs",
    sourceId: `source-${id}`,
    kind: "replay",
    pageUrl: `https://www.thedogs.com.au/videos/watch/races/${id}/replay`,
    streamUrl: `https://mediatdogs.skyracing.com.au/${id}.mp4?Expires=1`,
    sourceStatus: 200,
    sourceCode: "provider-video-id",
    playbackStatus: "unverified",
    licensingStatus: "license_gated",
    fieldCoherenceVerified: false,
    fetchedRank: 1,
    runtimeLoaded: true,
    runtimePrimary: true,
    sourceIdentityRaceCount: 1,
    pageUrlRaceCount: 1,
    streamUrlRaceCount: 1,
    streamResourceRaceCount: 1,
    directStreamShape: true,
    embedShape: false,
    providerResolvableShape: true,
    providerStateMismatch: false,
    possibleSignedExpiryQuery: true,
    thedogsLicenceGate: true,
    syntheticIngest: true,
    staleByAge: false,
    syntheticOrStale: true,
    sourceRawJsonBytes: 5,
    sourceRawJsonSha256: "a".repeat(64),
  };
  return {
    inventory: {
      schema: INVENTORY_SCHEMA,
      version: 1,
      generatedAt,
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
      raceNumber: 1,
      raceTime: generatedAt,
      distance: 500,
      replayUrl: withVideo ? video.pageUrl : null,
      sourceRawJsonBytes: 0,
      sourceRawJsonSha256: null,
    },
    meeting: { id: "meeting-1", meetingDate: generatedAt },
    track: { id: "track-1", name: "Test Track", state: "NSW" },
    runners: withVideo ? [{
      id: `runner-${id}`,
      raceId: id,
      dog: { id: `dog-${id}`, name: "Test Dog" },
      trainer: null,
      result: {
        id: `result-${id}`,
        runnerId: `runner-${id}`,
        raceId: id,
        gpsDataBytes: 0,
        gpsDataSha256: null,
        sourceRawJsonBytes: 0,
        sourceRawJsonSha256: null,
      },
      sourceRawJsonBytes: 0,
      sourceRawJsonSha256: null,
    }] : [],
    videos: withVideo ? [video] : [],
    videoCandidateCount: withVideo ? 1 : 0,
    runtimeTruncationRisk: false,
    flags: {
      resultRaceMismatch: false,
      sourceIdentityCollision: false,
      pageUrlCollision: false,
      streamUrlCollision: false,
      streamResourceCollision: false,
      legacyTheDogsConflict: false,
      providerStateMismatch: false,
      possibleSignedExpiryQuery: withVideo,
      thedogsLicenceGate: withVideo,
      syntheticOrStale: withVideo,
      identityConflict: false,
    },
    playbackStatus: "unverified",
    classification: withVideo
      ? "license_gated_unverified"
      : "provider_discovery_unverified",
  };
}

async function makeRun(rows) {
  const root = await mkdtemp(resolve(tmpdir(), "giq-replay-inventory-"));
  const partial = resolve(root, "run.partial");
  await mkdir(partial);
  const context = {
    database: DATABASE_NAME,
    cutoff: CUTOFF,
    container: { networkMode: "none", publishedPorts: 0 },
    preflight: {
      database: DATABASE_NAME,
      readOnly: true,
      isolation: "repeatable read",
      unixSocket: true,
      sessionUser: "postgres",
      pgcrypto: true,
    },
    rawLedgerContainsRestrictedUrls: true,
    playbackVerified: false,
  };
  await writeFile(resolve(partial, "export-context.json"), JSON.stringify(context));
  const jsonl = `${rows.map((item) => JSON.stringify(item)).join("\n")}\n`;
  await writeFile(
    resolve(partial, "race-replay-inventory.restricted.jsonl.gz"),
    gzipSync(jsonl)
  );
  return { root, partial };
}

test("container inspection accepts only an exact offline container with no ports", () => {
  const safe = {
    Id: "container-id",
    Name: "/replay-copy",
    State: { Running: true },
    Config: { Image: "postgres:16" },
    HostConfig: { NetworkMode: "none", PortBindings: {} },
    NetworkSettings: { Ports: { "5432/tcp": null } },
  };
  assert.equal(assertSafeContainerInspect(safe, "replay-copy").networkMode, "none");
  assert.throws(
    () => assertSafeContainerInspect({ ...safe, HostConfig: { ...safe.HostConfig, NetworkMode: "bridge" } }, "replay-copy"),
    /NetworkMode/
  );
  assert.throws(
    () => assertSafeContainerInspect({ ...safe, NetworkSettings: { Ports: { "5432/tcp": [{ HostPort: "5432" }] } } }, "replay-copy"),
    /published ports/
  );
});

test("disk projection is conservative and rejects missing projections", () => {
  const projection = calculateDiskProjection({
    sourceTableBytes: 10_000,
    raceCount: 10,
    runnerCount: 20,
    videoCount: 2,
  });
  assert.equal(projection.projectedArtifactBytes, 90_112);
  assert.ok(projection.requiredFreeBytes > projection.projectedArtifactBytes);
  assert.throws(
    () => calculateDiskProjection({ sourceTableBytes: 0, raceCount: 10, runnerCount: 20, videoCount: 2 }),
    /projection/
  );
});

test("streaming verification writes URL-free reports and atomically finalizes", async () => {
  const run = await makeRun([
    row({ id: "race-1", withVideo: true }),
    row({ id: "race-2", withVideo: false }),
  ]);
  try {
    const result = await verifyInventoryRun(run.partial, { finalize: true });
    assert.equal(result.manifest.lineCount, 2);
    assert.equal(result.manifest.uniqueRaceIds, 2);
    assert.equal(result.manifest.playbackVerified, false);
    assert.equal(result.directory.endsWith(".partial"), false);
    const aggregates = await readFile(resolve(result.directory, "replay-aggregates.json"), "utf8");
    const manifest = await readFile(resolve(result.directory, "manifest.json"), "utf8");
    assert.doesNotMatch(aggregates, /https?:\/\//i);
    assert.doesNotMatch(manifest, /https?:\/\//i);
    assert.equal(JSON.parse(aggregates).overall.races, 2);
    assert.equal(JSON.parse(aggregates).overall.storedCandidateCoveragePercent, 50);
    assert.equal(JSON.parse(aggregates).overall.verifiedPlaybackCoveragePercent, null);
  } finally {
    await rm(run.root, { recursive: true, force: true });
  }
});

test("streaming verification rejects a duplicate canonical race ID", async () => {
  const run = await makeRun([
    row({ id: "race-1" }),
    row({ id: "race-1" }),
  ]);
  try {
    await assert.rejects(() => verifyInventoryRun(run.partial), /duplicates canonical race ID/);
  } finally {
    await rm(run.root, { recursive: true, force: true });
  }
});

test("inventory SQL is one read-only COPY projection with fixed safety literals", async () => {
  const sql = await readFile(resolve(HERE, "inventory.sql"), "utf8");
  assert.match(sql, /^COPY \(/);
  assert.match(sql, /current_setting\('transaction_read_only'\) = 'on'/);
  assert.match(sql, /current_setting\('transaction_isolation'\) = 'repeatable read'/);
  assert.match(sql, /inet_server_addr\(\) IS NULL/);
  assert.match(sql, /session_user = 'postgres'/);
  assert.match(sql, /TIMESTAMP '2006-01-01 00:00:00'/);
  assert.match(sql, /extname = 'pgcrypto'/);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO)\b/i);
  assert.match(sql, /runner_aggregates AS \([\s\S]*GROUP BY ru\."raceId"/);
  assert.match(sql, /video_aggregates AS \([\s\S]*GROUP BY ve\."raceId"/);
  assert.equal(sql.match(/FROM "Runner" ru/g)?.length, 1);
  assert.equal(sql.match(/FROM video_enriched ve/g)?.length, 1);
  assert.equal(sql.match(/JOIN "Race" r_scope/g)?.length, 2);
  assert.equal(sql.match(/TIMESTAMP '2006-01-01 00:00:00'/g)?.length, 4);
  assert.doesNotMatch(sql, /\brace_scope AS\s*\(/);
  assert.doesNotMatch(sql, /JOIN race_scope/);
  assert.doesNotMatch(sql, /\bLATERAL\b/i);
  assert.doesNotMatch(sql, /ORDER BY\s+inventory_row/i);
  assert.match(sql, /SELECT inventory_row::text\s+FROM race_rows\s+ORDER BY race_id\s+\) TO STDOUT WITH \(\s+FORMAT csv,\s+DELIMITER E'\\x02',\s+QUOTE E'\\x01',\s+ESCAPE E'\\x01'\s+\);/);
});

test("control-byte CSV preserves JSONL where default text COPY escapes it", async () => {
  const sql = await readFile(resolve(HERE, "inventory.sql"), "utf8");
  const rawJson = JSON.stringify({
    quote: '"', comma: "a,b", backslash: "a\\b", tab: "a\tb",
    newline: "a\nb", controls: "\u0001\u0002\u0003",
  });
  const defaultTextCopy = rawJson.replaceAll("\\", "\\\\");

  assert.deepEqual(JSON.parse(rawJson), {
    quote: '"', comma: "a,b", backslash: "a\\b", tab: "a\tb",
    newline: "a\nb", controls: "\u0001\u0002\u0003",
  });
  assert.throws(() => JSON.parse(defaultTextCopy));
  assert.equal(rawJson.includes("\u0001"), false);
  assert.equal(rawJson.includes("\u0002"), false);
  assert.match(sql, /TO STDOUT WITH \(\s+FORMAT csv,\s+DELIMITER E'\\x02',\s+QUOTE E'\\x01',\s+ESCAPE E'\\x01'\s+\);/);
});

test("Docker psql execution keeps stdin attached for the audited SQL", async () => {
  const source = await readFile(resolve(HERE, "export.mjs"), "utf8");
  assert.match(source, /"exec",\s*\n\s*"--interactive",/);
  assert.match(source, /-cwork_mem=64MB/);
  assert.match(source, /"env",\s*\n\s*"--unset=PGSERVICE",\s*\n\s*"psql",/);
  assert.doesNotMatch(source, /"PGSERVICE="/);
});
