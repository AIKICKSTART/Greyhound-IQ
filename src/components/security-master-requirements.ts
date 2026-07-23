export const SECURITY_REQUIREMENT_STATUSES = [
  "not-assessed",
  "verified",
  "partially-verified",
  "not-verified",
  "control-missing",
  "implementation-vulnerable",
  "test-coverage-missing",
  "blocked-from-release",
  "risk-accepted-temporarily",
  "not-applicable-with-justification",
] as const;

export type SecurityRequirementStatus =
  (typeof SECURITY_REQUIREMENT_STATUSES)[number];

export const SECURITY_REQUIREMENT_SECTIONS = [
  "engagement-role",
  "required-input-registry",
  "trace-scope",
  "standards-baseline",
  "primary-objective-trace-chain",
  "primary-objective-trace-evidence",
  "security-language",
  "risk-acceptance",
  "authorised-testing-boundary",
  "server-authority",
  "deny-by-default",
  "least-privilege",
  "explicit-data-selection",
  "secure-failure",
  "architecture-application-surface",
  "architecture-infrastructure-surface",
  "architecture-component-record",
  "trust-boundary-diagram",
  "trace-identifier",
  "trace-identifier-example",
  "security-trace-contract",
  "security-trace-enum",
  "database-operation-contract",
  "database-operation-enum",
  "action-trace-user-context",
  "action-trace-frontend",
  "action-trace-request",
  "action-trace-server-entry",
  "action-trace-authorization",
  "action-trace-database",
  "action-trace-side-effect",
  "action-trace-response",
  "action-trace-evidence",
  "api-inventory-surface",
  "api-inventory-record",
  "api-inventory-management",
  "authentication-path",
  "authentication-control",
  "cookie-control",
  "csrf-control",
  "authorization-actor",
  "authorization-dimension",
  "object-authorization",
  "property-authorization",
  "tenant-isolation",
  "administration-control",
  "external-input-surface",
  "input-validation",
  "injection-prevention",
  "database-inventory",
  "database-column-record",
  "actual-query-capture",
  "database-query-record",
  "query-safety",
  "mutation-safety",
  "row-level-security",
  "database-role-separation",
  "migration-review",
  "api-top-ten",
  "resource-control",
  "sensitive-business-flow",
  "abuse-control",
  "idempotency-control",
  "cors-control",
  "http-control",
  "webhook-control",
  "queue-worker-control",
  "scheduled-task-control",
  "realtime-control",
  "voice-video-control",
  "file-media-inventory",
  "upload-validation",
  "upload-control",
  "upload-untrusted-claim",
  "download-control",
  "ssrf-control",
  "browser-data-handling",
  "frontend-authorization",
  "xss-surface",
  "browser-security-header",
  "external-link-embed",
  "threat-model-governance",
  "threat-public",
  "threat-racing",
  "threat-community",
  "threat-messaging",
  "threat-marketplace",
  "threat-account",
  "threat-administration",
  "threat-ai",
  "threat-design-lab",
  "third-party-inventory",
  "third-party-record",
  "third-party-response-validation",
  "third-party-prohibition",
  "billing-lifecycle",
  "billing-control",
  "personal-information-record",
  "privacy-minimisation",
  "retention-schedule",
  "deletion-lifecycle",
  "incident-readiness",
  "secret-inventory",
  "secret-record",
  "secret-control",
  "cryptography-record",
  "application-log-field",
  "application-log-prohibition",
  "audit-event",
  "audit-integrity",
  "alert-event",
  "alert-record",
  "infrastructure-review",
  "infrastructure-control",
  "supply-chain-control",
  "supply-chain-review",
  "endpoint-test-authentication",
  "endpoint-test-authorization",
  "endpoint-test-validation",
  "endpoint-test-injection-output",
  "endpoint-test-resource-abuse",
  "endpoint-test-concurrency",
  "endpoint-test-database",
  "endpoint-test-error",
  "endpoint-test-audit-failure",
  "mandatory-trace",
  "ci-gate",
  "ci-gate-governance",
  "security-finding-record",
  "finding-severity",
  "required-output",
  "registry-governance",
  "final-traceability-field",
  "final-summary-metric",
  "release-criterion",
  "implementation-cycle",
  "placeholder-prohibition",
  "reviewer-answerability",
] as const;

export type SecurityRequirementSection =
  (typeof SECURITY_REQUIREMENT_SECTIONS)[number];

export type SecurityRiskAcceptance = {
  owner: string;
  reason: string;
  severity: "critical" | "high" | "medium" | "low";
  compensatingControls: readonly string[];
  expiresOn: string;
  remediationPlan: string;
  retestRequirement: string;
};

export type SecurityMasterRequirement = {
  id: string;
  prompt: "security";
  section: SecurityRequirementSection;
  requirement: string;
  status: SecurityRequirementStatus;
  evidence: readonly string[];
  owner: string;
  releaseBlocking: boolean;
  riskAcceptance?: SecurityRiskAcceptance;
  notApplicableJustification?: string;
};

type RequirementSeed = readonly [id: string, requirement: string];

const DEFAULT_OWNER = "security-review";

function requirements(
  section: SecurityRequirementSection,
  seeds: readonly RequirementSeed[]
): SecurityMasterRequirement[] {
  return seeds.map(([id, requirement]) => ({
    id,
    prompt: "security",
    section,
    requirement,
    status: "not-assessed",
    evidence: [],
    owner: DEFAULT_OWNER,
    releaseBlocking: true,
  }));
}

function sectionRequirements(
  section: SecurityRequirementSection,
  seeds: readonly RequirementSeed[]
): SecurityMasterRequirement[] {
  return requirements(
    section,
    seeds.map(([id, requirement]) => [
      `security.${section}.${id
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9.-]+/g, "-")
        .toLowerCase()}`,
      requirement,
    ])
  );
}

function fieldRequirements(
  section: SecurityRequirementSection,
  group: string,
  subject: string,
  fields: readonly string[]
): SecurityMasterRequirement[] {
  return sectionRequirements(
    section,
    fields.map((field) => [
      `${group}.${field
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()}`,
      `${subject} must record ${field}.`,
    ])
  );
}

const ENGAGEMENT_ROLE = sectionRequirements("engagement-role", [
  ["application-security-architect", "Perform the work as a senior application-security architect."],
  ["backend-engineer", "Perform the work as a senior backend engineer."],
  ["database-security-engineer", "Perform the work as a senior database security engineer."],
  ["cloud-security-engineer", "Perform the work as a senior cloud security engineer."],
  ["privacy-engineer", "Perform the work as a senior privacy engineer."],
  ["site-reliability-engineer", "Perform the work as a senior site-reliability engineer."],
  ["authorised-security-tester", "Perform testing only as an authorized security tester."],
  ["audit-complete-system", "Audit the complete GreyhoundIQ system."],
  ["document-complete-system", "Document the complete GreyhoundIQ system."],
  ["test-complete-system", "Test the complete GreyhoundIQ system."],
  ["harden-complete-system", "Harden the complete GreyhoundIQ system."],
]);

const REQUIRED_INPUT_REGISTRIES = sectionRequirements("required-input-registry", [
  ["product", "Treat the existing product registry as a required input."],
  ["user-story", "Treat the existing user-story registry as a required input."],
  ["route", "Treat the existing route registry as a required input."],
  ["action", "Treat the existing action registry as a required input."],
  ["form", "Treat the existing form registry as a required input."],
  ["field", "Treat the existing field registry as a required input."],
  ["design-lab", "Treat the existing Design Lab registries as required inputs."],
  ["extend-incomplete", "Extend every required input registry where it is incomplete."],
]);

const TRACE_SCOPE = sectionRequirements("trace-scope", [
  ["user-story", "Create a complete and verifiable security trace for every user story."],
  ["route", "Create a complete and verifiable security trace for every route."],
  ["screen", "Create a complete and verifiable security trace for every screen."],
  ["form", "Create a complete and verifiable security trace for every form."],
  ["field", "Create a complete and verifiable security trace for every field."],
  ["interaction", "Create a complete and verifiable security trace for every interactive action."],
  ["not-visible-interface-only", "Do not limit analysis to the visible interface."],
  ["repository", "Inspect the complete repository."],
  ["deployed-architecture", "Inspect the deployed architecture."],
]);

const STANDARDS_BASELINE = sectionRequirements("standards-baseline", [
  ["asvs-5", "Use OWASP ASVS 5.0.0 as the application-control verification baseline."],
  ["owasp-top-10-2025", "Use OWASP Top 10:2025 as the web-risk baseline."],
  ["owasp-api-top-10-2023", "Use OWASP API Security Top 10:2023 as the API-risk baseline."],
  ["nist-ssdf-1-1", "Use NIST SSDF 1.1 as the final secure-development baseline."],
  ["nist-ssdf-1-2-draft", "Treat NIST SSDF 1.2 as draft rather than a final baseline."],
  ["australian-privacy-principles", "Map applicable Australian Privacy Principles."],
  ["app-11", "Map APP 11 security and retention obligations."],
  ["ndb", "Map the Notifiable Data Breaches scheme."],
  ["pci-scope", "Apply PCI DSS 4.0.1 only where GreyhoundIQ enters payment-card-data scope."],
  ["provider-held-card-data", "Prefer an architecture that keeps payment-card data with the payment provider."],
  ["defensible-target", "Target complete traceability, secure-by-design implementation, repeatable verification, no known critical or high-risk vulnerabilities, and explicit residual-risk documentation rather than claiming perfect security."],
]);

const PRIMARY_TRACE_CHAIN = sectionRequirements(
  "primary-objective-trace-chain",
  [
    ["user", "Trace the initiating user or system actor."],
    ["client", "Trace the browser or client interface."],
    ["frontend-component", "Trace the frontend component."],
    ["event-handler", "Trace the event handler."],
    ["client-validation", "Trace client-side validation."],
    ["request-builder", "Trace the request builder."],
    ["network-request", "Trace the network request."],
    ["edge-middleware", "Trace the CDN, reverse proxy, gateway, and middleware boundary."],
    ["server-entry", "Trace the server route or action."],
    ["authentication", "Trace authentication."],
    ["session-validation", "Trace session validation."],
    ["authorization", "Trace the authorization policy."],
    ["ownership", "Trace object ownership checks."],
    ["property-permission", "Trace property-level permissions."],
    ["request-schema", "Trace request-schema validation."],
    ["business-validation", "Trace business-rule validation."],
    ["service", "Trace the business service method."],
    ["repository", "Trace the repository or data-access method."],
    ["orm", "Trace the ORM operation."],
    ["normalized-query", "Trace the normalized database query."],
    ["database-role", "Trace the database role."],
    ["database-object", "Trace each table, view, function, or procedure."],
    ["transaction-locking", "Trace transaction and locking behavior."],
    ["constraints-rls", "Trace constraints and row-level policies."],
    ["cache", "Trace cache invalidation."],
    ["side-effect", "Trace each queue, job, or external side effect."],
    ["audit", "Trace the audit event."],
    ["application-response", "Trace the application response."],
    ["frontend-state", "Trace the frontend state update."],
    ["user-feedback", "Trace user feedback."],
  ]
);

const PRIMARY_TRACE_EVIDENCE = sectionRequirements(
  "primary-objective-trace-evidence",
  [
    ["source-file", "Identify the source file at every trace step."],
    ["source-symbol", "Identify the function, class, hook, component, or symbol at every trace step."],
    ["input", "Identify the input at every trace step."],
    ["output", "Identify the output at every trace step."],
    ["trust-boundary", "Identify every trust boundary crossed."],
    ["security-control", "Identify the security control applied at every trace step."],
    ["failure", "Identify failure behavior at every trace step."],
    ["test", "Identify the related test at every trace step."],
    ["evidence", "Identify evidence that each control works."],
    ["actual-behavior", "Document what the system actually does rather than what labels or documentation imply."],
    ["database-continuity", "Continue every action trace through the datastore or external side effect and back to the user."],
    ["frontend-not-authority", "Do not treat a hidden button as evidence that an action is secure."],
    ["implementation-required", "Implement missing controls and fixes rather than stopping at documentation."],
  ]
);

const SECURITY_LANGUAGE = sectionRequirements("security-language", [
  ["no-perfectly-secure", "Do not conclude that the system is perfectly secure."],
  ["no-100-percent-secure", "Do not conclude that the system is 100% secure."],
  ["no-impossible-to-exploit", "Do not conclude that exploitation is impossible."],
  ["no-fully-protected-without-evidence", "Do not use fully protected without defined evidence."],
  ["no-hidden-route-security", "Do not call a route secure because it is hidden."],
  ["no-frontend-validation-security", "Do not call an action secure because the frontend validates it."],
  ["status-verified", "Support the verification status Verified."],
  ["status-partial", "Support the verification status Partially verified."],
  ["status-not-verified", "Support the verification status Not verified."],
  ["status-control-missing", "Support the verification status Control missing."],
  ["status-vulnerable", "Support the verification status Implementation vulnerable."],
  ["status-test-missing", "Support the verification status Test coverage missing."],
  ["status-release-blocked", "Support the verification status Blocked from release."],
  ["status-risk-accepted", "Support the verification status Risk accepted temporarily."],
  ["status-not-applicable", "Support the verification status Not applicable with justification."],
]);

const RISK_ACCEPTANCE = sectionRequirements("risk-acceptance", [
  ["owner", "Every accepted risk must identify a risk owner."],
  ["reason", "Every accepted risk must include a written reason."],
  ["severity", "Every accepted risk must state a severity."],
  ["compensating-controls", "Every accepted risk must list compensating controls."],
  ["expiry", "Every accepted risk must have an expiry date."],
  ["remediation", "Every accepted risk must include a remediation plan."],
  ["retest", "Every accepted risk must include a retest requirement."],
  ["no-silent-critical-high", "Do not silently accept a critical or high-risk vulnerability."],
]);

const AUTHORISED_TESTING = sectionRequirements(
  "authorised-testing-boundary",
  [
    ["intrusive-scope", "Perform intrusive testing only against explicitly authorized local, development, test, or staging systems."],
    ["no-production-load", "Do not perform disruptive load tests against production."],
    ["no-real-credential-attacks", "Do not attempt credential attacks against real users."],
    ["no-private-data-extraction", "Do not extract real private information."],
    ["no-production-secret-docs", "Do not copy production secrets into documentation."],
    ["no-production-session-storage", "Do not store production session tokens."],
    ["no-production-destructive-query", "Do not run destructive database queries against production."],
    ["no-live-malware-upload", "Do not upload malicious content to a real public environment."],
    ["no-live-payment-replay", "Do not replay real payment events against production."],
    ["no-private-fixtures", "Do not use live customer messages or files as Design Lab fixtures."],
    ["no-weakened-controls", "Do not weaken production controls to make testing easier."],
    ["safe-production-confirmation", "Confirm production behavior only through safe read-only inspection, configuration evidence, sanitized telemetry, or an explicitly approved test account."],
  ]
);

const SERVER_AUTHORITY = sectionRequirements("server-authority", [
  ["identity", "Treat server-resolved user identity as authoritative."],
  ["session", "Treat server-validated session validity as authoritative."],
  ["role", "Treat server-resolved role as authoritative."],
  ["organization", "Treat server-resolved organization membership as authoritative."],
  ["team", "Treat server-resolved team membership as authoritative."],
  ["page", "Treat server-resolved page membership as authoritative."],
  ["ownership", "Treat server-resolved ownership as authoritative."],
  ["plan", "Treat server-resolved subscription plan as authoritative."],
  ["entitlement", "Treat server-resolved feature entitlement as authoritative."],
  ["moderation", "Treat server-resolved moderation powers as authoritative."],
  ["administration", "Treat server-resolved administration powers as authoritative."],
  ["billing", "Treat server-resolved billing status as authoritative."],
  ["payment", "Treat server-confirmed payment status as authoritative."],
  ["verification", "Treat server-resolved verification status as authoritative."],
  ["listing", "Treat server-resolved listing status as authoritative."],
  ["visibility", "Treat server-resolved data visibility as authoritative."],
  ["relationships", "Treat server-resolved object relationships as authoritative."],
  ["blocks", "Treat server-resolved block relationships as authoritative."],
  ["privacy", "Treat server-resolved privacy settings as authoritative."],
  ["state-transitions", "Treat server-validated state transitions as authoritative."],
  ["browser-untrusted", "Never trust browser-supplied authority values."],
  ["client-usability-only", "Use client-side permission checks only as usability controls."],
]);

const DENY_DEFAULT = sectionRequirements("deny-by-default", [
  ["authentication", "Deny safely when authentication is missing, invalid, expired, ambiguous, or unavailable."],
  ["policy", "Deny safely when the authorization policy is missing, invalid, ambiguous, or unavailable."],
  ["role", "Deny safely when the required role is missing or invalid."],
  ["ownership", "Deny safely when ownership is missing or ambiguous."],
  ["tenant", "Deny safely when tenant or organization context is missing or ambiguous."],
  ["entitlement", "Deny safely when feature entitlement is missing or invalid."],
  ["verification", "Deny safely when required verification is missing or invalid."],
  ["identifier", "Deny safely when an object identifier is invalid."],
  ["relationship", "Deny safely when a required relationship is missing."],
  ["state", "Deny safely when a required business state is missing or invalid."],
  ["lookup-not-permission", "Do not infer permission from a successful database lookup."],
]);

const LEAST_PRIVILEGE = sectionRequirements("least-privilege", [
  ["browser", "Give the browser only the minimum required access."],
  ["server-route", "Give each server route only the minimum required access."],
  ["worker", "Give each worker only the minimum required access."],
  ["queue-consumer", "Give each queue consumer only the minimum required access."],
  ["database-connection", "Give each database connection only the minimum required access."],
  ["database-role", "Give each database role only the minimum required access."],
  ["storage", "Give each storage client only the minimum required access."],
  ["payment", "Give payment integrations only the minimum required access."],
  ["email", "Give email services only the minimum required access."],
  ["ai", "Give AI providers only the minimum required access."],
  ["admin-tool", "Give administration tools only the minimum required access."],
  ["deployment", "Give deployment pipelines only the minimum required access."],
  ["operator", "Give human operators only the minimum required access."],
  ["no-app-superuser", "Do not use a database superuser for ordinary application requests."],
  ["no-cloud-admin", "Do not use broad cloud-administrator credentials for ordinary application requests."],
]);

const EXPLICIT_DATA_SELECTION = sectionRequirements("explicit-data-selection", [
  ["select-fields", "Select only explicitly allowed fields."],
  ["mutate-fields", "Mutate only explicitly allowed fields."],
  ["return-fields", "Return only explicitly allowed fields."],
  ["no-select-star", "Do not use SELECT * for sensitive records."],
  ["no-automatic-serialization", "Do not rely on automatic ORM serialization for client responses."],
  ["no-request-spread", "Do not spread arbitrary request objects into database mutations."],
  ["no-complete-entity", "Do not return complete database entities to the client."],
  ["no-frontend-redaction", "Do not rely on frontend code to hide sensitive fields."],
  ["no-generic-update", "Do not expose generic update-object endpoints without field allowlists."],
]);

const SECURE_FAILURE = sectionRequirements("secure-failure", [
  ["deny", "A failure must deny the unsafe operation."],
  ["rollback", "A failure must roll back incomplete transactions."],
  ["redact", "A failure must not leak secrets or internal details."],
  ["user-message", "A failure must provide a safe user message."],
  ["correlation-id", "A failure must provide a correlation or reference ID."],
  ["diagnostics", "A failure must record sufficient server-side diagnostic information."],
  ["existence-hiding", "A failure must avoid revealing whether a protected object exists."],
  ["retry-context", "A recoverable failure must preserve enough context for a safe retry."],
]);

const APPLICATION_SURFACES = sectionRequirements(
  "architecture-application-surface",
  [
    ["public-route", "Discover every public route."],
    ["authenticated-route", "Discover every authenticated route."],
    ["dynamic-route", "Discover every dynamic route."],
    ["administration-route", "Discover every administration route."],
    ["api-route", "Discover every API route."],
    ["route-handler", "Discover every route handler."],
    ["server-action", "Discover every server action."],
    ["rpc", "Discover every remote procedure call."],
    ["graphql-query", "Discover every GraphQL query."],
    ["graphql-mutation", "Discover every GraphQL mutation."],
    ["graphql-subscription", "Discover every GraphQL subscription."],
    ["trpc", "Discover every tRPC procedure."],
    ["rest", "Discover every REST endpoint."],
    ["websocket", "Discover every WebSocket connection."],
    ["websocket-event", "Discover every WebSocket event."],
    ["sse", "Discover every server-sent event."],
    ["upload", "Discover every file-upload endpoint."],
    ["signed-upload", "Discover every signed-upload generator."],
    ["download", "Discover every download endpoint."],
    ["auth-callback", "Discover every authentication callback."],
    ["payment-return", "Discover every payment return route."],
    ["payment-webhook", "Discover every payment webhook."],
    ["provider-webhook", "Discover every other provider webhook."],
    ["internal-service", "Discover every internal service endpoint."],
    ["scheduled-task", "Discover every scheduled task."],
    ["cron", "Discover every cron job."],
    ["queue-publisher", "Discover every queue publisher."],
    ["queue-consumer", "Discover every queue consumer."],
    ["worker", "Discover every background worker."],
    ["database-trigger", "Discover every database trigger."],
    ["database-function", "Discover every database function."],
    ["search-index", "Discover every search-index operation."],
    ["cache", "Discover every cache operation."],
    ["ai-tool", "Discover every AI tool invocation."],
    ["admin-cli", "Discover every command-line administration operation."],
    ["design-lab-simulation", "Discover every Design Lab simulation endpoint."],
    ["legacy", "Discover every legacy endpoint."],
    ["deprecated", "Discover every deprecated API version."],
    ["debug", "Discover every debug or diagnostics route."],
    ["source-search", "Search source code and route definitions for application surfaces."],
    ["framework-search", "Search framework configuration for application surfaces."],
    ["test-search", "Search tests and API documentation for application surfaces."],
    ["client-search", "Search generated clients and mobile clients for application surfaces."],
    ["email-worker-search", "Search email links and worker code for application surfaces."],
    ["not-route-folder-only", "Do not rely only on the route folder for discovery."],
  ]
);

const INFRASTRUCTURE_SURFACES = sectionRequirements(
  "architecture-infrastructure-surface",
  [
    ["dns", "Map DNS."],
    ["domains", "Map domains and subdomains."],
    ["cdn", "Map the CDN."],
    ["waf", "Map the web application firewall."],
    ["load-balancer", "Map load balancers."],
    ["reverse-proxy", "Map reverse proxies."],
    ["application-servers", "Map application servers."],
    ["serverless", "Map serverless functions."],
    ["containers", "Map containers."],
    ["internal-services", "Map internal services."],
    ["network-boundaries", "Map VPC or virtual-network boundaries."],
    ["subnets", "Map public and private subnets."],
    ["database-hosts", "Map database hosts."],
    ["replicas", "Map read replicas."],
    ["poolers", "Map connection poolers."],
    ["caches", "Map cache systems."],
    ["queues", "Map queues."],
    ["object-storage", "Map object storage."],
    ["search", "Map search services."],
    ["monitoring", "Map monitoring systems."],
    ["logs", "Map log stores."],
    ["secrets", "Map secrets managers."],
    ["cicd", "Map CI/CD systems."],
    ["source-control", "Map source-control integrations."],
    ["backups", "Map backup systems."],
    ["authentication-provider", "Map authentication providers."],
    ["payment-provider", "Map payment providers."],
    ["email-provider", "Map email providers."],
    ["messaging-provider", "Map messaging and call providers."],
    ["analytics-provider", "Map analytics providers."],
    ["ai-provider", "Map AI providers."],
    ["racing-provider", "Map racing-data providers."],
  ]
);

const INFRASTRUCTURE_COMPONENT_RECORD = fieldRequirements(
  "architecture-component-record",
  "component",
  "Every architecture component record",
  [
    "publicOrPrivateExposure",
    "authenticationMethod",
    "networkRestrictions",
    "credentialUsed",
    "dataProcessed",
    "dataStored",
    "encryption",
    "logging",
    "retention",
    "responsibleOwner",
    "failureImpact",
    "recoveryMethod",
  ]
);

const TRUST_BOUNDARY_DIAGRAMS = sectionRequirements("trust-boundary-diagram", [
  ["public-browsing", "Create a data-flow and trust-boundary diagram for public browsing."],
  ["authentication", "Create a data-flow and trust-boundary diagram for authentication."],
  ["authenticated-use", "Create a data-flow and trust-boundary diagram for authenticated application use."],
  ["administration", "Create a data-flow and trust-boundary diagram for administration."],
  ["billing", "Create a data-flow and trust-boundary diagram for billing."],
  ["racing-ingestion", "Create a data-flow and trust-boundary diagram for racing-data ingestion."],
  ["community", "Create a data-flow and trust-boundary diagram for community content."],
  ["messaging", "Create a data-flow and trust-boundary diagram for private messaging."],
  ["calls", "Create a data-flow and trust-boundary diagram for voice and video calls."],
  ["marketplace", "Create a data-flow and trust-boundary diagram for Marketplace."],
  ["uploads", "Create a data-flow and trust-boundary diagram for file uploads."],
  ["exports", "Create a data-flow and trust-boundary diagram for data exports."],
  ["deletion", "Create a data-flow and trust-boundary diagram for account deletion."],
  ["ai-tools", "Create a data-flow and trust-boundary diagram for AI tools."],
  ["design-lab", "Create a data-flow and trust-boundary diagram for Design Lab."],
  ["cicd", "Create a data-flow and trust-boundary diagram for CI/CD and deployment."],
  ["format", "Use Mermaid or the project's existing diagram format."],
  ["external-actors", "Identify external actors in every diagram."],
  ["internal-actors", "Identify internal actors in every diagram."],
  ["processes", "Identify processes in every diagram."],
  ["datastores", "Identify datastores in every diagram."],
  ["external-services", "Identify external services in every diagram."],
  ["trust-boundaries", "Identify trust boundaries in every diagram."],
  ["authentication-boundaries", "Identify authentication boundaries in every diagram."],
  ["authorization-boundaries", "Identify authorization boundaries in every diagram."],
  ["encryption-boundaries", "Identify encryption boundaries in every diagram."],
  ["sensitive-data-flows", "Identify sensitive-data flows in every diagram."],
  ["entry-points", "Identify entry points in every diagram."],
  ["exit-points", "Identify exit points in every diagram."],
]);

const TRACE_IDENTIFIERS = sectionRequirements("trace-identifier", [
  ["per-action", "Assign one permanent trace ID to every meaningful user and system action."],
  ["format", "Use the <ProductArea>.<ScreenOrService>.<Action> trace-ID format or an equivalent stable convention."],
  ["user-stories", "Use the same trace ID in user stories."],
  ["frontend", "Use the same trace ID in frontend components."],
  ["api-inventory", "Use the same trace ID in the API inventory."],
  ["server-policies", "Use the same trace ID in server policies."],
  ["database-map", "Use the same trace ID in the database-query map."],
  ["audit-registry", "Use the same trace ID in the audit-event registry."],
  ["analytics", "Use the same trace ID in the analytics registry."],
  ["tests", "Use the same trace ID in test names."],
  ["threat-model", "Use the same trace ID in the threat model."],
  ["findings", "Use the same trace ID in security findings."],
  ["fixtures", "Use the same trace ID in Design Lab fixtures."],
  ["coverage", "Use the same trace ID in the final coverage report."],
  ["not-api-boundary", "Do not consider a trace mapped when it ends at the API boundary."],
]);

const TRACE_IDENTIFIER_EXAMPLES = sectionRequirements("trace-identifier-example", [
  ["public-home-start-sign-in", "Use a stable trace ID equivalent to PUBLIC.HOME.START_SIGN_IN for starting sign-in from the homepage."],
  ["auth-callback-complete", "Use a stable trace ID equivalent to AUTH.CALLBACK.COMPLETE for completing an authentication callback."],
  ["racing-open-dog", "Use a stable trace ID equivalent to RACING.RACE_DETAIL.OPEN_DOG for opening a dog from race detail."],
  ["community-create-post", "Use a stable trace ID equivalent to COMMUNITY.FEED.CREATE_POST for creating a Feed post."],
  ["community-add-comment", "Use a stable trace ID equivalent to COMMUNITY.POST.ADD_COMMENT for adding a comment."],
  ["pulse-send-message", "Use a stable trace ID equivalent to PULSE.THREAD.SEND_MESSAGE for sending a message."],
  ["marketplace-save", "Use a stable trace ID equivalent to MARKETPLACE.LISTING.SAVE for saving a listing."],
  ["marketplace-create", "Use a stable trace ID equivalent to MARKETPLACE.LISTING.CREATE for creating a listing."],
  ["account-profile-update", "Use a stable trace ID equivalent to ACCOUNT.PROFILE.UPDATE for updating a profile."],
  ["account-team-role", "Use a stable trace ID equivalent to ACCOUNT.TEAM.CHANGE_ROLE for changing a team role."],
  ["billing-checkout", "Use a stable trace ID equivalent to BILLING.CHECKOUT.START for starting checkout."],
  ["billing-webhook", "Use a stable trace ID equivalent to BILLING.WEBHOOK.PROCESS for processing a billing webhook."],
  ["admin-user-status", "Use a stable trace ID equivalent to ADMIN.USERS.CHANGE_STATUS for changing user status."],
  ["ai-start-run", "Use a stable trace ID equivalent to AI.AGENT.START_RUN for starting an AI run."],
  ["design-lab-simulate", "Use a stable trace ID equivalent to DESIGN_LAB.SCREEN.SIMULATE_ACTION for a Design Lab simulation."],
]);

const SECURITY_TRACE_CONTRACT = [
  ...fieldRequirements("security-trace-contract", "identity", "Each SecurityTraceContract", [
    "traceId", "userStoryIds", "productArea", "routePatterns", "screenIds", "actionName", "actionType",
  ]),
  ...fieldRequirements("security-trace-contract", "access", "Each SecurityTraceContract", [
    "actors", "authentication", "allowedRoles", "allowedTiers", "requiredPermissions", "requiredRelationships", "featureFlags",
  ]),
  ...fieldRequirements("security-trace-contract", "frontend", "Each SecurityTraceContract frontend record", [
    "sourceFiles", "components", "eventHandlers", "forms", "fields", "clientValidationSchemas", "clientStateStores", "sensitiveBrowserStorage",
  ]),
  ...fieldRequirements("security-trace-contract", "transport", "Each SecurityTraceContract transport record", [
    "protocol", "method", "pathOrProcedure", "contentType", "credentialMode", "requiredHeaders", "csrfControl", "corsPolicy", "maximumRequestBytes", "timeoutMilliseconds",
  ]),
  ...fieldRequirements("security-trace-contract", "server", "Each SecurityTraceContract server record", [
    "entryFiles", "handlers", "middlewareOrder", "authenticationFunction", "sessionValidationFunction", "authorizationPolicy", "objectAuthorizationPolicy", "propertyAuthorizationPolicy", "requestValidationSchema", "outputSchema", "businessService", "repositoryMethods", "rateLimitPolicy", "idempotencyPolicy",
  ]),
  ...fieldRequirements("security-trace-contract", "database", "Each SecurityTraceContract", ["databaseOperations"]),
  ...fieldRequirements("security-trace-contract", "cache", "Each SecurityTraceContract cache operation", [
    "operation", "keyShape", "includesSecurityContext", "ttlSeconds", "invalidationTriggers",
  ]),
  ...fieldRequirements("security-trace-contract", "background", "Each SecurityTraceContract background operation", [
    "queueOrScheduler", "jobType", "payloadSchema", "workerIdentity", "retryPolicy", "idempotencyKey",
  ]),
  ...fieldRequirements("security-trace-contract", "external", "Each SecurityTraceContract external operation", [
    "provider", "operation", "credentialScope", "requestSchema", "responseSchema", "timeoutPolicy", "retryPolicy", "circuitBreakerPolicy", "webhookFollowUp",
  ]),
  ...fieldRequirements("security-trace-contract", "response", "Each SecurityTraceContract response", [
    "successStatus", "responseSchema", "permittedFields", "cachePolicy", "frontendSuccessState",
  ]),
  ...fieldRequirements("security-trace-contract", "failure", "Each SecurityTraceContract failure mode", [
    "condition", "externalStatus", "safeUserMessage", "serverLogEvent", "retryPermitted",
  ]),
  ...fieldRequirements("security-trace-contract", "governance", "Each SecurityTraceContract", [
    "dataClassification", "auditEvents", "securityControls", "threats", "tests", "evidence", "owner", "verificationStatus",
  ]),
  ...sectionRequirements("security-trace-contract", [
    ["single-authority", "Maintain one authoritative machine-readable security trace registry."],
    ["architecture-adaptation", "Adapt the registry contract to the existing architecture without losing required information."],
    ["ci-validation", "Generate or validate the security trace registry in CI to prevent silent drift from code."],
  ]),
];

const SECURITY_TRACE_ENUMS = [
  ...sectionRequirements("security-trace-enum", [
    ["authentication-public", "Allow public as a SecurityTraceContract authentication value."],
    ["authentication-optional", "Allow optional as a SecurityTraceContract authentication value."],
    ["authentication-required", "Allow required as a SecurityTraceContract authentication value."],
  ]),
  ...[
    "read", "create", "update", "delete", "upload", "download", "authentication", "billing", "administration", "background", "webhook", "realtime", "external",
  ].flatMap((actionType) =>
    sectionRequirements("security-trace-enum", [
      [`action-${actionType}`, `Allow ${actionType} as a SecurityTraceContract action type.`],
    ])
  ),
];

const DATABASE_OPERATION_CONTRACT = fieldRequirements(
  "database-operation-contract",
  "field",
  "Each DatabaseOperationContract",
  [
    "queryId", "traceId", "sourceFile", "sourceSymbol", "ormOrDriver", "ormOperation", "normalizedSql", "storedProcedure", "databaseFunction", "databaseRole", "databaseName", "schemaName", "operationType", "tables", "views", "columnsRead", "columnsWritten", "boundParameters", "parameterized", "tenantPredicate", "ownershipPredicate", "visibilityPredicate", "rowLevelSecurityPolicies", "expectedRowCount", "maximumRowCount", "paginationRequired", "transactionBoundary", "isolationLevel", "locks", "concurrencyControl", "indexesExpected", "constraintsReliedOn", "triggersInvoked", "timeoutMilliseconds", "explainPlanEvidence", "sensitiveColumns", "returnedDataShape", "notFoundBehaviour", "unauthorizedBehaviour", "conflictBehaviour", "failureBehaviour", "tests",
  ]
);

const DATABASE_OPERATION_ENUMS = [
  ...[
    "select", "insert", "update", "delete", "upsert", "procedure", "transaction",
  ].flatMap((operationType) =>
    sectionRequirements("database-operation-enum", [
      [`operation-${operationType}`, `Allow ${operationType} as a DatabaseOperationContract operation type.`],
    ])
  ),
];

const ACTION_TRACE_USER_CONTEXT = fieldRequirements(
  "action-trace-user-context", "field", "Every action trace user-context section", [
    "actor", "authenticationState", "role", "organisationOrTenant", "ownershipRelationship", "subscriptionTier", "featureEntitlements", "privacyRelationship", "blockRelationship", "requiredObjectState", "entryRoute", "previousRoute", "intendedOutcome",
  ]
);

const ACTION_TRACE_FRONTEND = [
  ...fieldRequirements("action-trace-frontend", "field", "Every action trace frontend-trigger section", [
    "route", "component", "buttonLinkFormOrEvent", "accessibleLabel", "eventHandler", "clientHook", "clientValidation", "hiddenValues", "browserStorageUsed", "queryParametersUsed", "headersGenerated", "conditionalRendering", "frontendSecurityDecision",
  ]),
  ...sectionRequirements("action-trace-frontend", [
    ["usability-control", "Explicitly classify frontend security checks as usability controls rather than authoritative controls."],
  ]),
];

const ACTION_TRACE_REQUEST = fieldRequirements(
  "action-trace-request", "field", "Every action trace request section", [
    "httpMethodOrProcedureType", "exactRoutePattern", "contentType", "bodySchema", "queryStringSchema", "pathParameterSchema", "requiredHeaders", "authenticationMechanism", "csrfMechanism", "originValidation", "requestSizeLimit", "timeout", "rateLimit", "idempotencyKey", "correlationId", "cacheBehaviour",
  ]
);

const ACTION_TRACE_SERVER_ENTRY = [
  ...fieldRequirements("action-trace-server-entry", "field", "Every action trace server-entry section", [
    "serverFile", "handler", "middlewareExecutionOrder", "authenticationFunction", "sessionValidation", "tokenValidation", "tenantResolution", "featureGateEvaluation", "requestParsing", "requestValidation", "authorisationFunction", "businessServiceCalled",
  ]),
  ...sectionRequirements("action-trace-server-entry", [
    ["alternate-entry-points", "Confirm that alternate entry points cannot bypass the same controls."],
  ]),
];

const ACTION_TRACE_AUTHORIZATION = fieldRequirements(
  "action-trace-authorization", "field", "Every action trace authorization-decision section", [
    "functionLevelPermission", "objectLevelPermission", "propertyLevelPermission", "ownershipCheck", "tenantOrOrganisationCheck", "relationshipCheck", "blockOrPrivacyCheck", "subscriptionEntitlement", "recordStatusRequirement", "allowedStateTransition", "administratorModeratorDistinction", "denialResponse", "auditEvent", "trustedServerValuesAndSources",
  ]
);

const ACTION_TRACE_DATABASE = fieldRequirements(
  "action-trace-database", "field", "Every action trace database-activity section", [
    "repositoryMethod", "ormOperation", "normalisedSql", "boundParametersWithoutValues", "databaseRole", "tablesAndColumns", "tenantPredicate", "ownershipPredicate", "visibilityPredicate", "rowLevelSecurityPolicy", "expectedRows", "maximumRows", "indexes", "constraints", "transaction", "locks", "isolationLevel", "concurrencyHandling", "queryTimeout", "failureBehaviour",
  ]
);

const ACTION_TRACE_SIDE_EFFECT = fieldRequirements(
  "action-trace-side-effect", "field", "Every action trace side-effect section", [
    "cacheWriteOrInvalidation", "queueEvent", "email", "notification", "fileOperation", "searchIndexing", "analyticsEvent", "auditEvent", "paymentProviderOperation", "aiProviderOperation", "otherExternalApi", "retryBehaviour", "duplicateEventBehaviour", "outOfOrderEventBehaviour",
  ]
);

const ACTION_TRACE_RESPONSE = fieldRequirements(
  "action-trace-response", "field", "Every action trace response section", [
    "httpOrProcedureStatus", "responseSchema", "explicitReturnedFields", "redactedFields", "cacheHeaders", "browserStorageEffects", "frontendStateUpdate", "optimisticUpdate", "reconciliationBehaviour", "successMessage", "recoverableFailureMessage", "focusBehaviour", "retryAction",
  ]
);

const ACTION_TRACE_EVIDENCE = fieldRequirements(
  "action-trace-evidence", "field", "Every action trace security-evidence section", [
    "relevantTestNames", "configurationEvidence", "schemaEvidence", "authorisationPolicyEvidence", "databasePolicyEvidence", "queryPlanEvidence", "sanitisedAuditLogSample", "securityScannerEvidence", "manualVerificationNotes", "remainingUncertainty",
  ]
);

const API_INVENTORY_SURFACES = sectionRequirements("api-inventory-surface", [
  ["rest", "Inventory every REST API."],
  ["graphql", "Inventory every GraphQL API."],
  ["rpc", "Inventory every tRPC or RPC procedure."],
  ["server-action", "Inventory every framework server action."],
  ["server-component-data", "Inventory every server-component data call."],
  ["websocket", "Inventory every WebSocket surface."],
  ["sse", "Inventory every server-sent-event surface."],
  ["auth-callback", "Inventory every authentication callback."],
  ["oauth-oidc", "Inventory every OAuth or OIDC endpoint."],
  ["webhook", "Inventory every webhook."],
  ["upload", "Inventory every file-upload API."],
  ["media-transform", "Inventory every media-transformation API."],
  ["download", "Inventory every download API."],
  ["export", "Inventory every export API."],
  ["internal", "Inventory every internal API."],
  ["administration", "Inventory every administration API."],
  ["worker", "Inventory every worker API."],
  ["cron", "Inventory every cron entry point."],
  ["queue-consumer", "Inventory every queue consumer."],
  ["ai-tool", "Inventory every AI tool endpoint."],
  ["legacy", "Inventory every legacy API version."],
  ["development", "Inventory every development-only endpoint."],
  ["health", "Inventory every health endpoint."],
  ["diagnostics", "Inventory every diagnostics endpoint."],
  ["metrics", "Inventory every metrics endpoint."],
]);

const API_INVENTORY_RECORD = fieldRequirements(
  "api-inventory-record", "field", "Every API inventory endpoint record", [
    "endpointId", "protocol", "host", "environment", "version", "method", "routeOrProcedure", "sourceFile", "handler", "frontendCallers", "nonFrontendCallers", "authentication", "sessionOrTokenType", "csrfRequirement", "corsPolicy", "allowedActors", "allowedRoles", "allowedSubscriptions", "requiredPermissions", "objectLevelPolicy", "propertyLevelPolicy", "tenantPolicy", "requestSchema", "allowedInputFields", "maximumBodySize", "maximumFileSize", "outputSchema", "allowedOutputFields", "rateLimit", "costOrResourceBudget", "idempotency", "databaseOperations", "cacheOperations", "backgroundJobs", "externalProviders", "sensitiveData", "auditEvent", "logEvents", "errorResponses", "deprecationStatus", "owner", "tests", "verificationStatus",
  ]
);

const API_INVENTORY_MANAGEMENT = sectionRequirements("api-inventory-management", [
  ["all-apis", "Inventory every API regardless of whether it is intended to be public."],
  ["complete-deployed", "No deployed endpoint may be absent from the API inventory."],
  ["code-exists", "No inventory endpoint may refer to nonexistent code."],
  ["debug-not-public", "Debug endpoints must not be exposed publicly."],
  ["obsolete-disabled", "Remove or explicitly disable obsolete API versions."],
  ["deprecated-owner-date", "Every deprecated endpoint must have an owner and retirement date."],
  ["generated-docs-redact", "Generated API documentation must not expose internal-only operations."],
  ["health-redact", "Health endpoints must not expose credentials, stack traces, environment variables, or database details."],
  ["metrics-restricted", "Metrics endpoints must have appropriate network or identity restrictions."],
  ["admin-separation", "Separate administration APIs clearly from member APIs."],
  ["moderator-not-admin", "Moderator APIs must not inherit administrator powers."],
]);

const AUTHENTICATION_PATHS = sectionRequirements("authentication-path", [
  ["sign-in", "Audit sign in."],
  ["sign-out", "Audit sign out."],
  ["account-creation", "Audit new-account creation."],
  ["callback", "Audit the authentication callback."],
  ["email-verification", "Audit email verification."],
  ["password-reset", "Audit password reset where applicable."],
  ["passwordless", "Audit passwordless login where applicable."],
  ["oauth-oidc", "Audit OAuth or OIDC login."],
  ["account-linking", "Audit account linking."],
  ["invitation", "Audit invitation acceptance."],
  ["session-refresh", "Audit session refresh."],
  ["session-expiry", "Audit session expiry."],
  ["session-revocation", "Audit session revocation."],
  ["security-setting", "Audit security-setting changes."],
  ["email-change", "Audit email-address changes."],
  ["step-up", "Audit privileged step-up authentication."],
  ["recovery", "Audit account recovery."],
  ["deletion", "Audit account deletion."],
  ["administrator", "Audit administrator access."],
  ["moderator", "Audit moderator access."],
  ["support", "Audit support-operator access."],
]);

const AUTHENTICATION_CONTROLS = sectionRequirements("authentication-control", [
  ["redirect-allowlist", "Allowlist authentication redirect destinations to internal destinations."],
  ["oidc-state", "Validate OAuth or OIDC state."],
  ["nonce", "Validate nonce where applicable."],
  ["pkce", "Use PKCE where applicable."],
  ["callback-single-use", "Prevent callback-code reuse."],
  ["rotate-after-auth", "Rotate sessions after authentication."],
  ["rotate-after-privilege", "Rotate sessions after privilege changes."],
  ["invalidate-compromise", "Invalidate sessions after credential compromise."],
  ["logout-server", "Invalidate the server session on logout where supported."],
  ["recovery-expiry", "Expire recovery tokens."],
  ["recovery-single-use", "Make recovery tokens single use."],
  ["recovery-storage", "Store recovery tokens safely."],
  ["no-enumeration", "Prevent authentication errors from enabling user enumeration."],
  ["brute-force", "Implement brute-force and credential-stuffing controls."],
  ["privileged-strong-auth", "Use stronger authentication for privileged accounts."],
  ["admin-step-up", "Use step-up authentication for administration or document an equivalent control."],
  ["session-lifetime", "Set session lifetime appropriate to risk."],
  ["idle-expiry", "Define explicit idle expiry."],
  ["absolute-expiry", "Define explicit absolute expiry."],
  ["concurrent-sessions", "Document concurrent-session management."],
  ["suspended-deleted-session", "Prevent suspended or deleted users from using existing sessions."],
]);

const COOKIE_CONTROLS = sectionRequirements("cookie-control", [
  ["secure", "Set Secure on cookie-based sessions."],
  ["http-only", "Set HttpOnly on cookie-based sessions."],
  ["same-site", "Set an appropriate SameSite value on cookie-based sessions."],
  ["domain", "Use the minimum cookie Domain."],
  ["path", "Use the minimum cookie Path."],
  ["no-url-session", "Do not place session identifiers in URLs."],
  ["no-analytics-session", "Do not place session tokens in analytics."],
  ["no-client-log-session", "Do not place session tokens in client logs."],
  ["no-error-report-session", "Do not place session tokens in error reports."],
  ["no-local-storage", "Do not store authentication tokens in local storage without a documented and reviewed reason."],
]);

const CSRF_CONTROLS = sectionRequirements("csrf-control", [
  ["state-changing-cookie-action", "Protect every state-changing cookie-authenticated action against CSRF."],
  ["framework-defense", "Use a CSRF defense appropriate to the framework."],
  ["origin-validation", "Validate request origin where appropriate."],
  ["reject-cross-site", "Reject unexpected cross-site requests."],
  ["not-samesite-only", "Do not rely only on SameSite for CSRF defense."],
  ["no-get-mutation", "Do not use GET for state-changing operations."],
  ["missing-test", "Test missing CSRF values."],
  ["invalid-test", "Test invalid CSRF values."],
  ["reused-test", "Test reused CSRF values."],
  ["server-actions", "Cover server actions with CSRF controls and tests."],
  ["rpc", "Cover RPC procedures with CSRF controls and tests."],
  ["uploads", "Cover upload endpoints with CSRF controls and tests."],
]);

const AUTHORIZATION_ACTORS = sectionRequirements("authorization-actor", [
  ["signed-out", "Map signed-out visitor authorization."],
  ["member", "Map ordinary member authorization."],
  ["racing", "Map racing member authorization."],
  ["buyer", "Map buyer authorization."],
  ["seller", "Map seller authorization."],
  ["owner", "Map greyhound owner authorization."],
  ["breeder", "Map breeder authorization."],
  ["trainer", "Map trainer authorization."],
  ["community", "Map community participant authorization."],
  ["group-member", "Map group member authorization."],
  ["group-moderator", "Map group moderator authorization."],
  ["page-member", "Map page member authorization."],
  ["page-manager", "Map page manager authorization."],
  ["team-member", "Map team member authorization."],
  ["team-owner", "Map team owner authorization."],
  ["support", "Map support-operator authorization."],
  ["moderator", "Map moderator authorization."],
  ["administrator", "Map administrator authorization."],
  ["billing", "Map billing-operator authorization."],
  ["ai", "Map AI-feature-user authorization."],
  ["design-lab", "Map Design Lab reviewer authorization."],
  ["suspended", "Map suspended-user authorization."],
  ["blocked", "Map blocked-user authorization."],
  ["deleted", "Map deleted-user authorization."],
]);

const AUTHORIZATION_DIMENSIONS = sectionRequirements("authorization-dimension", [
  ["function", "Evaluate function-level authorization for every action."],
  ["object", "Evaluate object-level authorization for every action."],
  ["property", "Evaluate property-level authorization for every action."],
  ["tenant", "Evaluate tenant-level authorization for every action."],
  ["relationship", "Evaluate relationship-level authorization for every action."],
  ["state", "Evaluate status-transition authorization for every action."],
  ["entitlement", "Evaluate feature-entitlement authorization for every action."],
]);

const OBJECT_AUTHORIZATION = sectionRequirements("object-authorization", [
  ["independent-check", "Every API accepting an object identifier must independently verify access to that specific object."],
  ...[
    "user", "profile", "page", "organisation", "team", "dog", "ownership-claim", "race", "track", "post", "comment", "group", "thread", "message", "conversation", "listing", "enquiry", "file", "invoice", "subscription", "support-ticket", "export", "report", "webhook-event", "ai-run",
  ].map((object) => [`${object}-id`, `Enforce object-level authorization for ${object} identifiers.`] as const),
  ["existence-not-access", "Do not assume access merely because an object exists."],
]);

const PROPERTY_AUTHORIZATION = sectionRequirements("property-authorization", [
  ["allowlist", "Explicitly allow the properties each actor can mutate."],
  ...[
    "id", "userId", "ownerId", "createdBy", "organisationId", "tenantId", "role", "permissions", "isAdmin", "isModerator", "verificationStatus", "paymentStatus", "subscriptionStatus", "entitlements", "plan", "pricePaid", "moderationStatus", "publishedAt", "approvedAt", "deletedAt", "auditActorId", "securityFlags",
  ].map((field) => [`untrusted-${field}`, `Never trust an ordinary client's ${field} value.`] as const),
  ["unexpected-fields", "Reject, ignore, or safely normalize unexpected security-sensitive properties."],
  ["mass-assignment-tests", "Add mass-assignment tests."],
]);

const TENANT_ISOLATION = sectionRequirements("tenant-isolation", [
  ["server-resolution", "Resolve tenant context server-side."],
  ["repository", "Include tenant restrictions in repository access."],
  ["database-policy", "Include tenant restrictions in database policies where practical."],
  ["cache-key", "Include tenant context in cache keys."],
  ["search", "Prevent cross-tenant search results."],
  ["exports", "Prevent cross-tenant exports."],
  ["jobs", "Prevent cross-tenant background-job processing."],
  ["websocket", "Prevent cross-tenant WebSocket subscriptions."],
  ["same-id-test", "Test identical object IDs under different tenants."],
]);

const ADMINISTRATION_CONTROLS = sectionRequirements("administration-control", [
  ["role-separation", "Enforce least-privilege role separation."],
  ["server-permission", "Enforce administration permissions server-side."],
  ["step-up", "Require step-up authentication for high-risk actions where appropriate."],
  ["reason", "Require reasons for sensitive mutations."],
  ["confirmation", "Require confirmation for destructive actions."],
  ["last-owner", "Protect the last owner."],
  ["last-admin", "Protect the last administrator."],
  ["self-lockout", "Prevent administrator self-lockout."],
  ["role-boundaries", "Separate support, moderator, and administrator powers."],
  ["audit-integrity", "Produce immutable or integrity-protected audit evidence."],
  ["no-admin-all", "Do not use a broad admin-equals-all-access shortcut without explicit review."],
]);

const EXTERNAL_INPUT_SURFACES = sectionRequirements("external-input-surface", [
  ...[
    "request bodies", "query strings", "path parameters", "headers", "cookies", "uploaded files", "file names", "URLs", "webhook payloads", "third-party API responses", "queue messages", "database records originating from external systems", "AI output", "search queries", "sort fields", "filter fields", "pagination tokens", "rich text", "Markdown", "HTML", "media metadata",
  ].map((surface) => [surface.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Validate ${surface} at the server boundary.`] as const),
]);

const INPUT_VALIDATION = sectionRequirements("input-validation", [
  ["type", "Define a type for every external input."],
  ["required", "Define required or optional status for every external input."],
  ["max-length", "Define a maximum length for every external input."],
  ["min-length", "Define a minimum length where relevant."],
  ["numeric-range", "Define numeric ranges where relevant."],
  ["enum", "Use enumeration allowlists where relevant."],
  ["charset", "Define expected character sets."],
  ["canonical", "Define canonical form."],
  ["null", "Define null behavior."],
  ["unknown-field", "Define unknown-field behavior."],
  ["nested-limit", "Define nested-object limits."],
  ["array-limit", "Define array-length limits."],
  ["depth-limit", "Define recursion or depth limits."],
  ["error", "Define safe validation-error behavior."],
]);

const INJECTION_PREVENTION = sectionRequirements("injection-prevention", [
  ...[
    ["sql", "SQL injection"], ["orm", "ORM injection"], ["nosql", "NoSQL injection"], ["command", "command injection"], ["template", "template injection"], ["ldap", "LDAP injection where applicable"], ["header", "header injection"], ["email-header", "email-header injection"], ["log", "log injection"], ["path", "path traversal"], ["deserialization", "unsafe deserialization"], ["xss", "cross-site scripting"], ["stored-xss", "stored cross-site scripting"], ["dom-xss", "DOM cross-site scripting"], ["ssrf", "server-side request forgery"], ["redirect", "open redirects"], ["url-scheme", "unsafe URL schemes"], ["csv", "CSV or spreadsheet-formula injection in exports"], ["html-markdown", "HTML and Markdown injection"], ["graphql", "GraphQL query-depth and complexity abuse"],
  ].map(([id, attack]) => [`prevent-${id}`, `Verify protection against ${attack}.`] as const),
  ["parameterized", "Use parameterized database operations."],
  ["identifier-allowlist", "Allowlist dynamic identifiers such as sort columns, table names, and field names."],
  ["bound-parameter-limit", "Do not assume bound parameters can make dynamic identifiers safe."],
]);

const DATABASE_INVENTORY = sectionRequirements("database-inventory", [
  ...[
    "database", "schema", "table", "view", "materialized view", "function", "stored procedure", "trigger", "sequence", "index", "constraint", "row-level security policy", "database role", "service account", "migration", "backup", "replica", "connection pool",
  ].map((object) => [object.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Inventory every ${object}.`] as const),
]);

const DATABASE_COLUMN_RECORD = fieldRequirements(
  "database-column-record", "field", "Every table and column record", [
    "purpose", "dataOwner", "dataClassification", "personalInformationStatus", "sensitiveInformationStatus", "tenantScope", "ownershipField", "foreignKeys", "uniqueConstraints", "nullability", "defaultValues", "encryption", "retention", "deletionOrDeidentificationBehaviour", "auditRequirement", "accessingServices", "exportEligibility", "searchIndexEligibility", "logEligibility",
  ]
);

const ACTUAL_QUERY_CAPTURE = sectionRequirements("actual-query-capture", [
  ["locate", "Locate the real repository or ORM call for every database operation."],
  ["generated-sql", "Capture generated SQL in local or staging."],
  ["placeholders", "Replace real values with named placeholders."],
  ["structure", "Preserve the actual query structure."],
  ["columns", "Record selected and modified columns."],
  ["authz-predicates", "Record all authorization predicates."],
  ["tenant-predicates", "Record all tenant predicates."],
  ["visibility-predicates", "Record all visibility predicates."],
  ["cardinality", "Record expected and maximum cardinality."],
  ["database-role", "Record the database role used."],
  ["indexes-constraints", "Record indexes and constraints relied on."],
  ["transaction-locking", "Record transaction and locking behavior."],
  ["timeout", "Record query timeout."],
  ["response-map", "Record the mapping from rows to response fields."],
  ["tests", "Link the query to tests."],
  ["no-customer-values", "Do not include real customer values in query documentation."],
  ["no-production-credentials", "Do not include production credentials in query documentation."],
  ["no-production-query-logs", "Do not include raw production query logs in documentation."],
]);

const DATABASE_QUERY_RECORD = fieldRequirements(
  "database-query-record", "field", "Every database query record", [
    "queryId", "traceId", "triggeringUserAction", "serverHandler", "service", "repository", "ormOrDriver", "ormOperation", "normalisedSql", "boundParameterNames", "database", "schema", "databaseRole", "tables", "views", "columnsRead", "columnsWritten", "tenantPredicate", "ownershipPredicate", "visibilityPredicate", "rowLevelPolicy", "expectedRows", "maximumRows", "pagination", "transaction", "isolation", "locks", "concurrencyStrategy", "indexes", "constraints", "triggers", "timeout", "sensitiveData", "returnedShape", "cacheInteraction", "notFoundBehaviour", "unauthorisedBehaviour", "conflictBehaviour", "failureBehaviour", "tests", "evidence",
  ]
);

const QUERY_SAFETY = sectionRequirements("query-safety", [
  ["parameterized-values", "Parameterize all user values."],
  ["allowlisted-identifiers", "Allowlist sort and field identifiers."],
  ["bounded-collections", "Bound every collection read."],
  ["pagination-max", "Enforce pagination maxima server-side."],
  ["export-limits", "Apply explicit limits and authorization to export jobs."],
  ["permission-before-exposure", "Do not expose records before permission checks."],
  ["unomittable-scope", "Make ownership and tenant restrictions impossible for callers to omit."],
  ["narrow-columns", "Avoid broad column selection for sensitive queries."],
  ["redact-db-errors", "Do not expose database errors to clients."],
  ["timeouts", "Set timeouts on slow queries."],
  ["cancellation", "Handle query cancellation."],
  ["bounded-pools", "Bound connection pools."],
  ["n-plus-one", "Identify N+1 query patterns."],
  ["indexes", "Index or redesign expensive queries."],
  ["plans", "Review query plans with representative sanitized data."],
  ["no-production-impact", "Ensure query-plan testing does not affect production."],
  ["replica-safety", "Prevent unsafe authorization or stale-write assumptions on read replicas."],
]);

const MUTATION_SAFETY = sectionRequirements("mutation-safety", [
  ["state-transition", "Validate each allowed mutation state transition."],
  ["ownership-permission", "Validate ownership and permissions in the mutation path."],
  ["affected-rows", "Check the affected-row count."],
  ["transaction", "Use a transaction when multiple writes form one operation."],
  ["unique-constraint", "Use unique constraints for uniqueness guarantees."],
  ["no-read-only-uniqueness", "Do not rely only on a prior read for uniqueness."],
  ["lost-update", "Prevent lost updates."],
  ["concurrency-token", "Use versions, timestamps, or locks when concurrent editing matters."],
  ["deadlock-retry", "Handle deadlock retries safely."],
  ["network-retry", "Prevent duplicate mutation after network retry."],
  ["idempotency", "Define idempotency where required."],
  ["rollback-side-effects", "Roll back incomplete side effects."],
  ["outbox", "Use an outbox or equivalent where database and message consistency requires it."],
]);

const ROW_LEVEL_SECURITY = sectionRequirements("row-level-security", [
  ["defense-in-depth", "Use suitable database row-level security as defense in depth where supported."],
  ["application-authz", "Keep application-layer authorization when row-level security is used."],
  ["role-tests", "Test each database role against row-level security."],
  ["tenant-tests", "Test tenant isolation at the database policy layer."],
  ["owner-tests", "Test owner access at the database policy layer."],
  ["privileged-tests", "Test privileged access at the database policy layer."],
  ["worker-tests", "Test background-worker access at the database policy layer."],
  ["pool-context", "Prevent connection pooling from retaining the wrong security context."],
  ["service-bypass", "Prevent service roles from unintentionally bypassing policies."],
  ["exclusions", "Document justified row-level-security exclusions."],
]);

const DATABASE_ROLE_SEPARATION = sectionRequirements("database-role-separation", [
  ["migrations", "Use a distinct database role for migrations where practical."],
  ["app", "Use a least-privilege role for ordinary application reads and writes."],
  ["reporting", "Use a read-only role for reporting."],
  ["workers", "Use a distinct database role for background workers where practical."],
  ["ingestion", "Use a distinct database role for racing-data ingestion where practical."],
  ["administration", "Use a distinct database role for administration where practical."],
  ["backups", "Use a distinct database role for backups where practical."],
  ["monitoring", "Use a distinct database role for monitoring where practical."],
  ["incident", "Use a distinct database role for incident response where practical."],
  ["no-schema-ddl", "Do not allow the ordinary application role to create or drop schema."],
  ["no-functions", "Do not allow the ordinary application role to create arbitrary functions."],
  ["no-user-management", "Do not allow the ordinary application role to change database users."],
  ["no-policy-disable", "Do not allow the ordinary application role to disable security policies."],
  ["no-system-tables", "Do not allow the ordinary application role to read unrelated system tables."],
  ["no-tenant-bypass", "Do not allow the ordinary application role to bypass tenant isolation without a documented requirement."],
]);

const MIGRATION_REVIEW = sectionRequirements("migration-review", [
  ["backward", "Review migrations for backward compatibility."],
  ["forward", "Review migrations for forward compatibility."],
  ["lock", "Review migrations for lock duration."],
  ["rewrite", "Review migrations for table-rewrite risk."],
  ["data-loss", "Review migrations for data-loss risk."],
  ["nullability", "Review new nullable and non-nullable columns."],
  ["defaults", "Review default-value behavior."],
  ["constraint-validation", "Review constraint-validation strategy."],
  ["index-creation", "Review index-creation strategy."],
  ["rollback", "Review rollback strategy."],
  ["access-control", "Review access-control changes."],
  ["retention", "Review retention impact."],
  ["privacy", "Review privacy impact."],
  ["backup", "Review backup requirements."],
]);

const API_TOP_TEN = sectionRequirements("api-top-ten", [
  ["bola", "Map and test broken object-level authorization for every relevant endpoint."],
  ["authentication", "Map and test broken authentication for every relevant endpoint."],
  ["property", "Map and test broken object-property-level authorization for every relevant endpoint."],
  ["resource", "Map and test unrestricted resource consumption for every relevant endpoint."],
  ["function", "Map and test broken function-level authorization for every relevant endpoint."],
  ["business-flow", "Map and test unrestricted access to sensitive business flows for every relevant endpoint."],
  ["ssrf", "Map and test server-side request forgery for every relevant endpoint."],
  ["configuration", "Map and test security misconfiguration for every relevant endpoint."],
  ["inventory", "Map and test improper API inventory management for every relevant endpoint."],
  ["third-party", "Map and test unsafe consumption of third-party APIs for every relevant endpoint."],
]);

const RESOURCE_CONTROLS = sectionRequirements("resource-control", [
  ...[
    "request-size limit", "file-size limit", "array-length limit", "pagination limit", "query-complexity limit", "processing timeout", "database timeout", "external-provider timeout", "concurrent-request limit", "per-user rate limit", "per-IP rate limit where appropriate", "per-object rate limit where appropriate", "daily or monthly quota where cost matters", "queue-depth protection", "storage quota", "email or SMS quota", "AI token or cost budget",
  ].map((control) => [control.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Define an appropriate ${control} for every relevant endpoint.`] as const),
]);

const SENSITIVE_BUSINESS_FLOWS = sectionRequirements("sensitive-business-flow", [
  ...[
    "account creation", "authentication", "password reset", "invitation creation", "friend requests", "follows", "group joining", "posting", "commenting", "reactions", "messaging", "rich-media sending", "voice or video call invitations", "Marketplace enquiries", "listing creation", "listing publication", "ownership claims", "verification requests", "support submissions", "reports", "data exports", "account deletion", "AI tool runs", "search and scraping", "payment checkout creation", "coupon or promotion use if applicable",
  ].map((flow) => [flow.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Protect ${flow} from automation and abuse.`] as const),
]);

const ABUSE_CONTROLS = sectionRequirements("abuse-control", [
  ...[
    "actor-based limits", "object-based limits", "risk-based friction", "duplicate detection", "cooldowns", "abuse scoring", "moderation queues", "verification", "Captcha where justified", "human review", "cost budgets", "circuit breakers",
  ].map((control) => [control.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Use ${control} where justified by the flow's abuse risk.`] as const),
  ["not-global-ip-only", "Do not use one global IP limit as the only abuse control."],
]);

const IDEMPOTENCY_CONTROLS = sectionRequirements("idempotency-control", [
  ...[
    "checkout creation", "payment processing", "subscription changes", "webhook processing", "listing publication", "ownership claims", "team invitations", "data exports", "account-deletion requests", "administrative actions", "email sends", "queue jobs", "AI actions with external cost",
  ].map((operation) => [operation.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Require idempotency for ${operation}.`] as const),
  ["bind-actor", "Bind idempotency to the actor."],
  ["bind-operation", "Bind idempotency to the operation."],
  ["bind-object", "Bind idempotency to the object."],
  ["bind-fingerprint", "Bind idempotency to a request fingerprint where appropriate."],
  ["expiry", "Define the idempotency expiry period."],
  ["isolation", "Prevent one user from discovering another user's idempotency result."],
]);

const CORS_CONTROLS = sectionRequirements("cors-control", [
  ["explicit-origin", "Use an explicit CORS origin policy."],
  ["no-wildcard-credentials", "Do not combine wildcard origins with credentials."],
  ["methods", "Allow only required CORS methods."],
  ["headers", "Allow only required CORS headers."],
  ["preflight", "Verify correct CORS preflight behavior."],
  ["no-dev-origin", "Do not enable development origins in production."],
  ["not-security-boundary", "Do not treat permissive CORS as authorization for internal APIs."],
  ["websocket-origin", "Address WebSocket origin validation separately."],
]);

const HTTP_CONTROLS = sectionRequirements("http-control", [
  ["no-get-mutation", "Do not use GET for state changes."],
  ["unsupported-method", "Return safe responses for unsupported methods."],
  ["content-types", "Enforce expected content types."],
  ["reject-unexpected-body-type", "Reject unexpected form or text content for JSON endpoints where appropriate."],
  ["cache-sensitivity", "Match cache headers to data sensitivity."],
  ["no-public-private-cache", "Do not publicly cache private responses."],
  ["no-store", "Use no-store behavior for sensitive responses where appropriate."],
  ["safe-download", "Prevent unsafe content interpretation for downloads."],
  ["redirect-validation", "Validate redirect destinations."],
]);

const WEBHOOK_CONTROLS = sectionRequirements("webhook-control", [
  ["provider", "Identify each webhook provider."],
  ["signature", "Verify webhook signatures using the provider-required method."],
  ["freshness", "Verify webhook timestamps or freshness where supported."],
  ["raw-body", "Use the raw request body when required for signature verification."],
  ["reject-signature", "Reject missing or invalid webhook signatures."],
  ["replay", "Prevent webhook replay."],
  ["event-id", "Record provider event IDs."],
  ["dedupe", "Deduplicate webhook processing."],
  ["duplicate", "Handle duplicate webhook delivery."],
  ["out-of-order", "Handle out-of-order webhook delivery."],
  ["delayed", "Handle delayed webhook delivery."],
  ["refetch", "Re-fetch authoritative provider state where required."],
  ["browser-not-proof", "Do not trust browser-return parameters as payment or subscription proof."],
  ["transaction", "Use a transaction for local webhook state changes."],
  ["audit", "Record a webhook audit event."],
  ["prompt-response", "Return an appropriate webhook response promptly."],
  ["async", "Process lengthy webhook work asynchronously."],
  ["minimal-payload", "Store only the minimum webhook payload needed."],
  ["redacted-logs", "Redact sensitive webhook payload data from logs."],
]);

const QUEUE_WORKER_CONTROLS = sectionRequirements("queue-worker-control", [
  ["schema", "Define each job payload schema."],
  ["validate", "Validate each job payload in the worker."],
  ["infrastructure-trust", "Authenticate the queue or establish trust through infrastructure controls."],
  ["tenant", "Include tenant context in jobs."],
  ["actor", "Include actor context where required."],
  ["reauthorize", "Re-authorize sensitive operations at execution time."],
  ["permission-change", "Do not assume permissions remain unchanged after enqueueing."],
  ["retry", "Define each job retry policy."],
  ["dead-letter", "Define dead-letter behavior."],
  ["idempotency", "Define job idempotency."],
  ["attempts", "Define maximum job attempts."],
  ["poison", "Prevent poison-message loops."],
  ["fan-out", "Protect against unbounded fan-out."],
  ["record-outcome", "Record job completion and failure."],
  ["no-secrets", "Do not store secrets in job payloads."],
]);

const SCHEDULED_TASK_CONTROLS = sectionRequirements("scheduled-task-control", [
  ["not-public", "Protect scheduled tasks from unauthenticated public invocation."],
  ["identity", "Define each scheduled task execution identity."],
  ["database-role", "Define each scheduled task database role."],
  ["lock", "Define lock or leader-election behavior."],
  ["overlap", "Prevent overlapping runs where unsafe."],
  ["idempotency", "Define scheduled-task idempotency."],
  ["timeout", "Define maximum execution time."],
  ["alerting", "Define scheduled-task alerting."],
  ["missed-run", "Define missed-run recovery."],
]);

const REALTIME_CONTROLS = sectionRequirements("realtime-control", [
  ...[
    "connection authentication", "session expiry during a connection", "re-authentication or disconnection", "origin validation", "conversation membership", "message-level authorization", "room or channel authorization", "block relationships", "privacy settings", "tenant isolation", "rate limits", "message-size limits", "attachment limits", "replay behavior", "ordering behavior", "duplicate-message behavior", "delivery receipts", "read receipts", "presence visibility", "typing-indicator visibility", "error redaction", "reconnection", "offline delivery", "server-side moderation controls",
  ].map((control) => [control.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Verify realtime ${control}.`] as const),
  ["channel-membership", "Do not trust a client-provided channel ID without verifying membership."],
]);

const VOICE_VIDEO_CONTROLS = sectionRequirements("voice-video-control", [
  ["short-lived", "Issue short-lived call credentials."],
  ["scope", "Scope call credentials to the correct call and participant."],
  ["reuse", "Prevent call-credential reuse."],
  ["no-master-secret", "Do not expose provider master secrets."],
  ["membership", "Verify call membership."],
  ["blocks", "Enforce block relationships for calls."],
  ["invitation-limit", "Limit call invitations."],
  ["lifecycle-audit", "Record security-relevant call lifecycle events without recording private media content."],
  ["removal", "Handle participant removal."],
  ["expiry", "Revoke or expire call credentials promptly."],
  ["enumeration", "Prevent unauthorized room enumeration."],
]);

const FILE_MEDIA_INVENTORY = sectionRequirements("file-media-inventory", [
  ["uploads", "Map every upload path."],
  ["downloads", "Map every download path."],
]);

const UPLOAD_VALIDATION = sectionRequirements("upload-validation", [
  ...[
    "authentication", "ownership", "permission", "file-size limit", "total storage quota", "claimed MIME type", "detected content type", "file signature or magic bytes", "allowed extension", "allowed dimensions", "media duration", "archive contents if archives are allowed", "file-name normalization", "object-key generation", "metadata", "processing timeout",
  ].map((control) => [control.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Validate upload ${control}.`] as const),
]);

const UPLOAD_CONTROLS = sectionRequirements("upload-control", [
  ...[
    "server-generated storage keys", "storage outside executable application paths", "private storage by default", "short-lived signed access where required", "malware or unsafe-content scanning where appropriate", "image re-encoding where appropriate", "metadata stripping where appropriate", "safe thumbnail generation", "quarantine until checks complete", "recovery from failed processing", "deletion of abandoned uploads", "audit evidence",
  ].map((control) => [control.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Implement ${control} for uploads.`] as const),
]);

const UPLOAD_UNTRUSTED_CLAIMS = sectionRequirements("upload-untrusted-claim", [
  ["filename", "Do not trust the original upload filename."],
  ["mime", "Do not trust the browser-reported MIME type."],
  ["path", "Do not trust a client-generated storage path."],
  ["success", "Do not trust a client claim that upload processing succeeded."],
]);

const DOWNLOAD_CONTROLS = sectionRequirements("download-control", [
  ["ownership-visibility", "Verify download object ownership or visibility."],
  ["tenant", "Enforce tenant isolation for downloads."],
  ["signed-url", "Use expiring signed URLs where appropriate."],
  ["disposition", "Use safe Content-Disposition."],
  ["mime", "Return the correct MIME type."],
  ["path", "Prevent path traversal."],
  ["private-url", "Do not expose predictable private-storage URLs."],
  ["revocation", "Define download revocation behavior."],
  ["deleted-blocked", "Define deleted or blocked content behavior."],
  ["large-export-rate", "Rate-limit large exports."],
]);

const SSRF_CONTROLS = sectionRequirements("ssrf-control", [
  ["scheme", "Reject unsafe remote-media and link-preview URL schemes."],
  ["resolve-validate", "Resolve and validate remote destinations."],
  ["private-network", "Block loopback, link-local, and private-network destinations unless explicitly required."],
  ["dns-rebinding", "Handle DNS rebinding safely."],
  ["redirects", "Limit remote redirects."],
  ["size", "Limit remote response size."],
  ["time", "Limit remote processing time."],
  ["content-type", "Validate remote content type."],
  ["isolation", "Isolate preview processing."],
  ["metadata", "Prevent access to cloud metadata endpoints."],
  ["credentials", "Do not forward credentials to remote destinations."],
]);

const BROWSER_DATA_HANDLING = sectionRequirements("browser-data-handling", [
  ...[
    "local storage", "session storage", "IndexedDB", "service-worker caches", "URLs", "query strings", "browser history", "analytics payloads", "client logs", "error-reporting payloads", "HTML source", "hydration payloads", "public source maps", "persisted client state",
  ].map((surface) => [surface.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Verify sensitive data is not stored unnecessarily in ${surface}.`] as const),
]);

const FRONTEND_AUTHORIZATION = sectionRequirements("frontend-authorization", [
  ["server-denial", "The server must deny actions hidden by the frontend."],
  ["direct-api", "Test direct API requests independent of frontend controls."],
  ["alternate-routes", "Test alternate routes independent of frontend controls."],
  ["stale-entitlement", "Prevent stale client entitlements from granting access."],
  ["browser-state", "Prevent edited browser state from changing permissions."],
  ["hidden-fields", "Treat hidden fields as untrusted input."],
]);

const XSS_SURFACES = sectionRequirements("xss-surface", [
  ...[
    "user posts", "comments", "group content", "forum content", "profiles", "listings", "seller descriptions", "support messages", "administration notes", "imported racing content", "rich text", "Markdown", "link previews", "error messages", "AI-generated output",
  ].map((surface) => [surface.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Review ${surface} for cross-site scripting.`] as const),
  ["context-escaping", "Use context-appropriate output escaping and sanitization."],
  ["avoid-unsafe-html", "Avoid unsafe HTML rendering."],
  ["allowlist-sanitizer", "Use a reviewed allowlist sanitizer when HTML is required."],
  ["stored-render-test", "Test stored content after rendering."],
]);

const BROWSER_SECURITY_HEADERS = sectionRequirements("browser-security-header", [
  ["csp", "Define and test an appropriate Content Security Policy."],
  ["frame-ancestors", "Define and test frame-ancestors or equivalent clickjacking protection."],
  ["hsts", "Define and test HTTP Strict Transport Security."],
  ["nosniff", "Define and test X-Content-Type-Options."],
  ["referrer", "Define and test Referrer-Policy."],
  ["permissions", "Define and test Permissions-Policy."],
  ["cross-origin", "Define and test compatible cross-origin policies."],
  ["cache", "Define and test security-sensitive cache controls."],
  ["cookie", "Define and test secure cookie attributes."],
  ["meaningful-csp", "Do not deploy a meaningless CSP with broadly unsafe inline execution without documented necessity."],
]);

const EXTERNAL_LINK_EMBED = sectionRequirements("external-link-embed", [
  ["scheme", "Validate safe external-link URL schemes."],
  ["noopener", "Use noopener or equivalent behavior where relevant."],
  ["referrer", "Prevent transfer of sensitive referrer data."],
  ["embed-allowlist", "Allowlist trusted embeds."],
  ["sandbox", "Sandbox untrusted embeds."],
  ["no-user-script", "Do not include arbitrary scripts from user content."],
  ["sri", "Use subresource integrity where suitable for static third-party assets."],
]);

const THREAT_MODEL_GOVERNANCE = sectionRequirements("threat-model-governance", [
  ...[
    "public website", "racing intelligence", "community and Feed", "messaging and Pulse", "Marketplace", "account", "administration", "AI tools", "Design Lab",
  ].flatMap((area) => [
    [`${area.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-threat-model`, `Create a threat model for ${area}.`] as const,
    [`${area.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-abuse-cases`, `Create an abuse-case map for ${area}.`] as const,
  ]),
]);

function threatRequirements(
  section: SecurityRequirementSection,
  threats: readonly string[]
): SecurityMasterRequirement[] {
  return sectionRequirements(
    section,
    threats.map((threat) => [
      threat.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      `Threat-model ${threat}.`,
    ])
  );
}

const THREAT_PUBLIC = threatRequirements("threat-public", [
  "contact-form spam", "form injection", "email-header injection", "excessive submissions", "authentication open redirects", "account enumeration", "legal-page availability", "cache poisoning", "public-data scraping", "public error leakage",
]);
const THREAT_RACING = threatRequirements("threat-racing", [
  "unauthorized provider access", "provider-key exposure", "data-source impersonation", "corrupt or malformed feed data", "stale data", "duplicate records", "conflicting records", "unbounded race searches", "high-cost statistics queries", "enumeration of unpublished records", "mixing public and restricted data", "cache leakage", "unsafe replay or media URLs", "data-provenance loss", "administrative correction auditability",
]);
const THREAT_COMMUNITY = threatRequirements("threat-community", [
  "stored XSS", "spam", "automated reactions", "automated friend requests", "private-profile leakage", "block bypass", "deleted-content leakage", "unauthorized edit or deletion", "comment ownership", "share-link privacy", "notification privacy", "search-result privacy", "group-membership bypass", "forum moderation bypass", "media abuse", "report abuse", "moderator privilege escalation",
]);
const THREAT_MESSAGING = threatRequirements("threat-messaging", [
  "conversation ID enumeration", "non-member message access", "block bypass", "attachment access", "message replay", "message impersonation", "read-receipt privacy", "presence leakage", "notification-content leakage", "WebSocket room access", "call-token theft", "call invitation spam", "provider credential exposure", "failed-message duplication", "deleted-message retention",
]);
const THREAT_MARKETPLACE = threatRequirements("threat-marketplace", [
  "listing ownership bypass", "unauthorized editing", "unauthorized publication", "verification-status forgery", "seller impersonation", "mass assignment", "enquiry spam", "buyer or seller privacy leakage", "saved-listing enumeration", "media manipulation", "malicious files", "false disclosure", "status-transition bypass", "archived or deleted listing leakage", "search scraping", "payment-state manipulation where applicable",
]);
const THREAT_ACCOUNT = threatRequirements("threat-account", [
  "profile takeover", "email-change abuse", "session persistence after security changes", "notification-setting manipulation", "privacy-setting bypass", "saved-item leakage", "team invitation theft", "role escalation", "last-owner removal", "page-ownership transfer", "billing-return manipulation", "invoice access", "data export access", "account deletion", "support-ticket privacy", "onboarding-state tampering",
]);
const THREAT_ADMINISTRATION = threatRequirements("threat-administration", [
  "moderator-to-administrator escalation", "insecure direct object references", "bulk-action mistakes", "self-lockout", "last-administrator removal", "missing required reasons", "audit-log tampering", "export abuse", "user impersonation", "support-access overreach", "webhook replay", "payment mutation", "plan or entitlement manipulation", "source-health command injection", "unsafe job reprocessing", "sensitive diagnostic leakage", "cross-tenant administration mistakes",
]);
const THREAT_AI = [
  ...threatRequirements("threat-ai", [
    "prompt injection", "indirect prompt injection", "secret exposure", "cross-user data leakage", "cross-tenant data leakage", "unauthorized tool invocation", "excessive agency", "protected-data mutation", "malicious retrieved content", "unsafe external URLs", "cost exhaustion", "output injection", "hallucinated permissions", "unsafe logging of prompts or responses", "model-provider retention", "insecure plugin or tool credentials",
  ]),
  ...sectionRequirements("threat-ai", [
    ["ordinary-authz", "AI output must not bypass ordinary server-side authorization."],
    ["tool-authz", "AI-invoked tools must use the same or stricter permission checks as direct user actions."],
  ]),
];
const THREAT_DESIGN_LAB = [
  ...threatRequirements("threat-design-lab", [
    "public indexing", "production enablement", "production-data access", "production mutations", "real user impersonation", "leaked environment variables", "debug routes", "fixture sanitization", "authentication bypass leaking into production code", "selector query parameters altering production permissions", "preview links shared outside authorized environments",
  ]),
  ...sectionRequirements("threat-design-lab", [
    ["simulation-only", "Permit role simulation only in the isolated Design Lab preview environment."],
    ["no-real-authz-change", "Design Lab controls must never alter production authorization."],
  ]),
];

const THIRD_PARTY_INVENTORY = sectionRequirements("third-party-inventory", [
  ["all-providers", "Inventory every external provider."],
]);

const THIRD_PARTY_RECORD = fieldRequirements(
  "third-party-record", "field", "Every external-provider record", [
    "purpose", "dataSent", "dataReceived", "personalInformation", "credentials", "credentialScope", "credentialStorage", "credentialRotation", "environments", "allowedHosts", "tlsVerification", "requestTimeout", "retryPolicy", "circuitBreaker", "rateLimit", "costLimit", "responseValidation", "webhookSecurity", "dataRetention", "providerLogging", "knownSubprocessors", "failureFallback", "incidentContact", "responsibleOwner",
  ]
);

const THIRD_PARTY_RESPONSE_VALIDATION = sectionRequirements("third-party-response-validation", [
  ...[
    "response schema", "field types", "length", "identifiers", "URLs", "media", "status values", "currency", "timestamps", "signatures where available", "duplicate records", "unexpected fields", "missing fields",
  ].map((field) => [field.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Validate third-party ${field}.`] as const),
  ["untrusted", "Treat every third-party response as untrusted input."],
]);

const THIRD_PARTY_PROHIBITIONS = sectionRequirements("third-party-prohibition", [
  ["credentials", "Do not forward user credentials to unrelated services."],
  ["url-secret", "Do not include secrets in URLs."],
  ["logs", "Do not log provider secrets."],
  ["ssrf", "Do not follow arbitrary provider-supplied URLs without SSRF controls."],
  ["non-idempotent-retry", "Do not blindly retry non-idempotent provider calls."],
  ["metadata-permission", "Do not trust provider metadata to grant local permissions."],
  ["browser-payment", "Do not treat a payment-provider browser return as payment proof."],
]);

const BILLING_LIFECYCLE = sectionRequirements("billing-lifecycle", [
  ["selection", "Trace plan selection."],
  ["checkout", "Trace authenticated checkout creation."],
  ["allowlist", "Trace server-side plan allowlisting."],
  ["provider-session", "Trace provider-session creation."],
  ["redirect", "Trace user redirect to the provider."],
  ["provider-payment", "Trace provider payment processing."],
  ["webhook", "Trace the signed provider webhook."],
  ["dedupe", "Trace webhook deduplication."],
  ["provider-verify", "Trace authoritative provider-state verification."],
  ["transaction", "Trace the local billing transaction."],
  ["entitlements", "Trace entitlement recalculation."],
  ["audit", "Trace the billing audit record."],
  ["cache", "Trace billing cache invalidation."],
  ["return", "Trace the user return."],
  ["display", "Trace server-confirmed billing display."],
]);

const BILLING_CONTROLS = sectionRequirements("billing-control", [
  ["server-plan", "Select plans and prices from server-side configuration."],
  ["no-client-price", "Prevent the browser from setting authoritative price."],
  ["no-client-entitlement", "Prevent the browser from setting authoritative plan entitlement."],
  ["ownership-link", "Link checkout sessions to the correct user or organization."],
  ["customer-id", "Verify provider customer IDs against local ownership."],
  ["return-informational", "Treat payment-return query parameters as informational only."],
  ["authoritative-state", "Establish payment state using signed webhooks or authoritative provider API checks."],
  ["webhook-idempotent", "Make billing webhook processing idempotent."],
  ["out-of-order", "Handle out-of-order billing events."],
  ["state-machine", "Control cancellation and reactivation through a state machine."],
  ["invoice-ownership", "Check invoice ownership."],
  ["refund-privilege", "Require appropriate privilege for refunds."],
  ["refund-audit", "Record refund audit evidence."],
  ["no-failure-entitlement", "Do not grant entitlements on billing failure."],
  ["grace-period", "Handle entitlement-removal grace periods explicitly."],
  ["no-card-logs", "Do not log payment-card data."],
  ["card-provider", "Keep card data out of GreyhoundIQ servers unless explicitly required and compliance-scoped."],
]);

const PERSONAL_INFORMATION_RECORD = fieldRequirements(
  "personal-information-record", "field", "Every personal-information inventory record", [
    "name", "purpose", "collectionSource", "legalOrOperationalBasis", "requiredOrOptionalStatus", "userVisibility", "staffVisibility", "thirdPartyDisclosure", "storageLocation", "encryption", "retention", "deletion", "deidentification", "backupBehaviour", "exportBehaviour", "correctionBehaviour", "loggingBehaviour", "analyticsBehaviour", "aiUseBehaviour", "dataOwner",
  ]
);

const PRIVACY_MINIMISATION = sectionRequirements("privacy-minimisation", [
  ["minimise", "Apply collection minimization."],
  ["no-future-use", "Do not collect a field solely because it may be useful later."],
]);

const RETENTION_SCHEDULE = sectionRequirements("retention-schedule", [
  ...[
    "user profiles", "sessions", "authentication events", "posts", "comments", "messages", "media", "listings", "enquiries", "support tickets", "moderation records", "audit logs", "security logs", "billing records", "invoices", "webhook payloads", "racing-data snapshots", "AI prompts and responses", "exports", "deleted-account data", "backups",
  ].map((record) => [record.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Define retention for ${record}.`] as const),
]);

const DELETION_LIFECYCLE = sectionRequirements("deletion-lifecycle", [
  ...[
    "immediate deletion", "soft deletion", "delayed deletion", "legal retention", "de-identification", "backup expiry", "search-index deletion", "cache deletion", "object-storage deletion", "third-party deletion", "analytics deletion", "AI-provider deletion where supported",
  ].map((behavior) => [behavior.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Document ${behavior}.`] as const),
  ["truthful-interface", "Do not promise immediate permanent deletion when backups or legal retention prevent it."],
]);

const INCIDENT_READINESS = sectionRequirements("incident-readiness", [
  ...[
    "account compromise", "credential leak", "database exposure", "object-storage exposure", "private-message exposure", "payment-provider incident", "third-party racing-data incident", "malware upload", "administration compromise", "AI-provider data incident", "lost signing key", "webhook-secret compromise", "ransomware", "accidental deletion",
  ].map((incident) => [incident.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Create an incident procedure for ${incident}.`] as const),
  ["ndb-assessment", "Include breach assessment where the Privacy Act and NDB scheme apply."],
  ["ndb-containment", "Include breach containment where the Privacy Act and NDB scheme apply."],
  ["ndb-evidence", "Include evidence preservation where the Privacy Act and NDB scheme apply."],
  ["ndb-notification", "Include notification decision-making where the Privacy Act and NDB scheme apply."],
  ["ndb-communications", "Assign communication responsibilities where the Privacy Act and NDB scheme apply."],
]);

const SECRET_INVENTORY = sectionRequirements("secret-inventory", [
  ...[
    "database credentials", "session keys", "cookie-signing keys", "token-signing keys", "OAuth credentials", "webhook secrets", "payment credentials", "email credentials", "storage credentials", "queue credentials", "AI-provider keys", "racing-provider keys", "monitoring tokens", "deployment credentials", "backup keys", "encryption keys",
  ].map((secret) => [secret.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Inventory ${secret}.`] as const),
]);

const SECRET_RECORD = fieldRequirements(
  "secret-record", "field", "Every secret inventory record", [
    "owner", "purpose", "environment", "storage", "scope", "rotationProcess", "rotationFrequency", "revocationProcess", "lastRotation", "servicesUsingIt", "loggingExposure", "buildTimeExposure", "clientBundleExposure", "incidentProcedure",
  ]
);

const SECRET_CONTROLS = sectionRequirements("secret-control", [
  ["no-client", "Do not place secrets in client bundles."],
  ["no-source", "Do not commit secrets to source control."],
  ["no-example-real", "Do not place real secret values in example files."],
  ["no-logs", "Do not place secrets in logs."],
  ["no-errors", "Do not place secrets in error messages."],
  ["no-analytics", "Do not place secrets in analytics."],
  ["short-lived-cloud", "Prefer short-lived cloud identity over long-lived broad credentials."],
  ["environment-separation", "Use different development and production secrets."],
  ["safe-rotation", "Avoid unsafe downtime during secret rotation where practical."],
  ["revocable", "Make compromised secrets revocable."],
  ["established-crypto", "Use established cryptographic libraries and platform capabilities."],
  ["no-custom-crypto", "Do not create custom encryption schemes."],
]);

const CRYPTOGRAPHY_RECORD = fieldRequirements(
  "cryptography-record", "field", "Cryptography documentation", [
    "algorithms", "keySizes", "keyStorage", "rotation", "nonceHandling", "tokenSigning", "passwordHashingWhereApplicable", "dataEncryption", "backupEncryption", "tlsConfiguration",
  ]
);

const APPLICATION_LOG_FIELDS = sectionRequirements("application-log-field", [
  ...[
    "timestamp", "environment", "service", "request or correlation ID", "trace ID", "actor ID where appropriate", "tenant ID where appropriate", "action", "target type", "safe target ID", "outcome", "error classification", "duration", "security-relevant metadata",
  ].map((field) => [field.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Include ${field} in structured application logs.`] as const),
]);

const APPLICATION_LOG_PROHIBITIONS = sectionRequirements("application-log-prohibition", [
  ...[
    "passwords", "session tokens", "access tokens", "refresh tokens", "recovery tokens", "webhook signatures", "API secrets", "full payment-card data", "private message bodies unless explicitly justified", "sensitive uploaded-file contents", "unredacted provider payloads", "database connection strings", "full authentication headers",
  ].map((value) => [value.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Do not include ${value} in application logs.`] as const),
]);

const AUDIT_EVENTS = sectionRequirements("audit-event", [
  ...[
    "authentication success", "authentication failure", "logout", "session revocation", "email or identity changes", "security-setting changes", "role changes", "team invitations", "ownership transfers", "privacy changes", "account suspension", "account deletion", "data export", "listing publication", "listing moderation", "verification decisions", "payment changes", "entitlement changes", "administrative access", "administrative mutations", "support impersonation where supported", "webhook reprocessing", "AI tool mutations", "secret rotation", "policy changes",
  ].map((event) => [event.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Create an audit event for ${event}.`] as const),
]);

const AUDIT_INTEGRITY = sectionRequirements("audit-integrity", [
  ["append-only", "Make audit records append-only or otherwise protected from ordinary application tampering."],
]);

const ALERT_EVENTS = sectionRequirements("alert-event", [
  ...[
    "authentication attack patterns", "repeated access denials", "cross-tenant access attempts", "administrator privilege changes", "last-owner change attempts", "unusual export volume", "unusual message volume", "unusual listing volume", "unusual AI cost", "repeated webhook signature failures", "queue dead-letter growth", "malware detections", "database-authentication failures", "public access to private storage", "secrets detected in logs or builds", "unusual administration access", "backup failure", "restore-test failure", "audit-log pipeline failure",
  ].map((alert) => [alert.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Create an alert for ${alert}.`] as const),
]);

const ALERT_RECORD = fieldRequirements(
  "alert-record", "field", "Every alert definition", [
    "owner", "severity", "threshold", "investigationSteps", "containmentSteps", "escalationPath", "falsePositiveReview", "testMethod",
  ]
);

const INFRASTRUCTURE_REVIEW = sectionRequirements("infrastructure-review", [
  ...[
    "cloud accounts", "IAM", "network policies", "public endpoints", "database exposure", "storage policies", "security groups", "firewalls", "CDN configuration", "TLS", "certificates", "DNS", "domain ownership", "container configuration", "serverless configuration", "runtime permissions", "metadata access", "build systems", "deployment identities", "environment separation", "backups", "monitoring", "patch management",
  ].map((surface) => [surface.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Review infrastructure ${surface}.`] as const),
]);

const INFRASTRUCTURE_CONTROLS = sectionRequirements("infrastructure-control", [
  ["database-private", "Do not expose production databases directly to the public without an explicitly reviewed architecture."],
  ["storage-private", "Keep storage private by default."],
  ["public-object-intentional", "Make every public storage object intentional."],
  ["dev-no-prod", "Prevent development from connecting to production by default."],
  ["staging-no-prod", "Prevent staging credentials from accessing production."],
  ["ci-min-secrets", "Give CI jobs only required secrets."],
  ["untrusted-pr", "Prevent untrusted pull-request jobs from accessing production secrets."],
  ["identity-separation", "Separate deployment identities from runtime identities."],
  ["debug-off", "Disable production debug mode."],
  ["no-stack-traces", "Do not expose stack traces publicly."],
  ["management-controls", "Protect management interfaces with strong authentication and network controls."],
  ["backup-encryption", "Encrypt backups."],
  ["restore-test", "Test restore procedures."],
  ["recovery-objectives", "Document recovery objectives."],
  ["patch-sla", "Define service-level targets for security patches."],
  ["supported-runtime", "Remove unsupported runtimes and dependencies."],
]);

const SUPPLY_CHAIN_CONTROLS = sectionRequirements("supply-chain-control", [
  ...[
    "dependency inventory", "lockfiles", "package provenance", "software bill of materials", "dependency vulnerability scanning", "secret scanning", "static application-security testing", "infrastructure-as-code scanning", "container-image scanning", "license review", "malicious-package detection", "dependency update process", "build reproducibility where practical", "artifact integrity", "deployment approval", "protected branches", "required code review", "security-sensitive code ownership", "release signing or provenance where supported",
  ].map((control) => [control.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Create a supply-chain control for ${control}.`] as const),
]);

const SUPPLY_CHAIN_REVIEW = sectionRequirements("supply-chain-review", [
  ...[
    "install scripts", "post-install scripts", "direct URL dependencies", "Git dependencies", "unmaintained packages", "duplicate libraries", "runtime dependencies used only for development", "public package-name confusion", "internal package publishing", "CI action pinning", "container base images", "transitive dependencies",
  ].map((surface) => [surface.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Review ${surface} for supply-chain risk.`] as const),
  ["scan-not-proof", "Do not treat a clean dependency scan as proof that the application is secure."],
]);

const ENDPOINT_TEST_AUTHENTICATION = sectionRequirements("endpoint-test-authentication", [
  ...[
    "signed out", "expired session", "revoked session", "suspended user", "deleted user", "invalid token", "wrong token audience", "wrong token issuer", "reused callback", "invalid callback state", "unsafe return URL", "missing CSRF protection", "invalid CSRF protection",
  ].map((state) => [state.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Test every relevant endpoint with ${state}.`] as const),
]);

const ENDPOINT_TEST_AUTHORIZATION = sectionRequirements("endpoint-test-authorization", [
  ...[
    "wrong role", "wrong permission", "wrong subscription", "wrong tenant", "wrong organization", "wrong owner", "wrong page", "wrong team", "wrong group", "wrong conversation member", "blocked relationship", "private object", "deleted object", "archived object", "suspended object", "administrator-only action as moderator", "moderator action as ordinary member", "object ID belonging to another user", "correct object type but unauthorized object", "attempted security-field update", "attempted mass assignment",
  ].map((state) => [state.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Test every relevant endpoint with ${state}.`] as const),
]);

const ENDPOINT_TEST_VALIDATION = sectionRequirements("endpoint-test-validation", [
  ...[
    "missing required field", "null", "empty string", "excessively long value", "out-of-range number", "invalid enumeration", "unexpected fields", "invalid nested object", "oversized array", "invalid identifier", "invalid date", "invalid URL", "invalid file", "unexpected content type", "oversized request", "unsupported method", "duplicate submission",
  ].map((state) => [state.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Test every relevant endpoint with ${state}.`] as const),
]);

const ENDPOINT_TEST_INJECTION_OUTPUT = sectionRequirements("endpoint-test-injection-output", [
  ...[
    "SQL injection attempts", "stored XSS content", "reflected XSS content", "unsafe Markdown", "unsafe HTML", "path traversal", "header injection", "log injection", "unsafe redirect destinations", "SSRF destinations", "spreadsheet-formula content in exports", "external API responses with unexpected values",
  ].map((state) => [state.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Test representative ${state} and confirm safe handling rather than only an error response.`] as const),
]);

const ENDPOINT_TEST_RESOURCE_ABUSE = sectionRequirements("endpoint-test-resource-abuse", [
  ...[
    "pagination maximum", "large search", "high-cost filter combination", "repeated submissions", "per-user rate limits", "per-object rate limits", "upload quotas", "messaging quotas", "export quotas", "AI cost limits", "queue backpressure", "provider timeout", "database timeout",
  ].map((state) => [state.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Test ${state}.`] as const),
]);

const ENDPOINT_TEST_CONCURRENCY = sectionRequirements("endpoint-test-concurrency", [
  ...[
    "two simultaneous edits", "duplicate publication", "duplicate checkout", "duplicate invitation", "duplicate webhook", "out-of-order webhook", "simultaneous ownership transfer", "simultaneous last-owner removal", "simultaneous moderation action", "retried queue job", "lost-update prevention", "idempotency-key reuse",
  ].map((state) => [state.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Test ${state}.`] as const),
]);

const ENDPOINT_TEST_DATABASE = sectionRequirements("endpoint-test-database", [
  ...[
    "tenant predicate", "ownership predicate", "row-level security", "database-role privileges", "constraint enforcement", "affected-row checks", "transaction rollback", "query timeout", "pagination bound", "sensitive-column selection", "deleted-record filtering", "index use for critical queries", "migration compatibility",
  ].map((state) => [state.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Test database ${state}.`] as const),
]);

const ENDPOINT_TEST_ERROR = sectionRequirements("endpoint-test-error", [
  ...[
    "database unavailable", "cache unavailable", "queue unavailable", "storage unavailable", "payment provider unavailable", "authentication provider unavailable", "racing provider unavailable", "AI provider unavailable", "malformed provider response", "internal exception", "logging failure", "audit failure",
  ].map((state) => [state.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Test safe behavior when ${state}.`] as const),
]);

const ENDPOINT_TEST_AUDIT_FAILURE = sectionRequirements("endpoint-test-audit-failure", [
  ["fail-closed", "Fail sensitive mutations safely when required audit evidence cannot be recorded."],
  ["durable-fallback", "Document and verify a durable fallback before allowing a sensitive mutation when direct audit recording fails."],
  ["negative-tests", "Give every endpoint automated negative tests rather than only happy-path tests."],
]);

const MANDATORY_TRACES = requirements("mandatory-trace", [
  ["security.trace.01.homepage-read", "Trace a visitor opening the homepage."],
  ["security.trace.02.contact-submit", "Trace a visitor submitting the contact form."],
  ["security.trace.03.sign-in-start", "Trace a visitor starting sign-in."],
  ["security.trace.04.auth-callback-session", "Trace an authentication callback creating or resuming a session."],
  ["security.trace.05.signed-out-protected-route", "Trace a signed-out user attempting to open a protected route."],
  ["security.trace.06.race-search", "Trace a member searching races."],
  ["security.trace.07.open-race", "Trace a member opening a race."],
  ["security.trace.08.open-dog", "Trace a member opening a dog."],
  ["security.trace.09.open-track", "Trace a member opening a track."],
  ["security.trace.10.racing-provider-ingest", "Trace racing data ingested from an external provider."],
  ["security.trace.11.feed-create", "Trace a member creating a Feed post."],
  ["security.trace.12.feed-edit", "Trace a member editing a Feed post."],
  ["security.trace.13.feed-delete", "Trace a member deleting a Feed post."],
  ["security.trace.14.add-comment", "Trace a member adding a comment."],
  ["security.trace.15.react", "Trace a member reacting to content."],
  ["security.trace.16.save", "Trace a member saving content."],
  ["security.trace.17.group-join", "Trace a member joining a group."],
  ["security.trace.18.private-thread-open", "Trace a member opening a private thread."],
  ["security.trace.19.conversation-start", "Trace a member starting a private conversation."],
  ["security.trace.20.send-text", "Trace a member sending a text message."],
  ["security.trace.21.message-media-upload", "Trace a member uploading message media."],
  ["security.trace.22.voice-video-start", "Trace a member starting a voice or video call."],
  ["security.trace.23.marketplace-search", "Trace a buyer searching Marketplace."],
  ["security.trace.24.marketplace-open", "Trace a buyer opening a listing."],
  ["security.trace.25.marketplace-save", "Trace a buyer saving a listing."],
  ["security.trace.26.marketplace-enquire", "Trace a buyer sending an enquiry."],
  ["security.trace.27.listing-draft-create", "Trace a seller creating a listing draft."],
  ["security.trace.28.listing-media-upload", "Trace a seller uploading listing media."],
  ["security.trace.29.listing-publish", "Trace a seller publishing a listing."],
  ["security.trace.30.listing-edit", "Trace a seller editing a listing."],
  ["security.trace.31.unauthorised-other-seller-edit", "Trace an unauthorized member attempting to edit another seller's listing."],
  ["security.trace.32.profile-update", "Trace a member updating profile information."],
  ["security.trace.33.privacy-change", "Trace a member changing privacy settings."],
  ["security.trace.34.security-change", "Trace a member changing a security setting."],
  ["security.trace.35.team-invite-create", "Trace a team owner creating an invitation."],
  ["security.trace.36.invitation-accept", "Trace an invited user accepting an invitation."],
  ["security.trace.37.team-role-change", "Trace a team owner changing a role."],
  ["security.trace.38.last-owner-removal-attempt", "Trace an attempt to remove the last owner."],
  ["security.trace.39.billing-checkout", "Trace a member starting billing checkout."],
  ["security.trace.40.payment-webhook", "Trace a payment-provider webhook."],
  ["security.trace.41.checkout-return", "Trace a member returning from checkout."],
  ["security.trace.42.invoice-view", "Trace a member viewing an invoice."],
  ["security.trace.43.data-export-request", "Trace a member requesting a data export."],
  ["security.trace.44.account-deletion-request", "Trace a member requesting account deletion."],
  ["security.trace.45.moderator-allowed-report", "Trace a moderator processing an allowed report."],
  ["security.trace.46.moderator-admin-only-attempt", "Trace a moderator attempting an administrator-only action."],
  ["security.trace.47.admin-user-status-change", "Trace an administrator changing user status."],
  ["security.trace.48.admin-webhook-reprocess", "Trace an administrator reprocessing a webhook."],
  ["security.trace.49.ai-run-start", "Trace an AI user starting an agent run."],
  ["security.trace.50.ai-protected-mutation-attempt", "Trace an AI tool attempting a protected mutation."],
  ["security.trace.51.background-queued-event", "Trace a background job processing a queued event."],
  ["security.trace.52.design-lab-privileged-render", "Trace Design Lab rendering a privileged state."],
  ["security.trace.53.design-lab-simulated-destructive-action", "Trace Design Lab attempting a simulated destructive action."],
  ["security.trace.54.private-file-download", "Trace a private file download."],
  ["security.trace.55.blocked-user-protected-access", "Trace a blocked user attempting to access protected content."],
] as const);

const CI_GATES = requirements("ci-gate", [
  ["security.ci.01.frontend-action-missing-trace", "Fail when a frontend action has no security trace ID."],
  ["security.ci.02.api-missing-inventory", "Fail when an API has no inventory entry."],
  ["security.ci.03.nonexistent-inventory-endpoint", "Fail when an inventory endpoint does not exist."],
  ["security.ci.04.deployed-route-absent", "Fail when a deployed route is absent from the inventory."],
  ["security.ci.05.mutation-no-authz", "Fail when a state-changing endpoint lacks an authorization policy."],
  ["security.ci.06.object-endpoint-no-object-authz", "Fail when an object endpoint lacks object-level authorization."],
  ["security.ci.07.unrestricted-mutation-fields", "Fail when a mutation accepts unrestricted fields."],
  ["security.ci.08.protected-endpoint-no-signed-out-test", "Fail when a protected endpoint has no signed-out test."],
  ["security.ci.09.tenant-endpoint-no-cross-tenant-test", "Fail when a tenant-scoped endpoint has no cross-tenant test."],
  ["security.ci.10.admin-endpoint-accessible-moderator", "Fail when an administrator endpoint is accessible to a moderator."],
  ["security.ci.11.database-operation-no-trace", "Fail when a database operation is not linked to a trace."],
  ["security.ci.12.unsafe-query-interpolation", "Fail when a database query uses unsafe string interpolation."],
  ["security.ci.13.collection-unbounded", "Fail when a collection query has no enforced bound."],
  ["security.ci.14.sensitive-query-unspecified-fields", "Fail when a sensitive query returns unspecified fields."],
  ["security.ci.15.destructive-action-no-audit", "Fail when a destructive action has no audit event."],
  ["security.ci.16.payment-webhook-no-signature", "Fail when a payment webhook lacks signature verification."],
  ["security.ci.17.webhook-no-dedupe", "Fail when a webhook lacks deduplication."],
  ["security.ci.18.billing-return-grants-entitlement", "Fail when a billing return grants entitlements."],
  ["security.ci.19.sensitive-action-no-csrf", "Fail when a sensitive action lacks CSRF protection where required."],
  ["security.ci.20.private-response-public-cacheable", "Fail when a private response is publicly cacheable."],
  ["security.ci.21.committed-secret", "Fail when a secret is committed."],
  ["security.ci.22.client-bundle-server-secret", "Fail when a production client bundle contains a server secret."],
  ["security.ci.23.unresolved-release-blocking-dependency", "Fail when a dependency has an unresolved release-blocking vulnerability."],
  ["security.ci.24.infrastructure-exposes-private-datastore", "Fail when an infrastructure change exposes a private datastore."],
  ["security.ci.25.design-lab-indexable", "Fail when a Design Lab endpoint is indexable."],
  ["security.ci.26.design-lab-production-mutation", "Fail when a Design Lab action can mutate production."],
  ["security.ci.27.security-doc-missing-endpoint", "Fail when a security tour or document references a nonexistent endpoint."],
  ["security.ci.28.skipped-critical-test", "Fail when a critical security test is skipped."],
  ["security.ci.29.high-finding-no-owner", "Fail when a new high-risk finding has no owner."],
  ["security.ci.30.expired-risk-acceptance", "Fail when a risk acceptance has expired."],
] as const);

const CI_GATE_GOVERNANCE = sectionRequirements("ci-gate-governance", [
  ["security-review-for-expectation-change", "Do not allow developers to bypass security gates by changing test expectations without security review."],
]);

const SECURITY_FINDING_RECORD = fieldRequirements(
  "security-finding-record", "field", "Every security finding", [
    "findingId", "title", "severity", "affectedTraceIds", "affectedEnvironments", "affectedActors", "affectedRecords", "dataClassification", "sourceFile", "sourceSymbol", "endpoint", "databaseOperation", "description", "actualBehaviour", "expectedBehaviour", "attackPreconditions", "businessImpact", "privacyImpact", "evidence", "rootCause", "immediateContainment", "permanentRemediation", "regressionTests", "owner", "targetDate", "status", "residualRisk", "retestEvidence",
  ]
);

const FINDING_SEVERITY = sectionRequirements("finding-severity", [
  ...[
    "exploitability", "authentication required", "required role", "cross-tenant impact", "personal-information impact", "financial impact", "administration impact", "automation potential", "scale", "detectability", "recoverability",
  ].map((factor) => [factor.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Consider ${factor} when assigning finding severity.`] as const),
  ["not-obscurity", "Do not lower severity because a route is undocumented or difficult to find."],
]);

const REQUIRED_OUTPUTS = requirements("required-output", [
  ["security.output.01.security-architecture", "Produce docs/security/security-architecture.md."],
  ["security.output.02.trust-boundaries", "Produce docs/security/trust-boundaries.md."],
  ["security.output.03.data-flow-diagrams", "Produce docs/security/data-flow-diagrams.md."],
  ["security.output.04.api-inventory", "Produce docs/security/api-inventory.md and docs/security/api-inventory.json."],
  ["security.output.05.security-trace-registry", "Produce docs/security/security-trace-registry.md."],
  ["security.output.06.frontend-server-database-map", "Produce docs/security/frontend-server-database-map.md."],
  ["security.output.07.database-inventory", "Produce docs/security/database-inventory.md."],
  ["security.output.08.database-query-map", "Produce docs/security/database-query-map.md."],
  ["security.output.09.database-role-matrix", "Produce docs/security/database-role-matrix.md."],
  ["security.output.10.data-classification", "Produce docs/security/data-classification.md."],
  ["security.output.11.authorization-matrix", "Produce docs/security/authorization-matrix.md."],
  ["security.output.12.authentication-review", "Produce docs/security/authentication-review.md."],
  ["security.output.13.session-review", "Produce docs/security/session-review.md."],
  ["security.output.14.threat-model", "Produce docs/security/threat-model.md."],
  ["security.output.15.abuse-case-map", "Produce docs/security/abuse-case-map.md."],
  ["security.output.16.file-upload-review", "Produce docs/security/file-upload-review.md."],
  ["security.output.17.webhook-review", "Produce docs/security/webhook-review.md."],
  ["security.output.18.third-party-register", "Produce docs/security/third-party-register.md."],
  ["security.output.19.secrets-register", "Produce docs/security/secrets-register.md."],
  ["security.output.20.logging-and-alerting", "Produce docs/security/logging-and-alerting.md."],
  ["security.output.21.privacy-data-lifecycle", "Produce docs/security/privacy-data-lifecycle.md."],
  ["security.output.22.incident-response", "Produce docs/security/incident-response.md."],
  ["security.output.23.backup-and-recovery", "Produce docs/security/backup-and-recovery.md."],
  ["security.output.24.supply-chain-review", "Produce docs/security/supply-chain-review.md."],
  ["security.output.25.security-test-matrix", "Produce docs/security/security-test-matrix.md."],
  ["security.output.26.risk-register", "Produce docs/security/risk-register.md."],
  ["security.output.27.release-security-report", "Produce docs/security/release-security-report.md."],
  ["security.output.28.registry-traces", "Produce the authoritative machine registry security/traces.ts."],
  ["security.output.29.registry-endpoints", "Produce the authoritative machine registry security/endpoints.ts."],
  ["security.output.30.registry-policies", "Produce the authoritative machine registry security/policies.ts."],
  ["security.output.31.registry-audit-events", "Produce the authoritative machine registry security/audit-events.ts."],
  ["security.output.32.registry-data-classification", "Produce the authoritative machine registry security/data-classification.ts."],
  ["security.output.33.registry-database-operations", "Produce the authoritative machine registry security/database-operations.ts."],
  ["security.output.34.registry-rate-limits", "Produce the authoritative machine registry security/rate-limits.ts."],
  ["security.output.35.registry-third-parties", "Produce the authoritative machine registry security/third-parties.ts."],
] as const);

const REGISTRY_GOVERNANCE = sectionRequirements("registry-governance", [
  ["adapt-paths", "Adapt authoritative output paths to the existing repository structure."],
  ["machine-readable", "Create machine-readable registries where possible."],
  ["single-authority", "Do not create duplicate registries that can conflict."],
  ["generated-docs", "Generate documentation from authoritative registries where practical."],
]);

const FINAL_TRACEABILITY_FIELDS = fieldRequirements(
  "final-traceability-field", "field", "Every final traceability matrix row", [
    "traceId", "productArea", "route", "userAction", "frontendSource", "request", "serverHandler", "authentication", "authorizationPolicy", "validationSchema", "service", "databaseQueryIds", "databaseRole", "tables", "sensitiveData", "cacheEffects", "backgroundEffects", "externalEffects", "auditEvent", "securityTests", "openFindings", "verificationStatus", "owner",
  ]
);

const FINAL_SUMMARY_METRICS = sectionRequirements("final-summary-metric", [
  ...[
    "total frontend actions", "total APIs", "total database operations", "total external integrations", "total privileged operations", "total traces verified", "total traces partially verified", "total missing traces", "critical findings", "high findings", "medium findings", "low findings", "accepted risks", "expired risk acceptances", "missing tests", "missing owners", "missing audit events", "unbounded queries", "unauthorized data paths", "deprecated endpoints", "publicly exposed internal services",
  ].map((metric) => [metric.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Report ${metric} in the final traceability report.`] as const),
]);

const RELEASE_CRITERIA = requirements("release-criterion", [
  ["security.release.01.all-actions-trace-ids", "Every discovered user action has a trace ID."],
  ["security.release.02.traces-reach-datastore-external", "Every trace reaches the actual datastore or external side effect."],
  ["security.release.03.all-deployed-apis-inventoried", "Every deployed API is inventoried."],
  ["security.release.04.protected-endpoints-server-authn", "Every protected endpoint authenticates on the server."],
  ["security.release.05.protected-endpoints-server-authz", "Every protected endpoint authorizes on the server."],
  ["security.release.06.identifier-endpoints-object-authz", "Every identifier-based endpoint has object-level authorization."],
  ["security.release.07.mutations-field-allowlist", "Every mutation has a field allowlist."],
  ["security.release.08.tenant-isolation", "Every tenant-scoped operation enforces tenant isolation."],
  ["security.release.09.queries-parameterized", "Every database query is parameterized."],
  ["security.release.10.collections-bounded", "Every collection query is bounded."],
  ["security.release.11.sensitive-responses-output-schema", "Every sensitive response has an explicit output schema."],
  ["security.release.12.privileged-mutations-audited", "Every privileged mutation is audited."],
  ["security.release.13.destructive-confirmation-authz", "Every destructive action has appropriate confirmation and authorization."],
  ["security.release.14.payment-state-server-confirmed", "Every payment state is confirmed server-side."],
  ["security.release.15.webhooks-authenticated-idempotent", "Every webhook is authenticated and idempotent."],
  ["security.release.16.uploads-validated-owned", "Every upload is validated and ownership-controlled."],
  ["security.release.17.private-downloads-authorised", "Every private download is authorized."],
  ["security.release.18.background-jobs-payload-authority", "Every background job validates its payload and execution authority."],
  ["security.release.19.external-responses-untrusted", "Every external API response is treated as untrusted."],
  ["security.release.20.high-risk-abuse-controls", "Every high-risk flow has abuse controls."],
  ["security.release.21.secrets-outside-source-client", "Every secret is stored outside source code and client bundles."],
  ["security.release.22.datastore-network-reviewed", "Every production datastore has reviewed network exposure."],
  ["security.release.23.backups-restore-tested", "Every critical backup has a successful restore test."],
  ["security.release.24.high-risk-negative-tests", "Every high-risk endpoint has negative tests."],
  ["security.release.25.design-lab-no-production-data-mutation", "Design Lab cannot access or mutate production data."],
  ["security.release.26.no-unresolved-critical-high", "No known critical or high-risk vulnerability remains unresolved."],
  ["security.release.27.residual-risks-owner-expiry", "Every remaining risk has an explicit owner and expiry date."],
  ["security.release.28.report-accurate-residual-risk", "The final report accurately states residual risk."],
  ["security.release.29.no-fabricated-evidence", "No evidence is fabricated."],
  ["security.release.30.no-frontend-only-conclusion", "No security conclusion depends only on frontend behavior."],
] as const);

const IMPLEMENTATION_CYCLE = sectionRequirements("implementation-cycle", [
  ["root-cause", "When a control is missing, identify its root cause."],
  ["server-fix", "When a control is missing, implement the server-side fix."],
  ["database-control", "When a control is missing, add or update the database control."],
  ["tests", "When a control is missing, add negative and regression tests."],
  ["trace-registry", "When a control is missing, update the trace registry."],
  ["api-inventory", "When a control is missing, update the API inventory."],
  ["query-map", "When a control is missing, update the database-query map."],
  ["threat-model", "When a control is missing, update the threat model."],
  ["audit-monitoring", "When a control is missing, record audit and monitoring requirements."],
  ["rerun-tests", "When a control is missing, rerun the full relevant test suite."],
  ["not-docs-only", "Do not stop after producing security documentation."],
]);

const PLACEHOLDER_PROHIBITIONS = sectionRequirements("placeholder-prohibition", [
  ...[
    "Add authentication later", "Check permissions", "Validate input", "Secure this endpoint", "Add rate limits", "Use encryption", "Handle errors", "Add database security", "Review the webhook", "Test for IDOR",
  ].map((placeholder) => [placeholder.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `Do not leave the generic placeholder '${placeholder}'.`] as const),
  ["exact-file", "Every control must name the exact file."],
  ["exact-function", "Every control must name the exact function."],
  ["exact-policy", "Every control must name the exact policy."],
  ["exact-schema", "Every control must name the exact schema."],
  ["exact-query", "Every control must name the exact query."],
  ["exact-role", "Every control must name the exact database role."],
  ["exact-test", "Every control must name the exact test."],
  ["exact-evidence", "Every control must name the exact evidence."],
  ["exact-owner", "Every control must name the exact owner."],
]);

const REVIEWER_ANSWERABILITY = sectionRequirements("reviewer-answerability", [
  ...[
    "who can perform the action", "what the browser sends", "which server code receives it", "how the user is authenticated", "which policy authorizes the action", "how ownership is checked", "which fields are accepted", "which fields are returned", "which database role is used", "what exact normalized query runs", "which tables and columns are accessed", "which constraints and policies protect the data", "what transaction occurs", "what happens concurrently", "which caches, queues, and external providers are involved", "what is logged", "what is audited", "what the user sees on success or failure", "which automated tests prove the expected security behavior", "what residual risk remains",
  ].map((question) => [question.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), `The final system must let a reviewer answer ${question} without guessing.`] as const),
  ["shared-trace-ids", "Make the screen, action, API, database-query, security-control, and automated-test registries share the same trace IDs."],
]);

export const SECURITY_MASTER_REQUIREMENT_COUNTS = {
  mandatoryTrace: 55,
  ciGate: 30,
  requiredOutput: 35,
  releaseCriterion: 30,
} as const;

export const SECURITY_MASTER_REQUIREMENTS: readonly SecurityMasterRequirement[] = [
  ...ENGAGEMENT_ROLE,
  ...REQUIRED_INPUT_REGISTRIES,
  ...TRACE_SCOPE,
  ...STANDARDS_BASELINE,
  ...PRIMARY_TRACE_CHAIN,
  ...PRIMARY_TRACE_EVIDENCE,
  ...SECURITY_LANGUAGE,
  ...RISK_ACCEPTANCE,
  ...AUTHORISED_TESTING,
  ...SERVER_AUTHORITY,
  ...DENY_DEFAULT,
  ...LEAST_PRIVILEGE,
  ...EXPLICIT_DATA_SELECTION,
  ...SECURE_FAILURE,
  ...APPLICATION_SURFACES,
  ...INFRASTRUCTURE_SURFACES,
  ...INFRASTRUCTURE_COMPONENT_RECORD,
  ...TRUST_BOUNDARY_DIAGRAMS,
  ...TRACE_IDENTIFIERS,
  ...TRACE_IDENTIFIER_EXAMPLES,
  ...SECURITY_TRACE_CONTRACT,
  ...SECURITY_TRACE_ENUMS,
  ...DATABASE_OPERATION_CONTRACT,
  ...DATABASE_OPERATION_ENUMS,
  ...ACTION_TRACE_USER_CONTEXT,
  ...ACTION_TRACE_FRONTEND,
  ...ACTION_TRACE_REQUEST,
  ...ACTION_TRACE_SERVER_ENTRY,
  ...ACTION_TRACE_AUTHORIZATION,
  ...ACTION_TRACE_DATABASE,
  ...ACTION_TRACE_SIDE_EFFECT,
  ...ACTION_TRACE_RESPONSE,
  ...ACTION_TRACE_EVIDENCE,
  ...API_INVENTORY_SURFACES,
  ...API_INVENTORY_RECORD,
  ...API_INVENTORY_MANAGEMENT,
  ...AUTHENTICATION_PATHS,
  ...AUTHENTICATION_CONTROLS,
  ...COOKIE_CONTROLS,
  ...CSRF_CONTROLS,
  ...AUTHORIZATION_ACTORS,
  ...AUTHORIZATION_DIMENSIONS,
  ...OBJECT_AUTHORIZATION,
  ...PROPERTY_AUTHORIZATION,
  ...TENANT_ISOLATION,
  ...ADMINISTRATION_CONTROLS,
  ...EXTERNAL_INPUT_SURFACES,
  ...INPUT_VALIDATION,
  ...INJECTION_PREVENTION,
  ...DATABASE_INVENTORY,
  ...DATABASE_COLUMN_RECORD,
  ...ACTUAL_QUERY_CAPTURE,
  ...DATABASE_QUERY_RECORD,
  ...QUERY_SAFETY,
  ...MUTATION_SAFETY,
  ...ROW_LEVEL_SECURITY,
  ...DATABASE_ROLE_SEPARATION,
  ...MIGRATION_REVIEW,
  ...API_TOP_TEN,
  ...RESOURCE_CONTROLS,
  ...SENSITIVE_BUSINESS_FLOWS,
  ...ABUSE_CONTROLS,
  ...IDEMPOTENCY_CONTROLS,
  ...CORS_CONTROLS,
  ...HTTP_CONTROLS,
  ...WEBHOOK_CONTROLS,
  ...QUEUE_WORKER_CONTROLS,
  ...SCHEDULED_TASK_CONTROLS,
  ...REALTIME_CONTROLS,
  ...VOICE_VIDEO_CONTROLS,
  ...FILE_MEDIA_INVENTORY,
  ...UPLOAD_VALIDATION,
  ...UPLOAD_CONTROLS,
  ...UPLOAD_UNTRUSTED_CLAIMS,
  ...DOWNLOAD_CONTROLS,
  ...SSRF_CONTROLS,
  ...BROWSER_DATA_HANDLING,
  ...FRONTEND_AUTHORIZATION,
  ...XSS_SURFACES,
  ...BROWSER_SECURITY_HEADERS,
  ...EXTERNAL_LINK_EMBED,
  ...THREAT_MODEL_GOVERNANCE,
  ...THREAT_PUBLIC,
  ...THREAT_RACING,
  ...THREAT_COMMUNITY,
  ...THREAT_MESSAGING,
  ...THREAT_MARKETPLACE,
  ...THREAT_ACCOUNT,
  ...THREAT_ADMINISTRATION,
  ...THREAT_AI,
  ...THREAT_DESIGN_LAB,
  ...THIRD_PARTY_INVENTORY,
  ...THIRD_PARTY_RECORD,
  ...THIRD_PARTY_RESPONSE_VALIDATION,
  ...THIRD_PARTY_PROHIBITIONS,
  ...BILLING_LIFECYCLE,
  ...BILLING_CONTROLS,
  ...PERSONAL_INFORMATION_RECORD,
  ...PRIVACY_MINIMISATION,
  ...RETENTION_SCHEDULE,
  ...DELETION_LIFECYCLE,
  ...INCIDENT_READINESS,
  ...SECRET_INVENTORY,
  ...SECRET_RECORD,
  ...SECRET_CONTROLS,
  ...CRYPTOGRAPHY_RECORD,
  ...APPLICATION_LOG_FIELDS,
  ...APPLICATION_LOG_PROHIBITIONS,
  ...AUDIT_EVENTS,
  ...AUDIT_INTEGRITY,
  ...ALERT_EVENTS,
  ...ALERT_RECORD,
  ...INFRASTRUCTURE_REVIEW,
  ...INFRASTRUCTURE_CONTROLS,
  ...SUPPLY_CHAIN_CONTROLS,
  ...SUPPLY_CHAIN_REVIEW,
  ...ENDPOINT_TEST_AUTHENTICATION,
  ...ENDPOINT_TEST_AUTHORIZATION,
  ...ENDPOINT_TEST_VALIDATION,
  ...ENDPOINT_TEST_INJECTION_OUTPUT,
  ...ENDPOINT_TEST_RESOURCE_ABUSE,
  ...ENDPOINT_TEST_CONCURRENCY,
  ...ENDPOINT_TEST_DATABASE,
  ...ENDPOINT_TEST_ERROR,
  ...ENDPOINT_TEST_AUDIT_FAILURE,
  ...MANDATORY_TRACES,
  ...CI_GATES,
  ...CI_GATE_GOVERNANCE,
  ...SECURITY_FINDING_RECORD,
  ...FINDING_SEVERITY,
  ...REQUIRED_OUTPUTS,
  ...REGISTRY_GOVERNANCE,
  ...FINAL_TRACEABILITY_FIELDS,
  ...FINAL_SUMMARY_METRICS,
  ...RELEASE_CRITERIA,
  ...IMPLEMENTATION_CYCLE,
  ...PLACEHOLDER_PROHIBITIONS,
  ...REVIEWER_ANSWERABILITY,
];
