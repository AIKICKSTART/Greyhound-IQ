import assert from "node:assert/strict";

import { extractMentionHandles } from "./feed-mentions";

assert.deepEqual(
  extractMentionHandles("Thanks @track-team and @Track-Team. Email a@b.test."),
  ["track-team"]
);
assert.deepEqual(extractMentionHandles("@a is too short, @valid_name works"), [
  "valid_name",
]);
assert.deepEqual(extractMentionHandles("No mentions here"), []);

console.log("feed mention tests passed");
