import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { DESIGN_LAB_USER_STORY_MANIFESTS } from "../src/components/screen-contracts/design-lab-user-stories";
import { SCREEN_CONTRACT_BY_ROUTE } from "../src/components/demo-experience-registry";
import {
  DESIGN_LAB_HTTP_RUNTIME_CONTRACT_FILES,
  getDesignLabSourceFingerprint,
  getDesignLabSourcePaths,
  getRepositoryHeadSha,
} from "./design-lab-source-fingerprint";
import {
  resolveStagingLoadBaseUrl,
  resolveStagingRequestUrl,
} from "./staging-load-policy";

export const DESIGN_LAB_STORY_AUDIT_PATH =
  "output/demo-route-audit/design-lab-user-stories.json";

export type DesignLabStoryRuntimeCase = {
  id: string;
  route: string;
  requestPath: string;
  expectedStatus: number;
  includes: readonly string[];
  counts?: Readonly<Record<string, number>>;
};

type DesignLabStoryScenarioResult = {
  id: string;
  route: string;
  requestPath: string;
  status: number;
  durationMs: number;
  passed: boolean;
  failures: string[];
};

export const DESIGN_LAB_STORY_RUNTIME_CASES: readonly DesignLabStoryRuntimeCase[] = [
  {
    id: "DL.STORY.CONTRACT-WORKSPACE.1",
    route: "/design-lab",
    requestPath: "/design-lab?area=screens",
    expectedStatus: 200,
    includes: [
      'data-design-lab-active-area="screens"',
      'placeholder="Search routes or user stories"',
      "data-design-lab-status-ribbon",
    ],
  },
  {
    id: "DL.STORY.CONTRACT-WORKSPACE.2",
    route: "/design-lab",
    requestPath: "/design-lab?area=delivery",
    expectedStatus: 200,
    includes: [
      'data-design-lab-active-area="delivery"',
      "Production locked",
      "data-design-lab-delivery-progress",
    ],
  },
  {
    id: "DL.STORY.CONTRACT-WORKSPACE.3",
    route: "/design-lab",
    requestPath: "/design-lab?area=screens",
    expectedStatus: 200,
    includes: [
      'data-design-lab-active-area="screens"',
      'placeholder="Search routes or user stories"',
      "data-design-lab-status-ribbon",
    ],
  },
  {
    id: "DL.STORY.DEMO-EXPERIENCE.1",
    route: "/design-lab/demo-experience",
    requestPath: "/design-lab/demo-experience",
    expectedStatus: 200,
    includes: [
      'data-design-lab-active-area="screens"',
      'placeholder="Search routes or user stories"',
    ],
  },
  {
    id: "DL.STORY.DEMO-EXPERIENCE.2",
    route: "/design-lab/demo-experience",
    requestPath: "/design-lab/demo-experience?view=admin-frames",
    expectedStatus: 200,
    includes: [
      "data-admin-frame-lab",
      'href="/design-lab/demo-experience"',
      "Screen registry",
    ],
    counts: { "<iframe": 1 },
  },
  {
    id: "DL.STORY.DOCK-SKINS.1",
    route: "/design-lab/dock-skins",
    requestPath: "/design-lab/dock-skins?dock=D6",
    expectedStatus: 200,
    includes: [
      'data-dock-skin="D6"',
      'data-action="home"',
      'data-action="feed"',
      'data-action="post"',
      'data-action="chat"',
      'data-action="menu"',
    ],
  },
  {
    id: "DL.STORY.DOCK-SKINS.2",
    route: "/design-lab/dock-skins",
    requestPath: "/design-lab/dock-skins?dock=unsupported",
    expectedStatus: 200,
    includes: [
      'data-dock-skin="D1"',
      "This review surface does not change production dock behaviour.",
    ],
    counts: { 'data-dock-skin="D1"': 1 },
  },
  {
    id: "DL.STORY.ROLE-BLUEPRINTS.1",
    route: "/design-lab/role-blueprints",
    requestPath: "/design-lab/role-blueprints?role=punter&variant=C2",
    expectedStatus: 200,
    includes: [
      'data-role-blueprint="punter"',
      'data-app-template="C2"',
      'href="/design-lab/role-blueprints?role=business&amp;variant=C2"',
      'href="/design-lab/role-blueprints?role=punter&amp;variant=A1"',
    ],
  },
  {
    id: "DL.STORY.ROLE-BLUEPRINTS.2",
    route: "/design-lab/role-blueprints",
    requestPath: "/design-lab/role-blueprints?role=unsupported&variant=Z9",
    expectedStatus: 200,
    includes: ['data-role-blueprint="business"', 'data-app-template="A1"'],
  },
  {
    id: "DL.STORY.FEED-DEVICE-PREVIEW.1",
    route: "/feed/device-preview",
    requestPath:
      "/feed/device-preview?device=tablet&variant=C2&dock=D6&sponsored=off",
    expectedStatus: 200,
    includes: [
      'data-review-frame-id="APP-C2-D6-TABLET"',
      'data-review-target="/feed?variant=C2&amp;demo=1&amp;dock=D6&amp;sponsored=off"',
      'href="/feed/device-preview?device=desktop&amp;variant=C2&amp;dock=D6&amp;sponsored=off"',
    ],
  },
  {
    id: "DL.STORY.FEED-DEVICE-PREVIEW.2",
    route: "/feed/device-preview",
    requestPath:
      "/feed/device-preview?device=tablet&variant=C2&dock=D6&sponsored=off",
    expectedStatus: 200,
    includes: [
      'data-review-id="C2-TABLET-SHELL"',
      'data-review-dimensions="834x1210"',
      'data-sponsored-marketplace="off"',
    ],
  },
  {
    id: "DL.STORY.MARKETPLACE-TEMPLATES.1",
    route: "/marketplace/design-lab",
    requestPath: "/marketplace/design-lab?template=M6",
    expectedStatus: 200,
    includes: [
      'data-marketplace-template="M6"',
      'data-layout-family="comparison-matrix"',
      'href="/marketplace/design-lab?template=M1"',
    ],
  },
  {
    id: "DL.STORY.MARKETPLACE-TEMPLATES.2",
    route: "/marketplace/design-lab",
    requestPath: "/marketplace/design-lab?template=unsupported",
    expectedStatus: 200,
    includes: [
      'data-marketplace-template="M1"',
      'data-layout-family="editorial-grandstand"',
      "Seller details on listing",
    ],
  },
] as const;

export function evaluateDesignLabStoryHtml(
  storyCase: DesignLabStoryRuntimeCase,
  html: string,
) {
  const failures = storyCase.includes
    .filter((needle) => !html.includes(needle))
    .map((needle) => `missing ${needle}`);
  for (const [needle, expected] of Object.entries(storyCase.counts ?? {})) {
    const actual = html.split(needle).length - 1;
    if (actual !== expected) failures.push(`${needle} count ${actual}, expected ${expected}`);
  }
  return failures;
}

export function findDesignLabStoryAuditIssues(
  value: unknown,
  binding?: {
    headSha: string;
    sourceSha256: string;
    sourceFileCount: number;
    now?: number;
  },
) {
  if (!isRecord(value)) return ["User-story audit must be a JSON object."];
  const issues: string[] = [];
  if (value.schemaVersion !== 1) {
    issues.push("User-story audit schemaVersion must be 1.");
  }
  if (value.auditKind !== "design-lab-user-stories") {
    issues.push("User-story audit auditKind is invalid.");
  }
  if (!isLoopbackAuditBaseUrl(value.baseUrl)) {
    issues.push("User-story audit baseUrl must be an HTTP(S) loopback origin.");
  }
  const rows = Array.isArray(value.results) ? value.results.filter(isRecord) : [];
  const scenarios = rows.flatMap((row) =>
    Array.isArray(row.scenarios) ? row.scenarios.filter(isRecord) : [],
  );
  const expectedRoutes = [
    ...new Set(DESIGN_LAB_STORY_RUNTIME_CASES.map((item) => item.route)),
  ];

  if (rows.length !== expectedRoutes.length) {
    issues.push(`User-story audit has ${rows.length}/${expectedRoutes.length} route rows.`);
  }
  if (scenarios.length !== DESIGN_LAB_STORY_RUNTIME_CASES.length) {
    issues.push(
      `User-story audit has ${scenarios.length}/${DESIGN_LAB_STORY_RUNTIME_CASES.length} scenario rows.`,
    );
  }
  for (const route of expectedRoutes) {
    const matches = rows.filter((row) => row.route === route);
    if (matches.length !== 1 || matches[0]?.passed !== true) {
      issues.push(`User-story audit route ${route} must have one passing row.`);
      continue;
    }
    const expectedScenarioIds = DESIGN_LAB_STORY_RUNTIME_CASES.filter(
      (scenario) => scenario.route === route,
    )
      .map((scenario) => scenario.id)
      .toSorted();
    const routeScenarios = Array.isArray(matches[0].scenarios)
      ? matches[0].scenarios.filter(isRecord)
      : [];
    const actualScenarioIds = routeScenarios
      .map((scenario) => scenario.id)
      .filter((id): id is string => typeof id === "string")
      .toSorted();
    if (
      JSON.stringify(actualScenarioIds) !== JSON.stringify(expectedScenarioIds) ||
      routeScenarios.some((scenario) => scenario.route !== route)
    ) {
      issues.push(`User-story audit route ${route} has invalid child-scenario membership.`);
    }
  }
  for (const expected of DESIGN_LAB_STORY_RUNTIME_CASES) {
    const matches = scenarios.filter((scenario) => scenario.id === expected.id);
    if (
      matches.length !== 1 ||
      matches[0]?.route !== expected.route ||
      matches[0]?.requestPath !== expected.requestPath ||
      matches[0]?.status !== expected.expectedStatus ||
      matches[0]?.passed !== true ||
      !Array.isArray(matches[0]?.failures) ||
      matches[0]?.failures.length !== 0
    ) {
      issues.push(`User-story scenario ${expected.id} must have one exact passing row.`);
    }
  }
  if (
    value.expectedRoutes !== expectedRoutes.length ||
    value.passedRoutes !== expectedRoutes.length ||
    value.expectedScenarios !== DESIGN_LAB_STORY_RUNTIME_CASES.length ||
    value.passedScenarios !== DESIGN_LAB_STORY_RUNTIME_CASES.length
  ) {
    issues.push("User-story audit summary does not match its required inventory.");
  }

  if (binding) {
    if (value.testedCommitSha !== binding.headSha) {
      issues.push("User-story audit is not bound to the current Git HEAD.");
    }
    if (value.sourceSha256 !== binding.sourceSha256) {
      issues.push("User-story audit source digest does not match the current source tree.");
    }
    if (value.sourceFileCount !== binding.sourceFileCount) {
      issues.push("User-story audit source-file count does not match the current source tree.");
    }
    const generatedAt =
      typeof value.generatedAt === "string" ? Date.parse(value.generatedAt) : Number.NaN;
    const now = binding.now ?? Date.now();
    if (!Number.isFinite(generatedAt)) {
      issues.push("User-story audit generatedAt is invalid.");
    } else if (generatedAt > now + 5 * 60_000) {
      issues.push("User-story audit generatedAt is in the future.");
    } else if (now - generatedAt > 24 * 60 * 60_000) {
      issues.push("User-story audit evidence is older than 24 hours.");
    }
  }
  return issues;
}

async function main() {
  const repositoryRoot = path.resolve(".");
  const baseUrl = resolveStagingLoadBaseUrl(readFlag("--base-url"), "--base-url");
  const outputPath = path.resolve(
    readFlag("--output") ??
      DESIGN_LAB_STORY_AUDIT_PATH,
  );
  const storyRoutes = [
    ...new Set(DESIGN_LAB_STORY_RUNTIME_CASES.map((item) => item.route)),
  ];
  const sourceContract = {
    directFiles: ["scripts/audit-design-lab-user-stories.ts"],
    transitiveImportRoots: storyRoutes.flatMap((route) => {
      const contract = SCREEN_CONTRACT_BY_ROUTE.get(route);
      if (!contract) throw new Error(`Missing screen contract for ${route}.`);
      return contract.sourceFiles;
    }),
    fixtures: [],
    schemaFiles: [],
    runtimeContractFiles: DESIGN_LAB_HTTP_RUNTIME_CONTRACT_FILES,
  };
  const sourceFiles = getDesignLabSourcePaths(repositoryRoot, sourceContract);
  const sourceBefore = getDesignLabSourceFingerprint(repositoryRoot, sourceContract);
  const expectedRoutes = DESIGN_LAB_USER_STORY_MANIFESTS.map((item) => item.route).toSorted();
  const auditedRoutes = [...new Set(DESIGN_LAB_STORY_RUNTIME_CASES.map((item) => item.route))].toSorted();
  if (JSON.stringify(expectedRoutes) !== JSON.stringify(auditedRoutes)) {
    throw new Error("Runtime story cases do not exactly cover the six Design Lab manifests.");
  }

  const scenarioResults: DesignLabStoryScenarioResult[] = [];
  for (const storyCase of DESIGN_LAB_STORY_RUNTIME_CASES) {
    const startedAt = performance.now();
    const response = await fetch(
      resolveStagingRequestUrl(storyCase.requestPath, baseUrl),
      {
        cache: "no-store",
        redirect: "manual",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "GreyhoundIQ-Design-Lab-Story-Audit/1.0",
        },
        signal: AbortSignal.timeout(30_000),
      },
    );
    const html = await response.text();
    const failures = evaluateDesignLabStoryHtml(storyCase, html);
    if (response.status !== storyCase.expectedStatus) {
      failures.unshift(`HTTP ${response.status}, expected ${storyCase.expectedStatus}`);
    }
    if (!response.headers.get("x-request-id")) failures.push("missing X-Request-ID");
    if (/\$RX\(|something went wrong|protected operation interrupted/i.test(html)) {
      failures.push("rendered error marker");
    }
    scenarioResults.push({
      id: storyCase.id,
      route: storyCase.route,
      requestPath: storyCase.requestPath,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      passed: failures.length === 0,
      failures,
    });
  }

  const sourceAfter = getDesignLabSourceFingerprint(repositoryRoot, sourceContract);
  if (
    sourceAfter.sha256 !== sourceBefore.sha256 ||
    sourceAfter.fileCount !== sourceBefore.fileCount
  ) {
    throw new Error("Design Lab source changed during the user-story audit; discard the run.");
  }

  const results = expectedRoutes.map((route) => {
    const scenarios = scenarioResults.filter((item) => item.route === route);
    return { route, passed: scenarios.every((item) => item.passed), scenarios };
  });
  const report = {
    schemaVersion: 1,
    auditKind: "design-lab-user-stories",
    generatedAt: new Date().toISOString(),
    baseUrl,
    testedCommitSha: getRepositoryHeadSha(repositoryRoot),
    sourceSha256: sourceBefore.sha256,
    sourceFileCount: sourceBefore.fileCount,
    sourceFiles,
    expectedRoutes: results.length,
    passedRoutes: results.filter((item) => item.passed).length,
    expectedScenarios: scenarioResults.length,
    passedScenarios: scenarioResults.filter((item) => item.passed).length,
    results,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  const reportJson = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(outputPath, reportJson, "utf8");
  console.log(
    `Design Lab user stories: ${report.passedScenarios}/${report.expectedScenarios} scenarios across ${report.passedRoutes}/${report.expectedRoutes} routes.`,
  );
  console.log(`Evidence SHA-256: ${createHash("sha256").update(reportJson).digest("hex")}`);
  console.log(`Report: ${outputPath}`);
  if (report.passedScenarios !== report.expectedScenarios) process.exitCode = 1;
}

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLoopbackAuditBaseUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const isLoopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    return (
      isLoopback &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
