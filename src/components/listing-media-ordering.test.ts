import assert from "node:assert/strict";

import {
  moveMediaItem,
  promoteMediaItem,
} from "./media-attachment-fields";

const media = [
  { key: "first", id: "media-1" },
  { key: "second", id: "media-2" },
  { key: "third", id: "media-3" },
] as const;

assert.deepEqual(
  moveMediaItem(media, "second", -1).map(({ key }) => key),
  ["second", "first", "third"],
);
assert.deepEqual(
  moveMediaItem(media, "second", 1).map(({ key }) => key),
  ["first", "third", "second"],
);
assert.deepEqual(
  moveMediaItem(media, "first", -1).map(({ key }) => key),
  ["first", "second", "third"],
);
assert.deepEqual(
  promoteMediaItem(media, "third").map(({ key }) => key),
  ["third", "first", "second"],
);
assert.deepEqual(
  promoteMediaItem(media, "missing").map(({ key }) => key),
  ["first", "second", "third"],
);

console.log(
  "Listing media ordering passed: boundary-safe earlier/later moves and explicit primary promotion preserve a deterministic submitted order.",
);
