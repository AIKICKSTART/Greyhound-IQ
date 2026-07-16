# Security trace registry and final traceability report

Status: **Partially verified — report structure verified; production release blocked**  
Authoritative records: `security/traces.ts`, `security/endpoints.ts`, `security/database-operations.ts`, `security/third-parties.ts`  
Generation contract: `security/final-traceability.ts`

This report verifies that every current trace row records all 23 required fields and that all 21 required summary metrics are present. It does not claim complete action, API, query, finding, deployment or runtime coverage. `Unknown` is a deliberate fail-closed result with a concrete reason, not a zero.

## Summary metrics

| Metric | Status | Value | Scope and limitation | Evidence |
|---|---|---:|---|---|
| `security.final-summary-metric.total-frontend-actions` | unknown | Unknown | All product frontend actions. No complete frontend-action registry exists; discovered server actions are not a frontend-action total. Observed facets: {"discoveredServerActions":81,"seededTraceRows":19}. | `docs/product/action-inventory.md`<br>`security/endpoints.ts` |
| `security.final-summary-metric.total-apis` | partial | 187 | Source-discovered EndpointContract records, including HTTP methods and server actions. Deployed API parity and non-Next entry points have not been verified. Observed facets: {"httpMethods":106,"serverActions":81}. | `security/endpoints.ts`<br>`security/registry.test.ts` |
| `security.final-summary-metric.total-database-operations` | partial | 27 | Registered DatabaseOperationContract records. The registry is a reviewed seed, not a complete runtime query inventory. | `security/database-operations.ts`<br>`security/registry.test.ts` |
| `security.final-summary-metric.total-external-integrations` | partial | 18 | Registered ThirdPartyContract records. Provider coverage is incomplete and deployed credentials/configuration were not inspected. | `security/third-parties.ts`<br>`security/registry.test.ts` |
| `security.final-summary-metric.total-privileged-operations` | unknown | Unknown | All administrator, moderator, internal-worker and provider-privileged operations. No complete privilege classification links every endpoint, action and job. | `security/endpoints.ts`<br>`docs/security/authorization-matrix.md` |
| `security.final-summary-metric.total-traces-verified` | known | 0 | Current SecurityTraceContract registry. This is a registry-status count, not proof that the trace inventory is complete. | `security/traces.ts`<br>`security/registry.test.ts` |
| `security.final-summary-metric.total-traces-partially-verified` | known | 19 | Current SecurityTraceContract registry. This is a registry-status count, not proof that the trace inventory is complete. | `security/traces.ts`<br>`security/registry.test.ts` |
| `security.final-summary-metric.total-missing-traces` | unknown | Unknown | All required product and system traces. Mandatory trace requirements are not linked one-to-one to SecurityTraceContract IDs, and the complete frontend-action total is unknown. Observed facets: {"mandatoryTraceRequirements":55,"seededTraceRows":19}. | `security/traces.ts`<br>`src/components/security-master-requirements.ts` |
| `security.final-summary-metric.critical-findings` | unknown | Unknown | All open Critical findings. No authoritative machine finding registry exists; zero identified in reviewed prose is not proof of absence. | `docs/security/risk-register.md` |
| `security.final-summary-metric.high-findings` | unknown | Unknown | All open High findings. The prose risk register documents reviewed findings, but no complete machine finding registry proves the total. Observed facets: {"documentedOpenHighFindings":12}. | `docs/security/risk-register.md` |
| `security.final-summary-metric.medium-findings` | unknown | Unknown | All open Medium findings. Medium findings have not been comprehensively triaged into a machine registry. | `docs/security/risk-register.md` |
| `security.final-summary-metric.low-findings` | unknown | Unknown | All open Low findings. Low findings have not been comprehensively triaged into a machine registry. | `docs/security/risk-register.md` |
| `security.final-summary-metric.accepted-risks` | known | 0 | Current merged security-master evidence records with risk-accepted-temporarily status. This count says nothing about risks that have not yet been discovered or registered. | `src/components/master-audit-evidence.ts` |
| `security.final-summary-metric.expired-risk-acceptances` | known | 0 | Current merged security-master evidence records whose acceptance expiry is not in the future. This count covers registered acceptances only. | `src/components/master-audit-requirements.ts` |
| `security.final-summary-metric.missing-tests` | partial | 175 | Source endpoint records whose tests array is empty. Trace and database test gaps are separate facets; this is not a product-wide missing-test total. Observed facets: {"endpointRecordsWithoutLinkedTests":175,"traceRowsWithoutLinkedTests":0,"databaseOperationsMarkedTestCoverageMissing":0}. | `security/endpoints.ts`<br>`security/traces.ts`<br>`security/database-operations.ts` |
| `security.final-summary-metric.missing-owners` | partial | 172 | Source endpoint records with an empty or unassigned owner. DatabaseOperationContract has no owner field, so this is not a cross-registry owner total. Observed facets: {"endpointRecordsWithoutAssignedOwner":172,"traceRowsWithoutOwner":0}. | `security/endpoints.ts`<br>`security/traces.ts` |
| `security.final-summary-metric.missing-audit-events` | partial | 178 | Source endpoint records whose auditEvent array is empty. Not every operation requires an audit event and the required-event classification is incomplete. Observed facets: {"endpointRecordsWithoutLinkedAuditEvent":178,"traceRowsWithoutLinkedAuditEvent":12}. | `security/endpoints.ts`<br>`security/traces.ts`<br>`security/audit-events.ts` |
| `security.final-summary-metric.unbounded-queries` | unknown | Unknown | All unbounded database operations. DatabaseOperationContract does not carry an authoritative boundedness classification; null maximumRowCount is not equivalent to unbounded. Observed facets: {"explicitlyDescribedUnboundedOperations":0}. | `security/database-operations.ts` |
| `security.final-summary-metric.unauthorized-data-paths` | unknown | Unknown | All source and deployed data paths lacking required authorization. No machine registry classifies authorization completeness across every data path. | `security/endpoints.ts`<br>`security/database-operations.ts`<br>`docs/security/authorization-matrix.md` |
| `security.final-summary-metric.deprecated-endpoints` | partial | 0 | Source endpoint records explicitly marked deprecated. Most endpoint deprecation statuses remain unknown, so zero marked deprecated is not proof that no deprecated endpoint exists. Observed facets: {"active":187,"deprecated":0,"unknown":0}. | `security/endpoints.ts` |
| `security.final-summary-metric.publicly-exposed-internal-services` | unknown | Unknown | Deployed internal services reachable through a public path. Source discovery finds internal route methods, but deployed ingress and origin exposure were not inspected. Observed facets: {"internalSourceRouteMethods":12}. | `security/endpoints.ts`<br>`docs/security/security-architecture.md` |

## Trace rows

The matrix contains exactly 19 current seed rows. Every row remains bound to its source verification status. Missing trace coverage remains release-blocking.

### `ONBOARDING.ANALYTICS.RECORD`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | ONBOARDING.ANALYTICS.RECORD |
| `security.final-traceability-field.field.product-area` | Onboarding |
| `security.final-traceability-field.field.route` | ["/api/analytics/onboarding"] |
| `security.final-traceability-field.field.user-action` | Record a consent-gated privacy-minimised onboarding event |
| `security.final-traceability-field.field.frontend-source` | ["src/components/interactive-help.tsx","src/components/onboarding-analytics-client.ts","src/components/onboarding-analytics.ts"] |
| `security.final-traceability-field.field.request` | {"contentType":"application/json","maximumRequestBytes":512,"timeoutMilliseconds":null,"protocol":"HTTPS same-origin fetch","method":"POST","pathOrProcedure":"/api/analytics/onboarding","credentialMode":"same-origin; no identity token required","requiredHeaders":["Origin matching the request URL origin","Sec-Fetch-Site: same-origin when supplied by the user agent","x-greyhoundiq-analytics-consent: accepted","Content-Type: application/json"],"csrfControl":"exact Origin comparison, fetch-metadata rejection and a fixed accepted-consent header","corsPolicy":"same-origin only; no cross-origin success response"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/api/analytics/onboarding/route.ts"],"handlers":["POST","handleOnboardingAnalyticsPost"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"public","authenticationFunction":"public endpoint; no identity lookup","sessionValidationFunction":"not applicable: the event contract excludes identity"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"POLICY.ONBOARDING.ANALYTICS.MINIMISED_PUBLIC_INGEST","object":"registered tour and event-specific step pairs only; no application object access","property":"schemaVersion, event, tourId and event-specific stepId are the only accepted properties","requiredPermissions":[],"requiredRelationships":[]} |
| `security.final-traceability-field.field.validation-schema` | {"client":["parseOnboardingAnalyticsEvent"],"server":"parseOnboardingAnalyticsEvent"} |
| `security.final-traceability-field.field.service` | logRequestInfo onboarding.analytics.recorded with product-area derivation |
| `security.final-traceability-field.field.database-query-ids` | ["DB.ONBOARDING.ANALYTICS.RATE_LIMIT"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["RateLimit"] |
| `security.final-traceability-field.field.sensitive-data` | ["NON_IDENTIFYING_PRODUCT_ANALYTICS"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["src/components/onboarding-analytics.test.ts","src/app/api/analytics/onboarding/route.test.ts","src/lib/rate-limit.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to ONBOARDING.ANALYTICS.RECORD","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | onboarding-observability |

### `AUTH.CALLBACK.RECOVER`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | AUTH.CALLBACK.RECOVER |
| `security.final-traceability-field.field.product-area` | Authentication |
| `security.final-traceability-field.field.route` | ["/callback","/auth/error"] |
| `security.final-traceability-field.field.user-action` | Recover from an authentication callback failure |
| `security.final-traceability-field.field.frontend-source` | ["src/app/auth/error/page.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"not verified","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS OAuth/OIDC callback through WorkOS AuthKit","method":"GET","pathOrProcedure":"/callback","credentialMode":"AuthKit callback state/cookies; exact cookie behaviour not captured","requiredHeaders":[],"csrfControl":"Provider state validation delegated to AuthKit; independent evidence not captured","corsPolicy":"same-site navigation; not independently verified"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/callback/route.ts"],"handlers":["GET (handleAuth)","GET.onError","GET.onSuccess"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"public","authenticationFunction":"@workos-inc/authkit-nextjs handleAuth","sessionValidationFunction":"AuthKit SDK callback validation; exact internal symbol not captured"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"POLICY.AUTH.CALLBACK.WORKOS","object":"not verified","property":"not verified","requiredPermissions":[],"requiredRelationships":[]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"AuthKit callback contract; reason allowlist applied only to recovery display"} |
| `security.final-traceability-field.field.service` | syncAuthUser on success; classifyAuthCallbackFailure on failure |
| `security.final-traceability-field.field.database-query-ids` | [] |
| `security.final-traceability-field.field.database-role` | [] |
| `security.final-traceability-field.field.tables` | [] |
| `security.final-traceability-field.field.sensitive-data` | ["AUTHENTICATION","PERSONAL"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [{"circuitBreakerPolicy":"not verified","webhookFollowUp":"not verified","provider":"WorkOS","operation":"validate callback and establish identity session","credentialScope":"server WorkOS credentials; scope not captured","requestSchema":"AuthKit SDK callback","responseSchema":"AuthKit callback result","timeoutPolicy":"SDK default; not captured","retryPolicy":"fresh user-initiated sign-in"}] |
| `security.final-traceability-field.field.audit-event` | ["AUDIT.AUTH.CALLBACK.FAILED"] |
| `security.final-traceability-field.field.security-tests` | ["src/lib/auth-callback-recovery.test.ts","src/lib/auth-callback-route-contract.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to AUTH.CALLBACK.RECOVER","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | identity-security |

### `AUTH.CALLBACK.COMPLETE`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | AUTH.CALLBACK.COMPLETE |
| `security.final-traceability-field.field.product-area` | Authentication |
| `security.final-traceability-field.field.route` | ["/callback","/auth/error"] |
| `security.final-traceability-field.field.user-action` | Accept an authenticated callback, synchronize the local account and durably hand off new-user side effects |
| `security.final-traceability-field.field.frontend-source` | ["src/app/sign-in/route.ts","src/app/auth/error/page.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"No application request body; AuthKit callback query/cookie contract","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS OAuth/OIDC callback through WorkOS AuthKit","method":"GET","pathOrProcedure":"/callback","credentialMode":"AuthKit callback state, authorization code and cookies; exact fields are not captured","requiredHeaders":[],"csrfControl":"Provider state validation delegated to AuthKit; independent state/nonce/PKCE evidence not captured","corsPolicy":"same-site top-level navigation expected; deployed CORS/Origin behaviour not verified"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/proxy.ts","src/app/callback/route.ts","src/lib/auth-sync.ts","src/lib/signup-acceptance.ts","src/lib/request-id.ts","src/lib/logger.ts","src/lib/db-context.ts","src/lib/signup-acceptance-worker.ts","src/lib/signup-acceptance-worker-store.ts"],"handlers":["proxy","GET (handleAuth)","GET.onSuccess","syncAuthUser","recordSignupAccepted","processSignupAcceptanceBatch","signupAcceptanceWorkerStore"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"public","authenticationFunction":"@workos-inc/authkit-nextjs handleAuth","sessionValidationFunction":"AuthKit callback validation/session establishment; exact SDK state, nonce, PKCE and rotation internals are not captured"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"POLICY.AUTH.CALLBACK.WORKOS","object":"No caller-selected local object; provider subject lookup is server controlled and unverified-email fallback is denied","property":"Server maps fixed AuthIdentity fields and derives free tier, member role, actor defaults, outbox status and idempotency key","requiredPermissions":["callback state and authorization code accepted by AuthKit"],"requiredRelationships":["validated provider subject resolves to one local User","a first local User owns exactly one Profile, personal SocialActor and SignupOutbox row"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"AuthKit handleAuth callback: query { code: string, state: string }; state-bound PKCE cookie carries StateSchema { nonce: string, codeVerifier: string, customState?: string, returnPathname?: string }; local recovery query { error?: string }"} |
| `security.final-traceability-field.field.service` | syncAuthUser / recordSignupAccepted / processSignupAcceptanceBatch |
| `security.final-traceability-field.field.database-query-ids` | ["DB.AUTH.CALLBACK.ACCEPTANCE.TRANSACTION","DB.AUTH.SIGNUP_OUTBOX.EXPIRED_ATTEMPTS.DEAD_LETTER","DB.AUTH.SIGNUP_OUTBOX.CLAIM","DB.AUTH.SIGNUP_OUTBOX.SETTLE"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["User","Profile","SocialActor","SignupOutbox","AuditLog"] |
| `security.final-traceability-field.field.sensitive-data` | ["AUTHENTICATION","PERSONAL","AUDIT_SECURITY","INTERNAL"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [{"queueOrScheduler":"PostgreSQL SignupOutbox; production invoker/scheduler is not implemented or verified","jobType":"Run an injected idempotent new-user acceptance handler; the concrete side effect is not bound","payloadSchema":"{ userId, idempotencyKey, correlationId, attempt }","workerIdentity":"Not implemented or verified; source exports a worker and store but no production invocation identity","retryPolicy":"one claim at a time, 45-second default handler deadline, five default attempts, bounded exponential backoff with deterministic jitter, terminal dead letter","idempotencyKey":"signup.accepted:{server-derived local userId}"}] |
| `security.final-traceability-field.field.external-effects` | [{"circuitBreakerPolicy":"not verified","webhookFollowUp":"Not applicable; this is a browser authentication callback","provider":"WorkOS","operation":"validate the callback and establish or resume the AuthKit session","credentialScope":"server WorkOS credentials; exact grants and rotation evidence are not captured","requestSchema":"GET /callback?code=<string>&state=<string> plus the state-bound PKCE cookie containing AuthKit StateSchema { nonce: string, codeVerifier: string, customState?: string, returnPathname?: string }","responseSchema":"AuthKit authenticateWithCode result { accessToken: string, refreshToken: string, user: @workos-inc/node.User, impersonator?: { email: string, reason: string \| null }, oauthTokens?: OauthTokens, authenticationMethod?: AuthenticationResponse[\"authenticationMethod\"], organizationId?: string }","timeoutPolicy":"SDK/provider defaults; not captured","retryPolicy":"fresh user-initiated sign-in only"}] |
| `security.final-traceability-field.field.audit-event` | ["AUDIT.AUTH.CALLBACK.FAILED","AUDIT.AUTH.CALLBACK.LOCAL_ACCEPTANCE_FAILED"] |
| `security.final-traceability-field.field.security-tests` | ["src/lib/auth-callback-recovery.test.ts","src/lib/auth-callback-route-contract.test.ts","src/lib/workos-redirect.test.ts","src/lib/request-id.test.ts","src/lib/signup-acceptance.test.ts","src/lib/signup-acceptance-worker.test.ts","src/lib/logger.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to AUTH.CALLBACK.COMPLETE","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | identity-security |

### `BILLING.WEBHOOK.PROCESS`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | BILLING.WEBHOOK.PROCESS |
| `security.final-traceability-field.field.product-area` | Billing |
| `security.final-traceability-field.field.route` | ["/api/webhooks/stripe"] |
| `security.final-traceability-field.field.user-action` | Authenticate, deduplicate and process a Stripe webhook |
| `security.final-traceability-field.field.frontend-source` | [] |
| `security.final-traceability-field.field.request` | {"contentType":"Stripe webhook payload","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS webhook","method":"POST","pathOrProcedure":"/api/webhooks/stripe","credentialMode":"stripe-signature header","requiredHeaders":["stripe-signature"],"csrfControl":"Provider signature on raw body; browser CSRF token not applicable","corsPolicy":"server-to-server; no browser CORS dependency"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/api/webhooks/stripe/route.ts","src/lib/billing/stripe-webhooks.ts"],"handlers":["POST","ingestStripeWebhook","verifyStripeWebhook","reduceStripeWebhook"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"required","authenticationFunction":"verifyStripeWebhook","sessionValidationFunction":"not verified"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"POLICY.WEBHOOK.STRIPE_SIGNATURE","object":"not verified","property":"not verified","requiredPermissions":["valid Stripe webhook signature"],"requiredRelationships":["provider event links to a known checkout/customer where required by event type"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"Stripe SDK event construction plus event-specific settlement guards"} |
| `security.final-traceability-field.field.service` | ingestStripeWebhook / reduceStripeWebhook |
| `security.final-traceability-field.field.database-query-ids` | ["DB.BILLING.STRIPE_WEBHOOK_EVENT.INSERT"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["WebhookEvent"] |
| `security.final-traceability-field.field.sensitive-data` | ["FINANCIAL","PERSONAL","AUDIT_SECURITY"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [{"circuitBreakerPolicy":"not verified","webhookFollowUp":"event reducer may update local billing and entitlements","provider":"Stripe","operation":"construct and validate signed webhook event","credentialScope":"webhook endpoint secret","requestSchema":"raw bytes plus stripe-signature","responseSchema":"Stripe.Event","timeoutPolicy":"not captured","retryPolicy":"provider delivery retry with local deduplication"}] |
| `security.final-traceability-field.field.audit-event` | ["AUDIT.BILLING.WEBHOOK.RECEIVED"] |
| `security.final-traceability-field.field.security-tests` | ["src/lib/billing/stripe-readiness.test.ts","src/lib/billing/stripe-webhook-settlement.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to BILLING.WEBHOOK.PROCESS","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | billing-security |

### `PULSE.CONVERSATION.BLOCK`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | PULSE.CONVERSATION.BLOCK |
| `security.final-traceability-field.field.product-area` | Pulse |
| `security.final-traceability-field.field.route` | ["/messages/[id]","/api/conversations/[id]/block"] |
| `security.final-traceability-field.field.user-action` | Block a conversation participant and revoke realtime access |
| `security.final-traceability-field.field.frontend-source` | ["src/app/messages/[id]/page.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"server-action form data or route parameters","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"Next.js server action or HTTPS API","method":"POST","pathOrProcedure":"blockConversation / /api/conversations/[id]/block","credentialMode":"authenticated server session","requiredHeaders":[],"csrfControl":"framework server-action origin control not independently captured; API route CSRF control not verified","corsPolicy":"same-origin expected; not verified"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/actions.ts","src/app/api/conversations/[id]/block/route.ts","src/lib/conversation-service.ts","src/lib/realtime-service.ts"],"handlers":["blockConversation","POST","setConversationBlock","revokeConversationRealtimeGrants"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"required","authenticationFunction":"requireCurrentUserProfile","sessionValidationFunction":"getCurrentUser via requireCurrentUserProfile; details not captured in this trace seed"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"POLICY.PULSE.CONVERSATION.PARTICIPANT","object":"POLICY.PULSE.CONVERSATION.PARTICIPANT","property":"Only blockedById/blockedAt and UserBlock relation are set from server-derived identity","requiredPermissions":["conversation participant"],"requiredRelationships":["participant A or participant B"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"No explicit identifier schema; database object lookup is the current validation boundary"} |
| `security.final-traceability-field.field.service` | setConversationBlock |
| `security.final-traceability-field.field.database-query-ids` | ["DB.PULSE.CONVERSATION.ACCESS.SELECT","DB.PULSE.CONVERSATION.BLOCK.UPDATE","DB.PULSE.USER_BLOCK.UPSERT","DB.PULSE.REALTIME_GRANT.REVOKE"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime","service_role"] |
| `security.final-traceability-field.field.tables` | ["Conversation","UserBlock","giq_realtime_topic_grants"] |
| `security.final-traceability-field.field.sensitive-data` | ["PRIVATE_COMMUNICATION","PERSONAL","AUDIT_SECURITY"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [{"circuitBreakerPolicy":"not verified","webhookFollowUp":"not verified","provider":"Supabase Realtime","operation":"revoke opaque conversation topic grants for both profiles","credentialScope":"server administrative client; exact database grants not captured","requestSchema":"requested_profile_ids[], requested_topics[]","responseSchema":"Supabase RPC error envelope","timeoutPolicy":"not captured","retryPolicy":"caller may retry block; UserBlock upsert is duplicate-safe"}] |
| `security.final-traceability-field.field.audit-event` | ["AUDIT.PULSE.CONVERSATION.BLOCK"] |
| `security.final-traceability-field.field.security-tests` | ["src/lib/realtime-authorization.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to PULSE.CONVERSATION.BLOCK","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | community-security |

### `MEDIA.ASSET.READ`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | MEDIA.ASSET.READ |
| `security.final-traceability-field.field.product-area` | Media |
| `security.final-traceability-field.field.route` | ["/api/media/[id]"] |
| `security.final-traceability-field.field.user-action` | Read owned media processing status |
| `security.final-traceability-field.field.frontend-source` | ["src/components/profile-media-status.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"not verified","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS","method":"GET","pathOrProcedure":"/api/media/[id]","credentialMode":"authenticated server session","requiredHeaders":[],"csrfControl":"not applicable to read","corsPolicy":"same-origin expected; not verified"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/api/media/[id]/route.ts","src/lib/media-service.ts"],"handlers":["GET","getMediaStatusForCurrentUser"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"required","authenticationFunction":"requireCurrentUserProfile","sessionValidationFunction":"not verified"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"POLICY.MEDIA.UPLOADER","object":"POLICY.MEDIA.UPLOADER","property":"not verified","requiredPermissions":["media uploader ownership"],"requiredRelationships":["MediaAsset.uploaderId equals current database user ID"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"No explicit media ID schema; the owner-bound database lookup is the current boundary"} |
| `security.final-traceability-field.field.service` | getMediaStatusForCurrentUser |
| `security.final-traceability-field.field.database-query-ids` | ["DB.MEDIA.ASSET.STATUS.SELECT"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["MediaAsset"] |
| `security.final-traceability-field.field.sensitive-data` | ["USER_MEDIA","PERSONAL"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["src/lib/media-service.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to MEDIA.ASSET.READ","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | media-security |

### `MEDIA.ASSET.DELETE`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | MEDIA.ASSET.DELETE |
| `security.final-traceability-field.field.product-area` | Media |
| `security.final-traceability-field.field.route` | ["/api/media/[id]"] |
| `security.final-traceability-field.field.user-action` | Delete an owned media asset |
| `security.final-traceability-field.field.frontend-source` | ["src/components/profile-media-status.tsx","src/components/media-attachment-fields.tsx","src/components/feed-post-card.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"not verified","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS","method":"DELETE","pathOrProcedure":"/api/media/[id]","credentialMode":"authenticated server session","requiredHeaders":[],"csrfControl":"not explicitly captured","corsPolicy":"same-origin expected; not verified"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/api/media/[id]/route.ts","src/lib/media-service.ts"],"handlers":["DELETE","deleteMediaForCurrentUser"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"required","authenticationFunction":"requireCurrentUserProfile","sessionValidationFunction":"not verified"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"POLICY.MEDIA.UPLOADER","object":"POLICY.MEDIA.UPLOADER","property":"Only server-generated deletedAt and related cleanup mutations are written","requiredPermissions":["media uploader ownership"],"requiredRelationships":["MediaAsset.uploaderId equals current database user ID"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"No explicit media ID schema; the owner-bound database lookup is the current boundary"} |
| `security.final-traceability-field.field.service` | deleteMediaForCurrentUser |
| `security.final-traceability-field.field.database-query-ids` | ["DB.MEDIA.ASSET.DELETE.TOMBSTONE"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["MediaAsset"] |
| `security.final-traceability-field.field.sensitive-data` | ["USER_MEDIA","PERSONAL","AUDIT_SECURITY"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [{"circuitBreakerPolicy":"not verified","webhookFollowUp":"not verified","provider":"Supabase Storage","operation":"remove original and derived object paths","credentialScope":"server administrative storage client; exact scope not captured","requestSchema":"validated bucket plus server-stored/generated object paths","responseSchema":"Supabase storage removal result","timeoutPolicy":"not captured","retryPolicy":"failure is logged after the database tombstone; durable retry workflow not captured"}] |
| `security.final-traceability-field.field.audit-event` | ["AUDIT.MEDIA.DELETE"] |
| `security.final-traceability-field.field.security-tests` | ["src/lib/media-service.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to MEDIA.ASSET.DELETE","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | media-security |

### `DESIGN_LAB.SCREEN.REVIEW`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | DESIGN_LAB.SCREEN.REVIEW |
| `security.final-traceability-field.field.product-area` | Design Lab |
| `security.final-traceability-field.field.route` | ["/design-lab"] |
| `security.final-traceability-field.field.user-action` | Review a registered screen and its audit checklist |
| `security.final-traceability-field.field.frontend-source` | ["src/components/demo-experience-screen-map.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"not verified","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS server-rendered page","method":"GET","pathOrProcedure":"/design-lab","credentialMode":"AuthKit cookie in the production application; none for local or explicitly isolated demo review","requiredHeaders":[],"csrfControl":"not applicable to read-only page","corsPolicy":"same-origin page"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/design-lab/page.tsx","src/lib/design-lab-access.ts","src/lib/design-lab-access-policy.ts"],"handlers":["DesignLabPage","requireDesignLabReviewer","resolveDesignLabAccessDecision"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"optional","authenticationFunction":"requireDesignLabReviewer -> requireAdminProfile when required","sessionValidationFunction":"not verified"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"POLICY.DESIGN_LAB.PRODUCTION_FLAG","object":"not verified","property":"not verified","requiredPermissions":[],"requiredRelationships":[]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"DesignLabSearchParams { area?: string \| string[]; route?: string \| string[] }; resolveDesignLabArea allowlists area and firstValue selects the first route value"} |
| `security.final-traceability-field.field.service` | DemoExperienceScreenMap |
| `security.final-traceability-field.field.database-query-ids` | [] |
| `security.final-traceability-field.field.database-role` | [] |
| `security.final-traceability-field.field.tables` | [] |
| `security.final-traceability-field.field.sensitive-data` | ["INTERNAL"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["src/components/design-lab-route-safety.test.ts","src/lib/demo-production-isolation.test.ts","src/components/design-lab-release-gate.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to DESIGN_LAB.SCREEN.REVIEW","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | design-lab-security |

### `ACCOUNT.DELETION.EXECUTE`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | ACCOUNT.DELETION.EXECUTE |
| `security.final-traceability-field.field.product-area` | Account |
| `security.final-traceability-field.field.route` | ["/account","/api/users/me/delete","/api/internal/account-deletion"] |
| `security.final-traceability-field.field.user-action` | Request and finalize account deletion |
| `security.final-traceability-field.field.frontend-source` | ["src/app/account/page.tsx","src/app/actions.ts"] |
| `security.final-traceability-field.field.request` | {"contentType":"server-action form submission or JSON deletion confirmation","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"Next.js server action and HTTPS internal maintenance request","method":"POST","pathOrProcedure":"src/app/actions.ts#requestAccountDeletion or /api/users/me/delete; later /api/internal/account-deletion","credentialMode":"authenticated application session for request; configured internal secret for maintenance","requiredHeaders":["X-Internal-Secret or Authorization bearer for the internal maintenance entry"],"csrfControl":"Next.js server-action origin control is not independently verified; the JSON route has no independent CSRF evidence","corsPolicy":"same-origin request expected; internal entry is server-to-server"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/actions.ts","src/app/api/users/me/delete/route.ts","src/app/api/internal/account-deletion/route.ts","src/lib/account-service.ts","src/lib/internal-auth.ts"],"handlers":["requestAccountDeletion server action","POST /api/users/me/delete","POST /api/internal/account-deletion","requestAccountDeletion service","runAccountDeletionMaintenance"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"required","authenticationFunction":"requireCurrentUserProfile / requireInternalRequest","sessionValidationFunction":"requireCurrentUserProfile; WorkOS session revocation after request is not implemented"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"POLICY.ACCOUNT.DELETION.SELF_REQUEST and POLICY.ACCOUNT.DELETION.INTERNAL_MAINTENANCE","object":"POLICY.ACCOUNT.DELETION.SELF_REQUEST","property":"server-derived target IDs, fixed tombstone fields and validated storage bucket/prefix jobs","requiredPermissions":["current-user self-service request","valid internal secret for maintenance execution"],"requiredRelationships":["request target is the current database user","finalization candidate is banned and past the 30-day grace cutoff"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"deletionRequestSchema for the JSON route; no explicit server-action input schema; internal route has no body"} |
| `security.final-traceability-field.field.service` | requestAccountDeletion / runAccountDeletionMaintenance |
| `security.final-traceability-field.field.database-query-ids` | ["DB.ACCOUNT.DELETION.REQUEST.TRANSACTION","DB.ACCOUNT.DELETION.PENDING.SELECT","DB.ACCOUNT.DELETION.FINALIZE.TRANSACTION","DB.ACCOUNT.DELETION.STORAGE_JOBS.PROCESS"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["Profile","User","AuditLog","Message","Post","Thread","Listing","SocialActor","DeletionJob","MediaAsset","MemoryEntry","ConversationContext","AgentRun"] |
| `security.final-traceability-field.field.sensitive-data` | ["PERSONAL","AUTHENTICATION","FINANCIAL","PRIVATE_COMMUNICATION","USER_MEDIA","AUDIT_SECURITY"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [{"queueOrScheduler":"Cloud Scheduler/internal maintenance route or operator script","jobType":"account deletion finalization and storage deletion","payloadSchema":"empty invocation; candidates selected by server time and database state","workerIdentity":"configured internal secret; cloud execution identity not captured","retryPolicy":"stale processing storage leases are reclaimable after 15 minutes; failed jobs are not automatically rescheduled","idempotencyKey":"DeletionJob ID claim; no candidate-level finalization idempotency key"}] |
| `security.final-traceability-field.field.external-effects` | [{"circuitBreakerPolicy":"not verified","webhookFollowUp":"not verified","provider":"Supabase Storage","operation":"list and remove validated user-prefix objects from public and private user-media buckets","credentialScope":"server Supabase storage client; exact credential role not captured","requestSchema":"validated bucket plus users/{server-derived userId} prefix and at most 500 paths","responseSchema":"list result and remove error envelope","timeoutPolicy":"not captured","retryPolicy":"incomplete 500-object batches return the job to pending; failed jobs remain failed"}] |
| `security.final-traceability-field.field.audit-event` | ["AUDIT.ACCOUNT.DELETION.REQUESTED","AUDIT.ACCOUNT.DELETION.FINALIZED","AUDIT.ACCOUNT.DELETION.STORAGE"] |
| `security.final-traceability-field.field.security-tests` | ["src/lib/account-deletion.test.ts","scripts/check-account-deletion-pending-select-postgres.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to ACCOUNT.DELETION.EXECUTE","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | privacy-security |

### `ACCOUNT.DATA_EXPORT.DOWNLOAD`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | ACCOUNT.DATA_EXPORT.DOWNLOAD |
| `security.final-traceability-field.field.product-area` | Account |
| `security.final-traceability-field.field.route` | ["/account","/api/users/me/export"] |
| `security.final-traceability-field.field.user-action` | Download a bounded export of the current user's data |
| `security.final-traceability-field.field.frontend-source` | ["src/components/site-header.tsx","src/app/account/page.tsx","src/components/user-data-export-form.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"application/x-www-form-urlencoded request; application/json attachment response","maximumRequestBytes":0,"timeoutMilliseconds":30000,"protocol":"HTTPS","method":"POST","pathOrProcedure":"/api/users/me/export","credentialMode":"authenticated application session","requiredHeaders":[],"csrfControl":"same-origin POST form; global proxy rejects cross-origin browser mutations and the handler rejects cross-site fetch metadata","corsPolicy":"same-origin form submission; no cross-origin mutation allowance"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/api/users/me/export/route.ts","src/lib/user-export-service.ts","src/lib/user-export-policy.ts","src/lib/account-service.ts"],"handlers":["POST","privateJson","readUserExportData","recordUserExportCompletion"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"required","authenticationFunction":"requireCurrentUserProfile","sessionValidationFunction":"getCurrentUser via requireCurrentUserProfile; details not captured in this trace"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"POLICY.ACCOUNT.DATA_EXPORT.SELF","object":"POLICY.ACCOUNT.DATA_EXPORT.SELF","property":"explicit service projections, safe media columns and assertUserExportDto forbidden-field denylist","requiredPermissions":["current user may export only their own data"],"requiredRelationships":["every root query is bound to current.dbUserId or current.profileId"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"empty form submission with no user-supplied object ID"} |
| `security.final-traceability-field.field.service` | readUserExportData plus route-local DTO assembly and user-export-policy guards |
| `security.final-traceability-field.field.database-query-ids` | ["DB.ACCOUNT.DATA_EXPORT.READ","DB.ACCOUNT.DATA_EXPORT.AUDIT.INSERT","DB.ACCOUNT.DATA_EXPORT.ARTIFACT.INSERT"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["User","Profile","DogOwnership","Dog","Thread","ForumCategory","Post","Listing","ListingMedia","MediaAsset","Conversation","Message","MessageMedia","MemoryEntry","AgentRun","AuditLog","ExportArtifact"] |
| `security.final-traceability-field.field.sensitive-data` | ["PERSONAL","PRIVATE_COMMUNICATION","USER_MEDIA","AUDIT_SECURITY"] |
| `security.final-traceability-field.field.cache-effects` | [{"ttlSeconds":null,"operation":"disable browser/shared response caching","keyShape":"none","includesSecurityContext":true,"invalidationTriggers":["Cache-Control: private, no-store on success and handled failures"]}] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [] |
| `security.final-traceability-field.field.audit-event` | ["AUDIT.ACCOUNT.DATA_EXPORT.DOWNLOADED"] |
| `security.final-traceability-field.field.security-tests` | ["src/lib/user-export-policy.test.ts","src/app/api/users/me/export/route.test.ts","scripts/check-rls-policies.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to ACCOUNT.DATA_EXPORT.DOWNLOAD","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | privacy-security |

### `PUBLIC.HOME.READ`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | PUBLIC.HOME.READ |
| `security.final-traceability-field.field.product-area` | Public website |
| `security.final-traceability-field.field.route` | ["/"] |
| `security.final-traceability-field.field.user-action` | Open the public homepage and read today's race summary |
| `security.final-traceability-field.field.frontend-source` | ["src/app/page.tsx","src/components/meeting-card.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"text/html","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS Next.js server-component navigation","method":"GET","pathOrProcedure":"/","credentialMode":"No credential required; incidental cookies are not used for authorization","requiredHeaders":[],"csrfControl":"Not applicable to a read-only navigation","corsPolicy":"Browser document navigation; no cross-origin data API is exposed by this page"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/page.tsx","src/lib/queries.ts"],"handlers":["HomePage","TodaysRacesSection","getTodaysMeetings"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"public","authenticationFunction":"none (public route)","sessionValidationFunction":"not applicable (public route)"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"Public racing reference-data read; no account entitlement is required.","object":"Only racing rows inside the calculated current race-day window are requested.","property":"The query projects racing reference fields and does not request account data.","requiredPermissions":[],"requiredRelationships":[]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"No body; fixed / route and server-calculated race-day window."} |
| `security.final-traceability-field.field.service` | getTodaysMeetings |
| `security.final-traceability-field.field.database-query-ids` | ["DB.PUBLIC.HOME.RACE_MEETINGS.READ_BUNDLE"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["Meeting","Track","Race","Runner","RaceVideo"] |
| `security.final-traceability-field.field.sensitive-data` | ["Public product content","Public racing reference data"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["security/mandatory-public-racing-trace-evidence.test.ts","src/components/screen-contracts/public-racing-user-stories.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to PUBLIC.HOME.READ","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | public-racing-platform |

### `SUPPORT.TICKET.CREATE`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | SUPPORT.TICKET.CREATE |
| `security.final-traceability-field.field.product-area` | Member support |
| `security.final-traceability-field.field.route` | ["/contact","src/app/actions.ts#createSupportTicket"] |
| `security.final-traceability-field.field.user-action` | Submit an authenticated support ticket |
| `security.final-traceability-field.field.frontend-source` | ["src/app/contact/page.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"Next Server Action form encoding","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS Next.js Server Action","method":"POST","pathOrProcedure":"src/app/actions.ts#createSupportTicket","credentialMode":"WorkOS AuthKit session cookie resolved server-side","requiredHeaders":[],"csrfControl":"Next Server Action origin/host enforcement; deployed framework parity is not tested in this batch","corsPolicy":"Same-origin form action"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/contact/page.tsx","src/app/actions.ts","src/lib/auth.ts","src/lib/db-context.ts"],"handlers":["createSupportTicket"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"required","authenticationFunction":"requireCurrentUserProfile","sessionValidationFunction":"WorkOS withAuth inside requireCurrentUserProfile"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"Only a caller with a current local profile reaches ticket creation.","object":"Both inserted userId values are server-bound to current.dbUserId.","property":"category is allowlisted and body is bounded by supportTicketSchema; the body is sanitized by cleanText before persistence.","requiredPermissions":["authenticated account with a local profile"],"requiredRelationships":["created ticket userId equals current.dbUserId"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":["native required category","native body minLength=20 maxLength=5000"],"server":"supportTicketSchema: category=general\|billing\|technical\|feedback; body=trimmed string 20..5000"} |
| `security.final-traceability-field.field.service` | createSupportTicket |
| `security.final-traceability-field.field.database-query-ids` | ["DB.SUPPORT.TICKET.CREATE.TRANSACTION"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["SupportTicket","SupportMessage"] |
| `security.final-traceability-field.field.sensitive-data` | ["Account identifier","Support message content","Potential PII"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["security/mandatory-public-racing-trace-evidence.test.ts","src/components/screen-contracts/screen-permission-evidence.test.ts","src/components/screen-contracts/production-screen-member-support-interactions.test.ts","scripts/check-rls-policies.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to SUPPORT.TICKET.CREATE","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | member-support-platform |

### `AUTH.SIGN_IN.START`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | AUTH.SIGN_IN.START |
| `security.final-traceability-field.field.product-area` | Authentication |
| `security.final-traceability-field.field.route` | ["/sign-in"] |
| `security.final-traceability-field.field.user-action` | Start WorkOS hosted sign-in and preserve a safe internal return path |
| `security.final-traceability-field.field.frontend-source` | ["src/components/site-header.tsx","src/app/auth/error/page.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"redirect response","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS redirect to WorkOS AuthKit hosted UI","method":"GET","pathOrProcedure":"/sign-in?returnTo&plan&interval","credentialMode":"No existing session required; AuthKit owns provider state/cookies","requiredHeaders":[],"csrfControl":"Read-only initiation; callback state verification is delegated to AuthKit","corsPolicy":"Browser navigation; return destination must pass the internal-path allowlist"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/sign-in/route.ts","src/lib/workos-redirect.ts"],"handlers":["GET","resolveWorkosReturnTo","resolveWorkosRedirectUri"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"public","authenticationFunction":"WorkOS getSignInUrl initiation (no prior session required)","sessionValidationFunction":"not applicable until /callback"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"Public sign-in initiation only; no authenticated operation occurs on this route.","object":"No application object is read or mutated.","property":"returnTo is restricted to a same-origin internal path; plan and interval are allowlisted.","requiredPermissions":[],"requiredRelationships":[]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"resolveWorkosReturnTo and resolveWorkosRedirectUri allowlists"} |
| `security.final-traceability-field.field.service` | WorkOS AuthKit getSignInUrl |
| `security.final-traceability-field.field.database-query-ids` | [] |
| `security.final-traceability-field.field.database-role` | [] |
| `security.final-traceability-field.field.tables` | [] |
| `security.final-traceability-field.field.sensitive-data` | ["Authentication navigation metadata"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [{"circuitBreakerPolicy":"No application circuit breaker","webhookFollowUp":"Authentication resumes through /callback, covered by AUTH.CALLBACK.COMPLETE","provider":"WorkOS AuthKit","operation":"Generate and redirect to hosted sign-in URL","credentialScope":"Server-held WorkOS client/configuration; exact provider scope is not captured","requestSchema":"{ redirectUri?: validated callback URI, returnTo: validated internal path }","responseSchema":"Hosted sign-in URL string","timeoutPolicy":"SDK URL-generation/provider timing is not independently captured","retryPolicy":"No automatic application retry"}] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["security/mandatory-public-racing-trace-evidence.test.ts","src/lib/workos-redirect.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to AUTH.SIGN_IN.START","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | identity-platform |

### `ACCOUNT.PROTECTED.SIGNED_OUT_DENY`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | ACCOUNT.PROTECTED.SIGNED_OUT_DENY |
| `security.final-traceability-field.field.product-area` | Account security |
| `security.final-traceability-field.field.route` | ["/account/notifications"] |
| `security.final-traceability-field.field.user-action` | Deny a signed-out attempt to open a protected account route |
| `security.final-traceability-field.field.frontend-source` | ["src/app/account/notifications/page.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"text/html redirect response","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS Next.js server-component navigation","method":"GET","pathOrProcedure":"/account/notifications","credentialMode":"WorkOS AuthKit session cookie","requiredHeaders":[],"csrfControl":"Not applicable to the denied read-only navigation","corsPolicy":"Browser document navigation"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/account/notifications/page.tsx","src/lib/auth.ts"],"handlers":["AccountNotificationsPage","requireNotificationsProfile","requireCurrentUserProfile"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"required","authenticationFunction":"requireCurrentUserProfile","sessionValidationFunction":"WorkOS withAuth"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"A missing session fails closed before account-scoped notification or marketing-preference reads.","object":"No protected object query is executed on the signed-out branch.","property":"No account fields are returned on the signed-out branch.","requiredPermissions":["valid WorkOS session and local profile"],"requiredRelationships":["notification and preference reads belong to current.dbUserId"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"Fixed protected route; no body or user-controlled object identifier."} |
| `security.final-traceability-field.field.service` | requireNotificationsProfile |
| `security.final-traceability-field.field.database-query-ids` | [] |
| `security.final-traceability-field.field.database-role` | [] |
| `security.final-traceability-field.field.tables` | [] |
| `security.final-traceability-field.field.sensitive-data` | ["Authentication state"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [{"circuitBreakerPolicy":"No application circuit breaker","webhookFollowUp":"None","provider":"WorkOS AuthKit","operation":"Resolve the optional current session with withAuth","credentialScope":"Session cookie verification; provider implementation details not independently captured","requestSchema":"Incoming request session cookies","responseSchema":"{ user } or no user","timeoutPolicy":"AuthKit runtime timeout not captured","retryPolicy":"No application retry"}] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["security/mandatory-public-racing-trace-evidence.test.ts","src/components/screen-contracts/production-screen-admin-access-state-evidence.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to ACCOUNT.PROTECTED.SIGNED_OUT_DENY","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | identity-platform |

### `RACING.RACE.SEARCH`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | RACING.RACE.SEARCH |
| `security.final-traceability-field.field.product-area` | Racing intelligence |
| `security.final-traceability-field.field.route` | ["/races?q&date&state&status&sort"] |
| `security.final-traceability-field.field.user-action` | Search and filter public racecards |
| `security.final-traceability-field.field.frontend-source` | ["src/app/races/page.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"text/html","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS Next.js server-component navigation","method":"GET","pathOrProcedure":"/races?q&date&state&status&sort","credentialMode":"No credential required; a session does not expand the public projection","requiredHeaders":[],"csrfControl":"Not applicable to a read-only GET","corsPolicy":"Same-origin browser navigation"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/races/page.tsx","src/lib/queries.ts"],"handlers":["RacesPage","getRaceExplorerData","fetchRaceExplorerData"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"optional","authenticationFunction":"none required (optional session is not consumed)","sessionValidationFunction":"not applicable to public race search"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"Public racing reference-data search with the same projection for every actor.","object":"Only race IDs returned by normalized public search/date/state/status filters are rendered.","property":"The explorer projection excludes account and raw provider payload fields.","requiredPermissions":[],"requiredRelationships":[]} |
| `security.final-traceability-field.field.validation-schema` | {"client":["native date input and server-owned normalizers"],"server":"normaliseRaceSearchParam(max80), normaliseRaceDateInput, state membership check, status allowlist, sort allowlist"} |
| `security.final-traceability-field.field.service` | getRaceExplorerData |
| `security.final-traceability-field.field.database-query-ids` | ["DB.RACING.RACE.SEARCH.READ_BUNDLE"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["Track","Meeting","Race","Runner","Result","Dog","DogProfileForm","RaceVideo"] |
| `security.final-traceability-field.field.sensitive-data` | ["Public racing reference data","Public search terms"] |
| `security.final-traceability-field.field.cache-effects` | [{"ttlSeconds":60,"operation":"process-local metadata caches","keyShape":"race states \| dataset stats \| recent race dates","includesSecurityContext":false,"invalidationTriggers":["TTL expiry","process restart"]}] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["security/mandatory-public-racing-trace-evidence.test.ts","scripts/check-race-search-postgres.test.ts","src/lib/queries.test.ts","src/components/search-filter-controls.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to RACING.RACE.SEARCH","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | racing-data-platform |

### `RACING.RACE.OPEN`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | RACING.RACE.OPEN |
| `security.final-traceability-field.field.product-area` | Racing intelligence |
| `security.final-traceability-field.field.route` | ["/races/[id]"] |
| `security.final-traceability-field.field.user-action` | Open a public race detail with runners, results and safe replay resolution |
| `security.final-traceability-field.field.frontend-source` | ["src/app/races/[id]/page.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"text/html","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS Next.js server-component navigation","method":"GET","pathOrProcedure":"/races/[id]","credentialMode":"No credential required","requiredHeaders":[],"csrfControl":"Not applicable to a read-only GET","corsPolicy":"Same-origin document navigation; external replay pages/streams are server-resolved and constrained"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/races/[id]/page.tsx","src/lib/queries.ts","src/lib/live/race-replay.ts","src/lib/live/thedogs-replay.ts","src/lib/live/replay-proxy.ts"],"handlers":["RacePage","getRaceById","getPreviousRaceVideoRunners","resolveRaceVideoReplay","resolveProviderRaceReplay","proxiedStreamPath"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"optional","authenticationFunction":"none required (public race detail)","sessionValidationFunction":"not applicable"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"Public racing reference-data detail with no account entitlement.","object":"The dynamic route ID is bound to getRaceById; a missing race returns not-found.","property":"The page renders selected public racing/replay fields and never returns provider raw JSON.","requiredPermissions":[],"requiredRelationships":[]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"Prisma unique race id lookup; no separate path-format schema is implemented."} |
| `security.final-traceability-field.field.service` | getRaceById plus replay resolvers |
| `security.final-traceability-field.field.database-query-ids` | ["DB.RACING.RACE.OPEN.DETAIL_BUNDLE"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["Race","Meeting","Track","Runner","Dog","Trainer","Result","FormEntry","DogProfileForm","RaceVideo"] |
| `security.final-traceability-field.field.sensitive-data` | ["Public racing reference data","Public replay metadata"] |
| `security.final-traceability-field.field.cache-effects` | [{"ttlSeconds":null,"operation":"React request memoization","keyShape":"race detail by route id","includesSecurityContext":false,"invalidationTriggers":["end of server render/request"]}] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [{"circuitBreakerPolicy":"No application circuit breaker","webhookFollowUp":"None","provider":"The Dogs / Racing Queensland / approved replay providers","operation":"Resolve current and at most two previous public replay sources","credentialScope":"Public provider endpoints; no user credential","requestSchema":"provider/source identifiers and host-pinned or normalized public replay URL","responseSchema":"ResolvedRaceReplay metadata; stream becomes an encrypted same-origin capability only for allowlisted HTTPS hosts","timeoutPolicy":"15 seconds per source fetch","retryPolicy":"No automatic retry"}] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["security/mandatory-public-racing-trace-evidence.test.ts","scripts/check-race-detail-postgres.test.ts","src/components/screen-contracts/production-screen-public-racing-interactions.test.ts","src/lib/live/replay-proxy.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to RACING.RACE.OPEN","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | racing-data-platform |

### `RACING.DOG.OPEN`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | RACING.DOG.OPEN |
| `security.final-traceability-field.field.product-area` | Racing intelligence |
| `security.final-traceability-field.field.route` | ["/dogs/[id]"] |
| `security.final-traceability-field.field.user-action` | Open a public dog profile with form, pedigree and viewer-scoped ownership state |
| `security.final-traceability-field.field.frontend-source` | ["src/app/dogs/[id]/page.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"text/html","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS Next.js server-component navigation","method":"GET","pathOrProcedure":"/dogs/[id]","credentialMode":"Optional WorkOS session; public detail remains available signed out","requiredHeaders":[],"csrfControl":"Not applicable to the read-only page trace","corsPolicy":"Same-origin document navigation"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/dogs/[id]/page.tsx","src/lib/queries.ts","src/lib/pedigree.ts","src/lib/auth.ts"],"handlers":["DogProfilePage","getDogById","getCurrentUser","getDogPedigree","getMyDogOwnership"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"optional","authenticationFunction":"getCurrentUser (optional); requireCurrentUserProfile is reserved for the separate claim mutation","sessionValidationFunction":"WorkOS withAuth inside getCurrentUser when demo bypass is disabled"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"Public dog/racing detail; claimant-only state requires a complete current profile.","object":"The dynamic dog id is bound to getDogById; missing rows return not-found; getMyDogOwnership uses dogId+current.profileId.","property":"Only approved ownership is presented publicly; pending/rejected status is read through the current-profile compound key.","requiredPermissions":[],"requiredRelationships":["claimant-only ownership status belongs to current.profileId"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"Prisma unique dog id lookup; no separate path-format schema is implemented."} |
| `security.final-traceability-field.field.service` | getDogById, getDogPedigree and optional getMyDogOwnership |
| `security.final-traceability-field.field.database-query-ids` | ["DB.RACING.DOG.OPEN.PUBLIC_DETAIL_BUNDLE","DB.RACING.DOG.OPEN.OWNERSHIP.SELECT"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["Dog","Trainer","FormEntry","Track","DogProfileForm","Runner","Race","Meeting","Result","DogOwnership","Profile"] |
| `security.final-traceability-field.field.sensitive-data` | ["Public racing reference data","Viewer-scoped ownership status","Approved-owner display name, kennel name and state"] |
| `security.final-traceability-field.field.cache-effects` | [{"ttlSeconds":null,"operation":"React request memoization","keyShape":"dog detail/pedigree by route id","includesSecurityContext":false,"invalidationTriggers":["end of server render/request"]}] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["security/mandatory-public-racing-trace-evidence.test.ts","scripts/check-dog-public-detail-postgres.test.ts","src/components/screen-contracts/production-screen-public-racing-interactions.test.ts","scripts/check-rls-policies.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to RACING.DOG.OPEN","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | racing-data-platform |

### `RACING.TRACK.OPEN`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | RACING.TRACK.OPEN |
| `security.final-traceability-field.field.product-area` | Racing intelligence |
| `security.final-traceability-field.field.route` | ["/tracks/[id]"] |
| `security.final-traceability-field.field.user-action` | Open a public track profile with recent meetings and results |
| `security.final-traceability-field.field.frontend-source` | ["src/app/tracks/[id]/page.tsx"] |
| `security.final-traceability-field.field.request` | {"contentType":"text/html","maximumRequestBytes":null,"timeoutMilliseconds":null,"protocol":"HTTPS Next.js server-component navigation","method":"GET","pathOrProcedure":"/tracks/[id]","credentialMode":"No credential required","requiredHeaders":[],"csrfControl":"Not applicable to a read-only GET","corsPolicy":"Same-origin document navigation"} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/tracks/[id]/page.tsx","src/lib/queries.ts"],"handlers":["TrackDetailPage","getTrackById"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"optional","authenticationFunction":"none required (public track detail)","sessionValidationFunction":"not applicable"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"Public racing reference-data detail with no account entitlement.","object":"The dynamic track id is bound to getTrackById; a missing track returns not-found.","property":"The query selects public track/meeting/race/runner/dog/result fields and no account data.","requiredPermissions":[],"requiredRelationships":[]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"Prisma unique track id lookup; no separate path-format schema is implemented."} |
| `security.final-traceability-field.field.service` | getTrackById |
| `security.final-traceability-field.field.database-query-ids` | ["DB.RACING.TRACK.OPEN.DETAIL_BUNDLE"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["Track","Meeting","Race","Runner","Dog","Result"] |
| `security.final-traceability-field.field.sensitive-data` | ["Public racing reference data"] |
| `security.final-traceability-field.field.cache-effects` | [{"ttlSeconds":null,"operation":"React request memoization","keyShape":"track detail by route id","includesSecurityContext":false,"invalidationTriggers":["end of server render/request"]}] |
| `security.final-traceability-field.field.background-effects` | [] |
| `security.final-traceability-field.field.external-effects` | [] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["security/mandatory-public-racing-trace-evidence.test.ts","src/components/screen-contracts/production-screen-public-racing-interactions.test.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to RACING.TRACK.OPEN","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | racing-data-platform |

### `RACING.PROVIDER.INGEST`

| Required field | Recorded value |
|---|---|
| `security.final-traceability-field.field.trace-id` | RACING.PROVIDER.INGEST |
| `security.final-traceability-field.field.product-area` | Racing intelligence |
| `security.final-traceability-field.field.route` | ["/api/internal/live-sync?scope&days"] |
| `security.final-traceability-field.field.user-action` | Authenticate an internal racing sync, validate provider data and transactionally upsert normalized public racing records |
| `security.final-traceability-field.field.frontend-source` | [] |
| `security.final-traceability-field.field.request` | {"contentType":"empty request body; JSON response","maximumRequestBytes":null,"timeoutMilliseconds":300000,"protocol":"HTTPS server-to-server scheduled request","method":"POST","pathOrProcedure":"/api/internal/live-sync?scope=upcoming\|results\|all&days=1..31","credentialMode":"X-Internal-Secret or Authorization bearer token","requiredHeaders":["X-Internal-Secret or Authorization"],"csrfControl":"Not applicable to the server-to-server entry; the internal secret is mandatory before work starts.","corsPolicy":"No browser CORS dependency; server-to-server only."} |
| `security.final-traceability-field.field.server-handler` | {"sourceFiles":["src/app/api/internal/live-sync/route.ts","src/lib/internal-auth.ts","src/lib/scheduled-task-control.ts","src/lib/live/provider.ts","src/lib/live/sync.ts"],"handlers":["POST/runLiveSync","requireInternalRequest","executeScheduledTask","syncLiveData","getLiveProvider","upsertSystemMeetings/upsertMeetings"]} |
| `security.final-traceability-field.field.authentication` | {"mode":"required","authenticationFunction":"requireInternalRequest","sessionValidationFunction":"constant-time comparison against configured internal scheduling secrets"} |
| `security.final-traceability-field.field.authorization-policy` | {"function":"Only a request presenting one configured internal secret may select a provider or enter the scheduler/database path.","object":"No client object identity is accepted; provider/natural keys resolve each normalized racing object server-side.","property":"Provider adapters validate/normalize response fields, sync stamps sourceProvider and writes explicit normalized columns.","requiredPermissions":["valid configured internal scheduling secret"],"requiredRelationships":["provider-derived records retain the server-selected sourceProvider identity","database writes run only with transaction-local app.system=true"]} |
| `security.final-traceability-field.field.validation-schema` | {"client":[],"server":"scope=upcoming\|results\|all (default upcoming); days is an integer 1..31 (default 7 for results, otherwise 31); no body."} |
| `security.final-traceability-field.field.service` | syncLiveData |
| `security.final-traceability-field.field.database-query-ids` | ["DB.RACING.PROVIDER.INGEST.TRANSACTION"] |
| `security.final-traceability-field.field.database-role` | ["greyhoundiq_runtime"] |
| `security.final-traceability-field.field.tables` | ["Track","Meeting","Race","RaceVideo","Dog","Trainer","Runner","Result","FormEntry"] |
| `security.final-traceability-field.field.sensitive-data` | ["Public racing reference data","Untrusted provider payload","Provider credential metadata (server-only)","Internal scheduling credential (server-only)"] |
| `security.final-traceability-field.field.cache-effects` | [] |
| `security.final-traceability-field.field.background-effects` | [{"queueOrScheduler":"Cloud Scheduler to internal live-sync route","jobType":"live-sync","payloadSchema":"scope and days query parameters only","workerIdentity":"internal-secret authenticated scheduler","retryPolicy":"Source scheduler wiring exists; exact deployed retry/backoff behavior is not verified.","idempotencyKey":"scheduled-task advisory lock plus normalized provider/natural keys"}] |
| `security.final-traceability-field.field.external-effects` | [{"circuitBreakerPolicy":"not implemented","webhookFollowUp":"not applicable","provider":"Configured greyhound racing provider adapters","operation":"fetch upcoming meetings and/or results","credentialScope":"Provider-specific server environment credentials; never accepted from the request or returned.","requestSchema":"server-bounded day window from 1 through 31","responseSchema":"adapter-specific response parsed into bounded LiveMeeting/Race/Runner/Result structures","timeoutPolicy":"provider adapters use abort timeouts covered by response-boundary tests","retryPolicy":"provider-specific bounded retry only; Topaz retry behavior is directly tested"}] |
| `security.final-traceability-field.field.audit-event` | [] |
| `security.final-traceability-field.field.security-tests` | ["security/mandatory-public-racing-trace-evidence.test.ts","src/app/api/internal/live-sync/route.test.ts","src/lib/live/provider-response-validation.test.ts","src/lib/live/topaz.test.ts","security/scheduled-task-control-evidence.test.ts","scripts/check-rls-policies.ts"] |
| `security.final-traceability-field.field.open-findings` | {"status":"unknown","value":null,"scope":"Open findings linked to RACING.PROVIDER.INGEST","reason":"No authoritative machine finding-to-trace registry exists; an empty list would falsely imply no open finding.","evidence":["docs/security/risk-register.md"]} |
| `security.final-traceability-field.field.verification-status` | Partially verified |
| `security.final-traceability-field.field.owner` | racing-data-platform |

## Release boundary

No row is `Verified`. The complete frontend-action inventory, deployed API parity, privileged-operation classification, finding-to-trace links, generated SQL/runtime roles, provider effects and production evidence remain incomplete. These are separate release blockers and are not closed by this report structure.
