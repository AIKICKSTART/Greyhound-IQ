import assert from "node:assert/strict";
import {
  orderMeetingsByFirstRaceTime,
  parseRaceSearchQuery,
  resolveRaceSearchDate,
} from "./queries";

const meetings = orderMeetingsByFirstRaceTime([
  {
    id: "late",
    sourceProvider: "thedogs",
    track: { name: "Meadows", state: "VIC" },
    races: [
      { raceNumber: 2, raceTime: new Date("2026-07-04T10:30:00.000Z"), distance: 525 },
      { raceNumber: 1, raceTime: new Date("2026-07-04T10:10:00.000Z"), distance: 525 },
    ],
  },
  {
    id: "duplicate-late",
    sourceProvider: "watchdog",
    track: { name: "The Meadows", state: "VIC" },
    races: [
      { raceNumber: 1, raceTime: new Date("2026-07-04T10:10:00.000Z"), distance: 525 },
      { raceNumber: 2, raceTime: new Date("2026-07-04T10:30:00.000Z"), distance: 525 },
    ],
  },
  {
    id: "empty",
    sourceProvider: null,
    track: { name: "Empty", state: "NSW" },
    races: [],
  },
  {
    id: "early",
    sourceProvider: null,
    track: { name: "Alpha", state: "NSW" },
    races: [
      { raceNumber: 1, raceTime: new Date("2026-07-04T09:00:00.000Z"), distance: 300 },
    ],
  },
]);

assert.deepEqual(
  meetings.map((meeting) => meeting.id),
  ["early", "late", "empty"]
);
assert.deepEqual(
  meetings[1].races.map((race) => race.raceTime.toISOString()),
  ["2026-07-04T10:10:00.000Z", "2026-07-04T10:30:00.000Z"]
);

assert.deepEqual(parseRaceSearchQuery("dubbo race 3"), {
  raceNumber: 3,
  distance: null,
  clockTime: null,
  text: "dubbo",
});
assert.deepEqual(parseRaceSearchQuery("dubbo r3"), {
  raceNumber: 3,
  distance: null,
  clockTime: null,
  text: "dubbo",
});
assert.deepEqual(parseRaceSearchQuery("sandown 19:30"), {
  raceNumber: null,
  distance: null,
  clockTime: { hour: 19, minute: 30 },
  text: "sandown",
});
assert.deepEqual(parseRaceSearchQuery("race 11 sandown"), {
  raceNumber: 11,
  distance: null,
  clockTime: null,
  text: "sandown",
});
assert.deepEqual(parseRaceSearchQuery("Grafton race 2 350m 7:12pm"), {
  raceNumber: 2,
  distance: 350,
  clockTime: { hour: 19, minute: 12 },
  text: "Grafton",
});
assert.deepEqual(resolveRaceSearchDate(null, "Casino", "2026-07-04"), {
  selectedDate: "2026-07-04",
  dateInputValue: "",
  isGlobalSearch: true,
});
assert.deepEqual(resolveRaceSearchDate("2026-06-30", "Casino", "2026-07-04"), {
  selectedDate: "2026-06-30",
  dateInputValue: "2026-06-30",
  isGlobalSearch: false,
});
