import { DATABASE_OPERATIONS } from "./database-operations";
import { DATABASE_QUERY_RECORDS } from "./database-query-records";
import { SECURITY_TRACES } from "./traces";

export const ACTION_TRACE_SECTION_FIELDS = {
  frontend: [
    "route",
    "component",
    "buttonLinkFormOrEvent",
    "accessibleLabel",
    "eventHandler",
    "clientHook",
    "clientValidation",
    "hiddenValues",
    "browserStorageUsed",
    "queryParametersUsed",
    "headersGenerated",
    "conditionalRendering",
    "frontendSecurityDecision",
  ],
  request: [
    "httpMethodOrProcedureType",
    "exactRoutePattern",
    "contentType",
    "bodySchema",
    "queryStringSchema",
    "pathParameterSchema",
    "requiredHeaders",
    "authenticationMechanism",
    "csrfMechanism",
    "originValidation",
    "requestSizeLimit",
    "timeout",
    "rateLimit",
    "idempotencyKey",
    "correlationId",
    "cacheBehaviour",
  ],
  authorization: [
    "functionLevelPermission",
    "objectLevelPermission",
    "propertyLevelPermission",
    "ownershipCheck",
    "tenantOrOrganisationCheck",
    "relationshipCheck",
    "blockOrPrivacyCheck",
    "subscriptionEntitlement",
    "recordStatusRequirement",
    "allowedStateTransition",
    "administratorModeratorDistinction",
    "denialResponse",
    "auditEvent",
    "trustedServerValuesAndSources",
  ],
  sideEffect: [
    "cacheWriteOrInvalidation",
    "queueEvent",
    "email",
    "notification",
    "fileOperation",
    "searchIndexing",
    "analyticsEvent",
    "auditEvent",
    "paymentProviderOperation",
    "aiProviderOperation",
    "otherExternalApi",
    "retryBehaviour",
    "duplicateEventBehaviour",
    "outOfOrderEventBehaviour",
  ],
  userContext: [
    "actor",
    "authenticationState",
    "role",
    "organisationOrTenant",
    "ownershipRelationship",
    "subscriptionTier",
    "featureEntitlements",
    "privacyRelationship",
    "blockRelationship",
    "requiredObjectState",
    "entryRoute",
    "previousRoute",
    "intendedOutcome",
  ],
  response: [
    "httpOrProcedureStatus",
    "responseSchema",
    "explicitReturnedFields",
    "redactedFields",
    "cacheHeaders",
    "browserStorageEffects",
    "frontendStateUpdate",
    "optimisticUpdate",
    "reconciliationBehaviour",
    "successMessage",
    "recoverableFailureMessage",
    "focusBehaviour",
    "retryAction",
  ],
  evidence: [
    "relevantTestNames",
    "configurationEvidence",
    "schemaEvidence",
    "authorisationPolicyEvidence",
    "databasePolicyEvidence",
    "queryPlanEvidence",
    "sanitisedAuditLogSample",
    "securityScannerEvidence",
    "manualVerificationNotes",
    "remainingUncertainty",
  ],
  serverEntry: [
    "serverFile",
    "handler",
    "middlewareExecutionOrder",
    "authenticationFunction",
    "sessionValidation",
    "tokenValidation",
    "tenantResolution",
    "featureGateEvaluation",
    "requestParsing",
    "requestValidation",
    "authorisationFunction",
    "businessServiceCalled",
  ],
} as const;

const NOT_SEPARATELY_CAPTURED = "not separately captured";

export const ACTION_TRACE_RECORDS = SECURITY_TRACES.map((trace) => {
  const queries = DATABASE_QUERY_RECORDS.filter(
    (query) => query.traceId === trace.traceId,
  );
  const operations = DATABASE_OPERATIONS.filter(
    (operation) => operation.traceId === trace.traceId,
  );
  const backgroundText = trace.backgroundOperations.map((operation) =>
    `${operation.jobType}: ${operation.queueOrScheduler}`,
  );
  const external = trace.externalOperations;
  const paymentExternal = external.filter((operation) =>
    /stripe|lago|payment|billing/i.test(operation.provider),
  );
  const aiExternal = external.filter((operation) =>
    /ai|model|openai|anthropic|gemini/i.test(operation.provider),
  );

  return {
    traceId: trace.traceId,
    frontend: {
      route: [...trace.routePatterns],
      component: [...trace.frontend.components],
      buttonLinkFormOrEvent: [
        ...trace.frontend.forms,
        ...trace.frontend.eventHandlers,
      ],
      accessibleLabel: NOT_SEPARATELY_CAPTURED,
      eventHandler: [...trace.frontend.eventHandlers],
      clientHook: NOT_SEPARATELY_CAPTURED,
      clientValidation: [...trace.frontend.clientValidationSchemas],
      hiddenValues: NOT_SEPARATELY_CAPTURED,
      browserStorageUsed: [...trace.frontend.sensitiveBrowserStorage],
      queryParametersUsed: NOT_SEPARATELY_CAPTURED,
      headersGenerated: NOT_SEPARATELY_CAPTURED,
      conditionalRendering: NOT_SEPARATELY_CAPTURED,
      frontendSecurityDecision:
        `Frontend checks are usability controls only; ${trace.server.authenticationFunction} and ${trace.server.authorizationPolicy} remain authoritative.`,
    },
    request: {
      httpMethodOrProcedureType: trace.transport.method ?? trace.actionType,
      exactRoutePattern: trace.transport.pathOrProcedure,
      contentType: trace.transport.contentType ?? "not verified",
      bodySchema: trace.server.requestValidationSchema,
      queryStringSchema: NOT_SEPARATELY_CAPTURED,
      pathParameterSchema: NOT_SEPARATELY_CAPTURED,
      requiredHeaders: [...trace.transport.requiredHeaders],
      authenticationMechanism: trace.server.authenticationFunction,
      csrfMechanism: trace.transport.csrfControl ?? "not verified",
      originValidation: trace.transport.corsPolicy ?? "not verified",
      requestSizeLimit: trace.transport.maximumRequestBytes ?? null,
      timeout: trace.transport.timeoutMilliseconds ?? null,
      rateLimit: trace.server.rateLimitPolicy ?? "not verified",
      idempotencyKey: trace.server.idempotencyPolicy ?? "not verified",
      correlationId: NOT_SEPARATELY_CAPTURED,
      cacheBehaviour: trace.response.cachePolicy,
    },
    authorization: {
      functionLevelPermission: trace.server.authorizationPolicy,
      objectLevelPermission:
        trace.server.objectAuthorizationPolicy ?? "not verified",
      propertyLevelPermission:
        trace.server.propertyAuthorizationPolicy ?? "not verified",
      ownershipCheck: [...trace.requiredRelationships],
      tenantOrOrganisationCheck: trace.requiredRelationships.filter((value) =>
        /tenant|organisation|organization|team|owner/i.test(value),
      ),
      relationshipCheck: [...trace.requiredRelationships],
      blockOrPrivacyCheck: trace.requiredRelationships.filter((value) =>
        /block|privacy|visibility|relationship/i.test(value),
      ),
      subscriptionEntitlement: {
        tiers: [...trace.allowedTiers],
        permissions: [...trace.requiredPermissions],
      },
      recordStatusRequirement: NOT_SEPARATELY_CAPTURED,
      allowedStateTransition: NOT_SEPARATELY_CAPTURED,
      administratorModeratorDistinction: [...trace.allowedRoles],
      denialResponse: trace.failureModes.map((failure) => ({
        condition: failure.condition,
        status: failure.externalStatus,
        message: failure.safeUserMessage,
      })),
      auditEvent: [...trace.auditEvents],
      trustedServerValuesAndSources:
        trace.server.propertyAuthorizationPolicy ?? "not verified",
    },
    sideEffect: {
      cacheWriteOrInvalidation: trace.cacheOperations.map((operation) => ({
        operation: operation.operation,
        invalidationTriggers: [...operation.invalidationTriggers],
      })),
      queueEvent: backgroundText,
      email: backgroundText.filter((value) => /email/i.test(value)),
      notification: backgroundText.filter((value) => /notification/i.test(value)),
      fileOperation: backgroundText.filter((value) => /file|media|storage/i.test(value)),
      searchIndexing: backgroundText.filter((value) => /search|index/i.test(value)),
      analyticsEvent: backgroundText.filter((value) => /analytics/i.test(value)),
      auditEvent: [...trace.auditEvents],
      paymentProviderOperation: paymentExternal.map((operation) => ({ ...operation })),
      aiProviderOperation: aiExternal.map((operation) => ({ ...operation })),
      otherExternalApi: external
        .filter(
          (operation) =>
            !paymentExternal.includes(operation) && !aiExternal.includes(operation),
        )
        .map((operation) => ({ ...operation })),
      retryBehaviour: [
        ...trace.backgroundOperations.map((operation) => operation.retryPolicy),
        ...external.map((operation) => operation.retryPolicy),
      ],
      duplicateEventBehaviour: [
        trace.server.idempotencyPolicy ?? "not verified",
        ...trace.backgroundOperations.map(
          (operation) => operation.idempotencyKey ?? "not verified",
        ),
      ],
      outOfOrderEventBehaviour: NOT_SEPARATELY_CAPTURED,
    },
    userContext: {
      actor: [...trace.actors],
      authenticationState: trace.authentication,
      role: [...trace.allowedRoles],
      organisationOrTenant: trace.requiredRelationships.filter((value) =>
        /tenant|organisation|organization|team/i.test(value),
      ),
      ownershipRelationship: trace.requiredRelationships.filter((value) =>
        /owner|member|participant|relationship/i.test(value),
      ),
      subscriptionTier: [...trace.allowedTiers],
      featureEntitlements: [
        ...trace.featureFlags,
        ...trace.requiredPermissions,
      ],
      privacyRelationship: trace.requiredRelationships.filter((value) =>
        /privacy|visibility/i.test(value),
      ),
      blockRelationship: trace.requiredRelationships.filter((value) =>
        /block/i.test(value),
      ),
      requiredObjectState: NOT_SEPARATELY_CAPTURED,
      entryRoute: [...trace.routePatterns],
      previousRoute: NOT_SEPARATELY_CAPTURED,
      intendedOutcome: trace.actionName,
    },
    response: {
      httpOrProcedureStatus: trace.response.successStatus,
      responseSchema: trace.response.responseSchema,
      explicitReturnedFields: [...trace.response.permittedFields],
      redactedFields: NOT_SEPARATELY_CAPTURED,
      cacheHeaders: trace.response.cachePolicy,
      browserStorageEffects: [...trace.frontend.sensitiveBrowserStorage],
      frontendStateUpdate: trace.response.frontendSuccessState,
      optimisticUpdate: NOT_SEPARATELY_CAPTURED,
      reconciliationBehaviour: NOT_SEPARATELY_CAPTURED,
      successMessage: trace.response.frontendSuccessState,
      recoverableFailureMessage: trace.failureModes.map(
        (failure) => failure.safeUserMessage,
      ),
      focusBehaviour: NOT_SEPARATELY_CAPTURED,
      retryAction: trace.failureModes.map((failure) => ({
        condition: failure.condition,
        permitted: failure.retryPermitted,
      })),
    },
    evidence: {
      relevantTestNames: [...trace.tests],
      configurationEvidence: [...trace.evidence],
      schemaEvidence: [
        trace.server.requestValidationSchema,
        trace.server.outputSchema,
      ],
      authorisationPolicyEvidence: [
        trace.server.authorizationPolicy,
        trace.server.objectAuthorizationPolicy ?? "not verified",
        trace.server.propertyAuthorizationPolicy ?? "not verified",
      ],
      databasePolicyEvidence: queries.flatMap((query) => query.rowLevelPolicy),
      queryPlanEvidence: operations.map(
        (operation) => operation.explainPlanEvidence ?? "not captured",
      ),
      sanitisedAuditLogSample: NOT_SEPARATELY_CAPTURED,
      securityScannerEvidence: NOT_SEPARATELY_CAPTURED,
      manualVerificationNotes: [...trace.evidence],
      remainingUncertainty: trace.evidence.filter((value) =>
        /unverified|not (?:captured|verified)|remain|missing|open/i.test(value),
      ),
    },
    serverEntry: {
      serverFile: [...trace.server.entryFiles],
      handler: [...trace.server.handlers],
      middlewareExecutionOrder: [...trace.server.middlewareOrder],
      authenticationFunction: trace.server.authenticationFunction,
      sessionValidation:
        trace.server.sessionValidationFunction ?? "not verified",
      tokenValidation: NOT_SEPARATELY_CAPTURED,
      tenantResolution: trace.requiredRelationships.filter((value) =>
        /tenant|organisation|organization|team/i.test(value),
      ),
      featureGateEvaluation: [...trace.featureFlags],
      requestParsing: {
        contentType: trace.transport.contentType ?? "not verified",
        bodySchema: trace.server.requestValidationSchema,
      },
      requestValidation: trace.server.requestValidationSchema,
      authorisationFunction: trace.server.authorizationPolicy,
      businessServiceCalled: trace.server.businessService,
    },
  };
});

export function validateActionTraceRecords(records: readonly unknown[]) {
  const failures: string[] = [];
  const traceIds = new Set<string>();

  for (const candidate of records) {
    if (!candidate || typeof candidate !== "object") {
      failures.push("record:not-an-object");
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const traceId =
      typeof record.traceId === "string" && record.traceId.trim()
        ? record.traceId
        : "record";
    for (const [section, fields] of Object.entries(ACTION_TRACE_SECTION_FIELDS)) {
      const sectionRecord = record[section];
      if (!sectionRecord || typeof sectionRecord !== "object") {
        failures.push(`${traceId}:${section}`);
        continue;
      }
      for (const field of fields) {
        const values = sectionRecord as Record<string, unknown>;
        if (!Object.hasOwn(values, field) || values[field] === undefined) {
          failures.push(`${traceId}:${section}.${field}`);
        }
      }
    }
    if (traceIds.has(traceId)) failures.push(`${traceId}:duplicate`);
    traceIds.add(traceId);
  }

  return failures;
}
