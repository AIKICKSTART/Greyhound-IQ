import assert from "node:assert/strict";

import {
  buildMeetingRacePresentation,
  buildMeetingSummary,
} from "./meeting-presentation";

const now = new Date("2026-07-15T10:00:00.000Z");
const completed = buildMeetingRacePresentation(
  {
    resultStatus: "Final",
    raceTime: new Date("2026-07-15T09:00:00.000Z"),
    replayUrl: null,
    _count: { runners: 8 },
    videos: [{ streamUrl: "https://media.example/replay.m3u8" }],
    runners: [
      {
        boxNumber: 2,
        dog: { id: "dog-1", name: "Stored Winner" },
        result: { finishingPosition: 1, runningTime: 29.82, margin: 1.25 },
      },
    ],
  },
  now,
);
assert.equal(completed.runnerCount, 8);
assert.equal(completed.resultCount, 1);
assert.equal(completed.hasReplay, true);
assert.equal(completed.status.key, "replay");
assert.equal(completed.winner?.dog.name, "Stored Winner");

const upcoming = buildMeetingRacePresentation(
  {
    resultStatus: null,
    raceTime: new Date("2026-07-15T11:00:00.000Z"),
    replayUrl: null,
    _count: { runners: 0 },
    videos: [],
    runners: [],
  },
  now,
);
assert.equal(upcoming.runnerCount, 0);
assert.equal(upcoming.resultCount, 0);
assert.equal(upcoming.status.key, "upcoming");
assert.equal(upcoming.winner, null);

assert.deepEqual(buildMeetingSummary([completed, upcoming]), {
  races: 2,
  runners: 8,
  racesWithResults: 1,
  replays: 1,
});
assert.deepEqual(buildMeetingSummary([]), {
  races: 0,
  runners: 0,
  racesWithResults: 0,
  replays: 0,
});

console.log(
  "Meeting presentation passed: summaries derive only from stored runner/result/replay rows and preserve valid zero counts.",
);
