import assert from "node:assert/strict";

import {
  buildFeedRaceDayData,
  listRacingDayTrackOptions,
  selectRacingDayMeetings,
} from "./feed-race-day";
import { parseRacingDayTrackIds } from "./feed-racing-day";

const now = new Date("2026-07-16T10:00:00.000Z");
const meetings = [
  {
    id: "meeting-nsw",
    track: { id: "track-nsw", name: "Wentworth Park", state: "NSW" },
    races: [
      race("live", "2026-07-16T09:58:00.000Z", 5),
      race("abandoned", "2026-07-16T10:20:00.000Z", 6, "Abandoned"),
      race("next", "2026-07-16T10:30:00.000Z", 7),
    ],
  },
  {
    id: "meeting-vic",
    track: { id: "track-vic", name: "Sandown Park", state: "VIC" },
    races: [
      race("completed", "2026-07-16T09:00:00.000Z", 3, "Final"),
      race("later", "2026-07-16T11:00:00.000Z", 8),
    ],
  },
];
const data = buildFeedRaceDayData(meetings, now);

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
  claimedDogCount: 0,
  claimedTrainerCount: 0,
  myRaces: [],
  nextRaces: [],
});

// "My racing day" selection filters meetings by track id; empty keeps all.
assert.deepEqual(
  selectRacingDayMeetings(meetings, ["track-vic"]).map((m) => m.id),
  ["meeting-vic"],
);
assert.deepEqual(
  selectRacingDayMeetings(meetings, []).map((m) => m.id),
  ["meeting-nsw", "meeting-vic"],
  "empty selection is the current all-meetings behaviour",
);
assert.deepEqual(
  selectRacingDayMeetings(meetings, undefined).map((m) => m.id),
  ["meeting-nsw", "meeting-vic"],
);
assert.deepEqual(
  selectRacingDayMeetings(meetings, ["track-missing"]).map((m) => m.id),
  ["meeting-nsw", "meeting-vic"],
  "a stale selection matching no track today falls back to all meetings",
);
assert.deepEqual(
  selectRacingDayMeetings(meetings, ["track-vic"], ["next"]).map((m) => m.id),
  ["meeting-nsw", "meeting-vic"],
  "an approved claimed dog's race remains in My Race Day outside selected tracks",
);
assert.equal(
  buildFeedRaceDayData(selectRacingDayMeetings(meetings, ["track-vic"]), now)
    .meetingCount,
  1,
);

const personalised = buildFeedRaceDayData(meetings, now, [
  {
    raceId: "later",
    dogId: "dog-1",
    dogName: "Paw Example",
    trainerId: "trainer-1",
    trainerName: "Jane Trainer",
    claimSources: ["trainer"],
  },
]);
assert.equal(personalised.claimedDogCount, 1);
assert.deepEqual(
  personalised.myRaces.map(({ id, claimedDogs }) => [
    id,
    claimedDogs[0]?.name,
    claimedDogs[0]?.trainerName,
  ]),
  [["later", "Paw Example", "Jane Trainer"]],
  "approved dog claims should surface their upcoming race with official trainer data",
);
assert.equal(personalised.claimedTrainerCount, 1);

// Track options are de-duplicated and ordered by state then name.
assert.deepEqual(
  listRacingDayTrackOptions(meetings).map((t) => t.id),
  ["track-nsw", "track-vic"],
);

// Stored preference parsing tolerates junk and bounds the list.
assert.deepEqual(parseRacingDayTrackIds(null), []);
assert.deepEqual(parseRacingDayTrackIds("not json"), []);
assert.deepEqual(parseRacingDayTrackIds('{"a":1}'), []);
assert.deepEqual(parseRacingDayTrackIds('["track-vic",1,"track-vic"]'), [
  "track-vic",
]);

console.log("Feed race-day data passed: stored counts, ordering, status filtering, selection, options, and empty state are exact.");

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
