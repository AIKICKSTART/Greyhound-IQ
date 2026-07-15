import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  HOME_RACE_MEETINGS_EVIDENCE_PATH,
  HOME_RACE_MEETINGS_VERIFY_CONFIRMATION,
  assertHomeRaceMeetingsVerifierTarget,
  validateHomeRaceMeetingsEvidence,
} from "./check-home-race-meetings-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertHomeRaceMeetingsVerifierTarget(
    runtimeUrl,
    HOME_RACE_MEETINGS_VERIFY_CONFIRMATION,
  ).toString(),
  runtimeUrl,
);
for (const invalid of [
  "postgresql://greyhoundiq_runtime@127.0.0.1:55733/greyhoundiq",
  "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime:secret@127.0.0.1:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@localhost:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/postgres",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq?host=db.invalid",
]) {
  assert.throws(() =>
    assertHomeRaceMeetingsVerifierTarget(
      invalid,
      HOME_RACE_MEETINGS_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertHomeRaceMeetingsVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, HOME_RACE_MEETINGS_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() => validateHomeRaceMeetingsEvidence(evidence, root));

const operation = DATABASE_OPERATIONS.find(
  (candidate) =>
    candidate.queryId === "DB.PUBLIC.HOME.RACE_MEETINGS.READ_BUNDLE",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceFile, "src/lib/queries.ts");
assert.equal(
  operation.sourceSymbol,
  "getTodaysMeetings -> getRaceExplorerMeetings",
);
assert.equal(operation.databaseRole, "greyhoundiq_runtime");
assert.equal(operation.databaseName, "greyhoundiq");
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 6_400);
assert.equal(operation.normalizedSqlVariants?.length, 5);
const statements = (evidence.proof as Record<string, unknown>)
  .statements as Array<Record<string, unknown>>;
assert.deepEqual(
  operation.normalizedSqlVariants?.map((variant) => ({
    variant: variant.variant,
    normalizedSql: variant.normalizedSql,
  })),
  statements.map((statement) => ({
    variant: statement.variant,
    normalizedSql: (statement.observedSql as Record<string, unknown>)
      .normalizedSql,
  })),
);
assert.ok(
  operation.tests.includes(
    "scripts/check-home-race-meetings-postgres.test.ts",
  ),
);
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes(HOME_RACE_MEETINGS_EVIDENCE_PATH),
  ),
);

const querySource = readFileSync(resolve(root, "src/lib/queries.ts"), "utf8");
assert.match(querySource, /const RACE_EXPLORER_MEETING_LIMIT = 128;/);
assert.match(querySource, /const RACE_EXPLORER_RACE_LIMIT = 2_048;/);
assert.match(
  querySource,
  /orderBy: \[\{ fetchedAt: "desc" \}, \{ id: "asc" \}\]/,
);

console.log(
  "home race-meeting database evidence passed: four bounded public reads and exact anonymous replay",
);
