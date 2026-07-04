import assert from "node:assert/strict";

import { parseTheDogsMeeting } from "./thedogs";

const meeting = parseTheDogsMeeting(
  `
  <div class="meeting-header__venue__name">Wentworth Park</div>
  <div class="meeting-header__venue__state">NSW</div>
  <a class="race-header" href="/racing/wentworth-park/2026-01-15/1/sprint">
    <div class="race-header__info__name">Race 1</div>
    <div class="race-header__info__grade">Maiden 520m</div>
  </a>
  `,
  {
    href: "/racing/wentworth-park/2026-01-15?trial=false",
    name: "Wentworth Park",
    state: "NSW",
    date: "2026-01-15",
  }
);

assert.equal(meeting.races.length, 1);
assert.equal(meeting.races[0]?.raceTimeSource, "fallback");
assert.equal(meeting.races[0]?.raceTime, "2026-01-15T01:01:00.000Z");
assert.match(meeting.races[0]?.sourceRawJson ?? "", /"raceTimeSource":"fallback"/);

const meetingWithProviderTime = parseTheDogsMeeting(
  `
  <a class="race-box" href="/racing/wentworth-park/2026-01-15/1/sprint" data-race-box="2026-01-15T20:12:00+11:00"></a>
  <a class="race-header" href="/racing/wentworth-park/2026-01-15/1/sprint">
    <div class="race-header__info__name">Race 1</div>
    <div class="race-header__info__grade">Maiden 520m</div>
  </a>
  `,
  {
    href: "/racing/wentworth-park/2026-01-15?trial=false",
    name: "Wentworth Park",
    state: "NSW",
    date: "2026-01-15",
  }
);

assert.equal(meetingWithProviderTime.races[0]?.raceTimeSource, "provider");
assert.equal(meetingWithProviderTime.races[0]?.raceTime, "2026-01-15T09:12:00.000Z");

console.log("thedogs parser tests passed");
