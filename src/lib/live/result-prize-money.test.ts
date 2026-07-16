import assert from "node:assert/strict";

import { parseTheDogsRaceResult } from "./thedogs";
import { mapRace } from "./topaz";
import { mapWatchdogPayload } from "./watchdog";

const theDogsRace = parseTheDogsRaceResult(
  `
  <div class="race-header__info__grade">Maiden 520m</div>
  <div class="race-header__info__name">Prize Test</div>
  <div class="race-header__prize__places">$1,500 - $450 - $225</div>
  <table>
    <tr class="race-runner">
      <td><sprite-svg name="rug_1"></sprite-svg></td>
      <td><a href="/dogs/101/fast-one"><div class="race-runners__name__dog">Fast One</div></a></td>
      <td class="race-runners__finish-position">1st</td>
      <td class="race-runners__time">30.12</td>
      <td class="race-runners__margin">0</td>
      <td class="race-runners__weight">31.2</td>
    </tr>
    <tr class="race-runner">
      <td><sprite-svg name="rug_2"></sprite-svg></td>
      <td><a href="/dogs/102/fast-two"><div class="race-runners__name__dog">Fast Two</div></a></td>
      <td class="race-runners__finish-position">2nd</td>
      <td class="race-runners__time">30.40</td>
      <td class="race-runners__margin">4</td>
      <td class="race-runners__weight">30.1</td>
    </tr>
    <tr class="race-runner">
      <td><sprite-svg name="rug_4"></sprite-svg></td>
      <td><a href="/dogs/104/fast-four"><div class="race-runners__name__dog">Fast Four</div></a></td>
      <td class="race-runners__finish-position">4th</td>
      <td class="race-runners__time">30.90</td>
      <td class="race-runners__margin">11</td>
      <td class="race-runners__weight">29.4</td>
    </tr>
  </table>
  `,
  {
    href: "/racing/wentworth-park/2026-01-15/1/prize-test",
    raceNumber: 1,
  },
  "2026-01-15"
);

assert.equal(theDogsRace?.runners[0]?.prizeMoneyWon, 1500);
assert.equal(theDogsRace?.runners[1]?.prizeMoneyWon, 450);
assert.equal(theDogsRace?.runners[2]?.prizeMoneyWon, 0);

const topazRace = mapRace({
  raceNumber: 1,
  raceStart: "2026-01-15T09:00:00.000Z",
  distance: 520,
  prizeMoney1: 1000,
  prizeMoney2: 300,
  runs: [
    { dogName: "Topaz One", boxNumber: 1, place: 2 },
    { dogName: "Topaz Two", boxNumber: 2, place: 1 },
    { dogName: "Topaz Three", boxNumber: 3, place: 3 },
  ],
});

assert.equal(topazRace.runners[0]?.prizeMoneyWon, 300);
assert.equal(topazRace.runners[1]?.prizeMoneyWon, 1000);
assert.equal(topazRace.runners[2]?.prizeMoneyWon, 0);

const [watchdogMeeting] = mapWatchdogPayload({
  meetings: [
    {
      id: 10,
      trackName: "Sandown Park",
      startTime: "2026-01-15T09:00:00.000Z",
    },
  ],
  races: [
    {
      id: 20,
      meetingId: 10,
      number: 1,
      distance: 515,
      firstPrize: 2000,
      secondPrize: 700,
      startTime: "2026-01-15T09:10:00.000Z",
    },
  ],
  participants: [
    { id: 1, raceId: 20, dogId: 101, box: 1, dogName: "Watch One", resultPlace: 1 },
    { id: 2, raceId: 20, dogId: 102, box: 2, dogName: "Watch Two", resultPlace: 2 },
    { id: 3, raceId: 20, dogId: 103, box: 3, dogName: "Watch Three", resultPlace: 3 },
  ],
});

assert.equal(watchdogMeeting?.races[0]?.runners[0]?.prizeMoneyWon, 2000);
assert.equal(watchdogMeeting?.races[0]?.runners[1]?.prizeMoneyWon, 700);
assert.equal(watchdogMeeting?.races[0]?.runners[2]?.prizeMoneyWon, 0);

console.log("result prize-money parser tests passed");
