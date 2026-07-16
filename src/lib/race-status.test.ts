import assert from "node:assert/strict";

import {
  getRacePresentationStatus,
  isRaceEligibleForNextToGo,
  normaliseRaceSourceStatus,
  raceSchemaEventStatus,
  RACE_LIVE_WINDOW_MS,
} from "./race-status";

const now = new Date("2026-07-15T10:00:00.000Z");

assert.equal(normaliseRaceSourceStatus(" ABANDONED "), "abandoned");
assert.equal(normaliseRaceSourceStatus("race_abandoned"), "abandoned");
assert.equal(normaliseRaceSourceStatus("Meeting-Postponed"), "postponed");
assert.equal(normaliseRaceSourceStatus("posted"), "completed");
assert.equal(normaliseRaceSourceStatus("Scheduled"), null);
assert.equal(normaliseRaceSourceStatus("cancelled"), null);
assert.equal(normaliseRaceSourceStatus(null), null);
assert.equal(
  raceSchemaEventStatus("Abandoned"),
  "https://schema.org/EventCancelled",
);
assert.equal(
  raceSchemaEventStatus("Postponed"),
  "https://schema.org/EventPostponed",
);
assert.equal(
  raceSchemaEventStatus("posted"),
  "https://schema.org/EventScheduled",
);

assert.deepEqual(
  getRacePresentationStatus({
    resultStatus: "Abandoned",
    raceTime: new Date("2026-07-15T11:00:00.000Z"),
    now,
    hasResults: false,
    hasReplay: false,
  }),
  { key: "abandoned", label: "Abandoned", terminal: true },
  "an explicit source status must override a future start time",
);
assert.deepEqual(
  getRacePresentationStatus({
    resultStatus: "Postponed",
    raceTime: new Date("2026-07-15T09:55:00.000Z"),
    now,
    hasResults: false,
    hasReplay: false,
  }),
  { key: "postponed", label: "Postponed", terminal: true },
  "an explicit source status must override the live-time heuristic",
);
assert.equal(
  getRacePresentationStatus({
    resultStatus: "pending",
    raceTime: new Date(now.getTime() - RACE_LIVE_WINDOW_MS + 1),
    now,
    hasResults: false,
    hasReplay: false,
  }).key,
  "live",
);
assert.equal(
  getRacePresentationStatus({
    resultStatus: "pending",
    raceTime: new Date("2026-07-15T10:30:00.000Z"),
    now,
    hasResults: false,
    hasReplay: false,
  }).key,
  "upcoming",
);
assert.equal(
  getRacePresentationStatus({
    resultStatus: "posted",
    raceTime: new Date("2026-07-15T09:00:00.000Z"),
    now,
    hasResults: true,
    hasReplay: true,
  }).key,
  "replay",
);
assert.equal(
  getRacePresentationStatus({
    resultStatus: "Final",
    raceTime: new Date("2026-07-15T09:00:00.000Z"),
    now,
    hasResults: true,
    hasReplay: false,
  }).key,
  "completed",
);
assert.equal(
  getRacePresentationStatus({
    resultStatus: "pending",
    raceTime: new Date("2026-07-15T09:00:00.000Z"),
    now,
    hasResults: false,
    hasReplay: false,
  }).key,
  "awaiting-result",
  "elapsed time alone must not invent a completed result",
);

for (const resultStatus of ["Abandoned", "Postponed", "posted"]) {
  assert.equal(
    isRaceEligibleForNextToGo({
      resultStatus,
      raceTime: new Date("2026-07-15T10:05:00.000Z"),
      now,
    }),
    false,
    `${resultStatus} must not appear in next-to-go`,
  );
}
assert.equal(
  isRaceEligibleForNextToGo({
    resultStatus: "pending",
    raceTime: new Date("2026-07-15T10:05:00.000Z"),
    now,
  }),
  true,
);

console.log(
  "Race status helpers passed: explicit abandoned/postponed states take precedence and terminal races are excluded from next-to-go.",
);
