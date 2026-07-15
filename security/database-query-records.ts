import { DATABASE_OPERATIONS } from "./database-operations";
import { SECURITY_TRACES } from "./traces";

export const DATABASE_QUERY_RECORD_FIELDS = [
  "queryId",
  "traceId",
  "triggeringUserAction",
  "serverHandler",
  "service",
  "repository",
  "ormOrDriver",
  "ormOperation",
  "normalisedSql",
  "boundParameterNames",
  "database",
  "schema",
  "databaseRole",
  "tables",
  "views",
  "columnsRead",
  "columnsWritten",
  "tenantPredicate",
  "ownershipPredicate",
  "visibilityPredicate",
  "rowLevelPolicy",
  "expectedRows",
  "maximumRows",
  "pagination",
  "transaction",
  "isolation",
  "locks",
  "concurrencyStrategy",
  "indexes",
  "constraints",
  "triggers",
  "timeout",
  "sensitiveData",
  "returnedShape",
  "cacheInteraction",
  "notFoundBehaviour",
  "unauthorisedBehaviour",
  "conflictBehaviour",
  "failureBehaviour",
  "tests",
  "evidence",
] as const;

export type DatabaseQueryRecord = {
  queryId: string;
  traceId: string;
  triggeringUserAction: string;
  serverHandler: string[];
  service: string;
  repository: string;
  ormOrDriver: string;
  ormOperation: string;
  normalisedSql: string | null;
  boundParameterNames: string[];
  database: string;
  schema: string;
  databaseRole: string;
  tables: string[];
  views: string[];
  columnsRead: string[];
  columnsWritten: string[];
  tenantPredicate: string | null;
  ownershipPredicate: string | null;
  visibilityPredicate: string | null;
  rowLevelPolicy: string[];
  expectedRows: string;
  maximumRows: number | null;
  pagination: boolean;
  transaction: string | null;
  isolation: string | null;
  locks: string[];
  concurrencyStrategy: string;
  indexes: string[];
  constraints: string[];
  triggers: string[];
  timeout: number | null;
  sensitiveData: string[];
  returnedShape: string;
  cacheInteraction: string[];
  notFoundBehaviour: string;
  unauthorisedBehaviour: string;
  conflictBehaviour: string;
  failureBehaviour: string;
  tests: string[];
  evidence: string[];
};

export const DATABASE_QUERY_RECORDS: readonly DatabaseQueryRecord[] =
  DATABASE_OPERATIONS.map((operation) => {
    const trace = SECURITY_TRACES.find(
      (candidate) => candidate.traceId === operation.traceId,
    );
    if (!trace) {
      throw new Error(`Missing security trace for ${operation.queryId}`);
    }

    return {
      queryId: operation.queryId,
      traceId: operation.traceId,
      triggeringUserAction: trace.actionName,
      serverHandler: [...trace.server.handlers],
      service: trace.server.businessService,
      repository: `${operation.sourceFile}#${operation.sourceSymbol}`,
      ormOrDriver: operation.ormOrDriver,
      ormOperation: operation.ormOperation,
      normalisedSql: operation.normalizedSql ?? null,
      boundParameterNames: [...operation.boundParameters],
      database: operation.databaseName,
      schema: operation.schemaName,
      databaseRole: operation.databaseRole,
      tables: [...operation.tables],
      views: [...operation.views],
      columnsRead: [...operation.columnsRead],
      columnsWritten: [...operation.columnsWritten],
      tenantPredicate: operation.tenantPredicate ?? null,
      ownershipPredicate: operation.ownershipPredicate ?? null,
      visibilityPredicate: operation.visibilityPredicate ?? null,
      rowLevelPolicy: [...operation.rowLevelSecurityPolicies],
      expectedRows: operation.expectedRowCount,
      maximumRows: operation.maximumRowCount ?? null,
      pagination: operation.paginationRequired,
      transaction: operation.transactionBoundary ?? null,
      isolation: operation.isolationLevel ?? null,
      locks: [...(operation.locks ?? [])],
      concurrencyStrategy: operation.concurrencyControl ?? "not captured",
      indexes: [...operation.indexesExpected],
      constraints: [...operation.constraintsReliedOn],
      triggers: [...operation.triggersInvoked],
      timeout: operation.timeoutMilliseconds ?? null,
      sensitiveData: [...operation.sensitiveColumns],
      returnedShape: operation.returnedDataShape,
      cacheInteraction: trace.cacheOperations.map(
        (cache) => `${cache.operation}: ${cache.keyShape}`,
      ),
      notFoundBehaviour: operation.notFoundBehaviour,
      unauthorisedBehaviour: operation.unauthorizedBehaviour,
      conflictBehaviour: operation.conflictBehaviour,
      failureBehaviour: operation.failureBehaviour,
      tests: [...operation.tests],
      evidence: [...operation.evidence],
    };
  });

export function validateDatabaseQueryRecords(records: readonly unknown[]) {
  const failures: string[] = [];
  const queryIds = new Set<string>();

  for (const candidate of records) {
    if (!candidate || typeof candidate !== "object") {
      failures.push("record:not-an-object");
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const queryId =
      typeof record.queryId === "string" && record.queryId.trim()
        ? record.queryId
        : "record";
    for (const field of DATABASE_QUERY_RECORD_FIELDS) {
      if (!Object.hasOwn(record, field) || record[field] === undefined) {
        failures.push(`${queryId}:${field}`);
      }
    }
    if (queryIds.has(queryId)) failures.push(`${queryId}:duplicate`);
    queryIds.add(queryId);
  }

  return failures;
}
