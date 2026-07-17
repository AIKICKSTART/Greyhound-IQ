import assert from "node:assert/strict";

import {
  buildRacingDataDisclosure,
  RACING_RESULT_FRESHNESS_WARNING_MS,
} from "./racing-data-disclosure";

const now = new Date("2026-07-15T12:00:00.000Z");

assert.deepEqual(
  buildRacingDataDisclosure(
    {
      timestamp: now.toISOString(),
      data: {
        database: "ok",
        liveProviders: [
          { name: "watchdog" },
          { name: "thedogs" },
          { name: "watchdog" },
          { name: null },
        ],
        latestResultAt: new Date(
          now.getTime() - RACING_RESULT_FRESHNESS_WARNING_MS,
        ).toISOString(),
      },
    },
    now,
  ),
  {
    providers: ["The Dogs", "Watchdog"],
    providerLabel: "The Dogs, Watchdog",
    latestResultAt: "2026-07-14T12:00:00.000Z",
    latestResultLabel: "14 July 2026, 10:00 pm",
    checkedAt: "2026-07-15T12:00:00.000Z",
    checkedAtLabel: "15 July 2026, 10:00 pm",
    state: "current",
    stateLabel: "Latest synced result is within 24 hours",
  },
);

assert.equal(
  buildRacingDataDisclosure(
    {
      timestamp: now.toISOString(),
      data: {
        database: "ok",
        liveProviders: [{ name: "thedogs" }],
        latestResultAt: new Date(
          now.getTime() - RACING_RESULT_FRESHNESS_WARNING_MS - 1,
        ).toISOString(),
      },
    },
    now,
  ).state,
  "stale",
);

const unavailable = buildRacingDataDisclosure(
  {
    timestamp: "not-a-date",
    data: {
      database: "error",
      liveProviders: [],
      latestResultAt: null,
    },
  },
  now,
);
assert.equal(unavailable.providerLabel, "No loaded provider attribution");
assert.equal(unavailable.latestResultLabel, "Not available");
assert.equal(unavailable.checkedAt, now.toISOString());
assert.equal(unavailable.state, "unavailable");
assert.match(unavailable.stateLabel, /verify data/i);

console.log(
  "Racing data disclosure helpers passed: provider attribution, exact as-of time and 24-hour stale/unavailable states remain deterministic.",
);
