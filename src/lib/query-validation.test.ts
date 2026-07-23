import assert from "node:assert/strict";

import {
  directorySearchQuerySchema,
  feedCommentPageQuerySchema,
  feedPageQuerySchema,
  listingApiQuerySchema,
  listingCreatePrefillQuerySchema,
  messageSearchQuerySchema,
  messageThreadQuerySchema,
  queryParamsObject,
} from "./query-validation";

assert.deepEqual(listingCreatePrefillQuerySchema.parse({}), {});
assert.deepEqual(
  listingCreatePrefillQuerySchema.parse({
    dogId: "dog_123",
    title: "  Fast   greyhound  ",
    price: "12500.50",
  }),
  { dogId: "dog_123", title: "Fast greyhound", price: "12500.50" },
);
for (const invalid of [
  { dogId: "../dog" },
  { dogId: ["dog_1", "dog_2"] },
  { title: "x".repeat(101) },
  { price: "-1" },
  { price: "Infinity" },
  { price: "100.999" },
]) {
  assert.equal(listingCreatePrefillQuerySchema.safeParse(invalid).success, false);
}

assert.deepEqual(directorySearchQuerySchema.parse({ q: "  box   dog " }), {
  q: "box dog",
  limit: 20,
});
assert.deepEqual(
  directorySearchQuerySchema.parse({
    q: "  Fernando   Bale ",
    limit: "8",
    breeding: "1",
  }),
  { q: "Fernando Bale", limit: 8, breeding: "1" },
);
assert.equal(
  directorySearchQuerySchema.safeParse({ q: "x".repeat(81) }).success,
  false,
);

assert.deepEqual(feedPageQuerySchema.parse({}), {
  mode: "public",
  limit: 20,
});
assert.deepEqual(
  feedPageQuerySchema.parse({ mode: "friends", cursor: "abc_DEF-123", limit: "50" }),
  { mode: "friends", cursor: "abc_DEF-123", limit: 50 },
);
assert.equal(feedPageQuerySchema.parse({ mode: "for-you" }).mode, "public");
assert.equal(feedPageQuerySchema.parse({ mode: "latest" }).mode, "public");
assert.equal(feedPageQuerySchema.safeParse({ limit: "51" }).success, false);
assert.equal(feedPageQuerySchema.safeParse({ cursor: "=".repeat(20) }).success, false);

assert.deepEqual(feedCommentPageQuerySchema.parse({ limit: "1" }), { limit: 1 });
assert.equal(
  feedCommentPageQuerySchema.safeParse({ cursor: "bad cursor" }).success,
  false,
);

assert.deepEqual(messageSearchQuerySchema.parse({ q: "  kennel   note " }), {
  q: "kennel note",
  limit: 20,
});
assert.equal(messageSearchQuerySchema.safeParse({ before: "../message" }).success, false);
assert.deepEqual(messageThreadQuerySchema.parse({ call: "voice", q: "hi" }), {
  call: "voice",
  q: "hi",
});
assert.equal(messageThreadQuerySchema.safeParse({ call: "unknown" }).success, false);

assert.deepEqual(
  listingApiQuerySchema.parse({
    limit: "25",
    type: "dog_for_sale",
    state: "NSW",
    category: "dogs-for-sale",
    q: "  racer  ",
  }),
  {
    limit: 25,
    type: "dog_for_sale",
    state: "NSW",
    category: "dogs-for-sale",
    q: "racer",
  },
);
assert.equal(listingApiQuerySchema.safeParse({ state: "XX" }).success, false);
assert.equal(listingApiQuerySchema.safeParse({ unknown: "value" }).success, false);

const duplicateParams = new URLSearchParams("q=one&q=two&limit=20");
assert.deepEqual(queryParamsObject(duplicateParams), {
  q: ["one", "two"],
  limit: "20",
});
assert.equal(directorySearchQuerySchema.safeParse(queryParamsObject(duplicateParams)).success, false);

console.log(
  "Query validation passed: listing prefills, directory search, feed/message cursors, limits, and marketplace filters reject malformed, repeated, unknown, and overlong values.",
);
