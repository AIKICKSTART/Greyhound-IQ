import assert from "node:assert/strict";

import {
  authorisedReplayStreamPath,
  isReplayProxyAuthorised,
} from "./replay-rights";

assert.equal(
  isReplayProxyAuthorised({
    jurisdiction: "SA",
    sourceProvider: "greyhound-racing-sa",
    now: new Date("2026-07-24T00:00:00Z"),
  }),
  false,
);

assert.equal(
  authorisedReplayStreamPath({
    jurisdiction: "SA",
    sourceProvider: "greyhound-racing-sa",
    streamUrl: "https://example.com/race.m3u8",
    now: new Date("2026-07-24T00:00:00Z"),
  }),
  null,
);

console.log("replay rights tests passed");
