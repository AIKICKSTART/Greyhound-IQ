import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  API_SURFACE_INVENTORY,
} from "./api-surface-inventory";
import { API_SURFACE_MASTER_EVIDENCE } from "./api-surface-evidence";
import {
  ENDPOINTS,
  discoverRouteHandlers,
  discoverServerActions,
} from "./endpoints";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  BACKGROUND_WORKER_MEMBERS,
  QUEUE_CONSUMER_MEMBERS,
  REALTIME_CONNECTION_MEMBERS,
  SERVER_COMPONENT_DATA_MEMBERS,
} from "./source-surface-inventory";

const repositoryRoot = process.cwd();
const recordsByKey = new Map(
  API_SURFACE_INVENTORY.map((record) => [record.key, record]),
);
const surfaceRequirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    requirement.section === "api-inventory-surface",
);

assert.equal(API_SURFACE_INVENTORY.length, 25);
assert.equal(recordsByKey.size, API_SURFACE_INVENTORY.length);
assert.deepEqual(
  API_SURFACE_INVENTORY.map((record) => record.requirementId).toSorted(),
  surfaceRequirements.map((requirement) => requirement.id).toSorted(),
  "the surface inventory must make an explicit decision for every immutable API-surface requirement",
);
assert.equal(
  API_SURFACE_INVENTORY.filter((record) => record.status === "open").length,
  0,
);
assert.equal(Object.keys(API_SURFACE_MASTER_EVIDENCE).length, 27);

for (const record of API_SURFACE_INVENTORY) {
  assert.equal(new Set(record.members).size, record.members.length);
  if (record.status === "verified") {
    assert.ok(record.members.length > 0, `${record.key} needs non-vacuous members`);
    assert.equal(record.justification, undefined);
  } else if (record.status === "not-applicable-with-justification") {
    assert.deepEqual(record.members, []);
    assert.ok(record.justification?.trim());
  } else {
    assert.deepEqual(record.members, []);
    assert.ok(record.knownGap?.trim());
  }

  const masterRequirement = surfaceRequirements.find(
    (requirement) => requirement.id === record.requirementId,
  );
  assert.ok(masterRequirement);
  assert.equal(
    isMasterRequirementComplete(masterRequirement),
    record.status !== "open",
    `${record.requirementId} completion must follow the tested inventory decision`,
  );
  if (record.status !== "open") {
    assert.deepEqual(
      SECURITY_MASTER_EVIDENCE[record.requirementId],
      API_SURFACE_MASTER_EVIDENCE[record.requirementId],
    );
  } else {
    assert.equal(SECURITY_MASTER_EVIDENCE[record.requirementId], undefined);
  }
}

const discoveredHttp = discoverRouteHandlers(repositoryRoot)
  .map((entry) => `${entry.method} ${entry.route}`)
  .toSorted();
const discoveredActions = discoverServerActions(repositoryRoot)
  .map((entry) => `ACTION ${entry.procedure}`)
  .toSorted();
assert.deepEqual(record("rest").members.toSorted(), discoveredHttp);
assert.deepEqual(record("server-action").members.toSorted(), discoveredActions);
assert.equal(
  discoveredHttp.length + discoveredActions.length,
  ENDPOINTS.length,
);

assertMembers("auth-callback", ["GET /callback"]);
assertMembers("oauth-oidc", ["GET /callback", "GET /sign-in"]);
assertMembers("webhook", [
  "POST /api/livekit/webhook",
  "POST /api/webhooks/lago",
  "POST /api/webhooks/stripe",
]);
assertMembers("upload", [
  "POST /api/media/[id]/finalize",
  "POST /api/media/sign-upload",
]);
assertMembers("download", [
  "GET /api/media/[id]/blob",
  "GET /api/media/[id]/url",
  "GET /api/replay/stream",
  "POST /api/users/me/export",
]);
for (const [requirementId, surfaceKey] of [
  ["security.file-media-inventory.uploads", "upload"],
  ["security.file-media-inventory.downloads", "download"],
] as const) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId} must remain immutable`);
  assert.ok(record(surfaceKey).members.length > 0);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    API_SURFACE_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}
assertMembers("export", [
  "ACTION src/app/admin/mutations.ts#createAdminExportAction",
  "POST /api/users/me/export",
]);
assertMembers("ai-tool", [
  "ACTION src/app/actions.ts#createAgentRun",
  "ACTION src/app/actions.ts#generateDogCardAction",
  "GET /api/agents/context",
  "GET /api/agents/runs",
  "GET /api/agents/runs/[id]",
  "POST /api/agents/[type]/run",
  "POST /api/agents/runs/[id]/cancel",
]);
assertMembers("health", [
  "GET /api/health",
  "GET /api/health/billing",
  "GET /api/health/feeds",
  "GET /api/health/ready",
]);
assert.deepEqual(
  record("server-component-data").members,
  SERVER_COMPONENT_DATA_MEMBERS,
);
assert.deepEqual(record("worker").members, BACKGROUND_WORKER_MEMBERS);
assert.deepEqual(record("queue-consumer").members, QUEUE_CONSUMER_MEMBERS);
assert.deepEqual(record("websocket").members, REALTIME_CONNECTION_MEMBERS);

assert.deepEqual(
  record("internal").members.toSorted(),
  ENDPOINTS.filter((endpoint) =>
    endpoint.routeOrProcedure.startsWith("/api/internal/"),
  )
    .map((endpoint) => `${endpoint.method} ${endpoint.routeOrProcedure}`)
    .toSorted(),
);
assert.deepEqual(
  record("administration").members.toSorted(),
  ENDPOINTS.filter(
    (endpoint) => endpoint.sourceFile === "src/app/admin/mutations.ts",
  )
    .map((endpoint) => `${endpoint.method} ${endpoint.routeOrProcedure}`)
    .toSorted(),
);

const schedulerSources = [
  "scripts/gcp-cloud-run-deploy.ps1",
  "scripts/gcp-scheduler-sync.sh",
  ".github/workflows/live-sync.yml",
]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
for (const member of record("cron").members) {
  const route = member.replace(/^POST /, "");
  assert.match(
    schedulerSources,
    new RegExp(escapeRegExp(route)),
    `${route} must remain bound to a scheduler definition`,
  );
  assert.ok(
    ENDPOINTS.some(
      (endpoint) =>
        endpoint.method === "POST" && endpoint.routeOrProcedure === route,
    ),
    `${route} must remain an inventoried POST endpoint`,
  );
}

const packageSource = readFileSync("package.json", "utf8");
const runtimeSource = walkRuntimeSource(path.join(repositoryRoot, "src"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
assert.doesNotMatch(packageSource, /"(?:graphql|@apollo\/|@trpc\/)/i);
assert.equal(
  ENDPOINTS.some((endpoint) => /graphql/i.test(endpoint.routeOrProcedure)),
  false,
);
assert.doesNotMatch(packageSource, /"@trpc\//i);
assert.equal(
  ENDPOINTS.some((endpoint) => /(?:^|\/)rpc(?:\/|$)/i.test(endpoint.routeOrProcedure)),
  false,
);
assert.doesNotMatch(runtimeSource, /text\/event-stream|new\s+EventSource\s*\(/);
assert.equal(
  ENDPOINTS.some((endpoint) =>
    /transform|transcode|resize|thumbnail/i.test(endpoint.routeOrProcedure),
  ),
  false,
);
assert.ok(ENDPOINTS.every((endpoint) => endpoint.version === "unversioned"));
assert.equal(
  ENDPOINTS.some((endpoint) => /\/api\/v\d+(?:\/|$)/i.test(endpoint.routeOrProcedure)),
  false,
);
assert.ok(
  ENDPOINTS.every((endpoint) =>
    endpoint.environment.includes("production when deployed"),
  ),
);
assert.equal(
  ENDPOINTS.some((endpoint) => /\/(?:debug|diagnostics)(?:\/|$)/i.test(endpoint.routeOrProcedure)),
  false,
);
assert.equal(
  ENDPOINTS.some((endpoint) => /\/metrics(?:\/|$)/i.test(endpoint.routeOrProcedure)),
  false,
);

console.log(
  `API surface inventory passed: ${API_SURFACE_INVENTORY.length}/25 source-static decisions complete; ${discoveredHttp.length} HTTP methods, ${discoveredActions.length} server actions, ${REALTIME_CONNECTION_MEMBERS.length} realtime connections, ${SERVER_COMPONENT_DATA_MEMBERS.length} server-component data calls, ${BACKGROUND_WORKER_MEMBERS.length} workers and ${QUEUE_CONSUMER_MEMBERS.length} queue consumers bound`,
);

function record(key: string) {
  const value = recordsByKey.get(key);
  assert.ok(value, `${key} must exist in the surface inventory`);
  return value;
}

function assertMembers(key: string, expected: readonly string[]) {
  assert.deepEqual(record(key).members.toSorted(), [...expected].toSorted());
}

function walkRuntimeSource(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkRuntimeSource(target);
    if (!/\.(?:ts|tsx)$/.test(entry.name)) return [];
    if (/\.test\.(?:ts|tsx)$/.test(entry.name)) return [];
    if (target.endsWith(path.join("components", "security-master-requirements.ts"))) {
      return [];
    }
    return [target];
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
