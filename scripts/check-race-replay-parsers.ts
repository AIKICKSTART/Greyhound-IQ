import assert from "node:assert/strict";

import {
  embedUrlFromReplayPage,
  extractRacingQueenslandStreamUrl,
  parseGreyhoundsWaVimeoVideos,
  parseTheDogsReplayCards,
  tasracingStreamUrl,
} from "../src/lib/live/race-replay";

const theDogsCards = parseTheDogsReplayCards(`
  <a data-turbolinks-action="video" class="video-card" href="/videos/watch/races/1263755/replay">
    <div class="video-card__title">BetDeluxe Capalaba Race 1</div>
  </a>
`);
assert.equal(theDogsCards.length, 1);
assert.deepEqual(theDogsCards[0], {
  raceNumber: 1,
  videoSourceId: "1263755",
  pageUrl: "/videos/watch/races/1263755/replay",
  trackName: "BetDeluxe Capalaba",
  title: "BetDeluxe Capalaba Race 1",
});

assert.equal(
  extractRacingQueenslandStreamUrl(`
    <source src="https://mediarqs.skyracing.com.au/P/V/2026/07/05/ABC.mp4?hdnts=abc&amp;token=123">
  `),
  "https://mediarqs.skyracing.com.au/P/V/2026/07/05/ABC.mp4?hdnts=abc&token=123"
);

assert.equal(
  tasracingStreamUrl("Hobart_Greyhounds_02_07_2026_Race_1_Side"),
  "https://tasracing-race-replays.s3.ap-southeast-2.amazonaws.com/Hobart_Greyhounds_02_07_2026_Race_1_Side/index.m3u8"
);
assert.equal(tasracingStreamUrl("../not-public"), null);

const waVideos = parseGreyhoundsWaVimeoVideos(`
  {"name":"20260704R01","embedUrl":"https://player.vimeo.com/video/1206963174?h=abc"}
`);
assert.deepEqual(waVideos, [
  {
    raceNumber: 1,
    videoId: "1206963174",
    pageUrl: "https://player.vimeo.com/video/1206963174?h=abc",
  },
]);

assert.deepEqual(embedUrlFromReplayPage("https://youtu.be/abcDEF12345"), {
  type: "youtube",
  embedUrl: "https://www.youtube-nocookie.com/embed/abcDEF12345",
});
assert.deepEqual(embedUrlFromReplayPage("https://vimeo.com/1206963174"), {
  type: "vimeo",
  embedUrl: "https://player.vimeo.com/video/1206963174",
});
assert.deepEqual(
  embedUrlFromReplayPage("https://player.vimeo.com/video/1206963174?h=abc"),
  {
    type: "vimeo",
    embedUrl: "https://player.vimeo.com/video/1206963174?h=abc",
  }
);

console.log("race replay parser checks passed");
