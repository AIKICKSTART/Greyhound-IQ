import accountDeletionFinalize from "../output/database-audit/account-deletion-finalize.json";
import liveProviderIngest from "../output/database-audit/live-provider-ingest.json";
import userExportRead from "../output/database-audit/user-export-read.json";

type CapturedStatement = {
  observedSql?: { normalizedSql?: unknown };
};

type CaptureDocument = {
  proof?: {
    queryId?: unknown;
    statements?: unknown;
  };
};

function capturedSql(document: CaptureDocument) {
  const statements = Array.isArray(document.proof?.statements)
    ? (document.proof.statements as CapturedStatement[])
    : [];
  const sql = statements.flatMap((statement) =>
    typeof statement.observedSql?.normalizedSql === "string"
      ? [statement.observedSql.normalizedSql]
      : [],
  );

  if (!document.proof?.queryId || sql.length === 0) {
    throw new Error("Database query capture artifact is incomplete");
  }

  return sql;
}

export const CAPTURED_NORMALISED_SQL_BY_QUERY_ID = new Map<
  string,
  readonly string[]
>([
  [
    "DB.ACCOUNT.DELETION.FINALIZE.TRANSACTION",
    capturedSql(accountDeletionFinalize),
  ],
  ["DB.ACCOUNT.DATA_EXPORT.READ", capturedSql(userExportRead)],
  ["DB.RACING.PROVIDER.INGEST.TRANSACTION", capturedSql(liveProviderIngest)],
]);
