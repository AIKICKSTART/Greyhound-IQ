import { DATABASE_QUERY_RECORDS } from "./database-query-records";
import { SECURITY_TRACES } from "./traces";

export const PRIMARY_TRACE_CHAIN_FIELDS = [
  "user",
  "client",
  "frontendComponent",
  "eventHandler",
  "clientValidation",
  "requestBuilder",
  "networkRequest",
  "edgeMiddleware",
  "serverEntry",
  "authentication",
  "sessionValidation",
  "authorization",
  "ownership",
  "propertyPermission",
  "requestSchema",
  "businessValidation",
  "service",
  "repository",
  "orm",
  "normalizedQuery",
  "databaseRole",
  "databaseObject",
  "transactionLocking",
  "constraintsRls",
  "cache",
  "sideEffect",
  "audit",
  "applicationResponse",
  "frontendState",
  "userFeedback",
] as const;

export const PRIMARY_TRACE_CHAINS = SECURITY_TRACES.map((trace) => {
  const queries = DATABASE_QUERY_RECORDS.filter(
    (record) => record.traceId === trace.traceId,
  );

  return {
    traceId: trace.traceId,
    user: [...trace.actors],
    client: {
      sourceFiles: [...trace.frontend.sourceFiles],
      stateStores: [...trace.frontend.clientStateStores],
    },
    frontendComponent: [...trace.frontend.components],
    eventHandler: [...trace.frontend.eventHandlers],
    clientValidation: [...trace.frontend.clientValidationSchemas],
    requestBuilder: [...trace.frontend.forms],
    networkRequest: { ...trace.transport },
    edgeMiddleware: [...trace.server.middlewareOrder],
    serverEntry: {
      files: [...trace.server.entryFiles],
      handlers: [...trace.server.handlers],
    },
    authentication: trace.server.authenticationFunction,
    sessionValidation: trace.server.sessionValidationFunction ?? "not verified",
    authorization: trace.server.authorizationPolicy,
    ownership: trace.server.objectAuthorizationPolicy ?? "not verified",
    propertyPermission:
      trace.server.propertyAuthorizationPolicy ?? "not verified",
    requestSchema: {
      client: [...trace.frontend.clientValidationSchemas],
      server: trace.server.requestValidationSchema,
    },
    businessValidation: [...trace.requiredRelationships],
    service: trace.server.businessService,
    repository: queries.map((query) => query.repository),
    orm: queries.map((query) => ({
      driver: query.ormOrDriver,
      operation: query.ormOperation,
    })),
    normalizedQuery: queries.map((query) => query.normalisedSql),
    databaseRole: queries.map((query) => query.databaseRole),
    databaseObject: queries.flatMap((query) => [
      ...query.tables,
      ...query.views,
    ]),
    transactionLocking: queries.map((query) => ({
      transaction: query.transaction,
      isolation: query.isolation,
      locks: query.locks,
      concurrency: query.concurrencyStrategy,
    })),
    constraintsRls: queries.map((query) => ({
      constraints: query.constraints,
      rowLevelPolicies: query.rowLevelPolicy,
    })),
    cache: trace.cacheOperations.map((operation) => ({ ...operation })),
    sideEffect: [
      ...trace.backgroundOperations.map((operation) => ({
        kind: "background" as const,
        operation,
      })),
      ...trace.externalOperations.map((operation) => ({
        kind: "external" as const,
        operation,
      })),
    ],
    audit: [...trace.auditEvents],
    applicationResponse: { ...trace.response },
    frontendState: trace.response.frontendSuccessState,
    userFeedback: trace.failureModes.map((failure) => failure.safeUserMessage),
  };
});

export function validatePrimaryTraceChains(records: readonly unknown[]) {
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
    for (const field of PRIMARY_TRACE_CHAIN_FIELDS) {
      if (!Object.hasOwn(record, field) || record[field] === undefined) {
        failures.push(`${traceId}:${field}`);
      }
    }
    if (traceIds.has(traceId)) failures.push(`${traceId}:duplicate`);
    traceIds.add(traceId);
  }

  return failures;
}
