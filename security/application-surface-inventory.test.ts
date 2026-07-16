import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SCREEN_CONTRACTS } from "../src/components/demo-experience-registry";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  APPLICATION_SURFACE_EVIDENCE_PATHS,
  APPLICATION_SURFACE_MASTER_EVIDENCE,
} from "./application-surface-evidence";
import {
  APPLICATION_SURFACE_INVENTORY,
  APPLICATION_SURFACE_SUMMARY,
  renderApplicationSurfaceInventoryMarkdown,
} from "./application-surface-inventory";
import { API_SURFACE_INVENTORY } from "./api-surface-inventory";
import {
  ENDPOINTS,
  OPENAPI_ENDPOINT_AUTHENTICATION,
  discoverRouteHandlers,
  discoverServerActions,
} from "./endpoints";
import {
  ADMIN_CLI_MEMBERS,
  BACKGROUND_WORKER_MEMBERS,
  CACHE_OPERATION_MEMBERS,
  CLIENT_SEARCH_MEMBERS,
  DATABASE_FUNCTION_MEMBERS,
  DATABASE_TRIGGER_MEMBERS,
  EMAIL_WORKER_SEARCH_MEMBERS,
  QUEUE_CONSUMER_MEMBERS,
  QUEUE_PUBLISHER_MEMBERS,
  REALTIME_CONNECTION_MEMBERS,
  REALTIME_EVENT_MEMBERS,
  RPC_CALL_MEMBERS,
  SEARCH_INDEX_OPERATION_MEMBERS,
} from "./source-surface-inventory";

const repositoryRoot = process.cwd();
const recordsByKey = new Map(
  APPLICATION_SURFACE_INVENTORY.map((record) => [record.key, record]),
);
const requirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    requirement.section === "architecture-application-surface",
);
const openKeys = [] as const;

assert.deepEqual(APPLICATION_SURFACE_SUMMARY, {
  total: 45,
  verified: 37,
  notApplicable: 8,
  open: 0,
  pages: 97,
  httpMethods: 106,
  serverActions: 79,
  scheduledDestinations: 7,
});
assert.equal(recordsByKey.size, APPLICATION_SURFACE_INVENTORY.length);
assert.deepEqual(
  APPLICATION_SURFACE_INVENTORY.map((record) => record.requirementId).toSorted(),
  requirements.map((requirement) => requirement.id).toSorted(),
  "every immutable application-surface requirement needs an explicit decision",
);
assert.deepEqual(
  APPLICATION_SURFACE_INVENTORY.filter((record) => record.status === "open")
    .map((record) => record.key)
    .toSorted(),
  [...openKeys].toSorted(),
);
assert.equal(Object.keys(APPLICATION_SURFACE_MASTER_EVIDENCE).length, 45);

for (const record of APPLICATION_SURFACE_INVENTORY) {
  assert.equal(new Set(record.members).size, record.members.length);
  assert.deepEqual(record.members, record.members.toSorted());

  if (record.status === "verified") {
    assert.ok(record.members.length > 0, `${record.key} needs non-vacuous members`);
    assert.equal(record.justification, undefined);
    assert.equal(record.knownGap, undefined);
  } else if (record.status === "not-applicable-with-justification") {
    assert.deepEqual(record.members, []);
    assert.ok(record.justification?.trim());
    assert.equal(record.knownGap, undefined);
  } else {
    assert.deepEqual(record.members, []);
    assert.deepEqual(record.sourceBasis, []);
    assert.ok(record.knownGap?.trim());
    assert.equal(record.justification, undefined);
  }

  for (const evidencePath of record.sourceBasis) {
    assert.ok(existsSync(evidencePath), `${record.key}: missing ${evidencePath}`);
  }

  const requirement = requirements.find(
    (candidate) => candidate.id === record.requirementId,
  );
  assert.ok(requirement);
  assert.equal(
    isMasterRequirementComplete(requirement),
    record.status !== "open",
    `${record.requirementId} completion must follow the tested decision`,
  );

  if (record.status === "open") {
    assert.equal(SECURITY_MASTER_EVIDENCE[record.requirementId], undefined);
    assert.equal(APPLICATION_SURFACE_MASTER_EVIDENCE[record.requirementId], undefined);
    continue;
  }

  const expectedEvidence = {
    status: record.status,
    evidence: APPLICATION_SURFACE_EVIDENCE_PATHS,
    ...(record.justification
      ? { notApplicableJustification: record.justification }
      : {}),
  };
  assert.deepEqual(
    APPLICATION_SURFACE_MASTER_EVIDENCE[record.requirementId],
    expectedEvidence,
  );
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[record.requirementId],
    expectedEvidence,
  );
}

const discoveredHttp = discoverRouteHandlers(repositoryRoot)
  .map((entry) => `${entry.method} ${entry.route}`)
  .toSorted();
const discoveredActions = discoverServerActions(repositoryRoot)
  .map((entry) => `ACTION ${entry.procedure}`)
  .toSorted();
const registeredPages = SCREEN_CONTRACTS.map(
  (screen) => `PAGE ${screen.route}`,
).toSorted();
assert.deepEqual(record("route-handler").members, discoveredHttp);
assert.deepEqual(record("server-action").members, discoveredActions);
assert.equal(discoveredHttp.length, 106);
assert.equal(discoveredActions.length, 79);
assert.equal(registeredPages.length, 97);

const expectedPublic = [
  ...SCREEN_CONTRACTS.filter(
    (screen) => screen.authentication !== "required",
  ).map((screen) => `PAGE ${screen.route}`),
  ...OPENAPI_ENDPOINT_AUTHENTICATION.filter((entry) =>
    ["public", "optional"].includes(entry.authentication),
  ).map((entry) => `${entry.method} ${entry.route}`),
].toSorted();
const expectedAuthenticated = [
  ...SCREEN_CONTRACTS.filter(
    (screen) => screen.authentication === "required",
  ).map((screen) => `PAGE ${screen.route}`),
  ...OPENAPI_ENDPOINT_AUTHENTICATION.filter(
    (entry) => !["public", "optional"].includes(entry.authentication),
  ).map((entry) => `${entry.method} ${entry.route}`),
].toSorted();
assert.deepEqual(record("public-route").members, expectedPublic);
assert.deepEqual(record("authenticated-route").members, expectedAuthenticated);
assert.deepEqual(
  [...record("public-route").members, ...record("authenticated-route").members]
    .toSorted(),
  [...registeredPages, ...discoveredHttp].toSorted(),
);
assert.equal(
  record("public-route").members.some((member) =>
    record("authenticated-route").members.includes(member),
  ),
  false,
);

assert.deepEqual(
  record("api-route").members,
  discoveredHttp.filter((member) => /^\w+ \/api\//.test(member)),
);
assert.deepEqual(
  record("administration-route").members,
  registeredPages.filter((member) => member.startsWith("PAGE /admin")),
);
assert.deepEqual(
  record("dynamic-route").members,
  [
    ...SCREEN_CONTRACTS.filter(
      (screen) => screen.dynamicParameters.length > 0,
    ).map((screen) => `PAGE ${screen.route}`),
    ...discoveredHttp.filter((member) => member.includes("[")),
  ].toSorted(),
);

for (const [applicationKey, apiKey] of [
  ["rest", "rest"],
  ["upload", "upload"],
  ["download", "download"],
  ["auth-callback", "auth-callback"],
  ["internal-service", "internal"],
  ["scheduled-task", "cron"],
  ["cron", "cron"],
  ["ai-tool", "ai-tool"],
] as const) {
  assert.deepEqual(
    record(applicationKey).members.toSorted(),
    apiRecord(apiKey).members.toSorted(),
  );
}
assert.deepEqual(record("signed-upload").members, [
  "POST /api/media/sign-upload",
]);
assert.deepEqual(record("payment-webhook").members, [
  "POST /api/webhooks/lago",
  "POST /api/webhooks/stripe",
]);
assert.deepEqual(record("provider-webhook").members, [
  "POST /api/livekit/webhook",
]);
assert.deepEqual(record("payment-return").members, [
  "PAGE /account/billing",
  "PAGE /account/pages",
  "PAGE /pricing",
]);
assert.deepEqual(record("design-lab-simulation").members, [
  "PAGE /design-lab",
  "PAGE /design-lab/demo-experience",
  "PAGE /design-lab/dock-skins",
  "PAGE /design-lab/role-blueprints",
]);
assert.deepEqual(record("rpc").members, RPC_CALL_MEMBERS);
assert.deepEqual(record("queue-publisher").members, QUEUE_PUBLISHER_MEMBERS);
assert.deepEqual(record("queue-consumer").members, QUEUE_CONSUMER_MEMBERS);
assert.deepEqual(record("worker").members, BACKGROUND_WORKER_MEMBERS);
assert.deepEqual(record("database-trigger").members, DATABASE_TRIGGER_MEMBERS);
assert.deepEqual(record("database-function").members, DATABASE_FUNCTION_MEMBERS);
assert.deepEqual(record("search-index").members, SEARCH_INDEX_OPERATION_MEMBERS);
assert.deepEqual(record("cache").members, CACHE_OPERATION_MEMBERS);
assert.deepEqual(record("websocket").members, REALTIME_CONNECTION_MEMBERS);
assert.deepEqual(record("websocket-event").members, REALTIME_EVENT_MEMBERS);
assert.deepEqual(record("admin-cli").members, ADMIN_CLI_MEMBERS);
assert.deepEqual(record("client-search").members, CLIENT_SEARCH_MEMBERS);
assert.deepEqual(
  record("email-worker-search").members,
  EMAIL_WORKER_SEARCH_MEMBERS,
);
assert.deepEqual(record("worker").members, apiRecord("worker").members);
assert.deepEqual(
  record("queue-consumer").members,
  apiRecord("queue-consumer").members,
);

const schedulerSource = [
  "scripts/gcp-cloud-run-deploy.ps1",
  "scripts/gcp-scheduler-sync.sh",
  ".github/workflows/live-sync.yml",
]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
for (const member of record("cron").members) {
  assert.match(schedulerSource, new RegExp(escapeRegExp(member.slice(5))));
}

const stripeSource = readFileSync("src/lib/billing/stripe-service.ts", "utf8");
for (const route of ["/account/billing", "/account/pages", "/pricing"]) {
  assert.match(stripeSource, new RegExp(`new URL\\(\"${escapeRegExp(route)}\"`));
}

const packageSource = readFileSync("package.json", "utf8");
assert.doesNotMatch(packageSource, /"(?:graphql|@apollo\/|@trpc\/)/i);
assert.equal(
  ENDPOINTS.some((endpoint) => /graphql/i.test(endpoint.routeOrProcedure)),
  false,
);
assert.equal(
  [...registeredPages, ...discoveredHttp].some((member) =>
    /\/(?:debug|diagnostics)(?:\/|$)/i.test(member),
  ),
  false,
);
assert.ok(ENDPOINTS.every((endpoint) => endpoint.version === "unversioned"));
assert.equal(
  ENDPOINTS.some((endpoint) => /\/api\/v\d+(?:\/|$)/i.test(endpoint.routeOrProcedure)),
  false,
);
assert.match(readFileSync("src/lib/realtime-service.ts", "utf8"), /\.rpc\s*\(/);

assert.equal(
  readFileSync("docs/security/application-surface-inventory.md", "utf8"),
  renderApplicationSurfaceInventoryMarkdown(),
);

console.log(
  `Application surface inventory passed: 45/45 source-static decisions complete; ${registeredPages.length} pages, ${discoveredHttp.length} HTTP methods, ${discoveredActions.length} server actions, ${REALTIME_CONNECTION_MEMBERS.length} realtime connections, ${REALTIME_EVENT_MEMBERS.length} realtime event bindings and ${ADMIN_CLI_MEMBERS.length} administrative CLI entries bound`,
);

function record(key: string) {
  const value = recordsByKey.get(key);
  assert.ok(value, `${key} must exist in the application-surface inventory`);
  return value;
}

function apiRecord(key: string) {
  const value = API_SURFACE_INVENTORY.find((candidate) => candidate.key === key);
  assert.ok(value, `${key} must exist in the API-surface inventory`);
  return value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
