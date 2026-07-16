import assert from "node:assert/strict";

import {
  CompositeLiveProvider,
  type LiveDataProvider,
  type LiveMeeting,
} from "./provider";

void main();

async function main() {
  const calls: string[] = [];
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    const provider = new CompositeLiveProvider([
      healthyProvider(calls),
      failingProvider(calls),
    ]);

    for (const operation of [
      "fetchUpcomingMeetings",
      "fetchResults",
    ] as const) {
      const meetings = await provider[operation](1);
      assert.equal(meetings.length, 1);
      assert.equal(meetings[0]?.sourceProvider, "thedogs");
      assert.equal(meetings[0]?.races[0]?.sourceProvider, "thedogs");
    }
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(calls, [
    "thedogs:upcoming",
    "watchdog:upcoming",
    "thedogs:results",
    "watchdog:results",
  ]);
  assert.deepEqual(
    warnings.map(([line]) => {
      const log = JSON.parse(String(line)) as Record<string, unknown>;
      return [log.event, log.provider, log.operation];
    }),
    [
      ["live.composite.provider_failed", "watchdog", "fetchUpcomingMeetings"],
      ["live.composite.provider_failed", "watchdog", "fetchResults"],
    ]
  );

  console.log("composite live provider tests passed");
}

function healthyProvider(calls: string[]): LiveDataProvider {
  return {
    name: "thedogs",
    async fetchUpcomingMeetings() {
      calls.push("thedogs:upcoming");
      return [meeting()];
    },
    async fetchResults() {
      calls.push("thedogs:results");
      return [meeting()];
    },
  };
}

function failingProvider(calls: string[]): LiveDataProvider {
  return {
    name: "watchdog",
    async fetchUpcomingMeetings() {
      calls.push("watchdog:upcoming");
      throw new Error("watchdog.response_invalid");
    },
    async fetchResults() {
      calls.push("watchdog:results");
      throw new Error("watchdog.response_invalid");
    },
  };
}

function meeting(): LiveMeeting {
  return {
    trackName: "Wentworth Park",
    meetingDate: "2026-07-16T00:00:00.000Z",
    races: [
      {
        raceNumber: 1,
        raceTime: "2026-07-16T09:00:00.000Z",
        distance: 520,
        runners: [],
      },
    ],
  };
}
