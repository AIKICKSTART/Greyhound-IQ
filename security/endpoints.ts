import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type { VerificationStatus } from "./shared";

const HTTP_METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const;

export type EndpointAuthentication =
  | "public"
  | "required"
  | "provider-signature"
  | "internal-secret"
  | "unknown";

export type OpenApiAuthenticationStatus =
  | "public"
  | "required"
  | "optional"
  | "provider-signature"
  | "internal-secret"
  | "signed-query";

export type OpenApiEndpointAuthentication = {
  endpointId: string;
  method: (typeof HTTP_METHODS)[number];
  route: string;
  authentication: OpenApiAuthenticationStatus;
  security: Array<Record<string, []>>;
};

const PUBLIC_HTTP_ENDPOINTS = new Set([
  "POST /api/analytics/onboarding",
  "GET /api/dogs/search",
  "GET /api/forum/categories",
  "GET /api/forum/categories/[slug]/threads",
  "GET /api/forum/threads/[id]/posts",
  "GET /api/health",
  "GET /api/health/billing",
  "GET /api/health/feeds",
  "GET /api/health/ready",
  "GET /api/listings",
  "GET /api/listings/[id]",
  "GET /callback",
  "GET /sign-in",
]);

const PUBLIC_REQUEST_GUARD_SCHEMES = new Map([
  ["POST /api/analytics/onboarding", "OnboardingAnalyticsConsent"],
]);

const OPTIONAL_HTTP_ENDPOINTS = new Set([
  "GET /api/discover",
  "GET /api/feed",
  "GET /api/feed/[postId]",
  "GET /api/feed/[postId]/comments",
  "GET /api/media/[id]/blob",
  "GET /api/users/me",
]);

const PROVIDER_SIGNATURE_SCHEMES = new Map([
  ["POST /api/livekit/webhook", "LiveKitWebhookAuthorization"],
  ["POST /api/webhooks/lago", "LagoSignature"],
  ["POST /api/webhooks/stripe", "StripeSignature"],
]);

const SIGNED_QUERY_SCHEMES = new Map([
  ["GET /api/replay/stream", "ReplaySignature"],
]);

export type EndpointContract = {
  endpointId: string;
  protocol: "http" | "server-action";
  host: string;
  environment: string[];
  version: string;
  method: (typeof HTTP_METHODS)[number] | "ACTION";
  routeOrProcedure: string;
  sourceFile: string;
  handler: string;
  frontendCallers: string[];
  nonFrontendCallers: string[];
  authentication: EndpointAuthentication;
  sessionOrTokenType: string;
  csrfRequirement: string;
  corsPolicy: string;
  allowedActors: string[];
  allowedRoles: string[];
  allowedSubscriptions: string[];
  requiredPermissions: string[];
  authorizationPolicy?: string;
  objectLevelPolicy: string | null;
  propertyLevelPolicy: string | null;
  tenantPolicy: string | null;
  requestSchema: string;
  allowedInputFields: string[];
  maximumBodySize: number | null;
  maximumFileSize: number | null;
  outputSchema: string;
  allowedOutputFields: string[];
  rateLimit: string | null;
  costOrResourceBudget: string;
  idempotency: string | null;
  databaseOperations: string[];
  cacheOperations: string[];
  backgroundJobs: string[];
  externalProviders: string[];
  sensitiveData: string[];
  auditEvent: string[];
  logEvents: string[];
  errorResponses: string[];
  deprecationStatus: "active" | "deprecated" | "disabled" | "unknown";
  retirementDate: string | null;
  owner: string;
  tests: string[];
  verificationStatus: VerificationStatus;
  knownGaps: string[];
};

type EndpointOverride = Partial<EndpointContract>;

const ENDPOINT_OVERRIDES: Record<string, EndpointOverride> = {
  "POST /api/analytics/onboarding": {
    authentication: "public",
    sessionOrTokenType:
      "no identity token; official browser client requires the accepted analytics preference",
    csrfRequirement:
      "exact same-origin Origin and Sec-Fetch-Site checks plus the fixed accepted-consent header",
    corsPolicy: "same-origin POST only; no cross-origin success response",
    allowedActors: ["analytics-consenting public visitor", "analytics-consenting signed-in user"],
    requiredPermissions: [],
    authorizationPolicy: "POLICY.ONBOARDING.ANALYTICS.MINIMISED_PUBLIC_INGEST",
    objectLevelPolicy: null,
    propertyLevelPolicy:
      "strict allowlist permits schemaVersion, event, tourId and event-specific stepId only",
    tenantPolicy: null,
    requestSchema:
      "parseOnboardingAnalyticsEvent strict allowlist; nine event names, registered tour/step pairs, additional fields rejected",
    allowedInputFields: ["schemaVersion", "event", "tourId", "stepId"],
    maximumBodySize: 512,
    outputSchema: "empty 204 response",
    allowedOutputFields: [],
    rateLimit:
      "6,000 accepted attempts per global minute through the database-distributed limiter, fail closed",
    costOrResourceBudget:
      "512-byte body, one global rate-counter operation and one privacy-minimised structured INFO log; no application data query or background job",
    idempotency:
      "analytics is at-most-best-effort; duplicate allowlisted events may be counted and the client never retries",
    databaseOperations: ["global RateLimit counter via checkRateLimit"],
    sensitiveData: [],
    auditEvent: [],
    logEvents: ["onboarding.analytics.recorded"],
    errorResponses: [
      "400 invalid length, JSON or strict event schema",
      "403 origin or consent contract rejected",
      "413 request body exceeds 512 bytes",
      "415 content type or content encoding rejected",
      "429 global limiter denied or failed closed",
      "503 limiter dependency was not supplied to the route handler",
    ],
    owner: "onboarding-observability",
    tests: [
      "src/components/onboarding-analytics.test.ts",
      "src/app/api/analytics/onboarding/route.test.ts",
    ],
    verificationStatus: "Partially verified",
    knownGaps: [
      "The official client enforces the browser preference, but a direct non-browser caller can assert the fixed consent header; the strict event schema prevents that caller from adding identity or free-form content.",
      "Deployed WAF and API-gateway enforcement of the same cost ceiling is not yet evidenced.",
    ],
  },
  "GET /callback": {
    authentication: "public",
    sessionOrTokenType: "WorkOS AuthKit callback state/cookies",
    csrfRequirement: "Provider state validation delegated to AuthKit; independent evidence not captured",
    corsPolicy: "same-site navigation",
    allowedActors: ["public visitor", "returning member"],
    authorizationPolicy: "POLICY.AUTH.CALLBACK.WORKOS",
    requestSchema: "AuthKit callback contract",
    allowedInputFields: ["provider callback parameters accepted by AuthKit"],
    outputSchema: "redirect to authenticated return path or /auth/error",
    allowedOutputFields: ["Location"],
    externalProviders: ["WorkOS"],
    sensitiveData: ["AUTHENTICATION", "PERSONAL"],
    auditEvent: ["AUDIT.AUTH.CALLBACK.FAILED"],
    logEvents: ["auth.callback_failed", "auth.callback_sync_failed"],
    errorResponses: ["allowlisted recovery redirect"],
    owner: "identity-security",
    tests: [
      "src/lib/auth-callback-recovery.test.ts",
      "src/lib/auth-callback-route-contract.test.ts",
    ],
    verificationStatus: "Partially verified",
    knownGaps: ["AuthKit state, nonce, PKCE, code-reuse and session-rotation evidence is not independently captured."],
  },
  "GET /sign-in": {
    authentication: "public",
    sessionOrTokenType: "WorkOS AuthKit sign-in redirect",
    csrfRequirement: "Authentication initiation; return target validation must remain server controlled",
    corsPolicy: "same-site navigation",
    allowedActors: ["public visitor", "signed-out member"],
    requestSchema: "returnTo query parameter validated by the sign-in route",
    outputSchema: "provider redirect",
    externalProviders: ["WorkOS"],
    sensitiveData: ["AUTHENTICATION"],
    owner: "identity-security",
    verificationStatus: "Partially verified",
    knownGaps: ["Complete sign-in trace is not yet registered."],
  },
  "POST /api/users/me/delete": {
    authentication: "required",
    sessionOrTokenType: "authenticated application session",
    csrfRequirement: "same-origin JSON mutation; direct route CSRF evidence not independently captured",
    corsPolicy: "same-origin expected; not independently verified",
    allowedActors: ["authenticated account owner"],
    allowedRoles: ["member", "moderator", "administrator"],
    allowedSubscriptions: ["free", "pro", "pro_plus"],
    requiredPermissions: ["current user may request deletion only for their own account"],
    authorizationPolicy: "POLICY.ACCOUNT.DELETION.SELF_REQUEST",
    objectLevelPolicy: "POLICY.ACCOUNT.DELETION.SELF_REQUEST",
    propertyLevelPolicy: "confirm must be the literal DELETE; user identity is server-derived",
    requestSchema: "z.object({ confirm: z.literal('DELETE') })",
    allowedInputFields: ["confirm"],
    maximumBodySize: null,
    outputSchema: "{ ok: true, deletionRequestedAt, graceDays: 30 }",
    allowedOutputFields: ["ok", "deletionRequestedAt", "graceDays"],
    rateLimit: "3 requests per database user per hour, fail closed",
    costOrResourceBudget: "single current-user update and audit insert",
    idempotency: "not explicit; repeated requests are rate limited",
    databaseOperations: ["DB.ACCOUNT.DELETION.REQUEST.TRANSACTION"],
    sensitiveData: ["PERSONAL", "AUTHENTICATION", "AUDIT_SECURITY"],
    auditEvent: ["AUDIT.ACCOUNT.DELETION.REQUESTED"],
    errorResponses: [
      "400 validation error",
      "403 last active administrator protection",
      "429 Too many requests",
      "safe jsonError envelope",
    ],
    owner: "privacy-security",
    tests: ["src/lib/account-deletion.test.ts"],
    verificationStatus: "Partially verified",
    knownGaps: [
      "Direct route signed-out, CSRF, duplicate-submission and rollback tests are missing.",
      "The request immediately bans the session owner, but WorkOS session revocation is not implemented.",
    ],
  },
  "ACTION src/app/actions.ts#requestAccountDeletion": {
    authentication: "required",
    sessionOrTokenType: "authenticated application session",
    csrfRequirement: "Next.js server-action origin control; independent evidence not captured",
    corsPolicy: "framework server action",
    allowedActors: ["authenticated account owner"],
    allowedRoles: ["member", "moderator", "administrator"],
    allowedSubscriptions: ["free", "pro", "pro_plus"],
    requiredPermissions: ["current user may request deletion only for their own account"],
    authorizationPolicy: "POLICY.ACCOUNT.DELETION.SELF_REQUEST",
    objectLevelPolicy: "POLICY.ACCOUNT.DELETION.SELF_REQUEST",
    propertyLevelPolicy: "target user is server-derived; this entry accepts no confirmation field",
    requestSchema: "no explicit input schema",
    allowedInputFields: [],
    outputSchema: "server-action revalidation result",
    allowedOutputFields: [],
    costOrResourceBudget: "single current-user update and audit insert; no explicit action rate limit",
    databaseOperations: ["DB.ACCOUNT.DELETION.REQUEST.TRANSACTION"],
    sensitiveData: ["PERSONAL", "AUTHENTICATION", "AUDIT_SECURITY"],
    auditEvent: ["AUDIT.ACCOUNT.DELETION.REQUESTED"],
    owner: "privacy-security",
    tests: ["src/lib/account-deletion.test.ts"],
    verificationStatus: "Partially verified",
    knownGaps: [
      "The server action has no explicit confirmation schema or rate limit and lacks direct negative tests.",
      "WorkOS session revocation is not implemented after the user is banned.",
    ],
  },
  "POST /api/internal/account-deletion": {
    authentication: "internal-secret",
    sessionOrTokenType: "X-Internal-Secret or bearer token validated by requireInternalRequest",
    csrfRequirement: "server-to-server internal request; browser CSRF token not applicable",
    corsPolicy: "server-to-server; no browser CORS dependency",
    allowedActors: ["account-deletion scheduler", "authorized operator script"],
    allowedRoles: ["internal system"],
    requiredPermissions: ["valid configured internal secret"],
    authorizationPolicy: "POLICY.ACCOUNT.DELETION.INTERNAL_MAINTENANCE",
    requestSchema: "empty request body",
    allowedInputFields: [],
    outputSchema: "AccountDeletionMaintenanceResult plus ok",
    allowedOutputFields: [
      "ok",
      "finalizedCount",
      "messagesScrubbed",
      "postsScrubbed",
      "threadsScrubbed",
      "listingsArchived",
      "mediaTombstoned",
      "storageDeletionJobsQueued",
      "storageDeletionJobsCompleted",
      "storageDeletionJobsFailed",
      "storageObjectsDeleted",
      "remoteProviderReferencesRetained",
      "memoriesDeleted",
      "contextsDeleted",
      "agentRunsScrubbed",
      "ranAt",
      "cutoff",
    ],
    costOrResourceBudget:
      "25 deletion candidates, 10 storage jobs and 500 storage objects per job batch per invocation",
    databaseOperations: [
      "DB.ACCOUNT.DELETION.PENDING.SELECT",
      "DB.ACCOUNT.DELETION.FINALIZE.TRANSACTION",
      "DB.ACCOUNT.DELETION.STORAGE_JOBS.PROCESS",
    ],
    externalProviders: ["Supabase Storage"],
    sensitiveData: [
      "PERSONAL",
      "AUTHENTICATION",
      "FINANCIAL",
      "PRIVATE_COMMUNICATION",
      "USER_MEDIA",
      "AUDIT_SECURITY",
    ],
    auditEvent: [
      "AUDIT.ACCOUNT.DELETION.FINALIZED",
      "AUDIT.ACCOUNT.DELETION.STORAGE",
    ],
    logEvents: [],
    errorResponses: ["403 Forbidden", "500 Could not run account deletion maintenance"],
    owner: "privacy-security",
    tests: ["src/lib/account-deletion.test.ts"],
    verificationStatus: "Partially verified",
    knownGaps: [
      "WorkOS identity/session revocation and Stripe customer/subscription lifecycle are not implemented.",
      "Managed-page and organization owner transfer is not implemented before finalization.",
      "Internal-secret rotation, endpoint authorization and complete transaction rollback tests are missing.",
    ],
  },
  "POST /api/users/me/export": {
    authentication: "required",
    sessionOrTokenType: "authenticated application session",
    csrfRequirement:
      "state-changing export request is submitted by a same-origin POST form; the global proxy rejects cross-origin browser mutations and the handler rejects cross-site fetch metadata",
    corsPolicy:
      "same-origin browser form submission; cross-origin mutations are rejected before the handler",
    allowedActors: ["authenticated account owner"],
    allowedRoles: ["member", "moderator", "administrator"],
    allowedSubscriptions: ["free", "pro", "pro_plus"],
    requiredPermissions: ["current user may export only their own data"],
    authorizationPolicy: "POLICY.ACCOUNT.DATA_EXPORT.SELF",
    objectLevelPolicy: "POLICY.ACCOUNT.DATA_EXPORT.SELF",
    propertyLevelPolicy:
      "explicit Prisma selects plus assertUserExportDto forbidden-field denylist",
    requestSchema:
      "empty application/x-www-form-urlencoded form body; no user-supplied object identifier",
    allowedInputFields: [],
    outputSchema: "greyhoundiq-user-export/v2 JSON archive",
    allowedOutputFields: [
      "schemaVersion",
      "exportedAt",
      "user",
      "profile",
      "community",
      "messages",
      "mediaAssets",
      "memoryEntries",
      "agentRuns",
    ],
    rateLimit: "3 exports per database user per hour, fail closed",
    costOrResourceBudget:
      "500 items per top-level collection, 20 media items per parent and 8 MiB serialized response",
    databaseOperations: [
      "DB.ACCOUNT.DATA_EXPORT.READ",
      "DB.ACCOUNT.DATA_EXPORT.AUDIT.INSERT",
      "DB.ACCOUNT.DATA_EXPORT.ARTIFACT.INSERT",
    ],
    cacheOperations: ["Cache-Control: private, no-store on success and handled errors"],
    backgroundJobs: [],
    sensitiveData: [
      "PERSONAL",
      "PRIVATE_COMMUNICATION",
      "USER_MEDIA",
      "AUDIT_SECURITY",
    ],
    auditEvent: ["AUDIT.ACCOUNT.DATA_EXPORT.DOWNLOADED"],
    errorResponses: [
      "403 Cross-site request blocked",
      "413 export.too_large",
      "429 Too many requests",
      "safe jsonError envelope",
    ],
    deprecationStatus: "active",
    owner: "privacy-security",
    tests: [
      "src/lib/user-export-policy.test.ts",
      "src/app/api/users/me/export/route.test.ts",
    ],
    verificationStatus: "Partially verified",
    knownGaps: [
      "Oversized exports require support; no authorized asynchronous export workflow exists.",
      "Signed-out, cross-site, RLS and complete route-response tests are missing.",
    ],
  },
  "POST /api/webhooks/stripe": {
    authentication: "provider-signature",
    sessionOrTokenType: "Stripe webhook signature",
    csrfRequirement: "Raw-body provider signature; browser CSRF token not applicable",
    corsPolicy: "server-to-server",
    allowedActors: ["Stripe"],
    requiredPermissions: ["valid Stripe webhook signature"],
    authorizationPolicy: "POLICY.WEBHOOK.STRIPE_SIGNATURE",
    requestSchema: "Stripe.Event plus event-specific settlement validation",
    allowedInputFields: ["raw provider payload accepted only after signature verification"],
    outputSchema: "{ ok: true, duplicate: boolean } or safe error envelope",
    allowedOutputFields: ["ok", "duplicate", "error.code", "error.message"],
    rateLimit: "RATE.BILLING.STRIPE_WEBHOOK",
    costOrResourceBudget: "1000 requests per client IP per 60 seconds; request byte limit not captured",
    idempotency: "unique provider event ID and provider/payload hash",
    databaseOperations: ["DB.BILLING.STRIPE_WEBHOOK_EVENT.INSERT"],
    externalProviders: ["Stripe"],
    sensitiveData: ["FINANCIAL", "PERSONAL", "AUDIT_SECURITY"],
    auditEvent: ["AUDIT.BILLING.WEBHOOK.RECEIVED"],
    errorResponses: ["401 Unauthorized", "400 Bad request", "429 Too many requests", "500 Webhook ingest failed"],
    owner: "billing-security",
    tests: [
      "src/lib/billing/stripe-readiness.test.ts",
      "src/lib/billing/stripe-webhook-settlement.test.ts",
    ],
    verificationStatus: "Partially verified",
    knownGaps: ["Maximum body bytes, complete reducer operations, generated SQL and out-of-order integration evidence are missing."],
  },
  "POST /api/conversations/[id]/block": {
    authentication: "required",
    sessionOrTokenType: "authenticated application session",
    csrfRequirement: "not verified for direct route call",
    corsPolicy: "same-origin expected; not verified",
    allowedActors: ["conversation participant"],
    allowedRoles: ["member", "moderator", "administrator"],
    allowedSubscriptions: ["free", "pro", "pro_plus"],
    requiredPermissions: ["conversation participant"],
    authorizationPolicy: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
    objectLevelPolicy: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
    propertyLevelPolicy: "server-derived blockedById/blockedAt and UserBlock relation only",
    requestSchema: "conversation path ID; no explicit identifier schema",
    allowedInputFields: ["id path parameter"],
    outputSchema: "{ item: conversation }",
    rateLimit: "RATE.PULSE.CONVERSATION.BLOCK",
    idempotency: "UserBlock unique pair",
    databaseOperations: [
      "DB.PULSE.CONVERSATION.ACCESS.SELECT",
      "DB.PULSE.CONVERSATION.BLOCK.UPDATE",
      "DB.PULSE.USER_BLOCK.UPSERT",
      "DB.PULSE.REALTIME_GRANT.REVOKE",
    ],
    externalProviders: ["Supabase Realtime"],
    sensitiveData: ["PRIVATE_COMMUNICATION", "PERSONAL"],
    auditEvent: ["AUDIT.PULSE.CONVERSATION.BLOCK"],
    owner: "community-security",
    tests: ["src/lib/realtime-authorization.test.ts"],
    verificationStatus: "Partially verified",
    knownGaps: ["Route-level CSRF, cross-user, rate-limit, concurrency and output-schema tests are missing."],
  },
  "DELETE /api/conversations/[id]/block": {
    authentication: "required",
    sessionOrTokenType: "authenticated application session",
    csrfRequirement: "not verified",
    corsPolicy: "same-origin expected; not verified",
    allowedActors: ["profile that created the block"],
    allowedRoles: ["member", "moderator", "administrator"],
    allowedSubscriptions: ["free", "pro", "pro_plus"],
    requiredPermissions: ["current profile is blockedById"],
    authorizationPolicy: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
    objectLevelPolicy: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
    propertyLevelPolicy: "server clears blockedById/blockedAt and deletes current profile's UserBlock relation",
    requestSchema: "conversation path ID; no explicit identifier schema",
    allowedInputFields: ["id path parameter"],
    outputSchema: "{ item: conversation }",
    owner: "community-security",
    verificationStatus: "Not verified",
    knownGaps: ["Unblock has not yet received a complete trace or negative tests."],
  },
  "POST /api/conversations/[id]/delivered": {
    authentication: "required",
    sessionOrTokenType: "authenticated application session",
    csrfRequirement:
      "same-origin browser mutation; global proxy rejects cross-origin requests",
    corsPolicy: "same-origin fetch only",
    allowedActors: ["conversation participant receiving messages"],
    allowedRoles: ["member", "moderator", "administrator"],
    allowedSubscriptions: ["free", "pro", "pro_plus"],
    requiredPermissions: ["current profile participates in the conversation"],
    authorizationPolicy: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
    objectLevelPolicy: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
    propertyLevelPolicy:
      "server derives recipient profile and writes only delivery receipts",
    requestSchema: "conversation path ID; empty request body",
    allowedInputFields: ["id path parameter"],
    outputSchema: "{ ok: true, delivered: number }",
    allowedOutputFields: ["ok", "delivered"],
    rateLimit: "20 acknowledgements per user and conversation per minute, fail closed",
    costOrResourceBudget:
      "at most 200 undelivered message IDs and one skip-duplicate receipt batch per request",
    idempotency: "unique receipt constraint plus createMany skipDuplicates",
    sensitiveData: ["PRIVATE_COMMUNICATION"],
    owner: "community-security",
    tests: ["src/app/api/conversations/[id]/delivered/route.test.ts"],
    verificationStatus: "Partially verified",
    knownGaps: [
      "Signed-out, cross-participant, runtime rate-limit and database rollback tests remain open.",
    ],
  },
  "GET /api/media/[id]": {
    authentication: "required",
    sessionOrTokenType: "authenticated application session",
    csrfRequirement: "not applicable to read",
    corsPolicy: "same-origin expected; not verified",
    allowedActors: ["media uploader"],
    allowedRoles: ["member", "moderator", "administrator"],
    allowedSubscriptions: ["free", "pro", "pro_plus"],
    requiredPermissions: ["media uploader ownership"],
    authorizationPolicy: "POLICY.MEDIA.UPLOADER",
    objectLevelPolicy: "POLICY.MEDIA.UPLOADER",
    requestSchema: "media path ID; no explicit identifier schema",
    allowedInputFields: ["id path parameter"],
    outputSchema: "explicit media status projection",
    allowedOutputFields: ["id", "originalName", "scanStatus", "processingStatus", "processingError", "createdAt", "updatedAt"],
    databaseOperations: ["DB.MEDIA.ASSET.STATUS.SELECT"],
    sensitiveData: ["USER_MEDIA", "PERSONAL"],
    owner: "media-security",
    tests: ["src/lib/media-service.test.ts"],
    verificationStatus: "Partially verified",
    knownGaps: ["Signed-out and cross-owner route tests plus explicit cache policy are missing."],
  },
  "DELETE /api/media/[id]": {
    authentication: "required",
    sessionOrTokenType: "authenticated application session",
    csrfRequirement: "not verified",
    corsPolicy: "same-origin expected; not verified",
    allowedActors: ["media uploader"],
    allowedRoles: ["member", "moderator", "administrator"],
    allowedSubscriptions: ["free", "pro", "pro_plus"],
    requiredPermissions: ["media uploader ownership"],
    authorizationPolicy: "POLICY.MEDIA.UPLOADER",
    objectLevelPolicy: "POLICY.MEDIA.UPLOADER",
    propertyLevelPolicy: "server-generated tombstone and related cleanup fields only",
    requestSchema: "media path ID; no explicit identifier schema",
    allowedInputFields: ["id path parameter"],
    outputSchema: "{ item: tombstoned media record }",
    rateLimit: "RATE.MEDIA.DELETE",
    idempotency: "deletedAt null predicate and affected-row check",
    databaseOperations: ["DB.MEDIA.ASSET.DELETE.TOMBSTONE"],
    externalProviders: ["Supabase Storage"],
    sensitiveData: ["USER_MEDIA", "PERSONAL"],
    auditEvent: ["AUDIT.MEDIA.DELETE"],
    owner: "media-security",
    tests: ["src/lib/media-service.test.ts"],
    verificationStatus: "Partially verified",
    knownGaps: ["CSRF evidence, explicit response allowlist, cross-owner endpoint test and durable storage cleanup retry are missing."],
  },
  "PATCH /api/media/[id]": {
    authentication: "required",
    sessionOrTokenType: "authenticated application session",
    csrfRequirement: "not verified",
    corsPolicy: "same-origin expected; not verified",
    allowedActors: ["media uploader"],
    requiredPermissions: ["media uploader ownership"],
    authorizationPolicy: "POLICY.MEDIA.UPLOADER",
    objectLevelPolicy: "POLICY.MEDIA.UPLOADER",
    propertyLevelPolicy: "mediaMetadataUpdateSchema allowlist",
    requestSchema: "mediaMetadataUpdateSchema",
    allowedInputFields: ["altText"],
    outputSchema: "{ item: media record }",
    owner: "media-security",
    verificationStatus: "Partially verified",
    knownGaps: ["Complete mutation trace and negative endpoint tests are missing."],
  },
  "ACTION src/app/actions.ts#blockConversation": {
    authentication: "required",
    sessionOrTokenType: "authenticated application session",
    csrfRequirement: "Next.js server-action origin control; independent evidence not captured",
    corsPolicy: "framework server action",
    allowedActors: ["conversation participant"],
    allowedRoles: ["member", "moderator", "administrator"],
    requiredPermissions: ["conversation participant"],
    authorizationPolicy: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
    objectLevelPolicy: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
    propertyLevelPolicy: "server-derived blocked identity",
    requestSchema: "conversationId string; no explicit schema",
    allowedInputFields: ["conversationId", "unused FormData"],
    databaseOperations: [
      "DB.PULSE.CONVERSATION.ACCESS.SELECT",
      "DB.PULSE.CONVERSATION.BLOCK.UPDATE",
      "DB.PULSE.USER_BLOCK.UPSERT",
      "DB.PULSE.REALTIME_GRANT.REVOKE",
    ],
    externalProviders: ["Supabase Realtime"],
    auditEvent: ["AUDIT.PULSE.CONVERSATION.BLOCK"],
    owner: "community-security",
    tests: ["src/lib/realtime-authorization.test.ts"],
    verificationStatus: "Partially verified",
    knownGaps: ["Server-action rate limit, explicit identifier schema and direct negative tests are missing."],
  },
};

export function discoverEndpointRegistry(repoRoot = process.cwd()): EndpointContract[] {
  const routeEntries = discoverRouteHandlers(repoRoot).map((entry) =>
    applyOverride(baseRouteEndpoint(entry), `${entry.method} ${entry.route}`)
  );
  const actionEntries = discoverServerActions(repoRoot).map((entry) =>
    applyOverride(baseServerActionEndpoint(entry), `ACTION ${entry.procedure}`)
  );
  return [...routeEntries, ...actionEntries].sort((left, right) =>
    left.endpointId.localeCompare(right.endpointId)
  );
}

export const ENDPOINTS = discoverEndpointRegistry();

export function discoverOpenApiEndpointAuthentication(
  repoRoot = process.cwd(),
): OpenApiEndpointAuthentication[] {
  const handlers = discoverRouteHandlers(repoRoot);
  const discovered = new Set(
    handlers.map((entry) => `${entry.method} ${entry.route}`),
  );
  for (const key of [
    ...PUBLIC_HTTP_ENDPOINTS,
    ...PUBLIC_REQUEST_GUARD_SCHEMES.keys(),
    ...OPTIONAL_HTTP_ENDPOINTS,
    ...PROVIDER_SIGNATURE_SCHEMES.keys(),
    ...SIGNED_QUERY_SCHEMES.keys(),
  ]) {
    if (!discovered.has(key)) {
      throw new Error(`OpenAPI authentication classification has no source route: ${key}`);
    }
  }

  return handlers
    .map((entry) => {
      const key = `${entry.method} ${entry.route}`;
      const authentication = openApiAuthenticationFor(key, entry.route);
      return {
        endpointId: endpointId("HTTP", entry.method, entry.route),
        method: entry.method,
        route: entry.route,
        authentication,
        security: openApiSecurityFor(key, authentication),
      };
    })
    .sort((left, right) => left.endpointId.localeCompare(right.endpointId));
}

export const OPENAPI_ENDPOINT_AUTHENTICATION =
  discoverOpenApiEndpointAuthentication();

export type RouteHandlerDiscovery = {
  method: (typeof HTTP_METHODS)[number];
  route: string;
  sourceFile: string;
  handler: string;
};

export function discoverRouteHandlers(repoRoot = process.cwd()): RouteHandlerDiscovery[] {
  const appRoot = path.join(repoRoot, "src", "app");
  if (!existsSync(appRoot)) return [];
  return walkFiles(appRoot)
    .filter((file) => path.basename(file) === "route.ts")
    .flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const methods = exportedHttpMethods(source);
      const sourceFile = toRepoPath(repoRoot, file);
      const route = routePatternForFile(repoRoot, file);
      return methods.map((method) => ({ method, route, sourceFile, handler: method }));
    });
}

export type ServerActionDiscovery = {
  procedure: string;
  sourceFile: string;
  handler: string;
};

export function discoverServerActions(repoRoot = process.cwd()): ServerActionDiscovery[] {
  const srcRoot = path.join(repoRoot, "src");
  if (!existsSync(srcRoot)) return [];

  const actions: ServerActionDiscovery[] = [];
  for (const file of walkFiles(srcRoot)) {
    if (!/\.(?:ts|tsx)$/.test(file) || /\.(?:test|spec)\.(?:ts|tsx)$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    if (!/["']use server["']/.test(source)) continue;
    const sourceFile = toRepoPath(repoRoot, file);
    const fileIsServerModule = /^\s*["']use server["'];?/m.test(source.slice(0, 300));

    if (fileIsServerModule) {
      for (const handler of exportedFunctionNames(source)) {
        actions.push({
          sourceFile,
          handler,
          procedure: `${sourceFile}#${handler}`,
        });
      }
    }

    for (const handler of inlineServerActionNames(source)) {
      actions.push({
        sourceFile,
        handler,
        procedure: `${sourceFile}#${handler}`,
      });
    }
  }

  const unique = new Map(actions.map((action) => [action.procedure, action]));
  return [...unique.values()].sort((left, right) =>
    left.procedure.localeCompare(right.procedure)
  );
}

export type EndpointRegistryIssueCode =
  | "DUPLICATE_ENDPOINT_ID"
  | "SOURCE_FILE_MISSING"
  | "ROUTE_SOURCE_MISMATCH"
  | "HANDLER_SYMBOL_MISSING"
  | "PROTECTED_AUTHORIZATION_MISSING"
  | "OBJECT_AUTHORIZATION_MISSING"
  | "AUTHENTICATION_NOT_VERIFIED";

export type EndpointRegistryIssue = {
  code: EndpointRegistryIssueCode;
  endpointId: string;
  message: string;
};

export function validateEndpointRegistry(
  entries: readonly EndpointContract[],
  repoRoot = process.cwd(),
  options: { includeCoverageGaps?: boolean } = {}
) {
  const issues: EndpointRegistryIssue[] = [];
  const ids = new Set<string>();

  for (const entry of entries) {
    if (ids.has(entry.endpointId)) {
      issues.push({
        code: "DUPLICATE_ENDPOINT_ID",
        endpointId: entry.endpointId,
        message: `Duplicate endpoint ID: ${entry.endpointId}`,
      });
    }
    ids.add(entry.endpointId);

    const absoluteSource = path.join(repoRoot, entry.sourceFile);
    if (!existsSync(absoluteSource)) {
      issues.push({
        code: "SOURCE_FILE_MISSING",
        endpointId: entry.endpointId,
        message: `Source file does not exist: ${entry.sourceFile}`,
      });
      continue;
    }

    const source = readFileSync(absoluteSource, "utf8");
    if (!new RegExp(`\\b${escapeRegExp(entry.handler)}\\b`).test(source)) {
      issues.push({
        code: "HANDLER_SYMBOL_MISSING",
        endpointId: entry.endpointId,
        message: `Handler symbol ${entry.handler} is absent from ${entry.sourceFile}`,
      });
    }

    if (entry.protocol === "http") {
      const actualRoute = routePatternForFile(repoRoot, absoluteSource);
      if (actualRoute !== entry.routeOrProcedure) {
        issues.push({
          code: "ROUTE_SOURCE_MISMATCH",
          endpointId: entry.endpointId,
          message: `${entry.routeOrProcedure} does not match source-derived ${actualRoute}`,
        });
      }
    }

    if (isProtected(entry.authentication) && !entry.authorizationPolicy) {
      issues.push({
        code: "PROTECTED_AUTHORIZATION_MISSING",
        endpointId: entry.endpointId,
        message: "Protected endpoint has no authorization policy metadata.",
      });
    }

    if (
      isProtected(entry.authentication) &&
      /\[[^\]]+\]/.test(entry.routeOrProcedure) &&
      !entry.objectLevelPolicy
    ) {
      issues.push({
        code: "OBJECT_AUTHORIZATION_MISSING",
        endpointId: entry.endpointId,
        message: "Protected identifier endpoint has no object authorization policy metadata.",
      });
    }

    if (options.includeCoverageGaps && entry.authentication === "unknown") {
      issues.push({
        code: "AUTHENTICATION_NOT_VERIFIED",
        endpointId: entry.endpointId,
        message: "Authentication requirements have not been verified.",
      });
    }
  }

  return issues;
}

function baseRouteEndpoint(entry: RouteHandlerDiscovery): EndpointContract {
  return {
    endpointId: endpointId("HTTP", entry.method, entry.route),
    protocol: "http",
    host: "GreyhoundIQ application host",
    environment: ["local", "preview", "production when deployed"],
    version: "unversioned",
    method: entry.method,
    routeOrProcedure: entry.route,
    sourceFile: entry.sourceFile,
    handler: entry.handler,
    frontendCallers: [],
    nonFrontendCallers: [],
    authentication: "unknown",
    sessionOrTokenType: "not verified",
    csrfRequirement: "not verified",
    corsPolicy: "not verified",
    allowedActors: [],
    allowedRoles: [],
    allowedSubscriptions: [],
    requiredPermissions: [],
    objectLevelPolicy: null,
    propertyLevelPolicy: null,
    tenantPolicy: null,
    requestSchema: "not verified",
    allowedInputFields: [],
    maximumBodySize: null,
    maximumFileSize: null,
    outputSchema: "not verified",
    allowedOutputFields: [],
    rateLimit: null,
    costOrResourceBudget: "not verified",
    idempotency: null,
    databaseOperations: [],
    cacheOperations: [],
    backgroundJobs: [],
    externalProviders: [],
    sensitiveData: [],
    auditEvent: [],
    logEvents: [],
    errorResponses: [],
    deprecationStatus: "active",
    retirementDate: null,
    owner: "unassigned",
    tests: [],
    verificationStatus: "Not verified",
    knownGaps: ["Discovered from source; security metadata and implementation trace have not been verified."],
  };
}

function baseServerActionEndpoint(entry: ServerActionDiscovery): EndpointContract {
  return {
    ...baseRouteEndpoint({
      method: "POST",
      route: entry.procedure,
      sourceFile: entry.sourceFile,
      handler: entry.handler,
    }),
    endpointId: endpointId("ACTION", "ACTION", entry.procedure),
    protocol: "server-action",
    method: "ACTION",
    routeOrProcedure: entry.procedure,
    csrfRequirement: "Next.js server-action control; not verified",
  };
}

function applyOverride(endpoint: EndpointContract, key: string) {
  const override = ENDPOINT_OVERRIDES[key];
  return override ? { ...endpoint, ...override } : endpoint;
}

function exportedHttpMethods(source: string) {
  const found = new Set<(typeof HTTP_METHODS)[number]>();
  const methodPattern = HTTP_METHODS.join("|");
  const patterns = [
    new RegExp(`\\bexport\\s+(?:async\\s+)?function\\s+(${methodPattern})\\b`, "g"),
    new RegExp(`\\bexport\\s+const\\s+(${methodPattern})\\s*=`, "g"),
    new RegExp(`\\bexport\\s*\\{[^}]*?\\bas\\s+(${methodPattern})\\b`, "g"),
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      found.add(match[1] as (typeof HTTP_METHODS)[number]);
    }
  }
  return HTTP_METHODS.filter((method) => found.has(method));
}

function exportedFunctionNames(source: string) {
  const names = new Set<string>();
  const patterns = [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/g,
    /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.add(match[1]);
  }
  return [...names];
}

function inlineServerActionNames(source: string) {
  const names = new Set<string>();
  const patterns = [
    /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*["']use server["'];?/g,
    /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*async\s*\([^)]*\)\s*=>\s*\{\s*["']use server["'];?/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.add(match[1]);
  }
  return [...names];
}

function routePatternForFile(repoRoot: string, file: string) {
  const routeDirectory = path.dirname(file);
  const relative = path.relative(path.join(repoRoot, "src", "app"), routeDirectory);
  const segments = relative
    .split(path.sep)
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .filter((segment) => !segment.startsWith("@"));
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

function toRepoPath(repoRoot: string, file: string) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

function endpointId(namespace: string, method: string, route: string) {
  const normalized = route
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, "OPTIONAL_CATCHALL_$1")
    .replace(/\[\.\.\.([^\]]+)\]/g, "CATCHALL_$1")
    .replace(/\[([^\]]+)\]/g, "PARAM_$1")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "ROOT";
  return `${namespace}.${method}.${normalized}`;
}

function openApiAuthenticationFor(
  key: string,
  route: string,
): OpenApiAuthenticationStatus {
  if (PUBLIC_HTTP_ENDPOINTS.has(key)) return "public";
  if (OPTIONAL_HTTP_ENDPOINTS.has(key)) return "optional";
  if (PROVIDER_SIGNATURE_SCHEMES.has(key)) return "provider-signature";
  if (SIGNED_QUERY_SCHEMES.has(key)) return "signed-query";
  if (route.startsWith("/api/internal/")) return "internal-secret";
  return "required";
}

function openApiSecurityFor(
  key: string,
  authentication: OpenApiAuthenticationStatus,
): Array<Record<string, []>> {
  if (authentication === "public") {
    const requestGuard = PUBLIC_REQUEST_GUARD_SCHEMES.get(key);
    return requestGuard ? [{ [requestGuard]: [] }] : [];
  }
  if (authentication === "required") return [{ WorkOSSession: [] }];
  if (authentication === "optional") return [{ WorkOSSession: [] }, {}];
  if (authentication === "internal-secret") {
    return [{ InternalSecret: [] }, { InternalBearer: [] }];
  }
  const scheme =
    authentication === "provider-signature"
      ? PROVIDER_SIGNATURE_SCHEMES.get(key)
      : SIGNED_QUERY_SCHEMES.get(key);
  if (!scheme) throw new Error(`OpenAPI security scheme is missing for ${key}`);
  return [{ [scheme]: [] }];
}

function isProtected(authentication: EndpointAuthentication) {
  return authentication !== "public" && authentication !== "unknown";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
