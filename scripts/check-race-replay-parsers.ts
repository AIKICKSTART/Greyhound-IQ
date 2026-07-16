import assert from "node:assert/strict";

import {
  embedUrlFromReplayPage,
  extractRacingQueenslandStreamUrl,
  parseGreyhoundsWaVimeoVideos,
  parseTheDogsReplayCards,
  tasracingStreamUrl,
} from "../src/lib/live/race-replay";
import { absoluteTheDogsUrl } from "../src/lib/live/thedogs-replay";
import {
  proxiedStreamPath,
  verifyStreamCapability,
} from "../src/lib/live/replay-proxy";

// Stream proxy: allowed hosts sign+round-trip; foreign hosts and tampered
// signatures are rejected (prevents open-proxy / SSRF and hides source origin).
process.env.REPLAY_PROXY_SECRET ||= "test-secret-for-replay-proxy-check";
const nowMs = Date.UTC(2026, 6, 14, 0, 0, 0);
const signed = proxiedStreamPath(
  "https://d2w8yyjcswa0zt.cloudfront.net/abc.m3u8",
  nowMs
);
assert.ok(signed && signed.startsWith("/api/replay/stream?t="));
const proxyParams = new URLSearchParams(signed!.split("?")[1]);
const capability = proxyParams.get("t")!;
assert.equal(
  verifyStreamCapability(capability, nowMs),
  "https://d2w8yyjcswa0zt.cloudfront.net/abc.m3u8"
);
const tamperIndex = Math.floor(capability.length / 2);
const tampered = `${capability.slice(0, tamperIndex)}${
  capability[tamperIndex] === "A" ? "B" : "A"
}${capability.slice(tamperIndex + 1)}`;
assert.equal(
  verifyStreamCapability(tampered, nowMs),
  null
);
assert.equal(
  verifyStreamCapability(capability, nowMs + 11 * 60 * 1000),
  null
);
assert.equal(proxiedStreamPath("https://attacker.example/x.m3u8"), null);
assert.equal(
  proxiedStreamPath("http://d2w8yyjcswa0zt.cloudfront.net/insecure.m3u8"),
  null
);
assert.equal(proxiedStreamPath("http://169.254.169.254/x"), null);

// SSRF guard: absolute values must not escape the thedogs host before a fetch.
assert.equal(
  absoluteTheDogsUrl("/videos/watch/races/1/replay"),
  "https://www.thedogs.com.au/videos/watch/races/1/replay"
);
for (const evil of [
  "http://169.254.169.254/latest/meta-data/",
  "https://attacker.example/x",
  "//attacker.example/x",
  "file:///etc/passwd",
]) {
  assert.throws(() => absoluteTheDogsUrl(evil), /url_host_not_allowed|Invalid/);
}

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
