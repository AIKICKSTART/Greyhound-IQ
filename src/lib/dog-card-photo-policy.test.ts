import assert from "node:assert/strict";
import path from "node:path";

import {
  assertDogCardPhotoSize,
  MAX_DOG_CARD_SOURCE_BYTES,
  resolveBundledDogCardPhotoPath,
} from "./dog-card-photo-policy";

assert.equal(
  resolveBundledDogCardPhotoPath("/images/demo/dog.webp", "C:/app"),
  path.resolve("C:/app", "public/images/demo/dog.webp"),
);
for (const value of [
  "https://attacker.example/dog.png",
  "/api/media/secret",
  "/images/../secret.png",
  "/images/%2e%2e/secret.png",
  "/images/dog.svg",
  "/images/dog.png?redirect=http://127.0.0.1",
  "\\images\\dog.png",
]) {
  assert.throws(() => resolveBundledDogCardPhotoPath(value, "C:/app"));
}

assert.doesNotThrow(() => assertDogCardPhotoSize(1024, 1024));
assert.throws(() => assertDogCardPhotoSize(0));
assert.throws(() => assertDogCardPhotoSize(MAX_DOG_CARD_SOURCE_BYTES + 1));
assert.throws(() => assertDogCardPhotoSize(1024, 2048));

console.log("dog-card photo policy tests passed");
