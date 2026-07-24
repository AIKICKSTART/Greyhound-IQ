import assert from "node:assert/strict";

import {
  aggregateResultsCompleteness,
  completenessAgeBucket,
} from "./results-completeness";

assert.equal(completenessAgeBucket(29), "under_30m");
assert.equal(completenessAgeBucket(30), "30m_to_90m");
assert.equal(completenessAgeBucket(90), "90m_to_6h");
assert.equal(completenessAgeBucket(360), "6h_to_48h");

const now = new Date("2026-07-24T00:00:00.000Z");
const [metric] = aggregateResultsCompleteness(
  [
    {
      raceTime: new Date("2026-07-23T22:00:00.000Z"),
      replayUrl: null,
      sourceProvider: "watchdog",
      meeting: { track: { name: "Test Track" } },
      runners: [
        {
          scratched: false,
          trainerId: null,
          weight: null,
          result: null,
        },
      ],
      videos: [],
    },
  ],
  now,
);
assert.equal(metric.staleResultRaces, 1);
assert.equal(metric.staleReplayRaces, 1);
assert.equal(metric.runners, 1);

console.log("recent results completeness tests passed");
