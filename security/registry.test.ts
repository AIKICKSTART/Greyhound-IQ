import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { AUDIT_EVENTS } from "./audit-events";
import { DATA_CLASSIFICATIONS } from "./data-classification";
import {
  DATABASE_OPERATIONS,
  type DatabaseOperationContract,
  validateDatabaseOperationLinks,
} from "./database-operations";
import {
  ENDPOINTS,
  OPENAPI_ENDPOINT_AUTHENTICATION,
  type EndpointContract,
  discoverRouteHandlers,
  discoverServerActions,
  validateEndpointRegistry,
} from "./endpoints";
import { SECURITY_POLICIES } from "./policies";
import { RATE_LIMITS } from "./rate-limits";
import { THIRD_PARTIES } from "./third-parties";
import { SECURITY_TRACES, type SecurityTraceContract } from "./traces";

const repoRoot = process.cwd();
const routeHandlers = discoverRouteHandlers(repoRoot);
const serverActions = discoverServerActions(repoRoot);

assert.ok(routeHandlers.length > 0, "route handler discovery must find endpoints");
assert.ok(serverActions.length > 0, "server action discovery must find actions");
assert.ok(
  !routeHandlers.some(
    (entry) =>
      entry.method === "PUT" &&
      entry.route === "/api/media/[id]/local-upload"
  ),
  "the permanently retired local-upload route must remain absent"
);
assert.equal(
  ENDPOINTS.length,
  routeHandlers.length + serverActions.length,
  "every discovered route method and server action must be inventoried"
);
assert.equal(
  OPENAPI_ENDPOINT_AUTHENTICATION.length,
  routeHandlers.length,
  "every discovered HTTP operation must have an OpenAPI authentication contract"
);
const optionalOpenApiEndpoints = OPENAPI_ENDPOINT_AUTHENTICATION.filter(
  (entry) => entry.authentication === "optional"
);
assert.equal(optionalOpenApiEndpoints.length, 6);
for (const entry of optionalOpenApiEndpoints) {
  assert.deepEqual(entry.security, [{ WorkOSSession: [] }, {}]);
}
assert.deepEqual(
  OPENAPI_ENDPOINT_AUTHENTICATION.find(
    (entry) => entry.route === "/api/analytics/onboarding" && entry.method === "POST",
  )?.security,
  [{ OnboardingAnalyticsConsent: [] }],
  "the public analytics write must retain its source-required consent request guard",
);
for (const entry of OPENAPI_ENDPOINT_AUTHENTICATION.filter(
  (candidate) =>
    candidate.authentication !== "public" &&
    candidate.authentication !== "optional"
)) {
  assert.ok(
    entry.security.every((requirement) => Object.keys(requirement).length > 0),
    `${entry.endpointId} must not permit anonymous authentication`
  );
}

const routeFiles = walkFiles(path.join(repoRoot, "src", "app"))
  .filter((file) => path.basename(file) === "route.ts")
  .map((file) => repoPath(file));
const discoveredRouteFiles = new Set(routeHandlers.map((entry) => entry.sourceFile));
for (const routeFile of routeFiles) {
  assert.ok(
    discoveredRouteFiles.has(routeFile),
    `${routeFile} has no discovered HTTP method export`
  );
}

assert.ok(
  routeHandlers.some((entry) => !entry.route.startsWith("/api/")),
  "non-API route handlers must be included"
);
assert.ok(
  serverActions.some((entry) => entry.procedure === "src/components/site-header.tsx#signOutAction"),
  "inline server actions must be included"
);

assert.deepEqual(
  validateEndpointRegistry(ENDPOINTS, repoRoot),
  [],
  "the live inventory must have no structural registry errors"
);
assert.ok(
  validateEndpointRegistry(ENDPOINTS, repoRoot, {
    includeCoverageGaps: true,
  }).some((issue) => issue.code === "AUTHENTICATION_NOT_VERIFIED"),
  "unreviewed endpoints must remain visible as authentication coverage gaps"
);

const requiredTraces = [
  "AUTH.CALLBACK.RECOVER",
  "AUTH.CALLBACK.COMPLETE",
  "BILLING.WEBHOOK.PROCESS",
  "PULSE.CONVERSATION.BLOCK",
  "MEDIA.ASSET.READ",
  "MEDIA.ASSET.DELETE",
  "DESIGN_LAB.SCREEN.REVIEW",
  "ACCOUNT.DELETION.EXECUTE",
  "ACCOUNT.DATA_EXPORT.DOWNLOAD",
  "PUBLIC.HOME.READ",
  "SUPPORT.TICKET.CREATE",
  "AUTH.SIGN_IN.START",
  "ACCOUNT.PROTECTED.SIGNED_OUT_DENY",
  "RACING.RACE.SEARCH",
  "RACING.RACE.OPEN",
  "RACING.DOG.OPEN",
  "RACING.TRACK.OPEN",
] as const;
const traceIds = new Set(SECURITY_TRACES.map((trace) => trace.traceId));
for (const traceId of requiredTraces) {
  assert.ok(traceIds.has(traceId), `${traceId} must be seeded`);
}
const callbackCompleteTrace = SECURITY_TRACES.find(
  (trace) => trace.traceId === "AUTH.CALLBACK.COMPLETE"
);
assert.deepEqual(
  validateAuthCallbackCompleteTrace(callbackCompleteTrace, repoRoot),
  [],
  "AUTH.CALLBACK.COMPLETE must retain every source-evidenced stage and explicit unverified boundary"
);
assert.deepEqual(
  callbackCompleteTrace?.databaseOperations.map((operation) => operation.queryId),
  [
    "DB.AUTH.CALLBACK.ACCEPTANCE.TRANSACTION",
    "DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER",
    "DB.AUTH.SIGNUP_OUTBOX.CLAIM",
    "DB.AUTH.SIGNUP_OUTBOX.SETTLE",
  ]
);
const authKitCallbackSource = readFileSync(
  path.join(
    repoRoot,
    "node_modules/@workos-inc/authkit-nextjs/src/authkit-callback-route.ts"
  ),
  "utf8"
);
const authKitRedirectSource = readFileSync(
  path.join(repoRoot, "node_modules/@workos-inc/authkit-nextjs/src/utils.ts"),
  "utf8"
);
const nextResponseSource = readFileSync(
  path.join(
    repoRoot,
    "node_modules/next/dist/server/web/spec-extension/response.js"
  ),
  "utf8"
);
const authSyncSource = readFileSync(
  path.join(repoRoot, "src/lib/auth-sync.ts"),
  "utf8"
);
const prismaSchemaSource = readFileSync(
  path.join(repoRoot, "prisma/schema.prisma"),
  "utf8"
);
assert.match(authKitCallbackSource, /redirectWithFallback\(url\.toString\(\)\)/);
assert.match(
  authKitRedirectSource,
  /NextResponse\.redirect\(redirectUri, \{ headers \}\)/
);
assert.match(nextResponseSource, /init\.status\) \?\? 307/);
const restorationAuditStart = authSyncSource.indexOf("if (wasDeletionPending)");
const restorationAuditEnd = authSyncSource.indexOf(
  "return ensureProfile",
  restorationAuditStart
);
assert.ok(restorationAuditStart >= 0 && restorationAuditEnd > restorationAuditStart);
const restorationAuditSource = authSyncSource.slice(
  restorationAuditStart,
  restorationAuditEnd
);
const auditLogSchemaStart = prismaSchemaSource.indexOf("model AuditLog {");
const auditLogSchemaEnd = prismaSchemaSource.indexOf(
  "model AdminAction {",
  auditLogSchemaStart
);
assert.ok(auditLogSchemaStart >= 0 && auditLogSchemaEnd > auditLogSchemaStart);
const auditLogSchema = prismaSchemaSource.slice(
  auditLogSchemaStart,
  auditLogSchemaEnd
);
for (const column of [
  "actorId",
  "actorType",
  "action",
  "targetType",
  "targetId",
  "metadata",
]) {
  assert.match(restorationAuditSource, new RegExp(`\\b${column}:`));
  assert.match(auditLogSchema, new RegExp(`\\b${column}\\s+`));
}
assert.doesNotMatch(restorationAuditSource, /\b(?:ip|userAgent):/);
for (const eventId of callbackCompleteTrace?.auditEvents ?? []) {
  const event = AUDIT_EVENTS.find((candidate) => candidate.eventId === eventId);
  assert.ok(event, `${eventId} must exist for AUTH.CALLBACK.COMPLETE`);
  assert.ok(
    event.traceIds.some((traceId) => traceId === "AUTH.CALLBACK.COMPLETE"),
    `${eventId} must link back to AUTH.CALLBACK.COMPLETE`
  );
}
const localAcceptanceFailureEvent = AUDIT_EVENTS.find(
  (event) => event.eventId === "AUDIT.AUTH.CALLBACK.LOCAL_ACCEPTANCE_FAILED"
);
assert.deepEqual(localAcceptanceFailureEvent?.traceIds, ["AUTH.CALLBACK.COMPLETE"]);
assert.equal(localAcceptanceFailureEvent?.eventName, "auth.callback_sync_failed");
assert.ok(localAcceptanceFailureEvent?.prohibitedFields.includes("email"));
assert.ok(localAcceptanceFailureEvent?.prohibitedFields.includes("provider payload"));
assert.ok(localAcceptanceFailureEvent?.prohibitedFields.includes("raw error"));
assert.ok(localAcceptanceFailureEvent?.safeFields.includes("errorCode"));
assert.ok(localAcceptanceFailureEvent?.safeFields.includes("errorClass"));
assert.ok(localAcceptanceFailureEvent?.safeFields.includes("severity"));
assert.ok(localAcceptanceFailureEvent?.safeFields.includes("message"));
assert.equal(localAcceptanceFailureEvent?.verificationStatus, "Partially verified");

assert.ok(callbackCompleteTrace, "AUTH.CALLBACK.COMPLETE fixture must exist");
const missingWorkerStage = {
  ...callbackCompleteTrace,
  backgroundOperations: [],
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(missingWorkerStage, repoRoot).some(
    (issue) => issue === "MISSING_STAGE:async-worker"
  )
);
const unsafeOutboxField = {
  ...callbackCompleteTrace,
  databaseOperations: callbackCompleteTrace.databaseOperations.map((operation) =>
    operation.queryId === "DB.AUTH.SIGNUP_OUTBOX.CLAIM"
      ? {
          ...operation,
          columnsWritten: [...operation.columnsWritten, "SignupOutbox.email"],
        }
      : operation
  ),
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(unsafeOutboxField, repoRoot).some(
    (issue) => issue === "UNSAFE_OUTBOX_FIELD:SignupOutbox.email"
  )
);
const removedExpiredRowBound = {
  ...callbackCompleteTrace,
  databaseOperations: callbackCompleteTrace.databaseOperations.map((operation) =>
    operation.queryId === "DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER"
      ? {
          ...operation,
          maximumRowCount: null,
          expectedRowCount: "unbounded",
        }
      : operation
  ),
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(removedExpiredRowBound, repoRoot).some(
    (issue) =>
      issue ===
      "FALSE_ROW_BOUND:DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER"
  )
);
const incompleteAuditColumns = {
  ...callbackCompleteTrace,
  databaseOperations: callbackCompleteTrace.databaseOperations.map((operation) =>
    operation.queryId === "DB.AUTH.CALLBACK.ACCEPTANCE.TRANSACTION"
      ? {
          ...operation,
          columnsWritten: operation.columnsWritten.filter(
            (column) => column !== "AuditLog.metadata"
          ),
        }
      : operation
  ),
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(incompleteAuditColumns, repoRoot).some(
    (issue) => issue === "INCOMPLETE_AUDIT_LOG_COLUMNS:AuditLog.metadata"
  )
);
const wrongRedirectStatus = {
  ...callbackCompleteTrace,
  response: { ...callbackCompleteTrace.response, successStatus: 302 },
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(wrongRedirectStatus, repoRoot).some(
    (issue) => issue === "REDIRECT_STATUS_MISMATCH:success"
  )
);
const danglingUserStory = {
  ...callbackCompleteTrace,
  userStoryIds: ["AUTH.CALLBACK.CREATE_OR_RESUME_SESSION"],
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(danglingUserStory, repoRoot).some(
    (issue) =>
      issue ===
      "USER_STORY_REFERENCE_MISSING:AUTH.CALLBACK.CREATE_OR_RESUME_SESSION"
  )
);
const danglingScreen = {
  ...callbackCompleteTrace,
  screenIds: ["auth-error"],
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(danglingScreen, repoRoot).some(
    (issue) => issue === "SCREEN_REFERENCE_MISSING:auth-error"
  )
);
const unsafeWorkerPayload = {
  ...callbackCompleteTrace,
  backgroundOperations: callbackCompleteTrace.backgroundOperations.map(
    (operation) => ({
      ...operation,
      payloadSchema: "{ userId, idempotencyKey, correlationId, attempt, email }",
    })
  ),
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(unsafeWorkerPayload, repoRoot).some(
    (issue) => issue === "UNSAFE_OUTBOX_FIELD:email"
  )
);
const unsafeLogField = {
  ...callbackCompleteTrace,
  failureModes: callbackCompleteTrace.failureModes.map((failure, index) =>
    index === 0
      ? { ...failure, serverLogEvent: "auth.callback_failed email=user@example.test" }
      : failure
  ),
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(unsafeLogField, repoRoot).some(
    (issue) => issue.startsWith("UNSAFE_LOG_EVENT:")
  )
);
const orphanEvidence = {
  ...callbackCompleteTrace,
  evidence: [...callbackCompleteTrace.evidence, "Evidence file: security/not-real.ts"],
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(orphanEvidence, repoRoot).some(
    (issue) => issue === "EVIDENCE_FILE_MISSING:security/not-real.ts"
  )
);
const runtimeOverclaim = {
  ...callbackCompleteTrace,
  verificationStatus: "Verified",
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(runtimeOverclaim, repoRoot).some(
    (issue) => issue === "RUNTIME_OVERCLAIM:verificationStatus"
  )
);
const missingProviderBoundary = {
  ...callbackCompleteTrace,
  evidence: callbackCompleteTrace.evidence.filter(
    (entry) => !entry.startsWith("Unverified provider boundary:")
  ),
} satisfies SecurityTraceContract;
assert.ok(
  validateAuthCallbackCompleteTrace(missingProviderBoundary, repoRoot).some(
    (issue) => issue === "RUNTIME_OVERCLAIM:provider-boundary"
  )
);
assert.equal(
  SECURITY_TRACES.find((trace) => trace.traceId === "DESIGN_LAB.SCREEN.REVIEW")
    ?.verificationStatus,
  "Partially verified",
  "production Design Lab reviewer authentication must retain explicit evidence and residual gaps"
);
const deletionTrace = SECURITY_TRACES.find(
  (trace) => trace.traceId === "ACCOUNT.DELETION.EXECUTE"
);
assert.match(
  deletionTrace?.evidence.join(" ") ?? "",
  /WorkOS.*Stripe.*session|WorkOS identity\/session revocation and Stripe/
);
assert.match(deletionTrace?.evidence.join(" ") ?? "", /Managed-page/);
const exportTrace = SECURITY_TRACES.find(
  (trace) => trace.traceId === "ACCOUNT.DATA_EXPORT.DOWNLOAD"
);
assert.match(exportTrace?.evidence.join(" ") ?? "", /asynchronous export/);
const exportOwnerInsertPolicy = readFileSync(
  path.join(
    repoRoot,
    "prisma",
    "migrations",
    "20260713173000_allow_owned_user_export_artifacts",
    "migration.sql"
  ),
  "utf8"
);
assert.match(exportOwnerInsertPolicy, /FOR INSERT/);
assert.match(
  exportOwnerInsertPolicy,
  /"targetUserId" = public\.giq_current_user_id\(\)/
);
assert.match(
  exportOwnerInsertPolicy,
  /"requestedByUserId" = public\.giq_current_user_id\(\)/
);
assert.doesNotMatch(exportOwnerInsertPolicy, /FOR ALL|FOR UPDATE|FOR DELETE|\bUSING\s*\(/);

assert.deepEqual(
  validateDatabaseOperationLinks(DATABASE_OPERATIONS, traceIds),
  [],
  "every database operation must link to a registered trace"
);
for (const trace of SECURITY_TRACES) {
  for (const operation of trace.databaseOperations) {
    assert.equal(operation.traceId, trace.traceId);
    assert.ok(
      DATABASE_OPERATIONS.some((candidate) => candidate.queryId === operation.queryId),
      `${operation.queryId} must use the authoritative database operation registry`
    );
  }
}

assertUnique(ENDPOINTS, (entry) => entry.endpointId, "endpoint ID");
assertUnique(SECURITY_TRACES, (entry) => entry.traceId, "trace ID");
assertUnique(DATABASE_OPERATIONS, (entry) => entry.queryId, "database query ID");
assertUnique(SECURITY_POLICIES, (entry) => entry.policyId, "policy ID");
assertUnique(AUDIT_EVENTS, (entry) => entry.eventId, "audit event ID");
assertUnique(DATA_CLASSIFICATIONS, (entry) => entry.id, "data classification ID");
assertUnique(RATE_LIMITS, (entry) => entry.rateLimitId, "rate-limit ID");
assertUnique(THIRD_PARTIES, (entry) => entry.providerId, "third-party ID");

for (const [label, entries] of [
  ["endpoints", ENDPOINTS],
  ["traces", SECURITY_TRACES],
  ["database operations", DATABASE_OPERATIONS],
  ["policies", SECURITY_POLICIES],
  ["audit events", AUDIT_EVENTS],
  ["data classifications", DATA_CLASSIFICATIONS],
  ["rate limits", RATE_LIMITS],
  ["third parties", THIRD_PARTIES],
] as const) {
  assert.ok(entries.length > 0, `${label} registry must not be empty`);
}

for (const entry of ENDPOINTS) assertSourceExists(entry.sourceFile);
for (const operation of DATABASE_OPERATIONS) assertSourceExists(operation.sourceFile);
for (const trace of SECURITY_TRACES) {
  for (const sourceFile of [
    ...trace.frontend.sourceFiles,
    ...trace.server.entryFiles,
    ...trace.tests,
  ]) {
    assertSourceExists(sourceFile);
  }
}

// Prove the validators reject each release-relevant drift mode.
const protectedDynamic = ENDPOINTS.find(
  (entry) =>
    entry.protocol === "http" &&
    entry.authentication === "required" &&
    entry.routeOrProcedure.includes("[")
);
assert.ok(protectedDynamic, "a protected dynamic endpoint fixture must exist");

const duplicateIssues = validateEndpointRegistry(
  [protectedDynamic, { ...protectedDynamic }],
  repoRoot
);
assert.ok(duplicateIssues.some((issue) => issue.code === "DUPLICATE_ENDPOINT_ID"));

const missingSource = {
  ...protectedDynamic,
  endpointId: "TEST.MISSING_SOURCE",
  sourceFile: "src/app/api/not-a-real-route/route.ts",
} satisfies EndpointContract;
assert.ok(
  validateEndpointRegistry([missingSource], repoRoot).some(
    (issue) => issue.code === "SOURCE_FILE_MISSING"
  )
);

const wrongRoute = {
  ...protectedDynamic,
  endpointId: "TEST.WRONG_ROUTE",
  routeOrProcedure: "/api/not-the-source-route",
} satisfies EndpointContract;
assert.ok(
  validateEndpointRegistry([wrongRoute], repoRoot).some(
    (issue) => issue.code === "ROUTE_SOURCE_MISMATCH"
  )
);

const missingAuthorization = {
  ...protectedDynamic,
  endpointId: "TEST.MISSING_AUTHORIZATION",
  authorizationPolicy: undefined,
} satisfies EndpointContract;
assert.ok(
  validateEndpointRegistry([missingAuthorization], repoRoot).some(
    (issue) => issue.code === "PROTECTED_AUTHORIZATION_MISSING"
  )
);

const missingObjectAuthorization = {
  ...protectedDynamic,
  endpointId: "TEST.MISSING_OBJECT_AUTHORIZATION",
  objectLevelPolicy: null,
} satisfies EndpointContract;
assert.ok(
  validateEndpointRegistry([missingObjectAuthorization], repoRoot).some(
    (issue) => issue.code === "OBJECT_AUTHORIZATION_MISSING"
  )
);

const missingHandler = {
  ...protectedDynamic,
  endpointId: "TEST.MISSING_HANDLER",
  handler: "thisHandlerDoesNotExist",
} satisfies EndpointContract;
assert.ok(
  validateEndpointRegistry([missingHandler], repoRoot).some(
    (issue) => issue.code === "HANDLER_SYMBOL_MISSING"
  )
);

const unlinkedDatabaseOperation = {
  ...DATABASE_OPERATIONS[0],
  queryId: "DB.TEST.UNLINKED",
  traceId: "TRACE.THAT.DOES.NOT.EXIST",
} satisfies DatabaseOperationContract;
assert.ok(
  validateDatabaseOperationLinks([unlinkedDatabaseOperation], traceIds).some(
    (issue) => issue.code === "TRACE_MISSING"
  )
);

console.log(
  `security registry tests passed: ${routeHandlers.length} route methods, ${serverActions.length} server actions, ${SECURITY_TRACES.length} seeded traces, ${DATABASE_OPERATIONS.length} database operations`
);

function assertUnique<T>(
  entries: readonly T[],
  idFor: (entry: T) => string,
  label: string
) {
  const ids = entries.map(idFor);
  assert.equal(new Set(ids).size, ids.length, `${label}s must be unique`);
}

function assertSourceExists(sourceFile: string) {
  assert.ok(existsSync(path.join(repoRoot, sourceFile)), `${sourceFile} must exist`);
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

function repoPath(file: string) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

function validateAuthCallbackCompleteTrace(
  trace: SecurityTraceContract | undefined,
  root: string
) {
  if (!trace) return ["MISSING_STAGE:trace"];

  const issues: string[] = [];
  const queryIds = new Set(
    trace.databaseOperations.map((operation) => operation.queryId)
  );
  const stageChecks: readonly [string, boolean][] = [
    [
      "input",
      trace.actors.length > 0 &&
        trace.routePatterns.includes("/callback") &&
        trace.frontend.sourceFiles.length > 0,
    ],
    [
      "transport",
      trace.transport.method === "GET" &&
        trace.transport.pathOrProcedure === "/callback" &&
        trace.transport.protocol.length > 0,
    ],
    [
      "server-entry",
      trace.server.entryFiles.includes("src/app/callback/route.ts") &&
        trace.server.handlers.includes("GET.onSuccess"),
    ],
    [
      "authority-validation",
      trace.authentication === "public" &&
        trace.requiredPermissions.length > 0 &&
        trace.server.authenticationFunction.length > 0 &&
        trace.server.authorizationPolicy === "POLICY.AUTH.CALLBACK.WORKOS" &&
        trace.server.requestValidationSchema.length > 0,
    ],
    [
      "transaction-rls",
      queryIds.has("DB.AUTH.CALLBACK.ACCEPTANCE.TRANSACTION") &&
        trace.databaseOperations.some((operation) =>
          operation.rowLevelSecurityPolicies.includes("giq_signup_outbox_system")
        ),
    ],
    [
      "data-outbox",
      trace.server.repositoryMethods.some((method) =>
        method.includes("tx.signupOutbox.upsert")
      ),
    ],
    [
      "response",
      trace.response.permittedFields.includes("Location") &&
        trace.response.frontendSuccessState.length > 0,
    ],
    ["recovery", trace.failureModes.length >= 3],
    [
      "async-worker",
      trace.backgroundOperations.length > 0 &&
        queryIds.has("DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER") &&
        queryIds.has("DB.AUTH.SIGNUP_OUTBOX.CLAIM") &&
        queryIds.has("DB.AUTH.SIGNUP_OUTBOX.SETTLE") &&
        trace.server.handlers.includes("processSignupAcceptanceBatch"),
    ],
    [
      "external-provider",
      trace.externalOperations.some((operation) => operation.provider === "WorkOS"),
    ],
  ];
  for (const [stage, present] of stageChecks) {
    if (!present) issues.push(`MISSING_STAGE:${stage}`);
  }

  const expiredCleanup = trace.databaseOperations.find(
    (operation) =>
      operation.queryId ===
      "DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER"
  );
  if (
    !expiredCleanup ||
    expiredCleanup.maximumRowCount !== 1 ||
    !expiredCleanup.normalizedSql?.includes("FOR UPDATE SKIP LOCKED LIMIT $4") ||
    /unbounded/i.test(expiredCleanup.expectedRowCount)
  ) {
    issues.push(
      "FALSE_ROW_BOUND:DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER"
    );
  }
  for (const queryId of [
    "DB.AUTH.SIGNUP_OUTBOX.CLAIM",
    "DB.AUTH.SIGNUP_OUTBOX.SETTLE",
  ]) {
    const operation = trace.databaseOperations.find(
      (candidate) => candidate.queryId === queryId
    );
    if (!operation || operation.maximumRowCount !== 1) {
      issues.push(`FALSE_ROW_BOUND:${queryId}`);
    }
  }

  const acceptanceOperation = trace.databaseOperations.find(
    (operation) =>
      operation.queryId === "DB.AUTH.CALLBACK.ACCEPTANCE.TRANSACTION"
  );
  const expectedAuditColumns = new Set([
    "AuditLog.actorId",
    "AuditLog.actorType",
    "AuditLog.action",
    "AuditLog.targetType",
    "AuditLog.targetId",
    "AuditLog.metadata",
  ]);
  const recordedAuditColumns = new Set(
    acceptanceOperation?.columnsWritten.filter((column) =>
      column.startsWith("AuditLog.")
    ) ?? []
  );
  for (const column of expectedAuditColumns) {
    if (!recordedAuditColumns.has(column)) {
      issues.push(`INCOMPLETE_AUDIT_LOG_COLUMNS:${column}`);
    }
  }
  for (const column of recordedAuditColumns) {
    if (!expectedAuditColumns.has(column)) {
      issues.push(`UNEXPECTED_AUDIT_LOG_COLUMN:${column}`);
    }
  }

  if (trace.response.successStatus !== 307) {
    issues.push("REDIRECT_STATUS_MISMATCH:success");
  }
  for (const failure of trace.failureModes.slice(0, 2)) {
    if (failure.externalStatus !== 307) {
      issues.push(`REDIRECT_STATUS_MISMATCH:${failure.condition}`);
    }
  }

  const storyRegistrySource = readFileSync(
    path.join(root, "src/components/demo-experience-registry.ts"),
    "utf8"
  );
  const canonicalStoryIds = new Set(
    [...storyRegistrySource.matchAll(/\bid:\s*"([^"\r\n]+\.STORY\.[^"\r\n]+)"/g)].map(
      (match) => match[1]
    )
  );
  for (const userStoryId of trace.userStoryIds) {
    if (!canonicalStoryIds.has(userStoryId)) {
      issues.push(`USER_STORY_REFERENCE_MISSING:${userStoryId}`);
    }
  }
  for (const screenId of trace.screenIds) {
    issues.push(`SCREEN_REFERENCE_MISSING:${screenId}`);
  }

  const safeOutboxFields = new Set([
    "id",
    "userId",
    "idempotencyKey",
    "correlationId",
    "status",
    "retryCount",
    "lastAttemptAt",
    "nextRetryAt",
    "leaseExpiresAt",
    "leaseToken",
    "sentAt",
    "deadLetteredAt",
    "lastErrorCode",
    "createdAt",
    "updatedAt",
  ]);
  for (const operation of trace.databaseOperations.filter((candidate) =>
    candidate.tables.includes("SignupOutbox")
  )) {
    for (const column of [
      ...operation.columnsRead,
      ...operation.columnsWritten,
    ].filter((candidate) => candidate.startsWith("SignupOutbox."))) {
      const field = column.slice("SignupOutbox.".length);
      if (!safeOutboxFields.has(field)) {
        issues.push(`UNSAFE_OUTBOX_FIELD:${column}`);
      }
    }
  }
  for (const operation of trace.backgroundOperations) {
    const match = /^\{ ([A-Za-z0-9_, ]+) \}$/.exec(operation.payloadSchema);
    const fields = match
      ? match[1].split(",").map((field) => field.trim())
      : [operation.payloadSchema];
    for (const field of fields) {
      if (!new Set(["userId", "idempotencyKey", "correlationId", "attempt"]).has(field)) {
        issues.push(`UNSAFE_OUTBOX_FIELD:${field}`);
      }
    }
  }
  for (const failure of trace.failureModes) {
    if (
      failure.serverLogEvent !== "not implemented" &&
      !/^[a-z][a-z0-9]*(?:\.[a-z0-9_]+)+$/.test(failure.serverLogEvent)
    ) {
      issues.push(`UNSAFE_LOG_EVENT:${failure.serverLogEvent}`);
    }
  }

  const evidenceFiles = new Set([
    ...trace.frontend.sourceFiles,
    ...trace.server.entryFiles,
    ...trace.tests,
    ...trace.databaseOperations.flatMap((operation) => [
      operation.sourceFile,
      ...operation.tests,
    ]),
    ...trace.evidence
      .filter((entry) => entry.startsWith("Evidence file: "))
      .map((entry) => entry.slice("Evidence file: ".length)),
  ]);
  for (const evidenceFile of evidenceFiles) {
    const absolute = path.resolve(root, evidenceFile);
    const relative = path.relative(root, absolute);
    if (
      path.isAbsolute(evidenceFile) ||
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      !existsSync(absolute)
    ) {
      issues.push(`EVIDENCE_FILE_MISSING:${evidenceFile}`);
    }
  }

  if (trace.verificationStatus !== "Partially verified") {
    issues.push("RUNTIME_OVERCLAIM:verificationStatus");
  }
  const evidence = trace.evidence.join("\n");
  for (const boundary of [
    "provider",
    "runtime",
    "database",
    "worker",
    "logging",
  ]) {
    if (!evidence.includes(`Unverified ${boundary} boundary:`)) {
      issues.push(`RUNTIME_OVERCLAIM:${boundary}-boundary`);
    }
  }
  if (!evidence.includes("Unverified product-story boundary:")) {
    issues.push("RUNTIME_OVERCLAIM:product-story-boundary");
  }
  if (!evidence.includes("Unverified screen boundary:")) {
    issues.push("SCREEN_REFERENCE_MISSING:absence-not-explicit");
  }
  return issues;
}
