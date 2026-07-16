import assert from "node:assert/strict";

import {
  formatRaceMetric,
  formatRaceScheduleSummary,
  RACE_METRIC_UNAVAILABLE_LABEL,
} from "./race-metric";

assert.deepEqual(formatRaceMetric(0), { state: "measured", text: "0" });
assert.deepEqual(formatRaceMetric(12500), {
  state: "measured",
  text: "12,500",
});
assert.deepEqual(formatRaceMetric(null), {
  state: "missing",
  text: RACE_METRIC_UNAVAILABLE_LABEL,
});
assert.deepEqual(formatRaceMetric(undefined), {
  state: "missing",
  text: RACE_METRIC_UNAVAILABLE_LABEL,
});
assert.deepEqual(formatRaceMetric(Number.NaN), {
  state: "missing",
  text: RACE_METRIC_UNAVAILABLE_LABEL,
});

assert.equal(
  formatRaceScheduleSummary({ meetings: 0, races: 0 }),
  "0 meetings / 0 races on this schedule.",
);
assert.equal(
  formatRaceScheduleSummary({ meetings: null, races: 0 }),
  "Meeting and race totals are not available for this schedule.",
);

console.log(
  "Race metric helpers passed: measured zero stays 0 while missing and invalid values remain visibly unavailable.",
);
