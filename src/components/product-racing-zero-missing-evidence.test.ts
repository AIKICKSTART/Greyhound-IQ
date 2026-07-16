import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  formatRaceMetric,
  formatRaceScheduleSummary,
} from "../lib/race-metric";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS } from "./product-racing-meeting-search-evidence";
import {
  PRODUCT_RACING_ZERO_MISSING_EVIDENCE_FILE,
  PRODUCT_RACING_ZERO_MISSING_EXPECTED_GAIN,
  PRODUCT_RACING_ZERO_MISSING_MASTER_EVIDENCE,
  PRODUCT_RACING_ZERO_MISSING_REQUIREMENT_IDS,
  PRODUCT_RACING_ZERO_MISSING_SCOPE,
  PRODUCT_RACING_ZERO_MISSING_TEST_FILE,
} from "./product-racing-zero-missing-evidence";

const completedIds = [...PRODUCT_RACING_ZERO_MISSING_REQUIREMENT_IDS];
assert.deepEqual(completedIds, ["ROUTE.RACING.zero-vs-missing"]);
assert.equal(PRODUCT_RACING_ZERO_MISSING_EXPECTED_GAIN, 1);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.deepEqual(
  Object.keys(PRODUCT_RACING_ZERO_MISSING_MASTER_EVIDENCE),
  completedIds,
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of completedIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  assert.equal(
    (PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS as readonly string[]).includes(
      requirementId,
    ),
    false,
  );
  const record = PRODUCT_RACING_ZERO_MISSING_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_RACING_ZERO_MISSING_EVIDENCE_FILE,
    PRODUCT_RACING_ZERO_MISSING_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  assert.equal(record.evidence.some((path) => path.startsWith("output/")), false);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], record);
}

const evidenceSource = readFileSync(
  PRODUCT_RACING_ZERO_MISSING_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_RACING_ZERO_MISSING_SCOPE, /measured racing count zero renders as 0/i);
assert.match(PRODUCT_RACING_ZERO_MISSING_SCOPE, /render as Not available/i);
assert.match(PRODUCT_RACING_ZERO_MISSING_SCOPE, /fallbacks preserve null/i);
assert.match(PRODUCT_RACING_ZERO_MISSING_SCOPE, /aggregate and race-detail prize/i);
assert.match(PRODUCT_RACING_ZERO_MISSING_SCOPE, /does not prove live database success/i);
assert.match(PRODUCT_RACING_ZERO_MISSING_SCOPE, /broader no-invention requirement/i);
assert.match(PRODUCT_RACING_ZERO_MISSING_SCOPE, /production readiness/i);

assert.deepEqual(formatRaceMetric(0), { state: "measured", text: "0" });
assert.deepEqual(formatRaceMetric(null), {
  state: "missing",
  text: "Not available",
});
assert.equal(
  formatRaceScheduleSummary({ meetings: 0, races: 0 }),
  "0 meetings / 0 races on this schedule.",
);
assert.equal(
  formatRaceScheduleSummary({ meetings: null, races: 0 }),
  "Meeting and race totals are not available for this schedule.",
);

const querySource = readFileSync("src/lib/queries.ts", "utf8");
for (const sourceAssertion of [
  "const fallback: DatasetStats = {",
  "races: tableCounts.get(\"Race\") ?? null",
  "const fallback: RaceDateSummary = {",
  "meetings: null,",
  "videosWithStream: null,",
  "safeQuery<number | null>(",
  "summary.runners += race._count.runners;",
  "summary.videos += race.videos.length;",
]) {
  assert.ok(
    querySource.includes(sourceAssertion),
    `race query fallbacks must preserve ${sourceAssertion}`,
  );
}
assert.doesNotMatch(
  querySource,
  /const fallback: RaceDateSummary = \{[\s\S]{0,240}?meetings: 0,/,
  "a failed date-summary query must not manufacture zero meetings",
);
assert.doesNotMatch(
  querySource,
  /prisma\.result\.count\(\{ where: \{ raceId: \{ in: raceIds \} \} \}\),\s*0/,
  "a failed search result-count query must not manufacture zero results",
);

const listSource = readFileSync("src/app/races/page.tsx", "utf8");
for (const sourceAssertion of [
  "formatRaceScheduleSummary(summary)",
  "const metric = formatRaceMetric(value);",
  "data-metric-state={metric.state}",
  "{metric.text}",
]) {
  assert.ok(
    listSource.includes(sourceAssertion),
    `race explorer metrics must preserve ${sourceAssertion}`,
  );
}
assert.doesNotMatch(listSource, /value \?\? 0/);
assert.doesNotMatch(listSource, /function formatCount\(/);

const detailSource = readFileSync("src/app/races/[id]/page.tsx", "utf8");
assert.ok(
  detailSource.includes("race.prizeMoney !== null"),
  "a measured zero prize must remain visible",
);
assert.doesNotMatch(detailSource, /race\.prizeMoney && \(/);

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
  PRODUCT_RACING_ZERO_MISSING_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly one completed requirement",
);

console.log(
  "Product racing zero-versus-missing evidence passed: measured zero remains visible, missing aggregates remain unavailable, and 1 gate closed.",
);
