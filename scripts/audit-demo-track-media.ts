import "./load-env";

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { prisma } from "../src/lib/db";
import { getActiveTracks } from "../src/lib/queries";
import { trackMediaPathForName } from "../src/lib/track-media";

const DEFAULT_BASE_URL = "https://greyhound-iq-five.vercel.app";

type CheckResult = {
  id: string;
  name: string;
  mediaPath: string;
  detailStatus: number | null;
  detailHasImage: boolean;
  passed: boolean;
  error: string | null;
};

type AssetCheck = {
  mediaPath: string;
  status: number | null;
  passed: boolean;
  error: string | null;
};

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function fetchWithTimeout(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": "GreyhoundIQ-Track-Media-Audit/1.0" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const baseUrl = (readFlag("--base-url") ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const outputDirectory = path.resolve(
    readFlag("--output") ?? "output/demo-track-media-audit"
  );
  const activeTracks = await getActiveTracks();
  const assetDirectories = await readdir(
    path.resolve("public/images/tracks"),
    { withFileTypes: true }
  );
  const canonicalMediaPaths = assetDirectories
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/images/tracks/${entry.name}/master.webp`)
    .sort();
  const tracks = activeTracks.map((track) => ({
    id: track.id,
    name: track.name,
    mediaPath: trackMediaPathForName(track.name),
  }));
  const missingMappings = tracks.filter((track) => !track.mediaPath);
  const uniqueMediaPaths = new Set(
    tracks.flatMap((track) => (track.mediaPath ? [track.mediaPath] : []))
  );

  if (tracks.length < 45) {
    throw new Error(`Expected at least 45 active track records, found ${tracks.length}.`);
  }
  if (missingMappings.length > 0) {
    throw new Error(
      `Missing track media mappings: ${missingMappings
        .map((track) => track.name)
        .join(", ")}`
    );
  }
  if (canonicalMediaPaths.length !== 45) {
    throw new Error(
      `Expected 45 canonical track masters, found ${canonicalMediaPaths.length}.`
    );
  }

  const tracksPage = await fetchWithTimeout(new URL("/tracks", baseUrl));
  const tracksPageBody = await tracksPage.text();
  const results = new Array<CheckResult>(tracks.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < tracks.length) {
      const index = nextIndex++;
      const track = tracks[index];
      const mediaPath = track.mediaPath!;
      try {
        const detailResponse = await fetchWithTimeout(
          new URL(`/tracks/${track.id}`, baseUrl)
        );
        const detailBody = await detailResponse.text();
        const detailHasImage =
          detailBody.includes(mediaPath) ||
          detailBody.includes(encodeURIComponent(mediaPath));
        const passed =
          detailResponse.status === 200 &&
          detailResponse.headers.get("x-greyhoundiq-demo") ===
            "full-access-read-only" &&
          detailHasImage;
        results[index] = {
          id: track.id,
          name: track.name,
          mediaPath,
          detailStatus: detailResponse.status,
          detailHasImage,
          passed,
          error: null,
        };
      } catch (error) {
        results[index] = {
          id: track.id,
          name: track.name,
          mediaPath,
          detailStatus: null,
          detailHasImage: false,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      completed += 1;
      const result = results[index];
      console.log(
        `[${String(completed).padStart(2, "0")}/${tracks.length}] ${
          result.passed ? "PASS" : "FAIL"
        } ${track.name}`
      );
    }
  }

  await Promise.all([worker(), worker()]);

  const assetResults = new Array<AssetCheck>(canonicalMediaPaths.length);
  let nextAssetIndex = 0;
  async function assetWorker() {
    while (nextAssetIndex < canonicalMediaPaths.length) {
      const index = nextAssetIndex++;
      const mediaPath = canonicalMediaPaths[index];
      try {
        const response = await fetchWithTimeout(new URL(mediaPath, baseUrl));
        assetResults[index] = {
          mediaPath,
          status: response.status,
          passed: response.status === 200,
          error: null,
        };
      } catch (error) {
        assetResults[index] = {
          mediaPath,
          status: null,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }
  await Promise.all([assetWorker(), assetWorker(), assetWorker(), assetWorker()]);

  const tracksPageHasAllMedia = [...uniqueMediaPaths].every(
    (mediaPath) =>
      tracksPageBody.includes(mediaPath) ||
      tracksPageBody.includes(encodeURIComponent(mediaPath))
  );
  const passed = results.filter((result) => result.passed).length;
  const assetsPassed = assetResults.filter((result) => result.passed).length;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseUrl,
    activeTrackRecords: tracks.length,
    activeCourseMasters: uniqueMediaPaths.size,
    canonicalMasters: canonicalMediaPaths.length,
    tracksPageStatus: tracksPage.status,
    tracksPageHasAllMedia,
    passed,
    failed: results.length - passed,
    results,
    assetsPassed,
    assetsFailed: assetResults.length - assetsPassed,
    assetResults,
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  console.log(`Report: ${path.join(outputDirectory, "latest.json")}`);

  if (
    tracksPage.status !== 200 ||
    !tracksPageHasAllMedia ||
    passed !== results.length ||
    assetsPassed !== assetResults.length
  ) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
