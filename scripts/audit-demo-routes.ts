import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEMO_SCREEN_COUNT,
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACTS,
} from "../src/components/demo-experience-registry";
import {
  resolveStagingLoadBaseUrl,
  resolveStagingRedirectUrl,
  resolveStagingRequestUrl,
} from "./staging-load-policy";
import {
  DESIGN_LAB_DEMO_FIXTURE_FILES,
  DESIGN_LAB_SAFE_RUNTIME_CONTRACT_FILES,
  getDesignLabSourceFingerprint,
  getDesignLabSourcePaths,
  getRepositoryHeadSha,
} from "./design-lab-source-fingerprint";

const DEMO_HEADER = "full-access-read-only";
const ERROR_MARKERS = [
  "something went wrong",
  "protected operation interrupted",
  "auth.unauthorized",
  "auth.forbidden",
  "demo_auth.identity_invalid",
  "page not found",
] as const;

type RouteAudit = {
  family: string;
  route: string;
  samplePath: string;
  finalUrl: string;
  status: number | null;
  durationMs: number;
  demoHeader: string | null;
  hasMain: boolean;
  hasH1: boolean;
  hasReactStreamError: boolean;
  errorMarkers: string[];
  passed: boolean;
  error: string | null;
};

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function escapeTableCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function inspectRouteHtml(body: string) {
  const bodyLower = body.toLowerCase();
  return {
    errorMarkers: ERROR_MARKERS.filter((marker) => bodyLower.includes(marker)),
    hasH1: /<h1(?:\s|>)/i.test(body),
    hasMain: /<main(?:\s|>)/i.test(body),
    hasReactStreamError: /\$RX\(/.test(body),
  };
}

export function resolveAuditConcurrency(value?: string) {
  const concurrency = Number.parseInt(value ?? "1", 10);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error("--concurrency must be an integer between 1 and 4.");
  }
  return concurrency;
}

async function auditRoute(
  baseUrl: string,
  family: string,
  route: string,
  samplePath: string,
): Promise<RouteAudit> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    let requestUrl = resolveStagingRequestUrl(samplePath, baseUrl);
    let response: Response | undefined;
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      response = await fetch(requestUrl, {
        redirect: "manual",
        cache: "no-store",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "GreyhoundIQ-Demo-Route-Audit/1.0",
        },
        signal: controller.signal,
      });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get("location");
      if (!location) break;
      if (redirects === 5) throw new Error("Too many same-origin redirects");
      await response.body?.cancel();
      requestUrl = resolveStagingRedirectUrl(location, requestUrl, baseUrl);
    }
    if (!response) throw new Error("Route audit did not receive a response");
    const body = await response.text();
    const { errorMarkers, hasH1, hasMain, hasReactStreamError } =
      inspectRouteHtml(body);
    const finalUrl = response.url;
    const redirectedToAuth =
      (response.status >= 300 && response.status < 400) ||
      finalUrl.includes("/sign-in");
    const demoHeader = response.headers.get("x-greyhoundiq-demo");
    const passed =
      response.status === 200 &&
      !redirectedToAuth &&
      demoHeader === DEMO_HEADER &&
      hasMain &&
      hasH1 &&
      !hasReactStreamError &&
      errorMarkers.length === 0;

    return {
      family,
      route,
      samplePath,
      finalUrl,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      demoHeader,
      hasMain,
      hasH1,
      hasReactStreamError,
      errorMarkers: [...errorMarkers],
      passed,
      error: redirectedToAuth ? "Redirected to authentication" : null,
    };
  } catch (error) {
    return {
      family,
      route,
      samplePath,
      finalUrl: "",
      status: null,
      durationMs: Math.round(performance.now() - startedAt),
      demoHeader: null,
      hasMain: false,
      hasH1: false,
      hasReactStreamError: false,
      errorMarkers: [],
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const repositoryRoot = path.resolve(".");
  const testedCommitSha = getRepositoryHeadSha(repositoryRoot);
  const sourceContract = {
    directFiles: ["scripts/audit-demo-routes.ts"],
    transitiveImportRoots: SCREEN_CONTRACTS.flatMap(
      (screen) => screen.sourceFiles,
    ),
    fixtures: DESIGN_LAB_DEMO_FIXTURE_FILES,
    schemaFiles: ["prisma/schema.prisma"],
    runtimeContractFiles: DESIGN_LAB_SAFE_RUNTIME_CONTRACT_FILES,
  };
  const sourceFiles = getDesignLabSourcePaths(repositoryRoot, sourceContract);
  const sourceBefore = getDesignLabSourceFingerprint(repositoryRoot, sourceContract);
  const baseUrl = resolveStagingLoadBaseUrl(
    readFlag("--base-url"),
    "--base-url",
  );
  const concurrency = resolveAuditConcurrency(readFlag("--concurrency"));
  const outputDirectory = path.resolve(
    readFlag("--output") ?? "output/demo-route-audit",
  );
  const routes = DEMO_SCREEN_FAMILIES.flatMap((family) =>
    family.screens.map((screen) => ({
      family: family.key,
      route: screen.route,
      samplePath: screen.href ?? screen.route,
    })),
  );

  if (routes.length !== DEMO_SCREEN_COUNT) {
    throw new Error(
      `Registry count mismatch: expected ${DEMO_SCREEN_COUNT}, found ${routes.length}.`,
    );
  }
  const unresolved = routes.filter((entry) => entry.samplePath.includes("["));
  if (unresolved.length > 0) {
    throw new Error(
      `Dynamic demo samples are unresolved: ${unresolved
        .map((entry) => entry.route)
        .join(", ")}`,
    );
  }

  console.log(
    `Auditing ${routes.length} routes at ${baseUrl} (concurrency ${concurrency})`,
  );
  const results = new Array<RouteAudit>(routes.length);
  let nextIndex = 0;
  let completed = 0;
  async function worker() {
    while (nextIndex < routes.length) {
      const index = nextIndex++;
      const entry = routes[index];
      const result = await auditRoute(
        baseUrl,
        entry.family,
        entry.route,
        entry.samplePath,
      );
      results[index] = result;
      completed += 1;
      console.log(
        `[${String(completed).padStart(2, "0")}/${routes.length}] ${
          result.passed ? "PASS" : "FAIL"
        } ${entry.route} -> ${result.status ?? "ERR"} (${result.durationMs}ms)`,
      );
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const sourceAfter = getDesignLabSourceFingerprint(repositoryRoot, sourceContract);
  if (
    sourceAfter.sha256 !== sourceBefore.sha256 ||
    sourceAfter.fileCount !== sourceBefore.fileCount
  ) {
    throw new Error(
      "Design Lab source changed during the route audit; discard the run and retry."
    );
  }

  const generatedAt = new Date().toISOString();
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  const report = {
    schemaVersion: 2,
    generatedAt,
    baseUrl,
    testedCommitSha,
    sourceSha256: sourceBefore.sha256,
    sourceFileCount: sourceBefore.fileCount,
    sourceFiles,
    expected: DEMO_SCREEN_COUNT,
    passed,
    failed,
    results,
  };
  const markdown = [
    "# GreyhoundIQ demo route audit",
    "",
    `- Generated: ${generatedAt}`,
    `- Base URL: ${baseUrl}`,
    `- Result: ${passed}/${results.length} passed`,
    "",
    "| Result | Family | Registry route | Sample/final URL | Status | Time | Render |",
    "|---|---|---|---|---:|---:|---|",
    ...results.map((result) => {
      const final = result.finalUrl || result.error || "No response";
      const render = `main=${result.hasMain}; h1=${result.hasH1}; header=${
        result.demoHeader ?? "missing"
      }; streamError=${result.hasReactStreamError}${
        result.errorMarkers.length > 0
          ? `; markers=${result.errorMarkers.join(",")}`
          : ""
      }`;
      return `| ${result.passed ? "PASS" : "FAIL"} | ${escapeTableCell(
        result.family,
      )} | ${escapeTableCell(result.route)} | ${escapeTableCell(
        `${result.samplePath} -> ${final}`,
      )} | ${result.status ?? "ERR"} | ${result.durationMs}ms | ${escapeTableCell(
        render,
      )} |`;
    }),
    "",
  ].join("\n");

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, "latest.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    ),
    writeFile(path.join(outputDirectory, "latest.md"), markdown, "utf8"),
  ]);

  console.log(`Report: ${path.join(outputDirectory, "latest.json")}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
