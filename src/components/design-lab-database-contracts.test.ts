import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DATABASE_OPERATIONS, type DatabaseOperationContract } from "../../security/database-operations";
import {
  DESIGN_LAB_DATABASE_CONTRACT_SUMMARY,
  isDesignLabDatabaseOperationComplete,
} from "./design-lab-database-contracts";

assert.equal(DESIGN_LAB_DATABASE_CONTRACT_SUMMARY.total, DATABASE_OPERATIONS.length);
assert.equal(
  DESIGN_LAB_DATABASE_CONTRACT_SUMMARY.complete,
  DATABASE_OPERATIONS.filter(isDesignLabDatabaseOperationComplete).length
);
assert.equal(
  new Set(DATABASE_OPERATIONS.map((operation) => operation.queryId)).size,
  DATABASE_OPERATIONS.length
);

const completeFixture: DatabaseOperationContract = {
  ...DATABASE_OPERATIONS[0],
  normalizedSql:
    'INSERT INTO "WebhookEvent" ("provider", "lagoEventId") VALUES (:provider, :providerEventId)',
  databaseRole: "greyhoundiq_runtime",
  databaseName: "greyhoundiq",
  schemaName: "public",
  tests: ["test:database-operation"],
  evidence: ["evidence:normalized-sql"],
  verificationStatus: "Verified",
};
assert.equal(isDesignLabDatabaseOperationComplete(completeFixture), true);
assert.equal(
  isDesignLabDatabaseOperationComplete({
    ...completeFixture,
    databaseRole: "DATABASE_URL principal (role name not captured)",
  }),
  false
);
assert.equal(
  isDesignLabDatabaseOperationComplete({
    ...completeFixture,
    normalizedSql: undefined,
  }),
  false
);
assert.equal(
  isDesignLabDatabaseOperationComplete({
    ...completeFixture,
    normalizedSql: undefined,
    normalizedSqlArtifact:
      "output/database-audit/synthetic.json#proof.statements[*].observedSql.normalizedSql",
  }),
  true
);
assert.equal(
  isDesignLabDatabaseOperationComplete({
    ...completeFixture,
    verificationStatus: "Partially verified",
  }),
  false
);

for (const [queryId, artifactPath, expectedStatements] of [
  [
    "DB.ACCOUNT.DELETION.FINALIZE.TRANSACTION",
    "output/database-audit/account-deletion-finalize.json",
    17,
  ],
  [
    "DB.ACCOUNT.DATA_EXPORT.READ",
    "output/database-audit/user-export-read.json",
    18,
  ],
] as const) {
  const operation = DATABASE_OPERATIONS.find((item) => item.queryId === queryId);
  assert.ok(operation, queryId);
  assert.equal(
    operation.normalizedSqlArtifact,
    `${artifactPath}#proof.statements[*].observedSql.normalizedSql`,
  );
  assert.equal(isDesignLabDatabaseOperationComplete(operation), true, queryId);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    verdict?: string;
    proof?: {
      statementCount?: number;
      statements?: Array<{
        observedSql?: { normalizedSql?: string; persistedParameterValues?: boolean };
      }>;
    };
  };
  assert.equal(artifact.verdict, "verified", queryId);
  assert.equal(artifact.proof?.statementCount, expectedStatements, queryId);
  assert.equal(artifact.proof?.statements?.length, expectedStatements, queryId);
  for (const statement of artifact.proof?.statements ?? []) {
    assert.ok(statement.observedSql?.normalizedSql?.trim(), queryId);
    assert.equal(statement.observedSql?.persistedParameterValues, false, queryId);
  }
}

console.log("Design Lab database contract completion tests passed");
