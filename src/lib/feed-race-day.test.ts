import assert from "node:assert/strict";

import { buildFeedRaceDayData } from "./feed-race-day";

const now = new Date("2026-07-16T10:00:00.000Z");
const data = buildFeedRaceDayData(
  [
    {
      id: "meeting-nsw",
      track: { name: "Wentworth Park", state: "NSW" },
      races: [
        race("live", "2026-07-16T09:58:00.000Z", 5),
        race("abandoned", "2026-07-16T10:20:00.000Z", 6, "Abandoned"),
        race("next", "2026-07-16T10:30:00.000Z", 7),
      ],
    },
    {
      id: "meeting-vic",
      track: { name: "Sandown Park", state: "VIC" },
      races: [
        race("completed", "2026-07-16T09:00:00.000Z", 3, "Final"),
        race("later", "2026-07-16T11:00:00.000Z", 8),
      ],
    },
  ],
  now,
);

assert.equal(data.meetingCount, 2);
assert.equal(data.raceCount, 5);
assert.equal(data.stateLabel, "NSW, VIC");
assert.deepEqual(
  data.nextRaces.map(({ id, statusLabel }) => [id, statusLabel]),
  [
    ["live", "Live"],
    ["next", "30 min"],
    ["later", "1 hr"],
  ],
  "only real live/upcoming races should enter the command strip in time order",
);

assert.deepEqual(buildFeedRaceDayData([], now), {
  meetingCount: 0,
  raceCount: 0,
  stateLabel: "No meetings available",
  nextRaces: [],
});

console.log("Feed race-day data passed: stored counts, ordering, status filtering, and empty state are exact.");

function race(
  id: string,
  raceTime: string,
  raceNumber: number,
  resultStatus: string | null = null,
) {
  return {
    id,
    raceNumber,
    raceTime: new Date(raceTime),
    distance: 520,
    resultStatus,
    videos: [],
  };
}
