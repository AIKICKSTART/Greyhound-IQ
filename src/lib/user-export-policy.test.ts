import assert from "node:assert/strict";
import {
  assertUserExportCollections,
  assertUserExportDto,
  assertUserExportSize,
  USER_EXPORT_CACHE_CONTROL,
  USER_EXPORT_COLLECTION_LIMIT,
  USER_EXPORT_MAX_BYTES,
} from "./user-export-policy";

assert.equal(USER_EXPORT_CACHE_CONTROL, "private, no-store");

assert.doesNotThrow(() =>
  assertUserExportDto({
    profile: { displayName: "Example member" },
    messages: [{ body: "User-visible content" }],
    media: [{ mimeType: "image/webp", sizeBytes: 42 }],
  })
);
for (const field of [
  "workosUserId",
  "stripeCustomerId",
  "storagePath",
  "metadataJson",
  "inputJson",
  "toolInvocations",
]) {
  assert.throws(
    () => assertUserExportDto({ nested: [{ [field]: "private" }] }),
    /export\.forbidden_field/
  );
}

assert.throws(
  () =>
    assertUserExportCollections({
      messages: Array.from({ length: USER_EXPORT_COLLECTION_LIMIT + 1 }),
    }),
  /export\.too_large/
);
assert.throws(
  () => assertUserExportSize("x".repeat(USER_EXPORT_MAX_BYTES + 1)),
  /export\.too_large/
);

console.log("user export policy tests passed");
