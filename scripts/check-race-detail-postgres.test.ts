import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  RACE_DETAIL_EVIDENCE_PATH,
  RACE_DETAIL_VERIFY_CONFIRMATION,
  assertRaceDetailVerifierTarget,
  validateRaceDetailEvidence,
} from "./check-race-detail-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertRaceDetailVerifierTarget(
    runtimeUrl,
    RACE_DETAIL_VERIFY_CONFIRMATION,
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
    assertRaceDetailVerifierTarget(
      invalid,
      RACE_DETAIL_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertRaceDetailVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, RACE_DETAIL_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() => validateRaceDetailEvidence(evidence, root));

const operation = DATABASE_OPERATIONS.find(
  (candidate) =>
    candidate.queryId === "DB.RACING.RACE.OPEN.DETAIL_BUNDLE",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceFile, "src/lib/queries.ts");
assert.equal(
  operation.sourceSymbol,
  "getRaceById + getPreviousRaceVideoRunners",
);
assert.equal(operation.databaseRole, "greyhoundiq_runtime");
assert.equal(operation.databaseName, "greyhoundiq");
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 812);

const statements = (evidence.proof as Record<string, unknown>)
  .statements as Array<Record<string, unknown>>;
assert.ok(operation.normalizedSql);
assert.ok(
  statements.some(
    (statement) =>
      (statement.observedSql as Record<string, unknown>).normalizedSql ===
      operation.normalizedSql,
  ),
);
assert.ok(operation.tests.includes("scripts/check-race-detail-postgres.test.ts"));
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes(RACE_DETAIL_EVIDENCE_PATH),
  ),
);

const queriesSource = readFileSync(resolve(root, "src/lib/queries.ts"), "utf8");
for (const contract of [
  "const RACE_DETAIL_RUNNER_LIMIT = 12;",
  "const RACE_DETAIL_VIDEO_LIMIT = 16;",
  "const RACE_DETAIL_MEETING_RACE_LIMIT = 24;",
  "const RACE_DETAIL_DOG_FORM_LIMIT = 6;",
  "const RACE_DETAIL_DOG_PROFILE_FORM_LIMIT = 8;",
  "const RACE_DETAIL_PREVIOUS_RUNNER_LIMIT = 24;",
  "take: RACE_DETAIL_RUNNER_LIMIT",
  "take: RACE_DETAIL_VIDEO_LIMIT",
  "take: RACE_DETAIL_MEETING_RACE_LIMIT",
  "LIMIT ${RACE_DETAIL_DOG_FORM_LIMIT}",
  "LIMIT ${RACE_DETAIL_DOG_PROFILE_FORM_LIMIT}",
  "LIMIT ${RACE_DETAIL_VIDEO_LIMIT}",
  "take: RACE_DETAIL_PREVIOUS_RUNNER_LIMIT",
]) {
  assert.ok(queriesSource.includes(contract), contract);
}
const raceDetail = between(
  queriesSource,
  "export const getRaceById",
  "export async function getPreviousRaceVideoRunners",
);
const previousRaces = between(
  queriesSource,
  "export async function getPreviousRaceVideoRunners",
  "const dogSearchSelect",
);
for (const source of [raceDetail, previousRaces]) {
  assert.doesNotMatch(
    source,
    /sourceRawJson:\s*true|profileSourceRawJson:\s*true|gpsData:\s*true|sectionals:\s*true/,
  );
  assert.doesNotMatch(source, /include:\s*\{/);
}
assert.match(previousRaces, /raceTime:\s*\{ lt: currentRace\.raceTime \}/);
assert.match(
  previousRaces,
  /OR:\s*\[\{ replayUrl: \{ not: null \} \}, \{ videos: \{ some: \{\} \} \}\]/,
);

console.log(
  "race-detail database evidence passed: bounded least-privilege bundle, anonymous RLS replay, sanitized plans and exact cleanup",
);

function between(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source slice ${start} -> ${end}`);
  return source.slice(from, to);
}
