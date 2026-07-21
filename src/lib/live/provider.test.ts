import assert from "node:assert/strict";

import {
  CompositeLiveProvider,
  getLiveProvider,
  getLiveProviderConfig,
  type LiveDataProvider,
  type LiveMeeting,
} from "./provider";

void main();

async function main() {
  theDogsRequiresLicensedUseApproval();
  watchdogRequiresExplicitOptIn();
  const calls: string[] = [];
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    const failingComposite = new CompositeLiveProvider([
      healthyProvider("thedogs", calls),
      failingProvider(calls),
    ]);

    await assert.rejects(
      failingComposite.fetchUpcomingMeetings(1),
      (err: Error) => err.message === "live.composite.provider_failed",
    );

    const healthyComposite = new CompositeLiveProvider([
      healthyProvider("thedogs", calls),
      healthyProvider("watchdog", calls),
    ]);
    const meetings = await healthyComposite.fetchResults(1);
    assert.deepEqual(
      meetings.map((item) => [
        item.sourceProvider,
        item.races[0]?.sourceProvider,
        item.races[0]?.runners[0]?.sourceProvider,
        item.races[0]?.runners[0]?.dog.sourceProvider,
      ]),
      [
        ["thedogs", "thedogs", "thedogs", "thedogs"],
        ["watchdog", "watchdog", "watchdog", "watchdog"],
      ],
    );
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
    ]
  );
  assert.equal(JSON.stringify(warnings).includes("secret-provider-token"), false);

  console.log("composite live provider tests passed");
}

function theDogsRequiresLicensedUseApproval() {
  const keys = [
    "THEDOGS_LICENSED_USE_APPROVED",
    "THEDOGS_PROVIDER_ENABLED",
    "TOPAZ_API_KEY",
    "WATCHDOG_PROVIDER_ENABLED",
    "FASTTRACK_PROTOTYPE_ENABLED",
  ] as const;
  const original = new Map(keys.map((key) => [key, process.env[key]]));

  try {
    delete process.env.TOPAZ_API_KEY;
    process.env.WATCHDOG_PROVIDER_ENABLED = "false";
    process.env.FASTTRACK_PROTOTYPE_ENABLED = "false";
    process.env.THEDOGS_PROVIDER_ENABLED = "true";

    for (const denied of [undefined, "", "false", "TRUE", " true", "1", "yes"]) {
      if (denied === undefined) delete process.env.THEDOGS_LICENSED_USE_APPROVED;
      else process.env.THEDOGS_LICENSED_USE_APPROVED = denied;
      assert.equal(theDogsConfig().configured, false);
      assert.equal(getLiveProvider(), null);
    }

    process.env.THEDOGS_LICENSED_USE_APPROVED = "true";
    delete process.env.THEDOGS_PROVIDER_ENABLED;
    assert.equal(theDogsConfig().configured, true);
    assert.equal(getLiveProvider()?.name, "thedogs");

    process.env.THEDOGS_PROVIDER_ENABLED = "false";
    assert.equal(theDogsConfig().configured, false);

    delete process.env.THEDOGS_LICENSED_USE_APPROVED;
    process.env.THEDOGS_PROVIDER_ENABLED = "true";
    process.env.WATCHDOG_PROVIDER_ENABLED = "true";
    assert.equal(getLiveProvider()?.name, "watchdog");
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function theDogsConfig() {
  const feed = getLiveProviderConfig().feeds.find((item) => item.name === "thedogs");
  assert.ok(feed);
  return feed;
}

function watchdogRequiresExplicitOptIn() {
  const original = process.env.WATCHDOG_PROVIDER_ENABLED;
  try {
    delete process.env.WATCHDOG_PROVIDER_ENABLED;
    assert.equal(watchdogConfig().configured, false);

    process.env.WATCHDOG_PROVIDER_ENABLED = "true";
    assert.equal(watchdogConfig().configured, true);
  } finally {
    if (original === undefined) delete process.env.WATCHDOG_PROVIDER_ENABLED;
    else process.env.WATCHDOG_PROVIDER_ENABLED = original;
  }
}

function watchdogConfig() {
  const feed = getLiveProviderConfig().feeds.find((item) => item.name === "watchdog");
  assert.ok(feed);
  return feed;
}

function healthyProvider(name: string, calls: string[]): LiveDataProvider {
  return {
    name,
    async fetchUpcomingMeetings() {
      calls.push(`${name}:upcoming`);
      return [meeting()];
    },
    async fetchResults() {
      calls.push(`${name}:results`);
      return [meeting()];
    },
  };
}

function failingProvider(calls: string[]): LiveDataProvider {
  return {
    name: "watchdog",
    async fetchUpcomingMeetings() {
      calls.push("watchdog:upcoming");
      throw new Error("Authorization: Bearer secret-provider-token");
    },
    async fetchResults() {
      calls.push("watchdog:results");
      throw new Error("Authorization: Bearer secret-provider-token");
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
        runners: [
          {
            sourceId: "runner-1",
            boxNumber: 1,
            dog: { sourceId: "dog-1", name: "Safe Dog" },
          },
        ],
      },
    ],
  };
}
