import assert from "node:assert/strict";

import {
  embedUrlFromReplayPage,
  extractRacingQueenslandStreamUrl,
  normaliseLegacyRaceReplaySource,
  parseGreyhoundsWaVimeoVideos,
  parseSaRaceReplayVideoIds,
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
process.env.THEDOGS_LICENSED_USE_APPROVED = "true";
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
  extractRacingQueenslandStreamUrl(
    String.raw`{"src":"https:\/\/mediarqs.skyracing.com.au\/P\/V\/2026\/07\/05\/ABC.mp4?token=123"}`
  ),
  "https://mediarqs.skyracing.com.au/P/V/2026/07/05/ABC.mp4?token=123"
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
assert.deepEqual(
  parseGreyhoundsWaVimeoVideos(`
    {"name":"20260704R01","embedUrl":"https://player.vimeo.com/video/1206963174?h=abc"}
    {"name":"20260704R01","embedUrl":"https://player.vimeo.com/video/1206963175?h=def"}
  `),
  [],
  "conflicting WA videos for one race must remain quarantined"
);

const saAuthoritativeResult = `
  "videoRenderer":{"videoId":"Wld_KgyxlHc","title":{"runs":[{"text":"Angle-Park-07072026-Race-1"}]},"longBylineText":{"runs":[{"text":"SA Race Replay","navigationEndpoint":{"browseEndpoint":{"canonicalBaseUrl":"/@saracereplays"}}}]}}
`;
assert.deepEqual(
  parseSaRaceReplayVideoIds(
    saAuthoritativeResult,
    "Angle-Park-07072026-Race-1"
  ),
  ["Wld_KgyxlHc"]
);
assert.deepEqual(
  parseSaRaceReplayVideoIds(
    saAuthoritativeResult.replace("/@saracereplays", "/@unverified"),
    "Angle-Park-07072026-Race-1"
  ),
  [],
  "an exact title from an unverified channel must not be accepted"
);
assert.deepEqual(
  parseSaRaceReplayVideoIds(
    `${saAuthoritativeResult}${saAuthoritativeResult.replace(
      "Wld_KgyxlHc",
      "AbCdEfGhI12"
    )}`,
    "Angle-Park-07072026-Race-1"
  ),
  ["AbCdEfGhI12", "Wld_KgyxlHc"],
  "multiple authoritative ids remain visible so the caller can quarantine ambiguity"
);

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

assert.deepEqual(
  normaliseLegacyRaceReplaySource({
    sourceProvider: "thedogs",
    replayUrl: "/videos/watch/races/1263755/replay",
  }),
  {
    sourceProvider: "thedogs",
    sourceId: "1263755",
    pageUrl: "https://www.thedogs.com.au/videos/watch/races/1263755/replay",
    embedSourceType: "race-replay",
    streamUrl: null,
    streamContentType: null,
    sourceCode: "legacy-thedogs-race-replay-url",
  }
);
assert.deepEqual(
  normaliseLegacyRaceReplaySource({
    sourceProvider: "watchdog",
    replayUrl: "https://www.youtube.com/watch?v=abcDEF12345",
  }),
  {
    sourceProvider: "watchdog",
    sourceId: "abcDEF12345",
    pageUrl: "https://www.youtube-nocookie.com/embed/abcDEF12345",
    embedSourceType: "youtube",
    streamUrl: null,
    streamContentType: null,
    sourceCode: "legacy-youtube-replay-url",
  }
);
assert.deepEqual(
  normaliseLegacyRaceReplaySource({
    sourceProvider: "thedogs",
    replayUrl:
      "https://tasracing-race-replays.s3.ap-southeast-2.amazonaws.com/Hobart_R5_Side/index.m3u8",
  }),
  {
    sourceProvider: "tasracing",
    sourceId: "Hobart_R5_Side",
    pageUrl:
      "https://tasracing-race-replays.s3.ap-southeast-2.amazonaws.com/Hobart_R5_Side/index.m3u8",
    embedSourceType: "tasracing-hls",
    streamUrl:
      "https://tasracing-race-replays.s3.ap-southeast-2.amazonaws.com/Hobart_R5_Side/index.m3u8",
    streamContentType: "application/vnd.apple.mpegurl",
    sourceCode: "legacy-tasracing-replay-url",
  }
);
assert.equal(
  normaliseLegacyRaceReplaySource({
    sourceProvider: "thedogs",
    replayUrl: "/videos/watch/meetings/101486/preview",
  }),
  null,
  "meeting previews must remain quarantined instead of becoming race replays"
);
assert.equal(
  normaliseLegacyRaceReplaySource({
    sourceProvider: "thedogs",
    replayUrl: "https://attacker.example/replay.m3u8",
  }),
  null,
  "unknown replay hosts must remain quarantined"
);

console.log("race replay parser checks passed");
