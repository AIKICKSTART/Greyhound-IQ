import assert from "node:assert/strict";

import {
  buildRaceDetailHref,
  buildRaceListReturnHref,
  normaliseRaceListContext,
  parseRaceListContext,
  resolveMeetingRaceNavigation,
} from "./race-navigation";

const races = [
  { id: "r3", raceNumber: 3, raceTime: new Date("2026-07-15T10:30:00Z") },
  { id: "r1", raceNumber: 1, raceTime: new Date("2026-07-15T10:00:00Z") },
  { id: "r2", raceNumber: 2, raceTime: new Date("2026-07-15T10:15:00Z") },
] as const;

assert.deepEqual(resolveMeetingRaceNavigation(races, "r2"), {
  previous: races[1],
  next: races[0],
  position: 2,
  total: 3,
});
assert.deepEqual(resolveMeetingRaceNavigation(races, "r1"), {
  previous: null,
  next: races[2],
  position: 1,
  total: 3,
});
assert.deepEqual(resolveMeetingRaceNavigation(races, "r3"), {
  previous: races[2],
  next: null,
  position: 3,
  total: 3,
});
assert.deepEqual(resolveMeetingRaceNavigation(races, "missing"), {
  previous: null,
  next: null,
  position: null,
  total: 3,
});
assert.deepEqual(resolveMeetingRaceNavigation([], "missing"), {
  previous: null,
  next: null,
  position: null,
  total: 0,
});

const listContext = normaliseRaceListContext({
  date: "2026-07-15",
  state: "nsw",
  query: "  Wentworth   Park  ",
  status: "live",
  sort: "relevance",
  meetingId: "meeting_123",
});
assert.deepEqual(listContext, {
  date: "2026-07-15",
  state: "NSW",
  query: "Wentworth Park",
  status: "live",
  sort: "relevance",
  meetingId: "meeting_123",
});
assert.equal(
  buildRaceDetailHref("race/unsafe", listContext),
  "/races/race%2Funsafe?fromDate=2026-07-15&fromState=NSW&fromQ=Wentworth+Park&fromStatus=live&fromSort=relevance&fromMeeting=meeting_123",
);
assert.equal(
  buildRaceListReturnHref(listContext),
  "/races?date=2026-07-15&state=NSW&q=Wentworth+Park&status=live&sort=relevance#meeting-meeting_123",
);
assert.deepEqual(
  parseRaceListContext({
    fromDate: "2026-07-15",
    fromState: "NSW",
    fromQ: "Wentworth Park",
    fromStatus: "live",
    fromSort: "relevance",
    fromMeeting: "meeting_123",
  }),
  listContext,
);
assert.equal(parseRaceListContext({ unrelated: "value" }), null);
assert.deepEqual(
  parseRaceListContext({
    fromDate: "javascript:alert(1)",
    fromState: "../../etc",
    fromQ: " q ",
    fromStatus: "unknown",
    fromSort: "DROP TABLE",
    fromMeeting: "bad/anchor",
  }),
  {
    date: null,
    state: null,
    query: "q",
    status: "all",
    sort: "time",
    meetingId: null,
  },
);

console.log("Meeting race navigation helper tests passed");
