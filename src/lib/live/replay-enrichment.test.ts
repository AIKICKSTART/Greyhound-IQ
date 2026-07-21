import assert from "node:assert/strict";

import {
  racingQueenslandTrackCode,
  saRaceReplayTitle,
} from "./replay-enrichment";

assert.equal(racingQueenslandTrackCode("Bet Nation Townsville"), "town");
assert.equal(racingQueenslandTrackCode("Ladbrokes Q Straight"), "qst ");
assert.equal(racingQueenslandTrackCode("BetDeluxe Capalaba"), "capa");
assert.equal(racingQueenslandTrackCode("Unknown Track"), null);

assert.equal(
  saRaceReplayTitle("Angle Park", "2026-07-20", 7),
  "Angle-Park-20072026-Race-7",
);
assert.equal(
  saRaceReplayTitle("Mount Gambier", "2026-07-20", 1),
  "Mt-Gambier-20072026-Race-1",
);
assert.equal(saRaceReplayTitle("", "2026-07-20", 1), null);

console.log("Live replay enrichment helper tests passed");
