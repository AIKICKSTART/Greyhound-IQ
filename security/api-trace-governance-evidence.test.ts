import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { ADMIN_AUTHORIZATION_INVENTORY } from "../src/app/admin/admin-authorization-inventory";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { AUDIT_EVENTS } from "./audit-events";
import {
  API_TRACE_GOVERNANCE_MASTER_EVIDENCE,
  MANDATORY_ACTION_TRACE_COVERAGE,
  MANDATORY_ACTION_TRACE_OPEN_GAPS,
  MANDATORY_TRACE_BINDINGS,
} from "./api-trace-governance-evidence";
import {
  DATABASE_OPERATIONS,
  validateDatabaseOperationLinks,
} from "./database-operations";
import {
  ENDPOINTS,
  discoverRouteHandlers,
  discoverServerActions,
} from "./endpoints";
import {
  FINAL_TRACEABILITY_ROWS,
  buildFinalTraceabilitySummary,
  renderFinalTraceabilityMarkdown,
} from "./final-traceability";
import { SECURITY_TRACES } from "./traces";

const repositoryRoot = process.cwd();
type PromotedId = keyof typeof API_TRACE_GOVERNANCE_MASTER_EVIDENCE;
const promotedIds = Object.keys(
  API_TRACE_GOVERNANCE_MASTER_EVIDENCE,
) as PromotedId[];
const evidenceRecords = Object.values(API_TRACE_GOVERNANCE_MASTER_EVIDENCE);

assert.equal(promotedIds.length, 58);
assert.equal(
  evidenceRecords.filter((record) => record.status === "verified").length,
  55,
);
assert.equal(
  evidenceRecords.filter(
    (record) => record.status === "not-applicable-with-justification",
  ).length,
  3,
);

for (const id of promotedIds) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id} must remain an immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[id],
    API_TRACE_GOVERNANCE_MASTER_EVIDENCE[id],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);

  for (const evidencePath of API_TRACE_GOVERNANCE_MASTER_EVIDENCE[id].evidence) {
    assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
  }
}

const mandatoryActionTraceIds = [
  "security.trace.11.feed-create",
  "security.trace.12.feed-edit",
  "security.trace.13.feed-delete",
  "security.trace.14.add-comment",
  "security.trace.15.react",
  "security.trace.16.save",
  "security.trace.17.group-join",
  "security.trace.18.private-thread-open",
  "security.trace.19.conversation-start",
  "security.trace.20.send-text",
  "security.trace.22.voice-video-start",
  "security.trace.23.marketplace-search",
  "security.trace.24.marketplace-open",
  "security.trace.25.marketplace-save",
  "security.trace.26.marketplace-enquire",
  "security.trace.27.listing-draft-create",
  "security.trace.29.listing-publish",
  "security.trace.32.profile-update",
  "security.trace.33.privacy-change",
  "security.trace.34.security-change",
  "security.trace.36.invitation-accept",
  "security.trace.39.billing-checkout",
  "security.trace.41.checkout-return",
  "security.trace.42.invoice-view",
  "security.trace.45.moderator-allowed-report",
  "security.trace.46.moderator-admin-only-attempt",
  "security.trace.47.admin-user-status-change",
  "security.trace.48.admin-webhook-reprocess",
  "security.trace.49.ai-run-start",
  "security.trace.50.ai-protected-mutation-attempt",
  "security.trace.53.design-lab-simulated-destructive-action",
  "security.trace.55.blocked-user-protected-access",
] as const;
const coveredActionTraceIds = Object.keys(MANDATORY_ACTION_TRACE_COVERAGE);
const openActionTraceIds = Object.keys(MANDATORY_ACTION_TRACE_OPEN_GAPS);

assert.equal(mandatoryActionTraceIds.length, 32);
assert.equal(coveredActionTraceIds.length, 27);
assert.equal(openActionTraceIds.length, 5);
assert.deepEqual(
  [...coveredActionTraceIds, ...openActionTraceIds].toSorted(),
  [...mandatoryActionTraceIds].toSorted(),
);

for (const [id, coverage] of Object.entries(MANDATORY_ACTION_TRACE_COVERAGE)) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);

  const evidence =
    API_TRACE_GOVERNANCE_MASTER_EVIDENCE[
      id as keyof typeof API_TRACE_GOVERNANCE_MASTER_EVIDENCE
    ];
  assert.equal(evidence.status, "verified");
  const evidencePaths: readonly string[] = evidence.evidence;
  assert.ok(evidencePaths.includes(coverage.sourceFile));
  assert.match(coverage.residual, /does not prove deployed routing/i);

  const source = readFileSync(coverage.sourceFile, "utf8");
  for (const marker of coverage.sourceMarkers) {
    assert.ok(
      source.includes(marker),
      `${id}: missing source marker ${marker}`,
    );
  }
}

for (const [id, gap] of Object.entries(MANDATORY_ACTION_TRACE_OPEN_GAPS)) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  assert.equal(
    API_TRACE_GOVERNANCE_MASTER_EVIDENCE[
      id as keyof typeof API_TRACE_GOVERNANCE_MASTER_EVIDENCE
    ],
    undefined,
  );
  assert.equal(SECURITY_MASTER_EVIDENCE[id], undefined);
  assert.equal(isMasterRequirementComplete(requirement), false);
  assert.ok(gap.length > 80, `${id}: explicit source gap required`);
}

const discoveredHttp = discoverRouteHandlers(repositoryRoot);
const discoveredActions = discoverServerActions(repositoryRoot);
assert.equal(discoveredHttp.length, 106);
assert.equal(discoveredActions.length, 79);
assert.equal(ENDPOINTS.length, discoveredHttp.length + discoveredActions.length);
assert.deepEqual(
  ENDPOINTS.map(
    (endpoint) => `${endpoint.method} ${endpoint.routeOrProcedure}`,
  ).toSorted(),
  [
    ...discoveredHttp.map((entry) => `${entry.method} ${entry.route}`),
    ...discoveredActions.map((entry) => `ACTION ${entry.procedure}`),
  ].toSorted(),
);

assert.equal(hasRoute(/\/(?:debug|diagnostics)(?:\/|$)/i), false);
assert.equal(hasRoute(/\/metrics(?:\/|$)/i), false);
assert.ok(ENDPOINTS.every((endpoint) => endpoint.version === "unversioned"));
assert.equal(hasRoute(/\/api\/v\d+(?:\/|$)/i), false);
assert.equal(hasRoute(/\/api\/debug(?:\/|$)/i, [
  ...ENDPOINTS,
  { ...ENDPOINTS[0], routeOrProcedure: "/api/debug" },
]), true);
assert.equal(hasRoute(/\/metrics(?:\/|$)/i, [
  ...ENDPOINTS,
  { ...ENDPOINTS[0], routeOrProcedure: "/metrics" },
]), true);

const adminSurfaces = [
  ...ADMIN_AUTHORIZATION_INVENTORY.pages,
  ...ADMIN_AUTHORIZATION_INVENTORY.serverActions,
  ...ADMIN_AUTHORIZATION_INVENTORY.routeHandlers,
];
assert.equal(ADMIN_AUTHORIZATION_INVENTORY.pages.length, 32);
assert.equal(ADMIN_AUTHORIZATION_INVENTORY.serverActions.length, 32);
assert.equal(ADMIN_AUTHORIZATION_INVENTORY.routeHandlers.length, 1);
assert.equal(new Set(adminSurfaces.map((surface) => `${surface.kind}:${surface.id}`)).size, 65);
assert.ok(
  adminSurfaces.every(
    (surface) =>
      surface.requiredRole === "moderator" || surface.requiredRole === "admin",
  ),
);

const traceIds = SECURITY_TRACES.map((trace) => trace.traceId);
const traceIdSet = new Set(traceIds);
const traceIdPattern = /^[A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*){2,}$/;
assert.equal(traceIds.length, 19);
assert.equal(traceIdSet.size, traceIds.length);
assert.ok(traceIds.every((traceId) => traceIdPattern.test(traceId)));
assert.equal(traceIdPattern.test("not a stable trace id"), false);

assert.deepEqual(
  validateDatabaseOperationLinks(DATABASE_OPERATIONS, traceIdSet),
  [],
);
assert.equal(DATABASE_OPERATIONS.length, 27);

assert.equal(AUDIT_EVENTS.length, 22);
assert.equal(
  AUDIT_EVENTS.reduce((total, event) => total + event.traceIds.length, 0),
  10,
);
assert.equal(AUDIT_EVENTS.filter((event) => event.traceIds.length > 0).length, 9);
assert.ok(
  AUDIT_EVENTS.every(
    (event) =>
      event.traceIds.length > 0 ||
      (event.sourceFiles.length > 0 &&
        event.sourceSymbols.length > 0 &&
        event.evidence.length > 0),
  ),
);
assert.deepEqual(validateAuditTraceLinks(AUDIT_EVENTS, traceIdSet), []);
assert.deepEqual(
  validateAuditTraceLinks(
    [
      ...AUDIT_EVENTS,
      { ...AUDIT_EVENTS[0], eventId: "AUDIT.TEST.DANGLING", traceIds: ["TRACE.NOT.REGISTERED"] },
    ],
    traceIdSet,
  ),
  ["AUDIT.TEST.DANGLING:TRACE.NOT.REGISTERED"],
);

assert.deepEqual(
  FINAL_TRACEABILITY_ROWS.map((row) => row.traceId).toSorted(),
  traceIds.toSorted(),
);
assert.notDeepEqual(
  FINAL_TRACEABILITY_ROWS.slice(1)
    .map((row) => row.traceId)
    .toSorted(),
  traceIds.toSorted(),
);
assert.ok(traceIdSet.has("AUTH.CALLBACK.COMPLETE"));
assert.ok(traceIdSet.has("BILLING.WEBHOOK.PROCESS"));

for (const [requirementId, traceId] of Object.entries(
  MANDATORY_TRACE_BINDINGS,
)) {
  const trace = SECURITY_TRACES.find((candidate) => candidate.traceId === traceId);
  assert.ok(trace, `${requirementId}: missing ${traceId}`);
  assert.ok(trace.userStoryIds.length > 0, `${traceId}: missing user story`);
  assert.ok(trace.routePatterns.length > 0, `${traceId}: missing route`);
  assert.ok(trace.server.entryFiles.length > 0, `${traceId}: missing server entry`);
  assert.ok(trace.server.authorizationPolicy.trim(), `${traceId}: missing authorization policy`);
  assert.ok(trace.tests.length > 0, `${traceId}: missing focused tests`);
  assert.ok(trace.evidence.length > 0, `${traceId}: missing evidence notes`);
  for (const testPath of trace.tests) {
    assert.ok(existsSync(testPath), `${traceId}: missing ${testPath}`);
  }
}

const backgroundTrace = requiredTrace("AUTH.CALLBACK.COMPLETE");
assert.ok(
  backgroundTrace.backgroundOperations.some(
    (operation) =>
      operation.queueOrScheduler.includes("SignupOutbox") &&
      operation.jobType.includes("idempotent new-user acceptance handler"),
  ),
  "trace 51 must reach the source-evidenced SignupOutbox worker",
);
assert.ok(
  backgroundTrace.tests.includes("src/lib/signup-acceptance-worker.test.ts"),
);

const privateDownloadTrace = requiredTrace("ACCOUNT.DATA_EXPORT.DOWNLOAD");
assert.equal(privateDownloadTrace.actionType, "download");
assert.equal(privateDownloadTrace.authentication, "required");
assert.equal(
  privateDownloadTrace.server.authenticationFunction,
  "requireCurrentUserProfile",
);
assert.equal(privateDownloadTrace.response.cachePolicy, "private, no-store");
assert.match(
  readFileSync("src/app/api/users/me/export/route.ts", "utf8"),
  /attachment; filename="greyhoundiq-export-/,
);

const registryAuthorities = {
  AUDIT_EVENTS: "security/audit-events.ts",
  DATABASE_OPERATIONS: "security/database-operations.ts",
  DATA_CLASSIFICATIONS: "security/data-classification.ts",
  ENDPOINTS: "security/endpoints.ts",
  RATE_LIMITS: "security/rate-limits.ts",
  SECURITY_POLICIES: "security/policies.ts",
  SECURITY_TRACES: "security/traces.ts",
  THIRD_PARTIES: "security/third-parties.ts",
} as const;
for (const [exportName, expectedPath] of Object.entries(registryAuthorities)) {
  assert.deepEqual(findRegistryAuthorityDefinitions(exportName), [expectedPath]);
}

const acceptedRiskRecords = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    requirement.status === "risk-accepted-temporarily",
);
const generatedReport = renderFinalTraceabilityMarkdown(
  FINAL_TRACEABILITY_ROWS,
  buildFinalTraceabilitySummary({
    mandatoryTraceRequirementCount: SECURITY_MASTER_REQUIREMENTS.filter(
      (requirement) => requirement.section === "mandatory-trace",
    ).length,
    acceptedRisks: acceptedRiskRecords.length,
    expiredRiskAcceptances: acceptedRiskRecords.filter(
      (requirement) =>
        !requirement.riskAcceptance ||
        Date.parse(requirement.riskAcceptance.expiresOn) <= Date.now(),
    ).length,
  }),
);
const committedReport = readFileSync(
  "docs/security/security-trace-registry.md",
  "utf8",
).replace(/\r\n/g, "\n");
assert.equal(committedReport, generatedReport);
assert.notEqual(`${committedReport}\nstale`, generatedReport);

console.log(
  `API and trace governance evidence passed: ${promotedIds.length} requirements, ${ENDPOINTS.length} endpoints, ${DATABASE_OPERATIONS.length} database operations, ${AUDIT_EVENTS.length} audit events and ${FINAL_TRACEABILITY_ROWS.length} final trace rows bound`,
);

function hasRoute(
  pattern: RegExp,
  endpoints: readonly Pick<
    (typeof ENDPOINTS)[number],
    "routeOrProcedure"
  >[] = ENDPOINTS,
) {
  return endpoints.some((endpoint) => pattern.test(endpoint.routeOrProcedure));
}

function validateAuditTraceLinks(
  events: readonly { eventId: string; traceIds: readonly string[] }[],
  knownTraceIds: ReadonlySet<string>,
) {
  return events.flatMap((event) =>
    event.traceIds
      .filter((traceId) => !knownTraceIds.has(traceId))
      .map((traceId) => `${event.eventId}:${traceId}`),
  );
}

function findRegistryAuthorityDefinitions(exportName: string) {
  assert.match(exportName, /^[A-Z_]+$/);
  const definition = new RegExp(`export\\s+const\\s+${exportName}\\b`);
  return ["security", "src", "scripts"]
    .flatMap((directory) => walkTypeScriptFiles(directory))
    .filter((file) => !file.endsWith(".test.ts"))
    .filter((file) => definition.test(readFileSync(file, "utf8")))
    .map((file) => file.replaceAll("\\", "/"))
    .toSorted();
}

function requiredTrace(traceId: string) {
  const trace = SECURITY_TRACES.find((candidate) => candidate.traceId === traceId);
  assert.ok(trace, `${traceId}: trace missing`);
  return trace;
}

function walkTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkTypeScriptFiles(target);
    return /\.tsx?$/.test(entry.name) ? [target] : [];
  });
}
