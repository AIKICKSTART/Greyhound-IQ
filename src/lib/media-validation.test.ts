import assert from "node:assert/strict";

import {
  MEDIA_MAX_DIMENSION_PX,
  MEDIA_MAX_DURATION_SEC,
  mediaSignUploadSchema,
  uploadFilenameMatchesMimeType,
  validateDecodedMediaMetadata,
} from "./media-validation";

assert.equal(uploadFilenameMatchesMimeType("race-card.JPG", "image/jpeg"), true);
assert.equal(uploadFilenameMatchesMimeType("voice-note.m4a", "audio/mp4"), true);
assert.equal(uploadFilenameMatchesMimeType("race-card.exe", "image/jpeg"), false);
assert.equal(uploadFilenameMatchesMimeType("race-card", "image/jpeg"), false);

assert.equal(
  mediaSignUploadSchema.safeParse({
    filename: "race-card.png",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
  }).success,
  false,
);
assert.equal(
  mediaSignUploadSchema.safeParse({
    filename: "payload.zip",
    mimeType: "application/zip",
    sizeBytes: 1024,
  }).success,
  false,
);
assert.equal(
  mediaSignUploadSchema.parse({
    filename: "..\\private\\race card.JPEG",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
  }).filename,
  "race-card.JPEG",
);

assert.doesNotThrow(() =>
  validateDecodedMediaMetadata(
    "image",
    { width: MEDIA_MAX_DIMENSION_PX, height: 1080 },
    { width: MEDIA_MAX_DIMENSION_PX, height: 1080 },
  ),
);
assert.doesNotThrow(() =>
  validateDecodedMediaMetadata(
    "video",
    { width: 1920, height: 1080, durationSec: MEDIA_MAX_DURATION_SEC },
    { width: 1920, height: 1080, durationSec: MEDIA_MAX_DURATION_SEC - 1 },
  ),
);
assert.doesNotThrow(() =>
  validateDecodedMediaMetadata(
    "audio",
    { durationSec: 30.5 },
    { durationSec: 31.5 },
  ),
);

for (const decoded of [
  { width: MEDIA_MAX_DIMENSION_PX + 1, height: 1 },
  { width: 1, height: MEDIA_MAX_DIMENSION_PX + 1 },
]) {
  assert.throws(
    () => validateDecodedMediaMetadata("image", decoded),
    /media\.dimensions_exceeded/,
  );
}
for (const decoded of [
  {},
  { width: 0, height: 100 },
  { width: 100, height: Number.NaN },
  { width: Number.POSITIVE_INFINITY, height: 100 },
  { width: 100.5, height: 100 },
]) {
  assert.throws(
    () => validateDecodedMediaMetadata("image", decoded),
    /media\.decoded_metadata_invalid/,
  );
}
for (const durationSec of [
  undefined,
  0,
  Number.NaN,
  Number.POSITIVE_INFINITY,
]) {
  assert.throws(
    () => validateDecodedMediaMetadata("audio", { durationSec }),
    /media\.decoded_metadata_invalid/,
  );
}
assert.throws(
  () =>
    validateDecodedMediaMetadata("video", {
      width: 1920,
      height: 1080,
      durationSec: MEDIA_MAX_DURATION_SEC + 0.001,
    }),
  /media\.duration_exceeded/,
);
assert.throws(
  () =>
    validateDecodedMediaMetadata(
      "image",
      { width: MEDIA_MAX_DIMENSION_PX + 1, height: 1080 },
      { width: 1, height: 1 },
    ),
  /media\.dimensions_exceeded/,
);
assert.throws(
  () =>
    validateDecodedMediaMetadata(
      "image",
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
    ),
  /media\.metadata_mismatch/,
);
assert.throws(
  () =>
    validateDecodedMediaMetadata(
      "video",
      { width: 1920, height: 1080, durationSec: 30 },
      { durationSec: 31.001 },
    ),
  /media\.metadata_mismatch/,
);
assert.throws(
  () =>
    validateDecodedMediaMetadata(
      "audio",
      { durationSec: 30 },
      { width: 1 },
    ),
  /media\.metadata_mismatch/,
);
assert.throws(
  () =>
    validateDecodedMediaMetadata(
      "image",
      { width: 1920, height: 1080 },
      { durationSec: 1 },
    ),
  /media\.metadata_mismatch/,
);

console.log(
  "media validation tests passed: upload names and decoded dimension/duration metadata fail closed",
);
