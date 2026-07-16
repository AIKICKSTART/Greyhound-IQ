const ACTION_TRACE_RECORD_EVIDENCE = [
  "security/action-trace-records.ts",
  "security/action-trace-records.test.ts",
  "security/traces.ts",
  "security/database-query-records.ts",
  "security/database-operations.ts",
] as const;

export const ACTION_TRACE_REQUEST_FIELD_BINDINGS = {
  "security.action-trace-request.field.http-method-or-procedure-type": "httpMethodOrProcedureType",
  "security.action-trace-request.field.exact-route-pattern": "exactRoutePattern",
  "security.action-trace-request.field.content-type": "contentType",
  "security.action-trace-request.field.body-schema": "bodySchema",
  "security.action-trace-request.field.query-string-schema": "queryStringSchema",
  "security.action-trace-request.field.path-parameter-schema": "pathParameterSchema",
  "security.action-trace-request.field.required-headers": "requiredHeaders",
  "security.action-trace-request.field.authentication-mechanism": "authenticationMechanism",
  "security.action-trace-request.field.csrf-mechanism": "csrfMechanism",
  "security.action-trace-request.field.origin-validation": "originValidation",
  "security.action-trace-request.field.request-size-limit": "requestSizeLimit",
  "security.action-trace-request.field.timeout": "timeout",
  "security.action-trace-request.field.rate-limit": "rateLimit",
  "security.action-trace-request.field.idempotency-key": "idempotencyKey",
  "security.action-trace-request.field.correlation-id": "correlationId",
  "security.action-trace-request.field.cache-behaviour": "cacheBehaviour",
} as const;

export const ACTION_TRACE_FRONTEND_FIELD_BINDINGS = {
  "security.action-trace-frontend.field.route": "route",
  "security.action-trace-frontend.field.component": "component",
  "security.action-trace-frontend.field.button-link-form-or-event": "buttonLinkFormOrEvent",
  "security.action-trace-frontend.field.accessible-label": "accessibleLabel",
  "security.action-trace-frontend.field.event-handler": "eventHandler",
  "security.action-trace-frontend.field.client-hook": "clientHook",
  "security.action-trace-frontend.field.client-validation": "clientValidation",
  "security.action-trace-frontend.field.hidden-values": "hiddenValues",
  "security.action-trace-frontend.field.browser-storage-used": "browserStorageUsed",
  "security.action-trace-frontend.field.query-parameters-used": "queryParametersUsed",
  "security.action-trace-frontend.field.headers-generated": "headersGenerated",
  "security.action-trace-frontend.field.conditional-rendering": "conditionalRendering",
  "security.action-trace-frontend.field.frontend-security-decision": "frontendSecurityDecision",
} as const;

export const ACTION_TRACE_SERVER_ENTRY_FIELD_BINDINGS = {
  "security.action-trace-server-entry.field.server-file": "serverFile",
  "security.action-trace-server-entry.field.handler": "handler",
  "security.action-trace-server-entry.field.middleware-execution-order": "middlewareExecutionOrder",
  "security.action-trace-server-entry.field.authentication-function": "authenticationFunction",
  "security.action-trace-server-entry.field.session-validation": "sessionValidation",
  "security.action-trace-server-entry.field.token-validation": "tokenValidation",
  "security.action-trace-server-entry.field.tenant-resolution": "tenantResolution",
  "security.action-trace-server-entry.field.feature-gate-evaluation": "featureGateEvaluation",
  "security.action-trace-server-entry.field.request-parsing": "requestParsing",
  "security.action-trace-server-entry.field.request-validation": "requestValidation",
  "security.action-trace-server-entry.field.authorisation-function": "authorisationFunction",
  "security.action-trace-server-entry.field.business-service-called": "businessServiceCalled",
} as const;

export const ACTION_TRACE_AUTHORIZATION_FIELD_BINDINGS = {
  "security.action-trace-authorization.field.function-level-permission": "functionLevelPermission",
  "security.action-trace-authorization.field.object-level-permission": "objectLevelPermission",
  "security.action-trace-authorization.field.property-level-permission": "propertyLevelPermission",
  "security.action-trace-authorization.field.ownership-check": "ownershipCheck",
  "security.action-trace-authorization.field.tenant-or-organisation-check": "tenantOrOrganisationCheck",
  "security.action-trace-authorization.field.relationship-check": "relationshipCheck",
  "security.action-trace-authorization.field.block-or-privacy-check": "blockOrPrivacyCheck",
  "security.action-trace-authorization.field.subscription-entitlement": "subscriptionEntitlement",
  "security.action-trace-authorization.field.record-status-requirement": "recordStatusRequirement",
  "security.action-trace-authorization.field.allowed-state-transition": "allowedStateTransition",
  "security.action-trace-authorization.field.administrator-moderator-distinction": "administratorModeratorDistinction",
  "security.action-trace-authorization.field.denial-response": "denialResponse",
  "security.action-trace-authorization.field.audit-event": "auditEvent",
  "security.action-trace-authorization.field.trusted-server-values-and-sources": "trustedServerValuesAndSources",
} as const;

export const ACTION_TRACE_SIDE_EFFECT_FIELD_BINDINGS = {
  "security.action-trace-side-effect.field.cache-write-or-invalidation": "cacheWriteOrInvalidation",
  "security.action-trace-side-effect.field.queue-event": "queueEvent",
  "security.action-trace-side-effect.field.email": "email",
  "security.action-trace-side-effect.field.notification": "notification",
  "security.action-trace-side-effect.field.file-operation": "fileOperation",
  "security.action-trace-side-effect.field.search-indexing": "searchIndexing",
  "security.action-trace-side-effect.field.analytics-event": "analyticsEvent",
  "security.action-trace-side-effect.field.audit-event": "auditEvent",
  "security.action-trace-side-effect.field.payment-provider-operation": "paymentProviderOperation",
  "security.action-trace-side-effect.field.ai-provider-operation": "aiProviderOperation",
  "security.action-trace-side-effect.field.other-external-api": "otherExternalApi",
  "security.action-trace-side-effect.field.retry-behaviour": "retryBehaviour",
  "security.action-trace-side-effect.field.duplicate-event-behaviour": "duplicateEventBehaviour",
  "security.action-trace-side-effect.field.out-of-order-event-behaviour": "outOfOrderEventBehaviour",
} as const;

export const ACTION_TRACE_USER_CONTEXT_FIELD_BINDINGS = {
  "security.action-trace-user-context.field.actor": "actor",
  "security.action-trace-user-context.field.authentication-state": "authenticationState",
  "security.action-trace-user-context.field.role": "role",
  "security.action-trace-user-context.field.organisation-or-tenant": "organisationOrTenant",
  "security.action-trace-user-context.field.ownership-relationship": "ownershipRelationship",
  "security.action-trace-user-context.field.subscription-tier": "subscriptionTier",
  "security.action-trace-user-context.field.feature-entitlements": "featureEntitlements",
  "security.action-trace-user-context.field.privacy-relationship": "privacyRelationship",
  "security.action-trace-user-context.field.block-relationship": "blockRelationship",
  "security.action-trace-user-context.field.required-object-state": "requiredObjectState",
  "security.action-trace-user-context.field.entry-route": "entryRoute",
  "security.action-trace-user-context.field.previous-route": "previousRoute",
  "security.action-trace-user-context.field.intended-outcome": "intendedOutcome",
} as const;

export const ACTION_TRACE_RESPONSE_FIELD_BINDINGS = {
  "security.action-trace-response.field.http-or-procedure-status": "httpOrProcedureStatus",
  "security.action-trace-response.field.response-schema": "responseSchema",
  "security.action-trace-response.field.explicit-returned-fields": "explicitReturnedFields",
  "security.action-trace-response.field.redacted-fields": "redactedFields",
  "security.action-trace-response.field.cache-headers": "cacheHeaders",
  "security.action-trace-response.field.browser-storage-effects": "browserStorageEffects",
  "security.action-trace-response.field.frontend-state-update": "frontendStateUpdate",
  "security.action-trace-response.field.optimistic-update": "optimisticUpdate",
  "security.action-trace-response.field.reconciliation-behaviour": "reconciliationBehaviour",
  "security.action-trace-response.field.success-message": "successMessage",
  "security.action-trace-response.field.recoverable-failure-message": "recoverableFailureMessage",
  "security.action-trace-response.field.focus-behaviour": "focusBehaviour",
  "security.action-trace-response.field.retry-action": "retryAction",
} as const;

export const ACTION_TRACE_EVIDENCE_FIELD_BINDINGS = {
  "security.action-trace-evidence.field.relevant-test-names": "relevantTestNames",
  "security.action-trace-evidence.field.configuration-evidence": "configurationEvidence",
  "security.action-trace-evidence.field.schema-evidence": "schemaEvidence",
  "security.action-trace-evidence.field.authorisation-policy-evidence": "authorisationPolicyEvidence",
  "security.action-trace-evidence.field.database-policy-evidence": "databasePolicyEvidence",
  "security.action-trace-evidence.field.query-plan-evidence": "queryPlanEvidence",
  "security.action-trace-evidence.field.sanitised-audit-log-sample": "sanitisedAuditLogSample",
  "security.action-trace-evidence.field.security-scanner-evidence": "securityScannerEvidence",
  "security.action-trace-evidence.field.manual-verification-notes": "manualVerificationNotes",
  "security.action-trace-evidence.field.remaining-uncertainty": "remainingUncertainty",
} as const;

export const ACTION_TRACE_RECORD_FIELD_BINDINGS = {
  frontend: ACTION_TRACE_FRONTEND_FIELD_BINDINGS,
  request: ACTION_TRACE_REQUEST_FIELD_BINDINGS,
  authorization: ACTION_TRACE_AUTHORIZATION_FIELD_BINDINGS,
  sideEffect: ACTION_TRACE_SIDE_EFFECT_FIELD_BINDINGS,
  userContext: ACTION_TRACE_USER_CONTEXT_FIELD_BINDINGS,
  response: ACTION_TRACE_RESPONSE_FIELD_BINDINGS,
  evidence: ACTION_TRACE_EVIDENCE_FIELD_BINDINGS,
  serverEntry: ACTION_TRACE_SERVER_ENTRY_FIELD_BINDINGS,
} as const;

export const ACTION_TRACE_RECORD_MASTER_EVIDENCE: Readonly<
  Record<
    string,
    { status: "verified"; evidence: typeof ACTION_TRACE_RECORD_EVIDENCE }
  >
> = {
  ...Object.fromEntries(
    Object.values(ACTION_TRACE_RECORD_FIELD_BINDINGS)
      .flatMap((bindings) => Object.keys(bindings))
      .map((id) => [
        id,
        {
          status: "verified" as const,
          evidence: ACTION_TRACE_RECORD_EVIDENCE,
        },
      ]),
  ),
  "security.action-trace-frontend.usability-control": {
    status: "verified" as const,
    evidence: ACTION_TRACE_RECORD_EVIDENCE,
  },
  "security.primary-objective-trace-evidence.frontend-not-authority": {
    status: "verified" as const,
    evidence: ACTION_TRACE_RECORD_EVIDENCE,
  },
};
