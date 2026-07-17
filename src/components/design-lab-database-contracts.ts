import {
  DATABASE_OPERATIONS,
  type DatabaseOperationContract,
} from "../../security/database-operations";

const UNCERTAIN_RUNTIME_VALUE = /not captured|runtime database|runtime search_path|runtime database_url/i;

export function isDesignLabDatabaseOperationComplete(
  operation: DatabaseOperationContract
) {
  const hasExecutableShape = Boolean(
    operation.normalizedSql?.trim() ||
      operation.normalizedSqlArtifact?.trim() ||
      operation.storedProcedure?.trim() ||
      operation.databaseFunction?.trim()
  );
  const runtimeIdentityCaptured = [
    operation.databaseRole,
    operation.databaseName,
    operation.schemaName,
  ].every(
    (value) => value.trim() && !UNCERTAIN_RUNTIME_VALUE.test(value)
  );

  return (
    operation.verificationStatus === "Verified" &&
    hasExecutableShape &&
    runtimeIdentityCaptured &&
    operation.parameterized &&
    operation.tests.length > 0 &&
    operation.evidence.length > 0 &&
    operation.expectedRowCount.trim().length > 0 &&
    operation.returnedDataShape.trim().length > 0 &&
    operation.failureBehaviour.trim().length > 0
  );
}

export const DESIGN_LAB_DATABASE_CONTRACT_SUMMARY = Object.freeze({
  total: DATABASE_OPERATIONS.length,
  complete: DATABASE_OPERATIONS.filter(
    isDesignLabDatabaseOperationComplete
  ).length,
  normalizedSqlCaptured: DATABASE_OPERATIONS.filter((operation) =>
    Boolean(
      operation.normalizedSql?.trim() ||
        operation.normalizedSqlArtifact?.trim()
    )
  ).length,
  linkedTests: DATABASE_OPERATIONS.filter(
    (operation) => operation.tests.length > 0
  ).length,
});
