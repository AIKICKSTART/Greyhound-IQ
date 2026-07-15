const ACTION_TRACE_DATABASE_EVIDENCE = [
  "security/action-trace-database.ts",
  "security/action-trace-database.test.ts",
  "security/database-query-records.ts",
  "security/database-operations.ts",
  "security/traces.ts",
] as const;

export const ACTION_TRACE_DATABASE_FIELD_BINDINGS = {
  "security.action-trace-database.field.repository-method": "repositoryMethod",
  "security.action-trace-database.field.orm-operation": "ormOperation",
  "security.action-trace-database.field.normalised-sql": "normalisedSql",
  "security.action-trace-database.field.bound-parameters-without-values": "boundParametersWithoutValues",
  "security.action-trace-database.field.database-role": "databaseRole",
  "security.action-trace-database.field.tables-and-columns": "tablesAndColumns",
  "security.action-trace-database.field.tenant-predicate": "tenantPredicate",
  "security.action-trace-database.field.ownership-predicate": "ownershipPredicate",
  "security.action-trace-database.field.visibility-predicate": "visibilityPredicate",
  "security.action-trace-database.field.row-level-security-policy": "rowLevelSecurityPolicy",
  "security.action-trace-database.field.expected-rows": "expectedRows",
  "security.action-trace-database.field.maximum-rows": "maximumRows",
  "security.action-trace-database.field.indexes": "indexes",
  "security.action-trace-database.field.constraints": "constraints",
  "security.action-trace-database.field.transaction": "transaction",
  "security.action-trace-database.field.locks": "locks",
  "security.action-trace-database.field.isolation-level": "isolationLevel",
  "security.action-trace-database.field.concurrency-handling": "concurrencyHandling",
  "security.action-trace-database.field.query-timeout": "queryTimeout",
  "security.action-trace-database.field.failure-behaviour": "failureBehaviour",
} as const;

export const ACTION_TRACE_DATABASE_MASTER_EVIDENCE = Object.fromEntries(
  Object.keys(ACTION_TRACE_DATABASE_FIELD_BINDINGS).map((id) => [
    id,
    {
      status: "verified" as const,
      evidence: ACTION_TRACE_DATABASE_EVIDENCE,
    },
  ]),
);
