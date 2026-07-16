import assert from "node:assert/strict";

import {
  listingPatchSchema,
  listingWriteSchema,
} from "./listing-validation";

const write = listingWriteSchema.parse({
  type: "wanted",
  title: "  Racing gear wanted  ",
  description: "  Looking for safe, well maintained racing equipment.  ",
});
assert.equal(write.title, "Racing gear wanted");
assert.equal(write.negotiable, false);
assert.equal(write.contactPreference, "message");
assert.deepEqual(write.mediaIds, []);

assert.equal(listingPatchSchema.safeParse({}).success, false);
assert.equal(
  listingPatchSchema.safeParse({ title: "Updated listing title" }).success,
  true,
);
assert.deepEqual(listingPatchSchema.parse({ negotiable: true }), {
  negotiable: true,
});
assert.deepEqual(listingPatchSchema.parse({ mediaIds: [] }), { mediaIds: [] });
assert.equal(
  listingPatchSchema.safeParse({
    title: "Updated listing title",
    providerSecret: "must-not-be-accepted",
  }).success,
  false,
);
assert.equal(
  listingPatchSchema.safeParse({ mediaIds: Array(12).fill("media-id") }).success,
  false,
);

console.log(
  "Listing validation passed: create defaults stay create-only while PATCH is strict, non-empty, bounded, and preserves omitted fields.",
);
