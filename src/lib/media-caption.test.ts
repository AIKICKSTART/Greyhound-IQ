import assert from "node:assert/strict";

import {
  mediaMetadataUpdateSchema,
  readWebVttUpload,
  validateWebVttCaption,
  WEBVTT_MAX_BYTES,
} from "./media-validation";

const encoder = new TextEncoder();
const validCaption = `WEBVTT

00:00.000 --> 00:02.500
The greyhound leaves the boxes.
`;

assert.doesNotThrow(() => validateWebVttCaption(encoder.encode(validCaption)));
assert.doesNotThrow(() =>
  validateWebVttCaption(
    encoder.encode(
      "\uFEFFWEBVTT Race captions\r\n\r\n1\r\n00:00:01.000 --> 00:00:03.000 align:start\r\nFirst bend.\r\n"
    )
  )
);
assert.throws(() => validateWebVttCaption(encoder.encode("not captions")));
assert.throws(() =>
  validateWebVttCaption(encoder.encode("WEBVTT\n00:00.000 --> 00:01.000\nText\n"))
);
assert.throws(() =>
  validateWebVttCaption(encoder.encode("WEBVTT\n\n00:02.000 --> 00:01.000\nText\n"))
);
assert.throws(() =>
  validateWebVttCaption(encoder.encode("WEBVTT\n\n00:00.000 --> 00:01.000\n"))
);
assert.throws(() => validateWebVttCaption(Uint8Array.of(0xff, 0xfe, 0xfd)));
assert.throws(() =>
  validateWebVttCaption(new Uint8Array(WEBVTT_MAX_BYTES + 1))
);
assert.throws(() =>
  mediaMetadataUpdateSchema.parse({ captionPath: "users/someone/processed/file.vtt" })
);

async function testUploadBoundary() {
  const upload = await readWebVttUpload(
    new Request("https://greyhoundiq.test/caption", {
      method: "PUT",
      headers: { "Content-Type": "text/vtt; charset=utf-8" },
      body: validCaption,
    })
  );
  assert.equal(new TextDecoder().decode(upload), validCaption);
  await assert.rejects(() =>
    readWebVttUpload(
      new Request("https://greyhoundiq.test/caption", {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: validCaption,
      })
    )
  );
  await assert.rejects(() =>
    readWebVttUpload(
      new Request("https://greyhoundiq.test/caption", {
        method: "PUT",
        headers: {
          "Content-Type": "text/vtt",
          "Content-Length": String(WEBVTT_MAX_BYTES + 1),
        },
        body: validCaption,
      })
    )
  );
}

void testUploadBoundary()
  .then(() => console.log("media-caption tests passed"))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
