import { DATABASE_QUERY_RECORDS } from "./database-query-records";

export const ACTION_TRACE_DATABASE_FIELDS = [
  "repositoryMethod",
  "ormOperation",
  "normalisedSql",
  "boundParametersWithoutValues",
  "databaseRole",
  "tablesAndColumns",
  "tenantPredicate",
  "ownershipPredicate",
  "visibilityPredicate",
  "rowLevelSecurityPolicy",
  "expectedRows",
  "maximumRows",
  "indexes",
  "constraints",
  "transaction",
  "locks",
  "isolationLevel",
  "concurrencyHandling",
  "queryTimeout",
  "failureBehaviour",
] as const;

export const ACTION_TRACE_DATABASE_ACTIVITY = DATABASE_QUERY_RECORDS.map(
  (query) => ({
    traceId: query.traceId,
    queryId: query.queryId,
    repositoryMethod: query.repository,
    ormOperation: query.ormOperation,
    normalisedSql: query.normalisedSql,
    boundParametersWithoutValues: [...query.boundParameterNames],
    databaseRole: query.databaseRole,
    tablesAndColumns: {
      tables: [...query.tables],
      views: [...query.views],
      read: [...query.columnsRead],
      written: [...query.columnsWritten],
    },
    tenantPredicate: query.tenantPredicate,
    ownershipPredicate: query.ownershipPredicate,
    visibilityPredicate: query.visibilityPredicate,
    rowLevelSecurityPolicy: [...query.rowLevelPolicy],
    expectedRows: query.expectedRows,
    maximumRows: query.maximumRows,
    indexes: [...query.indexes],
    constraints: [...query.constraints],
    transaction: query.transaction,
    locks: [...query.locks],
    isolationLevel: query.isolation,
    concurrencyHandling: query.concurrencyStrategy,
    queryTimeout: query.timeout,
    failureBehaviour: query.failureBehaviour,
  }),
);

export function validateActionTraceDatabaseActivity(records: readonly unknown[]) {
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
    for (const field of ACTION_TRACE_DATABASE_FIELDS) {
      if (!Object.hasOwn(record, field) || record[field] === undefined) {
        failures.push(`${queryId}:${field}`);
      }
    }
    if (queryIds.has(queryId)) failures.push(`${queryId}:duplicate`);
    queryIds.add(queryId);
  }

  return failures;
}
