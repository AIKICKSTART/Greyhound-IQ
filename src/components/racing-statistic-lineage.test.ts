import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  RACING_ROUTE_PRESENTATION_SCHEMAS,
  type RacingPresentationRoute,
} from "./racing-presentation-schema";
import { RACING_STATISTIC_LINEAGE } from "./racing-statistic-lineage";

const numericTypes = new Set(["currency", "decimal", "integer", "percentage"]);
const numericPresentations = RACING_ROUTE_PRESENTATION_SCHEMAS.flatMap(
  ({ route, presentations }) =>
    presentations.flatMap((presentation) => {
      const metricKeys = presentation.columns
        .filter(({ type }) => numericTypes.has(type))
        .map(({ key }) => key);
      return metricKeys.length > 0
        ? [{ route, presentationId: presentation.id, metricKeys }]
        : [];
    }),
);

assert.equal(numericPresentations.length, 24);
assert.equal(RACING_STATISTIC_LINEAGE.length, numericPresentations.length);
assert.equal(
  new Set(
    RACING_STATISTIC_LINEAGE.map(
      ({ route, presentationId }) => `${route}/${presentationId}`,
    ),
  ).size,
  RACING_STATISTIC_LINEAGE.length,
);

for (const presentation of numericPresentations) {
  const lineage = RACING_STATISTIC_LINEAGE.find(
    (candidate) =>
      candidate.route === presentation.route &&
      candidate.presentationId === presentation.presentationId,
  );
  assert.ok(
    lineage,
    `${presentation.route}/${presentation.presentationId}: numeric presentation needs lineage`,
  );
  assert.deepEqual(
    [...lineage.metricKeys].toSorted(),
    presentation.metricKeys.toSorted(),
    `${presentation.route}/${presentation.presentationId}: every numeric column needs lineage`,
  );
  assert.ok(lineage.missingRule.length >= 60, presentation.presentationId);
  assert.ok(lineage.sourceFiles.length > 0, presentation.presentationId);
  for (const sourceContract of lineage.sourceFiles) {
    assert.equal(existsSync(sourceContract.file), true, sourceContract.file);
    const source = readFileSync(sourceContract.file, "utf8");
    for (const marker of sourceContract.markers) {
      assert.ok(
        source.includes(marker),
        `${presentation.route}/${presentation.presentationId}: missing authority marker ${marker} in ${sourceContract.file}`,
      );
    }
  }
}

const routesWithNumericPresentations = new Set<RacingPresentationRoute>(
  numericPresentations.map(({ route }) => route),
);
assert.deepEqual(
  [...new Set(RACING_STATISTIC_LINEAGE.map(({ route }) => route))].toSorted(),
  [...routesWithNumericPresentations].toSorted(),
);

const querySource = readFileSync("src/lib/queries.ts", "utf8");
for (const nullableTally of ["Dog", "Race", "Result"]) {
  assert.ok(
    querySource.includes(`counts.get("${nullableTally}") ?? null`),
    `${nullableTally} planner estimate must preserve missing`,
  );
  assert.equal(
    querySource.includes(`counts.get("${nullableTally}") ?? 0`),
    false,
    `${nullableTally} planner estimate must not manufacture zero`,
  );
}

const dogListSource = readFileSync("src/app/dogs/page.tsx", "utf8");
assert.match(dogListSource, /formatRaceMetric\(tallies\.dogs\)/);
assert.match(dogListSource, /Unavailable totals are never replaced/);
assert.doesNotMatch(dogListSource, /formatTally\(/);

const dogSearchSource = readFileSync("src/components/dog-search.tsx", "utf8");
assert.match(dogSearchSource, /dog\.prizeMoney !== null/);
assert.match(dogSearchSource, /formatDogPrizeMoney/);
assert.doesNotMatch(dogSearchSource, /function formatPrize/);

const dogDetailSource = readFileSync("src/app/dogs/[id]/page.tsx", "utf8");
assert.match(dogDetailSource, /formatDogWinRate\(\{ wins, starts: total \}\)/);
assert.match(dogDetailSource, /formatDogPrizeMoney\(dog\.prizeMoney\)\.text/);
assert.doesNotMatch(dogDetailSource, /total > 0[\s\S]{0,100}: "0"/);

const trackDetailSource = readFileSync(
  "src/app/tracks/[id]/page.tsx",
  "utf8",
);
assert.match(trackDetailSource, /runningTime != null/);
assert.doesNotMatch(trackDetailSource, /runningTime \?\? 99/);

const statisticsSource = readFileSync("src/app/statistics/page.tsx", "utf8");
assert.doesNotMatch(statisticsSource, /4,800\+ meetings/);
assert.match(statisticsSource, /formatBoxBiasAggregateSummary\(boxBiasRows\)/);

const meetingSource = readFileSync("src/app/meetings/[id]/page.tsx", "utf8");
assert.match(meetingSource, /buildMeetingSummary/);
assert.match(meetingSource, /data-metric-state="measured"/);
assert.match(meetingSource, /No race rows are available for this stored meeting/);

const lineageSource = readFileSync(
  "src/components/racing-statistic-lineage.ts",
  "utf8",
);
assert.doesNotMatch(lineageSource, /from ["']node:/);
assert.doesNotMatch(lineageSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Racing statistic lineage passed: every numeric column across 10 public racing routes has stored/planner authority and an explicit missing rule.",
);
