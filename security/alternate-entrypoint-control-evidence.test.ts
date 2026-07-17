import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  ALTERNATE_ENTRYPOINT_BINDINGS,
  ALTERNATE_ENTRYPOINT_CONTROL_MASTER_EVIDENCE,
  ALTERNATE_ENTRYPOINT_CONTROL_REQUIREMENT_ID,
  ALTERNATE_ENTRYPOINT_CONTROL_SCOPE,
  ALTERNATE_ENTRYPOINT_SERVICE_BINDINGS,
  auditAlternateEntrypointControls,
  type AlternateEntrypointBinding,
  type AlternateEntrypointContract,
  type AlternateEntrypointServiceBinding,
  type AlternateEntrypointSource,
} from "./alternate-entrypoint-control-evidence";
import {
  FRONTEND_AUTHORIZATION_ALTERNATE_ROUTES,
  FRONTEND_AUTHORIZATION_MASTER_EVIDENCE,
} from "./frontend-authorization-evidence";

const sources = collectProductionSources("src");
const prerequisiteVerified =
  FRONTEND_AUTHORIZATION_MASTER_EVIDENCE[
    "security.frontend-authorization.alternate-routes"
  ].status === "verified";
const currentIssues = auditAlternateEntrypointControls(
  FRONTEND_AUTHORIZATION_ALTERNATE_ROUTES,
  ALTERNATE_ENTRYPOINT_BINDINGS,
  ALTERNATE_ENTRYPOINT_SERVICE_BINDINGS,
  sources,
  prerequisiteVerified,
);

assert.ok(sources.length > 600);
assert.deepEqual(currentIssues, []);
assert.equal(FRONTEND_AUTHORIZATION_ALTERNATE_ROUTES.length, 3);
assert.equal(ALTERNATE_ENTRYPOINT_BINDINGS.length, 6);
assert.equal(ALTERNATE_ENTRYPOINT_SERVICE_BINDINGS.length, 3);
assert.equal(
  ALTERNATE_ENTRYPOINT_SERVICE_BINDINGS.reduce(
    (total, { directCallerFiles }) => total + directCallerFiles.length,
    0,
  ),
  6,
);
assert.deepEqual(
  FRONTEND_AUTHORIZATION_ALTERNATE_ROUTES.map(({ capability }) => capability),
  [
    "agent execution",
    "feed publishing",
    "marketplace listing edit page",
  ],
);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === ALTERNATE_ENTRYPOINT_CONTROL_REQUIREMENT_ID,
);
assert.equal(
  requirement?.requirement,
  "Confirm that alternate entry points cannot bypass the same controls.",
);
const evidence =
  ALTERNATE_ENTRYPOINT_CONTROL_MASTER_EVIDENCE[
    ALTERNATE_ENTRYPOINT_CONTROL_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing alternate-entrypoint evidence: ${path}`);
}
assert.match(ALTERNATE_ENTRYPOINT_CONTROL_SCOPE, /same guarded server service/i);
assert.match(ALTERNATE_ENTRYPOINT_CONTROL_SCOPE, /new direct caller/i);
assert.match(ALTERNATE_ENTRYPOINT_CONTROL_SCOPE, /current alternate-entrypoint convergence only/i);
assert.match(ALTERNATE_ENTRYPOINT_CONTROL_SCOPE, /does not claim deployed direct-request testing/i);
assert.match(ALTERNATE_ENTRYPOINT_CONTROL_SCOPE, /cross-user or cross-tenant runtime behavior/i);
assert.match(ALTERNATE_ENTRYPOINT_CONTROL_SCOPE, /production readiness/i);

const fixtureContract: AlternateEntrypointContract = {
  capability: "fixture mutation",
  entrypoints: ["POST /api/fixture", "src/app/actions.ts#fixtureAction"],
  service: "sharedFixtureService",
  serviceGuard: "current.ownerId",
};
const fixtureEntrypoints: readonly AlternateEntrypointBinding[] = [
  {
    capability: fixtureContract.capability,
    entrypoint: fixtureContract.entrypoints[0],
    sourceFile: "src/app/api/fixture/route.ts",
    requiredMarker: "sharedFixtureService(",
  },
  {
    capability: fixtureContract.capability,
    entrypoint: fixtureContract.entrypoints[1],
    sourceFile: "src/app/actions.ts",
    requiredMarker: "sharedFixtureService(",
  },
];
const fixtureService: AlternateEntrypointServiceBinding = {
  capability: fixtureContract.capability,
  service: fixtureContract.service,
  serviceGuard: fixtureContract.serviceGuard,
  sourceFile: "src/lib/fixture-service.ts",
  directCallerFiles: [
    "src/app/actions.ts",
    "src/app/api/fixture/route.ts",
  ],
};
const fixtureSources: readonly AlternateEntrypointSource[] = [
  {
    path: "src/app/api/fixture/route.ts",
    source: "export function POST() { return sharedFixtureService(); }",
  },
  {
    path: "src/app/actions.ts",
    source: "export function fixtureAction() { return sharedFixtureService(); }",
  },
  {
    path: "src/lib/fixture-service.ts",
    source:
      "export function sharedFixtureService(current: { ownerId: string }) { return current.ownerId; }",
  },
];

assert.deepEqual(
  auditAlternateEntrypointControls(
    [fixtureContract],
    fixtureEntrypoints,
    [fixtureService],
    fixtureSources,
    true,
  ),
  [],
);
assertIssue([], [], [], [], true, "ALTERNATE_ENTRYPOINT_CONTRACT_INVENTORY_VACUOUS");
assertIssue(
  [fixtureContract],
  fixtureEntrypoints,
  [fixtureService],
  fixtureSources,
  false,
  "ALTERNATE_ENTRYPOINT_PREREQUISITE_UNVERIFIED",
);
assertIssue(
  [{ ...fixtureContract, entrypoints: [fixtureContract.entrypoints[0]] }],
  fixtureEntrypoints,
  [fixtureService],
  fixtureSources,
  true,
  "ALTERNATE_ENTRYPOINT_NOT_ALTERNATE",
);
assertIssue(
  [fixtureContract, fixtureContract],
  fixtureEntrypoints,
  [fixtureService],
  fixtureSources,
  true,
  "ALTERNATE_ENTRYPOINT_CAPABILITY_INVALID",
);
assertIssue(
  [fixtureContract],
  fixtureEntrypoints.slice(1),
  [fixtureService],
  fixtureSources,
  true,
  "ALTERNATE_ENTRYPOINT_BINDING_MISSING",
);
assertIssue(
  [fixtureContract],
  [
    ...fixtureEntrypoints,
    {
      ...fixtureEntrypoints[0],
      entrypoint: "POST /api/stale",
    },
  ],
  [fixtureService],
  fixtureSources,
  true,
  "ALTERNATE_ENTRYPOINT_BINDING_STALE",
);
assertIssue(
  [fixtureContract],
  fixtureEntrypoints,
  [fixtureService],
  fixtureSources.map((record) =>
    record.path === fixtureEntrypoints[0].sourceFile
      ? { ...record, source: "export function POST() { return true; }" }
      : record,
  ),
  true,
  "ALTERNATE_ENTRYPOINT_MARKER_MISSING",
);
assertIssue(
  [fixtureContract],
  fixtureEntrypoints,
  [fixtureService],
  fixtureSources.map((record) =>
    record.path === fixtureService.sourceFile
      ? { ...record, source: "export function sharedFixtureService() {}" }
      : record,
  ),
  true,
  "ALTERNATE_ENTRYPOINT_SERVICE_GUARD_MISSING",
);
assertIssue(
  [fixtureContract],
  fixtureEntrypoints,
  [fixtureService],
  [
    ...fixtureSources,
    {
      path: "src/app/hidden-entry.ts",
      source: "export function hidden() { return sharedFixtureService(); }",
    },
  ],
  true,
  "ALTERNATE_ENTRYPOINT_DIRECT_CALLER_UNREVIEWED",
);
assertIssue(
  [fixtureContract],
  fixtureEntrypoints,
  [
    {
      ...fixtureService,
      directCallerFiles: [...fixtureService.directCallerFiles, "src/app/missing.ts"],
    },
  ],
  fixtureSources,
  true,
  "ALTERNATE_ENTRYPOINT_DIRECT_CALLER_MISSING",
);
assertIssue(
  [fixtureContract],
  fixtureEntrypoints,
  [fixtureService],
  [...fixtureSources, fixtureSources[0]],
  true,
  "ALTERNATE_ENTRYPOINT_SOURCE_PATH_DUPLICATE",
);

console.log(
  "Alternate-entrypoint control passed: 3 multi-entry capabilities, 6 registered entry points, 3 guarded shared services and all 6 direct callers remain source-bound without a bypass path.",
);

function collectProductionSources(root: string): AlternateEntrypointSource[] {
  return walk(root)
    .filter((path) => [".ts", ".tsx"].includes(extname(path)))
    .map((path) => path.replaceAll("\\", "/"))
    .filter(
      (path) =>
        !/(?:^|\/)[^/]+\.(?:test|spec|stories)\.tsx?$/u.test(path) &&
        !/(?:^|\/)__tests__(?:\/|$)/u.test(path),
    )
    .sort()
    .map((path) => ({ path, source: readFileSync(path, "utf8") }));
}

function walk(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function assertIssue(
  contracts: readonly AlternateEntrypointContract[],
  entrypoints: readonly AlternateEntrypointBinding[],
  services: readonly AlternateEntrypointServiceBinding[],
  fixtureSources: readonly AlternateEntrypointSource[],
  prerequisiteVerified: boolean,
  expected: string,
) {
  const issues = auditAlternateEntrypointControls(
    contracts,
    entrypoints,
    services,
    fixtureSources,
    prerequisiteVerified,
  );
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}
