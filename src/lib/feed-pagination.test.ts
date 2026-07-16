import assert from "node:assert/strict";
import {
  compareFeedCandidates,
  cursorForCandidate,
  decodeFeedCursor,
  encodeFeedCursor,
  feedRankBucket,
  isAfterFeedCursor,
  type FeedRankCandidate,
} from "./feed-pagination";

const now = new Date("2026-07-10T00:00:00.000Z");
const base = {
  createdAt: new Date("2026-07-09T00:00:00.000Z"),
  pinnedAt: null,
  connectedActor: false,
  followedTopic: false,
};
const candidates: FeedRankCandidate[] = [
  { ...base, id: "post:other" },
  { ...base, id: "post:topic", followedTopic: true },
  { ...base, id: "post:connected", connectedActor: true },
  {
    ...base,
    id: "post:pinned",
    pinnedAt: new Date("2026-07-08T00:00:00.000Z"),
  },
];

assert.deepEqual(
  candidates.toSorted((a, b) => compareFeedCandidates(a, b, "for-you", now)).map((row) => row.id),
  ["post:pinned", "post:connected", "post:topic", "post:other"]
);
assert.equal(feedRankBucket(candidates[0]), 3);

const cursor = cursorForCandidate(candidates[1], "for-you", now);
const encoded = encodeFeedCursor(cursor);
assert.deepEqual(decodeFeedCursor(encoded, "for-you"), cursor);
assert.equal(
  decodeFeedCursor(
    encodeFeedCursor({ ...cursor, id: "legacy-post-id" }),
    "for-you"
  )?.id,
  "post:legacy-post-id"
);
assert.equal(isAfterFeedCursor(candidates[0], cursor, now), true);
assert.throws(() => decodeFeedCursor(encoded, "latest"), /feed\.invalid_cursor/);
assert.throws(() => decodeFeedCursor("not-json", "for-you"), /feed\.invalid_cursor/);

const sourcePost: FeedRankCandidate = {
  ...base,
  id: "post:source",
  createdAt: new Date("2026-07-08T00:00:00.000Z"),
};
const reshare: FeedRankCandidate = {
  ...base,
  id: "share:reshare",
  createdAt: new Date("2026-07-09T12:00:00.000Z"),
  connectedActor: true,
};
assert.deepEqual(
  [sourcePost, reshare]
    .toSorted((a, b) => compareFeedCandidates(a, b, "latest", now))
    .map((row) => row.id),
  ["share:reshare", "post:source"]
);
assert.equal(
  isAfterFeedCursor(sourcePost, cursorForCandidate(reshare, "for-you", now), now),
  true
);

console.log("feed pagination tests passed");
