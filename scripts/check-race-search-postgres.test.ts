import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  RACE_SEARCH_EVIDENCE_PATH,
  RACE_SEARCH_VERIFY_CONFIRMATION,
  assertRaceSearchVerifierTarget,
  validateRaceSearchEvidence,
} from "./check-race-search-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertRaceSearchVerifierTarget(runtimeUrl, RACE_SEARCH_VERIFY_CONFIRMATION)
    .toString(),
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
    assertRaceSearchVerifierTarget(invalid, RACE_SEARCH_VERIFY_CONFIRMATION),
  );
}
assert.throws(() =>
  assertRaceSearchVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, RACE_SEARCH_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() => validateRaceSearchEvidence(evidence, root));

const operation = DATABASE_OPERATIONS.find(
  (candidate) => candidate.queryId === "DB.RACING.RACE.SEARCH.READ_BUNDLE",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.databaseRole, "greyhoundiq_runtime");
assert.equal(operation.databaseName, "greyhoundiq");
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 7_053);
const statements = (evidence.proof as Record<string, unknown>)
  .statements as Array<Record<string, unknown>>;
assert.ok(
  statements.some(
    (statement) =>
      (statement.observedSql as Record<string, unknown>).normalizedSql ===
      operation.normalizedSql,
  ),
  "the registry primary SQL must be one of the 31 exact captured variants",
);
assert.ok(operation.tests.includes("scripts/check-race-search-postgres.test.ts"));
assert.ok(
  operation.evidence.some((entry) => entry.includes(RACE_SEARCH_EVIDENCE_PATH)),
);

const source = readFileSync(resolve(root, "src/lib/queries.ts"), "utf8");
for (const contract of [
  "const RACE_EXPLORER_MEETING_LIMIT = 128;",
  "const RACE_EXPLORER_RACE_LIMIT = 2_048;",
  "const RACE_EXPLORER_STATE_LIMIT = 16;",
  "const RACE_EXPLORER_REPLAY_LIMIT = 8;",
  "const RACE_SEARCH_RESULT_LIMIT = 120;",
  "const RACE_SEARCH_DOG_MATCH_LIMIT = 80;",
  "const RACE_SEARCH_RUNNER_RESULT_LIMIT = 48;",
  "take: RACE_EXPLORER_STATE_LIMIT",
  'db.track.groupBy({',
  "take: RACE_EXPLORER_REPLAY_LIMIT",
  "take: RACE_EXPLORER_MEETING_LIMIT",
  "take: RACE_EXPLORER_RACE_LIMIT",
]) {
  assert.ok(source.includes(contract), contract);
}
const replaySlice = between(
  source,
  "const [dateSummary, replayRaces] = searchQuery",
  "const meetings = orderRaceExplorerMeetings",
);
assert.match(replaySlice, /select:\s*\{/);
assert.doesNotMatch(
  replaySlice,
  /meeting:\s*\{\s*include|videos:\s*\{[\s\S]*?where/,
);

console.log(
  "race-search database evidence passed: four bounded search paths, exact anonymous replay and least-privilege replay projection",
);

function between(sourceText: string, start: string, end: string) {
  const from = sourceText.indexOf(start);
  const to = sourceText.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source slice ${start} -> ${end}`);
  return sourceText.slice(from, to);
}
