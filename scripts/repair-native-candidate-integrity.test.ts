import assert from "node:assert/strict";

import {
  assertExpectedRepairScope,
  assertNativeCandidateIdentity,
  assertNativeCandidateUrl,
  compareRunnerCandidates,
  deterministicQuarantineId,
  parseRepairArguments,
  planDuplicateGroup,
  resultsAreCompatible,
  type ResultCandidate,
  type RunnerCandidate,
} from "./repair-native-candidate-integrity";

const result = (
  id: string,
  runnerId: string,
  overrides: Partial<ResultCandidate> = {},
): ResultCandidate => ({
  id,
  runnerId,
  raceId: "race-1",
  finishingPosition: 1,
  runningTime: 29.5,
  margin: 0,
  prizeMoneyWon: 1_000,
  splitTime: 5.1,
  sectionals: "[5.1]",
  gpsData: null,
  sourceProvider: "provider",
  sourceId: "result-1",
  sourceRawJson: null,
  ...overrides,
});

const runner = (
  id: string,
  boxNumber: number,
  overrides: Partial<RunnerCandidate> = {},
): RunnerCandidate => ({
  id,
  raceId: "race-1",
  dogId: "dog-1",
  boxNumber,
  scratched: false,
  result: null,
  ...overrides,
});

assert.deepEqual(
  assertNativeCandidateUrl(
    "postgresql://postgres:credential@127.0.0.1:55434/giq_production_candidate_20260716_r1",
  ),
  {
    host: "127.0.0.1",
    port: 55_434,
    database: "giq_production_candidate_20260716_r1",
  },
);
assert.equal(
  assertNativeCandidateUrl(
    "postgresql://postgres@localhost:55434/giq_production_candidate_20260716_r1",
  ).host,
  "localhost",
);
for (const invalid of [
  "postgresql://postgres@127.0.0.1:55433/giq_production_candidate_20260716_r1",
  "postgresql://postgres@127.0.0.1:55432/giq_production_candidate_20260716_r1",
  "postgresql://postgres@127.0.0.1:55434/giq_production_stage11_20260718",
  "postgresql://postgres@database.internal:55434/giq_production_candidate_20260716_r1",
  "postgresql://postgres@127.0.0.1:55434/giq_production_candidate_20260716_r1?host=docker",
]) {
  assert.throws(() => assertNativeCandidateUrl(invalid));
}

assert.doesNotThrow(() =>
  assertNativeCandidateIdentity({
    database: "giq_production_candidate_20260716_r1",
    port: 55_434,
    dataDirectory: "C:\\GreyhoundIQ\\native-postgres16\\data\\",
    serverVersionNum: "160009",
  }),
);
assert.throws(() =>
  assertNativeCandidateIdentity({
    database: "giq_production_candidate_20260716_r1",
    port: 55_434,
    dataDirectory: "/var/lib/postgresql/data",
    serverVersionNum: "160009",
  }),
);

assert.deepEqual(parseRepairArguments([]), { apply: false });
assert.deepEqual(parseRepairArguments(["--apply"]), { apply: true });
assert.throws(() => parseRepairArguments(["--dry-run"]), /Usage/);

const expectedRepairScope = {
  duplicateGroups: 16,
  duplicateLosingOccurrences: 16,
  repairableDuplicateOccurrences: 15,
  duplicateConflictGroups: 1,
  orphanFormEntries: 101_059,
};
assert.doesNotThrow(() => assertExpectedRepairScope(expectedRepairScope));
for (const key of Object.keys(expectedRepairScope) as Array<keyof typeof expectedRepairScope>) {
  assert.throws(
    () => assertExpectedRepairScope({ ...expectedRepairScope, [key]: expectedRepairScope[key] + 1 }),
    /repair scope changed/u,
  );
}
assert.doesNotThrow(() =>
  assertExpectedRepairScope(
    {
      duplicateGroups: 1,
      duplicateLosingOccurrences: 1,
      repairableDuplicateOccurrences: 0,
      duplicateConflictGroups: 1,
      orphanFormEntries: 99_659,
    },
    {
      repairedRunnerQuarantines: 15,
      conflictingRunnerQuarantines: 1,
      formEntryQuarantines: 1_400,
      quarantinedFormEntriesStillOrphaned: 0,
    },
  ),
);
assert.doesNotThrow(() =>
  assertExpectedRepairScope(
    {
      duplicateGroups: 1,
      duplicateLosingOccurrences: 1,
      repairableDuplicateOccurrences: 0,
      duplicateConflictGroups: 1,
      orphanFormEntries: 99_759,
    },
    {
      repairedRunnerQuarantines: 15,
      conflictingRunnerQuarantines: 1,
      formEntryQuarantines: 1_400,
      quarantinedFormEntriesStillOrphaned: 100,
    },
  ),
);
assert.throws(
  () =>
    assertExpectedRepairScope(
      { ...expectedRepairScope, orphanFormEntries: 101_058 },
      {
        repairedRunnerQuarantines: 0,
        conflictingRunnerQuarantines: 0,
        formEntryQuarantines: 0,
        quarantinedFormEntriesStillOrphaned: 0,
      },
    ),
  /FormEntry repair scope changed/u,
);

const ranked = [
  runner("reserve", 9),
  runner("scratched", 1, { scratched: true }),
  runner("active-low", 2),
  runner("result", 8, { result: result("result-row", "result") }),
].sort(compareRunnerCandidates);
assert.deepEqual(
  ranked.map(({ id }) => id),
  ["result", "active-low", "reserve", "scratched"],
);
assert.equal(
  [runner("b", 2), runner("a", 2)].sort(compareRunnerCandidates)[0].id,
  "a",
);

const compatibleLeft = result("left-result", "left");
const compatibleRight = result("right-result", "right");
assert.equal(resultsAreCompatible(compatibleLeft, compatibleRight), true);
assert.equal(
  resultsAreCompatible(compatibleLeft, {
    ...compatibleRight,
    sourceId: "different-result",
  }),
  false,
);

const safePlan = planDuplicateGroup([
  runner("winner", 5, { result: compatibleLeft }),
  runner("loser-result", 6, { result: compatibleRight }),
  runner("loser-empty", 2),
]);
assert.equal(safePlan.winner.id, "winner");
assert.equal(safePlan.repairable, true);
assert.deepEqual(
  safePlan.losers.map(({ id }) => id),
  ["loser-result", "loser-empty"],
);

const conflictPlan = planDuplicateGroup([
  runner("winner", 5, { result: compatibleLeft }),
  runner("loser", 6, {
    result: result("other-result", "loser", { finishingPosition: 2 }),
  }),
]);
assert.equal(conflictPlan.repairable, false);
assert.equal(conflictPlan.reasonCode, "duplicate_runner_result_conflict");

const quarantineId = deterministicQuarantineId("stable-occurrence");
assert.equal(quarantineId, deterministicQuarantineId("stable-occurrence"));
assert.match(
  quarantineId,
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
);

console.log("native candidate integrity repair tests passed");
