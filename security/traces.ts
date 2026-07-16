import {
  DATABASE_OPERATIONS,
  type DatabaseOperationContract,
} from "./database-operations";
import { buildMandatoryPublicRacingTraceRecords } from "./mandatory-public-racing-traces";
import type { VerificationStatus } from "./shared";

export const SECURITY_TRACE_AUTHENTICATION_VALUES = [
  "public",
  "optional",
  "required",
] as const;

export const SECURITY_TRACE_ACTION_TYPES = [
  "read",
  "create",
  "update",
  "delete",
  "upload",
  "download",
  "authentication",
  "billing",
  "administration",
  "background",
  "webhook",
  "realtime",
  "external",
] as const;

export type SecurityTraceContract = {
  traceId: string;

  userStoryIds: string[];
  productArea: string;
  routePatterns: string[];
  screenIds: string[];
  actionName: string;
  actionType: (typeof SECURITY_TRACE_ACTION_TYPES)[number];

  actors: string[];
  authentication: (typeof SECURITY_TRACE_AUTHENTICATION_VALUES)[number];
  allowedRoles: string[];
  allowedTiers: string[];
  requiredPermissions: string[];
  requiredRelationships: string[];
  featureFlags: string[];

  frontend: {
    sourceFiles: string[];
    components: string[];
    eventHandlers: string[];
    forms: string[];
    fields: string[];
    clientValidationSchemas: string[];
    clientStateStores: string[];
    sensitiveBrowserStorage: string[];
  };

  transport: {
    protocol: string;
    method?: string;
    pathOrProcedure: string;
    contentType?: string;
    credentialMode?: string;
    requiredHeaders: string[];
    csrfControl?: string;
    corsPolicy?: string;
    maximumRequestBytes?: number | null;
    timeoutMilliseconds?: number | null;
  };

  server: {
    entryFiles: string[];
    handlers: string[];
    middlewareOrder: string[];
    authenticationFunction: string;
    sessionValidationFunction?: string;
    authorizationPolicy: string;
    objectAuthorizationPolicy?: string;
    propertyAuthorizationPolicy?: string;
    requestValidationSchema: string;
    outputSchema: string;
    businessService: string;
    repositoryMethods: string[];
    rateLimitPolicy?: string;
    idempotencyPolicy?: string;
  };

  databaseOperations: DatabaseOperationContract[];

  cacheOperations: {
    operation: string;
    keyShape: string;
    includesSecurityContext: boolean;
    ttlSeconds?: number | null;
    invalidationTriggers: string[];
  }[];

  backgroundOperations: {
    queueOrScheduler: string;
    jobType: string;
    payloadSchema: string;
    workerIdentity: string;
    retryPolicy: string;
    idempotencyKey?: string;
  }[];

  externalOperations: {
    provider: string;
    operation: string;
    credentialScope: string;
    requestSchema: string;
    responseSchema: string;
    timeoutPolicy: string;
    retryPolicy: string;
    circuitBreakerPolicy?: string;
    webhookFollowUp?: string;
  }[];

  response: {
    successStatus: number | string;
    responseSchema: string;
    permittedFields: string[];
    cachePolicy: string;
    frontendSuccessState: string;
  };

  failureModes: {
    condition: string;
    externalStatus: number | string;
    safeUserMessage: string;
    serverLogEvent: string;
    retryPermitted: boolean;
  }[];

  dataClassification: string[];
  auditEvents: string[];
  securityControls: string[];
  threats: string[];
  tests: string[];
  evidence: string[];
  owner: string;
  verificationStatus: VerificationStatus;
};

function databaseOperationsFor(traceId: string) {
  return DATABASE_OPERATIONS.filter((operation) => operation.traceId === traceId);
}

const SECURITY_TRACE_RECORDS = [
  {
    traceId: "ONBOARDING.ANALYTICS.RECORD",
    userStoryIds: [
      "PUBLIC.STORY.HOME",
      "ACCOUNT.STORY.OVERVIEW",
      "ADMIN.STORY.DASHBOARD",
      "AI.STORY.AGENT-CONSOLE",
    ],
    productArea: "Onboarding",
    routePatterns: ["/api/analytics/onboarding"],
    screenIds: [],
    actionName: "Record a consent-gated privacy-minimised onboarding event",
    actionType: "create",
    actors: [
      "analytics-consenting public visitor",
      "analytics-consenting member",
      "analytics-consenting moderator",
      "analytics-consenting administrator",
    ],
    authentication: "public",
    allowedRoles: [],
    allowedTiers: [],
    requiredPermissions: [],
    requiredRelationships: [],
    featureFlags: [],
    frontend: {
      sourceFiles: [
        "src/components/interactive-help.tsx",
        "src/components/onboarding-analytics-client.ts",
        "src/components/onboarding-analytics.ts",
      ],
      components: ["InteractiveHelp"],
      eventHandlers: [
        "queueOnboardingAnalyticsEvent",
        "tour lifecycle and help/upgrade/support interaction handlers",
      ],
      forms: [],
      fields: ["schemaVersion", "event", "tourId", "event-specific stepId"],
      clientValidationSchemas: ["parseOnboardingAnalyticsEvent"],
      clientStateStores: ["greyhoundiq.cookie-consent.v1 preference read only"],
      sensitiveBrowserStorage: [],
    },
    transport: {
      protocol: "HTTPS same-origin fetch",
      method: "POST",
      pathOrProcedure: "/api/analytics/onboarding",
      contentType: "application/json",
      credentialMode: "same-origin; no identity token required",
      requiredHeaders: [
        "Origin matching the request URL origin",
        "Sec-Fetch-Site: same-origin when supplied by the user agent",
        "x-greyhoundiq-analytics-consent: accepted",
        "Content-Type: application/json",
      ],
      csrfControl:
        "exact Origin comparison, fetch-metadata rejection and a fixed accepted-consent header",
      corsPolicy: "same-origin only; no cross-origin success response",
      maximumRequestBytes: 512,
      timeoutMilliseconds: null,
    },
    server: {
      entryFiles: ["src/app/api/analytics/onboarding/route.ts"],
      handlers: ["POST", "handleOnboardingAnalyticsPost"],
      middlewareOrder: [
        "same-origin and fetch-metadata check",
        "accepted-consent header check",
        "JSON content type and identity encoding check",
        "declared 512-byte body limit",
        "fail-closed global distributed rate limit",
        "streamed 512-byte body limit and strict UTF-8/JSON parsing",
        "strict registered tour/event/step allowlist",
        "privacy-minimised structured INFO event",
      ],
      authenticationFunction: "public endpoint; no identity lookup",
      sessionValidationFunction: "not applicable: the event contract excludes identity",
      authorizationPolicy: "POLICY.ONBOARDING.ANALYTICS.MINIMISED_PUBLIC_INGEST",
      objectAuthorizationPolicy:
        "registered tour and event-specific step pairs only; no application object access",
      propertyAuthorizationPolicy:
        "schemaVersion, event, tourId and event-specific stepId are the only accepted properties",
      requestValidationSchema: "parseOnboardingAnalyticsEvent",
      outputSchema: "empty 204 response",
      businessService:
        "logRequestInfo onboarding.analytics.recorded with product-area derivation",
      repositoryMethods: [
        "checkRateLimit for the constant analytics:onboarding:global counter",
        "no onboarding event is persisted to an application table",
      ],
      rateLimitPolicy:
        "RATE.ONBOARDING.ANALYTICS.INGEST: 6,000 accepted attempts per global minute, fail closed before reading the body",
      idempotencyPolicy:
        "best-effort non-transactional analytics; duplicates may be counted and the official client never retries",
    },
    databaseOperations: databaseOperationsFor("ONBOARDING.ANALYTICS.RECORD"),
    cacheOperations: [],
    backgroundOperations: [],
    externalOperations: [],
    response: {
      successStatus: 204,
      responseSchema: "no response body",
      permittedFields: [],
      cachePolicy: "private, no-store",
      frontendSuccessState: "No UI transition waits for or depends on analytics delivery",
    },
    failureModes: [
      {
        condition: "missing or cross-origin request context, or missing consent assertion",
        externalStatus: 403,
        safeUserMessage: "Request rejected",
        serverLogEvent:
          "HTTP 403 route metric; rejected attacker-controlled event content is intentionally not logged",
        retryPermitted: false,
      },
      {
        condition: "invalid length, JSON or strict event schema",
        externalStatus: 400,
        safeUserMessage: "Invalid analytics event",
        serverLogEvent:
          "HTTP 400 route metric; invalid attacker-controlled event content is intentionally not logged",
        retryPermitted: false,
      },
      {
        condition: "unsupported media type or compressed request body",
        externalStatus: 415,
        safeUserMessage: "Content type must be application/json",
        serverLogEvent: "HTTP 415 route metric",
        retryPermitted: false,
      },
      {
        condition: "declared or streamed body exceeds 512 bytes",
        externalStatus: 413,
        safeUserMessage: "Request body is too large",
        serverLogEvent: "HTTP 413 route metric",
        retryPermitted: false,
      },
      {
        condition: "distributed limiter denies or fails closed",
        externalStatus: 429,
        safeUserMessage: "Too many requests",
        serverLogEvent: "rate_limit.db_error on dependency failure plus HTTP 429 route metric",
        retryPermitted: false,
      },
    ],
    dataClassification: ["NON_IDENTIFYING_PRODUCT_ANALYTICS"],
    auditEvents: [],
    securityControls: [
      "explicit browser analytics preference gate",
      "same-origin and fetch-metadata enforcement",
      "strict additional-properties rejection",
      "registered tour and step allowlists",
      "512-byte declared and streamed body limits",
      "compressed body rejection",
      "fail-closed distributed global limiter before body read",
      "no client retry and no UI dependency",
      "structured log field allowlist with no identity, route, role, tier or free-form values",
      "private/no-store responses",
    ],
    threats: [
      "cross-origin event injection",
      "sensitive or free-form data leakage",
      "arbitrary high-cardinality dimensions",
      "request-body resource exhaustion",
      "analytics log and autoscaling cost exhaustion",
      "retry amplification",
      "cache leakage",
    ],
    tests: [
      "src/components/onboarding-analytics.test.ts",
      "src/app/api/analytics/onboarding/route.test.ts",
      "src/lib/rate-limit.test.ts",
    ],
    evidence: [
      "Focused contract tests cover all nine event types and reject identity, route, role, tier, email, message, form values, arbitrary steps, arbitrary tours and additional fields.",
      "Focused route tests prove same-origin and consent enforcement, dual 512-byte bounds, compressed-body rejection, strict parsing, empty no-store success, privacy-minimised log context and fail-closed rate denial.",
      "The direct public endpoint cannot cryptographically prove that a caller obtained human consent; damage is bounded because it accepts only registered non-identifying categorical values.",
      "Deployed gateway/WAF metrics, log-sink retention and representative global-counter contention remain unverified.",
    ],
    owner: "onboarding-observability",
    verificationStatus: "Partially verified",
  },
  {
    traceId: "AUTH.CALLBACK.RECOVER",
    userStoryIds: ["PUBLIC.STORY.AUTH-ERROR"],
    productArea: "Authentication",
    routePatterns: ["/callback", "/auth/error"],
    screenIds: [],
    actionName: "Recover from an authentication callback failure",
    actionType: "authentication",
    actors: ["public visitor", "returning member"],
    authentication: "public",
    allowedRoles: [],
    allowedTiers: [],
    requiredPermissions: [],
    requiredRelationships: [],
    featureFlags: [],
    frontend: {
      sourceFiles: ["src/app/auth/error/page.tsx"],
      components: ["AuthErrorPage"],
      eventHandlers: ["retry sign-in link", "contact support link", "home link"],
      forms: [],
      fields: ["reason query parameter", "ref query parameter"],
      clientValidationSchemas: [],
      clientStateStores: [],
      sensitiveBrowserStorage: [],
    },
    transport: {
      protocol: "HTTPS OAuth/OIDC callback through WorkOS AuthKit",
      method: "GET",
      pathOrProcedure: "/callback",
      credentialMode: "AuthKit callback state/cookies; exact cookie behaviour not captured",
      requiredHeaders: [],
      csrfControl: "Provider state validation delegated to AuthKit; independent evidence not captured",
      corsPolicy: "same-site navigation; not independently verified",
    },
    server: {
      entryFiles: ["src/app/callback/route.ts"],
      handlers: ["GET (handleAuth)", "GET.onError", "GET.onSuccess"],
      middlewareOrder: ["WorkOS AuthKit callback handling", "local user synchronization on success"],
      authenticationFunction: "@workos-inc/authkit-nextjs handleAuth",
      sessionValidationFunction: "AuthKit SDK callback validation; exact internal symbol not captured",
      authorizationPolicy: "POLICY.AUTH.CALLBACK.WORKOS",
      requestValidationSchema: "AuthKit callback contract; reason allowlist applied only to recovery display",
      outputSchema: "HTTP redirect to authenticated return path or /auth/error",
      businessService: "syncAuthUser on success; classifyAuthCallbackFailure on failure",
      repositoryMethods: ["syncAuthUser (database operations not yet captured)"],
    },
    databaseOperations: databaseOperationsFor("AUTH.CALLBACK.RECOVER"),
    cacheOperations: [],
    backgroundOperations: [],
    externalOperations: [
      {
        provider: "WorkOS",
        operation: "validate callback and establish identity session",
        credentialScope: "server WorkOS credentials; scope not captured",
        requestSchema: "AuthKit SDK callback",
        responseSchema: "AuthKit callback result",
        timeoutPolicy: "SDK default; not captured",
        retryPolicy: "fresh user-initiated sign-in",
      },
    ],
    response: {
      successStatus: 307,
      responseSchema: "Location header only",
      permittedFields: ["allowlisted reason", "random support reference"],
      cachePolicy: "not explicitly captured",
      frontendSuccessState: "Safe recovery screen with retry, support and home actions",
    },
    failureModes: [
      {
        condition: "access_denied",
        externalStatus: 307,
        safeUserMessage: "Sign-in was cancelled",
        serverLogEvent: "auth.callback_failed",
        retryPermitted: true,
      },
      {
        condition: "expired or invalid authentication interaction",
        externalStatus: 307,
        safeUserMessage: "That sign-in session expired",
        serverLogEvent: "auth.callback_failed",
        retryPermitted: true,
      },
      {
        condition: "provider or unknown failure",
        externalStatus: 307,
        safeUserMessage: "We could not complete sign-in",
        serverLogEvent: "auth.callback_failed",
        retryPermitted: true,
      },
    ],
    dataClassification: ["AUTHENTICATION", "PERSONAL"],
    auditEvents: ["AUDIT.AUTH.CALLBACK.FAILED"],
    securityControls: ["allowlisted recovery reason", "validated UUID reference", "fixed internal recovery destination"],
    threats: ["open redirect", "provider error leakage", "callback CSRF", "callback replay"],
    tests: [
      "src/lib/auth-callback-recovery.test.ts",
      "src/lib/auth-callback-route-contract.test.ts",
    ],
    evidence: [
      "Recovery classification and route contract are tested.",
      "Unverified screen boundary: /auth/error is represented by PUBLIC.STORY.AUTH-ERROR; the product registry does not define a separate canonical screen ID.",
      "AuthKit state/nonce/PKCE/session rotation and syncAuthUser database operations are not independently traced.",
    ],
    owner: "identity-security",
    verificationStatus: "Partially verified",
  },
  {
    traceId: "AUTH.CALLBACK.COMPLETE",
    userStoryIds: ["PUBLIC.STORY.AUTH-ERROR"],
    productArea: "Authentication",
    routePatterns: ["/callback", "/auth/error"],
    screenIds: [],
    actionName:
      "Accept an authenticated callback, synchronize the local account and durably hand off new-user side effects",
    actionType: "authentication",
    actors: ["user browser", "WorkOS AuthKit callback"],
    authentication: "public",
    allowedRoles: [],
    allowedTiers: [],
    requiredPermissions: [
      "callback state and authorization code accepted by AuthKit",
    ],
    requiredRelationships: [
      "validated provider subject resolves to one local User",
      "a first local User owns exactly one Profile, personal SocialActor and SignupOutbox row",
    ],
    featureFlags: [],
    frontend: {
      sourceFiles: [
        "src/app/sign-in/route.ts",
        "src/app/auth/error/page.tsx",
      ],
      components: ["AuthErrorPage on failure; success destination is SDK returnTo state"],
      eventHandlers: [
        "browser navigation to /sign-in",
        "provider redirect to /callback",
        "safe retry link on /auth/error",
      ],
      forms: ["WorkOS-hosted authentication form; implementation is external and not captured"],
      fields: [
        "allowlisted returnTo/plan/interval on sign-in",
        "provider callback parameters consumed by AuthKit",
      ],
      clientValidationSchemas: [],
      clientStateStores: [],
      sensitiveBrowserStorage: [
        "AuthKit session cookie behaviour is external and not independently captured",
      ],
    },
    transport: {
      protocol: "HTTPS OAuth/OIDC callback through WorkOS AuthKit",
      method: "GET",
      pathOrProcedure: "/callback",
      contentType: "No application request body; AuthKit callback query/cookie contract",
      credentialMode: "AuthKit callback state, authorization code and cookies; exact fields are not captured",
      requiredHeaders: [],
      csrfControl: "Provider state validation delegated to AuthKit; independent state/nonce/PKCE evidence not captured",
      corsPolicy: "same-site top-level navigation expected; deployed CORS/Origin behaviour not verified",
    },
    server: {
      entryFiles: [
        "src/proxy.ts",
        "src/app/callback/route.ts",
        "src/lib/auth-sync.ts",
        "src/lib/signup-acceptance.ts",
        "src/lib/request-id.ts",
        "src/lib/logger.ts",
        "src/lib/db-context.ts",
        "src/lib/signup-acceptance-worker.ts",
        "src/lib/signup-acceptance-worker-store.ts",
      ],
      handlers: [
        "proxy",
        "GET (handleAuth)",
        "GET.onSuccess",
        "syncAuthUser",
        "recordSignupAccepted",
        "processSignupAcceptanceBatch",
        "signupAcceptanceWorkerStore",
      ],
      middlewareOrder: [
        "generate a GreyhoundIQ-owned request ID at proxy",
        "apply AuthKit proxy/session handling and auth redirect contract",
        "AuthKit validates the provider callback and supplies AuthIdentity",
        "normalize request correlation and enter withDbSystemContext",
        "match or create User, ensure Profile and personal SocialActor",
        "upsert one payload-free SignupOutbox row for a first local User",
        "commit before reporting callback success",
        "later claim one due outbox row with SKIP LOCKED and an expiring lease token",
        "run the injected handler outside the transaction and token-guard completion, retry or dead-letter",
      ],
      authenticationFunction: "@workos-inc/authkit-nextjs handleAuth",
      sessionValidationFunction:
        "AuthKit callback validation/session establishment; exact SDK state, nonce, PKCE and rotation internals are not captured",
      authorizationPolicy: "POLICY.AUTH.CALLBACK.WORKOS",
      objectAuthorizationPolicy:
        "No caller-selected local object; provider subject lookup is server controlled and unverified-email fallback is denied",
      propertyAuthorizationPolicy:
        "Server maps fixed AuthIdentity fields and derives free tier, member role, actor defaults, outbox status and idempotency key",
      requestValidationSchema:
        "AuthKit handleAuth callback: query { code: string, state: string }; state-bound PKCE cookie carries StateSchema { nonce: string, codeVerifier: string, customState?: string, returnPathname?: string }; local recovery query { error?: string }",
      outputSchema:
        "AuthKit success: 3xx redirect with cache-prevention headers and state-bound PKCE-cookie deletion after syncAuthUser; local error: 3xx fixed-origin /auth/error?reason=<allowlist>&ref=<UUID>",
      businessService:
        "syncAuthUser / recordSignupAccepted / processSignupAcceptanceBatch",
      repositoryMethods: [
        "tx.user.findFirst/create/update",
        "tx.profile.create",
        "tx.socialActor.upsert",
        "tx.signupOutbox.upsert",
        "signupAcceptanceWorkerStore claimBatch/complete/fail",
      ],
      rateLimitPolicy:
        "No explicit callback/application rate limit is captured; edge abuse controls are not verified",
      idempotencyPolicy:
        "SignupOutbox is unique per user and idempotency key; worker settlement requires the current lease token; concurrent first-login and sink idempotency are not runtime verified",
    },
    databaseOperations: databaseOperationsFor("AUTH.CALLBACK.COMPLETE"),
    cacheOperations: [],
    backgroundOperations: [
      {
        queueOrScheduler:
          "PostgreSQL SignupOutbox; production invoker/scheduler is not implemented or verified",
        jobType:
          "Run an injected idempotent new-user acceptance handler; the concrete side effect is not bound",
        payloadSchema:
          "{ userId, idempotencyKey, correlationId, attempt }",
        workerIdentity:
          "Not implemented or verified; source exports a worker and store but no production invocation identity",
        retryPolicy:
          "one claim at a time, 45-second default handler deadline, five default attempts, bounded exponential backoff with deterministic jitter, terminal dead letter",
        idempotencyKey: "signup.accepted:{server-derived local userId}",
      },
    ],
    externalOperations: [
      {
        provider: "WorkOS",
        operation: "validate the callback and establish or resume the AuthKit session",
        credentialScope: "server WorkOS credentials; exact grants and rotation evidence are not captured",
        requestSchema:
          "GET /callback?code=<string>&state=<string> plus the state-bound PKCE cookie containing AuthKit StateSchema { nonce: string, codeVerifier: string, customState?: string, returnPathname?: string }",
        responseSchema:
          "AuthKit authenticateWithCode result { accessToken: string, refreshToken: string, user: @workos-inc/node.User, impersonator?: { email: string, reason: string | null }, oauthTokens?: OauthTokens, authenticationMethod?: AuthenticationResponse[\"authenticationMethod\"], organizationId?: string }",
        timeoutPolicy: "SDK/provider defaults; not captured",
        retryPolicy: "fresh user-initiated sign-in only",
        webhookFollowUp: "Not applicable; this is a browser authentication callback",
      },
    ],
    response: {
      successStatus: 307,
      responseSchema: "Location header; SDK session-cookie fields are not enumerated",
      permittedFields: ["Location"],
      cachePolicy: "callback response cache policy is not independently captured",
      frontendSuccessState:
        "Browser is redirected to the AuthKit return path only after local acceptance commits; session cookie and destination UI are not runtime verified",
    },
    failureModes: [
      {
        condition: "AuthKit rejects callback state/code or the provider is unavailable",
        externalStatus: 307,
        safeUserMessage: "Sign-in could not be completed; retry safely",
        serverLogEvent: "auth.callback_failed",
        retryPermitted: true,
      },
      {
        condition: "local User/Profile/SocialActor/SignupOutbox transaction fails",
        externalStatus: 307,
        safeUserMessage: "Sign-in could not be completed; retry safely",
        serverLogEvent: "auth.callback_sync_failed",
        retryPermitted: true,
      },
      {
        condition: "injected signup handler times out or returns a retryable failure",
        externalStatus: "asynchronous; committed callback/session is not rolled back",
        safeUserMessage: "No direct user message is implemented",
        serverLogEvent: "not implemented",
        retryPermitted: true,
      },
      {
        condition: "worker claim is invalid, exhausted or loses its lease",
        externalStatus: "asynchronous dead-letter or lease-lost result",
        safeUserMessage: "No direct user message is implemented",
        serverLogEvent: "not implemented",
        retryPermitted: false,
      },
    ],
    dataClassification: [
      "AUTHENTICATION",
      "PERSONAL",
      "AUDIT_SECURITY",
      "INTERNAL",
    ],
    auditEvents: [
      "AUDIT.AUTH.CALLBACK.FAILED",
      "AUDIT.AUTH.CALLBACK.LOCAL_ACCEPTANCE_FAILED",
    ],
    securityControls: [
      "AuthKit callback validation delegated to SDK",
      "proxy-generated request identity rather than caller-supplied request ID",
      "verified-email guard before email-based account linking",
      "system-context atomic local acceptance transaction",
      "payload-free one-row-per-user outbox",
      "normalized 128-character correlation ID",
      "SKIP LOCKED claim with expiring random lease ownership",
      "bounded handler deadline, attempts and retry delay",
      "generic persisted worker error codes",
      "fixed callback-failure error code/class without the caught exception",
      "fixed-origin allowlisted recovery redirect",
    ],
    threats: [
      "callback CSRF/replay",
      "open redirect",
      "account linking through an unverified email",
      "partial local signup state",
      "duplicate or stale worker settlement",
      "PII/provider payload persistence",
      "retry storm",
      "silent dead-letter backlog",
    ],
    tests: [
      "src/lib/auth-callback-recovery.test.ts",
      "src/lib/auth-callback-route-contract.test.ts",
      "src/lib/workos-redirect.test.ts",
      "src/lib/request-id.test.ts",
      "src/lib/signup-acceptance.test.ts",
      "src/lib/signup-acceptance-worker.test.ts",
      "src/lib/logger.test.ts",
    ],
    evidence: [
      "Evidence file: prisma/schema.prisma",
      "Evidence file: prisma/migrations/20260714004000_add_signup_acceptance_outbox/migration.sql",
      "Evidence file: prisma/migrations/20260714010000_add_signup_outbox_lease_token/migration.sql",
      "Evidence file: prisma/migrations/20260714012500_add_signup_outbox_correlation_id/migration.sql",
      "Source/unit evidence only: callback success waits for the local transaction, and failures use an allowlisted fixed-origin recovery path.",
      "Installed-source evidence: AuthKit and NextResponse.redirect use HTTP 307 when no override is supplied.",
      "Unverified product-story boundary: PUBLIC.STORY.AUTH-ERROR covers callback recovery only; no canonical callback-success product story is registered.",
      "Unverified screen boundary: no canonical callback-success screen ID exists, and /auth/error is represented by PUBLIC.STORY.AUTH-ERROR rather than a screen ID.",
      "Unverified provider boundary: AuthKit state, nonce, PKCE, authorization-code reuse and session rotation are not independently verified.",
      "Unverified runtime boundary: deployed proxy request-ID injection, TLS, CORS, callback headers, response caching, session cookie and destination UI success are not verified.",
      "Unverified database boundary: actual database principal, generated SQL, rollback, User/Profile FORCE RLS and non-local migration state are not verified.",
      "Unverified worker boundary: no production scheduler/invocation identity, concrete sink, sink idempotency, provider delivery, backlog alert, replay or dead-letter runbook is implemented or verified.",
      "Unverified logging boundary: deployed log delivery, retention, access controls and alert routing are not independently verified.",
    ],
    owner: "identity-security",
    verificationStatus: "Partially verified",
  },
  {
    traceId: "BILLING.WEBHOOK.PROCESS",
    userStoryIds: ["BILLING.WEBHOOK.APPLY_PROVIDER_STATE"],
    productArea: "Billing",
    routePatterns: ["/api/webhooks/stripe"],
    screenIds: [],
    actionName: "Authenticate, deduplicate and process a Stripe webhook",
    actionType: "webhook",
    actors: ["Stripe provider"],
    authentication: "required",
    allowedRoles: ["external provider"],
    allowedTiers: [],
    requiredPermissions: ["valid Stripe webhook signature"],
    requiredRelationships: ["provider event links to a known checkout/customer where required by event type"],
    featureFlags: [],
    frontend: {
      sourceFiles: [],
      components: [],
      eventHandlers: [],
      forms: [],
      fields: [],
      clientValidationSchemas: [],
      clientStateStores: [],
      sensitiveBrowserStorage: [],
    },
    transport: {
      protocol: "HTTPS webhook",
      method: "POST",
      pathOrProcedure: "/api/webhooks/stripe",
      contentType: "Stripe webhook payload",
      credentialMode: "stripe-signature header",
      requiredHeaders: ["stripe-signature"],
      csrfControl: "Provider signature on raw body; browser CSRF token not applicable",
      corsPolicy: "server-to-server; no browser CORS dependency",
    },
    server: {
      entryFiles: ["src/app/api/webhooks/stripe/route.ts", "src/lib/billing/stripe-webhooks.ts"],
      handlers: ["POST", "ingestStripeWebhook", "verifyStripeWebhook", "reduceStripeWebhook"],
      middlewareOrder: ["fail-closed rate limit", "read raw body", "verify signature", "deduplicate", "reduce event"],
      authenticationFunction: "verifyStripeWebhook",
      authorizationPolicy: "POLICY.WEBHOOK.STRIPE_SIGNATURE",
      requestValidationSchema: "Stripe SDK event construction plus event-specific settlement guards",
      outputSchema: "{ ok: true, duplicate: boolean } or safe error envelope",
      businessService: "ingestStripeWebhook / reduceStripeWebhook",
      repositoryMethods: ["tx.webhookEvent.create", "event-specific billing updates"],
      rateLimitPolicy: "RATE.BILLING.STRIPE_WEBHOOK",
      idempotencyPolicy: "unique Stripe event ID and provider/payload hash",
    },
    databaseOperations: databaseOperationsFor("BILLING.WEBHOOK.PROCESS"),
    cacheOperations: [],
    backgroundOperations: [],
    externalOperations: [
      {
        provider: "Stripe",
        operation: "construct and validate signed webhook event",
        credentialScope: "webhook endpoint secret",
        requestSchema: "raw bytes plus stripe-signature",
        responseSchema: "Stripe.Event",
        timeoutPolicy: "not captured",
        retryPolicy: "provider delivery retry with local deduplication",
        webhookFollowUp: "event reducer may update local billing and entitlements",
      },
    ],
    response: {
      successStatus: 200,
      responseSchema: "{ ok: true, duplicate: boolean }",
      permittedFields: ["ok", "duplicate"],
      cachePolicy: "dynamic route; explicit response cache header not captured",
      frontendSuccessState: "No direct browser state; billing UI reads server-confirmed local state later",
    },
    failureModes: [
      {
        condition: "invalid or missing signature",
        externalStatus: 401,
        safeUserMessage: "Unauthorized",
        serverLogEvent: "StripeWebhookError (safe code)",
        retryPermitted: false,
      },
      {
        condition: "rate limit unavailable or exceeded",
        externalStatus: 429,
        safeUserMessage: "Too many requests",
        serverLogEvent: "rate-limit implementation telemetry not captured",
        retryPermitted: true,
      },
      {
        condition: "unhandled ingest failure",
        externalStatus: 500,
        safeUserMessage: "Webhook ingest failed",
        serverLogEvent: "route does not explicitly log the caught exception; control gap",
        retryPermitted: true,
      },
    ],
    dataClassification: ["FINANCIAL", "PERSONAL", "AUDIT_SECURITY"],
    auditEvents: ["AUDIT.BILLING.WEBHOOK.RECEIVED"],
    securityControls: ["raw-body signature verification", "fail-closed rate limit", "deduplication", "settlement validation"],
    threats: ["webhook forgery", "replay", "out-of-order events", "browser return treated as payment proof"],
    tests: [
      "src/lib/billing/stripe-readiness.test.ts",
      "src/lib/billing/stripe-webhook-settlement.test.ts",
    ],
    evidence: [
      "Signature verification and settlement helper tests exist.",
      "Generated SQL, complete event reducer operation list, request byte limit, out-of-order integration test and provider re-fetch evidence remain open.",
    ],
    owner: "billing-security",
    verificationStatus: "Partially verified",
  },
  {
    traceId: "PULSE.CONVERSATION.BLOCK",
    userStoryIds: ["PULSE.CONVERSATION.BLOCK_PARTICIPANT"],
    productArea: "Pulse",
    routePatterns: ["/messages/[id]", "/api/conversations/[id]/block"],
    screenIds: ["message-thread"],
    actionName: "Block a conversation participant and revoke realtime access",
    actionType: "update",
    actors: ["authenticated conversation participant"],
    authentication: "required",
    allowedRoles: ["member", "moderator", "administrator"],
    allowedTiers: ["free", "pro", "pro_plus"],
    requiredPermissions: ["conversation participant"],
    requiredRelationships: ["participant A or participant B"],
    featureFlags: [],
    frontend: {
      sourceFiles: ["src/app/messages/[id]/page.tsx"],
      components: ["MessageThreadPage"],
      eventHandlers: ["blockConversation bound server action"],
      forms: ["block participant form"],
      fields: ["conversationId bound on the server"],
      clientValidationSchemas: [],
      clientStateStores: [],
      sensitiveBrowserStorage: [],
    },
    transport: {
      protocol: "Next.js server action or HTTPS API",
      method: "POST",
      pathOrProcedure: "blockConversation / /api/conversations/[id]/block",
      contentType: "server-action form data or route parameters",
      credentialMode: "authenticated server session",
      requiredHeaders: [],
      csrfControl: "framework server-action origin control not independently captured; API route CSRF control not verified",
      corsPolicy: "same-origin expected; not verified",
    },
    server: {
      entryFiles: [
        "src/app/actions.ts",
        "src/app/api/conversations/[id]/block/route.ts",
        "src/lib/conversation-service.ts",
        "src/lib/realtime-service.ts",
      ],
      handlers: ["blockConversation", "POST", "setConversationBlock", "revokeConversationRealtimeGrants"],
      middlewareOrder: ["require current profile", "rate limit on API entry", "participant object lookup", "transaction", "realtime grant revoke", "audit", "broadcast"],
      authenticationFunction: "requireCurrentUserProfile",
      sessionValidationFunction: "getCurrentUser via requireCurrentUserProfile; details not captured in this trace seed",
      authorizationPolicy: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
      objectAuthorizationPolicy: "POLICY.PULSE.CONVERSATION.PARTICIPANT",
      propertyAuthorizationPolicy: "Only blockedById/blockedAt and UserBlock relation are set from server-derived identity",
      requestValidationSchema: "No explicit identifier schema; database object lookup is the current validation boundary",
      outputSchema: "{ item: conversation } for API; redirect/revalidation for server action",
      businessService: "setConversationBlock",
      repositoryMethods: ["getConversationForProfile", "tx.conversation.update", "tx.userBlock.upsert"],
      rateLimitPolicy: "RATE.PULSE.CONVERSATION.BLOCK applies to the API entry; server-action rate limit not captured",
      idempotencyPolicy: "UserBlock unique pair makes repeated block relation creation idempotent",
    },
    databaseOperations: databaseOperationsFor("PULSE.CONVERSATION.BLOCK"),
    cacheOperations: [],
    backgroundOperations: [],
    externalOperations: [
      {
        provider: "Supabase Realtime",
        operation: "revoke opaque conversation topic grants for both profiles",
        credentialScope: "server administrative client; exact database grants not captured",
        requestSchema: "requested_profile_ids[], requested_topics[]",
        responseSchema: "Supabase RPC error envelope",
        timeoutPolicy: "not captured",
        retryPolicy: "caller may retry block; UserBlock upsert is duplicate-safe",
      },
    ],
    response: {
      successStatus: 200,
      responseSchema: "conversation item or server-action navigation result",
      permittedFields: ["conversation projection returned by CONVERSATION_INCLUDE (not yet enumerated)"],
      cachePolicy: "server-action path revalidates; API cache headers not explicitly captured",
      frontendSuccessState: "Thread becomes blocked and message/call controls are disabled",
    },
    failureModes: [
      {
        condition: "not a conversation participant",
        externalStatus: 404,
        safeUserMessage: "Could not block conversation",
        serverLogEvent: "jsonError safe mapping; exact log event not captured",
        retryPermitted: false,
      },
      {
        condition: "rate limit exceeded on API entry",
        externalStatus: 429,
        safeUserMessage: "Too many requests",
        serverLogEvent: "rate-limit telemetry not captured",
        retryPermitted: true,
      },
      {
        condition: "realtime grant revocation fails",
        externalStatus: 500,
        safeUserMessage: "Could not block conversation",
        serverLogEvent: "realtime.grant_revoke_failed",
        retryPermitted: true,
      },
    ],
    dataClassification: ["PRIVATE_COMMUNICATION", "PERSONAL", "AUDIT_SECURITY"],
    auditEvents: ["AUDIT.PULSE.CONVERSATION.BLOCK"],
    securityControls: ["server session", "object participant predicate", "RLS", "server-derived blocked identity", "realtime grant revocation"],
    threats: ["BOLA", "block bypass", "stale realtime grant", "cross-user mass assignment"],
    tests: ["src/lib/realtime-authorization.test.ts"],
    evidence: [
      "Realtime revocation regression test exists.",
      "A full block endpoint authorization/CSRF/rate-limit/concurrency negative suite and normalized SQL remain open.",
    ],
    owner: "community-security",
    verificationStatus: "Partially verified",
  },
  {
    traceId: "MEDIA.ASSET.READ",
    userStoryIds: ["MEDIA.ASSET.VIEW_PROCESSING_STATUS"],
    productArea: "Media",
    routePatterns: ["/api/media/[id]"],
    screenIds: ["profile-media-status"],
    actionName: "Read owned media processing status",
    actionType: "read",
    actors: ["authenticated media uploader"],
    authentication: "required",
    allowedRoles: ["member", "moderator", "administrator"],
    allowedTiers: ["free", "pro", "pro_plus"],
    requiredPermissions: ["media uploader ownership"],
    requiredRelationships: ["MediaAsset.uploaderId equals current database user ID"],
    featureFlags: [],
    frontend: {
      sourceFiles: ["src/components/profile-media-status.tsx"],
      components: ["ProfileMediaStatus"],
      eventHandlers: ["status refresh fetch"],
      forms: [],
      fields: ["media ID encoded into the path"],
      clientValidationSchemas: [],
      clientStateStores: [],
      sensitiveBrowserStorage: [],
    },
    transport: {
      protocol: "HTTPS",
      method: "GET",
      pathOrProcedure: "/api/media/[id]",
      credentialMode: "authenticated server session",
      requiredHeaders: [],
      csrfControl: "not applicable to read",
      corsPolicy: "same-origin expected; not verified",
    },
    server: {
      entryFiles: ["src/app/api/media/[id]/route.ts", "src/lib/media-service.ts"],
      handlers: ["GET", "getMediaStatusForCurrentUser"],
      middlewareOrder: ["require current profile", "owned media query", "explicit response projection"],
      authenticationFunction: "requireCurrentUserProfile",
      authorizationPolicy: "POLICY.MEDIA.UPLOADER",
      objectAuthorizationPolicy: "POLICY.MEDIA.UPLOADER",
      requestValidationSchema: "No explicit media ID schema; the owner-bound database lookup is the current boundary",
      outputSchema: "{ item: explicit media status projection }",
      businessService: "getMediaStatusForCurrentUser",
      repositoryMethods: ["tx.mediaAsset.findFirst"],
    },
    databaseOperations: databaseOperationsFor("MEDIA.ASSET.READ"),
    cacheOperations: [],
    backgroundOperations: [],
    externalOperations: [],
    response: {
      successStatus: 200,
      responseSchema: "{ item: { id, originalName, scanStatus, processingStatus, processingError, createdAt, updatedAt } }",
      permittedFields: ["id", "originalName", "scanStatus", "processingStatus", "processingError", "createdAt", "updatedAt"],
      cachePolicy: "not explicitly captured",
      frontendSuccessState: "The current processing state is refreshed",
    },
    failureModes: [
      {
        condition: "signed out",
        externalStatus: 401,
        safeUserMessage: "Could not load media",
        serverLogEvent: "jsonError safe mapping; exact log event not captured",
        retryPermitted: true,
      },
      {
        condition: "missing, deleted or other-owner media",
        externalStatus: 404,
        safeUserMessage: "Could not load media",
        serverLogEvent: "media.not_found",
        retryPermitted: false,
      },
    ],
    dataClassification: ["USER_MEDIA", "PERSONAL"],
    auditEvents: [],
    securityControls: ["server session", "owner predicate", "deleted filter", "RLS", "explicit selected fields"],
    threats: ["BOLA", "excessive data exposure", "deleted-media leakage"],
    tests: ["src/lib/media-service.test.ts"],
    evidence: ["Ownership predicate is unit tested; route-level signed-out and cross-owner tests are missing."],
    owner: "media-security",
    verificationStatus: "Partially verified",
  },
  {
    traceId: "MEDIA.ASSET.DELETE",
    userStoryIds: ["MEDIA.ASSET.DELETE_OWN_UPLOAD"],
    productArea: "Media",
    routePatterns: ["/api/media/[id]"],
    screenIds: ["profile-media-status", "media-attachment-fields", "feed-post-card"],
    actionName: "Delete an owned media asset",
    actionType: "delete",
    actors: ["authenticated media uploader"],
    authentication: "required",
    allowedRoles: ["member", "moderator", "administrator"],
    allowedTiers: ["free", "pro", "pro_plus"],
    requiredPermissions: ["media uploader ownership"],
    requiredRelationships: ["MediaAsset.uploaderId equals current database user ID"],
    featureFlags: [],
    frontend: {
      sourceFiles: [
        "src/components/profile-media-status.tsx",
        "src/components/media-attachment-fields.tsx",
        "src/components/feed-post-card.tsx",
      ],
      components: ["ProfileMediaStatus", "MediaAttachmentFields", "FeedPostCard"],
      eventHandlers: ["DELETE fetch handlers"],
      forms: [],
      fields: ["media ID encoded into the path"],
      clientValidationSchemas: [],
      clientStateStores: [],
      sensitiveBrowserStorage: [],
    },
    transport: {
      protocol: "HTTPS",
      method: "DELETE",
      pathOrProcedure: "/api/media/[id]",
      credentialMode: "authenticated server session",
      requiredHeaders: [],
      csrfControl: "not explicitly captured",
      corsPolicy: "same-origin expected; not verified",
    },
    server: {
      entryFiles: ["src/app/api/media/[id]/route.ts", "src/lib/media-service.ts"],
      handlers: ["DELETE", "deleteMediaForCurrentUser"],
      middlewareOrder: ["require current profile", "per-user/object rate limit", "owner-bound transaction", "storage cleanup", "audit"],
      authenticationFunction: "requireCurrentUserProfile",
      authorizationPolicy: "POLICY.MEDIA.UPLOADER",
      objectAuthorizationPolicy: "POLICY.MEDIA.UPLOADER",
      propertyAuthorizationPolicy: "Only server-generated deletedAt and related cleanup mutations are written",
      requestValidationSchema: "No explicit media ID schema; the owner-bound database lookup is the current boundary",
      outputSchema: "{ item: tombstoned media record }",
      businessService: "deleteMediaForCurrentUser",
      repositoryMethods: ["tx.mediaAsset.findFirst", "tx.mediaAsset.updateMany", "related feed cleanup operations"],
      rateLimitPolicy: "RATE.MEDIA.DELETE",
      idempotencyPolicy: "deletedAt null predicate and affected-row count prevent repeated mutation",
    },
    databaseOperations: databaseOperationsFor("MEDIA.ASSET.DELETE"),
    cacheOperations: [],
    backgroundOperations: [],
    externalOperations: [
      {
        provider: "Supabase Storage",
        operation: "remove original and derived object paths",
        credentialScope: "server administrative storage client; exact scope not captured",
        requestSchema: "validated bucket plus server-stored/generated object paths",
        responseSchema: "Supabase storage removal result",
        timeoutPolicy: "not captured",
        retryPolicy: "failure is logged after the database tombstone; durable retry workflow not captured",
      },
    ],
    response: {
      successStatus: 200,
      responseSchema: "{ item: tombstoned media record }",
      permittedFields: ["full returned Prisma media record currently; explicit output allowlist is missing"],
      cachePolicy: "not explicitly captured",
      frontendSuccessState: "Media is removed from the current client surface",
    },
    failureModes: [
      {
        condition: "signed out",
        externalStatus: 401,
        safeUserMessage: "Could not delete media",
        serverLogEvent: "jsonError safe mapping; exact log event not captured",
        retryPermitted: true,
      },
      {
        condition: "missing, deleted or other-owner media",
        externalStatus: 404,
        safeUserMessage: "Could not delete media",
        serverLogEvent: "media.not_found",
        retryPermitted: false,
      },
      {
        condition: "storage cleanup fails after database tombstone",
        externalStatus: 200,
        safeUserMessage: "Media is removed from the product surface",
        serverLogEvent: "media.delete_storage_failed",
        retryPermitted: false,
      },
    ],
    dataClassification: ["USER_MEDIA", "PERSONAL", "AUDIT_SECURITY"],
    auditEvents: ["AUDIT.MEDIA.DELETE"],
    securityControls: ["server session", "owner predicate", "rate limit", "RLS", "affected-row check", "server-derived storage paths"],
    threats: ["BOLA", "CSRF", "path traversal", "duplicate deletion", "orphaned storage"],
    tests: ["src/lib/media-service.test.ts"],
    evidence: [
      "Owner predicate and affected-row guard are present.",
      "Explicit response projection, CSRF evidence, cross-owner endpoint test, storage retry and complete related-query map are missing.",
    ],
    owner: "media-security",
    verificationStatus: "Partially verified",
  },
  {
    traceId: "DESIGN_LAB.SCREEN.REVIEW",
    userStoryIds: ["DESIGN_LAB.REVIEW.SCREEN_CONTRACT"],
    productArea: "Design Lab",
    routePatterns: ["/design-lab"],
    screenIds: ["design-lab-master"],
    actionName: "Review a registered screen and its audit checklist",
    actionType: "read",
    actors: ["local reviewer", "explicitly enabled production reviewer"],
    authentication: "optional",
    allowedRoles: ["local reviewer", "isolated demo reviewer", "administrator"],
    allowedTiers: [],
    requiredPermissions: [],
    requiredRelationships: [],
    featureFlags: ["ENABLE_DEVICE_PREVIEWS in production"],
    frontend: {
      sourceFiles: ["src/components/demo-experience-screen-map.tsx"],
      components: ["DemoExperienceScreenMap", "MasterAuditChecklist"],
      eventHandlers: ["screen search", "family filter", "screen link navigation"],
      forms: [],
      fields: ["screen search", "family selector", "URL audit selectors"],
      clientValidationSchemas: [],
      clientStateStores: [],
      sensitiveBrowserStorage: [],
    },
    transport: {
      protocol: "HTTPS server-rendered page",
      method: "GET",
      pathOrProcedure: "/design-lab",
      credentialMode: "AuthKit cookie in the production application; none for local or explicitly isolated demo review",
      requiredHeaders: [],
      csrfControl: "not applicable to read-only page",
      corsPolicy: "same-origin page",
    },
    server: {
      entryFiles: [
        "src/app/design-lab/page.tsx",
        "src/lib/design-lab-access.ts",
        "src/lib/design-lab-access-policy.ts",
      ],
      handlers: [
        "DesignLabPage",
        "requireDesignLabReviewer",
        "resolveDesignLabAccessDecision",
      ],
      middlewareOrder: [
        "resolve Design Lab environment policy",
        "deny unless the production flag is exact",
        "require administrator outside the isolated demo",
        "render noindex screen map",
      ],
      authenticationFunction: "requireDesignLabReviewer -> requireAdminProfile when required",
      authorizationPolicy: "POLICY.DESIGN_LAB.PRODUCTION_FLAG",
      requestValidationSchema:
        "DesignLabSearchParams { area?: string | string[]; route?: string | string[] }; resolveDesignLabArea allowlists area and firstValue selects the first route value",
      outputSchema: "server-rendered Design Lab HTML",
      businessService: "DemoExperienceScreenMap",
      repositoryMethods: [],
    },
    databaseOperations: databaseOperationsFor("DESIGN_LAB.SCREEN.REVIEW"),
    cacheOperations: [],
    backgroundOperations: [],
    externalOperations: [],
    response: {
      successStatus: 200,
      responseSchema: "Design Lab HTML",
      permittedFields: ["synthetic registry and fixture metadata only"],
      cachePolicy: "page-level cache headers not captured",
      frontendSuccessState: "Reviewer can inspect route and checklist coverage",
    },
    failureModes: [
      {
        condition: "production feature flag disabled",
        externalStatus: 404,
        safeUserMessage: "Not found",
        serverLogEvent: "none captured",
        retryPermitted: false,
      },
      {
        condition: "production application flag enabled for an unauthenticated or non-admin visitor",
        externalStatus: 404,
        safeUserMessage: "Not found",
        serverLogEvent: "none captured",
        retryPermitted: false,
      },
    ],
    dataClassification: ["INTERNAL"],
    auditEvents: [],
    securityControls: ["server-side environment policy", "administrator review gate", "noindex metadata", "release gate separate from browser state"],
    threats: ["public preview exposure", "production data access", "production mutation", "query-parameter role escalation"],
    tests: [
      "src/components/design-lab-route-safety.test.ts",
      "src/lib/demo-production-isolation.test.ts",
      "src/components/design-lab-release-gate.test.ts",
    ],
    evidence: [
      "Server-side feature gating and noindex have source-contract tests.",
      "The production application now requires administrator review access; the isolated full-access demo remains intentionally synthetic and read-only.",
      "A complete runtime proof that root layouts and every Design Lab action avoid production data/mutations remains open.",
    ],
    owner: "design-lab-security",
    verificationStatus: "Partially verified",
  },
  {
    traceId: "ACCOUNT.DELETION.EXECUTE",
    userStoryIds: [
      "ACCOUNT.DELETION.REQUEST",
      "ACCOUNT.DELETION.FINALIZE_AFTER_GRACE_PERIOD",
    ],
    productArea: "Account",
    routePatterns: [
      "/account",
      "/api/users/me/delete",
      "/api/internal/account-deletion",
    ],
    screenIds: ["account-overview"],
    actionName: "Request and finalize account deletion",
    actionType: "delete",
    actors: ["authenticated account owner", "account-deletion scheduler"],
    authentication: "required",
    allowedRoles: ["member", "moderator", "administrator", "internal system"],
    allowedTiers: ["free", "pro", "pro_plus"],
    requiredPermissions: [
      "current-user self-service request",
      "valid internal secret for maintenance execution",
    ],
    requiredRelationships: [
      "request target is the current database user",
      "finalization candidate is banned and past the 30-day grace cutoff",
    ],
    featureFlags: [],
    frontend: {
      sourceFiles: ["src/app/account/page.tsx", "src/app/actions.ts"],
      components: ["SignedInAccount"],
      eventHandlers: ["requestAccountDeletion server action"],
      forms: ["account deletion form"],
      fields: ["no server-action field; JSON route separately requires confirm = DELETE"],
      clientValidationSchemas: [],
      clientStateStores: [],
      sensitiveBrowserStorage: [],
    },
    transport: {
      protocol: "Next.js server action and HTTPS internal maintenance request",
      method: "POST",
      pathOrProcedure:
        "src/app/actions.ts#requestAccountDeletion or /api/users/me/delete; later /api/internal/account-deletion",
      contentType: "server-action form submission or JSON deletion confirmation",
      credentialMode: "authenticated application session for request; configured internal secret for maintenance",
      requiredHeaders: ["X-Internal-Secret or Authorization bearer for the internal maintenance entry"],
      csrfControl:
        "Next.js server-action origin control is not independently verified; the JSON route has no independent CSRF evidence",
      corsPolicy: "same-origin request expected; internal entry is server-to-server",
    },
    server: {
      entryFiles: [
        "src/app/actions.ts",
        "src/app/api/users/me/delete/route.ts",
        "src/app/api/internal/account-deletion/route.ts",
        "src/lib/account-service.ts",
        "src/lib/internal-auth.ts",
      ],
      handlers: [
        "requestAccountDeletion server action",
        "POST /api/users/me/delete",
        "POST /api/internal/account-deletion",
        "requestAccountDeletion service",
        "runAccountDeletionMaintenance",
      ],
      middlewareOrder: [
        "authenticate current user and apply last-admin guard for self-service request",
        "persist ban/deletion request and audit atomically",
        "after grace period authenticate internal caller",
        "select at most 25 due candidates",
        "anonymize each candidate and enqueue two storage-prefix jobs atomically",
        "claim at most 10 storage jobs and delete at most 500 objects per job batch",
        "record safe finalization/storage audit outcomes",
      ],
      authenticationFunction: "requireCurrentUserProfile / requireInternalRequest",
      sessionValidationFunction: "requireCurrentUserProfile; WorkOS session revocation after request is not implemented",
      authorizationPolicy:
        "POLICY.ACCOUNT.DELETION.SELF_REQUEST and POLICY.ACCOUNT.DELETION.INTERNAL_MAINTENANCE",
      objectAuthorizationPolicy: "POLICY.ACCOUNT.DELETION.SELF_REQUEST",
      propertyAuthorizationPolicy:
        "server-derived target IDs, fixed tombstone fields and validated storage bucket/prefix jobs",
      requestValidationSchema:
        "deletionRequestSchema for the JSON route; no explicit server-action input schema; internal route has no body",
      outputSchema:
        "self-service requestedAt/grace response or AccountDeletionMaintenanceResult",
      businessService: "requestAccountDeletion / runAccountDeletionMaintenance",
      repositoryMethods: [
        "requestAccountDeletion Prisma transaction",
        "findPendingAccountDeletionUsers indexed system-context selector",
        "scrubProfileOwnedContent",
        "runAccountStorageDeletionJobs",
      ],
      rateLimitPolicy:
        "JSON request route: 3/user/hour fail closed; server action and internal maintenance have no explicit request rate limit",
      idempotencyPolicy:
        "storage-job claims use affected-row leases; deletion request/finalization duplicate-worker idempotency is not fully proven",
    },
    databaseOperations: databaseOperationsFor("ACCOUNT.DELETION.EXECUTE"),
    cacheOperations: [],
    backgroundOperations: [
      {
        queueOrScheduler: "Cloud Scheduler/internal maintenance route or operator script",
        jobType: "account deletion finalization and storage deletion",
        payloadSchema: "empty invocation; candidates selected by server time and database state",
        workerIdentity: "configured internal secret; cloud execution identity not captured",
        retryPolicy:
          "stale processing storage leases are reclaimable after 15 minutes; failed jobs are not automatically rescheduled",
        idempotencyKey: "DeletionJob ID claim; no candidate-level finalization idempotency key",
      },
    ],
    externalOperations: [
      {
        provider: "Supabase Storage",
        operation: "list and remove validated user-prefix objects from public and private user-media buckets",
        credentialScope: "server Supabase storage client; exact credential role not captured",
        requestSchema: "validated bucket plus users/{server-derived userId} prefix and at most 500 paths",
        responseSchema: "list result and remove error envelope",
        timeoutPolicy: "not captured",
        retryPolicy: "incomplete 500-object batches return the job to pending; failed jobs remain failed",
      },
    ],
    response: {
      successStatus: "server-action revalidation, 200 request response or 200 internal maintenance summary",
      responseSchema: "Deletion request acknowledgement or AccountDeletionMaintenanceResult",
      permittedFields: [
        "ok",
        "deletionRequestedAt",
        "graceDays",
        "aggregate scrub/archive/job/object counts",
        "ranAt",
        "cutoff",
      ],
      cachePolicy: "explicit private/no-store response evidence is not captured for these routes",
      frontendSuccessState: "Account is marked for deletion; maintenance has no direct member UI update",
    },
    failureModes: [
      {
        condition: "invalid session, confirmation or final-active-administrator request",
        externalStatus: "400/401/403 safe error",
        safeUserMessage: "Could not request account deletion",
        serverLogEvent: "jsonError mapping; exact log event not captured",
        retryPermitted: true,
      },
      {
        condition: "invalid internal secret",
        externalStatus: 403,
        safeUserMessage: "Could not run account deletion maintenance",
        serverLogEvent: "exact denial log event not captured",
        retryPermitted: false,
      },
      {
        condition: "storage deletion fails",
        externalStatus: "maintenance response includes storageDeletionJobsFailed",
        safeUserMessage: "No direct member-facing message exists",
        serverLogEvent: "user.delete.storage_failed with safe error code",
        retryPermitted: false,
      },
    ],
    dataClassification: [
      "PERSONAL",
      "AUTHENTICATION",
      "FINANCIAL",
      "PRIVATE_COMMUNICATION",
      "USER_MEDIA",
      "AUDIT_SECURITY",
    ],
    auditEvents: [
      "AUDIT.ACCOUNT.DELETION.REQUESTED",
      "AUDIT.ACCOUNT.DELETION.FINALIZED",
      "AUDIT.ACCOUNT.DELETION.STORAGE",
    ],
    securityControls: [
      "server-derived identity",
      "literal confirmation on the JSON route",
      "serialized last-active-administrator guard",
      "30-day grace cutoff",
      "bounded oldest-first candidate scan with User(isBanned, deletionRequestedAt, id) index",
      "bounded storage-job and storage-object batches",
      "sender-only message scrubbing",
      "validated storage bucket and owner prefix",
      "affected-row storage-job claim",
      "safe storage error codes",
    ],
    threats: [
      "cross-user deletion",
      "last-administrator removal",
      "counterparty content corruption",
      "storage path traversal/cross-user deletion",
      "duplicate workers",
      "incomplete provider/session deletion",
    ],
    tests: [
      "src/lib/account-deletion.test.ts",
      "scripts/check-account-deletion-pending-select-postgres.test.ts",
    ],
    evidence: [
      "Regression coverage proves last-admin guards remain in the request path, only sender-authored messages are scrubbed, jobs are scoped to both user-media buckets and storage batches/paths are bounded and validated.",
      "The dedicated disposable selector artifact proves the real at-most-25 oldest-first candidate query and Profile.id relation query as non-superuser, non-BYPASSRLS greyhoundiq_runtime, exact SQL/plans, protected User data under anonymous/unrelated-member replay, the three-column index and exact cleanup. Candidate leasing remains part of the finalization residual.",
      "WorkOS identity/session revocation and Stripe customer/subscription cleanup are not implemented; provider references are explicitly retained in the finalization audit.",
      "Managed-page and organization last-owner transfer/blocking is not implemented before finalization.",
      "The server-action request has no explicit confirmation field or rate limit; complete endpoint, RLS, concurrency, provider and transaction tests remain open.",
    ],
    owner: "privacy-security",
    verificationStatus: "Partially verified",
  },
  {
    traceId: "ACCOUNT.DATA_EXPORT.DOWNLOAD",
    userStoryIds: ["ACCOUNT.DATA_EXPORT.DOWNLOAD_OWN_DATA"],
    productArea: "Account",
    routePatterns: ["/account", "/api/users/me/export"],
    screenIds: ["account-overview"],
    actionName: "Download a bounded export of the current user's data",
    actionType: "download",
    actors: ["authenticated account owner"],
    authentication: "required",
    allowedRoles: ["member", "moderator", "administrator"],
    allowedTiers: ["free", "pro", "pro_plus"],
    requiredPermissions: ["current user may export only their own data"],
    requiredRelationships: ["every root query is bound to current.dbUserId or current.profileId"],
    featureFlags: [],
    frontend: {
      sourceFiles: [
        "src/components/site-header.tsx",
        "src/app/account/page.tsx",
        "src/components/user-data-export-form.tsx",
      ],
      components: ["UserDataExportForm"],
      eventHandlers: ["native same-origin POST form submission"],
      forms: ["POST /api/users/me/export"],
      fields: [],
      clientValidationSchemas: [],
      clientStateStores: [],
      sensitiveBrowserStorage: [],
    },
    transport: {
      protocol: "HTTPS",
      method: "POST",
      pathOrProcedure: "/api/users/me/export",
      contentType:
        "application/x-www-form-urlencoded request; application/json attachment response",
      credentialMode: "authenticated application session",
      requiredHeaders: [],
      csrfControl:
        "same-origin POST form; global proxy rejects cross-origin browser mutations and the handler rejects cross-site fetch metadata",
      corsPolicy: "same-origin form submission; no cross-origin mutation allowance",
      maximumRequestBytes: 0,
      timeoutMilliseconds: 30_000,
    },
    server: {
      entryFiles: [
        "src/app/api/users/me/export/route.ts",
        "src/lib/user-export-service.ts",
        "src/lib/user-export-policy.ts",
        "src/lib/account-service.ts",
      ],
      handlers: [
        "POST",
        "privateJson",
        "readUserExportData",
        "recordUserExportCompletion",
      ],
      middlewareOrder: [
        "reject cross-site fetch metadata when present",
        "require current profile",
        "apply fail-closed per-user rate limit",
        "run explicit owner-scoped selects in one request-context transaction",
        "enforce 501-row top-level and 21-row per-parent database sentinels",
        "reject collection/nested/byte overflow and forbidden fields",
        "atomically record export audit and self-owned completed ExportArtifact",
        "return private/no-store attachment",
      ],
      authenticationFunction: "requireCurrentUserProfile",
      sessionValidationFunction: "getCurrentUser via requireCurrentUserProfile; details not captured in this trace",
      authorizationPolicy: "POLICY.ACCOUNT.DATA_EXPORT.SELF",
      objectAuthorizationPolicy: "POLICY.ACCOUNT.DATA_EXPORT.SELF",
      propertyAuthorizationPolicy:
        "explicit service projections, safe media columns and assertUserExportDto forbidden-field denylist",
      requestValidationSchema:
        "empty form submission with no user-supplied object ID",
      outputSchema: "greyhoundiq-user-export/v2 DTO",
      businessService:
        "readUserExportData plus route-local DTO assembly and user-export-policy guards",
      repositoryMethods: [
        "user/profile plus ten bounded owner-scoped Prisma collection roots",
        "per-parent ListingMedia and MessageMedia LATERAL reads",
        "recordUserExportCompletion",
      ],
      rateLimitPolicy: "3 exports per database user per hour, fail closed",
      idempotencyPolicy: "none; repeated downloads are bounded by the rate limit",
    },
    databaseOperations: databaseOperationsFor("ACCOUNT.DATA_EXPORT.DOWNLOAD"),
    cacheOperations: [
      {
        operation: "disable browser/shared response caching",
        keyShape: "none",
        includesSecurityContext: true,
        invalidationTriggers: ["Cache-Control: private, no-store on success and handled failures"],
      },
    ],
    backgroundOperations: [],
    externalOperations: [],
    response: {
      successStatus: 200,
      responseSchema: "greyhoundiq-user-export/v2 JSON archive",
      permittedFields: [
        "schemaVersion",
        "exportedAt",
        "explicit user/profile/community/message/media/memory/agent-run DTO fields",
      ],
      cachePolicy: "private, no-store",
      frontendSuccessState: "Browser downloads a dated JSON attachment",
    },
    failureModes: [
      {
        condition: "cross-site fetch metadata",
        externalStatus: 403,
        safeUserMessage: "Cross-site request blocked",
        serverLogEvent: "none captured",
        retryPermitted: false,
      },
      {
        condition: "collection, nested media or serialized response exceeds a bound",
        externalStatus: 413,
        safeUserMessage:
          "This account export is too large for an immediate download. Contact support for a managed export.",
        serverLogEvent: "none captured",
        retryPermitted: false,
      },
      {
        condition: "per-user rate limit exceeded or unavailable",
        externalStatus: 429,
        safeUserMessage: "Too many requests",
        serverLogEvent: "rate-limit telemetry not captured",
        retryPermitted: true,
      },
      {
        condition: "forbidden field or database/audit/artifact error",
        externalStatus: "safe jsonError response",
        safeUserMessage: "Could not export account data",
        serverLogEvent: "exact correlation/audit failure event not captured",
        retryPermitted: true,
      },
    ],
    dataClassification: [
      "PERSONAL",
      "PRIVATE_COMMUNICATION",
      "USER_MEDIA",
      "AUDIT_SECURITY",
    ],
    auditEvents: ["AUDIT.ACCOUNT.DATA_EXPORT.DOWNLOADED"],
    securityControls: [
      "server session identity",
      "same-origin POST form plus global cross-origin mutation rejection",
      "handler fetch-metadata check",
      "owner predicates on every root read",
      "explicit field selects",
      "forbidden-field DTO traversal",
      "500-item top-level collection bounds",
      "20-item nested media bounds",
      "8 MiB response bound",
      "fail-closed per-user rate limit",
      "private/no-store success and error responses",
      "INSERT-only self-owned ExportArtifact RLS policy",
      "atomic user.export audit and completed ExportArtifact transaction",
    ],
    threats: [
      "cross-user export/BOLA",
      "excessive data exposure",
      "provider/storage identifier leakage",
      "unbounded resource consumption",
      "public/private cache leakage",
      "arbitrary export-artifact ownership",
    ],
    tests: [
      "src/lib/user-export-policy.test.ts",
      "src/app/api/users/me/export/route.test.ts",
      "scripts/check-rls-policies.ts",
    ],
    evidence: [
      "Unit coverage proves no-store, collection/byte bounds and forbidden provider/storage/agent-internal field rejection.",
      "The route-method contract proves export audit and artifact creation are POST-only and both account surfaces submit an explicit form.",
      "The forward-only RLS migration and static gate bind targetUserId/requestedByUserId to current database identity and grant no member update/delete permission.",
      "The disposable runtime proof captures both write statements under a non-superuser, non-BYPASSRLS member context, rejects other-member and anonymous exact replays, proves owner update/delete denial, and forces artifact failure to roll back its preceding audit.",
      "An oversized asynchronous export workflow does not exist; the route returns 413 with a managed-support recovery path.",
      "The eleven-root export read bundle still lacks generated SQL/query plans, direct cross-user runtime evidence and a representative-volume scale test; deployed role/catalog parity, staging and production also remain open.",
    ],
    owner: "privacy-security",
    verificationStatus: "Partially verified",
  },
  ...buildMandatoryPublicRacingTraceRecords(databaseOperationsFor),
] satisfies SecurityTraceContract[];

export const SECURITY_TRACES: SecurityTraceContract[] =
  SECURITY_TRACE_RECORDS.map((trace) => ({
    ...trace,
    transport: {
      contentType: "not verified",
      maximumRequestBytes: null,
      timeoutMilliseconds: null,
      ...trace.transport,
    },
    server: {
      sessionValidationFunction: "not verified",
      objectAuthorizationPolicy: "not verified",
      propertyAuthorizationPolicy: "not verified",
      rateLimitPolicy: "not verified",
      idempotencyPolicy: "not verified",
      ...trace.server,
    },
    cacheOperations: trace.cacheOperations.map((operation) => ({
      ttlSeconds: null,
      ...operation,
    })),
    externalOperations: trace.externalOperations.map((operation) => ({
      circuitBreakerPolicy: "not verified",
      webhookFollowUp: "not verified",
      ...operation,
    })),
  }));
