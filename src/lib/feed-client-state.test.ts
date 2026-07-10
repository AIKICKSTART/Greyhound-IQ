import assert from "node:assert/strict";

import { mergeFeedItems } from "./feed-client-state";

const current = [
  { id: "head", value: 1 },
  { id: "older", value: 1 },
];

assert.deepEqual(mergeFeedItems(current, [{ id: "new", value: 1 }]), [
  { id: "new", value: 1 },
  { id: "head", value: 1 },
  { id: "older", value: 1 },
]);
assert.deepEqual(mergeFeedItems(current, [{ id: "head", value: 2 }]), [
  { id: "head", value: 2 },
  { id: "older", value: 1 },
]);
assert.deepEqual(
  mergeFeedItems(current, [], "older", { id: "older", value: 2 }),
  [
    { id: "head", value: 1 },
    { id: "older", value: 2 },
  ]
);
assert.deepEqual(
  mergeFeedItems(current, [{ id: "head", value: 2 }], "head", null),
  [{ id: "older", value: 1 }]
);
assert.deepEqual(
  mergeFeedItems(
    [
      { id: "source", feedEntryId: "post:source", value: "old" },
      { id: "source", feedEntryId: "share:one", value: "shared" },
    ],
    [
      { id: "source", feedEntryId: "share:one", value: "shared" },
      { id: "source", feedEntryId: "post:source", value: "new" },
    ],
    "source",
    { id: "source", feedEntryId: "post:source", value: "changed" }
  ),
  [
    { id: "source", feedEntryId: "share:one", value: "shared" },
    { id: "source", feedEntryId: "post:source", value: "changed" },
  ]
);

console.log("feed client state tests passed");
