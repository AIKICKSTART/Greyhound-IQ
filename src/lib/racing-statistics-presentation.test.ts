import assert from "node:assert/strict";

import {
  buildBoxBiasPresentation,
  formatBoxBiasAggregateSummary,
  formatBoxBiasRate,
  RACING_STATISTIC_UNAVAILABLE_LABEL,
} from "./racing-statistics-presentation";

const presentation = buildBoxBiasPresentation([
  { box: 1, starts: 0, wins: 0, winRate: null },
  { box: 3, starts: 10, wins: 1, winRate: 10 },
]);

assert.equal(presentation.length, 8);
assert.deepEqual(
  presentation.map(({ box }) => box),
  [1, 2, 3, 4, 5, 6, 7, 8],
);
assert.deepEqual(presentation[0], {
  box: 1,
  starts: 0,
  wins: 0,
  winRate: null,
  state: "missing",
});
assert.deepEqual(presentation[1], {
  box: 2,
  starts: null,
  wins: null,
  winRate: null,
  state: "missing",
});
assert.deepEqual(presentation[2], {
  box: 3,
  starts: 10,
  wins: 1,
  winRate: 10,
  state: "measured",
});
assert.equal(formatBoxBiasRate(presentation[0]), RACING_STATISTIC_UNAVAILABLE_LABEL);
assert.equal(formatBoxBiasRate(presentation[2]), "10%");
assert.equal(
  formatBoxBiasAggregateSummary([]),
  "No box-bias aggregate is available from the current read-only snapshot.",
);
assert.equal(
  formatBoxBiasAggregateSummary([
    { box: 1, starts: 0, wins: 0, winRate: null },
    { box: 3, starts: 1250, wins: 125, winRate: 10 },
  ]),
  "1,250 recorded starts in the current read-only box-bias snapshot.",
);

console.log(
  "Racing statistics presentation passed: all 8 boxes remain visible, zero starts do not invent a rate, and snapshot context is measured.",
);
