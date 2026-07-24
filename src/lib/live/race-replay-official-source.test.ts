import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  contentSecurityPolicy,
  PHOTO_FINISH_IMAGE_ORIGIN,
  safePhotoFinishSrc,
} from "../csp";
import {
  embedUrlFromReplayPage,
  officialRaceReplayUrl,
  replayPlaybackState,
  resolveRaceVideoReplay,
} from "./race-replay";

const allowed = [
  [
    "watchdog",
    "https://www.youtube.com/watch?v=abcDEF12345",
    "https://www.youtube.com/watch?v=abcDEF12345",
  ],
  [
    "watchdog",
    "https://watchdog.grv.org.au/meeting/12345/race/8",
    "https://watchdog.grv.org.au/meeting/12345/race/8",
  ],
  [
    "sa-race-replay",
    "https://youtu.be/abcDEF12345",
    "https://www.youtube.com/watch?v=abcDEF12345",
  ],
  [
    "greyhoundswa",
    "https://player.vimeo.com/video/1206963174?h=abc123",
    "https://player.vimeo.com/video/1206963174?h=abc123",
  ],
  [
    "thedogs",
    "https://www.thedogs.com.au/videos/watch/races/1263755/replay",
    "https://www.thedogs.com.au/videos/watch/races/1263755/replay",
  ],
  [
    "racing-queensland",
    "https://www.racingqueensland.com.au/racing/replays/tab-race-replays/race-player/greyhound/albi/20160214/race/1",
    "https://www.racingqueensland.com.au/racing/replays/tab-race-replays/race-player/greyhound/albi/20160214/race/1",
  ],
  [
    "racing-queensland",
    "https://www.racingqueensland.com.au/racing/replays/tab-race-replays/race-player/greyhound/qot%20/20260722/race/9",
    "https://www.racingqueensland.com.au/racing/replays/tab-race-replays/race-player/greyhound/qot%20/20260722/race/9",
  ],
  [
    "tasracing",
    "https://form.tasracing.com.au/replays/HGRC-20260722?race=6",
    "https://form.tasracing.com.au/replays/HGRC-20260722?race=6",
  ],
] as const;

for (const [sourceProvider, pageUrl, expected] of allowed) {
  assert.equal(
    officialRaceReplayUrl({ sourceProvider, pageUrl, sourceStatus: 200 }),
    expected,
  );
}

for (const [sourceProvider, pageUrl, sourceStatus] of [
  ["watchdog", "http://www.youtube.com/watch?v=abcDEF12345", 200],
  ["watchdog", "https://user:secret@www.youtube.com/watch?v=abcDEF12345", 200],
  ["watchdog", "https://www.youtube.com:8443/watch?v=abcDEF12345", 200],
  ["watchdog", "https://www.youtube.com/watch?v=abcDEF12345&next=evil", 200],
  ["watchdog", "https://youtube.example/watch?v=abcDEF12345", 200],
  ["youtube", "https://www.youtube.com/watch?v=abcDEF12345", 200],
  ["greyhoundswa", "https://player.vimeo.com/video/1206963174?h=abc&x=1", 200],
  ["thedogs", "https://www.thedogs.com.au/racing/meeting/1", 200],
  [
    "racing-queensland",
    "https://www.racingqueensland.com.au/racing/replays/tab-race-replays",
    200,
  ],
  [
    "racing-queensland",
    "https://www.racingqueensland.com.au/racing/replays/tab-race-replays/race-player/greyhound/q%20ot/20260722/race/9",
    200,
  ],
  [
    "racing-queensland",
    "https://www.racingqueensland.com.au/racing/replays/tab-race-replays/race-player/greyhound/qot%2Fbad/20260722/race/9",
    200,
  ],
  [
    "racing-queensland",
    "https://www.racingqueensland.com.au/racing/replays/tab-race-replays/race-player/greyhound/qot%09/20260722/race/9",
    200,
  ],
  ["tasracing", "https://form.tasracing.com.au/replays/HGRC-20260722", 200],
  ["tasracing", "https://form.tasracing.com.au/replays/HGRC-20260722?race=6&x=1", 200],
] as const) {
  assert.equal(
    officialRaceReplayUrl({ sourceProvider, pageUrl, sourceStatus }),
    null,
    pageUrl,
  );
}

assert.equal(
  officialRaceReplayUrl({
    sourceProvider: "thedogs",
    pageUrl: "https://www.thedogs.com.au/videos/watch/races/1263755/replay",
    sourceStatus: null,
  }),
  "https://www.thedogs.com.au/videos/watch/races/1263755/replay",
  "unknown status remains linkable",
);
assert.equal(
  officialRaceReplayUrl({
    sourceProvider: "sa-race-replay",
    pageUrl: "https://www.youtube.com/watch?v=abcDEF12345",
    sourceStatus: 500,
  }),
  "https://www.youtube.com/watch?v=abcDEF12345",
  "provider HTTP status remains diagnostic when a trusted playback URL exists",
);
assert.equal(
  replayPlaybackState({
    sourceProvider: "thedogs",
    pageUrl: "https://www.thedogs.com.au/videos/watch/races/1263755/replay",
    embedSourceType: "race-replay",
    sourceStatus: 500,
  }),
  "external",
  "a provider replay page is not marked embedded until it resolves to a stream or trusted embed URL",
);
assert.equal(
  replayPlaybackState({
    sourceProvider: "watchdog",
    pageUrl: "https://www.youtube.com/watch?v=abcDEF12345",
    verificationStatus: "failed",
  }),
  "failed",
  "a confirmed dead source must not remain embedded",
);

assert.ok(embedUrlFromReplayPage(allowed[0][2]), "official YouTube replays embed");
assert.ok(embedUrlFromReplayPage(allowed[3][2]), "official Vimeo replays embed");
async function assertMisfiledYoutubeStreamEmbeds() {
  assert.deepEqual(
    await resolveRaceVideoReplay({
      sourceProvider: "watchdog",
      pageUrl: "https://www.youtube.com/watch?v=abcDEF12345",
      streamUrl: "https://www.youtube.com/watch?v=abcDEF12345",
      embedSourceType: "youtube",
    }),
    {
      pageUrl: "https://www.youtube.com/watch?v=abcDEF12345",
      streamUrl: null,
      streamContentType: null,
      title: null,
      description: null,
      sourceStatus: null,
      sourceCode: null,
      embedUrl: "https://www.youtube-nocookie.com/embed/abcDEF12345",
      embedType: "youtube",
    },
    "a YouTube watch URL misfiled as streamUrl must still become an embed",
  );
  assert.equal(
    await resolveRaceVideoReplay({
      sourceProvider: "watchdog",
      pageUrl: "https://www.youtube.com/watch?v=abcDEF12345",
      verificationStatus: "failed",
    }),
    null,
    "a confirmed dead source must not resolve to an iframe",
  );
}

assert.equal(
  safePhotoFinishSrc(`${PHOTO_FINISH_IMAGE_ORIGIN}/photos/Photo Finish 1.jpg`),
  `${PHOTO_FINISH_IMAGE_ORIGIN}/photos/Photo%20Finish%201.jpg`,
);
for (const unsafePhotoUrl of [
  `http://${new URL(PHOTO_FINISH_IMAGE_ORIGIN).host}/photos/finish.jpg`,
  `https://user:secret@${new URL(PHOTO_FINISH_IMAGE_ORIGIN).host}/photos/finish.jpg`,
  `${PHOTO_FINISH_IMAGE_ORIGIN}.example/photos/finish.jpg`,
  `${PHOTO_FINISH_IMAGE_ORIGIN}:8443/photos/finish.jpg`,
  `${PHOTO_FINISH_IMAGE_ORIGIN}/photos/finish.jpg?sv=2026&sig=secret`,
  `${PHOTO_FINISH_IMAGE_ORIGIN}/photos/finish.jpg#fragment`,
  "data:image/jpeg;base64,AA==",
  "not a URL",
]) {
  assert.equal(safePhotoFinishSrc(unsafePhotoUrl), null, unsafePhotoUrl);
}

const cspDirectives = contentSecurityPolicy("test-nonce").split("; ");
const photoFinishDirectives = cspDirectives.filter((directive) =>
  directive.includes(PHOTO_FINISH_IMAGE_ORIGIN),
);
assert.deepEqual(photoFinishDirectives, [
  cspDirectives.find((directive) => directive.startsWith("img-src ")),
]);

const pageSource = readFileSync("src/app/races/[id]/page.tsx", "utf8");
assert.match(pageSource, /Watch on official source/);
assert.doesNotMatch(
  pageSource,
  /This provider supplies its replay on the official website\./,
);
assert.match(pageSource, /target="_blank"/);
assert.match(pageSource, /rel="noopener noreferrer"/);
// The page may render an inline player only after provider-rights authorization
// creates a same-origin capability; raw stream URLs must never reach the client.
assert.match(pageSource, /const replayStreamUrl = authorisedReplayStreamPath\(/);
assert.match(pageSource, /const proxiedStream = authorisedReplayStreamPath\(/);
const streamUrlProps = [...pageSource.matchAll(/streamUrl=\{([^}]+)\}/g)].map(
  (match) => match[1],
);
assert.deepEqual(
  [...new Set(streamUrlProps)].sort(),
  ["proxiedStream", "replayStreamUrl"],
  "RaceReplayPlayer must only receive proxied stream paths",
);
assert.match(pageSource, /const orderedVideos = \[\.\.\.race\.videos\]\.sort\(/);
assert.match(pageSource, /for \(const video of orderedVideos\)/);
assert.match(pageSource, /await resolveRaceVideoReplay\(video\)/);
assert.doesNotMatch(pageSource, /\bdownload\b/i);
assert.doesNotMatch(
  pageSource,
  /videos\.length === 0/,
  "an invalid RaceVideo row must not hide a valid legacy replay URL",
);
assert.match(
  pageSource,
  /replayCandidates\[0\]\?\.officialUrl \?\?\s+officialRaceReplayUrl\(/,
);
assert.match(pageSource, /safePhotoFinishSrc\(race\.photoFinishUrl\)/);
assert.match(pageSource, /Official photo finish/);

assertMisfiledYoutubeStreamEmbeds()
  .then(() => console.log("official race replay source checks passed"))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
