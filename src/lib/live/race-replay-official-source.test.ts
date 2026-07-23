import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  contentSecurityPolicy,
  PHOTO_FINISH_IMAGE_ORIGIN,
  safePhotoFinishSrc,
} from "../csp";
import { embedUrlFromReplayPage, officialRaceReplayUrl } from "./race-replay";

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
  ["sa-race-replay", "https://www.youtube.com/watch?v=abcDEF12345", 404],
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
  "unknown status remains linkable; only known non-2xx rows fail closed",
);

assert.ok(embedUrlFromReplayPage(allowed[0][2]), "official YouTube replays embed");
assert.ok(embedUrlFromReplayPage(allowed[3][2]), "official Vimeo replays embed");

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
assert.match(pageSource, /target="_blank"/);
assert.match(pageSource, /rel="noopener noreferrer"/);
// The page may render an inline player, but only with same-origin proxied
// stream capabilities — raw provider stream URLs must never reach the client.
assert.match(pageSource, /const replayStreamUrl = proxiedStreamPath\(/);
assert.match(pageSource, /const proxiedStream = proxiedStreamPath\(/);
const streamUrlProps = [...pageSource.matchAll(/streamUrl=\{([^}]+)\}/g)].map(
  (match) => match[1],
);
assert.deepEqual(
  [...new Set(streamUrlProps)].sort(),
  ["proxiedStream", "replayStreamUrl"],
  "RaceReplayPlayer must only receive proxied stream paths",
);
assert.doesNotMatch(pageSource, /\bdownload\b/i);
assert.doesNotMatch(
  pageSource,
  /videos\.length === 0/,
  "an invalid RaceVideo row must not hide a valid legacy replay URL",
);
assert.match(
  pageSource,
  /replayCandidate\?\.officialUrl \?\?\s+officialRaceReplayUrl\(/,
);
assert.match(pageSource, /safePhotoFinishSrc\(race\.photoFinishUrl\)/);
assert.match(pageSource, /Official photo finish/);

console.log("official race replay source checks passed");
