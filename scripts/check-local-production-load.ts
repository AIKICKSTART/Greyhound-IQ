import {
  spawn,
  spawnSync,
  type ChildProcessByStdio,
} from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Readable } from "node:stream";

import { loadEnvConfig } from "@next/env";

import {
  fingerprintRepositoryFiles,
  getDesignLabSourceFingerprint,
  getRepositoryHeadSha,
  type DesignLabSourceFingerprint,
} from "./design-lab-source-fingerprint";
import {
  resolveStagingLoadProfile,
  stableJson,
  stagingLoadConfigDigest,
  stagingLoadThresholdFindings,
  summarizeStagingLoad,
  type StagingLoadProfile,
  type StagingLoadSample,
} from "./staging-load-evidence";

export const LOCAL_PRODUCTION_LOAD_PROFILE_NAMES = [
  "baseline",
  "ramp",
  "spike-3x",
  "spike-10x",
  "soak",
] as const;
export const LOCAL_PRODUCTION_LOAD_SCOPE = {
  evidenceClass: "local-production-mode-simulation",
  managedCloudEligible: false,
  satisfiesManagedStagingGate: false,
  proves: [
    "the copied working-tree candidate completes next build",
    "the immutable candidate starts through next start on literal loopback",
    "fixed baseline, ramp, 3x, 10x and brief-soak public-route profiles execute",
  ],
  doesNotProve: [
    "managed staging or production",
    "authenticated, mutation, realtime, media or pool-saturation lanes",
    "CDN, WAF, bot management, DDoS absorption, load balancing or autoscaling",
    "provider quotas, regional capacity or one-zone-loss capacity",
  ],
} as const;

type LocalProductionLoadProfileName =
  (typeof LOCAL_PRODUCTION_LOAD_PROFILE_NAMES)[number];

type RouteProbe = Readonly<{
  label: string;
  path: string;
  expectedStatus: 200;
}>;

type BuildFingerprint = Readonly<{
  schemaVersion: 1;
  sha256: string;
  entryCount: number;
}>;

type OwnedProductionServer = ChildProcessByStdio<null, Readable, Readable>;

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_LOAD_PORT = 3_107;
const LOCAL_LOAD_HOST = "127.0.0.1";
const REQUEST_TIMEOUT_MS = 60_000;
const OUTPUT_DIRECTORY = join(
  REPOSITORY_ROOT,
  "output",
  "production-readiness",
  "local-load",
);
const CANDIDATE_DIRECTORIES = [
  "config",
  "docs",
  "infra",
  "prisma",
  "public",
  "scripts",
  "security",
  "src",
] as const;
const CANDIDATE_FILES = [
  ".dockerignore",
  ".spectral.yaml",
  "AGENTS.md",
  "Dockerfile",
  "components.json",
  "docker-compose.design-lab-db.yml",
  "docker-compose.local-db.yml",
  "next-env.d.ts",
  "next.config.ts",
  "openapi.json",
  "output/demo-route-audit/latest.json",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "prisma.config.ts",
  "tsconfig.json",
] as const;
const CONTROL_FILES = [
  "next.config.ts",
  "output/demo-route-audit/latest.json",
  "scripts/check-local-production-load.test.ts",
  "scripts/check-local-production-load.ts",
  "scripts/design-lab-source-fingerprint.ts",
  "scripts/http-method-boundary.cjs",
  "scripts/staging-load-evidence.ts",
] as const;
const ROUTES: readonly RouteProbe[] = [
  { label: "ready", path: "/api/health/ready", expectedStatus: 200 },
  { label: "feed-health", path: "/api/health/feeds", expectedStatus: 200 },
  {
    label: "marketplace-api",
    path: "/api/listings?limit=20",
    expectedStatus: 200,
  },
  { label: "marketplace-page", path: "/marketplace", expectedStatus: 200 },
  { label: "feed-page", path: "/feed", expectedStatus: 200 },
] as const;
const BUILD_FINGERPRINT_EXCLUSIONS = new Set([
  "cache",
  "diagnostics",
  "trace",
]);

export function resolveLocalProductionLoadPort(value: string | undefined) {
  if (value === undefined || value.trim() === "") return LOCAL_LOAD_PORT;
  if (value.trim() !== String(LOCAL_LOAD_PORT)) {
    throw new Error(
      `LOCAL_PRODUCTION_LOAD_PORT is pinned to unused loopback port ${LOCAL_LOAD_PORT}.`,
    );
  }
  return LOCAL_LOAD_PORT;
}

export function resolveLocalProductionLoadProfiles(
  values: readonly string[] = LOCAL_PRODUCTION_LOAD_PROFILE_NAMES,
) {
  const profiles = values.map((value) => value.trim());
  if (new Set(profiles).size !== profiles.length) {
    throw new Error("Local production load profiles may not contain duplicates.");
  }
  for (const profile of profiles) {
    if (
      !LOCAL_PRODUCTION_LOAD_PROFILE_NAMES.includes(
        profile as LocalProductionLoadProfileName,
      )
    ) {
      throw new Error(
        `Local production load profile must be one of ${LOCAL_PRODUCTION_LOAD_PROFILE_NAMES.join(
          ", ",
        )}.`,
      );
    }
  }
  if (profiles.length !== LOCAL_PRODUCTION_LOAD_PROFILE_NAMES.length) {
    throw new Error("Local production load evidence requires all five fixed profiles.");
  }
  return profiles as LocalProductionLoadProfileName[];
}

export function localProductionLoadFindings(
  profile: StagingLoadProfile,
  samples: readonly StagingLoadSample[],
) {
  return stagingLoadThresholdFindings(
    profile,
    summarizeStagingLoad(samples).overall,
  );
}

export function fingerprintBuildOutput(nextDirectory: string): BuildFingerprint {
  const canonicalRoot = realpathSync(nextDirectory);
  const entries = collectBuildEntries(canonicalRoot, canonicalRoot);
  const hash = createHash("sha256");
  hash.update("greyhoundiq-local-production-build-v1\0");
  for (const entry of entries) {
    const absolutePath = resolve(canonicalRoot, entry);
    const stat = lstatSync(absolutePath);
    hash.update(entry);
    hash.update("\0");
    if (stat.isSymbolicLink()) {
      hash.update("link\0");
      hash.update(readlinkSync(absolutePath));
    } else {
      const bytes = readFileSync(absolutePath);
      hash.update("file\0");
      hash.update(String(bytes.byteLength));
      hash.update("\0");
      hash.update(bytes);
    }
    hash.update("\0");
  }
  return {
    schemaVersion: 1,
    sha256: hash.digest("hex"),
    entryCount: entries.length,
  };
}

export async function runLocalProductionLoad(root = REPOSITORY_ROOT) {
  const port = resolveLocalProductionLoadPort(
    process.env.LOCAL_PRODUCTION_LOAD_PORT,
  );
  const origin = `http://${LOCAL_LOAD_HOST}:${port}`;
  const profiles = resolveLocalProductionLoadProfiles();
  await assertPortAvailable(port);
  loadEnvConfig(root);

  const repositorySourceBefore = getDesignLabSourceFingerprint(root);
  const testedCommitSha = getRepositoryHeadSha(root);
  const controls = fingerprintRepositoryFiles(root, CONTROL_FILES);
  const temporaryRoot = createOwnedTemporaryDirectory(root);
  let server: OwnedProductionServer | null = null;
  let serverOutput = "";

  try {
    copyCandidate(root, temporaryRoot);
    const repositorySourceAfterCopy = getDesignLabSourceFingerprint(root);
    assertSourceFingerprintEqual(
      repositorySourceBefore,
      repositorySourceAfterCopy,
      "Repository source changed while the production candidate was copied.",
    );
    const candidateSource = getDesignLabSourceFingerprint(temporaryRoot);
    assertSourceFingerprintEqual(
      repositorySourceBefore,
      candidateSource,
      "The isolated production candidate does not match the copied source.",
    );

    symlinkSync(
      resolve(root, "node_modules"),
      resolve(temporaryRoot, "node_modules"),
      "junction",
    );
    const runtimeEnvironment = localRuntimeEnvironment(origin);
    const buildStartedAt = Date.now();
    const build = spawnSync(
      process.execPath,
      [
        resolve(temporaryRoot, "node_modules/next/dist/bin/next"),
        "build",
        "--webpack",
      ],
      {
        cwd: temporaryRoot,
        env: runtimeEnvironment,
        encoding: "utf8",
        windowsHide: true,
        timeout: 20 * 60_000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    if (build.error || build.status !== 0) {
      throw new Error(
        `Isolated next build failed. ${summarizeChildOutput(
          `${build.stdout ?? ""}\n${build.stderr ?? ""}`,
        )}`,
      );
    }
    const buildDurationMilliseconds = Date.now() - buildStartedAt;
    const nextDirectory = resolve(temporaryRoot, ".next");
    const buildFingerprintBeforeLoad = fingerprintBuildOutput(nextDirectory);
    const buildId = readFileSync(resolve(nextDirectory, "BUILD_ID"), "utf8").trim();
    if (!buildId) throw new Error("Isolated next build produced no BUILD_ID.");

    const startedServer = spawn(
      process.execPath,
      [
        "--require",
        resolve(temporaryRoot, "scripts/http-method-boundary.cjs"),
        resolve(temporaryRoot, "node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        LOCAL_LOAD_HOST,
        "--port",
        String(port),
      ],
      {
        cwd: temporaryRoot,
        env: runtimeEnvironment,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    server = startedServer;
    const appendServerOutput = (value: Buffer) => {
      serverOutput = `${serverOutput}${value.toString("utf8")}`.slice(-65_536);
    };
    startedServer.stdout.on("data", appendServerOutput);
    startedServer.stderr.on("data", appendServerOutput);
    await waitForProductionServer(startedServer, origin);
    await warmRoutes(origin);

    const profileReports = [];
    const allFindings: string[] = [];
    const loadStartedAt = Date.now();
    for (const profileName of profiles) {
      const profile = resolveStagingLoadProfile(profileName);
      const samples: StagingLoadSample[] = [];
      const profileStartedAt = Date.now();
      for (const stage of profile.stages) {
        const stageSamples = await runPool(
          ROUTES.flatMap((route) =>
            Array.from({ length: stage.iterations }, () => route),
          ),
          stage.concurrency,
          origin,
        );
        samples.push(
          ...stageSamples.map((sample) => ({
            ...sample,
            label: `${stage.name} / ${sample.label}`,
          })),
        );
      }
      const summary = summarizeStagingLoad(samples);
      const findings = localProductionLoadFindings(profile, samples);
      allFindings.push(
        ...findings.map((finding) => `${profileName}: ${finding}`),
      );
      profileReports.push({
        profile: profileName,
        stages: profile.stages,
        durationMilliseconds: Date.now() - profileStartedAt,
        summary,
        thresholds: profile.thresholds,
        findings,
      });
    }
    const loadDurationMilliseconds = Date.now() - loadStartedAt;

    await stopOwnedServer(startedServer);
    server = null;
    const buildFingerprintAfterLoad = fingerprintBuildOutput(nextDirectory);
    if (
      JSON.stringify(buildFingerprintBeforeLoad) !==
      JSON.stringify(buildFingerprintAfterLoad)
    ) {
      allFindings.push("Production build output changed during the load run.");
    }

    const generatedAt = new Date().toISOString();
    const configuration = {
      profiles: profiles.map((profile) => resolveStagingLoadProfile(profile)),
      buildEngine: "webpack",
      routes: ROUTES,
      requestTimeoutMilliseconds: REQUEST_TIMEOUT_MS,
      target: {
        protocol: "http",
        host: LOCAL_LOAD_HOST,
        port,
        database: {
          host: "127.0.0.1",
          port: 55_735,
          name: "greyhoundiq",
          role: "greyhoundiq_runtime",
        },
      },
    };
    const evidence = {
      schemaVersion: 1,
      auditKind: "local-production-mode-load-evidence",
      status: allFindings.length === 0 ? "passed" : "failed",
      generatedAt,
      scope: LOCAL_PRODUCTION_LOAD_SCOPE,
      sourceBinding: {
        testedCommitSha,
        workingTreeSource: repositorySourceBefore,
        controlSha256: controls.sha256,
        controlFileCount: controls.fileCount,
        buildId,
        buildFingerprintBeforeLoad,
        buildFingerprintAfterLoad,
      },
      configuration: {
        ...configuration,
        configDigest: stagingLoadConfigDigest(configuration),
      },
      measurements: {
        buildDurationMilliseconds,
        loadDurationMilliseconds,
        serverLogSha256: createHash("sha256")
          .update(serverOutput)
          .digest("hex"),
        profiles: profileReports,
      },
      findings: allFindings,
    } as const;
    const paths = writeEvidence(evidence, generatedAt);
    return { evidence, paths };
  } finally {
    if (server) await stopOwnedServer(server).catch(() => undefined);
    removeOwnedTemporaryDirectory(temporaryRoot, root);
  }
}

function localRuntimeEnvironment(origin: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXTAUTH_URL: origin,
    STRIPE_APP_URL: origin,
    DATABASE_URL:
      "postgresql://greyhoundiq_runtime@127.0.0.1:55735/greyhoundiq?schema=public&connection_limit=20&pool_timeout=10&connect_timeout=5",
    DIRECT_URL:
      "postgresql://greyhoundiq_runtime@127.0.0.1:55735/greyhoundiq?schema=public&connection_limit=1&pool_timeout=10&connect_timeout=5",
    THEDOGS_PROVIDER_ENABLED: "false",
    WATCHDOG_PROVIDER_ENABLED: "false",
    TOPAZ_API_KEY: "",
    NOTIFICATION_WEBHOOK_URL: "",
    MEDIA_SCAN_MODE: "disabled",
    MAINTENANCE_MODE: "false",
    SEARCH_DISABLED: "false",
    ENABLE_DEVICE_PREVIEWS: "false",
  };
}

function copyCandidate(root: string, destination: string) {
  for (const directory of CANDIDATE_DIRECTORIES) {
    const source = resolve(root, directory);
    if (!existsSync(source)) continue;
    assertNoSymbolicLinks(source, root);
    cpSync(source, resolve(destination, directory), {
      recursive: true,
      dereference: false,
      errorOnExist: true,
      force: false,
    });
  }
  for (const file of CANDIDATE_FILES) {
    const source = resolve(root, file);
    if (!existsSync(source)) continue;
    if (lstatSync(source).isSymbolicLink()) {
      throw new Error(`Candidate copy refuses symbolic link: ${file}`);
    }
    mkdirSync(dirname(resolve(destination, file)), { recursive: true });
    copyFileSync(source, resolve(destination, file));
  }
}

function assertNoSymbolicLinks(directory: string, root: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    const repositoryPath = relative(root, path).replaceAll("\\", "/");
    if (entry.isSymbolicLink() || lstatSync(path).isSymbolicLink()) {
      throw new Error(`Candidate copy refuses symbolic link: ${repositoryPath}`);
    }
    if (entry.isDirectory()) assertNoSymbolicLinks(path, root);
  }
}

function collectBuildEntries(root: string, directory: string): string[] {
  const entries: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    const path = relative(root, absolutePath).replaceAll("\\", "/");
    const rootSegment = path.split("/")[0];
    if (BUILD_FINGERPRINT_EXCLUSIONS.has(rootSegment)) continue;
    if (entry.isSymbolicLink() || lstatSync(absolutePath).isSymbolicLink()) {
      entries.push(path);
    } else if (entry.isDirectory()) {
      entries.push(...collectBuildEntries(root, absolutePath));
    } else {
      entries.push(path);
    }
  }
  return entries.sort();
}

async function assertPortAvailable(port: number) {
  await new Promise<void>((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Local production load port ${port} is already in use; no process was stopped.`,
        ),
      ),
    );
    server.listen({ host: LOCAL_LOAD_HOST, port, exclusive: true }, () => {
      server.close((error) => (error ? reject(error) : resolvePromise()));
    });
  });
}

async function waitForProductionServer(
  child: OwnedProductionServer,
  origin: string,
) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Owned production server exited before readiness.");
    }
    try {
      const response = await fetch(`${origin}/api/health/ready`, {
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      });
      await response.arrayBuffer();
      if (response.status === 200) return;
    } catch {
      // The owned server is still starting.
    }
    await delay(250);
  }
  throw new Error("Owned production server did not become ready within 90 seconds.");
}

async function warmRoutes(origin: string) {
  for (const route of ROUTES) {
    const sample = await runProbe(route, origin);
    if (!sample.ok) {
      throw new Error(
        `Warm-up failed for ${route.label} with HTTP ${sample.status}.`,
      );
    }
  }
}

async function runPool(
  routes: readonly RouteProbe[],
  concurrency: number,
  origin: string,
) {
  const results: StagingLoadSample[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, routes.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= routes.length) return;
        results.push(await runProbe(routes[index], origin));
      }
    }),
  );
  return results;
}

async function runProbe(route: RouteProbe, origin: string) {
  const startedAt = Date.now();
  try {
    const response = await fetch(new URL(route.path, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    await response.arrayBuffer();
    return {
      label: route.label,
      status: response.status,
      ms: Date.now() - startedAt,
      ok: response.status === route.expectedStatus,
    } satisfies StagingLoadSample;
  } catch {
    return {
      label: route.label,
      status: 0,
      ms: Date.now() - startedAt,
      ok: false,
    } satisfies StagingLoadSample;
  }
}

async function stopOwnedServer(child: OwnedProductionServer) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  if (await waitForExit(child, 20_000)) return;
  child.kill("SIGKILL");
  if (!(await waitForExit(child, 10_000))) {
    throw new Error("Owned production server did not stop.");
  }
}

async function waitForExit(
  child: OwnedProductionServer,
  timeoutMilliseconds: number,
) {
  if (child.exitCode !== null) return true;
  return await new Promise<boolean>((resolvePromise) => {
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolvePromise(false);
    }, timeoutMilliseconds);
    const onExit = () => {
      clearTimeout(timer);
      resolvePromise(true);
    };
    child.once("exit", onExit);
  });
}

function assertSourceFingerprintEqual(
  expected: DesignLabSourceFingerprint,
  actual: DesignLabSourceFingerprint,
  message: string,
) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(message);
  }
}

function writeEvidence(evidence: unknown, generatedAt: string) {
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const timestamp = generatedAt.replaceAll(":", "-");
  const versioned = resolve(OUTPUT_DIRECTORY, `${timestamp}.json`);
  const latest = resolve(OUTPUT_DIRECTORY, "latest.json");
  const contents = stableJson(evidence);
  writeFileSync(versioned, contents, "utf8");
  writeFileSync(latest, contents, "utf8");
  return {
    versioned: relative(REPOSITORY_ROOT, versioned).replaceAll("\\", "/"),
    latest: relative(REPOSITORY_ROOT, latest).replaceAll("\\", "/"),
  };
}

function createOwnedTemporaryDirectory(root: string) {
  const canonicalParent = realpathSync(dirname(realpathSync(root)));
  return mkdtempSync(join(canonicalParent, "greyhoundiq-local-production-load-"));
}

function removeOwnedTemporaryDirectory(directory: string, root: string) {
  const canonicalTemporaryRoot = realpathSync(dirname(realpathSync(root)));
  const resolvedDirectory = resolve(directory);
  const pathFromTemporaryRoot = relative(canonicalTemporaryRoot, resolvedDirectory);
  if (
    basename(resolvedDirectory).startsWith("greyhoundiq-local-production-load-") &&
    pathFromTemporaryRoot !== "" &&
    !pathFromTemporaryRoot.startsWith(`..${sep}`) &&
    pathFromTemporaryRoot !== ".." &&
    !isAbsolute(pathFromTemporaryRoot)
  ) {
    rmSync(resolvedDirectory, { recursive: true, force: true });
    return;
  }
  throw new Error("Refusing to remove a directory outside the owned load-test temp root.");
}

function summarizeChildOutput(value: string) {
  const lines = value
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/giu, "<redacted-database-connection>")
    .replace(
      /\b(password|secret|token|api[-_]?key)\s*[=:]\s*[^\s,;]+/giu,
      "$1=<redacted>",
    )
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-30);
  return lines.join(" | ");
}

function delay(milliseconds: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function isMainModule() {
  return Boolean(
    process.argv[1] &&
      pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
  );
}

if (isMainModule()) {
  runLocalProductionLoad()
    .then(({ evidence, paths }) => {
      console.log(
        `[local-production-load] ${evidence.status}; evidence=${paths.latest}`,
      );
      if (evidence.status !== "passed") process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`[local-production-load] failed: ${String(error)}`);
      process.exitCode = 1;
    });
}
