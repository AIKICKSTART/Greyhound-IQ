const PRIMARY_TRACE_CHAIN_EVIDENCE = [
  "security/primary-trace-chain.ts",
  "security/primary-trace-chain.test.ts",
  "security/traces.ts",
  "security/database-query-records.ts",
  "security/final-traceability.ts",
] as const;

export const PRIMARY_TRACE_CHAIN_FIELD_BINDINGS = {
  "security.primary-objective-trace-chain.user": "user",
  "security.primary-objective-trace-chain.client": "client",
  "security.primary-objective-trace-chain.frontend-component": "frontendComponent",
  "security.primary-objective-trace-chain.event-handler": "eventHandler",
  "security.primary-objective-trace-chain.client-validation": "clientValidation",
  "security.primary-objective-trace-chain.request-builder": "requestBuilder",
  "security.primary-objective-trace-chain.network-request": "networkRequest",
  "security.primary-objective-trace-chain.edge-middleware": "edgeMiddleware",
  "security.primary-objective-trace-chain.server-entry": "serverEntry",
  "security.primary-objective-trace-chain.authentication": "authentication",
  "security.primary-objective-trace-chain.session-validation": "sessionValidation",
  "security.primary-objective-trace-chain.authorization": "authorization",
  "security.primary-objective-trace-chain.ownership": "ownership",
  "security.primary-objective-trace-chain.property-permission": "propertyPermission",
  "security.primary-objective-trace-chain.request-schema": "requestSchema",
  "security.primary-objective-trace-chain.business-validation": "businessValidation",
  "security.primary-objective-trace-chain.service": "service",
  "security.primary-objective-trace-chain.repository": "repository",
  "security.primary-objective-trace-chain.orm": "orm",
  "security.primary-objective-trace-chain.normalized-query": "normalizedQuery",
  "security.primary-objective-trace-chain.database-role": "databaseRole",
  "security.primary-objective-trace-chain.database-object": "databaseObject",
  "security.primary-objective-trace-chain.transaction-locking": "transactionLocking",
  "security.primary-objective-trace-chain.constraints-rls": "constraintsRls",
  "security.primary-objective-trace-chain.cache": "cache",
  "security.primary-objective-trace-chain.side-effect": "sideEffect",
  "security.primary-objective-trace-chain.audit": "audit",
  "security.primary-objective-trace-chain.application-response": "applicationResponse",
  "security.primary-objective-trace-chain.frontend-state": "frontendState",
  "security.primary-objective-trace-chain.user-feedback": "userFeedback",
} as const;

export const PRIMARY_TRACE_CHAIN_MASTER_EVIDENCE = Object.fromEntries(
  Object.keys(PRIMARY_TRACE_CHAIN_FIELD_BINDINGS).map((id) => [
    id,
    {
      status: "verified" as const,
      evidence: PRIMARY_TRACE_CHAIN_EVIDENCE,
    },
  ]),
);
