import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  buildBoxBiasPresentation,
  formatBoxBiasAggregateSummary,
  formatBoxBiasRate,
} from "../lib/racing-statistics-presentation";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { RACING_PRODUCTION_FIXTURES } from "./product-racing-fixture-evidence";
import {
  PRODUCT_RACING_MISSING_SNAPSHOT_EVIDENCE_FILE,
  PRODUCT_RACING_MISSING_SNAPSHOT_EXPECTED_GAIN,
  PRODUCT_RACING_MISSING_SNAPSHOT_MASTER_EVIDENCE,
  PRODUCT_RACING_MISSING_SNAPSHOT_REQUIREMENT_IDS,
  PRODUCT_RACING_MISSING_SNAPSHOT_SCOPE,
  PRODUCT_RACING_MISSING_SNAPSHOT_TEST_FILE,
} from "./product-racing-missing-snapshot-evidence";
import { PRODUCT_RACING_STRUCTURE_OPEN_REQUIREMENT_IDS } from "./product-racing-structure-evidence";

const completedIds = [...PRODUCT_RACING_MISSING_SNAPSHOT_REQUIREMENT_IDS];
assert.deepEqual(completedIds, [
  "RACING.STRUCT.missing-data",
  "RACING.STRUCT.typed-snapshot",
]);
assert.equal(PRODUCT_RACING_MISSING_SNAPSHOT_EXPECTED_GAIN, 2);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.deepEqual(
  Object.keys(PRODUCT_RACING_MISSING_SNAPSHOT_MASTER_EVIDENCE),
  completedIds,
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of completedIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  assert.equal(
    (PRODUCT_RACING_STRUCTURE_OPEN_REQUIREMENT_IDS as readonly string[]).includes(
      requirementId,
    ),
    false,
  );
  const record = PRODUCT_RACING_MISSING_SNAPSHOT_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_RACING_MISSING_SNAPSHOT_EVIDENCE_FILE,
    PRODUCT_RACING_MISSING_SNAPSHOT_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  assert.equal(record.evidence.some((path) => path.startsWith("output/")), false);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], record);
}

const evidenceSource = readFileSync(
  PRODUCT_RACING_MISSING_SNAPSHOT_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_RACING_MISSING_SNAPSHOT_SCOPE, /all eight box positions visible/i);
assert.match(PRODUCT_RACING_MISSING_SNAPSHOT_SCOPE, /Not available rather than zero/i);
assert.match(PRODUCT_RACING_MISSING_SNAPSHOT_SCOPE, /typed racing fixture contract/i);
assert.match(PRODUCT_RACING_MISSING_SNAPSHOT_SCOPE, /does not prove live database contents/i);
assert.match(PRODUCT_RACING_MISSING_SNAPSHOT_SCOPE, /broader no-invention requirement/i);
assert.match(PRODUCT_RACING_MISSING_SNAPSHOT_SCOPE, /production readiness/i);

const boxRows = buildBoxBiasPresentation([
  { box: 1, starts: 0, wins: 0, winRate: null },
  { box: 8, starts: 20, wins: 2, winRate: 10 },
]);
assert.equal(boxRows.length, 8);
assert.equal(boxRows[0]?.state, "missing");
assert.equal(boxRows[0]?.starts, 0);
assert.equal(formatBoxBiasRate(boxRows[0]!), "Not available");
assert.equal(boxRows[1]?.starts, null);
assert.equal(boxRows[7]?.state, "measured");
assert.equal(formatBoxBiasRate(boxRows[7]!), "10%");
assert.match(formatBoxBiasAggregateSummary([]), /No box-bias aggregate/i);

const querySource = readFileSync("src/lib/queries.ts", "utf8");
for (const sourceAssertion of [
  "FROM giq_box_bias",
  "FROM giq_trainer_performance",
  "FROM giq_track_records",
  "FROM giq_sire_leaderboard",
  "r.starts > 0",
  "r.progeny > 0",
]) {
  assert.ok(
    querySource.includes(sourceAssertion),
    `read-only racing aggregate contract needs ${sourceAssertion}`,
  );
}
assert.match(
  querySource,
  /r\.starts > 0[\s\S]{0,160}:[\s\n]*null/,
  "zero starts must not manufacture a zero box win rate",
);
assert.match(
  querySource,
  /r\.progeny > 0[\s\S]{0,180}:[\s\n]*null/,
  "zero progeny must not manufacture a zero strike rate",
);

const statisticsSource = readFileSync("src/app/statistics/page.tsx", "utf8");
for (const sourceAssertion of [
  "buildBoxBiasPresentation(boxBiasRows)",
  "formatBoxBiasAggregateSummary(boxBiasRows)",
  "formatBoxBiasRate(b)",
  'data-metric-state={b.state}',
  "Box-bias rates are not available",
  "Trainer statistics are not available",
  "Track records are not available",
  "TRAINER_LEADERS.length > 0",
  "TRACK_RECORDS.length > 0",
]) {
  assert.ok(
    statisticsSource.includes(sourceAssertion),
    `statistics missing-data UI needs ${sourceAssertion}`,
  );
}
assert.doesNotMatch(statisticsSource, /4,800\+ meetings/);

const breedingSource = readFileSync("src/app/breeding/page.tsx", "utf8");
for (const sourceAssertion of [
  "SIRE_LEADERS.length > 0",
  "Sire statistics are not available",
  's.strike === null ? "Not available"',
  'data-metric-state={s.strike === null ? "missing" : "measured"}',
  "current read-only aggregate",
]) {
  assert.ok(
    breedingSource.includes(sourceAssertion),
    `breeding missing-data UI needs ${sourceAssertion}`,
  );
}

const fixtureSource = readFileSync(
  "src/components/product-racing-fixture-evidence.ts",
  "utf8",
);
assert.ok(RACING_PRODUCTION_FIXTURES.length >= 15);
assert.match(fixtureSource, /satisfies readonly RacingProductionFixture\[\]/);
for (const requirementId of [
  "RACING.FIX.complete",
  "RACING.FIX.partial",
  "RACING.FIX.missing",
  "RACING.FIX.zero",
  "RACING.FIX.delayed",
  "RACING.FIX.corrected",
  "RACING.FIX.source-outage",
]) {
  assert.ok(
    RACING_PRODUCTION_FIXTURES.some(
      (fixture) => fixture.requirementId === requirementId,
    ),
    requirementId,
  );
}

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_RACING_MISSING_SNAPSHOT_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly two completed requirements",
);

console.log(
  "Product racing missing-data and snapshot evidence passed: explicit unavailable states, typed fixtures/read-only aggregates, and 2 gates closed.",
);
