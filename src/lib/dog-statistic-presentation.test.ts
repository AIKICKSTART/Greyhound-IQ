import assert from "node:assert/strict";

import {
  formatDogPrizeMoney,
  formatDogWinRate,
} from "./dog-statistic-presentation";

assert.deepEqual(formatDogPrizeMoney(0), { state: "measured", text: "$0" });
assert.deepEqual(formatDogPrizeMoney(12500), {
  state: "measured",
  text: "$12,500",
});
assert.deepEqual(formatDogPrizeMoney(null), {
  state: "missing",
  text: "Not available",
});
assert.deepEqual(formatDogWinRate({ wins: 0, starts: 0 }), {
  state: "missing",
  text: "Not available",
});
assert.deepEqual(formatDogWinRate({ wins: 2, starts: 8 }), {
  state: "measured",
  text: "25.0%",
});
assert.deepEqual(formatDogWinRate({ wins: 9, starts: 8 }), {
  state: "missing",
  text: "Not available",
});

console.log(
  "Dog statistic presentation passed: measured $0 remains visible and undefined win rates are never manufactured.",
);
