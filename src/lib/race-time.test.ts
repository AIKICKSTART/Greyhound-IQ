import assert from "node:assert/strict";
import {
  formatRaceDateInput,
  formatRaceTime,
  normaliseRaceDateInput,
  raceClockTimeWindow,
  raceDateTimeToUtc,
  raceDateWindow,
} from "./race-time";

const winterRace = new Date("2026-07-09T12:35:00.000Z");
assert.equal(formatRaceTime(winterRace), "22:35");
assert.equal(formatRaceDateInput(winterRace), "2026-07-09");

const winterWindow = raceDateWindow("2026-07-09");
assert.equal(winterWindow.gte.toISOString(), "2026-07-08T14:00:00.000Z");
assert.equal(winterWindow.lt.toISOString(), "2026-07-09T14:00:00.000Z");

const summerWindow = raceDateWindow("2026-01-15");
assert.equal(summerWindow.gte.toISOString(), "2026-01-14T13:00:00.000Z");
assert.equal(summerWindow.lt.toISOString(), "2026-01-15T13:00:00.000Z");

const clockWindow = raceClockTimeWindow("2026-07-09", 22, 35);
assert.equal(clockWindow.gte.toISOString(), "2026-07-09T12:35:00.000Z");
assert.equal(clockWindow.lt.toISOString(), "2026-07-09T12:36:00.000Z");

assert.equal(
  raceDateTimeToUtc("2026-01-15", 12, 1).toISOString(),
  "2026-01-15T01:01:00.000Z"
);
assert.equal(
  raceDateTimeToUtc("2026-07-09", 12, 1).toISOString(),
  "2026-07-09T02:01:00.000Z"
);

assert.equal(normaliseRaceDateInput("2026-02-31"), null);
