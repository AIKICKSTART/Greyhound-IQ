import assert from "node:assert/strict";

import {
  authorisedReplayStreamPath,
  isReplayProxyAuthorised,
} from "./replay-rights";

const originalTheDogsApproval = process.env.THEDOGS_LICENSED_USE_APPROVED;
process.env.THEDOGS_LICENSED_USE_APPROVED = "true";
process.env.REPLAY_PROXY_SECRET ||= "test-secret-for-replay-rights-validation";

assert.equal(
  isReplayProxyAuthorised({
    jurisdiction: "NSW",
    sourceProvider: "thedogs",
    now: new Date("2026-07-24T00:00:00Z"),
  }),
  true,
);
assert.match(
  authorisedReplayStreamPath({
    jurisdiction: "NSW",
    sourceProvider: "thedogs",
    streamUrl: "https://d2w8yyjcswa0zt.cloudfront.net/race.m3u8",
    now: new Date("2026-07-24T00:00:00Z"),
  }) ?? "",
  /^\/api\/replay\/stream\?t=/,
);
assert.equal(
  isReplayProxyAuthorised({
    jurisdiction: "ACT",
    sourceProvider: "thedogs",
    now: new Date("2026-07-24T00:00:00Z"),
  }),
  true,
);
assert.equal(
  isReplayProxyAuthorised({
    jurisdiction: "VIC",
    sourceProvider: "thedogs",
    now: new Date("2026-07-24T00:00:00Z"),
  }),
  false,
);

delete process.env.THEDOGS_LICENSED_USE_APPROVED;
assert.equal(
  isReplayProxyAuthorised({
    jurisdiction: "NSW",
    sourceProvider: "thedogs",
    now: new Date("2026-07-24T00:00:00Z"),
  }),
  false,
);

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

if (originalTheDogsApproval === undefined) {
  delete process.env.THEDOGS_LICENSED_USE_APPROVED;
} else {
  process.env.THEDOGS_LICENSED_USE_APPROVED = originalTheDogsApproval;
}

console.log("replay rights tests passed");
